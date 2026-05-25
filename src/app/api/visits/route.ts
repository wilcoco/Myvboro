import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeTier } from "@/lib/scoring";
import { recomputePlaceAggregates } from "@/lib/places";

const PhotoSchema = z.object({
  kind: z.enum(["STOREFRONT", "MENU", "FOOD", "INTERIOR", "RECEIPT"]),
  url: z.string().url(),
  takenInApp: z.boolean().optional(),
  exifTime: z.string().datetime().optional(),
  exifLat: z.number().optional(),
  exifLng: z.number().optional(),
});

const BodySchema = z.object({
  // attach to existing Place, or create new with rawName
  placeId: z.string().optional(),
  rawName: z.string().min(1).max(120),
  category: z.string().max(60).optional(),

  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  gpsAccuracy: z.number().min(0).optional(),
  dwellTimeSec: z.number().int().min(0).optional(),

  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(2000).optional(),

  photos: z.array(PhotoSchema).max(8).default([]),
  visitedAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const hasStorefront = body.photos.some((p) => p.kind === "STOREFRONT");
  const anyInApp = body.photos.some((p) => p.takenInApp);
  const { tier, weight } = computeTier({
    hasGps: true,
    gpsAccuracyMeters: body.gpsAccuracy ?? null,
    dwellTimeSec: body.dwellTimeSec ?? null,
    hasStorefrontPhoto: hasStorefront,
    takenInApp: anyInApp,
  });

  // Resolve placeId: either an existing Place, or create one rooted at
  // this visit's GPS. The choice is the user's — they saw nearby
  // candidates client-side and either picked one or opted for "new".
  let placeId = body.placeId;
  if (!placeId) {
    const created = await prisma.place.create({
      data: {
        primaryName: body.rawName,
        category: body.category ?? null,
        aliases: [{ name: body.rawName, count: 1, lang: "auto" }],
        centroidLat: body.lat,
        centroidLng: body.lng,
        radiusMeters: Math.max(15, Math.min(150, body.gpsAccuracy ?? 60)),
        confidence: 0.3,
      },
    });
    placeId = created.id;
  } else {
    // Make sure it exists (and isn't soft-merged away).
    const existing = await prisma.place.findUnique({
      where: { id: placeId },
      select: { id: true, mergedIntoId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "place not found" }, { status: 404 });
    }
    if (existing.mergedIntoId) placeId = existing.mergedIntoId;
  }

  const visit = await prisma.visit.create({
    data: {
      userId: session.user.id,
      placeId,
      rawName: body.rawName,
      lat: body.lat,
      lng: body.lng,
      gpsAccuracy: body.gpsAccuracy ?? null,
      dwellTimeSec: body.dwellTimeSec ?? null,
      tier,
      weight,
      comment: body.comment ?? null,
      rating: body.rating ?? null,
      visitedAt: body.visitedAt ? new Date(body.visitedAt) : new Date(),
      photos: {
        create: body.photos.map((p) => ({
          kind: p.kind,
          url: p.url,
          takenInApp: p.takenInApp ?? false,
          exifTime: p.exifTime ? new Date(p.exifTime) : null,
          exifLat: p.exifLat ?? null,
          exifLng: p.exifLng ?? null,
        })),
      },
    },
    include: { photos: true },
  });

  await recomputePlaceAggregates(placeId);

  // If this user had pending endorsements (queue-ups) for this place,
  // attach this visit to them and return them so the client can prompt
  // for satisfaction ratings — that closes the 4-step endorsement loop.
  const pending = await prisma.endorsement.findMany({
    where: {
      toUserId: session.user.id,
      placeId,
      visitId: null,
      satisfaction: null,
    },
    include: {
      fromUser: { select: { id: true, name: true, image: true } },
    },
  });
  if (pending.length > 0) {
    await prisma.endorsement.updateMany({
      where: { id: { in: pending.map((p) => p.id) } },
      data: { visitId: visit.id, visitedAt: visit.visitedAt },
    });
  }

  return NextResponse.json({ visit, placeId, pendingEndorsements: pending });
}
