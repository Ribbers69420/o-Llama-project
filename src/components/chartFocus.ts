/**
 * Which point a small-multiple chart reads out: the hovered one, else the
 * selected one. Both are clamped to the current data, because the step or
 * run count can shrink while the pointer rests on a column that no longer
 * exists (a removed element never fires pointerleave).
 */
export const chartFocus = (
  hovered: number | null,
  selected: number,
  count: number,
): { hover: number | null; focus: number } => {
  const hover = hovered !== null && hovered >= 0 && hovered < count ? hovered : null;
  return { hover, focus: hover ?? Math.max(0, Math.min(selected, count - 1)) };
};
