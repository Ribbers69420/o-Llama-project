import React, { useState } from 'react';
import { Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { ABLATION_TABLE } from './data';
import { VIZ } from '../vizTokens';

type CellState = 'present' | 'removed' | 'absent';

// "removable" columns hold a module CAVIS has, so false means a step removed it.
// "added" columns hold something VidEoMT introduces, so false just means not yet.
const BoolCell: React.FC<{ value: boolean; kind: 'removable' | 'added' }> = ({ value, kind }) => {
  const state: CellState = value ? 'present' : kind === 'removable' ? 'removed' : 'absent';
  return (
    <td className="px-3 py-2 text-center">
      {state === 'present' && <Check className="inline-block h-4 w-4 text-emerald-400" aria-hidden="true" />}
      {state === 'removed' && <X className="inline-block h-4 w-4 text-red-400" aria-hidden="true" />}
      {state === 'absent' && (
        <span className="text-slate-400" aria-hidden="true">
          —
        </span>
      )}
      <span className="sr-only">{state === 'present' ? 'present' : state === 'removed' ? 'removed' : 'not used'}</span>
    </td>
  );
};

const SparkBar: React.FC<{ value: number; max: number; highlight: boolean; digits?: number }> = ({
  value, max, highlight, digits = 0,
}) => (
  <div className="flex items-center gap-2">
    <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-800">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${(value / max) * 100}%`, backgroundColor: highlight ? VIZ.series : VIZ.reference }}
      />
    </div>
    <span className="w-10 text-right font-mono text-xs tabular-nums text-slate-300">{value.toFixed(digits)}</span>
  </div>
);

const TH = 'px-3 py-2 text-[10px] uppercase tracking-wider text-slate-400 font-medium';

const SimplificationTable: React.FC = () => {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const maxAP = Math.max(...ABLATION_TABLE.map((r) => r.ap));
  const maxFPS = Math.max(...ABLATION_TABLE.map((r) => r.fps));
  const finalStep = ABLATION_TABLE[ABLATION_TABLE.length - 1].step;

  return (
    <div className="relative">
      {/* `relative` makes this scroller the containing block of the table's absolutely positioned
          sr-only text; without it that text escapes the scroller and widens the whole page. */}
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Stepwise simplification from CAVIS to VidEoMT on YouTube-VIS 2019 val (paper Table 1). Select a step for its description and GFLOPs.
          </caption>
          <thead>
            <tr className="border-b border-slate-700">
              <th scope="col" className={`${TH} text-left`}>Step</th>
              <th scope="col" className={`${TH} text-left`}>Configuration</th>
              <th scope="col" className={`${TH} text-center`}>Adapter + M2F</th>
              <th scope="col" className={`${TH} text-center`}>Ctx-aware</th>
              <th scope="col" className={`${TH} text-center`}>Re-ID</th>
              <th scope="col" className={`${TH} text-center`}>Tracker</th>
              <th scope="col" className={`${TH} text-center`}>Q. prop</th>
              <th scope="col" className={`${TH} text-center`}>Q. fuse</th>
              <th scope="col" className={`${TH} text-left`}>AP</th>
              <th scope="col" className={`${TH} text-left`}>FPS</th>
              <th scope="col" className={`${TH} text-right`}>Params</th>
            </tr>
          </thead>
          <tbody>
            {ABLATION_TABLE.map((row) => {
              const isExpanded = expandedStep === row.step;
              const isFinal = row.step === finalStep;
              const detailId = `step-detail-${row.step}`;
              return (
                <React.Fragment key={row.step}>
                  <tr
                    className={`cursor-pointer border-l-2 transition-colors duration-200 hover:bg-slate-800/50 ${
                      isFinal ? 'border-l-cyan-500 bg-cyan-950/20' : 'border-l-transparent'
                    } ${isExpanded ? 'bg-slate-800/30' : ''}`}
                    // Enter/Space on the button below bubbles up to this handler.
                    onClick={() => setExpandedStep(isExpanded ? null : row.step)}
                  >
                    <td className="px-3 py-2 font-mono text-xs text-slate-300">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={detailId}
                        className="flex items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                      >
                        {isExpanded ? <ChevronDown className="h-3 w-3" aria-hidden="true" /> : <ChevronRight className="h-3 w-3" aria-hidden="true" />}
                        ({row.step})
                        <span className="sr-only">{row.label}</span>
                      </button>
                    </td>
                    <td className={`px-3 py-2 font-medium ${isFinal ? 'text-cyan-300' : 'text-slate-200'}`}>{row.label}</td>
                    <BoolCell value={row.hasViTAdapter || row.hasMask2FormerDecoder} kind="removable" />
                    <BoolCell value={row.hasContextAware} kind="removable" />
                    <BoolCell value={row.hasReID} kind="removable" />
                    <BoolCell value={row.hasTracker} kind="removable" />
                    <BoolCell value={row.hasQueryPropagation} kind="added" />
                    <BoolCell value={row.hasQueryFusion} kind="added" />
                    <td className="px-3 py-2">
                      <SparkBar value={row.ap} max={maxAP} highlight={isFinal} digits={1} />
                    </td>
                    <td className="px-3 py-2">
                      <SparkBar value={row.fps} max={maxFPS} highlight={isFinal} />
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-300">{row.params}</td>
                  </tr>
                  {isExpanded && (
                    <tr id={detailId} className={isFinal ? 'bg-cyan-950/10' : 'bg-slate-800/20'}>
                      <td colSpan={11} className="px-6 py-3">
                        {/* Sticky and capped to the visible width, so the text is not cut off when the table scrolls sideways. */}
                        <div className="sticky left-0 w-[min(100%,calc(100vw-7.5rem))] text-xs leading-relaxed text-slate-300">
                          {row.description}
                          <div className="mt-2 font-mono text-[11px] text-slate-400">GFLOPs: {row.gflops}</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Hint that the table scrolls sideways on narrow screens. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-10 md:hidden"
        style={{ background: 'linear-gradient(to left, rgba(2, 6, 23, 0.85), transparent)' }}
      />
    </div>
  );
};

export default SimplificationTable;
