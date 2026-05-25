import { getCurrentUser } from "@/lib/session";
import { maybeGrantDaily } from "@/lib/economy";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await getCurrentUser();
  if (!u) return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  await maybeGrantDaily(u.id);
  const fresh = await prisma.user.findUnique({
    where: { id: u.id },
    select: {
      id: true,
      phoneNumber: true,
      displayName: true,
      points: true,
      createdAt: true,
    },
  });

  // Portfolio totals.
  const [invs, divs] = await Promise.all([
    prisma.investment.aggregate({
      where: { userId: u.id },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.dividend.aggregate({
      where: { receiverUserId: u.id },
      _sum: { amount: true },
    }),
  ]);

  return Response.json({
    ok: true,
    user: fresh,
    portfolio: {
      totalInvested: invs._sum.amount ?? 0,
      investmentsCount: invs._count._all ?? 0,
      totalDividends: divs._sum.amount ?? 0,
    },
  });
}
