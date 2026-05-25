import MapCanvas from "@/components/MapCanvas";

export const dynamic = "force-dynamic";

export default function MapPage() {
  // Map fills the entire <main>. Inside a flex column body, main is
  // flex-1 + min-h-0, so this h-full resolves cleanly.
  return (
    <div className="h-full w-full">
      <MapCanvas />
    </div>
  );
}
