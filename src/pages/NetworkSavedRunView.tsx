import { useEffect, useRef, useState } from "react";
import {
  fetchNetworkDesignRun,
  networkDesignReportUrl,
  saveNetworkDesignReport,
  type NetworkDesignReportItem,
} from "../api";
import type { NetworkDesignRun } from "../types";
import {
  loadNetworkRun,
  type NetworkArchiveTab,
} from "../shared/networkRunNavigation";
import { NetworkDesignResultView } from "../components/NetworkDesignResultView";
import "./NetworkReports.css";

export function NetworkSavedRunView({
  runId,
  tab,
  reports,
  reportsLoading,
  reportListError,
  onTabChange,
  onBack,
  onOpenRun,
  onReportSaved,
}: {
  runId: string;
  tab: NetworkArchiveTab;
  reports: NetworkDesignReportItem[];
  reportsLoading: boolean;
  reportListError: boolean;
  onTabChange: (tab: NetworkArchiveTab) => void;
  onBack: () => void;
  onOpenRun: (id: string) => void;
  onReportSaved: (report: NetworkDesignReportItem) => void;
}) {
  const [run, setRun] = useState<NetworkDesignRun | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("Загрузка сохранённого расчёта…");
  const [revision, setRevision] = useState(0);
  const [resultViewId, setResultViewId] = useState("ensemble");
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [newReport, setNewReport] = useState<NetworkDesignReportItem | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [reportError, setReportError] = useState("");
  const selectedRun = useRef(runId);
  selectedRun.current = runId;
  const report =
    (newReport?.run_id === runId ? newReport : null) ??
    reports.find((item) => item.run_id === runId);
  useEffect(() => {
    const controller = new AbortController();
    setRun(null);
    setError("");
    setResultViewId("ensemble");
    setCandidateId(null);
    setNewReport(null);
    setReportError("");
    void loadNetworkRun(
      runId,
      fetchNetworkDesignRun,
      controller.signal,
      (value) =>
        setProgress(
          value.status === "running" || value.status === "queued"
            ? `${value.progress_percent}% · ${value.progress_stage}`
            : "Загрузка результата…",
        ),
    )
      .then((value) => {
        if (!controller.signal.aborted) setRun(value);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Не удалось открыть расчёт",
          );
      });
    return () => controller.abort();
  }, [runId, revision]);
  const generateReport = async () => {
    if (!run || saving) return;
    const id = run.id;
    setSaving(true);
    setReportError("");
    try {
      const { networkScreeningReportHtml } =
        await import("./NetworkDesignPage");
      const value = await saveNetworkDesignReport(
        id,
        networkScreeningReportHtml(run),
      );
      if (selectedRun.current === id) {
        setNewReport(value);
        onReportSaved(value);
      }
    } catch (reason) {
      if (selectedRun.current === id)
        setReportError(
          reason instanceof Error
            ? reason.message
            : "Не удалось сохранить отчёт",
        );
    } finally {
      if (selectedRun.current === id) setSaving(false);
    }
  };
  const preparedForRun=useRef<string|null>(null);
  useEffect(()=>{if(run&&tab==='report'&&preparedForRun.current!==run.id){preparedForRun.current=run.id;void generateReport();}},[run,tab]);
  const activeResult =
    run &&
    (resultViewId === "ensemble"
      ? run.ensemble
      : (run.scenario_results.find((item) => item.scenario_id === resultViewId)
          ?.result ?? run.ensemble));
  return (
    <div className="module-page network-design-page network-wizard network-archive">
      <div className="network-archive__toolbar">
        <header className="network-archive__navigation">
          <button
            type="button"
            className="button button--ghost"
            onClick={onBack}
          >
            ← Все расчёты
          </button>
          <span>Сохранённый запуск · {runId.slice(0, 8)}</span>
        </header>
        <div
          className="network-archive__tabs"
          role="group"
          aria-label="Разделы сохранённого расчёта"
        >
          {(
            [
              ["result", "Результат"],
              ["report", "Отчёт"],
              ["research", "Научная проверка"],
            ] as const
          ).map(([id, title]) => (
            <button
              type="button"
              key={id}
              aria-pressed={tab === id}
              onClick={() => onTabChange(id)}
            >
              {title}
            </button>
          ))}
        </div>
      </div>
      {error && tab !== "report" ? (
        <div className="network-archive__empty" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setRevision((value) => value + 1)}
          >
            Повторить загрузку
          </button>
        </div>
      ) : !run && tab !== "report" ? (
        <p className="network-archive__empty" role="status">
          {progress}
        </p>
      ) : (
        <>
          <section
            className="network-archive__report"
            hidden={tab !== "report"}
            aria-label="Отчёт сохранённого расчёта"
          >
            <header>
              <div>
                <h2>
                  Отчёт ·{" "}
                  {run?.readiness.territory.name ??
                    report?.territory ??
                    "Сохранённый запуск"}
                </h2>
                <p>Документ относится к этому сохранённому запуску.</p>
              </div>
              {report && (
                <a
                  className="button button--primary"
                  href={networkDesignReportUrl(report.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть в отдельном окне
                </a>
              )}
            </header>
            {reportsLoading && !report ? (
              <p role="status">Загрузка отчёта…</p>
            ) : report ? (
              <>
                
                {tab === "report" && (
                  <iframe
                    title="Отчёт проектирования сети"
                    src={networkDesignReportUrl(report.id)}
                  />
                )}
              </>
            ) : (
              <div className="network-archive__empty">
                <p>
                  {!run
                    ? error || "Загрузка сохранённого запуска…"
                    : reportListError
                      ? "Список отчётов сейчас недоступен. Можно сформировать документ из сохранённого запуска."
                      : "HTML-отчёт ещё не сформирован. Результат расчёта и научные проверки доступны в соседних вкладках."}
                </p>
                <button
                  type="button"
                  className="button button--primary"
                  disabled={saving || !run}
                  onClick={() => void generateReport()}
                >
                  {saving ? "Формируем отчёт…" : "Сформировать отчёт"}
                </button>
              </div>
            )}
            {reportError && (
              <p className="form-error" role="alert">
                {reportError}
              </p>
            )}
          </section>
          <section
            className="module-card network-wizard__shell is-result"
            hidden={tab === "report"}
          >
            <div className="network-wizard__content">
              {run && activeResult && (
                <NetworkDesignResultView
                  run={run}
                  activeResult={activeResult}
                  resultViewId={resultViewId}
                  selectedCandidateId={candidateId}
                  reportSaving={false}
                  reportSaved={!!report}
                  reportError={null}
                  resultStale={false}
                  runError={null}
                  onResultViewChange={setResultViewId}
                  onSelectCandidate={setCandidateId}
                  onEdit={() => onOpenRun(run.id)}
                  onDownloadReport={() => onTabChange("report")}
                  archiveView={tab === "research" ? "research" : "result"}
                />
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
