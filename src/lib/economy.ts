import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { isoDayUTC } from "@/lib/utils";

// Idempotent daily-grant top-up. Call on each authenticated request that
// would benefit from a fresh balance (e.g., reading the profile).
export async function maybeGrantDaily(userId: string): Promise<void> {
  const today = isoDayUTC();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastDailyGrant: true },
  });
  if (!user || user.lastDailyGrant === today) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      lastDailyGrant: today,
      points: { increment: env.dailyPointsGrant },
    },
  });
}

// Signup grant — call once, right after creating the User row.
export async function grantSignupBonus(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { points: { increment: env.signupPointsGrant } },
  });
}
