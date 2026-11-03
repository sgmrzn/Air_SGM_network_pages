type Point = { longitude: number; latitude: number };
type TerritoryBounds = {
  min_lon: number;
  min_lat: number;
  max_lon: number;
  max_lat: number;
};

/** Shared opening extent: the settlement and the full coverage of every zone. */
export function networkResultBounds(
  territory: TerritoryBounds,
  candidates: Point[],
  radiusM: number,
): [[number, number], [number, number]] {
  const points = candidates.filter(
    (point) =>
      Number.isFinite(point.longitude) && Number.isFinite(point.latitude),
  );
  const west = [territory.min_lon],
    south = [territory.min_lat];
  const east = [territory.max_lon],
    north = [territory.max_lat];
  for (const point of points) {
    const dy = radiusM / 111_320;
    const dx =
      radiusM /
      (111_320 * Math.max(0.2, Math.cos((point.latitude * Math.PI) / 180)));
    west.push(point.longitude - dx);
    east.push(point.longitude + dx);
    south.push(point.latitude - dy);
    north.push(point.latitude + dy);
  }
  return [
    [Math.min(...west), Math.min(...south)],
    [Math.max(...east), Math.max(...north)],
  ];
}
