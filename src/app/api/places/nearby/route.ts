import { NextRequest, NextResponse } from "next/server";
import { findNearbyPlaces } from "@/lib/places";

// GET /api/places/nearby?lat=..&lng=..&radius=50
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  const radius = Number(req.nextUrl.searchParams.get("radius") ?? 50);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
  }
  const places = await findNearbyPlaces({ lat, lng, radiusMeters: radius });
  return NextResponse.json({ places });
}
