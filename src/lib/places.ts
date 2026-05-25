import { prisma } from "@/lib/prisma";

export type NearbyCandidate = {
  id: string;
  primaryName: string;
  category: string | null;
  centroidLat: number;
  centroidLng: number;
  radiusMeters: number;
  confidence: number;
  visitCount: number;
  distanceMeters: number;
};

export async function findNearbyPlaces(opts: {
  lat: number;
  lng: number;
  radiusMeters?: number;
  limit?: number;
}): Promise<NearbyCandidate[]> {
  const radius = opts.radiusMeters ?? 50;
  const limit = opts.limit ?? 10;

  return prisma.$queryRaw<NearbyCandidate[]>`
    SELECT
      "id",
      "primaryName",
      "category",
      "centroidLat",
      "centroidLng",
      "radiusMeters",
      "confidence",
      "visitCount",
      ST_Distance(
        "location",
        ST_SetSRID(ST_MakePoint(${opts.lng}, ${opts.lat}), 4326)::geography
      ) AS "distanceMeters"
    FROM "Place"
    WHERE "mergedIntoId" IS NULL
      AND "location" IS NOT NULL
      AND ST_DWithin(
        "location",
        ST_SetSRID(ST_MakePoint(${opts.lng}, ${opts.lat}), 4326)::geography,
        ${radius}
      )
    ORDER BY "distanceMeters" ASC
    LIMIT ${limit}
  `;
}

export type PlaceInBbox = {
  id: string;
  primaryName: string;
  category: string | null;
  centroidLat: number;
  centroidLng: number;
  radiusMeters: number;
  confidence: number;
  visitCount: number;
  authoritySum: number;
};

export async function findPlacesInBbox(opts: {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  limit?: number;
}): Promise<PlaceInBbox[]> {
  const limit = opts.limit ?? 500;
  return prisma.$queryRaw<PlaceInBbox[]>`
    SELECT
      "id",
      "primaryName",
      "category",
      "centroidLat",
      "centroidLng",
      "radiusMeters",
      "confidence",
      "visitCount",
      "authoritySum"
    FROM "Place"
    WHERE "mergedIntoId" IS NULL
      AND "location" IS NOT NULL
      AND "location" && ST_MakeEnvelope(${opts.minLng}, ${opts.minLat}, ${opts.maxLng}, ${opts.maxLat}, 4326)::geography
    ORDER BY "authoritySum" DESC
    LIMIT ${limit}
  `;
}

// After a Visit is created/attached to a Place, recompute the Place's
// aggregates. Centroid = mean of all visit locations; radius shrinks as
// visits cluster; confidence grows with visit count (log curve).
export async function recomputePlaceAggregates(placeId: string) {
  await prisma.$executeRaw`
    WITH stats AS (
      SELECT
        AVG(lat) AS avg_lat,
        AVG(lng) AS avg_lng,
        COUNT(*)::int AS n,
        COALESCE(SUM(weight), 0) AS weight_sum,
        COALESCE(
          ST_Distance(
            ST_SetSRID(ST_MakePoint(AVG(lng), AVG(lat)), 4326)::geography,
            ST_SetSRID(ST_MakePoint(AVG(lng) + STDDEV(lng), AVG(lat) + STDDEV(lat)), 4326)::geography
          ),
          30
        ) AS spread_m
      FROM "Visit"
      WHERE "placeId" = ${placeId}
    )
    UPDATE "Place" p
    SET
      "centroidLat"  = COALESCE(s.avg_lat, p."centroidLat"),
      "centroidLng"  = COALESCE(s.avg_lng, p."centroidLng"),
      "visitCount"   = s.n,
      "authoritySum" = s.weight_sum,
      "radiusMeters" = GREATEST(15, LEAST(150, s.spread_m)),
      "confidence"   = LEAST(1.0, GREATEST(0.3, LN(GREATEST(s.n, 1) + 1) / LN(20)))
    FROM stats s
    WHERE p.id = ${placeId}
  `;
}
