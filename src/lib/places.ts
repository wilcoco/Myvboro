import { prisma } from "@/lib/prisma";
import { hammingHex, PHASH_HEX_RE } from "@/lib/phash";

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

// Same-storefront detection: a STOREFRONT photo whose dHash is within
// HAMMING_MATCH of the candidate's hash is a strong signal that two
// visits are at the *same* place even if their GPS drifts. We scan
// a wider radius for hash matches than for raw GPS candidates.
const HAMMING_MATCH = 12;

export async function findCandidatePlaces(opts: {
  lat: number;
  lng: number;
  radiusMeters?: number;
  storefrontHash?: string | null;
  hashRadiusMeters?: number;
  limit?: number;
}): Promise<NearbyCandidate[]> {
  const gps = await findNearbyPlaces({
    lat: opts.lat,
    lng: opts.lng,
    radiusMeters: opts.radiusMeters ?? 50,
    limit: opts.limit ?? 10,
  });

  if (!opts.storefrontHash || !PHASH_HEX_RE.test(opts.storefrontHash)) {
    return gps;
  }

  const hashRadius = opts.hashRadiusMeters ?? 300;
  type Row = { placeId: string | null; perceptualHash: string };
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT v."placeId", p."perceptualHash"
    FROM "Photo" p
    JOIN "Visit" v ON v.id = p."visitId"
    WHERE p.kind = 'STOREFRONT'
      AND p."perceptualHash" IS NOT NULL
      AND v."placeId" IS NOT NULL
      AND v."location" IS NOT NULL
      AND ST_DWithin(
        v."location",
        ST_SetSRID(ST_MakePoint(${opts.lng}, ${opts.lat}), 4326)::geography,
        ${hashRadius}
      )
    LIMIT 500
  `;

  const seen = new Set(gps.map((c) => c.id));
  const matched = new Map<string, number>();
  for (const row of rows) {
    if (!row.placeId || seen.has(row.placeId)) continue;
    const h = hammingHex(opts.storefrontHash, row.perceptualHash);
    if (h > HAMMING_MATCH) continue;
    const prev = matched.get(row.placeId);
    if (prev == null || h < prev) matched.set(row.placeId, h);
  }
  if (matched.size === 0) return gps;

  const extraIds = [...matched.keys()];
  const extra = await prisma.$queryRaw<NearbyCandidate[]>`
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
    WHERE "id" = ANY(${extraIds}::text[])
      AND "mergedIntoId" IS NULL
  `;

  return [...gps, ...extra].slice(0, opts.limit ?? 10);
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
