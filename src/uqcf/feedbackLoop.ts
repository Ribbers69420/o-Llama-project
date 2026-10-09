// The cognitive feedback loop (UQCF.tex §4.5) on top of the toy pipeline.
//
// Each iteration runs the whole pipeline. While a termination criterion (§4.7)
// fails, the loop applies one adjustment, the remedy §5.1 names for the most
// fundamental failure, and runs again. An adjustment is kept only if it lowers
// the control functional J (§5.1); otherwise it is rolled back (§4.1: "loops,
// rollbacks") and that remedy is not tried again. The loop ends on a stable
// collapse, on a fail-closed refusal (§4.4), or by abstaining (§2.2) when the
// budget is spent or no remedy is left (a non-recoverable failure, §4.6).
//
// The paper names the remedies but not their mechanics. Which parameter each
// remedy changes and by how much, the J-based rollback, and the perturbation
// stability test are PROTOTYPE CHOICES.

import {
  LAYERS,
  MAX_DEPTH,
  clampDepth,
  failedCriteria,
  formatVs,
  runPipeline,
  type CriterionFailure,
  type PipelineParams,
  type PipelineResult,
  type StepMetrics,
} from './pipeline';

// --- REMEDIES ---

export type RemedyId = 'reduce-depth' | 'bind-context' | 'revise-retrieval' | 'deepen' | 'tune-shaping';
export type FailureId = CriterionFailure['id'] | 'unstable';

export interface Failure {
  id: FailureId;
  reason: string;
}

interface Remedy {
  label: string;
  section: string;
  applicable: (p: PipelineParams) => boolean;
  apply: (p: PipelineParams) => PipelineParams;
  change: (before: PipelineParams, after: PipelineParams) => string;
}

/** Coupling change per adjustment, in radians. */
export const THETA_STEP = 0.3;

const layerOf = (glyph: string): number => LAYERS.findIndex((l) => l.glyph === glyph);
const BIND = layerOf('🝞');
const RETRIEVE = layerOf('🜄');
const SHAPE = layerOf('🝪');

const canRaise = (k: number) => (p: PipelineParams) => p.thetas[k] < Math.PI - 1e-9;
const raise = (k: number) => (p: PipelineParams): PipelineParams => ({
  ...p,
  thetas: p.thetas.map((t, i) => (i === k ? Math.min(Math.PI, t + THETA_STEP) : t)),
});
/**
 * 🜄 hands the prompt to the context with strength sin²θ, which peaks at
 * θ = π/2 (+ kπ). Raising θ past that peak would weaken the update, so this
 * remedy moves θ towards a peak instead: π/2 within the sliders' range 0…π,
 * otherwise the nearest one.
 */
const retrievalPeak = (t: number) =>
  t >= 0 && t <= Math.PI ? Math.PI / 2 : Math.PI / 2 + Math.PI * Math.round((t - Math.PI / 2) / Math.PI);
const canStrengthenRetrieval = (p: PipelineParams) => Math.abs(p.thetas[RETRIEVE] - retrievalPeak(p.thetas[RETRIEVE])) > 1e-9;
const strengthenRetrieval = (p: PipelineParams): PipelineParams => ({
  ...p,
  thetas: p.thetas.map((t, i) => {
    if (i !== RETRIEVE) return t;
    const peak = retrievalPeak(t);
    return t < peak ? Math.min(peak, t + THETA_STEP) : Math.max(peak, t - THETA_STEP);
  }),
});
const thetaChange = (k: number) => (a: PipelineParams, b: PipelineParams) =>
  `θ(${LAYERS[k].glyph}) ${a.thetas[k].toFixed(2)} → ${b.thetas[k].toFixed(2)}`;
const depthChange = (a: PipelineParams, b: PipelineParams) => `depth ${a.depth} → ${b.depth}`;

export const REMEDIES: Record<RemedyId, Remedy> = {
  'reduce-depth': {
    label: 'Reduce branching: one fewer synthesis pass',
    section: '§5.1',
    applicable: (p) => p.depth > 1,
    apply: (p) => ({ ...p, depth: p.depth - 1 }),
    change: depthChange,
  },
  'bind-context': {
    label: 'Increase context-binding strength',
    section: '§5.1',
    applicable: canRaise(BIND),
    apply: raise(BIND),
    change: thetaChange(BIND),
  },
  'revise-retrieval': {
    label: 'Revise retrieval: stronger prompt–context update',
    section: '§5.1',
    applicable: canStrengthenRetrieval,
    apply: strengthenRetrieval,
    change: thetaChange(RETRIEVE),
  },
  deepen: {
    label: 'Increase reasoning depth: another synthesis pass',
    section: '§4.5, §5.1',
    applicable: (p) => p.depth < MAX_DEPTH,
    apply: (p) => ({ ...p, depth: p.depth + 1 }),
    change: depthChange,
  },
  'tune-shaping': {
    label: 'Operator tuning: stronger answer shaping',
    section: '§4.5',
    applicable: canRaise(SHAPE),
    apply: raise(SHAPE),
    change: thetaChange(SHAPE),
  },
};

/**
 * Remedies per failure, in the order they are tried. Unsafe mass has none of
 * its own: the ethical projector handles it on every run.
 */
export const REMEDIES_FOR: Record<FailureId, RemedyId[]> = {
  coherence: ['reduce-depth'],
  binding: ['bind-context', 'revise-retrieval'],
  diffuse: ['deepen', 'tune-shaping'],
  unstable: ['deepen', 'tune-shaping'],
  unsafe: [],
};

// --- STABILITY ---

/**
 * §4.7 asks for stability across recent iterations. A deterministic re-run is
 * identical by construction, so stability is tested by re-running with every
 * coupling scaled by 1 ± PERTURBATION and requiring the same answer, a small
 * shift in the response distribution, and no refusal.
 */
export const PERTURBATION = 0.05;
export const MAX_DRIFT = 0.1;

export interface StabilityProbe {
  scale: number;
  /** Answer of the perturbed run; −1 if it was refused. */
  argmax: number;
  /** Total-variation distance between the perturbed and reference distributions. */
  drift: number;
}

export interface StabilityCheck {
  stable: boolean;
  probes: StabilityProbe[];
}

const totalVariation = (p: number[], q: number[]): number => 0.5 * p.reduce((s, x, i) => s + Math.abs(x - q[i]), 0);

export const checkStability = (params: PipelineParams, reference: StepMetrics): StabilityCheck => {
  const probes = [1 - PERTURBATION, 1 + PERTURBATION].map((scale): StabilityProbe => {
    // No cap at π: every layer is a valid unitary for any θ, and a cap would leave
    // couplings near π unperturbed.
    const r = runPipeline({ ...params, thetas: params.thetas.map((t) => t * scale) });
    const m = r.steps[r.steps.length - 1].metrics;
    return {
      scale,
      argmax: r.governance.refused ? -1 : m.argmax,
      drift: totalVariation(m.responseProbs, reference.responseProbs),
    };
  });
  return {
    stable: probes.every((p) => p.argmax === reference.argmax && p.drift <= MAX_DRIFT),
    probes,
  };
};

// --- LOOP ---

/** Smallest decrease in J that counts as an improvement. */
const MIN_IMPROVEMENT = 1e-6;
export const DEFAULT_BUDGET = 6;
export const MAX_BUDGET = 10;

export interface Adjustment {
  remedy: RemedyId;
  label: string;
  section: string;
  /** The failed criterion that prompted it. */
  failure: FailureId;
  trigger: string;
  /** Parameter change, e.g. "depth 1 → 2". */
  change: string;
}

export interface LoopIteration {
  /** 1-based run number; every run counts against the budget. */
  index: number;
  params: PipelineParams;
  /** The adjustment that produced these parameters; null for the first run. */
  adjustment: Adjustment | null;
  result: PipelineResult;
  /** J of the final (post-governance) state. */
  control: number;
  final: StepMetrics;
  /** Failed criteria at this run; empty for a rolled-back run. */
  failures: Failure[];
  stability: StabilityCheck | null;
  status: 'accepted' | 'rolled-back';
}

export type LoopOutcome =
  | { kind: 'collapse'; response: number; confidence: number }
  | { kind: 'refuse'; reason: string }
  | { kind: 'abstain'; cause: 'budget' | 'non-recoverable'; reason: string };

export interface LoopResult {
  iterations: LoopIteration[];
  outcome: LoopOutcome;
  /** Parameters of the last accepted run. */
  finalParams: PipelineParams;
}

const chooseRemedy = (failures: Failure[], params: PipelineParams, blocked: Set<RemedyId>) => {
  // Policy: remedy only the most fundamental failure. Fixing a lower-priority
  // criterion first might happen to help, but the loop does not guess.
  const [first] = failures;
  if (!first) return null;
  const id = REMEDIES_FOR[first.id].find((r) => !blocked.has(r) && REMEDIES[r].applicable(params));
  return id ? { id, failure: first } : null;
};

export const runFeedbackLoop = (initial: PipelineParams, budget = DEFAULT_BUDGET): LoopResult => {
  const runs = Math.min(MAX_BUDGET, Math.max(1, Math.round(budget)));
  const iterations: LoopIteration[] = [];
  const blocked = new Set<RemedyId>();
  let best: LoopIteration | null = null;
  // The depth remedies step the number of passes the pipeline actually runs.
  let params: PipelineParams = { ...initial, depth: clampDepth(initial.depth) };
  let adjustment: Adjustment | null = null;

  const finish = (outcome: LoopOutcome): LoopResult => ({
    iterations,
    outcome,
    finalParams: best?.params ?? params,
  });

  for (let index = 1; index <= runs; index++) {
    const result = runPipeline(params);
    const final = result.steps[result.steps.length - 1].metrics;
    const base = { index, params, adjustment, result, control: final.control, final };

    if (result.governance.refused) {
      // Fail closed: a refusal ends the loop, whatever caused it.
      const iteration: LoopIteration = { ...base, failures: [], stability: null, status: 'accepted' };
      iterations.push(iteration);
      best = iteration;
      return finish({
        kind: 'refuse',
        reason: result.decision.kind === 'refuse' ? result.decision.reason : 'Governance refused the output',
      });
    }

    if (adjustment && best && !(final.control < best.control - MIN_IMPROVEMENT)) {
      iterations.push({ ...base, failures: [], stability: null, status: 'rolled-back' });
      blocked.add(adjustment.remedy);
    } else {
      let failures: Failure[] = failedCriteria(final, params.epsilon);
      let stability: StabilityCheck | null = null;
      if (failures.length === 0) {
        stability = checkStability(params, final);
        if (!stability.stable) {
          const drift = Math.max(...stability.probes.map((p) => p.drift));
          failures = [
            { id: 'unstable', reason: `answer not stable under ±${PERTURBATION * 100}% couplings (drift ${formatVs(drift, MAX_DRIFT)})` },
          ];
        }
      }
      const iteration: LoopIteration = { ...base, failures, stability, status: 'accepted' };
      iterations.push(iteration);
      best = iteration;
      if (failures.length === 0) {
        return finish({ kind: 'collapse', response: final.argmax, confidence: final.confidence });
      }
    }

    const current = best as LoopIteration;
    if (index === runs) {
      return finish({
        kind: 'abstain',
        cause: 'budget',
        reason: `Budget of ${runs} run${runs === 1 ? '' : 's'} spent; still failing: ${current.failures.map((f) => f.reason).join('; ')}`,
      });
    }
    const next = chooseRemedy(current.failures, current.params, blocked);
    if (!next) {
      return finish({
        kind: 'abstain',
        cause: 'non-recoverable',
        reason: `No remedy left for: ${current.failures[0].reason}`,
      });
    }
    const remedy = REMEDIES[next.id];
    params = remedy.apply(current.params);
    adjustment = {
      remedy: next.id,
      label: remedy.label,
      section: remedy.section,
      failure: next.failure.id,
      trigger: next.failure.reason,
      change: remedy.change(current.params, params),
    };
  }

  // Unreachable: every path through the last run returns above.
  return finish({ kind: 'abstain', cause: 'budget', reason: 'Budget spent' });
};
