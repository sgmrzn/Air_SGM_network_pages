import { useEffect, useState } from "react";
import { Database, Layers3, RadioTower, Wind } from "lucide-react";

type Status =
  "not_loaded" | "pending" | "running" | "partial" | "completed" | "failed";
type Month = {
  month: string;
  status: Status;
  loaded_cells: number;
  expected_cells: number;
  valid_cells?: number;
  indicator?: string;
  processing_version?: string;
};
type Layer = {
  id: string;
  title: string;
  source: string;
  status: string;
  description: string;
  feature_count?: number;
  stations_count?: number;
  settlement_zones?: number;
  dataset_name?: string;
  size_bytes?: number;
  filename?: string;
};
type Coverage = {
  year: number;
  available_years: number[];
  generated_at: string;
  era5: Month[];
  spatial_layers: Layer[];
};
type Tab = "overview" | "era5" | "spatial" | "registries";
const tabs: { id: Tab; label: string; Icon: typeof Database }[] = [
  { id: "overview", label: "Обзор", Icon: Database },
  { id: "era5", label: "ERA5", Icon: Wind },
  { id: "spatial", label: "Пространственные слои", Icon: Layers3 },
  { id: "registries", label: "Реестры", Icon: RadioTower },
];
const statusLabel: Record<string, string> = {
  completed: "Готово",
  running: "Загружается",
  pending: "В очереди",
  partial: "Частично",
  failed: "Ошибка",
  not_loaded: "Нет данных",
  ready: "Готово",
  not_configured: "Не настроено",
  planned: "Планируется",
};
const countReady = (items: Month[]) =>
  items.filter((item) => item.status === "completed").length;
const itemCount = (item: Layer) =>
  item.feature_count ?? item.stations_count ?? item.settlement_zones ?? null;

export function DataCatalogPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [year, setYear] = useState(2019);
  const [data, setData] = useState<Coverage | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [stations, setStations] = useState<
    {
      id: string;
      name: string;
      station_type?: string;
      status?: string;
      pollutants?: string[];
    }[]
  >([]);
  const [error, setError] = useState("");
  useEffect(() => {
    void Promise.all([
      fetch(`/api/data-coverage?year=${year}`).then((r) =>
        r.ok
          ? (r.json() as Promise<Coverage>)
          : Promise.reject(new Error(`Ошибка ${r.status}`)),
      ),
      fetch("/api/spatial/layers").then((r) =>
        r.ok ? (r.json() as Promise<Layer[]>) : [],
      ),
      fetch("/api/spatial/monitoring-stations").then((r) =>
        r.ok
          ? (r.json() as Promise<
              {
                id: string;
                name: string;
                station_type?: string;
                status?: string;
                pollutants?: string[];
              }[]
            >)
          : [],
      ),
    ])
      .then(([coverage, nextLayers, nextStations]) => {
        setData(coverage);
        setLayers(nextLayers);
        setStations(nextStations);
        if (
          coverage.available_years.length &&
          !coverage.available_years.includes(year)
        )
          setYear(coverage.available_years[0]);
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : String(reason)),
      );
  }, [year]);
  const spatial = layers.length ? layers : (data?.spatial_layers ?? []);
  const sourceLayers = spatial.filter((item) =>
    ["monitoring_stations", "social_features", "user_layers"].includes(item.id),
  );
  const downloadLayers = spatial.filter((item) => !sourceLayers.includes(item));
  return (
    <div className="module-page data-catalog-page">
      <section className="module-card data-catalog-intro">
        <div>
          <span>ЛОКАЛЬНЫЙ АРХИВ</span>
          <h2>Данные</h2>
          <p>
            Просмотр наборов, которые уже сохранены системой. Здесь нет запуска
            загрузок — для него используйте раздел «Загрузка данных».
          </p>
        </div>
        <label>
          <span>Год для временных рядов</span>
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {(data?.available_years.length ? data.available_years : [year]).map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
        </label>
      </section>
      <nav className="data-catalog-tabs" aria-label="Категории данных">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "data-catalog-tabs__active" : ""}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            <Icon aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
      {error && <div className="form-error">{error}</div>}
      {tab === "overview" && (
        <>
          <section className="data-catalog-kpis">
            <Metric
              label="ERA5"
              value={data ? `${countReady(data.era5)} / 12` : "—"}
              note="месяцев метеоданных"
            />
            <Metric
              label="Слои"
              value={`${spatial.filter((item) => item.status === "ready").length} / ${spatial.length}`}
              note="готовых пространственных наборов"
            />
            <Metric
              label="Посты"
              value={String(stations.length)}
              note="записей в реестре"
            />
          </section>
          <section className="module-card data-catalog-summary">
            <div className="module-card__head">
              <div>
                <span>СОСТОЯНИЕ АРХИВА</span>
                <h3>Доступные наборы</h3>
              </div>
              <small>
                {data
                  ? `Проверено: ${new Date(data.generated_at).toLocaleString("ru-RU")}`
                  : "Получение данных…"}
              </small>
            </div>
            <div>
              {[...downloadLayers, ...sourceLayers].map((item) => (
                <DatasetCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        </>
      )}
      {tab === "era5" && (
        <ValueInspector
          year={year}
          months={(data?.era5 ?? [])
            .filter((item) => item.status === "completed")
            .map((item) => item.month)}
        />
      )}
      {tab === "spatial" && (
        <section className="module-card data-catalog-summary">
          <div className="module-card__head">
            <div>
              <span>ОБЩИЕ ДЛЯ ВСЕХ ЛЕТ</span>
              <h3>Пространственные слои</h3>
              <p>
                Границы, население, рельеф, землепользование и тематические
                маски.
              </p>
            </div>
          </div>
          <div>
            {downloadLayers.map((item) => (
              <DatasetCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
      {tab === "registries" && (
        <section className="module-card data-catalog-registry">
          <div className="module-card__head">
            <div>
              <span>ПРОВЕРЯЕМЫЕ РЕЕСТРЫ</span>
              <h3>Посты и тематические объекты</h3>
              <p>Активные и исторические записи из локальных реестров.</p>
            </div>
          </div>
          <div className="data-catalog-registry__summary">
            {sourceLayers.map((item) => (
              <DatasetCard key={item.id} item={item} />
            ))}
          </div>
          <div className="data-catalog-table">
            <div>
              <span>Наименование</span>
              <span>Тип</span>
              <span>Статус</span>
              <span>Загрязнители</span>
            </div>
            {stations.length ? (
              stations.map((item) => (
                <div key={item.id}>
                  <b>{item.name}</b>
                  <span>{item.station_type ?? "—"}</span>
                  <span>{item.status ?? "—"}</span>
                  <span>{item.pollutants?.join(", ") || "—"}</span>
                </div>
              ))
            ) : (
              <p>Записей постов пока нет.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
function DatasetCard({ item }: { item: Layer }) {
  const count = itemCount(item);
  return (
    <article className="data-catalog-dataset">
      <div>
        <b>{item.title}</b>
        <span>{item.dataset_name ?? item.source}</span>
        <small>{item.description}</small>
      </div>
      {count !== null && <em>{count.toLocaleString("ru-RU")} объектов</em>}
      <i className={`data-catalog-status data-catalog-status--${item.status}`}>
        {statusLabel[item.status] ?? item.status}
      </i>
    </article>
  );
}
function MonthlyTable({
  title,
  subtitle,
  rows,
  withIndicator = false,
}: {
  title: string;
  subtitle: string;
  rows: (Month & { indicator?: string })[];
  withIndicator?: boolean;
}) {
  return (
    <section className="module-card data-catalog-table-card">
      <div className="module-card__head">
        <div>
          <span>ВРЕМЕННЫЕ РЯДЫ</span>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="data-catalog-table">
        {withIndicator ? (
          <div>
            <span>Показатель</span>
            <span>Месяц</span>
            <span>Покрытие</span>
            <span>Статус</span>
          </div>
        ) : (
          <div>
            <span>Месяц</span>
            <span>Загружено</span>
            <span>Валидных ячеек</span>
            <span>Статус</span>
          </div>
        )}
        {rows.map((item) => {
          const coverage = item.expected_cells
            ? Math.round((item.loaded_cells / item.expected_cells) * 100)
            : 0;
          return (
            <div key={`${item.indicator ?? "era5"}-${item.month}`}>
              {withIndicator ? <b>{item.indicator}</b> : <b>{item.month}</b>}
              {withIndicator && <span>{item.month}</span>}
              {!withIndicator && (
                <span>
                  {item.loaded_cells.toLocaleString("ru-RU")} /{" "}
                  {item.expected_cells.toLocaleString("ru-RU")}
                </span>
              )}
              <span>
                {withIndicator
                  ? `${coverage}% · ${item.loaded_cells.toLocaleString("ru-RU")} ячеек`
                  : (item.valid_cells?.toLocaleString("ru-RU") ?? "—")}
              </span>
              <i
                className={`data-catalog-status data-catalog-status--${item.status}`}
              >
                {statusLabel[item.status]}
              </i>
            </div>
          );
        })}
        {!rows.length && <p>За выбранный год в архиве нет записей.</p>}
      </div>
    </section>
  );
}

function ValueInspector({
  year,
  months,
}: {
  year: number;
  months: string[];
}) {
  const available = months;
  const [month, setMonth] = useState("");
  const [rows, setRows] = useState<Record<string, number | string | null>[]>(
    [],
  );
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!available.includes(month)) setMonth(available[0] ?? "");
  }, [available.join("|"), month]);
  useEffect(() => {
    if (!month) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError("");
    void fetch(`/api/data-coverage/era5/values?month=${month}&limit=100`)
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error(`Ошибка ${response.status}`)),
      )
      .then((payload) => {
        setRows(payload.rows ?? []);
        setTotal(payload.total ?? 0);
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : String(reason)),
      )
      .finally(() => setLoading(false));
  }, [month]);
  const number = (value: unknown, digits = 2) =>
    typeof value === "number"
      ? value.toLocaleString("ru-RU", { maximumFractionDigits: digits })
      : "—";
  return (
    <section className="module-card data-values">
      <div className="module-card__head">
        <div>
          <span>ЗНАЧЕНИЯ ИЗ ЛОКАЛЬНОГО АРХИВА</span>
          <h3>ERA5 · метеоданные за {year}</h3>
          <p>Температура, относительная влажность, скорость ветра, осадки, высота пограничного слоя и облачность по сохранённым ячейкам.</p>
        </div>
      </div>
      <div className="data-values__filters">
        <label>
          <span>Месяц</span>
          <select
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            disabled={!available.length}
          >
            {available.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <div>
          <b>
            {month
              ? `${total.toLocaleString("ru-RU")} ячеек в наборе`
              : "Нет готового месяца"}
          </b>
          <small>Показаны первые 100 строк, без изменения данных.</small>
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="data-values__table">
        <>
            <div>
              <span>Ячейка</span>
              <span>Координаты</span>
              <span>Температура</span>
              <span>Влажность</span>
              <span>Ветер</span>
              <span>Осадки</span>
              <span>ПС / облачность</span>
            </div>
            {rows.map((row) => (
              <div key={String(row.grid_cell_id)}>
                <b>{String(row.grid_cell_id)}</b>
                <span>
                  {number(row.centroid_lat, 3)}, {number(row.centroid_lon, 3)}
                </span>
                <span>{number(row.temperature_mean_c)} °C</span>
                <span>{number(row.humidity_mean_pct)} %</span>
                <span>{number(row.wind_speed_mean_mps)} м/с</span>
                <span>{number(row.precipitation_total_mm)} мм</span>
                <span>
                  {number(row.boundary_layer_height_mean_m)} м /{" "}
                  {number(row.cloud_cover_mean)} %
                </span>
              </div>
            ))}
        </>
        {!loading && !rows.length && (
          <p>
            {month
              ? "В выбранном наборе нет строк."
              : "Выберите готовый месяц."}
          </p>
        )}
      </div>
    </section>
  );
}
