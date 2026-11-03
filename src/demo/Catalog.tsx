import { useEffect, useState } from 'react';
import { FileText, FolderOpen } from 'lucide-react';
import { catalog, cities, loadDemoRun, type CatalogItem, type DemoCity } from './api';
import type { NetworkDesignRun } from '../types';
import { placementOptions, meteoOptions } from './options';

export function DemoCatalog({onOpen}: {onOpen:(run:NetworkDesignRun)=>void}) {
  const [items,setItems]=useState<CatalogItem[]>([]),[locations,setLocations]=useState<DemoCity[]>([]);
  const [city,setCity]=useState('osm-area-1782722'),[mode,setMode]=useState('new_network'),[count,setCount]=useState(7);
  const [error,setError]=useState(''),[loading,setLoading]=useState(false);
  const [placement,setPlacement]=useState('population_coverage'),[meteo,setMeteo]=useState('annual');
  const [analysis,setAnalysis]=useState('coverage_backbone');
  const [expanded,setExpanded]=useState(true);
  useEffect(()=>{ Promise.all([catalog(),cities()]).then(([runs,towns])=>{setItems(runs);setLocations(towns);}).catch(e=>setError(e.message)); },[]);
  const selected=items.find(x=>x.city_id===city && x.planning_mode===mode && x.post_count===count && (x.placement_mode || 'population_coverage')===placement && (x.meteo_profile || 'annual')===meteo && (x.analysis_profile || 'coverage_backbone')===analysis);
  async function open() {
    if (!selected) return;
    setLoading(true); setError('');
    try { onOpen(await loadDemoRun(selected)); setExpanded(false); } catch(e) {setError(e instanceof Error ? e.message : String(e));} finally {setLoading(false);}
  }
  return <section className={`module-card demo-catalog${expanded ? "" : " is-collapsed"}`}>
    <header><button type="button" className="button button--ghost demo-catalog-toggle" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded ? "Свернуть каталог" : "Выбрать другой сценарий"}</button><div><span className="network-inputs__eyebrow">РЯЗАНСКАЯ ОБЛАСТЬ · ГОТОВЫЕ РАСЧЁТЫ</span><h2><FolderOpen size={21}/> Каталог сценариев</h2><p>12 городов · {items.length || '…'} расчётов · исходная методика Air SGM</p></div></header>
    {expanded && <><div className="demo-catalog__controls">
      <label>Город<select value={city} onChange={e=>setCity(e.target.value)}>{locations.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Задача<select value={mode} onChange={e=>{setMode(e.target.value); if (count===0 && e.target.value==='new_network')setCount(1);}}><option value="new_network">Новая сеть</option><option value="expand">Расширение действующей сети</option></select></label>
      <label>Цель сети<select value={placement} onChange={e=>setPlacement(e.target.value)}>{placementOptions.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <label>Период ветра<select value={meteo} onChange={e=>setMeteo(e.target.value)}>{meteoOptions.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <label>Проверка<select value={analysis} onChange={e=>setAnalysis(e.target.value)}><option value="coverage_backbone">Быстрый расчёт</option><option value="extended_diagnostics">Исследовательская</option></select></label>
      <label>{mode==='expand' ? 'Добавить постов' : 'Число постов'}<select value={count} onChange={e=>setCount(Number(e.target.value))}>{Array.from({length:mode==='expand'?16:15},(_,i)=>mode==='expand'?i:i+1).map(n=><option key={n} value={n}>{n===0?'0 · оценка действующей сети':n}</option>)}</select></label>
      <button className="button button--primary" onClick={()=>void open()} disabled={!selected||loading}>{loading?'Открываем…':'Открыть готовый расчёт'}</button>
    </div>
    <p>Быстрый и исследовательский профили · пять целей · пять профилей ERA5 · базовая сетка 1 км и радиус 2,5 км. Исследовательский профиль сравнивает периоды, сетку 0,5 км и радиус 5 км. При расширении новые зоны добавляются к действующим постам.</p>
    </>}
    {error&&<div role="alert" className="form-error">{error}</div>}
  </section>;
}
