import { NextRequest, NextResponse } from "next/server";
import { findPlacesInBbox } from "@/lib/places";

// GET /api/places?bbox=minLng,minLat,maxLng,maxLat
export async function GET(req: NextRequest) {
  const bbox = req.nextUrl.searchParams.get("bbox");
  if (!bbox) {
    return NextResponse.json({ error: "missing bbox" }, { status: 400 });
  }
  const parts = bbox.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return NextResponse.json({ error: "invalid bbox" }, { status: 400 });
  }
  const [minLng, minLat, maxLng, maxLat] = parts;
  const places = await findPlacesInBbox({ minLng, minLat, maxLng, maxLat });
  return NextResponse.json({ places });
}
