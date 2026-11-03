import { useState } from "react";
import { compareSavedSeries, type SavedSeries } from "../shared/networkExperimentSeriesComparison";

const number=(value?:number|null, digits=0) => value != null && Number.isFinite(value) ? value.toLocaleString("ru-RU",{maximumFractionDigits:digits}) : "—";
const change=(value:number|null,digits=0) => value == null ? "—" : `${value>0 ? "+" : ""}${number(value,digits)}`;
const status=(value?:string) => value ? ({optimal:"Оптимум подтверждён",feasible_time_limit:"Допустимое решение · лимит времени",infeasible:"Невыполнимая задача",no_solution:"Решение не найдено",heuristic:"Эвристика",native_fallback_not_proven:"Оптимальность не подтверждена"} as Record<string,string>)[value] ?? value : "Нет варианта";
const labels:Record<string,string>={greedy_maximum_gain:"Жадный прирост",spatial_farthest_first:"Пространственное разнесение",primary_milp:"MILP"};

export function NetworkSeriesComparison({experiments,action,disabled}:{experiments:SavedSeries[];action:"frontier"|"benchmark";disabled:boolean}) {
  const [first,setFirst]=useState(""); const [second,setSecond]=useState("");
  const choices=experiments.filter(run=>run.request?.action===action);
  const a=choices.find(run=>run.id===first), b=choices.find(run=>run.id===second);
  const result=a && b ? compareSavedSeries(a,b,action) : null;
  return <details className="planning-comparison">
    <summary>{action === "frontier" ? "Сравнить сохранённые кривые N" : "Сравнить сохранённые проверки методов"}</summary>
    <p className="planning-help">Одинаковые исходный запуск, сценарий и снимок данных. Показатели сопоставляются по N или названию метода, разница — Б − А. Новый расчёт не запускается.</p>
    {choices.length<2 ? <p className="planning-hint">Нужны две сохранённые проверки этого типа.</p> : <>
      <div className="planning-comparison__selectors">{["А","Б"].map((label,index)=><label key={label}>Проверка {label}<select disabled={disabled} value={index===0 ? first : second} onChange={event=>(index===0 ? setFirst : setSecond)(event.target.value)}>
        <option value="">Выберите эксперимент</option>{choices.map(run=><option key={run.id} value={run.id}>{run.created_at ? new Date(run.created_at).toLocaleString("ru-RU") : "Дата неизвестна"} · {run.id.slice(0,8)}</option>)}
      </select></label>)}</div>
      {result && !result.comparable && <p className="planning-hint" role="status">{result.reason}</p>}
      {result?.comparable && <>
        {result.warnings.map(text=><p className="planning-hint" key={text}>{text}</p>)}
        <div className="planning-comparison__table"><table><thead><tr><th>{action==="frontier" ? "N" : "Метод"}</th><th>Охват А</th><th>Охват Б</th><th>Разница, чел.</th><th>Цель А</th><th>Цель Б</th><th>Разница цели</th><th>Выбрано А / Б</th>{action==="frontier" && <th>Доля охвата А / Б, %</th>}<th>Статус А / Б</th><th>MIP gap А / Б</th>{action==="benchmark" && <><th>Время А / Б, с</th><th>Разница, с</th></>}</tr></thead><tbody>
          {result.rows.map(row=><tr key={row.key}><td>{labels[row.key] ?? row.key}</td><td>{number(row.a?.additional_population)}</td><td>{number(row.b?.additional_population)}</td><td>{change(row.populationDelta)}</td><td>{number(row.a?.objective_value,3)}</td><td>{number(row.b?.objective_value,3)}</td><td>{change(row.objectiveDelta,3)}</td><td>{number(row.a?.resolved_post_count)} / {number(row.b?.resolved_post_count)}</td>{action==="frontier" && <td>{number(row.a?.coverage_percent,1)} / {number(row.b?.coverage_percent,1)}</td>}<td>{status(row.a?.status)} / {status(row.b?.status)}{row.bothOptimal ? " · оба оптимальны" : ""}</td><td>{number(row.a?.mip_gap,6)} / {number(row.b?.mip_gap,6)}</td>{action==="benchmark" && <><td>{number(row.a?.duration_seconds,3)} / {number(row.b?.duration_seconds,3)}</td><td>{change(row.timeDelta,3)}</td></>}</tr>)}
        </tbody></table></div>
        <p className="planning-help">«—» означает отсутствие показателя, а не ноль. Для N, присутствующего только в одной кривой, разница не рассчитывается. Больший охват и большее значение взвешенной цели — разные показатели; неподтверждённое решение не обозначается оптимальным.</p>
      </>}
    </>}
  </details>;
}
