import type { StyleSpecification } from "maplibre-gl";

// Shared MapLibre style builder so MapCanvas and ProfileVisitsMap stay
// in sync on tiles + attribution. Mapbox raster when a token is set,
// OSM raster otherwise.
export function buildMapStyle(mapboxToken: string): StyleSpecification {
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
