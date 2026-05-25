import { prisma } from "@/lib/prisma";
import { listInvestors, userEquity } from "@/lib/invest";
import { getCurrentUser } from "@/lib/session";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const place = await prisma.place.findUnique({
    where: { id },
    select: {
      id: true,
      primaryName: true,
      category: true,
      centroidLat: true,
      centroidLng: true,
      radiusMeters: true,
      confidence: true,
      visitCount: true,
      totalInvestment: true,
      investorCount: true,
      recentInvestSum: true,
      mergedIntoId: true,
      createdAt: true,
      createdById: true,
    },
  });
  if (!place) {
    return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  // Follow merge redirect.
  if (place.mergedIntoId) {
    return Response.json({ ok: true, redirectTo: place.mergedIntoId });
  }

  const investors = await listInvestors(id);
  const me = await getCurrentUser();
  const myEquity = me ? await userEquity(me.id, id) : 0;

  return Response.json({
    ok: true,
    place,
    investors,
    me: me ? { id: me.id, points: me.points, equity: myEquity } : null,
  });
}
