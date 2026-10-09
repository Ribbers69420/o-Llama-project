// Chart tokens for the Φ-pipeline view. The series colour was checked with the
// dataviz palette validator against the slate-900 chart surface (#0f172a): it
// passes the lightness band, chroma floor and 3:1 contrast. Indigo-400, the app's
// accent, fails the lightness band, so data marks use this blue instead.
// Status colours carry state only and always ship with an icon and a label.
export const VIZ = {
  surface: '#0f172a', // slate-900
  grid: '#1e293b', // slate-800, hairline
  axis: '#334155', // slate-700, baseline
  reference: '#64748b', // slate-500, threshold and selection markers
  crosshair: '#94a3b8', // slate-400
  textPrimary: '#e2e8f0', // slate-200
  textSecondary: '#94a3b8', // slate-400
  textMuted: '#64748b', // slate-500
  series: '#3987e5',
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
} as const;

/** Bundled glyph subsets first (see src/assets/fonts), then the UI sans. */
export const GLYPH_FONT = "'UQCF Glyphs', ui-sans-serif, system-ui, sans-serif";

/** The same for monospaced text that can contain a glyph, such as "θ(🝞) 0.10 → 0.40". */
export const GLYPH_MONO_FONT =
  "'UQCF Glyphs', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
