import type {
  AblationRow,
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

// Schematic demo frames for the query-propagation walkthrough. These are NOT paper data:
// the objects, boxes and confidences are made up to illustrate the mechanism.
// Entity colours are slots 1-4 of the dataviz categorical palette (dark steps); every
// object is also named in text, so identity never depends on colour alone.
export const DEMO_FRAMES: FrameState[] = [
  {
    frameIndex: 0,
    objects: [
      { id: 'obj-a', label: 'Person', color: '#3987e5', x: 20, y: 30, width: 18, height: 40, confidence: 0.95, isNew: false },
      { id: 'obj-b', label: 'Dog', color: '#d95926', x: 55, y: 50, width: 14, height: 20, confidence: 0.91, isNew: false },
      { id: 'obj-c', label: 'Ball', color: '#199e70', x: 75, y: 65, width: 8, height: 8, confidence: 0.88, isNew: false },
    ],
  },
  {
    frameIndex: 1,
    objects: [
      { id: 'obj-a', label: 'Person', color: '#3987e5', x: 24, y: 28, width: 18, height: 40, confidence: 0.96, isNew: false },
      { id: 'obj-b', label: 'Dog', color: '#d95926', x: 50, y: 48, width: 14, height: 20, confidence: 0.93, isNew: false },
      { id: 'obj-c', label: 'Ball', color: '#199e70', x: 68, y: 60, width: 8, height: 8, confidence: 0.85, isNew: false },
    ],
  },
  {
    frameIndex: 2,
    objects: [
      { id: 'obj-a', label: 'Person', color: '#3987e5', x: 30, y: 25, width: 18, height: 40, confidence: 0.94, isNew: false },
      { id: 'obj-b', label: 'Dog', color: '#d95926', x: 44, y: 45, width: 14, height: 20, confidence: 0.90, isNew: false },
      { id: 'obj-c', label: 'Ball', color: '#199e70', x: 60, y: 55, width: 8, height: 8, confidence: 0.82, isNew: false },
    ],
  },
  {
    frameIndex: 3,
    objects: [
      { id: 'obj-a', label: 'Person', color: '#3987e5', x: 36, y: 22, width: 18, height: 40, confidence: 0.93, isNew: false },
      { id: 'obj-b', label: 'Dog', color: '#d95926', x: 38, y: 42, width: 14, height: 20, confidence: 0.87, isNew: false },
      { id: 'obj-c', label: 'Ball', color: '#199e70', x: 52, y: 50, width: 8, height: 8, confidence: 0.79, isNew: false },
      { id: 'obj-d', label: 'Cat', color: '#c98500', x: 80, y: 55, width: 12, height: 16, confidence: 0.72, isNew: true },
    ],
  },
  {
    frameIndex: 4,
    objects: [
      { id: 'obj-a', label: 'Person', color: '#3987e5', x: 42, y: 20, width: 18, height: 40, confidence: 0.95, isNew: false },
      { id: 'obj-b', label: 'Dog', color: '#d95926', x: 32, y: 40, width: 14, height: 20, confidence: 0.89, isNew: false },
      { id: 'obj-c', label: 'Ball', color: '#199e70', x: 45, y: 48, width: 8, height: 8, confidence: 0.83, isNew: false },
      { id: 'obj-d', label: 'Cat', color: '#c98500', x: 72, y: 50, width: 12, height: 16, confidence: 0.88, isNew: false },
    ],
  },
  {
    frameIndex: 5,
    objects: [
      { id: 'obj-a', label: 'Person', color: '#3987e5', x: 48, y: 18, width: 18, height: 40, confidence: 0.96, isNew: false },
      { id: 'obj-b', label: 'Dog', color: '#d95926', x: 28, y: 38, width: 14, height: 20, confidence: 0.91, isNew: false },
      { id: 'obj-c', label: 'Ball', color: '#199e70', x: 38, y: 45, width: 8, height: 8, confidence: 0.86, isNew: false },
      { id: 'obj-d', label: 'Cat', color: '#c98500', x: 65, y: 46, width: 12, height: 16, confidence: 0.92, isNew: false },
    ],
  },
];
