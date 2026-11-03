import type { WindRoseResult } from "../windTypes";

const COLORS: Record<string, string> = {
  calm: "#94a3b8",
  low: "#38bdf8",
  moderate: "#2f6fed",
  fresh: "#22c55e",
  strong: "#f59e0b",
  very_strong: "#ef4444",
};

const SPEED_LABELS: Record<string, string> = {
  calm: "штиль / calm",
  low: "0.5-1",
  moderate: "1-3",
  fresh: "3-5",
  strong: "5-8",
  very_strong: "> 8",
};
const BIN_COLORS = ["#38bdf8", "#2f6fed", "#22c55e", "#f59e0b", "#ef4444"];

const RU_TO_EN: Record<string, string> = {
  С: "N",
  ССВ: "NNE",
  СВ: "NE",
  ВСВ: "ENE",
  В: "E",
  ВЮВ: "ESE",
  ЮВ: "SE",
  ЮЮВ: "SSE",
  Ю: "S",
  ЮЮЗ: "SSW",
  ЮЗ: "SW",
  ЗЮЗ: "WSW",
  З: "W",
  ЗСЗ: "WNW",
  СЗ: "NW",
  ССЗ: "NNW",
};

interface WindRoseChartProps {
  data: Pick<WindRoseResult, "directions">;
  prevailingDirection?: string | null;
  compact?: boolean;
  minimalLabels?: boolean;
  inspector?: boolean;
}

function directionLabel(label: string) {
  const english = RU_TO_EN[label];
  return english ? `${label}/${english}` : label;
}

function polarPoint(center: number, radius: number, degrees: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return {
    x: center + Math.cos(radians) * radius,
    y: center + Math.sin(radians) * radius,
  };
}

function sectorPath(
  center: number,
  innerRadius: number,
  outerRadius: number,
  startDegrees: number,
  endDegrees: number,
) {
  if (outerRadius <= innerRadius) return "";
  const outerStart = polarPoint(center, outerRadius, startDegrees);
  const outerEnd = polarPoint(center, outerRadius, endDegrees);
  if (innerRadius < 0.5) {
    return `M ${center} ${center} L ${outerStart.x} ${outerStart.y} A ${outerRadius} ${outerRadius} 0 0 1 ${outerEnd.x} ${outerEnd.y} Z`;
  }
  const innerStart = polarPoint(center, innerRadius, startDegrees);
  const innerEnd = polarPoint(center, innerRadius, endDegrees);
  return `M ${innerStart.x} ${innerStart.y} A ${innerRadius} ${innerRadius} 0 0 1 ${innerEnd.x} ${innerEnd.y} L ${outerEnd.x} ${outerEnd.y} A ${outerRadius} ${outerRadius} 0 0 0 ${outerStart.x} ${outerStart.y} Z`;
}

export function WindRoseChart({
  data,
  prevailingDirection,
  compact = false,
  minimalLabels = false,
  inspector = false,
}: WindRoseChartProps) {
  const size = 800;
  const center = size / 2;
  const chartDirections = inspector && data.directions.length === 16
    ? data.directions.filter((_, index) => index % 2 === 0).map((direction, index) => {
      const adjacent = data.directions[index * 2 + 1];
      return {
        ...direction,
        total_frequency: direction.total_frequency + (adjacent?.total_frequency ?? 0),
        bins: direction.bins.map((bin, binIndex) => ({
          ...bin,
          count: bin.count + (adjacent?.bins[binIndex]?.count ?? 0),
          frequency: bin.frequency + (adjacent?.bins[binIndex]?.frequency ?? 0),
        })),
      };
    })
    : data.directions;
  const isDetailedRose = chartDirections.length === 36;
  const maxRadius = isDetailedRose ? 315 : compact ? 315 : 270;
  const directedMax = Math.max(
    1,
    ...chartDirections.map((item) => item.total_frequency),
  );
  const maxFrequency = Math.ceil(directedMax / 3) * 3;
  const labelStride = inspector
    ? 1
    : minimalLabels
    ? Math.max(1, Math.round(chartDirections.length / 4))
    : isDetailedRose
      ? 3
      : 1;
  const sectorWidth = 360 / chartDirections.length;
  const sectorHalfWidth = sectorWidth * (isDetailedRose ? 0.48 : 0.42);
  const sectorStrokeWidth = isDetailedRose ? 0.35 : 1;
  const directionLabelRadius = maxRadius + (compact ? 34 : 44);
  const directionLabelSize = inspector
    ? 27
    : minimalLabels
    ? compact
      ? 22
      : 18
    : chartDirections.length === 16
      ? compact
        ? 12
        : 13
      : 14;
  const rings = inspector ? [0.33, 0.66, 1] : [0.25, 0.5, 0.75, 1];
  const legendBins = [...(chartDirections[0]?.bins ?? [])].sort(
    (left, right) => left.min_speed - right.min_speed,
  );

  return (
    <div className="wrn-chart-wrap">
      <svg
        className="wrn-svg-chart"
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Роза ветров ERA5"
      >
        {rings.map((fraction) => (
          <g key={fraction}>
            <circle
              cx={center}
              cy={center}
              r={maxRadius * fraction}
              fill="none"
              stroke="#dbe3ef"
              strokeWidth="1.2"
            />
            <text
              x={center - 8}
              y={center - maxRadius * fraction + 13}
              fill="#8ea0b6"
              fontSize={inspector ? "23" : minimalLabels && compact ? "17" : "12"}
              textAnchor="end"
            >
              {(maxFrequency * fraction).toFixed(1)}%
            </text>
          </g>
        ))}

        {chartDirections.map((direction) => {
          const radians = ((direction.degrees - 90) * Math.PI) / 180;
          return (
            <line
              key={`axis-${direction.index}`}
              x1={center}
              y1={center}
              x2={center + Math.cos(radians) * (maxRadius + 18)}
              y2={center + Math.sin(radians) * (maxRadius + 18)}
              stroke="#e8eef5"
              strokeWidth="1"
            />
          );
        })}

        {chartDirections.map((direction) => {
          let offset = 0;
          const bins = [...direction.bins].sort(
            (left, right) => left.min_speed - right.min_speed,
          );
          const startDegrees = direction.degrees - sectorHalfWidth;
          const endDegrees = direction.degrees + sectorHalfWidth;
          return (
            <g key={direction.index}>
              {bins.map((bin, binIndex) => {
                const innerRadius = (offset / maxFrequency) * maxRadius;
                offset += bin.frequency;
                const outerRadius = (offset / maxFrequency) * maxRadius;
                return (
                  <path
                    key={bin.key}
                    d={sectorPath(
                      center,
                      innerRadius,
                      outerRadius,
                      startDegrees,
                      endDegrees,
                    )}
                    fill={
                      COLORS[bin.key] ??
                      BIN_COLORS[binIndex % BIN_COLORS.length]
                    }
                    stroke="rgba(255,255,255,.92)"
                    strokeWidth={sectorStrokeWidth}
                  >
                    <title>
                      {directionLabel(direction.label)}: {bin.label} м/с,{" "}
                      {bin.frequency.toFixed(2)}%, n={bin.count}
                    </title>
                  </path>
                );
              })}
            </g>
          );
        })}

        {chartDirections
          .filter((direction) => direction.label === prevailingDirection)
          .map((direction) => {
            const outerRadius =
              (direction.total_frequency / maxFrequency) * maxRadius;
            return (
              <path
                key={`prevailing-${direction.index}`}
                className="wrn-prevailing-sector"
                d={sectorPath(
                  center,
                  0,
                  outerRadius,
                  direction.degrees - sectorHalfWidth,
                  direction.degrees + sectorHalfWidth,
                )}
                fill="none"
                stroke="#087f72"
                strokeWidth="5"
                strokeLinejoin="round"
                pointerEvents="none"
              />
            );
          })}

        {inspector && (
          <g className="wrn-inspector-core" pointerEvents="none">
            <circle cx={center} cy={center} r="56" fill="#ffffff" stroke="#b9d3f4" strokeWidth="4" />
            <text x={center} y={center - 10} textAnchor="middle" fill="#6c839e" fontSize="18" fontWeight="800">ВЕТЕР</text>
            <text x={center} y={center + 27} textAnchor="middle" fill="#1265c5" fontSize="42" fontWeight="900">{prevailingDirection ?? "—"}</text>
          </g>
        )}

        {chartDirections
          .filter((direction) => direction.index % labelStride === 0)
          .map((direction) => {
            const radians = ((direction.degrees - 90) * Math.PI) / 180;
            return (
              <text
                key={`label-${direction.index}`}
                x={center + Math.cos(radians) * directionLabelRadius}
                y={center + Math.sin(radians) * directionLabelRadius + 4}
                textAnchor="middle"
                fill="#526179"
                fontSize={directionLabelSize}
                fontWeight="900"
                stroke="#ffffff"
                strokeWidth="3"
                paintOrder="stroke"
              >
                {inspector ? direction.label : directionLabel(direction.label)}
              </text>
            );
          })}
      </svg>
      <div className="wrn-chart-legend">
        {inspector && <strong>Скорость ветра, м/с</strong>}
        {!inspector && (
          <span>
            <i style={{ background: COLORS.calm }} />
            {SPEED_LABELS.calm}
          </span>
        )}
        {legendBins.map((bin, index) => (
          <span key={bin.key}>
            <i
              style={{
                background:
                  COLORS[bin.key] ?? BIN_COLORS[index % BIN_COLORS.length],
              }}
            />
            {inspector ? (bin.label || `${bin.min_speed}–${bin.max_speed}`) : (SPEED_LABELS[bin.key] ?? `${bin.label} м/с`)}
          </span>
        ))}
      </div>
    </div>
  );
}
