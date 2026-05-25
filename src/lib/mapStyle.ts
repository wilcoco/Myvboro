import type { StyleSpecification } from "maplibre-gl";
import { env } from "@/lib/env";

// Default tile source: Mapbox raster if a token is set, OSM otherwise.
// Keep the style tiny — we render Place circles as a separate GeoJSON layer.
export function defaultStyle(): StyleSpecification {
  if (env.mapboxToken) {
    return {
      version: 8,
      sources: {
        raster: {
          type: "raster",
          tiles: [
            `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${env.mapboxToken}`,
          ],
          tileSize: 256,
          attribution: "© Mapbox © OpenStreetMap",
        },
      },
      layers: [{ id: "raster", type: "raster", source: "raster" }],
    };
  }
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  };
}
