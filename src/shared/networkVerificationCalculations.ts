import raw from "../data/networkVerificationCalculations.json";
import type {
  VerificationCase,
  VerificationMethod,
} from "./networkVerification";

export interface MethodCalculation {
  selected_ids: string[];
  per_point: Array<{ cell_count: number; weight_sum: number }>;
  covered_cell_count: number;
  sum_before_deduplication: number;
  duplicate_weight: number;
  union_weight: number;
}
export interface CaseCalculation {
  case_sha256: string;
  matrix_sha256: string;
  candidate_count: number;
  demand_cell_count: number;
  methods: Record<string, MethodCalculation>;
}
export const calculations = raw as Record<string, CaseCalculation>;

export function methodGeometryStatus(method: VerificationMethod | undefined) {
  const check = method?.exact_geometry_check;
  if (!check) return "Геометрия не проверена";
  if (check.sites.some((site) => !site.valid))
    return "Есть нарушения геометрии";
  if (
    check.requires_expert_review ||
    (method?.requires_review_positions ?? 0) > 0
  )
    return "Нужна экспертная проверка";
  return "Геометрия проверена";
}

export function availableVerificationOptions(
  cases: VerificationCase[],
  count: string,
) {
  return cases.filter(
    (item) => count === "all" || item.post_count === Number(count),
  );
}
