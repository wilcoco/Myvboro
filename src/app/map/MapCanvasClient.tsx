"use client";

import dynamic from "next/dynamic";
// Static import of the MapLibre stylesheet. Keeping this in the lazy
// chunk made the CSS load after the canvas mounted, which is what was
// turning the map invisible (tiles 200'd, canvas inherited no size).
import "maplibre-gl/dist/maplibre-gl.css";

// SSR-skip: MapLibre touches window/navigator/document at module load and
// at runtime, and the initial server-rendered HTML doesn't match what the
// client mounts (the canvas is created lazily). Bypassing SSR avoids the
// React #418/#423 hydration errors and removes ~250KB from the SSR bundle.
const MapCanvas = dynamic(() => import("@/components/MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted">
      지도를 불러오는 중…
    </div>
  ),
});

export default function MapCanvasClient() {
  return <MapCanvas />;
}
