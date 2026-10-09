import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, LAYERS, MAX_DEPTH, runPipeline, type PipelineParams } from './pipeline';
import {
  MAX_BUDGET,
  MAX_DRIFT,
  REMEDIES,
  REMEDIES_FOR,
  checkStability,
  runFeedbackLoop,
  type LoopResult,
} from './feedbackLoop';
import { SCENARIOS, matchScenario } from './scenarios';

/** Compact trace of the remedies tried: "deepen:ok tune-shaping:rb". */
const trace = (r: LoopResult) =>
  r.iterations
    .slice(1)
    .map((i) => `${i.adjustment?.remedy}:${i.status === 'accepted' ? 'ok' : 'rb'}`)
    .join(' ');

describe('scenarios', () => {
  // Each preset's summary in scenarios.ts must stay true.
  const expected: Record<string, { outcome: string; trace: string; response?: number }> = {
    'one-pass-not-enough': { outcome: 'collapse', trace: 'deepen:ok', response: 2 },
    'converges-in-one-pass': { outcome: 'collapse', trace: '', response: 0 },
    'weak-binding': { outcome: 'collapse', trace: 'bind-context:ok', response: 2 },
    'fragile-answer': { outcome: 'collapse', trace: 'deepen:rb tune-shaping:ok', response: 0 },
    'too-deep': { outcome: 'collapse', trace: 'reduce-depth:ok reduce-depth:ok', response: 0 },
    'too-noisy': { outcome: 'abstain', trace: '' },
    'fail-closed': { outcome: 'refuse', trace: '' },
  };

  it('covers every preset', () => {
    expect(SCENARIOS.map((s) => s.id).sort()).toEqual(Object.keys(expected).sort());
  });

  for (const scenario of SCENARIOS) {
    it(`"${scenario.name}" behaves as described`, () => {
      const r = runFeedbackLoop(scenario.params);
      const want = expected[scenario.id];
      expect(r.outcome.kind).toBe(want.outcome);
      expect(trace(r)).toBe(want.trace);
      if (r.outcome.kind === 'collapse') expect(r.outcome.response).toBe(want.response);
    });
  }

  it('starts the first run of the default scenario with a diffuse answer and an active projector', () => {
    const [first] = runFeedbackLoop(DEFAULT_PARAMS).iterations;
    expect(first.failures.map((f) => f.id)).toEqual(['diffuse']);
    expect(first.result.governance.triggered).toBe(true);
  });

  it('abstains as non-recoverable when coherence is lost at depth 1', () => {
    const r = runFeedbackLoop(SCENARIOS.find((s) => s.id === 'too-noisy')!.params);
    expect(r.outcome).toMatchObject({ kind: 'abstain', cause: 'non-recoverable' });
    expect(r.iterations[0].failures[0].id).toBe('coherence');
  });

  it('matches presets by value', () => {
    expect(matchScenario({ ...DEFAULT_PARAMS })?.id).toBe('one-pass-not-enough');
    expect(matchScenario({ ...DEFAULT_PARAMS, epsilon: 0.06 })).toBeUndefined();
  });
});

describe('budget', () => {
  it('abstains when the budget is spent before convergence', () => {
    const r = runFeedbackLoop(DEFAULT_PARAMS, 1);
    expect(r.iterations).toHaveLength(1);
    expect(r.outcome).toMatchObject({ kind: 'abstain', cause: 'budget' });
    expect(r.finalParams).toEqual(DEFAULT_PARAMS);
  });

  it('clamps the budget to 1…MAX_BUDGET', () => {
    expect(runFeedbackLoop(DEFAULT_PARAMS, 0).iterations).toHaveLength(1);
    // This configuration still has failures and remedies after MAX_BUDGET runs.
    const long = { ...DEFAULT_PARAMS, thetas: [0.34, 0.22, 0.12, 3, 0.52, 1.29, 0.23, 1.26], depth: 3 };
    const r = runFeedbackLoop(long, 99);
    expect(r.iterations).toHaveLength(MAX_BUDGET);
    expect(r.outcome).toMatchObject({ kind: 'abstain', cause: 'budget', reason: expect.stringMatching(/^Budget of 10 runs spent/) });
  });
});

describe('stability', () => {
  it('passes for a converged answer and reports both probes', () => {
    const r = runFeedbackLoop(SCENARIOS.find((s) => s.id === 'converges-in-one-pass')!.params);
    const s = r.iterations[0].stability!;
    expect(s.stable).toBe(true);
    expect(s.probes.map((p) => p.scale)).toEqual([0.95, 1.05]);
    s.probes.forEach((p) => expect(p.drift).toBeLessThanOrEqual(MAX_DRIFT));
  });

  it('fails for the fragile preset before its remedy, and says why without rounding it away', () => {
    const p = SCENARIOS.find((s) => s.id === 'fragile-answer')!.params;
    const first = runFeedbackLoop(p).iterations[0];
    expect(first.failures.map((f) => f.id)).toEqual(['unstable']);
    expect(checkStability(p, first.final).stable).toBe(false);
    // The drift is 0.104: "drift 0.10" against a limit of 0.1 would read as a pass.
    expect(first.failures[0].reason).toMatch(/drift 0\.104\)/);
  });

  it('scales every coupling, including those at or near π', () => {
    const p: PipelineParams = { ...DEFAULT_PARAMS, thetas: [2.33, 1.53, 3.02, 3, 0.33, 1.67, 3.02, 2.09], dephasing: 0.004 };
    const reference = runPipeline(p).steps.at(-1)!.metrics;
    const check = checkStability(p, reference);
    for (const probe of check.probes) {
      const scaled = runPipeline({ ...p, thetas: p.thetas.map((t) => t * probe.scale) }).steps.at(-1)!.metrics;
      const drift = 0.5 * scaled.responseProbs.reduce((s, x, k) => s + Math.abs(x - reference.responseProbs[k]), 0);
      expect(probe.drift).toBeCloseTo(drift, 12);
    }
    // A true ×1.05 drifts 0.111 here; capping θ at π used to hide that.
    expect(check.stable).toBe(false);
  });

  it('requires the same answer, not only a small drift', () => {
    const p = SCENARIOS.find((s) => s.id === 'converges-in-one-pass')!.params;
    const reference = runPipeline(p).steps.at(-1)!.metrics;
    const check = checkStability(p, { ...reference, argmax: (reference.argmax + 1) % 4 });
    check.probes.forEach((probe) => expect(probe.drift).toBeLessThanOrEqual(MAX_DRIFT));
    expect(check.stable).toBe(false);
  });
});

describe('loop invariants', () => {
  // Seeded random configurations, so failures are reproducible.
  let seed = 4242;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const configs: PipelineParams[] = Array.from({ length: 40 }, () => ({
    ...DEFAULT_PARAMS,
    thetas: LAYERS.map(() => Math.round(rand() * 31) / 10),
    depth: 1 + Math.floor(rand() * MAX_DEPTH),
    dephasing: Math.round(rand() * 30) / 1000,
    mitigation: rand() < 0.2 ? 'fail-closed' : 'project',
  }));

  it('hold for every configuration', () => {
    for (const config of configs) {
      const r = runFeedbackLoop(config, 8);
      expect(r.iterations.length).toBeLessThanOrEqual(8);
      expect(r.iterations[0].adjustment).toBeNull();
      expect(r.iterations[0].status).toBe('accepted');

      let bestJ = Infinity;
      const blocked = new Set<string>();
      let lastAccepted = r.iterations[0];
      for (const it of r.iterations) {
        if (it.adjustment) {
          // Remedies come from the list for the failure they answer, and never after a rollback.
          expect(REMEDIES_FOR[it.adjustment.failure]).toContain(it.adjustment.remedy);
          expect(blocked.has(it.adjustment.remedy)).toBe(false);
        }
        if (it.status === 'accepted') {
          // Accepted runs strictly improve J, except a terminal refusal.
          if (it.index > 1 && r.outcome.kind !== 'refuse') expect(it.control).toBeLessThan(bestJ);
          bestJ = Math.min(bestJ, it.control);
          lastAccepted = it;
        } else {
          expect(it.control).toBeGreaterThanOrEqual(bestJ - 1e-6);
          blocked.add(it.adjustment!.remedy);
        }
      }
      expect(r.finalParams).toEqual(lastAccepted.params);

      const last = r.iterations[r.iterations.length - 1];
      if (r.outcome.kind === 'collapse') {
        expect(last.status).toBe('accepted');
        expect(last.failures).toEqual([]);
        expect(last.stability?.stable).toBe(true);
        expect(r.outcome.response).toBe(last.final.argmax);
      }
      if (r.outcome.kind === 'refuse') expect(last.result.governance.refused).toBe(true);
    }
  });

  it('only offers remedies that change something', () => {
    for (const config of configs) {
      for (const [id, remedy] of Object.entries(REMEDIES)) {
        if (!remedy.applicable(config)) continue;
        expect(remedy.apply(config), id).not.toEqual(config);
      }
    }
  });
});

describe('remedies', () => {
  const RETRIEVE = LAYERS.findIndex((l) => l.glyph === '🜄');
  // 🜄 hands the prompt to the context with strength sin²θ.
  const transfer = (p: PipelineParams) => Math.sin(p.thetas[RETRIEVE]) ** 2;

  it('revise-retrieval always strengthens the prompt–context update, within the sliders\' range', () => {
    const remedy = REMEDIES['revise-retrieval'];
    const grid = [...Array.from({ length: 63 }, (_, i) => i * 0.05), Math.PI];
    for (const t of grid) {
      const p = { ...DEFAULT_PARAMS, thetas: DEFAULT_PARAMS.thetas.map((x, i) => (i === RETRIEVE ? t : x)) };
      if (!remedy.applicable(p)) continue;
      const next = remedy.apply(p);
      expect(transfer(next), `θ = ${t.toFixed(2)}`).toBeGreaterThan(transfer(p));
      expect(next.thetas[RETRIEVE]).toBeGreaterThanOrEqual(0);
      expect(next.thetas[RETRIEVE]).toBeLessThanOrEqual(Math.PI);
    }
    const atPeak = { ...DEFAULT_PARAMS, thetas: DEFAULT_PARAMS.thetas.map((x, i) => (i === RETRIEVE ? Math.PI / 2 : x)) };
    expect(remedy.applicable(atPeak)).toBe(false);
  });

  it('step the depth the pipeline actually runs', () => {
    // Depth 0 runs one pass; it must not be "deepened" to 1, which changes nothing.
    const low = runFeedbackLoop({ ...DEFAULT_PARAMS, depth: 0 });
    expect(low.iterations[0].params.depth).toBe(1);
    expect(trace(low)).toBe(trace(runFeedbackLoop(DEFAULT_PARAMS)));
    const high = runFeedbackLoop({ ...DEFAULT_PARAMS, depth: 7 });
    expect(high.iterations[0].params.depth).toBe(MAX_DEPTH);
  });
});
