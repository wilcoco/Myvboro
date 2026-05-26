"use client";

import OSMMap from "@/components/OSMMap";

// Static OSM-tile map of the signed-in user's own visit points
// ("내 노드들 한눈에" per kickoff §4). Non-interactive: the main
// /map is where users actually browse.
export default function ProfileVisitsMap({
  visits,
}: {
  visits: { lat: number; lng: number }[];
}) {
  if (visits.length === 0) return null;
  const points = visits.map((v) => ({ lng: v.lng, lat: v.lat }));
  return (
    <OSMMap
      fitTo={points}
      dots={points}
      interactive={false}
      className="relative w-full h-48 rounded-lg overflow-hidden border bg-muted"
    />
  );
}
