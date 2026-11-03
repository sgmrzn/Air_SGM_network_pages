import type { NetworkDesignRun, NetworkDesignRunRequest } from '../types';
import { russianSourceName } from '../shared/sourceNamesRu';

export interface DemoCity { id: string; name: string; label: string; kind: string; longitude: number; latitude: number; region_name: string }
export interface CatalogItem { key: string; id: string; city_id: string; city: string; planning_mode: string; placement_mode?: string; meteo_profile?: string; analysis_profile?: string; sensitivity_mode?: string; grid_km?: number; radius_m?: number; network_size_mode?: string; use_exclusion_masks?: boolean; preset_key?: string; scenario_count?: number; post_count: number; file: string; resolved_post_count: number; input_fingerprint: string; created_at: string; methodology_version: string; report_size_bytes?: number; empty_baseline?: boolean; generated_report?: boolean }
const originalFetch = window.fetch.bind(window);
const cache = new Map<string, Promise<any>>();
export function demoData<T = any>(file: string): Promise<T> {
  if (!cache.has(file)) cache.set(file, originalFetch(`${import.meta.env.BASE_URL}demo/${file}`).then(async r => {
    if (!r.ok) throw new Error('Не удалось загрузить сохранённые данные. Обновите страницу.');
    if (file.endsWith('.gz')) {
      const bytes = new Uint8Array(await r.arrayBuffer());
      // Servers may send .gz files with Content-Encoding:gzip, in which case
      // fetch has already decompressed them. Decode each representation once.
      if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return JSON.parse(new TextDecoder().decode(bytes));
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      return JSON.parse(await new Response(stream).text());
    }
    return r.json();
  }).catch(e => { cache.delete(file); throw e; }));
  return cache.get(file)!;
}
export const catalog = () => demoData<CatalogItem[]>(import.meta.env.VITE_DEMO_CATALOG || 'catalog.json');
export function parameterCatalog(q: URLSearchParams): Promise<CatalogItem[]> {
  if (!q.has('grid_km')) return catalog();
  const name=`g${q.get('grid_km')}--r${q.get('radius_m')}--m${q.get('use_exclusion_masks') === 'false' ? 0 : 1}--${q.get('network_size_mode')}`;
  return demoData<CatalogItem[]>(`catalogs/${name}.json.gz`);
}
export const cities = () => demoData<DemoCity[]>('cities.json');
export async function loadDemoRun(item: CatalogItem): Promise<NetworkDesignRun> {
  const saved = await demoData(item.file);
  if (saved.format === 'air-sgm-run-blocks-v1' || saved.format === 'air-sgm-preset-bundle-v1') {
    const expand = async (value: any): Promise<any> => {
      if (value && typeof value === 'object' && Object.keys(value).length === 1 && value.$air_sgm_block) {
        const block = await demoData(`${saved.shared_dir}${value.$air_sgm_block}.json.gz`);
        return JSON.stringify(block).includes('"$air_sgm_block"') ? expand(block) : structuredClone(block);
      }
      if (Array.isArray(value)) return Promise.all(value.map(expand));
      if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key,child]) => [key,await expand(child)])));
      return value;
    };
    return expand(saved.format === 'air-sgm-preset-bundle-v1' ? saved.runs[item.preset_key!] : saved.tree);
  }
  if (saved.format !== 'air-sgm-run-delta-v1') return saved;
  let run = structuredClone(await demoData(saved.base_file));
  for (const [path, value] of saved.changes) {
    if (!path.length) { run = structuredClone(value); continue; }
    let parent = run;
    for (const part of path.slice(0, -1)) {
      if (['__proto__','constructor','prototype'].includes(String(part))) throw new Error('Некорректный путь паспорта');
      parent = parent[part];
    }
    const last = path.at(-1);
    if (['__proto__','constructor','prototype'].includes(String(last))) throw new Error('Некорректный путь паспорта');
    parent[last] = structuredClone(value);
  }
  return run;
}
const loadedPresetRuns = new Map<string, NetworkDesignRun>();
export async function loadPreparedConfiguration(request: NetworkDesignRunRequest): Promise<NetworkDesignRun> {
  const name = `${request.territory_id}--${request.placement_mode}--g${request.grid_km}--r${request.radius_m}--m${Number(request.use_exclusion_masks)}--${request.network_size_mode}`;
  const file = `presets/${name}.json.gz`;
  const presetKey = `${request.meteo_profile}|${request.planning_mode}|${request.post_count}|${request.analysis_profile === 'extended_diagnostics' ? 'research' : 'quick'}`;
  const saved = await demoData(file);
  if (!saved.runs?.[presetKey]) throw new Error('Паспорт выбранного сочетания ещё не подготовлен.');
  const result = await loadDemoRun({file,preset_key:presetKey} as CatalogItem);
  loadedPresetRuns.set(result.id, result);
  return result;
}
export function demoReportUrl(id: string) { return `${import.meta.env.BASE_URL}demo/reports/${id}.html`; }
let dbPromise: Promise<IDBDatabase> | undefined;
function database() {
  return dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('air-sgm-network-pages-v1', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('reports', { keyPath: 'id' }); req.result.createObjectStore('settings'); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('Браузер не разрешил сохранение локальных данных.'));
  });
}
async function storage(store: string, method: 'get' | 'getAll' | 'put' | 'delete', value?: any, key?: string): Promise<any> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, method === 'get' || method === 'getAll' ? 'readonly' : 'readwrite');
    const obj = transaction.objectStore(store);
    const request = method === 'getAll' ? obj.getAll() : method === 'put' ? (key ? obj.put(value, key) : obj.put(value)) : method === 'get' ? obj.get(value) : obj.delete(value);
    let result: any;
    request.onsuccess = () => { result = request.result; };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
async function localStations() { return (await storage('settings', 'get', 'stations')) ?? demoData('stations.json'); }
function asJson(value: any, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }); }
function containsPolygon(point: number[], rings: number[][][]) {
  const inRing = (ring: number[][]) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]) inside = !inside;
    }
    return inside;
  };
  return inRing(rings[0]) && !rings.slice(1).some(inRing);
}
async function insideRegion(lon: number, lat: number) {
  const region = (await demoData('regions.json')).features[0].geometry;
  return region.type === 'Polygon' ? containsPolygon([lon, lat], region.coordinates) : region.coordinates.some((p: number[][][]) => containsPolygon([lon,lat],p));
}
function filterItems(items: any[], q: URLSearchParams) {
  const search = (q.get('search') || '').toLocaleLowerCase('ru-RU');
  return items.filter(x => (!q.get('registry') || x.registry === q.get('registry')) && (!search || [x.name,x.original_name].some(name=>(name || '').toLocaleLowerCase('ru-RU').includes(search))));
}
export async function resolveDemoApi(url: URL, options?: RequestInit): Promise<Response> {
  const p = url.pathname, q = url.searchParams, method = (options?.method || 'GET').toUpperCase();
  const body = () => JSON.parse(String(options?.body || '{}'));
  const cityId = q.get('territory_id');
  if (p === '/api/spatial/network-territories' || p === '/api/places') {
    const search = (q.get('search') || q.get('q') || '').toLocaleLowerCase('ru-RU');
    return asJson((await cities()).filter(c => c.name.toLocaleLowerCase('ru-RU').includes(search)));
  }
  if (p === '/api/spatial/boundaries/region/geojson') return asJson(await demoData('regions.json'));
  if (p === '/api/spatial/network-design/meteo-regions') {
    return asJson(await demoData('meteo-regions.json'));
  }
  if (p === '/api/spatial/network-design/readiness' || p === '/api/spatial/network-design/population-preview') {
    if (!(await cities()).some(c => c.id === cityId)) throw new Error('Выберите город Рязанской области.');
    const data = structuredClone(await demoData(`cities/${cityId}/${p.endsWith('readiness') ? 'readiness' : 'population-preview'}.json`));
    if (p.endsWith('readiness') && data.ready_for_population_only_new_network && !data.layers.stations?.stationary_count) {
      data.ready_for_population_only_expansion = true;
      data.demo_empty_baseline = true;
    }
    return asJson(data);
  }
  if (p === '/api/spatial/network-design/official-population') {
    return asJson({detail:'Готовые расчёты используют сохранённые исходные данные. Изменение официального населения и пересчёт доступны в основной программе.'},405);
  }
  if (/^\/api\/spatial\/network-design\/runs\/[^/]+\/(experiments|experiment-jobs)$/.test(p)) {
    if(method==='GET') return asJson([]);
    if(p.endsWith('/experiments')&&body()?.action==='validate')return asJson({result:{status:'unavailable',sites:[],message:'Новая проверка перенесённых точек требует сервера основной программы. Исходные расчётные зоны сохранены в паспорте.'}});
    return asJson({detail:'Новые проектные эксперименты требуют расчётного сервера основной программы. В демонстрации доступны сохранённые расчёты и проверка алгоритма.'},405);
  }
  if (/^\/api\/spatial\/network-design\/runs\/[^/]+\/(site-domain|bundle)$/.test(p)||p.includes('/experiment-jobs/'))return asJson({detail:'Операция требует сервера основной программы. Используйте сохранённый JSON-паспорт и HTML-отчёт.'},405);
  if (p === '/api/spatial/network-design/input-features') {
    const data = await demoData(`cities/${cityId}/${q.get('layer')}.json`);
    const offset = Number(q.get('offset') || 0), limit = Number(q.get('limit') || 100);
    return asJson({...data, features:data.features.slice(offset,offset+limit),offset,limit});
  }
  if (['input-passport', 'input-layer', 'input-export'].some(endpoint => p === `/api/spatial/network-design/${endpoint}`)) {
    if (!(await cities()).some(city => city.id === cityId)) return asJson({detail:'Выберите город из опубликованного снимка Рязанской области.'},404);
    const directory = `input-evidence/${cityId}`;
    if (p.endsWith('/input-passport')) return asJson(await demoData(`${directory}/passport.json`));
    const layer = q.get('layer') || 'residential';
    if (!['residential','roads','constraints'].includes(layer)) return asJson({detail:'Неизвестный векторный слой.'},422);
    if (p.endsWith('/input-layer')) return asJson(await demoData(`${directory}/${layer}.json.gz`));
    return originalFetch(`${import.meta.env.BASE_URL}demo/${directory}/${layer}.zip`, {signal:options?.signal});
  }
  if (p === '/api/spatial/network-design/population-pixel') {
    const lon=Number(q.get('longitude')), lat=Number(q.get('latitude'));
    for (const city of await cities()) {
      const pixels = await demoData(`cities/${city.id}/pixels.json`);
      const [a,,c,,e,f] = pixels.transform;
      const col=Math.floor((lon-c)/a), row=Math.floor((lat-f)/e);
      if (row>=0 && row<pixels.values.length && col>=0 && col<pixels.values[0].length) {
        const value = pixels.values[row][col];
        return asJson({value:value<0 ? null : value,dataset_id:pixels.dataset_id,longitude:lon,latitude:lat});
      }
    }
    return asJson({detail:'Точка находится вне сохранённых фрагментов городов.'},404);
  }
  if (p === '/api/spatial/network-design/stored-meteo') {
    const lon=Number(q.get('longitude')), lat=Number(q.get('latitude'));
    if (!await insideRegion(lon,lat)) throw new Error('Выберите точку в Рязанской области.');
    // ERA5 cell identity is exported explicitly; never substitute nearest-city values.
    for (const city of await cities()) {
      const data=await demoData(`cities/${city.id}/meteo-${q.get('profile') || 'annual'}.json`);
      if (lon>=data.grid_cell.min_lon && lon<data.grid_cell.max_lon && lat>=data.grid_cell.min_lat && lat<data.grid_cell.max_lat) return asJson(data);
    }
    const regionData=await demoData(`meteo-region-${q.get('profile') || 'annual'}.json`);
    if (lon>=regionData.grid_cell.min_lon && lon<regionData.grid_cell.max_lon && lat>=regionData.grid_cell.min_lat && lat<regionData.grid_cell.max_lat) return asJson(regionData);
    return asJson({detail:'Для этой ячейки ERA5 нет сохранённого фрагмента. Выберите один из 12 городов.'},404);
  }
  if (p === '/api/spatial/network-design/runs' || p === '/api/spatial/network-design/runs/async') {
    const request = body() as NetworkDesignRunRequest;
    if (request.grid_km !== 1 || request.radius_m !== 2500 || !['coverage_backbone','extended_diagnostics'].includes(request.analysis_profile) || request.network_size_mode !== 'required_network_size' || !request.use_exclusion_masks || request.sensitivity_mode !== (request.analysis_profile === 'extended_diagnostics' ? 'standard' : 'off') || request.source_context_radius_km !== 25 || request.wind_sector_tolerance_deg !== 22.5 || request.selected_source_ids?.length || request.transport_evidence_mode !== 'auto' || request.post_type !== 'stationary') {
      throw new Error('Базовый расчёт демонстрации использует сетку 1 км и радиус 2,5 км. Для сравнения с сеткой 0,5 км и радиусом 5 км выберите исследовательский профиль.');
    }
    if (request.post_count > 15 || request.post_count < (request.planning_mode === 'expand' ? 0 : 1)) throw new Error('Выберите до 15 постов.');
    const result = await loadPreparedConfiguration(request);
    // A saved research-mode result cannot silently pass as a normative request.
    if (!request.research_mode && result.readiness.normative_requirements.minimum && request.planning_mode === 'new_network' && request.post_count < result.readiness.normative_requirements.minimum) throw new Error('Включите исследовательский режим для числа постов ниже численного ориентира.');
    return asJson(result,201);
  }
  if (p.startsWith('/api/spatial/network-design/runs/')) {
    const loaded=loadedPresetRuns.get(p.split('/').pop()!);
    if (loaded) return asJson(loaded);
    const item=(await catalog()).find(x => x.id===p.split('/').pop());
    return item ? asJson(await loadDemoRun(item)) : asJson({detail:'Расчёт не найден'},404);
  }
  if (p === '/api/spatial/network-design/reports') {
    if (method !== 'GET') return asJson({detail:'Скачайте отчёт на компьютер. Каталог готовых отчётов доступен только для чтения.'},405);
    return asJson((await parameterCatalog(q)).map(x => ({id:x.id,run_id:x.id,territory:x.city,created_at:x.created_at,recommended_positions:x.resolved_post_count,scenario_count:x.scenario_count || 1,methodology_version:x.methodology_version,input_fingerprint:x.input_fingerprint,size_bytes:x.report_size_bytes || 0,generated_report:x.generated_report,demo_placement:x.placement_mode || 'population_coverage',demo_meteo:x.meteo_profile || 'annual',demo_analysis:x.analysis_profile || 'coverage_backbone',demo_mode:x.planning_mode,demo_count:x.post_count,demo_note:x.empty_baseline?'Пустой исходный реестр':'',demo_file:x.file,demo_preset_key:x.preset_key})));
  }
  if (p.startsWith('/api/spatial/network-design/reports/')) return asJson({detail:'Каталог отчётов доступен только для чтения.'},405);
  if (p === '/api/spatial/monitoring-stations/regions') return asJson(['Рязанская область']);
  if (p === '/api/spatial/monitoring-stations/addresses') return asJson((await localStations()).map((x: any) => x.address).filter(Boolean));
  if (p.startsWith('/api/spatial/monitoring-stations')) {
    const stations=await localStations();
    if (method === 'GET') return asJson(stations);
    const id=p==='/api/spatial/monitoring-stations' ? crypto.randomUUID() : p.split('/').pop();
    if (method === 'DELETE') {
      await storage('settings','put',stations.filter((x: any) => x.id!==id),'stations');
      return asJson({message:'Запись удалена из локальной демонстрации.'});
    }
    if (!(options?.body instanceof FormData)) throw new Error('Некорректная форма поста');
    const fields=Object.fromEntries(options.body.entries());
    const lon=Number(fields.longitude),lat=Number(fields.latitude);
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || !await insideRegion(lon,lat)) throw new Error('Координаты поста должны находиться в Рязанской области.');
    const station={...stations.find((x: any) => x.id===id),...fields,id,longitude:lon,latitude:lat,pollutants:String(fields.pollutants || '').split(',').map(x=>x.trim()).filter(Boolean),coordinate_accuracy_m:Number(fields.coordinate_accuracy_m)||null};
    await storage('settings','put',[...stations.filter((x: any) => x.id!==id),station],'stations');
    return asJson(station,method==='POST' ? 201 : 200);
  }
  if (p === '/api/spatial/sources/osm/status') return asJson(await demoData('osm-status.json'));
  if (p === '/api/spatial/sources/osm') {
    const data=await demoData('osm.json');
    const search=(q.get('search')||'').toLocaleLowerCase('ru-RU');
    const localized=data.features.map((f: any)=>({...f,properties:{...f.properties,original_name:f.properties.name,name:russianSourceName(f.properties)}}));
    const features=localized.filter((f: any) => (!q.get('feature_type') || f.properties.feature_type===q.get('feature_type')) && (!search || [f.properties.name,f.properties.original_name].some(name=>(name||'').toLocaleLowerCase('ru-RU').includes(search))));
    const offset=Number(q.get('offset')||0),limit=Number(q.get('limit')||2000);
    const preview = !q.get('feature_type') && offset===0 && features.length>limit
      ? ['industrial_osm','railway_osm','airport_osm'].flatMap(kind=>features.filter((f: any)=>f.properties.feature_type===kind).slice(0,Math.max(1,Math.floor(limit/3)))).slice(0,limit)
      : features.slice(offset,offset+limit);
    return asJson({...data,total:features.length,features:preview});
  }
  if (p === '/api/spatial/sources') {
    const data=await demoData('sources.json'); const items=filterItems(data.items.map((item:any)=>({...item,original_name:item.name,name:russianSourceName(item)})),q);
    return asJson({...data,total:items.length,items:items.slice(0,Number(q.get('limit')||2000))});
  }
  throw new Error('Эта операция требует полной серверной версии Air SGM.');
}
export function installDemoApi() {
  window.fetch = async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input),window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return originalFetch(input,options);
    if (options?.signal?.aborted) throw new DOMException('Aborted','AbortError');
    try {
      const response = await resolveDemoApi(url,options);
      if (options?.signal?.aborted) throw new DOMException('Aborted','AbortError');
      return response;
    } catch (error) {
      if (error instanceof DOMException && error.name==='AbortError') throw error;
      return asJson({detail:error instanceof Error ? error.message : String(error)},409);
    }
  };
}
