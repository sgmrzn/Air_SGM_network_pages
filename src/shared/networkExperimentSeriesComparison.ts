import type { SavedLayout } from "./networkExperimentComparison";

export interface SeriesRow {
  post_count?: number; method?: string; additional_population?: number | null;
  objective_value?: number | null; coverage_percent?: number | null;
  duration_seconds?: number | null; status?: string; mip_gap?: number | null;
  resolved_post_count?: number;
}
export interface SavedSeries extends Omit<SavedLayout,"result"> {
  result: SavedLayout["result"] & { rows?: SeriesRow[]; count?: number; network_size_mode?: string; objective_kind?: string };
}
const numeric = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const delta = (a: unknown,b: unknown) => numeric(a) && numeric(b) ? b-a : null;

export function compareSavedSeries(a: SavedSeries,b: SavedSeries, action: "frontier" | "benchmark") {
  const block = (reason:string) => ({comparable:false as const,reason});
  if (a.id === b.id) return block("Выберите два разных эксперимента.");
  if (a.request?.action !== action || b.request?.action !== action) return block("Типы экспериментов различаются.");
  if (!a.origin_run_id || a.origin_run_id !== b.origin_run_id || !a.request.view || a.request.view !== b.request.view) return block("Нужны один исходный запуск и один сценарий.");
  if (!a.matrix_snapshot_sha256 || a.matrix_snapshot_sha256 !== b.matrix_snapshot_sha256) return block("Одинаковый снимок данных не подтверждён.");
  if (action === "frontier" && (!["required_network_size","budget_ceiling"].includes(a.result.network_size_mode ?? "") || a.result.network_size_mode !== b.result.network_size_mode)) return block("Режимы числа постов неизвестны или различаются.");
  if (action === "benchmark" && (!Number.isInteger(a.result.count) || a.result.count! < 0 || a.result.count !== b.result.count)) return block("Число постов неизвестно или различается.");
  if (a.result.objective_kind && b.result.objective_kind && a.result.objective_kind !== b.result.objective_kind) return block("Виды целевой функции различаются.");
  const first=a.result.rows, second=b.result.rows;
  if (!first?.length || !second?.length) return block("В одном из экспериментов нет таблицы результатов.");
  const key = (row:SeriesRow) => action === "frontier" ? row.post_count : row.method;
  const valid = (rows:SeriesRow[]) => rows.every(row => action === "frontier" ? Number.isInteger(row.post_count) && row.post_count! > 0 : typeof row.method === "string" && row.method.length > 0) && new Set(rows.map(key)).size === rows.length;
  if (!valid(first) || !valid(second)) return block("Ключи N или методов отсутствуют, некорректны либо повторяются.");
  const mapA=new Map(first.map(row=>[String(key(row)),row])), mapB=new Map(second.map(row=>[String(key(row)),row]));
  if (![...mapA.keys()].some(id=>mapB.has(id))) return block(action === "frontier" ? "Нет общих значений N для сравнения." : "Нет общих методов для сравнения.");
  const warnings:string[]=[];
  const hash = (value?: Record<string,string>) => value && Object.keys(value).length ? JSON.stringify(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))) : null;
  if (!hash(a.implementation_sha256) || !hash(b.implementation_sha256)) warnings.push("Версия реализации одного из экспериментов неизвестна.");
  else if (hash(a.implementation_sha256) !== hash(b.implementation_sha256)) warnings.push("Реализации различаются. Разница может отражать изменения алгоритма.");
  if (action === "benchmark") warnings.push("Время зависит от нагрузки и окружения. Один запуск не доказывает преимущество по производительности.");
  const keys=[...new Set([...mapA.keys(),...mapB.keys()])].sort((a,b)=> action === "frontier" ? Number(a)-Number(b) : a.localeCompare(b));
  return {comparable:true as const,warnings, rows:keys.map(id=> {
    const left=mapA.get(id), right=mapB.get(id);
    return {key:id,a:left,b:right,populationDelta:delta(left?.additional_population,right?.additional_population),
      objectiveDelta:delta(left?.objective_value,right?.objective_value), timeDelta:delta(left?.duration_seconds,right?.duration_seconds),
      bothOptimal:left?.status === "optimal" && right?.status === "optimal"};
  })};
}
