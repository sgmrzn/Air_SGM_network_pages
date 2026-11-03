import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { request } from "../shared/http";
import { SOURCE_SYMBOLS } from "../shared/sourceSymbols";

const MapPanel = lazy(() => import("../components/MapPanel"));

// The pilot region extent; the screen filters the national registry to it by
// default so the table and the map agree.
const PILOT_BOUNDS = { min_lon: 38.75, min_lat: 53.3, max_lon: 42.17, max_lat: 55.3 };

const REGISTRY_LABELS: Record<string, string> = {
  gem: "Global Energy Monitor",
  "climate-trace": "Climate TRACE",
  osm: "OpenStreetMap",
};

const OSM_LABELS: Record<string, string> = { industrial_osm: "Промышленные площадки", railway_osm: "Железные дороги", airport_osm: "Аэропорты" };
const OSM_UNNAMED: Record<string, string> = { industrial_osm: "Промышленная площадка без названия", railway_osm: "Железнодорожный участок без названия", airport_osm: "Аэродром без названия" };
type OsmResponse = GeoJSON.FeatureCollection & { total: number; counts: Record<string, number>; note: string };

interface SourceItem {
  id: string;
  name: string;
  registry: string;
  feature_type?: string;
  longitude: number;
  latitude: number;
}

interface SourcesResponse {
  total: number;
  items: SourceItem[];
  summary: Record<string, number>;
  notice: string;
}

export function SourcesPage() {
  const [regions, setRegions] = useState<GeoJSON.FeatureCollection | null>(null);
  const [regionsError, setRegionsError] = useState(false);
  const [showRegions, setShowRegions] = useState(true);
  useEffect(() => {
    let active = true;
    request<GeoJSON.FeatureCollection>("/api/spatial/boundaries/region/geojson")
      .then((collection) => { if (active) setRegions(collection); })
      .catch(() => { if (active) setRegionsError(true); });
    return () => { active = false; };
  }, []);
  const regionLayers = useMemo(() => ({ regions: regions ?? undefined }), [regions]);
  const [osmCounts, setOsmCounts] = useState<Record<string, number> | null>(null);
  const [osmData, setOsmData] = useState<OsmResponse | null>(null);
  const [osmRoadCount, setOsmRoadCount] = useState<number | null>(null);
  const [osmStatusError, setOsmStatusError] = useState(false);
  const [osmStatusRequested, setOsmStatusRequested] = useState(false);
  useEffect(() => {
    if (!osmStatusRequested) return;
    let active = true;
    request<{ feature_counts: Record<string, number> }>("/api/spatial/sources/osm/status")
      .then((context) => {
        if (!active) return;
        setOsmCounts(context.feature_counts ?? {});
        setOsmRoadCount(Object.entries(context.feature_counts ?? {})
          .filter(([key]) => key.startsWith("osm_road_proxy_"))
          .reduce((total, [, count]) => total + count, 0));
      })
      .catch(() => { if (active) setOsmStatusError(true); });
    return () => { active = false; };
  }, [osmStatusRequested]);
  const [registry, setRegistry] = useState("");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("Рязанская область");
  const regionOptions = useMemo(() => [...new Set((regions?.features ?? []).map((feature) => String(feature.properties?.name ?? "")).filter(Boolean))].sort((a,b) => a.localeCompare(b,"ru")), [regions]);
  const regionBounds = useMemo(() => {
    const feature = regions?.features.find((item) => item.properties?.name === scope);
    if (feature?.properties?.bounds) return feature.properties.bounds as number[];
    if (!feature || feature.geometry.type === "GeometryCollection") return null;
    const bounds = [Infinity, Infinity, -Infinity, -Infinity];
    const collect = (coordinates: unknown): void => {
      if (!Array.isArray(coordinates)) return;
      if (typeof coordinates[0] === "number") {
        bounds[0] = Math.min(bounds[0],coordinates[0]); bounds[1] = Math.min(bounds[1],coordinates[1]);
        bounds[2] = Math.max(bounds[2],coordinates[0]); bounds[3] = Math.max(bounds[3],coordinates[1]);
      } else coordinates.forEach(collect);
    };
    collect(feature.geometry.coordinates);
    return Number.isFinite(bounds[0]) ? bounds : null;
  }, [regions,scope]);
  const [data, setData] = useState<SourcesResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setData(null);
    setOsmData(null);
    setSelectedId(null);
    const query = new URLSearchParams({ limit: "2000" });
    query.set("territory", scope === "all" ? "russia" : scope);
    if (scope === "all") {
      query.set("min_lon", "-180"); query.set("max_lon", "180");
      query.set("min_lat", "-90"); query.set("max_lat", "90");
    }
    if (registry) query.set("registry", registry);
    if (search.trim().length >= 2) query.set("search", search.trim());
    if (regionBounds) {
      query.set("min_lon", String(regionBounds[0]));
      query.set("min_lat", String(regionBounds[1]));
      query.set("max_lon", String(regionBounds[2]));
      query.set("max_lat", String(regionBounds[3]));
    }
    const handle = window.setTimeout(() => {
      const osmQuery = new URLSearchParams(query);
      osmQuery.delete("registry");
      if (OSM_LABELS[registry]) osmQuery.set("feature_type", registry);
      const sourceQuery = new URLSearchParams(query);
      if (OSM_LABELS[registry]) { sourceQuery.delete("registry"); sourceQuery.set("limit", "1"); }
      let sources: SourcesResponse = { total: 0, items: [], summary: {}, notice: "" };
      let osm: OsmResponse | null = null;
      const publish = () => {
        if (!active) return;
        setOsmData(osm);
        const osmItems: SourceItem[] = (osm?.features ?? []).map((feature) => {
          const properties = feature.properties ?? {};
          const bounds: number[] = properties.bounds ?? [0, 0, 0, 0];
          return { id: String(properties.id), name: properties.name || OSM_UNNAMED[properties.feature_type] || "Объект OSM без названия", registry: "osm", feature_type: properties.feature_type, longitude: properties.longitude ?? (bounds[0] + bounds[2]) / 2, latitude: properties.latitude ?? (bounds[1] + bounds[3]) / 2 };
        });
        setData((previous) => ({ ...sources, summary: Object.keys(sources.summary).length ? sources.summary : previous?.summary ?? {}, total: sources.total + (osm?.total ?? 0), items: [...sources.items, ...osmItems], notice: [sources.notice, osm?.note].filter(Boolean).join(" ") }));
      };
      const failed = (reason: unknown) => {
          if (active) setError(
            reason instanceof Error
              ? reason.message
              : "Не удалось получить реестр источников",
          );
        };
      const knownRequest = request<SourcesResponse>(`/api/spatial/sources?${sourceQuery.toString()}`)
        .then((response) => { sources = OSM_LABELS[registry] ? { ...response, total: 0, items: [], notice: "" } : response; publish(); })
        .catch(failed);
      const osmRequest = !registry || OSM_LABELS[registry]
        ? request<OsmResponse>(`/api/spatial/sources/osm?${osmQuery.toString()}`).then((response) => { osm = response; publish(); }).catch(failed)
        : Promise.resolve();
      Promise.all([knownRequest, osmRequest])
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(handle); };
  }, [registry, search, scope, regionBounds]);

  const markers = useMemo(
    () =>
      (data?.items ?? []).map((item) => ({
        id: item.id,
        longitude: item.longitude,
        latitude: item.latitude,
        label: item.name,
        kind: "source" as const,
        source_symbol: item.feature_type ?? item.registry,
      })),
    [data],
  );
  const selected = data?.items.find((item) => item.id === selectedId) ?? null;
  const viewBounds = useMemo(() => {
    if (regionBounds) return [[regionBounds[0],regionBounds[1]],[regionBounds[2],regionBounds[3]]] as [[number,number],[number,number]];
    if (scope === "Рязанская область")
      return [
        [PILOT_BOUNDS.min_lon, PILOT_BOUNDS.min_lat],
        [PILOT_BOUNDS.max_lon, PILOT_BOUNDS.max_lat],
      ] as [[number, number], [number, number]];
    return [
      [19, 41],
      [191, 82],
    ] as [[number, number], [number, number]];
  }, [scope,regionBounds]);

  return (
    <div className="module-page network-coverage-page sources-page">
      <section className="module-card network-coverage__controls">
        <div className="network-coverage__toolbar">
          <label>
            <span>Реестр</span>
            <select
              value={registry}
              onChange={(event) => setRegistry(event.target.value)}
            >
              <option value="">Все реестры</option>
              <option value="gem">Global Energy Monitor</option>
              <option value="climate-trace">Climate TRACE</option>
              {Object.entries(OSM_LABELS).map(([value, label]) => <option key={value} value={value}>{label} · OSM</option>)}
            </select>
          </label>
          <label>
            <span>Регионы</span>
            <select
              value={scope}
              onChange={(event) =>
                setScope(event.target.value)
              }
            >
              {!regionOptions.length && <option value="Рязанская область">Рязанская область</option>}
              {regionOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="network-coverage__territory">
            <span>Поиск по названию</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Не менее двух символов"
            />
          </label>
        </div>
      </section>

      {error && <div className="form-error">{error}</div>}
      {regionsError && <p className="method-note">Не удалось загрузить границы регионов. Обновите страницу, чтобы повторить загрузку.</p>}
      {regions && regions.features.length === 0 && <p className="method-note">Границы регионов ещё не загружены. Добавьте их в разделе «Загрузка данных».</p>}

      <section className="network-coverage__layout">
        <article className="module-card network-coverage__map-card">
          <div className="network-coverage__map">
            <Suspense
              fallback={<div className="map-state">Загрузка MapLibre…</div>}
            >
                <MapPanel
                  boundaryLayers={regionLayers}
                  layerVisibility={{ boundaries: showRegions }}
                  mapControls={<label className="sources-region-toggle"><input type="checkbox" checked={showRegions} onChange={(event) => setShowRegions(event.target.checked)} />Границы регионов</label>}
                  mapLegend={<div className="sources-map-legend" aria-label="Обозначения реестров">{Object.entries(SOURCE_SYMBOLS).map(([key, symbol]) => <span key={key}><svg viewBox="0 0 24 24" aria-hidden="true" style={{ color: symbol.color }}><path d={symbol.path} /></svg>{symbol.label}</span>)}</div>}
                  data={null}
                  selectedCellId={null}
                  minValue={0}
                  maxValue={1}
                  onSelect={() => undefined}
                  viewBounds={viewBounds}
                  markers={markers}
                  contextLayers={osmData}
                  selectedMarkerId={selectedId}
                  onMarkerSelect={setSelectedId}
                />
            </Suspense>
            {loading && (
              <div className="sources-loading" role="status">
                <span className="spinner" />
                Загрузка реестра…
              </div>
            )}
          </div>
          <p className="method-note">{data?.notice}</p>
        </article>

        <aside className="network-coverage__side">
          <section className="wind-kpis network-coverage__kpis network-coverage__kpis--stacked">
            <article>
              <span>В ВЫБОРКЕ</span>
              <strong>{data?.total ?? "—"}</strong>
              <p>
                {scope === "all" ? "по всей России" : "в пределах региона"}
              </p>
            </article>
            <article>
              <span>GLOBAL ENERGY MONITOR</span>
              <strong>{data?.summary.gem ?? "—"}</strong>
              <p>объектов в реестре</p>
            </article>
            <article>
              <span>CLIMATE TRACE</span>
              <strong>{data?.summary["climate-trace"] ?? "—"}</strong>
              <p>объектов в реестре</p>
            </article>
          </section>

          <article className="module-card source-registry">
            <div className="module-card__head">
              <div>
                <span>РЕЕСТР</span>
                <h3>Источники в выборке</h3>
                <p>{selected ? selected.name : "Выберите объект, чтобы посмотреть его координаты"}</p>
                {data && data.total > data.items.length && <p>На карте показано {data.items.length} из {data.total.toLocaleString("ru-RU")} объектов. Выберите тип или уточните поиск.</p>}
                {selected?.registry === "osm" && <p>Значок расположен на объекте внутри выбранной территории; контур показан на карте.</p>}
              </div>
            </div>
            <div className="source-registry__list">
              {(data?.items ?? []).slice(0, 200).map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={item.id === selectedId ? "is-selected" : ""}
                  aria-pressed={item.id === selectedId}
                  onClick={() => setSelectedId(item.id)}
                >
                  <strong>{item.name}</strong>
                  <span className="source-registry__badge">{SOURCE_SYMBOLS[item.feature_type ?? item.registry] && <svg viewBox="0 0 24 24" aria-hidden="true" style={{ color: SOURCE_SYMBOLS[item.feature_type ?? item.registry].color }}><path d={SOURCE_SYMBOLS[item.feature_type ?? item.registry].path} /></svg>}{OSM_LABELS[item.feature_type ?? ""] ?? REGISTRY_LABELS[item.registry] ?? item.registry}</span>
                  <span>{item.latitude.toFixed(4)}° с. ш. · {item.longitude.toFixed(4)}° в. д.</span>
                </button>
              ))}
              {data && data.total > 200 && (
                <p>Показаны первые 200 из {data.total}; уточните фильтры.</p>
              )}
              {data && !data.items.length && <p>Ничего не найдено.</p>}
            </div>
          </article>

          <details className="module-card source-osm" onToggle={(event) => { if (event.currentTarget.open) setOsmStatusRequested(true); }}>
            <summary>Инфраструктура OSM · состояние данных</summary>
            <div className="source-osm__content">
            <div className="module-card__head">
              <div>
                <span>ДОПОЛНИТЕЛЬНЫЕ СЛОИ</span>
                <h3>Инфраструктура OSM</h3>
                <p>
                  Контуры площадок, железные дороги и аэропорты показаны на карте. Выберите тип OSM в фильтре «Реестр» для просмотра списка.
                </p>
              </div>
            </div>
            <div className="source-osm__status" role="status">
              <strong>Дорожная сеть OSM</strong>
              <p>{osmStatusError ? "Не удалось проверить загрузку данных. Попробуйте обновить страницу." : osmRoadCount === null ? "Проверяем данные…" : osmRoadCount > 0 ? `Загружено ${osmRoadCount.toLocaleString("ru-RU")} участков дорог в снимке Рязанской области. Доступность для города проверяется в расчёте сети. На этой карте дороги не показаны отдельным слоем.` : "Дорожные данные ещё не загружены. Загрузка доступна в разделе «Исходные данные сети»."}</p>
            </div>
            <details className="source-osm__details">
              <summary>Слои OSM в базе</summary>
              {Object.entries(OSM_LABELS).map(([key, label]) => <p key={key}><strong>{label}</strong><br />{osmStatusError ? "Не удалось проверить загрузку" : osmCounts === null ? "Проверяем…" : `${(osmCounts[`osm_${key}`] ?? 0).toLocaleString("ru-RU")} объектов в снимке Рязанской области`} · {key === "industrial_osm" ? "промышленный фактор" : "транспортный фактор"}</p>)}
              <p>OSM описывает геометрию объектов. Выбросы и интенсивность движения не измерены.</p>
            </details>
            </div>
          </details>
        </aside>
      </section>
    </div>
  );
}
