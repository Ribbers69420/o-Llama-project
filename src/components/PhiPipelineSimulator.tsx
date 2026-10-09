import React, { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  Gauge,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Workflow,
} from 'lucide-react';
import {
  DEFAULT_PARAMS,
  LAYERS,
  RESPONSE_LABELS,
  THRESHOLDS,
  UNSAFE_RESPONSE,
  runPipeline,
  topBasisStates,
  type Mitigation,
  type PipelineParams,
  type PipelineResult,
  type StepMetrics,
} from '../uqcf/pipeline';
import { MetricMultiple, ResponseBars } from './PipelineCharts';
import { GLYPH_FONT, VIZ } from './vizTokens';

// --- METRIC DEFINITIONS ---

type NumericMetric = Exclude<keyof StepMetrics, 'responseProbs' | 'argmax'>;

interface MetricDef {
  key: NumericMetric;
  symbol: string;
  label: string;
  unit: string;
  digits: number;
  domain: (values: number[]) => [number, number];
  threshold?: (params: PipelineParams) => { value: number; label: string };
  note: string;
}

const fixed = (lo: number, hi: number) => (): [number, number] => [lo, hi];
const atLeast = (hi: number) => (values: number[]): [number, number] => [0, Math.max(hi, Math.ceil(Math.max(...values) * 2) / 2)];

const METRICS: MetricDef[] = [
  {
    key: 'responseEntropy', symbol: 'H_R', label: 'Response entropy', unit: 'bits', digits: 2, domain: fixed(0, 2),
    threshold: () => ({ value: THRESHOLDS.maxResponseEntropy, label: 'max' }),
    note: '−Σ p_k log₂ p_k over the candidate responses (§5)',
  },
  {
    key: 'confidence', symbol: 'max_k p_k', label: 'Confidence', unit: '', digits: 2, domain: fixed(0, 1),
    threshold: () => ({ value: THRESHOLDS.minConfidence, label: 'min' }),
    note: 'Largest Born probability over the candidate responses (§5)',
  },
  {
    key: 'entropyP', symbol: 'S_ent(P)', label: 'Entanglement entropy of P', unit: 'bits', digits: 2, domain: fixed(0, 1),
    note: '−Tr(ρ_P log₂ ρ_P) (§5); equals entanglement only while the full state is pure',
  },
  {
    key: 'mutualInfo', symbol: 'I(C;R)', label: 'Context–response information', unit: 'bits', digits: 2, domain: fixed(0, 2),
    threshold: () => ({ value: THRESHOLDS.minMutualInfo, label: 'min' }),
    note: 'S(ρ_C) + S(ρ_R) − S(ρ_CR) (§5)',
  },
  {
    key: 'purity', symbol: 'γ', label: 'Purity', unit: '', digits: 3, domain: fixed(0, 1),
    threshold: () => ({ value: THRESHOLDS.minPurity, label: 'min' }),
    note: 'Tr(ρ²) of the full state (§5)',
  },
  {
    key: 'fidelity', symbol: 'F', label: 'Fidelity to noise-free run', unit: '', digits: 3, domain: fixed(0, 1),
    note: 'Tr(ρ_target ρ) (§5). Prototype choice: the target is the same pipeline run without decoherence',
  },
  {
    key: 'surprise', symbol: 'D_KL', label: 'Surprise vs previous step', unit: 'bits', digits: 2, domain: atLeast(0.5),
    note: 'D_KL(p_current ‖ p_baseline) (§5). Prototype choice: baseline = previous step, smoothed by 10⁻⁶',
  },
  {
    key: 'pUnsafe', symbol: 'p_unsafe', label: 'Unsafe mass', unit: '', digits: 3, domain: atLeast(0.5),
    threshold: (p) => ({ value: p.epsilon, label: 'ε' }),
    note: '⟨Ê_block⟩ = Tr(Ê_block ρ), Ê_block projecting onto r₃ (§4.4)',
  },
  {
    key: 'control', symbol: 'J', label: 'Control functional', unit: '', digits: 2,
    domain: (values) => [Math.min(-1, Math.floor(Math.min(...values))), Math.max(2, Math.ceil(Math.max(...values)))],
    note: 'w₁H_R − w₂I(C;R) − w₃γ + w₄p_unsafe with all weights 1 (§5.1)',
  },
];

// --- SMALL PIECES ---

const Glyph: React.FC<{ children: string; className?: string }> = ({ children, className = '' }) => (
  <span className={className} style={{ fontFamily: GLYPH_FONT }}>
    {children}
  </span>
);

const stepGlyph = (result: PipelineResult, i: number): string => {
  const step = result.steps[i];
  if (step.kind === 'init') return 'Ψ₀';
  if (step.kind === 'governance') return 'Ê';
  return step.glyph ?? '?';
};

const Panel: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode }> = ({
  title,
  icon,
  children,
  aside,
}) => (
  <section className="bg-slate-900/50 rounded-xl border border-slate-800 p-5 shadow-2xl">
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 className="text-sm font-bold flex items-center gap-2 text-slate-200">
        <span className="text-slate-400">{icon}</span>
        {title}
      </h2>
      {aside}
    </div>
    {children}
  </section>
);

const Slider: React.FC<{
  label: React.ReactNode;
  ariaLabel: string;
  value: number;
  min: number;
  max: number;
  step: number;
  digits: number;
  onChange: (v: number) => void;
}> = ({ label, ariaLabel, value, min, max, step, digits, onChange }) => (
  <label className="block">
    <div className="flex items-center justify-between gap-2 mb-1">
      <span className="text-xs text-slate-300 min-w-0 truncate">{label}</span>
      <span className="text-xs font-mono text-slate-400 tabular-nums">{value.toFixed(digits)}</span>
    </div>
    <input
      type="range"
      aria-label={ariaLabel}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-indigo-500"
    />
  </label>
);

const StatTile: React.FC<{ label: string; value: string; unit?: string }> = ({ label, value, unit }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
    <div className="text-[10px] text-slate-500 truncate">{label}</div>
    <div className="text-lg font-semibold text-slate-100">
      {value}
      {unit && <span className="text-xs font-normal text-slate-500 ml-1">{unit}</span>}
    </div>
  </div>
);

// --- STEP DETAIL ---

const StepDescription: React.FC<{ result: PipelineResult; index: number; params: PipelineParams }> = ({
  result,
  index,
  params,
}) => {
  const step = result.steps[index];
  if (step.kind === 'init') {
    return (
      <div className="text-xs text-slate-400 space-y-1">
        <p className="text-slate-200 font-semibold">QuantumMetaPrompt (§4.2)</p>
        <p>
          Initial product state <span className="font-mono text-slate-300">|0⟩_P ⊗ |0⟩_C ⊗ |s⟩_R</span>, with the response
          register in the uniform (neutral) superposition |s⟩ over r₀–r₃.
        </p>
      </div>
    );
  }
  if (step.kind === 'governance') {
    const g = result.governance;
    const outcome = !g.triggered
      ? 'Within tolerance: the state passes unchanged.'
      : g.refused
        ? 'Exceeds tolerance: the fail-closed policy refuses to answer; the state is left unchanged.'
        : 'Exceeds tolerance: the state is projected into the allowed subspace, Ê_allow ρ Ê_allow / Tr(Ê_allow ρ).';
    return (
      <div className="text-xs text-slate-400 space-y-1">
        <p className="text-slate-200 font-semibold">Ethical projector (§4.4)</p>
        <p className="font-mono text-slate-300">
          p_unsafe = {g.pUnsafeBefore.toFixed(3)} {g.triggered ? '>' : '≤'} ε = {params.epsilon.toFixed(3)}
        </p>
        <p>{outcome}</p>
      </div>
    );
  }
  const layer = LAYERS[index - 1];
  return (
    <div className="text-xs text-slate-400 space-y-1">
      <p className="text-slate-200 font-semibold flex items-center gap-2">
        <Glyph className="text-xl text-slate-100">{layer.glyph}</Glyph>
        {layer.codexName ? <em>{layer.codexName}</em> : <span>Not named in the Codex Harmonicus</span>}
        <span className="font-mono font-normal text-slate-500">{layer.codepoint}</span>
      </p>
      <p>
        Codex function:{' '}
        <span className="text-slate-300">
          {layer.codexFunction ? `${layer.codexFunction} (${layer.codexLayer})` : 'not specified'}
        </span>
      </p>
      <p>
        Prototype operator: <span className="text-slate-300">{layer.operator}</span>{' '}
        <span className="font-mono text-slate-500">θ = {params.thetas[index - 1].toFixed(2)}</span>
      </p>
    </div>
  );
};

// --- DECISION ---

const DecisionBanner: React.FC<{ result: PipelineResult }> = ({ result }) => {
  const d = result.decision;
  const final = result.steps[result.steps.length - 1].metrics;
  const view =
    d.kind === 'collapse'
      ? {
          color: VIZ.good,
          icon: <CheckCircle2 size={20} />,
          title: `Collapse → ${RESPONSE_LABELS[d.response]}`,
          body: `P(${RESPONSE_LABELS[d.response]}) = ${final.confidence.toFixed(2)}. All termination criteria are met (§4.7).`,
        }
      : d.kind === 'continue'
        ? {
            color: VIZ.warning,
            icon: <RefreshCw size={20} />,
            title: 'Continue: run another feedback iteration',
            body: `Criteria not met (§4.5, §4.7): ${d.reasons.join('; ')}.`,
          }
        : {
            color: VIZ.critical,
            icon: <Ban size={20} />,
            title: 'Refuse (fail closed)',
            body: `${d.reason} (§4.4).`,
          };
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 p-4 rounded-lg bg-slate-900 border"
      style={{ borderColor: view.color }}
    >
      <span className="shrink-0 mt-0.5" style={{ color: view.color }}>
        {view.icon}
      </span>
      <div>
        <div className="text-sm font-bold text-slate-100">{view.title}</div>
        <p className="text-xs text-slate-400 mt-1">{view.body}</p>
      </div>
    </div>
  );
};

// --- MAIN ---

const PhiPipelineSimulator: React.FC = () => {
  const [params, setParams] = useState<PipelineParams>(DEFAULT_PARAMS);
  const [selected, setSelected] = useState(LAYERS.length + 1);
  const [hovered, setHovered] = useState<number | null>(null);

  const result = useMemo(() => runPipeline(params), [params]);
  const glyphs = useMemo(() => result.steps.map((_, i) => stepGlyph(result, i)), [result]);
  const step = result.steps[selected];
  const m = step.metrics;

  const setTheta = useCallback((k: number, v: number) => {
    setParams((prev) => ({ ...prev, thetas: prev.thetas.map((t, i) => (i === k ? v : t)) }));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
              <Workflow size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Φ-Layer <span className="text-indigo-400">Pipeline</span>
            </h1>
          </div>
          <p className="text-slate-500 font-mono text-xs">
            Toy simulation of UQCF.tex §2–§5 &bull; 16-dim density operator &bull; P ⊗ C ⊗ R
          </p>
        </header>

        <div className="p-4 bg-gradient-to-r from-indigo-900/20 to-violet-900/20 border border-indigo-500/20 rounded-lg flex items-start gap-4">
          <FlaskConical className="text-indigo-400 shrink-0 mt-0.5" size={20} />
          <div className="text-xs text-indigo-100/80 space-y-1">
            <p>
              <span className="font-bold text-indigo-300">Prototype.</span> The state space, metrics (§5), the ethical
              projector (§4.4) and the control logic (§4.7, §5.1) follow the paper. The paper names the eight glyph-chain
              operators but does not define them, so each operator here is a stand-in chosen for this demo. Each layer is the
              identity at θ = 0, so you can ablate it.
            </p>
            <p>
              Subsystems: prompt P (1 qubit), context C (1 qubit), response R (candidates r₀–r₃). Response r₃ spans the
              disallowed subspace.
            </p>
          </div>
        </div>

        {/* Glyph chain stepper */}
        <nav aria-label="Pipeline steps" className="overflow-x-auto">
          <ol className="flex items-stretch gap-1 min-w-max">
            {result.steps.map((s, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={14} className="text-slate-600" aria-hidden />}
                <button
                  type="button"
                  aria-pressed={selected === i}
                  onClick={() => setSelected(i)}
                  onPointerEnter={() => setHovered(i)}
                  onPointerLeave={() => setHovered(null)}
                  className={`w-[5.5rem] h-full px-1 py-2 rounded-lg border text-center transition-colors ${
                    selected === i
                      ? 'bg-indigo-900/40 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Glyph className="block text-xl leading-7">{glyphs[i]}</Glyph>
                  <span className="block text-[9px] leading-tight text-slate-400 mt-1 [overflow-wrap:anywhere]">
                    {s.kind === 'init'
                      ? <>Quantum<wbr />MetaPrompt</>
                      : s.kind === 'governance'
                        ? 'Ethical projector'
                        : (LAYERS[i - 1].codexName ?? 'unnamed')}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Panel
            title="Parameters"
            icon={<SlidersHorizontal size={16} />}
            aside={
              <button
                type="button"
                onClick={() => setParams(DEFAULT_PARAMS)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-300 transition-colors"
              >
                <RotateCcw size={12} /> Defaults
              </button>
            }
          >
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Layer couplings θ</p>
              {LAYERS.map((layer, k) => (
                <Slider
                  key={layer.codepoint}
                  label={
                    <>
                      <Glyph className="text-base mr-1.5">{layer.glyph}</Glyph>
                      {layer.codexName ?? layer.codepoint}
                    </>
                  }
                  ariaLabel={`Coupling θ for layer ${k + 1}, ${layer.codexName ?? layer.codepoint}`}
                  value={params.thetas[k]}
                  min={0}
                  max={Math.PI}
                  step={0.05}
                  digits={2}
                  onChange={(v) => setTheta(k, v)}
                />
              ))}
              <button
                type="button"
                onClick={() => setParams((prev) => ({ ...prev, thetas: LAYERS.map(() => 0) }))}
                className="w-full px-2.5 py-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-300 transition-colors"
              >
                Switch every layer off (θ = 0)
              </button>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold pt-2">Noise and governance</p>
              <Slider
                label="Dephasing per layer, p (§2.6)"
                ariaLabel="Dephasing strength per layer"
                value={params.dephasing}
                min={0}
                max={0.1}
                step={0.005}
                digits={3}
                onChange={(v) => setParams((prev) => ({ ...prev, dephasing: v }))}
              />
              <Slider
                label="Tolerance on p_unsafe, ε (§4.4)"
                ariaLabel="Tolerance epsilon on unsafe mass"
                value={params.epsilon}
                min={0}
                max={0.5}
                step={0.01}
                digits={2}
                onChange={(v) => setParams((prev) => ({ ...prev, epsilon: v }))}
              />
              <label className="block">
                <span className="block text-xs text-slate-300 mb-1">Mitigation when p_unsafe &gt; ε</span>
                <select
                  value={params.mitigation}
                  onChange={(e) => setParams((prev) => ({ ...prev, mitigation: e.target.value as Mitigation }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                >
                  <option value="project">Project into the allowed subspace</option>
                  <option value="fail-closed">Fail closed (refuse)</option>
                </select>
              </label>
            </div>
          </Panel>

          <div className="lg:col-span-2 space-y-6">
            <Panel title={`Step ${selected} of ${result.steps.length - 1}`} icon={<Gauge size={16} />}>
              <StepDescription result={result} index={selected} params={params} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                <StatTile label="Response entropy H_R" value={m.responseEntropy.toFixed(2)} unit="bits" />
                <StatTile label={`Confidence (${RESPONSE_LABELS[m.argmax]})`} value={m.confidence.toFixed(2)} />
                <StatTile label="Context–response I(C;R)" value={m.mutualInfo.toFixed(2)} unit="bits" />
                <StatTile label="Unsafe mass p_unsafe" value={m.pUnsafe.toFixed(3)} />
                <StatTile label="Entanglement S_ent(P)" value={m.entropyP.toFixed(2)} unit="bits" />
                <StatTile label="Purity γ" value={m.purity.toFixed(3)} />
                <StatTile label="Fidelity F" value={m.fidelity.toFixed(3)} />
                <StatTile label="Control functional J" value={m.control.toFixed(2)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <h3 className="text-xs text-slate-300 mb-1">Response distribution P(m) = ⟨m|ρ_R|m⟩</h3>
                  <ResponseBars probs={m.responseProbs} labels={RESPONSE_LABELS} unsafeIndex={UNSAFE_RESPONSE} />
                </div>
                <div>
                  <h3 className="text-xs text-slate-300 mb-2">Top basis states |p c r⟩</h3>
                  <ul className="space-y-1.5">
                    {topBasisStates(step.rho).map((b) => (
                      <li key={b.label} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-xs">
                        <span className="font-mono text-slate-300">{b.label}</span>
                        <span className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${b.probability * 100}%`, background: VIZ.series }}
                          />
                        </span>
                        <span className="text-right font-mono text-slate-400 tabular-nums">{b.probability.toFixed(3)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Panel>

            <Panel title="Control logic" icon={<ShieldCheck size={16} />}>
              <DecisionBanner result={result} />
              <ul className="mt-4 space-y-2">
                {result.signals.map((s) => (
                  <li key={s.id} className="flex items-start gap-3 text-xs">
                    <span className="shrink-0 mt-0.5" style={{ color: s.triggered ? VIZ.warning : VIZ.good }}>
                      {s.triggered ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                    </span>
                    <div className="min-w-0">
                      <span className="text-slate-300 font-semibold mr-2">{s.triggered ? 'Triggered' : 'OK'}</span>
                      <span className="font-mono text-slate-400">{s.condition}</span>
                      {s.triggered && <div className="text-slate-500 mt-0.5">→ {s.action} (§5.1)</div>}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-slate-500 mt-3">
                Thresholds are prototype values; the paper leaves calibration to empirical tuning (§5.3). Stability across
                iterations, also a §4.7 criterion, is not modelled because this prototype runs a single pass.
              </p>
            </Panel>
          </div>
        </div>

        <Panel title="Metric trajectories" icon={<Workflow size={16} />} aside={<span className="text-[10px] text-slate-500">Hover to inspect, click to select a step</span>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {METRICS.map((def) => {
              const values = result.steps.map((s) => s.metrics[def.key]);
              return (
                <MetricMultiple
                  key={def.key}
                  symbol={def.symbol}
                  label={def.label}
                  unit={def.unit}
                  values={values}
                  stepGlyphs={glyphs}
                  domain={def.domain(values)}
                  digits={def.digits}
                  threshold={def.threshold?.(params)}
                  selected={selected}
                  hovered={hovered}
                  onHover={setHovered}
                  onSelect={setSelected}
                />
              );
            })}
          </div>
        </Panel>

        <Panel title="Table view" icon={<Gauge size={16} />}>
          <details>
            <summary className="text-xs text-slate-400 cursor-pointer select-none">
              Every metric at every step, with definitions
            </summary>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800">
                    <th className="text-left font-normal py-2 pr-3">Step</th>
                    {METRICS.map((d) => (
                      <th key={d.key} className="text-right font-normal font-mono py-2 px-2 whitespace-nowrap">
                        {d.symbol}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.steps.map((s, i) => (
                    <tr key={i} className={`border-b border-slate-800/60 ${i === selected ? 'bg-indigo-900/20' : ''}`}>
                      <td className="py-1.5 pr-3 text-slate-300 whitespace-nowrap">
                        <Glyph className="mr-1.5">{glyphs[i]}</Glyph>
                        {s.kind === 'layer' ? (LAYERS[i - 1].codexName ?? LAYERS[i - 1].codepoint) : s.label}
                      </td>
                      {METRICS.map((d) => (
                        <td key={d.key} className="text-right font-mono text-slate-400 tabular-nums py-1.5 px-2">
                          {s.metrics[d.key].toFixed(d.digits)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-[11px]">
              {METRICS.map((d) => (
                <div key={d.key} className="flex gap-2">
                  <dt className="font-mono text-slate-300 shrink-0 w-20">{d.symbol}</dt>
                  <dd className="text-slate-500">{d.note}</dd>
                </div>
              ))}
            </dl>
          </details>
        </Panel>

        <footer className="text-center text-xs text-slate-600 font-mono pb-4">
          <p>UQCF Φ-LAYER PIPELINE &bull; PROTOTYPE &bull; OPERATORS ARE STAND-INS, NOT DEFINITIONS FROM THE PAPER</p>
        </footer>
      </div>
    </div>
  );
};

export default PhiPipelineSimulator;
