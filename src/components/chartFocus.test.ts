import { describe, expect, it } from 'vitest';
import { chartFocus } from './chartFocus';

describe('chartFocus', () => {
  it('reads out the hovered point, else the selected one', () => {
    expect(chartFocus(2, 5, 9)).toEqual({ hover: 2, focus: 2 });
    expect(chartFocus(null, 5, 9)).toEqual({ hover: null, focus: 5 });
  });

  it('ignores a hover left on a column that no longer exists', () => {
    // Depth 3 → 2 while the pointer rests on step 17 of 18: 14 steps remain.
    expect(chartFocus(17, 13, 14)).toEqual({ hover: null, focus: 13 });
    // Budget 6 → 2 while the pointer rests on run 3.
    expect(chartFocus(2, 1, 2)).toEqual({ hover: null, focus: 1 });
  });

  it('clamps the selection to the data', () => {
    expect(chartFocus(null, Number.MAX_SAFE_INTEGER, 4)).toEqual({ hover: null, focus: 3 });
    expect(chartFocus(null, -1, 4)).toEqual({ hover: null, focus: 0 });
  });
});
