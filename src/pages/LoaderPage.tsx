import { useCallback, useEffect, useMemo, useState } from "react";

import { windApi } from "../windApi";
import type { WindJob, WindJobCreate, WindJobEvent } from "../windTypes";

interface LoaderPageProps {
  onOpenRose: (jobId: number) => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const INITIAL_FORM: WindJobCreate = {
  source: "gee",
  period_mode: "year",
  year: CURRENT_YEAR - 1,
  sector_count: 36,
};

const STATUS_LABELS: Record<WindJob["status"], string> = {
  queued: "В очереди",
  running: "Выполняется",
  completed: "Завершено",
  failed: "Ошибка",
};

export function LoaderPage({ onOpenRose }: LoaderPageProps) {
  const [form, setForm] = useState<WindJobCreate>(INITIAL_FORM);
  const [jobs, setJobs] = useState<WindJob[]>([]);
  const [activeJob, setActiveJob] = useState<WindJob | null>(null);
  const [events, setEvents] = useState<WindJobEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchYears, setBatchYears] = useState(
    `${CURRENT_YEAR - 3}, ${CURRENT_YEAR - 2}, ${CURRENT_YEAR - 1}`,
  );

  const parsedBatchYears = useMemo(() => {
    if (!batchMode) return form.year == null ? [] : [form.year];
    return Array.from(
      new Set(
        batchYears
          .split(/[\s,;]+/)
          .map(Number)
          .filter(
            (year) =>
              Number.isInteger(year) && year >= 1940 && year <= CURRENT_YEAR,
          ),
      ),
    ).sort((left, right) => left - right);
  }, [batchMode, batchYears, form.year]);

  const periodLabel = useMemo(
    () =>
      form.period_mode === "year" && batchMode
        ? parsedBatchYears.length > 0
          ? `${parsedBatchYears.join(", ")} гг. · ${parsedBatchYears.length} задач`
          : "укажите годы через запятую"
        : form.period_mode === "year"
        ? `весь ${form.year} год`
        : `${form.date_from || "…"} — ${form.date_to || "…"}`,
    [batchMode, form, parsedBatchYears],
  );

  const loadJobs = useCallback(async () => {
    const result = await windApi.jobs();
    setJobs(result);
    return result;
  }, []);

  const refreshActive = useCallback(async (jobId: number) => {
    const [job, nextEvents] = await Promise.all([
      windApi.job(jobId),
      windApi.events(jobId),
    ]);
    setActiveJob(job);
    setEvents(nextEvents);
    return job;
  }, []);

  useEffect(() => {
    loadJobs().catch((reason: unknown) =>
      setError(
        reason instanceof Error ? reason.message : "Ошибка загрузки истории",
      ),
    );
  }, [loadJobs]);

  useEffect(() => {
    if (activeJob) return;
    const running =
      jobs.find((job) => job.status === "running") ??
      [...jobs]
        .filter((job) => job.status === "queued")
        .sort((left, right) => left.id - right.id)[0];
    if (!running) return;
    void refreshActive(running.id).catch((reason: unknown) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось восстановить текущую задачу",
      ),
    );
  }, [activeJob, jobs, refreshActive]);

  useEffect(() => {
    if (!activeJob) return;
    const timer = window.setInterval(() => {
      refreshActive(activeJob.id)
        .then((job) => {
          if (job.status === "completed" || job.status === "failed") {
            void loadJobs();
            setActiveJob(null);
            setEvents([]);
          }
        })
        .catch((reason) =>
          setError(
            reason instanceof Error
              ? reason.message
              : "Ошибка обновления статуса",
          ),
        );
    }, 1200);
    return () => window.clearInterval(timer);
  }, [activeJob?.id, loadJobs, refreshActive]);

  const update = <K extends keyof WindJobCreate>(
    key: K,
    value: WindJobCreate[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const start = async () => {
    setIsStarting(true);
    setError(null);
    try {
      if (form.period_mode === "year" && batchMode && parsedBatchYears.length === 0)
        throw new Error("Укажите хотя бы один корректный год");
      if (parsedBatchYears.length > 20)
        throw new Error("За один раз можно добавить не более 20 годов");
      const created: WindJob[] =
        form.period_mode === "year" && batchMode
          ? await windApi.createJobBatch(parsedBatchYears, form.source)
          : [await windApi.createJob(form)];
      setEvents([]);
      const nextJobs = await loadJobs();
      const current =
        nextJobs.find((job) => job.status === "running") ??
        [...nextJobs]
          .filter((job) => job.status === "queued")
          .sort((left, right) => left.id - right.id)[0] ??
        created[0];
      setActiveJob(current);
      await refreshActive(current.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось запустить ERA5 ETL",
      );
    } finally {
      setIsStarting(false);
    }
  };

  const queuePosition = useMemo(() => {
    if (!activeJob || activeJob.status !== "queued") return null;
    const queue = jobs
      .filter((job) => job.status === "queued")
      .sort((left, right) => left.id - right.id);
    const index = queue.findIndex((job) => job.id === activeJob.id);
    return index >= 0 ? index + 1 : null;
  }, [activeJob, jobs]);

  const cancel = async () => {
    if (!activeJob) return;
    setIsCancelling(true);
    setError(null);
    try {
      const job = await windApi.cancelJob(activeJob.id);
      setActiveJob(job);
      await loadJobs();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось отменить загрузку",
      );
    } finally {
      setIsCancelling(false);
    }
  };

  const openJob = async (jobId: number) => {
    setError(null);
    try {
      await refreshActive(jobId);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось открыть задачу",
      );
    }
  };

  return (
    <div className="module-page loader-page">
      <div className="loader-layout">
        <section className="module-card loader-config">
          <div className="module-card__head">
            <div>
              <span>НОВАЯ ЗАДАЧА</span>
              <h3>Параметры загрузки</h3>
              <p>Контур обработки фиксирован: Российская Федерация.</p>
            </div>
          </div>
          <div className="form-grid national-form-grid">
            <label>
              <span>Источник</span>
              <div className="form-static-field">
                Google Earth Engine — ERA5
              </div>
            </label>
            <label>
              <span>Территория</span>
              <div className="form-static-field">Российская Федерация</div>
            </label>
            <label>
              <span>Режим периода</span>
              <select
                value={form.period_mode}
                onChange={(event) =>
                  update("period_mode", event.target.value as "year" | "custom")
                }
              >
                <option value="year">Один календарный год</option>
                <option value="custom">Произвольный интервал</option>
              </select>
            </label>
            {form.period_mode === "year" ? (
              batchMode ? (
                <label>
                  <span>Годы загрузки</span>
                  <input
                    type="text"
                    value={batchYears}
                    placeholder="2022, 2023, 2024"
                    onChange={(event) => setBatchYears(event.target.value)}
                  />
                </label>
              ) : (
                <label>
                  <span>Год загрузки</span>
                  <input
                    type="number"
                    min="1940"
                    max={CURRENT_YEAR}
                    value={form.year ?? ""}
                    onChange={(event) =>
                      update("year", Number(event.target.value))
                    }
                  />
                </label>
              )
            ) : (
              <>
                <label>
                  <span>Начало периода</span>
                  <input
                    type="date"
                    value={form.date_from ?? ""}
                    onChange={(event) =>
                      update("date_from", event.target.value)
                    }
                  />
                </label>
                <label>
                  <span>Конец периода</span>
                  <input
                    type="date"
                    value={form.date_to ?? ""}
                    onChange={(event) => update("date_to", event.target.value)}
                  />
                </label>
              </>
            )}
            <label>
              <span>Секторы направления</span>
              <div className="form-static-field">36 секторов (10°)</div>
            </label>
            <label>
              <span>Штиль</span>
              <div className="form-static-field">
                &lt; 0,5 м/с · правило WMO
              </div>
            </label>
          </div>
          {form.period_mode === "year" && (
            <label className="loader-queue-toggle">
              <input
                type="checkbox"
                checked={batchMode}
                onChange={(event) => setBatchMode(event.target.checked)}
              />
              <span>
                Поставить в очередь несколько лет для последовательной ночной
                загрузки
              </span>
            </label>
          )}
          <div className="loader-period-summary">
            <strong>Будет обработан период:</strong>
            <span>{periodLabel}</span>
            <small>
              Почасовые данные обрабатываются в GEE; в БД попадут только готовые
              национальные агрегаты.
            </small>
          </div>
          <div className="loader-data-note">
            <strong>Состав загрузки:</strong>
            <span>
              ветер и розы · температура · влажность · осадки · высота
              пограничного слоя · облачность и солнечная радиация
            </span>
          </div>
          <div className="method-warning">
            <strong>Методическое ограничение</strong>
            <p>
              Порог штиля сохраняется с версией загрузки. Высота пограничного
              слоя показывается как контекст рассеивания, а не как готовая
              оценка загрязнения.
            </p>
          </div>
          <div className="gee-note">
            <strong>Для реального запуска:</strong> требуются `GEE_PROJECT`,
            авторизация Earth Engine и подключённый пакетный ETL по сетке
            России.
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="form-actions">
            <button
              className="button button--primary loader-start"
              type="button"
              onClick={start}
              disabled={isStarting}
            >
              {isStarting
                ? "Добавление…"
                : batchMode
                  ? `Добавить в очередь (${parsedBatchYears.length})`
                  : activeJob?.status === "running"
                    ? "Добавить следующую задачу"
                    : "Запустить загрузку"}
            </button>
            {(activeJob?.status === "running" ||
              activeJob?.status === "queued") && (
              <button
                className="button button--secondary loader-cancel"
                type="button"
                onClick={() => void cancel()}
                disabled={isCancelling}
              >
                {isCancelling ? "Отмена…" : "Отменить"}
              </button>
            )}
          </div>
        </section>

        <aside className="module-card loader-status-card">
          <div className="module-card__head">
            <div>
              <span>ТЕКУЩАЯ ЗАДАЧА</span>
              <h3>Статус обработки</h3>
            </div>
            {activeJob && (
              <i className={`job-status job-status--${activeJob.status}`}>
                {STATUS_LABELS[activeJob.status]}
              </i>
            )}
          </div>
          {!activeJob ? (
            <div className="empty-module">
              <span>⇩</span>
              <strong>Задача не запущена</strong>
              <p>
                Выберите год или интервал и запустите подготовку национального
                метеослоя.
              </p>
            </div>
          ) : (
            <div className="job-progress">
              <div className="job-progress__value">
                <strong>
                  {activeJob.status === "queued" && queuePosition
                    ? `№ ${queuePosition} в очереди`
                    : `${activeJob.progress_percent.toFixed(0)}%`}
                </strong>
                <span>
                  {activeJob.status === "queued"
                    ? "worker запустит задачу после предыдущих"
                    : `${activeJob.observations_count.toLocaleString("ru-RU")} обработанных оценок`}
                </span>
              </div>
              <div className="progress progress--large">
                <i style={{ width: `${activeJob.progress_percent}%` }} />
              </div>
              <dl>
                <div>
                  <dt>Контур</dt>
                  <dd>Россия</dd>
                </div>
                <div>
                  <dt>Период</dt>
                  <dd>
                    {activeJob.current_period ??
                      `${activeJob.date_from} — ${activeJob.date_to}`}
                  </dd>
                </div>
                <div>
                  <dt>Событий в журнале</dt>
                  <dd>{events.length}</dd>
                </div>
              </dl>
              {activeJob.error_message && (
                <div className="form-error">{activeJob.error_message}</div>
              )}
            </div>
          )}
        </aside>
      </div>

      <section className="module-card job-log-card">
        <div className="module-card__head">
          <div>
            <span>ЖУРНАЛ ТЕКУЩЕЙ ЗАДАЧИ</span>
            <h3>События загрузки</h3>
          </div>
          {activeJob?.log_file_path && <p>Файл: {activeJob.log_file_path}</p>}
        </div>
        <div className="job-log">
          {!activeJob ? (
            <p>Журнал появится после запуска задачи.</p>
          ) : events.length === 0 ? (
            <p>События пока не поступили.</p>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className={`job-log__entry job-log__entry--${event.level}`}
              >
                <time>
                  {new Date(event.created_at).toLocaleTimeString("ru-RU")}
                </time>
                <span>{event.message}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="module-card history-card">
        <div className="module-card__head">
          <div>
            <span>ИСТОРИЯ</span>
            <h3>Запуски ERA5</h3>
          </div>
          <button
            className="text-button"
            type="button"
            onClick={() => void loadJobs()}
          >
            Обновить
          </button>
        </div>
        <div className="jobs-table">
          <div className="jobs-table__head">
            <span>ID</span>
            <span>Контур</span>
            <span>Режим</span>
            <span>Период</span>
            <span>Наблюдения</span>
            <span>Статус</span>
            <span />
          </div>
          {jobs.length === 0 ? (
            <p>Запусков пока нет.</p>
          ) : (
            jobs.map((job) => (
              <div className="jobs-table__row" key={job.id}>
                <span>#{job.id}</span>
                <span>
                  {job.job_scope === "russia" ? "Россия" : job.location_name}
                </span>
                <span>
                  {job.period_mode === "year"
                    ? `Год ${job.requested_year ?? ""}`
                    : "Интервал"}
                </span>
                <span>
                  {job.date_from} — {job.date_to}
                </span>
                <span>{job.observations_count.toLocaleString("ru-RU")}</span>
                <span>
                  <i className={`job-status job-status--${job.status}`}>
                    {STATUS_LABELS[job.status]}
                  </i>
                  {job.status === "queued" && (
                    <small className="queue-position">
                      №{" "}
                      {[...jobs]
                        .filter((item) => item.status === "queued")
                        .sort((left, right) => left.id - right.id)
                        .findIndex((item) => item.id === job.id) + 1}
                    </small>
                  )}
                </span>
                <span>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() =>
                      job.status === "completed"
                        ? onOpenRose(job.id)
                        : void openJob(job.id)
                    }
                  >
                    {job.status === "completed" ? "Роза" : "Открыть"}
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
