import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import {
  AriaComponent,
  PolarComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { ECharts, EChartsCoreOption } from "echarts/core";

import type { WindRoseData } from "../types";

echarts.use([
  AriaComponent,
  BarChart,
  CanvasRenderer,
  PolarComponent,
  TooltipComponent,
]);

type WindSector = WindRoseData["directions"][number];
type WindSpeedBin = WindSector["bins"][number];

interface CompactWindRoseProps {
  data: Pick<WindRoseData, "directions"> | null | undefined;
  prevailingDirection?: string | null;
  prevailingDegrees?: number | null;
  prevailingFrequency?: number | null;
  averageSpeed?: number | null;
  calmPercent?: number | null;
  observationCount?: number | null;
  showMetrics?: boolean;
  displayMode?: "percent" | "count";
  showScaleLabels?: boolean;
  showLegendNote?: boolean;
  className?: string;
  title?: string;
  percentScaleMaximum?: number;
  leadingDirections?: { label: string; total_frequency: number }[];
  onDirectionHover?: (direction: { label: string; degrees: number }) => void;
  onDirectionLeave?: () => void;
}

const CARDINAL_LABELS = new Set(["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"]);
const COMPASS_16 = [
  "С",
  "ССВ",
  "СВ",
  "ВСВ",
  "В",
  "ВЮВ",
  "ЮВ",
  "ЮЮВ",
  "Ю",
  "ЮЮЗ",
  "ЮЗ",
  "ЗЮЗ",
  "З",
  "ЗСЗ",
  "СЗ",
  "ССЗ",
];
const SPEED_COLORS = ["#2f6fed", "#35a6df", "#20a972", "#e9a320", "#e45745"];

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function formatDegrees(value: number) {
  const normalized = normalizeDegrees(value);
  return `${Number.isInteger(normalized) ? normalized : normalized.toFixed(1)}°`;
}

function directionForDegrees(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return COMPASS_16[
    Math.round(normalizeDegrees(value) / 22.5) % COMPASS_16.length
  ];
}

function displayAxisLabel(sector: WindSector, sectorCount: number) {
  if (sectorCount === 16)
    return CARDINAL_LABELS.has(sector.label) ? sector.label : "";
  return Number.isInteger(sector.degrees / 90)
    ? (directionForDegrees(sector.degrees) ?? "")
    : "";
}

function speedColor(index: number, bin: WindSpeedBin) {
  void bin;
  return SPEED_COLORS[index] ?? SPEED_COLORS[SPEED_COLORS.length - 1];
}

function isPrevailing(
  sector: WindSector,
  prevailingDirection?: string | null,
  prevailingDegrees?: number | null,
) {
  if (prevailingDirection && sector.label === prevailingDirection) return true;
  if (prevailingDegrees == null) return false;
  return (
    Math.abs(normalizeDegrees(sector.degrees - prevailingDegrees + 180) - 180) <
    0.01
  );
}

export function CompactWindRose({
  data,
  prevailingDirection,
  prevailingDegrees,
  prevailingFrequency,
  averageSpeed,
  calmPercent,
  observationCount,
  showMetrics = true,
  displayMode = "percent",
  showScaleLabels = false,
  showLegendNote = false,
  className,
  title = "Роза ветров ERA5",
  percentScaleMaximum,
  leadingDirections,
  onDirectionHover,
  onDirectionLeave,
}: CompactWindRoseProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);
  const sectorsRef = useRef<WindSector[]>([]);
  const hoverCallbackRef = useRef(onDirectionHover);
  const leaveCallbackRef = useRef(onDirectionLeave);
  const sectors = useMemo(
    () =>
      [...(data?.directions ?? [])].sort(
        (left, right) => left.index - right.index,
      ),
    [data],
  );
  const speedBins = useMemo(() => {
    const bins = new Map<string, WindSpeedBin>();
    sectors.forEach((sector) =>
      sector.bins.forEach((bin) => {
        if (!bins.has(bin.key)) bins.set(bin.key, bin);
      }),
    );
    return [...bins.values()].sort(
      (left, right) => left.min_speed - right.min_speed,
    );
  }, [sectors]);
  const computedPrevailing = useMemo(
    () =>
      sectors.reduce<WindSector | null>(
        (leading, sector) =>
          !leading || sector.total_frequency > leading.total_frequency
            ? sector
            : leading,
        null,
      ),
    [sectors],
  );
  const resolvedDirection =
    prevailingDirection ?? computedPrevailing?.label ?? null;
  const resolvedDegrees =
    prevailingDegrees ?? computedPrevailing?.degrees ?? null;
  const resolvedFrequency =
    prevailingFrequency ?? computedPrevailing?.total_frequency ?? null;
  const hasChartData = sectors.length > 0 && speedBins.length > 0;

  useEffect(() => {
    sectorsRef.current = sectors;
    hoverCallbackRef.current = onDirectionHover;
    leaveCallbackRef.current = onDirectionLeave;
  }, [onDirectionHover, onDirectionLeave, sectors]);

  const option = useMemo<EChartsCoreOption | null>(() => {
    if (!sectors.length || !speedBins.length) return null;
    const sectorWidth = 360 / sectors.length;
    const totals = sectors.map((sector) =>
      displayMode === "count"
        ? sector.bins.reduce((sum, bin) => sum + bin.count, 0)
        : sector.total_frequency,
    );
    const maximum = Math.max(1, ...totals);
    const countStep = Math.pow(10, Math.max(0, Math.floor(Math.log10(maximum)) - 1));
    const radialStep = displayMode === "count" ? Math.max(1, countStep * 2) : 5;
    const radialMaximum = Math.max(percentScaleMaximum ?? 0, Math.ceil(maximum / radialStep) * radialStep);
    const categories = sectors.map((sector) =>
      displayAxisLabel(sector, sectors.length),
    );
    return {
      animation: false,
      aria: {
        enabled: true,
        label: {
          description:
            "Роза ветров ERA5. Длина сектора показывает повторяемость ветра, цвет — класс скорости.",
        },
      },
      polar: { center: ["47%", "53%"], radius: "78%" },
      angleAxis: {
        type: "category",
        data: categories,
        // Category bands otherwise shift compass bearings by half a sector.
        boundaryGap: false,
        startAngle: 90,
        clockwise: true,
        axisLine: { lineStyle: { color: "#c9d8e8", width: 1 } },
        axisTick: { show: false },
        axisLabel: {
          color: "#254566",
          fontSize: 10,
          fontWeight: 700,
          margin: 5,
        },
        splitLine: { show: true, lineStyle: { color: "#e7eef6", width: 1 } },
      },
      radiusAxis: {
        type: "value",
        min: 0,
        max: radialMaximum,
        interval: radialStep,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          show: showScaleLabels,
          color: "#456281",
          fontSize: 10,
          formatter: (value: number) => displayMode === "percent" ? `${value}%` : value.toLocaleString("ru-RU"),
        },
        splitLine: { lineStyle: { color: "#dfe8f2", width: 1 } },
      },
      tooltip: {
        trigger: "axis",
        renderMode: "richText",
        backgroundColor: "#14243a",
        borderWidth: 0,
        padding: [8, 10],
        textStyle: { color: "#f7fbff", fontSize: 11, lineHeight: 17 },
        extraCssText: "border-radius:8px;",
        formatter: (params: unknown) => {
          const values = Array.isArray(params) ? params : [params];
          const first = values[0] as { dataIndex?: number } | undefined;
          const sector = sectors[first?.dataIndex ?? -1];
          if (!sector) return "";
          const start = formatDegrees(sector.degrees - sectorWidth / 2);
          const end = formatDegrees(sector.degrees + sectorWidth / 2);
          const lines = speedBins.map((bin, index) => {
            const current = sector.bins.find((item) => item.key === bin.key);
            const value = displayMode === "count"
              ? (current?.count ?? 0).toLocaleString("ru-RU")
              : `${(current?.frequency ?? 0).toFixed(1)}%`;
            return `{dot${index}|●} {label|${bin.label} м/с} {value|${value}}`;
          });
          const count =
            observationCount == null
              ? ""
              : `\n{muted|Наблюдений: N = ${observationCount.toLocaleString("ru-RU")}}`;
          const total = displayMode === "count"
            ? sector.bins.reduce((sum, bin) => sum + bin.count, 0).toLocaleString("ru-RU")
            : `${sector.total_frequency.toFixed(1)}%`;
          return `{title|${sector.label}} {muted|${start}–${end}}\n{label|Всего} {total|${total}}\n${lines.join("\n")}${count}`;
        },
        rich: {
          title: { color: "#ffffff", fontSize: 12, fontWeight: 700 },
          muted: { color: "#9fb4ca", fontSize: 10 },
          label: { color: "#d7e5f5", width: 86 },
          value: {
            color: "#ffffff",
            align: "right",
            width: 38,
            fontWeight: 700,
          },
          total: { color: "#6ed3ab", fontWeight: 700 },
          dot0: { color: SPEED_COLORS[0] },
          dot1: { color: SPEED_COLORS[1] },
          dot2: { color: SPEED_COLORS[2] },
          dot3: { color: SPEED_COLORS[3] },
          dot4: { color: SPEED_COLORS[4] },
        },
      },
      series: speedBins.map((bin, index) => ({
        name: bin.label,
        type: "bar",
        coordinateSystem: "polar",
        stack: "wind",
        roundCap: false,
        silent: false,
        data: sectors.map((sector) => ({
          value: displayMode === "count"
            ? sector.bins.find((item) => item.key === bin.key)?.count ?? 0
            : sector.bins.find((item) => item.key === bin.key)?.frequency ?? 0,
          itemStyle: isPrevailing(sector, resolvedDirection, resolvedDegrees)
            ? { borderColor: "#0e6f9f", borderWidth: 1.5 }
            : { borderColor: "#ffffff", borderWidth: 1 },
        })),
        barGap: "0%",
        barCategoryGap: "12%",
        itemStyle: { color: speedColor(index, bin) },
        emphasis: { focus: "series" },
      })),
    };
  }, [
    observationCount,
    displayMode,
    resolvedDegrees,
    resolvedDirection,
    sectors,
    speedBins,
    showScaleLabels,
    percentScaleMaximum,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasChartData) return;
    const chart = echarts.init(container, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(container);
    const handleOver = (event: {
      componentType?: string;
      dataIndex?: number;
    }) => {
      if (event.componentType !== "series" || event.dataIndex == null) return;
      const sector = sectorsRef.current[event.dataIndex];
      if (sector)
        hoverCallbackRef.current?.({
          label: sector.label,
          degrees: sector.degrees,
        });
    };
    const handleOut = () => leaveCallbackRef.current?.();
    chart.on("mouseover", handleOver);
    chart.on("mouseout", handleOut);
    return () => {
      resizeObserver.disconnect();
      chart.off("mouseover", handleOver);
      chart.off("mouseout", handleOut);
      chart.dispose();
      chartRef.current = null;
    };
  }, [hasChartData]);

  useEffect(() => {
    chartRef.current?.setOption(option ?? {}, {
      notMerge: true,
      lazyUpdate: true,
    });
  }, [option]);

  if (!hasChartData) {
    return (
      <div className="compact-wind-rose__state">
        Метеоданные ERA5 для выбранной зоны недоступны.
      </div>
    );
  }

  return (
    <section
      className={`compact-wind-rose compact-wind-rose--flat${className ? ` ${className}` : ""}`}
      aria-label="Роза ветров ERA5 для выбранной зоны"
    >
      <header className="compact-wind-rose__header">
        <div>
          <h4>{title}</h4>
        </div>
      </header>

      <div className="compact-wind-rose__viz-row">
        <div
          ref={containerRef}
          className="compact-wind-rose__chart"
          role="img"
          aria-label="Интерактивная роза ветров: длина сектора показывает повторяемость ветра, цвет — класс скорости"
        />

        <div
          className="compact-wind-rose__legend"
          aria-label="Легенда классов скорости ветра"
        >
          <span>Скорость ветра, м/с</span>
          <div>
            {speedBins.map((bin, index) => (
              <i key={bin.key}>
                <b style={{ backgroundColor: speedColor(index, bin) }} />
                {bin.label}
              </i>
            ))}
            <i className="is-calm"><b />Штиль: &lt;0,5 м/с</i>
          </div>
          {showLegendNote && (
            <p><span aria-hidden="true">i</span> Направление показывает, откуда приходит ветер; перенос интерпретируется в противоположную сторону.</p>
          )}
        </div>
      </div>

      {showMetrics && <div
        className="compact-wind-rose__metrics"
        aria-label="Основные показатели ветрового профиля"
      >
        <div className="is-accent">
          <span>{(leadingDirections?.length ?? 0) > 1 ? "Близкие по частоте" : "Преобладает"}</span>
          <strong>{(leadingDirections?.length ?? 0) > 1 ? leadingDirections!.map(d => d.label).join(" / ") : resolvedDirection ?? "—"}</strong>
          <em>
            {(leadingDirections?.length ?? 0) > 1 ? leadingDirections!.map(d => `${d.label}: ${d.total_frequency.toFixed(2)}%`).join(" · ") : resolvedFrequency == null
              ? "—"
              : `${resolvedFrequency.toFixed(1)}%`}
          </em>
        </div>
        <div>
          <span>Средняя скорость</span>
          <strong>
            {averageSpeed == null ? "—" : `${averageSpeed.toFixed(1)} м/с`}
          </strong>
        </div>
        <div>
          <span>Штиль</span>
          <strong>
            {calmPercent == null ? "—" : `${calmPercent.toFixed(1)}%`}
          </strong>
        </div>
      </div>}

    </section>
  );
}
