import { DEMO_FRAMES } from './data';
import type { AnimationPhase } from './types';

/** Index of the last demo frame. */
export const LAST = DEMO_FRAMES.length - 1;

export interface DemoState {
  /** The frame whose queries have been committed. While a step runs, the next frame is shown. */
  frame: number;
  phase: AnimationPhase;
  playing: boolean;
}

export type DemoAction =
  | { type: 'step' } // start a step to the next frame (Next button, or autoplay after its dwell)
  | { type: 'tick' } // the timer of the current phase fired
  | { type: 'back' }
  | { type: 'goto'; frame: number }
  | { type: 'reset' }
  | { type: 'togglePlay' };

export const initialDemoState: DemoState = { frame: 0, phase: 'complete', playing: false };

const NEXT_PHASE: Record<Exclude<AnimationPhase, 'complete'>, AnimationPhase> = {
  propagating: 'transforming',
  transforming: 'fusing',
  fusing: 'complete', // committing the frame happens on this transition
};

/**
 * One step is a chain of ticks: propagating → transforming → fusing → complete. The frame only
 * changes on the last tick, a step can only start from 'complete', and Back/Next/Go-to are ignored
 * while a step runs, so two steps can never overlap and the frame can never leave [0, LAST].
 * Pure, so every reachable state can be checked in demoMachine.test.ts.
 */
export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  const idle = state.phase === 'complete';
  switch (action.type) {
    case 'step':
      return idle && state.frame < LAST ? { ...state, phase: 'propagating' } : state;

    case 'tick': {
      if (state.phase === 'complete') return state;
      const phase = NEXT_PHASE[state.phase];
      if (phase !== 'complete') return { ...state, phase };
      const frame = Math.min(state.frame + 1, LAST);
      // Autoplay ends by itself when it reaches the last frame.
      return { frame, phase: 'complete', playing: state.playing && frame < LAST };
    }

    case 'back':
      return idle && state.frame > 0 ? { frame: state.frame - 1, phase: 'complete', playing: false } : state;

    case 'goto':
      if (!idle || !Number.isInteger(action.frame) || action.frame < 0 || action.frame > LAST) return state;
      return { frame: action.frame, phase: 'complete', playing: false };

    case 'reset':
      return initialDemoState;

    case 'togglePlay':
      // On the last frame, Play means "replay from the start".
      if (idle && state.frame === LAST) return { frame: 0, phase: 'complete', playing: true };
      return { ...state, playing: !state.playing };
  }
}
