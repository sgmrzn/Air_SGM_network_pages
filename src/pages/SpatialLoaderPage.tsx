import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PopulationLoaderPanel } from "./PopulationLoaderPanel";
import { SpatialApiLoadersPanel } from "./SpatialApiLoadersPanel";

type SpatialLayer = {
  id: string;
  title: string;
  source: string;
  status:
    | "ready"
    | "running"
    | "partial"
    | "failed"
    | "not_loaded"
    | "not_configured"
    | "planned";
  description: string;
  license: string;
  error_message?: string | null;
  downloaded_bytes?: number;
  expected_bytes?: number;
  settlement_zones?: number;
  feature_count?: number;
  feature_counts?: Record<string, number>;
  dataset_name?: string;
  reference_year?: number;
  source_url?: string | null;
  size_bytes?: number;
  filename?: string;
  stations_count?: number;
};
type Tab =
  "boundaries" | "base" | "population" | "stations" | "social" | "other";

const statusLabel: Record<SpatialLayer["status"], string> = {
  ready: "Готово",
  running: "Выполняется",
  partial: "Частично загружено",
  failed: "Ошибка",
  not_loaded: "Не загружено",
  not_configured: "Требует настройки",
  planned: "Планируется",
};
const bytes = (value = 0) =>
  value >= 1024 ** 3
    ? `${(value / 1024 ** 3).toFixed(2)} ГБ`
    : `${(value / 1024 ** 2).toFixed(0)} МБ`;

export function SpatialLoaderPage() {
  const [layers, setLayers] = useState<SpatialLayer[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [tab, setTab] = useState<Tab>("boundaries");
  const refresh = useCallback(async () => {
    try {
      const [nextLayers, nextLog] = await Promise.all([
        fetch("/api/spatial/layers").then(
          (r) => r.json() as Promise<SpatialLayer[]>,
        ),
        fetch("/api/spatial/osm/log").then(
          (r) => r.json() as Promise<string[]>,
        ),
      ]);
      setLayers(nextLayers);
      setLog(nextLog);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось обновить пространственные слои",
      );
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  const startOsm = async (mode: "resume" | "restart" | "import") => {
    try {
      setStarting(true);
      setError("");
      const path =
        mode === "import"
          ? "/api/spatial/osm/import"
          : mode === "restart"
            ? "/api/spatial/osm/restart"
            : "/api/spatial/osm/resume";
      const response = await fetch(path, { method: "POST" });
      if (!response.ok)
        throw new Error(
          (await response.json()).detail ?? "Не удалось запустить загрузку OSM",
        );
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setStarting(false);
    }
  };
  const layer = (id: string) => layers.find((item) => item.id === id);
  const tabs: { id: Tab; label: string; hint: string }[] = [
    {
      id: "boundaries",
      label: "Границы",
      hint: "контуры расчётной территории",
    },
    { id: "base", label: "Базовая география", hint: "OSM и опорная география" },
    { id: "population", label: "Население", hint: "растр WorldPop" },
    { id: "stations", label: "Посты", hint: "реестр станций мониторинга" },
    {
      id: "social",
      label: "Социальные объекты",
      hint: "школы, больницы и жилые зоны",
    },
    {
      id: "other",
      label: "Прочие слои",
      hint: "рельеф, землепользование и файлы",
    },
  ];
  return (
    <div className="module-page spatial-loader-page">
      <section className="module-card spatial-intro">
        <div>
          <span>ЕДИНЫЙ ОФЛАЙН-АРХИВ</span>
          <h3>Загрузчик пространственных данных</h3>
          <p>
            Каждый тип данных загружается и проверяется в своей вкладке. После
            импорта расчёты выполняются локально.
          </p>
        </div>
        <div className="spatial-intro__note">
          <b>Порядок подготовки</b>
          <span>Границы → население → посты и источники → расчёт покрытия</span>
        </div>
      </section>
      {error && <div className="form-error">{error}</div>}
      <nav className="spatial-loader-tabs" aria-label="Разделы загрузчика">
        {tabs.map((item) => (
          <button
            type="button"
            key={item.id}
            title={item.hint}
            aria-current={tab === item.id ? "page" : undefined}
            className={tab === item.id ? "spatial-loader-tabs__active" : ""}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {tab === "boundaries" && (
        <section className="spatial-boundary-grid">
          <BoundaryImport
            kind="region"
            title="Граница региона для расчётов"
            description="Один полигон территории анализа. Он ограничивает расчёты покрытия и выбор кандидатных зон."
            onImported={refresh}
          />
          <BoundaryImport
            kind="municipality"
            title="Муниципальные границы"
            description="Набор полигонов муниципальных образований для отчётов, фильтров и сравнения покрытия."
            onImported={refresh}
          />
        </section>
      )}
      {tab === "base" && (
        <section className="spatial-layer-grid">
          {layer("osm_base") && (
            <LayerCard
              layer={layer("osm_base")!}
              starting={starting}
              onStart={startOsm}
            />
          )}
          <LogCard log={log} />
        </section>
      )}
      {tab === "population" && (
        <>
          <section className="spatial-layer-grid">
            {layer("population") && (
              <LayerCard
                layer={layer("population")!}
                starting={starting}
                onStart={startOsm}
              />
            )}
          </section>
          <PopulationLoaderPanel onImported={() => void refresh()} />
        </>
      )}
      {tab === "stations" && (
        <section className="spatial-layer-grid">
          {layer("monitoring_stations") && (
            <LayerCard
              layer={layer("monitoring_stations")!}
              starting={starting}
              onStart={startOsm}
            />
          )}
        </section>
      )}
      {tab === "social" && layer("social_features") && (
        <SocialFeaturesPanel
          layer={layer("social_features")!}
          onImported={refresh}
        />
      )}
      {tab === "other" && (
        <>
          <SpatialApiLoadersPanel onImported={refresh} />
          <section className="spatial-layer-grid">
            {["user_layers"]
              .map((id) => layer(id))
              .filter((item): item is SpatialLayer => Boolean(item))
              .map((item) => (
                <LayerCard
                  key={item.id}
                  layer={item}
                  starting={starting}
                  onStart={startOsm}
                />
              ))}
          </section>
        </>
      )}
    </div>
  );
}

function BoundaryImport({
  kind,
  title,
  description,
  onImported,
}: {
  kind: "region" | "municipality";
  title: string;
  description: string;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [osmBusy, setOsmBusy] = useState(false);
  const [message, setMessage] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const data = new FormData();
      data.set("file", file);
      data.set("source_url", sourceUrl);
      const response = await fetch(`/api/spatial/boundaries/${kind}`, {
        method: "POST",
        body: data,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.detail ?? "Не удалось импортировать границы");
      setMessage(
        kind === "region"
          ? `Импортирована граница: ${result.name}.`
          : `Импортировано муниципалитетов: ${result.count}.`,
      );
      onImported();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  const importOsm = async () => {
    setOsmBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/spatial/boundaries/osm/${kind}/import`,
        { method: "POST" },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.detail ?? "Не удалось запустить импорт OSM");
      setMessage(
        "Импорт из локального архива OSM запущен. Статус обновится автоматически.",
      );
      onImported();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setOsmBusy(false);
    }
  };
  return (
    <article className="module-card spatial-boundary-card">
      <div className="spatial-layer__head">
        <div>
          <span>АДМИНИСТРАТИВНЫЕ ГРАНИЦЫ</span>
          <h3>{title}</h3>
        </div>
      </div>
      <p>{description}</p>
      <div className="spatial-boundary-card__osm">
        <div>
          <b>OpenStreetMap</b>
          <span>
            {kind === "region"
              ? "Границы субъектов РФ · admin_level=4"
              : "Муниципальные образования · admin_level=6"}
          </span>
        </div>
        <button
          type="button"
          className="button button--primary"
          disabled={osmBusy}
          onClick={() => void importOsm()}
        >
          {osmBusy ? "Запуск…" : "Импортировать из OSM"}
        </button>
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <label>
          <span>Файл GeoJSON</span>
          <input
            type="file"
            accept=".geojson,.json,application/geo+json,application/json"
            required
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <label>
          <span>Ссылка на первоисточник</span>
          <input
            type="url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://…"
          />
        </label>
        <button className="button" disabled={!file || busy}>
          {busy ? "Импорт…" : "Загрузить GeoJSON"}
        </button>
      </form>
      <footer>
        {kind === "region"
          ? "OSM-импорт берёт границы субъектов. GeoJSON требует один Polygon или MultiPolygon."
          : "OSM-импорт использует admin_level=6. GeoJSON может содержать FeatureCollection."}
      </footer>
      {message && <div className="station-entry__message">{message}</div>}
    </article>
  );
}

function SocialFeaturesPanel({
  layer,
  onImported,
}: {
  layer: SpatialLayer;
  onImported: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const counts = layer.feature_counts ?? {};
  const startImport = async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/spatial/social-features/osm/import", {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.detail ?? "Не удалось запустить импорт");
      setMessage(
        "Извлечение из OSM запущено в фоне. Статус и количество объектов обновятся автоматически.",
      );
      onImported();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="module-card social-features-panel">
      <div className="module-card__head">
        <div>
          <span>ПРИОРИТЕТНЫЕ ТЕРРИТОРИИ</span>
          <h3>Социальные объекты и жилая застройка</h3>
          <p>
            Эти слои увеличивают приоритет кандидатных зон при проектировании
            сети, но не заменяют расчёт по населению.
          </p>
        </div>
        <i className={`spatial-status spatial-status--${layer.status}`}>
          {statusLabel[layer.status]}
        </i>
      </div>
      <div className="social-features-panel__items">
        <article>
          <b>Образование</b>
          <span>Школы, детские сады, колледжи и вузы</span>
          <strong>{counts.education ?? 0}</strong>
        </article>
        <article>
          <b>Здравоохранение</b>
          <span>Больницы, клиники и кабинеты врачей</span>
          <strong>{counts.health ?? 0}</strong>
        </article>
        <article>
          <b>Жилые зоны</b>
          <span>Полигоны `landuse=residential`</span>
          <strong>{counts.residential ?? 0}</strong>
        </article>
      </div>
      <div className="social-features-panel__action">
        <div>
          <b>Источник: OpenStreetMap</b>
          <span>
            Используется локальный архив Geofabrik Russia PBF; повторное
            скачивание не нужно.
          </span>
        </div>
        <button
          className="button button--primary"
          disabled={busy || layer.status === "running"}
          onClick={() => void startImport()}
        >
          {layer.status === "running"
            ? "Импорт выполняется…"
            : busy
              ? "Запуск…"
              : "Извлечь из OSM"}
        </button>
      </div>
      {message && <div className="station-entry__message">{message}</div>}
      <footer>
        Лицензия ODbL: при выводе результатов требуется атрибуция OpenStreetMap.
      </footer>
    </section>
  );
}

function LayerCard({
  layer,
  starting,
  onStart,
}: {
  layer: SpatialLayer;
  starting: boolean;
  onStart: (mode: "resume" | "restart" | "import") => void;
}) {
  const isOsm = layer.id === "osm_base";
  const isPopulation = layer.id === "population";
  const percent = layer.expected_bytes
    ? Math.min(
        100,
        Math.round(
          ((layer.downloaded_bytes ?? 0) / layer.expected_bytes) * 100,
        ),
      )
    : 0;
  const importOnly =
    layer.status === "failed" &&
    Boolean(layer.downloaded_bytes) &&
    Boolean(layer.expected_bytes) &&
    (layer.downloaded_bytes ?? 0) >= (layer.expected_bytes ?? Infinity);
  const action = importOnly
    ? "import"
    : layer.status === "failed"
      ? "restart"
      : "resume";
  return (
    <article className="module-card spatial-layer">
      <div className="spatial-layer__head">
        <div>
          <span>ПРОСТРАНСТВЕННЫЙ СЛОЙ</span>
          <h3>{layer.title}</h3>
        </div>
        <i className={`spatial-status spatial-status--${layer.status}`}>
          {statusLabel[layer.status]}
        </i>
      </div>
      <p className="spatial-layer__source">{layer.source}</p>
      <p className="spatial-layer__description">{layer.description}</p>
      {isOsm && (
        <>
          <div className="spatial-layer__progress">
            <div>
              <span>{bytes(layer.downloaded_bytes)}</span>
              <small>из ~{bytes(layer.expected_bytes)}</small>
            </div>
            <div className="progress">
              <i style={{ width: `${percent}%` }} />
            </div>
            <b>
              {percent}% · зон населённых пунктов: {layer.settlement_zones ?? 0}
            </b>
          </div>
          <button
            className="button button--primary spatial-layer__action"
            onClick={() => onStart(action)}
            disabled={starting || layer.status === "running"}
          >
            {importOnly
              ? "Повторить импорт"
              : layer.status === "failed"
                ? "Скачать заново"
                : layer.status === "running"
                  ? "Загрузка выполняется…"
                  : layer.status === "ready"
                    ? "Обновить OSM-архив"
                    : "Продолжить загрузку"}
          </button>
        </>
      )}
      {isPopulation && layer.status === "ready" && (
        <div className="spatial-layer__planned">
          <b>
            {layer.dataset_name} · {layer.reference_year}
          </b>
          <small>
            {layer.filename} · {bytes(layer.size_bytes)}
          </small>
        </div>
      )}
      {layer.feature_count !== undefined && (
        <div className="spatial-layer__planned">
          <b>Объектов: {layer.feature_count}</b>
          <small>{layer.dataset_name ?? "Импорт ещё не выполнен"}</small>
        </div>
      )}
      {!isOsm && !isPopulation && layer.feature_count === undefined && (
        <div className="spatial-layer__planned">
          <b>
            {layer.status === "planned"
              ? "Будет добавлен импорт файлов"
              : "Источник будет выбран перед первым запуском"}
          </b>
          <small>{layer.license}</small>
        </div>
      )}
      <footer>{layer.license}</footer>
    </article>
  );
}

function LogCard({ log }: { log: string[] }) {
  return (
    <section className="module-card job-log-card">
      <div className="module-card__head">
        <div>
          <span>ЖУРНАЛ БАЗОВОЙ ГЕОГРАФИИ</span>
          <h3>События загрузки OSM</h3>
        </div>
        <p>data/logs/osm-boundaries-import.log</p>
      </div>
      <div className="job-log">
        {log.length === 0 ? (
          <p>Журнал появится после запуска загрузки OSM.</p>
        ) : (
          log.map((line, index) => (
            <div className="job-log__entry" key={`${index}-${line}`}>
              <time>OSM</time>
              <span>{line}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
