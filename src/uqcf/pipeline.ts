// Toy instantiation of the UQCF operational pipeline (UQCF.tex §2–§5).
//
// State space H = H_P ⊗ H_C ⊗ H_R: prompt P (1 qubit), context C (1 qubit) and
// response R (4 candidate responses, held as two qubits r₁ r₀, r = 2·r₁ + r₀).
// The state is a 16×16 density operator so decoherence can be modelled.
//
// The paper names the glyph-chain operators but does not define their matrices.
// Every operator below is therefore a PROTOTYPE CHOICE, not a definition taken
// from UQCF.tex. Each layer is the identity when its coupling θ is 0, which
// makes per-layer ablation possible (§3.4, §8).

import {
  type CMatrix,
  add,
  conjugate,
  identity,
  kron,
  matmul,
  matrix,
  outer,
  scale,
  shannonEntropy,
  trace,
  traceProduct,
  vonNeumannEntropy,
  zeros,
} from './linalg';

// --- SUBSYSTEMS ---

export type Subsystem = 'P' | 'C' | 'R';
type Qubit = 'P' | 'C' | 'R1' | 'R0';

const SUBSYSTEMS: Subsystem[] = ['P', 'C', 'R'];
const DIM_OF: Record<Subsystem, number> = { P: 2, C: 2, R: 4 };
export const DIM = 16;

const coords = (i: number): Record<Subsystem, number> => ({ P: i >> 3, C: (i >> 2) & 1, R: i & 3 });

export const RESPONSE_LABELS = ['r₀', 'r₁', 'r₂', 'r₃'] as const;
/** Index of the response basis state that spans the disallowed subspace. */
export const UNSAFE_RESPONSE = 3;

export const basisLabel = (i: number): string => {
  const c = coords(i);
  return `|${c.P} ${c.C} ${RESPONSE_LABELS[c.R]}⟩`;
};

// --- GATES ---

const I2 = identity(2);
const X = matrix([[0, 1], [1, 0]]);
const Y = matrix([[0, [0, -1]], [[0, 1], 0]]);
const Z = matrix([[1, 0], [0, -1]]);
const PROJ0 = matrix([[1, 0], [0, 0]]);
const PROJ1 = matrix([[0, 0], [0, 1]]);

const ry = (t: number): CMatrix =>
  matrix([
    [Math.cos(t / 2), -Math.sin(t / 2)],
    [Math.sin(t / 2), Math.cos(t / 2)],
  ]);

/** Embed single-qubit operators into the 16-dim space (identity elsewhere). */
const on = (ops: Partial<Record<Qubit, CMatrix>>): CMatrix =>
  kron(kron(kron(ops.P ?? I2, ops.C ?? I2), ops.R1 ?? I2), ops.R0 ?? I2);

/** exp(−iθ·S) for an operator S with S² = I (any Pauli string). */
const expInvolution = (theta: number, s: CMatrix): CMatrix =>
  add(scale(identity(s.n), Math.cos(theta)), scale(s, { re: 0, im: -Math.sin(theta) }));

const controlled = (control: Qubit, target: Qubit, u: CMatrix): CMatrix =>
  add(on({ [control]: PROJ0 }), on({ [control]: PROJ1, [target]: u }));

/** Uniform superposition over the four candidate responses. */
const UNIFORM_R: [number, number][] = [[0.5, 0], [0.5, 0], [0.5, 0], [0.5, 0]];

// --- GLYPH-CHAIN LAYERS ---

export interface LayerSpec {
  glyph: string;
  codepoint: string;
  /** Neo-Latin name, function and φ-layer from the Codex Harmonicus; null where unspecified. */
  codexName: string | null;
  codexFunction: string | null;
  codexLayer: string | null;
  /** Plain-language description of the prototype operator. */
  operator: string;
  defaultTheta: number;
  build: (theta: number) => CMatrix;
}

const TROTTER_STEPS = 4;

export const LAYERS: LayerSpec[] = [
  {
    glyph: '🜂',
    codepoint: 'U+1F702',
    codexName: 'Signum Recognitionis',
    codexFunction: 'Primary perception',
    codexLayer: 'φ⁰',
    operator: 'R_y(θ) on the prompt qubit P',
    defaultTheta: 1.1,
    build: (t) => on({ P: ry(t) }),
  },
  {
    glyph: '🜄',
    codepoint: 'U+1F704',
    codexName: 'Sigillum Aequalitatis',
    codexFunction: 'Kalman resonance and update flow',
    codexLayer: 'φ¹',
    operator: 'Exchange coupling exp(−iθ(XX+YY)/2) between P and C: the context is updated from the prompt',
    defaultTheta: 2.2,
    build: (t) =>
      matmul(expInvolution(t / 2, on({ P: X, C: X })), expInvolution(t / 2, on({ P: Y, C: Y }))),
  },
  {
    glyph: '🝞',
    codepoint: 'U+1F75E',
    codexName: null,
    codexFunction: null,
    codexLayer: null,
    operator: 'C-controlled R_y(θ) on response bit r₁: binds context to the response',
    defaultTheta: 0.9,
    build: (t) => controlled('C', 'R1', ry(t)),
  },
  {
    glyph: '⟠',
    codepoint: 'U+27E0',
    codexName: null,
    codexFunction: null,
    codexLayer: null,
    operator: 'P-controlled R_y(θ) on response bit r₀: binds prompt to the response',
    defaultTheta: 2.1,
    build: (t) => controlled('P', 'R0', ry(t)),
  },
  {
    glyph: '⦾',
    codepoint: 'U+29BE',
    codexName: 'Signum Compressionis',
    codexFunction: 'Fractal batching / harmonic compression',
    codexLayer: 'φ²–φ⁵',
    operator: 'R_x(θ) on both response bits: mixes candidate amplitudes so their phases interfere',
    defaultTheta: 2.5,
    build: (t) => matmul(on({ R1: expInvolution(t / 2, X) }), on({ R0: expInvolution(t / 2, X) })),
  },
  {
    glyph: '🜿',
    codepoint: 'U+1F73F',
    codexName: 'Sigillum Harmoniae',
    codexFunction: 'Fractal error correction',
    codexLayer: 'φ⁸–φ¹⁰',
    operator: 'ZZ phase couplings C–r₁ and P–r₀: relative phases between branches',
    defaultTheta: 0.6,
    build: (t) =>
      matmul(expInvolution(t / 2, on({ C: Z, R1: Z })), expInvolution(t / 2, on({ P: Z, R0: Z }))),
  },
  {
    glyph: '🝏',
    codepoint: 'U+1F74F',
    codexName: 'Glyphus Temporalis Ordinis',
    codexFunction: 'Time-ordered entanglement flow',
    codexLayer: 'φ³–φ⁶',
    operator: `Trotterised evolution exp(−iĤt), Ĥ = Z_P Z_r₀ + Z_C Z_r₁ + ½(X_r₀ + X_r₁), t = θ, ${TROTTER_STEPS} steps`,
    defaultTheta: 0.5,
    build: (t) => {
      const dt = t / TROTTER_STEPS;
      const step = [
        expInvolution(dt, on({ P: Z, R0: Z })),
        expInvolution(dt, on({ C: Z, R1: Z })),
        expInvolution(dt / 2, on({ R0: X })),
        expInvolution(dt / 2, on({ R1: X })),
      ].reduce((acc, u) => matmul(u, acc));
      let u = identity(DIM);
      for (let k = 0; k < TROTTER_STEPS; k++) u = matmul(step, u);
      return u;
    },
  },
  {
    glyph: '🝪',
    codepoint: 'U+1F76A',
    codexName: 'Metasignum Transcendentiae',
    codexFunction: 'Recursive glyph triggering',
    codexLayer: 'φ⁷ and above',
    operator:
      'Partial reflection I + (e^{−iθ} − 1)|s⟩⟨s| about the uniform response state |s⟩ (θ = π is a Grover diffusion): concentrates probability mass',
    defaultTheta: 1.9,
    build: (t) => {
      const proj = kron(identity(4), outer(UNIFORM_R));
      return add(identity(DIM), scale(proj, { re: Math.cos(t) - 1, im: -Math.sin(t) }));
    },
  },
];

// Defaults were found by a seeded random search for a run that exercises every
// stage: entropy falls along the chain, unsafe mass exceeds ε so the projector
// acts, and the final state collapses. They carry no meaning beyond that.
export const DEFAULT_THETAS = LAYERS.map((l) => l.defaultTheta);

// --- STATE PREPARATION (QuantumMetaPrompt, §4.2) ---

/** |Ψ(0)⟩ = |0⟩_P ⊗ |0⟩_C ⊗ |s⟩_R, with a neutral (uniform) response state. */
export const initialState = (): CMatrix => kron(kron(outer([[1, 0], [0, 0]]), outer([[1, 0], [0, 0]])), outer(UNIFORM_R));

// --- CHANNELS ---

/**
 * Independent dephasing of P, C and R in the computational basis with strength p:
 * each coherence ρ_ij is damped by (1 − p) for every subsystem on which i and j differ.
 */
export const dephase = (rho: CMatrix, p: number): CMatrix => {
  if (p === 0) return rho;
  const out = zeros(DIM);
  for (let i = 0; i < DIM; i++) {
    const ci = coords(i);
    for (let j = 0; j < DIM; j++) {
      const cj = coords(j);
      let f = 1;
      for (const s of SUBSYSTEMS) if (ci[s] !== cj[s]) f *= 1 - p;
      out.re[i * DIM + j] = rho.re[i * DIM + j] * f;
      out.im[i * DIM + j] = rho.im[i * DIM + j] * f;
    }
  }
  return out;
};

/** Reduced state Tr_{others}(ρ) on the given subsystems, kept in P, C, R order. */
export const partialTrace = (rho: CMatrix, keep: Subsystem[]): CMatrix => {
  const kept = SUBSYSTEMS.filter((s) => keep.includes(s));
  const traced = SUBSYSTEMS.filter((s) => !keep.includes(s));
  const n = kept.reduce((d, s) => d * DIM_OF[s], 1);
  const keptIndex = (c: Record<Subsystem, number>) => kept.reduce((acc, s) => acc * DIM_OF[s] + c[s], 0);
  const out = zeros(n);
  for (let i = 0; i < DIM; i++) {
    const ci = coords(i);
    for (let j = 0; j < DIM; j++) {
      const cj = coords(j);
      if (!traced.every((s) => ci[s] === cj[s])) continue;
      const k = keptIndex(ci) * n + keptIndex(cj);
      out.re[k] += rho.re[i * DIM + j];
      out.im[k] += rho.im[i * DIM + j];
    }
  }
  return out;
};

// --- GOVERNANCE (§4.4) ---

export type Mitigation = 'project' | 'fail-closed';

/** Ê_block: projector onto the disallowed response subspace. */
export const E_BLOCK: CMatrix = (() => {
  const e = zeros(DIM);
  for (let i = 0; i < DIM; i++) if (coords(i).R === UNSAFE_RESPONSE) e.re[i * DIM + i] = 1;
  return e;
})();

const E_ALLOW: CMatrix = add(identity(DIM), scale(E_BLOCK, -1));

export const unsafeMass = (rho: CMatrix): number => traceProduct(E_BLOCK, rho);

export interface GovernanceOutcome {
  pUnsafeBefore: number;
  triggered: boolean;
  /** True when the fail-closed policy refused to produce an answer. */
  refused: boolean;
  rho: CMatrix;
}

export const govern = (rho: CMatrix, epsilon: number, mitigation: Mitigation): GovernanceOutcome => {
  const pUnsafeBefore = unsafeMass(rho);
  if (pUnsafeBefore <= epsilon) return { pUnsafeBefore, triggered: false, refused: false, rho };
  const allowed = 1 - pUnsafeBefore;
  if (mitigation === 'fail-closed' || allowed < 1e-12) {
    return { pUnsafeBefore, triggered: true, refused: true, rho };
  }
  // Project into the allowed subspace and renormalise: Ê_allow ρ Ê_allow / Tr(Ê_allow ρ).
  return { pUnsafeBefore, triggered: true, refused: false, rho: scale(conjugate(E_ALLOW, rho), 1 / allowed) };
};

// --- METRICS (§5) ---

export interface MetricWeights {
  responseEntropy: number;
  mutualInfo: number;
  purity: number;
  unsafe: number;
}

export const DEFAULT_WEIGHTS: MetricWeights = { responseEntropy: 1, mutualInfo: 1, purity: 1, unsafe: 1 };

export interface StepMetrics {
  /** Born probabilities P(m) = ⟨m|ρ_R|m⟩ over the candidate responses. */
  responseProbs: number[];
  responseEntropy: number;
  confidence: number;
  argmax: number;
  /** S_ent(P) = −Tr(ρ_P log₂ ρ_P). */
  entropyP: number;
  /** I(C;R) = S(ρ_C) + S(ρ_R) − S(ρ_CR). */
  mutualInfo: number;
  /** γ = Tr(ρ²) of the full state. */
  purity: number;
  /** F = Tr(ρ_ideal ρ): overlap with the same pipeline run without decoherence. */
  fidelity: number;
  /** D_KL(p_current ‖ p_previous step), baseline smoothed by SURPRISE_SMOOTHING. */
  surprise: number;
  pUnsafe: number;
  /** 𝒥 = w₁H_R − w₂I(C;R) − w₃γ + w₄p_unsafe. */
  control: number;
}

export const SURPRISE_SMOOTHING = 1e-6;

const klDivergence = (p: number[], q: number[]): number => {
  const d = SURPRISE_SMOOTHING;
  return p.reduce((s, pi, k) => {
    if (pi < 1e-15) return s;
    const qk = (q[k] + d) / (1 + d * q.length);
    return s + pi * Math.log2(pi / qk);
  }, 0);
};

export const computeMetrics = (
  rho: CMatrix,
  rhoIdeal: CMatrix,
  previousProbs: number[] | null,
  weights: MetricWeights = DEFAULT_WEIGHTS,
): StepMetrics => {
  const rhoR = partialTrace(rho, ['R']);
  const responseProbs = Array.from({ length: 4 }, (_, k) => Math.max(0, rhoR.re[k * 4 + k]));
  const responseEntropy = shannonEntropy(responseProbs);
  const confidence = Math.max(...responseProbs);
  const entropyP = vonNeumannEntropy(partialTrace(rho, ['P']));
  const mutualInfo = Math.max(
    0,
    vonNeumannEntropy(partialTrace(rho, ['C'])) + vonNeumannEntropy(rhoR) - vonNeumannEntropy(partialTrace(rho, ['C', 'R'])),
  );
  const purity = traceProduct(rho, rho);
  const pUnsafe = unsafeMass(rho);
  return {
    responseProbs,
    responseEntropy,
    confidence,
    argmax: responseProbs.indexOf(confidence),
    entropyP,
    mutualInfo,
    purity,
    fidelity: traceProduct(rhoIdeal, rho),
    surprise: previousProbs ? klDivergence(responseProbs, previousProbs) : 0,
    pUnsafe,
    control:
      weights.responseEntropy * responseEntropy -
      weights.mutualInfo * mutualInfo -
      weights.purity * purity +
      weights.unsafe * pUnsafe,
  };
};

export const topBasisStates = (rho: CMatrix, count = 5): { label: string; probability: number }[] =>
  Array.from({ length: DIM }, (_, i) => ({ label: basisLabel(i), probability: rho.re[i * DIM + i] }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, count);

// --- CONTROL LOGIC (§4.7, §5.1) ---

/** Prototype thresholds; the paper leaves calibration to empirical tuning (§5.3). */
export const THRESHOLDS = {
  maxResponseEntropy: 1.0,
  minMutualInfo: 0.2,
  minPurity: 0.8,
  minConfidence: 0.6,
};

export interface ControlSignal {
  id: 'entropy' | 'binding' | 'coherence' | 'unsafe';
  condition: string;
  triggered: boolean;
  action: string;
}

export type Decision =
  | { kind: 'collapse'; response: number }
  | { kind: 'continue'; reasons: string[] }
  | { kind: 'refuse'; reason: string };

// --- PIPELINE ---

export interface PipelineParams {
  thetas: number[];
  /** Dephasing strength p applied after every layer (§2.6). */
  dephasing: number;
  /** Tolerance ε on p_unsafe. */
  epsilon: number;
  mitigation: Mitigation;
}

export const DEFAULT_PARAMS: PipelineParams = {
  thetas: DEFAULT_THETAS,
  dephasing: 0.01,
  epsilon: 0.05,
  mitigation: 'project',
};

export interface PipelineStep {
  kind: 'init' | 'layer' | 'governance';
  label: string;
  glyph: string | null;
  rho: CMatrix;
  metrics: StepMetrics;
}

export interface PipelineResult {
  steps: PipelineStep[];
  governance: GovernanceOutcome;
  /** Metrics of the chain output, before governance. */
  chainMetrics: StepMetrics;
  signals: ControlSignal[];
  decision: Decision;
}

export const runPipeline = (params: PipelineParams): PipelineResult => {
  const unitaries = LAYERS.map((layer, k) => layer.build(params.thetas[k] ?? 0));

  let rho = initialState();
  let ideal = rho;
  const steps: PipelineStep[] = [
    { kind: 'init', label: '|Ψ(0)⟩', glyph: null, rho, metrics: computeMetrics(rho, ideal, null) },
  ];

  unitaries.forEach((u, k) => {
    rho = dephase(conjugate(u, rho), params.dephasing);
    ideal = conjugate(u, ideal);
    const previous = steps[steps.length - 1].metrics.responseProbs;
    steps.push({
      kind: 'layer',
      label: `${LAYERS[k].glyph} ${LAYERS[k].codexName ?? LAYERS[k].codepoint}`,
      glyph: LAYERS[k].glyph,
      rho,
      metrics: computeMetrics(rho, ideal, previous),
    });
  });

  const chainMetrics = steps[steps.length - 1].metrics;
  const governance = govern(rho, params.epsilon, params.mitigation);
  const idealGoverned = govern(ideal, params.epsilon, params.mitigation).rho;
  steps.push({
    kind: 'governance',
    label: 'Ethical projector',
    glyph: null,
    rho: governance.rho,
    metrics: computeMetrics(governance.rho, idealGoverned, chainMetrics.responseProbs),
  });

  const final = steps[steps.length - 1].metrics;
  const fmt = (x: number) => x.toFixed(2);
  // The comparison shown always states the true relation to the threshold.
  const entropyHigh = final.responseEntropy > THRESHOLDS.maxResponseEntropy;
  const bindingLow = final.mutualInfo < THRESHOLDS.minMutualInfo;
  const coherenceLow = final.purity < THRESHOLDS.minPurity;
  const signals: ControlSignal[] = [
    {
      id: 'entropy',
      condition: `H_R = ${fmt(final.responseEntropy)} bits ${entropyHigh ? '>' : '≤'} ${THRESHOLDS.maxResponseEntropy}`,
      triggered: entropyHigh,
      action: 'Increase reasoning depth or tighten context relevance',
    },
    {
      id: 'binding',
      condition: `I(C;R) = ${fmt(final.mutualInfo)} bits ${bindingLow ? '<' : '≥'} ${THRESHOLDS.minMutualInfo}`,
      triggered: bindingLow,
      action: 'Revise retrieval or increase context-binding strength',
    },
    {
      id: 'coherence',
      condition: `γ = ${fmt(final.purity)} ${coherenceLow ? '<' : '≥'} ${THRESHOLDS.minPurity}`,
      triggered: coherenceLow,
      action: 'Reduce branching or refresh state integrity',
    },
    {
      id: 'unsafe',
      condition: `p_unsafe = ${governance.pUnsafeBefore.toFixed(3)} ${governance.triggered ? '>' : '≤'} ε = ${params.epsilon.toFixed(3)} (before governance)`,
      triggered: governance.triggered,
      action:
        params.mitigation === 'project'
          ? 'Mitigate: project into the allowed subspace'
          : 'Mitigate: fail closed and refuse to answer',
    },
  ];

  let decision: Decision;
  if (governance.refused) {
    decision = {
      kind: 'refuse',
      reason:
        params.mitigation === 'fail-closed'
          ? `p_unsafe exceeded ε under the fail-closed policy`
          : 'No allowed mass remains after projection',
    };
  } else {
    const reasons: string[] = [];
    if (final.confidence < THRESHOLDS.minConfidence)
      reasons.push(`confidence ${fmt(final.confidence)} < ${THRESHOLDS.minConfidence}`);
    if (final.mutualInfo < THRESHOLDS.minMutualInfo)
      reasons.push(`I(C;R) ${fmt(final.mutualInfo)} < ${THRESHOLDS.minMutualInfo}`);
    if (final.purity < THRESHOLDS.minPurity) reasons.push(`γ ${fmt(final.purity)} < ${THRESHOLDS.minPurity}`);
    if (final.pUnsafe > params.epsilon) reasons.push(`p_unsafe ${final.pUnsafe.toFixed(3)} > ε`);
    decision = reasons.length === 0 ? { kind: 'collapse', response: final.argmax } : { kind: 'continue', reasons };
  }

  return { steps, governance, chainMetrics, signals, decision };
};

/** Sanity helper for tests and debugging: Tr ρ. */
export const traceOf = (rho: CMatrix): number => trace(rho).re;
