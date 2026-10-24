// requestAnimationFrame loop with a fixed-timestep clock. Pauses when the page is hidden, the canvas is
// off screen, or the renderer is stopped. Draws a calm, low-rate scene under prefers-reduced-motion.

import { Scene } from './scene';
import type { FieldSnap } from './types';

const STEP = 1 / 60;
const MAX_STEPS = 6;
const CALM_INTERVAL = 250;

export class Renderer {
  readonly scene = new Scene();
  private g: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private lastDraw = 0;
  private running = false;
  private visible = true;
  private lastSnap: FieldSnap | null = null;
  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;
  private mq: MediaQueryList | null = null;

  constructor(private canvas: HTMLCanvasElement, private getSnap: () => FieldSnap) {
    this.g = canvas.getContext('2d', { alpha: false })!;
    this.mq = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
    this.scene.calm = !!this.mq?.matches;
    this.mq?.addEventListener?.('change', this.onMotion);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    if ('IntersectionObserver' in window) {
      this.io = new IntersectionObserver((e) => {
        this.visible = e[e.length - 1]?.isIntersecting ?? true;
        this.kick();
      });
      this.io.observe(canvas);
    }
    this.resize();
    this.kick();
  }

  private onMotion = (): void => {
    this.scene.calm = !!this.mq?.matches;
    this.lastDraw = 0;
  };

  private onVisibility = (): void => this.kick();

  private resize(): void {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.scene.setSize(w, h, dpr);
    this.lastDraw = 0;
  }

  private shouldRun(): boolean {
    return document.visibilityState !== 'hidden' && this.visible;
  }

  private kick(): void {
    if (this.shouldRun()) {
      if (!this.running) {
        this.running = true;
        this.last = 0;
        this.raf = requestAnimationFrame(this.frame);
      }
    } else {
      this.running = false;
      cancelAnimationFrame(this.raf);
    }
  }

  private frame = (ts: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = this.last ? Math.min(0.25, (ts - this.last) / 1000) : 0;
    this.last = ts;
    const snap = this.getSnap();
    if (snap !== this.lastSnap) {
      this.lastSnap = snap;
      this.scene.sync(snap);
    }
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_STEPS) {
      this.scene.update(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) this.acc = 0;
    if (this.scene.calm && ts - this.lastDraw < CALM_INTERVAL) return;
    this.lastDraw = ts;
    this.scene.draw(this.g);
  };

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.io?.disconnect();
    this.mq?.removeEventListener?.('change', this.onMotion);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}
