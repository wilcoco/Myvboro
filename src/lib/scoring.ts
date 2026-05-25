// Proof-ladder scoring per kickoff §3-4.
// Tier 0 text · 1 GPS · 2 GPS+dwell · 3 in-app camera · 4 menu-match (v1.5)
// · 5 receipt OCR (v2) · 6 repeat-visit multiplier.

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

  // GPS accuracy gate — anything worse than 200m we down-rank to text.
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

// Half-life decay: 6-month half-life per kickoff §3-4.
const HALF_LIFE_DAYS = 180;
export function timeDecay(visitedAt: Date, now: Date = new Date()): number {
  const ageDays = (now.getTime() - visitedAt.getTime()) / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}
