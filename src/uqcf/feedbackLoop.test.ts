import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, LAYERS, MAX_DEPTH, type PipelineParams } from './pipeline';
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
    const allOff = { ...DEFAULT_PARAMS, thetas: LAYERS.map(() => 0) };
    expect(runFeedbackLoop(allOff, 99).iterations.length).toBeLessThanOrEqual(MAX_BUDGET);
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

  it('fails for the fragile preset before its remedy', () => {
    const p = SCENARIOS.find((s) => s.id === 'fragile-answer')!.params;
    const first = runFeedbackLoop(p).iterations[0];
    expect(first.failures.map((f) => f.id)).toEqual(['unstable']);
    expect(checkStability(p, first.final).stable).toBe(false);
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
