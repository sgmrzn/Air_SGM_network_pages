import type {
  MeteoDatasetVersion,
  MeteoMonthCoverage,
  MeteoWindRoseResult,
  PlaceSearchResult,
  WindJob,
  WindJobCreate,
  WindJobEvent,
  WindRoseResult,
  WindSeason,
} from "./windTypes";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(payload?.detail ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const windApi = {
  jobs: () => request<WindJob[]>("/api/wind/jobs"),
  job: (id: number) => request<WindJob>(`/api/wind/jobs/${id}`),
  events: (id: number) =>
    request<WindJobEvent[]>(`/api/wind/jobs/${id}/events`),
  meteoDatasets: () => request<MeteoDatasetVersion[]>("/api/meteo/datasets"),
  meteoCoverage: (year: number) =>
    request<MeteoMonthCoverage[]>(`/api/meteo/coverage?year=${year}`),
  createJob: (payload: WindJobCreate) =>
    request<WindJob>("/api/wind/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  createJobBatch: (years: number[], source: WindJobCreate["source"] = "gee") =>
    request<WindJob[]>("/api/wind/jobs/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, years, sector_count: 36 }),
    }),
  cancelJob: (id: number) =>
    request<WindJob>(`/api/wind/jobs/${id}/cancel`, {
      method: "POST",
    }),
  rose: (season: WindSeason, jobId?: number | null) => {
    const query = new URLSearchParams({ season });
    if (jobId != null) query.set("job_id", String(jobId));
    return request<WindRoseResult>(`/api/wind/rose?${query.toString()}`);
  },
  places: (query: string) =>
    request<PlaceSearchResult[]>(`/api/places?q=${encodeURIComponent(query)}`),
  meteoWindRose: (
    longitude: number,
    latitude: number,
    season: WindSeason,
    sectorCount: 8 | 16 | 36,
    datasetVersionId?: string | null,
  ) => {
    const query = new URLSearchParams({
      longitude: String(longitude),
      latitude: String(latitude),
      season: season === "all" ? "annual" : season,
      sector_count: String(sectorCount),
    });
    if (datasetVersionId) query.set("dataset_version_id", datasetVersionId);
    return request<MeteoWindRoseResult>(
      `/api/meteo/wind-rose?${query.toString()}`,
    );
  },
  meteoWindRoseSeasons: (
    longitude: number,
    latitude: number,
    sectorCount: 8 | 16 | 36,
    datasetVersionId?: string | null,
  ) => {
    const query = new URLSearchParams({
      longitude: String(longitude),
      latitude: String(latitude),
      sector_count: String(sectorCount),
    });
    if (datasetVersionId) query.set("dataset_version_id", datasetVersionId);
    return request<{ seasons: Record<string, MeteoWindRoseResult | null> }>(
      `/api/meteo/wind-rose/seasons?${query.toString()}`,
    );
  },
};
