import type {
  AblationRow,
  Analysis,
  AnalysisRow,
  Backbone,
  BenchmarkResult,
  DatasetKey,
  FrameState,
  MetricName,
} from './types';

// Source for everything in this file except DEMO_FRAMES:
//   Norouzi et al., "VidEoMT: Your ViT is Secretly Also a Video Segmentation Model", arXiv:2602.17807.
// Numbers are copied from the paper's tables (checked against the arXiv HTML):
//   ABLATION_TABLE    -> Table 1 (YouTube-VIS 2019 val)
//   BENCHMARK_RESULTS -> Tables 2-5 (VIS, VPS and VSS comparisons)
// data.test.ts re-derives the speed-ups and gaps that the paper's prose quotes from these numbers.

// Table 1: stepwise simplification from CAVIS to VidEoMT (YouTube-VIS 2019 val)
export const ABLATION_TABLE: AblationRow[] = [
  {
    step: 0,
    label: 'CAVIS',
    description: 'Full CAVIS model with ViT-Adapter, Mask2Former decoder, context-aware features, re-identification layers, and Transformer-based tracker.',
    hasViTAdapter: true,
    hasMask2FormerDecoder: true,
    hasTracker: true,
    hasContextAware: true,
    hasReID: true,
    hasQueryPropagation: false,
    hasQueryFusion: false,
    ap: 68.9,
    fps: 15,
    params: '358M',
    gflops: 838,
  },
  {
    step: 1,
    label: 'w/ EoMT Segmenter',
    description: 'Replace the complex segmenter (ViT-Adapter + Mask2Former pixel decoder + Transformer decoder) with EoMT. Queries are injected directly into the last 4 ViT layers.',
    hasViTAdapter: false,
    hasMask2FormerDecoder: false,
    hasTracker: true,
    hasContextAware: true,
    hasReID: true,
    hasQueryPropagation: false,
    hasQueryFusion: false,
    ap: 68.1,
    fps: 42,
    params: '328M',
    gflops: 699,
  },
  {
    step: 2,
    label: 'w/o Context-Aware',
    description: 'Remove context-aware features module. The paper hypothesises that a strong pre-trained ViT is already fine-grained enough to keep object identity stable without explicit boundary pooling.',
    hasViTAdapter: false,
    hasMask2FormerDecoder: false,
    hasTracker: true,
    hasContextAware: false,
    hasReID: true,
    hasQueryPropagation: false,
    hasQueryFusion: false,
    ap: 68.4,
    fps: 72,
    params: '327M',
    gflops: 581,
  },
  {
    step: 3,
    label: 'w/o Re-ID Layers',
    description: 'Remove re-identification MLP layers and contrastive loss. The paper hypothesises that the pre-trained ViT features already carry instance-level information.',
    hasViTAdapter: false,
    hasMask2FormerDecoder: false,
    hasTracker: true,
    hasContextAware: false,
    hasReID: false,
    hasQueryPropagation: false,
    hasQueryFusion: false,
    ap: 68.0,
    fps: 74,
    params: '326M',
    gflops: 580,
  },
  {
    step: 4,
    label: 'w/o Tracker (= EoMT)',
    description: 'Remove the entire Transformer-based tracker. Per-frame EoMT only — no temporal modeling. Huge speedup but significant accuracy drop.',
    hasViTAdapter: false,
    hasMask2FormerDecoder: false,
    hasTracker: false,
    hasContextAware: false,
    hasReID: false,
    hasQueryPropagation: false,
    hasQueryFusion: false,
    ap: 61.3,
    fps: 162,
    params: '316M',
    gflops: 565,
  },
  {
    step: 5,
    label: 'w/ Query Propagation',
    description: 'Reintroduce temporal modeling by feeding the output queries of frame t-1 in as the queries for frame t. No extra compute, +2.6 AP, but the model struggles to pick up newly appearing objects.',
    hasViTAdapter: false,
    hasMask2FormerDecoder: false,
    hasTracker: false,
    hasContextAware: false,
    hasReID: false,
    hasQueryPropagation: true,
    hasQueryFusion: false,
    ap: 63.9,
    fps: 162,
    params: '316M',
    gflops: 565,
  },
  {
    step: 6,
    label: 'VidEoMT',
    description: 'Add query fusion: Linear(Q_prev) + Q_learned. Propagated queries carry the past, learned queries stay free to detect new objects. Recovers nearly all of CAVIS’s accuracy (68.6 vs 68.9 AP) at more than 10× the speed.',
    hasViTAdapter: false,
    hasMask2FormerDecoder: false,
    hasTracker: false,
    hasContextAware: false,
    hasReID: false,
    hasQueryPropagation: true,
    hasQueryFusion: true,
    ap: 68.6,
    fps: 160,
    params: '318M',
    gflops: 566,
  },
];

export const DATASET_LABELS: Record<DatasetKey, string> = {
  ytvis19: 'YouTube-VIS 2019',
  ytvis21: 'YouTube-VIS 2021',
  ytvis22: 'YouTube-VIS 2022',
  ovis: 'OVIS',
  vipseg: 'VIPSeg',
  vspw: 'VSPW',
};

/** Headline metric per dataset, as printed in the paper. */
export const DATASET_METRIC: Record<DatasetKey, MetricName> = {
  ytvis19: 'AP',
  ytvis21: 'AP',
  ytvis22: 'AP_L',
  ovis: 'AP',
  vipseg: 'VPQ',
  vspw: 'mIoU',
};

export const DATASET_TASK: Record<DatasetKey, string> = {
  ytvis19: 'Video instance segmentation',
  ytvis21: 'Video instance segmentation',
  ytvis22: 'Video instance segmentation',
  ovis: 'Video instance segmentation',
  vipseg: 'Video panoptic segmentation',
  vspw: 'Video semantic segmentation',
};

/** Footnotes the paper attaches to a dataset's table. */
export const DATASET_NOTES: Partial<Record<DatasetKey, string>> = {
  ytvis22: 'Metric is AP_L, the column the paper prints as “APL”. DVIS-DAQ with Swin-L is not reported for this dataset.',
  ovis: 'DVIS-DAQ (ViT-L) and VidEoMT use an input resolution of 544 px (shortest side) on OVIS, as marked † in the paper.',
  vspw: 'The paper reports no CAVIS or DVIS-DAQ results on VSPW. The paper’s second VSPW metric, mVC16, is shown beside mIoU.',
};

const PRETRAINING: Record<Backbone, BenchmarkResult['pretraining']> = {
  'Swin-L': 'IN21K',
  'ViT-L': 'DINOv2',
};

const result = (
  dataset: DatasetKey,
  method: string,
  backbone: Backbone,
  metric: number,
  gflops: number,
  fps: number,
  secondary?: BenchmarkResult['secondary'],
): BenchmarkResult => ({
  id: `${dataset}:${method}:${backbone}`,
  method,
  backbone,
  pretraining: PRETRAINING[backbone],
  dataset,
  metric,
  metricName: DATASET_METRIC[dataset],
  fps,
  gflops,
  isVidEoMT: method === 'VidEoMT',
  secondary,
});

// Tables 2-5. Argument order: dataset, method, backbone, metric, GFLOPs, FPS.
export const BENCHMARK_RESULTS: BenchmarkResult[] = [
  // Table 2 — YouTube-VIS 2019 val (AP)
  result('ytvis19', 'MinVIS', 'Swin-L', 61.6, 401, 29),
  result('ytvis19', 'DVIS', 'Swin-L', 63.9, 411, 23),
  result('ytvis19', 'DVIS-DAQ', 'Swin-L', 65.7, 415, 13),
  result('ytvis19', 'DVIS++', 'ViT-L', 67.7, 846, 18),
  result('ytvis19', 'DVIS-DAQ', 'ViT-L', 68.3, 851, 10),
  result('ytvis19', 'CAVIS', 'ViT-L', 68.9, 838, 15),
  result('ytvis19', 'VidEoMT', 'ViT-L', 68.6, 566, 160),

  // Table 2 — YouTube-VIS 2021 val (AP)
  result('ytvis21', 'MinVIS', 'Swin-L', 55.3, 255, 30),
  result('ytvis21', 'DVIS', 'Swin-L', 58.7, 405, 24),
  result('ytvis21', 'DVIS-DAQ', 'Swin-L', 61.1, 410, 11),
  result('ytvis21', 'DVIS++', 'ViT-L', 62.3, 830, 17),
  result('ytvis21', 'DVIS-DAQ', 'ViT-L', 62.4, 836, 10),
  result('ytvis21', 'CAVIS', 'ViT-L', 64.6, 824, 15),
  result('ytvis21', 'VidEoMT', 'ViT-L', 63.1, 560, 160),

  // Table 3 — YouTube-VIS 2022 val (AP_L)
  result('ytvis22', 'MinVIS', 'Swin-L', 33.1, 224, 31),
  result('ytvis22', 'DVIS', 'Swin-L', 39.9, 401, 23),
  result('ytvis22', 'DVIS++', 'ViT-L', 37.5, 820, 18),
  result('ytvis22', 'CAVIS', 'ViT-L', 39.5, 815, 15),
  result('ytvis22', 'DVIS-DAQ', 'ViT-L', 42.0, 826, 10),
  result('ytvis22', 'VidEoMT', 'ViT-L', 42.6, 557, 161),

  // Table 3 — OVIS val (AP)
  result('ovis', 'MinVIS', 'Swin-L', 39.4, 408, 30),
  result('ovis', 'DVIS', 'Swin-L', 45.9, 419, 24),
  result('ovis', 'DVIS-DAQ', 'Swin-L', 49.5, 423, 12),
  result('ovis', 'DVIS++', 'ViT-L', 49.6, 868, 17),
  result('ovis', 'CAVIS', 'ViT-L', 53.2, 863, 15),
  result('ovis', 'DVIS-DAQ', 'ViT-L', 54.3, 1173, 8),
  result('ovis', 'VidEoMT', 'ViT-L', 52.5, 934, 115),

  // Table 4 — VIPSeg val (VPQ)
  result('vipseg', 'DVIS', 'Swin-L', 54.7, 879, 20),
  result('vipseg', 'DVIS++', 'ViT-L', 56.0, 2290, 13),
  result('vipseg', 'CAVIS', 'ViT-L', 56.9, 2612, 10),
  result('vipseg', 'DVIS-DAQ', 'ViT-L', 57.4, 2315, 4),
  result('vipseg', 'VidEoMT', 'ViT-L', 55.2, 1897, 75),

  // Table 5 — VSPW val (mIoU, with mVC16)
  result('vspw', 'DVIS', 'Swin-L', 61.3, 879, 22, { name: 'mVC16', value: 94.3 }),
  result('vspw', 'DVIS++', 'ViT-L', 62.8, 2290, 13, { name: 'mVC16', value: 94.2 }),
  result('vspw', 'VidEoMT', 'ViT-L', 64.9, 1909, 73, { name: 'mVC16', value: 95.0 }),
];

// The paper's analysis tables (§5.3 and Appendix B). Table numbers are the paper's own.
// Tables 8 and 9 print the AP change of VidEoMT against CAVIS next to each VidEoMT row; it is
// kept as `printedDelta` so data.test.ts can check it against the AP values.
const row = (
  id: string,
  label: string,
  ap: number,
  gflops: number,
  fps: number,
  extra: Partial<AnalysisRow> = {},
): AnalysisRow => ({ id, label, ap, gflops, fps, isVidEoMT: false, ...extra });

const pretrainingPair = (
  group: string,
  cavis: [number, number, number],
  vid: [number, number, number],
  printedDelta: number,
): AnalysisRow[] => [
  row(`pretraining:${group}:CAVIS`, 'CAVIS', cavis[0], cavis[1], cavis[2], { group, isReference: true }),
  row(`pretraining:${group}:VidEoMT`, 'VidEoMT', vid[0], vid[1], vid[2], { group, isVidEoMT: true, printedDelta }),
];

const sizeTriple = (
  group: string,
  cavis: [number, string, number, number],
  eomtCavis: [number, string, number, number],
  vid: [number, string, number, number],
  printedDelta: number,
): AnalysisRow[] => [
  row(`size:${group}:CAVIS`, 'CAVIS', cavis[0], cavis[2], cavis[3], { group, params: cavis[1], isReference: true }),
  row(`size:${group}:EoMT+CAVIS`, 'EoMT + CAVIS', eomtCavis[0], eomtCavis[2], eomtCavis[3], { group, params: eomtCavis[1] }),
  row(`size:${group}:VidEoMT`, 'VidEoMT', vid[0], vid[2], vid[3], { group, params: vid[1], isVidEoMT: true, printedDelta }),
];

// Order inside the tuples: [AP, (params,) GFLOPs, FPS].
export const ANALYSES: Analysis[] = [
  {
    key: 'pretraining',
    title: 'Pre-training',
    question: 'Does VidEoMT need large-scale pre-training?',
    source: 'Paper Table 8 (§5.3)',
    setup: 'YouTube-VIS 2019 val, ViT-L. The ± figure is VidEoMT’s AP minus CAVIS’s AP with the same pre-training.',
    takeaway:
      'With strong pre-training (DINOv3, DINOv2, EVA-02) VidEoMT is within 0.3 AP of CAVIS or ahead of it. The gap in CAVIS’s favour grows to 1.4 AP with ImageNet-21K and 2.7 AP with ImageNet-1K. The paper reads this as support for its hypothesis that large-scale pre-training is what lets a plain ViT take over the tracking modules.',
    note: 'DINOv3 and EVA-02 run slower than DINOv2 at about the same GFLOPs. The paper attributes a significant part of that to rotary position embeddings (App. B.3).',
    rows: [
      ...pretrainingPair('DINOv3', [68.8, 838, 13], [68.9, 566, 123], 0.1),
      ...pretrainingPair('DINOv2', [68.9, 838, 15], [68.6, 566, 160], -0.3),
      ...pretrainingPair('EVA-02', [68.0, 835, 12], [67.8, 564, 110], -0.2),
      ...pretrainingPair('IN21K', [62.2, 838, 15], [60.8, 566, 160], -1.4),
      ...pretrainingPair('IN1K', [59.4, 838, 15], [56.7, 566, 160], -2.7),
    ],
  },
  {
    key: 'size',
    title: 'Model size',
    question: 'How does the size of the ViT change the picture?',
    source: 'Paper Tables 9 and B (§5.3, App. B.2)',
    setup: 'YouTube-VIS 2019 val, DINOv2. The ± figure is VidEoMT’s AP minus CAVIS’s AP at the same size.',
    takeaway:
      'The gap to CAVIS shrinks as the ViT grows: 2.7 AP at ViT-S, 1.3 at ViT-B, 0.3 at ViT-L. VidEoMT with ViT-L (68.6 AP, 160 FPS) is still far more accurate than CAVIS with ViT-S (55.5 AP, 19 FPS) and several times faster. At every size VidEoMT beats EoMT + CAVIS in both AP and FPS.',
    rows: [
      ...sizeTriple('ViT-L', [68.9, '358M', 838, 15], [68.1, '328M', 699, 42], [68.6, '318M', 566, 160], -0.3),
      ...sizeTriple('ViT-B', [59.5, '131M', 390, 18], [57.4, '103M', 284, 67], [58.2, '95M', 182, 251], -1.3),
      ...sizeTriple('ViT-S', [55.5, '57M', 251, 19], [50.3, '34M', 150, 93], [52.8, '25M', 56, 294], -2.7),
    ],
  },
  {
    key: 'propagation',
    title: 'Propagation strategy',
    question: 'How should the queries be carried to the next frame?',
    source: 'Paper Table A (App. B.1)',
    setup: 'YouTube-VIS 2019 val, ViT-L, DINOv2.',
    takeaway:
      'With no propagation the model gets 61.3 AP. Feeding the previous queries back alone gives 63.9 AP but struggles to find new objects. Resetting queries that found no object gets 67.8, and a TrackFormer-style scheme 67.7, but that one drops to 117 FPS because duplicate detections must be filtered before they are propagated. Query fusion gets 68.6 AP at 160 FPS.',
    rows: [
      row('propagation:none', 'No propagation', 61.3, 565, 162),
      row('propagation:only', 'Propagation only', 63.9, 565, 162),
      row('propagation:reset', 'Non-object reset', 67.8, 565, 157),
      row('propagation:trackformer', 'TrackFormer', 67.7, 571, 117),
      row('propagation:fusion', 'Query fusion = VidEoMT', 68.6, 566, 160, { isVidEoMT: true }),
    ],
  },
  {
    key: 'trackers',
    title: 'EoMT plus a tracker',
    question: 'Why not bolt an existing tracker onto EoMT?',
    source: 'Paper Table 6 (§5.3)',
    setup: 'YouTube-VIS 2019 val, ViT-L, DINOv2.',
    takeaway:
      'Existing trackers do work on top of EoMT; the best, CAVIS, reaches 68.1 AP. VidEoMT is slightly more accurate than that combination and nearly 4× faster, with no tracker at all.',
    rows: [
      row('trackers:cavis', 'EoMT + CAVIS', 68.1, 699, 42),
      row('trackers:dvispp', 'EoMT + DVIS++', 67.0, 683, 69),
      row('trackers:daq', 'EoMT + DVIS-DAQ', 67.3, 703, 28),
      row('trackers:videomt', 'VidEoMT (no tracker)', 68.6, 566, 160, { isVidEoMT: true }),
    ],
  },
  {
    key: 'decoder',
    title: 'Decoder or encoder-only',
    question: 'Would the same trick work in a decoder instead?',
    source: 'Paper Table 7 (§5.3)',
    setup: 'YouTube-VIS 2019 val, ViT-L, DINOv2.',
    takeaway:
      'Propagating queries into a ViT-Adapter + Mask2Former decoder instead of the encoder gives comparable AP (68.0 with query fusion, 67.8 with TrackFormer’s scheme) but runs at 32 and 22 FPS. The encoder-only VidEoMT reaches 68.6 AP at 160 FPS. In the decoder, query fusion is slightly more accurate and faster than TrackFormer’s scheme.',
    rows: [
      row('decoder:trackformer', 'Decoder + TrackFormer', 67.8, 739, 22, { detail: 'ViT-Adapter encoder, Mask2Former decoder, TrackFormer-style propagation' }),
      row('decoder:fusion', 'Decoder + query fusion', 68.0, 718, 32, { detail: 'ViT-Adapter encoder, Mask2Former decoder, query fusion' }),
      row('decoder:videomt', 'VidEoMT, query fusion', 68.6, 566, 160, { isVidEoMT: true, detail: 'Encoder only: no adapter, no decoder' }),
    ],
  },
];

/** VidEoMT's AP minus the reference row of the same group, to the paper's one decimal. */
export function gapToReference(rows: AnalysisRow[], r: AnalysisRow): number | null {
  const ref = rows.find((x) => x.group === r.group && x.isReference);
  if (!ref || r.isReference) return null;
  return Math.round((r.ap - ref.ap) * 10) / 10;
}

/** Query slots drawn in the demo. The paper uses N = 200 learnable queries. */
export const DEMO_SLOTS = 8;

// Schematic demo frames for the query-propagation walkthrough. These are NOT paper data:
// the objects, boxes and confidences are made up to illustrate the mechanism.
// What they do illustrate: an object keeps the same query slot for the whole clip, and a
// newly appearing object (the cat, frame 3) lands in a slot that was idle before.
// Entity colours are slots 1-4 of the dataviz categorical palette (dark steps); every
// object also has a name, a one-letter tag and a shape, so identity never depends on colour.
export const DEMO_FRAMES: FrameState[] = [
  {
    frameIndex: 0,
    objects: [
      { id: 'obj-a', label: 'Person', slot: 0, shape: 'rect', color: '#3987e5', x: 20, y: 30, width: 18, height: 40, confidence: 0.95, isNew: false },
      { id: 'obj-b', label: 'Dog', slot: 1, shape: 'ellipse', color: '#d95926', x: 55, y: 50, width: 14, height: 20, confidence: 0.91, isNew: false },
      { id: 'obj-c', label: 'Ball', slot: 2, shape: 'circle', color: '#199e70', x: 75, y: 65, width: 8, height: 8, confidence: 0.88, isNew: false },
    ],
  },
  {
    frameIndex: 1,
    objects: [
      { id: 'obj-a', label: 'Person', slot: 0, shape: 'rect', color: '#3987e5', x: 24, y: 28, width: 18, height: 40, confidence: 0.96, isNew: false },
      { id: 'obj-b', label: 'Dog', slot: 1, shape: 'ellipse', color: '#d95926', x: 50, y: 48, width: 14, height: 20, confidence: 0.93, isNew: false },
      { id: 'obj-c', label: 'Ball', slot: 2, shape: 'circle', color: '#199e70', x: 68, y: 60, width: 8, height: 8, confidence: 0.85, isNew: false },
    ],
  },
  {
    frameIndex: 2,
    objects: [
      { id: 'obj-a', label: 'Person', slot: 0, shape: 'rect', color: '#3987e5', x: 30, y: 25, width: 18, height: 40, confidence: 0.94, isNew: false },
      { id: 'obj-b', label: 'Dog', slot: 1, shape: 'ellipse', color: '#d95926', x: 44, y: 45, width: 14, height: 20, confidence: 0.90, isNew: false },
      { id: 'obj-c', label: 'Ball', slot: 2, shape: 'circle', color: '#199e70', x: 60, y: 55, width: 8, height: 8, confidence: 0.82, isNew: false },
    ],
  },
  {
    frameIndex: 3,
    objects: [
      { id: 'obj-a', label: 'Person', slot: 0, shape: 'rect', color: '#3987e5', x: 36, y: 22, width: 18, height: 40, confidence: 0.93, isNew: false },
      { id: 'obj-b', label: 'Dog', slot: 1, shape: 'ellipse', color: '#d95926', x: 38, y: 42, width: 14, height: 20, confidence: 0.87, isNew: false },
      { id: 'obj-c', label: 'Ball', slot: 2, shape: 'circle', color: '#199e70', x: 52, y: 50, width: 8, height: 8, confidence: 0.79, isNew: false },
      { id: 'obj-d', label: 'Cat', slot: 3, shape: 'triangle', color: '#c98500', x: 80, y: 55, width: 12, height: 16, confidence: 0.72, isNew: true },
    ],
  },
  {
    frameIndex: 4,
    objects: [
      { id: 'obj-a', label: 'Person', slot: 0, shape: 'rect', color: '#3987e5', x: 42, y: 20, width: 18, height: 40, confidence: 0.95, isNew: false },
      { id: 'obj-b', label: 'Dog', slot: 1, shape: 'ellipse', color: '#d95926', x: 32, y: 40, width: 14, height: 20, confidence: 0.89, isNew: false },
      { id: 'obj-c', label: 'Ball', slot: 2, shape: 'circle', color: '#199e70', x: 45, y: 48, width: 8, height: 8, confidence: 0.83, isNew: false },
      { id: 'obj-d', label: 'Cat', slot: 3, shape: 'triangle', color: '#c98500', x: 72, y: 50, width: 12, height: 16, confidence: 0.88, isNew: false },
    ],
  },
  {
    frameIndex: 5,
    objects: [
      { id: 'obj-a', label: 'Person', slot: 0, shape: 'rect', color: '#3987e5', x: 48, y: 18, width: 18, height: 40, confidence: 0.96, isNew: false },
      { id: 'obj-b', label: 'Dog', slot: 1, shape: 'ellipse', color: '#d95926', x: 28, y: 38, width: 14, height: 20, confidence: 0.91, isNew: false },
      { id: 'obj-c', label: 'Ball', slot: 2, shape: 'circle', color: '#199e70', x: 38, y: 45, width: 8, height: 8, confidence: 0.86, isNew: false },
      { id: 'obj-d', label: 'Cat', slot: 3, shape: 'triangle', color: '#c98500', x: 65, y: 46, width: 12, height: 16, confidence: 0.92, isNew: false },
    ],
  },
];
