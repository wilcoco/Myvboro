import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { findNearbyPlaces, findPlacesInBbox } from "@/lib/places";
import { env } from "@/lib/env";
import { investInPlace } from "@/lib/invest";

const PostBody = z.object({
  primaryName: z.string().min(1).max(80),
  category: z.string().max(40).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  // Optional: first investment that bootstraps the place. Defaults to
  // env.placeCreateCost so creators always have skin in the game.
  initialInvestment: z.number().int().nonnegative().optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bboxParam = url.searchParams.get("bbox");
  if (bboxParam) {
    const [minLng, minLat, maxLng, maxLat] = bboxParam.split(",").map(Number);
    if ([minLng, minLat, maxLng, maxLat].some((n) => !Number.isFinite(n))) {
      return Response.json({ ok: false, error: "BAD_BBOX" }, { status: 400 });
    }
    const places = await findPlacesInBbox({ minLng, minLat, maxLng, maxLat });
    return Response.json({ ok: true, places });
  }

  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ ok: false, error: "BAD_COORDS" }, { status: 400 });
  }
  const radius = Number(url.searchParams.get("r")) || 200;
  const places = await findNearbyPlaces({ lat, lng, radiusMeters: radius });
  return Response.json({ ok: true, places });
}

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "INVALID", detail: parsed.error.format() }, { status: 400 });
  }

  const seed = parsed.data.initialInvestment ?? env.placeCreateCost;
  if (user.points < seed) {
    return Response.json(
      { ok: false, error: "INSUFFICIENT_POINTS", need: seed, have: user.points },
      { status: 400 },
    );
  }

  // Create the place first, then bootstrap with an initial investment from
  // the creator. Both inside one transaction wouldn't help much because
  // investInPlace has its own transaction; doing them sequentially is fine
  // since the worst case is an orphan zero-investment place (recoverable).
  const place = await prisma.place.create({
    data: {
      primaryName: parsed.data.primaryName,
      category: parsed.data.category,
      centroidLat: parsed.data.lat,
      centroidLng: parsed.data.lng,
      createdById: user.id,
    },
    select: { id: true },
  });

  if (seed > 0) {
    const invResult = await investInPlace({
      userId: user.id,
      placeId: place.id,
      amount: seed,
    });
    if (!invResult.ok) {
      // Roll back the place to keep the DB tidy.
      await prisma.place.delete({ where: { id: place.id } }).catch(() => undefined);
      return Response.json({ ok: false, error: invResult.reason }, { status: 400 });
    }
  }

  return Response.json({ ok: true, placeId: place.id });
}
