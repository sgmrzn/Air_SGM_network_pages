import { useState } from "react";
import { compareSavedLayouts, type SavedLayout } from "../shared/networkExperimentComparison";

const format = (value: number | undefined | null) => value != null && Number.isFinite(value) ? value.toLocaleString("ru-RU", {maximumFractionDigits: 0}) : "—";
const signed = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${format(value)}`;

export function NetworkExperimentComparison({ experiments, disabled, onShow }: {
  experiments: SavedLayout[]; disabled: boolean; onShow: (run: SavedLayout) => void;
}) {
  const [firstId, setFirstId] = useState("");
  const [secondId, setSecondId] = useState("");
  const layouts = experiments.filter(run => run.request?.action === "layout");
  const a = layouts.find(run => run.id === firstId), b = layouts.find(run => run.id === secondId);
  const comparison = a && b ? compareSavedLayouts(a, b) : null;
  return <details className="planning-comparison">
    <summary>Сравнить сохранённые варианты размещения</summary>
    <p className="planning-help">Выберите два эксперимента переноса одного сценария. Сравнение читает сохранённые результаты и не запускает вычисление.</p>
    {layouts.length < 2 ? <p className="planning-hint">Для сравнения нужны два сохранённых эксперимента «Перенос и охват». Пересчитайте и сохраните ещё один вариант размещения.</p> : <>
      <div className="planning-comparison__selectors">{(["А", "Б"] as const).map((label,index) => <label key={label}>Вариант {label}
        <select disabled={disabled} value={index === 0 ? firstId : secondId} onChange={event => (index === 0 ? setFirstId : setSecondId)(event.target.value)}>
          <option value="">Выберите эксперимент</option>
          {layouts.map(run => <option key={run.id} value={run.id}>{run.created_at ? new Date(run.created_at).toLocaleString("ru-RU") : "Дата неизвестна"} · {run.id.slice(0,8)}</option>)}
        </select>
      </label>)}</div>
      {comparison && !comparison.comparable && <p className="planning-hint" role="status">{comparison.reason}</p>}
      {comparison?.comparable && a && b && <>
        <p className="planning-help">Один исходный запуск, одинаковый сценарий и снимок матрицы. Разница рассчитана как Б − А.</p>
        {comparison.warnings.map(warning => <p className="planning-hint" key={warning}>{warning}</p>)}
        <div className="planning-comparison__table"><table><thead><tr><th>Показатель</th><th>А</th><th>Б</th><th>Б − А</th></tr></thead><tbody>
          <tr><td>Дополнительный охват, чел.</td><td>{format(a.result.additional_population)}</td><td>{format(b.result.additional_population)}</td><td>{signed(comparison.populationDelta)}</td></tr>
          <tr><td>Охвачены несколькими новыми постами, чел.</td><td>{format(a.result.multiple_coverage_population)}</td><td>{format(b.result.multiple_coverage_population)}</td><td>{signed(comparison.overlapDelta)}</td></tr>
        </tbody></table></div>
        <div className="planning-tool__actions"><button className="planning-button" disabled={disabled} onClick={() => onShow(a)}>Показать А на карте</button><button className="planning-button" disabled={disabled} onClick={() => onShow(b)}>Показать Б на карте</button></div>
        <div className="planning-comparison__table"><table><thead><tr><th>Пост</th><th>Координаты А, широта / долгота</th><th>Координаты Б, широта / долгота</th><th>Смещение, км</th><th>Уникальный охват А</th><th>Уникальный охват Б</th><th>Разница, чел.</th></tr></thead><tbody>
          {comparison.sites.map(site => <tr key={site.id}><td>{site.id}</td><td>{site.first.latitude.toFixed(5)} / {site.first.longitude.toFixed(5)}</td><td>{site.second.latitude.toFixed(5)} / {site.second.longitude.toFixed(5)}</td><td>{site.distanceKm.toFixed(3)}</td><td>{format(site.uniqueA)}</td><td>{format(site.uniqueB)}</td><td>{signed(site.uniqueDelta)}</td></tr>)}
        </tbody></table></div>
        <p className="planning-help">Больший охват не доказывает пригодность площадки. Перекрытие не равно избыточности измерений. Верхняя сводка остаётся сводкой исходного запуска.</p>
      </>}
    </>}
  </details>;
}
