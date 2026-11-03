/** Pilot territory that both analytical screens open on.
 *
 * Kept in one place so the two screens cannot drift apart: the coverage screen
 * matches suggestions by `label`, the design screen by `name`, and both need
 * the same OSM identifier.
 */
export const DEFAULT_TERRITORY = {
  id: "osm-area-1782722",
  name: "Рязань",
  label: "Рязань, Рязанская область",
  kind: "settlement" as const,
  /** Grid step the design screen uses for a settlement, per changeKind(). */
  gridKm: 1,
};
