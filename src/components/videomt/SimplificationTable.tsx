import React, { useState } from 'react';
import { Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { ABLATION_TABLE } from './data';

const BoolCell: React.FC<{ value: boolean; removed?: boolean }> = ({ value, removed }) => (
  <td className="px-3 py-2 text-center">
    {value ? (
      <Check className="w-4 h-4 text-emerald-400 inline-block" />
    ) : removed ? (
      <X className="w-4 h-4 text-red-400/50 inline-block" />
    ) : (
      <span className="text-slate-600">—</span>
    )}
  </td>
);

const SparkBar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => (
  <div className="flex items-center gap-2">
    <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${(value / max) * 100}%`, backgroundColor: color }}
      />
    </div>
    <span className="font-mono text-xs text-slate-300 w-10 text-right">{value}</span>
  </div>
);

const SimplificationTable: React.FC = () => {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const maxAP = Math.max(...ABLATION_TABLE.map(r => r.ap));
  const maxFPS = Math.max(...ABLATION_TABLE.map(r => r.fps));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-slate-500">Step</th>
            <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-slate-500">Configuration</th>
            <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider text-slate-500">Decoder</th>
            <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider text-slate-500">Tracker</th>
            <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider text-slate-500">Q.Prop</th>
            <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider text-slate-500">Q.Fuse</th>
            <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-slate-500">AP</th>
            <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-slate-500">FPS</th>
            <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-slate-500">Params</th>
          </tr>
        </thead>
        <tbody>
          {ABLATION_TABLE.map((row) => {
            const isExpanded = expandedStep === row.step;
            const isFinal = row.step === 6;
            return (
              <React.Fragment key={row.step}>
                <tr
                  className={`cursor-pointer transition-all duration-200 hover:bg-slate-800/50 ${
                    isFinal
                      ? 'bg-cyan-950/20 border-l-2 border-l-cyan-500'
                      : 'border-l-2 border-l-transparent'
                  } ${isExpanded ? 'bg-slate-800/30' : ''}`}
                  onClick={() => setExpandedStep(isExpanded ? null : row.step)}
                >
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      ({row.step})
                    </span>
                  </td>
                  <td className={`px-3 py-2 font-medium ${isFinal ? 'text-cyan-400' : 'text-slate-200'}`}>
                    {row.label}
                  </td>
                  <BoolCell value={row.hasMask2FormerDecoder} removed={row.step > 0 && row.step <= 6} />
                  <BoolCell value={row.hasTracker} removed={row.step >= 4} />
                  <BoolCell value={row.hasQueryPropagation} />
                  <BoolCell value={row.hasQueryFusion} />
                  <td className="px-3 py-2">
                    <SparkBar value={row.ap} max={maxAP} color={isFinal ? '#06b6d4' : '#64748b'} />
                  </td>
                  <td className="px-3 py-2">
                    <SparkBar value={row.fps} max={maxFPS} color={isFinal ? '#06b6d4' : '#64748b'} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-400 text-right">{row.params}</td>
                </tr>
                {isExpanded && (
                  <tr className={isFinal ? 'bg-cyan-950/10' : 'bg-slate-800/20'}>
                    <td colSpan={9} className="px-6 py-3 text-xs text-slate-400 leading-relaxed">
                      {row.description}
                      <div className="mt-2 font-mono text-[10px] text-slate-500">
                        GFLOPs: {row.gflops}
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
  );
};

export default SimplificationTable;
