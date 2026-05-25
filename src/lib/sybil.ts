import { prisma } from "@/lib/prisma";

// "How many distinct users have we seen on this same device fingerprint?"
// > 1 is a yellow flag, > 3 is a strong red flag. Doesn't *block* on its
// own — it raises suspicionScore and tightens caps in lib/invest.ts.
export async function distinctUsersOnFingerprint(fp: string | null): Promise<number> {
  if (!fp) return 1;
  const rows = await prisma.deviceLink.groupBy({
    by: ["userId"],
    where: { deviceFingerprint: fp },
  });
  return rows.length;
}

// Quick heuristic suspicion score (0..1) for a given user. Cheap to call;
// callers should pass userId only when they need a fresh value (e.g.,
// before allowing an invest action). Persistent score lives on User.
export async function computeSuspicion(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, points: true },
  });
  if (!user) return 1;

  const ageDays = (Date.now() - user.createdAt.getTime()) / 86_400_000;

  const [investsOnSelfPlaces, deviceFps] = await Promise.all([
    // How many of this user's invests landed in places they themselves
    // created? Some self-investment is fine; high ratios are wash-trading.
    prisma.$queryRaw<{ ratio: number }[]>`
      SELECT COALESCE(
        SUM(CASE WHEN p."createdById" = ${userId} THEN 1 ELSE 0 END)::float /
          NULLIF(COUNT(*)::float, 0),
        0
      ) AS ratio
      FROM "Investment" i
      JOIN "Place" p ON p.id = i."placeId"
      WHERE i."userId" = ${userId}
    `,
    prisma.deviceLink.findMany({
      where: { userId },
      select: { deviceFingerprint: true },
    }),
  ]);

  let s = 0;

  // Brand-new accounts get a small starting suspicion that decays.
  if (ageDays < 1) s += 0.2;

  const selfRatio = investsOnSelfPlaces[0]?.ratio ?? 0;
  if (selfRatio > 0.6) s += 0.5;
  else if (selfRatio > 0.3) s += 0.2;

  // Shared fingerprints: if any of this user's fingerprints is also linked
  // to another user, raise suspicion proportionally.
  for (const link of deviceFps) {
    const distinct = await distinctUsersOnFingerprint(link.deviceFingerprint);
    if (distinct >= 4) {
      s += 0.4;
      break;
    } else if (distinct >= 2) {
      s += 0.2;
    }
  }

  return Math.min(1, s);
}
