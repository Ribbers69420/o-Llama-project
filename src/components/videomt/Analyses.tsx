import React, { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { ANALYSES, gapToReference } from './data';
import type { Analysis, AnalysisRow } from './types';
import { formatDelta } from './vizMath';
import { VIZ } from '../vizTokens';

// Emphasis form, as in the benchmark chart: VidEoMT in the one accent, every other row gray.
// Every bar is labelled directly, so nothing depends on colour to be told apart.
const markColor = (r: AnalysisRow, active: boolean) => (r.isVidEoMT ? VIZ.series : active ? VIZ.crosshair : VIZ.reference);

/** The AP change against CAVIS: an arrow (none for no change) and a signed number, never colour alone. */
const Gap: React.FC<{ gap: number }> = ({ gap }) => (
  <span className="inline-flex items-center gap-0.5 font-mono text-[11px]" style={{ color: VIZ.textSecondary }}>
    {gap > 0 && <ArrowUp className="h-3 w-3 shrink-0" aria-hidden="true" />}
    {gap < 0 && <ArrowDown className="h-3 w-3 shrink-0" aria-hidden="true" />}
    {formatDelta(gap)} AP vs CAVIS
  </span>
);

/** What a screen reader hears when a row is chosen: the numbers the row itself does not show. */
const summary = (r: AnalysisRow, gap: number | null) =>
  [
    `${r.label}${r.group ? `, ${r.group}` : ''}`,
    `${r.ap.toFixed(1)} AP`,
    `${r.fps} FPS`,
    `${r.gflops} GFLOPs`,
    r.params ? `${r.params} parameters` : null,
    gap !== null ? `${formatDelta(gap)} AP versus CAVIS` : null,
    r.detail ?? null,
  ]
    .filter(Boolean)
    .join(', ');

interface Group {
  name: string | null;
  rows: AnalysisRow[];
}

const groupsOf = (a: Analysis): Group[] => {
  const out: Group[] = [];
  for (const r of a.rows) {
    const name = r.group ?? null;
    const last = out[out.length - 1];
    if (last && last.name === name) last.rows.push(r);
    else out.push({ name, rows: [r] });
  }
  return out;
};

const Bars: React.FC<{
  analysis: Analysis;
  activeId: string | null;
  /** `announce` is true for focus and click, false for a passing hover. */
  onActivate: (id: string, announce: boolean) => void;
}> = ({ analysis, activeId, onActivate }) => {
  const max = Math.max(...analysis.rows.map((r) => r.ap));
  return (
    <div className="space-y-3">
      {groupsOf(analysis).map((g) => (
        <div key={g.name ?? 'all'}>
          {g.name && (
            <h4 className="mb-1 font-mono text-[11px] uppercase tracking-wider" style={{ color: VIZ.textSecondary }}>
              {g.name}
            </h4>
          )}
          <ul className="space-y-1">
            {g.rows.map((r) => {
              const active = r.id === activeId;
              const gap = gapToReference(analysis.rows, r);
              const ratio = r.ap / max;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onMouseEnter={() => onActivate(r.id, false)}
                    onFocus={() => onActivate(r.id, true)}
                    onClick={() => onActivate(r.id, true)}
                    className={`grid w-full scroll-mb-28 grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 rounded px-1 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-300 sm:grid-cols-[11rem_1fr_3.75rem] ${
                      active ? 'bg-slate-800/60' : ''
                    }`}
                  >
                    <span className="col-start-1 row-start-1 min-w-0 text-xs leading-snug" style={{ color: r.isVidEoMT ? VIZ.textPrimary : VIZ.textSecondary }}>
                      <span className={r.isVidEoMT ? 'font-semibold' : ''}>{r.label}</span>
                      {gap !== null && (
                        <span className="block">
                          <Gap gap={gap} />
                        </span>
                      )}
                    </span>
                    {/* Bars start at zero; the value sits just past the tip, so it is never clipped. On phones the
                        bar gets its own line under the label, so it has the full width. */}
                    <span className="relative col-span-2 row-start-2 block h-4 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                      <span
                        className="forced-color-adjust-none absolute left-0 top-0 block h-4 rounded-r"
                        style={{ width: `calc((100% - 2.5rem) * ${ratio})`, background: markColor(r, active) }}
                      />
                      <span
                        className="absolute top-0 flex h-4 items-center font-mono text-[11px] tabular-nums"
                        style={{ left: `calc((100% - 2.5rem) * ${ratio} + 0.4rem)`, color: VIZ.textPrimary }}
                      >
                        {r.ap.toFixed(1)}
                      </span>
                    </span>
                    <span
                      className="col-start-2 row-start-1 text-right font-mono text-[11px] tabular-nums sm:col-start-3"
                      style={{ color: r.isVidEoMT ? VIZ.textPrimary : VIZ.textSecondary }}
                    >
                      {r.fps} FPS
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
};

const AnalysisTable: React.FC<{ analysis: Analysis }> = ({ analysis }) => {
  const grouped = analysis.rows.some((r) => r.group);
  const hasParams = analysis.rows.some((r) => r.params);
  const th = 'py-1.5 pr-3 font-medium';
  // The last column keeps clear of the scroll-hint fade on phones, so its digits are not dimmed.
  const lastTh = 'py-1.5 pr-8 text-right font-medium sm:pr-0';
  const lastTd = 'py-1.5 pr-8 text-right sm:pr-0';
  return (
    <div>
      <div className="pb-2 text-[10px] uppercase tracking-wider" style={{ color: VIZ.textSecondary }}>
        {analysis.title} — {analysis.source}
      </div>
      <div className="relative">
        <div className="relative overflow-x-auto">
          <table className="w-full text-xs">
            <caption className="sr-only">
              {analysis.title}: {analysis.question} ({analysis.source})
            </caption>
            <thead>
              <tr className="border-b border-slate-700 text-left text-[10px] uppercase tracking-wider" style={{ color: VIZ.textSecondary }}>
                {grouped && <th scope="col" className={th}>Setting</th>}
                <th scope="col" className={th}>Method</th>
                <th scope="col" className={`${th} text-right`}>AP</th>
                {grouped && <th scope="col" className={`${th} text-right`}>vs CAVIS</th>}
                <th scope="col" className={`${th} text-right`}>FPS</th>
                <th scope="col" className={hasParams ? `${th} text-right` : lastTh}>GFLOPs</th>
                {hasParams && <th scope="col" className={lastTh}>Params</th>}
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {analysis.rows.map((r) => {
                const gap = gapToReference(analysis.rows, r);
                return (
                  <tr
                    key={r.id}
                    className="border-b border-slate-800"
                    style={{ color: r.isVidEoMT ? VIZ.textPrimary : VIZ.textSecondary, fontWeight: r.isVidEoMT ? 600 : 400 }}
                  >
                    {grouped && <td className="py-1.5 pr-3">{r.group}</td>}
                    <th scope="row" className="py-1.5 pr-3 text-left font-[inherit]">
                      {r.label}
                    </th>
                    <td className="py-1.5 pr-3 text-right">{r.ap.toFixed(1)}</td>
                    {grouped && <td className="py-1.5 pr-3 text-right">{gap === null ? '–' : formatDelta(gap)}</td>}
                    <td className="py-1.5 pr-3 text-right">{r.fps}</td>
                    <td className={hasParams ? 'py-1.5 pr-3 text-right' : lastTd}>{r.gflops}</td>
                    {hasParams && <td className={lastTd}>{r.params ?? '–'}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 sm:hidden"
          style={{ background: `linear-gradient(to left, ${VIZ.surface}, transparent)` }}
        />
      </div>
    </div>
  );
};

const Analyses: React.FC = () => {
  const [key, setKey] = useState(ANALYSES[0].key);
  const [view, setView] = useState<'chart' | 'table'>('chart');
  // What the readout shows (hover, focus or tap) and what a screen reader is told (focus or tap only).
  const [activeId, setActiveId] = useState<string | null>(null);
  const [announcedId, setAnnouncedId] = useState<string | null>(null);
  const activate = (id: string, announce: boolean) => {
    setActiveId(id);
    if (announce) setAnnouncedId(id);
  };

  const analysis = ANALYSES.find((a) => a.key === key)!;
  // A selection that belongs to another analysis simply stops matching.
  const active = analysis.rows.find((r) => r.id === activeId) ?? null;
  const announced = analysis.rows.find((r) => r.id === announcedId) ?? null;
  const activeGap = active ? gapToReference(analysis.rows, active) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Analysis" className="flex flex-wrap gap-1.5">
          {ANALYSES.map((a) => (
            <button
              key={a.key}
              type="button"
              aria-pressed={key === a.key}
              onClick={() => setKey(a.key)}
              className={`rounded px-2.5 py-1.5 text-[11px] font-mono transition-colors ${
                key === a.key ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {a.title}
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

      <div>
        <h3 className="text-sm font-semibold" style={{ color: VIZ.textPrimary }}>
          {analysis.question}
        </h3>
        <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: VIZ.textSecondary }}>
          {analysis.source} · {analysis.setup}
        </p>
      </div>

      <div className="rounded-lg border border-slate-800 p-4" style={{ background: VIZ.surface }}>
        {view === 'chart' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider" style={{ color: VIZ.textSecondary }}>
              <span>AP, with FPS beside it</span>
              <span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
                <span className="forced-color-adjust-none inline-block h-2.5 w-2.5 rounded-full" style={{ background: VIZ.series }} /> VidEoMT
                <span className="forced-color-adjust-none ml-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: VIZ.reference }} /> other
              </span>
            </div>
            <Bars analysis={analysis} activeId={active?.id ?? null} onActivate={activate} />
            {/* Stays on screen while the bars are in view, so a tapped row's numbers are never far away. */}
            <div
              className="sticky bottom-2 z-10 min-h-[3.25rem] rounded-lg border border-slate-700 px-4 py-2.5 text-xs shadow-lg shadow-black/40"
              style={{ background: VIZ.surface, color: VIZ.textSecondary }}
            >
              {active ? (
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="text-lg font-semibold tabular-nums" style={{ color: VIZ.textPrimary }}>
                    {active.ap.toFixed(1)} <span className="text-xs font-normal">AP</span>
                  </span>
                  <span style={{ color: VIZ.textPrimary }}>
                    {active.label}
                    {active.group ? ` · ${active.group}` : ''}
                  </span>
                  <span className="font-mono">
                    {active.fps} FPS · {active.gflops} GFLOPs{active.params ? ` · ${active.params} params` : ''}
                  </span>
                  {activeGap !== null && <Gap gap={activeGap} />}
                  {active.detail && <span className="basis-full">{active.detail}</span>}
                </div>
              ) : (
                <span>Hover, focus or tap a bar to read its numbers. The Table view lists every value.</span>
              )}
            </div>
            <div role="status" aria-live="polite" className="sr-only">
              {announced ? summary(announced, gapToReference(analysis.rows, announced)) : ''}
            </div>
          </div>
        ) : (
          <AnalysisTable analysis={analysis} />
        )}
      </div>

      <div className="rounded-lg border border-slate-800 px-4 py-3" style={{ background: VIZ.surface }}>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: VIZ.textSecondary }}>
          What the paper found
        </div>
        <p className="text-xs leading-relaxed" style={{ color: VIZ.textPrimary }}>
          {analysis.takeaway}
        </p>
        {analysis.note && (
          <p className="mt-2 text-[11px] leading-relaxed" style={{ color: VIZ.textSecondary }}>
            {analysis.note}
          </p>
        )}
      </div>
    </div>
  );
};

export default Analyses;
