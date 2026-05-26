import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { computeSuspicion } from "@/lib/sybil";

// =========================================================================
// VC-style seed-dilution mechanic.
//
//   pool_before  = Place.totalInvestment at the moment the new invest lands
//   for each existing Investment row i on the same Place:
//     dividend_to_i = floor( newAmount * i.amount / pool_before )
//   place.totalInvestment += newAmount
//   user.points -= newAmount   (caller)
//   for each i: i.user.points += dividend_to_i
//
// Equity at any moment = userInvestmentSum / Place.totalInvestment.
// =========================================================================

export type InvestError =
  | "INSUFFICIENT_POINTS"
  | "AMOUNT_TOO_SMALL"
  | "AMOUNT_TOO_LARGE"   // exceeds the per-action share cap
  | "DAILY_CAP"          // user exceeded their daily invest cap
  | "SUSPICIOUS"
  | "PLACE_NOT_FOUND"
  | "ACCOUNT_TOO_YOUNG";

export type InvestResult =
  | { ok: true; investmentId: string; newPool: number; dividends: Array<{ userId: string; amount: number }> }
  | { ok: false; reason: InvestError; detail?: string };

const MIN_INVEST = 10;
// Hard daily cap per user (sum of invest amounts in a UTC day). Pool-share
// cap below is the per-action limit; this is the per-day limit.
const DAILY_CAP_POINTS = 1000;

export async function investInPlace(opts: {
  userId: string;
  placeId: string;
  amount: number;
}): Promise<InvestResult> {
  const { userId, placeId, amount } = opts;

  if (!Number.isInteger(amount) || amount < MIN_INVEST) {
    return { ok: false, reason: "AMOUNT_TOO_SMALL", detail: `min ${MIN_INVEST}` };
  }

  // Pull a fresh suspicion score. We don't block outright at score 1,
  // but we tighten caps and (eventually) require manual review.
  const suspicion = await computeSuspicion(userId);
  if (suspicion >= 0.9) return { ok: false, reason: "SUSPICIOUS" };

  // Account-age gate.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { points: true, createdAt: true },
  });
  if (!user) return { ok: false, reason: "PLACE_NOT_FOUND", detail: "user missing" };

  const ageDays = (Date.now() - user.createdAt.getTime()) / 86_400_000;
  if (ageDays < env.minAccountAgeDaysToInvest) {
    return { ok: false, reason: "ACCOUNT_TOO_YOUNG" };
  }
  if (user.points < amount) return { ok: false, reason: "INSUFFICIENT_POINTS" };

  // Daily cap (UTC day window).
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const todayAgg = await prisma.investment.aggregate({
    where: { userId, investedAt: { gte: dayStart } },
    _sum: { amount: true },
  });
  const usedToday = todayAgg._sum.amount ?? 0;
  if (usedToday + amount > DAILY_CAP_POINTS) {
    return { ok: false, reason: "DAILY_CAP", detail: `used ${usedToday}/${DAILY_CAP_POINTS}` };
  }

  // The whole bookkeeping has to be atomic.
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Serialize concurrent investments on the same place.
      //
      // Under Prisma's default READ COMMITTED isolation, two transactions
      // doing `findUnique` on the same Place row would both see the same
      // `totalInvestment`, both compute dividends against that snapshot,
      // and both write back absolute values — the second commit would
      // overwrite the first's increment, dropping its principal from the
      // pool. SELECT ... FOR UPDATE acquires a row-level lock that other
      // invest transactions on this place wait on until we commit, so the
      // "pool before me" snapshot the dividend math depends on is the
      // real, current pool.
      await tx.$queryRaw`SELECT id FROM "Place" WHERE id = ${placeId} FOR UPDATE`;

      const place = await tx.place.findUnique({
        where: { id: placeId },
        select: { id: true, totalInvestment: true, investorCount: true, mergedIntoId: true },
      });
      if (!place || place.mergedIntoId) {
        throw new Error("PLACE_NOT_FOUND");
      }

      const poolBefore = place.totalInvestment;
      const shareCap = ageDays < 7 ? env.newAccountMaxShareFraction : env.maxShareFraction;
      // Per-action share cap: investment as fraction of the resulting pool
      // must not exceed shareCap. (For the very first investor pool=0, so
      // they own 100% by definition — that's intended.)
      if (poolBefore > 0) {
        const resultingPool = poolBefore + amount;
        if (amount / resultingPool > shareCap) {
          throw new Error("AMOUNT_TOO_LARGE");
        }
      }

      // 1. Deduct points from investor.
      const updated = await tx.user.update({
        where: { id: userId },
        data: { points: { decrement: amount } },
        select: { points: true },
      });
      if (updated.points < 0) {
        // Shouldn't happen — we checked above — but guard against races.
        throw new Error("INSUFFICIENT_POINTS");
      }

      // 2. Create the Investment row.
      const lockedUntil = new Date(Date.now() + env.lockupDays * 86_400_000);
      const newInvestment = await tx.investment.create({
        data: {
          userId,
          placeId,
          amount,
          poolBeforeInvest: poolBefore,
          lockedUntil,
        },
      });

      // 3. Distribute dividends pro-rata. (Skipped when this is the first
      // investor — there's no one to pay.)
      const dividends: Array<{ userId: string; amount: number }> = [];
      if (poolBefore > 0) {
        // Sum prior investment per user — multiple Investment rows from the
        // same user accumulate equity.
        const priorByUser = await tx.investment.groupBy({
          by: ["userId"],
          where: { placeId, id: { not: newInvestment.id } },
          _sum: { amount: true },
        });

        for (const row of priorByUser) {
          const priorAmount = row._sum.amount ?? 0;
          if (priorAmount <= 0) continue;
          const dividend = Math.floor((amount * priorAmount) / poolBefore);
          if (dividend <= 0) continue;

          // Find one of the receiver's prior Investment rows to attach this
          // Dividend to (audit trail). Use the earliest as canonical.
          const receiverInv = await tx.investment.findFirst({
            where: { placeId, userId: row.userId },
            orderBy: { investedAt: "asc" },
            select: { id: true },
          });
          if (!receiverInv) continue;

          await tx.dividend.create({
            data: {
              causingInvestmentId: newInvestment.id,
              receiverInvestmentId: receiverInv.id,
              receiverUserId: row.userId,
              amount: dividend,
            },
          });
          await tx.user.update({
            where: { id: row.userId },
            data: { points: { increment: dividend } },
          });
          dividends.push({ userId: row.userId, amount: dividend });
        }
      }

      // 4. Update place aggregates.
      const isNewInvestor =
        (await tx.investment.count({
          where: { placeId, userId, id: { not: newInvestment.id } },
        })) === 0;

      // Refresh rolling 7-day window before adding the new amount.
      const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
      const recentAgg = await tx.investment.aggregate({
        where: { placeId, investedAt: { gte: sevenDaysAgo } },
        _sum: { amount: true },
      });

      // Atomic increments — even with the FOR UPDATE lock above, writing
      // absolute values from a JS-side snapshot is the wrong shape for a
      // counter. Increments keep the row well-typed for any future code
      // path that doesn't take the lock.
      await tx.place.update({
        where: { id: placeId },
        data: {
          totalInvestment: { increment: amount },
          investorCount: { increment: isNewInvestor ? 1 : 0 },
          recentInvestSum: recentAgg._sum.amount ?? amount,
          recentInvestUpdatedAt: new Date(),
        },
      });

      return { newInvestment, dividends, newPool: poolBefore + amount };
    });

    return {
      ok: true,
      investmentId: result.newInvestment.id,
      newPool: result.newPool,
      dividends: result.dividends,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (
      msg === "PLACE_NOT_FOUND" ||
      msg === "AMOUNT_TOO_LARGE" ||
      msg === "INSUFFICIENT_POINTS"
    ) {
      return { ok: false, reason: msg };
    }
    throw e;
  }
}

// Compute live equity for a user on a place.
export async function userEquity(userId: string, placeId: string): Promise<number> {
  const [mine, place] = await Promise.all([
    prisma.investment.aggregate({
      where: { userId, placeId },
      _sum: { amount: true },
    }),
    prisma.place.findUnique({ where: { id: placeId }, select: { totalInvestment: true } }),
  ]);
  const pool = place?.totalInvestment ?? 0;
  const mineSum = mine._sum.amount ?? 0;
  if (pool === 0) return 0;
  return mineSum / pool;
}

// Investor breakdown for a place's detail view. Sorted by equity desc.
export type InvestorRow = {
  userId: string;
  displayName: string | null;
  totalInvested: number;
  dividendsReceived: number;
  equity: number;
};

export async function listInvestors(placeId: string): Promise<InvestorRow[]> {
  const [invs, divs, place] = await Promise.all([
    prisma.investment.groupBy({
      by: ["userId"],
      where: { placeId },
      _sum: { amount: true },
    }),
    prisma.dividend.groupBy({
      by: ["receiverUserId"],
      where: { receiverInvestment: { placeId } },
      _sum: { amount: true },
    }),
    prisma.place.findUnique({ where: { id: placeId }, select: { totalInvestment: true } }),
  ]);

  const pool = place?.totalInvestment ?? 0;
  const divMap = new Map(divs.map((d) => [d.receiverUserId, d._sum.amount ?? 0]));

  const users = await prisma.user.findMany({
    where: { id: { in: invs.map((i) => i.userId) } },
    select: { id: true, displayName: true },
  });
  const nameMap = new Map(users.map((u) => [u.id, u.displayName]));

  const rows: InvestorRow[] = invs.map((i) => {
    const invested = i._sum.amount ?? 0;
    return {
      userId: i.userId,
      displayName: nameMap.get(i.userId) ?? null,
      totalInvested: invested,
      dividendsReceived: divMap.get(i.userId) ?? 0,
      equity: pool === 0 ? 0 : invested / pool,
    };
  });

  rows.sort((a, b) => b.equity - a.equity);
  return rows;
}
