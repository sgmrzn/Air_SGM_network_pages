import type { NetworkDesignRun } from "../types";

export function networkRunHash(runId: string): string {
  return `#network?run=${encodeURIComponent(runId)}`;
}

export function networkRunIdFromHash(hash: string): string | null {
  const [page, query = ""] = hash.replace(/^#/, "").split("?");
  if (page !== "network") return null;
  const value = new URLSearchParams(query).get("run");
  return value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : null;
}

export type NetworkArchiveTab = "result" | "report" | "research";

export function networkArchiveHash(
  runId: string,
  tab: NetworkArchiveTab = "result",
): string {
  return `#networkReports?run=${encodeURIComponent(runId)}&tab=${tab}`;
}

export function networkArchiveFromHash(
  hash: string,
): { runId: string; tab: NetworkArchiveTab } | null {
  const [page, query = ""] = hash.replace(/^#/, "").split("?");
  if (page !== "networkReports") return null;
  const runId = networkRunIdFromHash(`#network?${query}`);
  if (!runId) return null;
  const tab = new URLSearchParams(query).get("tab");
  return {
    runId,
    tab: tab === "report" || tab === "research" ? tab : "result",
  };
}

function pause(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, 800);
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** Resume an existing job with GET requests only, including after leaving the page. */
export async function loadNetworkRun(
  runId: string,
  fetchRun: (id: string, signal?: AbortSignal) => Promise<NetworkDesignRun>,
  signal: AbortSignal,
  onProgress: (run: NetworkDesignRun) => void,
): Promise<NetworkDesignRun> {
  let run = await fetchRun(runId, signal);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  onProgress(run);
  while (run.status === "queued" || run.status === "running") {
    await pause(signal);
    run = await fetchRun(runId, signal);
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    onProgress(run);
  }
  if (run.status !== "completed" || !run.ensemble) {
    throw new Error(
      (run as NetworkDesignRun & { error?: string }).error ||
        run.progress_stage ||
        "Завершённый результат отсутствует",
    );
  }
  return run;
}
