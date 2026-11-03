export type WindSeason = "all" | "winter" | "spring" | "summer" | "autumn";
export type WindSource = "demo" | "gee";

export interface WindJob {
  id: number;
  source: WindSource;
  dataset: string;
  location_name: string;
  latitude: number;
  longitude: number;
  job_scope: "russia" | "point";
  period_mode: "year" | "custom";
  requested_year: number | null;
  date_from: string;
  date_to: string;
  sector_count: 8 | 16 | 36;
  calm_threshold: number;
  status: "queued" | "running" | "completed" | "failed";
  progress_percent: number;
  observations_count: number;
  current_period: string | null;
  error_message: string | null;
  log_file_path: string | null;
  is_demo: boolean;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface WindJobCreate {
  source: WindSource;
  period_mode: "year" | "custom";
  year?: number;
  date_from?: string;
  date_to?: string;
  sector_count: 36;
}

export interface WindJobEvent {
  id: number;
  job_id: number;
  level: "info" | "warning" | "error";
  message: string;
  created_at: string;
}

export interface MeteoDatasetVersion {
  id: string;
  dataset: string;
  period_start: string;
  period_end: string;
  processing_version: string;
  calm_threshold_mps: number;
  status: "completed";
  created_at: string;
  completed_at: string | null;
  cells_count: number;
}

export interface MeteoMonthCoverage {
  month: string;
  expected_cells: number;
  loaded_cells: number;
  status:
    "not_loaded" | "pending" | "running" | "partial" | "completed" | "failed";
  error_message: string | null;
  completed_at: string | null;
  dataset_version_id: string | null;
  processing_version: string | null;
}

export interface WindSpeedBinResult {
  key: string;
  label: string;
  min_speed: number;
  max_speed: number | null;
  count: number;
  frequency: number;
}

export interface WindDirectionResult {
  index: number;
  label: string;
  degrees: number;
  total_frequency: number;
  bins: WindSpeedBinResult[];
}

export interface WindRoseResult {
  job: WindJob;
  season: WindSeason;
  summary: {
    observations_count: number;
    calm_count: number;
    calm_percent: number;
    mean_speed: number | null;
    max_speed: number | null;
    prevailing_direction: string | null;
    prevailing_degrees: number | null;
    prevailing_frequency: number | null;
  };
  directions: WindDirectionResult[];
}

export interface PlaceSearchResult {
  id: string;
  name: string;
  settlement_type: string | null;
  region_name: string | null;
  longitude: number;
  latitude: number;
  population: number | null;
}

export interface MeteoWindRoseResult {
  grid_cell: {
    grid_cell_id: string;
    source_cell_key: string;
    min_lon: number;
    min_lat: number;
    max_lon: number;
    max_lat: number;
    centroid_lon: number;
    centroid_lat: number;
  };
  dataset: {
    dataset_version_id: string;
    dataset: string;
    period_start: string;
    period_end: string;
    calm_threshold_mps: number;
  };
  summary: WindRoseResult["summary"];
  directions: WindDirectionResult[];
}
