// @vitest-environment jsdom

import { StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import QueryPropagationDemo from './QueryPropagationDemo';
import { DEMO_FRAMES } from './data';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root | null;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<QueryPropagationDemo />));
});

afterEach(() => {
  act(() => root?.unmount());
  container.remove();
  vi.clearAllTimers();
  vi.useRealTimers();
});

function controls() {
  return container.querySelectorAll('button');
}

function clickControl(index: number) {
  act(() => controls()[index].click());
}

function frameCards() {
  const strip = container.querySelector('.overflow-x-auto');
  if (!strip) throw new Error('Frame strip was not rendered');
  return Array.from(strip.children) as HTMLElement[];
}

function selectFrame(index: number) {
  act(() => frameCards()[index].click());
}

function state() {
  const activePhase = Array.from(container.querySelectorAll('div')).find(
    (element) => element.classList.contains('text-cyan-400') &&
      ['propagating', 'transforming', 'fusing', 'complete'].includes(element.textContent?.trim() ?? ''),
  );
  return {
    frame: frameCards().findIndex((card) => card.classList.contains('border-cyan-500')),
    phase: activePhase?.textContent?.trim(),
    playing: container.querySelector('.lucide-pause') !== null,
  };
}

function advance(milliseconds: number) {
  act(() => vi.advanceTimersByTime(milliseconds));
}

describe('QueryPropagationDemo timers', () => {
  it('completes the normal forward phases and allows stepping back', () => {
    clickControl(3);
    expect(state()).toEqual({ frame: 0, phase: 'propagating', playing: false });
    advance(400);
    expect(state().phase).toBe('transforming');
    advance(400);
    expect(state().phase).toBe('fusing');
    advance(400);
    expect(state()).toEqual({ frame: 1, phase: 'complete', playing: false });
    clickControl(1);
    expect(state()).toEqual({ frame: 0, phase: 'complete', playing: false });
  });

  it.each([0, 400, 800])('cancels playback when paused %ims into a transition', (elapsed) => {
    clickControl(2);
    advance(2000);
    advance(elapsed);
    clickControl(2);
    expect(state()).toEqual({ frame: 0, phase: 'complete', playing: false });
    advance(5000);
    expect(state()).toEqual({ frame: 0, phase: 'complete', playing: false });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([0, 400, 800])('keeps reset stable %ims into a transition', (elapsed) => {
    selectFrame(1);
    clickControl(2);
    advance(2000);
    advance(elapsed);
    clickControl(0);
    expect(state()).toEqual({ frame: 0, phase: 'complete', playing: false });
    advance(5000);
    expect(state()).toEqual({ frame: 0, phase: 'complete', playing: false });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops playback when a frame is selected before the first interval tick', () => {
    clickControl(2);
    advance(1000);
    selectFrame(2);
    expect(state()).toEqual({ frame: 2, phase: 'complete', playing: false });
    advance(5000);
    expect(state()).toEqual({ frame: 2, phase: 'complete', playing: false });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cannot advance beyond the final frame after resetting a transition from frame zero', () => {
    clickControl(3);
    advance(200);
    clickControl(0);
    const finalFrame = DEMO_FRAMES.length - 1;
    selectFrame(finalFrame);
    advance(5000);
    expect(state()).toEqual({ frame: finalFrame, phase: 'complete', playing: false });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([0, 400, 800])('preserves a manually selected frame %ims into a transition', (elapsed) => {
    clickControl(2);
    advance(2000);
    advance(elapsed);
    selectFrame(2);
    expect(state()).toEqual({ frame: 2, phase: 'complete', playing: false });
    advance(5000);
    expect(state()).toEqual({ frame: 2, phase: 'complete', playing: false });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears playback and phase timers on unmount', () => {
    clickControl(2);
    advance(2000);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    act(() => root?.unmount());
    root = null;
    expect(vi.getTimerCount()).toBe(0);
    advance(5000);
    expect(container.childElementCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('advances only once when forward is clicked twice before a render', () => {
    act(() => {
      controls()[3].click();
      controls()[3].click();
    });
    advance(1200);
    expect(state()).toEqual({ frame: 1, phase: 'complete', playing: false });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not overlap a manual step with the next autoplay tick', () => {
    clickControl(2);
    advance(1600);
    clickControl(3);
    advance(400);
    advance(800);
    expect(state().frame).toBe(1);
    advance(400);
    expect(state().frame).toBe(1);
    expect(state().phase).toBe('complete');
  });

  it('preserves autoplay through the final frame under StrictMode', () => {
    act(() => root?.render(<StrictMode><QueryPropagationDemo /></StrictMode>));
    clickControl(2);
    for (let frame = 1; frame < DEMO_FRAMES.length; frame += 1) {
      advance(2000);
      expect(state().phase).toBe('propagating');
      advance(1200);
      expect(state().frame).toBe(frame);
      expect(state().phase).toBe('complete');
    }
    advance(2000);
    expect(state()).toEqual({ frame: DEMO_FRAMES.length - 1, phase: 'complete', playing: false });
    clickControl(3);
    advance(5000);
    expect(state()).toEqual({ frame: DEMO_FRAMES.length - 1, phase: 'complete', playing: false });
    expect(vi.getTimerCount()).toBe(0);
  });
});
