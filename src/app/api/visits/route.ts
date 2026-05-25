import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { computeTier, recomputePlaceAggregates } from "@/lib/scoring";

const Body = z.object({
  placeId: z.string().cuid().optional(),
  rawName: z.string().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  gpsAccuracy: z.number().nonnegative().optional(),
  dwellTimeSec: z.number().int().nonnegative().optional(),
  takenInApp: z.boolean().optional(),
  hasStorefrontPhoto: z.boolean().optional(),
  comment: z.string().max(2000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  visitedAt: z.string().datetime(),
});

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "INVALID" }, { status: 400 });
  }
  const d = parsed.data;

  const { tier, weight } = computeTier({
    hasGps: Number.isFinite(d.lat) && Number.isFinite(d.lng),
    gpsAccuracyMeters: d.gpsAccuracy ?? null,
    dwellTimeSec: d.dwellTimeSec ?? null,
    hasStorefrontPhoto: Boolean(d.hasStorefrontPhoto),
    takenInApp: Boolean(d.takenInApp),
  });

  const visit = await prisma.visit.create({
    data: {
      userId: user.id,
      placeId: d.placeId,
      rawName: d.rawName,
      lat: d.lat,
      lng: d.lng,
      gpsAccuracy: d.gpsAccuracy,
      dwellTimeSec: d.dwellTimeSec,
      comment: d.comment,
      rating: d.rating,
      tier,
      weight,
      visitedAt: new Date(d.visitedAt),
    },
    select: { id: true, placeId: true },
  });

  if (visit.placeId) {
    await recomputePlaceAggregates(visit.placeId);
  }

  return Response.json({ ok: true, visitId: visit.id, tier, weight });
}
