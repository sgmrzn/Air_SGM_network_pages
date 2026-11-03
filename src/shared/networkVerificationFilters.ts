import type { VerificationCase } from "./networkVerification";

export interface VerificationFilters {
  city: string;
  grid: string;
  count: string;
  scope: string;
}

export const verificationFilterLabels: Record<
  keyof VerificationFilters,
  string
> = {
  city: "Город",
  grid: "Шаг сетки",
  count: "Задано постов",
  scope: "Особенности расчёта",
};

export function filterVerificationCases(
  cases: VerificationCase[],
  filters: VerificationFilters,
) {
  return cases.filter(
    (c) =>
      (filters.city === "all" || c.territory_id === filters.city) &&
      (filters.grid === "all" || c.grid_km === Number(filters.grid)) &&
      (filters.count === "all" || c.post_count === Number(filters.count)) &&
      (filters.scope === "all" ||
        (filters.scope === "review"
          ? c.feasibility.status === "requires_review"
          : filters.scope === "infeasible"
            ? c.classification === "infeasible"
            : c.classification === "completed" && !c.independent_confirmation)),
  );
}

// Keep the user's latest choice and as many existing constraints as possible.
// When equally many can be kept, prefer city, then post count, then grid.
export function updateVerificationFilters(
  cases: VerificationCase[],
  current: VerificationFilters,
  key: keyof VerificationFilters,
  value: string,
  locked: (keyof VerificationFilters)[] = [],
) {
  const requested = { ...current, [key]: value };
  const others = (["city", "count", "grid", "scope"] as const).filter(
    (field) =>
      field !== key && requested[field] !== "all" && !locked.includes(field),
  );
  let best = requested;
  let bestScore = -1;
  let reset: (keyof VerificationFilters)[] = [];
  for (let mask = 0; mask < 1 << others.length; mask++) {
    const candidate = { ...requested };
    const removed = others.filter((_, index) => mask & (1 << index));
    removed.forEach((field) => {
      candidate[field] = "all";
    });
    if (!filterVerificationCases(cases, candidate).length) continue;
    const score =
      (others.length - removed.length) * 100 +
      others.reduce(
        (sum, _, index) =>
          sum + (mask & (1 << index) ? 0 : 1 << (others.length - index)),
        0,
      );
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
      reset = removed;
    }
  }
  return { filters: best, reset };
}
