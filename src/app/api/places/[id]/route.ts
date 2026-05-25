import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/places/[id] — Place + top-authority visits (with photos + user)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const place = await prisma.place.findUnique({
    where: { id },
    include: {
      visits: {
        orderBy: [{ weight: "desc" }, { visitedAt: "desc" }],
        take: 20,
        include: {
          photos: { select: { id: true, kind: true, url: true, thumbnailUrl: true } },
          user: {
            select: { id: true, name: true, image: true, authorityScore: true },
          },
        },
      },
    },
  });

  if (!place) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ place });
}
