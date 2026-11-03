import type { HistogramBin } from "../types";

export function percentile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function histogram(values: number[], binCount = 10): HistogramBin[] {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.abs(min) || 1;
  const width = span / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    start: min + index * width,
    end: min + (index + 1) * width,
    count: 0,
  }));
  for (const value of values) {
    const index = Math.min(
      binCount - 1,
      Math.max(0, Math.floor((value - min) / width)),
    );
    bins[index].count += 1;
  }
  return bins;
}

const SUPERSCRIPT: Record<string, string> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

export function formatScientific(value: number | null, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "нет данных";
  const [mantissa, exponent] = value.toExponential(digits).split("e");
  const power = exponent
    .split("")
    .map((character) => SUPERSCRIPT[character] ?? character)
    .join("");
  return `${mantissa} × 10${power}`;
}
