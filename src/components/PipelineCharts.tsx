import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { GLYPH_FONT, VIZ } from './vizTokens';

// --- HELPERS ---

/** Column path with a 4px rounded data end and a square baseline. */
const columnPath = (x: number, y: number, w: number, y0: number): string => {
  const r = Math.min(4, (y0 - y) / 2, w / 2);
  if (r <= 0) return '';
  return `M${x},${y0} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y0} Z`;
};

// --- RESPONSE DISTRIBUTION ---

export const ResponseBars: React.FC<{
  probs: number[];
  labels: readonly string[];
  unsafeIndex: number;
}> = ({ probs, labels, unsafeIndex }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const W = 360;
  const H = 190;
  const m = { top: 22, right: 8, bottom: 38, left: 34 };
  const plotW = W - m.left - m.right;
  const plotH = H - m.top - m.bottom;
  const band = plotW / probs.length;
  const barW = 24;
  const y = (v: number) => m.top + plotH * (1 - v);
  const y0 = y(0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Response distribution">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={m.left} x2={W - m.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? VIZ.axis : VIZ.grid} strokeWidth={1} />
          <text x={m.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={VIZ.textMuted} className="tabular-nums">
            {t === 0 ? '0' : t.toFixed(2)}
          </text>
        </g>
      ))}
      {probs.map((p, k) => {
        const unsafe = k === unsafeIndex;
        const x = m.left + band * k + (band - barW) / 2;
        const cx = x + barW / 2;
        const active = hovered === k;
        return (
          <g
            key={labels[k]}
            tabIndex={0}
            role="img"
            aria-label={`${labels[k]}: probability ${p.toFixed(3)}${unsafe ? ', disallowed' : ''}`}
            onPointerEnter={() => setHovered(k)}
            onPointerLeave={() => setHovered(null)}
            onFocus={() => setHovered(k)}
            onBlur={() => setHovered(null)}
            className="outline-none"
          >
            {/* Hit target: the whole band, larger than the mark. */}
            <rect x={m.left + band * k} y={m.top} width={band} height={plotH} fill="transparent" />
            <path
              d={columnPath(x, y(p), barW, y0)}
              fill={unsafe ? VIZ.critical : VIZ.series}
              opacity={hovered === null || active ? 1 : 0.55}
            />
            <text x={cx} y={y(p) - 6} textAnchor="middle" fontSize={11} fill={VIZ.textPrimary} className="tabular-nums">
              {p.toFixed(2)}
            </text>
            <text x={cx} y={y0 + 14} textAnchor="middle" fontSize={11} fill={VIZ.textSecondary}>
              {labels[k]}
            </text>
            {unsafe && (
              <g>
                <AlertTriangle x={cx - 34} y={y0 + 20} width={11} height={11} color={VIZ.critical} />
                <text x={cx - 20} y={y0 + 29} fontSize={10} fill={VIZ.textSecondary}>
                  disallowed
                </text>
              </g>
            )}
            {active && (
              <g pointerEvents="none">
                <rect x={cx - 52} y={m.top - 20} width={104} height={20} rx={4} fill="#020617" stroke={VIZ.axis} />
                <text x={cx} y={m.top - 6} textAnchor="middle" fontSize={11} fill={VIZ.textPrimary}>
                  <tspan fontWeight={600} className="tabular-nums">{p.toFixed(3)}</tspan>
                  <tspan fill={VIZ.textSecondary}>{`  P(${labels[k]})`}</tspan>
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
};

// --- METRIC SMALL MULTIPLE ---

export interface MultipleProps {
  symbol: string;
  label: string;
  unit: string;
  values: number[];
  stepGlyphs: string[];
  domain: [number, number];
  digits: number;
  threshold?: { value: number; label: string };
  selected: number;
  hovered: number | null;
  onHover: (step: number | null) => void;
  onSelect: (step: number) => void;
}

export const MetricMultiple: React.FC<MultipleProps> = ({
  symbol,
  label,
  unit,
  values,
  stepGlyphs,
  domain,
  digits,
  threshold,
  selected,
  hovered,
  onHover,
  onSelect,
}) => {
  const W = 260;
  const H = 104;
  const m = { top: 8, right: 34, bottom: 20, left: 30 };
  const plotW = W - m.left - m.right;
  const plotH = H - m.top - m.bottom;
  const [lo, hi] = domain;
  const step = plotW / (values.length - 1);
  const x = (i: number) => m.left + step * i;
  const y = (v: number) => m.top + plotH * (1 - (v - lo) / (hi - lo || 1));
  const focus = hovered ?? selected;
  const fmt = (v: number) => v.toFixed(digits);
  const last = values.length - 1;
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
      {/* Readout: the value leads, the label follows. */}
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <div className="min-w-0">
          <div className="text-xs text-slate-300 font-mono truncate">{symbol}</div>
          <div className="text-[10px] text-slate-500 truncate">{label}</div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-sm font-semibold text-slate-100 tabular-nums">{fmt(values[focus])}</span>
          {unit && <span className="text-[10px] text-slate-500 ml-1">{unit}</span>}
          <div className="text-[10px] text-slate-500">
            at <span style={{ fontFamily: GLYPH_FONT }}>{stepGlyphs[focus]}</span>
          </div>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`${label} across pipeline steps`}
        onPointerLeave={() => onHover(null)}
      >
        {[lo, hi].map((t) => (
          <g key={t}>
            <line x1={m.left} x2={m.left + plotW} y1={y(t)} y2={y(t)} stroke={VIZ.grid} strokeWidth={1} />
            <text x={m.left - 5} y={y(t)} dy="0.32em" textAnchor="end" fontSize={9} fill={VIZ.textMuted} className="tabular-nums">
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </text>
          </g>
        ))}
        {lo < 0 && hi > 0 && (
          <line x1={m.left} x2={m.left + plotW} y1={y(0)} y2={y(0)} stroke={VIZ.axis} strokeWidth={1} />
        )}
        {threshold && threshold.value > lo && threshold.value < hi && (
          <g>
            <line x1={m.left} x2={m.left + plotW} y1={y(threshold.value)} y2={y(threshold.value)} stroke={VIZ.reference} strokeWidth={1} />
            <text x={m.left + plotW + 4} y={y(threshold.value)} dy="0.32em" fontSize={9} fill={VIZ.textMuted}>
              {threshold.label}
            </text>
          </g>
        )}
        {/* Selected step marker. */}
        <line x1={x(selected)} x2={x(selected)} y1={m.top} y2={m.top + plotH} stroke={VIZ.reference} strokeWidth={1} />
        {hovered !== null && hovered !== selected && (
          <line x1={x(hovered)} x2={x(hovered)} y1={m.top} y2={m.top + plotH} stroke={VIZ.crosshair} strokeWidth={1} />
        )}
        <path d={path} fill="none" stroke={VIZ.series} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(focus)} cy={y(values[focus])} r={4} fill={VIZ.series} stroke={VIZ.surface} strokeWidth={2} />
        {focus !== last && (
          <circle cx={x(last)} cy={y(values[last])} r={4} fill={VIZ.series} stroke={VIZ.surface} strokeWidth={2} />
        )}
        {/* End label, unless the threshold label already sits there. */}
        {(!threshold || Math.abs(y(values[last]) - y(threshold.value)) > 10) && (
          <text x={x(last) + 7} y={y(values[last])} dy="0.32em" fontSize={10} fill={VIZ.textSecondary} className="tabular-nums">
            {fmt(values[last])}
          </text>
        )}
        {stepGlyphs.map((g, i) => (
          <text key={i} x={x(i)} y={H - 5} textAnchor="middle" fontSize={9} fill={VIZ.textMuted} style={{ fontFamily: GLYPH_FONT }}>
            {g}
          </text>
        ))}
        {/* Hit targets: one full-height column per step. */}
        {values.map((_, i) => (
          <rect
            key={i}
            x={x(i) - step / 2}
            y={0}
            width={step}
            height={H}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onPointerEnter={() => onHover(i)}
            onClick={() => onSelect(i)}
          />
        ))}
      </svg>
    </div>
  );
};
