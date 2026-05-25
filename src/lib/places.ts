import { prisma } from "@/lib/prisma";

// =========================================================================
// Spatial queries without PostGIS.
//
// We use a fast bounding-box pre-filter on (centroidLat, centroidLng) —
// indexed in schema.prisma — then refine with the haversine formula in
// SQL. Earth radius constant = 6371000 m.
//
// Accuracy is sub-meter inside a single bounding box, which is well within
// the GPS accuracy we collect anyway. Scales to ~100k rows per region
// before we'd need to revisit (PostGIS / S2 / H3).
// =========================================================================

const EARTH_R_M = 6371000;
const DEG_PER_METER_LAT = 1 / 111320;

function deltaLngDeg(latDeg: number, meters: number): number {
  const cosLat = Math.cos((latDeg * Math.PI) / 180);
  // Guard against cos(lat) underflow near the poles.
  const safe = Math.max(Math.abs(cosLat), 1e-6);
  return meters / (111320 * safe);
}

export type NearbyCandidate = {
  id: string;
  primaryName: string;
  category: string | null;
  centroidLat: number;
  centroidLng: number;
  radiusMeters: number;
  confidence: number;
  visitCount: number;
  totalInvestment: number;
  investorCount: number;
  distanceMeters: number;
};

export async function findNearbyPlaces(opts: {
  lat: number;
  lng: number;
  radiusMeters?: number;
  limit?: number;
}): Promise<NearbyCandidate[]> {
  const radius = opts.radiusMeters ?? 100;
  const limit = opts.limit ?? 20;
  const dLat = radius * DEG_PER_METER_LAT;
  const dLng = deltaLngDeg(opts.lat, radius);

  const minLat = opts.lat - dLat;
  const maxLat = opts.lat + dLat;
  const minLng = opts.lng - dLng;
  const maxLng = opts.lng + dLng;

  return prisma.$queryRaw<NearbyCandidate[]>`
    WITH bbox AS (
      SELECT
        "id",
        "primaryName",
        "category",
        "centroidLat",
        "centroidLng",
        "radiusMeters",
        "confidence",
        "visitCount",
        "totalInvestment",
        "investorCount",
        ${EARTH_R_M}::double precision * 2 * ASIN(SQRT(
          POW(SIN(RADIANS(${opts.lat}::double precision - "centroidLat") / 2), 2) +
          COS(RADIANS(${opts.lat}::double precision)) * COS(RADIANS("centroidLat")) *
          POW(SIN(RADIANS(${opts.lng}::double precision - "centroidLng") / 2), 2)
        )) AS "distanceMeters"
      FROM "Place"
      WHERE "mergedIntoId" IS NULL
        AND "centroidLat" BETWEEN ${minLat} AND ${maxLat}
        AND "centroidLng" BETWEEN ${minLng} AND ${maxLng}
    )
    SELECT * FROM bbox
    WHERE "distanceMeters" <= ${radius}
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
  totalInvestment: number;
  investorCount: number;
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
      "totalInvestment",
      "investorCount"
    FROM "Place"
    WHERE "mergedIntoId" IS NULL
      AND "centroidLat" BETWEEN ${opts.minLat} AND ${opts.maxLat}
      AND "centroidLng" BETWEEN ${opts.minLng} AND ${opts.maxLng}
    ORDER BY "totalInvestment" DESC
    LIMIT ${limit}
  `;
}
