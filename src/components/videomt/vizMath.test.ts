import { describe, expect, it } from 'vitest';
import { BENCHMARK_RESULTS, DATASET_LABELS, DEMO_FRAMES } from './data';
import { contrastRatio, FPS_TICKS, inkFor, luminance, niceTicks, scatterScales } from './vizMath';
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
      // Every tick sits on the plot, so its gridline and label are drawn.
      for (const t of xTicks) expect(toX(t)).toBeGreaterThanOrEqual(-0.001);
      for (const t of yTicks) expect(toY(t)).toBeGreaterThanOrEqual(-0.001);
    });

    it(`${DATASET_LABELS[d]}: faster is further right and more accurate is higher`, () => {
      const { toX, toY } = scatterScales(rows);
      const sorted = [...rows].sort((a, b) => a.fps - b.fps);
      for (let i = 1; i < sorted.length; i++) expect(toX(sorted[i].fps)).toBeGreaterThanOrEqual(toX(sorted[i - 1].fps));
      const byMetric = [...rows].sort((a, b) => a.metric - b.metric);
      for (let i = 1; i < byMetric.length; i++) expect(toY(byMetric[i].metric)).toBeLessThanOrEqual(toY(byMetric[i - 1].metric));
    });
  }

  it('survives data that would collapse the axis (all points beyond the last tick, or all equal)', () => {
    const fast = scatterScales([{ fps: 400, metric: 50 }, { fps: 500, metric: 51 }]);
    expect(Number.isFinite(fast.toX(400))).toBe(true);
    const same = scatterScales([{ fps: 10, metric: 60 }, { fps: 10, metric: 60 }]);
    expect(Number.isFinite(same.toY(60))).toBe(true);
    expect(Number.isFinite(same.toX(10))).toBe(true);
  });
});

describe('contrast helpers', () => {
  it('matches the WCAG reference values', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1, 5);
    expect(luminance('#000000')).toBeCloseTo(0, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
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
