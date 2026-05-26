"use client";

// Tile-by-tile Canvas renderer for the OpenStreetMap raster layer.
// No MapLibre / Leaflet / Mapbox — just <Image> elements drawn via
// drawImage onto a single <canvas>, plus pointer-event panning and
// wheel zoom.
//
// Tiles: https://{a|b|c}.tile.openstreetmap.org/{z}/{x}/{y}.png
// OSM's public tile server is fine for dev/MVP but **not for
// production traffic** (per OSM tile usage policy). When we ship,
// swap the URL for a paid raster provider (Stadia, MapTiler, etc.).

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  fitBounds,
  type LngLat,
  MAX_ZOOM,
  metersPerPixel,
  MIN_ZOOM,
  project,
  TILE_SIZE,
  unproject,
} from "@/lib/tileMath";

export type MapCircle = {
  id: string;
  lng: number;
  lat: number;
  radiusMeters: number;
  confidence: number;
  visitCount: number;
};

export type MapDot = { lng: number; lat: number };

export type MapBbox = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

export type OSMMapHandle = {
  flyTo: (center: LngLat, zoom?: number) => void;
};

type Props = {
  initialView?: { center: LngLat; zoom: number };
  // If provided, the map auto-fits to these points (overrides initialView).
  fitTo?: LngLat[];
  interactive?: boolean;
  circles?: MapCircle[];
  dots?: MapDot[];
  myLocation?: LngLat | null;
  onCircleClick?: (id: string) => void;
  onMoveEnd?: (bbox: MapBbox) => void;
  className?: string;
};

const SUBDOMAINS = ["a", "b", "c"];
const DRAG_THRESHOLD_PX = 5;
const CLICK_HIT_PX = 16;
const CIRCLE_FILL_BASE = 0.18;
const CIRCLE_FILL_MAX = 0.55;

const OSMMap = forwardRef<OSMMapHandle, Props>(function OSMMap(
  {
    initialView,
    fitTo,
    interactive = true,
    circles = [],
    dots = [],
    myLocation = null,
    onCircleClick,
    onMoveEnd,
    className,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Tile image cache (image element lives forever — typical session
  // stays well under a thousand tiles).
  const tileCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [center, setCenter] = useState<LngLat>(
    initialView?.center ?? { lng: 0, lat: 0 },
  );
  const [zoom, setZoom] = useState<number>(initialView?.zoom ?? 13);

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (c: LngLat, z?: number) => {
        setCenter(c);
        if (z != null) setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(z))));
      },
    }),
    [],
  );

  // Fit to bounds when the input points or viewport size change.
  const fitKey = useMemo(
    () => (fitTo ? fitTo.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join("|") : null),
    [fitTo],
  );
  useEffect(() => {
    if (!fitTo || size.w === 0 || size.h === 0) return;
    const v = fitBounds(fitTo, size.w, size.h);
    setCenter(v.center);
    setZoom(v.zoom);
  }, [fitKey, size.w, size.h, fitTo]);

  // Track container size.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Imperative draw — pulls every state from refs so we can call it
  // from image onload without stale closures.
  const stateRef = useRef({ center, zoom, size, circles, dots, myLocation });
  stateRef.current = { center, zoom, size, circles, dots, myLocation };

  const requestTile = useCallback((tx: number, ty: number, tz: number): HTMLImageElement | null => {
    const key = `${tz}/${tx}/${ty}`;
    const cached = tileCacheRef.current.get(key);
    if (cached) return cached;
    const img = new Image();
    img.crossOrigin = "anonymous";
    const sub = SUBDOMAINS[Math.abs(tx + ty) % SUBDOMAINS.length]!;
    img.src = `https://${sub}.tile.openstreetmap.org/${tz}/${tx}/${ty}.png`;
    img.onload = () => draw();
    img.onerror = () => {};
    tileCacheRef.current.set(key, img);
    return img;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const { center: ctr, zoom: zm, size: sz, circles: crc, dots: dts, myLocation: mloc } =
      stateRef.current;
    if (!canvas || sz.w === 0 || sz.h === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== sz.w * dpr || canvas.height !== sz.h * dpr) {
      canvas.width = sz.w * dpr;
      canvas.height = sz.h * dpr;
      canvas.style.width = sz.w + "px";
      canvas.style.height = sz.h + "px";
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, sz.w, sz.h);

    const z = zm;
    const centerPx = project(ctr.lng, ctr.lat, z);
    const tlX = centerPx.x - sz.w / 2;
    const tlY = centerPx.y - sz.h / 2;
    const worldTiles = Math.pow(2, z);

    const minTx = Math.floor(tlX / TILE_SIZE);
    const minTy = Math.floor(tlY / TILE_SIZE);
    const maxTx = Math.floor((tlX + sz.w) / TILE_SIZE);
    const maxTy = Math.floor((tlY + sz.h) / TILE_SIZE);

    for (let ty = minTy; ty <= maxTy; ty++) {
      if (ty < 0 || ty >= worldTiles) continue;
      for (let tx = minTx; tx <= maxTx; tx++) {
        let wx = tx % worldTiles;
        if (wx < 0) wx += worldTiles;
        const img = requestTile(wx, ty, z);
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(
            img,
            tx * TILE_SIZE - tlX,
            ty * TILE_SIZE - tlY,
            TILE_SIZE,
            TILE_SIZE,
          );
        }
      }
    }

    // Place circles — radius is real-world meters, fill opacity tracks
    // confidence (faint giant blob → small tight dot).
    const mpp = metersPerPixel(ctr.lat, z);
    for (const c of crc) {
      const p = project(c.lng, c.lat, z);
      const sx = p.x - tlX;
      const sy = p.y - tlY;
      if (sx < -200 || sx > sz.w + 200 || sy < -200 || sy > sz.h + 200) continue;
      const r = Math.max(4, c.radiusMeters / mpp);

      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(22, 163, 74, ${CIRCLE_FILL_BASE + Math.min(CIRCLE_FILL_MAX - CIRCLE_FILL_BASE, c.confidence * 0.4)})`;
      ctx.fill();
      ctx.strokeStyle = "rgba(22, 163, 74, 0.7)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Center dot — gentle growth with visit count.
      const dotR = 3 + Math.min(4, Math.log(c.visitCount + 1));
      ctx.beginPath();
      ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
      ctx.fillStyle = "#16a34a";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Simple dots (profile mini-map).
    for (const d of dts) {
      const p = project(d.lng, d.lat, z);
      const sx = p.x - tlX;
      const sy = p.y - tlY;
      if (sx < -10 || sx > sz.w + 10 || sy < -10 || sy > sz.h + 10) continue;
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(22, 163, 74, 0.85)";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // "Me" marker.
    if (mloc) {
      const p = project(mloc.lng, mloc.lat, z);
      const sx = p.x - tlX;
      const sy = p.y - tlY;
      ctx.beginPath();
      ctx.arc(sx, sy, 11, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(59, 130, 246, 0.25)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#3b82f6";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw whenever any visible input changes.
  useEffect(() => {
    draw();
  }, [draw, size, center, zoom, circles, dots, myLocation]);

  // Debounced moveend callback for bbox-driven fetches.
  useEffect(() => {
    if (!onMoveEnd || size.w === 0 || size.h === 0) return;
    const t = setTimeout(() => {
      const centerPx = project(center.lng, center.lat, zoom);
      const tl = unproject(centerPx.x - size.w / 2, centerPx.y - size.h / 2, zoom);
      const br = unproject(centerPx.x + size.w / 2, centerPx.y + size.h / 2, zoom);
      onMoveEnd({ minLng: tl.lng, maxLng: br.lng, minLat: br.lat, maxLat: tl.lat });
    }, 250);
    return () => clearTimeout(t);
  }, [center.lng, center.lat, zoom, size.w, size.h, onMoveEnd]);

  // --- Interactions ------------------------------------------------------
  const dragRef = useRef<{ x: number; y: number; moved: number } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!interactive) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, moved: 0 };
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!interactive || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current.moved += Math.abs(dx) + Math.abs(dy);
    dragRef.current.x = e.clientX;
    dragRef.current.y = e.clientY;

    const centerPx = project(center.lng, center.lat, zoom);
    setCenter(unproject(centerPx.x - dx, centerPx.y - dy, zoom));
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!interactive) return;
    const wasDrag = dragRef.current ? dragRef.current.moved >= DRAG_THRESHOLD_PX : false;
    dragRef.current = null;
    if (wasDrag || !onCircleClick) return;

    // Tap test against the rendered circles (closest within CLICK_HIT_PX).
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const centerPx = project(center.lng, center.lat, zoom);
    const tlX = centerPx.x - size.w / 2;
    const tlY = centerPx.y - size.h / 2;

    let best: { id: string; d: number } | null = null;
    for (const c of circles) {
      const p = project(c.lng, c.lat, zoom);
      const d = Math.hypot(cx - (p.x - tlX), cy - (p.y - tlY));
      if (d < CLICK_HIT_PX && (!best || d < best.d)) best = { id: c.id, d };
    }
    if (best) onCircleClick(best.id);
  }

  function zoomAround(clientX: number, clientY: number, newZoomRaw: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const newZ = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(newZoomRaw)));
    if (newZ === zoom) return;

    // Keep the lng/lat under the cursor in the same screen position.
    const centerPx = project(center.lng, center.lat, zoom);
    const worldPxAtMouse = {
      x: centerPx.x - size.w / 2 + mx,
      y: centerPx.y - size.h / 2 + my,
    };
    const lngLatAtMouse = unproject(worldPxAtMouse.x, worldPxAtMouse.y, zoom);
    const newPxAtMouse = project(lngLatAtMouse.lng, lngLatAtMouse.lat, newZ);
    const newCenterPx = {
      x: newPxAtMouse.x - (mx - size.w / 2),
      y: newPxAtMouse.y - (my - size.h / 2),
    };
    setCenter(unproject(newCenterPx.x, newCenterPx.y, newZ));
    setZoom(newZ);
  }

  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    if (!interactive) return;
    e.preventDefault();
    zoomAround(e.clientX, e.clientY, zoom + (e.deltaY < 0 ? 1 : -1));
  }

  function zoomFromCenter(delta: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    zoomAround(r.left + r.width / 2, r.top + r.height / 2, zoom + delta);
  }

  return (
    <div ref={containerRef} className={className ?? "absolute inset-0"}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        className={`absolute inset-0 ${
          interactive ? "cursor-grab active:cursor-grabbing touch-none" : ""
        }`}
      />

      {interactive && (
        <div className="absolute top-4 right-4 z-10 flex flex-col rounded-md border bg-card shadow overflow-hidden">
          <button
            type="button"
            onClick={() => zoomFromCenter(1)}
            aria-label="Zoom in"
            className="px-3 py-1.5 text-lg leading-none hover:bg-accent border-b"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoomFromCenter(-1)}
            aria-label="Zoom out"
            className="px-3 py-1.5 text-lg leading-none hover:bg-accent"
          >
            −
          </button>
        </div>
      )}

      <div className="absolute bottom-1 right-1 z-10 text-[10px] text-muted-foreground bg-background/70 px-1.5 py-0.5 rounded pointer-events-auto">
        ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          OpenStreetMap
        </a>
      </div>
    </div>
  );
});

export default OSMMap;
