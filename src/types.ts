export type Position = [number, number];

export interface WindRoseData {
  prevailing_direction?: string | null;
  prevailing_degrees?: number | null;
  prevailing_frequency_percent?: number | null;
  directions: Array<{
    index: number;
    label: string;
    degrees: number;
    total_frequency: number;
    bins: Array<{
      key: string;
      label: string;
      min_speed: number;
      max_speed: number | null;
      count: number;
      frequency: number;
    }>;
  }>;
}

export interface CellProperties {
  cell_id: string;
  cell_index: number;
  feature_name: string;
  feature_value: number | null;
  unit: string;
  period_start: string;
  period_end: string;
  source: string;
  dataset: string;
  processing_version: string;
  quality: string;
  is_demo: boolean;
  /** Present on the per-post geometries used by the population coverage map. */
  station_id?: string;
  station_name?: string;
  station_type?: string;
  station_operator?: string;
  station_population?: number;
  radius_km?: number;
  major_axis_km?: number;
  minor_axis_km?: number;
  area_km2?: number;
  reference_radius_km?: number;
  reference_area_km2?: number;
  area_vs_reference_percent?: number;
  downwind_degrees?: number;
  shape_model?: string;
  sector_radii?: Array<{
    bearing: number;
    radius_km: number;
    frequency_percent?: number;
    mean_speed_mps?: number;
    relief_factor?: number;
  }>;
  factors?: string[];
  meteo?: {
    season_label?: string;
    wind_speed_mean_mps?: number;
    calm_frequency_percent?: number;
    boundary_layer_height_mean_m?: number;
    relief_profiles?: Array<{
      bearing: number;
      factor: number;
      origin_elevation_m: number;
      rise_m: number;
      descent_m: number;
      range_m: number;
    }>;
    relief_dataset?: {
      dataset_name?: string;
      resolution_m?: number;
      requested_resolution_m?: number;
      sha256?: string;
    };
    wind_rose?: WindRoseData;
  };
  /** Optional functional screening attached by network-design v4+. */
  role_assessment?: NetworkRoleAssessment;
}

export interface CellFeature {
  type: "Feature";
  id: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | GeoJSON.GeometryCollection;
  properties: CellProperties;
}

export interface CollectionMetadata {
  region_id: string;
  feature_name: string;
  label: string;
  description: string;
  unit: string;
  count: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  is_demo: boolean;
}

export interface CellCollection {
  type: "FeatureCollection";
  features: CellFeature[];
  metadata: CollectionMetadata;
}

export interface FeatureOption {
  feature_name: string;
  label: string;
  description: string;
  unit: string;
  period_start: string;
  period_end: string;
  cell_count: number;
  is_demo: boolean;
}

export interface CellDetail {
  cell: {
    id: string;
    grid_version: string;
    centroid_lon: number;
    centroid_lat: number;
    is_demo: boolean;
  };
  features: Array<{
    feature_name: string;
    value: number | null;
    unit: string;
    period_start: string;
    period_end: string;
    source: string;
    dataset: string;
    processing_version: string;
    quality: Record<string, unknown>;
    is_demo: boolean;
  }>;
}

export interface HistogramBin {
  start: number;
  end: number;
  count: number;
}

export interface NetworkCoverage {
  methodology: {
    kind: string;
    radius_m: number;
    grid_km: number;
    status: string;
    notice: string;
  };
  territory: {
    id: string;
    name: string;
    kind: "region" | "municipality" | "settlement";
    bounds: {
      min_lon: number;
      min_lat: number;
      max_lon: number;
      max_lat: number;
    };
  };
  boundary_layers?: {
    selected: CellCollection;
    municipalities: CellCollection;
    settlements: CellCollection;
    settlements_visibility: "local" | "shown";
  };
  filters: {
    operators: string[];
    station_types: string[];
    selected: { operator?: string; station_type?: string };
  };
  meteo?: {
    available_years: number[];
    selected_year?: number | null;
    season: string;
    sector_count?: 8 | 16 | 36 | null;
    terrain_mode?: "off" | "sensitivity" | null;
  };
  stations: {
    active_count: number;
    excluded: Array<{ id: string; name: string; reason: string }>;
    by_type: Record<string, number>;
    by_pollutant: Record<string, number>;
    items: Array<{
      id: string;
      name: string;
      operator: string;
      station_type: string;
      verification_status: string;
      pollutants: string[];
      longitude: number;
      latitude: number;
    }>;
  };
  coverage: {
    cells_total: number;
    cells_covered: number;
    cells_uncovered: number;
    cells_covered_percent: number;
    population: {
      status: string;
      total_population?: number;
      covered_population?: number;
      uncovered_population?: number;
      by_station_population?: Record<string, number>;
      full_zone_population?: number;
      outside_territory_population?: number;
      by_station_full_population?: Record<string, number>;
      by_station_municipality_population?: Record<
        string,
        Record<string, number>
      >;
      /** Additive technical allocation by nearest station centre; it does not
       * describe representativeness, concentrations, or physical influence. */
      by_station_exclusive_population?: Record<string, number>;
      exclusive_assignment_methodology?: {
        label: string;
        purpose: string;
        distance_rule: string;
        tie_break_rule: string;
      };
      source?: "worldpop" | "rosstat_density";
      reference_year?: number | null;
      density_per_km2?: number;
      source_population?: number;
      source_area_km2?: number;
      density_status?: "published" | "calculated";
      message?: string;
      methodology?: {
        id: "radius" | "dynamic" | "terrain";
        label: string;
        rule: string;
        shape_model?: string;
        terrain_mode?: "off" | "sensitivity";
        terrain_note?: string | null;
        factors_used?: string[];
        factors_missing?: string[];
      };
      zones_geojson?: CellCollection;
      /** Merged outline of all post zones, used for the map fill. */
      union_geojson?: CellCollection;
    };
  };
  geojson: CellCollection;
}

export interface NetworkTerritory {
  id: string;
  name: string;
  label?: string;
  kind: "region" | "municipality" | "settlement";
  settlement_type?: string | null;
}

export interface NetworkStationWindRose {
  station_id: string;
  station_name: string;
  season: string;
  year: number;
  sector_count: 8 | 16 | 36;
  wind_rose: WindRoseData;
}

export type NetworkDesignAnalysisProfile =
  "coverage_backbone" | "extended_diagnostics";

export type NetworkPlacementMode =
  | "population_coverage"
  | "industrial_influence"
  | "transport_influence"
  | "urban_background"
  | "integrated_screening";

export type NetworkMeteoProfile =
  | "annual"
  | "cold_period"
  | "warm_period"
  | "weak_wind"
  | "calm_accumulation"
  | "accumulation_risk";

export interface NetworkPlacementEvidence {
  hazard_status?: string;
  hazard_weight?: number | null;
  component_weights_basis?: string;
  mr_algorithm_status?: string;
  mode: NetworkPlacementMode;
  label: string;
  objective_kind: string;
  formula: string;
  evidence: string;
  evidence_cells: number;
  population_floor: number;
  component_weights?: Record<string, number>;
  uses_dispersion_model: false;
  uses_ground_concentrations: false;
  interpretation: string;
  meteo?: Record<string, unknown>;
  industrial?: Record<string, unknown>;
  transport?: Record<string, unknown>;
}

export type NetworkFunctionalRoleId =
  "urban_background" | "transport_context" | "industrial_context";

export type NetworkRoleEvidenceQuality = "derived" | "proxy" | "missing";

export interface NetworkRoleEvidence {
  indicator: string;
  value: number | string | null;
  quality: NetworkRoleEvidenceQuality;
}

export interface NetworkRoleResult {
  status: "candidate" | "supporting_context" | "low_evidence" | "unavailable";
  readiness: "screening_ready" | "proxy_only" | "insufficient_data";
  score: number | null;
  evidence: NetworkRoleEvidence[];
  limitations: string[];
  normative_status: "preliminary_screening_only" | "not_assessed";
}

/**
 * A classification of an already selected candidate zone. Role scores are
 * screening indicators and never weights of causal pollutant influence.
 */
export interface NetworkRoleAssessment {
  version: "functional-role-screening-v1" | string;
  suggested_role: NetworkFunctionalRoleId | null;
  /**
   * Roles that independently passed their own screening thresholds. There may
   * be more than one: their scores are not comparable and must not be used to
   * force a single preferred role.
   */
  candidate_roles?: NetworkFunctionalRoleId[];
  roles: Partial<Record<NetworkFunctionalRoleId, NetworkRoleResult>>;
  limitations: string[];
  normative_status: {
    status: "preliminary_candidate_zone" | string;
    statement: string;
  };
}

export interface NetworkRoleAssessmentSummary {
  version: "functional-role-screening-v1" | string;
  scope: string;
  classification_only: true;
  by_role: Partial<
    Record<
      NetworkFunctionalRoleId,
      {
        candidate_count: number;
        supporting_count: number;
        unavailable_count: number;
      }
    >
  >;
  limitations: string[];
}

export interface NetworkPlanningScope {
  kind?: "settlement_backbone" | "settlement_with_context" | string;
  analysis_profile?: NetworkDesignAnalysisProfile;
  statement?: string;
  included?: string[];
  excluded?: string[];
  [key: string]: unknown;
}

export interface NetworkDesignNormativeStatus {
  status?:
    "numeric_minimum_met" | "numeric_minimum_not_met" | "not_assessed" | string;
  numerical_minimum_only?: boolean;
  spatial_suitability_status?:
    "preliminary_screening_only" | "not_assessed" | string;
  statement?: string;
  [key: string]: unknown;
}

export interface NetworkCandidateScreening {
  admissible_total: number;
  screened_count: number;
  reduced: boolean;
  optimality_scope: "full_admissible_pool" | "screened_candidate_pool";
  screening_method: string;
  residential_intersection_method?: string;
  residential_intersection_exact?: boolean;
}

export interface NetworkFeasibility {
  status:
    | "data_insufficient"
    | "infeasible"
    | "not_solved"
    | "requires_review"
    | "ready_for_inspection";
  reason: string;
  message: string;
  available_candidates: number;
  requested_positions: number;
  selected_positions: number;
  selected_requiring_review: number;
  suggested_grid_km: number[];
  field_inspection_required: boolean;
  review_zones?: Array<{
    zone_code: string;
    constraints: Array<{ id?: string; name?: string; status: string }>;
  }>;
}

export type NetworkSourceContextStatus =
  | "supporting_context"
  | "weak_context"
  | "outside_primary_sector"
  | "insufficient_meteo_data"
  | "dataset_unavailable";

export interface NetworkSourceContextItem {
  source_id: string;
  name: string;
  type: string;
  registry: string;
  registry_version: string | null;
  longitude: number;
  latitude: number;
  distance_km: number;
  bearing_receptor_to_source: number;
  bearing_source_to_receptor: number;
  direction: string;
  upwind_frequency_percent: number | null;
  mean_wind_speed_when_upwind_mps: number | null;
  status: NetworkSourceContextStatus;
  interpretation: string | null;
}

export interface NetworkSourceWindContext {
  status: "ready" | "insufficient_meteo_data";
  scope: "meteorological_gis_screening";
  era5_profile: NetworkMeteoProfile;
  wind_statistics_scope?: "territory";
  period: Record<string, unknown>;
  requested_period: Record<string, unknown>;
  wind_from_convention: string;
  transport_to_rule: string;
  wind_sector_tolerance_deg: number;
  source_context_radius_km: number;
  valid_observation_count: number | null;
  calm_fraction: number | null;
  prevailing_wind_from_degrees: number | null;
  prevailing_wind_from: string | null;
  transport_to_degrees: number | null;
  wind_rose: {
    dataset?: Record<string, unknown>;
    requested_period?: Record<string, unknown>;
    summary?: {
      observations_count?: number;
      calm_count?: number;
      calm_percent?: number;
      mean_speed?: number | null;
      max_speed?: number | null;
      prevailing_direction?: string | null;
      prevailing_degrees?: number | null;
      prevailing_frequency?: number | null;
      leading_directions?: {
        label: string;
        degrees: number;
        total_frequency: number;
      }[];
    };
    territory_aggregation?: {
      scope: "territory";
      method: string;
      grid_resolution_degrees: number;
      spatial_coverage_percent: number;
      cells: {
        grid_cell: Record<string, unknown>;
        weight: number;
        intersection_geometry: GeoJSON.Geometry;
        wind_rose: {
          summary: { mean_speed?: number; prevailing_direction?: string };
          directions: WindRoseData["directions"];
        };
      }[];
    };
    directions: WindRoseData["directions"];
  } | null;
  source_dataset_status:
    "ready" | "no_objects_in_radius" | "dataset_unavailable";
  source_registry_match_count: number;
  source_count: number;
  shown_source_count: number;
  sources: NetworkSourceContextItem[];
  optional_datasets: Record<
    string,
    {
      status: "ready" | "no_objects_in_radius" | "dataset_unavailable";
      label: string;
    }
  >;
  disclaimer: string;
  upwind_sector_geojson: GeoJSON.FeatureCollection;
  flow_arrows_geojson: GeoJSON.FeatureCollection;
  source_relationships_geojson: GeoJSON.FeatureCollection;
}

export interface NetworkCoverageSummary {
  population_total: number;
  baseline_covered_population: number;
  additional_covered_population: number;
  total_covered_population: number;
  remaining_uncovered_population: number;
  additional_covered_cells: number;
  total_cells: number;
  baseline_covered_cells: number;
  remaining_uncovered_cells: number;
  calculation: "single_count_network_union" | string;
}

export interface NetworkDesign {
  territory_wind_rose?: NetworkSourceWindContext["wind_rose"];
  district_coverage?: Array<{
    id: string;
    name: string;
    coverage_percent: number | null;
    min_coverage_percent: number;
    meets: boolean;
  }>;
  planning_diagnostics?: NetworkPlanningDiagnostics;
  mode: "stationary";
  planning_mode: "new_network" | "expand";
  placement_mode?: NetworkPlacementMode;
  placement_evidence?: NetworkPlacementEvidence;
  methodology: {
    version?: string;
    kind: string;
    status: string;
    radius_m: number;
    grid_km: number;
    objective: string;
    notice: string;
  };
  data_provenance?: {
    contract_version?: string;
    analysis_profile?: NetworkDesignAnalysisProfile;
    population_dataset?: {
      id?: string;
      reference_year?: number;
      sha256?: string;
    } | null;
    baseline_policy?: string;
    known_source_locations?: number;
    source_context_policy?: string;
    network_context_records?: number;
    diagnostic_context_used_in_placement?: boolean;
    exclusion_masks_used?: boolean;
    excluded_inputs?: string[];
    [key: string]: unknown;
  };
  objective: {
    kind: string;
    population_weighted: boolean;
    fallback: string | null;
  };
  territory: NetworkCoverage["territory"];
  /** Administrative context for the map, same shape as the coverage screen. */
  boundary_layers?: NetworkCoverage["boundary_layers"];
  baseline: {
    active_stations: number;
    registry_active_stations: number;
    registry_active_stations_total?: number;
    cells_total: number;
    cells_covered: number;
  };
  /** Diagnostic distances between proposed and existing posts; not hard constraints. */
  spacing?: {
    diagnostic_only?: boolean;
    min_required_km: number | null;
    max_guideline_km: number | null;
    min_achieved_km: number | null;
    max_achieved_km: number | null;
    max_neighbor_required_km?: number | null;
    max_nearest_neighbor_km?: number | null;
    candidates_rejected_near_existing: number;
    candidates_rejected_unpopulated?: number;
    neighbor_constraint_enforced?: boolean;
    exceeds_guideline: boolean;
  };
  suitability_masks: {
    status: "ready" | "not_configured";
    count: number;
    types: string[];
    excluded_candidate_cells: number;
    constraints_applied: number;
    optimizer: "maximum_coverage_milp" | "greedy_fallback" | "not_run";
    candidate_count: number;
    network_size_mode?: "required_network_size" | "budget_ceiling";
    target_post_count?: number;
    resolved_post_count?: number;
    unresolved_slots?: number;
    hard_count?: number;
    review_count?: number;
    policy_version?: string;
  };
  /** Current settlement-level requirement, or an explicitly historical context. */
  normative_requirements?: {
    status: "ready" | "not_configured" | "not_applicable";
    population: number | null;
    minimum: number | null;
    maximum: number | null;
    source: string;
    source_url?: string;
    valid_until?: string;
    population_evidence?: {
      population: number;
      territory_id: string;
      territory_name?: string;
      as_of: string;
      source_name: string;
      source_url: string;
      confirmed: boolean;
      verification_method?: string;
      confirmed_at?: string;
    } | null;
    reference_status?:
      "historical_reference" | "current_requirement" | "preliminary_model";
    population_basis?: "worldpop";
    population_dataset?: {
      id?: string;
      reference_year?: number | null;
      sha256?: string;
      source_url?: string;
    } | null;
    planning_comparison?: "meets_guide" | "below_guide" | "unknown";
    legally_binding?: boolean;
    note?: string;
    active_posts: number;
    compliance: "meets" | "below_minimum" | "above_maximum" | "unknown";
    deficit?: number;
    spacing_min_km?: number;
    spacing_max_km?: number;
    spacing_is_binding?: boolean;
    spacing_note?: string;
    territory_kind: string;
  };
  priority_criteria?: {
    contract_version?: string;
    primary?: { kind: string; share: number };
    diagnostic_context?: {
      used_in_placement: false;
      known_sources?: number;
      transport_features?: number;
      recreation_features?: number;
    };
  };
  active_stations: Array<{
    id: string;
    name: string;
    longitude: number;
    latitude: number;
    station_type: string;
    operator?: string | null;
    address?: string | null;
  }>;
  /** Active route posts are shown as context, not counted in fixed baseline coverage. */
  route_stations?: Array<{
    id: string;
    name: string;
    longitude: number;
    latitude: number;
    station_type: "route" | string;
    operator?: string | null;
    address?: string | null;
  }>;
  scenarios: Array<{
    rank: number;
    zone_code?: string;
    id: string;
    longitude: number;
    latitude: number;
    cell_id: string;
    newly_covered_cells: number;
    covered_cells: number;
    covered_percent: number;
    newly_covered_population: number;
    covered_population: number;
    recommendation_type: string;
    monitoring_role?:
      | NetworkFunctionalRoleId
      | "population_coverage_zone"
      | "industrial_downwind"
      | "traffic_exposure"
      | "recreation_background"
      | "urban_exposure"
      | "territorial_background";
    nearest_post_km?: number;
    priority_score?: number;
    rationale: string;
    factors?: {
      score: number;
      components?: Record<string, number>;
      available?: string[];
      missing?: string[];
    };
    selected_in_scenarios?: string[];
    stability?: number;
    stability_class?: "high" | "medium" | "specialized";
    ensemble_role?: "core" | "conditional" | "alternative";
    alternative_kind?: "scenario" | "geometric_sensitivity";
    sensitivity_variants?: Array<{ grid_km: number; radius_m: number }>;
    scenario_rank_mean?: number;
    role_assessment?: NetworkRoleAssessment;
    local_population?: number;
    additional_population?: number;
    exclusive_population?: number;
    baseline_overlap_population?: number;
    additional_cells?: number;
    source_wind_context?: NetworkSourceWindContext;
    source_wind_context_by_profile?: Record<string, NetworkSourceWindContext>;
  }>;
  analysis_profile?: NetworkDesignAnalysisProfile;
  planning_scope?: NetworkPlanningScope;
  normative_status?: NetworkDesignNormativeStatus;
  role_assessment_summary?: NetworkRoleAssessmentSummary;
  candidate_screening?: NetworkCandidateScreening;
  feasibility?: NetworkFeasibility;
  factor_status?: Record<string, unknown>;
  calculation_profile?: {
    cache: "hit" | "miss";
    grid_seconds?: number;
    factor_seconds?: number;
    matrix_seconds?: number;
    optimizer_seconds?: number;
    candidate_count?: number;
    cell_count?: number;
  };
  site_selection?: {
    method: string;
    assessment_scope?: string;
    used: string[];
    missing: string[];
    limitations?: string[];
  };
  candidates_geojson: {
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      id: string;
      geometry: { type: "Point"; coordinates: Position };
      properties: {
        rank: number;
        cell_id: string;
        recommendation_type: string;
      };
    }>;
  };
  candidate_zones_geojson: CellCollection;
  context_layers?: GeoJSON.FeatureCollection;
  population_geojson?: CellCollection;
  coverage_summary?: NetworkCoverageSummary;
  source_wind_context_summary?: {
    status: string;
    source_dataset_status: string;
    source_count: number;
    bounded_sources_per_zone?: number;
  };
  required_data: Array<{
    id: string;
    label: string;
    status: "optional" | "required" | "not_in_scope";
    impact: string;
  }>;
}

export type NetworkMeteoScenario = NetworkMeteoProfile;

export interface NetworkDesignReadinessLayer {
  status: "ready" | "not_configured" | "diagnostic_only";
  label: string;
  required?: boolean;
  required_for?: "expand";
  source?: string | null;
  feature_count?: number;
  verified_feature_count?: number;
  proxy_feature_count?: number;
  record_count?: number;
  unique_named_count?: number;
  osm_feature_count?: number;
  known_local_emissions_count?: number;
  items?: Array<{
    id: string;
    name: string;
    has_local_emissions: boolean;
  }>;
  capacity_proxy_records?: number;
  source_strength_policy?:
    "reported_local_pollutants" | "neutral_equal_strength";
  stationary_count?: number;
  route_count?: number;
  route_posts?: Array<{
    id: string;
    name: string;
    longitude: number;
    latitude: number;
    station_type: string;
  }>;
  available_years?: number[];
  resolution_profiles?: Array<{
    id: string;
    label: string;
    resolution_degrees: number;
    scope: string;
    no2_complete_years: number[];
    no2_incomplete_years: number[];
    no2_year_coverage?: Array<{
      year: number;
      valid_months: number;
      months: string[];
    }>;
  }>;
  qa_status?: "not_approved_for_placement";
  used_in_placement?: boolean;
  note?: string;
  dataset?: Record<string, unknown> | null;
  dataset_fingerprint?: string | null;
}

export interface NetworkDesignReadiness {
  territory: NetworkCoverage["territory"] & { population?: number | null };
  layers: Record<string, NetworkDesignReadinessLayer>;
  scenarios: Array<{
    id: NetworkMeteoScenario;
    label: string;
    status: "ready" | "not_configured" | "not_required";
    era5_season?: string;
    dataset_version_id?: string | null;
    dataset_version_ids?: string[];
    month_numbers?: number[];
    years?: number[];
    period_start?: string | null;
    period_end?: string | null;
    note?: string | null;
  }>;
  normative_requirements: NonNullable<NetworkDesign["normative_requirements"]>;
  ready_for_new_network: boolean;
  ready_for_expansion: boolean;
  ready_for_population_only_new_network: boolean;
  ready_for_population_only_expansion: boolean;
  methodology_version: string;
}

export interface NetworkDesignRunRequest {
  territory_kind: "settlement";
  territory_id: string;
  planning_mode: "new_network" | "expand";
  placement_mode: NetworkPlacementMode;
  meteo_profile: NetworkMeteoProfile;
  selected_source_ids: string[];
  transport_evidence_mode: "auto" | "verified_only" | "proxy_allowed";
  post_type: "stationary";
  post_count: number;
  research_mode: boolean;
  analysis_profile: NetworkDesignAnalysisProfile;
  network_size_mode: "required_network_size" | "budget_ceiling";
  grid_km: number;
  radius_m: number;
  source_context_radius_km: number;
  wind_sector_tolerance_deg: number;
  use_exclusion_masks: boolean;
  sensitivity_mode: "off" | "standard";
  sensitivity_grid_km: number[];
  sensitivity_radii_m: number[];
}

export interface NetworkDesignEnsemble {
  territory_wind_rose?: NetworkSourceWindContext["wind_rose"];
  zone_stability?: NetworkZoneStability;
  district_coverage?: Array<{
    id: string;
    name: string;
    coverage_percent: number | null;
    min_coverage_percent: number;
    meets: boolean;
  }>;
  planning_diagnostics?: NetworkPlanningDiagnostics;
  fixed_layout_stress?: NetworkFixedLayoutStress;
  placement_mode?: NetworkPlacementMode;
  placement_evidence?: NetworkPlacementEvidence;
  methodology: {
    version: string;
    status: string;
    kind: string;
    notice: string;
  };
  territory: NetworkDesign["territory"];
  boundary_layers?: NetworkDesign["boundary_layers"];
  context_layers?: NetworkDesign["context_layers"];
  population_geojson?: NetworkDesign["population_geojson"];
  coverage_summary?: NetworkCoverageSummary;
  planning_mode: NetworkDesign["planning_mode"];
  active_stations: NetworkDesign["active_stations"];
  route_stations?: NetworkDesign["route_stations"];
  baseline: NetworkDesign["baseline"];
  normative_requirements?: NetworkDesign["normative_requirements"];
  scenarios: NetworkDesign["scenarios"];
  core_recommendations?: NetworkDesign["scenarios"];
  conditional_recommendations?: NetworkDesign["scenarios"];
  scenario_alternatives?: NetworkDesign["scenarios"];
  candidate_zones_geojson: CellCollection;
  candidates_geojson: NetworkDesign["candidates_geojson"];
  alternatives_geojson?: CellCollection;
  alternative_candidates_geojson?: NetworkDesign["candidates_geojson"];
  map_geojson?: CellCollection;
  scenario_count: number;
  effective_scenario_count?: number;
  scenario_family_count?: number;
  independent_selection_count?: number;
  equivalent_scenario_groups?: string[][];
  target_post_count: number;
  resolved_post_count: number;
  unresolved_slots: number;
  core_count?: number;
  conditional_count?: number;
  alternative_count?: number;
  analysis_profile?: NetworkDesignAnalysisProfile;
  planning_scope?: NetworkPlanningScope;
  normative_status?: NetworkDesignNormativeStatus;
  role_assessment_summary?: NetworkRoleAssessmentSummary;
  candidate_screening?: NetworkCandidateScreening;
  feasibility?: NetworkFeasibility;
  source_wind_context_summary?: NetworkDesign["source_wind_context_summary"];
  robustness?: {
    stable_zone_count: number;
    mean_selection_frequency: number | null;
    minimum_additional_coverage: number | null;
    median_additional_coverage: number | null;
    maximum_additional_coverage: number | null;
    coverage_variability: number | null;
    scenario_overlap: number | null;
    interpretation: string;
  };
  sensitivity?: {
    status: "ready" | "disabled";
    matching_distance_km?: number;
    variants: Array<{
      grid_km: number;
      radius_m: number;
      resolved_post_count: number;
      primary_points_reproduced: number;
      stability: number;
    }>;
  };
}

export interface NetworkDesignRun {
 demo_transport_snapshot?: {dataset_id:string;provider:string;road_count:number;class_weights:Record<string,number>;note:string;fetched_at:string;source_url:string;license:string};
 demo_baseline?: {status:string;note:string};
  data_quality?: NetworkDataQuality;
  reproducibility?: NetworkReproducibility;
  id: string;
  status: "queued" | "completed" | "running" | "failed" | "partial";
  progress_stage: string;
  progress_percent: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  queue_wait_seconds?: number;
  calculation_duration_seconds?: number;
  methodology_version: string;
  input_fingerprint: string;
  request: NetworkDesignRunRequest;
  readiness: NetworkDesignReadiness;
  dataset_snapshot: Record<string, unknown>;
  scenario_results: Array<{
    scenario_id: NetworkMeteoScenario;
    label: string;
    result: NetworkDesign;
  }>;
  ensemble: NetworkDesignEnsemble;
  sensitivity?: NetworkDesignEnsemble["sensitivity"];
  persistence: string;
  persistence_warning?: string;
}

export interface NetworkPlanningDiagnostics {
  status: "ready" | "unavailable";
  reason?: string;
  version?: string;
  calculation_fingerprint?: string;
  additional_population?: number;
  population_covered_by_multiple_new_posts?: number;
  growth_interpretation?: string;
  replacement_interpretation?: string;
  growth_curve?: Array<{
    post_count: number;
    kind: string;
    cell_id?: string;
    additional_population: number;
    marginal_population: number;
    objective_value: number;
  }>;
  site_impacts?: Array<{
    cell_id: string;
    population_lost_if_removed: number;
    objective_lost_if_removed: number;
    nearby_replacements: Array<{
      cell_id: string;
      longitude: number;
      latitude: number;
      distance_km: number;
      population_delta: number;
      objective_delta: number;
    }>;
  }>;
}

export interface NetworkFixedLayoutStress {
  status: "ready" | "not_evaluated";
  variant_count: number;
  distinct_geometry_count: number;
  minimum_additional_population: number | null;
  maximum_additional_population: number | null;
  population_range: number | null;
  interpretation: string;
  variants: Array<{
    scenario_id: string;
    grid_km: number;
    radius_m: number;
    additional_population: number;
  }>;
}

export interface NetworkDataQuality {
  status: "ready" | "warning" | "blocked";
  population: {
    year?: number;
    valid_percent?: number;
    nodata_percent?: number;
    nodata_pixels?: number;
    invalid_pixels?: number;
    sha256?: string;
  };
  issues: Array<{ code: string; severity: string; message: string }>;
  layers: Array<{
    id: string;
    label: string;
    status: string;
    year?: number;
    updated_at?: string;
    source_snapshot_at?: string;
    latest_source_snapshot_at?: string;
    imported_at?: string;
    source_age_days?: number;
    source_provenance?: {
      kind?: string;
      date_semantics?: string;
      record_count?: number;
      dated_record_count?: number;
      missing_record_count?: number;
      sources?: Array<{
        id?: string;
        name?: string;
        dataset?: string;
        source_filename?: string;
        source_snapshot_at?: string;
        source_date?: string;
        source_version?: string;
        source_url?: string;
        reference_year?: number;
        period_start?: string;
        period_end?: string;
        processing_version?: string;
        sha256?: string;
        license?: string;
        verification_status?: string;
      }>;
    };
    fingerprint?: string;
    record_count?: number;
  }>;
  population_comparison: {
    territory_population: number | null;
    grid_population: number | null;
    difference: number | null;
    difference_percent: number | null;
    explanation: string;
  };
  masks_applied: boolean;
}

export interface NetworkZoneStability {
  status: string;
  variant_count: number;
  distinct_geometry_count: number;
  interpretation: string;
  geojson: GeoJSON.FeatureCollection;
  contour_version?: string;
  contour_interpretation?: string;
  contour_source?: string;
  zones: Array<{
    cell_id: string;
    support_fraction: number | null;
    maximum_shift_km: number | null;
    distinct_position_count?: number;
    contour_kind?: string;
    contour_area_km2?: number | null;
  }>;
}

export interface NetworkReproducibility {
  version: string;
  input_fingerprint: string;
  runtime: {
    python: string;
    platform: string;
    packages: Record<string, string | null>;
  };
  limitations: string[];
  method_references: Array<{ title: string; url: string; role: string }>;
}
