import {networkScreeningReportHtml} from '../demo/networkReport';
import { PublicationAvailability } from "../demo/PublicationAvailability";
import { normalizePublicationDraft, publicationPostCount, PUBLICATION_MAX_POSTS } from "../demo/publicationLimits";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  createAsyncNetworkDesignRun,
  fetchNetworkDesignReadiness,
  fetchNetworkDesignRun,
  fetchNetworkDesignReports,
  networkDesignReportUrl,
  saveNetworkDesignReport,
  saveNetworkOfficialPopulation,
} from "../api";
import { DEFAULT_TERRITORY } from "../defaults";
import publicationCities from "../../public/demo/cities.json";
import "./NetworkDesignParameters.css";
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

const DRAFT_KEY = "air-sgm:network-pages-wizard:v3";
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

const PUBLICATION_TERRITORIES: NetworkTerritory[] = publicationCities
  .map((city) => ({ ...city, kind: "settlement" as const }))
  .sort((a, b) => a.name.localeCompare(b.name, "ru"));

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
  gridKm: 1,
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
    const territory = PUBLICATION_TERRITORIES.find((item) => item.id === value.territoryId)
      ?? DEFAULT_TERRITORY;
    return normalizePublicationDraft({
      schemaVersion: 9,
      screeningProfile,
      territoryQuery: territory.label ?? territory.name,
      territoryId: territory.id,
      planningMode: value.planningMode ?? DEFAULT_DRAFT.planningMode,
      placementMode:
        value.placementMode && value.placementMode in PLACEMENT_MODES
          ? value.placementMode
          : DEFAULT_DRAFT.placementMode,
      meteoProfile:
        value.meteoProfile === "accumulation_risk"
          ? "weak_wind"
          : value.meteoProfile && value.meteoProfile in METEO_PROFILES
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
    });
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

export {networkScreeningReportHtml} from '../demo/networkReport';
export function NetworkDesignPage({
  preferredRunId,
  onRunSelected,
  onOpenRegistry,
}: {
  preferredRunId: string | null;
  onRunSelected: (id: string | null) => void;
  onOpenRegistry: (
    runId?: string | null,
    tab?: "result" | "report" | "research",
  ) => void;
}) {
  const [draft, setDraft] = useState<WizardDraft>(loadDraft);
  const [step, setStep] = useState<WizardStep>(1);
  const [readiness, setReadiness] = useState<NetworkDesignReadiness | null>(
    null,
  );
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [officialPopulation, setOfficialPopulation] = useState({
    population: "",
    as_of: "",
    source_name: "",
    source_url: "",
    confirmed: false,
  });
  const [populationSaving, setPopulationSaving] = useState(false);
  const [populationSaveError, setPopulationSaveError] = useState<string | null>(
    null,
  );
  useEffect(() => {
    const evidence = readiness?.normative_requirements.population_evidence;
    setOfficialPopulation({
      population: evidence ? String(evidence.population) : "",
      as_of: evidence?.as_of ?? "",
      source_name: evidence?.source_name ?? "",
      source_url: evidence?.source_url ?? "",
      confirmed: false,
    });
    setPopulationSaveError(null);
  }, [draft.territoryId, readiness]);
  const [run, setRun] = useState<NetworkDesignRun | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [runProgress, setRunProgress] = useState({ percent: 0, stage: "" });
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [progressClock, setProgressClock] = useState(() => Date.now());
  const [reportSaving, setReportSaving] = useState(false);
  const [reportState, setReportState] = useState<{
    runId: string;
    id?: string;
    error?: string;
  } | null>(null);
  const reportRequest = useRef<{
    runId: string;
    promise: ReturnType<typeof saveNetworkDesignReport>;
  } | null>(null);

  // Keep a single save request per result, including React's repeated effect setup.
  const ensureReport = (result: NetworkDesignRun) => {
    if (reportRequest.current?.runId !== result.id) {
      reportRequest.current = {
        runId: result.id,
        promise: Promise.resolve().then(()=>saveNetworkDesignReport(result.id,networkScreeningReportHtml(result))),
      };
    }
    return reportRequest.current.promise;
  };

  useEffect(() => {
    if (!run || run.status !== "completed") return;
    let active = true;
    setReportSaving(true);
    setReportState({ runId: run.id });
    void ensureReport(run)
      .then((report) => {
        if (active) setReportState({ runId: run.id, id: report.id });
      })
      .catch((reason) => {
        if (active)
          setReportState({
            runId: run.id,
            error:
              reason instanceof Error
                ? reason.message
                : "Не удалось сохранить отчёт",
          });
      })
      .finally(() => {
        if (active) setReportSaving(false);
      });
    return () => {
      active = false;
    };
  }, [run]);
  const [runError, setRunError] = useState<string | null>(null);
  const [resultStale, setResultStale] = useState(false);
  const [resultViewId, setResultViewId] = useState<string>("ensemble");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null,
  );
  const [postCountTouched, setPostCountTouched] = useState(
    () => loadDraft() !== DEFAULT_DRAFT,
  );
  const readinessRequest = useRef(0);
  const submission = useRef(0);

  useEffect(
    () => () => {
      submission.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (!preferredRunId) {
      setRun(null);
      setStep(1);
      setRunLoading(false);
      setRunStartedAt(null);
      return;
    }
    const controller = new AbortController();
    setRun(null);
    setStep(1);
    setRunLoading(true);
    setRunError(null);
    setRunProgress({ percent: 0, stage: "Загрузка сохранённого расчёта…" });
    void loadNetworkRun(
      preferredRunId,
      fetchNetworkDesignRun,
      controller.signal,
      (value) => {
        setRunProgress({
          percent: value.progress_percent ?? 0,
          stage: value.progress_stage ?? "Загрузка результата…",
        });
        if (value.status === "queued" || value.status === "running") {
          const started = Date.parse(value.started_at ?? value.created_at);
          setRunStartedAt(Number.isFinite(started) ? started : Date.now());
        }
      },
    )
      .then((value) => {
        if (controller.signal.aborted) return;
        const request = value.request;
        setPostCountTouched(true);
        setReadiness(value.readiness);
        setDraft({
          ...DEFAULT_DRAFT,
          territoryId: request.territory_id,
          territoryQuery:
            value.readiness?.territory.name ?? value.ensemble.territory.name,
          planningMode: request.planning_mode,
          placementMode: request.placement_mode ?? DEFAULT_DRAFT.placementMode,
          meteoProfile: request.meteo_profile === "accumulation_risk"
            ? "weak_wind"
            : request.meteo_profile ?? DEFAULT_DRAFT.meteoProfile,
          postCount: request.post_count,
          researchMode: request.research_mode ?? false,
          screeningProfile:
            request.analysis_profile === "extended_diagnostics"
              ? "robustness"
              : "quick",
          networkSizeMode:
            request.network_size_mode ?? DEFAULT_DRAFT.networkSizeMode,
          gridKm: request.grid_km,
          radiusM: request.radius_m,
          sourceContextRadiusKm:
            request.source_context_radius_km ??
            DEFAULT_DRAFT.sourceContextRadiusKm,
          windSectorToleranceDeg:
            request.wind_sector_tolerance_deg ??
            DEFAULT_DRAFT.windSectorToleranceDeg,
          useExclusionMasks: request.use_exclusion_masks,
          sensitivityMode: request.sensitivity_mode ?? "off",
        });
        setRun(value);
        setResultViewId("ensemble");
        setSelectedCandidateId(null);
        setResultStale(false);
        setStep(2);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setRunError(
            reason instanceof Error
              ? reason.message
              : "Не удалось открыть расчёт",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setRunLoading(false);
          setRunStartedAt(null);
        }
      });
    return () => controller.abort();
  }, [preferredRunId]);

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    if (!runLoading || runStartedAt === null) return;
    const timer = window.setInterval(() => setProgressClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [runLoading, runStartedAt]);

  useEffect(() => {
    if (!draft.territoryId) {
      setReadiness(null);
      return;
    }
    const requestId = ++readinessRequest.current;
    const controller = new AbortController();
    setReadinessLoading(true);
    setReadiness(null);
    setReadinessError(null);
    fetchNetworkDesignReadiness(draft.territoryId, controller.signal)
      .then((value) => {
        if (requestId !== readinessRequest.current) return;
        setReadiness(value);
        const minimum = value.normative_requirements.minimum ?? 1;
        const deficit = value.normative_requirements.deficit ?? minimum;
        setDraft((current) => ({
          ...current,
          ...(!postCountTouched
            ? {
                postCount:
                  current.planningMode === "new_network"
                    ? publicationPostCount(minimum, "new_network")
                    : publicationPostCount(deficit, "expand"),
              }
            : {}),
        }));
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setReadiness(null);
        setReadinessError(
          reason instanceof Error
            ? reason.message
            : "Не удалось проверить готовность данных",
        );
      })
      .finally(() => {
        if (requestId === readinessRequest.current) setReadinessLoading(false);
      });
    return () => controller.abort();
  }, [draft.territoryId]);

  const updateDraft = (changes: Partial<WizardDraft>) => {
    setDraft((current) => normalizePublicationDraft({ ...current, ...changes }));
    if (run) setResultStale(true);
    setRunError(null);
  };

  const applyScreeningProfile = (screeningProfile: ScreeningProfile) => {
    updateDraft({
      screeningProfile,
      sensitivityMode: screeningProfile === "robustness" ? "standard" : "off",
    });
  };

  const selectTerritory = (item: NetworkTerritory) => {
    const territoryChanged = item.id !== draft.territoryId;
    setPostCountTouched(false);
    updateDraft({
      territoryId: item.id,
      territoryQuery: item.label ?? item.name,
      ...(territoryChanged ? { postCount: 1 } : {}),
    });
    // Readiness reloads when the selected city changes.
    if (territoryChanged) setReadiness(null);
  };

  const changePlanningMode = (mode: "new_network" | "expand") => {
    const minimum = readiness?.normative_requirements.minimum ?? 1;
    const deficit = readiness?.normative_requirements.deficit ?? minimum;
    setPostCountTouched(false);
    updateDraft({
      planningMode: mode,
      postCount:
        mode === "new_network" ? Math.max(1, minimum) : Math.max(0, deficit),
    });
  };

  const readinessAllowsCurrentMode =
    readiness?.[
      draft.planningMode === "expand"
        ? "ready_for_population_only_expansion"
        : "ready_for_population_only_new_network"
    ] ?? false;
  const selectedEvidenceReady = (() => {
    if (!readiness) return false;
    const ready = (id: string) => readiness.layers[id]?.status === "ready";
    if (draft.placementMode === "industrial_influence") return ready("sources");
    if (draft.placementMode === "transport_influence") {
      return (
        ready("roads") &&
        Number(readiness.layers.roads?.proxy_feature_count ?? 0) > 0
      );
    }
    if (draft.placementMode === "urban_background")
      return ready("sources") || ready("roads");
    if (draft.placementMode === "integrated_screening") {
      return (
        ready("sources") &&
        ready("roads") &&
        Number(readiness.layers.roads?.proxy_feature_count ?? 0) > 0
      );
    }
    return true;
  })();

  const readinessBlockers = (() => {
    if (!readiness)
      return [
        "Не удалось получить сведения о готовности данных. Вернитесь к выбору населённого пункта.",
      ];
    const messages: string[] = [];
    const ready = (id: string) => readiness.layers[id]?.status === "ready";
    if (!readinessAllowsCurrentMode) {
      for (const [id, label] of [
        ["boundary", "границы населённого пункта"],
        ["population", "населения"],
        ["residential", "жилой застройки"],
      ]) {
        if (!ready(id))
          messages.push(
            `Не готовы данные ${label}. Загрузите их в разделе «Исходные данные сети».`,
          );
      }
      if (draft.planningMode === "expand" && !ready("stations")) {
        messages.push(
          "Для расширения сети нужны действующие стационарные посты. Добавьте их или выберите «Новая сеть с нуля».",
        );
      }
      if (!messages.length)
        messages.push(
          "Обязательные данные территории не готовы. Проверьте их в разделе «Исходные данные сети».",
        );
    }
    if (
      ["industrial_influence", "integrated_screening"].includes(
        draft.placementMode,
      ) &&
      !ready("sources")
    ) {
      messages.push(
        `Для режима «${PLACEMENT_MODES[draft.placementMode].title}» нужны именованные промышленные объекты или промышленные площадки OSM. Для выбранной территории эти данные не загружены. Загрузите инфраструктуру OSM в разделе «Исходные данные сети». Безымянные точки реестра выбросов не используются; площадки OSM учитываются по контуру.`,
      );
    }
    if (
      ["transport_influence", "integrated_screening"].includes(
        draft.placementMode,
      ) &&
      (!ready("roads") ||
        Number(readiness.layers.roads?.proxy_feature_count ?? 0) === 0)
    ) {
      messages.push(
        "Для выбранного режима нужны транспортные объекты OSM: магистрали, действующие железные дороги или аэропорты. Загрузите инфраструктуру OSM в разделе «Исходные данные сети».",
      );
    }
    if (
      draft.placementMode === "urban_background" &&
      !ready("sources") &&
      !ready("roads")
    ) {
      messages.push(
        "Для режима городского фона нужен хотя бы один слой: промышленные объекты или дороги. Загрузите эти данные.",
      );
    }
    return messages;
  })();

  const postCountValid =
    Number.isInteger(draft.postCount) &&
    draft.postCount <= PUBLICATION_MAX_POSTS &&
    (draft.planningMode === "expand"
      ? draft.postCount >= 0
      : draft.postCount >= 1 &&
        (readiness?.normative_requirements.reference_status ===
          "preliminary_model" ||
          draft.postCount >= (readiness?.normative_requirements.minimum ?? 1) ||
          draft.researchMode));
  const canCalculate = Boolean(
    draft.territoryId &&
    readiness?.territory.id === draft.territoryId &&
    !readinessLoading &&
    !populationSaving &&
    !runLoading &&
    readinessAllowsCurrentMode &&
    selectedEvidenceReady &&
    postCountValid,
  );

  const startCalculation = async () => {
    if (!canCalculate || !draft.territoryId) return;
    const payload: NetworkDesignRunRequest = {
      territory_kind: "settlement",
      territory_id: draft.territoryId,
      planning_mode: draft.planningMode,
      placement_mode: draft.placementMode,
      meteo_profile: draft.meteoProfile,
      selected_source_ids: [],
      transport_evidence_mode: "auto",
      post_type: "stationary",
      post_count: draft.postCount,
      research_mode: draft.researchMode,
      analysis_profile:
        draft.screeningProfile === "robustness"
          ? "extended_diagnostics"
          : "coverage_backbone",
      network_size_mode: draft.networkSizeMode,
      grid_km: draft.gridKm,
      radius_m: draft.radiusM,
      source_context_radius_km: draft.sourceContextRadiusKm,
      wind_sector_tolerance_deg: draft.windSectorToleranceDeg,
      use_exclusion_masks: draft.useExclusionMasks,
      sensitivity_mode: draft.sensitivityMode,
      sensitivity_grid_km: [1, 0.5],
      sensitivity_radii_m: [2500, 5000],
    };
    setRunLoading(true);
    setRunProgress({ percent: 1, stage: "Расчёт поставлен в очередь" });
    const calculationStartedAt = Date.now();
    setRunStartedAt(calculationStartedAt);
    setProgressClock(calculationStartedAt);
    setRunError(null);
    const recordProgress = (next: {
      progress_percent: number;
      progress_stage: string;
    }) => {
      setRunProgress({
        percent: next.progress_percent,
        stage: next.progress_stage,
      });
    };
    const submissionId = ++submission.current;
    try {
      const started = await createAsyncNetworkDesignRun(payload);
      if (submissionId !== submission.current) return;
      recordProgress(started);
      onRunSelected(started.id);
    } catch (reason) {
      if (submissionId !== submission.current) return;
      setRunError(
        reason instanceof Error
          ? reason.message
          : "Не удалось выполнить расчёт",
      );
      setRunLoading(false);
      setRunStartedAt(null);
    }
  };

  const calculationElapsedSeconds =
    runStartedAt === null
      ? 0
      : Math.max(0, (progressClock - runStartedAt) / 1000);

  const activeResult: ResultView | null = useMemo(() => {
    if (!run) return null;
    if (resultViewId === "ensemble") return run.ensemble;
    return (
      run.scenario_results.find((item) => item.scenario_id === resultViewId)
        ?.result ?? run.ensemble
    );
  }, [resultViewId, run]);

  useEffect(() => {
    const scenarios = [
      ...(activeResult?.scenarios ?? []),
      ...(resultViewId === "ensemble"
        ? (run?.ensemble.scenario_alternatives ?? [])
        : []),
    ];
    setSelectedCandidateId((current) =>
      current && scenarios.some((item) => item.cell_id === current)
        ? current
        : (scenarios[0]?.cell_id ?? null),
    );
  }, [activeResult, resultViewId, run]);

  const expectedNetworkSize = readiness
    ? (draft.planningMode === "expand"
        ? readiness.normative_requirements.active_posts
        : 0) + draft.postCount
    : draft.postCount;
  const minimumPosts = readiness?.normative_requirements.minimum ?? null;
  const normativeDeficit = readiness?.normative_requirements.deficit ?? null;
  const sensitivityVariantCount =
    [1, 0.5].filter((gridKm) => gridKm !== draft.gridKm).length +
    [2500, 5000].filter((radiusM) => radiusM !== draft.radiusM).length;
  const downloadReport = async () => {
    if (!run) return;
    const previewWindow = window.open("about:blank", "_blank");
    if (previewWindow) {
      previewWindow.document.title = "Air SGM · Подготовка отчёта";
      previewWindow.document.body.textContent =
        "Формируем научно-технический отчёт…";
    }
    setReportSaving(true);
    setRunError(null);
    try {
      if (reportState?.runId === run.id && reportState.error)
        reportRequest.current = null;
      const report = await ensureReport(run);
      setReportState({ runId: run.id, id: report.id });
      const reportUrl = networkDesignReportUrl(report.id);
      if (previewWindow) {
        previewWindow.opener = null;
        previewWindow.location.replace(reportUrl);
      } else {
        const link = document.createElement("a");
        link.href = reportUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.click();
      }
    } catch (reason) {
      previewWindow?.close();
      setReportState({
        runId: run.id,
        error:
          reason instanceof Error
            ? reason.message
            : "Не удалось сохранить отчёт",
      });
    } finally {
      setReportSaving(false);
    }
  };

  return (
    <div className="module-page network-design-page network-wizard">
      <section
        className={`module-card network-wizard__shell${step === 2 && run ? " is-result" : ""}`}
      >
        <header className="network-wizard__head">
          <div>
            <span>МОДУЛЬ 1 · ПРЕДВАРИТЕЛЬНЫЙ ГИС-СКРИНИНГ</span>
            <h2>Планирование сети мониторинга</h2>
            <p>
              Выберите параметры и получите кандидатные зоны для проверки.
              Подготовка данных и классификация зон выполняются автоматически.
            </p>
          </div>
          <div
            className={
              step === 2 && run
                ? "network-wizard__status is-ready"
                : "network-wizard__status"
            }
          >
            <b>
              {runLoading
                ? "Расчёт выполняется"
                : step === 2 && run
                  ? "Скрининг завершён"
                  : `Шаг ${step} из 2`}
            </b>
            <span>
              {step === 2 && run
                ? `${run.ensemble.resolved_post_count} кандидатных зон`
                : STEPS[step - 1].subtitle}
            </span>
          </div>
        </header>

        {step === 1 && (
          <div className="network-wizard__registry-link">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => onOpenRegistry()}
            >
              Расчёты и отчёты сети
            </button>
          </div>
        )}

        <div className="network-wizard__scope-strip" role="note">
          <span aria-hidden="true">i</span>
          <p>
            <strong>Граница результата:</strong> модуль формирует аналитические
            зоны для предварительного сравнения. Численный ориентир сети,
            пространственный охват и пригодность конкретной площадки оцениваются
            раздельно. Выбросы, атмосферное рассеивание и наземные измерения в
            эту постановку не входят.
          </p>
        </div>

        {step === 1 && (
          <ol
            className="network-wizard__steps"
            aria-label="Этапы предварительного ГИС-скрининга сети"
          >
            {STEPS.map((item) => {
              const available = !runLoading && (item.id === 1 || Boolean(run));
              const complete =
                item.id < step || (item.id === 2 && Boolean(run));
              return (
                <li
                  key={item.id}
                  className={`${item.id === step ? "is-active" : ""} ${complete ? "is-complete" : ""}`}
                >
                  <button
                    type="button"
                    disabled={!available}
                    aria-current={item.id === step ? "step" : undefined}
                    onClick={() => available && setStep(item.id)}
                  >
                    <b>{complete ? "✓" : item.id}</b>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.subtitle}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        <div className="network-wizard__content">
          {step === 1 && (
            <section
              className="network-parameters"
              aria-label="Параметры расчёта"
            >
              <div className="network-parameters__layout">
                <div className="network-parameters__main">
                  <fieldset
                    className="network-parameters__controls"
                    disabled={runLoading}
                  >
                    <div className="network-parameters__form">
                      <h3>Что проектируем</h3>
                      <div className="network-wizard__form-grid">
                        <label className="network-wizard__territory-field">
                          <span>Населённый пункт</span>
                          <select
                            value={draft.territoryId ?? ""}
                            onChange={(event) => {
                              const territory = PUBLICATION_TERRITORIES.find(
                                (item) => item.id === event.target.value,
                              );
                              if (territory) selectTerritory(territory);
                            }}
                          >
                            {PUBLICATION_TERRITORIES.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                          <small>
                            Все {PUBLICATION_TERRITORIES.length} городов Рязанской области,
                            доступных в публикационной версии. Выберите город из списка.
                          </small>
                        </label>
                        <label>
                          <span>Задача сети</span>
                          <select
                            value={draft.planningMode}
                            onChange={(event) =>
                              changePlanningMode(
                                event.target.value as "new_network" | "expand",
                              )
                            }
                          >
                            <option value="new_network">
                              Новая сеть с нуля
                            </option>
                            <option value="expand">
                              Расширение существующей сети
                            </option>
                          </select>
                          <small>
                            {draft.planningMode === "new_network"
                              ? "Действующие посты показываются для сравнения."
                              : "Новые зоны дополняют охват действующих постов."}
                          </small>
                        </label>

                        <label className="network-parameters__purpose">
                          <span>Приоритет размещения</span>
                          <select
                            value={draft.placementMode}
                            onChange={(event) =>
                              updateDraft({
                                placementMode: event.target
                                  .value as NetworkPlacementMode,
                              })
                            }
                          >
                            {(
                              Object.entries(PLACEMENT_MODES) as Array<
                                [
                                  NetworkPlacementMode,
                                  (typeof PLACEMENT_MODES)[NetworkPlacementMode],
                                ]
                              >
                            ).map(([id, mode]) => (
                              <option key={id} value={id}>
                                {mode.title}
                              </option>
                            ))}
                          </select>
                          <small>
                            {PLACEMENT_MODES[draft.placementMode].description}
                          </small>
                        </label>
                        <label>
                          <span>
                            {draft.planningMode === "new_network"
                              ? "Постов в новой сети"
                              : "Добавить стационарных постов"}
                          </span>
                          <select
                            value={draft.postCount}
                            onChange={(event) => {
                              setPostCountTouched(true);
                              updateDraft({
                                postCount: Number(event.target.value),
                              });
                            }}
                          >
                            {Array.from(
                              {
                                length:
                                  draft.planningMode === "expand" ? 21 : 20,
                              },
                              (_, index) =>
                                draft.planningMode === "expand"
                                  ? index
                                  : index + 1,
                            ).map((value) => {
                              const note =
                                draft.planningMode === "new_network" &&
                                value === minimumPosts
                                  ? " · численный ориентир"
                                  : draft.planningMode === "expand" &&
                                      value === normativeDeficit
                                    ? " · дефицит по количеству"
                                    : "";
                              return (
                                <option key={value} value={value} disabled={value > PUBLICATION_MAX_POSTS}>
                                  {value}
                                  {note}
                                  {value > PUBLICATION_MAX_POSTS ? " · только основная система" : ""}
                                </option>
                              );
                            })}
                          </select>
                          <small>
                            Ожидаемый итог сети: {expectedNetworkSize} постов.
                          </small>
                        </label>
                        <label>
                          <span>Режим размера сети</span>
                          <select
                            value={draft.networkSizeMode}
                            onChange={(event) =>
                              updateDraft({
                                networkSizeMode: event.target
                                  .value as WizardDraft["networkSizeMode"],
                              })
                            }
                          >
                            <option value="required_network_size">
                              Сформировать N позиций
                            </option>
                            <option value="budget_ceiling" disabled>
                              Не более N позиций · только основная система
                            </option>
                          </select>
                          <small>
                            В публикации доступно формирование N позиций.
                            Режим верхней границы N доступен в основной системе.
                          </small>
                        </label>
                      </div>
                      <NetworkParameterDetails
                        className="network-parameters__advanced"
                        title="Дополнительные настройки"
                      >
                        <PublicationAvailability compact />
                        <div className="network-wizard__config-grid">
                          <label>
                            <span>Период розы ветров ERA5</span>
                            <select
                              value={draft.meteoProfile}
                              onChange={(event) =>
                                updateDraft({
                                  meteoProfile: event.target
                                    .value as NetworkMeteoProfile,
                                })
                              }
                            >
                              {(
                                Object.entries(METEO_PROFILES) as Array<
                                  [NetworkMeteoProfile, string]
                                >
                              ).filter(([id]) => id !== "accumulation_risk").map(([id, label]) => (
                                <option key={id} value={id}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <small>
                              Меняет выбор точек в промышленном и комплексном
                              режимах; в остальных входит в паспорт как справка.
                            </small>
                          </label>
                          <label>
                            <span>Шаг аналитической сетки</span>
                            <select
                              value={draft.gridKm}
                              onChange={(event) =>
                                updateDraft({
                                  gridKm: Number(event.target.value),
                                })
                              }
                            >
                              <option value={0.4} disabled>
                                400 м · только основная система
                              </option>
                              <option value={0.3} disabled>
                                300 м · только основная система
                              </option>
                              <option value={0.25} disabled>
                                0,25 км · только основная система
                              </option>
                              <option value={0.2} disabled>
                                200 м · только основная система
                              </option>
                              <option value={1}>
                                1 км · укрупнённый расчёт
                              </option>
                              <option value={0.5} disabled>
                                0,5 км · только сравнение в исследовательском режиме
                              </option>
                            </select>
                            <small>
                              В публикации базовая сетка — 1 км. Сетка 0,5 км
                              включена в сохранённую проверку устойчивости;
                              самостоятельный выбор других сеток доступен в основной системе.
                            </small>
                          </label>
                          <label>
                            <span>Сценарный радиус охвата поста</span>
                            <select
                              value={draft.radiusM}
                              onChange={(event) =>
                                updateDraft({
                                  radiusM: Number(event.target.value),
                                })
                              }
                            >
                              <option value={2500}>
                                2,5 км · базовый радиус покрытия
                              </option>
                              <option value={5000} disabled>5 км · только сравнение в исследовательском режиме</option>
                              <option value={10000} disabled>10 км · только основная система</option>
                            </select>
                            <small>
                              Это параметр MCLP, а не радиус репрезентативности
                              или шаг между постами.
                            </small>
                          </label>
                          <label>
                            <span>Глубина проверки</span>
                            <select
                              value={draft.screeningProfile}
                              onChange={(event) =>
                                applyScreeningProfile(
                                  event.target.value as ScreeningProfile,
                                )
                              }
                            >
                              <option value="quick">
                                Быстрый режим · один расчёт
                              </option>
                              <option value="robustness">
                                Исследовательский режим · ERA5, сетка и радиус
                              </option>
                            </select>
                            <small>
                              {draft.screeningProfile === "robustness"
                                ? "Сравниваются доступные периоды ERA5, сетки 1/0,5 км и радиусы 2,5/5 км; неустойчивые варианты попадут в альтернативы."
                                : "Выполняется один расчёт для выбранного периода ERA5."}
                            </small>
                          </label>
                          <label>
                            <span>Маски непригодности</span>
                            <select
                              value={draft.useExclusionMasks ? "on" : "off"}
                              onChange={(event) =>
                                updateDraft({
                                  useExclusionMasks:
                                    event.target.value === "on",
                                })
                              }
                            >
                              <option
                                value="on"
                                disabled={
                                  readiness?.layers.constraints?.status !==
                                  "ready"
                                }
                              >
                                Применять загруженные ограничения
                              </option>
                              <option value="off" disabled>Не применять · только основная система</option>
                            </select>
                            <small>
                              Исключаются только проверенные загруженные
                              геометрии.
                            </small>
                          </label>
                        </div>
                        <p className="network-parameters__note">
                          Проектируются стационарные посты. Сетка и радиус
                          задают масштаб сценарного сравнения; роли зон
                          определяются автоматически после расчёта.
                        </p>
                      </NetworkParameterDetails>
                    </div>
                    {readinessLoading && (
                      <div className="network-parameters__health" role="status">
                        <span className="spinner" />
                        Проверяем территорию и данные…
                      </div>
                    )}
                    {readinessError && (
                      <div className="form-error" role="alert">
                        {readinessError}
                      </div>
                    )}
                    {!draft.territoryId && (
                      <p className="network-parameters__note">
                        Выберите населённый пункт из результатов поиска.
                      </p>
                    )}
                    {readiness && !readinessLoading && (
                      <>
                        <div
                          className={`network-parameters__health${readinessAllowsCurrentMode && selectedEvidenceReady ? " is-ready" : ""}`}
                          role="status"
                        >
                          {readinessAllowsCurrentMode && selectedEvidenceReady
                            ? "✓ Обязательные данные готовы"
                            : "Не хватает данных для выбранного режима"}
                        </div>
                        {(!readinessAllowsCurrentMode ||
                          !selectedEvidenceReady) && (
                          <div
                            className="network-parameters__warning"
                            role="alert"
                          >
                            <strong>Расчёт пока недоступен</strong>
                            {readinessBlockers.map((message) => (
                              <p key={message}>{message}</p>
                            ))}
                            {readinessAllowsCurrentMode &&
                              !selectedEvidenceReady && (
                                <button
                                  type="button"
                                  className="button button--ghost"
                                  onClick={() =>
                                    updateDraft({
                                      placementMode: "population_coverage",
                                    })
                                  }
                                >
                                  Выбрать охват населения
                                </button>
                              )}
                          </div>
                        )}
                        <NetworkParameterDetails
                          className="network-parameters__data"
                          title="Состав и готовность данных"
                        >
                          <p className="demo-readiness__intro">
                            {readiness.territory.name} · {PLACEMENT_MODES[draft.placementMode].title}
                            {draft.planningMode === "expand" ? " · расширение сети" : " · новая сеть"}
                          </p>
                          <div className="demo-readiness__table-wrap">
                            <table className="demo-readiness__table">
                              <thead><tr><th>Набор данных</th><th>Готовность</th><th>Состав</th><th>Роль в выбранном расчёте</th></tr></thead>
                              <tbody>
                            {Object.entries(readiness?.layers ?? {}).map(
                              ([id, layer]) => {
                                const usedBySelectedMode =
                                  (id === "sources" &&
                                    [
                                      "industrial_influence",
                                      "urban_background",
                                      "integrated_screening",
                                    ].includes(draft.placementMode)) ||
                                  (id === "roads" &&
                                    [
                                      "transport_influence",
                                      "urban_background",
                                      "integrated_screening",
                                    ].includes(draft.placementMode));
                                const required =
                                  [
                                    "boundary",
                                    "population",
                                    "residential",
                                  ].includes(id) ||
                                  usedBySelectedMode ||
                                  (layer.required_for === "expand" &&
                                    draft.planningMode === "expand");
                                const contextOnly =
                                  [
                                    "sources",
                                    "roads",
                                    "recreation",
                                    "terrain",
                                  ].includes(id) && !usedBySelectedMode;
                                const layerExcluded =
                                  (id === "stations" &&
                                    draft.planningMode === "new_network") ||
                                  (id === "constraints" &&
                                    !draft.useExclusionMasks);
                                return (
                                  <tr key={id} className={`is-${layer.status}`}>
                                    <th scope="row">{layer.label}</th>
                                    <td><span className="demo-readiness__status">
                                      <i aria-hidden="true">{layer.status === "ready" ? "✓" : layer.status === "diagnostic_only" ? "i" : "!"}</i>
                                      {STATUS_LABELS[layer.status] ?? layer.status}
                                    </span></td>
                                    <td className="demo-readiness__metrics">
                                    {layer.feature_count != null && (
                                      <p>
                                        Объектов:{" "}
                                        {layer.feature_count.toLocaleString(
                                          "ru-RU",
                                        )}
                                      </p>
                                    )}
                                    {layer.verified_feature_count != null && (
                                      <p>
                                        Проверенных объектов:{" "}
                                        {layer.verified_feature_count.toLocaleString(
                                          "ru-RU",
                                        )}
                                      </p>
                                    )}
                                    {layer.proxy_feature_count != null && (
                                      <p>
                                        Предварительных объектов OSM:{" "}
                                        {layer.proxy_feature_count.toLocaleString(
                                          "ru-RU",
                                        )}
                                      </p>
                                    )}
                                    {layer.unique_named_count != null && (
                                      <p>
                                        Доступных промышленных объектов и
                                        площадок: {layer.unique_named_count}
                                      </p>
                                    )}
                                    {id === "sources" &&
                                      layer.osm_feature_count != null && (
                                        <p>
                                          Промышленных площадок OSM:{" "}
                                          {layer.osm_feature_count}
                                        </p>
                                      )}
                                    {id === "sources" &&
                                      layer.status !== "ready" && (
                                        <p>
                                          Нет именованных промышленных объектов
                                          или площадок OSM. Загрузите
                                          инфраструктуру OSM.
                                        </p>
                                      )}
                                    {layer.stationary_count != null && (
                                      <p>
                                        Стационарных постов:{" "}
                                        {layer.stationary_count}
                                      </p>
                                    )}
                                    {layer.route_count != null && (
                                      <p>
                                        Маршрутных постов:{" "}
                                        {layer.route_count}
                                      </p>
                                    )}
                                      {!['feature_count', 'verified_feature_count', 'proxy_feature_count', 'unique_named_count', 'stationary_count', 'route_count'].some((key) => layer[key as keyof typeof layer] != null) && <span aria-label="Число объектов не указано">—</span>}
                                    </td>
                                    <td className="demo-readiness__role">
                                    <div
                                      className={`network-wizard__layer-use is-${layerExcluded ? "excluded" : "automatic"}`}
                                    >
                                      <i aria-hidden="true">
                                        {contextOnly
                                          ? "i"
                                          : layerExcluded
                                            ? "—"
                                            : required &&
                                                layer.status !== "ready"
                                              ? "!"
                                              : "✓"}
                                      </i>
                                      <span>
                                        {layerExcluded
                                          ? "Не используется в текущем расчёте"
                                          : required && layer.status !== "ready"
                                            ? "Данные недоступны для выбранного режима"
                                            : required
                                              ? "Участвует в выборе зон"
                                              : contextOnly
                                                ? "Контекст: поясняет результат"
                                                : "Ограничивает выбор мест"}
                                      </span>
                                    </div>
                                    <p className="network-wizard__data-purpose">
                                      {usedBySelectedMode
                                        ? `Слой влияет на расчёт в режиме «${PLACEMENT_MODES[draft.placementMode].title}». Это скрининговый признак, не измеренная концентрация.`
                                        : layerPurpose(id, draft.planningMode)}
                                    </p>
                                    </td>
                                  </tr>
                                );
                              },
                            )}
                              </tbody>
                            </table>
                          </div>
                        </NetworkParameterDetails>
                      </>
                    )}
                    {readiness &&
                      readiness.normative_requirements.reference_status ===
                        "current_requirement" && (
                        <NetworkParameterDetails
                          className="network-wizard__warning"
                          title="Численность поселения для сверки по приказу № 524"
                        >
                          <p>{readiness.normative_requirements.note}</p>
                          {readiness.normative_requirements
                            .population_evidence && (
                            <p>
                              Сохранено:{" "}
                              {readiness.normative_requirements.population?.toLocaleString(
                                "ru-RU",
                              )}{" "}
                              жителей на{" "}
                              {
                                readiness.normative_requirements
                                  .population_evidence.as_of
                              }
                              ;{" "}
                              {
                                readiness.normative_requirements
                                  .population_evidence.source_name
                              }
                              .
                            </p>
                          )}
                          <form
                            className="network-official-population"
                            onSubmit={async (event) => {
                              event.preventDefault();
                              const territoryId = draft.territoryId;
                              if (
                                !territoryId ||
                                readinessLoading ||
                                readiness.territory.id !== territoryId
                              )
                                return;
                              const requestId = readinessRequest.current;
                              setPopulationSaving(true);
                              setPopulationSaveError(null);
                              try {
                                const value =
                                  await saveNetworkOfficialPopulation(
                                    territoryId,
                                    {
                                      ...officialPopulation,
                                      population: Number(
                                        officialPopulation.population,
                                      ),
                                    },
                                  );
                                if (requestId !== readinessRequest.current)
                                  return;
                                setReadiness(value);
                                setResultStale(true);
                                if (
                                  !postCountTouched &&
                                  value.normative_requirements.minimum != null
                                ) {
                                  setDraft((current) => ({
                                    ...current,
                                    postCount:
                                      publicationPostCount(
                                        current.planningMode === "new_network"
                                          ? value.normative_requirements.minimum!
                                          : (value.normative_requirements.deficit ?? 0),
                                        current.planningMode,
                                      ),
                                  }));
                                }
                              } catch (error) {
                                if (requestId === readinessRequest.current)
                                  setPopulationSaveError(
                                    error instanceof Error
                                      ? error.message
                                      : "Не удалось сохранить численность",
                                  );
                              } finally {
                                setPopulationSaving(false);
                              }
                            }}
                          >
                            <label>
                              Численность, человек
                              <input
                                type="number"
                                min="1"
                                max="100000000"
                                step="1"
                                required
                                value={officialPopulation.population}
                                onChange={(event) =>
                                  setOfficialPopulation({
                                    ...officialPopulation,
                                    population: event.target.value,
                                    confirmed: false,
                                  })
                                }
                              />
                            </label>
                            <label>
                              На дату
                              <input
                                type="date"
                                required
                                value={officialPopulation.as_of}
                                onChange={(event) =>
                                  setOfficialPopulation({
                                    ...officialPopulation,
                                    as_of: event.target.value,
                                    confirmed: false,
                                  })
                                }
                              />
                            </label>
                            <label>
                              Официальный источник
                              <input
                                required
                                minLength={3}
                                value={officialPopulation.source_name}
                                onChange={(event) =>
                                  setOfficialPopulation({
                                    ...officialPopulation,
                                    source_name: event.target.value,
                                    confirmed: false,
                                  })
                                }
                                placeholder="Росстат, таблица численности поселений"
                              />
                            </label>
                            <label>
                              Ссылка на документ
                              <input
                                type="url"
                                required
                                value={officialPopulation.source_url}
                                onChange={(event) =>
                                  setOfficialPopulation({
                                    ...officialPopulation,
                                    source_url: event.target.value,
                                    confirmed: false,
                                  })
                                }
                              />
                            </label>
                            <label>
                              <input
                                type="checkbox"
                                required
                                checked={officialPopulation.confirmed}
                                onChange={(event) =>
                                  setOfficialPopulation({
                                    ...officialPopulation,
                                    confirmed: event.target.checked,
                                  })
                                }
                              />
                              Я проверил официальный источник: значение и дата
                              относятся именно к поселению «
                              {readiness.territory.name}», а не к району или
                              региону.
                            </label>
                            <button type="submit" disabled={populationSaving}>
                              {populationSaving
                                ? "Сохраняем…"
                                : "Сохранить численность и пересчитать минимум"}
                            </button>
                            {populationSaveError && (
                              <p role="alert">{populationSaveError}</p>
                            )}
                          </form>
                        </NetworkParameterDetails>
                      )}

                    {draft.planningMode === "expand" &&
                      draft.postCount === 0 && (
                        <p className="network-parameters__note">
                          Новые посты не добавляются: расчёт покажет охват
                          действующей сети. Выберите 1–15 постов, чтобы найти
                          места для расширения.
                        </p>
                      )}
                    {minimumPosts != null &&
                      expectedNetworkSize < minimumPosts &&
                      readiness?.normative_requirements.reference_status !==
                        "preliminary_model" && (
                        <div className="network-parameters__warning">
                          <strong>
                            Итог ниже численного ориентира для территории.
                          </strong>
                          <label className="network-parameters__research">
                            <input
                              type="checkbox"
                              checked={draft.researchMode}
                              onChange={(event) =>
                                updateDraft({
                                  researchMode: event.target.checked,
                                })
                              }
                            />
                            Подтверждаю исследовательский запуск неполного
                            каркаса.
                          </label>
                        </div>
                      )}
                  </fieldset>

                  {runError && (
                    <div className="form-error" role="alert">
                      {runError}
                    </div>
                  )}
                  <NetworkPlanningHelp mode="setup" />
                </div>
                <aside
                  className="network-parameters__summary"
                  aria-label="Сводка расчёта"
                >
                  <span className="network-parameters__eyebrow">
                    ВАШ РАСЧЁТ
                  </span>
                  <h3>
                    {draft.planningMode === "new_network"
                      ? "Новая сеть"
                      : "Расширение сети"}
                  </h3>
                  <dl>
                    <div>
                      <dt>Территория</dt>
                      <dd>
                        {readiness?.territory.name ??
                          (draft.territoryId
                            ? draft.territoryQuery
                            : "Не выбрана")}
                      </dd>
                    </div>
                    <div>
                      <dt>Приоритет</dt>
                      <dd>{PLACEMENT_MODES[draft.placementMode].title}</dd>
                    </div>
                    <div>
                      <dt>
                        {draft.planningMode === "expand"
                          ? "Добавить постов"
                          : "Постов в новой сети"}
                      </dt>
                      <dd>
                        {draft.networkSizeMode === "budget_ceiling"
                          ? "Не более "
                          : ""}
                        {draft.postCount}
                      </dd>
                    </div>
                    {draft.planningMode === "expand" && readiness && (
                      <div>
                        <dt>Действующих постов</dt>
                        <dd>
                          {readiness.normative_requirements.active_posts} · итог{" "}
                          {expectedNetworkSize}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt>Масштаб сравнения</dt>
                      <dd>
                        Сетка {draft.gridKm} км · радиус {draft.radiusM / 1000}{" "}
                        км
                      </dd>
                    </div>
                    <div>
                      <dt>Период ветра</dt>
                      <dd>{METEO_PROFILES[draft.meteoProfile]}</dd>
                    </div>
                  </dl>
                  {!runLoading && (
                    <p>
                      {draft.sensitivityMode === "standard"
                        ? `С проверкой устойчивости: периоды ERA5 и ${sensitivityVariantCount} дополнительных варианта сетки и радиуса.`
                        : "Один основной расчёт"}
                    </p>
                  )}
                  {runLoading && (
                    <div
                      className="network-wizard__calculation"
                      aria-live="polite"
                      aria-busy="true"
                    >
                      <div
                        className="network-wizard__progress"
                        role="progressbar"
                        aria-label="Прогресс ГИС-скрининга"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={runProgress.percent}
                      >
                        <span style={{ width: `${runProgress.percent}%` }} />
                      </div>
                      <div className="network-wizard__progress-copy">
                        <strong>
                          {runProgress.percent}% ·{" "}
                          {runProgress.stage.replace(
                            /:\s*\d+ из \d+ базовых вариантов$/,
                            "",
                          ) || "Подготавливаем расчёт"}
                        </strong>
                        <div className="network-wizard__progress-meta">
                          <span>
                            Выполняется:{" "}
                            {formatCalculationTime(calculationElapsedSeconds)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    className="button button--primary"
                    disabled={!canCalculate}
                    onClick={() => void startCalculation()}
                  >
                    {runLoading ? "Рассчитываем сеть…" : "Рассчитать сеть →"}
                  </button>
                  <small>
                    {runLoading
                      ? "Результат откроется автоматически."
                      : readinessLoading
                        ? "Ожидаем проверку данных."
                        : !draft.territoryId
                          ? "Сначала выберите территорию."
                          : populationSaving
                            ? "Сохраняем численность населения."
                            : !readinessAllowsCurrentMode ||
                                !selectedEvidenceReady
                              ? "Для запуска нужны обязательные данные."
                              : !postCountValid
                                ? "Проверьте число постов и исследовательский режим."
                                : "Результат — кандидатные зоны для проверки."}
                  </small>
                  {run && (
                    <button
                      type="button"
                      className="button button--ghost"
                      disabled={runLoading}
                      onClick={() => setStep(2)}
                    >
                      {resultStale
                        ? "Открыть предыдущий результат"
                        : "Открыть результат"}
                    </button>
                  )}
                </aside>
              </div>
            </section>
          )}

          {step === 2 && run && activeResult && (
            <NetworkDesignResultView
              run={run}
              activeResult={activeResult}
              resultViewId={resultViewId}
              selectedCandidateId={selectedCandidateId}
              reportSaving={reportSaving}
              reportSaved={reportState?.runId === run.id && !!reportState.id}
              reportError={
                reportState?.runId === run.id
                  ? (reportState.error ?? null)
                  : null
              }
              resultStale={resultStale}
              runError={runError}
              onResultViewChange={setResultViewId}
              onSelectCandidate={setSelectedCandidateId}
              onEdit={() => setStep(1)}
              onDownloadReport={() =>
                reportState?.runId === run.id && reportState.error
                  ? void downloadReport()
                  : onOpenRegistry(run.id, "report")
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}
