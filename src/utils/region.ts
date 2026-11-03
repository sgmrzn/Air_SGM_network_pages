import { RYAZAN_OBLAST_GEOJSON } from "../data/ryazanOblastBoundary";

type LonLat = [number, number];
type Ring = LonLat[];
type Polygon = Ring[];

function pointInRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index++
  ) {
    const current = ring[index];
    const prior = ring[previous];
    const intersects =
      current[1] > lat !== prior[1] > lat &&
      lon <
        ((prior[0] - current[0]) * (lat - current[1])) /
          (prior[1] - current[1]) +
          current[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lon: number, lat: number, polygon: Polygon): boolean {
  const [outer, ...holes] = polygon;
  return Boolean(
    outer &&
    pointInRing(lon, lat, outer) &&
    !holes.some((hole) => pointInRing(lon, lat, hole)),
  );
}

export function isInsideRyazan(lon: number, lat: number): boolean {
  const geometry = RYAZAN_OBLAST_GEOJSON.geometry;
  if (geometry.type === "Polygon")
    return pointInPolygon(lon, lat, geometry.coordinates as Polygon);
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as Polygon[]).some((polygon) =>
      pointInPolygon(lon, lat, polygon),
    );
  }
  return false;
}
