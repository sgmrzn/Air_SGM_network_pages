import type { NetworkDesignRun } from "../types";

const escape = (value: unknown) =>
  String(value ?? "не указано")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const number = (value: number | null | undefined, digits = 0) =>
  value == null || !Number.isFinite(value)
    ? "не указано"
    : value.toLocaleString("ru-RU", { maximumFractionDigits: digits });

export function networkReportConclusionHtml(run: NetworkDesignRun): string {
  const result = run.ensemble,
    coverage = result.coverage_summary;
  const total = coverage?.population_total;
  const covered = coverage?.total_covered_population;
  const share =
    total != null && total > 0 && covered != null
      ? (100 * covered) / total
      : null;
  const feasibility = result.feasibility;
  return `<section class="panel report-conclusion"><h2>Заключение по результатам расчёта</h2>
    ${feasibility ? `<p><b>Результат предварительного отбора.</b> ${escape(feasibility.message)} Доступно кандидатных участков: ${number(feasibility.available_candidates)}.${feasibility.suggested_grid_km.length ? ` Можно проверить более подробную сетку: ${feasibility.suggested_grid_km.map((value) => number(value, 2)).join("; ")} км.` : ""}</p>` : ""}
    <p>Для территории «${escape(run.readiness.territory.name)}» сформировано ${result.resolved_post_count} из ${run.request.post_count} заданных зон${run.request.planning_mode === "expand" ? " дополнения действующей сети" : " новой сети"}. Число постов задано параметрами расчёта; результат не определяет необходимую численность сети.</p>
    <p>${share == null ? "Доля расчётного охвата населения в сохранённом результате не определена." : `При радиусе анализа ${number(run.request.radius_m / 1000, 2)} км охват составляет ${number(covered)} чел., или ${number(share, 1)}% населения расчётной сетки.`} Дополнительный охват: ${number(coverage?.additional_covered_population)} чел.; вне зон охвата: ${number(coverage?.remaining_uncovered_population)} чел.</p>
    <p>Выделенные зоны служат исходными вариантами для обследования площадок. Окончательное размещение требует определения цели наблюдений, перечня загрязняющих веществ, масштаба пространственной репрезентативности и условий отбора проб.</p>
  </section>`;
}

export function networkReportQualityHtml(run: NetworkDesignRun): string {
  const evidence = run.scenario_results[0]?.result.placement_evidence;
  const mrScope = evidence?.hazard_status
    ? `<p>В модели использованы отдельные пространственные подходы МР 2.1.6.0157-19: детализация сетки, геометрия площадок и интерполяция ветра. Полный алгоритм МР не выполнен. Опасность предприятий и риск для здоровья не определены: отсутствуют выбросы по веществам и концентрации. Веса 45/25/20/10% комплексного режима являются авторскими параметрами, а не коэффициентами МР.</p>`
    : "";
  const quality = run.data_quality,
    coverage = run.ensemble.coverage_summary;
  if (!quality)
    return `${mrScope}<div class="report-data-quality"><h3>Качество исходных данных</h3><p>Сведения об автоматической проверке качества не сохранены. Полнота и актуальность исходных данных не подтверждены.</p></div>`;
  const difference = quality.population_comparison?.difference_percent;
  const objective = run.scenario_results[0]?.result.objective;
  const mismatch =
    objective?.population_weighted === false &&
    Boolean(objective.fallback) &&
    (coverage?.population_total ?? 0) > 0;
  const feasibility = run.ensemble.feasibility;
  const reviewZones = feasibility?.review_zones ?? [];
  return `${mrScope}<div class="report-data-quality"><h3>Основание оценки и ограничения данных</h3>
    ${reviewZones.length ? `<p><b>Ограничения требуют отдельной проверки.</b> ${reviewZones.map((zone) => `Зона ${escape(zone.zone_code)}: ${zone.constraints.map((item) => escape(item.name || item.id || "ограничение территории")).join(", ")}`).join("; ")}. Допустимость размещения не подтверждена.</p>` : ""}
    <p>WorldPop: ${escape(quality.population.year ?? "год не указан")}. Численность на расчётной сетке, используемая для определения доли охвата: ${number(coverage?.population_total)} чел. Сумма населения в границе по исходному растру: ${number(quality.population_comparison?.territory_population)} чел.${difference == null ? "" : ` Расхождение сетки и растра: ${number(difference, 2)}%.`}</p>
    <p>Пиксели с корректными значениями: ${number(quality.population.valid_percent, 1)}%; пиксели без значений: ${number(quality.population.nodata_percent, 1)}%. Доля пикселей без значений не является долей неучтённого населения.</p>
    ${mismatch ? `<p class="notice"><b>Несогласованность описания расчёта.</b> В сохранённом описании целевой функции указан резервный режим единичных весов ячеек, хотя показатели охвата приведены в численности населения. До использования результата в проектном обосновании необходимо проверить фактически применённые веса. Численные результаты в отчёте воспроизведены без изменения.</p>` : ""}
    ${quality.issues.length ? `<details><summary>Замечания автоматической проверки (${quality.issues.length})</summary><ul>${quality.issues.map((issue) => `<li>${escape(issue.message)}</li>`).join("")}</ul></details>` : "<p>Замечания автоматической проверки не зарегистрированы; натурная проверка площадок в её состав не входит.</p>"}
  </div>`;
}

export function networkReportSolverHtml(run: NetworkDesignRun): string {
  const result = run.scenario_results[0]?.result;
  const masks = result?.suitability_masks as
    | (NonNullable<typeof result>["suitability_masks"] & {
        optimization_diagnostics?: {
          status?: string;
          primary_optimum?: number;
          selected_primary_value?: number;
          primary_loss_fraction?: number;
        };
      })
    | undefined;
  const screening =
    run.ensemble.candidate_screening ?? result?.candidate_screening;
  const diagnostics = masks?.optimization_diagnostics;
  const method =
    (
      {
        maximum_coverage_two_stage_milp:
          "Двухэтапная целочисленная оптимизация покрытия",
        maximum_coverage_milp: "Целочисленная оптимизация покрытия",
        greedy_fallback: "Последовательный выбор зон (резервный алгоритм)",
        not_run: "Оптимизация не выполнялась",
      } as Record<string, string>
    )[masks?.optimizer ?? ""] ?? "Метод не указан в сохранённом результате";
  const status =
    (
      {
        solved: "Решение получено",
        optimal: "Оптимальное решение по статусу решателя",
        infeasible: "Допустимое решение не найдено",
        time_limit: "Достигнут лимит времени",
      } as Record<string, string>
    )[diagnostics?.status ?? ""] ?? "Статус решателя не сохранён";
  return `<h3>Метод и область поиска</h3><p>${escape(method)}. ${escape(status)}.</p>
    ${screening ? `<p>Рассмотрено ${number(screening.screened_count)} из ${number(screening.admissible_total)} допустимых ячеек. ${screening.optimality_scope === "full_admissible_pool" ? "Поиск охватывал весь допустимый набор." : "Поиск ограничен предварительно отобранным набором; результат нельзя распространять на все допустимые ячейки."} Пересечение с жилой застройкой определено ${screening.residential_intersection_exact ? "точным геометрическим методом" : "приближённым методом"}.</p>` : "<p>Сведения о полноте набора допустимых ячеек не сохранены.</p>"}
    ${diagnostics?.primary_optimum != null ? `<p>Записанное целевое значение первого этапа: ${number(diagnostics.primary_optimum, 3)}; значение выбранного решения: ${number(diagnostics.selected_primary_value, 3)}. Единицы целевой функции определяются режимом размещения и могут отличаться от численности населения.</p>` : ""}
    <p>Полнота рассмотренного набора и совпадение целевых значений сами по себе не являются сертификатом глобальной оптимальности. Разрыв оптимальности и границы оценки в этой версии отчёта не представлены.</p>`;
}
