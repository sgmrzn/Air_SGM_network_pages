import { useEffect, useMemo, useState } from "react";

type Region = {
  id: string;
  name: string;
  min_lon: number;
  min_lat: number;
  max_lon: number;
  max_lat: number;
};
type ReliefJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress_percent: number;
  stage: string;
  bytes_downloaded: number;
  bytes_total: number | null;
  error_message: string | null;
  result: { width: number; height: number } | null;
};

const regionalResolutions = [30, 90, 250, 500, 1000];
// CDSE Process API does not produce Copernicus DEM coarser than 1.5 km for
// the country-wide request. Keep its actual output resolution explicit.
const nationalResolutions = [1500];

export function SpatialApiLoadersPanel({
  onImported,
}: {
  onImported: () => void;
}) {
  const [mode, setMode] = useState<"national_base" | "region_detail">(
    "national_base",
  );
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionId, setRegionId] = useState("");
  const [resolution, setResolution] = useState(1500);
  const [dem, setDem] = useState("COPERNICUS_30");
  const [busy, setBusy] = useState<"dem" | null>(null);
  const [message, setMessage] = useState("");
  const [demJob, setDemJob] = useState<ReliefJob | null>(null);
  const [demEvents, setDemEvents] = useState<string[]>([]);
  const resolutions = useMemo(
    () =>
      mode === "national_base" ? nationalResolutions : regionalResolutions,
    [mode],
  );
  const selectedRegion = regions.find((region) => region.id === regionId);

  useEffect(() => {
    void fetch("/api/spatial/boundaries/region")
      .then((response) =>
        response.ok ? (response.json() as Promise<Region[]>) : [],
      )
      .then((items) => {
        setRegions(items);
        if (!regionId && items[0]) setRegionId(items[0].id);
      })
      .catch(() => setRegions([]));
  }, []);

  useEffect(() => {
    if (!demJob || !["queued", "running"].includes(demJob.status)) return;
    const refresh = () => {
      void Promise.all([
        fetch(`/api/spatial/relief/jobs/${demJob.id}`).then(
          (response) => response.json() as Promise<ReliefJob>,
        ),
        fetch(`/api/spatial/relief/jobs/${demJob.id}/events`).then(
          (response) => response.json() as Promise<string[]>,
        ),
      ])
        .then(([job, events]) => {
          setDemJob(job);
          setDemEvents(events);
          if (job.status === "completed") {
            onImported();
            setMessage(
              `Рельеф сохранён: ${job.result?.width} × ${job.result?.height} ячеек.`,
            );
          }
          if (job.status === "failed")
            setMessage(job.error_message ?? "Загрузка рельефа не завершена");
        })
        .catch((error) =>
          setMessage(error instanceof Error ? error.message : String(error)),
        );
    };
    refresh();
    const timer = window.setInterval(refresh, 1500);
    return () => window.clearInterval(timer);
  }, [demJob?.id, demJob?.status, onImported]);

  const changeMode = (next: "national_base" | "region_detail") => {
    setMode(next);
    setResolution(next === "national_base" ? 1500 : 250);
  };
  const loadDem = async () => {
    setBusy("dem");
    setMessage("");
    try {
      const body = new URLSearchParams({
        mode,
        resolution_m: String(resolution),
        dem_instance: dem,
      });
      if (mode === "region_detail") body.set("region_id", regionId);
      const response = await fetch("/api/spatial/relief/copernicus-dem", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const result = (await response.json()) as {
        detail?: string;
        job?: ReliefJob;
      };
      if (!response.ok)
        throw new Error(result.detail ?? "Ошибка загрузки рельефа");
      setDemJob(result.job ?? null);
      setDemEvents([]);
      setMessage("Задача запущена в фоне. Статус и журнал появятся ниже.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="spatial-layer-grid">
      <article className="module-card dem-loader">
        <header className="dem-loader__header">
          <div>
            <span>РЕЛЬЕФ · CDSE API</span>
            <h3>Copernicus DEM</h3>
            <p>
              Выберите масштаб задачи — система сама ограничит небезопасно
              большой запрос.
            </p>
          </div>
          <div className="dem-loader__source">
            <b>Доступ настроен</b>
            <small>CDSE credentials из .env</small>
          </div>
        </header>
        <div className="dem-loader__step">
          <span>1</span>
          <div>
            <b>Для какой задачи нужен рельеф?</b>
            <small>Базовый слой и детальный слой хранятся отдельно.</small>
          </div>
        </div>
        <div
          className="dem-loader__modes"
          role="radiogroup"
          aria-label="Режим загрузки рельефа"
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === "national_base"}
            className={
              mode === "national_base"
                ? "dem-loader__mode dem-loader__mode--active"
                : "dem-loader__mode"
            }
            onClick={() => changeMode("national_base")}
          >
            <b>Базовый рельеф России</b>
            <span>Для общероссийской аналитики</span>
            <small>Сетка 1,5 км</small>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "region_detail"}
            className={
              mode === "region_detail"
                ? "dem-loader__mode dem-loader__mode--active"
                : "dem-loader__mode"
            }
            onClick={() => changeMode("region_detail")}
          >
            <b>Детальный рельеф региона</b>
            <span>Для расчёта покрытия постов</span>
            <small>Сетка 30 м – 1 км</small>
          </button>
        </div>
        <div className="dem-loader__step">
          <span>2</span>
          <div>
            <b>Настройте выгрузку</b>
            <small>
              Исходные данные остаются Copernicus DEM; для всей России CDSE
              выдаёт сетку 1,5 км.
            </small>
          </div>
        </div>
        <div className="dem-loader__fields">
          {mode === "region_detail" && (
            <label className="dem-loader__field dem-loader__field--region">
              <span>Граница региона</span>
              <select
                value={regionId}
                onChange={(event) => setRegionId(event.target.value)}
                disabled={!regions.length}
              >
                <option value="">Выберите границу…</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
              <small>
                {regions.length
                  ? "Берётся охватывающий прямоугольник загруженной границы."
                  : "Сначала добавьте границу в разделе «Границы»."}
              </small>
            </label>
          )}
          <label className="dem-loader__field">
            <span>Исходный DEM</span>
            <select
              value={dem}
              onChange={(event) => setDem(event.target.value)}
            >
              <option value="COPERNICUS_30">GLO-30 · 30 м</option>
              <option value="COPERNICUS_90">GLO-90 · 90 м</option>
            </select>
          </label>
          <label className="dem-loader__field">
            <span>Шаг расчётной сетки</span>
            <select
              value={resolution}
              onChange={(event) => setResolution(Number(event.target.value))}
            >
              {resolutions.map((value) => (
                <option key={value} value={value}>
                  {value >= 1000 ? `${value / 1000} км` : `${value} м`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <footer className="dem-loader__footer">
          <div>
            <b>
              {mode === "national_base"
                ? "Будет создан базовый слой для России"
                : selectedRegion
                  ? `Будет создан детальный слой: ${selectedRegion.name}`
                  : "Выберите загруженную границу региона"}
            </b>
            <span>
              {mode === "national_base"
                ? "CDSE для всей России выдаёт не грубее 1,5 км; этот фактический шаг будет сохранён без понижения детализации."
                : "250–500 м обычно достаточно для предварительного планирования постов."}
            </span>
          </div>
          <button
            className="button button--primary"
            disabled={
              busy !== null ||
              ["queued", "running"].includes(demJob?.status ?? "") ||
              (mode === "region_detail" && !regionId)
            }
            onClick={() => void loadDem()}
          >
            {busy === "dem" ||
            ["queued", "running"].includes(demJob?.status ?? "")
              ? "Загрузка…"
              : "Создать слой рельефа"}
          </button>
        </footer>
        {demJob && (
          <div className="job-progress dem-loader__progress">
            <div className="job-progress__value">
              <strong>{Math.round(demJob.progress_percent)}%</strong>
              <span>{demJob.stage}</span>
            </div>
            <div className="progress progress--large">
              <i style={{ width: `${demJob.progress_percent}%` }} />
            </div>
            <small>
              {demJob.bytes_total
                ? `${(demJob.bytes_downloaded / 1024 / 1024).toFixed(1)} / ${(demJob.bytes_total / 1024 / 1024).toFixed(1)} МБ`
                : demJob.bytes_downloaded
                  ? `${(demJob.bytes_downloaded / 1024 / 1024).toFixed(1)} МБ получено`
                  : "Ожидание ответа CDSE"}
            </small>
            {demJob.status === "failed" && (
              <p className="station-entry__message">{demJob.error_message}</p>
            )}
            <div className="job-log">
              {demEvents.length ? (
                demEvents.map((event, index) => (
                  <div className="job-log__entry" key={`${index}-${event}`}>
                    <time>DEM</time>
                    <span>{event}</span>
                  </div>
                ))
              ) : (
                <p>События появятся после запуска задачи.</p>
              )}
            </div>
          </div>
        )}
      </article>
      <article className="module-card spatial-layer">
        <div className="spatial-layer__head">
          <div>
            <span>КОНТЕКСТ ПЛОЩАДКИ</span>
            <h3>OpenStreetMap</h3>
          </div>
        </div>
        <p className="spatial-layer__description">
          Конкретная площадка утверждается экспертом на местности. Локальный
          OSM-архив используется как справочный контекст: жилая застройка и
          социальные объекты уже доступны; воду, дороги и доступность следует
          подтвердить в полевом обследовании или загрузить как проверенные
          маски.
        </p>
      </article>
      {message && <p className="station-entry__message">{message}</p>}
    </section>
  );
}
