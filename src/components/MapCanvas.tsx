"use client";

import { useCallback, useRef, useState } from "react";
import { Locate, Plus } from "lucide-react";

import { Link } from "@/i18n/routing";
import OSMMap, {
  type MapBbox,
  type MapCircle,
  type OSMMapHandle,
} from "@/components/OSMMap";
import PlaceDetailSheet from "@/components/PlaceDetailSheet";

type Labels = {
  locateMe: string;
  locating: string;
  permissionDenied: string;
  loading: string;
  addVisit: string;
  sheet: {
    loading: string;
    visits: string;
    queueUp: string;
    queued: string;
    loginToQueue: string;
    noVisits: string;
    close: string;
    suspected: string;
  };
};

// Default view = Gangnam (kickoff §8: 한 도시 한 카테고리로 검증 시작).
const DEFAULT_VIEW = { center: { lng: 127.0276, lat: 37.4979 }, zoom: 13 };

type ApiPlace = {
  id: string;
  primaryName: string;
  category: string | null;
  centroidLat: number;
  centroidLng: number;
  radiusMeters: number;
  confidence: number;
  visitCount: number;
  authoritySum: number;
};

export default function MapCanvas({
  labels,
  isAuthed,
}: {
  labels: Labels;
  isAuthed: boolean;
}) {
  const mapRef = useRef<OSMMapHandle>(null);

  const [places, setPlaces] = useState<ApiPlace[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [myLocation, setMyLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);

  const onMoveEnd = useCallback(async (bbox: MapBbox) => {
    const url = `/api/places?bbox=${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`;
    const res = await fetch(url).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { places: ApiPlace[] };
    setPlaces(data.places ?? []);
  }, []);

  const circles: MapCircle[] = places.map((p) => ({
    id: p.id,
    lng: p.centroidLng,
    lat: p.centroidLat,
    radiusMeters: p.radiusMeters,
    confidence: p.confidence,
    visitCount: p.visitCount,
  }));

  function locateMe() {
    if (!navigator.geolocation) return;
    setLocating(true);
    setDenied(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lngLat = { lng: pos.coords.longitude, lat: pos.coords.latitude };
        setMyLocation(lngLat);
        mapRef.current?.flyTo(lngLat, 15);
      },
      () => {
        setLocating(false);
        setDenied(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

  return (
    <div className="absolute inset-0">
      <OSMMap
        ref={mapRef}
        initialView={DEFAULT_VIEW}
        circles={circles}
        myLocation={myLocation}
        onMoveEnd={onMoveEnd}
        onCircleClick={setSelectedPlaceId}
      />

      <Link
        href="/add"
        className="absolute bottom-24 right-4 z-10 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg px-5 py-3 hover:opacity-90 transition"
      >
        <Plus className="h-4 w-4" />
        <span className="text-sm font-medium">{labels.addVisit}</span>
      </Link>

      <button
        type="button"
        onClick={locateMe}
        disabled={locating}
        aria-label={labels.locateMe}
        className="absolute bottom-6 right-4 z-10 flex items-center gap-2 rounded-full bg-card text-card-foreground border shadow-lg px-4 py-3 hover:bg-accent transition disabled:opacity-60"
      >
        <Locate className="h-4 w-4" />
        <span className="text-sm font-medium">
          {locating ? labels.locating : labels.locateMe}
        </span>
      </button>

      {denied && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 rounded-full bg-destructive text-destructive-foreground text-sm px-4 py-2 shadow">
          {labels.permissionDenied}
        </div>
      )}

      <PlaceDetailSheet
        placeId={selectedPlaceId}
        isAuthed={isAuthed}
        labels={labels.sheet}
        onClose={() => setSelectedPlaceId(null)}
      />
    </div>
  );
}
