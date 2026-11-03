import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { MeteoMonthCoverage } from "../windTypes";

type CoverageRow = MeteoMonthCoverage & {
  indicator?: string;
  grid_version_id?: string;
  valid_cells?: number;
  checked_at?: string | null;
};
type SpatialLayer = {
  id: string;
  title: string;
  source: string;
  status: string;
  feature_count?: number;
  stations_count?: number;
  settlement_zones?: number;
};
type ActiveJob = {
  id: number;
  status: string;
  current_period: string | null;
  progress_percent: number;
};
type CoverageResponse = {
  year: number;
  available_years: number[];
  generated_at: string;
  era5: CoverageRow[];
  spatial_layers: SpatialLayer[];
  active_jobs: { era5: ActiveJob | null };
};

const MONTHS = [
  "Янв",
  "Фев",
  "Мар",
  "Апр",
  "Май",
  "Июн",
  "Июл",
  "Авг",
  "Сен",
  "Окт",
  "Ноя",
  "Дек",
];
const STATUS_LABEL: Record<CoverageRow["status"], string> = {
  not_loaded: "Нет данных",
  pending: "В очереди",
  running: "Загружается",
  partial: "Частично",
  completed: "Проверено",
  failed: "Ошибка",
};

function countReady(rows: CoverageRow[]): number {
  return rows.filter((row) => row.status === "completed").length;
}

function layerCount(layer: SpatialLayer): number | null {
  return (
    layer.feature_count ??
    layer.stations_count ??
    layer.settlement_zones ??
    null
  );
}

export function MeteoCoveragePage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<CoverageResponse | null>(null);
  const [selected, setSelected] = useState<{
    label: string;
    row: CoverageRow;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coverageRequest = useRef<AbortController | null>(null);

  const loadCoverage = useCallback(async () => {
    if (coverageRequest.current) return;
    const controller = new AbortController();
    coverageRequest.current = controller;
    try {
      setError(null);
      const response = await fetch(`/api/data-coverage?year=${year}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Сервер вернул ${response.status}`);
      const payload = (await response.json()) as CoverageResponse;
      setData(payload);
      if (
        payload.available_years.length &&
        !payload.available_years.includes(year)
      ) {
        setYear(payload.available_years[0]);
      }
    } catch (reason) {
      if (controller.signal.aborted) return;
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось получить покрытие данных",
      );
    } finally {
      if (coverageRequest.current === controller) {
        coverageRequest.current = null;
        setLoading(false);
      }
    }
  }, [year]);

  useEffect(() => {
    setLoading(true);
    void loadCoverage();
    return () => {
      coverageRequest.current?.abort();
      coverageRequest.current = null;
    };
  }, [loadCoverage]);

  const hasActiveJob = Boolean(data?.active_jobs.era5);
  useEffect(() => {
    if (!hasActiveJob) return;
    const timer = window.setInterval(() => void loadCoverage(), 15_000);
    return () => window.clearInterval(timer);
  }, [hasActiveJob, loadCoverage]);

  const matrix = useMemo(() => {
    if (!data) return [];
    return [
      { key: "era5", label: "ERA5", note: "метеоданные", rows: data.era5 },
    ];
  }, [data]);

  const problemRows = matrix.flatMap((dataset) => {
    const datasetStarted = dataset.rows.some(
      (row) => row.status !== "not_loaded",
    );
    if (!datasetStarted) return [];
    return dataset.rows
      .filter(
        (row) =>
          row.status === "not_loaded" ||
          row.status === "partial" ||
          row.status === "failed",
      )
      .map((row) => ({ dataset: dataset.label, row }));
  });
  const spatialReady =
    data?.spatial_layers.filter((layer) => layer.status === "ready").length ??
    0;

  const refreshCoverage = async () => {
    if (coverageRequest.current) return;
    setRebuilding(true);
    setLoading(true);
    try {
      await loadCoverage();
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <div className="module-page data-readiness-page">
      <section className="module-card readiness-toolbar">
        <div>
          <span>СВОДНЫЙ КОНТРОЛЬ ЗАГРУЗОК</span>
          <h2>Покрытие данных</h2>
          <p>
            Сохранённая полнота ERA5 и базовых пространственных слоёв.
          </p>
        </div>
        <label>
          <span>Год</span>
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {(data?.available_years.length ? data.available_years : [year]).map(
              (value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ),
            )}
          </select>
        </label>
        <div className="readiness-actions">
          <small>
            {data
              ? `Проверено ${new Date(data.generated_at).toLocaleString("ru-RU")}`
              : "Получение сводки…"}
          </small>
          <button
            className="button button--secondary"
            type="button"
            disabled={rebuilding}
            onClick={() => void refreshCoverage()}
          >
            {rebuilding ? "Обновляется…" : "Обновить"}
          </button>
        </div>
      </section>

      {error && <div className="form-error">{error}</div>}
      {hasActiveJob && (
        <section className="readiness-job-banner">
          <strong>Идёт загрузка данных</strong>
          {data?.active_jobs.era5 && (
            <span>
              ERA5 #{data.active_jobs.era5.id}:{" "}
              {Math.round(data.active_jobs.era5.progress_percent)}% ·{" "}
              {data.active_jobs.era5.current_period ?? "подготовка"}
            </span>
          )}
        </section>
      )}

      <section className="readiness-kpis">
        <article
          className={
            data && countReady(data.era5) < data.era5.length
              ? "readiness-kpi--warning"
              : undefined
          }
        >
          <span>ERA5</span>
          <strong>
            {data ? `${countReady(data.era5)} / ${data.era5.length}` : "—"}
          </strong>
          <small>месяцев загружено</small>
        </article>
        <article>
          <span>Базовые слои</span>
          <strong>
            {data ? `${spatialReady} / ${data.spatial_layers.length}` : "—"}
          </strong>
          <small>наборов готово</small>
        </article>
        <article
          className={
            problemRows.length ? "readiness-kpi--warning" : "readiness-kpi--ok"
          }
        >
          <span>Требует внимания</span>
          <strong>{problemRows.length}</strong>
          <small>
            {problemRows.length ? "неполных периодов" : "ошибок не найдено"}
          </small>
        </article>
      </section>

      <section className="module-card readiness-matrix-card">
        <div className="module-card__head">
          <div>
            <span>ГОДОВЫЕ НАБОРЫ · {year}</span>
            <h3>Покрытие по месяцам</h3>
          </div>
          <div className="readiness-legend">
            <i className="completed" />
            Загружено
            <i className="partial" />
            Частично
            <i className="not_loaded" />
            Не загружено
          </div>
        </div>
        <div
          className={`readiness-matrix${loading ? " readiness-matrix--loading" : ""}`}
        >
          <div className="readiness-matrix__corner">Набор</div>
          {MONTHS.map((month) => (
            <b key={month}>{month}</b>
          ))}
          {matrix.map((dataset) => (
            <div
              className={`readiness-matrix__row${dataset.rows.some((row) => row.status === "not_loaded" || row.status === "partial" || row.status === "failed") ? " readiness-matrix__row--problem" : ""}`}
              key={dataset.key}
            >
              <div>
                <strong>{dataset.label}</strong>
                <small>{dataset.note}</small>
              </div>
              {dataset.rows.map((row, index) => {
                const percent = row.expected_cells
                  ? Math.round((row.loaded_cells / row.expected_cells) * 100)
                  : 0;
                const cellLabel = `${MONTHS[index]}: ${STATUS_LABEL[row.status]}${row.loaded_cells ? ` · ${percent}%` : ""}`;
                return (
                  <button
                    key={row.month}
                    type="button"
                    className={`readiness-cell readiness-cell--${row.status}`}
                    onClick={() => setSelected({ label: dataset.label, row })}
                    title={cellLabel}
                    aria-label={`${dataset.label}, ${cellLabel}`}
                  >
                    <span>{index + 1}</span>
                    {row.status !== "completed" && (
                      <small>
                        {row.status === "not_loaded"
                          ? "Нет"
                          : row.status === "partial"
                            ? `${percent}%`
                            : row.status === "failed"
                              ? "Ошибка"
                              : "…"}
                      </small>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {selected && (
          <div className="readiness-detail">
            <div>
              <span>
                {selected.label} · {selected.row.month}
              </span>
              <strong>{STATUS_LABEL[selected.row.status]}</strong>
            </div>
            <dl>
              <div>
                <dt>Загружено</dt>
                <dd>
                  {selected.row.loaded_cells.toLocaleString("ru-RU")} /{" "}
                  {selected.row.expected_cells.toLocaleString("ru-RU")} ячеек
                </dd>
              </div>
              {selected.row.valid_cells !== undefined && (
                <div>
                  <dt>С данными</dt>
                  <dd>
                    {selected.row.valid_cells.toLocaleString("ru-RU")} ячеек
                  </dd>
                </div>
              )}
              <div>
                <dt>Версия</dt>
                <dd>
                  {selected.row.processing_version ??
                    selected.row.grid_version_id ??
                    "не указана"}
                </dd>
              </div>
              <div>
                <dt>Проверено</dt>
                <dd>
                  {selected.row.checked_at || selected.row.completed_at
                    ? new Date(
                        selected.row.checked_at ??
                          selected.row.completed_at ??
                          "",
                      ).toLocaleString("ru-RU")
                    : "—"}
                </dd>
              </div>
            </dl>
            <button
              className="text-button"
              type="button"
              onClick={() => setSelected(null)}
            >
              Закрыть
            </button>
          </div>
        )}
      </section>

      {problemRows.length > 0 && (
        <section className="module-card readiness-problems">
          <div className="module-card__head">
            <div>
              <span>ТРЕБУЕТ ВНИМАНИЯ</span>
              <h3>Неполные и ошибочные периоды</h3>
            </div>
          </div>
          <div>
            {problemRows.map(({ dataset, row }) => (
              <button
                type="button"
                key={`${dataset}-${row.month}`}
                onClick={() => setSelected({ label: dataset, row })}
              >
                <strong>
                  {dataset} · {row.month}
                </strong>
                <span>
                  {STATUS_LABEL[row.status]}:{" "}
                  {row.loaded_cells.toLocaleString("ru-RU")} /{" "}
                  {row.expected_cells.toLocaleString("ru-RU")} ячеек
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="module-card readiness-layers">
        <div className="module-card__head">
          <div>
            <span>ОБЩИЕ ДЛЯ ВСЕХ ЛЕТ</span>
            <h3>Базовые пространственные слои</h3>
          </div>
        </div>
        <div>
          {data?.spatial_layers.map((layer) => (
            <article key={layer.id}>
              <div>
                <strong>{layer.title}</strong>
                <small>{layer.source}</small>
              </div>
              {layerCount(layer) !== null && (
                <em>{layerCount(layer)?.toLocaleString("ru-RU")} объектов</em>
              )}
              <span
                className={`data-coverage-layers__status data-coverage-layers__status--${layer.status}`}
              >
                {layer.status === "ready"
                  ? "Готово"
                  : layer.status === "running"
                    ? "Выполняется"
                    : layer.status === "failed"
                      ? "Ошибка"
                      : layer.status === "planned"
                        ? "Планируется"
                        : "Не настроено"}
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
