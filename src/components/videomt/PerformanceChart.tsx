import React, { useState } from 'react';
import { BENCHMARK_RESULTS, DATASET_LABELS, DATASET_NOTES, DATASET_TASK } from './data';
import type { BenchmarkResult, DatasetKey } from './types';
import { VIZ } from '../vizTokens';

const DATASETS = Object.keys(DATASET_LABELS) as DatasetKey[];

// Emphasis form: VidEoMT is the point, every other method is context. One accent hue
// for VidEoMT, gray for the rest. Backbone is carried by marker shape (filled / ring),
// never by colour.
const ACCENT = VIZ.series;
const CONTEXT = VIZ.reference;
const CONTEXT_ACTIVE = VIZ.crosshair;

const markColor = (r: BenchmarkResult, active: boolean) => (r.isVidEoMT ? ACCENT : active ? CONTEXT_ACTIVE : CONTEXT);

const metricLabel = (r: BenchmarkResult) => r.metricName.replace('_', ' ');

const rowName = (r: BenchmarkResult) => `${r.method} (${r.backbone})`;

const FPS_TICKS = [2, 5, 10, 20, 50, 100, 200];

/** Clean tick values covering [lo, hi]. */
function niceTicks(lo: number, hi: number): number[] {
  const span = hi - lo;
  const raw = span / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const first = Math.floor(lo / step) * step;
  const ticks: number[] = [];
  for (let v = first; v < hi + step; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks.filter((_, i) => i === 0 || ticks[i - 1] < hi);
}

interface ChartProps {
  rows: BenchmarkResult[];
  activeId: string | null;
  onActivate: (id: string) => void;
}

const ScatterPlot: React.FC<ChartProps> = ({ rows, activeId, onActivate }) => {
  const fpsValues = rows.map((r) => r.fps);
  const xLo = [...FPS_TICKS].reverse().find((t) => t <= Math.min(...fpsValues) * 0.85) ?? FPS_TICKS[0];
  const xHi = FPS_TICKS.find((t) => t >= Math.max(...fpsValues) * 1.15) ?? FPS_TICKS[FPS_TICKS.length - 1];
  const xTicks = FPS_TICKS.filter((t) => t >= xLo && t <= xHi);
  const toX = (fps: number) => ((Math.log10(fps) - Math.log10(xLo)) / (Math.log10(xHi) - Math.log10(xLo))) * 100;

  const mVals = rows.map((r) => r.metric);
  const pad = Math.max((Math.max(...mVals) - Math.min(...mVals)) * 0.12, 0.5);
  const yTicks = niceTicks(Math.min(...mVals) - pad, Math.max(...mVals) + pad);
  const yLo = yTicks[0];
  const yHi = yTicks[yTicks.length - 1];
  const toY = (m: number) => 100 - ((m - yLo) / (yHi - yLo)) * 100;

  const name = metricLabel(rows[0]);

  return (
    <div>
      <div className="flex">
        {/* y axis label + ticks */}
        <div className="relative w-10 shrink-0 mb-8">
          {yTicks.map((t) => (
            <span
              key={t}
              className="absolute right-1 -translate-y-1/2 text-[10px] font-mono tabular-nums"
              style={{ top: `${toY(t)}%`, color: VIZ.textMuted }}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="relative h-64 sm:h-72" style={{ borderLeft: `1px solid ${VIZ.axis}`, borderBottom: `1px solid ${VIZ.axis}` }}>
            {yTicks.map((t) => (
              <div key={`gy-${t}`} className="absolute inset-x-0" style={{ top: `${toY(t)}%`, borderTop: `1px solid ${VIZ.grid}` }} />
            ))}
            {xTicks.map((t) => (
              <div key={`gx-${t}`} className="absolute inset-y-0" style={{ left: `${toX(t)}%`, borderLeft: `1px solid ${VIZ.grid}` }} />
            ))}

            {rows.map((r) => {
              const active = r.id === activeId;
              const size = r.isVidEoMT ? 14 : 10;
              const color = markColor(r, active);
              const hollow = r.backbone === 'Swin-L';
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-label={`${r.method}, ${r.backbone}: ${r.metric} ${metricLabel(r)}, ${r.fps} FPS`}
                  aria-pressed={active}
                  onMouseEnter={() => onActivate(r.id)}
                  onFocus={() => onActivate(r.id)}
                  onClick={() => onActivate(r.id)}
                  // 28px hit target around a 10-14px mark.
                  className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  style={{ left: `${toX(r.fps)}%`, top: `${toY(r.metric)}%`, zIndex: r.isVidEoMT ? 3 : active ? 2 : 1 }}
                >
                  <span
                    className="block rounded-full transition-transform duration-150"
                    style={{
                      width: size,
                      height: size,
                      background: hollow ? VIZ.surface : color,
                      border: hollow ? `2px solid ${color}` : 'none',
                      boxShadow: `0 0 0 2px ${VIZ.surface}`,
                      transform: active ? 'scale(1.35)' : undefined,
                    }}
                  />
                  {r.isVidEoMT && (
                    <span
                      className="pointer-events-none absolute right-full mr-1 whitespace-nowrap text-[11px] font-semibold"
                      style={{ color: VIZ.textPrimary }}
                    >
                      VidEoMT
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {/* x ticks */}
          <div className="relative h-5">
            {xTicks.map((t) => (
              <span
                key={t}
                className="absolute top-1 -translate-x-1/2 text-[10px] font-mono tabular-nums"
                style={{ left: `${toX(t)}%`, color: VIZ.textMuted }}
              >
                {t}
              </span>
            ))}
          </div>
          <div className="text-center text-[10px] font-mono" style={{ color: VIZ.textSecondary }}>
            speed, FPS (log scale) → · up is more accurate ({name})
          </div>
        </div>
      </div>
    </div>
  );
};

const BarList: React.FC<ChartProps> = ({ rows, activeId, onActivate }) => {
  const sorted = [...rows].sort((a, b) => b.metric - a.metric);
  const max = sorted[0].metric;

  return (
    <ul className="space-y-1.5">
      {sorted.map((r) => {
        const active = r.id === activeId;
        const ratio = r.metric / max;
        return (
          <li key={r.id}>
            <button
              type="button"
              onMouseEnter={() => onActivate(r.id)}
              onFocus={() => onActivate(r.id)}
              onClick={() => onActivate(r.id)}
              aria-pressed={active}
              className={`grid w-full grid-cols-[6.5rem_1fr_3.25rem] items-center gap-2 rounded px-1 py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-300 sm:grid-cols-[9rem_1fr_3.75rem] ${
                active ? 'bg-slate-800/60' : ''
              }`}
            >
              <span className="min-w-0 truncate text-xs" style={{ color: r.isVidEoMT ? VIZ.textPrimary : VIZ.textSecondary }}>
                <span className={r.isVidEoMT ? 'font-semibold' : ''}>{r.method}</span>
                <span className="ml-1 text-[10px]" style={{ color: VIZ.textMuted }}>
                  {r.backbone}
                </span>
              </span>
              {/* Bars start at zero and are capped so the value fits outside the tip. */}
              <span className="relative block h-4">
                <span
                  className="absolute left-0 top-0 block h-4 rounded-r"
                  style={{ width: `calc((100% - 2.5rem) * ${ratio})`, background: markColor(r, active) }}
                />
                <span
                  className="absolute top-0 flex h-4 items-center text-[11px] font-mono tabular-nums"
                  style={{ left: `calc((100% - 2.5rem) * ${ratio} + 0.4rem)`, color: VIZ.textPrimary }}
                >
                  {r.metric}
                </span>
              </span>
              <span className="text-right text-[11px] font-mono tabular-nums" style={{ color: r.isVidEoMT ? VIZ.textPrimary : VIZ.textMuted }}>
                {r.fps} FPS
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

const ResultsTable: React.FC<{ rows: BenchmarkResult[]; dataset: DatasetKey }> = ({ rows, dataset }) => {
  const sorted = [...rows].sort((a, b) => b.metric - a.metric);
  const second = sorted.find((r) => r.secondary)?.secondary?.name;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <caption className="pb-2 text-left text-[10px] uppercase tracking-wider" style={{ color: VIZ.textMuted }}>
          {DATASET_LABELS[dataset]} — sorted by {metricLabel(rows[0])}
        </caption>
        <thead>
          <tr className="border-b border-slate-700 text-left text-[10px] uppercase tracking-wider" style={{ color: VIZ.textMuted }}>
            <th scope="col" className="py-1.5 pr-3 font-medium">Method</th>
            <th scope="col" className="py-1.5 pr-3 font-medium">Backbone</th>
            <th scope="col" className="py-1.5 pr-3 font-medium">Pre-training</th>
            <th scope="col" className="py-1.5 pr-3 text-right font-medium">{metricLabel(rows[0])}</th>
            {second && <th scope="col" className="py-1.5 pr-3 text-right font-medium">{second}</th>}
            <th scope="col" className="py-1.5 pr-3 text-right font-medium">GFLOPs</th>
            <th scope="col" className="py-1.5 text-right font-medium">FPS</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {sorted.map((r) => (
            <tr
              key={r.id}
              className="border-b border-slate-800"
              style={{ color: r.isVidEoMT ? VIZ.textPrimary : VIZ.textSecondary, fontWeight: r.isVidEoMT ? 600 : 400 }}
            >
              <th scope="row" className="py-1.5 pr-3 text-left font-[inherit]">{r.method}</th>
              <td className="py-1.5 pr-3">{r.backbone}</td>
              <td className="py-1.5 pr-3">{r.pretraining}</td>
              <td className="py-1.5 pr-3 text-right">{r.metric}</td>
              {second && <td className="py-1.5 pr-3 text-right">{r.secondary?.value ?? '–'}</td>}
              <td className="py-1.5 pr-3 text-right">{r.gflops}</td>
              <td className="py-1.5 text-right">{r.fps}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const PerformanceChart: React.FC = () => {
  const [dataset, setDataset] = useState<DatasetKey>('ytvis19');
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [activeId, setActiveId] = useState<string | null>(null);

  const rows = BENCHMARK_RESULTS.filter((r) => r.dataset === dataset);
  // A selection from another dataset simply stops matching; no effect needed to clear it.
  const active = rows.find((r) => r.id === activeId) ?? null;
  const vid = rows.find((r) => r.isVidEoMT)!;
  const note = DATASET_NOTES[dataset];

  return (
    <div className="space-y-4">
      {/* One filter row above everything it scopes. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Dataset" className="flex flex-wrap gap-1.5">
          {DATASETS.map((ds) => (
            <button
              key={ds}
              type="button"
              aria-pressed={dataset === ds}
              onClick={() => setDataset(ds)}
              className={`rounded px-2.5 py-1.5 text-[11px] font-mono transition-colors ${
                dataset === ds ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {DATASET_LABELS[ds]}
            </button>
          ))}
        </div>
        <div role="group" aria-label="View" className="flex gap-1">
          {(['chart', 'table'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`rounded px-2.5 py-1.5 text-[11px] font-mono capitalize transition-colors ${
                view === v ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs" style={{ color: VIZ.textSecondary }}>
        {DATASET_TASK[dataset]} · metric: <span className="font-mono">{metricLabel(vid)}</span> · from the paper’s Tables 2–5
      </div>

      {view === 'chart' ? (
        <>
          {/* Legend: emphasis colour and the backbone marker shapes. */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px]" style={{ color: VIZ.textSecondary }}>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ACCENT }} /> VidEoMT
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CONTEXT }} /> other methods
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CONTEXT }} /> filled = ViT-L (DINOv2)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: VIZ.surface, border: `2px solid ${CONTEXT}` }} /> ring = Swin-L (IN21K)
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-800 p-4" style={{ background: VIZ.surface }}>
              <div className="mb-3 text-[10px] font-mono uppercase tracking-wider" style={{ color: VIZ.textMuted }}>
                Accuracy vs speed
              </div>
              <ScatterPlot rows={rows} activeId={active?.id ?? null} onActivate={setActiveId} />
            </div>
            <div className="rounded-lg border border-slate-800 p-4" style={{ background: VIZ.surface }}>
              <div className="mb-3 text-[10px] font-mono uppercase tracking-wider" style={{ color: VIZ.textMuted }}>
                {metricLabel(vid)} and FPS by method
              </div>
              <BarList rows={rows} activeId={active?.id ?? null} onActivate={setActiveId} />
            </div>
          </div>

          {/* Readout shared by both charts: hover, focus or tap a mark. */}
          <div
            aria-live="polite"
            className="min-h-[3.25rem] rounded-lg border border-slate-800 px-4 py-2.5 text-xs"
            style={{ background: VIZ.surface, color: VIZ.textSecondary }}
          >
            {active ? (
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="text-lg font-semibold tabular-nums" style={{ color: VIZ.textPrimary }}>
                  {active.metric} <span className="text-xs font-normal">{metricLabel(active)}</span>
                </span>
                <span style={{ color: VIZ.textPrimary }}>{rowName(active)}</span>
                <span className="font-mono">
                  {active.pretraining} · {active.gflops} GFLOPs · {active.fps} FPS
                  {active.secondary ? ` · ${active.secondary.name} ${active.secondary.value}` : ''}
                </span>
              </div>
            ) : (
              <span>Hover, focus or tap a mark to read its numbers. The Table view lists every value.</span>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-slate-800 p-4" style={{ background: VIZ.surface }}>
          <ResultsTable rows={rows} dataset={dataset} />
        </div>
      )}

      {note && (
        <p className="text-[11px] leading-relaxed" style={{ color: VIZ.textMuted }}>
          {note}
        </p>
      )}
    </div>
  );
};

export default PerformanceChart;
