import { request } from "../shared/http";
import { NetworkPlanningHelp } from "./NetworkPlanningHelp";
import type { SiteCheck } from "./NetworkPlanningLab";
import { NetworkPlanningLab, type PlanningPoint } from "./NetworkPlanningLab";
import {
  lazy,
  Suspense,
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Factory,
  FileText,
  Layers3,
  MapPin,
  SlidersHorizontal,
} from "lucide-react";

import type {
  CellFeature,
  NetworkDesign,
  NetworkDesignEnsemble,
  NetworkDesignRun,
  NetworkFunctionalRoleId,
} from "../types";
import { NetworkTerritoryWind } from "./NetworkTerritoryWind";
import { networkTerritoryWind } from "../shared/networkTerritoryWind";
import { networkResultBounds } from "../shared/networkResultBounds";
import { NetworkPlanningDiagnosticsView } from "./NetworkPlanningDiagnostics";
import "./NetworkZoneCard.css";
import { NetworkRunPassport } from "./NetworkRunPassport";
import "./NetworkResultLayout.css";

const MapPanel = lazy(() => import("./MapPanel"));

type ResultView = NetworkDesign | NetworkDesignEnsemble;
type Candidate = NetworkDesign["scenarios"][number];

interface NetworkDesignResultViewProps {
  run: NetworkDesignRun;
  activeResult: ResultView;
  resultViewId: string;
  selectedCandidateId: string | null;
  reportSaving: boolean;
  reportSaved: boolean;
  reportError: string | null;
  resultStale: boolean;
  runError: string | null;
  onResultViewChange: (value: string) => void;
  onSelectCandidate: (value: string) => void;
  onEdit: () => void;
  onDownloadReport: () => void;
  archiveView?: "result" | "research";
}

const ROLE_LABELS: Record<NetworkFunctionalRoleId, string> = {
  urban_background: "Городской фон",
  transport_context: "Влияние магистралей",
  industrial_context: "Промышленное окружение",
};

const EVIDENCE_LABELS: Record<string, string> = {
  candidate: "кандидатная роль",
  supporting_context: "дополнительный признак",
  low_evidence: "мало данных",
  unavailable: "данные недоступны",
};

const integer = (value: number | null | undefined) =>
  value == null ? "—" : Math.round(value).toLocaleString("ru-RU");

const percent = (value: number | null | undefined, digits = 0) =>
  value == null ? "—" : `${value.toFixed(digits)}%`;

function candidateRole(candidate: Candidate) {
  const assessment = candidate.role_assessment;
  const explicit = assessment?.suggested_role;
  const supportedExplicit =
    explicit && explicit in ROLE_LABELS ? explicit : null;
  const firstCandidate = Object.entries(assessment?.roles ?? {}).find(
    ([roleId, role]) => roleId in ROLE_LABELS && role?.status === "candidate",
  )?.[0] as NetworkFunctionalRoleId | undefined;
  const firstSupporting = Object.entries(assessment?.roles ?? {}).find(
    ([roleId, role]) =>
      roleId in ROLE_LABELS && role?.status === "supporting_context",
  )?.[0] as NetworkFunctionalRoleId | undefined;
  const id = supportedExplicit ?? firstCandidate ?? firstSupporting ?? null;
  const result = id ? assessment?.roles[id] : null;
  return {
    id,
    title: id ? ROLE_LABELS[id] : "Нет подтверждённой функциональной роли",
    evidence: result?.status
      ? (EVIDENCE_LABELS[result.status] ?? result.status)
      : "требуется полевая проверка",
  };
}

function contextProfile(candidate: Candidate) {
  const components = candidate.factors?.components ?? {};
  const values = [
    {
      id: "population",
      label: "Население",
      value: Number(
        components.population ?? components.integrated_population ?? 0,
      ),
    },
    {
      id: "industrial",
      label: "Промышленный",
      value: Number(
        components.industrial_wind_distance ?? components.sources ?? 0,
      ),
    },
    {
      id: "transport",
      label: "Транспортный",
      value: Number(
        components.transport_screening ?? components.traffic_osm_proxy ?? 0,
      ),
    },
    {
      id: "urban",
      label: "Городской фон",
      value: Number(components.integrated_urban_background ?? 0),
    },
  ];
  const total = values.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  return values.map((item) => ({
    ...item,
    share: total > 0 ? (Math.max(0, item.value) / total) * 100 : 25,
  }));
}

export function NetworkDesignResultView({
  run,
  activeResult,
  resultViewId,
  selectedCandidateId,
  reportSaving,
  reportSaved,
  reportError,
  resultStale,
  runError,
  onResultViewChange,
  onSelectCandidate,
  onEdit,
  onDownloadReport,
  archiveView,
}: NetworkDesignResultViewProps) {
  // Alternatives remain selectable in an individual meteo scenario as well:
  // each carries its own source/wind context for the map presentation.
  const ensembleAlternatives = run.ensemble.scenario_alternatives ?? [];
  const candidates = [...activeResult.scenarios, ...ensembleAlternatives];
  const selectedCandidate =
    candidates.find((item) => item.cell_id === selectedCandidateId) ??
    candidates[0] ??
    null;
  const selectedContext =
    selectedCandidate?.source_wind_context_by_profile?.[resultViewId] ??
    selectedCandidate?.source_wind_context;
  const selectedRole = selectedCandidate
    ? candidateRole(selectedCandidate)
    : null;
  const territoryRose = useMemo(
    () => networkTerritoryWind(run, resultViewId),
    [run, resultViewId],
  );
  const profile = selectedCandidate ? contextProfile(selectedCandidate) : [];
  const [activeTool, setActiveTool] = useState<
    "diagnostics" | "experiments" | "passport" | null
  >(archiveView ? "diagnostics" : null);
  const [visitedExperiments, setVisitedExperiments] = useState(false);
  const isResearch = archiveView === "research";
  const mapWorkspace = useRef<HTMLDivElement>(null);
  const toolWorkspace = useRef<HTMLElement>(null);
  const toolOptions = [
    {
      id: "diagnostics",
      title: "Обоснование расчёта",
      description: "Охват, вклад зон и устойчивость",
    },
    {
      id: "experiments",
      title: "Проверка решения",
      description: "Перенос точек, размер сети и решатель",
    },
    {
      id: "passport",
      title: "Паспорт и данные",
      description: "Параметры, версии и исходный запуск",
    },
  ] as const;
  const [siteChecks, setSiteChecks] = useState<SiteCheck | null>(null);
  const [siteOverlay, setSiteOverlay] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [showStability, setShowStability] = useState(false);
  const [editingPoints, setEditingPoints] = useState(false);
  const [movedPoints, setMovedPoints] = useState<Record<string, PlanningPoint>>(
    {},
  );
  useEffect(() => {
    if (editingPoints)
      requestAnimationFrame(() =>
        mapWorkspace.current?.scrollIntoView({
          block: "start",
          behavior: "smooth",
        }),
      );
  }, [editingPoints]);
  useEffect(() => {
    setEditingPoints(false);
  }, [archiveView]);
  const moveCandidate = useCallback(
    (cell_id: string, longitude: number, latitude: number) => {
      setMovedPoints((previous) => ({
        ...previous,
        [cell_id]: { cell_id, longitude, latitude },
      }));
    },
    [],
  );
  const invalidCandidateIds = useMemo(
    () =>
      siteChecks?.sites.filter((row) => !row.valid).map((row) => row.cell_id),
    [siteChecks],
  );
  useEffect(() => {
    setMovedPoints({});
    setEditingPoints(false);
  }, [run.id, resultViewId]);
  useEffect(() => {
    setSiteOverlay(null);
    setSiteChecks(null);
    if (!editingPoints) return;
    const controller = new AbortController();
    void request<GeoJSON.FeatureCollection>(
      `/api/spatial/network-design/runs/${encodeURIComponent(run.id)}/site-domain?view=${encodeURIComponent(resultViewId)}`,
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted) setSiteOverlay(value);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [editingPoints, run.id, resultViewId]);
  const experimentPoints = activeResult.scenarios.map(
    (item) => movedPoints[item.cell_id] ?? item,
  );
  const [layersOpen, setLayersOpen] = useState(false);
  const [focusedMarkerId, setFocusedMarkerId] = useState<string | null>(null);
  const [layerVisibility, setLayerVisibility] = useState({
    population: true,
    boundaries: true,
    zones: true,
    coverageRings: true,
    stations: true,
    sources: true,
    roads: false,
    recreation: false,
    windSector: true,
    flowArrows: true,
    relationships: true,
  });

  const resultMapData =
    resultViewId === "ensemble"
      ? (run.ensemble.map_geojson ?? activeResult.candidate_zones_geojson)
      : activeResult.candidate_zones_geojson;
  const bounds = useMemo(
    () =>
      networkResultBounds(
        activeResult.territory.bounds,
        [...activeResult.scenarios, ...ensembleAlternatives],
        run.request.radius_m,
      ),
    [
      activeResult.scenarios,
      activeResult.territory.bounds,
      ensembleAlternatives,
      run.request.radius_m,
    ],
  );
  const showExistingStations = run.request.planning_mode === "expand";
  const markers = useMemo(
    () => [
      ...(showExistingStations ? activeResult.active_stations : []).map(
        (item) => ({
          id: item.id,
          longitude: item.longitude,
          latitude: item.latitude,
          label: item.name,
          kind: "station" as const,
          station_type: item.station_type,
          station_operator: item.operator,
          station_address: item.address,
        }),
      ),
      ...(showExistingStations ? (activeResult.route_stations ?? []) : []).map(
        (item) => ({
          id: item.id,
          longitude: item.longitude,
          latitude: item.latitude,
          label: item.name,
          kind: "station" as const,
          station_type: item.station_type,
          station_operator: item.operator,
          station_address: item.address,
        }),
      ),
      ...activeResult.scenarios.map((original) => {
        const item = movedPoints[original.cell_id] ?? original;
        return {
          id: item.cell_id,
          longitude: item.longitude,
          latitude: item.latitude,
          label: String(original.rank),
          kind: "candidate" as const,
        };
      }),
      ...ensembleAlternatives.map((item) => ({
        id: item.cell_id,
        longitude: item.longitude,
        latitude: item.latitude,
        label: `A${item.rank}`,
        kind: "alternative" as const,
      })),
      ...(selectedContext?.sources ?? []).map((item) => ({
        id: item.source_id,
        longitude: item.longitude,
        latitude: item.latitude,
        label: item.name,
        kind: "source" as const,
        relevant: item.status === "supporting_context",
      })),
    ],
    [
      activeResult,
      ensembleAlternatives,
      selectedContext,
      showExistingStations,
      movedPoints,
    ],
  );

  const coverage =
    activeResult.coverage_summary ?? run.ensemble.coverage_summary;
  const stabilityEvaluable = run.ensemble.scenario_count > 1;
  const validScenarioCount = Math.max(1, run.ensemble.scenario_count);
  const coverageRadiusLabel = (run.request.radius_m / 1000).toLocaleString(
    "ru-RU",
    {
      maximumFractionDigits: 1,
    },
  );
  const candidatePopupDetails = useMemo(
    () =>
      Object.fromEntries(
        candidates.map((candidate) => {
          const role = candidateRole(candidate);
          const leadingFactors = contextProfile(candidate)
            .filter((item) => item.value > 0)
            .sort((first, second) => second.share - first.share)
            .slice(0, 2)
            .map((item) => item.label.toLowerCase());
          const nearbyRecreation =
            Number(candidate.factors?.components?.recreation_context ?? 0) > 0;
          const isAlternative = candidate.ensemble_role === "alternative";
          return [
            candidate.cell_id,
            {
              title: isAlternative
                ? `Альтернативная зона A${candidate.rank}`
                : `Зона ${candidate.zone_code ?? candidate.rank}`,
              kind: isAlternative ? "Альтернативный вариант" : "Основная зона",
              population: `+${integer(candidate.additional_population ?? candidate.newly_covered_population)} жителей в дополнительном охвате`,
              role: role.title,
              reasons: leadingFactors.length
                ? `Главные основания: ${leadingFactors.join(" и ")}.`
                : "Выбрана по дополнительному охвату населения.",
              stability: stabilityEvaluable
                ? `Повторяется в ${candidate.selected_in_scenarios?.length ?? 1} из ${validScenarioCount} сценариев`
                : "Один основной сценарий",
              recreationNote: nearbyRecreation
                ? "Парки и зоны отдыха рядом показаны справочно"
                : undefined,
            },
          ];
        }),
      ),
    [candidates, stabilityEvaluable, validScenarioCount],
  );

  const toggleLayer = (id: keyof typeof layerVisibility) => {
    setLayerVisibility((current) => ({ ...current, [id]: !current[id] }));
  };

  const selectAdjacent = (direction: -1 | 1) => {
    if (!selectedCandidate || candidates.length < 2) return;
    const current = candidates.findIndex(
      (item) => item.cell_id === selectedCandidate.cell_id,
    );
    const next = (current + direction + candidates.length) % candidates.length;
    onSelectCandidate(candidates[next].cell_id);
  };

  return (
    <section className="network-result-v4" data-testid="network-design-result">
      <header className="network-result-v4__header">
        <div>
          <h2>
            {run.readiness.territory.name} ·{" "}
            {run.request.planning_mode === "expand"
              ? "Расширение сети"
              : "Новая сеть"}{" "}
            · {run.request.post_count}{" "}
            {run.request.post_count === 1
              ? "пост"
              : run.request.post_count >= 2 && run.request.post_count <= 4
                ? "поста"
                : "постов"}
          </h2>
        </div>
        <div className="network-result-v4__actions">
          <button className="button button--ghost" onClick={onEdit}>
            <SlidersHorizontal />{" "}
            {archiveView ? "Открыть в проектировании" : "Изменить параметры"}
          </button>
          <div className="network-result-v4__report-action">
            {" "}
            <button
              className="button button--primary"
              disabled={reportSaving}
              onClick={onDownloadReport}
            >
              <FileText />{" "}
              {reportSaving
                ? "Готовим отчёт…"
                : reportError
                  ? "Повторить открытие"
                  : "Открыть отчёт"}
            </button>
            <span
              className={`network-result-v4__save-status${reportError ? " is-error" : ""}`}
              role="status"
              aria-live="polite"
            >
              {reportSaving
                ? "Готовим отчёт…"
                : reportError
                  ? `Отчёт не подготовлен: ${reportError}`
                  : reportSaved
                    ? "Отчёт готов к просмотру"
                    : archiveView
                      ? "Отчёт ещё не сформирован"
                      : "Подготовка отчёта…"}
            </span>
          </div>
        </div>
      </header>

      {(runError || resultStale || run.persistence_warning) && (
        <div className="network-result-v4__alerts">
          {runError && <span>{runError}</span>}
          {resultStale && (
            <span>
              Параметры изменены после расчёта — показан сохранённый запуск.
            </span>
          )}
          {run.persistence_warning && <span>{run.persistence_warning}</span>}
        </div>
      )}

      {activeResult.feasibility && (
        <div className="network-result-v4__alerts" role="status">
          <span>{activeResult.feasibility.message}</span>
          <span>
            Доступно кандидатных участков:{" "}
            {activeResult.feasibility.available_candidates}. Сформировано зон:{" "}
            {activeResult.feasibility.selected_positions}.
          </span>
          {activeResult.feasibility.suggested_grid_km.length > 0 && (
            <span>
              Для уточнения отбора можно проверить шаг сетки{" "}
              {activeResult.feasibility.suggested_grid_km
                .map((value) => value.toLocaleString("ru-RU"))
                .join(" или ")}{" "}
              км. Число заданных позиций сохранено.
            </span>
          )}
          {activeResult.feasibility.review_zones?.map((zone) => (
            <span key={zone.zone_code}>
              Зона {zone.zone_code}:{" "}
              {zone.constraints
                .map((item) => item.name || item.id || "ограничение территории")
                .join(", ")}{" "}
              — требуется экспертная проверка.
            </span>
          ))}
        </div>
      )}

      <div
        className="network-result-v4__kpis"
        aria-label="Сводные показатели результата"
        hidden={isResearch && !editingPoints}
      >
        <article>
          <span>Дополнительный охват</span>
          <strong>
            +{integer(coverage?.additional_covered_population)}{" "}
            <small>чел.</small>
          </strong>
          <em>
            {coverage?.population_total
              ? `+${percent((coverage.additional_covered_population / coverage.population_total) * 100, 1)}`
              : "single-count"}
          </em>
        </article>
        <article>
          <span>Основные зоны</span>
          <strong>
            {activeResult.scenarios.length}{" "}
            <small>из {run.request.post_count}</small>
          </strong>
          <em>{ensembleAlternatives.length} альтернативных зон</em>
        </article>
        <article>
          <span>Вне охвата</span>
          <strong>
            {integer(coverage?.remaining_uncovered_population)}{" "}
            <small>чел.</small>
          </strong>
        </article>
      </div>

      {editingPoints && (
        <div className="network-result-tools__editing" role="status">
          <div>
            <strong>Редактирование варианта</strong>
            <span>
              Перетащите точки на карте, затем пересчитайте охват. Исходный
              запуск сохранён.
            </span>
          </div>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => {
              setEditingPoints(false);
              toolWorkspace.current?.scrollIntoView({
                block: "start",
                behavior: "smooth",
              });
            }}
          >
            К проверке охвата ↓
          </button>
        </div>
      )}
      <div
        className="network-result-v4__workspace"
        ref={mapWorkspace}
        hidden={isResearch && !editingPoints}
      >
        {Object.keys(movedPoints).length > 0 && (
          <p className="network-result-tools__changed" role="status">
            Карта показывает перенесённые точки. Сводные показатели и оценки зон
            выше относятся к исходному запуску; охват изменённого варианта
            показан в блоке «Проверка проектного решения» после пересчёта.
          </p>
        )}
        <div className="network-result-v4__map-column">
          <div className="network-result-v4__map-shell">
            <Suspense
              fallback={<div className="map-state">Загрузка MapLibre…</div>}
            >
              <MapPanel
                data={resultMapData}
                planningOverlay={
                  editingPoints
                    ? siteOverlay
                    : showStability
                      ? run.ensemble.zone_stability?.geojson
                      : null
                }
                invalidCandidateIds={invalidCandidateIds}
                onCandidateMove={editingPoints ? moveCandidate : undefined}
                populationLayer={activeResult.population_geojson}
                coverageRadiusM={run.request.radius_m}
                selectedCellId={selectedCandidate?.cell_id ?? null}
                selectedMarkerId={selectedCandidate?.cell_id ?? null}
                focusedMarkerId={focusedMarkerId}
                minValue={0}
                maxValue={1}
                onSelect={(feature: CellFeature) =>
                  onSelectCandidate(feature.properties.cell_id)
                }
                onMarkerSelect={(markerId) => {
                  if (candidates.some((item) => item.cell_id === markerId)) {
                    onSelectCandidate(markerId);
                  }
                }}
                viewBounds={bounds}
                markers={markers}
                boundaryLayers={activeResult.boundary_layers}
                contextLayers={activeResult.context_layers}
                candidatePopupDetails={candidatePopupDetails}
                presentationLayers={
                  editingPoints || Object.keys(movedPoints).length
                    ? {}
                    : {
                        // Earlier saved runs may contain fans for several close peaks.
                        // Show only the leading sector and its three flow arrows.
                        upwindSector: selectedContext
                          ? {
                              ...selectedContext.upwind_sector_geojson,
                              features:
                                selectedContext.upwind_sector_geojson.features.slice(
                                  0,
                                  1,
                                ),
                            }
                          : undefined,
                        flowArrows: selectedContext
                          ? {
                              ...selectedContext.flow_arrows_geojson,
                              features:
                                selectedContext.flow_arrows_geojson.features.slice(
                                  0,
                                  3,
                                ),
                            }
                          : undefined,
                        sourceRelationships:
                          selectedContext?.source_relationships_geojson,
                      }
                }
                layerVisibility={layerVisibility}
                networkDesignMode
                mapControls={
                  <>
                    {run.ensemble.zone_stability?.status === "ready" &&
                      resultViewId === "ensemble" &&
                      !editingPoints &&
                      !layersOpen && (
                        <button
                          className="network-result-v4__layers-button planning-stability-map-button"
                          aria-pressed={showStability}
                          onClick={() => setShowStability((value) => !value)}
                        >
                          Контуры и смещения:{" "}
                          {showStability ? "показаны" : "показать"}
                        </button>
                      )}
                    <button
                      className="network-result-v4__layers-button"
                      aria-expanded={layersOpen}
                      onClick={() => setLayersOpen((value) => !value)}
                    >
                      <Layers3 /> Слои{" "}
                      <b>
                        {Object.values(layerVisibility).filter(Boolean).length}
                      </b>
                    </button>
                    {layersOpen && (
                      <div
                        className="network-result-v4__layers"
                        role="dialog"
                        aria-label="Управление слоями"
                      >
                        <header>
                          <strong>Слои карты</strong>
                          <button
                            aria-label="Закрыть слои"
                            onClick={() => setLayersOpen(false)}
                          >
                            ×
                          </button>
                        </header>
                        <span>Базовые</span>
                        {(
                          [
                            ["population", "Плотность населения"],
                            ["boundaries", "Граница территории"],
                            ["zones", "Основные и альтернативные зоны"],
                            [
                              "coverageRings",
                              `Зоны покрытия · r = ${coverageRadiusLabel} км`,
                            ],
                            ["stations", "Существующие посты"],
                          ] as const
                        ).map(([id, label]) => (
                          <label key={id}>
                            <input
                              type="checkbox"
                              checked={layerVisibility[id]}
                              onChange={() => toggleLayer(id)}
                            />
                            {label}
                          </label>
                        ))}
                        <span>Дополнительные слои</span>
                        {(
                          [
                            ["sources", "Промышленные объекты и площадки OSM"],
                            ["roads", "Транспорт OSM: дороги, ж/д, аэропорты"],
                            ["recreation", "Парки и зоны отдыха"],
                          ] as const
                        ).map(([id, label]) => (
                          <label key={id}>
                            <input
                              type="checkbox"
                              checked={layerVisibility[id]}
                              onChange={() => toggleLayer(id)}
                            />
                            {label}
                          </label>
                        ))}
                        <label
                          className="is-disabled"
                          title="Набор данных не подключён"
                        >
                          <input disabled type="checkbox" />
                          Полигоны ТКО · нет данных
                        </label>
                        <label
                          className="is-disabled"
                          title="Набор данных не подключён"
                        >
                          <input disabled type="checkbox" />
                          Котельные / ТЭЦ · нет данных
                        </label>
                        <span>Метеорология</span>
                        {(
                          [
                            ["windSector", "Сектор самого частого ветра"],
                            ["flowArrows", "Приход воздуха к точке"],
                            ["relationships", "Связи с объектами"],
                          ] as const
                        ).map(([id, label]) => (
                          <label key={id}>
                            <input
                              type="checkbox"
                              checked={layerVisibility[id]}
                              onChange={() => toggleLayer(id)}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    )}
                  </>
                }
                mapLegend={
                  <div
                    className="network-result-v4__legend"
                    aria-label="Легенда карты. Визуализация не является моделью рассеивания."
                  >
                    <header>
                      <strong>
                        Плотность населения <small>(чел. / км²)</small>
                      </strong>
                    </header>
                    <div className="network-result-v4__density-bins">
                      <span>
                        <i className="density density--very-high" />
                        &gt; 10 000
                      </span>
                      <span>
                        <i className="density density--high" />5 000 – 10 000
                      </span>
                      <span>
                        <i className="density density--medium" />1 000 – 5 000
                      </span>
                      <span>
                        <i className="density density--low" />
                        200 – 1 000
                      </span>
                      <span>
                        <i className="density density--very-low" />
                        &lt; 200
                      </span>
                    </div>
                    <strong className="network-result-v4__legend-section-title">
                      Кандидатные зоны
                    </strong>
                    <div className="network-result-v4__legend-items">
                      <span>
                        <i className="is-zone" />
                        Основные точки
                      </span>
                      <span>
                        <i className="is-alternative" />
                        Альтернативные точки
                      </span>
                      <span>
                        <i className="is-station" />
                        Существующие посты
                      </span>
                      <span>
                        <i className="is-coverage-ring" />
                        Зона покрытия (r = {coverageRadiusLabel} км)
                      </span>
                      <span>
                        <Factory
                          className="network-result-v4__legend-source-icon"
                          aria-hidden="true"
                        />
                        Промышленные предприятия
                      </span>
                    </div>
                  </div>
                }
              />
            </Suspense>
          </div>
        </div>

        <div className="network-result-v4__sidebar">
          <aside
            className="network-result-v4__inspector network-zone-card"
            aria-label="Инспектор выбранной зоны"
          >
            {selectedCandidate && selectedRole ? (
              <>
                <header>
                  <div>
                    <span>Выбрана зона</span>
                    <h3>
                      {selectedCandidate.ensemble_role === "alternative"
                        ? `Альтернатива A${selectedCandidate.rank}`
                        : `Зона ${selectedCandidate.zone_code ?? selectedCandidate.rank}`}
                    </h3>
                    <em>
                      {selectedCandidate.ensemble_role === "alternative"
                        ? "Альтернативная зона"
                        : "Основная зона"}
                    </em>
                  </div>
                  <nav>
                    <button
                      aria-label="Предыдущая зона"
                      onClick={() => selectAdjacent(-1)}
                    >
                      <ChevronLeft />
                    </button>
                    <button
                      aria-label="Следующая зона"
                      onClick={() => selectAdjacent(1)}
                    >
                      <ChevronRight />
                    </button>
                  </nav>
                </header>

                <div className="network-zone-card__body">
                  <section className="network-result-v4__role">
                    <div>
                      <MapPin />
                      <strong>{selectedRole.title}</strong>
                      <em>{selectedRole.evidence}</em>
                    </div>
                  </section>

                  <section className="network-result-v4__profile">
                    <details className="network-zone-card__factors">
                      <summary title="Факторы выбора не являются долями загрязнения">
                        Факторы выбора зоны <ChevronDown aria-hidden="true" />
                      </summary>
                      <div className="network-result-v4__profile-bar">
                        {profile.map((item) => (
                          <i
                            key={item.id}
                            className={`is-${item.id}`}
                            style={{ width: `${item.share}%` }}
                          />
                        ))}
                      </div>
                      <div className="network-zone-card__factor-legend">
                        {profile.map((item) => (
                          <span key={item.id}>
                            <i className={`is-${item.id}`} />
                            {item.label}
                            <b>{Math.round(item.share)}%</b>
                          </span>
                        ))}
                      </div>
                      <small>
                        Показаны факторы выбора зоны, а не доли загрязнения.
                      </small>
                    </details>
                  </section>

                  <section className="network-result-v4__scenario-panel">
                    <header>
                      <span>Сценарий расчёта</span>
                      <button onClick={onEdit}>Параметры</button>
                    </header>
                    <label aria-label="Сценарий расчёта">
                      <select
                        value={resultViewId}
                        onChange={(event) =>
                          onResultViewChange(event.target.value)
                        }
                      >
                        <option value="ensemble">
                          Рекомендованный вариант
                        </option>
                        {run.scenario_results.map((item) => (
                          <option
                            key={item.scenario_id}
                            value={item.scenario_id}
                          >
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <small>
                      Объединяет точки, которые повторяются в доступных
                      вариантах расчёта.
                    </small>
                  </section>
                </div>
              </>
            ) : (
              <div className="network-result-v4__missing">
                Кандидатные зоны не сформированы.
              </div>
            )}
          </aside>
          <NetworkTerritoryWind
            rose={territoryRose}
            territory={run.readiness.territory.name}
          />
        </div>
      </div>

      {archiveView && (
        <section
          hidden={!isResearch}
          className="network-result-tools"
          ref={toolWorkspace}
          aria-label="Проверка расчёта и служебные данные"
        >
          <header>
            <div>
              <h3>Научная проверка</h3>
              <p>
                Обоснование, эксперименты и паспорт сохранённого запуска.
                Исходный расчёт не изменяется.
              </p>
            </div>
            {activeTool && (
              <button
                type="button"
                className="button button--ghost"
                onClick={() => {
                  setActiveTool(null);
                  setEditingPoints(false);
                }}
              >
                Свернуть
              </button>
            )}
          </header>
          <div
            className="network-result-tools__navigation"
            aria-label="Инструменты проверки"
          >
            {toolOptions.map((tool) => (
              <button
                key={tool.id}
                id={`network-tool-${tool.id}`}
                type="button"
                aria-expanded={activeTool === tool.id}
                aria-controls={`network-tool-panel-${tool.id}`}
                className={activeTool === tool.id ? "is-active" : ""}
                onClick={() => {
                  setActiveTool((current) =>
                    current === tool.id ? null : tool.id,
                  );
                  setEditingPoints(false);
                  if (tool.id === "experiments") setVisitedExperiments(true);
                }}
              >
                <strong>{tool.title}</strong>
                <span>{tool.description}</span>
              </button>
            ))}
          </div>
          <div
            id="network-tool-panel-diagnostics"
            role="region"
            aria-labelledby="network-tool-diagnostics"
            hidden={activeTool !== "diagnostics"}
          >
            {activeResult.planning_diagnostics ? (
              <NetworkPlanningDiagnosticsView
                zones={run.ensemble.zone_stability}
                diagnostics={activeResult.planning_diagnostics}
                stress={run.ensemble.fixed_layout_stress}
                selectedCellId={selectedCandidate?.cell_id}
              />
            ) : (
              <p className="planning-help">
                Для этого сохранённого запуска диагностика не выполнялась.
              </p>
            )}
          </div>
          <div
            id="network-tool-panel-experiments"
            role="region"
            aria-labelledby="network-tool-experiments"
            hidden={activeTool !== "experiments"}
          >
            {visitedExperiments && (
              <>
                <NetworkPlanningHelp mode="result" />
                <NetworkPlanningLab
                  key={`${run.id}:${resultViewId}`}
                  runId={run.id}
                  view={resultViewId}
                  count={run.request.post_count}
                  points={experimentPoints}
                  onValidation={setSiteChecks}
                  onApplyPoints={(points) =>
                    setMovedPoints(
                      Object.fromEntries(
                        points.map((point) => [point.cell_id, point]),
                      ),
                    )
                  }
                  editing={editingPoints}
                  onEditingChange={(value) => {
                    setEditingPoints(value);
                    if (value)
                      mapWorkspace.current?.scrollIntoView({
                        block: "start",
                        behavior: "smooth",
                      });
                  }}
                  onReset={() => setMovedPoints({})}
                />
              </>
            )}
          </div>
          <div
            id="network-tool-panel-passport"
            role="region"
            aria-labelledby="network-tool-passport"
            hidden={activeTool !== "passport"}
          >
            <NetworkRunPassport
              run={run}
              windView={resultViewId}
            />
          </div>
        </section>
      )}
    </section>
  );
}
