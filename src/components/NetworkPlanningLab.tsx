import { useState, useEffect, useRef } from "react";
import { explainExperimentError } from "../shared/networkExperimentErrors";
import { request } from "../shared/http";
import {
  Move,
  TrendingUp,
  GitCompareArrows,
  Download,
  RotateCcw,
  Play,
  ShieldCheck,
} from "lucide-react";
import "./NetworkPlanning.css";
import { NetworkExperimentComparison } from "./NetworkExperimentComparison";
import { NetworkSeriesComparison } from "./NetworkSeriesComparison";

export interface PlanningPoint {
  cell_id: string;
  longitude: number;
  latitude: number;
}
export interface SiteCheck {
  status: string;
  message: string;
  requires_expert_review?: boolean;
  sites: Array<{
    cell_id: string;
    valid: boolean;
    reasons: string[];
    warnings?: string[];
  }>;
}
interface ExperimentJob {
  id: string;
  status:
    "queued" | "running" | "cancelling" | "cancelled" | "completed" | "failed";
  percent: number;
  stage: string;
  error?: string;
  queue_position?: number;
  queue_wait_seconds?: number | null;
  execution_seconds?: number | null;
  timing?: {
    stages: Array<{ stage: string; seconds: number }>;
    current?: { stage: string; seconds: number; interrupted?: boolean } | null;
  };
  request: {
    action: "layout" | "frontier" | "spopt" | "benchmark";
    view: string;
  };
  experiment?: Experiment;
}
interface Experiment {
  id: string;
  result: Record<string, any>;
  [key: string]: any;
}

export function NetworkPlanningLab({
  runId,
  view,
  count,
  points,
  editing,
  onEditingChange,
  onReset,
  onValidation,
  onApplyPoints,
}: {
  runId: string;
  view: string;
  count: number;
  points: PlanningPoint[];
  editing: boolean;
  onEditingChange: (value: boolean) => void;
  onReset: () => void;
  onValidation?: (value: SiteCheck | null) => void;
  onApplyPoints?: (value: PlanningPoint[]) => void;
}) {
  const [result, setResult] = useState<Experiment | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeAction, setActiveAction] = useState<
    "layout" | "frontier" | "spopt" | "benchmark" | null
  >(null);
  const [job, setJob] = useState<ExperimentJob | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [pollRevision, setPollRevision] = useState(0);
  const currentScope = useRef(`${runId}:${view}`);
  currentScope.current = `${runId}:${view}`;
  const jobStorageKey = `air-sgm:experiment-job:${runId}:${view}`;
  const [statusKnown, setStatusKnown] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [queueRevision, setQueueRevision] = useState(0);
  const [errorDetail, setErrorDetail] = useState("");
  const [error, setError] = useState("");
  const [validation, setValidation] = useState<SiteCheck | null>(null);
  const [validatedSignature, setValidatedSignature] = useState<string | null>(
    null,
  );
  const [history, setHistory] = useState<Experiment[]>([]);
  const validationCallback = useRef(onValidation);
  validationCallback.current = onValidation;
  const [from, setFrom] = useState(Math.max(1, count - 2));
  const [to, setTo] = useState(Math.min(20, count + 2));
  const pointSignature = JSON.stringify(
    points.map(({ cell_id, longitude, latitude }) => [
      cell_id,
      longitude,
      latitude,
    ]),
  );
  const currentPoints = useRef(pointSignature);
  currentPoints.current = pointSignature;
  useEffect(() => {
    setResult(null);
    setError("");
  }, [pointSignature]);
  useEffect(() => {
    const controller = new AbortController();
    setValidation(null);
    setValidatedSignature(null);
    validationCallback.current?.(null);
    const timer = setTimeout(() => {
      void request<{ result: SiteCheck }>(
        `/api/spatial/network-design/runs/${encodeURIComponent(runId)}/experiments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ action: "validate", view, points }),
        },
      )
        .then((value) => {
          if (!controller.signal.aborted) {
            setValidation(value.result);
            setValidatedSignature(pointSignature);
            validationCallback.current?.(value.result);
          }
        })
        .catch((failure) => {
          if (!controller.signal.aborted)
            setValidation({
              status: "unavailable",
              sites: [],
              message:
                failure instanceof Error ? failure.message : String(failure),
            });
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [editing, pointSignature, runId, view]);
  useEffect(() => {
    const controller = new AbortController();
    setHistoryError("");
    setHistory([]);
    setHistoryLoading(true);
    void request<Experiment[]>(
      `/api/spatial/network-design/runs/${encodeURIComponent(runId)}/experiments`,
      { signal: controller.signal },
    )
      .then((rows) => {
        if (!controller.signal.aborted)
          setHistory(rows.filter((row) => row.request?.view === view));
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          const problem = explainExperimentError(failure, "history");
          setHistoryError(`${problem.message} ${problem.detail}`);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });
    return () => controller.abort();
  }, [runId, view, result?.id, historyRevision]);
  useEffect(() => {
    setJobId(null);
    setJob(null);
    setBusy(false);
    setResult(null);
    setError("");
    setErrorDetail("");
    setStatusKnown(true);
    const controller = new AbortController();
    const saved = window.localStorage.getItem(jobStorageKey);
    void request<ExperimentJob[]>(
      `/api/spatial/network-design/runs/${encodeURIComponent(runId)}/experiment-jobs`,
      { signal: controller.signal },
    )
      .then((rows) => {
        if (controller.signal.aborted) return;
        const selected =
          rows.find((row) => row.id === saved && row.request.view === view) ??
          rows.find(
            (row) =>
              row.request.view === view &&
              ["queued", "running", "cancelling"].includes(row.status),
          );
        if (selected) {
          setJob(selected);
          setJobId(selected.id);
        }
      })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        if (saved) setJobId(saved);
        else {
          const problem = explainExperimentError(failure, "history");
          setError(problem.message);
          setErrorDetail(problem.detail);
        }
      });
    return () => controller.abort();
  }, [runId, view, queueRevision]);

  useEffect(() => {
    if (!jobId) return;
    const controller = new AbortController();
    window.localStorage.setItem(jobStorageKey, jobId);
    setBusy(true);
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await request<ExperimentJob>(
          `/api/spatial/network-design/runs/${encodeURIComponent(runId)}/experiment-jobs/${encodeURIComponent(jobId)}`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setJob(next);
        setStatusKnown(true);
        setError("");
        setErrorDetail("");
        setActiveAction(next.request.action);
        if (["queued", "running", "cancelling"].includes(next.status)) {
          timer = setTimeout(poll, 800);
          return;
        }
        setBusy(false);
        if (next.status === "completed" && next.experiment) {
          setResult(next.experiment);
          setError("");
          if (next.request.action === "layout") {
            const used = JSON.stringify(
              next.experiment.request.points.map(
                ({ cell_id, longitude, latitude }: PlanningPoint) => [
                  cell_id,
                  longitude,
                  latitude,
                ],
              ),
            );
            if (used !== currentPoints.current)
              setError(
                "Эксперимент завершён для прежних координат. Его результат сохранён; для текущих точек выполните новый пересчёт.",
              );
          }
        } else if (next.status === "failed") {
          const problem = explainExperimentError(
            new Error(next.error || "Причина не указана исполнителем"),
            "compute",
          );
          setError(problem.message);
          setErrorDetail(problem.detail);
        }
      } catch (failure) {
        if (!controller.signal.aborted) {
          const problem = explainExperimentError(failure, "status");
          setStatusKnown(false);
          setBusy(!problem.statusMissing);
          setError(problem.message);
          setErrorDetail(problem.detail);
          if (problem.statusMissing) {
            setJob(null);
            setJobId(null);
            window.localStorage.removeItem(jobStorageKey);
          }
        }
      }
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [jobId, pollRevision, runId, view]);

  async function cancelJob() {
    if (!jobId) return;
    try {
      const next = await request<ExperimentJob>(
        `/api/spatial/network-design/runs/${encodeURIComponent(runId)}/experiment-jobs/${encodeURIComponent(jobId)}/cancel`,
        { method: "POST" },
      );
      setJob(next);
      setPollRevision((value) => value + 1);
    } catch (failure) {
      const problem = explainExperimentError(failure, "cancel");
      setStatusKnown(false);
      setError(problem.message);
      setErrorDetail(problem.detail);
    }
  }

  async function calculate(
    action: "layout" | "frontier" | "spopt" | "benchmark",
  ) {
    if (
      action === "layout" &&
      (validation?.status !== "valid" || validatedSignature !== pointSignature)
    )
      return;
    const scope = `${runId}:${view}`;
    setBusy(true);
    setActiveAction(action);
    setError("");
    setResult(null);
    setJob(null);
    setStatusKnown(true);
    setErrorDetail("");
    try {
      if (action === "frontier" && (from > to || to - from > 5))
        throw new RangeError("Выберите от 1 до 6 значений N");
      const value = await request<ExperimentJob>(
        `/api/spatial/network-design/runs/${encodeURIComponent(runId)}/experiment-jobs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            view,
            points:
              action === "layout"
                ? points.map(({ cell_id, longitude, latitude }) => ({
                    cell_id,
                    longitude,
                    latitude,
                  }))
                : [],
            budgets:
              action === "frontier"
                ? Array.from({ length: to - from + 1 }, (_, i) => from + i)
                : [],
          }),
        },
      );
      if (currentScope.current !== scope) return;
      setJob(value);
      setJobId(value.id);
    } catch (failure) {
      if (currentScope.current === scope) {
        const problem = explainExperimentError(failure, "submit");
        setError(problem.message);
        setErrorDetail(problem.detail);
        setBusy(false);
      }
    }
  }
  const data = result?.result;

  const rangeValid =
    Number.isInteger(from) &&
    Number.isInteger(to) &&
    from >= 1 &&
    to <= 20 &&
    to >= from &&
    to - from <= 5;
  return (
    <section
      className="network-planning-lab"
      aria-labelledby="planning-lab-title"
      aria-busy={busy}
    >
      <header className="planning-heading">
        <div>
          <span className="planning-eyebrow">ПРОЕКТНЫЕ ЭКСПЕРИМЕНТЫ</span>
          <h3 id="planning-lab-title">Проверка проектного решения</h3>
          <p>
            Проверьте размещение, выберите размер сети и сравните результат с
            независимым решателем.
          </p>
        </div>
        <span className="planning-badge">
          <ShieldCheck aria-hidden="true" /> Исходный запуск сохранён
        </span>
      </header>
      <div className="planning-tools">
        <article className={`planning-tool ${editing ? "is-active" : ""}`}>
          <div className="planning-tool__title">
            <span className="planning-icon">
              <Move aria-hidden="true" />
            </span>
            <div>
              <span className="planning-eyebrow">01 · РАЗМЕЩЕНИЕ</span>
              <h4>Перенос точек</h4>
            </div>
          </div>
          <p>
            Измените координаты на карте и оцените, как меняются охват и
            перекрытие постов.
          </p>
          <label className="planning-toggle">
            <input
              type="checkbox"
              checked={editing}
              disabled={busy}
              onChange={(e) => {
                onEditingChange(e.target.checked);
                setResult(null);
              }}
            />
            <span>Редактировать точки на карте</span>
          </label>
          {editing && (
            <div className="planning-hint">
              Перетащите точки. Зелёная область — жилые контуры; красная —
              исключения. Для новых расчётов точка должна находиться внутри
              границы и жилого контура вне применённых исключений. Контур здания
              служит расчётным ориентиром; наружную площадку выбирают при
              обследовании. После пересчёта покажем контекстные баллы в новых
              координатах по сохранённым данным. Основная сеть не оптимизируется
              повторно.
            </div>
          )}
          {(editing || validation?.status === "unavailable") && (
            <div className="planning-hint" role="status">
              {validation ? validation.message : "Проверяем координаты…"}
              {validation?.sites
                .filter((row) => !row.valid)
                .map((row) => (
                  <p key={row.cell_id}>
                    {row.cell_id}:{" "}
                    {row.reasons
                      .map(
                        (reason) =>
                          ({
                            outside_territory: "вне границы",
                            outside_residential: "вне жилой застройки",
                            inside_exclusion: "в маске исключений",
                            invalid_coordinates: "некорректные координаты",
                          })[reason] ?? reason,
                      )
                      .join(", ")}
                  </p>
                ))}
            </div>
          )}
          {editing &&
            validation?.sites.some((row) =>
              row.warnings?.includes("outside_residential"),
            ) && (
              <div className="planning-help">
                Точек вне жилых контуров:{" "}
                {
                  validation.sites.filter((row) =>
                    row.warnings?.includes("outside_residential"),
                  ).length
                }
                . Это справочная характеристика; пересчёт охвата разрешён, если
                нет нарушений границы и масок.
              </div>
            )}
          {validation?.requires_expert_review && (
            <div className="planning-hint" role="status">
              Одна или несколько точек находятся на территории с неуточнёнными
              ограничениями. Охват рассчитан условно; допустимость размещения
              требует экспертной проверки.
            </div>
          )}
          <div className="planning-tool__actions">
            <button
              className="planning-button is-primary"
              disabled={
                busy ||
                validation?.status !== "valid" ||
                validatedSignature !== pointSignature
              }
              onClick={() => void calculate("layout")}
            >
              <Play aria-hidden="true" />
              {busy && activeAction === "layout"
                ? "Пересчитываем…"
                : "Пересчитать охват"}
            </button>
            <button
              className="planning-button is-icon"
              title="Вернуть исходные точки"
              aria-label="Вернуть исходные точки"
              disabled={busy}
              onClick={() => {
                onReset();
                setResult(null);
              }}
            >
              <RotateCcw aria-hidden="true" />
            </button>
          </div>
        </article>
        <article className="planning-tool">
          <div className="planning-tool__title">
            <span className="planning-icon">
              <TrendingUp aria-hidden="true" />
            </span>
            <div>
              <span className="planning-eyebrow">02 · РАЗМЕР СЕТИ</span>
              <h4>Кривая покрытия</h4>
            </div>
          </div>
          <p>
            Сравните охват для разных N. Для каждого числа постов размещение
            рассчитывается заново.
          </p>
          <div className="planning-range">
            <label>
              Постов от
              <input
                aria-label="Начальное N"
                type="number"
                min={1}
                max={20}
                disabled={busy}
                value={from}
                onChange={(e) => {
                  setFrom(Number(e.target.value));
                  setResult(null);
                }}
              />
            </label>
            <span aria-hidden="true">—</span>
            <label>
              до
              <input
                aria-label="Конечное N"
                type="number"
                min={1}
                max={20}
                disabled={busy}
                value={to}
                onChange={(e) => {
                  setTo(Number(e.target.value));
                  setResult(null);
                }}
              />
            </label>
          </div>
          <small
            className={rangeValid ? "planning-help" : "planning-help is-error"}
          >
            {rangeValid
              ? `${to - from + 1} вариантов · не более 6 за один расчёт`
              : "Укажите до 6 значений в диапазоне 1–20"}
          </small>
          <div className="planning-tool__actions">
            <button
              className="planning-button is-primary"
              disabled={busy || !rangeValid}
              onClick={() => void calculate("frontier")}
            >
              <TrendingUp aria-hidden="true" />
              {busy && activeAction === "frontier"
                ? "Строим кривую…"
                : "Рассчитать кривую"}
            </button>
          </div>
        </article>
        <article className="planning-tool">
          <div className="planning-tool__title">
            <span className="planning-icon">
              <GitCompareArrows aria-hidden="true" />
            </span>
            <div>
              <span className="planning-eyebrow">03 · ПРОВЕРКА ЯДРА</span>
              <h4>Сравнение со spopt</h4>
            </div>
          </div>
          <p>
            Независимый решатель проверяет основную целевую функцию на тех же
            данных и при том же N.
          </p>
          <div className="planning-reference">
            <strong>{count} постов</strong>
            <span>Одинаковые данные · основная цель</span>
          </div>
          <div className="planning-tool__actions">
            <button
              className="planning-button"
              disabled={busy}
              onClick={() => void calculate("spopt")}
            >
              <GitCompareArrows aria-hidden="true" />
              {busy && activeAction === "spopt"
                ? "Сравниваем…"
                : "Сравнить решатели"}
            </button>
          </div>
        </article>
      </div>
      <div className="planning-research-actions">
        <button
          className="planning-button"
          disabled={busy}
          onClick={() => void calculate("benchmark")}
        >
          <GitCompareArrows aria-hidden="true" />
          {busy && activeAction === "benchmark"
            ? "Сравниваем методы…"
            : "Сравнить MILP и базовые алгоритмы"}
        </button>
        <span className="planning-help">
          На одинаковых данных: жадный прирост и пространственное разнесение.
        </span>
      </div>
      {history.length > 0 && (
        <label className="planning-help">
          Сохранённые эксперименты этого сценария
          <select
            aria-label="Сохранённые эксперименты"
            disabled={busy}
            value={result?.id ?? ""}
            onChange={(event) => {
              const saved = history.find(
                (row) => row.id === event.target.value,
              );
              if (!saved) return;
              setResult(saved);
              setActiveAction(saved.request.action);
              setError("");
            }}
          >
            <option value="">Выберите сохранённый результат</option>
            {history.map((row) => (
              <option key={row.id} value={row.id}>
                {
                  (
                    {
                      layout: "Перенос и охват",
                      frontier: "Кривая N",
                      spopt: "spopt",
                      benchmark: "Сравнение методов",
                    } as Record<string, string>
                  )[row.request.action]
                }{" "}
                · {new Date(row.created_at).toLocaleString("ru-RU")}
              </option>
            ))}
          </select>
        </label>
      )}
      {historyLoading && (
        <p className="planning-help" role="status">
          Загружаем сохранённые эксперименты…
        </p>
      )}
      {historyError && (
        <div className="planning-status is-error" role="alert">
          <div>{historyError}</div>
          <button
            className="planning-button"
            onClick={() => setHistoryRevision((value) => value + 1)}
          >
            Повторить загрузку истории
          </button>
        </div>
      )}
      {!historyError && !historyLoading && (
        <NetworkExperimentComparison
          key={`${runId}:${view}`}
          experiments={history}
          disabled={busy}
          onShow={(saved) => {
            onApplyPoints?.(saved.result.points!);
            onEditingChange(true);
          }}
        />
      )}
      {!historyError && !historyLoading && (
        <NetworkSeriesComparison
          key={`frontier:${runId}:${view}`}
          experiments={history}
          action="frontier"
          disabled={busy}
        />
      )}
      {!historyError && !historyLoading && (
        <NetworkSeriesComparison
          key={`benchmark:${runId}:${view}`}
          experiments={history}
          action="benchmark"
          disabled={busy}
        />
      )}
      {job && (
        <div className="planning-status" role="status">
          <div>
            <strong>
              {!statusKnown
                ? "Текущий статус не подтверждён"
                : {
                    queued: "В очереди",
                    running: "Эксперимент выполняется",
                    cancelling: "Отмена",
                    cancelled: "Эксперимент отменён",
                    completed: "Эксперимент завершён",
                    failed: "Ошибка эксперимента",
                  }[job.status]}
            </strong>
            <p>
              {!statusKnown ? "Последний полученный этап: " : ""}
              {job.stage}
              {job.status === "queued" && job.queue_position
                ? ` · место в очереди: ${job.queue_position}`
                : ""}
            </p>
            <p>
              {!statusKnown ? "Последнее полученное время: " : ""}Ожидание в
              очереди:{" "}
              {job.queue_wait_seconds == null
                ? "—"
                : `${job.queue_wait_seconds.toFixed(1)} с`}{" "}
              · Выполнение:{" "}
              {job.execution_seconds == null
                ? "—"
                : `${job.execution_seconds.toFixed(1)} с`}
            </p>
            {job.timing && (
              <details>
                <summary>Время стадий</summary>
                <ul>
                  {job.timing.stages.map((row, index) => (
                    <li key={index}>
                      {row.stage}: {row.seconds.toFixed(3)} с
                    </li>
                  ))}
                  {job.timing.current && (
                    <li>
                      {job.timing.current.stage}:{" "}
                      {job.timing.current.seconds.toFixed(1)} с
                      {job.timing.current.interrupted
                        ? " · прервано"
                        : statusKnown
                          ? " · текущая стадия"
                          : " · последнее измерение"}
                    </li>
                  )}
                </ul>
              </details>
            )}
            {statusKnown &&
              ["queued", "running", "cancelling"].includes(job.status) && (
                <>
                  <progress
                    max={100}
                    value={job.percent}
                    aria-label="Прогресс эксперимента"
                  />{" "}
                  <span>{job.percent}% · этапы расчёта</span>
                </>
              )}
          </div>
          {["queued", "running"].includes(job.status) && (
            <button
              className="planning-button"
              onClick={() => void cancelJob()}
            >
              Отменить эксперимент
            </button>
          )}
          {!statusKnown &&
            ["queued", "running", "cancelling"].includes(job.status) && (
              <button
                className="planning-button"
                onClick={() => setPollRevision((value) => value + 1)}
              >
                Обновить статус
              </button>
            )}
        </div>
      )}
      {busy && !job && statusKnown && (
        <div className="planning-status" role="status">
          {jobId
            ? "Проверяем сохранённое задание…"
            : "Добавляем эксперимент в очередь…"}
        </div>
      )}
      {error && (
        <div className="planning-status is-error" role="alert">
          <div>
            {error}
            {errorDetail && (
              <details>
                <summary>Ответ сервера</summary>
                <p>{errorDetail}</p>
              </details>
            )}
          </div>
          <button
            className="planning-button"
            disabled={busy}
            onClick={() => setQueueRevision((value) => value + 1)}
          >
            Проверить очередь
          </button>
          {jobId && !statusKnown && (
            <button
              className="planning-button"
              onClick={() => setPollRevision((value) => value + 1)}
            >
              Повторить проверку статуса
            </button>
          )}
        </div>
      )}
      {data ? (
        <div className="planning-result">
          <header className="planning-result__heading">
            <div>
              <span className="planning-eyebrow">РЕЗУЛЬТАТ ЭКСПЕРИМЕНТА</span>
              <h4>
                {activeAction === "frontier"
                  ? "Охват при разных размерах сети"
                  : activeAction === "spopt"
                    ? "Сравнение целевых значений"
                    : activeAction === "benchmark"
                      ? "Сравнение методов размещения"
                      : "Охват выбранного размещения"}
              </h4>
            </div>
            
          </header>
          {!data.reference && <p>{data.interpretation}</p>}
          {result?.timing ? (
            <details>
              <summary>Измеренное время стадий эксперимента</summary>
              <p className="planning-help">
                Вычисление в исполнителе:{" "}
                {result.timing.worker_seconds.toFixed(3)} с. Ожидание очереди,
                запуск процесса и публикация результата сюда не входят.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Стадия</th>
                    <th>Время, с</th>
                  </tr>
                </thead>
                <tbody>
                  {result.timing.stages.map(
                    (
                      row: { stage: string; seconds: number },
                      index: number,
                    ) => (
                      <tr key={index}>
                        <td>{row.stage}</td>
                        <td>{row.seconds.toFixed(3)}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </details>
          ) : (
            <p className="planning-help">
              Время стадий для этого эксперимента не сохранялось.
            </p>
          )}

          {data.rows && activeAction === "frontier" && (
            <>
              <svg
                viewBox="0 0 600 160"
                role="img"
                aria-label="Кривая дополнительного охвата населения"
                style={{ width: "100%", maxWidth: 650 }}
              >
                {data.rows.map((row: any, index: number) => {
                  if (row.additional_population == null) return null;
                  const x =
                    30 + (index * 540) / Math.max(1, data.rows.length - 1);
                  const scale = Math.max(
                    1,
                    ...data.rows.map((v: any) => v.additional_population ?? 0),
                  );
                  const y = 130 - (110 * row.additional_population) / scale;
                  const previous = data.rows[index - 1];
                  return (
                    <g key={row.post_count}>
                      {previous?.additional_population != null && (
                        <line
                          stroke="#2563eb"
                          strokeWidth="3"
                          x1={
                            30 +
                            ((index - 1) * 540) /
                              Math.max(1, data.rows.length - 1)
                          }
                          y1={
                            130 - (110 * previous.additional_population) / scale
                          }
                          x2={x}
                          y2={y}
                        />
                      )}
                      <circle cx={x} cy={y} r="4" fill="#2563eb" />
                      <text x={x} y="153" textAnchor="middle">
                        N={row.post_count}
                      </text>
                      <title>{row.additional_population.toFixed(0)} чел.</title>
                    </g>
                  );
                })}
              </svg>
              <table>
                <thead>
                  <tr>
                    <th>N</th>
                    <th>Выбрано</th>
                    <th>Охват, чел.</th>
                    <th>Прирост</th>
                    <th>Доля охвата</th>
                    <th>Целевая функция</th>
                    <th>Статус</th>
                    <th>Разрыв</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r: any) => (
                    <tr key={r.post_count}>
                      <td>{r.post_count}</td>
                      <td>{r.resolved_post_count}</td>
                      <td>{r.additional_population?.toFixed(0) ?? "—"}</td>
                      <td>{r.population_difference?.toFixed(0) ?? "—"}</td>
                      <td>{r.coverage_percent?.toFixed(1) ?? "—"}%</td>
                      <td>{r.objective_value?.toFixed(2) ?? "—"}</td>
                      <td>
                        {r.status}
                        {r.low_population_gain ? " · низкий прирост" : ""}
                      </td>
                      <td>{r.mip_gap ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {data.reference && (
            <>
              <div
                className={`planning-check-summary${data.objectives_match === true && data.both_optimal === true ? " is-confirmed" : ""}`}
                role="status"
              >
                <strong>
                  {data.objectives_match === true
                    ? "Целевые значения совпадают."
                    : data.objectives_match === false
                      ? "Обнаружены различия в целевых значениях."
                      : "Совпадение целевых значений не установлено."}
                </strong>
                <span>
                  {data.both_optimal === true
                    ? "Оптимальность обоих решений подтверждена."
                    : "Оптимальность обоих решений не подтверждена."}
                </span>
                <small>
                  Проверена основная целевая функция на одинаковых данных.
                </small>
              </div>
              <details className="planning-check-details">
                <summary>Подробности проверки</summary>
                <p>{data.interpretation}</p>
                <p>
                  Ядро: {data.native_objective} ({data.native_status}); spopt{" "}
                  {data.reference.spopt_version}:{" "}
                  {data.reference.objective_value} ({data.reference.status}).
                </p>
                <a
                  href="https://doi.org/10.21105/joss.03330"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Методический источник · Feng et al., 2022
                </a>
              </details>
            </>
          )}
          {activeAction === "frontier" && (
            <p className="planning-help">{data.low_gain_rule}</p>
          )}
          {activeAction === "layout" && data.points && (
            <div className="planning-hint">
              Показатели относятся к сохранённым координатам этого эксперимента.{" "}
              <button
                className="planning-button"
                disabled={busy}
                onClick={() => {
                  onApplyPoints?.(data.points);
                  onEditingChange(true);
                }}
              >
                Показать вариант на карте
              </button>
            </div>
          )}
          {activeAction === "benchmark" && (
            <table>
              <thead>
                <tr>
                  <th>Метод</th>
                  <th>Охват, чел.</th>
                  <th>Значение цели</th>
                  <th>Время, с</th>
                  <th>Статус</th>
                  <th>Потеря к оптимуму</th>
                </tr>
              </thead>
              <tbody>
                {data.rows?.map((row: any) => (
                  <tr key={row.method}>
                    <td>
                      {
                        (
                          {
                            primary_milp: "MILP",
                            greedy_maximum_gain: "Жадный прирост",
                            spatial_farthest_first:
                              "Пространственное разнесение",
                          } as Record<string, string>
                        )[row.method]
                      }
                    </td>
                    <td>{row.additional_population?.toFixed(0) ?? "—"}</td>
                    <td>{row.objective_value?.toFixed(2) ?? "—"}</td>
                    <td>{row.duration_seconds}</td>
                    <td>{row.status}</td>
                    <td>
                      {row.loss_to_confirmed_optimum_percent?.toFixed(2) ?? "—"}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data.context_comparison && (
            <section>
              <h4>Контекст в перенесённых точках</h4>
              <p>{data.context_comparison.message}</p>
              {data.context_comparison.status === "ready" && (
                <table>
                  <thead>
                    <tr>
                      <th>Пост</th>
                      <th>Промышленный</th>
                      <th>Транспортный</th>
                      <th>Фон</th>
                      <th>Баллы режима</th>
                      <th>Изменение</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.context_comparison.rows.map((row: any) => (
                      <tr key={row.cell_id}>
                        <td>{row.cell_id}</td>
                        <td>
                          {data.context_comparison.industrial_evidence_available
                            ? row.industrial.toFixed(3)
                            : "Нет данных"}
                        </td>
                        <td>
                          {data.context_comparison.transport_evidence_available
                            ? row.transport.toFixed(3)
                            : "Нет данных"}
                        </td>
                        <td>
                          {data.context_comparison.background_evidence_complete
                            ? row.background.toFixed(3)
                            : "Частичные данные"}
                        </td>
                        <td>{row.site_score.toFixed(3)}</td>
                        <td>
                          {row.site_score_change?.toFixed(3) ?? "—"}
                          {row.industrial_saturated
                            ? " · достигнут предел шкалы"
                            : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="planning-help">
                Баллы — признаки предварительного скрининга, не концентрации и
                не доли загрязнения. Шкала закреплена за исходной сеткой.
              </p>
            </section>
          )}
          {data.site_impacts && (
            <>
              <p>
                Дополнительный охват: {data.additional_population.toFixed(0)}{" "}
                чел.; изменение: {data.population_change.toFixed(0)};
                многократный охват:{" "}
                {data.multiple_coverage_population.toFixed(0)} чел.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Пост</th>
                    <th>Уникальный охват, чел.</th>
                    <th>Население у ближайшего поста</th>
                  </tr>
                </thead>
                <tbody>
                  {data.site_impacts.map((r: any) => (
                    <tr key={r.cell_id}>
                      <td>{r.cell_id}</td>
                      <td>{r.exclusive_population.toFixed(0)}</td>
                      <td>
                        {data.nearest_site_population[r.cell_id]?.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                Перекрытие пар (взвешенный Jaccard):{" "}
                {data.pairwise_overlap
                  .map(
                    (r: any) =>
                      `${r.first} / ${r.second}: ${r.population_jaccard?.toFixed(2) ?? "—"}`,
                  )
                  .join("; ") || "один пост"}
                .{" "}
                <a href="https://ladco.github.io/NetAssessApp/about.html">
                  NetAssess
                </a>
              </p>
            </>
          )}
        </div>
      ) : (
        !busy &&
        !error && (
          <div className="planning-empty">
            Выберите проверку выше — её результат появится здесь.
          </div>
        )
      )}
    </section>
  );
}
