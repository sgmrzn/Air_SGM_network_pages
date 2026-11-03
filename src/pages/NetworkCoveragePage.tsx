import { lazy, Suspense, useEffect, useMemo, useState } from "react";

import {
  fetchNetworkCoverage,
  fetchNetworkPopulationStatus,
  fetchNetworkStationWindRose,
  fetchNetworkTerritories,
} from "../api";
import { WindRoseChart } from "../components/WindRoseChart";
import { DEFAULT_TERRITORY } from "../defaults";
import type {
  NetworkCoverage,
  NetworkStationWindRose,
  NetworkTerritory,
} from "../types";

const MapPanel = lazy(() => import("../components/MapPanel"));

const TYPE_LABELS: Record<string, string> = {
  stationary: "Стационарные",
  route: "Маршрутные",
  mobile: "Передвижные",
  background: "Фоновые",
};
const STATION_TYPE_LABELS: Record<string, string> = {
  stationary: "стационарный",
  route: "маршрутный",
  mobile: "передвижной",
  background: "фоновый",
};
const TERRITORY_LABELS: Record<string, string> = {
  region: "Субъект РФ",
  municipality: "Муниципальное образование",
  settlement: "Населённый пункт",
};
const SETTLEMENT_TYPE_LABELS: Record<string, string> = {
  city: "город",
  town: "город",
  village: "село",
  hamlet: "деревня",
  suburb: "микрорайон",
  locality: "населённый пункт",
};

function number(value: number | undefined): string {
  return value == null ? "—" : value.toLocaleString("ru-RU");
}

function coordinates(longitude: number, latitude: number): string {
  return `${latitude.toFixed(4)}° с. ш. · ${longitude.toFixed(4)}° в. д.`;
}

const RUMB_LABELS: Record<string, string> = {
  С: "северный",
  ССВ: "северо-северо-восточный",
  СВ: "северо-восточный",
  ВСВ: "востоко-северо-восточный",
  В: "восточный",
  ВЮВ: "востоко-юго-восточный",
  ЮВ: "юго-восточный",
  ЮЮВ: "юго-юго-восточный",
  Ю: "южный",
  ЮЮЗ: "юго-юго-западный",
  ЮЗ: "юго-западный",
  ЗЮЗ: "западно-юго-западный",
  З: "западный",
  ЗСЗ: "западно-северо-западный",
  СЗ: "северо-западный",
  ССЗ: "северо-северо-западный",
};

export function NetworkCoveragePage({
  view = "network",
}: {
  view?: "network" | "population";
}) {
  const [radiusM, setRadiusM] = useState(2500);
  const [radiusMode, setRadiusMode] = useState<"normative" | "custom">(
    "normative",
  );
  const [gridKm, setGridKm] = useState(5);
  const [populationMethod, setPopulationMethod] = useState<
    "radius" | "dynamic" | "terrain"
  >("radius");
  const [meteoSeason, setMeteoSeason] = useState("annual");
  const [meteoYear, setMeteoYear] = useState<number | null>(null);
  const [windSectorCount, setWindSectorCount] = useState<8 | 16 | 36>(16);
  const [populationSource, setPopulationSource] = useState<
    "worldpop" | "rosstat"
  >("worldpop");
  const [rosstatYear, setRosstatYear] = useState(2025);
  const [territoryKind, setTerritoryKind] = useState<
    "region" | "municipality" | "settlement"
  >("settlement");
  const [territoryQuery, setTerritoryQuery] = useState(DEFAULT_TERRITORY.label);
  const [territoryId, setTerritoryId] = useState<string | null>(
    DEFAULT_TERRITORY.id,
  );
  const [territories, setTerritories] = useState<NetworkTerritory[]>([]);
  const [data, setData] = useState<NetworkCoverage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );
  const [stationWindRose, setStationWindRose] =
    useState<NetworkStationWindRose | null>(null);
  const [windRoseLoading, setWindRoseLoading] = useState(false);
  const [operatorFilter, setOperatorFilter] = useState("");
  const [stationTypeFilter, setStationTypeFilter] = useState("");
  const [stationSearch, setStationSearch] = useState("");
  const [stationSort, setStationSort] = useState<
    "exclusive" | "population" | "area" | "name"
  >("exclusive");

  useEffect(() => {
    const controller = new AbortController();
    if (territoryKind !== "region" && !territoryId) {
      setLoading(false);
      setData(null);
      return () => controller.abort();
    }
    setLoading(true);
    setError(null);
    fetchNetworkCoverage(
      radiusM,
      territoryKind,
      territoryId,
      view === "population",
      gridKm,
      populationMethod,
      radiusMode,
      {
        operator: operatorFilter || undefined,
        stationType: stationTypeFilter || undefined,
      },
      meteoSeason,
      meteoYear,
      windSectorCount,
      populationSource,
      rosstatYear,
      controller.signal,
    )
      .then(setData)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError")
          return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Не удалось рассчитать покрытие",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [
    radiusM,
    territoryKind,
    territoryId,
    view,
    gridKm,
    populationMethod,
    radiusMode,
    operatorFilter,
    stationTypeFilter,
    meteoSeason,
    meteoYear,
    windSectorCount,
    populationSource,
    rosstatYear,
  ]);

  useEffect(() => {
    if (
      populationMethod !== "radius" &&
      meteoYear == null &&
      data?.meteo?.selected_year != null
    ) {
      setMeteoYear(data.meteo.selected_year);
    }
  }, [data?.meteo?.selected_year, meteoYear, populationMethod]);

  useEffect(() => {
    const cacheKey = (
      data?.coverage.population as { cache_key?: string } | undefined
    )?.cache_key;
    const populationStatus = data?.coverage.population.status;
    if (!cacheKey || !["queued", "running"].includes(populationStatus ?? ""))
      return;
    const poll = window.setInterval(() => {
      fetchNetworkPopulationStatus(cacheKey)
        .then((population) => {
          setData((current) =>
            current
              ? {
                  ...current,
                  coverage: {
                    ...current.coverage,
                    population: {
                      ...population,
                      methodology: current.coverage.population.methodology,
                      zones_geojson: current.coverage.population.zones_geojson,
                    },
                  },
                }
              : current,
          );
        })
        .catch(() => undefined);
    }, 1200);
    return () => window.clearInterval(poll);
  }, [data?.coverage.population]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      fetchNetworkTerritories(territoryKind, territoryQuery)
        .then((items) => {
          setTerritories(items);
        })
        .catch(() => setTerritories([]));
    }, 180);
    return () => window.clearTimeout(handle);
  }, [territoryKind, territoryQuery]);

  const chooseKind = (kind: "region" | "municipality" | "settlement") => {
    setTerritoryKind(kind);
    setGridKm(kind === "region" ? 5 : kind === "municipality" ? 2 : 1);
    setTerritoryId(null);
    setTerritoryQuery(kind === "region" ? "Рязанская область" : "");
    setData(null);
  };
  const chooseTerritory = (value: string) => {
    setTerritoryQuery(value);
    setTerritoryId(null);
  };
  const selectTerritory = (item: NetworkTerritory) => {
    setTerritoryId(item.id);
    setTerritoryQuery(item.label ?? item.name);
    setTerritories([]);
  };

  const metadata = data?.geojson.metadata;
  const viewBounds = data
    ? ([
        [data.territory.bounds.min_lon, data.territory.bounds.min_lat],
        [data.territory.bounds.max_lon, data.territory.bounds.max_lat],
      ] as [[number, number], [number, number]])
    : undefined;
  const stationsByType = useMemo(
    () => Object.entries(data?.stations.by_type ?? {}),
    [data],
  );
  const population = data?.coverage.population;
  const populationPercent =
    population?.status === "ready" && population.total_population
      ? (population.covered_population! / population.total_population) * 100
      : null;
  const selectedStation = useMemo(
    () =>
      (data?.stations.items ?? []).find(
        (item) => item.id === selectedStationId,
      ) ??
      data?.stations.items[0] ??
      null,
    [data, selectedStationId],
  );
  const selectedStationPopulation = selectedStation
    ? population?.by_station_full_population?.[selectedStation.id] ??
      population?.by_station_population?.[selectedStation.id]
    : undefined;
  const selectedStationMunicipalities = selectedStation
    ? population?.by_station_municipality_population?.[selectedStation.id]
    : undefined;
  const selectedStationExclusive = selectedStation
    ? population?.by_station_exclusive_population?.[selectedStation.id]
    : undefined;
  // Shown only when the post shares people with a neighbour. Equal values mean
  // an isolated zone, where a second figure would just repeat the first.
  const showsExclusive =
    selectedStationPopulation != null &&
    selectedStationExclusive != null &&
    selectedStationExclusive < selectedStationPopulation;
  const selectedStationPopulationPercent =
    population?.status === "ready" &&
    population.total_population &&
    selectedStationPopulation != null
      ? (selectedStationPopulation / population.total_population) * 100
      : null;
  const stationTableRows = useMemo(() => {
    const items = data?.stations.items ?? [];
    const exclusive = population?.by_station_exclusive_population;
    const perZone = population?.by_station_population;
    const zones = new Map(
      (population?.zones_geojson?.features ?? []).map((feature) => [
        feature.properties.station_id,
        feature.properties.area_km2,
      ]),
    );
    const query = stationSearch.trim().toLocaleLowerCase("ru");
    return items
      .map((item) => {
        const stationPopulation = perZone?.[item.id];
        const stationExclusive = exclusive?.[item.id];
        return {
          item,
          population: stationPopulation,
          exclusive: stationExclusive,
          overlap:
            stationPopulation != null && stationExclusive != null
              ? Math.max(0, stationPopulation - stationExclusive)
              : undefined,
          area: zones.get(item.id),
        };
      })
      .filter(
        ({ item }) =>
          !query ||
          `${item.name} ${item.operator} ${STATION_TYPE_LABELS[item.station_type] ?? item.station_type}`
            .toLocaleLowerCase("ru")
            .includes(query),
      )
      .sort((a, b) => {
        if (stationSort === "name")
          return a.item.name.localeCompare(b.item.name, "ru");
        return (b[stationSort] ?? -1) - (a[stationSort] ?? -1);
      });
  }, [
    data?.stations.items,
    population?.by_station_exclusive_population,
    population?.by_station_population,
    population?.zones_geojson,
    stationSearch,
    stationSort,
  ]);
  const selectedInfluenceZone = useMemo(
    () =>
      population?.zones_geojson?.features.find(
        (feature) => feature.properties.station_id === selectedStation?.id,
      ) ?? null,
    [population?.zones_geojson, selectedStation?.id],
  );
  const selectedZoneMeteo = selectedInfluenceZone?.properties.meteo;
  const reliefProfiles = selectedZoneMeteo?.relief_profiles ?? [];
  const reliefFactorRange = reliefProfiles.length
    ? {
        min: Math.min(...reliefProfiles.map((item) => item.factor)),
        max: Math.max(...reliefProfiles.map((item) => item.factor)),
        rise: Math.max(...reliefProfiles.map((item) => item.rise_m)),
        range: Math.max(...reliefProfiles.map((item) => item.range_m)),
        elevation: reliefProfiles[0]?.origin_elevation_m,
      }
    : null;
  const displayedWindRose =
    stationWindRose && stationWindRose.station_id === selectedStation?.id
      ? stationWindRose.wind_rose
      : selectedZoneMeteo?.wind_rose;

  useEffect(() => {
    const controller = new AbortController();
    if (populationMethod === "radius" || !selectedStation) {
      setStationWindRose(null);
      setWindRoseLoading(false);
      return () => controller.abort();
    }
    setStationWindRose(null);
    setWindRoseLoading(true);
    fetchNetworkStationWindRose(
      selectedStation.id,
      meteoSeason,
      data?.meteo?.selected_year ?? meteoYear,
      windSectorCount,
      controller.signal,
    )
      .then(setStationWindRose)
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError"))
          setStationWindRose(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setWindRoseLoading(false);
      });
    return () => controller.abort();
  }, [
    populationMethod,
    selectedStation,
    meteoSeason,
    meteoYear,
    windSectorCount,
    data?.meteo?.selected_year,
  ]);
  const stationMarkers = useMemo(
    () =>
      (data?.stations.items ?? []).map((item) => ({
        id: item.id,
        longitude: item.longitude,
        latitude: item.latitude,
        label: item.name,
        kind: "station" as const,
        station_type: item.station_type,
        station_operator: item.operator,
      })),
    [data],
  );

  const populationView = view === "population";
  const basePopulationMap = populationView
    ? (population?.zones_geojson ?? data?.geojson ?? null)
    : (data?.geojson ?? null);
  const populationMap = useMemo(() => {
    if (!populationView || !basePopulationMap) return basePopulationMap;
    const stationsById = new Map(
      (data?.stations.items ?? []).map((station) => [station.id, station]),
    );
    return {
      ...basePopulationMap,
      boundaryLayers: data?.boundary_layers,
      features: basePopulationMap.features.map((feature) => {
        const stationId = feature.properties.station_id;
        const station = stationId ? stationsById.get(stationId) : undefined;
        return station
          ? {
              ...feature,
              properties: {
                ...feature.properties,
                station_name: station.name,
                station_type:
                  STATION_TYPE_LABELS[station.station_type] ??
                  station.station_type,
                station_operator: station.operator,
                station_population:
                  population?.by_station_population?.[station.id],
              },
            }
          : feature;
      }),
    };
  }, [
    basePopulationMap,
    data?.boundary_layers,
    data?.stations.items,
    population?.by_station_population,
    populationView,
  ]);

  return (
    <div className="module-page network-coverage-page">
      <section className="module-card network-coverage__controls">
        <div
          className={`network-coverage__toolbar ${
            populationView && populationMethod !== "radius"
              ? "network-coverage__toolbar--dynamic"
              : ""
          } ${populationView ? "network-coverage__toolbar--population" : ""}`}
        >
          {populationView && (
            <label>
              <span>Режим расчёта</span>
              <select
                value={populationMethod}
                onChange={(event) =>
                  setPopulationMethod(
                    event.target.value as "radius" | "dynamic" | "terrain",
                  )
                }
              >
                <option value="radius">Фиксированный радиус</option>
                <option value="dynamic">Ветроориентированная область</option>
                <option value="terrain">Рельефно-чувствительная область</option>
              </select>
            </label>
          )}
          {populationView && (
            <label className="network-coverage__population-source">
              <span>Данные населения</span>
              <select
                value={populationSource}
                onChange={(event) =>
                  setPopulationSource(
                    event.target.value as "worldpop" | "rosstat",
                  )
                }
              >
                <option value="worldpop">WorldPop 2025 · растр 100 м</option>
                <option value="rosstat">Росстат · средняя плотность</option>
              </select>
            </label>
          )}
          {populationView && populationSource === "rosstat" && (
            <label className="network-coverage__population-year">
              <span>Год плотности Росстата</span>
              <select
                value={rosstatYear}
                onChange={(event) => setRosstatYear(Number(event.target.value))}
              >
                {[2019, 2020, 2021, 2022, 2023, 2024, 2025].map((year) => (
                  <option value={year} key={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          )}
          {populationView && populationMethod !== "radius" && (
            <label className="network-coverage__meteo-year">
              <span>Год данных ERA5</span>
              <select
                value={meteoYear ?? ""}
                onChange={(event) => setMeteoYear(Number(event.target.value))}
              >
                {(data?.meteo?.available_years ?? []).map((year) => (
                  <option value={year} key={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          )}
          {populationView && populationMethod !== "radius" && (
            <label className="network-coverage__meteo-period">
              <span>Период ветрового режима</span>
              <select
                value={meteoSeason}
                onChange={(event) => setMeteoSeason(event.target.value)}
              >
                <option value="annual">Годовой</option>
                <option value="winter">Зима</option>
                <option value="spring">Весна</option>
                <option value="summer">Лето</option>
                <option value="autumn">Осень</option>
              </select>
            </label>
          )}
          {populationView && populationMethod !== "radius" && (
            <label className="network-coverage__wind-sectors">
              <span>Секторы розы ветров</span>
              <select
                value={windSectorCount}
                onChange={(event) =>
                  setWindSectorCount(Number(event.target.value) as 8 | 16 | 36)
                }
              >
                <option value={8}>8 секторов</option>
                <option value={16}>16 секторов</option>
                <option value={36}>36 секторов</option>
              </select>
            </label>
          )}
          <label>
            <span>Масштаб расчёта</span>
            <select
              value={territoryKind}
              onChange={(event) =>
                chooseKind(
                  event.target.value as
                    "region" | "municipality" | "settlement",
                )
              }
            >
              {Object.entries(TERRITORY_LABELS).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="network-coverage__territory">
            <span>Территория</span>
            <input
              value={territoryQuery}
              onChange={(event) => chooseTerritory(event.target.value)}
              placeholder={
                territoryKind === "settlement"
                  ? "Начните вводить название"
                  : "Выберите территорию"
              }
            />
            {territoryKind !== "region" &&
              territoryQuery &&
              territories.length > 0 && (
                <div className="network-coverage__suggestions" role="listbox">
                  {territories.map((item) => (
                    <button
                      type="button"
                      role="option"
                      key={item.id}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectTerritory(item);
                      }}
                    >
                      <strong>{item.label ?? item.name}</strong>
                      {item.settlement_type && (
                        <small>
                          {SETTLEMENT_TYPE_LABELS[item.settlement_type] ??
                            "населённый пункт"}
                        </small>
                      )}
                    </button>
                  ))}
                </div>
              )}
          </label>
          {populationView && populationMethod === "radius" ? (
            <label className="network-coverage__radius-control">
              <span>Радиус зоны</span>
              <div>
                <select
                  value={radiusMode}
                  onChange={(event) => {
                    const mode = event.target.value as "normative" | "custom";
                    setRadiusMode(mode);
                    if (mode === "normative") setRadiusM(2500);
                  }}
                >
                  <option value="normative">Методический · 2,5 км</option>
                  <option value="custom">Произвольный</option>
                </select>
                {radiusMode === "custom" && (
                  <>
                    <input
                      aria-label="Произвольный радиус в километрах"
                      type="number"
                      min="0.1"
                      max="50"
                      step="0.1"
                      value={radiusM / 1000}
                      onChange={(event) =>
                        setRadiusM(
                          Math.round(
                            Math.max(
                              0.1,
                              Math.min(50, Number(event.target.value) || 0.1),
                            ) * 1000,
                          ),
                        )
                      }
                    />
                    <em>км</em>
                  </>
                )}
              </div>
            </label>
          ) : null}
        </div>

        {populationView && (
          <section
            className="network-coverage__filters"
            aria-label="Фильтры постов для расчёта"
          >
            <span className="network-coverage__filters-label">
              ФИЛЬТРЫ ПОСТОВ
            </span>
            <div className="network-coverage__filter-controls">
              <label>
                <span>Оператор</span>
                <select
                  value={operatorFilter}
                  onChange={(event) => {
                    setOperatorFilter(event.target.value);
                    setSelectedStationId(null);
                  }}
                >
                  <option value="">Все операторы</option>
                  {(data?.filters.operators ?? []).map((operator) => (
                    <option key={operator} value={operator}>
                      {operator}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Тип</span>
                <select
                  value={stationTypeFilter}
                  onChange={(event) => {
                    setStationTypeFilter(event.target.value);
                    setSelectedStationId(null);
                  }}
                >
                  <option value="">Все типы</option>
                  {(data?.filters.station_types ?? []).map((type) => (
                    <option key={type} value={type}>
                      {STATION_TYPE_LABELS[type] ?? type}
                    </option>
                  ))}
                </select>
              </label>
              {(operatorFilter || stationTypeFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setOperatorFilter("");
                    setStationTypeFilter("");
                    setSelectedStationId(null);
                  }}
                >
                  Сбросить
                </button>
              )}
            </div>
          </section>
        )}
      </section>

      {error && <div className="form-error">{error}</div>}

      {/* KPIs live in the right column beside the map, not in a band above it:
          the band cost the map ~90 px of height and split the numbers across
          two places. DOM order matches the visual order. */}

      <section className="network-coverage__layout">
        <article className="module-card network-coverage__map-card">
          <div className="network-coverage__map">
            {/* Mounted only once the territory is known: the loading panel is
                translucent, so an earlier mount showed a blurred national view
                that then jumped to the territory. */}
            <Suspense
              fallback={<div className="map-state">Загрузка MapLibre…</div>}
            >
              {data && (
                <MapPanel
                  key={stationMarkers.map((marker) => marker.id).join("|")}
                  data={populationMap}
                  selectedCellId={null}
                  minValue={0}
                  maxValue={populationMethod !== "radius" ? 6 : 1}
                  onSelect={(feature) => {
                    if (feature.properties.station_id)
                      setSelectedStationId(feature.properties.station_id);
                  }}
                  onMarkerSelect={setSelectedStationId}
                  highlightedStationId={selectedStation?.id}
                  focusedMarkerId={selectedStationId}
                  viewBounds={viewBounds}
                  markers={stationMarkers}
                  unionLayer={populationView ? population?.union_geojson : null}
                />
              )}
            </Suspense>
            {populationView && !loading && data && (
              <div
                className="map-legend network-coverage__population-legend"
                aria-label="Условные обозначения карты"
              >
                <span>
                  <i className="map-legend__zone" />
                  Совокупная зона постов
                </span>
                <span>
                  <i className="map-legend__outline" />
                  Зона отдельного поста
                </span>
                <span>
                  <i className="map-legend__station" />
                  Действующий пост
                </span>
                <span>
                  <i className="map-legend__boundary" />
                  Граница территории
                </span>
                <span>
                  <i className="map-legend__municipal" />
                  Муниципальные образования
                </span>
                <small>
                  Заливка показывает совокупную зону без наложений: пересечение
                  двух зон не означает большего значения.
                </small>
              </div>
            )}
            {loading && (
              <div className="map-state">
                <span className="spinner" />
                Расчёт покрытия…
              </div>
            )}
            {!loading && !data && (
              <div className="map-state">
                Выберите территорию из списка для расчёта.
              </div>
            )}
          </div>
        </article>
        <aside className="network-coverage__side">
          <section className="wind-kpis network-coverage__kpis network-coverage__kpis--stacked">
            <article>
              <span>
                {populationView
                  ? "НАСЕЛЕНИЕ В ЗОНАХ ПОСТОВ"
                  : "ОХВАЧЕННОЕ НАСЕЛЕНИЕ"}
              </span>
              <strong>
                {populationPercent == null
                  ? "—"
                  : `${populationPercent.toFixed(1)}%`}
              </strong>
              <p className="network-coverage__kpi-caption">
                {population?.status === "ready"
                  ? `${number(population.covered_population)} из ${number(population.total_population)}`
                  : (population?.message ?? "данные населения не рассчитаны")}
              </p>
              {population?.status === "ready" && (
                <p className="network-coverage__kpi-source">
                  {populationSource === "rosstat"
                    ? `Росстат ${rosstatYear}: ${number(population.density_per_km2)} чел./км²`
                    : "WorldPop 2025 · растр 100 м"}
                </p>
              )}
            </article>
            <article>
              <span>НАСЕЛЕНИЕ ВНЕ ЗОН</span>
              <strong>
                {population?.status === "ready"
                  ? number(population.uncovered_population)
                  : "—"}
              </strong>
              <p className="network-coverage__kpi-caption">чел. в пределах территории</p>
            </article>
          </section>
          {populationView && (
            <article className="module-card network-coverage__station-population">
              <div className="module-card__head">
                <div>
                  <span>ВЫБРАННЫЙ ПОСТ</span>
                  <h3>{selectedStation?.name ?? "Выберите пост"}</h3>
                  <p>
                    {[
                      STATION_TYPE_LABELS[
                        selectedStation?.station_type ?? ""
                      ] ?? "пост наблюдения",
                      selectedStation?.operator,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
              <div className="network-coverage__figures">
                <div>
                  <span>Население в зоне поста</span>
                  <strong>
                    {selectedStationPopulation == null
                      ? "—"
                      : number(selectedStationPopulation)}
                  </strong>
                  <small>
                    {selectedStationPopulation == null
                      ? population?.status === "ready"
                        ? "нет значения для поста"
                        : "расчёт выполняется"
                      : selectedStationPopulationPercent == null
                        ? populationSource === "rosstat"
                          ? "по средней плотности Росстата"
                          : "человек по растру"
                        : `${selectedStationPopulationPercent.toFixed(1)}% населения территории`}
                  </small>
                </div>
                {showsExclusive && (
                  <div className="network-coverage__figures-secondary">
                    <span>Назначено без двойного счёта</span>
                    <strong>{number(selectedStationExclusive)}</strong>
                    <small>
                      технически назначено ближайшему центру; это не оценка
                      репрезентативности или физического влияния поста
                    </small>
                  </div>
                )}
              </div>
              {selectedStation && (
                <dl className="network-coverage__station-facts">
                  <div>
                    <dt>Центр зоны</dt>
                    <dd>
                      {coordinates(
                        selectedStation.longitude,
                        selectedStation.latitude,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Метод</dt>
                    <dd>
                      {populationMethod !== "radius"
                        ? populationMethod === "terrain"
                          ? "рельефно-чувствительная область"
                          : "ветроориентированная область"
                        : `${radiusMode === "normative" ? "методический" : "сценарный"} радиус · ${radiusM / 1000} км`}
                    </dd>
                  </div>
                  <div>
                    <dt>Население</dt>
                    <dd>
                      {populationSource === "rosstat"
                        ? `плотность Росстата ${rosstatYear} · ${number(population?.density_per_km2)} чел./км²`
                        : "WorldPop 2025 · растр 100 м"}
                    </dd>
                  </div>
                  {selectedStationMunicipalities &&
                    Object.entries(selectedStationMunicipalities).map(
                      ([municipality, value]) => (
                        <div key={municipality}>
                          <dt>{municipality}</dt>
                          <dd>{number(value)} чел.</dd>
                        </div>
                      ),
                    )}
                  {populationMethod !== "radius" && (
                    <div>
                      <dt>Размер зоны</dt>
                      <dd>
                        {selectedInfluenceZone?.properties.area_km2 == null
                          ? "рассчитывается"
                          : `${selectedInfluenceZone.properties.area_km2.toFixed(1)} км² · ${selectedInfluenceZone.properties.area_vs_reference_percent?.toFixed(0) ?? "—"}% от круга R=2,5 км`}
                      </dd>
                    </div>
                  )}
                  {populationMethod === "terrain" && reliefFactorRange && (
                    <>
                      <div>
                        <dt>Рельеф</dt>
                        <dd>
                          {selectedZoneMeteo?.relief_dataset?.dataset_name ??
                            "Copernicus DEM"}
                          {selectedZoneMeteo?.relief_dataset?.resolution_m
                            ? ` · ${selectedZoneMeteo.relief_dataset.resolution_m} м`
                            : ""}
                        </dd>
                      </div>
                      <div>
                        <dt>Высота поста</dt>
                        <dd>{reliefFactorRange.elevation?.toFixed(1) ?? "—"} м</dd>
                      </div>
                      <div>
                        <dt>Профиль 5 км</dt>
                        <dd>
                          подъём до {reliefFactorRange.rise.toFixed(1)} м · перепад до{" "}
                          {reliefFactorRange.range.toFixed(1)} м
                        </dd>
                      </div>
                      <div>
                        <dt>Поправка</dt>
                        <dd>
                          {reliefFactorRange.min.toFixed(3)}–
                          {reliefFactorRange.max.toFixed(3)} · площадь сохранена
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              )}
              {populationMethod !== "radius" && selectedStation && (
                <section
                  className="network-coverage__zone-profile"
                  aria-label="Профиль условий репрезентативности"
                >
                  <div className="network-coverage__zone-profile-head">
                    <span>
                      ВЕТРОВОЙ ПРОФИЛЬ
                      {(data?.meteo?.selected_year ?? meteoYear) != null
                        ? ` · ${data?.meteo?.selected_year ?? meteoYear}`
                        : ""}
                      {` · ${data?.meteo?.sector_count ?? windSectorCount} секторов`}
                    </span>
                  </div>
                  <div className="network-coverage__wind-rose">
                    {displayedWindRose?.directions.length ? (
                      <WindRoseChart
                        data={displayedWindRose}
                        compact
                        prevailingDirection={
                          displayedWindRose.prevailing_direction
                        }
                      />
                    ) : windRoseLoading ? (
                      <small>Загрузка секторных данных ERA5…</small>
                    ) : (
                      <small>Нет секторных данных ERA5</small>
                    )}
                  </div>
                  <div className="network-coverage__wind-insight">
                    <div>
                      <span>ПРЕОБЛАДАЕТ</span>
                      <strong>
                        {displayedWindRose?.prevailing_degrees == null
                          ? "—"
                          : `${displayedWindRose.prevailing_direction ?? ""} · ${Math.round(displayedWindRose.prevailing_degrees)}°`}
                      </strong>
                      <p>
                        {displayedWindRose?.prevailing_frequency_percent == null
                          ? "направление не определено"
                          : `${RUMB_LABELS[displayedWindRose.prevailing_direction ?? ""] ?? "румб"} сектор · ${displayedWindRose.prevailing_frequency_percent.toFixed(1)}% наблюдений`}
                      </p>
                    </div>
                  </div>
                </section>
              )}
            </article>
          )}
        </aside>
      </section>

      {populationView && (
        <section
          className="module-card network-coverage__station-table-card"
          aria-labelledby="network-stations-title"
        >
          <header className="network-coverage__station-table-head">
            <div>
              <span>АКТИВНЫЕ ПОСТЫ</span>
              <h3 id="network-stations-title">
                Посты сети <b>{data?.stations.active_count ?? 0}</b>
              </h3>
              <p>
                Выберите строку для просмотра поста на карте и в правой
                карточке.
              </p>
            </div>
            <div className="network-coverage__station-table-tools">
              <label>
                <span>Найти пост</span>
                <input
                  type="search"
                  value={stationSearch}
                  onChange={(event) => setStationSearch(event.target.value)}
                  placeholder="Название или оператор"
                />
              </label>
              <label>
                <span>Сортировка</span>
                <select
                  value={stationSort}
                  onChange={(event) =>
                    setStationSort(
                      event.target.value as
                        "exclusive" | "population" | "area" | "name",
                    )
                  }
                >
                  <option value="exclusive">По назначенному населению</option>
                  <option value="population">По населению в зоне</option>
                  <option value="area">По площади зоны</option>
                  <option value="name">По названию</option>
                </select>
              </label>
            </div>
          </header>
          <div className="network-coverage__station-table-wrap">
            <table className="network-coverage__station-table">
              <thead>
                <tr>
                  <th>Пост</th>
                  <th>Тип / оператор</th>
                  <th className="is-number">Население в зоне</th>
                  <th className="is-number">Назначено без двойного счёта</th>
                  <th className="is-number">Доля территории</th>
                  <th className="is-number">Площадь зоны</th>
                  <th className="is-number">Пересечение</th>
                  <th>
                    <span className="sr-only">Действие</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {stationTableRows.map(
                  ({
                    item,
                    population: stationPopulation,
                    exclusive,
                    area,
                    overlap,
                  }) => (
                    <tr
                      key={item.id}
                      className={
                        item.id === selectedStation?.id ? "is-selected" : ""
                      }
                      tabIndex={0}
                      aria-selected={item.id === selectedStation?.id}
                      onClick={() => setSelectedStationId(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedStationId(item.id);
                        }
                      }}
                    >
                      <td>
                        <strong>{item.name}</strong>
                        <small>
                          {coordinates(item.longitude, item.latitude)}
                        </small>
                      </td>
                      <td>
                        <span>
                          {STATION_TYPE_LABELS[item.station_type] ??
                            item.station_type}
                        </span>
                        <small>{item.operator || "оператор не указан"}</small>
                      </td>
                      <td className="is-number">{number(stationPopulation)}</td>
                      <td className="is-number is-contribution">
                        {number(exclusive)}
                      </td>
                      <td className="is-number">
                        {exclusive != null && population?.total_population
                          ? `${((exclusive / population.total_population) * 100).toFixed(1)}%`
                          : "—"}
                      </td>
                      <td className="is-number">
                        {area == null ? "—" : `${area.toFixed(1)} км²`}
                      </td>
                      <td className="is-number">{number(overlap)}</td>
                      <td>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedStationId(item.id);
                          }}
                        >
                          На карте
                        </button>
                      </td>
                    </tr>
                  ),
                )}
                {!stationTableRows.length && (
                  <tr>
                    <td
                      className="network-coverage__station-table-empty"
                      colSpan={8}
                    >
                      {stationSearch
                        ? "Посты по запросу не найдены."
                        : "Нет активных постов для выбранных фильтров."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
