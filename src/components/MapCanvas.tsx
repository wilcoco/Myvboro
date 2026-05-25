"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Locate } from "lucide-react";

type Labels = {
  locateMe: string;
  locating: string;
  permissionDenied: string;
  loading: string;
};

// Default view = Gangnam (kickoff §8: 한 도시 한 카테고리로 검증 시작).
const DEFAULT_CENTER: [number, number] = [127.0276, 37.4979];
const DEFAULT_ZOOM = 13;

function buildStyle(mapboxToken: string): maplibregl.StyleSpecification {
  // Use Mapbox raster tiles via MapLibre. If a token is missing we fall
  // back to OpenStreetMap raster tiles so the map still renders in dev.
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

export default function MapCanvas({
  mapboxToken,
  labels,
}: {
  mapboxToken: string;
  labels: Labels;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const meMarkerRef = useRef<Marker | null>(null);

  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);

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

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken]);

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
          el.className =
            "w-4 h-4 rounded-full bg-primary ring-4 ring-primary/30 shadow-lg";
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
    </div>
  );
}
