import { describe, expect, it } from 'vitest';
import {
  ABLATION_TABLE,
  ANALYSES,
  BENCHMARK_RESULTS,
  DATASET_LABELS,
  DATASET_METRIC,
  DEMO_FRAMES,
  DEMO_SLOTS,
  gapToReference,
} from './data';
import type { AnalysisKey, BenchmarkResult, DatasetKey } from './types';
import { ABLATION_GOLDEN, ANALYSES_GOLDEN, BENCHMARK_GOLDEN } from './paperTables.fixture';
import type { AnalysisRow } from './types';

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

describe('analysis tables (§5.3 and Appendix B)', () => {
  const analysis = (key: AnalysisKey) => ANALYSES.find((a) => a.key === key)!;
  const rowOf = (key: AnalysisKey, id: string) => {
    const r = analysis(key).rows.find((x) => x.id === id);
    if (!r) throw new Error(`no row ${id} in ${key}`);
    return r;
  };
  const gaps = (key: AnalysisKey) =>
    Object.fromEntries(
      analysis(key)
        .rows.filter((r) => r.isVidEoMT)
        .map((r) => [r.group, gapToReference(analysis(key).rows, r)]),
    );

  it('has unique row ids and one analysis per key', () => {
    const ids = ANALYSES.flatMap((a) => a.rows.map((r) => r.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ANALYSES.map((a) => a.key)).size).toBe(ANALYSES.length);
  });

  it('has exactly one VidEoMT row per group, and one CAVIS reference where the paper compares against it', () => {
    for (const key of ['pretraining', 'size'] as const) {
      const groups = new Set(analysis(key).rows.map((r) => r.group));
      for (const g of groups) {
        const rows = analysis(key).rows.filter((r) => r.group === g);
        expect(rows.filter((r) => r.isVidEoMT)).toHaveLength(1);
        expect(rows.filter((r) => r.isReference)).toHaveLength(1);
      }
    }
    for (const key of ['propagation', 'trackers', 'decoder'] as const) {
      expect(analysis(key).rows.filter((r) => r.isVidEoMT)).toHaveLength(1);
    }
  });

  it('transcribed each AP correctly: the change the paper prints equals VidEoMT minus CAVIS', () => {
    for (const key of ['pretraining', 'size'] as const) {
      for (const r of analysis(key).rows.filter((x) => x.isVidEoMT)) {
        expect(r.printedDelta).toBeDefined();
        expect(gapToReference(analysis(key).rows, r)).toBeCloseTo(r.printedDelta!, 5);
      }
    }
  });

  it('pre-training: comparable to CAVIS with large-scale pre-training, a growing gap with less', () => {
    const g = gaps('pretraining');
    for (const large of ['DINOv3', 'DINOv2', 'EVA-02']) expect(Math.abs(g[large]!)).toBeLessThanOrEqual(0.3);
    expect(Math.abs(g['IN21K']!)).toBeGreaterThan(Math.abs(g['DINOv2']!));
    expect(Math.abs(g['IN1K']!)).toBeGreaterThan(Math.abs(g['IN21K']!));
    expect(g['IN21K']).toBeLessThan(0);
    expect(g['IN1K']).toBeLessThan(0);
    // DINOv3 gives only a marginal gain over DINOv2 for VidEoMT.
    const gain = rowOf('pretraining', 'pretraining:DINOv3:VidEoMT').ap - rowOf('pretraining', 'pretraining:DINOv2:VidEoMT').ap;
    expect(gain).toBeGreaterThan(0);
    expect(gain).toBeLessThan(0.5);
    // DINOv3 and EVA-02 are slower than DINOv2 at about the same GFLOPs (App. B.3).
    const v2 = rowOf('pretraining', 'pretraining:DINOv2:VidEoMT');
    for (const other of ['DINOv3', 'EVA-02']) {
      const o = rowOf('pretraining', `pretraining:${other}:VidEoMT`);
      expect(o.fps).toBeLessThan(v2.fps);
      expect(Math.abs(o.gflops - v2.gflops)).toBeLessThanOrEqual(3);
    }
  });

  it('model size: the gap to CAVIS shrinks as the ViT grows; ViT-L VidEoMT beats ViT-S CAVIS by a lot', () => {
    const g = gaps('size');
    expect(Math.abs(g['ViT-S']!)).toBeGreaterThan(Math.abs(g['ViT-B']!));
    expect(Math.abs(g['ViT-B']!)).toBeGreaterThan(Math.abs(g['ViT-L']!));
    const vitL = rowOf('size', 'size:ViT-L:VidEoMT');
    const cavisS = rowOf('size', 'size:ViT-S:CAVIS');
    expect(vitL.fps / cavisS.fps).toBeGreaterThan(8);
    expect(vitL.ap - cavisS.ap).toBeGreaterThan(10);
  });

  it('model size: VidEoMT beats EoMT + CAVIS in AP and FPS at every size, with fewer parameters', () => {
    for (const size of ['ViT-L', 'ViT-B', 'ViT-S']) {
      const vid = rowOf('size', `size:${size}:VidEoMT`);
      const eomt = rowOf('size', `size:${size}:EoMT+CAVIS`);
      expect(vid.ap).toBeGreaterThan(eomt.ap);
      expect(vid.fps).toBeGreaterThan(eomt.fps);
      expect(parseInt(vid.params!, 10)).toBeLessThan(parseInt(eomt.params!, 10));
    }
  });

  it('agrees with Table 1 and the YouTube-VIS 2019 comparison wherever the same model appears', () => {
    const pairs: [string, number, number, number][] = [
      // [analysis row, AP, GFLOPs, FPS] from the ablation table
      ['size:ViT-L:CAVIS', ablation(0).ap, ablation(0).gflops, ablation(0).fps],
      ['size:ViT-L:EoMT+CAVIS', ablation(1).ap, ablation(1).gflops, ablation(1).fps],
      ['size:ViT-L:VidEoMT', ablation(6).ap, ablation(6).gflops, ablation(6).fps],
      ['pretraining:DINOv2:CAVIS', ablation(0).ap, ablation(0).gflops, ablation(0).fps],
      ['pretraining:DINOv2:VidEoMT', ablation(6).ap, ablation(6).gflops, ablation(6).fps],
    ];
    for (const [id, ap, gflops, fps] of pairs) {
      const r = ANALYSES.flatMap((a) => a.rows).find((x) => x.id === id)!;
      expect([r.ap, r.gflops, r.fps]).toEqual([ap, gflops, fps]);
    }
    // Table A repeats steps 4, 5 and 6 of Table 1.
    for (const [id, step] of [['propagation:none', 4], ['propagation:only', 5], ['propagation:fusion', 6]] as const) {
      const r = rowOf('propagation', id);
      expect([r.ap, r.gflops]).toEqual([ablation(step).ap, ablation(step).gflops]);
    }
    expect(rowOf('trackers', 'trackers:videomt').ap).toBe(find('ytvis19', 'VidEoMT').metric);
  });

  it('propagation strategies: fusion is the most accurate, and TrackFormer’s scheme is considerably slower', () => {
    const rows = analysis('propagation').rows;
    const fusion = rowOf('propagation', 'propagation:fusion');
    expect(Math.max(...rows.map((r) => r.ap))).toBe(fusion.ap);
    expect(rowOf('propagation', 'propagation:reset').ap).toBeGreaterThan(rowOf('propagation', 'propagation:only').ap);
    expect(rowOf('propagation', 'propagation:only').ap).toBeGreaterThan(rowOf('propagation', 'propagation:none').ap);
    const tf = rowOf('propagation', 'propagation:trackformer');
    expect(tf.ap).toBeLessThan(fusion.ap);
    expect(tf.fps / fusion.fps).toBeLessThan(0.8);
  });

  it('EoMT + a tracker: VidEoMT is slightly more accurate than the best combination and nearly 4x faster', () => {
    const rows = analysis('trackers').rows.filter((r) => !r.isVidEoMT);
    const best = rows.reduce((a, b) => (b.ap > a.ap ? b : a));
    expect(best.id).toBe('trackers:cavis');
    const vid = rowOf('trackers', 'trackers:videomt');
    expect(vid.ap).toBeGreaterThan(best.ap);
    expect(vid.ap - best.ap).toBeLessThan(1);
    expect(vid.fps / best.fps).toBeGreaterThan(3.5);
    expect(vid.fps / best.fps).toBeLessThan(4);
  });

  it('decoder vs encoder-only: encoder-only is comparable in AP and much faster; fusion beats TrackFormer in the decoder', () => {
    const tf = rowOf('decoder', 'decoder:trackformer');
    const fus = rowOf('decoder', 'decoder:fusion');
    const vid = rowOf('decoder', 'decoder:videomt');
    expect(fus.ap).toBeGreaterThan(tf.ap);
    expect(fus.fps).toBeGreaterThan(tf.fps);
    expect(vid.ap - fus.ap).toBeLessThan(1);
    expect(vid.fps / fus.fps).toBeGreaterThan(4);
    expect(vid.gflops).toBeLessThan(fus.gflops);
  });
});

describe('every transcribed number against the independent copy parsed from the paper', () => {
  it('Table 1: all seven ablation rows match, field by field', () => {
    expect(ABLATION_TABLE).toHaveLength(ABLATION_GOLDEN.length);
    for (const [step, ap, params, gflops, fps] of ABLATION_GOLDEN) {
      const r = ablation(step);
      expect({ step, ap: r.ap, params: r.params, gflops: r.gflops, fps: r.fps }).toEqual({ step, ap, params, gflops, fps });
    }
  });

  it('Tables 2-5: the same rows and the same numbers, none missing and none extra', () => {
    const key = (dataset: string, method: string, backbone: string) => `${dataset}|${method}|${backbone}`;
    expect(BENCHMARK_RESULTS.map((r) => key(r.dataset, r.method, r.backbone)).sort()).toEqual(
      BENCHMARK_GOLDEN.map(([d, m, b]) => key(d, m, b)).sort(),
    );
    for (const [dataset, method, backbone, metric, gflops, fps, mvc] of BENCHMARK_GOLDEN) {
      const r = BENCHMARK_RESULTS.find((x) => key(x.dataset, x.method, x.backbone) === key(dataset, method, backbone))!;
      expect({ metric: r.metric, gflops: r.gflops, fps: r.fps, mvc: r.secondary?.value ?? null }).toEqual({ metric, gflops, fps, mvc });
    }
  });

  it('Tables 6-9, A and B: the same rows and the same numbers, params and printed changes included', () => {
    const rows = ANALYSES.flatMap((a) => a.rows);
    expect(rows.map((r) => r.id).sort()).toEqual(ANALYSES_GOLDEN.map(([id]) => id).sort());
    for (const [id, ap, gflops, fps, params, delta] of ANALYSES_GOLDEN) {
      const r = rows.find((x) => x.id === id)!;
      expect({ ap: r.ap, gflops: r.gflops, fps: r.fps, params: r.params ?? null, delta: r.printedDelta ?? null }).toEqual({
        ap, gflops, fps, params, delta,
      });
    }
  });
});

describe('gapToReference and the group structure the Analyses view relies on', () => {
  const r = (id: string, ap: number, extra: Partial<AnalysisRow> = {}): AnalysisRow => ({
    id, label: id, ap, fps: 1, gflops: 1, isVidEoMT: false, ...extra,
  });
  const rows = [
    r('cavis', 68.9, { group: 'g', isReference: true }),
    r('other', 68.1, { group: 'g' }),
    r('vid', 68.6, { group: 'g', isVidEoMT: true }),
    r('lone', 50, { group: 'h' }),
    r('ungrouped', 60),
  ];

  it('is null for the reference row itself, for a group with no reference, and for ungrouped rows', () => {
    expect(gapToReference(rows, rows[0])).toBeNull();
    expect(gapToReference(rows, rows[3])).toBeNull();
    expect(gapToReference(rows, rows[4])).toBeNull();
  });

  it('is the row minus the reference, signed, for any row of the group (not only VidEoMT)', () => {
    expect(gapToReference(rows, rows[1])).toBe(-0.8);
    expect(gapToReference(rows, rows[2])).toBe(-0.3);
    expect(gapToReference(rows, r('up', 70, { group: 'g' }))).toBe(1.1);
  });

  it('is exactly zero for a tie, and rounds to the paper’s one decimal', () => {
    expect(gapToReference(rows, r('tie', 68.9, { group: 'g' }))).toBe(0);
    expect(gapToReference(rows, r('float', 68.1 + 0.1 + 0.1, { group: 'g' }))).toBe(-0.6);
  });

  it('keeps the rows of each group together, so no group heading is drawn twice', () => {
    for (const a of ANALYSES) {
      const seen = new Set<string>();
      let previous: string | undefined;
      for (const row of a.rows) {
        if (row.group !== previous) {
          if (row.group) expect(seen.has(row.group)).toBe(false);
          if (row.group) seen.add(row.group);
        }
        previous = row.group;
      }
    }
  });
});
