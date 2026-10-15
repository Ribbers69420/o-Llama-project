// Pure helpers for the VidEoMT charts and tiles, kept out of the components so they can be tested.

/** Tick values for the log-scale speed axis of the scatter plot: a 1-2-5 ladder that covers every speed in the paper (the fastest is 294 FPS). */
export const FPS_TICKS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

/** Clean tick values (steps of 1, 2 or 5 times a power of ten) covering [lo, hi]. */
export function niceTicks(lo: number, hi: number): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || !(hi > lo)) return [lo];
  const raw = (hi - lo) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const first = Math.floor(lo / step) * step;
  // Round to the step's own precision (0.005 needs three decimals), and stop after a dozen ticks:
  // for values so large that adding a step changes nothing, the loop would otherwise never end.
  const digits = Math.max(0, -Math.floor(Math.log10(step)));
  const ticks: number[] = [];
  for (let v = first, n = 0; v < hi + step && n < 12; v += step, n++) ticks.push(Number(v.toFixed(digits)));
  // Keep ticks up to and including the first one that reaches hi.
  return ticks.filter((_, i) => i === 0 || ticks[i - 1] < hi);
}

export interface ScatterScales {
  xTicks: number[];
  yTicks: number[];
  /** Position of a speed on the x axis, in percent of the plot width (log scale). */
  toX: (fps: number) => number;
  /** Position of a metric on the y axis, in percent of the plot height (0 is the top). */
  toY: (metric: number) => number;
}

/** Axis scales for a speed-vs-accuracy scatter plot, with room around the outermost points. */
export function scatterScales(points: { fps: number; metric: number }[]): ScatterScales {
  const fps = points.map((p) => p.fps);
  const values = points.map((p) => p.metric);

  let xLo = [...FPS_TICKS].reverse().find((t) => t <= Math.min(...fps) * 0.85) ?? FPS_TICKS[0];
  let xHi = FPS_TICKS.find((t) => t >= Math.max(...fps) * 1.15) ?? FPS_TICKS[FPS_TICKS.length - 1];
  // The ladder covers any real speed. This only guards degenerate input (NaN, or speeds beyond
  // the ladder) so the axis cannot collapse into a divide-by-zero.
  if (!(xLo < xHi)) {
    xLo = FPS_TICKS[0];
    xHi = FPS_TICKS[FPS_TICKS.length - 1];
  }
  const xTicks = FPS_TICKS.filter((t) => t >= xLo && t <= xHi);
  // A speed of zero (or less) has no place on a log axis: pin it to the left edge rather than NaN.
  const toX = (v: number) => ((Math.log10(Math.max(v, xLo)) - Math.log10(xLo)) / (Math.log10(xHi) - Math.log10(xLo))) * 100;

  const pad = Math.max((Math.max(...values) - Math.min(...values)) * 0.12, 0.5);
  const yTicks = niceTicks(Math.min(...values) - pad, Math.max(...values) + pad);
  const yLo = yTicks[0];
  const yHi = yTicks[yTicks.length - 1];
  const toY = (m: number) => 100 - ((m - yLo) / (yHi - yLo)) * 100;

  return { xTicks, yTicks, toX, toY };
}

/** Parse "#rrggbb". */
function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** WCAG relative luminance of a "#rrggbb" colour. */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two "#rrggbb" colours. */
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export const INK_LIGHT = '#ffffff';
export const INK_DARK = '#020617';

/** White or dark ink, whichever reads better on a fill, so a label inside a mark clears contrast. */
export function inkFor(fill: string): string {
  return contrastRatio(fill, INK_LIGHT) >= contrastRatio(fill, INK_DARK) ? INK_LIGHT : INK_DARK;
}

/** A signed change to one decimal: "+0.1", "−0.3" (a true minus sign), and "0.0" for no change (also for -0 and for -0.04). */
export function formatDelta(n: number): string {
  const r = Math.round(n * 10) / 10;
  if (r === 0) return '0.0';
  return (r > 0 ? '+' : '−') + Math.abs(r).toFixed(1);
}
