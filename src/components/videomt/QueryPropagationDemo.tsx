import React, { useEffect, useReducer, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, RotateCcw } from 'lucide-react';
import { DEMO_FRAMES, DEMO_SLOTS } from './data';
import { demoReducer, initialDemoState, LAST } from './demoMachine';
import { inkFor } from './vizMath';
import type { AnimationPhase, FrameState, ObjectQuery } from './types';
import { VIZ } from '../vizTokens';

const PHASE_MS = 400; // time each phase of a step is shown
const DWELL_MS = 1600; // autoplay pause on a finished frame

const PHASES: AnimationPhase[] = ['propagating', 'transforming', 'fusing', 'complete'];
const PHASE_TEXT: Record<AnimationPhase, string> = {
  propagating: 'The output queries of frame t−1 become Q_prev.',
  transforming: 'A linear layer transforms Q_prev.',
  fusing: 'Linear(Q_prev) is added element-wise to Q_learned.',
  complete: 'Q_fused enters the last L₂ ViT blocks; the output queries become the next Q_prev.',
};

const LEARNED = VIZ.reference; // a learned query: no object bound to it
/** The object (if any) that each query slot follows in a frame. */
const bindings = (frame: FrameState): (ObjectQuery | null)[] =>
  Array.from({ length: DEMO_SLOTS }, (_, k) => frame.objects.find((o) => o.slot === k) ?? null);

/** An object's shape inside a (x, y, w, h) box, in whatever SVG units the caller uses. */
const Glyph: React.FC<{ o: ObjectQuery; x: number; y: number; w: number; h: number; opacity?: number }> = ({
  o, x, y, w, h, opacity = 1,
}) => {
  const common = { fill: o.color, opacity };
  switch (o.shape) {
    case 'ellipse':
      return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...common} />;
    case 'circle':
      return <circle cx={x + w / 2} cy={y + h / 2} r={Math.min(w, h) / 2} {...common} />;
    case 'triangle':
      return <polygon points={`${x + w / 2},${y} ${x + w},${y + h} ${x},${y + h}`} {...common} />;
    default:
      return <rect x={x} y={y} width={w} height={h} rx={2} {...common} />;
  }
};

type TileKind = 'learned' | 'tracked' | 'fused';

/** One row of query slots. Colour comes with a letter and the slot number, never alone. */
const SlotRow: React.FC<{
  kind: TileKind;
  slots: (ObjectQuery | null)[];
  className?: string;
  glowNew?: boolean;
}> = ({ kind, slots, className = '', glowNew = false }) => (
  <ol className={`grid grid-cols-8 gap-1 transition-all duration-300 ${className}`}>
    {slots.map((slotObj, k) => {
      // Learned queries and idle fused slots are plain learned vectors; a tracked slot that
      // predicted no object is drawn hollow.
      const o = kind === 'learned' ? null : slotObj;
      const hollow = kind === 'tracked' && o === null;
      const fill = o ? o.color : hollow ? 'transparent' : LEARNED;
      const ink = hollow ? VIZ.textSecondary : inkFor(fill);
      return (
        <li
          key={k}
          className="flex aspect-square min-w-0 flex-col items-center justify-center rounded text-[10px] leading-none"
          style={{
            background: fill,
            color: ink,
            border: hollow ? `1px solid ${VIZ.reference}` : '1px solid transparent',
            boxShadow: glowNew && o?.isNew ? `0 0 0 2px ${VIZ.surface}, 0 0 0 4px #6ee7b7` : undefined,
          }}
        >
          <span className="text-xs font-semibold">{o ? o.label[0] : ''}</span>
          <span className="font-mono">{k}</span>
        </li>
      );
    })}
  </ol>
);

const Card: React.FC<{
  title: string;
  active: boolean;
  dim?: boolean;
  caption: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ title, active, dim = false, caption, className = '', children }) => (
  <div
    className={`rounded-lg border p-3 transition-colors duration-300 ${className}`}
    style={{
      background: VIZ.surface,
      borderColor: active ? '#22d3ee' : '#334155',
    }}
  >
    <div className="mb-2 font-mono text-[11px] tracking-wide text-slate-300">{title}</div>
    <div className={`transition-opacity duration-300 ${dim ? 'opacity-40' : 'opacity-100'}`}>{children}</div>
    <div className="mt-2 text-[11px] leading-snug text-slate-400">{caption}</div>
  </div>
);

const btn =
  'rounded-lg bg-slate-800 p-2 text-slate-300 transition-colors hover:bg-slate-700 hover:text-slate-100 ' +
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-800 disabled:hover:text-slate-300 ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-slate-300';

const QueryPropagationDemo: React.FC = () => {
  const [state, dispatch] = useReducer(demoReducer, initialDemoState);
  const { frame: currentFrame, phase, playing } = state;
  const stripRef = useRef<HTMLDivElement>(null);

  // The reducer owns what a step is (see demoMachine.ts); the effects only supply the clock.
  // Each phase lasts PHASE_MS. The effect depends on the phase, so its cleanup cancels the
  // pending timer on Reset and on unmount.
  useEffect(() => {
    if (phase === 'complete') return;
    const id = setTimeout(() => dispatch({ type: 'tick' }), PHASE_MS);
    return () => clearTimeout(id);
  }, [phase]);

  // Autoplay: after a dwell on a finished frame, start the next step.
  useEffect(() => {
    if (!playing || phase !== 'complete') return;
    const id = setTimeout(() => dispatch({ type: 'step' }), DWELL_MS);
    return () => clearTimeout(id);
  }, [playing, phase]);

  // While a step runs, show the frame it is heading for, so every phase animates the queries
  // that really are being propagated.
  const shownFrame = phase === 'complete' ? currentFrame : Math.min(currentFrame + 1, LAST);
  const frame = DEMO_FRAMES[shownFrame];
  const prevFrame = shownFrame > 0 ? DEMO_FRAMES[shownFrame - 1] : null;
  const idle = phase === 'complete';

  // Keep the current thumbnail in view when the strip scrolls (phones).
  useEffect(() => {
    const strip = stripRef.current;
    const tile = strip?.children[shownFrame] as HTMLElement | undefined;
    if (!strip || !tile) return;
    strip.scrollTo({ left: tile.offsetLeft - (strip.clientWidth - tile.offsetWidth) / 2 });
  }, [shownFrame]);

  const stepForward = () => dispatch({ type: 'step' });
  const stepBack = () => dispatch({ type: 'back' });
  const reset = () => dispatch({ type: 'reset' });
  const togglePlay = () => dispatch({ type: 'togglePlay' });
  const goTo = (i: number) => dispatch({ type: 'goto', frame: i });

  const prevSlots = prevFrame ? bindings(prevFrame) : null;
  const slots = bindings(frame);
  const newObject = frame.objects.find((o) => o.isNew);
  const status = idle
    ? `Frame t=${currentFrame}. ${frame.objects.map((o) => `slot ${o.slot} follows ${o.label}${o.isNew ? ' (new)' : ''}`).join(', ')}.`
    : '';

  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-slate-400">
        A schematic of one query slot per object. The paper uses N = 200 learnable queries; {DEMO_SLOTS} are drawn.
        The objects and confidences are made up.
      </p>

      {/* Frame strip */}
      <div ref={stripRef} role="group" aria-label="Demo frames" className="relative flex gap-2 overflow-x-auto pb-2">
        {DEMO_FRAMES.map((f, i) => (
          <button
            key={f.frameIndex}
            type="button"
            aria-label={`Show frame t=${i}`}
            aria-current={i === shownFrame ? 'step' : undefined}
            disabled={!idle}
            onClick={() => goTo(i)}
            className={`relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border-2 bg-slate-900 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-default ${
              i === shownFrame ? 'border-cyan-400' : 'border-slate-700 hover:border-slate-500'
            }`}
          >
            <span className="absolute left-1 top-1 rounded bg-slate-900/80 px-1 font-mono text-[10px] text-slate-400">t={i}</span>
            <svg viewBox="0 0 100 80" className="h-full w-full" aria-hidden="true">
              {f.objects.map((o) => (
                <Glyph key={o.id} o={o} x={o.x} y={o.y} w={o.width} h={o.height} opacity={i <= shownFrame ? 0.9 : 0.3} />
              ))}
            </svg>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <button type="button" aria-label="Reset to frame 0" onClick={reset} className={btn}>
          <RotateCcw className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Previous frame" onClick={stepBack} disabled={currentFrame === 0 || !idle} className={btn}>
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={playing ? 'Pause' : currentFrame === LAST ? 'Replay' : 'Play'}
          onClick={togglePlay}
          className="rounded-lg bg-cyan-700 p-3 text-white outline-none transition-colors hover:bg-cyan-600 focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <button type="button" aria-label="Next frame" onClick={stepForward} disabled={currentFrame === LAST || !idle} className={btn}>
          <SkipForward className="h-4 w-4" />
        </button>
      </div>

      {/* Query state */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card
          title="Q_learned"
          active={false}
          caption="The same learned vectors in every frame, so they can pick up objects that appear later."
        >
          <SlotRow kind="learned" slots={Array.from({ length: DEMO_SLOTS }, () => null)} />
        </Card>

        <Card
          title="Linear(Q_prev)"
          active={phase === 'propagating' || phase === 'transforming'}
          caption={
            prevSlots
              ? 'Output queries of frame t−1 through a linear layer. Hollow: the query predicted no object.'
              : 'Frame 0 has no previous frame, so only the learned queries are used.'
          }
        >
          {prevSlots ? (
            <SlotRow
              kind="tracked"
              slots={prevSlots}
              className={
                phase === 'propagating' ? 'translate-x-2 opacity-60' : phase === 'transforming' ? 'scale-95 opacity-80' : ''
              }
            />
          ) : (
            <div className="flex aspect-[8/1] min-h-9 items-center text-xs text-slate-400">No Q_prev at t=0</div>
          )}
        </Card>

        <Card
          title={prevSlots ? 'Q_fused = Linear(Q_prev) + Q_learned' : 'Q_fused = Q_learned (t=0)'}
          active={phase === 'fusing'}
          dim={phase === 'propagating' || phase === 'transforming'}
          caption="Past context plus the learned queries. This is what the last L₂ ViT blocks receive with the patch tokens."
        >
          <SlotRow kind="fused" slots={prevSlots ?? Array.from({ length: DEMO_SLOTS }, () => null)} />
        </Card>

        <Card
          className="md:col-span-3"
          title="Output queries at frame t (they become Q_prev for frame t+1)"
          active={phase === 'complete'}
          dim={!idle}
          caption={
            newObject
              ? `A new object (${newObject.label}) takes slot ${newObject.slot}, which was idle until now.`
              : 'Each slot keeps following the same object. Hollow slots are free for objects that appear later.'
          }
        >
          <div className="max-w-md">
            <SlotRow kind="tracked" slots={slots} glowNew />
          </div>
        </Card>
      </div>

      {/* Phase indicator */}
      <div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[11px]">
          {PHASES.map((p) => (
            <div key={p} className={`flex items-center gap-1 transition-colors ${phase === p ? 'text-cyan-300' : 'text-slate-400'}`}>
              <div className={`h-2 w-2 rounded-full transition-colors ${phase === p ? 'bg-cyan-300 motion-safe:animate-pulse' : 'bg-slate-600'}`} />
              {p}
            </div>
          ))}
        </div>
        <p className="mt-2 min-h-8 text-center text-xs text-slate-400">{PHASE_TEXT[phase]}</p>
      </div>

      {/* Legend */}
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        {frame.objects.map((o) => (
          <li key={o.id} className="flex items-center gap-2 text-xs text-slate-300">
            <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
              <Glyph o={o} x={1} y={1} w={10} h={10} />
            </svg>
            <span className="font-mono">
              {o.label}
              <span className="ml-1 text-slate-400">slot {o.slot} · {(o.confidence * 100).toFixed(0)}%</span>
              {o.isNew && <span className="ml-1 text-emerald-300">NEW</span>}
            </span>
          </li>
        ))}
      </ul>

      <div role="status" aria-live="polite" className="sr-only">
        {status}
      </div>
    </div>
  );
};

export default QueryPropagationDemo;
