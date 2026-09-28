/* Axis maths for plot blocks: scales, "nice" tick positions and labels. Pure, tested. */

export type Scale = "linear" | "log";

/** Maps a data value to 0..1 along an axis. */
export function normalise(value: number, min: number, max: number, scale: Scale): number {
  if (scale === "log") return (Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
  return (value - min) / (max - min);
}

/** Evenly spaced sample points across an axis (log-spaced on a log axis). */
export function samples(min: number, max: number, scale: Scale, count: number): number[] {
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return scale === "log" ? 10 ** (Math.log10(min) + t * (Math.log10(max) - Math.log10(min))) : min + t * (max - min);
  });
}

/** Tick positions at 1, 2 or 5 × 10^k, aiming for about `target` ticks. */
export function niceTicks(min: number, max: number, target = 6): number[] {
  const span = max - min;
  if (!(span > 0)) return [min];
  const rough = span / target;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => span / s <= target + 1)!;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return ticks;
}

/** Decade ticks (…, 0.1, 1, 10, 100, …) within [min, max] for a log axis. */
export function logTicks(min: number, max: number): number[] {
  const ticks: number[] = [];
  for (let k = Math.ceil(Math.log10(min) - 1e-9); k <= Math.floor(Math.log10(max) + 1e-9); k++) ticks.push(10 ** k);
  return ticks;
}

/** Short, readable tick labels: 0.001, 0.5, 20, 1k, 10k, 1M; very small/large as 1e-6. */
export function formatTick(v: number): string {
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 1e6 && abs < 1e9 && Number.isInteger(v / 1e6)) return `${v / 1e6}M`;
  if (abs >= 1e3 && abs < 1e6 && Number.isInteger(v / 1e3)) return `${v / 1e3}k`;
  if (abs >= 1e-3 && abs < 1e6) return String(Number(v.toPrecision(4)));
  return v.toExponential(0).replace("e+", "e");
}

/** Readout for a slider or hover value, with sensible precision. */
export function formatValue(v: number, step?: number): string {
  if (!Number.isFinite(v)) return "–";
  if (step && step < 1) return v.toFixed(Math.min(4, Math.max(0, Math.ceil(-Math.log10(step)))));
  return formatTick(Number(v.toPrecision(4)));
}
