import MapCanvas from "@/components/MapCanvas";

export const dynamic = "force-dynamic";

export default function MapPage() {
  return (
    <div className="h-[calc(100vh-3.5rem)] w-full">
      <MapCanvas />
    </div>
  );
}
