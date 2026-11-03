import raw from "../data/networkVerification.json";
export interface VerificationMethod {
  method: string;
  status: string;
  optimizer: string | null;
  objective_value: number | null;
  duration_seconds: number | null;
  resolved_post_count: number | null;
  common_pixel_coverage: {
    coverage_percent: number;
    covered_population: number;
    denominator: number;
  } | null;
  coordinates: number[][];
  loss_to_confirmed_optimum_percent: number | null;
  mip_gap: number | null;
  requires_review_positions: number | null;
  exact_geometry_check: {
    status: string;
    requires_expert_review: boolean;
    sites: Array<{ valid: boolean; requires_expert_review?: boolean }>;
  } | null;
}
export interface VerificationCase {
  id: string;
  city: string;
  territory_id: string;
  grid_km: number;
  post_count: number;
  radius_m: number;
  classification: string;
  feasibility: {
    status: string;
    selected_positions: number;
    available_candidates: number;
    selected_requiring_review: number;
    message: string;
    reason: string;
    field_inspection_required: boolean;
  };
  screening: {
    reduced: boolean;
    admissible_total: number;
    screened_count: number;
    optimality_scope: string;
    excluded_by_masks: number;
    residential_quality: { status: string };
    [key: string]: unknown;
  };
  reference: {
    status: string;
    optimality_confirmed?: boolean;
    objective_value?: number;
  } | null;
  independent_confirmation: boolean;
  pixel_field: {
    population_denominator: number;
    inside_pixels: number;
    valid_pixels: number;
    missing_pixels: number;
    metric: string;
  };
  methods: VerificationMethod[];
  input_sha256: string;
  case_sha256: string;
}
export interface VerificationCity {
  id: string;
  name: string;
  boundary: GeoJSON.Geometry;
  source_sha256: string;
}
export const verification = raw as unknown as {
  schema_version: number;
  title: string;
  protocol_id: string;
  methodology_version: string;
  completed_at: string;
  summary: {
    planned: number;
    recorded: number;
    classification: { completed: number; infeasible: number };
    independent_confirmations: number;
    native_status: { optimal: number; native_fallback_not_proven: number };
  };
  audit: {
    status: string;
    checked_at: string;
    implementation_sha256: string;
    protocol_sha256: string;
    scenarios: number;
    unique_input_snapshots: number;
    cell_weights_checked: number;
    algorithm_objectives_recomputed: number;
    common_pixel_metrics_recomputed: number;
    selected_geometry_checked_points: number;
    conditional_review_checked_points: number;
    distance_matrix_rows_checked: number;
    new_optimisations_run: boolean;
  };
  cities: VerificationCity[];
  cases: VerificationCase[];
};
export const methodNames: Record<string, string> = {
  primary_milp: "Основной алгоритм",
  greedy_maximum_gain: "Последовательное добавление",
  spatial_farthest_first: "Пространственное разнесение",
  spopt: "Независимый решатель spopt",
};
export const methodOrder = [
  "primary_milp",
  "greedy_maximum_gain",
  "spatial_farthest_first",
  "spopt",
];
export const primary = (item: VerificationCase) =>
  item.methods.find((method) => method.method === "primary_milp");
export const territoryStatus = (item: VerificationCase) =>
  item.classification === "infeasible"
    ? "Нет решения при заданном N"
    : item.feasibility.status === "requires_review"
      ? "Условные зоны"
      : "Для последующего обследования";
export const solverStatus = (status: string | undefined) =>
  status === "optimal" || status === "Optimal"
    ? "Оптимум подтверждён"
    : status === "native_fallback_not_proven"
      ? "Оптимум не доказан"
      : status === "heuristic"
        ? "Эвристическое решение"
        : status === "reference_skipped_size_limit"
          ? "Пропущено: размер задачи"
          : status || "Не выполнялось";
export function verificationCsv(items: VerificationCase[]) {
  const rows = [
    [
      "Город",
      "Сетка, км",
      "Задано постов",
      "Получено постов",
      "Территориальный статус",
      "Статус основного решателя",
      "Охват по пикселям, %",
      "Матричная цель",
      "Независимое подтверждение",
      "Пул сокращён",
      "Идентификатор",
    ],
    ...items.map((item) => {
      const row = primary(item);
      return [
        item.city,
        item.grid_km,
        item.post_count,
        item.feasibility.selected_positions,
        territoryStatus(item),
        solverStatus(row?.status),
        row?.common_pixel_coverage?.coverage_percent ?? "",
        row?.objective_value ?? "",
        item.independent_confirmation ? "Да" : "Нет",
        item.screening.reduced ? "Да" : "Нет",
        item.id,
      ];
    }),
  ];
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => '"' + String(value).replaceAll('"', '""') + '"')
          .join(";"),
      )
      .join("\r\n")
  );
}
