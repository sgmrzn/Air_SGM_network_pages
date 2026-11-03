import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { baseMapStyle } from "../mapStyle";

export type VectorLayer = "residential" | "roads" | "constraints";
export type InputLayer = VectorLayer | "population" | "hourly";
export const inputLayerNames: Record<InputLayer, string> = {
  residential: "Жилая застройка",
  roads: "Транспорт OSM",
  constraints: "Маски и ограничения",
  population: "Население WorldPop",
  hourly: "Метеоданные ERA5",
};
export const inputTypeNames: Record<string, string> = {
  residential: "Жилая территория",
  residential_building: "Жилое здание",
  restricted_land: "Территория с ограничениями",
  water: "Водоём",
  protected_area: "ООПТ · экспертная проверка",
  road_proxy_motorway: "Автомагистраль",
  road_proxy_trunk: "Магистральная дорога",
  road_proxy_primary: "Главная дорога",
  railway_osm: "Действующая железная дорога",
  airport_osm: "Аэропорт OSM",
  industrial_osm: "Промышленная площадка OSM",
};
export const relationNames: Record<string, string> = {
  inside: "Внутри границы",
  crossing: "Пересекает / касается границы",
  outside: "Вне границы",
  invalid: "Ошибка геометрии",
};
export const number = (value: number | null | undefined, digits = 2) =>
  value == null || !Number.isFinite(value)
    ? "Не установлено"
    : value.toLocaleString("ru-RU", { maximumFractionDigits: digits });
export const date = (value?: string | null) => {
  if (!value) return "Не установлена";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Не установлена"
    : parsed.toLocaleDateString("ru-RU");
};

interface SourceVersion {
  source_filename?: string;
  source_snapshot_at?: string | null;
  source_version?: string;
  source_url?: string;
  source?: string;
  name?: string;
  id?: string;
  reference_year?: number;
  source_date?: string | null;
  imported_at?: string;
  period_start?: string;
  period_end?: string;
  sha256?: string;
  version_kind?: string;
}
export interface Provenance {
  record_count: number;
  dated_record_count: number;
  missing_record_count: number;
  oldest_source_at?: string | null;
  newest_source_at?: string | null;
  oldest_imported_at?: string | null;
  newest_imported_at?: string | null;
  sources: SourceVersion[];
}
export interface VectorSummary {
  total: number;
  spatial_counts: Record<string, number>;
  territory_area_km2: number;
  area_inside_km2: number;
  area_percent: number;
  length_inside_km: number;
  hard_exclusion_area_km2: number | null;
  expert_review_area_km2: number | null;
  classes: Array<{
    feature_type: string;
    count: number;
    inside_count: number;
    area_inside_km2: number;
    length_inside_km: number;
  }>;
  source_provenance: Provenance;
  content_sha256: string;
  measurement_crs: string;
  role: string;
  method: string;
  limitations: string;
  selection_rule: string;
}
export interface InputProperties {
  id: string;
  name: string | null;
  feature_type: string;
  created_at: string | null;
  spatial_relation: string;
  area_inside_km2: number | null;
  length_inside_km: number | null;
  restriction_policy?: string;
}
export interface VectorData {
  type: "FeatureCollection";
  features: Array<GeoJSON.Feature<GeoJSON.Geometry | null, InputProperties>>;
  boundary: GeoJSON.Geometry;
  summary: VectorSummary;
  layer: VectorLayer;
}
export interface InputPassport {
  version: string;
  territory: { id: string; name: string };
  vectors: Record<VectorLayer, VectorSummary>;
  population: {
    status: string;
    source_provenance: Provenance;
    dataset?: SourceVersion & {
      original_filename?: string;
      source_url?: string;
    };
    quality: {
      inside_pixels?: number;
      valid_pixels?: number;
      nodata_pixels?: number;
      nodata_percent?: number;
      extent_covers_boundary?: boolean;
      population?: number;
    };
  };
  meteo: {
    status: string;
    record_count: number;
    source_provenance: Provenance;
  };
  boundary: {
    source?: string;
    source_provenance: Provenance;
    dataset_fingerprint?: string;
  };
  local_meteo: {
    status: string;
    note?: string;
    cell_count?: number;
    requested_period?: {
      coverage_percent: number;
      expected_hours: number;
      available_months: string[];
      missing_months: string[];
    };
    dataset?: {
      period_start: string;
      period_end: string;
      dataset_version_ids: string[];
    };
    aggregation?: { spatial_coverage_percent: number };
  };
}

export function InputOverview({
  passport,
  layer,
  onSelect,
}: {
  passport: InputPassport;
  layer: InputLayer;
  onSelect: (layer: InputLayer) => void;
}) {
  const quality = passport.population.quality;
  const meteo = passport.local_meteo;
  return (
    <section
      className="input-evidence__overview"
      aria-label="Сводка исходных данных"
    >
      <div className="input-evidence__section-head">
        <div>
          <h3>Состав и пространственное покрытие</h3>
          <p>
            {passport.territory.name} · площадь границы{" "}
            {number(passport.vectors.residential.territory_area_km2)} км²
          </p>
        </div>
        <span className="input-evidence__notice">
          Наличие данных ≠ подтверждение полноты
        </span>
      </div>
      <div className="network-inputs__table">
        <table>
          <thead>
            <tr>
              <th>Слой</th>
              <th>Набор и период</th>
              <th>Объём внутри территории</th>
              <th>Качество и ограничения</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Граница поселения</strong>
                <small>{passport.territory.id}</small>
              </td>
              <td>
                {passport.boundary.source || "Источник не записан"}
                <small>
                  Дата снимка:{" "}
                  {date(passport.boundary.source_provenance.newest_source_at)}
                </small>
              </td>
              <td>
                {number(passport.vectors.residential.territory_area_km2)} км²
              </td>
              <td>
                Основа пространственного отбора
                <small>
                  Внешний прямоугольник выборки и граница измерений различаются.
                </small>
              </td>
            </tr>
            {(["residential", "roads", "constraints"] as const).map((key) => {
              const item = passport.vectors[key];
              return (
                <tr key={key} className={layer === key ? "is-selected" : ""}>
                  <td>
                    <button
                      className="input-evidence__text-button"
                      onClick={() => onSelect(key)}
                    >
                      {inputLayerNames[key]}
                    </button>
                  </td>
                  <td>
                    OpenStreetMap
                    <small>
                      Дата снимка:{" "}
                      {date(item.source_provenance.newest_source_at)}
                    </small>
                  </td>
                  <td>
                    {number(
                      item.spatial_counts.inside + item.spatial_counts.crossing,
                      0,
                    )}{" "}
                    из {number(item.total, 0)} объектов выборки
                    <small>
                      {key === "roads"
                        ? `${number(item.length_inside_km)} км линейных объектов`
                        : `${number(item.area_inside_km2)} км² · ${number(item.area_percent)}% площади города`}
                    </small>
                  </td>
                  <td>
                    {item.spatial_counts.invalid
                      ? `Ошибки геометрии: ${item.spatial_counts.invalid}`
                      : "Невалидных геометрий не выявлено"}
                    <small>Полнота картографирования не оценена</small>
                  </td>
                </tr>
              );
            })}
            <tr className={layer === "population" ? "is-selected" : ""}>
              <td>
                <button
                  className="input-evidence__text-button"
                  onClick={() => onSelect("population")}
                >
                  Население WorldPop
                </button>
              </td>
              <td>
                {passport.population.dataset?.name || "Набор не загружен"}
                <small>
                  Расчётный год:{" "}
                  {passport.population.dataset?.reference_year ||
                    "не установлен"}
                </small>
              </td>
              <td>
                {number(quality.population, 0)} жителей по модели
                <small>
                  {number(quality.valid_pixels, 0)} валидных из{" "}
                  {number(quality.inside_pixels, 0)} пикселей
                </small>
              </td>
              <td>
                NoData: {number(quality.nodata_percent)}%
                <small>
                  {quality.extent_covers_boundary === true
                    ? "Экстент растра покрывает границу"
                    : quality.extent_covers_boundary === false
                      ? "Экстент не покрывает всю границу"
                      : "Покрытие не установлено"}
                  . NoData не заменяется нулём.
                </small>
              </td>
            </tr>
            <tr className={layer === "hourly" ? "is-selected" : ""}>
              <td>
                <button
                  className="input-evidence__text-button"
                  onClick={() => onSelect("hourly")}
                >
                  Метеоданные ERA5
                </button>
              </td>
              <td>
                Период расчёта: 2021–2025
                <small>
                  Использованных версий:{" "}
                  {number(meteo.dataset?.dataset_version_ids.length, 0)}
                </small>
              </td>
              <td>
                {meteo.status === "available"
                  ? `${meteo.cell_count} ячеек · покрытие ${number(meteo.aggregation?.spatial_coverage_percent)}%`
                  : "Покрытие территории не подтверждено"}
                <small>
                  Общие месяцы:{" "}
                  {number(meteo.requested_period?.available_months.length, 0)}{" "}
                  из 60
                </small>
              </td>
              <td>
                {meteo.status === "available"
                  ? `Полнота периода: ${number(meteo.requested_period?.coverage_percent)}%`
                  : "Локальные данные недоступны"}
                <small>
                  Месячные агрегаты; измерения постов не используются.
                </small>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function VectorPassport({ summary }: { summary: VectorSummary }) {
  const provenance = summary.source_provenance;
  return (
    <div className="input-evidence__passport">
      <div className="input-evidence__metrics">
        <div>
          <span>Внутри границы</span>
          <strong>{number(summary.spatial_counts.inside, 0)}</strong>
        </div>
        <div>
          <span>Пересекают / касаются границы</span>
          <strong>{number(summary.spatial_counts.crossing, 0)}</strong>
        </div>
        <div>
          <span>Вне границы, в прямоугольнике</span>
          <strong>{number(summary.spatial_counts.outside, 0)}</strong>
        </div>
        <div>
          <span>Ошибки геометрии</span>
          <strong>{number(summary.spatial_counts.invalid, 0)}</strong>
        </div>
      </div>
      <p className="input-evidence__role">{summary.role}</p>
      {summary.hard_exclusion_area_km2 != null && (
        <p>
          Исключающие маски:{" "}
          <strong>{number(summary.hard_exclusion_area_km2)} км²</strong>.
          Контуры для экспертной проверки:{" "}
          <strong>{number(summary.expert_review_area_km2)} км²</strong>. Эти
          площади могут пересекаться.
        </p>
      )}
      <details className="input-evidence__metadata">
        <summary>Происхождение и воспроизводимость</summary>
        <dl>
          <div>
            <dt>Первичный источник</dt>
            <dd>
              OpenStreetMap contributors ·{" "}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
              >
                Авторство и условия использования OSM
              </a>
            </dd>
          </div>
          <div>
            <dt>Даты снимков</dt>
            <dd>
              {date(provenance.oldest_source_at)} —{" "}
              {date(provenance.newest_source_at)}
              <small>
                Дата снимка установлена для{" "}
                {number(provenance.dated_record_count, 0)} из{" "}
                {number(provenance.record_count, 0)} записей.
              </small>
            </dd>
          </div>
          <div>
            <dt>Локальный импорт</dt>
            <dd>
              {date(provenance.oldest_imported_at)} —{" "}
              {date(provenance.newest_imported_at)}
              <small>
                Дата загрузки в систему не подтверждает актуальность источника.
              </small>
            </dd>
          </div>
          <div>
            <dt>SHA256 текущего входного набора</dt>
            <dd>
              <code>{summary.content_sha256}</code>
              <small>
                Исходные записи, граница, записанное происхождение и версия
                метода. Это не SHA256 файла PBF.
              </small>
            </dd>
          </div>
        </dl>
        {provenance.missing_record_count > 0 && (
          <p className="input-evidence__warning">
            Для {number(provenance.missing_record_count, 0)} записей дата
            исходного снимка неизвестна. Актуальность этих объектов не
            подтверждена.
          </p>
        )}
        {!!provenance.sources.length && (
          <div className="network-inputs__table">
            <table>
              <thead>
                <tr>
                  <th>Исходная выгрузка</th>
                  <th>Снимок</th>
                  <th>Идентификатор версии</th>
                </tr>
              </thead>
              <tbody>
                {provenance.sources.map((source, index) => (
                  <tr key={index}>
                    <td>{source.source_filename || "Имя файла не записано"}</td>
                    <td>{date(source.source_snapshot_at)}</td>
                    <td>
                      <code>{source.source_version || "Не установлен"}</code>
                      <small>
                        Идентификатор дескриптора выгрузки; не контрольная сумма
                        содержимого PBF.
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
      <details className="input-evidence__metadata">
        <summary>Метод измерения, классы и ограничения</summary>
        <p>{summary.selection_rule}</p>
        <p>{summary.method}</p>
        <p>{summary.limitations}</p>
        <p>
          Система координат измерений: <code>{summary.measurement_crs}</code>
        </p>
        <div className="network-inputs__table">
          <table>
            <thead>
              <tr>
                <th>Класс</th>
                <th>В выборке / пересекают город</th>
                <th>Площадь внутри, км²</th>
                <th>Линейная длина внутри, км</th>
              </tr>
            </thead>
            <tbody>
              {summary.classes.map((item) => (
                <tr key={item.feature_type}>
                  <td>
                    {inputTypeNames[item.feature_type] || item.feature_type}
                  </td>
                  <td>
                    {number(item.count, 0)} / {number(item.inside_count, 0)}
                  </td>
                  <td>{number(item.area_inside_km2)}</td>
                  <td>{number(item.length_inside_km)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function RasterMeteoPassport({
  passport,
  layer,
}: {
  passport: InputPassport;
  layer: "population" | "hourly";
}) {
  const population = layer === "population";
  const provenance = population
    ? passport.population.source_provenance
    : passport.meteo.source_provenance;
  const dataset = passport.population.dataset;
  return (
    <details className="input-evidence__metadata" open>
      <summary>
        Паспорт {population ? "растра населения" : "метеорологических данных"}
      </summary>
      <p>
        {population
          ? "Население суммируется по центрам пикселей внутри границы поселения. NoData означает отсутствие значения, а не отсутствие жителей. Предпросмотр карты уменьшен; по клику читается исходный пиксель."
          : "Сводка выше относится к общему периоду ячеек, покрывающих выбранную территорию, с весами по площади пересечения. Ниже можно отдельно исследовать месяцы и розу ветров для конкретной ячейки; это другой пространственный уровень."}
      </p>
      {population && (
        <dl>
          <div>
            <dt>Исходный файл</dt>
            <dd>{dataset?.original_filename || "Не установлен"}</dd>
          </div>
          <div>
            <dt>SHA256 растра</dt>
            <dd>
              <code>{dataset?.sha256 || "Не установлена"}</code>
            </dd>
          </div>
          <div>
            <dt>Источник</dt>
            <dd>
              {dataset?.source_url &&
              /^https?:\/\//.test(dataset.source_url) ? (
                <a
                  href={dataset.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Исходный набор WorldPop
                </a>
              ) : (
                "Ссылка не записана"
              )}
            </dd>
          </div>
        </dl>
      )}
      <p>
        Последний записанный импорт: {date(provenance.newest_imported_at)}. Дата
        публикации / снимка: {date(provenance.newest_source_at)}.
      </p>
      {!population && (
        <>
          <p>
            {passport.local_meteo.note ||
              "ERA5 — модельный ветровой контекст; оценка концентраций и рассеивания здесь не выполняется."}
          </p>
          <p>
            Пропущенные общие месяцы:{" "}
            {passport.local_meteo.requested_period?.missing_months.join(", ") ||
              (passport.local_meteo.status === "available"
                ? "нет"
                : "не установлены")}
            .
          </p>
          <details>
            <summary>Каталог записанных версий ERA5</summary>
            <ul>
              {provenance.sources.map((source, index) => (
                <li key={index}>
                  <code>
                    {source.id || source.source_version || source.name}
                  </code>{" "}
                  · {source.period_start || "?"} — {source.period_end || "?"}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </details>
  );
}

function geometryBounds(geometry: GeoJSON.Geometry): maplibregl.LngLatBounds {
  const bounds = new maplibregl.LngLatBounds();
  const visit = (coordinates: unknown): void => {
    if (!Array.isArray(coordinates)) return;
    if (
      typeof coordinates[0] === "number" &&
      typeof coordinates[1] === "number"
    )
      bounds.extend([coordinates[0], coordinates[1]]);
    else coordinates.forEach(visit);
  };
  if (geometry.type === "GeometryCollection")
    geometry.geometries.forEach((item) => bounds.extend(geometryBounds(item)));
  else visit(geometry.coordinates);
  return bounds;
}

export function InputVectorMap({
  data,
  selectedId,
  onSelect,
  showOutside,
}: {
  data: VectorData;
  selectedId: string;
  onSelect: (id: string) => void;
  showOutside: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<maplibregl.Map | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: baseMapStyle,
      cooperativeGestures: true,
      bounds: geometryBounds(data.boundary),
      fitBoundsOptions: { padding: 35 },
    });
    instance.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-left");
    map.on("load", () => {
      map.addSource("input-objects", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: data.features.filter(
            (f): f is GeoJSON.Feature<GeoJSON.Geometry, InputProperties> =>
              f.geometry !== null &&
              (showOutside || f.properties.spatial_relation !== "outside"),
          ),
        },
      });
      const color =
        data.layer === "roads"
          ? "#b7791f"
          : data.layer === "constraints"
            ? "#b04e75"
            : "#208574";
      map.addLayer({
        id: "input-fill",
        type: "fill",
        source: "input-objects",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": color, "fill-opacity": 0.23 },
      });
      map.addLayer({
        id: "input-line",
        type: "line",
        source: "input-objects",
        paint: { "line-color": color, "line-width": 1.8 },
      });
      map.addLayer({
        id: "input-point",
        type: "circle",
        source: "input-objects",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-color": color,
          "circle-radius": 5,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1,
        },
      });
      map.addLayer({
        id: "input-selected",
        type: "line",
        source: "input-objects",
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": "#1665e8", "line-width": 4 },
      });
      map.addLayer({
        id: "input-selected-point",
        type: "circle",
        source: "input-objects",
        filter: [
          "all",
          ["==", ["geometry-type"], "Point"],
          ["==", ["get", "id"], ""],
        ],
        paint: { "circle-color": "#1665e8", "circle-radius": 8 },
      });
      map.addSource("input-boundary", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: data.boundary },
      });
      map.addLayer({
        id: "input-boundary",
        type: "line",
        source: "input-boundary",
        paint: {
          "line-color": "#1c3455",
          "line-width": 2,
          "line-dasharray": [3, 2],
        },
      });
      map.on("click", (event) => {
        const feature = map.queryRenderedFeatures(event.point, {
          layers: ["input-fill", "input-line", "input-point"],
        })[0];
        if (feature?.properties?.id)
          select.current(String(feature.properties.id));
      });
    });
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.current = null;
      map.remove();
    };
  }, [data, showOutside]);
  useEffect(() => {
    const map = instance.current;
    if (!map) return;
    const highlight = () => {
      if (!map.getLayer("input-selected")) return;
      map.setFilter("input-selected", ["==", ["get", "id"], selectedId]);
      map.setFilter("input-selected-point", [
        "all",
        ["==", ["geometry-type"], "Point"],
        ["==", ["get", "id"], selectedId],
      ]);
      const feature = data.features.find((f) => f.properties.id === selectedId);
      if (feature?.geometry)
        map.fitBounds(geometryBounds(feature.geometry), {
          padding: 70,
          maxZoom: 16,
        });
    };
    if (map.isStyleLoaded()) highlight();
    else map.once("load", highlight);
    return () => {
      map.off("load", highlight);
    };
  }, [selectedId, data, showOutside]);
  return (
    <div className="input-evidence__map-wrap">
      <div
        ref={container}
        className="input-evidence__map"
        aria-label="Карта исходных объектов и граница территории"
      />
      <div className="input-evidence__legend">
        <span
          className={`input-evidence__swatch input-evidence__swatch--${data.layer}`}
        />
        Объекты слоя <span className="input-evidence__boundary-key" />
        Граница поселения <span className="input-evidence__selection-key" />
        Выбранный объект
      </div>
      <p>
        Показана исходная геометрия; численные показатели рассчитаны только
        внутри границы. Выберите объект на карте или в таблице. Подложка OSM
        требует интернета.
      </p>
    </div>
  );
}
