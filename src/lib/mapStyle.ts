import type { StyleSpecification } from "maplibre-gl";
import { env } from "@/lib/env";

// Default tile source. Strategy:
// 1. If a valid-looking Mapbox token (starts with "pk.") is present, use
//    Mapbox dark-v11 raster.
// 2. Otherwise fall back to CARTO Dark Matter raster — a free, CORS-OK
//    tile set rendered against OSM data, lighter on the public OSM tile
//    server and visually consistent with our dark UI.
//
// We deliberately do NOT use tile.openstreetmap.org directly: their tile
// usage policy disallows commercial / heavy use and they rate-limit.
export function defaultStyle(): StyleSpecification {
  const token = env.mapboxToken?.trim() ?? "";
  if (token.startsWith("pk.")) {
    return {
      version: 8,
      sources: {
        raster: {
          type: "raster",
          tiles: [
            `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${token}`,
          ],
          tileSize: 256,
          attribution: "© Mapbox © OpenStreetMap",
        },
      },
      layers: [
        { id: "bg", type: "background", paint: { "background-color": "#111" } },
        { id: "raster", type: "raster", source: "raster" },
      ],
    };
  }

  // CARTO Dark Matter — free, CORS-enabled, three subdomains for parallel
  // tile fetches.
  return {
    version: 8,
    sources: {
      carto: {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
          "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
          "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        ],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors © CARTO",
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#111" } },
      { id: "carto", type: "raster", source: "carto" },
    ],
  };
}
