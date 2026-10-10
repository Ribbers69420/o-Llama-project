import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EnterpriseQuantumVisualizer from './EnterpriseQuantumVisualizer';

// Static markup is enough here: these are regressions in what the component renders on first paint.
const html = renderToStaticMarkup(<EnterpriseQuantumVisualizer />);

describe('EnterpriseQuantumVisualizer', () => {
  it('renders the Ψ ket as glyphs, not as literal \\u escapes', () => {
    // JSX text does not process `\u` escapes (a JS string does), so a bare escape prints verbatim.
    expect(html).toContain('|Ψ_0⟩');
    expect(html).not.toMatch(/\\u[0-9a-fA-F]{4}/);
  });

  it('makes every tree node a keyboard-operable disclosure', () => {
    const toggles = html.match(/<div[^>]*role="button"[^>]*>/g) ?? [];
    expect(toggles).toHaveLength(11);
    for (const tag of toggles) {
      expect(tag).toMatch(/tabindex="0"/);
      expect(tag).toMatch(/aria-expanded="(true|false)"/);
    }
    // The tree opens with the root and the cognitive layer expanded.
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(2);
  });

  it('gives each colour-coded status dot a text alternative', () => {
    const labels = [...html.matchAll(/role="img" aria-label="(Status: [a-z]+)"/g)].map(m => m[1]);
    expect(labels.sort()).toEqual([
      'Status: active',
      'Status: active',
      'Status: active',
      'Status: optimizing',
      'Status: standby',
    ]);
  });

  it('starts at h1 and never skips a heading level', () => {
    const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map(m => Number(m[1]));
    expect(levels[0]).toBe(1);
    levels.slice(1).forEach((level, i) => expect(level).toBeLessThanOrEqual(levels[i] + 1));
  });
});
