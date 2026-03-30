import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, RotateCcw } from 'lucide-react';
import { DEMO_FRAMES } from './data';
import type { AnimationPhase } from './types';

const QueryPropagationDemo: React.FC = () => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [phase, setPhase] = useState<AnimationPhase>('complete');

  const advanceFrame = useCallback(() => {
    if (currentFrame < DEMO_FRAMES.length - 1) {
      setPhase('propagating');
      setTimeout(() => setPhase('transforming'), 400);
      setTimeout(() => setPhase('fusing'), 800);
      setTimeout(() => {
        setPhase('complete');
        setCurrentFrame((f) => f + 1);
      }, 1200);
    } else {
      setIsPlaying(false);
    }
  }, [currentFrame]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(advanceFrame, 2000);
    return () => clearInterval(timer);
  }, [isPlaying, advanceFrame]);

  const stepForward = () => {
    if (currentFrame < DEMO_FRAMES.length - 1 && phase === 'complete') {
      advanceFrame();
    }
  };

  const stepBack = () => {
    if (currentFrame > 0 && phase === 'complete') {
      setCurrentFrame((f) => f - 1);
    }
  };

  const reset = () => {
    setIsPlaying(false);
    setCurrentFrame(0);
    setPhase('complete');
  };

  const frame = DEMO_FRAMES[currentFrame];
  const prevFrame = currentFrame > 0 ? DEMO_FRAMES[currentFrame - 1] : null;

  return (
    <div className="space-y-5">
      {/* Frame strip */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {DEMO_FRAMES.map((f, i) => (
          <div
            key={i}
            className={`relative shrink-0 w-28 h-20 rounded-lg border-2 transition-all duration-300 ${
              i === currentFrame
                ? 'border-cyan-500 shadow-lg shadow-cyan-500/20'
                : i < currentFrame
                ? 'border-slate-600 opacity-70'
                : 'border-slate-700 opacity-40'
            } bg-slate-900 overflow-hidden cursor-pointer`}
            onClick={() => { if (phase === 'complete') setCurrentFrame(i); }}
          >
            {/* Frame label */}
            <div className="absolute top-1 left-1 text-[8px] font-mono text-slate-500 bg-slate-900/80 px-1 rounded">
              t={i}
            </div>
            {/* Objects as colored rectangles */}
            <svg viewBox="0 0 100 80" className="w-full h-full">
              {f.objects.map((obj) => (
                <rect
                  key={obj.id}
                  x={obj.x}
                  y={obj.y}
                  width={obj.width}
                  height={obj.height}
                  fill={obj.color}
                  opacity={i <= currentFrame ? 0.7 : 0.2}
                  rx={2}
                />
              ))}
            </svg>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <button onClick={reset} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors">
          <RotateCcw className="w-4 h-4" />
        </button>
        <button onClick={stepBack} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors" disabled={currentFrame === 0}>
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-3 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        <button onClick={stepForward} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors" disabled={currentFrame === DEMO_FRAMES.length - 1}>
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Query state visualization */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Learned queries */}
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-3">
          <div className="text-[10px] uppercase tracking-wider text-purple-400 mb-2 font-mono">Q_learned</div>
          <div className="flex gap-1 flex-wrap">
            {frame.objects.map((obj) => (
              <div
                key={`learned-${obj.id}`}
                className={`h-6 rounded transition-all duration-500 flex items-center justify-center text-[8px] font-mono text-white/80 ${
                  phase === 'fusing' || phase === 'complete' ? 'opacity-100' : 'opacity-40'
                }`}
                style={{ backgroundColor: '#a855f7', width: `${100 / frame.objects.length - 2}%`, minWidth: 40 }}
              >
                {obj.label}
              </div>
            ))}
          </div>
          <div className="text-[9px] text-slate-500 mt-2 font-mono">Adaptability for new objects</div>
        </div>

        {/* Propagated queries (from previous frame) */}
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-3">
          <div className="text-[10px] uppercase tracking-wider text-cyan-400 mb-2 font-mono">
            Linear(Q_prev)
          </div>
          <div className="flex gap-1 flex-wrap">
            {prevFrame ? prevFrame.objects.map((obj) => (
              <div
                key={`prop-${obj.id}`}
                className={`h-6 rounded flex items-center justify-center text-[8px] font-mono text-white/80 transition-all duration-500 ${
                  phase === 'propagating' ? 'translate-x-2 opacity-60' :
                  phase === 'transforming' ? 'scale-95 opacity-80' :
                  'opacity-100'
                }`}
                style={{ backgroundColor: obj.color, width: `${100 / prevFrame.objects.length - 2}%`, minWidth: 40 }}
              >
                {obj.label}
              </div>
            )) : (
              <div className="text-[9px] text-slate-600 font-mono">No previous frame (t=0)</div>
            )}
          </div>
          <div className="text-[9px] text-slate-500 mt-2 font-mono">Temporal context from t-1</div>
        </div>

        {/* Fused queries */}
        <div className={`rounded-lg border p-3 transition-all duration-500 ${
          phase === 'complete'
            ? 'bg-cyan-950/30 border-cyan-500/50'
            : 'bg-slate-800/50 border-slate-700'
        }`}>
          <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-2 font-mono">
            Q_fused = Linear(Q_prev) + Q_learned
          </div>
          <div className="flex gap-1 flex-wrap">
            {frame.objects.map((obj) => (
              <div
                key={`fused-${obj.id}`}
                className={`h-6 rounded flex items-center justify-center text-[8px] font-mono text-white/80 transition-all duration-500 ${
                  phase === 'complete' ? 'opacity-100 scale-100' : 'opacity-30 scale-95'
                }`}
                style={{
                  backgroundColor: obj.color,
                  width: `${100 / frame.objects.length - 2}%`,
                  minWidth: 40,
                  boxShadow: obj.isNew && phase === 'complete' ? '0 0 8px rgba(16, 185, 129, 0.5)' : 'none',
                }}
              >
                {obj.label}
                {obj.isNew && <span className="ml-1 text-emerald-300">*</span>}
              </div>
            ))}
          </div>
          <div className="text-[9px] text-slate-500 mt-2 font-mono">
            {frame.objects.some(o => o.isNew)
              ? 'New object detected via learned queries!'
              : 'Fed into last L₂ ViT blocks'}
          </div>
        </div>
      </div>

      {/* Phase indicator */}
      <div className="flex items-center justify-center gap-4 text-[10px] font-mono">
        {(['propagating', 'transforming', 'fusing', 'complete'] as AnimationPhase[]).map((p) => (
          <div key={p} className={`flex items-center gap-1 transition-colors ${phase === p ? 'text-cyan-400' : 'text-slate-600'}`}>
            <div className={`w-2 h-2 rounded-full transition-colors ${phase === p ? 'bg-cyan-400 animate-pulse' : 'bg-slate-700'}`} />
            {p}
          </div>
        ))}
      </div>

      {/* Object tracking legend */}
      <div className="flex flex-wrap gap-3 justify-center">
        {frame.objects.map((obj) => (
          <div key={obj.id} className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: obj.color }} />
            <span className="font-mono text-slate-400">
              {obj.label}
              <span className="text-slate-600 ml-1">({(obj.confidence * 100).toFixed(0)}%)</span>
              {obj.isNew && <span className="text-emerald-400 ml-1">NEW</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QueryPropagationDemo;
