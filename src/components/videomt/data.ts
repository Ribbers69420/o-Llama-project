import type { AblationRow, BenchmarkResult, FrameState, DatasetKey } from './types';

// Table 1: Stepwise simplification from CAVIS to VidEoMT (YouTube-VIS 2019 val)
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
    description: 'Remove context-aware features module. The DINOv2 ViT features are already fine-grained enough to capture object identity without explicit boundary pooling.',
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
    description: 'Remove re-identification MLP layers and contrastive loss. The pre-trained ViT already provides instance-discriminative features.',
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
    description: 'Reintroduce temporal modeling by propagating output queries from frame t-1 as input to frame t. Zero extra compute, +2.6 AP recovery.',
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
    description: 'Add query fusion: Linear(Q_prev) + Q_learned. Combines temporal context with adaptability for new objects. Full accuracy recovery at 10× speed.',
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

// Benchmark results across datasets (Tables 2-5)
export const BENCHMARK_RESULTS: BenchmarkResult[] = [
  // YouTube-VIS 2019
  { method: 'MinVIS', backbone: 'R50', dataset: 'ytvis19', metric: 47.4, metricName: 'AP', fps: 39, isVidEoMT: false },
  { method: 'DVIS', backbone: 'ViT-L', dataset: 'ytvis19', metric: 63.9, metricName: 'AP', fps: 16, isVidEoMT: false },
  { method: 'DVIS-DAQ', backbone: 'ViT-L', dataset: 'ytvis19', metric: 66.2, metricName: 'AP', fps: 11, isVidEoMT: false },
  { method: 'DVIS++', backbone: 'ViT-L', dataset: 'ytvis19', metric: 66.0, metricName: 'AP', fps: 16, isVidEoMT: false },
  { method: 'CAVIS', backbone: 'ViT-L', dataset: 'ytvis19', metric: 68.9, metricName: 'AP', fps: 15, isVidEoMT: false },
  { method: 'VidEoMT', backbone: 'ViT-L', dataset: 'ytvis19', metric: 68.6, metricName: 'AP', fps: 160, isVidEoMT: true },

  // YouTube-VIS 2021
  { method: 'DVIS', backbone: 'ViT-L', dataset: 'ytvis21', metric: 57.6, metricName: 'AP', fps: 16, isVidEoMT: false },
  { method: 'DVIS-DAQ', backbone: 'ViT-L', dataset: 'ytvis21', metric: 60.8, metricName: 'AP', fps: 11, isVidEoMT: false },
  { method: 'DVIS++', backbone: 'ViT-L', dataset: 'ytvis21', metric: 60.3, metricName: 'AP', fps: 16, isVidEoMT: false },
  { method: 'CAVIS', backbone: 'ViT-L', dataset: 'ytvis21', metric: 63.0, metricName: 'AP', fps: 15, isVidEoMT: false },
  { method: 'VidEoMT', backbone: 'ViT-L', dataset: 'ytvis21', metric: 61.2, metricName: 'AP', fps: 160, isVidEoMT: true },

  // YouTube-VIS 2022
  { method: 'DVIS-DAQ', backbone: 'ViT-L', dataset: 'ytvis22', metric: 53.0, metricName: 'AP', fps: 11, isVidEoMT: false },
  { method: 'CAVIS', backbone: 'ViT-L', dataset: 'ytvis22', metric: 54.3, metricName: 'AP', fps: 15, isVidEoMT: false },
  { method: 'VidEoMT', backbone: 'ViT-L', dataset: 'ytvis22', metric: 55.1, metricName: 'AP', fps: 160, isVidEoMT: true },

  // OVIS
  { method: 'DVIS', backbone: 'ViT-L', dataset: 'ovis', metric: 43.6, metricName: 'AP', fps: 16, isVidEoMT: false },
  { method: 'DVIS-DAQ', backbone: 'ViT-L', dataset: 'ovis', metric: 50.0, metricName: 'AP', fps: 11, isVidEoMT: false },
  { method: 'DVIS++', backbone: 'ViT-L', dataset: 'ovis', metric: 47.5, metricName: 'AP', fps: 16, isVidEoMT: false },
  { method: 'CAVIS', backbone: 'ViT-L', dataset: 'ovis', metric: 48.5, metricName: 'AP', fps: 15, isVidEoMT: false },
  { method: 'VidEoMT', backbone: 'ViT-L', dataset: 'ovis', metric: 48.4, metricName: 'AP', fps: 112, isVidEoMT: true },

  // VIPSeg (VPQ metric)
  { method: 'DVIS', backbone: 'ViT-L', dataset: 'vipseg', metric: 52.6, metricName: 'VPQ', fps: 11, isVidEoMT: false },
  { method: 'DVIS++', backbone: 'ViT-L', dataset: 'vipseg', metric: 55.7, metricName: 'VPQ', fps: 11, isVidEoMT: false },
  { method: 'DVIS-DAQ', backbone: 'ViT-L', dataset: 'vipseg', metric: 57.4, metricName: 'VPQ', fps: 4, isVidEoMT: false },
  { method: 'CAVIS', backbone: 'ViT-L', dataset: 'vipseg', metric: 56.0, metricName: 'VPQ', fps: 10, isVidEoMT: false },
  { method: 'VidEoMT', backbone: 'ViT-L', dataset: 'vipseg', metric: 55.2, metricName: 'VPQ', fps: 75, isVidEoMT: true },

  // VSPW (mIoU metric)
  { method: 'DVIS', backbone: 'ViT-L', dataset: 'vspw', metric: 57.7, metricName: 'mIoU', fps: 11, isVidEoMT: false },
  { method: 'DVIS++', backbone: 'ViT-L', dataset: 'vspw', metric: 59.4, metricName: 'mIoU', fps: 11, isVidEoMT: false },
  { method: 'CAVIS', backbone: 'ViT-L', dataset: 'vspw', metric: 60.6, metricName: 'mIoU', fps: 10, isVidEoMT: false },
  { method: 'VidEoMT', backbone: 'ViT-L', dataset: 'vspw', metric: 61.5, metricName: 'mIoU', fps: 75, isVidEoMT: true },
];

export const DATASET_LABELS: Record<DatasetKey, string> = {
  ytvis19: 'YouTube-VIS 2019',
  ytvis21: 'YouTube-VIS 2021',
  ytvis22: 'YouTube-VIS 2022',
  ovis: 'OVIS',
  vipseg: 'VIPSeg',
  vspw: 'VSPW',
};

// Demo frames for the query propagation visualization
export const DEMO_FRAMES: FrameState[] = [
  {
    frameIndex: 0,
    objects: [
      { id: 'obj-a', label: 'Person', color: '#06b6d4', x: 20, y: 30, width: 18, height: 40, confidence: 0.95, isNew: false },
      { id: 'obj-b', label: 'Dog', color: '#a855f7', x: 55, y: 50, width: 14, height: 20, confidence: 0.91, isNew: false },
      { id: 'obj-c', label: 'Ball', color: '#f59e0b', x: 75, y: 65, width: 8, height: 8, confidence: 0.88, isNew: false },
    ],
  },
  {
    frameIndex: 1,
    objects: [
      { id: 'obj-a', label: 'Person', color: '#06b6d4', x: 24, y: 28, width: 18, height: 40, confidence: 0.96, isNew: false },
      { id: 'obj-b', label: 'Dog', color: '#a855f7', x: 50, y: 48, width: 14, height: 20, confidence: 0.93, isNew: false },
      { id: 'obj-c', label: 'Ball', color: '#f59e0b', x: 68, y: 60, width: 8, height: 8, confidence: 0.85, isNew: false },
    ],
  },
  {
    frameIndex: 2,
    objects: [
      { id: 'obj-a', label: 'Person', color: '#06b6d4', x: 30, y: 25, width: 18, height: 40, confidence: 0.94, isNew: false },
      { id: 'obj-b', label: 'Dog', color: '#a855f7', x: 44, y: 45, width: 14, height: 20, confidence: 0.90, isNew: false },
      { id: 'obj-c', label: 'Ball', color: '#f59e0b', x: 60, y: 55, width: 8, height: 8, confidence: 0.82, isNew: false },
    ],
  },
  {
    frameIndex: 3,
    objects: [
      { id: 'obj-a', label: 'Person', color: '#06b6d4', x: 36, y: 22, width: 18, height: 40, confidence: 0.93, isNew: false },
      { id: 'obj-b', label: 'Dog', color: '#a855f7', x: 38, y: 42, width: 14, height: 20, confidence: 0.87, isNew: false },
      { id: 'obj-c', label: 'Ball', color: '#f59e0b', x: 52, y: 50, width: 8, height: 8, confidence: 0.79, isNew: false },
      { id: 'obj-d', label: 'Cat', color: '#10b981', x: 80, y: 55, width: 12, height: 16, confidence: 0.72, isNew: true },
    ],
  },
  {
    frameIndex: 4,
    objects: [
      { id: 'obj-a', label: 'Person', color: '#06b6d4', x: 42, y: 20, width: 18, height: 40, confidence: 0.95, isNew: false },
      { id: 'obj-b', label: 'Dog', color: '#a855f7', x: 32, y: 40, width: 14, height: 20, confidence: 0.89, isNew: false },
      { id: 'obj-c', label: 'Ball', color: '#f59e0b', x: 45, y: 48, width: 8, height: 8, confidence: 0.83, isNew: false },
      { id: 'obj-d', label: 'Cat', color: '#10b981', x: 72, y: 50, width: 12, height: 16, confidence: 0.88, isNew: false },
    ],
  },
  {
    frameIndex: 5,
    objects: [
      { id: 'obj-a', label: 'Person', color: '#06b6d4', x: 48, y: 18, width: 18, height: 40, confidence: 0.96, isNew: false },
      { id: 'obj-b', label: 'Dog', color: '#a855f7', x: 28, y: 38, width: 14, height: 20, confidence: 0.91, isNew: false },
      { id: 'obj-c', label: 'Ball', color: '#f59e0b', x: 38, y: 45, width: 8, height: 8, confidence: 0.86, isNew: false },
      { id: 'obj-d', label: 'Cat', color: '#10b981', x: 65, y: 46, width: 12, height: 16, confidence: 0.92, isNew: false },
    ],
  },
];
