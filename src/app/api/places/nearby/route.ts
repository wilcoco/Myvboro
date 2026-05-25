import { NextRequest, NextResponse } from "next/server";
import { findCandidatePlaces } from "@/lib/places";

// GET /api/places/nearby?lat=..&lng=..&radius=50&storefrontHash=<hex16>
// The hash boosts dedup beyond raw GPS — same storefront photographed
// from different angles will surface even if the GPS drifts (kickoff §3-3).
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  const radius = Number(req.nextUrl.searchParams.get("radius") ?? 50);
  const storefrontHash = req.nextUrl.searchParams.get("storefrontHash");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
  }
  const places = await findCandidatePlaces({
    lat,
    lng,
    radiusMeters: radius,
    storefrontHash,
  });
  return NextResponse.json({ places });
}
