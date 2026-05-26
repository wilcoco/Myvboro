// Slippy-map (Web Mercator / EPSG:3857) projection at OSM's 256px tile size.
// Pure functions — safe in any environment.

export type LngLat = { lng: number; lat: number };

export const TILE_SIZE = 256;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 19;

export function lng2tileX(lng: number, z: number): number {
  return ((lng + 180) / 360) * Math.pow(2, z);
}

export function lat2tileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
    Math.pow(2, z)
  );
}

export function tileX2lng(x: number, z: number): number {
  return (x / Math.pow(2, z)) * 360 - 180;
}

export function tileY2lat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

// Project lng/lat → world pixel coordinates at the given zoom.
export function project(lng: number, lat: number, z: number): { x: number; y: number } {
  return { x: lng2tileX(lng, z) * TILE_SIZE, y: lat2tileY(lat, z) * TILE_SIZE };
}

export function unproject(x: number, y: number, z: number): LngLat {
  return { lng: tileX2lng(x / TILE_SIZE, z), lat: tileY2lat(y / TILE_SIZE, z) };
}

// Real-world meters per screen pixel at a given latitude/zoom.
// Needed so Place circles render at their true `radiusMeters`.
export function metersPerPixel(lat: number, z: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, z);
}

// Pick the largest integer zoom at which the given points (with `padding`
// px around them) fit inside a (width × height) viewport.
export function fitBounds(
  points: LngLat[],
  width: number,
  height: number,
  padding = 40,
  maxZoom = 15,
): { center: LngLat; zoom: number } {
  if (points.length === 0) return { center: { lng: 0, lat: 0 }, zoom: MIN_ZOOM };
  if (points.length === 1) return { center: points[0]!, zoom: maxZoom };

  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const center: LngLat = {
    lng: (minLng + maxLng) / 2,
    lat: (minLat + maxLat) / 2,
  };

  for (let z = maxZoom; z >= MIN_ZOOM; z--) {
    const nw = project(minLng, maxLat, z);
    const se = project(maxLng, minLat, z);
    if (se.x - nw.x + padding * 2 <= width && se.y - nw.y + padding * 2 <= height) {
      return { center, zoom: z };
    }
  }
  return { center, zoom: MIN_ZOOM };
}
