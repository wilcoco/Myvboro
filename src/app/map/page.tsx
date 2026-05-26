import MapCanvasClient from "./MapCanvasClient";

export const dynamic = "force-dynamic";

export default function MapPage() {
  // Anchor against the viewport, not the flex chain. The h-14 header is
  // in layout.tsx; this fills everything below it. Bypasses the "percent
  // heights inside flex-1" gotcha that left the container at 0×0.
  return (
    <div className="fixed inset-x-0 bottom-0 top-14">
      <MapCanvasClient />
    </div>
  );
}
