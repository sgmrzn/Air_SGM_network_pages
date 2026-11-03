import type { StyleSpecification } from "maplibre-gl";

export const baseMapStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
      paint: {
        "raster-saturation": -0.18,
        "raster-brightness-min": 0.16,
        "raster-brightness-max": 0.98,
        "raster-contrast": -0.03,
      },
    },
  ],
};
