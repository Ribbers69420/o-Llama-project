import { describe, expect, it } from 'vitest';
import { demoReducer, initialDemoState, LAST } from './demoMachine';
import type { DemoAction, DemoState } from './demoMachine';

const PHASES = ['propagating', 'transforming', 'fusing', 'complete'];

// Every action the UI can send, plus targets the UI never sends but a bug could.
const ACTIONS: DemoAction[] = [
  { type: 'step' },
  { type: 'tick' },
  { type: 'back' },
  { type: 'reset' },
  { type: 'togglePlay' },
  ...Array.from({ length: LAST + 1 }, (_, frame) => ({ type: 'goto', frame }) as DemoAction),
  { type: 'goto', frame: -1 },
  { type: 'goto', frame: LAST + 1 },
  { type: 'goto', frame: 2.5 },
  { type: 'goto', frame: NaN },
];

const key = (s: DemoState) => `${s.frame}/${s.phase}/${s.playing}`;

/** Every state reachable from the start, with every transition out of it (the space is finite). */
function explore() {
  const seen = new Map<string, DemoState>([[key(initialDemoState), initialDemoState]]);
  const transitions: { from: DemoState; action: DemoAction; to: DemoState }[] = [];
  const queue = [initialDemoState];
  while (queue.length) {
    const from = queue.shift()!;
    for (const action of ACTIONS) {
      const to = demoReducer(from, action);
      transitions.push({ from, action, to });
      if (!seen.has(key(to))) {
        seen.set(key(to), to);
        queue.push(to);
      }
    }
  }
  return { states: [...seen.values()], transitions };
}

describe('demo state machine', () => {
  const { states, transitions } = explore();

  it('explores a finite state space that includes the start and the last frame', () => {
    expect(states.length).toBeGreaterThan(10);
    expect(states.length).toBeLessThanOrEqual((LAST + 1) * PHASES.length * 2);
    expect(states.some((s) => s.frame === LAST && s.phase === 'complete')).toBe(true);
  });

  it('never leaves the frame range, whatever is sent (the crash this guards against)', () => {
    for (const s of states) {
      expect(Number.isInteger(s.frame)).toBe(true);
      expect(s.frame).toBeGreaterThanOrEqual(0);
      expect(s.frame).toBeLessThanOrEqual(LAST);
    }
    for (const t of transitions) {
      expect(t.to.frame).toBeGreaterThanOrEqual(0);
      expect(t.to.frame).toBeLessThanOrEqual(LAST);
    }
  });

  it('only runs a step when there is a next frame, and only autoplays when there is one too', () => {
    for (const s of states) {
      expect(PHASES).toContain(s.phase);
      if (s.phase !== 'complete') expect(s.frame).toBeLessThan(LAST);
      if (s.playing) expect(s.frame).toBeLessThan(LAST);
    }
  });

  it('ignores Next, Back and Go-to while a step is running, so two steps never overlap', () => {
    const busy = transitions.filter((t) => t.from.phase !== 'complete' && ['step', 'back', 'goto'].includes(t.action.type));
    expect(busy.length).toBeGreaterThan(0);
    for (const t of busy) expect(t.to).toEqual(t.from);
  });

  it('commits the next frame only on the last tick of a step, after exactly three ticks', () => {
    for (const from of states.filter((s) => s.phase === 'propagating')) {
      const a = demoReducer(from, { type: 'tick' });
      const b = demoReducer(a, { type: 'tick' });
      const c = demoReducer(b, { type: 'tick' });
      expect([a.phase, b.phase, c.phase]).toEqual(['transforming', 'fusing', 'complete']);
      expect(a.frame).toBe(from.frame);
      expect(b.frame).toBe(from.frame);
      expect(c.frame).toBe(from.frame + 1);
    }
  });

  it('ignores a tick when nothing is running', () => {
    for (const s of states.filter((x) => x.phase === 'complete')) expect(demoReducer(s, { type: 'tick' })).toEqual(s);
  });

  it('Reset goes back to the start from every state, mid-step included', () => {
    for (const s of states) expect(demoReducer(s, { type: 'reset' })).toEqual(initialDemoState);
  });

  it('stops autoplay on arriving at the last frame, and Play there replays from the start', () => {
    const last: DemoState = { frame: LAST, phase: 'complete', playing: false };
    expect(demoReducer(last, { type: 'togglePlay' })).toEqual({ frame: 0, phase: 'complete', playing: true });
    const lastStep: DemoState = { frame: LAST - 1, phase: 'fusing', playing: true };
    expect(demoReducer(lastStep, { type: 'tick' })).toEqual({ frame: LAST, phase: 'complete', playing: false });
  });

  it('Back and Go-to stop autoplay, so a navigation is not undone a moment later', () => {
    const playing: DemoState = { frame: 3, phase: 'complete', playing: true };
    expect(demoReducer(playing, { type: 'back' }).playing).toBe(false);
    expect(demoReducer(playing, { type: 'goto', frame: 1 }).playing).toBe(false);
  });

  it('rejects out-of-range and non-integer Go-to targets', () => {
    const at: DemoState = { frame: 2, phase: 'complete', playing: false };
    for (const frame of [-1, LAST + 1, 2.5, NaN, Infinity]) expect(demoReducer(at, { type: 'goto', frame })).toEqual(at);
  });

  it('still clamps the frame if it is ever handed a corrupt state (defence in depth)', () => {
    // Not reachable through the actions above: the guards already prevent it. This is the backstop.
    const corrupt: DemoState = { frame: LAST, phase: 'fusing', playing: true };
    expect(demoReducer(corrupt, { type: 'tick' })).toEqual({ frame: LAST, phase: 'complete', playing: false });
  });

  it('can reach every frame by stepping, with no frame skipped', () => {
    let s = initialDemoState;
    const visited = [s.frame];
    for (let i = 0; i < LAST; i++) {
      s = demoReducer(s, { type: 'step' });
      while (s.phase !== 'complete') s = demoReducer(s, { type: 'tick' });
      visited.push(s.frame);
    }
    expect(visited).toEqual(Array.from({ length: LAST + 1 }, (_, i) => i));
    expect(demoReducer(s, { type: 'step' })).toEqual(s); // nothing after the last frame
  });
});
