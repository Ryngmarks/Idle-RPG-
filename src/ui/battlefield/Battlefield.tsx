import { useEffect, useRef } from 'react';
import { bumpTile } from '../fx';
import { LOOT_COLOR } from './palette';
import { Renderer } from './renderer';
import type { FieldPick, FieldSnap } from './types';

const FLY_POOL = 10;
const FLY_MS = 680;

/** Lightweight page overlay: loot icons fly from the canvas to the real resource tile, then the tile bumps. */
class LootFlight {
  private layer = document.createElement('div');
  private free: HTMLElement[] = [];
  private live = new Set<Animation>();

  constructor() {
    this.layer.className = 'loot-layer';
    this.layer.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < FLY_POOL; i++) {
      const el = document.createElement('i');
      el.className = 'loot-fly';
      this.layer.appendChild(el);
      this.free.push(el);
    }
    document.body.appendChild(this.layer);
  }

  launch(canvas: HTMLCanvasElement, res: string, x: number, y: number, fly: boolean): void {
    const tile = document.querySelector<HTMLElement>(`[data-res="${res}"]`);
    if (!fly || !tile) {
      bumpTile(res);
      return;
    }
    const el = this.free.pop();
    const c = canvas.getBoundingClientRect();
    const t = tile.getBoundingClientRect();
    if (!el || typeof el.animate !== 'function' || t.bottom < 0 || t.top > window.innerHeight) {
      if (el) this.free.push(el);
      bumpTile(res);
      return;
    }
    const x0 = c.left + x;
    const y0 = c.top + y;
    const x1 = t.left + t.width * 0.28;
    const y1 = t.top + t.height / 2;
    el.dataset.res = res;
    el.style.background = LOOT_COLOR[res] ?? '#ddd';
    el.style.display = 'block';
    const mx = (x0 + x1) / 2 + (x1 > x0 ? -18 : 18);
    const my = Math.min(y0, y1) + (y0 - y1) * 0.25;
    const a = el.animate(
      [
        { transform: `translate(${x0 - 6}px, ${y0 - 6}px) scale(1)`, opacity: 1 },
        { transform: `translate(${mx - 6}px, ${my - 6}px) scale(1.05)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${x1 - 6}px, ${y1 - 6}px) scale(0.55)`, opacity: 0.95 },
      ],
      { duration: FLY_MS, easing: 'cubic-bezier(0.45, 0.05, 0.75, 0.6)', fill: 'forwards' },
    );
    this.live.add(a);
    a.onfinish = () => {
      this.live.delete(a);
      el.style.display = 'none';
      this.free.push(el);
      bumpTile(res);
    };
  }

  destroy(): void {
    for (const a of this.live) { a.onfinish = null; a.cancel(); }
    this.layer.remove();
  }
}

/**
 * The living battlefield. React only passes the latest snapshot into a ref; the canvas renderer reads it
 * on its own animation loop, so nothing re-renders per frame. Taps are hit-tested by the scene.
 */
export function LivingBattlefield({ snap, onPick }: { snap: FieldSnap; onPick?: (p: FieldPick) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const rend = useRef<Renderer | null>(null);
  const ref = useRef(snap);
  ref.current = snap;
  const pick = useRef(onPick);
  pick.current = onPick;
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const r = new Renderer(el, () => ref.current);
    const flight = new LootFlight();
    r.scene.onLoot = (res, x, y, fly) => flight.launch(el, res, x, y, fly);
    rend.current = r;
    return () => {
      rend.current = null;
      r.destroy();
      flight.destroy();
    };
  }, []);
  const n = snap.troops.reduce((s, t) => s + t.size, 0);
  const tap = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = rend.current;
    if (!r) return;
    const b = e.currentTarget.getBoundingClientRect();
    const p = r.scene.pick(e.clientX - b.left, e.clientY - b.top);
    if (p) pick.current?.(p);
  };
  return (
    <canvas
      ref={canvas}
      className="living-bf"
      role="img"
      onClick={tap}
      aria-label={n > 0 ? `Slagfältet: ${n} soldater strider mot ${snap.enemyName}. Detaljer finns som knappar under bilden.` : 'Slagfältet: lägret väntar på en trupp'}
    />
  );
}
