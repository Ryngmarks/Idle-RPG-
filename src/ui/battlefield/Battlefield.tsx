import { useEffect, useRef } from 'react';
import { Renderer } from './renderer';
import type { FieldSnap } from './types';

/**
 * The living battlefield. React only passes the latest snapshot into a ref; the canvas renderer reads it
 * on its own animation loop, so nothing re-renders per frame.
 */
export function LivingBattlefield({ snap }: { snap: FieldSnap }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ref = useRef(snap);
  ref.current = snap;
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const r = new Renderer(el, () => ref.current);
    return () => r.destroy();
  }, []);
  const n = snap.troops.reduce((s, t) => s + t.size, 0);
  return (
    <canvas
      ref={canvas}
      className="living-bf"
      role="img"
      aria-label={n > 0 ? `Slagfältet: ${n} soldater strider mot ${snap.enemyName}` : 'Slagfältet: lägret väntar på en trupp'}
    />
  );
}
