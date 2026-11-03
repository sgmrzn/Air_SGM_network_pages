import { useEffect, useRef, useState } from "react";
import { ExternalLink, FileText, MapPin, RefreshCw } from "lucide-react";
import { placementOptions, meteoOptions, placementLabel, meteoLabel } from '../demo/options';
import { openPreparedReport } from '../demo/reports';
import { catalog, loadDemoRun } from '../demo/api';
import type { NetworkDesignRun } from '../types';

import {
  fetchNetworkDesignReports,
  networkDesignReportUrl,
  type NetworkDesignReportItem,
} from "../api";

export function NetworkReportsPage({onOpenRun}: {onOpenRun:(run:NetworkDesignRun)=>void}) {
  const [reports, setReports] = useState<NetworkDesignReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(() => Math.max(1, Math.floor((window.innerHeight - 350) / 110)));
  useEffect(() => { const resize = () => setPageSize(Math.max(1, Math.floor((window.innerHeight - 350) / 110))); window.addEventListener('resize',resize); return () => window.removeEventListener('resize',resize); }, []);

  const [city, setCity] = useState('');
  const [mode, setMode] = useState('');
  const [count, setCount] = useState('');
  const [placement, setPlacement] = useState('');
  const [meteo, setMeteo] = useState('');
  const [analysis,setAnalysis]=useState('');
  const [preparing, setPreparing] = useState<string|null>(null);
  const loadGeneration=useRef(0);
  useEffect(() => setPage(0), [city, mode, count, placement, meteo, analysis, pageSize]);
  const visibleReports = reports.filter(r => (!city || r.territory === city) && (!mode || r.demo_mode === mode) && (!count || r.demo_count === Number(count)) && (!placement || r.demo_placement === placement) && (!meteo || r.demo_meteo === meteo) && (!analysis || r.demo_analysis===analysis));
  const report = async (id: string) => {
    setPreparing(id); setError('');
    const item=reports.find(r=>r.id===id);
    try { await openPreparedReport(id, item?.demo_file ? {file:item.demo_file,preset_key:item.demo_preset_key} : undefined); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сформировать отчёт'); }
    finally { setPreparing(null); }
  };

  const openMap = async (item:NetworkDesignReportItem) => {
    setPreparing(item.id);setError('');
    try {
      const selected=(await catalog()).find(row=>row.id===(item.run_id || item.id));
      if(!selected)throw new Error('Готовый расчёт не найден в каталоге.');
      onOpenRun(await loadDemoRun(selected));
    } catch(reason){setError(reason instanceof Error ? reason.message : 'Не удалось открыть расчёт на карте');}
    finally{setPreparing(null);}
  };

  const load = () => {
    const generation=++loadGeneration.current;
    setLoading(true);
    setError("");
    setLoadError(false);
    fetchNetworkDesignReports()
      .then(items=>{if(generation===loadGeneration.current){setReports(items);setPage(0);}})
      .catch((reason) => {if(generation===loadGeneration.current){setLoadError(true);setError(reason instanceof Error ? reason.message : "Не удалось загрузить архив отчётов");}})
      .finally(() => {if(generation===loadGeneration.current)setLoading(false);});
  };

  useEffect(load, []);

  return (
    <div className="module-page network-reports-page">
      <section className="module-card network-reports__shell">
        <header className="network-reports__head">
          <div>
            <span>МОДУЛЬ 1 · КАТАЛОГ РАСЧЁТОВ И ОТЧЁТОВ</span>
            <h2>Готовые расчёты и отчёты сети</h2>
            <p>Выберите готовый расчёт: «На карте» открывает результат в «Сети мониторинга», «Отчёт» — документ для просмотра.</p>
          </div>
          
        </header>
        {error && <div className="form-error" role="alert">{error}
          {loadError && !loading && <button className="button button--ghost network-reports__retry" onClick={load}>
            <RefreshCw aria-hidden="true" /> Повторить загрузку
          </button>}
        </div>}
        <div className="demo-report-filters"><label>Город<select value={city} onChange={e=>setCity(e.target.value)}><option value="">Все города области</option>{[...new Set(reports.map(r=>r.territory).filter(Boolean))].map(name=><option key={name!} value={name!}>{name}</option>)}</select></label><label>Тип сети<select value={mode} onChange={e=>setMode(e.target.value)}><option value="">Все варианты</option><option value="new_network">Новая сеть</option><option value="expand">Расширение действующей сети</option></select></label><label>Запрошено постов<select value={count} onChange={e=>setCount(e.target.value)}><option value="">Любое число</option>{Array.from({length:16},(_,n)=><option key={n} value={n}>{n}</option>)}</select></label><label>Цель сети<select value={placement} onChange={e=>setPlacement(e.target.value)}><option value="">Все цели</option>{placementOptions.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Период ветра<select value={meteo} onChange={e=>setMeteo(e.target.value)}><option value="">Все периоды</option>{meteoOptions.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><span>{visibleReports.length} отчётов</span></div>
        <div className="demo-report-filters demo-report-filters--parameters">
          <label>Профиль проверки<select value={analysis} onChange={e=>setAnalysis(e.target.value)}><option value="">Оба профиля</option><option value="coverage_backbone">Быстрый</option><option value="extended_diagnostics">Исследовательский</option></select></label>
        </div>
        {loading && <div className="network-reports__empty">Загрузка каталога…</div>}
        {!loading && !reports.length && (
          <div className="network-reports__empty">
            <FileText aria-hidden="true" />
            <strong>Сохранённых отчётов пока нет</strong>
            <span>Готовые отчёты доступны для просмотра.</span>
          </div>
        )}
        {!!reports.length && (
          <div className="network-reports__table-wrap">
            <table className="network-reports__table">
              <thead><tr><th>Создан</th><th>Территория</th><th>Результат</th><th>Методика</th><th>Расчёт и данные</th><th>Действия</th></tr></thead>
              <tbody>{visibleReports.slice(page * pageSize, (page + 1) * pageSize).map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.created_at).toLocaleString("ru-RU")}</td>
                  <td><strong>{item.territory || "Не указана"}</strong><small>{item.demo_mode === 'expand' ? `Расширение · добавить ${item.demo_count}` : `Новая сеть · ${item.demo_count} постов`}</small>{item.demo_note && <small>{item.demo_note}</small>}</td>
                  <td>{item.recommended_positions ?? "—"} позиций · {item.scenario_count ?? "—"} сценариев<small>{placementLabel(item.demo_placement)}</small><small>{meteoLabel(item.demo_meteo)} · {item.demo_analysis==='extended_diagnostics'?'Исследовательский':'Быстрый'}</small></td>
                  <td>{item.methodology_version || "—"}</td>
                  <td><code>{item.run_id}</code><small>{item.input_fingerprint?.slice(0, 16)}…</small></td>
                  
                  <td><div className="network-reports__actions"><button className="button button--ghost" disabled={preparing === item.id} onClick={()=>void openMap(item)}><MapPin aria-hidden="true"/>На карте</button><button className="button button--ghost" disabled={preparing === item.id} onClick={() => void report(item.id)}><ExternalLink aria-hidden="true"/>Отчёт</button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {!loading && <footer className="demo-pagination"><span>{visibleReports.length ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, visibleReports.length)} из ${visibleReports.length}` : 'Нет отчётов по выбранным условиям'}</span><button className="button button--ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Назад</button><label>Страница <select value={page} onChange={e => setPage(Number(e.target.value))}>{Array.from({length:Math.max(1,Math.ceil(visibleReports.length / pageSize))},(_,n)=><option key={n} value={n}>{n+1}</option>)}</select></label><button className="button button--ghost" disabled={(page + 1) * pageSize >= visibleReports.length} onClick={() => setPage(page + 1)}>Далее</button></footer>}
      </section>
    </div>
  );
}
