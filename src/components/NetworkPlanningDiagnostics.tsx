import type { NetworkPlanningDiagnostics, NetworkFixedLayoutStress, NetworkReproducibility, NetworkZoneStability } from "../types";
import "./NetworkPlanning.css";

const count = (value: number | null | undefined) => value == null ? "—" : Math.round(value).toLocaleString("ru-RU");
const profileLabels: Record<string, string> = {
  annual: "Годовой",
  cold_period: "Холодный период",
  warm_period: "Тёплый период",
  weak_wind: "Слабый ветер",
  calm_accumulation: "Штиль",
  accumulation_risk: "Слабое перемешивание",
};

export function NetworkPlanningDiagnosticsView({ diagnostics, stress, manifest, selectedCellId, zones }: {
  zones?: NetworkZoneStability;
  diagnostics?: NetworkPlanningDiagnostics;
  stress?: NetworkFixedLayoutStress;
  manifest?: NetworkReproducibility;
  selectedCellId?: string | null;
}) {
  if (!diagnostics && !manifest) return null;
  const site = diagnostics?.site_impacts?.find(item => item.cell_id === selectedCellId);
  return <section className="network-planning-diagnostics" aria-label="Обоснование предварительного расчёта">
    <header className="planning-heading"><div><span className="planning-eyebrow">АНАЛИЗ ИСХОДНОГО ЗАПУСКА</span><h3>Обоснование предварительного расчёта</h3>
    <p>Охват населения, вклад отдельных зон и чувствительность размещения.</p></div><span className="planning-badge">Геометрическая оценка</span></header>
    <p className="planning-help">Концентрации и риск для здоровья не рассчитываются. Все показатели ниже относятся к исходному запуску.</p>
    {diagnostics?.status === "ready" ? <>
      <details open>
        <summary>Эффект количества новых постов</summary>
        <p>{diagnostics.growth_interpretation}</p>
        <table><thead><tr><th>Новых постов</th><th>Дополнительный охват, чел.</th><th>Прирост, чел.</th><th>Вариант</th></tr></thead>
          <tbody>{diagnostics.growth_curve?.map(row => <tr key={row.post_count}>
            <td>{row.post_count}</td><td>{count(row.additional_population)}</td><td>+{count(row.marginal_population)}</td>
            <td>{row.kind === "selected_prefix" ? "Выбранные зоны" : "Условное добавление"}</td>
          </tr>)}</tbody></table>
        <p>Повторно покрыто двумя и более новыми постами: {count(diagnostics.population_covered_by_multiple_new_posts)} чел. В общем охвате каждый житель учитывается один раз. Это аналитическая геометрия, а не подтверждённая представительность постов.</p>
      </details>
      {site && <details open>
        <summary>Вклад выбранной зоны и ближайшие замены</summary>
        <p>Исключение зоны без перестановки остальных точек уменьшает охват на {count(site.population_lost_if_removed)} чел.</p>
        <p>{diagnostics.replacement_interpretation}</p>
        {site.nearby_replacements.length ? <table><thead><tr><th>Координаты, широта / долгота</th><th>Смещение, км</th><th>Изменение охвата, чел.</th></tr></thead>
          <tbody>{site.nearby_replacements.map(row => <tr key={row.cell_id}>
            <td>{row.latitude.toFixed(5)} / {row.longitude.toFixed(5)}</td><td>{row.distance_km.toFixed(2)}</td>
            <td>{row.population_delta > 0 ? "+" : ""}{count(row.population_delta)}</td>
          </tr>)}</tbody></table> : <p>Других допустимых расчётных точек в пределах 1,5 км не найдено.</p>}
      </details>}
    </> : <p>{diagnostics?.reason ?? "Для сохранённого запуска диагностика не выполнялась."}</p>}
    {zones && <details><summary>Смещения точек между вариантами</summary><p>{zones.interpretation}</p>{zones.contour_interpretation && <p>{zones.contour_interpretation}</p>}<p>Вариантов: {zones.variant_count}; разных сочетаний сетки и радиуса: {zones.distinct_geometry_count}. Контуры наблюдаемых смещений и линии можно включить на карте итоговой сети. Зелёная заливка — совпадения во всех проверенных вариантах, оранжевая — неполная повторяемость. Это не разрешённая область размещения.</p><table><thead><tr><th>Зона</th><th>Повторяемость</th><th>Максимальное смещение, км</th><th>Разных координат</th><th>Контур</th><th>Площадь контура, км²</th></tr></thead><tbody>{zones.zones.map(row => <tr key={row.cell_id}><td>{row.cell_id}</td><td>{row.support_fraction == null ? "—" : `${(100*row.support_fraction).toFixed(0)}%`}</td><td>{row.maximum_shift_km?.toFixed(2) ?? "Нет совпадений"}</td><td>{row.distinct_position_count ?? "—"}</td><td>{({Polygon:"Область",LineString:"Линия",Point:"Точка",not_evaluated:"Нет совпадений"} as Record<string,string>)[row.contour_kind ?? ""] ?? "Не сохранён"}</td><td>{row.contour_area_km2 == null ? "—" : row.contour_area_km2.toLocaleString("ru-RU",{maximumFractionDigits:4})}</td></tr>)}</tbody></table></details>}
    {stress && (stress.status === "ready" && stress.distinct_geometry_count > 1 ? <details>
      <summary>Устойчивость сети · охват {count(stress.minimum_additional_population)}–{count(stress.maximum_additional_population)} чел.</summary>
      <p>Проверено вариантов сетки и радиуса: {stress.distinct_geometry_count}.</p>
      <p>{stress.interpretation}</p>
      <table><thead><tr><th>Профиль</th><th>Сетка, км</th><th>Радиус, км</th><th>Охват фиксированной сети, чел.</th></tr></thead>
        <tbody>{stress.variants.map((row, index) => <tr key={index}><td>{profileLabels[row.scenario_id] ?? row.scenario_id}</td><td>{row.grid_km}</td><td>{row.radius_m / 1000}</td><td>{count(row.additional_population)}</td></tr>)}</tbody></table>
    </details> : <p className="planning-help"><strong>Устойчивость не оценена.</strong> Сравнение разных сеток и радиусов не выполнено. Для проверки выберите исследовательский режим в дополнительных настройках.</p>)}
    {manifest && <details>
      <summary>Паспорт воспроизводимости и методические источники</summary>
      <p>Версия диагностики: {manifest.version}. Python {manifest.runtime.python}.</p>
      <p>Отпечаток входов: <code>{manifest.input_fingerprint}</code></p>
      <p>{Object.entries(manifest.runtime.packages).map(([name, version]) => `${name}: ${version ?? "не установлен"}`).join("; ")}</p>
      <ul>{manifest.limitations.map(text => <li key={text}>{text}</li>)}</ul>
      <ul>{manifest.method_references.map(item => <li key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a> — {item.role}</li>)}</ul>
    </details>}
  </section>;
}
