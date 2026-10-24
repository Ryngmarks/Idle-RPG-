// Tiny presentation helpers: detect "something just happened" from state changes (no core changes,
// no timers, no per-frame loops). The returned counter is used as a React key to replay a CSS animation.

import { useEffect, useState } from 'react';

/** Counts how many times `hit(prev, next)` was true between renders. Safe derived-state pattern. */
export function useBump(value: number, hit: (prev: number, next: number) => boolean): number {
  const [s, setS] = useState({ v: value, n: 0 });
  if (s.v !== value) setS({ v: value, n: s.n + (hit(s.v, value) ? 1 : 0) });
  return s.n;
}

/** Bumps when the value grows by at least `min`. */
export function useRise(value: number, min = 0): number {
  return useBump(value, (p, n) => n - p >= min && n > p);
}

/** Bumps when a 0..1 progress value wraps around (a work cycle finished). */
export function useWrap(progress: number): number {
  return useBump(progress, (p, n) => p - n > 0.3);
}

/** Seconds per swing so a whole number of swings fits one work cycle (faster cycle = faster work). */
export function swingSeconds(cycleSec: number): number {
  if (!(cycleSec > 0) || !Number.isFinite(cycleSec)) return 1.3;
  const n = Math.max(1, Math.round(cycleSec / 1.4));
  return Math.max(0.45, Math.min(2.2, cycleSec / n));
}

/** Fired on `window` when something lands on a resource tile (loot from the battlefield): detail is the resource id. */
export const TILE_BUMP_EVENT = 'utposten:tile-bump';

export function bumpTile(res: string): void {
  window.dispatchEvent(new CustomEvent(TILE_BUMP_EVENT, { detail: res }));
}

/** Counts bump events aimed at one resource tile, so the tile can replay its pulse animation. */
export function useTileBump(res: string): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const on = (e: Event) => { if ((e as CustomEvent<string>).detail === res) setN((x) => x + 1); };
    window.addEventListener(TILE_BUMP_EVENT, on);
    return () => window.removeEventListener(TILE_BUMP_EVENT, on);
  }, [res]);
  return n;
}
