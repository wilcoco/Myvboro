"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MLMap, GeoJSONSource } from "maplibre-gl";
// NOTE: maplibre-gl.css is imported from MapCanvasClient.tsx (the static
// entry point) instead of here, so the stylesheet ships in the page CSS
// bundle rather than getting bundled into the lazy chunk. Without it
// MapLibre's canvas inherits no sizing and the map looks invisible even
// though tile fetches are succeeding.
import { defaultStyle } from "@/lib/mapStyle";
import { useRouter } from "next/navigation";

type PlaceFeature = {
  id: string;
  primaryName: string;
  category: string | null;
  centroidLat: number;
  centroidLng: number;
  radiusMeters: number;
  confidence: number;
  totalInvestment: number;
  investorCount: number;
};

// Seoul City Hall — sensible default for first load if geolocation denied.
const DEFAULT_CENTER: [number, number] = [126.9784, 37.5666];

export default function MapCanvas() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!wrapperRef.current) return;

    const map = new maplibregl.Map({
      container: wrapperRef.current,
      style: defaultStyle(),
      center: DEFAULT_CENTER,
      zoom: 13,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), "top-right");

    // We wire the resize observer + moveend handler only AFTER the style
    // finishes loading. Otherwise the very first ResizeObserver callback
    // calls map.resize() before the style is wired, which fires moveend,
    // which calls loadInBbox(map), which calls map.getSource('places') —
    // and that explodes with "Cannot read properties of undefined" because
    // map.style hasn't been assigned yet.
    let ro: ResizeObserver | null = null;

    map.on("load", () => {
      // Trigger one more resize after the style finishes loading; some
      // layouts only get their final size by then.
      map.resize();
      map.addSource("places", { type: "geojson", data: emptyFC() });
      // Outer "uncertainty" circle: larger when radius is large (low confidence).
      map.addLayer({
        id: "place-radius",
        type: "circle",
        source: "places",
        paint: {
          "circle-radius": [
            "interpolate",
            ["exponential", 2],
            ["zoom"],
            10, ["/", ["get", "radiusMeters"], 50],
            18, ["/", ["get", "radiusMeters"], 0.6],
          ],
          "circle-color": "#10b981",
          "circle-opacity": ["interpolate", ["linear"], ["get", "confidence"], 0, 0.05, 1, 0.25],
          "circle-stroke-color": "#10b981",
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0.6,
        },
      });
      // Inner "centroid" dot scaled by investment.
      map.addLayer({
        id: "place-center",
        type: "circle",
        source: "places",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "totalInvestment"],
            0, 4,
            100, 6,
            1000, 10,
            10000, 16,
          ],
          "circle-color": "#fafafa",
          "circle-stroke-color": "#0a0a0a",
          "circle-stroke-width": 1,
        },
      });
      setLoaded(true);

      map.on("click", "place-center", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = f.properties?.id as string | undefined;
        if (id) router.push(`/places/${id}`);
      });
      map.on("mouseenter", "place-center", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "place-center", () => (map.getCanvas().style.cursor = ""));

      // Safe to wire these now — places source + layers exist.
      map.on("moveend", () => loadInBbox(map));
      if (wrapperRef.current) {
        ro = new ResizeObserver(() => map.resize());
        ro.observe(wrapperRef.current);
      }
    });

    // Try to recenter on user location once.
    navigator.geolocation?.getCurrentPosition(
      (pos) => map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 15 }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 5000 },
    );

    return () => {
      ro?.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loaded && mapRef.current) loadInBbox(mapRef.current).then(setCount);
  }, [loaded]);

  async function loadInBbox(map: MLMap): Promise<number> {
    // Guard against being called before style/sources are wired.
    // getSource on an unloaded map throws inside MapLibre (style is undef).
    let src: GeoJSONSource | undefined;
    try {
      src = map.getSource("places") as GeoJSONSource | undefined;
    } catch {
      return 0;
    }
    if (!src) return 0;

    const b = map.getBounds();
    const bbox = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
    const res = await fetch(`/api/places?bbox=${bbox}`);
    if (!res.ok) return 0;
    const data = (await res.json()) as { ok: boolean; places?: PlaceFeature[] };
    const places = data.places ?? [];
    src.setData({
      type: "FeatureCollection",
      features: places.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.centroidLng, p.centroidLat] },
        properties: { ...p },
      })),
    });
    setCount(places.length);
    return places.length;
  }

  return (
    <div className="relative h-full w-full">
      <div ref={wrapperRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-surface/90 px-3 py-1 text-xs text-muted backdrop-blur">
        {count} places in view
      </div>
    </div>
  );
}

function emptyFC(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}
