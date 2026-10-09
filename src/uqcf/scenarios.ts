// Preset parameter sets, each chosen to show one feedback-loop behaviour.
// They were found by seeded searches over the couplings; the tests in
// feedbackLoop.test.ts check that each one still behaves as described.

import { DEFAULT_PARAMS, type PipelineParams } from './pipeline';

export interface Scenario {
  id: string;
  name: string;
  /** What the feedback loop does from these parameters. */
  summary: string;
  params: PipelineParams;
}

const ONE_PASS_THETAS = [1.1, 2.2, 0.9, 2.1, 2.5, 0.6, 0.5, 1.9];

export const SCENARIOS: Scenario[] = [
  {
    id: 'one-pass-not-enough',
    name: 'One pass is not enough',
    summary: 'The first run leaves the answer diffuse; the loop adds a synthesis pass and converges.',
    params: DEFAULT_PARAMS,
  },
  {
    id: 'converges-in-one-pass',
    name: 'Converges in one pass',
    summary: 'Every criterion is met on the first run, so the loop stops at once.',
    params: { ...DEFAULT_PARAMS, thetas: ONE_PASS_THETAS },
  },
  {
    id: 'weak-binding',
    name: 'Weak context binding',
    summary: 'The context barely shapes the answer; the loop strengthens context binding (🝞).',
    params: { ...DEFAULT_PARAMS, thetas: [2.7, 1.6, 0.1, 1.2, 1.3, 1.1, 0.9, 0.8] },
  },
  {
    id: 'fragile-answer',
    name: 'Fragile answer',
    summary:
      'Confident but unstable under small perturbations; deepening backfires and is rolled back, then stronger answer shaping (🝪) fixes it.',
    params: { ...DEFAULT_PARAMS, thetas: [0.4, 1.1, 0.8, 2.7, 1, 0.3, 1.9, 3] },
  },
  {
    id: 'too-deep',
    name: 'Too deep for the noise',
    summary: 'Three synthesis passes lose too much coherence; the loop reduces branching until the answer holds.',
    params: { ...DEFAULT_PARAMS, thetas: ONE_PASS_THETAS, depth: 3, dephasing: 0.012 },
  },
  {
    id: 'too-noisy',
    name: 'Too noisy to recover',
    summary: 'Coherence is lost even at depth 1 and no remedy is left, so the loop abstains.',
    params: { ...DEFAULT_PARAMS, dephasing: 0.03 },
  },
  {
    id: 'fail-closed',
    name: 'Unsafe answer, fail closed',
    summary: 'Unsafe mass exceeds ε under the fail-closed policy, so the pipeline refuses.',
    params: { ...DEFAULT_PARAMS, mitigation: 'fail-closed' },
  },
];

export const sameParams = (a: PipelineParams, b: PipelineParams): boolean =>
  a.depth === b.depth &&
  a.dephasing === b.dephasing &&
  a.epsilon === b.epsilon &&
  a.mitigation === b.mitigation &&
  a.thetas.length === b.thetas.length &&
  a.thetas.every((t, i) => t === b.thetas[i]);

/** The scenario whose parameters match exactly, if any. */
export const matchScenario = (params: PipelineParams): Scenario | undefined =>
  SCENARIOS.find((s) => sameParams(s.params, params));
