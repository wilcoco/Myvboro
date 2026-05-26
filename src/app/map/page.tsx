import MapCanvasClient from "./MapCanvasClient";

export const dynamic = "force-dynamic";

export default function MapPage() {
  // Anchor against the viewport, not the flex chain. The h-14 header is
  // in layout.tsx; this fills everything below it. Bypasses the "percent
  // heights inside flex-1" gotcha that left the container at 0×0.
  // Explicit height — using bottom:0 + top:14 gives the box the right
  // visual size but CSS `height` resolves to `auto`, so any descendant
  // that uses h-full collapses to 0. (Diagnosed in the field: canvas was
  // 592×300, .maplibregl-map wrapper was 592×0, the wrapper's overflow:hidden
  // clipped the canvas to nothing.)
  return (
    <div className="fixed inset-x-0 top-14 h-[calc(100dvh-3.5rem)]">
      <MapCanvasClient />
    </div>
  );
}
