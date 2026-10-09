import { describe, expect, it } from 'vitest';
import { adjoint, identity, kron, matmul, maxAbsDiff, outer } from './linalg';
import {
  DEFAULT_PARAMS,
  DIM,
  LAYERS,
  UNSAFE_RESPONSE,
  computeMetrics,
  dephase,
  govern,
  initialState,
  partialTrace,
  runPipeline,
  traceOf,
} from './pipeline';

const ket0 = outer([[1, 0], [0, 0]]);

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

  it('loses purity and fidelity under dephasing', () => {
    const final = runPipeline(DEFAULT_PARAMS).steps.at(-1)!.metrics;
    expect(final.purity).toBeLessThan(1);
    expect(final.fidelity).toBeLessThan(1);
  });

  it('is a no-op on the response when every layer is off', () => {
    const r = runPipeline({ ...DEFAULT_PARAMS, thetas: LAYERS.map(() => 0), dephasing: 0 });
    expect(maxAbsDiff(r.steps[LAYERS.length].rho, initialState())).toBeLessThan(1e-12);
  });

  it('defaults exercise governance and end in a collapse', () => {
    const r = runPipeline(DEFAULT_PARAMS);
    expect(r.governance.pUnsafeBefore).toBeGreaterThan(DEFAULT_PARAMS.epsilon);
    expect(r.signals.find((s) => s.id === 'unsafe')?.triggered).toBe(true);
    expect(r.decision.kind).toBe('collapse');
  });

  it('states the true comparison in every control signal', () => {
    for (const s of runPipeline(DEFAULT_PARAMS).signals) {
      const op = s.condition.match(/[<>≤≥]/)?.[0];
      expect(['<', '>'].includes(op!), s.id).toBe(s.triggered);
    }
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
