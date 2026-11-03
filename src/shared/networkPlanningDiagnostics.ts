import type { NetworkDesignRun } from "../types";

const escape = (value: unknown) =>
  String(value ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const population = (value: number | undefined | null) =>
  value == null ? "—" : Math.round(value).toLocaleString("ru-RU");
const profile = (value: string) =>
  (
    ({
      annual: "Среднегодовой",
      warm_period: "Тёплый период",
      cold_period: "Холодный период",
    }) as Record<string, string>
  )[value] ?? value;
const qualityStatus = (value: string) =>
  (
    ({
      ready: "Проверка выполнена",
      warning: "Есть замечания",
      blocked: "Данные не прошли проверку",
    }) as Record<string, string>
  )[value] ?? "Не определён";

export function networkPlanningDiagnosticsHtml(run: NetworkDesignRun): string {
  const diagnostics = run.ensemble.planning_diagnostics;
  const stress = run.ensemble.fixed_layout_stress;
  const manifest = run.reproducibility;
  const quality = run.data_quality;
  const zones = run.ensemble.zone_stability;
  if (!diagnostics && !manifest && !quality) return "";
  const curve =
    diagnostics?.growth_curve
      ?.map(
        (row) =>
          `<tr><td>${row.post_count}</td><td>${population(row.additional_population)}</td><td>+${population(row.marginal_population)}</td><td>${row.kind === "selected_prefix" ? "Выбранные зоны" : "Условное добавление"}</td></tr>`,
      )
      .join("") ?? "";
  const sites =
    diagnostics?.site_impacts
      ?.map(
        (row) =>
          `<tr><td>${escape(row.cell_id)}</td><td>${population(row.population_lost_if_removed)}</td><td>${row.nearby_replacements.map((item) => `${item.latitude.toFixed(5)} / ${item.longitude.toFixed(5)}: ${item.population_delta > 0 ? "+" : ""}${population(item.population_delta)} чел.`).join("<br>") || "Нет ближайших расчётных замен"}</td></tr>`,
      )
      .join("") ?? "";
  const stressRows =
    stress?.variants
      .map(
        (row) =>
          `<tr><td>${escape(profile(row.scenario_id))}</td><td>${row.grid_km}</td><td>${row.radius_m / 1000}</td><td>${population(row.additional_population)}</td></tr>`,
      )
      .join("") ?? "";
  return `<h2>Обоснование предварительного расчёта</h2>
    ${quality ? `<h3>Качество данных</h3><p>WorldPop: ${escape(quality.population.year)}; пиксели с корректными значениями: ${quality.population.valid_percent?.toFixed(1) ?? "—"}%; пиксели без значений: ${quality.population.nodata_percent?.toFixed(1) ?? "—"}%. ${escape(qualityStatus(quality.status))}.</p><ul>${quality.issues.map((issue) => `<li>${escape(issue.message)}</li>`).join("")}</ul><p>Население в границе: ${population(quality.population_comparison.territory_population)}; на расчётной сетке: ${population(quality.population_comparison.grid_population)}. ${escape(quality.population_comparison.explanation)}</p>${quality.layers ? `<table><thead><tr><th>Слой</th><th>Дата снимка</th><th>Дата загрузки</th></tr></thead><tbody>${quality.layers.map((row) => `<tr><td>${escape(row.label)}</td><td>${escape(row.year ?? row.source_snapshot_at?.slice(0, 10))}</td><td>${escape(row.imported_at?.slice(0, 10) ?? row.updated_at?.slice(0, 10))}</td></tr>`).join("")}</tbody></table>` : ""}` : ""}
    ${zones ? `<h3>Смещения между вариантами</h3><p>${escape(zones.interpretation)}</p>${zones.contour_interpretation ? `<p>${escape(zones.contour_interpretation)}</p>` : ""}<table><thead><tr><th>Зона</th><th>Повторяемость</th><th>Максимальное смещение, км</th><th>Разных координат</th><th>Контур</th><th>Площадь, км²</th></tr></thead><tbody>${zones.zones.map((row) => `<tr><td>${escape(row.cell_id)}</td><td>${row.support_fraction == null ? "—" : (100 * row.support_fraction).toFixed(0)}%</td><td>${row.maximum_shift_km?.toFixed(2) ?? "—"}</td><td>${row.distinct_position_count ?? "—"}</td><td>${escape(row.contour_kind)}</td><td>${row.contour_area_km2?.toFixed(4) ?? "—"}</td></tr>`).join("")}</tbody></table>` : ""}
    ${run.ensemble.district_coverage?.length ? `<h3>Районные ограничения</h3><table><thead><tr><th>Район</th><th>Охват населения</th><th>Минимум</th><th>Выполнено</th></tr></thead><tbody>${run.ensemble.district_coverage.map((row) => `<tr><td>${escape(row.name)}</td><td>${row.coverage_percent?.toFixed(1) ?? "—"}%</td><td>${row.min_coverage_percent}%</td><td>${row.meets ? "Да" : "Нет"}</td></tr>`).join("")}</tbody></table>` : ""}
    <p>Геометрический охват населения; концентрации и риск здоровью не рассчитываются. Данные ниже относятся к расчётным ячейкам, а не к физической представительности постов.</p>
    ${
      diagnostics?.status === "ready"
        ? `<h3>Эффект количества новых постов</h3><p>${escape(diagnostics.growth_interpretation)}</p>
      <div class="table-wrap"><table><thead><tr><th>Новых постов</th><th>Дополнительный охват, чел.</th><th>Прирост, чел.</th><th>Вариант</th></tr></thead><tbody>${curve}</tbody></table></div>
      <p>Повторно покрыто несколькими новыми постами: ${population(diagnostics.population_covered_by_multiple_new_posts)} чел.; общий охват считается без повторов.</p>
      <h3>Исключение зоны и ближайшие замены</h3><p>${escape(diagnostics.replacement_interpretation)}</p>
      <div class="table-wrap"><table><thead><tr><th>Расчётная зона</th><th>Потеря охвата при исключении, чел.</th><th>Координаты замены и изменение охвата</th></tr></thead><tbody>${sites}</tbody></table></div>`
        : `<p>${escape(diagnostics?.reason)}</p>`
    }
    ${
      stress
        ? `<h3>Одна сеть при разных допущениях</h3><p>${stress.status === "ready" ? `Диапазон: ${population(stress.minimum_additional_population)}–${population(stress.maximum_additional_population)} чел.` : "Геометрическая устойчивость не оценена: недостаточно разных сеток или радиусов."}</p><p>${escape(stress.interpretation)}</p>
      <div class="table-wrap"><table><thead><tr><th>Профиль</th><th>Сетка, км</th><th>Радиус, км</th><th>Охват фиксированной сети, чел.</th></tr></thead><tbody>${stressRows}</tbody></table></div>`
        : ""
    }
    ${
      manifest
        ? `<h3>Паспорт воспроизводимости</h3><p>Версия: ${escape(manifest.version)}. Python ${escape(manifest.runtime.python)}.</p>
      <p style="overflow-wrap:anywhere">Отпечаток входов: ${escape(manifest.input_fingerprint)}. Отпечаток матричного расчёта: ${escape(diagnostics?.calculation_fingerprint)}.</p>
      <p>${escape(
        Object.entries(manifest.runtime.packages)
          .map(([name, version]) => `${name}: ${version ?? "не установлен"}`)
          .join("; "),
      )}</p>
      <ul>${manifest.limitations.map((text) => `<li>${escape(text)}</li>`).join("")}</ul>
      <ul>${manifest.method_references.map((item) => `<li><a href="${escape(item.url)}">${escape(item.title)}</a> — ${escape(item.role)}</li>`).join("")}</ul>`
        : ""
    }`;
}
