import { demoReportUrl } from "./demo/api";
import type {
  NetworkCoverage,
  NetworkDesignReadiness,
  NetworkDesignRun,
  NetworkDesignRunRequest,
  NetworkStationWindRose,
  NetworkTerritory,
} from "./types";
import { request } from "./shared/http";

export interface PlaceOption {
  id: string;
  name: string;
  settlement_type: string | null;
  region_name: string | null;
  longitude: number;
  latitude: number;
  population?: number | null;
}

export interface MonitoringStationOption {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  address?: string | null;
  station_type?: string;
}

export function fetchMonitoringStations(): Promise<MonitoringStationOption[]> {
  return request("/api/spatial/monitoring-stations");
}

export function fetchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<PlaceOption[]> {
  const params = new URLSearchParams({ q: query, limit: "12" });
  return request(`/api/places?${params.toString()}`, { signal });
}

export function fetchNetworkCoverage(
  radiusM: number,
  territoryKind: string,
  territoryId: string | null,
  includePopulation = false,
  gridKm = 5,
  populationMethod: "radius" | "dynamic" | "terrain" = "radius",
  radiusMode: "normative" | "custom" = "normative",
  stationFilters?: { operator?: string; stationType?: string },
  meteoSeason = "annual",
  meteoYear?: number | null,
  sectorCount: 8 | 16 | 36 = 16,
  populationSource: "worldpop" | "rosstat" = "worldpop",
  rosstatYear = 2025,
  signal?: AbortSignal,
): Promise<NetworkCoverage> {
  const query = new URLSearchParams({
    region: "Рязанская область",
    territory_kind: territoryKind,
    radius_m: String(radiusM),
    grid_km: String(gridKm),
    include_population: String(includePopulation),
    population_method: populationMethod,
    radius_mode: radiusMode,
    population_source: populationSource,
    rosstat_year: String(rosstatYear),
  });
  if (territoryId) query.set("territory_id", territoryId);
  if (stationFilters?.operator) query.set("operator", stationFilters.operator);
  if (stationFilters?.stationType)
    query.set("station_type", stationFilters.stationType);
  if (populationMethod !== "radius") query.set("meteo_season", meteoSeason);
  if (populationMethod !== "radius" && meteoYear != null)
    query.set("meteo_year", String(meteoYear));
  if (populationMethod !== "radius")
    query.set("sector_count", String(sectorCount));
  return request(`/api/spatial/network-coverage?${query.toString()}`, {
    signal,
  });
}

export function fetchNetworkStationWindRose(
  stationId: string,
  meteoSeason: string,
  meteoYear?: number | null,
  sectorCount: 8 | 16 | 36 = 16,
  signal?: AbortSignal,
): Promise<NetworkStationWindRose> {
  const query = new URLSearchParams({
    station_id: stationId,
    meteo_season: meteoSeason,
  });
  if (meteoYear != null) query.set("meteo_year", String(meteoYear));
  query.set("sector_count", String(sectorCount));
  return request(`/api/spatial/network-station-wind-rose?${query.toString()}`, {
    signal,
  });
}

export function fetchNetworkPopulationStatus(cacheKey: string): Promise<
  NetworkCoverage["coverage"]["population"] & {
    cache_key: string;
    cached?: boolean;
    updated_at?: string;
  }
> {
  return request(
    `/api/spatial/network-population-status?cache_key=${encodeURIComponent(cacheKey)}`,
  );
}

export function fetchNetworkTerritories(
  kind: string,
  search: string,
): Promise<NetworkTerritory[]> {
  const query = new URLSearchParams({
    territory_kind: kind,
    search,
    limit: "30",
  });
  return request(`/api/spatial/network-territories?${query.toString()}`);
}

export function fetchNetworkDesignReadiness(
  territoryId: string,
  signal?: AbortSignal,
): Promise<NetworkDesignReadiness> {
  return request(
    `/api/spatial/network-design/readiness?territory_id=${encodeURIComponent(territoryId)}`,
    { signal },
  );
}

export function createNetworkDesignRun(
  payload: NetworkDesignRunRequest,
): Promise<NetworkDesignRun> {
  return request("/api/spatial/network-design/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function createAsyncNetworkDesignRun(
  payload: NetworkDesignRunRequest,
): Promise<NetworkDesignRun> {
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
  return request<NetworkDesignRun>(
    "/api/spatial/network-design/runs/async",
    options,
  ).catch((reason: unknown) => {
    if (
      reason instanceof Error &&
      reason.message.includes("Method Not Allowed")
    ) {
      // Compatibility with an API process that has not yet been restarted
      // after deployment of the observable background-run endpoint.
      return request<NetworkDesignRun>(
        "/api/spatial/network-design/runs",
        options,
      );
    }
    throw reason;
  });
}

export function fetchNetworkDesignRun(
  runId: string,
): Promise<NetworkDesignRun> {
  return request(
    `/api/spatial/network-design/runs/${encodeURIComponent(runId)}`,
  );
}

export interface NetworkDesignReportItem {
  demo_analysis?: string;
  demo_file?: string;
  demo_preset_key?: string;
  demo_placement?: string;
  demo_meteo?: string;
  generated_report?: boolean;
  demo_mode?: string;
  demo_count?: number;
  demo_note?: string;
  id: string;
  run_id: string;
  created_at: string;
  territory?: string | null;
  methodology_version?: string | null;
  input_fingerprint?: string | null;
  recommended_positions?: number | null;
  scenario_count?: number | null;
  size_bytes: number;
  view_url?: string;
  download_url?: string;
}

const localNetworkReportUrls = new Map<string,string>();
export async function saveNetworkDesignReport(runId:string,html:string):Promise<NetworkDesignReportItem> {
 const previous=localNetworkReportUrls.get(runId);if(previous)URL.revokeObjectURL(previous);
 const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));localNetworkReportUrls.set(runId,url);
 return {id:runId,run_id:runId,created_at:new Date().toISOString(),size_bytes:new Blob([html]).size,view_url:url};
}

export function fetchNetworkDesignReports(parameters?: {gridKm:number;radiusM:number;useExclusionMasks:boolean;networkSizeMode:string}): Promise<
  NetworkDesignReportItem[]
> {
  const query=parameters ? '?' + new URLSearchParams({grid_km:String(parameters.gridKm),radius_m:String(parameters.radiusM),use_exclusion_masks:String(parameters.useExclusionMasks),network_size_mode:parameters.networkSizeMode}) : '';
  return request("/api/spatial/network-design/reports"+query);
}

export function deleteNetworkDesignReport(
  reportId: string,
): Promise<{ id: string; deleted: boolean }> {
  return request(
    `/api/spatial/network-design/reports/${encodeURIComponent(reportId)}`,
    {
      method: "DELETE",
    },
  );
}

export function networkDesignReportUrl(reportId:string,download=false):string {
 void download; return localNetworkReportUrls.get(reportId) || demoReportUrl(reportId);
}

export function saveNetworkOfficialPopulation(territoryId: string, payload: {
  population: number; as_of: string; source_name: string; source_url: string; confirmed: boolean;
}): Promise<NetworkDesignReadiness> {
  return request(`/api/spatial/network-design/official-population?territory_id=${encodeURIComponent(territoryId)}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
}

