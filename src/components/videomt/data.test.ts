import { describe, expect, it } from 'vitest';
import { ABLATION_TABLE, BENCHMARK_RESULTS, DATASET_LABELS, DATASET_METRIC, DEMO_FRAMES, DEMO_SLOTS } from './data';
import type { BenchmarkResult, DatasetKey } from './types';

const DATASETS = Object.keys(DATASET_LABELS) as DatasetKey[];

const find = (dataset: DatasetKey, method: string, backbone?: BenchmarkResult['backbone']) => {
  const hits = BENCHMARK_RESULTS.filter(
    (r) => r.dataset === dataset && r.method === method && (backbone === undefined || r.backbone === backbone),
  );
  if (hits.length !== 1) throw new Error(`expected one ${method}/${backbone ?? '*'} row for ${dataset}, got ${hits.length}`);
  return hits[0];
};
const ablation = (step: number) => ABLATION_TABLE.find((r) => r.step === step)!;
const speedup = (a: BenchmarkResult, b: BenchmarkResult) => a.fps / b.fps;

describe('benchmark data shape', () => {
  it('has unique ids, because DVIS-DAQ appears with two backbones on some datasets', () => {
    const ids = BENCHMARK_RESULTS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has exactly one VidEoMT row per dataset, and uses the dataset’s headline metric everywhere', () => {
    for (const d of DATASETS) {
      const rows = BENCHMARK_RESULTS.filter((r) => r.dataset === d);
      expect(rows.filter((r) => r.isVidEoMT)).toHaveLength(1);
      expect(rows.every((r) => r.metricName === DATASET_METRIC[d])).toBe(true);
    }
  });

  it('pairs Swin-L with IN21K and ViT-L with DINOv2, as every table in the paper does', () => {
    for (const r of BENCHMARK_RESULTS) {
      expect(r.pretraining).toBe(r.backbone === 'Swin-L' ? 'IN21K' : 'DINOv2');
    }
  });
});

describe('Table 1 (ablation) against the paper’s prose', () => {
  it('matches the headline rows of the YouTube-VIS 2019 comparison', () => {
    const cavis = find('ytvis19', 'CAVIS');
    const vid = find('ytvis19', 'VidEoMT');
    expect([ablation(0).ap, ablation(0).fps]).toEqual([cavis.metric, cavis.fps]);
    expect([ablation(6).ap, ablation(6).fps]).toEqual([vid.metric, vid.fps]);
    expect(ablation(6).gflops).toBe(vid.gflops);
  });

  it('reproduces the step-by-step claims in §5.1', () => {
    // (1) EoMT segmenter: nearly 3x faster, AP drops by only 0.8.
    expect(ablation(1).fps / ablation(0).fps).toBeGreaterThan(2.7);
    expect(ablation(0).ap - ablation(1).ap).toBeCloseTo(0.8, 5);
    // (2)-(3) speed rises 1.8x to 74 FPS with almost no accuracy change.
    expect(ablation(3).fps).toBe(74);
    expect(ablation(3).fps / ablation(1).fps).toBeCloseTo(1.8, 1);
    // (4) removing the tracker: more than 10x faster than CAVIS, a 7.6 AP drop.
    expect(ablation(4).fps / ablation(0).fps).toBeGreaterThan(10);
    expect(ablation(0).ap - ablation(4).ap).toBeCloseTo(7.6, 5);
    // (5) query propagation: +2.6 AP at no extra cost.
    expect(ablation(5).ap - ablation(4).ap).toBeCloseTo(2.6, 5);
    expect(ablation(5).gflops).toBe(ablation(4).gflops);
    // (6) query fusion recovers nearly all of CAVIS's accuracy, at more than 10x the speed.
    expect(ablation(0).ap - ablation(6).ap).toBeLessThan(0.5);
    expect(ablation(6).fps / ablation(0).fps).toBeGreaterThan(10);
  });

  it('flags the modules that each step removes or adds', () => {
    expect(ablation(0).hasTracker && ablation(0).hasViTAdapter && ablation(0).hasMask2FormerDecoder).toBe(true);
    expect(ablation(1).hasViTAdapter || ablation(1).hasMask2FormerDecoder).toBe(false);
    expect(ablation(2).hasContextAware).toBe(false);
    expect(ablation(3).hasReID).toBe(false);
    expect(ablation(4).hasTracker).toBe(false);
    expect(ablation(5).hasQueryPropagation && !ablation(5).hasQueryFusion).toBe(true);
    expect(ablation(6).hasQueryPropagation && ablation(6).hasQueryFusion).toBe(true);
  });
});

describe('Tables 2-5 against the paper’s prose (§5.2)', () => {
  it('VIS: over 14x faster than DVIS-DAQ (ViT-L); more accurate everywhere except OVIS, where it is within 2 AP', () => {
    for (const d of ['ytvis19', 'ytvis21', 'ytvis22', 'ovis'] as const) {
      const vid = find(d, 'VidEoMT');
      const daq = find(d, 'DVIS-DAQ', 'ViT-L');
      expect(speedup(vid, daq)).toBeGreaterThan(14);
      if (d === 'ovis') {
        expect(daq.metric - vid.metric).toBeGreaterThan(0);
        expect(daq.metric - vid.metric).toBeLessThan(2);
      } else {
        expect(vid.metric).toBeGreaterThan(daq.metric);
      }
    }
  });

  it('VIS: beats CAVIS on YouTube-VIS 2022, is comparable on 2019 and OVIS, within 2 AP on 2021, and 7x to 10x+ faster', () => {
    const pair = (d: DatasetKey) => [find(d, 'VidEoMT'), find(d, 'CAVIS')] as const;
    expect(pair('ytvis22')[0].metric).toBeGreaterThan(pair('ytvis22')[1].metric);
    expect(Math.abs(pair('ytvis19')[0].metric - pair('ytvis19')[1].metric)).toBeLessThan(1);
    expect(Math.abs(pair('ovis')[0].metric - pair('ovis')[1].metric)).toBeLessThan(1);
    expect(pair('ytvis21')[1].metric - pair('ytvis21')[0].metric).toBeLessThan(2);
    const ratios = (['ytvis19', 'ytvis21', 'ytvis22', 'ovis'] as const).map((d) => speedup(...pair(d)));
    expect(Math.min(...ratios)).toBeGreaterThanOrEqual(7);
    expect(Math.max(...ratios)).toBeGreaterThan(10);
  });

  it('VIS: outperforms DVIS and DVIS++ and is faster than MinVIS, on every dataset that has them', () => {
    for (const d of ['ytvis19', 'ytvis21', 'ytvis22', 'ovis'] as const) {
      const vid = find(d, 'VidEoMT');
      for (const other of BENCHMARK_RESULTS.filter(
        (r) => r.dataset === d && ['DVIS', 'DVIS++', 'MinVIS'].includes(r.method),
      )) {
        expect(vid.metric).toBeGreaterThan(other.metric);
        expect(vid.fps).toBeGreaterThan(other.fps);
      }
    }
  });

  it('VPS: gives up 2.2 VPQ to DVIS-DAQ for nearly 19x the speed, and is 5x-7x faster than DVIS++ and CAVIS', () => {
    const vid = find('vipseg', 'VidEoMT');
    const daq = find('vipseg', 'DVIS-DAQ');
    expect(daq.metric).toBe(Math.max(...BENCHMARK_RESULTS.filter((r) => r.dataset === 'vipseg').map((r) => r.metric)));
    expect(daq.fps).toBe(Math.min(...BENCHMARK_RESULTS.filter((r) => r.dataset === 'vipseg').map((r) => r.fps)));
    expect(daq.metric - vid.metric).toBeCloseTo(2.2, 5);
    expect(speedup(vid, daq)).toBeGreaterThan(18);
    expect(speedup(vid, daq)).toBeLessThan(19);
    for (const m of ['DVIS++', 'CAVIS']) {
      const r = speedup(vid, find('vipseg', m));
      expect(r).toBeGreaterThanOrEqual(5);
      expect(r).toBeLessThanOrEqual(8);
    }
  });

  it('VSS: +2.1 mIoU and +0.8 mVC16 over DVIS++, and more than 5x faster', () => {
    const vid = find('vspw', 'VidEoMT');
    const pp = find('vspw', 'DVIS++');
    expect(vid.metric - pp.metric).toBeCloseTo(2.1, 5);
    expect(vid.secondary!.name).toBe('mVC16');
    expect(vid.secondary!.value - pp.secondary!.value).toBeCloseTo(0.8, 5);
    expect(speedup(vid, pp)).toBeGreaterThan(5);
  });
});

describe('demo frames (schematic, not paper data)', () => {
  it('keeps every object id stable across frames and introduces one new object', () => {
    const first = new Set(DEMO_FRAMES[0].objects.map((o) => o.id));
    const fresh = DEMO_FRAMES.flatMap((f) => f.objects.filter((o) => o.isNew).map((o) => o.id));
    expect(fresh).toEqual(['obj-d']);
    for (const f of DEMO_FRAMES) {
      for (const id of first) expect(f.objects.some((o) => o.id === id)).toBe(true);
      // An object keeps one colour for the whole clip.
      for (const o of f.objects) {
        expect(DEMO_FRAMES.flatMap((g) => g.objects).filter((p) => p.id === o.id).every((p) => p.color === o.color)).toBe(true);
      }
    }
  });

  it('keeps an object in one query slot, never shares a slot, and puts the new object in a slot that was idle', () => {
    const slotOf = new Map<string, number>();
    for (const f of DEMO_FRAMES) {
      const used = f.objects.map((o) => o.slot);
      expect(new Set(used).size).toBe(used.length);
      for (const o of f.objects) {
        expect(o.slot).toBeGreaterThanOrEqual(0);
        expect(o.slot).toBeLessThan(DEMO_SLOTS);
        expect(slotOf.get(o.id) ?? o.slot).toBe(o.slot);
        slotOf.set(o.id, o.slot);
      }
    }
    DEMO_FRAMES.forEach((f, i) => {
      for (const o of f.objects.filter((x) => x.isNew)) {
        expect(i).toBeGreaterThan(0);
        expect(DEMO_FRAMES[i - 1].objects.some((p) => p.slot === o.slot)).toBe(false);
      }
    });
  });
});
