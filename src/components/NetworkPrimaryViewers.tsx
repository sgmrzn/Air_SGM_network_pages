import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { baseMapStyle } from "../mapStyle";
import { request } from "../shared/http";
import { CompactWindRose } from "./CompactWindRose";
import type { WindRoseData } from "../types";
import { fetchPlaces } from "../api";

interface Preview {
  image: string; bounds: [number, number, number, number]; boundary: GeoJSON.Geometry;
  native_width: number; native_height: number; dataset: { id: string; reference_year?: number; source?: string };
}

export function PopulationRasterViewer({ territory }: { territory: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [pixel, setPixel] = useState("");
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError(""); setPixel("");
    request<Preview>(`/api/spatial/network-design/population-preview?territory_id=${encodeURIComponent(territory)}`, { signal: controller.signal }).then(setData).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [territory]);
  useEffect(() => {
    if (!data || !container.current) return;
    const [west, south, east, north] = data.bounds;
    const map = new maplibregl.Map({ container: container.current, style: baseMapStyle, bounds: [[west, south], [east, north]], fitBoundsOptions: { padding: 25 } });
    map.addControl(new maplibregl.NavigationControl(), "top-left");
    let active = true;
    let clickId = 0;
    const controller = new AbortController();
    map.on("load", () => {
      map.addSource("population-raster", { type: "image", url: data.image, coordinates: [[west, north], [east, north], [east, south], [west, south]] });
      map.addLayer({ id: "population-raster", type: "raster", source: "population-raster", paint: { "raster-resampling": "nearest", "raster-opacity": .85 } });
      map.addSource("boundary", { type: "geojson", data: { type: "Feature", properties: {}, geometry: data.boundary } });
      map.addLayer({ id: "boundary", type: "line", source: "boundary", paint: { "line-color": "#1665b3", "line-width": 2 } });
    });
    map.on("click", e => {
      const id = ++clickId;
      setPixel("Читаем исходный пиксель…");
      request<{ value: number | null; dataset_id: string }>(`/api/spatial/network-design/population-pixel?longitude=${e.lngLat.lng}&latitude=${e.lngLat.lat}`, { signal: controller.signal }).then(result => {
        if (active && id === clickId) setPixel(result.dataset_id !== data.dataset.id ? "Набор данных изменился. Обновите карту." : `${e.lngLat.lat.toFixed(5)}, ${e.lngLat.lng.toFixed(5)} · ${result.value == null ? "Нет данных" : result.value.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + " жителей в исходном пикселе"}`);
      }).catch(err => { if (active && id === clickId) setPixel(err.message); });
    });
    const observer = new ResizeObserver(() => map.resize()); observer.observe(container.current);
    return () => { active = false; controller.abort(); observer.disconnect(); map.remove(); };
  }, [data]);
  return <div className="network-inputs__viewer">
    {error && <div className="form-error" role="alert">{error}</div>}
    {!data && !error && <p role="status">Подготавливаем растр населения…</p>}
    {data && <><div className="network-inputs__viewer-meta"><strong>Население · {data.dataset.reference_year || "Год не указан"}</strong><span>Исходный фрагмент: {data.native_width} × {data.native_height} пикселей</span></div><div ref={container} className="network-inputs__raster-map" /><div className="network-inputs__raster-legend">{["< 1", "1–10", "10–50", "50–100", "≥ 100"].map((label, index) => <span key={label}><i style={{ background: ["#c6e0a9", "#ffe899", "#ffbf70", "#f27d5b", "#be3753"][index] }} />{label}</span>)} жителей / исходный пиксель</div><p role="status">{pixel || "Нажмите на карту, чтобы прочитать значение исходного пикселя."}</p><small>Карта — уменьшенное изображение растра без суммирования значений. По клику читается исходный пиксель. Показан прямоугольный фрагмент вокруг территории; это модель населения, не измерение качества воздуха. Подложка требует интернета.</small></>}
  </div>;
}

interface StoredMeteo {
  directions: WindRoseData["directions"];
  summary: { observations_count: number; mean_speed: number; calm_percent: number };
  dataset: { period_start: string; period_end: string; dataset_version_ids: string[] };
  requested_period: { coverage_percent: number; expected_hours: number; missing_months: string[] };
  grid_cell: { centroid_lon: number; centroid_lat: number };
  monthly_records: Array<{ month: string; dataset_version_id: string; observations_count: number; mean_speed: number | null; max_speed: number }>;
}
export function StoredEra5Viewer() {
  const [mode, setMode] = useState("coordinates");
  const [search, setSearch] = useState("");
  const [locations, setLocations] = useState<Array<{ id: string; name: string; longitude: number; latitude: number; region_name?: string | null }>>([]);
  const [selected, setSelected] = useState("");
  const [searching, setSearching] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [latitude, setLatitude] = useState("54.62696");
  const [longitude, setLongitude] = useState("39.70415");
  const [profile, setProfile] = useState("annual");
  const [data, setData] = useState<StoredMeteo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pending = useRef<AbortController | null>(null);
  function clearResult() { pending.current?.abort(); setLoading(false); setData(null); setError(""); }
  useEffect(() => {
    setLocations([]); setLocationError("");
    if (mode === "coordinates" || (mode === "settlement" && search.trim().length < 2)) { setSearching(false); return; }
    let active = true;
    const controller = new AbortController();
    setSearching(true);
    const timer = window.setTimeout(() => {
      const task = mode === "settlement" ? fetchPlaces(search, controller.signal) : request<Array<{ id: string; name: string; longitude: number; latitude: number }>>(`/api/spatial/network-design/meteo-regions?search=${encodeURIComponent(search)}`, { signal: controller.signal });
      task.then(items => { if (active) setLocations(items); }).catch(e => { if (active) setLocationError(e.message); }).finally(() => { if (active) setSearching(false); });
    }, 300);
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [mode, search]);
  useEffect(() => () => pending.current?.abort(), []);
  async function load(e: React.FormEvent) {
    e.preventDefault(); pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setLoading(true); setError(""); setData(null);
    try {
      setData(await request(`/api/spatial/network-design/stored-meteo?${new URLSearchParams({ latitude, longitude, profile })}`, { signal: controller.signal }));
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e)); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  return <div className="network-inputs__viewer"><div className="network-inputs__explanation"><span>Период расчёта: 2021–2025. Здесь показаны месячные записи и роза ветров из базы системы. Почасовая последовательность не сохраняется. Новые данные из интернета не загружаются.</span></div>
    <div className="network-inputs__tabs" role="group" aria-label="Выбор места ERA5">{[["coordinates", "По координатам"], ["settlement", "Населённый пункт"], ["region", "Субъект РФ"]].map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} className={mode === value ? "is-active" : ""} onClick={() => { setMode(value); setSearch(""); setSelected(""); clearResult(); }}>{label}</button>)}</div>
    {mode !== "coordinates" && <div className="network-inputs__filters"><label>Поиск {mode === "region" ? "субъекта РФ" : "населённого пункта"}<input value={search} placeholder={mode === "region" ? "Например, Рязанская область" : "Например, Рязань"} onChange={e => { setSearch(e.target.value); setSelected(""); clearResult(); }} /></label><label>{mode === "region" ? "Субъект РФ" : "Населённый пункт"}<select value={selected} onChange={e => { const place = locations.find(p => p.id === e.target.value); setSelected(e.target.value); clearResult(); if (place) { setLatitude(String(place.latitude)); setLongitude(String(place.longitude)); } }}><option value="">{searching ? "Поиск…" : "Выберите из списка"}</option>{locations.map(p => <option key={p.id} value={p.id}>{p.name}{p.region_name ? ` · ${p.region_name}` : ""}</option>)}</select></label></div>}
    {locationError && <div role="alert" className="form-error">{locationError}</div>}
    {mode !== "coordinates" && !searching && !locations.length && !locationError && <p className="network-inputs__muted">{mode === "settlement" && search.trim().length < 2 ? "Введите не менее двух букв названия." : "Совпадений в загруженных справочниках нет. Можно уточнить название или ввести координаты."}</p>}
    {mode === "region" && <p className="network-inputs__explanation">Для субъекта показывается ячейка ERA5 в опорной точке внутри его границы. Это не средняя роза ветров всего субъекта. Координаты опорной точки указаны ниже.</p>}
    <form onSubmit={load} className="network-inputs__hourly-form">{[["Широта", latitude, setLatitude, -90, 90], ["Долгота", longitude, setLongitude, -180, 180]].map(([label, value, setter, min, max]) => <label key={String(label)}>{String(label)}<input aria-label={String(label)} type="number" step="any" readOnly={mode !== "coordinates"} required min={Number(min)} max={Number(max)} value={String(value)} onChange={e => { (setter as (value: string) => void)(e.target.value); clearResult(); }} /></label>)}<label>Профиль ветра<select value={profile} onChange={e => { setProfile(e.target.value); clearResult(); }}><option value="annual">Все месяцы</option><option value="cold_period">Холодный период · ноябрь–март</option><option value="warm_period">Тёплый период · апрель–октябрь</option><option value="weak_wind">Слабый ветер · 0,5–2 м/с</option></select></label><button className="button button--primary" disabled={loading || (mode !== "coordinates" && !selected)}>{loading ? "Читаем из базы…" : "Показать данные"}</button></form>
    {error && <div className="form-error" role="alert">{error}</div>}
    {data && <><div className="network-inputs__toolbar"><span>{data.dataset.period_start} — {data.dataset.period_end} · {data.summary.observations_count.toLocaleString("ru-RU")} часов · полнота {data.requested_period.coverage_percent.toFixed(1)}%</span></div>
      <p>Ячейка ERA5: {data.grid_cell.centroid_lat.toFixed(4)}, {data.grid_cell.centroid_lon.toFixed(4)}. Версий данных: {data.dataset.dataset_version_ids.length}.</p>
      {!!data.requested_period.missing_months.length && <div className="form-error">Не хватает месяцев: {data.requested_period.missing_months.join(", ")}. Статистика рассчитана только по доступным данным.</div>}
      <CompactWindRose data={data} averageSpeed={data.summary.mean_speed} calmPercent={data.summary.calm_percent} observationCount={data.summary.observations_count} />
      <div className="network-inputs__table"><table><thead><tr><th>Месяц</th><th>Учтено часов</th><th>Средняя скорость, м/с</th><th>Максимальная, м/с</th><th>Версия данных</th></tr></thead><tbody>{data.monthly_records.map(r => <tr key={r.month}><td>{r.month}</td><td>{r.observations_count}</td><td>{r.mean_speed?.toFixed(2) ?? "—"}</td><td>{r.max_speed.toFixed(2)}</td><td><small>{r.dataset_version_id}</small></td></tr>)}</tbody></table></div></>}
    <p className="network-inputs__muted">Направление показывает, откуда приходит ветер. Скорости и штиль относятся ко всем часам выбранных месяцев; профиль слабого ветра фильтрует только классы розы. Это модельные данные для ячейки ERA5, не измерения поста.</p>
  </div>;
}
