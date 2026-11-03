import reportMapLibreJs from "maplibre-gl/dist/maplibre-gl.js?raw";
import reportMapLibreCss from "maplibre-gl/dist/maplibre-gl.css?raw";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  createAsyncNetworkDesignRun,
  fetchNetworkDesignReadiness,
  fetchNetworkDesignRun,
  fetchNetworkDesignReports,
  fetchNetworkTerritories,
  networkDesignReportUrl,
  saveNetworkDesignReport,
  saveNetworkOfficialPopulation,
} from "../api";
import { DEFAULT_TERRITORY } from "../defaults";

import { networkPlanningDiagnosticsHtml } from "../shared/networkPlanningDiagnostics";
import {
  networkReportConclusionHtml,
  networkReportQualityHtml,
  networkReportSolverHtml,
} from "../shared/networkReportNarrative";
import { NetworkParameterDetails } from "../components/NetworkParameterDetails";
import { NetworkDesignResultView } from "../components/NetworkDesignResultView";
import { NetworkPlanningHelp } from "../components/NetworkPlanningHelp";
import { loadNetworkRun } from "../shared/networkRunNavigation";
import type {
  NetworkDesign,
  NetworkDesignEnsemble,
  NetworkDesignReadiness,
  NetworkDesignRun,
  NetworkDesignRunRequest,
  NetworkPlacementMode,
  NetworkMeteoProfile,
  NetworkFunctionalRoleId,
  NetworkRoleAssessment,
  NetworkRoleResult,
  NetworkTerritory,
} from "../types";

const DRAFT_KEY = "air-sgm:network-design-wizard:v1";
const STEPS = [
  { id: 1, title: "Параметры", subtitle: "территория и настройки" },
  { id: 2, title: "Результат", subtitle: "карта и выбранные зоны" },
] as const;

type ScreeningProfile = "quick" | "robustness";

const PLACEMENT_MODES: Record<
  NetworkPlacementMode,
  { short: string; title: string; description: string }
> = {
  population_coverage: {
    short: "Н",
    title: "Охват населения",
    description: "Максимум жителей в зоне действия новых постов.",
  },
  industrial_influence: {
    short: "П",
    title: "Промышленные источники",
    description:
      "Ветер ERA5 и расстояние от промышленных объектов и площадок OSM к жилым зонам.",
  },
  transport_influence: {
    short: "Т",
    title: "Транспорт",
    description:
      "Близость к магистралям, действующим железным дорогам и аэропортам OSM; без измерений интенсивности движения.",
  },
  urban_background: {
    short: "Ф",
    title: "Городской фон",
    description:
      "Населённые зоны вдали от сильных локальных промышленных и дорожных сигналов.",
  },
  integrated_screening: {
    short: "Σ",
    title: "Комплексное проектирование",
    description:
      "Авторский сценарий: население 45%, промышленный контекст 25%, транспорт 20%, городской фон 10%. Эти веса не установлены МР и не оценивают опасность выбросов.",
  },
};

const METEO_PROFILES: Record<NetworkMeteoProfile, string> = {
  annual: "Годовая роза ветров",
  cold_period: "Холодный период",
  warm_period: "Тёплый период",
  weak_wind: "Слабый ветер 0,5–2 м/с",
  calm_accumulation: "Штиль менее 0,5 м/с",
  accumulation_risk: "Условия слабого перемешивания",
};

const INTEGRATED_COMPONENT_LABELS = [
  ["integrated_population", "Население"],
  ["integrated_industrial_influence", "Промышленный фактор"],
  ["integrated_transport_influence", "Транспортный фактор"],
  ["integrated_urban_background", "Городской фон"],
] as const;

const ROLE_CATALOG: Record<
  NetworkFunctionalRoleId,
  {
    short: string;
    title: string;
    description: string;
    evidence: string;
    layers: string[];
  }
> = {
  urban_background: {
    short: "ГФ",
    title: "Городской фон",
    description:
      "Кандидатная жилая зона для проверки типичного городского окружения без заметного влияния отдельного источника или магистрали.",
    evidence:
      "Население, жилая застройка, удалённость от отдельных источников и магистралей",
    layers: ["population", "residential", "roads", "sources"],
  },
  transport_context: {
    short: "ТР",
    title: "Влияние магистралей",
    description: "Кандидатная зона рядом с магистральной дорожной сетью.",
    evidence:
      "Класс и расстояние до дорог; без интерпретации как интенсивность движения",
    layers: ["roads", "population", "residential"],
  },
  industrial_context: {
    short: "ПР",
    title: "Промышленное окружение",
    description:
      "Пространственная близость к известному именованному промышленному объекту.",
    evidence:
      "Геометрия и расстояние; без оценки причинного или количественного вклада",
    layers: ["sources", "population", "residential"],
  },
};

const ROLE_ORDER = Object.keys(ROLE_CATALOG) as NetworkFunctionalRoleId[];

const CALCULATION_PHASES = [
  { threshold: 3, label: "Аудит входов" },
  { threshold: 12, label: "Сетка и ограничения" },
  { threshold: 35, label: "Каркас покрытия" },
  { threshold: 63, label: "Классификация зон" },
  { threshold: 78, label: "Устойчивость" },
  { threshold: 96, label: "Паспорт результата" },
] as const;

const formatCalculationTime = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes > 0 ? `${minutes} мин ${rest} с` : `${rest} с`;
};

const ROLE_READINESS_LABELS: Record<NetworkRoleResult["readiness"], string> = {
  screening_ready: "Достаточно для скрининга",
  proxy_only: "Только proxy-данные",
  insufficient_data: "Недостаточно данных",
};

const ROLE_STATUS_LABELS: Record<NetworkRoleResult["status"], string> = {
  candidate: "Основная роль",
  supporting_context: "Дополнительный признак",
  low_evidence: "Слабая доказательность",
  unavailable: "Не оценено",
};

const STATUS_LABELS: Record<string, string> = {
  ready: "Готово",
  not_configured: "Нет данных",
  diagnostic_only: "Только диагностика",
};

const LAYER_PURPOSE: Record<string, string> = {
  boundary: "Задаёт границы территории, в которой ищем места для сети.",
  population: "Показывает, где живут люди и какой охват даст каждая зона.",
  residential: "Показывает жилую застройку — подходящие места для кандидатов.",
  sources:
    "Помогает увидеть близость к промышленным объектам; выбросы здесь не рассчитываются.",
  stations:
    "Существующие посты нужны для сравнения и не становятся новыми кандидатами.",
  terrain: "Рельеф проверяется отдельно и не меняет порядок выбранных зон.",
  constraints:
    "Исключает участки, где размещение поста невозможно или нежелательно.",
  roads:
    "Для транспортного режима используется только геометрический OSM-признак: класс дороги и расстояние до неё. AADT и измерения интенсивности не используются.",
  recreation:
    "Показывает парки и зоны отдыха рядом с выбранной зоной; на выбор точки не влияет.",
};

const layerPurpose = (
  id: string,
  planningMode: WizardDraft["planningMode"],
): string => {
  if (id === "stations" && planningMode === "new_network") {
    return "Показываем для сравнения с гипотетической новой сетью; в расчёт новых мест посты не входят.";
  }
  return (
    LAYER_PURPOSE[id] ??
    "Слой используется как дополнительное пояснение к результату."
  );
};

const SETTLEMENT_TYPE_LABELS: Record<string, string> = {
  city: "город",
  town: "город",
  urban: "посёлок городского типа",
  "administrative-center": "административный центр",
  village: "село / деревня",
  hamlet: "населённый пункт",
};

type WizardStep = (typeof STEPS)[number]["id"];

type WizardDraft = {
  schemaVersion: 9;
  screeningProfile: ScreeningProfile;
  territoryQuery: string;
  territoryId: string | null;
  planningMode: "new_network" | "expand";
  placementMode: NetworkPlacementMode;
  meteoProfile: NetworkMeteoProfile;
  postCount: number;
  researchMode: boolean;
  networkSizeMode: "required_network_size" | "budget_ceiling";
  gridKm: number;
  radiusM: number;
  sourceContextRadiusKm: number;
  windSectorToleranceDeg: number;
  useExclusionMasks: boolean;
  sensitivityMode: "off" | "standard";
};

const DEFAULT_DRAFT: WizardDraft = {
  schemaVersion: 9,
  screeningProfile: "quick",
  territoryQuery: DEFAULT_TERRITORY.label,
  territoryId: DEFAULT_TERRITORY.id,
  planningMode: "new_network",
  placementMode: "population_coverage",
  meteoProfile: "annual",
  postCount: 7,
  researchMode: false,
  networkSizeMode: "required_network_size",
  gridKm: 0.4,
  radiusM: 2500,
  sourceContextRadiusKm: 25,
  windSectorToleranceDeg: 22.5,
  useExclusionMasks: true,
  sensitivityMode: "off",
};

function loadDraft(): WizardDraft {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return DEFAULT_DRAFT;
    const value = JSON.parse(raw) as Partial<
      Omit<WizardDraft, "schemaVersion">
    > & {
      schemaVersion?: number;
      analysisProfile?: string;
    };
    if (![4, 5, 6, 7, 8, 9].includes(value.schemaVersion ?? 0))
      return DEFAULT_DRAFT;
    const screeningProfile: ScreeningProfile =
      (value.schemaVersion ?? 0) >= 6
        ? value.screeningProfile === "robustness"
          ? "robustness"
          : "quick"
        : value.analysisProfile === "extended_diagnostics"
          ? "robustness"
          : "quick";
    return {
      schemaVersion: 9,
      screeningProfile,
      territoryQuery: value.territoryQuery ?? DEFAULT_DRAFT.territoryQuery,
      territoryId:
        value.territoryId === undefined
          ? DEFAULT_DRAFT.territoryId
          : value.territoryId,
      planningMode: value.planningMode ?? DEFAULT_DRAFT.planningMode,
      placementMode:
        value.placementMode && value.placementMode in PLACEMENT_MODES
          ? value.placementMode
          : DEFAULT_DRAFT.placementMode,
      meteoProfile:
        value.meteoProfile && value.meteoProfile in METEO_PROFILES
          ? value.meteoProfile
          : DEFAULT_DRAFT.meteoProfile,
      postCount:
        Number.isInteger(value.postCount) &&
        Number(value.postCount) >= (value.planningMode === "expand" ? 0 : 1) &&
        Number(value.postCount) <= 20
          ? Number(value.postCount)
          : DEFAULT_DRAFT.postCount,
      researchMode: value.researchMode ?? DEFAULT_DRAFT.researchMode,
      networkSizeMode: value.networkSizeMode ?? DEFAULT_DRAFT.networkSizeMode,
      gridKm: [0.2, 0.25, 0.3, 0.4, 0.5, 1].includes(Number(value.gridKm))
        ? Number(value.gridKm)
        : DEFAULT_DRAFT.gridKm,
      radiusM: [2500, 5000, 10000].includes(Number(value.radiusM))
        ? Number(value.radiusM)
        : DEFAULT_DRAFT.radiusM,
      sourceContextRadiusKm:
        Number(value.sourceContextRadiusKm) >= 1 &&
        Number(value.sourceContextRadiusKm) <= 100
          ? Number(value.sourceContextRadiusKm)
          : DEFAULT_DRAFT.sourceContextRadiusKm,
      windSectorToleranceDeg:
        Number(value.windSectorToleranceDeg) >= 1 &&
        Number(value.windSectorToleranceDeg) <= 90
          ? Number(value.windSectorToleranceDeg)
          : DEFAULT_DRAFT.windSectorToleranceDeg,
      useExclusionMasks:
        value.useExclusionMasks ?? DEFAULT_DRAFT.useExclusionMasks,
      sensitivityMode: screeningProfile === "robustness" ? "standard" : "off",
    };
  } catch {
    return DEFAULT_DRAFT;
  }
}

type ResultView = NetworkDesign | NetworkDesignEnsemble;

type NetworkCandidate = NetworkDesign["scenarios"][number];

const LEGACY_ROLE_MAP: Partial<
  Record<
    NonNullable<NetworkCandidate["monitoring_role"]>,
    NetworkFunctionalRoleId
  >
> = {
  urban_exposure: "urban_background",
  traffic_exposure: "transport_context",
  industrial_downwind: "industrial_context",
};

function candidateRole(candidate: NetworkCandidate): {
  id: NetworkFunctionalRoleId | null;
  candidateIds: NetworkFunctionalRoleId[];
  assessment: NetworkRoleAssessment | null;
  result: NetworkRoleResult | null;
  legacy: boolean;
} {
  const assessment = candidate.role_assessment ?? null;
  const suggestedRole = assessment?.suggested_role ?? null;
  const assessedRole =
    suggestedRole && suggestedRole in ROLE_CATALOG ? suggestedRole : null;
  const candidateIds = (assessment?.candidate_roles ?? []).filter(
    (roleId): roleId is NetworkFunctionalRoleId => roleId in ROLE_CATALOG,
  );
  if (assessedRole) {
    return {
      id: assessedRole,
      candidateIds: [assessedRole],
      assessment,
      result: assessment?.roles[assessedRole] ?? null,
      legacy: false,
    };
  }
  const legacyRole = candidate.monitoring_role
    ? (LEGACY_ROLE_MAP[candidate.monitoring_role] ?? null)
    : null;
  return {
    id: legacyRole,
    candidateIds,
    assessment,
    result: null,
    legacy: Boolean(legacyRole),
  };
}

function roleDisplay(candidate: NetworkCandidate): {
  title: string;
  status: string;
  readiness: string;
  icon: string;
} {
  const role = candidateRole(candidate);
  const roleMeta = role.id ? ROLE_CATALOG[role.id] : null;
  if (roleMeta && role.result) {
    return {
      title: roleMeta.title,
      status: ROLE_STATUS_LABELS[role.result.status],
      readiness: ROLE_READINESS_LABELS[role.result.readiness],
      icon: roleMeta.short,
    };
  }
  if (role.legacy && roleMeta) {
    return {
      title: roleMeta.title,
      status: "Назначено по совместимому полю старого результата",
      readiness: "Совместимая оценка",
      icon: roleMeta.short,
    };
  }
  if (role.candidateIds.length > 1) {
    return {
      title: role.candidateIds.map((id) => ROLE_CATALOG[id].title).join(" · "),
      status: "Несколько независимых признаков; единая роль не выбрана",
      readiness: "Нужна проверка",
      icon: "±",
    };
  }
  if (role.candidateIds.length === 1) {
    const candidateRoleMeta = ROLE_CATALOG[role.candidateIds[0]];
    return {
      title: candidateRoleMeta.title,
      status: "Предварительная роль; единая рекомендация не сформирована",
      readiness: "Нужна проверка",
      icon: candidateRoleMeta.short,
    };
  }
  if (role.assessment) {
    return {
      title: "Нет подтверждённой функциональной роли",
      status: "Ни одна роль не прошла порог screening",
      readiness: "Недостаточно оснований",
      icon: "—",
    };
  }
  return {
    title: "Оценка функциональной роли отсутствует",
    status: "Нужен результат backend с role_assessment",
    readiness: "Нет оценки",
    icon: "—",
  };
}

function candidateSelectionSummary(candidate: NetworkCandidate): string {
  if (candidate.rationale?.trim()) return candidate.rationale;
  const gain = Math.round(candidate.newly_covered_population).toLocaleString(
    "ru-RU",
  );
  const cells = candidate.newly_covered_cells;
  const nearest =
    candidate.nearest_post_km != null
      ? ` До ближайшего зарегистрированного поста — ${candidate.nearest_post_km} км.`
      : "";
  return `Зона отобрана при расчёте каркаса: добавляет ${gain} чел. и ${cells} новых ячеек.${nearest}`;
}

function candidateIntegratedContributions(candidate: NetworkCandidate) {
  const components = candidate.factors?.components ?? {};
  const values = INTEGRATED_COMPONENT_LABELS.map(([id, label]) => ({
    id,
    label,
    value: Math.max(0, Number(components[id] ?? 0)),
  }));
  const total = values.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return [];
  return values.map((item) => ({
    ...item,
    percent: Math.round((item.value / total) * 100),
  }));
}

function evidenceQualityLabel(
  quality: NetworkRoleResult["evidence"][number]["quality"],
): string {
  if (quality === "derived") return "расчётный признак";
  if (quality === "proxy") return "proxy";
  return "пробел данных";
}

function escapeReportHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function networkScreeningReportHtml(run: NetworkDesignRun): string {
  const result = run.ensemble;
  const historicalPostCount = result.normative_requirements?.minimum ?? null;
  const isExpand = run.request.planning_mode === "expand";
  const modeLabel = isExpand
    ? "Расширение действующей сети"
    : "Новая сеть с нуля";
  const baselinePosts = isExpand ? result.baseline.active_stations : 0;
  const additionalPosts = result.resolved_post_count;
  const projectedNetworkSize = baselinePosts + additionalPosts;
  const roleRows = result.scenarios
    .map((candidate) => {
      const zoneLabel = candidate.zone_code
        ? `Зона ${candidate.zone_code}`
        : `Зона ${candidate.rank}`;
      const latitude = candidate.latitude.toFixed(4);
      const longitude = candidate.longitude.toFixed(4);
      const mapUrl = `https://www.openstreetmap.org/?mlat=${candidate.latitude}&mlon=${candidate.longitude}#map=14/${candidate.latitude}/${candidate.longitude}`;
      return `<tr>
      <td><b>${escapeReportHtml(zoneLabel)}</b></td>
      <td><a href="${escapeReportHtml(mapUrl)}" target="_blank" rel="noopener">${latitude}, ${longitude}</a><br><small>открыть на OpenStreetMap · центр расчётной зоны; площадка не обследована</small></td>
      <td>${Math.round(candidate.newly_covered_population).toLocaleString("ru-RU")}</td>
    </tr>`;
    })
    .join("");
  const sourceRows = result.scenarios
    .flatMap((candidate) => {
      const zoneLabel = candidate.zone_code
        ? `Зона ${candidate.zone_code}`
        : `Зона ${candidate.rank}`;
      return (candidate.source_wind_context?.sources ?? []).map(
        (source) => `<tr>
      <td><b>${escapeReportHtml(zoneLabel)}</b></td>
      <td>${escapeReportHtml(source.name)}<br><small>${escapeReportHtml(source.type)} · ${escapeReportHtml(source.registry)}</small></td>
      <td>${source.distance_km.toFixed(2)}</td>
      <td>${escapeReportHtml(source.direction)} / ${source.bearing_receptor_to_source.toFixed(1)}°</td>
      <td>${source.upwind_frequency_percent == null ? "—" : `${source.upwind_frequency_percent.toFixed(1)}%`}</td>
      <td>${escapeReportHtml(source.interpretation ?? source.status)}</td>
    </tr>`,
      );
    })
    .join("");
  const sharedWindContext = result.scenarios[0]?.source_wind_context;
  const territoryWind =
    sharedWindContext?.wind_statistics_scope === "territory";
  const windCells =
    sharedWindContext?.wind_rose?.territory_aggregation?.cells ?? [];
  const windScaleMaximum =
    Math.ceil(
      Math.max(
        1,
        ...result.scenarios.flatMap(
          (c) =>
            c.source_wind_context?.wind_rose?.directions?.map(
              (d) => d.total_frequency,
            ) ?? [],
        ),
        ...windCells.flatMap(
          (c) => c.wind_rose.directions?.map((d) => d.total_frequency) ?? [],
        ),
      ) / 5,
    ) * 5;
  const windRoseCards = (
    territoryWind ? result.scenarios.slice(0, 1) : result.scenarios
  )
    .map((candidate) => {
      const context = candidate.source_wind_context;
      const directions = context?.wind_rose?.directions ?? [];
      const maxFrequency = windScaleMaximum;
      const bars = directions
        .map(
          (item) =>
            `<div class="rose-row"><span>${escapeReportHtml(item.label)}</span><i><b style="width:${Math.max(1, (item.total_frequency / maxFrequency) * 100).toFixed(1)}%"></b></i><em>${item.total_frequency.toFixed(1)}%</em></div>`,
        )
        .join("");
      const leaders = context?.wind_rose?.summary?.leading_directions ?? [];
      return `<article class="rose-card"><h3>${territoryWind ? "Роза ветров территории · ERA5" : escapeReportHtml(candidate.zone_code ? `Зона ${candidate.zone_code}` : `Зона ${candidate.rank}`)}</h3>
      <p>ERA5: ${escapeReportHtml(context?.era5_profile ?? run.request.meteo_profile)} · ${leaders.length > 1 ? `близкие по частоте: ${leaders.map((d) => `${escapeReportHtml(d.label)} ${d.total_frequency.toFixed(2)}%`).join("; ")}` : `преобладающее направление ветра: ${escapeReportHtml(context?.prevailing_wind_from ?? "—")}`} · штиль: ${context?.calm_fraction == null ? "—" : `${(context.calm_fraction * 100).toFixed(1)}%`} · часов: ${context?.valid_observation_count?.toLocaleString("ru-RU") ?? "—"}</p>
      <div class="rose-bars">${bars || "Данные розы ветров недоступны"}</div></article>`;
    })
    .join("");
  const windDiagnostics = windCells
    .map(
      (cell) => `<article class="rose-card">
    <h3>Ячейка ${escapeReportHtml(cell.grid_cell.source_cell_key)}</h3>
    <p>Вес по площади: ${(cell.weight * 100).toFixed(2)}% · широта ${Number(cell.grid_cell.min_lat).toFixed(5)}–${Number(cell.grid_cell.max_lat).toFixed(5)} · долгота ${Number(cell.grid_cell.min_lon).toFixed(5)}–${Number(cell.grid_cell.max_lon).toFixed(5)}</p>
    <div class="rose-bars">${(cell.wind_rose.directions ?? []).map((d) => `<div class="rose-row"><span>${escapeReportHtml(d.label)}</span><i><b style="width:${((d.total_frequency / windScaleMaximum) * 100).toFixed(1)}%"></b></i><em>${d.total_frequency.toFixed(2)}%</em></div>`).join("")}</div>
  </article>`,
    )
    .join("");
  const alternativeRows = (result.scenario_alternatives ?? [])
    .map((candidate) => {
      const reason =
        candidate.alternative_kind === "geometric_sensitivity"
          ? `Появилась при изменении шага сетки или радиуса покрытия (${candidate.sensitivity_variants?.map((item) => `${item.grid_km} км / ${item.radius_m / 1000} км`).join("; ") || "вариант не указан"}).`
          : `Выбиралась в отдельных метеорологических сценариях: ${candidate.selected_in_scenarios?.map((id) => METEO_PROFILES[id as NetworkMeteoProfile] ?? id).join(", ") || "сценарий не указан"}.`;
      return `<tr><td><b>А${candidate.rank}</b></td><td>${candidate.latitude.toFixed(6)}, ${candidate.longitude.toFixed(6)}</td><td>${escapeReportHtml(reason)}</td><td>${candidate.stability == null ? "—" : `${Math.round(candidate.stability * 100)}%`}</td><td>Сравнить с ближайшей основной зоной и проверить площадку на месте.</td></tr>`;
    })
    .join("");
  const roleSummaryRows = ROLE_ORDER.map((roleId) => {
    const role = ROLE_CATALOG[roleId];
    const summary = result.role_assessment_summary?.by_role[roleId];
    const fallbackCount = result.scenarios.filter(
      (candidate) => candidateRole(candidate).id === roleId,
    ).length;
    return `<tr><td><b>${escapeReportHtml(role.title.replace("Влияние магистралей", "Транспортное окружение"))}</b></td><td>${summary?.candidate_count ?? fallbackCount}</td><td>${summary?.supporting_count ?? 0}</td><td>${escapeReportHtml(role.evidence)}</td></tr>`;
  }).join("");
  const layerRows = Object.entries(run.readiness.layers)
    .filter(([id]) => id !== "stations" || isExpand)
    .map(([id, layer]) => {
      const required =
        ["boundary", "population", "residential"].includes(id) ||
        (id === "stations" && run.request.planning_mode === "expand");
      const layerRole = required
        ? "исходные данные расчёта"
        : id === "terrain"
          ? "отдельная диагностика"
          : ["sources", "roads", "recreation"].includes(id)
            ? "пространственные признаки; участие в выборе зависит от режима"
            : "ограничение";
      const details = [
        layer.feature_count != null ? `объектов: ${layer.feature_count}` : null,
        layer.stationary_count != null
          ? `постов: ${layer.stationary_count}`
          : null,
        layer.route_count != null
          ? `маршрутных постов: ${layer.route_count}`
          : null,
        layer.unique_named_count != null
          ? `именованных объектов: ${layer.unique_named_count}`
          : null,
        layer.proxy_feature_count != null
          ? `объектов с косвенной характеристикой: ${layer.proxy_feature_count}`
          : null,
      ]
        .filter(Boolean)
        .join("; ");
      return `<tr><td>${escapeReportHtml(layer.label)}</td><td>${escapeReportHtml(STATUS_LABELS[layer.status] ?? "Статус не определён")}</td><td>${escapeReportHtml(layerRole)}</td><td>${escapeReportHtml(details || "—")}</td></tr>`;
    })
    .join("");
  const sensitivityRows = (run.sensitivity?.variants ?? [])
    .map(
      (variant) =>
        `<tr><td>${variant.grid_km}</td><td>${variant.radius_m / 1000}</td><td>${variant.resolved_post_count}</td><td>${variant.primary_points_reproduced}</td><td>${Math.round(variant.stability * 100)}%</td></tr>`,
    )
    .join("");
  const mapCandidates = [
    ...result.scenarios.map((candidate) => ({
      candidate,
      kind: "candidate" as const,
    })),
    ...(result.scenario_alternatives ?? []).map((candidate) => ({
      candidate,
      kind: "alternative" as const,
    })),
  ].map(({ candidate, kind }) => {
    const context =
      candidate.source_wind_context ??
      Object.values(candidate.source_wind_context_by_profile ?? {})[0] ??
      null;
    return {
      id: candidate.cell_id,
      rank: candidate.rank,
      zone_code: candidate.zone_code ?? null,
      kind,
      longitude: candidate.longitude,
      latitude: candidate.latitude,
      newly_covered_population: candidate.newly_covered_population,
      newly_covered_cells: candidate.newly_covered_cells,
      role_label: roleDisplay(candidate).title.replace(
        "Влияние магистралей",
        "Транспортное окружение",
      ),
      stability: candidate.stability ?? null,
      context: context
        ? {
            era5_profile: context.era5_profile,
            wind_statistics_scope: context.wind_statistics_scope,
            period: context.period,
            prevailing_wind_from: context.prevailing_wind_from,
            prevailing_wind_from_degrees: context.prevailing_wind_from_degrees,
            calm_fraction: context.calm_fraction,
            valid_observation_count: context.valid_observation_count,
            wind_rose: context.wind_rose
              ? {
                  directions: context.wind_rose.directions,
                  mean_speed: context.wind_rose.summary?.mean_speed ?? null,
                  leading_directions:
                    context.wind_rose.summary?.leading_directions,
                }
              : null,
            sources: context.sources,
            upwind_sector_geojson: {
              ...context.upwind_sector_geojson,
              features: context.upwind_sector_geojson.features.slice(0, 1),
            },
            flow_arrows_geojson: {
              ...context.flow_arrows_geojson,
              features: context.flow_arrows_geojson.features.slice(0, 3),
            },
            source_relationships_geojson: context.source_relationships_geojson,
          }
        : null,
    };
  });
  const mapPointOptions = mapCandidates.length
    ? mapCandidates
        .map((candidate, index) => {
          const label =
            candidate.kind === "alternative"
              ? `Альтернатива А${candidate.rank}`
              : `Зона ${candidate.zone_code ?? candidate.rank} · точка ${candidate.rank}`;
          return `<option value="${escapeReportHtml(candidate.id)}"${index === 0 ? " selected" : ""}>${escapeReportHtml(label)}</option>`;
        })
        .join("")
    : '<option value="">Расчётные точки не сформированы</option>';
  const initialMapCandidate = mapCandidates[0];
  const mapPayload = JSON.stringify({
    wind_scale_maximum: windScaleMaximum,
    wind_cells: {
      type: "FeatureCollection",
      features: windCells.map((cell) => ({
        type: "Feature",
        geometry: cell.intersection_geometry,
        properties: {
          label: String(cell.grid_cell.source_cell_key),
          weight: cell.weight,
        },
      })),
    },
    bounds: result.territory.bounds,
    coverage_radius_m: run.request.radius_m,
    boundary: result.boundary_layers?.selected ?? null,
    context: result.context_layers ?? null,
    zones: result.map_geojson ?? result.candidate_zones_geojson,
    population: result.population_geojson ?? null,
    stations:
      run.request.planning_mode === "new_network" ? [] : result.active_stations,
    route_stations:
      run.request.planning_mode === "new_network"
        ? []
        : (result.route_stations ?? []).filter((p)=>p.longitude>=result.territory.bounds.min_lon&&p.longitude<=result.territory.bounds.max_lon&&p.latitude>=result.territory.bounds.min_lat&&p.latitude<=result.territory.bounds.max_lat),
    candidates: mapCandidates,
  }).replaceAll("</", "<\\/");
  const unresolvedText =
    result.feasibility?.message ??
    (result.unresolved_slots
      ? `Из запрошенных ${run.request.post_count} зон сформировано ${result.resolved_post_count}; ещё ${result.unresolved_slots} не удалось подобрать по заданным условиям.`
      : `Сформированы все ${result.resolved_post_count} запрошенные зоны.`);
  const profileLabel =
    run.request.sensitivity_mode === "standard"
      ? "Исследовательский профиль: периоды ERA5, сетка и радиус"
      : "Основной расчёт пространственного охвата";
  const sizeRule =
    run.request.network_size_mode === "required_network_size"
      ? `ровно ${run.request.post_count} зон при наличии допустимых кандидатов`
      : `не более ${run.request.post_count} зон`;
  const stabilityLabel =
    run.request.sensitivity_mode === "standard"
      ? `Сравнение периодов ERA5, сетки ${run.request.sensitivity_grid_km.join(" / ")} км и радиусов ${run.request.sensitivity_radii_m.map((radius) => radius / 1000).join(" / ")} км`
      : "Один расчёт без дополнительных вариантов";
  const normativeSource =
    result.normative_requirements?.source || "источник не указан";
  const requirement = result.normative_requirements;
  const populationEvidence = requirement?.population_evidence;
  const currentRequirement =
    requirement?.reference_status === "current_requirement";
  const normativeSummary =
    requirement?.reference_status === "preliminary_model"
      ? `WorldPop: ${requirement.population == null ? "—" : Math.round(requirement.population).toLocaleString("ru-RU")} жителей в границе территории; год: ${requirement.population_dataset?.reference_year ?? "не указан"}. Предварительный ориентир: ${requirement.minimum ?? "—"} постов по шкале п. 158 приказа № 524. Нормативное соответствие не оценивалось.`
      : currentRequirement
        ? requirement.status === "ready" && populationEvidence?.confirmed
          ? `Минимум: ${requirement.minimum} стационарных постов. Подтверждённая численность: ${populationEvidence.population.toLocaleString("ru-RU")} на ${populationEvidence.as_of}. Источник: ${populationEvidence.source_name} (${populationEvidence.source_url}). Источник проверен пользователем для выбранного поселения. Статус численной сверки: ${{ meets: "численный минимум выполнен", below_minimum: "ниже минимума", above_maximum: "выше сохранённого верхнего ориентира", unknown: "не определён" }[requirement.compliance] ?? "не определён"}; дефицит: ${requirement.deficit ?? "—"}.`
          : "Сверка по приказу № 524 не выполнена: нет подтверждённой численности выбранного поселения."
        : historicalPostCount == null
          ? "В сохранённом результате нет численного ориентира по количеству постов."
          : `Сохранённое число ${historicalPostCount} получено по историческому источнику: ${normativeSource}. Исторический ориентир не используется для подтверждения соответствия действующим требованиям.`;
  const coverage = result.coverage_summary;
  const populationTotal = coverage?.population_total ?? null;
  const populationCovered = coverage?.total_covered_population ?? null;
  const coverageShare =
    populationTotal && populationCovered != null
      ? Math.max(0, Math.min(100, (populationCovered / populationTotal) * 100))
      : null;
  const formatPopulation = (value: number | null | undefined) =>
    value == null ? "—" : Math.round(value).toLocaleString("ru-RU");
  const completedAt = run.completed_at || run.created_at;
  const formattedCompletedAt =
    completedAt && !Number.isNaN(Date.parse(completedAt))
      ? new Date(completedAt).toLocaleString("ru-RU")
      : completedAt;
  const modeExplanation = (
    {
      population_coverage:
        "Целевая функция максимизирует охват населения в пределах заданного радиуса без повторного учёта пересечений.",
      industrial_influence:
        "При выборе учитываются население и пространственные признаки промышленного окружения: расстояние до объектов и статистика направлений ветра ERA5.",
      transport_influence:
        "При выборе учитываются население, класс и расстояние до транспортных объектов OpenStreetMap. Интенсивность движения по этим признакам не определяется.",
      urban_background:
        "При выборе учитываются население и удалённость от выраженных промышленных и транспортных объектов. Фоновая представительность площадки требует отдельного обоснования.",
      integrated_screening:
        "При выборе используется совокупный показатель населения, промышленного и транспортного окружения и признаков городского фона. Коэффициенты являются параметрами аналитической методики.",
    } satisfies Record<NetworkPlacementMode, string>
  )[run.request.placement_mode];
  const classificationText =
    "После расчёта зоны дополнительно описываются по городским условиям, близости к магистралям и промышленным объектам. Эти признаки помогают понять контекст зоны, но не подтверждают нормативную пригодность конкретной площадки.";
  const sensitivityInterpretation = run.sensitivity?.variants?.length
    ? `Доля совпадений определяется по числу исходных точек, воспроизведённых в другом варианте в пределах ${run.sensitivity.matching_distance_km ?? 1.5} км. Показатель характеризует чувствительность пространственного выбора к изменению параметров.`
    : "Проверка устойчивости не запускалась: процент совпадения для этого отчёта не рассчитывался.";
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="air-sgm-report-kind" content="network-design">
  <title>Выбор зон размещения постов · ${escapeReportHtml(run.readiness.territory.name)}</title>
  <style>
    @page{size:A4 portrait;margin:14mm}
    *{box-sizing:border-box}
    :root{color-scheme:light;--ink:#18324b;--muted:#60758a;--blue:#1769aa;--blue-dark:#104b7a;--line:#dbe5ed;--soft:#f2f7fa;--teal:#dff3ec;--amber:#fff4d9}
    body{width:100%;max-width:1680px;margin:0 auto;padding:clamp(16px,2vw,28px) clamp(12px,2vw,32px) 56px;font:16px/1.55 Arial,sans-serif;color:var(--ink);background:#f4f7f9}
    h1,h2,h3,p{margin-top:0}
    h1{max-width:1000px;margin:10px 0 14px;font-size:clamp(26px,3vw,34px);line-height:1.2;letter-spacing:-.02em}
    h2{margin:0 0 16px;font-size:24px;line-height:1.2;letter-spacing:-.02em}
    h3{margin:0 0 8px;font-size:18px}
    a{color:#075b9a}
    .toolbar{position:sticky;z-index:10;top:0;display:flex;justify-content:flex-end;padding:8px 0;background:#f4f7f9e8}
    .toolbar button{padding:11px 17px;color:#fff;background:#145f98;border:0;border-radius:9px;font:inherit;font-weight:700;cursor:pointer}
    .hero,.panel{border:1px solid var(--line);border-radius:18px;background:#fff;box-shadow:0 10px 30px #17324b0a}
    .hero{display:block;padding:24px;background:#fff}
    .hero-stamp{display:none}
    .report-data-quality{margin-top:18px;padding:16px 18px;border-left:3px solid #9bb7cb;background:#f5f8fa;font-size:14px}
    .report-data-quality h3{font-size:16px}.report-data-quality p:last-child{margin-bottom:0}
    .eyebrow{color:var(--blue);font-size:12px;font-weight:700;letter-spacing:.13em;text-transform:uppercase}
    .lead{max-width:720px;color:#435c70;font-size:19px}
    .hero-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}
    .hero-meta span{padding:8px 11px;border:1px solid var(--line);border-radius:8px;background:#ffffffc9;color:#344f66}
    .hero-meta b{color:var(--ink)}
    .hero-stamp{align-self:start;padding:20px;border:1px solid #c8e2d8;border-radius:14px;background:#eef8f4}
    .hero-stamp span,.kpi-label{display:block;color:var(--muted);font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
    .hero-stamp strong{display:block;margin:9px 0;color:#17664f;font-size:20px;line-height:1.2}
    .hero-stamp p{margin:0;color:#476557;font-size:14px}
    main{display:grid;gap:22px;margin-top:22px}
    .panel{padding:26px}
    .section-intro{max-width:800px;margin-bottom:18px;color:var(--muted)}
    .kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .kpi{min-height:132px;padding:18px;border:1px solid var(--line);border-radius:13px;background:var(--soft)}
    .kpi strong{display:block;margin:12px 0 4px;color:var(--blue-dark);font-size:clamp(24px,3vw,34px);line-height:1.05}
    .kpi span:last-child{color:#52697d;font-size:14px}
    .plain-note{margin:16px 0 0;padding:14px 16px;border-left:4px solid #d69b29;border-radius:7px;background:var(--amber);color:#594923}
    .map-wrap{display:flex;position:relative;height:clamp(420px,65vh,680px);min-height:360px;overflow:hidden;border:1px solid #cad8e1;border-radius:13px;background:#eaf0f3}
    .map{flex:1;height:auto;min-width:0;min-height:360px}
    .map-fallback{position:absolute;inset:0;display:grid;place-content:center;padding:30px;text-align:center;color:#52697d;background:#eaf0f3}
    .map-toolbar{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:12px;margin:0 0 14px}
    .map-toolbar label{display:grid;gap:5px;color:var(--muted);font-size:12px;font-weight:700}
    .map-toolbar select{min-width:min(360px,80vw);padding:10px 12px;border:1px solid #cbd9e4;border-radius:9px;background:#fff;color:var(--ink);font:inherit;font-size:14px}
    .map-toolbar p{margin:0;color:var(--muted);font-size:13px}
    .map-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,310px);gap:16px;align-items:stretch}
    .map-inspector{min-width:0;padding:18px;border:1px solid var(--line);border-radius:13px;background:#fbfdfe}
    .map-inspector .eyebrow{display:block;margin-bottom:6px}
    .map-inspector h3{margin:0 0 5px;color:var(--ink);font-size:19px}
    .map-inspector>p{margin:0 0 13px;color:var(--muted);font-size:12px}
    .map-inspector h4{margin:16px 0 4px;font-size:14px}
    .map-point-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .map-point-metrics>div{padding:10px;border:1px solid var(--line);border-radius:9px;background:#fff}
    .map-point-metrics small,.map-point-metrics span{display:block;color:var(--muted);font-size:11px}
    .map-point-metrics strong{display:block;margin:4px 0;color:var(--blue-dark);font-size:18px}
    .map-point-role{margin-top:8px;padding:9px 10px;border-radius:8px;background:#edf5fa;font-size:12px}
    .map-point-role b{display:block;margin-bottom:3px;color:var(--muted);font-size:10px;text-transform:uppercase}
    .map-wind-meta{font-size:11px!important;line-height:1.45}
    .map-wind-rose{display:grid;place-items:center;min-height:190px}
    .map-wind-rose svg{display:block;width:min(100%,230px);height:auto;overflow:visible}
    .map-wind-legend{display:flex;flex-wrap:wrap;gap:5px 10px;color:var(--muted);font-size:10px}
    .map-wind-legend span{white-space:nowrap}
    .map-wind-legend i{display:inline-block;width:8px;height:8px;margin-right:4px;border-radius:50%}
    .map-inspector .map-wind-note{margin-top:9px;font-size:10px}
    .report-map-popup{display:grid;gap:5px;min-width:170px;max-width:260px;color:var(--ink);font:12px/1.4 Arial,sans-serif}
    .report-map-popup strong{font-size:13px}
    .report-map-popup span,.report-map-popup small{color:#52697d}
    .map-note{margin:10px 0 0;color:var(--muted);font-size:13px}
    .legend{display:flex;flex-wrap:wrap;gap:10px 20px;margin:14px 0 0;color:#435c70;font-size:14px}
    .dot,.box{display:inline-block;width:11px;height:11px;margin-right:7px;vertical-align:-1px}
    .dot{border-radius:50%}.box{border:2px solid}
    .table-wrap{overflow-x:auto}
    table{width:100%;margin:12px 0 0;border-collapse:collapse;font-size:14px}
    th,td{padding:13px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
    th{color:#425c70;background:#f3f7fa;font-size:12px;letter-spacing:.04em;text-transform:uppercase}
    td small{display:block;margin-top:4px;color:var(--muted);font-size:12px}
    .checklist{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:0;list-style:none;counter-reset:steps}
    .checklist li{position:relative;min-height:122px;padding:17px 17px 17px 56px;border:1px solid var(--line);border-radius:12px;background:#fbfcfd;counter-increment:steps}
    .checklist li:before{position:absolute;left:16px;top:16px;display:grid;width:27px;height:27px;place-items:center;border-radius:50%;background:#e3f0f7;color:var(--blue-dark);font-weight:700;content:counter(steps)}
    .checklist b{display:block;margin-bottom:5px}
    .checklist span{color:#52697d;font-size:14px}
    .decision-box{padding:19px;border-radius:12px;background:#eaf4f8}
    .decision-box p:last-child{margin-bottom:0}
    .technical{border:1px solid var(--line);border-radius:14px;background:#fff}
    .technical>summary{padding:20px 24px;color:var(--blue-dark);font-weight:700;cursor:pointer}
    .technical-content{padding:0 24px 24px}
    .technical-content h2{margin-top:26px;font-size:20px}
    .method{padding:16px;border:1px solid var(--line);border-radius:10px;background:#f7fafc}
    .method ol{padding-left:24px}
    .notice{padding:15px;border:1px solid #ead9a8;border-radius:9px;background:#fff9e9}
    .rose-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .rose-card{padding:14px;border:1px solid var(--line);border-radius:10px;background:#f8fbfd}
    .rose-card h3,.rose-card p{margin:0 0 8px}
    .rose-bars{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 14px}
    .rose-row{display:grid;grid-template-columns:36px 1fr 42px;gap:7px;align-items:center;font-size:11px}
    .rose-row i{height:7px;overflow:hidden;background:#e1eaf0;border-radius:6px}
    .rose-row b{display:block;height:100%;background:#2f6fed}
    .rose-row em{font-style:normal;text-align:right}
    .hash{max-width:260px;overflow-wrap:anywhere;font:11px/1.4 Consolas,monospace}
    pre{max-height:420px;overflow:auto;padding:16px;color:#e5edf6;background:#122b42;font:11px/1.4 Consolas,monospace;white-space:pre-wrap}
    @media(max-width:960px){.map-layout{grid-template-columns:1fr}.map-inspector{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}.map-inspector h4,.map-inspector .map-wind-meta,.map-inspector .map-wind-rose,.map-inspector .map-wind-legend,.map-inspector .map-wind-note{grid-column:1/-1}}
    @media(max-width:760px){body{padding:12px 12px 36px}.hero{grid-template-columns:1fr;padding:24px}.hero-stamp{max-width:none}.panel{padding:19px}.kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.checklist,.rose-grid{grid-template-columns:1fr}.map-layout{grid-template-columns:1fr}.map-inspector{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}.map-inspector h4,.map-inspector .map-wind-meta,.map-inspector .map-wind-rose,.map-inspector .map-wind-legend,.map-inspector .map-wind-note{grid-column:1/-1}.map{min-height:320px}}
    @media(max-width:430px){.kpi-grid{grid-template-columns:1fr}.hero-meta{display:grid}.hero-meta span{width:100%}.map-inspector{display:block}.map-inspector>*{min-width:0;overflow-wrap:anywhere}.map-point-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.technical-content{padding:0 14px 18px;overflow-wrap:anywhere}}
    @media print{body{max-width:none;padding:0;background:#fff;font-size:11pt}.toolbar,.map-toolbar{display:none}.hero,.panel{box-shadow:none;break-inside:avoid}.hero{padding:20px}.panel{padding:18px}.map-layout{grid-template-columns:1fr}.map-inspector{display:none}.map{height:95mm;min-height:0}.technical:not([open]){display:none}.technical[open]{break-before:page}.checklist{grid-template-columns:repeat(2,1fr)}a{color:inherit;text-decoration:none}}
  </style>
</head>
<body>
  ${run.demo_baseline ? `<div style="padding:18px;background:#fff1d8;color:#765000"><strong>Исследовательский сценарий с пустым исходным реестром.</strong> ${escapeReportHtml(run.demo_baseline.note)}</div>` : ""}
  ${run.demo_transport_snapshot ? `<div style="padding:18px;background:#eef6ff;color:#284364"><strong>Местные дороги OSM · расширенный транспортный критерий.</strong> ${escapeReportHtml(run.demo_transport_snapshot.note)} Объектов: ${run.demo_transport_snapshot.road_count}. Источник: ${escapeReportHtml(run.demo_transport_snapshot.provider)}. Дата загрузки: ${escapeReportHtml(run.demo_transport_snapshot.fetched_at)}.</div>` : ""}


  <header class="hero">
    <div>
      <div class="eyebrow">AIR SGM · планирование мониторинга воздуха</div>
      <h1>Предварительный выбор зон размещения постов мониторинга атмосферного воздуха</h1>
      <p class="lead">В отчёте представлены результаты пространственного выбора зон по заданному критерию размещения. Выбор конкретных площадок требует натурного обследования и оценки условий проведения наблюдений.</p>
      <div class="hero-meta">
        <span><b>Территория:</b> ${escapeReportHtml(run.readiness.territory.name)}</span>
        <span><b>Дата расчёта:</b> ${escapeReportHtml(formattedCompletedAt || "не указана")}</span>
        <span><b>Режим:</b> ${escapeReportHtml(modeLabel)}</span>
      </div>
    </div>
    <aside class="hero-stamp">
      <span>Результат</span>
      <strong>Предварительные зоны размещения</strong>
      <p>Назначение результата — подготовка обследования и обоснование выбора площадок.</p>
    </aside>
  </header>

  <main>
    <section class="panel">
      <h2>Основные результаты расчёта</h2>
      <p class="section-intro">${escapeReportHtml(unresolvedText)} Критерий размещения: ${escapeReportHtml(PLACEMENT_MODES[run.request.placement_mode].title)}. Шаг сетки: ${run.request.grid_km} км; радиус анализа: ${run.request.radius_m / 1000} км.</p>
      <div class="kpi-grid">
        <article class="kpi"><span class="kpi-label">Расчётные зоны размещения</span><strong>${result.resolved_post_count}</strong><span>предварительные координаты центров зон</span></article>
        <article class="kpi"><span class="kpi-label">Дополнительный охват</span><strong>${formatPopulation(coverage?.additional_covered_population)}</strong><span>модельная оценка жителей</span></article>
        <article class="kpi"><span class="kpi-label">Доля охвата на расчётной сетке</span><strong>${coverageShare == null ? "—" : `${coverageShare.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`}</strong><span>от численности населения расчётной сетки</span></article>
        <article class="kpi"><span class="kpi-label">Население вне зон охвата</span><strong>${formatPopulation(coverage?.remaining_uncovered_population)}</strong><span>модельная оценка жителей</span></article>
      </div>
      ${networkReportQualityHtml(run)}
    </section>

    <section class="panel">
      <h2>Пространственное размещение расчётных зон</h2>
      <p class="section-intro">Синие маркеры — основные расчётные зоны; оранжевые — альтернативы. ${territoryWind ? "Роза ветров едина для территории. Выберите маркер, чтобы увидеть секторы прихода ветра и связанные с точкой объекты." : "Выберите маркер, чтобы переключить розу ветров и связанные с точкой объекты."}</p>
      <div class="map-layout">
        <div class="map-wrap"><div id="map" class="map"></div><div id="map-fallback" class="map-fallback">Загружаем карту. Если она не появится, используйте координаты из таблицы ниже.</div></div>
        <aside class="map-inspector" aria-label="Сведения о выбранной расчётной точке">
          <span class="eyebrow" id="map-point-kind">${initialMapCandidate?.kind === "alternative" ? "АЛЬТЕРНАТИВНАЯ ТОЧКА" : "ОСНОВНАЯ ТОЧКА"}</span>
          <h3 id="map-point-title">${initialMapCandidate ? escapeReportHtml(initialMapCandidate.kind === "alternative" ? `Альтернатива А${initialMapCandidate.rank}` : `Зона ${initialMapCandidate.zone_code ?? initialMapCandidate.rank}`) : "Точка не выбрана"}</h3>
          <p id="map-point-coordinates">${initialMapCandidate ? `${initialMapCandidate.latitude.toFixed(5)}, ${initialMapCandidate.longitude.toFixed(5)}` : "Координаты недоступны"}</p>
          <div class="map-point-metrics">
            <div><small>Дополнительный охват</small><strong id="map-point-population">${initialMapCandidate ? Math.round(initialMapCandidate.newly_covered_population).toLocaleString("ru-RU") : "—"}</strong><span>человек по модели</span></div>
            <div><small>Новые ячейки</small><strong id="map-point-cells">${initialMapCandidate?.newly_covered_cells ?? "—"}</strong><span>дополнительно включены в охват</span></div>
          </div>
          <div class="map-point-role"><b>Пространственная характеристика</b><span id="map-point-role">${escapeReportHtml(initialMapCandidate?.role_label ?? "Нет оценки")}</span></div>
          <h4>${territoryWind ? "Роза ветров территории · ERA5" : "Роза ветров ERA5"}</h4>
          <p class="map-wind-meta" id="map-wind-meta">${territoryWind ? "Единая статистика ветра территории для всех точек." : "Показана для выбранной точки; это статистика ветра, не модель переноса загрязнений."}</p>
          <div class="map-wind-rose" id="map-wind-rose">Для построения розы нужны метеоданные.</div>
          <div class="map-wind-legend" id="map-wind-legend"></div>
          <p class="map-wind-note">Сектор показывает самый частый ветер, стрелки — приход воздуха к выбранной точке. Размер сектора условный; дальность переноса загрязнения не рассчитана. Связь с объектом по ветру — справочный признак.</p>
        </aside>
      </div>
      <div class="legend"><span><i class="box" style="border-color:#155ea8;background:#2e72db18"></i>граница территории</span><span><i class="box" style="border-color:#246fe5;background:#246fe533"></i>кандидатная зона</span>${run.request.planning_mode === "new_network" ? "" : '<span><i class="dot" style="background:#0f8a68"></i>действующий стационарный пост</span><span><i class="dot" style="background:#c2410c"></i>маршрутный пост</span>'}<span><i class="dot" style="background:#246fe5"></i>основная точка</span>${alternativeRows ? '<span><i class="dot" style="background:#f59e0b"></i>альтернативная точка</span>' : ""}<span><i class="dot" style="background:transparent;border:1.5px dashed #2878e8"></i>радиус анализа ${run.request.radius_m / 1000} км</span><span><i class="box" style="border-color:#20a464;background:#20a46420"></i>ветровой сектор выбранной точки</span><span><i class="box" style="border-color:#8246a8;border-style:dashed"></i>связи с объектами выбранной точки</span></div>
      <p><a id="map-osm-link" href="https://www.openstreetmap.org/" target="_blank" rel="noopener noreferrer">Открыть выбранную точку в OpenStreetMap</a></p>
      <p class="map-note" id="map-status">Координата — центр расчётной зоны, а не точка, одобренная для установки прибора. Для поиска на местности используйте таблицу ниже и карту с подложкой.</p>
    </section>

    <section class="panel">
      <h2>Характеристики расчётных зон</h2>
      <p class="section-intro">Прирост охвата — модельная численность населения, дополнительно включённого в охват при последовательном добавлении зон. Пересечения учитываются однократно. Значение зависит от порядка включения зон и не является независимой оценкой значимости площадки.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Зона</th><th>Координаты центра зоны</th><th>Прирост охвата при включении, чел.</th></tr></thead>
          <tbody>${roleRows || '<tr><td colspan="3">Расчётные зоны не сформированы.</td></tr>'}</tbody>
        </table>
      </div>
      ${alternativeRows ? '<p class="map-note">Резервные варианты и причины их появления приведены в технических сведениях ниже. Не прибавляйте их к числу основных зон.</p>' : ""}
    </section>

    ${networkReportConclusionHtml(run)}
    <section class="panel">
      <h2>Условия выбора конкретных площадок</h2>
      <p class="section-intro">При выборе площадки необходимо установить цель наблюдений, требуемый масштаб пространственной репрезентативности и условия размещения оборудования. Перечень последующих работ приведён ниже.</p>
      <ol class="checklist">
        <li><b>Цель и программа наблюдений</b><span>Определение контролируемых веществ, временного разрешения и масштаба пространственной репрезентативности с учётом инвентаризации выбросов и результатов предварительных исследований.</span></li>
        <li><b>Натурное обследование</b><span>Сопоставление доступных площадок внутри зоны; фиксация координат, окружающей застройки, растительности, рельефа и локальных источников.</span></li>
        <li><b>Условия отбора проб</b><span>Оценка препятствий воздушному потоку, высоты и расположения пробоотборника, расстояний до дорог и источников применительно к цели наблюдений и методам измерений.</span></li>
        <li><b>Правовые и эксплуатационные условия</b><span>Установление возможности размещения, доступа для обслуживания, электроснабжения, связи и обеспечения безопасности оборудования и персонала.</span></li>
        <li><b>Обеспечение качества измерений</b><span>Выбор методов и средств измерений, процедур поверки, калибровки, контроля качества и проверки данных.</span></li>
        <li><b>Документирование выбора</b><span>Подготовка схемы и фотоматериалов площадки, обоснования её представительности, программы наблюдений и перечня ответственных организаций.</span></li>
      </ol>
      <div class="decision-box">
        <p><b>Область применимости.</b> Результат характеризует геометрический охват населения при заданных параметрах и доступных исходных данных. Радиус анализа не является радиусом представительности измерений.</p>
        <p>Концентрации загрязняющих веществ, экспозиция и риск для здоровья не рассчитываются. Соответствие качества воздуха нормативам и пригодность конкретных площадок по результатам этого расчёта не устанавливаются.</p>
      </div>
      <p class="plain-note"><b>Нормативная оговорка.</b> Сверка по п. 158 приказа № 524 относится только к количеству стационарных постов и выполняется при наличии подтверждённой численности поселения. Она не подтверждает пригодность площадок или полное соответствие сети. Срок действия опубликованного приказа — до 1 января 2027 года. <a href="https://dfo.meteorf.gov.ru/upload/iblock/f34/t68xx4j8lus52u7bjt002lpavd1xcxf2/6obutvergdenii524.pdf" target="_blank" rel="noopener">Открыть приказ № 524</a>.</p>
    </section>

    <details class="technical">
      <summary>Технические сведения: методика, источники данных и воспроизводимость</summary>
      <div class="technical-content">
        <h2>Паспорт расчёта</h2>
        <div class="table-wrap"><table><tbody>
          <tr><th>Идентификатор</th><td>${escapeReportHtml(run.id)}</td><th>Версия методики</th><td>${escapeReportHtml(run.methodology_version)}</td></tr>
          <tr><th>Критерий выбора</th><td>${escapeReportHtml(PLACEMENT_MODES[run.request.placement_mode].title)}</td><th>Метеопрофиль</th><td>${escapeReportHtml(METEO_PROFILES[run.request.meteo_profile])}</td></tr>
          <tr><th>Целевой размер</th><td>${escapeReportHtml(sizeRule)}</td><th>Сетка / радиус</th><td>${run.request.grid_km} км / ${run.request.radius_m / 1000} км</td></tr>
          <tr><th>Маски исключений</th><td colspan="3">${run.request.use_exclusion_masks ? "Применяются" : "Не применяются"}</td></tr>
          <tr><th>Профиль проверки устойчивости</th><td colspan="3">${escapeReportHtml(stabilityLabel)}</td></tr>
        </tbody></table></div>
        <p>Профиль расчёта: ${escapeReportHtml(profileLabel)}. ${escapeReportHtml(modeExplanation)} Показатели численности населения приведены отдельно от целевой функции. Классификация окружения выполняется после выбора зон.</p>
        ${run.request.placement_mode === "integrated_screening" ? "<p>Коэффициенты комплексного показателя: население — 45%, промышленное окружение — 25%, транспортное окружение — 20%, городской фон — 10%. Коэффициенты не являются долями вклада источников в загрязнение воздуха.</p>" : ""}
        ${result.placement_evidence?.industrial?.osm_industrial_area_count != null ? `<p>Промышленных площадок OSM в расчёте: ${escapeReportHtml(result.placement_evidence.industrial.osm_industrial_area_count)}. Способ определения координат: ${escapeReportHtml(result.placement_evidence.industrial.osm_coordinate_policy ?? "не сохранён")}; это предварительный признак, не подтверждённый источник выбросов.</p>` : ""}
        ${result.placement_evidence?.transport?.class_weights ? `<p>Транспортный фактор OSM учитывает магистрали, действующие железные дороги и аэропорты. Вес класса: автомагистраль 1; магистральная дорога 0,75; основная дорога, железная дорога и аэропорт 0,5. Близость: до 100 м — 1; до 300 м — 2/3; до 500 м — 1/3; дальше — 0. Внутри контура аэропорта расстояние равно нулю. Берётся максимальный сигнал, объекты не суммируются. Эти веса являются аналитическими настройками, а не оценкой объёмов выбросов.</p>` : ""}

        <h2>Методика пространственного выбора зон</h2>
        <div class="method">
          <p><b>Режим:</b> ${escapeReportHtml(modeLabel)}.</p>
          <ol>
            <li>Территория представлена сеткой ${run.request.grid_km} км; оценка населения взята из пространственной модели WorldPop, кандидаты ограничены жилой застройкой.</li>
            <li>Если настройка включена, применяются маски исключения для неподходящих ячеек.</li>
            <li>Подбирается ${sizeRule} с целью увеличить охват в аналитическом радиусе ${run.request.radius_m / 1000} км и не учитывать повторно уже покрытые ячейки.</li>
            <li>${escapeReportHtml(classificationText)}</li>
            <li>${run.request.sensitivity_mode === "standard" ? "Дополнительные расчёты сравнивают метеорологические периоды, шаг сетки и радиус; нестабильные варианты показаны отдельно." : "В быстром профиле выполнен один расчёт без дополнительных вариантов."}</li>
          </ol>
          ${networkReportSolverHtml(run)}
        </div>

        <h2>Предварительная классификация зон по пространственным признакам</h2>
        <p>Классификация описывает окружение выбранных зон по доступным пространственным данным. Тип поста и его представительность устанавливаются при разработке программы наблюдений. Отсутствие классификации означает недостаточность признаков.</p>
        <div class="table-wrap"><table><thead><tr><th>Роль</th><th>Основных зон</th><th>Дополнительных признаков</th><th>Основание или пробел данных</th></tr></thead><tbody>${roleSummaryRows}</tbody></table></div>

        ${alternativeRows ? `<h2>Резервные расчётные зоны</h2><p>Эти точки появлялись в отдельных метеорологических или геометрических вариантах и не входят в основной набор.</p><div class="table-wrap"><table><thead><tr><th>№</th><th>Координаты</th><th>Почему показана</th><th>Устойчивость</th><th>Дальнейшая проверка</th></tr></thead><tbody>${alternativeRows}</tbody></table></div>` : ""}

        <h2>Промышленное окружение и метеорологические характеристики</h2>
        <p>Реестровые объекты и направления ветра помогают подготовить выезд, но не доказывают влияние источника. Ветер — статистическое описание ERA5, а не моделирование переноса загрязнения.</p>
        <div class="table-wrap"><table><thead><tr><th>Зона</th><th>Объект</th><th>Расстояние, км</th><th>Направление к объекту</th><th>Частота ветра из сектора</th><th>Комментарий</th></tr></thead><tbody>${sourceRows || '<tr><td colspan="6">В подключённых реестрах нет объектов для отображения или данные недоступны.</td></tr>'}</tbody></table></div>
        <p class="notice">Некоторые специализированные реестры могут быть не подключены. Отсутствие слоя в данных не означает отсутствия объектов на местности.</p>
        <h3>${territoryWind ? "Единая роза ветров территории" : "Розы ветров по расчётным зонам"}</h3>
        ${territoryWind ? `<p>Единая статистика для всех точек территории. Период: ${escapeReportHtml(sharedWindContext?.period.period_start)} — ${escapeReportHtml(sharedWindContext?.period.period_end)}. Сетка ERA5 0,25°. Частоты объединены с весами по площади пересечения ячеек с границей территории. Ветер между зданиями не учитывается. Близкими считаются направления в пределах 0,5 процентного пункта от максимума. Общая шкала графиков: 0–${windScaleMaximum}%.</p>` : ""}
        <div class="rose-grid">${windRoseCards || '<article class="rose-card">Данные о ветре для выбранного периода недоступны.</article>'}</div>
        ${windDiagnostics ? `<details><summary>Диагностика исходных ячеек ERA5</summary><label><input type="checkbox" id="show-wind-cells"> Показать границы ячеек внутри территории на карте</label><div class="rose-grid">${windDiagnostics}</div></details>` : ""}
        <p class="map-note">Штиль выделен отдельно. Роза ветров не является расчётом концентраций или переноса примеси.</p>

        <h2>Количество постов и нормативная сверка</h2>
        <div class="method">
          <p><b>План сети:</b> ${
            isExpand
              ? `в исходном наборе учтено ${baselinePosts} стационарных постов; расчёт предлагает добавить ${additionalPosts}, всего ${projectedNetworkSize}.`
              : `расчёт предлагает ${additionalPosts} новых постов; существующая сеть в этом режиме не уменьшает это число.`
          }</p>
          <p>${escapeReportHtml(normativeSummary)}</p>
          <p>Сохранённый источник численного ориентира: ${escapeReportHtml(normativeSource)}. При использовании модельной численности населения нормативная сверка не считается выполненной.</p>
        </div>

        <h2>Слои данных</h2>
        <div class="table-wrap"><table><thead><tr><th>Слой</th><th>Состояние</th><th>Зачем использован</th><th>Состав</th></tr></thead><tbody>${layerRows}</tbody></table></div>

        ${networkPlanningDiagnosticsHtml(run)}
        <h2>Устойчивость размещения</h2>
        <p>Доля совпадения показывает, как часто те же зоны появляются при изменении шага сетки и радиуса. Она описывает стабильность пространственного результата, а не точность измерений.</p>
        <div class="table-wrap"><table><thead><tr><th>Шаг сетки, км</th><th>Радиус, км</th><th>Зон подобрано</th><th>Повторились</th><th>Совпадение</th></tr></thead><tbody>${sensitivityRows || '<tr><td colspan="5">Дополнительные расчёты не выполнялись.</td></tr>'}</tbody></table></div>
        <p class="notice">${escapeReportHtml(sensitivityInterpretation)}</p>

        <h2>Трассировка расчёта</h2>
        <p>Статус: ${run.status === "completed" ? "расчёт завершён" : "см. паспорт запуска"}; длительность: ${run.calculation_duration_seconds == null ? "не записана" : `${run.calculation_duration_seconds.toLocaleString("ru-RU")} с`}; ожидание очереди: ${run.queue_wait_seconds == null ? "не записано" : `${run.queue_wait_seconds.toLocaleString("ru-RU")} с`}.</p>
      </div>
    </details>
  </main>
  <style>${reportMapLibreCss}</style>
  <script>${reportMapLibreJs.replaceAll("</script", "<\\/script")}</script>
  <script id="map-data" type="application/json">${mapPayload}</script>
  <script>
  (function(){
    var fallback=document.getElementById("map-fallback");
    var mapStatus=document.getElementById("map-status");
    var data=JSON.parse(document.getElementById("map-data").textContent);
    var pointSelect=document.getElementById("map-point-select");
    var mapPoints=data.candidates||[];
    var selectedPointId=pointSelect?pointSelect.value:(mapPoints.length?String(mapPoints[0].id):"");
    var reportMapMode="schema";
    var map=null;
    var mapReady=false;
    var popup=null;
    var speedColors=["#2f6fed","#35a6df","#20a972","#e9a320","#e45745"];
    function number(value,digits){var parsed=Number(value);return Number.isFinite(parsed)?parsed.toLocaleString("ru-RU",{maximumFractionDigits:digits||0}):"—"}
    function pointById(id){return mapPoints.find(function(item){return String(item.id)===String(id)})||null}
    function setText(id,value){var node=document.getElementById(id);if(node)node.textContent=value==null?"—":String(value)}
    function svgElement(name,attributes){var node=document.createElementNS("http://www.w3.org/2000/svg",name);Object.keys(attributes||{}).forEach(function(key){node.setAttribute(key,String(attributes[key]))});return node}
    function renderWindRose(context){
      var chart=document.getElementById("map-wind-rose");
      var legend=document.getElementById("map-wind-legend");
      var meta=document.getElementById("map-wind-meta");
      if(!chart||!legend||!meta)return;
      chart.replaceChildren();legend.replaceChildren();
      var windRose=context&&context.wind_rose;
      var directions=windRose&&Array.isArray(windRose.directions)?windRose.directions.slice().sort(function(a,b){return a.index-b.index}):[];
      var bins=directions.length&&Array.isArray(directions[0].bins)?directions[0].bins.slice().sort(function(a,b){return a.min_speed-b.min_speed}):[];
      if(!directions.length||!bins.length){chart.textContent="Метеоданные ERA5 для этой точки не сохранены.";meta.textContent="Ветровой сектор и связи появятся, если в расчёте доступны метеоданные.";return}
      var maximum=Number(data.wind_scale_maximum)||Math.ceil(Math.max(1,...directions.map(function(item){return Number(item.total_frequency)||0}))/5)*5;
      var cx=120,cy=120,maxRadius=78,sectorWidth=360/directions.length;
      var svg=svgElement("svg",{viewBox:"0 0 240 240",role:"img","aria-label":context.wind_statistics_scope==="territory"?"Роза ветров территории":"Роза ветров для выбранной точки"});
      [0.25,0.5,0.75,1].forEach(function(fraction){var radius=maxRadius*fraction;svg.appendChild(svgElement("circle",{cx:cx,cy:cy,r:radius,fill:"none",stroke:"#dce6ef","stroke-width":"1"}));var label=svgElement("text",{x:cx+3,y:cy-radius-2,fill:"#456281","font-size":"9"});label.textContent=number(maximum*fraction,2)+"%";svg.appendChild(label)});
      function at(bearing,radius){var angle=bearing*Math.PI/180;return [cx+Math.sin(angle)*radius,cy-Math.cos(angle)*radius]}
      directions.forEach(function(direction){
        var start=Number(direction.degrees)-sectorWidth/2+sectorWidth*0.06;
        var end=Number(direction.degrees)+sectorWidth/2-sectorWidth*0.06;
        var inner=0;
        (direction.bins||[]).slice().sort(function(a,b){return a.min_speed-b.min_speed}).forEach(function(bin){
          var amount=Math.max(0,Number(bin.frequency)||0);
          if(!amount)return;
          var outer=Math.min(maxRadius,inner+amount/maximum*maxRadius);
          if(outer<=inner)return;
          var p1=at(start,outer),p2=at(end,outer),d;
          if(inner<=0){d="M "+cx+" "+cy+" L "+p1[0]+" "+p1[1]+" A "+outer+" "+outer+" 0 0 1 "+p2[0]+" "+p2[1]+" Z"}
          else{var p3=at(end,inner),p4=at(start,inner);d="M "+p1[0]+" "+p1[1]+" A "+outer+" "+outer+" 0 0 1 "+p2[0]+" "+p2[1]+" L "+p3[0]+" "+p3[1]+" A "+inner+" "+inner+" 0 0 0 "+p4[0]+" "+p4[1]+" Z"}
          var path=svgElement("path",{d:d,fill:speedColors[Math.min(bins.findIndex(function(item){return item.key===bin.key})<0?0:bins.findIndex(function(item){return item.key===bin.key}),speedColors.length-1)],stroke:"#fff","stroke-width":"1"});
          var prevailing=context.prevailing_wind_from_degrees;
          if(prevailing!=null&&Math.abs((((Number(direction.degrees)-Number(prevailing)+180)%360)+360)%360-180)<0.01){path.setAttribute("stroke","#0e6f9f");path.setAttribute("stroke-width","1.7")}
          svg.appendChild(path);inner=outer;
        });
      });
      [[0,"С"],[90,"В"],[180,"Ю"],[270,"З"]].forEach(function(item){var pos=at(item[0],maxRadius+15);var label=svgElement("text",{x:pos[0],y:pos[1],"text-anchor":"middle","dominant-baseline":"middle",fill:"#254566","font-size":"11","font-weight":"700"});label.textContent=item[1];svg.appendChild(label)});
      chart.appendChild(svg);
      bins.forEach(function(bin,index){var item=document.createElement("span");var dot=document.createElement("i");dot.style.backgroundColor=speedColors[Math.min(index,speedColors.length-1)];item.appendChild(dot);item.appendChild(document.createTextNode(String(bin.label)+" м/с"));legend.appendChild(item)});
      var calm=context.calm_fraction==null?"—":number(Number(context.calm_fraction)*100,1)+"%";
      var average=windRose.mean_speed==null?"—":number(windRose.mean_speed,1)+" м/с";
      var observations=context.valid_observation_count==null?"—":number(context.valid_observation_count,0);
      var leaders=windRose.leading_directions||[];
      var directionText=leaders.length>1?"Близкие по частоте: "+leaders.map(function(d){return d.label+" "+number(d.total_frequency,2)+"%"}).join("; "):"Преобладающий ветер: "+(context.prevailing_wind_from||"—");
      var period=context.period||{};
      meta.textContent=directionText+" · средняя скорость: "+average+" · штиль: "+calm+" · часов: "+observations+(context.wind_statistics_scope==="territory"?". Единая для всех точек · "+(period.period_start||"")+" — "+(period.period_end||"")+" · сетка 0,25°; ветер между зданиями не учитывается.":"");
    }
    function updatePointDetails(point){
      var isAlternative=point.kind==="alternative";
      setText("map-point-kind",isAlternative?"АЛЬТЕРНАТИВНАЯ ТОЧКА":"ОСНОВНАЯ ТОЧКА");
      setText("map-point-title",isAlternative?"Альтернатива А"+point.rank:"Зона "+(point.zone_code||point.rank));
      setText("map-point-coordinates",number(point.latitude,5)+", "+number(point.longitude,5));
      setText("map-point-population",number(point.newly_covered_population,0));
      setText("map-point-cells",number(point.newly_covered_cells,0));
      setText("map-point-role",point.role_label||"Нет оценки");
      var osmLink=document.getElementById("map-osm-link");if(osmLink)osmLink.href="https://www.openstreetmap.org/?mlat="+encodeURIComponent(point.latitude)+"&mlon="+encodeURIComponent(point.longitude)+"#map=14/"+point.latitude+"/"+point.longitude;
      renderWindRose(point.context);
    }

    function renderSavedMap(){
      if(!fallback)return;
      fallback.textContent='';fallback.style.cssText='position:absolute;inset:0;display:block;padding:0;background:#f5f8fc';
      var schemaButton=document.getElementById('report-view-schema'),osmButton=document.getElementById('report-view-osm');
      if(schemaButton)schemaButton.setAttribute('aria-pressed',String(reportMapMode==='schema'));
      if(osmButton)osmButton.setAttribute('aria-pressed',String(reportMapMode==='osm'));
      if(mapStatus)mapStatus.textContent='Уличная карта загружается при наличии интернета. Расчётные точки и сохранённые слои доступны без интернета.';
      var svg=svgElement('svg',{viewBox:'0 0 1000 600',width:'100%',height:'100%',role:'img','aria-label':'Схема сети по сохранённым геометриям'});
      var bounds={min_lon:Number(data.bounds.min_lon),max_lon:Number(data.bounds.max_lon),min_lat:Number(data.bounds.min_lat),max_lat:Number(data.bounds.max_lat)};
      function includePoint(lon,lat){if(!Number.isFinite(lon)||!Number.isFinite(lat))return;bounds.min_lon=Math.min(bounds.min_lon,lon);bounds.max_lon=Math.max(bounds.max_lon,lon);bounds.min_lat=Math.min(bounds.min_lat,lat);bounds.max_lat=Math.max(bounds.max_lat,lat);}
      function includeCoordinates(coords){if(!Array.isArray(coords))return;if(coords.length>=2&&typeof coords[0]==='number'&&typeof coords[1]==='number'){includePoint(coords[0],coords[1]);return;}coords.forEach(includeCoordinates);}
      function includeGeometry(geometry){if(!geometry)return;if(geometry.type==='GeometryCollection')(geometry.geometries||[]).forEach(includeGeometry);else includeCoordinates(geometry.coordinates);}
      var visibleContext=pointById(selectedPointId);visibleContext=visibleContext&&visibleContext.context||{};
      [data.population,data.boundary,data.zones,visibleContext.upwind_sector_geojson,visibleContext.flow_arrows_geojson,visibleContext.source_relationships_geojson].forEach(function(layer){collection(layer).features.forEach(function(f){includeGeometry(f.geometry)});});
      (data.candidates||[]).concat(data.stations||[],data.route_stations||[]).forEach(function(point){if(point.longitude!=null&&point.latitude!=null)includePoint(Number(point.longitude),Number(point.latitude));});
      var lon0=bounds.min_lon,lon1=bounds.max_lon;
      function mercator(lat){var value=Math.max(-85,Math.min(85,Number(lat)))*Math.PI/180;return Math.log(Math.tan(Math.PI/4+value/2));}
      var y0=mercator(bounds.min_lat),y1=mercator(bounds.max_lat),scale=Math.min(920/Math.max(.00001,(lon1-lon0)*Math.PI/180),500/Math.max(.00001,y1-y0));
      function project(coord){return [500+(Number(coord[0])-(lon0+lon1)/2)*Math.PI/180*scale,300-(mercator(coord[1])-(y0+y1)/2)*scale];}
      function line(coords,close){return coords.map(function(c,i){var p=project(c);return (i?'L':'M')+p[0].toFixed(2)+','+p[1].toFixed(2)}).join(' ')+(close?' Z':'');}
      function drawGeometry(geometry,fill,stroke,width,opacity){
        if(!geometry)return;
        if(geometry.type==='GeometryCollection'){geometry.geometries.forEach(function(g){drawGeometry(g,fill,stroke,width,opacity)});return;}
        if(geometry.type==='MultiPolygon'){geometry.coordinates.forEach(function(c){drawGeometry({type:'Polygon',coordinates:c},fill,stroke,width,opacity)});return;}
        if(geometry.type==='MultiLineString'){geometry.coordinates.forEach(function(c){drawGeometry({type:'LineString',coordinates:c},fill,stroke,width,opacity)});return;}
        var d=geometry.type==='Polygon'?geometry.coordinates.map(function(r){return line(r,true)}).join(' '):geometry.type==='LineString'?line(geometry.coordinates,false):'';
        if(d)svg.appendChild(svgElement('path',{d:d,fill:geometry.type==='Polygon'?fill:'none',stroke:stroke,'stroke-width':width,'fill-opacity':opacity,'fill-rule':'evenodd','vector-effect':'non-scaling-stroke'}));
      }
      collection(data.population).features.forEach(function(f){var density=Number(f.properties&&f.properties.population_density_km2)||0;var color=density>=10000?'#d84b55':density>=5000?'#f58a5c':density>=1000?'#fdc57a':density>=200?'#fee9a9':'#dcebc5';drawGeometry(f.geometry,color,'#fff',.4,.5)});
      var contextStart=svg.children.length;collection(data.context).features.forEach(function(f){drawGeometry(f.geometry,'#22a06b','#889aab',.8,.08)});var defs=svgElement('defs',{}),clip=svgElement('clipPath',{id:'report-context-clip'});clip.appendChild(svgElement('rect',{x:40,y:50,width:920,height:500}));defs.appendChild(clip);for(var ci=contextStart;ci<svg.children.length;ci++)svg.children[ci].setAttribute('clip-path','url(#report-context-clip)');svg.appendChild(defs);
      collection(data.boundary).features.forEach(function(f){drawGeometry(f.geometry,'#2e72db','#155ea8',2,.03)});
      if(windCellsToggle&&windCellsToggle.checked)collection(data.wind_cells).features.forEach(function(f){drawGeometry(f.geometry,'none','#aa3867',1,1)});
      collection(data.zones).features.forEach(function(f){var color=f.properties&&f.properties.ensemble_role==='alternative'?'#f59e0b':'#246fe5';drawGeometry(f.geometry,color,color,1.2,.12)});
      var selected=pointById(selectedPointId),context=selected&&selected.context||{};
      collection(context.upwind_sector_geojson).features.forEach(function(f){drawGeometry(f.geometry,'#20a464','#20a464',1,.1)});
      collection(context.flow_arrows_geojson).features.forEach(function(f){drawGeometry(f.geometry,'none','#139f70',1.5,1)});
      collection(context.source_relationships_geojson).features.forEach(function(f){drawGeometry(f.geometry,'none','#8246a8',1,1)});
      (data.stations||[]).concat(data.route_stations||[]).forEach(function(p){if(p.longitude==null||p.latitude==null)return;var xy=project([p.longitude,p.latitude]);svg.appendChild(svgElement('circle',{cx:xy[0],cy:xy[1],r:5,fill:'#0f8a68',stroke:'#fff','stroke-width':1.5}));});
      (data.candidates||[]).forEach(function(p){var xy=project([p.longitude,p.latitude]),active=String(p.id)===selectedPointId,color=p.kind==='alternative'?'#f59e0b':'#246fe5',g=svgElement('g',{tabindex:0,role:'button','aria-label':(p.kind==='alternative'?'Альтернатива ':'Зона ')+(p.zone_code||p.rank)});g.style.cursor='pointer';g.appendChild(svgElement('circle',{cx:xy[0],cy:xy[1],r:active?13:10,fill:color,stroke:active?'#0e7490':'#fff','stroke-width':active?3:2}));var text=svgElement('text',{x:xy[0],y:xy[1]+4,'text-anchor':'middle',fill:'#fff','font-size':11,'font-family':'Arial'});text.textContent=(p.kind==='alternative'?'А':'')+p.rank;g.appendChild(text);g.addEventListener('click',function(){updateSelectedPoint(p.id)});g.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();updateSelectedPoint(p.id)}});svg.appendChild(g);});
      var credit=svgElement('text',{x:980,y:588,'text-anchor':'end',fill:'#52697d','font-size':10,'font-family':'Arial'});credit.textContent='Границы и объекты: © OpenStreetMap contributors · Население: WorldPop';svg.appendChild(credit);
      fallback.appendChild(svg);
      var controls=document.createElement('div');controls.className='saved-map-controls';controls.style.cssText='position:absolute;top:10px;left:10px;display:flex;gap:5px';
      var view=[0,0,1000,600];function zoom(factor){var width=view[2]*factor,height=view[3]*factor;view=[view[0]+(view[2]-width)/2,view[1]+(view[3]-height)/2,width,height];svg.setAttribute('viewBox',view.join(' '));}
      [['+','Увеличить',.7],['−','Уменьшить',1.4],['↺','Показать всю схему',0]].forEach(function(c){var button=document.createElement('button');button.type='button';button.textContent=c[0];button.setAttribute('aria-label',c[1]);button.style.cssText='padding:5px 10px;background:#fff;border:1px solid #cad8e1;border-radius:5px;cursor:pointer';button.onclick=function(){if(c[2])zoom(c[2]);else{view=[0,0,1000,600];svg.setAttribute('viewBox',view.join(' '));}};controls.appendChild(button);});fallback.appendChild(controls);
      var drag=null;svg.addEventListener('pointerdown',function(e){if(e.target.closest('[role="button"]'))return;drag=[e.clientX,e.clientY,view.slice()];svg.setPointerCapture(e.pointerId);});svg.addEventListener('pointermove',function(e){if(!drag)return;var box=svg.getBoundingClientRect();view=[drag[2][0]-(e.clientX-drag[0])*drag[2][2]/box.width,drag[2][1]-(e.clientY-drag[1])*drag[2][3]/box.height,drag[2][2],drag[2][3]];svg.setAttribute('viewBox',view.join(' '));});svg.addEventListener('pointerup',function(){drag=null});svg.addEventListener('pointercancel',function(){drag=null});
    }

    function updateSelectedPoint(id){
      var point=pointById(id);if(!point)return;
      selectedPointId=String(point.id);
      if(pointSelect&&pointSelect.value!==selectedPointId)pointSelect.value=selectedPointId;
      updatePointDetails(point);
      if(!mapReady){renderSavedMap();return;}
      var pointSource=map.getSource("points");if(pointSource)pointSource.setData(pointCollection());
      var sourceSource=map.getSource("selected-sources");if(sourceSource)sourceSource.setData(sourceCollection(point.context&&point.context.sources));
      var context=point.context||{};
      var sectorSource=map.getSource("wind-sector");if(sectorSource)sectorSource.setData(collection(context.upwind_sector_geojson));
      var relationSource=map.getSource("relationships");if(relationSource)relationSource.setData(collection(context.source_relationships_geojson));
      var flowSource=map.getSource("flow");if(flowSource)flowSource.setData(collection(context.flow_arrows_geojson));
    }
    if(pointSelect)pointSelect.addEventListener("change",function(){updateSelectedPoint(pointSelect.value)});
    if(window.addEventListener){window.addEventListener('beforeprint',function(){renderSavedMap()});window.addEventListener('afterprint',function(){if(mapReady){fallback.style.display='none';map.resize();}else renderSavedMap();});}

    if(!mapPoints.length){
      if(pointSelect){pointSelect.disabled=true;pointSelect.replaceChildren();var option=document.createElement('option');option.value='';option.textContent=(data.stations||[]).length?'Оценка действующей сети · без новых зон':'Новые зоны отсутствуют в этом расчёте';pointSelect.appendChild(option);}
      setText('map-point-kind','ДЕЙСТВУЮЩАЯ СЕТЬ');setText('map-point-title','Оценка исходного покрытия');setText('map-point-coordinates','Стационарных постов: '+(data.stations||[]).length+' · маршрутных: '+(data.route_stations||[]).length);
      setText('map-point-population','—');setText('map-point-cells','—');setText('map-point-role','Новые зоны не добавлены');
      var territoryLink=document.getElementById('map-osm-link');if(territoryLink){territoryLink.textContent='Открыть территорию в OpenStreetMap';territoryLink.href='https://www.openstreetmap.org/#map=12/'+((Number(data.bounds.min_lat)+Number(data.bounds.max_lat))/2)+'/'+((Number(data.bounds.min_lon)+Number(data.bounds.max_lon))/2);}
      var osmViewButton=document.getElementById('report-view-osm');if(osmViewButton)osmViewButton.textContent='OpenStreetMap · территория';
      ['map-wind-meta','map-wind-rose','map-wind-legend'].forEach(function(id){var node=document.getElementById(id);if(node)node.style.display='none'});
      if(document.querySelectorAll)document.querySelectorAll('.map-inspector h4,.map-inspector .map-wind-note').forEach(function(node){node.style.display='none'});
    }

    var windCellsToggle=document.getElementById("show-wind-cells");
    if(windCellsToggle)windCellsToggle.addEventListener('change',function(){if(mapReady&&map.getLayer('wind-cells-line'))map.setLayoutProperty('wind-cells-line','visibility',windCellsToggle.checked?'visible':'none');else renderSavedMap();});
    updateSelectedPoint(selectedPointId);
    if(!window.maplibregl){renderSavedMap();return}
    try {map=new maplibregl.Map({container:"map",style:"https://tiles.openfreemap.org/styles/liberty",attributionControl:true});} catch(error) {renderSavedMap();return;}
    map.addControl(new maplibregl.NavigationControl({showCompass:false}),"top-left");
    popup=new maplibregl.Popup({closeButton:true,closeOnClick:false,offset:10});
    map.on("error",function(){if(mapStatus)mapStatus.textContent="Подложка или часть карты не загрузилась. Выбор расчётной точки работает; координаты приведены в таблице."});
    function collection(value){
      if(value&&Array.isArray(value.features))return value;
      var features=[];
      if(value&&typeof value==="object")Object.keys(value).forEach(function(key){var item=value[key];if(item&&Array.isArray(item.features))features=features.concat(item.features)});
      return {type:"FeatureCollection",features:features};
    }
    function addGeo(id,value,layers){var source=collection(value);if(!source.features.length)return;map.addSource(id,{type:"geojson",data:source});layers.forEach(function(layer){map.addLayer(Object.assign({source:id},layer))})}
    function addDynamicGeo(id,layers){map.addSource(id,{type:"geojson",data:{type:"FeatureCollection",features:[]}});layers.forEach(function(layer){map.addLayer(Object.assign({source:id},layer))})}
    function pointCollection(){var features=[];function add(items,defaultKind){(items||[]).forEach(function(item,index){var lon=Number(item.longitude),lat=Number(item.latitude),kind=item.kind||defaultKind;if(!Number.isFinite(lon)||!Number.isFinite(lat))return;var id=String(item.id||item.source_id||kind+"-"+index),label=kind==="candidate"?String(item.rank||""):kind==="alternative"?"А"+String(item.rank||""):String(item.name||"");features.push({type:"Feature",geometry:{type:"Point",coordinates:[lon,lat]},properties:{id:id,kind:kind,label:label,name:String(item.name||""),longitude:lon,latitude:lat,selected:id===selectedPointId,rank:item.rank,zone_code:item.zone_code,newly_covered_population:item.newly_covered_population,newly_covered_cells:item.newly_covered_cells,role_label:item.role_label,station_type:item.station_type,operator:item.operator,address:item.address}})})}add(data.stations,"station");add(data.route_stations,"route");add(data.candidates,"candidate");return {type:"FeatureCollection",features:features}}
    function sourceCollection(items){var features=[];(items||[]).forEach(function(item){var lon=Number(item.longitude),lat=Number(item.latitude);if(!Number.isFinite(lon)||!Number.isFinite(lat))return;features.push({type:"Feature",geometry:{type:"Point",coordinates:[lon,lat]},properties:{id:String(item.source_id||item.name),kind:"source",name:String(item.name||"Источник"),type:String(item.type||""),registry:String(item.registry||""),distance_km:item.distance_km,direction:String(item.direction||""),upwind_frequency_percent:item.upwind_frequency_percent,interpretation:String(item.interpretation||"")}})});return {type:"FeatureCollection",features:features}}
    function destination(lon,lat,bearingDeg,distanceKm){var d=distanceKm/6371.0088,b=bearingDeg*Math.PI/180,p=lat*Math.PI/180,l=lon*Math.PI/180,p2=Math.asin(Math.sin(p)*Math.cos(d)+Math.cos(p)*Math.sin(d)*Math.cos(b)),l2=l+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(p),Math.cos(d)-Math.sin(p)*Math.sin(p2));return [((l2*180/Math.PI+540)%360)-180,p2*180/Math.PI]}
    function coverageRings(){var radius=Number(data.coverage_radius_m||0)/1000,features=[];if(radius<=0)return {type:"FeatureCollection",features:features};(data.candidates||[]).forEach(function(item){var ring=[];for(var angle=0;angle<360;angle+=5)ring.push(destination(Number(item.longitude),Number(item.latitude),angle,radius));ring.push(ring[0]);features.push({type:"Feature",geometry:{type:"Polygon",coordinates:[ring]},properties:{kind:item.kind,radius_km:radius}})});return {type:"FeatureCollection",features:features}}
    function escapeHtml(value){return String(value==null?"":value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}
    function popupMarkup(properties){var kind=String(properties.kind||"");if(kind==="candidate"||kind==="alternative"){var title=kind==="alternative"?"Альтернатива А"+properties.rank:"Зона "+(properties.zone_code||properties.rank);return '<div class="report-map-popup"><strong>'+escapeHtml(title)+'</strong><span>Роль: '+escapeHtml(properties.role_label||"нет оценки")+'</span><span>Координаты: '+number(properties.latitude,5)+", "+number(properties.longitude,5)+'</span><span>Дополнительный охват: '+number(properties.newly_covered_population,0)+' чел.</span><small>Центр зоны для обследования, не утверждённое место установки.</small></div>'}if(kind==="source")return '<div class="report-map-popup"><strong>'+escapeHtml(properties.name||"Источник")+'</strong><span>'+escapeHtml(properties.type||"Объект")+' · '+escapeHtml(properties.registry||"реестр не указан")+'</span><span>Расстояние: '+number(properties.distance_km,2)+' км · направление: '+escapeHtml(properties.direction||"—")+'</span><span>Ветер из сектора: '+(properties.upwind_frequency_percent==null?"—":number(properties.upwind_frequency_percent,1)+"%")+'</span><small>'+escapeHtml(properties.interpretation||"")+'</small></div>';var postType=properties.station_type==="stationary"?"Стационарный пост":properties.station_type==="route"?"Маршрутный пост":String(properties.station_type||"Пост наблюдения");return '<div class="report-map-popup"><strong>'+escapeHtml(properties.name||"Пост наблюдения")+'</strong><span>Ведомство: '+escapeHtml(properties.operator||"не указано")+'</span><span>'+escapeHtml(postType)+'</span>'+(properties.address?'<small>'+escapeHtml(properties.address)+'</small>':"")+"</div>"}
    map.on("style.load",function(){
      addGeo("population",data.population,[{id:"population-fill",type:"fill",paint:{"fill-color":["step",["coalesce",["get","population_density_km2"],0],"rgba(239,244,212,.32)",200,"#fee9a9",1000,"#fdc57a",5000,"#f58a5c",10000,"#d84b55"],"fill-opacity":.58}},{id:"population-grid",type:"line",paint:{"line-color":"rgba(255,255,255,.8)","line-opacity":.5,"line-width":.5}}]);
      addGeo("wind-cells",data.wind_cells,[{id:"wind-cells-line",type:"line",layout:{visibility:windCellsToggle&&windCellsToggle.checked?"visible":"none"},paint:{"line-color":"#aa3867","line-width":2,"line-dasharray":[4,2]}}]);
      addGeo("boundary",data.boundary,[{id:"boundary-fill",type:"fill",paint:{"fill-color":"#2e72db","fill-opacity":.03}},{id:"boundary-line",type:"line",paint:{"line-color":"#155ea8","line-width":2.5}}]);
      addGeo("context",data.context,[{id:"context-fill",type:"fill",filter:["==",["geometry-type"],"Polygon"],paint:{"fill-color":"#22a06b","fill-opacity":.08}},{id:"context-line",type:"line",paint:{"line-color":"#c88b25","line-width":1.2,"line-opacity":.6}}]);
      addGeo("zones",data.zones,[{id:"zone-fill",type:"fill",paint:{"fill-color":["case",["==",["get","ensemble_role"],"alternative"],"#f59e0b","#246fe5"],"fill-opacity":.18}},{id:"zone-line",type:"line",paint:{"line-color":["case",["==",["get","ensemble_role"],"alternative"],"#e88906","#246fe5"],"line-width":2}}]);
      addDynamicGeo("wind-sector",[{id:"wind-sector-fill",type:"fill",paint:{"fill-color":"#20a464","fill-opacity":.11}},{id:"wind-sector-line",type:"line",paint:{"line-color":"#20a464","line-width":1.3,"line-dasharray":[3,2]}}]);
      addDynamicGeo("relationships",[{id:"relationship-line",type:"line",paint:{"line-color":"#8246a8","line-width":1,"line-opacity":.55,"line-dasharray":[2,2]}}]);
      addDynamicGeo("flow",[{id:"flow-line",type:"line",paint:{"line-color":"#139f70","line-width":2,"line-opacity":.75}}]);
      addGeo("coverage-rings",coverageRings(),[{id:"coverage-ring-fill",type:"fill",paint:{"fill-color":["case",["==",["get","kind"],"alternative"],"#f59e0b","#2f6fed"],"fill-opacity":.025}},{id:"coverage-ring-line",type:"line",paint:{"line-color":["case",["==",["get","kind"],"alternative"],"#e88906","#2878e8"],"line-opacity":.7,"line-width":1.4,"line-dasharray":[3,2]}}]);
      map.addSource("selected-sources",{type:"geojson",data:{type:"FeatureCollection",features:[]}});
      map.addLayer({id:"selected-source-circle",type:"circle",source:"selected-sources",paint:{"circle-radius":5,"circle-color":"#8246a8","circle-stroke-color":"#fff","circle-stroke-width":2}});
      addDynamicGeo("points",[{id:"point-circle",type:"circle",paint:{"circle-radius":["case",["boolean",["get","selected"],false],11,["match",["get","kind"],"candidate",8,"alternative",8,5]],"circle-color":["match",["get","kind"],"candidate","#246fe5","alternative","#f59e0b","route","#c2410c","#0f8a68"],"circle-stroke-color":["case",["boolean",["get","selected"],false],"#0e7490","#fff"],"circle-stroke-width":["case",["boolean",["get","selected"],false],3,2]}},{id:"point-label",type:"symbol",filter:["in",["get","kind"],["literal",["candidate","alternative"]]],layout:{"text-field":["get","label"],"text-size":10},paint:{"text-color":"#fff"}}]);
      map.getSource("points").setData(pointCollection());
      ["point-circle","point-label","selected-source-circle"].forEach(function(layer){map.on("mouseenter",layer,function(){map.getCanvas().style.cursor="pointer"});map.on("mouseleave",layer,function(){map.getCanvas().style.cursor=""})});
      mapReady=true;updateSelectedPoint(selectedPointId);
      if(mapStatus)mapStatus.textContent="Выберите расчётную точку на карте: карточка и роза ветров обновятся автоматически. Подложка: OpenStreetMap / OpenFreeMap.";
      map.resize();
      map.fitBounds([[data.bounds.min_lon,data.bounds.min_lat],[data.bounds.max_lon,data.bounds.max_lat]],{padding:18,duration:0});
      fallback.style.display="none";
    });
    map.on("click",function(event){var features=map.queryRenderedFeatures(event.point,{layers:["point-label","point-circle","selected-source-circle"]});if(!features.length){popup.remove();return}var feature=features.find(function(item){return item.properties&&(item.properties.kind==="candidate"||item.properties.kind==="alternative")})||features[0];var properties=feature.properties||{};if(properties.kind==="candidate"||properties.kind==="alternative")updateSelectedPoint(String(properties.id));popup.setLngLat(feature.geometry.coordinates).setHTML(popupMarkup(properties)).addTo(map)});
  })();
  </script>
</body>
</html>`;
}

