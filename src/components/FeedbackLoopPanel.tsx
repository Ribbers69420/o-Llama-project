import React, { useState } from 'react';
import { Ban, Check, CheckCircle2, CircleSlash, CornerLeftUp, Hourglass, Repeat, Undo2 } from 'lucide-react';
import { RESPONSE_LABELS, THRESHOLDS } from '../uqcf/pipeline';
import {
  MAX_BUDGET,
  MAX_DRIFT,
  PERTURBATION,
  THETA_STEP,
  type LoopIteration,
  type LoopResult,
} from '../uqcf/feedbackLoop';
import { MetricMultiple } from './PipelineCharts';
import { Panel, Slider, StatusBanner } from './pipelineUi';
import { VIZ } from './vizTokens';

// --- OUTCOME ---

const OutcomeBanner: React.FC<{ loop: LoopResult }> = ({ loop }) => {
  const o = loop.outcome;
  const n = loop.iterations.length;
  const runs = `${n} run${n === 1 ? '' : 's'}`;
  if (o.kind === 'collapse') {
    return (
      <StatusBanner
        color={VIZ.good}
        icon={<CheckCircle2 size={20} />}
        title={`Converged after ${runs} → ${RESPONSE_LABELS[o.response]} (P = ${o.confidence.toFixed(2)})`}
        body={`Every termination criterion is met and the answer holds when all couplings change by ±${PERTURBATION * 100}% (§4.7).`}
      />
    );
  }
  if (o.kind === 'refuse') {
    return (
      <StatusBanner
        color={VIZ.critical}
        icon={<Ban size={20} />}
        title={`Refused on run ${n} (fail closed)`}
        body={`${o.reason} (§4.4). A refusal ends the loop: the loop never optimises around governance.`}
      />
    );
  }
  return o.cause === 'budget' ? (
    <StatusBanner
      color={VIZ.warning}
      icon={<Hourglass size={20} />}
      title={`Abstained: budget spent after ${runs}`}
      body={`${o.reason}. Abstaining is a legitimate outcome, preferable to an overconfident answer (§2.2, §4.7).`}
    />
  ) : (
    <StatusBanner
      color={VIZ.warning}
      icon={<CircleSlash size={20} />}
      title="Abstained: failure is not recoverable (§4.6)"
      body={`${o.reason}. Fixing a lower-priority criterion cannot repair it, so the loop stops instead of guessing.`}
    />
  );
};

// --- ONE RUN ---

const fmt = (x: number, digits = 2) => x.toFixed(digits);

const RunCard: React.FC<{ run: LoopIteration; bestBefore: number | null; isLast: boolean; highlighted: boolean }> = ({
  run,
  bestBefore,
  isLast,
  highlighted,
}) => {
  const m = run.final;
  const rolledBack = run.status === 'rolled-back';
  return (
    <li
      className={`rounded-lg border p-3 ${highlighted ? 'border-indigo-500 bg-indigo-900/20' : 'border-slate-800 bg-slate-900'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-slate-200">
          Run {run.index}
          <span className="font-normal text-slate-400">
            {' · '}
            {run.adjustment ? run.adjustment.label : 'initial configuration'}
          </span>
        </div>
        {rolledBack ? (
          <span className="flex items-center gap-1 text-[11px] text-slate-300">
            <Undo2 size={13} style={{ color: VIZ.warning }} /> rolled back
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <Check size={13} /> {isLast ? 'final' : 'kept'}
          </span>
        )}
      </div>
      {run.adjustment && (
        <p className="text-[11px] text-slate-400 mt-1">
          Because {run.adjustment.trigger}: <span className="font-mono text-slate-300">{run.adjustment.change}</span>{' '}
          <span className="text-slate-500">({run.adjustment.section})</span>
        </p>
      )}
      <div className="mt-2 font-mono text-[11px] text-slate-400 flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
        <span>
          {RESPONSE_LABELS[m.argmax]} {fmt(m.confidence)}
        </span>
        <span>H_R {fmt(m.responseEntropy)}</span>
        <span>I(C;R) {fmt(m.mutualInfo)}</span>
        <span>γ {fmt(m.purity, 3)}</span>
        <span>J {fmt(run.control, 3)}</span>
        <span>depth {run.params.depth}</span>
      </div>
      {rolledBack && bestBefore !== null && (
        <p className="text-[11px] text-slate-500 mt-1">
          J went from {fmt(bestBefore, 3)} to {fmt(run.control, 3)} instead of falling, so this change was undone and the remedy is
          not tried again (§4.1).
        </p>
      )}
      {!rolledBack && run.failures.length > 0 && (
        <p className="text-[11px] text-slate-500 mt-1">Still failing: {run.failures.map((f) => f.reason).join('; ')}</p>
      )}
      {run.stability && (
        <p className="text-[11px] text-slate-500 mt-1">
          Stability check: {run.stability.stable ? 'same answer' : 'answer changed or drifted'} with couplings ×
          {run.stability.probes.map((p) => p.scale.toFixed(2)).join(' and ×')} (largest drift{' '}
          {fmt(Math.max(...run.stability.probes.map((p) => p.drift)))}, limit {MAX_DRIFT}).
        </p>
      )}
    </li>
  );
};

// --- PANEL ---

/** Best accepted J before each run, used to explain rollbacks. */
const bestJBefore = (runs: LoopIteration[]): (number | null)[] => {
  const out: (number | null)[] = [];
  let best: number | null = null;
  for (const r of runs) {
    out.push(best);
    if (r.status === 'accepted') best = best === null ? r.control : Math.min(best, r.control);
  }
  return out;
};

const LOOP_METRICS = [
  { key: 'confidence', symbol: 'max_k p_k', label: 'Confidence', unit: '', digits: 2, domain: [0, 1], threshold: { value: THRESHOLDS.minConfidence, label: 'min' } },
  { key: 'mutualInfo', symbol: 'I(C;R)', label: 'Context–response information', unit: 'bits', digits: 2, domain: [0, 2], threshold: { value: THRESHOLDS.minMutualInfo, label: 'min' } },
  { key: 'purity', symbol: 'γ', label: 'Purity', unit: '', digits: 3, domain: [0, 1], threshold: { value: THRESHOLDS.minPurity, label: 'min' } },
] as const;

const FeedbackLoopPanel: React.FC<{
  loop: LoopResult;
  /** True while a newer loop result is being computed. */
  stale: boolean;
  budget: number;
  onBudgetChange: (budget: number) => void;
  /** False when the view above already shows the final configuration. */
  canLoad: boolean;
  onLoad: () => void;
}> = ({ loop, stale, budget, onBudgetChange, canLoad, onLoad }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const runs = loop.iterations;
  const labels = runs.map((r) => String(r.index));
  const last = runs.length - 1;

  const bestBefore = bestJBefore(runs);
  const jValues = runs.map((r) => r.control);
  const jDomain: [number, number] = [
    Math.min(-1, Math.floor(Math.min(...jValues))),
    Math.max(1, Math.ceil(Math.max(...jValues))),
  ];

  return (
    <Panel
      title="Feedback loop (§4.5)"
      icon={<Repeat size={16} />}
      aside={
        <button
          type="button"
          disabled={!canLoad}
          onClick={onLoad}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800 disabled:cursor-not-allowed rounded border border-slate-700 text-slate-300 transition-colors"
        >
          <CornerLeftUp size={12} />
          {canLoad ? 'Show the final configuration above' : 'Final configuration shown above'}
        </button>
      }
    >
      <div className={`space-y-4 transition-opacity ${stale ? 'opacity-60' : ''}`} aria-busy={stale}>
        <p className="text-xs text-slate-400">
          Starting from the parameters above, the loop runs the whole pipeline, checks the termination criteria (§4.7) and,
          while one fails, applies the remedy §5.1 names for the most fundamental failure (coherence, then context binding,
          then response confidence or stability). A change is kept only if the control functional J falls; otherwise it is
          rolled back and that remedy is not tried again. Each run counts against the budget.
        </p>
        <div className="max-w-xs">
          <Slider
            label="Budget: maximum runs (§4.7)"
            ariaLabel="Feedback loop budget in runs"
            value={budget}
            min={1}
            max={MAX_BUDGET}
            step={1}
            digits={0}
            onChange={onBudgetChange}
          />
        </div>

        <OutcomeBanner loop={loop} />

        <ol className="space-y-2">
          {runs.map((run, i) => (
            <RunCard key={run.index} run={run} bestBefore={bestBefore[i]} isLast={i === last} highlighted={hovered === i} />
          ))}
        </ol>

        {runs.length > 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {LOOP_METRICS.map((def) => (
              <MetricMultiple
                key={def.key}
                symbol={def.symbol}
                label={`${def.label} per run`}
                unit={def.unit}
                values={runs.map((r) => r.final[def.key])}
                stepGlyphs={labels}
                domain={[def.domain[0], def.domain[1]]}
                digits={def.digits}
                threshold={def.threshold}
                selected={last}
                hovered={hovered}
                onHover={setHovered}
                focusPrefix="run"
              />
            ))}
            <MetricMultiple
              symbol="J"
              label="Control functional per run"
              unit=""
              values={jValues}
              stepGlyphs={labels}
              domain={jDomain}
              digits={3}
              selected={last}
              hovered={hovered}
              onHover={setHovered}
              focusPrefix="run"
            />
          </div>
        )}

        <p className="text-[10px] text-slate-500">
          Prototype choices: which parameter each remedy changes (coupling steps of {THETA_STEP} rad, depth steps of 1), the
          J-based rollback, and testing stability with ±{PERTURBATION * 100}% couplings. The paper names the remedies but not
          their mechanics.
        </p>
      </div>
    </Panel>
  );
};

export default FeedbackLoopPanel;
