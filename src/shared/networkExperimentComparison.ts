export interface SavedLayout {
  id: string;
  origin_run_id?: string;
  created_at?: string;
  matrix_snapshot_sha256?: string;
  implementation_sha256?: Record<string, string>;
  request?: { action?: string; view?: string };
  result: {
    additional_population?: number;
    multiple_coverage_population?: number;
    points?: Array<{ cell_id: string; longitude: number; latitude: number }>;
    site_impacts?: Array<{ cell_id: string; exclusive_population: number }>;
  };
}

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function compareSavedLayouts(a: SavedLayout, b: SavedLayout) {
  const blocked = (reason: string) => ({ comparable: false as const, reason });
  if (a.id === b.id) return blocked("Выберите два разных эксперимента.");
  if (a.request?.action !== "layout" || b.request?.action !== "layout") return blocked("Сравниваются только варианты переноса и охвата.");
  if (!a.origin_run_id || a.origin_run_id !== b.origin_run_id || !a.request.view || a.request.view !== b.request.view) return blocked("Нужны один исходный запуск и один сценарий.");
  if (!a.matrix_snapshot_sha256 || !b.matrix_snapshot_sha256) return blocked("Нет отпечатка сохранённой матрицы. Сопоставимость данных не подтверждена.");
  if (a.matrix_snapshot_sha256 !== b.matrix_snapshot_sha256) return blocked("Снимки исходных данных различаются. Прямое сравнение охвата недоступно.");
  const first = a.result.points, second = b.result.points;
  if (!first?.length || !second?.length) return blocked("В одном из экспериментов не сохранены координаты.");
  const ids = (points: typeof first) => points.map(point => point.cell_id).sort();
  if (new Set(ids(first)).size !== first.length || new Set(ids(second)).size !== second.length || JSON.stringify(ids(first)) !== JSON.stringify(ids(second))) return blocked("Наборы постов различаются. Для сравнения переноса нужны те же посты.");
  if (![...first, ...second].every(point => finite(point.longitude) && finite(point.latitude) && Math.abs(point.longitude) <= 180 && Math.abs(point.latitude) <= 90)) return blocked("В сохранённых координатах есть некорректные значения.");
  if (!finite(a.result.additional_population) || !finite(b.result.additional_population)) return blocked("В одном из экспериментов нет численного охвата.");
  const warnings: string[] = [];
  const hashes = (value?: Record<string,string>) => value ? JSON.stringify(Object.entries(value).sort(([x],[y]) => x.localeCompare(y))) : null;
  if (!a.implementation_sha256 || !Object.keys(a.implementation_sha256).length || !b.implementation_sha256 || !Object.keys(b.implementation_sha256).length) warnings.push("Версия реализации одного из экспериментов неизвестна.");
  else if (hashes(a.implementation_sha256) !== hashes(b.implementation_sha256)) warnings.push("Версии реализации различаются: изменение показателей нельзя приписать только переносу точек.");
  const delta = (x: unknown, y: unknown) => finite(x) && finite(y) ? y - x : null;
  const exclusive = (run: SavedLayout, id: string) => run.result.site_impacts?.find(row => row.cell_id === id)?.exclusive_population;
  const byId = new Map(second.map(point => [point.cell_id, point]));
  const radians = (angle: number) => angle * Math.PI / 180;
  return {
    comparable: true as const, warnings,
    populationDelta: b.result.additional_population - a.result.additional_population,
    overlapDelta: delta(a.result.multiple_coverage_population, b.result.multiple_coverage_population),
    sites: first.map(point => {
      const other = byId.get(point.cell_id)!;
      const h = Math.sin(radians(other.latitude - point.latitude)/2)**2 + Math.cos(radians(point.latitude))*Math.cos(radians(other.latitude))*Math.sin(radians(other.longitude - point.longitude)/2)**2;
      const distanceKm = 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
      return { id: point.cell_id, first: point, second: other, distanceKm,
        uniqueA: exclusive(a,point.cell_id), uniqueB: exclusive(b,point.cell_id),
        uniqueDelta: delta(exclusive(a,point.cell_id), exclusive(b,point.cell_id)) };
    }),
  };
}
