import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyMenuMatch } from "@/lib/aiVerify";
import { recomputePlaceAggregates } from "@/lib/places";

const TIER_4_WEIGHT = 10;
const MATCH_CONFIDENCE_THRESHOLD = 0.7;

// POST /api/visits/[id]/verify — runs the menu↔food vision check and
// promotes the visit to tier 4 if it matches. Designed to be fire-and-
// forget from the client immediately after a visit is created.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const visit = await prisma.visit.findUnique({
    where: { id },
    include: { photos: true },
  });
  if (!visit) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (visit.userId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (visit.tier >= 4) {
    return NextResponse.json({ alreadyVerified: true, tier: visit.tier });
  }

  const menu = visit.photos.find((p) => p.kind === "MENU");
  const food = visit.photos.find((p) => p.kind === "FOOD");
  if (!menu || !food) {
    return NextResponse.json({ error: "needs MENU and FOOD photos" }, { status: 400 });
  }

  const result = await verifyMenuMatch(menu.url, food.url);
  if (!result) {
    return NextResponse.json({ error: "verification unavailable" }, { status: 503 });
  }
  if (!result.match || result.confidence < MATCH_CONFIDENCE_THRESHOLD) {
    return NextResponse.json({ result, upgraded: false });
  }

  const updated = await prisma.visit.update({
    where: { id },
    data: { tier: 4, weight: TIER_4_WEIGHT },
  });
  if (visit.placeId) await recomputePlaceAggregates(visit.placeId);

  return NextResponse.json({ result, upgraded: true, visit: updated });
}
