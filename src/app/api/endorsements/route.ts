import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const CreateSchema = z.object({
  // The visit being endorsed → its author becomes `fromUser`.
  visitId: z.string(),
});

// POST /api/endorsements — "줄서기" (queue up to visit, triggered by
// seeing someone's recommendation).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const triggeringVisit = await prisma.visit.findUnique({
    where: { id: parsed.data.visitId },
    select: { id: true, userId: true, placeId: true },
  });
  if (!triggeringVisit?.placeId) {
    return NextResponse.json({ error: "visit not found" }, { status: 404 });
  }
  if (triggeringVisit.userId === session.user.id) {
    return NextResponse.json({ error: "cannot queue your own visit" }, { status: 400 });
  }

  // Deduplicate: one pending endorsement per (from, to, place).
  const existing = await prisma.endorsement.findFirst({
    where: {
      fromUserId: triggeringVisit.userId,
      toUserId: session.user.id,
      placeId: triggeringVisit.placeId,
      satisfaction: null,
    },
  });
  if (existing) return NextResponse.json({ endorsement: existing });

  const endorsement = await prisma.endorsement.create({
    data: {
      fromUserId: triggeringVisit.userId,
      toUserId: session.user.id,
      placeId: triggeringVisit.placeId,
    },
  });

  await prisma.place.update({
    where: { id: triggeringVisit.placeId },
    data: { endorsementCount: { increment: 1 } },
  });

  return NextResponse.json({ endorsement });
}

const RateSchema = z.object({
  endorsementId: z.string(),
  satisfaction: z.number().int().min(1).max(5),
});

// PATCH /api/endorsements — close the loop: B rates their satisfaction
// after visiting; A's authority moves up or down accordingly.
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = RateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const endorsement = await prisma.endorsement.findUnique({
    where: { id: parsed.data.endorsementId },
  });
  if (!endorsement || endorsement.toUserId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (endorsement.satisfaction !== null) {
    return NextResponse.json({ error: "already rated" }, { status: 400 });
  }

  const updated = await prisma.endorsement.update({
    where: { id: endorsement.id },
    data: {
      satisfaction: parsed.data.satisfaction,
      visitedAt: endorsement.visitedAt ?? new Date(),
    },
  });

  // Authority: a satisfied queue-up (≥4) bumps A's authority; a
  // disappointed one (≤2) drags it down. 3 is neutral.
  // (MVP-simple: real distribution/breadth/consistency math comes later.)
  const delta = parsed.data.satisfaction - 3;
  if (delta !== 0) {
    await prisma.user.update({
      where: { id: endorsement.fromUserId },
      data: { authorityScore: { increment: delta } },
    });
  }

  return NextResponse.json({ endorsement: updated });
}
