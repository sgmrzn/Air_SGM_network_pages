import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  Database,
  Download,
  Expand,
  ExternalLink,
  Info,
  Navigation,
  Search,
  Wind,
} from "lucide-react";

import { CompactWindRose } from "../components/CompactWindRose";
import { windApi } from "../windApi";
import type {
  MeteoDatasetVersion,
  PlaceSearchResult,
  WindJob,
  WindRoseResult,
  WindSeason,
} from "../windTypes";

interface WindRosePageProps {
  preferredJobId: number | null;
}

type AnalysisMode = "wind_rose" | "seasonal_wind_rose";
type RoseDisplayMode = "percent" | "count" | "table";

const MODES: { id: AnalysisMode; label: string }[] = [
  { id: "wind_rose", label: "Повторяемость" },
  { id: "seasonal_wind_rose", label: "Сезонная роза ветров" },
];

const SEASON_LABELS: Record<WindSeason, string> = {
  all: "Все сезоны",
  winter: "Зима",
  spring: "Весна",
  summer: "Лето",
  autumn: "Осень",
};

const DEFAULT_PLACE: PlaceSearchResult = {
  id: "default-ryazan",
  name: "Рязань",
  settlement_type: "city",
  region_name: "Рязанская область",
  longitude: 39.70415,
  latitude: 54.62696,
  population: null,
};

const DEFAULT_DATASET_PERIOD = {
  start: "2021-01-01",
  end: "2021-12-31",
};

function seasonForMonth(month: number): Exclude<WindSeason, "all"> {
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "autumn";
}

function seasonsCoveredByDataset(
  dataset: MeteoDatasetVersion | undefined,
): Set<WindSeason> {
  const available = new Set<WindSeason>(["all"]);
  if (!dataset) return available;
  const start = new Date(`${dataset.period_start}T00:00:00`);
  const end = new Date(`${dataset.period_end}T00:00:00`);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    available.add(seasonForMonth(cursor.getMonth() + 1));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return available;
}

const RU_TO_EN: Record<string, string> = {
  С: "N",
  ССВ: "NNE",
  СВ: "NE",
  ВСВ: "ENE",
  В: "E",
  ВЮВ: "ESE",
  ЮВ: "SE",
  ЮЮВ: "SSE",
  Ю: "S",
  ЮЮЗ: "SSW",
  ЮЗ: "SW",
  ЗЮЗ: "WSW",
  З: "W",
  ЗСЗ: "WNW",
  СЗ: "NW",
  ССЗ: "NNW",
};
const COMPASS_16 = [
  "С", "ССВ", "СВ", "ВСВ", "В", "ВЮВ", "ЮВ", "ЮЮВ",
  "Ю", "ЮЮЗ", "ЮЗ", "ЗЮЗ", "З", "ЗСЗ", "СЗ", "ССЗ",
];

const REGION_LABEL_OVERRIDES: Record<string, string> = {
  "Рязанан область": "Рязанская область",
  "Растовьска область": "Ростовская область",
  "Ростов область": "Ростовская область",
  "Тамбов область": "Тамбовская область",
};
const PLACE_LABEL_OVERRIDES: Record<string, string> = {
  Маразоўск: "Морозовск",
  Мардова: "Мордово",
};

function russianLabel(value: string) {
  return (
    PLACE_LABEL_OVERRIDES[value] ??
    value
      .replace(/івськ/giu, "овск")
      .replace(/ська\b/giu, "ская")
      .replace(/цька\b/giu, "цкая")
      .replace(/ька\b/giu, "ькая")
      .replace(/і/giu, "и")
      .replace(/ї/giu, "и")
      .replace(/є/giu, "е")
      .replace(/ґ/giu, "г")
      .replace(/ў/giu, "в")
  );
}

function regionLabel(region: string | null) {
  return region ? russianLabel(REGION_LABEL_OVERRIDES[region] ?? region) : null;
}

function formatMetric(value: number | null | undefined, digits = 1) {
  return value == null || Number.isNaN(value) ? "н/д" : value.toFixed(digits);
}

function directionLabel(
  label: string | null | undefined,
  degrees?: number | null,
) {
  if (!label) return "н/д";
  const english = RU_TO_EN[label];
  const base = english ? `${label} / ${english}` : label;
  return degrees == null
    ? base
    : `${base} · ${formatMetric(degrees, Number.isInteger(degrees) ? 0 : 1)}°`;
}

function oppositeDegrees(value: number) {
  return (value + 180) % 360;
}

function directionForAzimuth(value: number) {
  return COMPASS_16[Math.round(((value % 360) + 360) % 360 / 22.5) % 16];
}

function formatDate(value: string | null | undefined) {
  if (!value) return "н/д";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function csvCell(value: string | number | null | undefined) {
  if (value == null) return "";
  const text = String(value);
  return text.includes(",") || text.includes('"')
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

export function WindRosePage({
  preferredJobId: _preferredJobId,
}: WindRosePageProps) {
  const [datasets, setDatasets] = useState<MeteoDatasetVersion[]>([]);
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [placeQuery, setPlaceQuery] = useState(DEFAULT_PLACE.name);
  const [places, setPlaces] = useState<PlaceSearchResult[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const placeSearchCache = useRef(new Map<string, PlaceSearchResult[]>());
  const [selectedPlace, setSelectedPlace] = useState<PlaceSearchResult | null>(
    DEFAULT_PLACE,
  );
  const [defaultPlaceReady, setDefaultPlaceReady] = useState(false);
  const [longitude, setLongitude] = useState(String(DEFAULT_PLACE.longitude));
  const [latitude, setLatitude] = useState(String(DEFAULT_PLACE.latitude));
  const [sectorCount, setSectorCount] = useState<8 | 16 | 36>(16);
  const [season, setSeason] = useState<WindSeason>("all");
  const [mode, setMode] = useState<AnalysisMode>("wind_rose");
  const [displayMode, setDisplayMode] = useState<RoseDisplayMode>("percent");
  const [isExpanded, setIsExpanded] = useState(false);
  const [rose, setRose] = useState<WindRoseResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    windApi
      .meteoDatasets()
      .then((items) => {
        setDatasets(items);
        const defaultDataset = items.find(
          (item) =>
            item.period_start === DEFAULT_DATASET_PERIOD.start &&
            item.period_end === DEFAULT_DATASET_PERIOD.end,
        );
        setDatasetId(defaultDataset?.id ?? items[0]?.id ?? null);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Не удалось получить национальные наборы ERA5",
        ),
      );
  }, []);

  useEffect(() => {
    let active = true;
    windApi
      .places(DEFAULT_PLACE.name)
      .then((items) => {
        if (!active) return;
        const place =
          items.find(
            (item) =>
              russianLabel(item.name).localeCompare(
                russianLabel(DEFAULT_PLACE.name),
                "ru",
                { sensitivity: "base" },
              ) === 0 &&
              regionLabel(item.region_name) ===
                regionLabel(DEFAULT_PLACE.region_name),
          ) ??
          items.find(
            (item) =>
              russianLabel(item.name).localeCompare(
                russianLabel(DEFAULT_PLACE.name),
                "ru",
                { sensitivity: "base" },
              ) === 0,
          ) ??
          DEFAULT_PLACE;
        setSelectedPlace(place);
        setPlaceQuery(russianLabel(place.name));
        setLongitude(String(place.longitude));
        setLatitude(String(place.latitude));
        setPlaces([]);
      })
      .catch(() => {
        // The stable built-in coordinates remain a usable fallback when the
        // place catalogue is temporarily unavailable.
      })
      .finally(() => {
        if (active) setDefaultPlaceReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedDataset = useMemo(
    () => datasets.find((dataset) => dataset.id === datasetId),
    [datasets, datasetId],
  );
  const availableSeasons = useMemo(
    () => seasonsCoveredByDataset(selectedDataset),
    [selectedDataset],
  );
  useEffect(() => {
    if (!availableSeasons.has(season)) setSeason("all");
  }, [availableSeasons, season]);

  const activeJob = rose?.job ?? null;
  const searchPlaces = async (rawQuery = placeQuery) => {
    const query = rawQuery.trim();
    if (query.length < 2) {
      setPlaces([]);
      return;
    }
    const selectedName = selectedPlace
      ? russianLabel(selectedPlace.name).trim()
      : "";
    if (
      selectedName &&
      query.localeCompare(selectedName, "ru", { sensitivity: "base" }) === 0
    ) {
      setPlaces([]);
      return;
    }
    setError(null);
    const cacheKey = query.toLocaleLowerCase("ru-RU");
    const cached = placeSearchCache.current.get(cacheKey);
    if (cached) {
      setPlaces(cached);
      return;
    }
    setIsSearchingPlaces(true);
    try {
      const results = await windApi.places(query);
      placeSearchCache.current.set(cacheKey, results);
      setPlaces(results);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось выполнить поиск населённых пунктов",
      );
    } finally {
      setIsSearchingPlaces(false);
    }
  };
  useEffect(() => {
    const query = placeQuery.trim();
    const selectedName = selectedPlace
      ? russianLabel(selectedPlace.name).trim()
      : "";
    if (
      !defaultPlaceReady ||
      query.length < 2 ||
      (selectedName &&
        query.localeCompare(selectedName, "ru", { sensitivity: "base" }) === 0)
    ) {
      setPlaces([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void searchPlaces(query);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [defaultPlaceReady, placeQuery, selectedPlace]);
  const selectPlace = (place: PlaceSearchResult) => {
    setSelectedPlace(place);
    setPlaceQuery(russianLabel(place.name));
    setLongitude(String(place.longitude));
    setLatitude(String(place.latitude));
    setPlaces([]);
  };
  const wrapRose = useCallback(
    (
      nationalRose: {
        dataset: {
          dataset: string;
          period_start: string;
          period_end: string;
          calm_threshold_mps: number;
        };
        summary: WindRoseResult["summary"];
        directions: WindRoseResult["directions"];
      },
      roseSeason: WindSeason,
      lon: number,
      lat: number,
    ): WindRoseResult => {
      const locationName = selectedPlace
        ? `${russianLabel(selectedPlace.name)}${regionLabel(selectedPlace.region_name) ? `, ${regionLabel(selectedPlace.region_name)}` : ""}`
        : `Точка ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      return {
        job: {
          id: 0,
          source: "gee",
          dataset: nationalRose.dataset.dataset,
          location_name: locationName,
          latitude: lat,
          longitude: lon,
          job_scope: "point",
          period_mode: "custom",
          requested_year: null,
          date_from: nationalRose.dataset.period_start,
          date_to: nationalRose.dataset.period_end,
          sector_count: sectorCount,
          calm_threshold: nationalRose.dataset.calm_threshold_mps,
          status: "completed",
          progress_percent: 100,
          observations_count: nationalRose.summary.observations_count,
          current_period: null,
          error_message: null,
          log_file_path: null,
          is_demo: false,
          created_at: "",
          started_at: null,
          finished_at: null,
        },
        season: roseSeason,
        summary: nationalRose.summary,
        directions: nationalRose.directions,
      };
    },
    [sectorCount, selectedPlace],
  );

  const [seasonalRoses, setSeasonalRoses] = useState<Record<
    string,
    WindRoseResult | null
  > | null>(null);

  const loadRose = useCallback(async () => {
    const lon = Number(longitude);
    const lat = Number(latitude);
    if (
      !Number.isFinite(lon) ||
      !Number.isFinite(lat) ||
      lon < -180 ||
      lon > 180 ||
      lat < -90 ||
      lat > 90
    ) {
      setError(
        "Укажите корректные координаты: долгота от −180 до 180, широта от −90 до 90.",
      );
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const nationalRose = await windApi.meteoWindRose(
        lon,
        lat,
        season,
        sectorCount,
        datasetId,
      );
      setRose(wrapRose(nationalRose, season, lon, lat));
      // The seasonal panel loads alongside, so switching modes is instant and
      // the four charts always describe the same point and dataset.
      if (mode === "seasonal_wind_rose") {
        const bundle = await windApi.meteoWindRoseSeasons(
          lon,
          lat,
          sectorCount,
          datasetId,
        );
        const bySeason: Record<string, WindRoseResult | null> = {};
        for (const [key, value] of Object.entries(bundle.seasons)) {
          const uiSeason = (key === "annual" ? "all" : key) as WindSeason;
          bySeason[uiSeason] = value
            ? wrapRose(value, uiSeason, lon, lat)
            : null;
        }
        setSeasonalRoses(bySeason);
      }
    } catch (reason) {
      setRose(null);
      setSeasonalRoses(null);
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось получить розу ветров ERA5",
      );
    } finally {
      setIsLoading(false);
    }
  }, [datasetId, latitude, longitude, mode, season, sectorCount, wrapRose]);
  useEffect(() => {
    if (!defaultPlaceReady || !datasetId || !longitude || !latitude) return;
    const lon = Number(longitude);
    const lat = Number(latitude);
    if (
      !Number.isFinite(lon) ||
      !Number.isFinite(lat) ||
      lon < -180 ||
      lon > 180 ||
      lat < -90 ||
      lat > 90
    )
      return;
    const timer = window.setTimeout(() => {
      void loadRose();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [datasetId, defaultPlaceReady, latitude, longitude, loadRose]);
  const sortedDirections = useMemo(
    () =>
      [...(rose?.directions ?? [])].sort(
        (left, right) => right.total_frequency - left.total_frequency,
      ),
    [rose],
  );
  const prevailing = sortedDirections[0] ?? null;
  const transportDegrees = prevailing ? oppositeDegrees(prevailing.degrees) : null;
  const transportDirection =
    transportDegrees == null ? null : directionForAzimuth(transportDegrees);
  const directionalPercent = useMemo(
    () =>
      rose
        ? rose.directions.reduce(
            (sum, direction) => sum + direction.total_frequency,
            0,
          )
        : 0,
    [rose],
  );
  const modeLabel =
    MODES.find((item) => item.id === mode)?.label ?? "Повторяемость";
  const insight = useMemo(() => {
    if (!rose) return "Для выбранных фильтров нет подготовленной розы ветров.";
    if (!prevailing)
      return `Для выбранного периода доступно ${rose.summary.observations_count} валидных записей, но преобладающий сектор не определён.`;
    return `По отображаемой розе ветров преобладает сектор ${directionLabel(prevailing.label)}: ${formatMetric(prevailing.total_frequency, 1)}% наблюдений. Доля штиля ${formatMetric(rose.summary.calm_percent, 1)}%, средняя скорость ${formatMetric(rose.summary.mean_speed, 2)} м/с.`;
  }, [prevailing, rose]);

  const exportCsv = () => {
    if (!rose) return;
    const rows = [
      [
        "direction_sector",
        "direction_degrees",
        "speed_bin",
        "count",
        "frequency_percent",
      ],
    ];
    rows.push([
      "calm",
      "",
      "calm",
      String(rose.summary.calm_count),
      rose.summary.calm_percent.toFixed(4),
    ]);
    for (const direction of rose.directions) {
      for (const bin of direction.bins) {
        rows.push([
          direction.label,
          String(direction.degrees),
          bin.label,
          String(bin.count),
          bin.frequency.toFixed(4),
        ]);
      }
    }
    const blob = new Blob(
      [rows.map((row) => row.map(csvCell).join(",")).join("\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `era5-wind-rose-job-${rose.job.id}-${season}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`module-page wind-rose-new-page wind-rose-new-page--embedded${isExpanded ? " is-expanded" : ""}`}>
      <section className="wrn-filters" aria-label="Фильтры розы ветров">
        <div className="filter-group wrn-filter--mode">
          <label htmlFor="wrn-mode">Режим</label>
          <select
            id="wrn-mode"
            value={mode}
            onChange={(event) => setMode(event.target.value as AnalysisMode)}
          >
            {MODES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group wrn-filter--dataset">
          <label htmlFor="wrn-dataset">Набор ERA5</label>
          <select
            id="wrn-dataset"
            value={datasetId ?? ""}
            onChange={(event) => setDatasetId(event.target.value)}
            disabled={datasets.length === 0}
          >
            {datasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.period_start} — {dataset.period_end} ·{" "}
                {dataset.cells_count.toLocaleString("ru-RU")} ячеек
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group filter-group--wide wrn-filter--place">
          <label htmlFor="wrn-place">Населённый пункт или область</label>
          <div className="wrn-place-search">
            <input
              id="wrn-place"
              value={placeQuery}
              autoComplete="off"
              onChange={(event) => setPlaceQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void searchPlaces();
              }}
              placeholder="Например, Рязань или Рязанская область"
            />
            <button
              type="button"
              className="wrn-search-button"
              disabled={isSearchingPlaces}
              onClick={() => void searchPlaces()}
              aria-label="Найти населённый пункт"
              title="Найти населённый пункт"
            >
              <Search aria-hidden="true" />
            </button>
          </div>
          {places.length > 0 && (
            <div
              className="wrn-place-suggestions"
              role="listbox"
              aria-label="Результаты поиска"
            >
              {places.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  role="option"
                  onClick={() => selectPlace(place)}
                >
                  {russianLabel(place.name)}
                  {regionLabel(place.region_name)
                    ? ` · ${regionLabel(place.region_name)}`
                    : ""}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="filter-group wrn-filter--longitude">
          <label htmlFor="wrn-longitude">Долгота</label>
          <input
            id="wrn-longitude"
            type="number"
            step="any"
            value={longitude}
            onChange={(event) => {
              setLongitude(event.target.value);
              setSelectedPlace(null);
            }}
            placeholder="39.734"
          />
        </div>
        <div className="filter-group wrn-filter--latitude">
          <label htmlFor="wrn-latitude">Широта</label>
          <input
            id="wrn-latitude"
            type="number"
            step="any"
            value={latitude}
            onChange={(event) => {
              setLatitude(event.target.value);
              setSelectedPlace(null);
            }}
            placeholder="54.629"
          />
        </div>
        <div className="filter-group filter-group--data wrn-filter--period">
          <label>Период</label>
          <strong>
            {activeJob
              ? `${activeJob.date_from} — ${activeJob.date_to}`
              : "Нет данных"}
          </strong>
        </div>
        <div className="filter-group wrn-filter--sectors">
          <label htmlFor="wrn-sectors">Секторы</label>
          <select
            id="wrn-sectors"
            value={sectorCount}
            onChange={(event) =>
              setSectorCount(Number(event.target.value) as 8 | 16 | 36)
            }
          >
            <option value={8}>8 направлений</option>
            <option value={16}>16 направлений</option>
            <option value={36}>36 направлений</option>
          </select>
        </div>
        <div className="filter-group wrn-filter--season">
          <label htmlFor="wrn-season">Сезон</label>
          <select
            id="wrn-season"
            value={season}
            onChange={(event) => setSeason(event.target.value as WindSeason)}
          >
            {Object.entries(SEASON_LABELS).map(([key, label]) => (
              <option
                key={key}
                value={key}
                disabled={!availableSeasons.has(key as WindSeason)}
              >
                {label}
                {availableSeasons.has(key as WindSeason) ? "" : " — нет данных"}
              </option>
            ))}
          </select>
        </div>
        <div className="wrn-apply">
          <button
            type="button"
            className="button button--primary"
            onClick={() => void loadRose()}
            disabled={isLoading}
          >
            {isLoading ? "Загрузка…" : "Применить"}
          </button>
        </div>
        <div className="wrn-export">
          <button
            type="button"
            className="btn-secondary"
            onClick={exportCsv}
            disabled={!rose}
          >
            <Download aria-hidden="true" /> Экспорт CSV
          </button>
        </div>
        <div className="wrn-location-chip">
          <Navigation aria-hidden="true" />
          {selectedPlace ? regionLabel(selectedPlace.region_name) ?? russianLabel(selectedPlace.name) : "Выбранная точка"}
        </div>
      </section>

      {rose?.job.is_demo && (
        <div className="demo-notice wrn-demo">
          <strong>DEMO</strong>
          <span>
            Распределение построено по синтетическому почасовому ряду. Оно
            проверяет программный модуль, но не описывает реальный ветер.
          </span>
        </div>
      )}
      {error && <div className="form-error wind-error">{error}</div>}

      <section className="wrn-insight">
        <p>{insight}</p>
      </section>

      <main className="wrn-layout">
        <section className="wrn-panel wrn-main-chart">
          <div className="wrn-panel-head">
            <div>
              <span className="wrn-eyebrow">Метеорологический профиль</span>
              <h2>
                {mode === "wind_rose"
                  ? "Повторяемость направлений и классов скорости"
                  : modeLabel}
              </h2>
              <p>
                Частота направлений и классов скорости ветра, % наблюдений. Данные: ERA5 / ECMWF, высота 10 м, {" "}
                {activeJob?.sector_count ?? 36} секторов · {SEASON_LABELS[season]}
              </p>
            </div>
            <div className="wrn-view-controls" aria-label="Представление данных">
              {(["percent", "count", "table"] as RoseDisplayMode[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={displayMode === item ? "is-active" : ""}
                  onClick={() => setDisplayMode(item)}
                >
                  {item === "percent" ? "Проценты" : item === "count" ? "Частота" : "Таблица"}
                </button>
              ))}
              <button
                type="button"
                className="wrn-expand-button"
                onClick={() => setIsExpanded((value) => !value)}
                aria-label={isExpanded ? "Закрыть увеличенный режим" : "Увеличить диаграмму"}
                title={isExpanded ? "Закрыть" : "Увеличить диаграмму"}
              >
                <Expand aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="wrn-chart-stage">
            {isLoading ? (
              <div className="wrn-chart-state">
                <span className="spinner" />
                Загрузка розы ветров...
              </div>
            ) : !rose ? (
              <div className="wrn-chart-state">
                Выберите населённый пункт или введите координаты — роза ветров
                появится автоматически.
              </div>
            ) : displayMode === "table" ? (
              <div className="wrn-table-wrap">
                <table className="wrn-data-table">
                  <thead>
                    <tr>
                      <th>Направление</th>
                      <th>Азимут</th>
                      <th>Всего</th>
                      {rose.directions[0]?.bins.map((bin) => <th key={bin.key}>{bin.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rose.directions.map((direction) => (
                      <tr key={direction.index}>
                        <td>{directionLabel(direction.label)}</td>
                        <td>{formatMetric(direction.degrees, 1)}°</td>
                        <td>{direction.total_frequency.toFixed(1)}%</td>
                        {direction.bins.map((bin) => (
                          <td key={bin.key}>{bin.frequency.toFixed(1)}%</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : mode === "seasonal_wind_rose" ? (
              <div className="wrn-season-grid">
                {(["winter", "spring", "summer", "autumn"] as const).map(
                  (seasonKey) => {
                    const seasonRose = seasonalRoses?.[seasonKey] ?? null;
                    return (
                      <div className="wrn-season-cell" key={seasonKey}>
                        <h4>{SEASON_LABELS[seasonKey]}</h4>
                        {seasonRose ? (
                          <>
                            <CompactWindRose
                              className="wrn-page-rose wrn-page-rose--season"
                              data={seasonRose}
                              prevailingDirection={seasonRose.directions.reduce((best, item) => item.total_frequency > best.total_frequency ? item : best, seasonRose.directions[0]).label}
                              averageSpeed={seasonRose.summary.mean_speed}
                              calmPercent={seasonRose.summary.calm_percent}
                              showMetrics={false}
                              displayMode={displayMode}
                              showScaleLabels
                            />
                            <small>
                              штиль{" "}
                              {formatMetric(seasonRose.summary.calm_percent)}% ·
                              ср. {formatMetric(seasonRose.summary.mean_speed)}{" "}
                              м/с
                            </small>
                          </>
                        ) : (
                          <div className="wrn-chart-state">
                            Сезон не покрыт выбранным набором
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
            ) : (
              <CompactWindRose
                className="wrn-page-rose"
                data={rose}
                prevailingDirection={prevailing?.label}
                prevailingDegrees={prevailing?.degrees}
                prevailingFrequency={prevailing?.total_frequency}
                averageSpeed={rose.summary.mean_speed}
                calmPercent={rose.summary.calm_percent}
                observationCount={rose.summary.observations_count}
                displayMode={displayMode}
                showScaleLabels
                showLegendNote
              />
            )}
          </div>
        </section>

        <aside className="wrn-panel wrn-diagnostics">
          <section className="wrn-kpi-card">
          <div className="wrn-side-heading">
            <h2>Ключевые показатели</h2>
            <span>ERA5 / ECMWF</span>
          </div>
          <div className="wrn-metric-grid">
            <div><i><Database /></i><span>Валидные записи<strong>{rose?.summary.observations_count.toLocaleString("ru-RU") ?? "н/д"}</strong></span></div>
            <div><i className="is-success"><Check /></i><span>Покрытие<strong>{rose ? formatMetric(directionalPercent + rose.summary.calm_percent, 1) : "н/д"}%</strong></span></div>
            <div><i><CalendarDays /></i><span>Период<strong>{formatDate(activeJob?.date_from)} —<br />{formatDate(activeJob?.date_to)}</strong></span></div>
            <div><i><Wind /></i><span>Средняя скорость<strong>{rose ? `${formatMetric(rose.summary.mean_speed, 2)} м/с` : "н/д"}</strong></span></div>
            <div><i><Wind /></i><span>Доля штиля<strong>{rose ? formatMetric(rose.summary.calm_percent, 1) : "н/д"}%</strong></span></div>
            <div><i><Navigation /></i><span>Преобладающее направление<strong>{prevailing ? directionLabel(prevailing.label, prevailing.degrees) : "н/д"}</strong></span></div>
          </div>
          <div className="wrn-quality">
            <Check aria-hidden="true" />
            <span>
              Данные полные · пропуски в агрегированной ERA5-выборке не обнаружены
            </span>
          </div>
          </section>
          <section className="wrn-ranking-card">
          <div className="wrn-side-section-title">
            <h3>Диагностика направлений</h3>
            <span>Топ направлений по повторяемости</span>
          </div>
          <div className="wrn-direction-list">
            {sortedDirections.slice(0, 6).map((direction) => (
              <div key={direction.index}>
                <strong>{directionLabel(direction.label)}</strong>
                <i>
                  <span
                    style={{
                      width: `${(direction.total_frequency / Math.max(1, sortedDirections[0]?.total_frequency ?? 1)) * 100}%`,
                    }}
                  />
                </i>
                <em>{direction.total_frequency.toFixed(1)}%</em>
              </div>
            ))}
          </div>
          </section>

          <section className="wrn-interpretation">
            <div className="wrn-side-section-title">
              <h3>Интерпретация</h3>
              <button type="button" title="Направление переноса — геометрическая интерпретация ветрового режима, а не расчёт рассеивания или концентрации."><Info /></button>
            </div>
            <div className="wrn-interpretation-grid">
              <article>
                <i><Navigation /></i>
                <span>Ветер приходит с<strong>{prevailing ? directionLabel(prevailing.label) : "н/д"} <em>{prevailing ? `(${Math.round(prevailing.degrees)}°)` : ""}</em></strong><b>{prevailing ? `${prevailing.total_frequency.toFixed(1)}%` : "—"}</b></span>
              </article>
              <article>
                <i className="is-transport"><Navigation /></i>
                <span>Возможный перенос к<strong>{transportDirection ? directionLabel(transportDirection) : "н/д"} <em>{transportDegrees == null ? "" : `(${Math.round(transportDegrees)}°)`}</em></strong></span>
              </article>
            </div>
          </section>

          <section className="wrn-source-card">
            <div className="wrn-side-section-title"><h3>Источник данных</h3></div>
            <div>
              <i><Database /></i>
              <span><strong>ERA5 / ECMWF</strong><small>Почасовые данные, ветер на высоте 10 м.</small></span>
              <button type="button">Подробнее <ExternalLink /></button>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
