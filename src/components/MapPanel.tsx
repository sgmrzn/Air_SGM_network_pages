import { useEffect, useRef, type ReactNode } from "react";
import maplibregl, { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { baseMapStyle } from "../mapStyle";
import type { CellCollection, CellFeature } from "../types";
import { SOURCE_SYMBOLS } from "../shared/sourceSymbols";

interface MapPanelProps {
  data: CellCollection | null;
  selectedCellId: string | null;
  minValue: number | null;
  maxValue: number | null;
  onSelect: (cell: CellFeature) => void;
  onMarkerSelect?: (markerId: string) => void;
  planningOverlay?: GeoJSON.FeatureCollection | null;
  invalidCandidateIds?: string[];
  onCandidateMove?: (id: string, longitude: number, latitude: number) => void;
  highlightedStationId?: string | null;
  focusedMarkerId?: string | null;
  selectedMarkerId?: string | null;
  networkDesignMode?: boolean;
  coverageRadiusM?: number | null;
  viewBounds?: [[number, number], [number, number]];
  /** Merged outline of all post zones; carries the fill instead of the parts. */
  unionLayer?: CellCollection | null;
  markers?: Array<{
    id: string;
    longitude: number;
    latitude: number;
    label: string;
    kind?: "station" | "candidate" | "alternative" | "source";
    station_type?: string;
    source_symbol?: string;
    station_operator?: string | null;
    station_address?: string | null;
    relevant?: boolean;
  }>;
  boundaryLayers?: {
    regions?: GeoJSON.FeatureCollection;
    selected?: CellCollection;
    municipalities?: CellCollection;
    settlements?: CellCollection;
  };
  contextLayers?: GeoJSON.FeatureCollection | null;
  populationLayer?: CellCollection | null;
  presentationLayers?: {
    upwindSector?: GeoJSON.FeatureCollection | null;
    flowArrows?: GeoJSON.FeatureCollection | null;
    sourceRelationships?: GeoJSON.FeatureCollection | null;
  };
  candidatePopupDetails?: Record<
    string,
    {
      title: string;
      kind: string;
      population: string;
      role: string;
      reasons: string;
      stability: string;
      recreationNote?: string;
    }
  >;
  /** UI overlays that must remain inside MapLibre's fullscreen container. */
  mapControls?: ReactNode;
  mapLegend?: ReactNode;
  layerVisibility?: Partial<Record<
    | "population"
    | "boundaries"
    | "zones"
    | "coverageRings"
    | "stations"
    | "sources"
    | "roads"
    | "recreation"
    | "windSector"
    | "flowArrows"
    | "relationships",
    boolean
  >>;
}

const EMPTY_COLLECTION: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};
const EMPTY_MARKERS: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};
const COLORS = ["#2c7bb6", "#abd9e9", "#ffffbf", "#fdae61", "#d7191c"];
const NATIONAL_BOUNDS: [[number, number], [number, number]] = [
  [19, 41],
  [191, 82],
];
const CITY_LABELS = [
  ["Рязань", 39.74, 54.63],
  ["Касимов", 41.39, 54.94],
  ["Сасово", 41.91, 54.35],
  ["Шацк", 41.71, 54.03],
  ["Шилово", 40.88, 54.32],
  ["Скопин", 39.55, 53.82],
  ["Кораблино", 40.02, 53.92],
  ["Новомичуринск", 39.75, 54.04],
] as const;

function markerIcon(draw: (context: CanvasRenderingContext2D) => void) {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Не удалось подготовить значок маркера");
  draw(context);
  return context.getImageData(0, 0, size, size);
}

function addNetworkMarkerIcons(map: MapLibreMap) {
  for (const [key, symbol] of Object.entries(SOURCE_SYMBOLS)) {
    if (map.hasImage(`source-${key}`)) continue;
    map.addImage(`source-${key}`, markerIcon((context) => {
      context.translate(4, 4);
      context.strokeStyle = symbol.color;
      context.lineWidth = 2;
      context.lineJoin = "round";
      context.lineCap = "round";
      context.stroke(new Path2D(symbol.path));
    }), { pixelRatio: 2 });
  }
  if (!map.hasImage("network-station-icon")) {
    map.addImage("network-station-icon", markerIcon((context) => {
      context.beginPath();
      context.moveTo(16, 4);
      context.lineTo(28, 27);
      context.lineTo(4, 27);
      context.closePath();
      context.fillStyle = "#18a45e";
      context.fill();
      context.lineWidth = 3;
      context.strokeStyle = "#ffffff";
      context.stroke();
    }), { pixelRatio: 2 });
  }

  if (!map.hasImage("network-source-icon")) {
    map.addImage("network-source-icon", markerIcon((context) => {
      context.lineJoin = "round";
      context.lineCap = "round";
      context.lineWidth = 3;
      context.strokeStyle = "#8b43b9";
      context.beginPath();
      context.moveTo(5, 27);
      context.lineTo(5, 17);
      context.lineTo(12, 17);
      context.lineTo(12, 12);
      context.lineTo(17, 16);
      context.lineTo(17, 9);
      context.lineTo(22, 9);
      context.lineTo(22, 27);
      context.closePath();
      context.moveTo(25, 27);
      context.lineTo(25, 5);
      context.lineTo(28, 5);
      context.lineTo(28, 27);
      context.moveTo(9, 22);
      context.lineTo(9, 27);
      context.moveTo(15, 22);
      context.lineTo(15, 27);
      context.stroke();
    }), { pixelRatio: 2 });
  }
}

function colorExpression(
  min: number | null,
  max: number | null,
): maplibregl.ExpressionSpecification {
  const low = min ?? 0;
  const high = max ?? low + 1;
  const span = high - low || 1;
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "feature_value"], low],
    low,
    COLORS[0],
    low + span * 0.25,
    COLORS[1],
    low + span * 0.5,
    COLORS[2],
    low + span * 0.75,
    COLORS[3],
    high,
    COLORS[4],
  ];
}

function fillColorExpression(
  min: number | null,
  max: number | null,
): maplibregl.ExpressionSpecification {
  return ["case", ["has", "station_id"], "#0f766e", colorExpression(min, max)];
}

function populationColorExpression(): maplibregl.ExpressionSpecification {
  return [
    "step",
    ["coalesce", ["get", "population_density_km2"], 0],
    "rgba(239,244,212,0.32)",
    200,
    "#fee9a9",
    1000,
    "#fdc57a",
    5000,
    "#f58a5c",
    10000,
    "#d84b55",
  ];
}

function destinationCoordinate(
  longitude: number,
  latitude: number,
  bearingDegrees: number,
  distanceKm: number,
): [number, number] {
  const angularDistance = Math.max(0, distanceKm) / 6371.0088;
  const bearing = bearingDegrees * Math.PI / 180;
  const latitudeRadians = latitude * Math.PI / 180;
  const longitudeRadians = longitude * Math.PI / 180;
  const projectedLatitude = Math.asin(
    Math.sin(latitudeRadians) * Math.cos(angularDistance)
      + Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const projectedLongitude = longitudeRadians + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitudeRadians),
    Math.cos(angularDistance) - Math.sin(latitudeRadians) * Math.sin(projectedLatitude),
  );
  return [
    ((projectedLongitude * 180 / Math.PI + 540) % 360) - 180,
    projectedLatitude * 180 / Math.PI,
  ];
}

function coverageRingCollection(
  markers: NonNullable<MapPanelProps["markers"]>,
  radiusM: number,
  selectedCellId: string | null,
): GeoJSON.FeatureCollection {
  const radiusKm = Math.max(0, radiusM) / 1000;
  if (radiusKm <= 0) return EMPTY_COLLECTION;
  return {
    type: "FeatureCollection",
    features: markers
      .filter((marker) => marker.kind === "candidate" || marker.kind === "alternative")
      .map((marker) => {
        const ring = Array.from({ length: 72 }, (_, index) =>
          destinationCoordinate(
            marker.longitude,
            marker.latitude,
            index * 5,
            radiusKm,
          ),
        );
        ring.push(ring[0]);
        return {
          type: "Feature" as const,
          geometry: { type: "Polygon" as const, coordinates: [ring] },
          properties: {
            id: marker.id,
            kind: marker.kind,
            radius_m: radiusM,
            selected: marker.id === selectedCellId,
          },
        };
      }),
  };
}

function escapePopupText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export default function MapPanel({
  data,
  selectedCellId,
  minValue,
  maxValue,
  onSelect,
  onMarkerSelect,
  highlightedStationId,
  focusedMarkerId,
  selectedMarkerId,
  networkDesignMode = false,
  coverageRadiusM,
  viewBounds,
  markers = [],
  boundaryLayers,
  contextLayers,
  populationLayer,
  presentationLayers,
  candidatePopupDetails,
  mapControls,
  mapLegend,
  layerVisibility,
  unionLayer,
  onCandidateMove,
  planningOverlay,
  invalidCandidateIds = [],
}: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  const onMarkerSelectRef = useRef(onMarkerSelect);
  const candidatePopupDetailsRef = useRef(candidatePopupDetails);
  // Read by the one-shot "load" handler, which may fire after the territory is
  // already known.
  const viewBoundsRef = useRef(viewBounds);
  viewBoundsRef.current = viewBounds;

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    onMarkerSelectRef.current = onMarkerSelect;
  }, [onMarkerSelect]);
  useEffect(() => {
    candidatePopupDetailsRef.current = candidatePopupDetails;
  }, [candidatePopupDetails]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: baseMapStyle,
      center: [90, 62],
      zoom: 2.6,
      maxZoom: 15,
      attributionControl: false,
    });
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
    });
    const sourcePopup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: 14, maxWidth: "280px" });
    const showSourcePopup = (properties: Record<string, unknown>, longitude: number, latitude: number) => {
      const key = String(properties.source_symbol ?? properties.feature_type ?? "");
      const symbol = SOURCE_SYMBOLS[key];
      const typeNames: Record<string, string> = { industrial_osm: "Промышленная площадка", railway_osm: "Железнодорожный участок", airport_osm: "Аэродром" };
      const name = String(properties.label || properties.name || "").trim() || `${typeNames[key] ?? "Объект"} без названия`;
      const registry = key.endsWith("_osm") ? "OpenStreetMap" : symbol?.label ?? "Реестр источников";
      const type = typeNames[key] ?? "Потенциальный источник загрязнения";
      sourcePopup.setLngLat([longitude, latitude]).setHTML(
        `<div class="map-tooltip map-tooltip--source"><strong>${escapePopupText(name)}</strong><span>${escapePopupText(registry)}</span><small>${escapePopupText(type ?? "Объект инфраструктуры")}</small><small>${latitude.toFixed(4)}° с. ш. · ${longitude.toFixed(4)}° в. д.</small>${key.endsWith("_osm") ? '<small>Значок расположен на объекте внутри выбранной территории. Данные о выбросах отсутствуют.</small>' : ''}</div>`,
      ).addTo(map);
    };
    const showStationPopup = (
      properties: Record<string, unknown>,
      longitude: number,
      latitude: number,
    ) => {
      const name = String(properties.label ?? "").trim() || "Пост наблюдения";
      const operator = String(properties.station_operator ?? "").trim();
      const rawType = String(properties.station_type ?? "").trim();
      const stationType = rawType === "stationary"
        ? "Стационарный пост"
        : rawType === "route"
          ? "Маршрутный пост"
          : rawType || "Тип поста не указан";
      const address = String(properties.station_address ?? "").trim();
      const popupHtml =
        '<div class="map-tooltip map-tooltip--station">' +
        '<strong>' + escapePopupText(name) + '</strong>' +
        '<span>Ведомство: ' + escapePopupText(operator || "не указано") + '</span>' +
        '<small>' + escapePopupText(stationType) + '</small>' +
        (address ? '<small>' + escapePopupText(address) + '</small>' : '') +
        '</div>';
      popup.setLngLat([longitude, latitude]).setHTML(popupHtml).addTo(map);
    };
    const markers: maplibregl.Marker[] = [];
    let resizeFrame = 0;
    let wasVisible = false;
    const resizeObserver = new ResizeObserver(() => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        const container = containerRef.current;
        const visible = Boolean(container?.clientWidth && container?.clientHeight);
        map.resize();
        // A report/research tab may mount the map inside a hidden section.
        // Its first real dimensions must be used when the result is opened.
        if (visible && !wasVisible && viewBoundsRef.current)
          map.fitBounds(viewBoundsRef.current, { padding: 35, duration: 0 });
        wasVisible = visible;
      });
    });
    resizeObserver.observe(containerRef.current);

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-left",
    );
    map.addControl(
      new maplibregl.ScaleControl({ unit: "metric" }),
      "bottom-right",
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-left",
    );
    map.addControl(new maplibregl.FullscreenControl(), "top-right");

    map.on("load", () => {
      addNetworkMarkerIcons(map);
      // Drawn below the per-post polygons: one merged outline carries the fill,
      // so overlapping zones no longer darken and read as a higher value.
      map.addSource("coverage-union", {
        type: "geojson",
        data: EMPTY_COLLECTION,
      });
      map.addLayer({
        id: "coverage-union-fill",
        type: "fill",
        source: "coverage-union",
        paint: { "fill-color": "#0f766e", "fill-opacity": 0.16 },
      });
      map.addSource("network-context", {
        type: "geojson",
        data: EMPTY_COLLECTION,
      });
      map.addLayer({
        id: "network-recreation-fill",
        type: "fill",
        source: "network-context",
        filter: ["==", ["get", "context_kind"], "recreation"],
        paint: {
          "fill-color": "#22a06b",
          "fill-opacity": 0.14,
        },
      });
      map.addSource("population-density", {
        type: "geojson",
        data: EMPTY_COLLECTION,
      });
      map.addLayer({
        id: "population-density-fill",
        type: "fill",
        source: "population-density",
        paint: {
          "fill-color": populationColorExpression(),
          "fill-opacity": networkDesignMode ? 0.58 : 0,
        },
      });
      map.addLayer({
        id: "population-density-grid",
        type: "line",
        source: "population-density",
        paint: {
          "line-color": "rgba(255,255,255,0.82)",
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0.18, 10, 0.48, 13, 0.72],
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.25, 12, 0.75],
        },
      });
      map.addLayer({
        id: "network-recreation-outline",
        type: "line",
        source: "network-context",
        filter: ["==", ["get", "context_kind"], "recreation"],
        paint: {
          "line-color": "#16845a",
          "line-width": 1.4,
          "line-opacity": 0.8,
        },
      });
      map.addLayer({
        id: "network-road-context",
        type: "line",
        source: "network-context",
        filter: ["==", ["get", "context_kind"], "road"],
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "data_quality"], "verified"],
            "#dc2626",
            "#f59e0b",
          ],
          "line-width": [
            "case",
            ["==", ["get", "data_quality"], "verified"],
            3,
            1.5,
          ],
          "line-opacity": 0.82,
        },
      });
      map.addLayer({
        id: "network-industrial-airport-fill", type: "fill", source: "network-context",
        filter: ["in", ["get", "context_kind"], ["literal", ["industrial", "airport"]]],
        paint: { "fill-color": ["case", ["==", ["get", "context_kind"], "industrial"], "#9333ea", "#0891b2"], "fill-opacity": 0.16 },
      });
      map.addLayer({
        id: "network-industrial-airport-outline", type: "line", source: "network-context",
        filter: ["in", ["get", "context_kind"], ["literal", ["industrial", "airport"]]],
        paint: { "line-color": ["case", ["==", ["get", "context_kind"], "industrial"], "#9333ea", "#0891b2"], "line-width": 1.8 },
      });
      map.addLayer({
        id: "network-railway-context", type: "line", source: "network-context",
        filter: ["==", ["get", "context_kind"], "railway"],
        paint: { "line-color": "#475569", "line-width": 2, "line-dasharray": [3, 2] },
      });
      map.addLayer({
        id: "network-airport-points", type: "symbol", source: "network-context",
        filter: ["all", ["==", ["get", "context_kind"], "airport"], ["==", ["geometry-type"], "Point"]],
        layout: { "icon-image": "source-airport_osm", "icon-size": 1.5, "icon-allow-overlap": true },
      });
      map.addSource("analytical-cells", {
        type: "geojson",
        data: EMPTY_COLLECTION,
        promoteId: "cell_id",
      });
      map.addLayer({
        id: "cells-fill",
        type: "fill",
        source: "analytical-cells",
        paint: {
          // Coverage geometries are modelled zones, not a risk/intensity surface.
          // Keep them visually distinct from the red-yellow diagnostics palette.
          "fill-color": networkDesignMode
            ? [
                "case",
                ["==", ["get", "ensemble_role"], "alternative"],
                "#f59e0b",
                "#2f6fed",
              ]
            : fillColorExpression(minValue, maxValue),
          "fill-opacity": [
            "case",
            ["has", "station_id"],
            [
              // The union layer below supplies the tint. A per-post fill would
              // stack on it and bring back the overlap darkening, so only the
              // selected zone is filled; the rest stay clickable at zero alpha.
              "case",
              ["boolean", ["feature-state", "highlighted"], false],
              0.28,
              0,
            ],
            ["boolean", ["feature-state", "selected"], false],
            networkDesignMode ? 0.22 : 0.96,
            networkDesignMode ? 0.08 : 0.78,
          ],
        },
      });
      map.addLayer({
        id: "cells-outline",
        type: "line",
        source: "analytical-cells",
        paint: {
          "line-color": [
            "case",
            ["has", "station_id"],
            [
              "case",
              ["boolean", ["feature-state", "highlighted"], false],
              "#075985",
              "#0f766e",
            ],
            ["boolean", ["feature-state", "selected"], false],
            "#1d4ed8",
            networkDesignMode
              ? [
                  "case",
                  ["==", ["get", "ensemble_role"], "alternative"],
                  "#d97706",
                  "#2f6fed",
                ]
              : "rgba(255,255,255,0.58)",
          ],
          "line-opacity": ["case", ["has", "station_id"], 0.82, 1],
          "line-width": [
            "case",
            ["has", "station_id"],
            [
              "case",
              ["boolean", ["feature-state", "highlighted"], false],
              2.25,
              1.15,
            ],
            ["boolean", ["feature-state", "selected"], false],
            2.6,
            networkDesignMode ? 1.35 : 0.55,
          ],
          ...(networkDesignMode ? { "line-dasharray": [3, 2] } : {}),
        },
      });
      map.addSource("network-wind-presentation", {
        type: "geojson",
        data: EMPTY_COLLECTION,
      });
      map.addLayer({
        id: "network-upwind-sector-fill",
        type: "fill",
        source: "network-wind-presentation",
        filter: ["==", ["get", "kind"], "upwind_sector"],
        paint: { "fill-color": "#31b7d7", "fill-opacity": 0.14 },
      });
      map.addLayer({
        id: "network-upwind-sector-line",
        type: "line",
        source: "network-wind-presentation",
        filter: ["==", ["get", "kind"], "upwind_sector"],
        paint: { "line-color": "#1598bc", "line-opacity": 0.7, "line-width": 1.2 },
      });
      map.addLayer({
        id: "network-source-relationships",
        type: "line",
        source: "network-wind-presentation",
        filter: ["==", ["get", "kind"], "source_relationship"],
        paint: {
          "line-color": "#8b5cf6",
          "line-opacity": 0.38,
          "line-width": 1.1,
          "line-dasharray": [2, 3],
        },
      });
      map.addLayer({
        id: "network-flow-arrows-line",
        type: "line",
        source: "network-wind-presentation",
        filter: ["==", ["get", "kind"], "flow_arrow"],
        paint: { "line-color": "#118fb3", "line-opacity": 0.72, "line-width": 1.4 },
      });
      map.addLayer({
        id: "network-flow-arrows-symbol",
        type: "symbol",
        source: "network-wind-presentation",
        filter: ["==", ["get", "kind"], "flow_arrow"],
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 90,
          "text-field": "➤",
          "text-size": 12,
          "text-rotation-alignment": "map",
          "text-keep-upright": false,
        },
        paint: { "text-color": "#087d9e", "text-halo-color": "#ffffff", "text-halo-width": 1 },
      });
      map.addLayer({
        id: "candidate-zone-labels",
        type: "symbol",
        source: "analytical-cells",
        filter: ["has", "zone_code"],
        layout: {
          "text-field": ["get", "zone_code"],
          "text-size": 13,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-offset": [-1.9, -1.7],
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#173e65",
          "text-halo-color": "rgba(255,255,255,0.96)",
          "text-halo-width": 2,
        },
      });
      map.addSource("network-stations", {
        type: "geojson",
        data: EMPTY_MARKERS,
      });
      map.addLayer({
        id: "network-station-markers",
        type: "symbol",
        source: "network-stations",
        layout: {
          "icon-image": "network-station-icon",
          "icon-size": [
            "case",
            ["boolean", ["get", "selected"], false],
            1.2,
            0.9,
          ],
          "icon-allow-overlap": true,
        },
      });
      map.addLayer({
        id: "network-station-selection-ring",
        type: "circle",
        source: "network-stations",
        paint: {
          "circle-radius": [
            "case",
            ["boolean", ["get", "selected"], false],
            15,
            0,
          ],
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": "#0f766e",
          "circle-stroke-width": 2,
          "circle-stroke-opacity": [
            "case",
            ["boolean", ["get", "selected"], false],
            0.9,
            0,
          ],
        },
      });
      // Emission-source registry markers use the same factory symbol as the legend.
      map.addSource("known-sources", {
        type: "geojson",
        data: EMPTY_MARKERS,
      });
      map.addLayer({
        id: "known-source-markers",
        type: "symbol",
        source: "known-sources",
        layout: {
          "icon-image": ["match", ["get", "source_symbol"], "gem", "source-gem", "climate-trace", "source-climate-trace", "industrial_osm", "source-industrial_osm", "railway_osm", "source-railway_osm", "airport_osm", "source-airport_osm", "network-source-icon"],
          // The 24px drawing at pixelRatio 2 needs scale 1.5 to match the 18px legend.
          "icon-size": ["case", ["!=", ["coalesce", ["get", "source_symbol"], ""], ""], ["case", ["boolean", ["get", "selected"], false], 1.75, 1.5], ["case", ["boolean", ["get", "selected"], false], 1.1, 0.82]],
          "icon-allow-overlap": true,
        },
        paint: {
          "icon-opacity": ["case", ["boolean", ["get", "relevant"], true], 0.95, 0.32],
        },
      });
      map.addLayer({
        id: "known-source-labels",
        type: "symbol",
        source: "known-sources",
        filter: ["==", ["get", "selected"], true],
        layout: {
          "text-field": ["get", "label"],
          "text-size": 10,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
        },
        paint: { "text-color": "#5b21b6", "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
      });
      map.addSource("network-candidates", {
        type: "geojson",
        data: EMPTY_MARKERS,
      });
      map.addSource("network-coverage-rings", {
        type: "geojson",
        data: EMPTY_COLLECTION,
      });
      map.addLayer({
        id: "network-coverage-rings-fill",
        type: "fill",
        source: "network-coverage-rings",
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "kind"], "alternative"],
            "#f59e0b",
            "#2f6fed",
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["get", "selected"], false],
            0.055,
            0.018,
          ],
        },
      });
      map.addLayer({
        id: "network-coverage-rings-line",
        type: "line",
        source: "network-coverage-rings",
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "kind"], "alternative"],
            "#e88906",
            "#2878e8",
          ],
          "line-opacity": [
            "case",
            ["boolean", ["get", "selected"], false],
            0.9,
            0.58,
          ],
          "line-width": [
            "case",
            ["boolean", ["get", "selected"], false],
            2.1,
            1.35,
          ],
          "line-dasharray": [3, 2],
        },
      });
      map.addLayer({
        id: "network-candidate-markers",
        type: "circle",
        source: "network-candidates",
        paint: {
          "circle-radius": 13,
          "circle-color": "#1d4ed8",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2.5,
        },
      });
      map.addLayer({
        id: "network-candidate-selection-ring",
        type: "circle",
        source: "network-candidates",
        paint: {
          "circle-radius": ["case", ["boolean", ["get", "selected"], false], 20, 0],
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": "#2f6fed",
          "circle-stroke-width": 2,
          "circle-stroke-opacity": ["case", ["boolean", ["get", "selected"], false], 0.55, 0],
        },
      });
      map.addLayer({
        id: "network-candidate-labels",
        type: "symbol",
        source: "network-candidates",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#ffffff" },
      });
      map.addSource("network-alternatives", {
        type: "geojson",
        data: EMPTY_MARKERS,
      });
      map.addLayer({
        id: "network-alternative-markers",
        type: "circle",
        source: "network-alternatives",
        paint: {
          "circle-radius": 11,
          "circle-color": "#f59e0b",
          "circle-opacity": 0.88,
          "circle-stroke-color": "#7c2d12",
          "circle-stroke-width": 2.5,
        },
      });
      map.addLayer({
        id: "network-alternative-selection-ring",
        type: "circle",
        source: "network-alternatives",
        paint: {
          "circle-radius": ["case", ["boolean", ["get", "selected"], false], 18, 0],
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": "#f59e0b",
          "circle-stroke-width": 2,
          "circle-stroke-opacity": ["case", ["boolean", ["get", "selected"], false], 0.6, 0],
        },
      });
      map.addLayer({
        id: "network-alternative-labels",
        type: "symbol",
        source: "network-alternatives",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 10,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#ffffff" },
      });
      map.addSource("selected-boundary", {
        type: "geojson",
        data: EMPTY_COLLECTION,
      });
      map.addSource("municipality-boundaries", {
        type: "geojson",
        data: EMPTY_COLLECTION,
      });
      map.addSource("region-boundaries", { type: "geojson", data: EMPTY_COLLECTION });
      map.addLayer({
        id: "region-boundaries-line",
        type: "line",
        source: "region-boundaries",
        paint: { "line-color": "#475569", "line-opacity": 0.85, "line-width": 1.8, "line-dasharray": [5, 2] },
      });
      map.addLayer({
        id: "region-boundaries-label",
        type: "symbol",
        source: "region-boundaries",
        minzoom: 5,
        layout: { "text-field": ["get", "name"], "text-size": 12, "text-max-width": 12 },
        paint: { "text-color": "#334155", "text-halo-color": "#ffffff", "text-halo-width": 2 },
      });
      map.addSource("settlement-boundaries", {
        type: "geojson",
        data: EMPTY_COLLECTION,
      });
      map.addLayer({
        id: "settlement-boundaries-line",
        type: "line",
        source: "settlement-boundaries",
        paint: {
          "line-color": "#64748b",
          "line-opacity": 0.42,
          "line-width": 0.65,
          "line-dasharray": [2, 2],
        },
      });
      map.addLayer({
        id: "municipality-boundaries-line",
        type: "line",
        source: "municipality-boundaries",
        paint: {
          "line-color": "#4b647d",
          "line-opacity": 0.5,
          "line-width": 0.85,
          "line-dasharray": [3, 2],
        },
      });
      map.addLayer({
        id: "selected-boundary-fill",
        type: "fill",
        source: "selected-boundary",
        paint: { "fill-color": "#2563eb", "fill-opacity": 0.025 },
      });
      map.addLayer({
        id: "selected-boundary-line",
        type: "line",
        source: "selected-boundary",
        paint: {
          "line-color": "#315a89",
          "line-opacity": 0.74,
          "line-width": 1.35,
        },
      });

      // The shared map is now used for national layers; local demo labels must not be rendered.
      for (const [name, lon, lat] of [] as unknown as typeof CITY_LABELS) {
        const element = document.createElement("div");
        element.className = "city-label";
        element.textContent = name;
        markers.push(
          new maplibregl.Marker({ element, anchor: "center" })
            .setLngLat([lon, lat])
            .addTo(map),
        );
      }

      map.on("mouseenter", "cells-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "cells-fill", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
      map.on("mousemove", "cells-fill", (event) => {
        const properties = event.features?.[0]?.properties;
        if (!properties) return;
        if (properties.station_id) {
          const population = Number(properties.station_population);
          const populationText = Number.isFinite(population)
            ? `${population.toLocaleString("ru-RU")} чел.`
            : "расчёт населения выполняется";
          const zoneShape = properties.radius_km
            ? `радиус ${properties.radius_km} км`
            : properties.major_axis_km
              ? properties.shape_model === "wind-rose-polar-v2"
                ? `ветровой контур ${properties.major_axis_km} км (макс.)`
                : `эллипс ${properties.major_axis_km} × ${properties.minor_axis_km} км`
              : "расчётная область";
          popup
            .setLngLat(event.lngLat)
            .setHTML(
              `<div class="map-tooltip map-tooltip--station"><strong>${properties.station_name ?? "Пост наблюдения"}</strong><span>${properties.station_type ?? "действующий пост"} · ${zoneShape}</span>${properties.station_operator ? `<span>${properties.station_operator}</span>` : ""}<b>${populationText}</b><small>Нажмите, чтобы открыть карточку поста</small></div>`,
            )
            .addTo(map);
          return;
        }
        const detail = candidatePopupDetailsRef.current?.[String(properties.cell_id)];
        const popupHtml = detail
          ? `<div class="map-tooltip"><strong>${escapePopupText(detail.title)}</strong><span>${escapePopupText(detail.kind)} · ${escapePopupText(detail.role)}</span><b>${escapePopupText(detail.population)}</b><small>${escapePopupText(detail.reasons)}</small><small>${escapePopupText(detail.stability)}${detail.recreationNote ? ` · ${escapePopupText(detail.recreationNote)}` : ""}</small></div>`
          : `<div class="map-tooltip"><strong>Кандидатная зона ${escapePopupText(String(properties.zone_code ?? ""))}</strong><span>Аналитическая область, внутри которой выбрана расчётная точка</span><small>Нажмите на синий номер, чтобы открыть объяснение выбора</small></div>`;
        popup.setLngLat(event.lngLat).setHTML(popupHtml).addTo(map);
      });
      map.on("click", "cells-fill", (event) => {
        // Candidate labels sit over analytical polygons. Resolve markers first,
        // otherwise a click on a numbered point is handled as a polygon click
        // and leaves the previously selected wind context on the map.
        const markerFeatures = map.queryRenderedFeatures(event.point, {
          layers: [
            "network-station-markers",
            "network-alternative-labels",
            "network-alternative-markers",
            "network-candidate-labels",
            "network-candidate-markers",
          ],
        });
        const stationFeature = markerFeatures.find(
          (item) => item.layer.id === "network-station-markers" && item.properties?.id,
        );
        if (stationFeature?.properties) {
          const stationId = String(stationFeature.properties.id);
          showStationPopup(
            stationFeature.properties,
            event.lngLat.lng,
            event.lngLat.lat,
          );
          onMarkerSelectRef.current?.(stationId);
          return;
        }
        const markerFeature = markerFeatures.find(
          (item) => item.layer.id !== "network-station-markers" && item.properties?.id,
        );
        const markerId = markerFeature?.properties?.id;
        if (markerId) {
          onMarkerSelectRef.current?.(String(markerId));
          return;
        }
        const feature = event.features?.[0];
        if (!feature?.properties || feature.geometry.type !== "Polygon") return;
        onSelectRef.current({
          type: "Feature",
          id: String(feature.properties.cell_id),
          geometry: feature.geometry as CellFeature["geometry"],
          properties: feature.properties as CellFeature["properties"],
        });
      });
      map.on("click", "network-station-markers", (event) => {
        const feature = event.features?.find((item) => item.properties?.id);
        if (!feature?.properties) return;
        showStationPopup(feature.properties, event.lngLat.lng, event.lngLat.lat);
        onMarkerSelectRef.current?.(String(feature.properties.id));
      });
      map.on("mouseenter", "network-station-markers", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "network-station-markers", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("click", "network-candidate-markers", (event) => {
        const markerId = event.features?.[0]?.properties?.id;
        if (markerId) onMarkerSelectRef.current?.(String(markerId));
      });
      map.on("click", "network-candidate-labels", (event) => {
        const markerId = event.features?.[0]?.properties?.id;
        if (markerId) onMarkerSelectRef.current?.(String(markerId));
      });
      map.on("click", "network-alternative-markers", (event) => {
        const markerId = event.features?.[0]?.properties?.id;
        if (markerId) onMarkerSelectRef.current?.(String(markerId));
      });
      map.on("click", "network-alternative-labels", (event) => {
        const markerId = event.features?.[0]?.properties?.id;
        if (markerId) onMarkerSelectRef.current?.(String(markerId));
      });
      map.on("click", "known-source-markers", (event) => {
        const feature = event.features?.[0];
        const markerId = feature?.properties?.id;
        if (markerId) onMarkerSelectRef.current?.(String(markerId));
        if (feature?.geometry.type === "Point") {
          const [longitude, latitude] = feature.geometry.coordinates;
          showSourcePopup(feature.properties, longitude, latitude);
        }
      });
      map.on("click", "network-airport-points", (event) => {
        const feature = event.features?.[0];
        if (feature?.geometry.type === "Point") {
          const [longitude, latitude] = feature.geometry.coordinates;
          showSourcePopup(feature.properties, longitude, latitude);
        }
      });
      for (const layer of ["known-source-markers", "network-airport-points"]) {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
      }
      // The territory is often known before the style finishes loading, because
      // this panel is a lazily loaded chunk. Refitting to the national extent
      // here would discard it and leave the user looking at all of Russia.
      map.fitBounds(viewBoundsRef.current ?? NATIONAL_BOUNDS, {
        padding: 35,
        duration: 0,
      });
    });
    mapRef.current = map;
    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(resizeFrame);
      popup.remove();
      sourcePopup.remove();
      markers.forEach((marker) => marker.remove());
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      (map.getSource("population-density") as GeoJSONSource | undefined)?.setData(
        (populationLayer ?? EMPTY_COLLECTION) as unknown as GeoJSON.FeatureCollection,
      );
      if (map.getLayer("population-density-fill")) {
        map.setPaintProperty(
          "population-density-fill",
          "fill-color",
          populationColorExpression(),
        );
      }
    };
    if (map.getSource("population-density")) update();
    else map.once("load", update);
  }, [populationLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      const combined: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: [
          ...(presentationLayers?.upwindSector?.features ?? []),
          ...(presentationLayers?.flowArrows?.features ?? []),
          ...(presentationLayers?.sourceRelationships?.features ?? []),
        ],
      };
      (map.getSource("network-wind-presentation") as GeoJSONSource | undefined)?.setData(combined);
      map.triggerRepaint();
    };
    // A visible map can still report an unfinished style while its sources are
    // already available. Waiting for another `load` event in that state leaves
    // the wind layer on the first selected point.
    if (map.getSource("network-wind-presentation")) update();
    else map.once("load", update);
  }, [presentationLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      const source = map.getSource("analytical-cells") as
        GeoJSONSource | undefined;
      source?.setData(
        (data ?? EMPTY_COLLECTION) as unknown as GeoJSON.FeatureCollection,
      );
      if (map.getLayer("cells-fill"))
        map.setPaintProperty(
          "cells-fill",
          "fill-color",
          fillColorExpression(minValue, maxValue),
        );
      const boundaries =
        boundaryLayers ??
        (
          data as unknown as {
            boundaryLayers?: MapPanelProps["boundaryLayers"];
          } | null
        )?.boundaryLayers;
      (
        map.getSource("selected-boundary") as GeoJSONSource | undefined
      )?.setData(
        (boundaries?.selected ??
          EMPTY_COLLECTION) as unknown as GeoJSON.FeatureCollection,
      );
      (
        map.getSource("municipality-boundaries") as GeoJSONSource | undefined
      )?.setData(
        (boundaries?.municipalities ??
          EMPTY_COLLECTION) as unknown as GeoJSON.FeatureCollection,
      );
      (
        map.getSource("settlement-boundaries") as GeoJSONSource | undefined
      )?.setData(
        (boundaries?.settlements ??
          EMPTY_COLLECTION) as unknown as GeoJSON.FeatureCollection,
      );
    };
    if (map.getSource("analytical-cells")) update();
    else map.once("load", update);
  }, [data, minValue, maxValue, boundaryLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () =>
      (map.getSource("network-context") as GeoJSONSource | undefined)?.setData(
        (contextLayers ?? EMPTY_COLLECTION) as GeoJSON.FeatureCollection,
      );
    if (map.getSource("network-context")) update();
    else map.once("load", update);
  }, [contextLayers]);

  const boundsWest = viewBounds?.[0][0];
  const boundsSouth = viewBounds?.[0][1];
  const boundsEast = viewBounds?.[1][0];
  const boundsNorth = viewBounds?.[1][1];
  useEffect(() => {
    const map = mapRef.current;
    if (map && boundsWest != null && boundsSouth != null && boundsEast != null && boundsNorth != null)
      map.fitBounds([[boundsWest, boundsSouth], [boundsEast, boundsNorth]], { padding: 35, duration: 0 });
  }, [boundsWest, boundsSouth, boundsEast, boundsNorth]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () =>
      (map.getSource("coverage-union") as GeoJSONSource | undefined)?.setData(
        (unionLayer ??
          EMPTY_COLLECTION) as unknown as GeoJSON.FeatureCollection,
      );
    if (map.getSource("coverage-union")) update();
    else map.once("load", update);
  }, [unionLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      const stations = map.getSource("network-stations") as
        GeoJSONSource | undefined;
      const candidates = map.getSource("network-candidates") as
        GeoJSONSource | undefined;
      const alternatives = map.getSource("network-alternatives") as
        GeoJSONSource | undefined;
      const sources = map.getSource("known-sources") as
        GeoJSONSource | undefined;
      const collection = (kind: "station" | "candidate" | "alternative" | "source") =>
        ({
          type: "FeatureCollection",
          features: markers
            .filter((marker) => (marker.kind ?? "candidate") === kind)
            .map((marker) => ({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [marker.longitude, marker.latitude],
              },
              properties: {
                id: marker.id,
                source_symbol: marker.source_symbol ?? "",
                label: marker.label,
                station_type: marker.station_type,
                station_operator: marker.station_operator,
                station_address: marker.station_address,
                selected: marker.id === (selectedMarkerId ?? highlightedStationId),
                relevant: marker.relevant ?? true,
              },
            })),
        }) as GeoJSON.FeatureCollection;
      stations?.setData(collection("station"));
      candidates?.setData(collection("candidate"));
      alternatives?.setData(collection("alternative"));
      sources?.setData(collection("source"));
      map.triggerRepaint();
    };
    if (map.getSource("network-stations")) update();
    else map.once("load", update);
  }, [markers, highlightedStationId, selectedMarkerId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () =>
      (map.getSource("network-coverage-rings") as GeoJSONSource | undefined)?.setData(
        coverageRingCollection(markers, coverageRadiusM ?? 0, selectedCellId),
      );
    if (map.getSource("network-coverage-rings")) update();
    else map.once("load", update);
  }, [coverageRadiusM, markers, selectedCellId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const visibilityGroups: Record<string, string[]> = {
      population: ["population-density-fill", "population-density-grid"],
      boundaries: ["region-boundaries-line", "region-boundaries-label", "selected-boundary-fill", "selected-boundary-line", "municipality-boundaries-line", "settlement-boundaries-line"],
      zones: ["cells-fill", "cells-outline", "candidate-zone-labels", "network-candidate-markers", "network-candidate-selection-ring", "network-candidate-labels", "network-alternative-markers", "network-alternative-selection-ring", "network-alternative-labels"],
      coverageRings: ["network-coverage-rings-fill", "network-coverage-rings-line"],
      stations: ["network-station-markers", "network-station-selection-ring"],
      sources: ["known-source-markers", "known-source-labels", "network-industrial-airport-fill", "network-industrial-airport-outline"],
      roads: ["network-road-context", "network-railway-context", "network-airport-points"],
      recreation: ["network-recreation-fill", "network-recreation-outline"],
      windSector: ["network-upwind-sector-fill", "network-upwind-sector-line"],
      flowArrows: ["network-flow-arrows-line", "network-flow-arrows-symbol"],
      relationships: ["network-source-relationships"],
    };
    const update = () => {
      for (const [group, layerIds] of Object.entries(visibilityGroups)) {
        const visible = layerVisibility?.[group as keyof typeof layerVisibility] ?? true;
        for (const layerId of layerIds) {
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
          }
        }
      }
    };
    if (map.getLayer("region-boundaries-line")) update();
    else map.once("load", update);
    return () => { map.off("load", update); };
  }, [layerVisibility]);

  const focusedMarker = markers.find((item) => item.id === focusedMarkerId);
  const focusedLongitude = focusedMarker?.longitude;
  const focusedLatitude = focusedMarker?.latitude;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusedMarkerId || focusedLongitude == null || focusedLatitude == null) return;
    map.easeTo({
      center: [focusedLongitude, focusedLatitude],
      duration: 550,
    });
  }, [focusedMarkerId, focusedLongitude, focusedLatitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layers =
      boundaryLayers ??
      (
        data as unknown as {
          boundaryLayers?: MapPanelProps["boundaryLayers"];
        } | null
      )?.boundaryLayers;
    const update = () => {
      (map.getSource("region-boundaries") as GeoJSONSource | undefined)?.setData(layers?.regions ?? EMPTY_COLLECTION);
      (
        map.getSource("selected-boundary") as GeoJSONSource | undefined
      )?.setData(
        (layers?.selected ??
          EMPTY_COLLECTION) as unknown as GeoJSON.FeatureCollection,
      );
      (
        map.getSource("municipality-boundaries") as GeoJSONSource | undefined
      )?.setData(
        (layers?.municipalities ??
          EMPTY_COLLECTION) as unknown as GeoJSON.FeatureCollection,
      );
      (
        map.getSource("settlement-boundaries") as GeoJSONSource | undefined
      )?.setData(
        (layers?.settlements ??
          EMPTY_COLLECTION) as unknown as GeoJSON.FeatureCollection,
      );
    };
    // Tile/source requests can make isStyleLoaded false after the one-shot load.
    // Existing sources are ready for updates even while those requests run.
    if (map.getSource("region-boundaries")) update();
    else map.once("load", update);
    return () => { map.off("load", update); };
  }, [boundaryLayers, data]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource("analytical-cells")) return;
    for (const feature of data?.features ?? []) {
      map.setFeatureState(
        { source: "analytical-cells", id: feature.properties.cell_id },
        { selected: feature.properties.cell_id === selectedCellId },
      );
    }
  }, [data, selectedCellId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource("analytical-cells")) return;
    for (const feature of data?.features ?? []) {
      const stationId = feature.properties.station_id;
      if (!stationId) continue;
      map.setFeatureState(
        { source: "analytical-cells", id: feature.properties.cell_id },
        { highlighted: stationId === highlightedStationId },
      );
    }
  }, [data, highlightedStationId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onCandidateMove) return;
    let handles: maplibregl.Marker[] = [];
    let disposed = false;
    const install = () => {
      if (disposed) return;
      handles = markers.filter(item => item.kind === "candidate").map(item => {
        const element = document.createElement("button");
        element.type = "button";
        element.className = `planning-drag-handle${invalidCandidateIds.includes(item.id) ? " is-invalid" : ""}`;
        element.textContent = item.label ?? item.id;
        element.title = `Перетащить точку ${item.label ?? item.id}`;
        element.setAttribute("aria-label", element.title);
        element.addEventListener("click", event => event.stopPropagation());
        const handle = new maplibregl.Marker({ element, anchor: "center", draggable: true }).setLngLat([item.longitude, item.latitude]).addTo(map);
        handle.on("dragend", () => { const point = handle.getLngLat(); onCandidateMove(item.id, point.lng, point.lat); });
        return handle;
      });
    };
    // DOM markers can be installed immediately. `loaded()` may turn false
    // while tiles are fetching, after the one-shot `load` event has fired.
    install();
    return () => { disposed = true; map.off("load", install); handles.forEach(handle => handle.remove()); };
  }, [markers, onCandidateMove, invalidCandidateIds]);
  useEffect(() => {
    const map=mapRef.current; if (!map) return;
    const update=() => {
      if (!map.getSource("planning-evidence")) {
        map.addSource("planning-evidence",{type:"geojson",data:EMPTY_COLLECTION});
        const before=map.getStyle().layers?.find(layer => layer.type === "symbol")?.id;
        map.addLayer({id:"planning-residential",type:"fill",source:"planning-evidence",filter:["==",["get","kind"],"residential"],paint:{"fill-color":"#16a66c","fill-opacity":.2}},before);
        map.addLayer({id:"planning-exclusion",type:"fill",source:"planning-evidence",filter:["==",["get","kind"],"exclusion"],paint:{"fill-color":"#da4b4b","fill-opacity":.3}},before);
        map.addLayer({id:"planning-contour-fill",type:"fill",source:"planning-evidence",filter:["all",["==",["get","kind"],"movement_contour"],["==",["geometry-type"],"Polygon"]],paint:{"fill-color":["case",[">=",["coalesce",["get","support_fraction"],0],1],"#16a66c","#e39747"],"fill-opacity":.2}},before);
        map.addLayer({id:"planning-contour-line",type:"line",source:"planning-evidence",filter:["all",["==",["get","kind"],"movement_contour"],["!=",["geometry-type"],"Point"]],paint:{"line-color":"#168668","line-width":2}},before);
        map.addLayer({id:"planning-movement",type:"line",source:"planning-evidence",filter:["==",["get","kind"],"movement"],paint:{"line-color":"#8a5bc7","line-width":2,"line-dasharray":[3,2]}},before);
        map.addLayer({id:"planning-reference",type:"circle",source:"planning-evidence",filter:["==",["get","kind"],"reference"],paint:{"circle-radius":10,"circle-color":["interpolate",["linear"],["coalesce",["get","support_fraction"],0],0,"#e39747",1,"#28a876"],"circle-opacity":.5,"circle-stroke-color":"#fff","circle-stroke-width":2}},before);
      }
      (map.getSource("planning-evidence") as GeoJSONSource).setData(planningOverlay ?? EMPTY_COLLECTION);
    };
    if (map.getSource("analytical-cells")) update(); else map.once("load",update);
    return () => { map.off("load",update); };
  },[planningOverlay]);
  return (
    <div
      ref={containerRef}
      className="map-canvas"
      aria-label="Карта пространственных индикаторов"
    >
      {mapControls}
      {mapLegend}
    </div>
  );
}
