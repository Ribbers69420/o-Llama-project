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

export interface BenchmarkResult {
  method: string;
  backbone: string;
  dataset: string;
  metric: number;
  metricName: string;
  fps: number;
  isVidEoMT: boolean;
}

export interface ObjectQuery {
  id: string;
  label: string;
  color: string;
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

export type DatasetKey = 'ytvis19' | 'ytvis21' | 'ytvis22' | 'ovis' | 'vipseg' | 'vspw';

export type AnimationPhase = 'idle' | 'propagating' | 'transforming' | 'fusing' | 'complete';
