import React, { useState } from 'react';
import { BENCHMARK_RESULTS, DATASET_LABELS, DATASET_NOTES, DATASET_TASK } from './data';
import type { BenchmarkResult, DatasetKey } from './types';
import { VIZ } from '../vizTokens';
import { scatterScales } from './vizMath';

const DATASETS = Object.keys(DATASET_LABELS) as DatasetKey[];

// Emphasis form: VidEoMT is the point, every other method is context. One accent hue
// for VidEoMT, gray for the rest. Backbone is carried by marker shape (filled / ring),
// never by colour.
const ACCENT = VIZ.series;
const CONTEXT = VIZ.reference;
const CONTEXT_ACTIVE = VIZ.crosshair;

const markColor = (r: BenchmarkResult, active: boolean) => (r.isVidEoMT ? ACCENT : active ? CONTEXT_ACTIVE : CONTEXT);

const metricLabel = (r: BenchmarkResult) => r.metricName.replace('_', ' ');

/** The paper prints one decimal everywhere, so 42.0 and 95.0 keep their .0. */
const fmt = (n: number) => n.toFixed(1);

const rowName = (r: BenchmarkResult) => `${r.method} (${r.backbone})`;

interface ChartProps {
  rows: BenchmarkResult[];
  activeId: string | null;
  /** `announce` is true for focus and click, false for a passing hover. */
  onActivate: (id: string, announce: boolean) => void;
}

const ScatterPlot: React.FC<ChartProps> = ({ rows, activeId, onActivate }) => {
  const { xTicks, yTicks, toX, toY } = scatterScales(rows);

  const name = metricLabel(rows[0]);

  return (
    <div>
      <div className="flex">
        {/* Spacer for the y tick labels, which are drawn inside their gridlines below. */}
        <div className="w-10 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="relative h-64 sm:h-72" style={{ borderLeft: `1px solid ${VIZ.axis}`, borderBottom: `1px solid ${VIZ.axis}` }}>
            {yTicks.map((t) => (
              <div key={`gy-${t}`} className="absolute inset-x-0" style={{ top: `${toY(t)}%`, borderTop: `1px solid ${VIZ.grid}` }}>
                <span
                  className="absolute right-full top-0 mr-2 -translate-y-1/2 text-[10px] font-mono tabular-nums"
                  style={{ color: VIZ.textSecondary }}
                >
                  {t}
                </span>
              </div>
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
                  aria-label={`${r.method}, ${r.backbone}: ${fmt(r.metric)} ${metricLabel(r)}, ${r.fps} FPS`}
                  onMouseEnter={() => onActivate(r.id, false)}
                  onFocus={() => onActivate(r.id, true)}
                  onClick={() => onActivate(r.id, true)}
                  // 24px hit target around a 10-14px mark.
                  className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 scroll-mb-28 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  style={{ left: `${toX(r.fps)}%`, top: `${toY(r.metric)}%`, zIndex: r.isVidEoMT ? 3 : active ? 2 : 1 }}
                >
                  <span
                    className="forced-color-adjust-none block rounded-full transition-transform duration-150"
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
                style={{ left: `${toX(t)}%`, color: VIZ.textSecondary }}
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
              onMouseEnter={() => onActivate(r.id, false)}
              onFocus={() => onActivate(r.id, true)}
              onClick={() => onActivate(r.id, true)}
              className={`grid w-full scroll-mb-28 grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 rounded px-1 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-300 sm:grid-cols-[9rem_1fr_3.75rem] sm:py-0.5 ${
                active ? 'bg-slate-800/60' : ''
              }`}
            >
              <span className="col-start-1 row-start-1 min-w-0 truncate text-xs" style={{ color: r.isVidEoMT ? VIZ.textPrimary : VIZ.textSecondary }}>
                <span className={r.isVidEoMT ? 'font-semibold' : ''}>{r.method}</span>{' '}
                <span className="text-[10px]" style={{ color: VIZ.textSecondary }}>
                  {r.backbone}
                </span>
              </span>
              {/* Bars start at zero and are capped so the value fits outside the tip. On phones the bar gets
                  its own line under the label, so it has the full width. */}
              <span className="relative col-span-2 row-start-2 block h-4 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                <span
                  className="forced-color-adjust-none absolute left-0 top-0 block h-4 rounded-r"
                  style={{ width: `calc((100% - 2.5rem) * ${ratio})`, background: markColor(r, active) }}
                />
                <span
                  className="absolute top-0 flex h-4 items-center text-[11px] font-mono tabular-nums"
                  style={{ left: `calc((100% - 2.5rem) * ${ratio} + 0.4rem)`, color: VIZ.textPrimary }}
                >
                  {fmt(r.metric)}
                </span>
              </span>
              <span className="col-start-2 row-start-1 text-right text-[11px] font-mono tabular-nums sm:col-start-3" style={{ color: r.isVidEoMT ? VIZ.textPrimary : VIZ.textSecondary }}>
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
    <div>
      <div className="pb-2 text-[10px] uppercase tracking-wider" style={{ color: VIZ.textSecondary }}>
        {DATASET_LABELS[dataset]} — sorted by {metricLabel(rows[0])}
      </div>
      <div className="relative">
      <div className="relative overflow-x-auto">
      <table className="w-full text-xs">
        <caption className="sr-only">
          {DATASET_LABELS[dataset]}, sorted by {metricLabel(rows[0])}, with speed and compute (paper Tables 2–5)
        </caption>
        <thead>
          <tr className="border-b border-slate-700 text-left text-[10px] uppercase tracking-wider" style={{ color: VIZ.textSecondary }}>
            <th scope="col" className="py-1.5 pr-3 font-medium">Method</th>
            <th scope="col" className="py-1.5 pr-3 font-medium">Backbone</th>
            <th scope="col" className="hidden py-1.5 pr-3 font-medium sm:table-cell">Pre-training</th>
            <th scope="col" className="py-1.5 pr-3 text-right font-medium">{metricLabel(rows[0])}</th>
            {second && <th scope="col" className="py-1.5 pr-3 text-right font-medium">{second}</th>}
            <th scope="col" className="py-1.5 pr-3 text-right font-medium">FPS</th>
            <th scope="col" className="py-1.5 pr-8 text-right font-medium sm:pr-0">GFLOPs</th>
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
              <td className="hidden py-1.5 pr-3 sm:table-cell">{r.pretraining}</td>
              <td className="py-1.5 pr-3 text-right">{fmt(r.metric)}</td>
              {second && <td className="py-1.5 pr-3 text-right">{r.secondary ? fmt(r.secondary.value) : '–'}</td>}
              <td className="py-1.5 pr-3 text-right">{r.fps}</td>
              <td className="py-1.5 pr-8 text-right sm:pr-0">{r.gflops}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {/* Hint that the table scrolls sideways on narrow screens. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-8 sm:hidden"
        style={{ background: `linear-gradient(to left, ${VIZ.surface}, transparent)` }}
      />
      </div>
    </div>
  );
};

const PerformanceChart: React.FC = () => {
  const [dataset, setDataset] = useState<DatasetKey>('ytvis19');
  const [view, setView] = useState<'chart' | 'table'>('chart');
  // What the readout shows (hover, focus or tap) and what a screen reader is told (focus or tap only).
  const [activeId, setActiveId] = useState<string | null>(null);
  const [announcedId, setAnnouncedId] = useState<string | null>(null);
  const activate = (id: string, announce: boolean) => {
    setActiveId(id);
    if (announce) setAnnouncedId(id);
  };

  const rows = BENCHMARK_RESULTS.filter((r) => r.dataset === dataset);
  // A selection from another dataset simply stops matching; no effect needed to clear it.
  const active = rows.find((r) => r.id === activeId) ?? null;
  const announced = rows.find((r) => r.id === announcedId) ?? null;
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
                dataset === ds ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
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
              <span className="forced-color-adjust-none inline-block h-2.5 w-2.5 rounded-full" style={{ background: ACCENT }} /> VidEoMT
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="forced-color-adjust-none inline-block h-2.5 w-2.5 rounded-full" style={{ background: CONTEXT }} /> other methods
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="forced-color-adjust-none inline-block h-2.5 w-2.5 rounded-full" style={{ background: CONTEXT }} /> filled = ViT-L (DINOv2)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="forced-color-adjust-none inline-block h-2.5 w-2.5 rounded-full" style={{ background: VIZ.surface, border: `2px solid ${CONTEXT}` }} /> ring = Swin-L (IN21K)
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="order-1 rounded-lg border border-slate-800 p-4" style={{ background: VIZ.surface }}>
              <div className="mb-3 text-[10px] font-mono uppercase tracking-wider" style={{ color: VIZ.textSecondary }}>
                Accuracy vs speed
              </div>
              <ScatterPlot rows={rows} activeId={active?.id ?? null} onActivate={activate} />
            </div>
            <div className="order-3 rounded-lg border border-slate-800 p-4 lg:order-2" style={{ background: VIZ.surface }}>
              <div className="mb-3 text-[10px] font-mono uppercase tracking-wider" style={{ color: VIZ.textSecondary }}>
                {metricLabel(vid)} and FPS by method
              </div>
              <BarList rows={rows} activeId={active?.id ?? null} onActivate={activate} />
            </div>

            {/* Readout shared by both charts: hover, focus or tap a mark. Under the scatter plot on
                phones and tablets, full width below both charts on desktop. */}
            <div
              className="sticky bottom-2 z-10 order-2 min-h-[6.5rem] rounded-lg border border-slate-700 px-4 py-2.5 text-xs shadow-lg shadow-black/40 sm:min-h-[4.25rem] lg:order-3 lg:col-span-2"
              style={{ background: VIZ.surface, color: VIZ.textSecondary }}
            >
              {active ? (
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="text-lg font-semibold tabular-nums" style={{ color: VIZ.textPrimary }}>
                    {fmt(active.metric)} <span className="text-xs font-normal">{metricLabel(active)}</span>
                  </span>
                  <span style={{ color: VIZ.textPrimary }}>{rowName(active)}</span>
                  <span className="font-mono">
                    {active.pretraining} · {active.gflops} GFLOPs · {active.fps} FPS
                    {active.secondary ? ` · ${active.secondary.name} ${fmt(active.secondary.value)}` : ''}
                  </span>
                </div>
              ) : (
                <span>Hover, focus or tap a mark to read its numbers. The Table view lists every value.</span>
              )}
            </div>
            <div role="status" aria-live="polite" className="sr-only">
              {announced
                ? `${announced.method}, ${announced.backbone}, ${fmt(announced.metric)} ${metricLabel(announced)}, ${announced.fps} FPS, ${announced.gflops} GFLOPs${
                    announced.secondary ? `, ${announced.secondary.name} ${fmt(announced.secondary.value)}` : ''
                  }`
                : ''}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-slate-800 p-4" style={{ background: VIZ.surface }}>
          <ResultsTable rows={rows} dataset={dataset} />
        </div>
      )}

      {note && (
        <p className="text-[11px] leading-relaxed" style={{ color: VIZ.textSecondary }}>
          {note}
        </p>
      )}
    </div>
  );
};

export default PerformanceChart;
