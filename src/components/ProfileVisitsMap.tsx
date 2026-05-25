"use client";

import { useEffect, useRef } from "react";
import maplibregl, { Map as MLMap, LngLatBoundsLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { buildMapStyle } from "@/lib/mapStyle";

// Small static-ish map of the signed-in user's visits. No interaction —
// the main /map is where users actually browse; this is a personal-
// territory overview ("내 노드들 한눈에" per kickoff §4).
export default function ProfileVisitsMap({
  visits,
  mapboxToken,
}: {
  visits: { lat: number; lng: number }[];
  mapboxToken: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);

  useEffect(() => {
    if (!containerRef.current || visits.length === 0) return;

    const lngs = visits.map((v) => v.lng);
    const lats = visits.map((v) => v.lat);
    const bounds: LngLatBoundsLike = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(mapboxToken),
      bounds,
      fitBoundsOptions: { padding: 40, maxZoom: 14 },
      attributionControl: false,
      interactive: false,
    });

    map.on("load", () => {
      map.addSource("me", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: visits.map((v) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [v.lng, v.lat] },
            properties: {},
          })),
        },
      });
      map.addLayer({
        id: "me-dots",
        type: "circle",
        source: "me",
        paint: {
          "circle-color": "#16a34a",
          "circle-radius": 4,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
          "circle-opacity": 0.85,
        },
      });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [visits, mapboxToken]);

  return (
    <div
      ref={containerRef}
      className="w-full h-48 rounded-lg overflow-hidden border bg-muted"
    />
  );
}
