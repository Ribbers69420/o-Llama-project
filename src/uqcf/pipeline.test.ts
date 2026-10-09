import { describe, expect, it } from 'vitest';
import { adjoint, identity, kron, matmul, maxAbsDiff, outer, traceProduct } from './linalg';
import {
  DEFAULT_PARAMS,
  DIM,
  LAYERS,
  MAX_DEPTH,
  SURPRISE_SMOOTHING,
  SYNTHESIS_START,
  THRESHOLDS,
  UNSAFE_RESPONSE,
  computeMetrics,
  dephase,
  failedCriteria,
  formatVs,
  govern,
  initialState,
  layerSchedule,
  partialTrace,
  runPipeline,
  traceOf,
  type PipelineParams,
} from './pipeline';

const ket0 = outer([[1, 0], [0, 0]]);

/** Seeded configurations on the UI's slider grid, so failures are reproducible. */
const sliderConfigs: PipelineParams[] = (() => {
  let seed = 2026;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  return Array.from({ length: 300 }, () => ({
    ...DEFAULT_PARAMS,
    thetas: LAYERS.map(() => Math.round(rand() * 314) / 100),
    depth: 1 + Math.floor(rand() * MAX_DEPTH),
    dephasing: Math.round(rand() * 30) / 1000,
    epsilon: Math.round(rand() * 20) / 100,
  }));
})();

describe('glyph-chain layers', () => {
  it('are unitary for any coupling and the identity at θ = 0', () => {
    for (const layer of LAYERS) {
      for (const theta of [0.37, 1.9, -2.5]) {
        const u = layer.build(theta);
        expect(maxAbsDiff(matmul(adjoint(u), u), identity(DIM)), layer.glyph).toBeLessThan(1e-12);
      }
      expect(maxAbsDiff(layer.build(0), identity(DIM)), layer.glyph).toBeLessThan(1e-12);
    }
  });
});

describe('metrics', () => {
  it('start from a product state with uniform response uncertainty', () => {
    const rho = initialState();
    const m = computeMetrics(rho, rho, null);
    expect(traceOf(rho)).toBeCloseTo(1, 12);
    expect(m.responseProbs).toEqual([0.25, 0.25, 0.25, 0.25].map((p) => expect.closeTo(p, 12)));
    expect(m.responseEntropy).toBeCloseTo(2, 12);
    expect(m.entropyP).toBeCloseTo(0, 10);
    expect(m.mutualInfo).toBeCloseTo(0, 10);
    expect(m.purity).toBeCloseTo(1, 12);
    expect(m.fidelity).toBeCloseTo(1, 12);
    expect(m.pUnsafe).toBeCloseTo(0.25, 12);
  });

  it('give I(C;R) = 2 bits for a maximally entangled context–response pair', () => {
    // |0⟩_P ⊗ (|0⟩_C|r₀⟩ + |1⟩_C|r₁⟩)/√2
    const s = Math.SQRT1_2;
    const cr = outer([[s, 0], [0, 0], [0, 0], [0, 0], [0, 0], [s, 0], [0, 0], [0, 0]]);
    const rho = kron(ket0, cr);
    const m = computeMetrics(rho, rho, null);
    expect(m.mutualInfo).toBeCloseTo(2, 10);
    expect(m.entropyP).toBeCloseTo(0, 10);
    expect(m.responseEntropy).toBeCloseTo(1, 12);
  });

  it('reduce the full state consistently', () => {
    const rho = runPipeline(DEFAULT_PARAMS).steps[5].rho;
    expect(traceOf(partialTrace(rho, ['P']))).toBeCloseTo(1, 12);
    expect(traceOf(partialTrace(rho, ['C', 'R']))).toBeCloseTo(1, 12);
  });
});

describe('dephasing', () => {
  it('removes every coherence at p = 1 and keeps populations', () => {
    const rho = runPipeline({ ...DEFAULT_PARAMS, dephasing: 0 }).steps[6].rho;
    const d = dephase(rho, 1);
    for (let i = 0; i < DIM; i++) {
      for (let j = 0; j < DIM; j++) {
        if (i === j) expect(d.re[i * DIM + i]).toBeCloseTo(rho.re[i * DIM + i], 14);
        else expect(Math.hypot(d.re[i * DIM + j], d.im[i * DIM + j])).toBe(0);
      }
    }
  });
});

describe('governance', () => {
  const rho = initialState(); // p_unsafe = 0.25

  it('passes states within tolerance unchanged', () => {
    const g = govern(rho, 0.3, 'project');
    expect(g.triggered).toBe(false);
    expect(g.rho).toBe(rho);
  });

  it('projects into the allowed subspace and renormalises', () => {
    const g = govern(rho, 0.05, 'project');
    expect(g.triggered && !g.refused).toBe(true);
    expect(traceOf(g.rho)).toBeCloseTo(1, 12);
    const m = computeMetrics(g.rho, g.rho, null);
    expect(m.pUnsafe).toBeCloseTo(0, 12);
    expect(m.responseProbs[UNSAFE_RESPONSE]).toBeCloseTo(0, 12);
    expect(m.responseProbs[0]).toBeCloseTo(1 / 3, 12);
  });

  it('refuses under the fail-closed policy', () => {
    const g = govern(rho, 0.05, 'fail-closed');
    expect(g.refused).toBe(true);
    expect(g.rho).toBe(rho);
  });

  it('refuses when no allowed mass remains', () => {
    const blocked = kron(kron(ket0, ket0), outer([[0, 0], [0, 0], [0, 0], [1, 0]]));
    expect(govern(blocked, 0.05, 'project').refused).toBe(true);
  });
});

describe('runPipeline', () => {
  it('preserves trace at every step and keeps a pure state pure without noise', () => {
    const r = runPipeline({ ...DEFAULT_PARAMS, dephasing: 0 });
    expect(r.steps).toHaveLength(LAYERS.length + 2);
    for (const step of r.steps) {
      expect(traceOf(step.rho)).toBeCloseTo(1, 10);
      expect(step.metrics.purity).toBeCloseTo(1, 10);
      expect(step.metrics.fidelity).toBeCloseTo(1, 10);
    }
  });

  it('repeats only the synthesis layers ⦾ 🜿 🝏 🝪 for each extra pass', () => {
    const synthesis = LAYERS.length - SYNTHESIS_START;
    for (const depth of [1, 2, 3]) {
      const r = runPipeline({ ...DEFAULT_PARAMS, depth });
      expect(r.steps).toHaveLength(LAYERS.length + 2 + (depth - 1) * synthesis);
      const passes = r.steps.filter((s) => s.layer === SYNTHESIS_START).map((s) => s.pass);
      expect(passes).toEqual(Array.from({ length: depth }, (_, i) => i + 1));
    }
    // Out-of-range depths are clamped.
    expect(layerSchedule(0)).toHaveLength(LAYERS.length);
    expect(layerSchedule(9)).toHaveLength(LAYERS.length + (MAX_DEPTH - 1) * synthesis);
  });

  it('stays the identity at any depth when every layer is off', () => {
    const r = runPipeline({ ...DEFAULT_PARAMS, thetas: LAYERS.map(() => 0), dephasing: 0, depth: MAX_DEPTH });
    expect(maxAbsDiff(r.steps[r.steps.length - 2].rho, initialState())).toBeLessThan(1e-12);
  });

  it('loses purity and fidelity under dephasing', () => {
    const final = runPipeline(DEFAULT_PARAMS).steps.at(-1)!.metrics;
    expect(final.purity).toBeLessThan(1);
    expect(final.fidelity).toBeLessThan(1);
  });

  it('is a no-op on the response when every layer is off', () => {
    const r = runPipeline({ ...DEFAULT_PARAMS, thetas: LAYERS.map(() => 0), dephasing: 0 });
    expect(maxAbsDiff(r.steps[LAYERS.length].rho, initialState())).toBeLessThan(1e-12);
  });

  it('defaults exercise governance and leave the answer diffuse after one pass', () => {
    const r = runPipeline(DEFAULT_PARAMS);
    expect(r.governance.pUnsafeBefore).toBeGreaterThan(DEFAULT_PARAMS.epsilon);
    expect(r.signals.find((s) => s.id === 'unsafe')?.triggered).toBe(true);
    expect(r.decision).toMatchObject({ kind: 'continue', reasons: [expect.stringMatching(/^confidence/)] });
  });

  it('collapses in one pass from the one-pass couplings', () => {
    const r = runPipeline({ ...DEFAULT_PARAMS, thetas: [1.1, 2.2, 0.9, 2.1, 2.5, 0.6, 0.5, 1.9] });
    expect(r.decision).toEqual({ kind: 'collapse', response: 0 });
  });

  it('triggers each control signal exactly when its metric crosses the threshold', () => {
    for (const p of sliderConfigs) {
      const r = runPipeline(p);
      const m = r.steps.at(-1)!.metrics;
      const signal = (id: string) => r.signals.find((s) => s.id === id)!.triggered;
      expect(signal('entropy')).toBe(m.responseEntropy > THRESHOLDS.maxResponseEntropy);
      expect(signal('binding')).toBe(m.mutualInfo < THRESHOLDS.minMutualInfo);
      expect(signal('coherence')).toBe(m.purity < THRESHOLDS.minPurity);
      expect(signal('unsafe')).toBe(r.governance.pUnsafeBefore > p.epsilon);
    }
  });

  it('never shows a comparison that its own rounded numbers contradict', () => {
    // "0.20 bits < 0.2" or "drift 0.10, limit 0.1" would contradict the verdict.
    const holds = (a: number, op: string, b: number) =>
      ({ '<': a < b, '>': a > b, '≤': a <= b, '≥': a >= b })[op as '<' | '>' | '≤' | '≥'];
    const comparisons = /(-?\d+\.?\d*)(?: bits)? ([<>≤≥]) (?:ε = )?(-?\d+\.?\d*)/g;
    let checked = 0;
    for (const p of sliderConfigs) {
      const r = runPipeline(p);
      const texts = [...r.signals.map((s) => s.condition), ...failedCriteria(r.steps.at(-1)!.metrics, p.epsilon).map((f) => f.reason)];
      for (const text of texts) {
        for (const [, a, op, b] of text.matchAll(comparisons)) {
          expect(holds(Number(a), op, Number(b)), text).toBe(true);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('shows enough digits near a threshold', () => {
    // Defaults with θ(🜂) = 2.88 put I(C;R) just under 0.2.
    const r = runPipeline({ ...DEFAULT_PARAMS, thetas: DEFAULT_PARAMS.thetas.map((t, i) => (i === 0 ? 2.88 : t)) });
    const binding = r.signals.find((s) => s.id === 'binding')!;
    expect(binding.triggered).toBe(true);
    expect(binding.condition).not.toMatch(/0\.20 bits </);
  });

  it('refuses with the fail-closed policy when p_unsafe exceeds ε', () => {
    const r = runPipeline({ ...DEFAULT_PARAMS, mitigation: 'fail-closed' });
    expect(r.decision.kind).toBe('refuse');
  });

  it('asks for another iteration when the answer is not concentrated', () => {
    const r = runPipeline({ ...DEFAULT_PARAMS, thetas: LAYERS.map(() => 0), epsilon: 0.3 });
    expect(r.decision).toMatchObject({ kind: 'continue' });
  });
});

describe('formatVs', () => {
  it('adds digits only when rounding would land on the wrong side of the threshold', () => {
    expect(formatVs(0.5, 0.2)).toBe('0.50');
    expect(formatVs(0.104, 0.1)).toBe('0.104');
    expect(formatVs(0.1996, 0.2)).toBe('0.1996');
    expect(formatVs(0.7996, 0.8, 3)).toBe('0.7996');
    expect(formatVs(0.2, 0.2)).toBe('0.20');
  });
});

describe('metric definitions (§5)', () => {
  const noisy = runPipeline({ ...DEFAULT_PARAMS, depth: 2 });
  const ideal = runPipeline({ ...DEFAULT_PARAMS, depth: 2, dephasing: 0 });

  it('J = H_R − I(C;R) − γ + p_unsafe at every step', () => {
    for (const { metrics: m } of noisy.steps) {
      expect(m.control).toBeCloseTo(m.responseEntropy - m.mutualInfo - m.purity + m.pUnsafe, 12);
    }
  });

  it('F = Tr(ρ_ideal ρ) against the same run without dephasing', () => {
    noisy.steps.forEach((step, i) => {
      expect(step.metrics.fidelity).toBeCloseTo(traceProduct(ideal.steps[i].rho, step.rho), 12);
    });
    // Without noise the run is its own ideal: F = γ = 1 throughout.
    ideal.steps.forEach((step) => expect(step.metrics.fidelity).toBeCloseTo(1, 10));
  });

  it('D_KL(p_current ‖ p_previous) with a smoothed baseline, 0 for the initial state', () => {
    expect(noisy.steps[0].metrics.surprise).toBe(0);
    const d = SURPRISE_SMOOTHING;
    const kl = (p: number[], q: number[]) =>
      p.reduce((s, pi, k) => (pi < 1e-15 ? s : s + pi * Math.log2(pi / ((q[k] + d) / (1 + d * q.length)))), 0);
    for (let i = 1; i < noisy.steps.length; i++) {
      const p = noisy.steps[i].metrics.responseProbs;
      const q = noisy.steps[i - 1].metrics.responseProbs;
      expect(noisy.steps[i].metrics.surprise).toBeCloseTo(kl(p, q), 10);
    }
    // The direction matters: some steps give a different D_KL the other way round.
    const asymmetric = noisy.steps.slice(1).some((s, i) => {
      const p = s.metrics.responseProbs;
      const q = noisy.steps[i].metrics.responseProbs;
      return Math.abs(kl(p, q) - kl(q, p)) > 1e-3;
    });
    expect(asymmetric).toBe(true);
  });

  it('D_KL of a certain answer against a uniform baseline is 2 bits', () => {
    const certain = kron(kron(ket0, ket0), outer([[1, 0], [0, 0], [0, 0], [0, 0]]));
    expect(computeMetrics(certain, certain, [0.25, 0.25, 0.25, 0.25]).surprise).toBeCloseTo(2, 4);
  });
});
