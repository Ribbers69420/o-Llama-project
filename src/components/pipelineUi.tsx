import React from 'react';
import { GLYPH_FONT } from './vizTokens';

// Small building blocks shared by the Φ-pipeline view and its feedback-loop panel.

export const Glyph: React.FC<{ children: string; className?: string }> = ({ children, className = '' }) => (
  <span className={className} style={{ fontFamily: GLYPH_FONT }}>
    {children}
  </span>
);

export const Panel: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
}> = ({ title, icon, children, aside }) => (
  <section className="bg-slate-900/50 rounded-xl border border-slate-800 p-5 shadow-2xl">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h2 className="text-sm font-bold flex items-center gap-2 text-slate-200">
        <span className="text-slate-400">{icon}</span>
        {title}
      </h2>
      {aside}
    </div>
    {children}
  </section>
);

export const Slider: React.FC<{
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

/** Outcome banner: the status colour always comes with an icon and a title. */
export const StatusBanner: React.FC<{
  color: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}> = ({ color, icon, title, body }) => (
  <div
    role="status"
    aria-live="polite"
    className="flex items-start gap-3 p-4 rounded-lg bg-slate-900 border"
    style={{ borderColor: color }}
  >
    <span className="shrink-0 mt-0.5" style={{ color }}>
      {icon}
    </span>
    <div>
      <div className="text-sm font-bold text-slate-100">{title}</div>
      <p className="text-xs text-slate-400 mt-1">{body}</p>
    </div>
  </div>
);
