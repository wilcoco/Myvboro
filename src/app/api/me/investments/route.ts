import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  // One row per place (aggregate this user's investments + dividends).
  const invs = await prisma.investment.groupBy({
    by: ["placeId"],
    where: { userId: user.id },
    _sum: { amount: true },
    _min: { investedAt: true },
  });

  const divs = await prisma.dividend.groupBy({
    by: ["receiverInvestmentId"],
    where: { receiverUserId: user.id },
    _sum: { amount: true },
  });

  // Need to resolve receiverInvestmentId -> placeId to bucket by place.
  const dividendInvIds = divs.map((d) => d.receiverInvestmentId);
  const invToPlace = dividendInvIds.length
    ? await prisma.investment.findMany({
        where: { id: { in: dividendInvIds } },
        select: { id: true, placeId: true },
      })
    : [];
  const invToPlaceMap = new Map(invToPlace.map((r) => [r.id, r.placeId]));

  const divByPlace = new Map<string, number>();
  for (const d of divs) {
    const placeId = invToPlaceMap.get(d.receiverInvestmentId);
    if (!placeId) continue;
    divByPlace.set(placeId, (divByPlace.get(placeId) ?? 0) + (d._sum.amount ?? 0));
  }

  const placeIds = invs.map((i) => i.placeId);
  const places = await prisma.place.findMany({
    where: { id: { in: placeIds } },
    select: {
      id: true,
      primaryName: true,
      category: true,
      centroidLat: true,
      centroidLng: true,
      totalInvestment: true,
      investorCount: true,
      recentInvestSum: true,
    },
  });
  const placeMap = new Map(places.map((p) => [p.id, p]));

  const rows = invs
    .map((i) => {
      const place = placeMap.get(i.placeId);
      if (!place) return null;
      const invested = i._sum.amount ?? 0;
      const equity = place.totalInvestment > 0 ? invested / place.totalInvestment : 0;
      const dividendsReceived = divByPlace.get(i.placeId) ?? 0;
      return {
        place,
        invested,
        equity,
        dividendsReceived,
        netPosition: dividendsReceived - invested,
        firstInvestedAt: i._min.investedAt,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.invested - a.invested);

  return Response.json({ ok: true, holdings: rows });
}
