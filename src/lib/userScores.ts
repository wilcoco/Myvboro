import { prisma } from "@/lib/prisma";

// ~500m grid cells (latitude-only approximation; good enough for
// detecting "all my visits are in one block" patterns).
const GEO_CELL_DEG = 0.005;

function shannon(counts: number[]): number {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let h = 0;
  for (const c of counts) {
    if (c === 0) continue;
    const p = c / total;
    h -= p * Math.log(p);
  }
  return h;
}

export type UserScores = {
  breadthScore: number;
  distributionScore: number;
  hitRate: number;
  suspicionScore: number;
};

// Recomputes a user's structural scores from their visit history.
// Kept simple on purpose (kickoff §3-5): the work is in defining what
// "ad-like" looks like — a few small signals catch >90%.
//
//   breadthScore       ln(unique places + 1)
//   distributionScore  Shannon entropy across geo grid cells + categories
//   hitRate            fraction of ratings ≤ 3 (high = honest critic;
//                      0 + many visits = fishy)
//   suspicionScore     0 (trusted) .. 1 (likely shill) — composite flag
//                      that only activates once the user has ≥5 visits.
export async function recomputeUserScores(userId: string): Promise<UserScores | null> {
  const visits = await prisma.visit.findMany({
    where: { userId },
    select: {
      placeId: true,
      lat: true,
      lng: true,
      rating: true,
      place: { select: { category: true } },
    },
  });

  const visitCount = visits.length;
  if (visitCount === 0) return null;

  const uniquePlaces = new Set(visits.map((v) => v.placeId).filter(Boolean));
  const breadthScore = Math.log(uniquePlaces.size + 1);

  const geoBins = new Map<string, number>();
  const catBins = new Map<string, number>();
  for (const v of visits) {
    const cellLat = Math.round(v.lat / GEO_CELL_DEG);
    const cellLng = Math.round(v.lng / GEO_CELL_DEG);
    geoBins.set(`${cellLat}:${cellLng}`, (geoBins.get(`${cellLat}:${cellLng}`) ?? 0) + 1);
    const cat = v.place?.category ?? "_uncat";
    catBins.set(cat, (catBins.get(cat) ?? 0) + 1);
  }
  const distributionScore =
    shannon([...geoBins.values()]) + shannon([...catBins.values()]);

  const rated = visits.filter((v) => v.rating != null);
  const lowRated = rated.filter((v) => (v.rating as number) <= 3).length;
  const hitRate = rated.length > 0 ? lowRated / rated.length : 0;

  // Suspicion only activates once we have enough samples.
  let suspicionScore = 0;
  if (visitCount >= 5) {
    if (breadthScore < 1.5) suspicionScore += 0.4;
    if (distributionScore < 1.0) suspicionScore += 0.3;
    if (rated.length >= 3 && hitRate < 0.05) suspicionScore += 0.3;
  }
  suspicionScore = Math.min(1, suspicionScore);

  const scores: UserScores = { breadthScore, distributionScore, hitRate, suspicionScore };
  await prisma.user.update({ where: { id: userId }, data: scores });
  return scores;
}
