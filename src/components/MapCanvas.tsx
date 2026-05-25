"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Locate, Plus } from "lucide-react";

import { Link } from "@/i18n/routing";
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
  };
};

// Default view = Gangnam (kickoff §8: 한 도시 한 카테고리로 검증 시작).
const DEFAULT_CENTER: [number, number] = [127.0276, 37.4979];
const DEFAULT_ZOOM = 13;

const PLACES_SOURCE = "places";
const PLACES_FILL_LAYER = "places-fill";
const PLACES_STROKE_LAYER = "places-stroke";

function buildStyle(mapboxToken: string): maplibregl.StyleSpecification {
  if (mapboxToken) {
    return {
      version: 8,
      sources: {
        mapbox: {
          type: "raster",
          tiles: [
            `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`,
          ],
          tileSize: 512,
          attribution:
            '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/about/">OpenStreetMap</a>',
        },
      },
      layers: [{ id: "mapbox", type: "raster", source: "mapbox" }],
    };
  }

  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: [
          "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  };
}

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

function toGeoJson(places: ApiPlace[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: places.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.centroidLng, p.centroidLat] },
      properties: {
        id: p.id,
        name: p.primaryName,
        radiusMeters: p.radiusMeters,
        confidence: p.confidence,
        visitCount: p.visitCount,
      },
    })),
  };
}

export default function MapCanvas({
  mapboxToken,
  labels,
  isAuthed,
}: {
  mapboxToken: string;
  labels: Labels;
  isAuthed: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const meMarkerRef = useRef<Marker | null>(null);
  const lastBboxFetch = useRef<number>(0);

  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  // --- map init ----------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(mapboxToken),
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource(PLACES_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Fill: opacity ~ confidence, radius ~ real-world radiusMeters.
      map.addLayer({
        id: PLACES_FILL_LAYER,
        type: "circle",
        source: PLACES_SOURCE,
        paint: {
          "circle-color": "#16a34a",
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["get", "confidence"],
            0,
            0.15,
            1,
            0.55,
          ],
          "circle-radius": [
            "interpolate",
            ["exponential", 2],
            ["zoom"],
            10,
            ["max", 4, ["/", ["get", "radiusMeters"], 30]],
            18,
            ["max", 8, ["*", ["get", "radiusMeters"], 1.5]],
          ],
          "circle-stroke-color": "#16a34a",
          "circle-stroke-opacity": 0.7,
          "circle-stroke-width": 1,
        },
      });

      // Center dot — easy click target, intensity = visitCount.
      map.addLayer({
        id: PLACES_STROKE_LAYER,
        type: "circle",
        source: PLACES_SOURCE,
        paint: {
          "circle-color": "#16a34a",
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "visitCount"],
            0,
            3,
            5,
            5,
            20,
            7,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });

      map.on("click", PLACES_STROKE_LAYER, (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) setSelectedPlaceId(id);
      });
      map.on("click", PLACES_FILL_LAYER, (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) setSelectedPlaceId(id);
      });
      const onEnter = () => (map.getCanvas().style.cursor = "pointer");
      const onLeave = () => (map.getCanvas().style.cursor = "");
      map.on("mouseenter", PLACES_STROKE_LAYER, onEnter);
      map.on("mouseleave", PLACES_STROKE_LAYER, onLeave);

      void refreshPlaces();
    });

    map.on("moveend", () => void refreshPlaces());

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxToken]);

  // --- bbox fetch (throttled) -------------------------------------------
  async function refreshPlaces() {
    const map = mapRef.current;
    if (!map) return;
    const now = Date.now();
    if (now - lastBboxFetch.current < 300) return;
    lastBboxFetch.current = now;

    const b = map.getBounds();
    const bbox = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
    const res = await fetch(`/api/places?bbox=${bbox}`).catch(() => null);
    if (!res?.ok) return;
    const { places } = (await res.json()) as { places: ApiPlace[] };
    const source = map.getSource(PLACES_SOURCE) as maplibregl.GeoJSONSource | undefined;
    source?.setData(toGeoJson(places));
  }

  const locateMe = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    setLocating(true);
    setDenied(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        mapRef.current?.flyTo({ center: lngLat, zoom: 15, essential: true });

        if (meMarkerRef.current) {
          meMarkerRef.current.setLngLat(lngLat);
        } else {
          const el = document.createElement("div");
          el.className = "w-4 h-4 rounded-full bg-blue-500 ring-4 ring-blue-500/30 shadow-lg";
          meMarkerRef.current = new maplibregl.Marker({ element: el })
            .setLngLat(lngLat)
            .addTo(mapRef.current!);
        }
      },
      () => {
        setLocating(false);
        setDenied(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

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
