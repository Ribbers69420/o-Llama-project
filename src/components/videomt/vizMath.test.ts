import { describe, expect, it } from 'vitest';
import { BENCHMARK_RESULTS, DATASET_LABELS, DEMO_FRAMES } from './data';
import { contrastRatio, FPS_TICKS, formatDelta, inkFor, luminance, niceTicks, scatterScales } from './vizMath';
import { VIZ } from '../vizTokens';
import type { DatasetKey } from './types';

const DATASETS = Object.keys(DATASET_LABELS) as DatasetKey[];

describe('niceTicks', () => {
  const cases: [number, number][] = [
    [0, 1],
    [59.2, 70.1],
    [30.4, 45.3],
    [53.7, 58.1],
    [0.0123, 0.0456],
    [-3, 3],
    [1000, 100000],
  ];

  it('returns increasing ticks that cover the range, in steps of 1, 2 or 5 times a power of ten', () => {
    for (const [lo, hi] of cases) {
      const t = niceTicks(lo, hi);
      expect(t.length).toBeGreaterThanOrEqual(2);
      expect(t[0]).toBeLessThanOrEqual(lo);
      expect(t[t.length - 1]).toBeGreaterThanOrEqual(hi);
      for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
      const step = t[1] - t[0];
      const mantissa = step / 10 ** Math.floor(Math.log10(step));
      expect([1, 2, 5, 10].some((m) => Math.abs(m - mantissa) < 1e-6)).toBe(true);
    }
  });

  it('keeps the tick count readable', () => {
    for (const [lo, hi] of cases) expect(niceTicks(lo, hi).length).toBeLessThanOrEqual(8);
  });

  it('does not blow up on an empty or inverted range', () => {
    expect(niceTicks(5, 5)).toEqual([5]);
    expect(niceTicks(9, 3)).toEqual([9]);
  });

  it('gives exactly these ticks for known ranges (steps and rounding pinned)', () => {
    expect(niceTicks(0, 1)).toEqual([0, 0.5, 1]);
    expect(niceTicks(59.2, 70.1)).toEqual([55, 60, 65, 70, 75]);
    expect(niceTicks(0, 0.5)).toEqual([0, 0.2, 0.4, 0.6]); // needs the step 2 and no float noise (0.6000000000000001)
    expect(niceTicks(0, 0.02)).toEqual([0, 0.005, 0.01, 0.015, 0.02]);
    expect(niceTicks(0, 0.004)).toEqual([0, 0.001, 0.002, 0.003, 0.004]);
  });

  it('stays strictly increasing and covering across many magnitudes (2000 pseudo-random ranges)', () => {
    let seed = 12345;
    const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let i = 0; i < 2000; i++) {
      const mag = 10 ** (Math.floor(rand() * 9) - 4); // 1e-4 .. 1e4
      const lo = (rand() - 0.5) * 20 * mag;
      const hi = lo + (0.01 + rand() * 10) * mag;
      const t = niceTicks(lo, hi);
      expect(t.length).toBeGreaterThanOrEqual(2);
      expect(t.length).toBeLessThanOrEqual(8);
      expect(t[0]).toBeLessThanOrEqual(lo);
      expect(t[t.length - 1]).toBeGreaterThanOrEqual(hi);
      for (let j = 1; j < t.length; j++) expect(t[j]).toBeGreaterThan(t[j - 1]);
    }
  });

  it('terminates on values too large for a step to change them', () => {
    const t = niceTicks(1e16, 1e16 + 4);
    expect(t.length).toBeLessThanOrEqual(13);
    expect(t.every(Number.isFinite)).toBe(true);
  });
});

describe('scatterScales over the real benchmark data', () => {
  for (const d of DATASETS) {
    const rows = BENCHMARK_RESULTS.filter((r) => r.dataset === d);

    it(`${DATASET_LABELS[d]}: every point lands inside the plot with a margin, and ticks are sorted`, () => {
      const { xTicks, yTicks, toX, toY } = scatterScales(rows);
      expect(xTicks.length).toBeGreaterThanOrEqual(2);
      expect(yTicks.length).toBeGreaterThanOrEqual(2);
      for (const r of rows) {
        const x = toX(r.fps);
        const y = toY(r.metric);
        expect(x).toBeGreaterThan(1);
        expect(x).toBeLessThan(99);
        expect(y).toBeGreaterThan(1);
        expect(y).toBeLessThan(99);
      }
      expect([...xTicks].sort((a, b) => a - b)).toEqual(xTicks);
      for (const t of xTicks) expect(FPS_TICKS).toContain(t);
      // Every tick sits on the plot (not past either end), so its gridline and label are drawn.
      for (const t of xTicks) {
        expect(toX(t)).toBeGreaterThanOrEqual(-1e-9);
        expect(toX(t)).toBeLessThanOrEqual(100 + 1e-9);
      }
      for (const t of yTicks) {
        expect(toY(t)).toBeGreaterThanOrEqual(-1e-9);
        expect(toY(t)).toBeLessThanOrEqual(100 + 1e-9);
      }
      // The outermost ticks are the plot's edges.
      expect(toX(xTicks[0])).toBeCloseTo(0, 6);
      expect(toX(xTicks[xTicks.length - 1])).toBeCloseTo(100, 6);
    });

    it(`${DATASET_LABELS[d]}: faster is further right and more accurate is higher`, () => {
      const { toX, toY } = scatterScales(rows);
      const sorted = [...rows].sort((a, b) => a.fps - b.fps);
      for (let i = 1; i < sorted.length; i++) expect(toX(sorted[i].fps)).toBeGreaterThanOrEqual(toX(sorted[i - 1].fps));
      const byMetric = [...rows].sort((a, b) => a.metric - b.metric);
      for (let i = 1; i < byMetric.length; i++) expect(toY(byMetric[i].metric)).toBeLessThanOrEqual(toY(byMetric[i - 1].metric));
    });
  }

  it('keeps every point inside the plot for speeds the old axis could not hold (the paper’s ViT-B and ViT-S run at 251 and 294 FPS)', () => {
    const cases: [number, number][][] = [
      [[400, 50], [500, 51]],
      [[50, 60], [300, 62]],
      [[160, 68.6], [294, 52.8]],
      [[1, 1], [10, 2]],
    ];
    for (const pts of cases) {
      const { toX, toY } = scatterScales(pts.map(([fps, metric]) => ({ fps, metric })));
      for (const [fps, metric] of pts) {
        expect(toX(fps)).toBeGreaterThan(0);
        expect(toX(fps)).toBeLessThan(100);
        expect(toY(metric)).toBeGreaterThan(0);
        expect(toY(metric)).toBeLessThan(100);
      }
    }
  });

  it('survives degenerate data: equal points, and a speed of zero', () => {
    const same = scatterScales([{ fps: 10, metric: 60 }, { fps: 10, metric: 60 }]);
    expect(same.toX(10)).toBeGreaterThan(0);
    expect(same.toX(10)).toBeLessThan(100);
    expect(same.toY(60)).toBeGreaterThan(0);
    expect(same.toY(60)).toBeLessThan(100);
    const zero = scatterScales([{ fps: 0, metric: 60 }, { fps: 20, metric: 61 }]);
    expect(Number.isFinite(zero.toX(0))).toBe(true);
    expect(zero.toX(0)).toBeGreaterThanOrEqual(0);
  });
});

describe('contrast helpers', () => {
  it('matches the WCAG reference values', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1, 5);
    expect(luminance('#000000')).toBeCloseTo(0, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
    // Each colour channel's weight in the luminance is pinned: swapping two of them must fail.
    expect(luminance('#ff0000')).toBeCloseTo(0.2126, 4);
    expect(luminance('#00ff00')).toBeCloseTo(0.7152, 4);
    expect(luminance('#0000ff')).toBeCloseTo(0.0722, 4);
    expect(contrastRatio('#ff0000', '#ffffff')).toBeCloseTo(3.998, 2);
  });

  it('picks an ink that reads on every colour the demo draws (>= 4.5:1)', () => {
    const fills = new Set([VIZ.reference, ...DEMO_FRAMES.flatMap((f) => f.objects.map((o) => o.color))]);
    expect(fills.size).toBeGreaterThanOrEqual(5);
    for (const fill of fills) {
      expect(contrastRatio(fill, inkFor(fill))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('never picks the worse of the two inks', () => {
    for (const fill of ['#3987e5', '#d95926', '#199e70', '#c98500', '#64748b', '#000000', '#ffffff', '#808080']) {
      const best = Math.max(contrastRatio(fill, '#ffffff'), contrastRatio(fill, '#020617'));
      expect(contrastRatio(fill, inkFor(fill))).toBeCloseTo(best, 8);
    }
  });
});

describe('formatDelta', () => {
  it('signs a change with a plus or a true minus, to one decimal', () => {
    expect(formatDelta(0.1)).toBe('+0.1');
    expect(formatDelta(-0.3)).toBe('−0.3');
    expect(formatDelta(2)).toBe('+2.0');
    expect(formatDelta(-5.2)).toBe('−5.2');
    expect(formatDelta(1.25)).toBe('+1.3');
  });

  it('prints no sign for no change, including negative zero and changes that round to zero', () => {
    expect(formatDelta(0)).toBe('0.0');
    expect(formatDelta(-0)).toBe('0.0');
    expect(formatDelta(0.04)).toBe('0.0');
    expect(formatDelta(-0.04)).toBe('0.0');
  });
});
