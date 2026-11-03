import type { NetworkDesignRun, NetworkSourceWindContext } from "../types";

/** A territory rose belongs to the scenario, never to the currently selected zone. */
export function networkTerritoryWind(
  run: NetworkDesignRun,
  view: string,
): NetworkSourceWindContext["wind_rose"] {
  const result =
    view === "ensemble"
      ? run.ensemble
      : run.scenario_results.find((item) => item.scenario_id === view)?.result;
  if (!result) return null;
  if (result.territory_wind_rose?.directions?.length)
    return result.territory_wind_rose;
  const profile = view === "ensemble" ? run.request.meteo_profile : view;
  // Older saved runs may embed the same territory rose in their zone contexts.
  // A legacy point-specific rose must not be relabelled as territory statistics.
  for (const candidate of result.scenarios) {
    const context =
      candidate.source_wind_context_by_profile?.[profile] ??
      candidate.source_wind_context;
    if (
      context?.wind_statistics_scope === "territory" &&
      context.era5_profile === profile &&
      context.wind_rose?.directions?.length
    )
      return context.wind_rose;
  }
  return null;
}
