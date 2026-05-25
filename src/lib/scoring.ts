import { prisma } from "@/lib/prisma";

// Proof-ladder scoring.
// Tier 0 text · 1 GPS · 2 GPS+dwell · 3 in-app camera · 4 menu-match (later)
// · 5 receipt OCR (later).
export type TierInput = {
  hasGps: boolean;
  gpsAccuracyMeters: number | null;
  dwellTimeSec: number | null;
  hasStorefrontPhoto: boolean;
  takenInApp: boolean;
};

export type TierResult = { tier: number; weight: number };

const TIER_WEIGHTS: Record<number, number> = {
  0: 1,
  1: 2,
  2: 4,
  3: 7,
  4: 10,
  5: 20,
};

export function computeTier(input: TierInput): TierResult {
  if (!input.hasGps) return { tier: 0, weight: TIER_WEIGHTS[0] };

  // Down-rank junk GPS.
  if ((input.gpsAccuracyMeters ?? Infinity) > 200) {
    return { tier: 0, weight: TIER_WEIGHTS[0] };
  }

  if (input.takenInApp && input.hasStorefrontPhoto) {
    return { tier: 3, weight: TIER_WEIGHTS[3] };
  }
  if ((input.dwellTimeSec ?? 0) >= 15 * 60) {
    return { tier: 2, weight: TIER_WEIGHTS[2] };
  }
  return { tier: 1, weight: TIER_WEIGHTS[1] };
}

// 6-month half-life.
const HALF_LIFE_DAYS = 180;
export function timeDecay(visitedAt: Date, now: Date = new Date()): number {
  const ageDays = (now.getTime() - visitedAt.getTime()) / 86_400_000;
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

// Recompute a place's aggregates from its visits: centroid, radius
// (clustered visits -> small; scattered -> large), confidence, visit count,
// authority sum.
//
// `spread_m` is the visits' standard deviation projected to meters via the
// equirectangular approximation around the visit centroid — accurate enough
// for clusters smaller than a city block, which is the only regime where
// the value matters (we clamp to [15, 150]).
export async function recomputePlaceAggregates(placeId: string) {
  await prisma.$executeRaw`
    WITH stats AS (
      SELECT
        AVG(lat)                       AS avg_lat,
        AVG(lng)                       AS avg_lng,
        COUNT(*)::int                  AS n,
        COALESCE(SUM(weight), 0)       AS weight_sum,
        COALESCE(STDDEV(lat), 0)       AS sd_lat,
        COALESCE(STDDEV(lng), 0)       AS sd_lng
      FROM "Visit"
      WHERE "placeId" = ${placeId}
    )
    UPDATE "Place" p
    SET
      "centroidLat"  = COALESCE(s.avg_lat, p."centroidLat"),
      "centroidLng"  = COALESCE(s.avg_lng, p."centroidLng"),
      "visitCount"   = s.n,
      "authoritySum" = s.weight_sum,
      "radiusMeters" = GREATEST(15, LEAST(150,
        SQRT(
          POW(s.sd_lat * 111320, 2) +
          POW(s.sd_lng * 111320 * COS(RADIANS(s.avg_lat)), 2)
        )
      )),
      "confidence"   = LEAST(1.0, GREATEST(0.3, LN(GREATEST(s.n, 1) + 1) / LN(20)))
    FROM stats s
    WHERE p.id = ${placeId}
  `;
}
