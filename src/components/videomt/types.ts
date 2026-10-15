export interface AblationRow {
  step: number;
  label: string;
  description: string;
  hasViTAdapter: boolean;
  hasMask2FormerDecoder: boolean;
  hasTracker: boolean;
  hasContextAware: boolean;
  hasReID: boolean;
  hasQueryPropagation: boolean;
  hasQueryFusion: boolean;
  ap: number;
  fps: number;
  params: string;
  gflops: number;
}

export type DatasetKey = 'ytvis19' | 'ytvis21' | 'ytvis22' | 'ovis' | 'vipseg' | 'vspw';

export type Backbone = 'Swin-L' | 'ViT-L';

/** AP_L is printed "APL" in the paper's YouTube-VIS 2022 columns. */
export type MetricName = 'AP' | 'AP_L' | 'VPQ' | 'mIoU';

export interface BenchmarkResult {
  /** Stable key: DVIS-DAQ appears twice per dataset (Swin-L and ViT-L). */
  id: string;
  method: string;
  backbone: Backbone;
  /** Swin-L rows use IN21K pre-training and ViT-L rows use DINOv2, in every table. */
  pretraining: 'IN21K' | 'DINOv2';
  dataset: DatasetKey;
  metric: number;
  metricName: MetricName;
  fps: number;
  gflops: number;
  isVidEoMT: boolean;
  /** A second headline number the paper quotes, e.g. mVC16 on VSPW. */
  secondary?: { name: string; value: number };
}

export type ObjectShape = 'rect' | 'ellipse' | 'circle' | 'triangle';

export interface ObjectQuery {
  id: string;
  label: string;
  color: string;
  /** Which query slot tracks this object. An object keeps its slot for the whole clip. */
  slot: number;
  /** A second cue next to colour, so identity never depends on colour alone. */
  shape: ObjectShape;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  isNew: boolean;
}

export interface FrameState {
  frameIndex: number;
  objects: ObjectQuery[];
}

export type AnimationPhase = 'propagating' | 'transforming' | 'fusing' | 'complete';

export type AnalysisKey = 'pretraining' | 'size' | 'propagation' | 'trackers' | 'decoder';

export interface AnalysisRow {
  id: string;
  /** Rows in one group are compared with each other (one pre-training, one ViT size). */
  group?: string;
  label: string;
  /** What the label stands for, when it is too long to print beside a bar. */
  detail?: string;
  ap: number;
  fps: number;
  gflops: number;
  params?: string;
  isVidEoMT: boolean;
  /** The row the paper compares VidEoMT's AP against within its group (CAVIS). */
  isReference?: boolean;
  /** The change in AP that the paper prints next to a VidEoMT row (the ↑/↓ figure). */
  printedDelta?: number;
}

export interface Analysis {
  key: AnalysisKey;
  title: string;
  question: string;
  /** Where the numbers come from in the paper. */
  source: string;
  setup: string;
  takeaway: string;
  note?: string;
  rows: AnalysisRow[];
}
