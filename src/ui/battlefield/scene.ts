// The living battlefield scene. It interpolates visuals from the real numbers in a FieldSnap and never
// simulates anything: kills, hp, wounds and timings all come from the core via snapshot.ts.

import { fmtRate } from '../format';
import { BANDS, LOOT_COLOR, RESOURCE_ORDER, racePalette } from './palette';
import { ENEMY_H, ENEMY_W, HAND_X, HAND_Y, SOLDIER_AX, SOLDIER_AY, SOLDIER_H, SOLDIER_W, enemySprite, familyOf, rangedKind, renderBackground, renderMist, soldierSprite, type Family } from './sprites';
import type { FieldPick, FieldSnap, FieldTroop } from './types';

const MAX_FIG = 12;
const POOL = 128;
const FAMILY_SCALE: Record<Family, number> = { bird: 0.6, beast: 0.8, swarm: 0.85, frog: 0.75, human: 0.82, spirit: 0.95, brute: 1.15 };

// particle kinds
const DMG = 1;
const LOOT = 2;
const SPARK = 3;
const MOTE = 4;
const RING = 5;
const TEXT = 6;
const PROJ = 7;

class Particle {
  active = false;
  kind = 0;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  t = 0;
  life = 1;
  text = '';
  color = '';
  ri = 0;
  sx = 0;
  sy = 0;
  size = 1;
}

interface TroopVis {
  id: string;
  shown: number;
  born: number[];
  off: number[];
  level: number;
  flash: number;
  cycle: number;
  wound: number;
  /** When this troop was last struck by the foe, and the damage waiting to be shown as a number. */
  hitAt: number;
  pendingIn: number;
  /** Real soldier count last seen (drawn figures are capped, this is not). */
  size: number;
  /** Smoothed figure positions, so the formation slides together when someone falls. */
  fx: number[];
  fy: number[];
  label: string;
  // layout
  cx: number;
  baseY: number;
  scale: number;
  perRank: number;
  spacing: number;
  /** Latest data. */
  data: FieldTroop;
}

/** A soldier who just fell: tips over and fades. */
interface Faller {
  active: boolean;
  x: number;
  y: number;
  s: number;
  t: number;
  race: string;
}

/** A troop walking off the field (retreat). Keeps the formation it had. */
interface Leaver {
  active: boolean;
  v: TroopVis | null;
  t: number;
  race: string;
}

interface Dying {
  active: boolean;
  id: string;
  name: string;
  boss: boolean;
  t: number;
}

const SLOTS: Record<number, [number, number][]> = {
  1: [[0.3, 0.84]],
  2: [[0.2, 0.78], [0.4, 0.9]],
  3: [[0.19, 0.74], [0.46, 0.74], [0.325, 0.9]],
  4: [[0.19, 0.74], [0.46, 0.74], [0.19, 0.9], [0.46, 0.9]],
  5: [[0.19, 0.7], [0.46, 0.7], [0.325, 0.82], [0.19, 0.94], [0.46, 0.94]],
};
const SCALES: Record<number, number> = { 1: 1.45, 2: 1.2, 3: 1.1, 4: 1.0, 5: 0.88 };

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const fract = (x: number) => x - Math.floor(x);

export class Scene {
  w = 343;
  h = 250;
  dpr = 1;
  calm = false;
  clock = 0;

  private snap: FieldSnap | null = null;
  private syncClock = 0;
  private vis: TroopVis[] = [];
  private order: TroopVis[] = [];
  private pool: Particle[] = Array.from({ length: POOL }, () => new Particle());
  private dying: Dying[] = Array.from({ length: 4 }, () => ({ active: false, id: '', name: '', boss: false, t: 0 }));
  private fallers: Faller[] = Array.from({ length: 8 }, () => ({ active: false, x: 0, y: 0, s: 1, t: 0, race: '' }));
  private leavers: Leaver[] = Array.from({ length: 3 }, () => ({ active: false, v: null, t: 0, race: '' }));
  private enemy = { id: '', name: '', boss: false, born: -99, flinch: 0, nextAtk: 0, atk: -1, atkDur: 0.45, target: '', fired: false, lunge: 0 };
  private tap = { x: 0, y: 0, t: 9, kind: 0 };
  private lastHurtNum = -9;
  private lastBump = -9;
  /** Loot handoff to the page: the icon leaves the canvas at (x, y) and lands on the resource tile. `fly` is false under reduced motion. */
  onLoot: ((res: string, x: number, y: number, fly: boolean) => void) | null = null;
  private lastKills = -1;
  private pendingDmg = 0;
  private lastNum = -9;
  private lastLoot = -9;
  private lastFall = -9;
  private lastSpark = -9;
  private shake = 0;
  private seed = 1234567;
  private bg: HTMLCanvasElement | null = null;
  private mist: HTMLCanvasElement | null = null;
  private bgKey = '';
  private glow: HTMLCanvasElement | null = null;
  private labelKey = '';
  private labelW = 0;
  private motes = 0;

  setSize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.bgKey = '';
    this.layout();
  }

  private rnd(): number {
    this.seed ^= this.seed << 13;
    this.seed ^= this.seed >>> 17;
    this.seed ^= this.seed << 5;
    return ((this.seed >>> 0) % 100000) / 100000;
  }

  private spawn(kind: number, x: number, y: number, vx: number, vy: number, life: number): Particle | null {
    for (let i = 0; i < POOL; i++) {
      const p = this.pool[i]!;
      if (!p.active) {
        p.active = true;
        p.kind = kind;
        p.x = x;
        p.y = y;
        p.vx = vx;
        p.vy = vy;
        p.t = 0;
        p.life = life;
        p.size = 1;
        return p;
      }
    }
    return null;
  }

  // ---------- layout ----------

  private enemyX(): number {
    return this.w * 0.8;
  }
  private enemyY(): number {
    return this.h * 0.88;
  }
  private enemyScale(boss: boolean, name: string): number {
    return FAMILY_SCALE[familyOf(name, boss)] * (boss ? 1.45 : 1) * Math.min(1.25, Math.max(0.85, this.w / 343));
  }

  private layout(): void {
    const n = this.vis.length;
    if (n === 0) return;
    const slots = SLOTS[Math.min(5, n)]!;
    const sc = SCALES[Math.min(5, n)]! * Math.min(1.2, Math.max(0.85, this.w / 343));
    for (let i = 0; i < n; i++) {
      const v = this.vis[i]!;
      const [fx, fy] = slots[Math.min(i, slots.length - 1)]!;
      const drawn = Math.min(v.data.size, MAX_FIG);
      const ranks = drawn <= 4 ? 1 : drawn <= 8 ? 2 : 3;
      v.perRank = Math.ceil(drawn / ranks);
      v.scale = sc;
      v.cx = fx * this.w;
      v.baseY = fy * this.h;
      v.spacing = Math.min(18 * sc, (this.w * 0.26) / Math.max(1, v.perRank));
    }
    this.order = this.vis.slice().sort((a, b) => a.baseY - b.baseY);
  }

  // ---------- sync with the game snapshot ----------

  /** Called by the renderer when a new snapshot object arrives. */
  sync(snap: FieldSnap): void {
    const first = this.snap === null;
    const prev = this.snap;
    this.snap = snap;
    this.syncClock = this.clock;

    // troops
    const old = new Map(this.vis.map((v) => [v.id, v] as const));
    const next: TroopVis[] = [];
    let relayout = old.size !== snap.troops.length;
    const oldTotal = this.vis.reduce((n, v) => n + v.size, 0);
    const newTotal = snap.troops.reduce((n, t) => n + t.size, 0);
    // A real loss in a normal fight: fewer soldiers overall (a transfer between troops keeps the total).
    const losing = !first && !snap.boss && newTotal < oldTotal && snap.incoming > 0;
    for (const t of snap.troops) {
      let v = old.get(t.id);
      const drawn = Math.min(t.size, MAX_FIG);
      if (!v) {
        v = {
          id: t.id, shown: drawn, born: new Array(MAX_FIG).fill(first ? -99 : this.clock), off: [], level: t.level, flash: -99, cycle: 0, wound: t.wound,
          hitAt: -99, pendingIn: 0, size: t.size, fx: new Array(MAX_FIG).fill(NaN), fy: new Array(MAX_FIG).fill(NaN),
          label: t.name.length > 9 ? `${t.name.slice(0, 8)}.` : t.name, cx: 0, baseY: 0, scale: 1, perRank: 1, spacing: 10, data: t,
        };
        for (let i = 0; i < MAX_FIG; i++) v.off.push(((i * 0.6180339) + this.rnd() * 0.2) % 1);
        relayout = true;
      } else {
        if (t.size < v.size && losing) {
          // one figure falls per lost soldier (a couple at most per snapshot), the rest close the gap
          for (let n = Math.min(2, v.size - t.size); n > 0; n--) this.dropSoldier(v, snap.raceId);
        }
        if (drawn > v.shown) {
          for (let i = v.shown; i < drawn; i++) {
            v.born[i] = this.clock;
            v.fx[i] = NaN;
            this.burst(v.cx + (i - drawn / 2) * 8, v.baseY - 14, '#e3c06a', 4);
          }
        }
        if (drawn !== v.shown) relayout = true;
        v.shown = drawn;
        v.size = t.size;
        if (t.level > v.level) {
          v.flash = this.clock;
          const p = this.spawn(TEXT, v.cx, v.baseY - 46 * v.scale, 0, -22, 1.4);
          if (p) { p.text = `Nivå ${t.level}!`; p.color = '#e3c06a'; }
        }
        v.level = t.level;
        v.data = t;
        v.label = t.name.length > 9 ? `${t.name.slice(0, 8)}.` : t.name;
      }
      next.push(v);
    }
    // troops that left the field (retreat or new orders) walk off to the left
    if (!first && !this.calm) for (const [id, v] of old) if (!snap.troops.some((t) => t.id === id)) this.pushLeaver(v, snap.raceId);
    this.vis = next;
    if (relayout) this.layout();

    const fighting = snap.troops.length > 0;
    const k = Math.floor(snap.totalKills);
    const dk = this.lastKills < 0 ? 0 : k - this.lastKills;
    this.lastKills = k;

    // boss ended: the boss figure falls
    if (prev?.boss && !snap.boss) this.pushDying(prev.enemyId, prev.enemyName, true);
    if (dk > 0 && fighting && !snap.boss) this.onKill(snap, dk);

    if (this.enemy.id !== snap.enemyId || this.enemy.boss !== !!snap.boss) {
      this.enemy.id = snap.enemyId;
      this.enemy.name = snap.enemyName;
      this.enemy.boss = !!snap.boss;
      this.enemy.born = this.calm || first ? -99 : this.clock;
    }
    this.enemy.name = snap.enemyName;
  }

  /** Where figure i of a troop stands in its formation (feet position). */
  private figX(v: TroopVis, i: number): number {
    const r = Math.floor(i / v.perRank);
    const k = i - r * v.perRank;
    const inRank = Math.min(v.perRank, v.shown - r * v.perRank);
    return v.cx + (k - (inRank - 1) / 2) * v.spacing + (r % 2 ? v.spacing / 2 : 0);
  }
  private figY(v: TroopVis, i: number): number {
    return v.baseY - Math.floor(i / v.perRank) * 6 * v.scale;
  }

  private dropSoldier(v: TroopVis, race: string): void {
    if (this.calm || v.shown <= 0) return;
    const i = Math.min(v.shown - 1, Math.floor(this.rnd() * v.shown));
    const x = Number.isNaN(v.fx[i]!) ? this.figX(v, i) : v.fx[i]!;
    const y = Number.isNaN(v.fy[i]!) ? this.figY(v, i) : v.fy[i]!;
    for (const f of this.fallers) {
      if (f.active) continue;
      f.active = true; f.x = x; f.y = y; f.s = v.scale; f.t = 0; f.race = race;
      this.burst(x, y - 14 * v.scale, '#c0533f', 6);
      return;
    }
  }

  private pushLeaver(v: TroopVis, race: string): void {
    for (const l of this.leavers) {
      if (l.active) continue;
      l.active = true; l.v = v; l.t = 0; l.race = race;
      return;
    }
  }

  private burst(x: number, y: number, color: string, n: number): void {
    if (this.calm) return;
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * Math.PI * 2;
      const p = this.spawn(SPARK, x, y, Math.cos(a) * 40, Math.sin(a) * 40 - 20, 0.5);
      if (p) p.color = color;
    }
  }

  private pushDying(id: string, name: string, boss: boolean): void {
    if (this.calm) return;
    for (const d of this.dying) {
      if (!d.active) {
        d.active = true; d.id = id; d.name = name; d.boss = boss; d.t = 0;
        return;
      }
    }
  }

  private onKill(snap: FieldSnap, dk: number): void {
    const fastEnough = this.clock - this.lastFall > 0.45;
    if (fastEnough) {
      this.lastFall = this.clock;
      this.pushDying(this.enemy.id || snap.enemyId, this.enemy.name || snap.enemyName, false);
      this.enemy.born = this.calm ? -99 : this.clock;
      // Calm: loot tosses are rare so the resource bar stays readable. Reduced motion: no flight, only the tile bump.
      if (this.clock - this.lastLoot > (this.calm ? 1.5 : 0.7)) {
        this.lastLoot = this.clock;
        const ex = this.enemyX();
        const ey = this.enemyY() - 24;
        for (const r of snap.loot.slice(0, 3)) {
          if (this.calm) { this.onLoot?.(r, ex, ey, false); continue; }
          const p = this.spawn(LOOT, ex, ey, (this.rnd() - 0.5) * 90, -110 - this.rnd() * 40, 0.32);
          if (p) { p.color = LOOT_COLOR[r] ?? '#ddd'; p.ri = Math.max(0, RESOURCE_ORDER.indexOf(r)); p.text = r; }
        }
      }
    }
    if (dk > 1 && !this.calm) {
      const p = this.spawn(TEXT, this.enemyX(), this.enemyY() - 70, 0, -26, 1);
      if (p) { p.text = `×${dk}`; p.color = '#ffd27a'; }
    }
  }

  // ---------- update ----------

  update(dt: number): void {
    this.clock += dt;
    const snap = this.snap;
    if (this.enemy.flinch > 0) this.enemy.flinch = Math.max(0, this.enemy.flinch - dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.2);
    for (const d of this.dying) if (d.active) { d.t += dt; if (d.t > 1) d.active = false; }
    for (const f of this.fallers) if (f.active) { f.t += dt; if (f.t > 1.3) f.active = false; }
    for (const l of this.leavers) if (l.active) { l.t += dt; if (l.t > 2.4) { l.active = false; l.v = null; } }
    this.tap.t += dt;
    for (const v of this.vis) {
      const k = Math.min(1, dt * 7);
      for (let i = 0; i < v.shown; i++) {
        const tx = this.figX(v, i);
        const ty = this.figY(v, i);
        v.fx[i] = Number.isNaN(v.fx[i]!) ? tx : v.fx[i]! + (tx - v.fx[i]!) * k;
        v.fy[i] = Number.isNaN(v.fy[i]!) ? ty : v.fy[i]! + (ty - v.fy[i]!) * k;
      }
    }
    if (snap && !this.calm) this.updateEnemyAttack(snap, dt);

    if (snap) {
      const engaged = snap.troops.length > 0 && (snap.killsPerSec > 0 || !!snap.boss);
      for (const v of this.vis) {
        v.wound += (v.data.wound - v.wound) * Math.min(1, dt * 3);
        if (!engaged || this.calm) continue;
        const c = Math.floor(this.clock * snap.aps + v.off[0]! + 0.2);
        if (c !== v.cycle) {
          v.cycle = c;
          this.onHit(snap, v);
        }
      }
    }

    // particles
    const W = this.w;
    for (let i = 0; i < POOL; i++) {
      const p = this.pool[i]!;
      if (!p.active) continue;
      p.t += dt;
      if (p.t >= p.life) {
        p.active = false;
        if (p.kind === MOTE) this.motes--;
        // The toss is over: the page continues the icon's flight to the real resource tile.
        if (p.kind === LOOT) this.onLoot?.(p.text, p.x, p.y, true);
        if (p.kind === PROJ) this.onTroopHit(p.text);
        continue;
      }
      if (p.kind === LOOT) {
        p.vy += 520 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else if (p.kind === PROJ) {
        const q = p.t / p.life;
        p.x = lerp(p.sx, p.vx, q);
        p.y = lerp(p.sy, p.vy, q) - Math.sin(q * Math.PI) * (p.ri === 1 ? 14 : 6);
      } else if (p.kind === MOTE) {
        p.x += p.vx * dt + Math.sin(this.clock * 1.3 + p.sx) * 0.15;
        p.y += p.vy * dt;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === SPARK) p.vy += 90 * dt;
      }
    }
    // ambient motes
    if (!this.calm && this.motes < 10 && this.rnd() < dt * 3) {
      const band = BANDS[Math.min(snap?.band ?? 0, BANDS.length - 1)]!;
      const idle = !snap || snap.troops.length === 0;
      const p = this.spawn(MOTE, idle ? this.w * 0.3 + (this.rnd() - 0.5) * 16 : this.rnd() * this.w, idle ? this.h * 0.8 : this.h * (0.45 + this.rnd() * 0.4), (this.rnd() - 0.5) * 6, idle ? -26 - this.rnd() * 20 : -3 - this.rnd() * 4, idle ? 1.6 : 6 + this.rnd() * 4);
      if (p) { p.color = idle ? '#ffb060' : band.mote; p.sx = this.rnd() * 10; p.size = 0.8 + this.rnd(); this.motes++; }
    }
  }

  /** The foe strikes back: pick the troop that is really taking the damage, lunge or shoot, then land the hit. */
  private updateEnemyAttack(snap: FieldSnap, dt: number): void {
    const e = this.enemy;
    const age = this.clock - e.born;
    if (e.atk >= 0) {
      e.atk += dt;
      const target = this.vis.find((v) => v.id === e.target);
      const ranged = rangedKind(e.name, e.boss);
      if (!e.fired && target) {
        if (ranged) {
          if (e.atk >= e.atkDur * 0.4) {
            e.fired = true;
            const sc = this.enemyScale(e.boss, e.name);
            const p = this.spawn(PROJ, this.enemyX() - 20 * sc, this.enemyY() - 38 * sc, 0, 0, 0.34);
            if (p) {
              p.sx = p.x;
              p.sy = p.y;
              p.vx = target.cx;
              p.vy = target.baseY - 20 * target.scale;
              p.ri = ranged === 'arrow' ? 1 : 2;
              p.text = target.id;
              p.color = ranged === 'arrow' ? '#d8c8a0' : BANDS[Math.min(snap.band, BANDS.length - 1)]!.mote;
            }
          }
        } else if (e.atk >= e.atkDur * 0.6) {
          e.fired = true;
          this.onTroopHit(target.id);
        }
      }
      if (e.atk >= e.atkDur) e.atk = -1;
      return;
    }
    if (snap.incoming <= 0 || age < 0.9 || snap.troops.length === 0 || this.clock < e.nextAtk) return;
    // Rhythm: the harder the foe hits relative to a soldier's health, the faster it swings (0.6 to 2.2 swings per second).
    const rate = Math.max(0.6, Math.min(2.2, 0.6 + (4 * snap.incoming) / Math.max(1, snap.hpPerSoldier)));
    e.nextAtk = this.clock + 1 / rate;
    // Target weighted by incoming damage; troops that are really losing health (net wounds) count full, healed-up ones a third.
    let total = 0;
    for (const v of this.vis) total += v.data.incoming * (v.data.wounding > 0 ? 1 : 0.35);
    if (total <= 0) return;
    let roll = this.rnd() * total;
    let pick = this.vis[0]!;
    for (const v of this.vis) {
      roll -= v.data.incoming * (v.data.wounding > 0 ? 1 : 0.35);
      pick = v;
      if (roll <= 0) break;
    }
    e.target = pick.id;
    e.atk = 0;
    e.fired = false;
    e.atkDur = rangedKind(e.name, e.boss) ? 0.5 : 0.44;
    e.lunge = Math.min(this.w * 0.2, Math.max(0, (this.enemyX() - pick.cx) * 0.5));
    this.pendingRate = rate;
  }

  private pendingRate = 1;

  /** A blow lands on a troop: red flash, sparks and a rate-limited red number. Bosses wound but nobody falls here. */
  private onTroopHit(id: string): void {
    const snap = this.snap;
    const v = this.vis.find((x) => x.id === id);
    if (!snap || !v) return;
    v.hitAt = this.clock;
    v.pendingIn += snap.incoming / this.pendingRate; // damage one blow carries at the real incoming rate
    for (let i = 0; i < 4; i++) {
      const a = Math.PI + (this.rnd() - 0.5) * 2;
      const p = this.spawn(SPARK, v.cx + 8, v.baseY - 20 * v.scale, Math.cos(a) * 45, Math.sin(a) * 45 - 25, 0.4);
      if (p) p.color = '#e0533c';
    }
    if (this.clock - this.lastHurtNum > 0.55 && v.pendingIn > 0) {
      this.lastHurtNum = this.clock;
      const p = this.spawn(DMG, v.cx + (this.rnd() - 0.5) * 16, v.baseY - 54 * v.scale, (this.rnd() - 0.5) * 8, -28, 0.9);
      if (p) { p.text = `-${fmtRate(v.pendingIn)}`; p.color = '#ff5a48'; }
      v.pendingIn = 0;
      if (this.enemy.boss) this.shake = Math.max(this.shake, 0.25);
    }
  }

  /** The troop's lead soldier lands a blow: flinch, spark, and a rate-limited damage number. */
  private onHit(snap: FieldSnap, v: TroopVis): void {
    this.enemy.flinch = 0.14;
    this.pendingDmg += v.data.dps / snap.aps;
    if (this.clock - this.lastSpark > 0.18) {
      this.lastSpark = this.clock;
      const sc = this.enemyScale(this.enemy.boss, this.enemy.name);
      const p = this.spawn(SPARK, this.enemyX() - 14 * sc, this.enemyY() - 36 * sc, -30 - this.rnd() * 20, -50 - this.rnd() * 30, 0.35);
      if (p) p.color = '#ffe2a0';
    }
    if (this.clock - this.lastNum > 0.42 && this.pendingDmg > 0) {
      this.lastNum = this.clock;
      const sc = this.enemyScale(this.enemy.boss, this.enemy.name);
      const p = this.spawn(DMG, this.enemyX() + (this.rnd() - 0.5) * 30, this.enemyY() - 44 * sc, (this.rnd() - 0.5) * 10, -34, 0.95);
      if (p) { p.text = `-${fmtRate(this.pendingDmg)}`; p.color = this.enemy.boss ? '#ff9a6a' : '#ffd27a'; }
      this.pendingDmg = 0;
      if (this.enemy.boss) this.shake = 0.35;
    }
  }

  // ---------- draw ----------

  draw(g: CanvasRenderingContext2D): void {
    const { w, h, dpr } = this;
    const snap = this.snap;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bossNow = !!snap?.boss;
    const key = `${snap?.band ?? 0}|${bossNow ? 1 : 0}|${w}|${h}|${dpr}`;
    if (key !== this.bgKey) {
      this.bgKey = key;
      this.bg = renderBackground(snap?.band ?? 0, w, h, dpr, bossNow);
      this.mist = renderMist(snap?.band ?? 0, w, h * 0.3, dpr);
    }
    g.drawImage(this.bg!, 0, 0, w, h);
    const drift = this.calm ? 0 : (this.clock * 6) % w;
    g.drawImage(this.mist!, -drift, h * 0.38, w, h * 0.3);
    g.drawImage(this.mist!, w - drift, h * 0.38, w, h * 0.3);

    if (!snap || snap.troops.length === 0) {
      this.drawCamp(g, snap);
      this.drawExits(g);
      this.drawParticles(g);
      this.drawSign(g, snap);
      return;
    }

    const sk = this.calm ? 0 : this.shake;
    g.save();
    if (sk > 0) g.translate((this.rnd() - 0.5) * 4 * sk, (this.rnd() - 0.5) * 3 * sk);
    this.drawEnemy(g, snap);
    this.drawTroops(g, snap);
    this.drawExits(g);
    this.drawTapRing(g);
    this.drawParticles(g);
    g.restore();
    this.drawHud(g, snap);
    this.drawSign(g, snap);
  }

  private drawTroops(g: CanvasRenderingContext2D, snap: FieldSnap): void {
    const density = this.dpr * 1.5;
    const body = soldierSprite(snap.raceId, false, density);
    const hurt = soldierSprite(snap.raceId, true, density);
    const engaged = !this.calm && (snap.killsPerSec > 0 || !!snap.boss);
    const bob = this.calm ? 0 : 1;
    for (const v of this.order) {
      const s = v.scale;
      const t = v.data;
      const hf = this.calm ? 1 : (this.clock - v.hitAt) / 0.32;
      const flashAmt = hf < 1 ? 1 - hf : 0;
      const hurtAmt = Math.max(Math.min(0.7, v.wound * 1.4), flashAmt * 0.85);
      const hz = lerp(1.1, 0.55, Math.min(1, v.wound * 2));
      const ranks = Math.ceil(v.shown / v.perRank);
      // glow under a freshly levelled troop
      const fa = this.clock - v.flash;
      if (fa < 1.1 && !this.calm) {
        g.globalAlpha = (1 - fa / 1.1) * 0.7;
        g.strokeStyle = '#e3c06a';
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(v.cx, v.baseY, 24 + fa * 46, 6 + fa * 12, 0, 0, Math.PI * 2);
        g.stroke();
        const beam = g.createLinearGradient(0, v.baseY - 70 * s, 0, v.baseY);
        beam.addColorStop(0, 'rgba(255,230,150,0)');
        beam.addColorStop(1, 'rgba(255,230,150,0.45)');
        g.fillStyle = beam;
        g.fillRect(v.cx - 26, v.baseY - 70 * s, 52, 70 * s);
        g.globalAlpha = 1;
      }
      for (let r = ranks - 1; r >= 0; r--) {
        const inRank = Math.min(v.perRank, v.shown - r * v.perRank);
        for (let k = 0; k < inRank; k++) {
          const i = r * v.perRank + k;
          const x = (Number.isNaN(v.fx[i]!) ? this.figX(v, i) : v.fx[i]!) - flashAmt * 3 * s;
          const y = Number.isNaN(v.fy[i]!) ? this.figY(v, i) : v.fy[i]!;
          const age = this.clock - v.born[i]!;
          let fs = s;
          let drop = 0;
          if (age < 0.55) {
            const q = Math.max(0, age) / 0.55;
            fs = s * (0.2 + 0.8 * Math.min(1.12, ease(q) * 1.15));
            drop = -16 * (1 - ease(q));
          }
          const ph = fract(this.clock * snap.aps + v.off[i]!);
          let ang = -1.05;
          let lunge = 0;
          if (engaged) {
            if (ph < 0.55) ang = -1.05;
            else if (ph < 0.75) ang = lerp(-1.05, -2.1, (ph - 0.55) / 0.2);
            else if (ph < 0.86) { const q = (ph - 0.75) / 0.11; ang = lerp(-2.1, 0.9, q); lunge = Math.sin(q * Math.PI) * 3.5 * s; }
            else ang = lerp(0.9, -1.05, (ph - 0.86) / 0.14);
          } else ang = -1.05 + Math.sin(this.clock * 1.5 + v.off[i]! * 6) * 0.05 * bob;
          const by = bob * Math.sin(this.clock * Math.PI * 2 * hz + v.off[i]! * 6.28) * (1.1 + v.wound * 1.2) * s + drop + v.wound * 1.5 * s;
          const px = x + lunge;
          g.drawImage(body.canvas, px - SOLDIER_AX * fs, y - SOLDIER_AY * fs + by, SOLDIER_W * fs, SOLDIER_H * fs);
          if (hurtAmt > 0.04) {
            g.globalAlpha = hurtAmt;
            g.drawImage(hurt.canvas, px - SOLDIER_AX * fs, y - SOLDIER_AY * fs + by, SOLDIER_W * fs, SOLDIER_H * fs);
            g.globalAlpha = 1;
          }
          // weapon, drawn live from the hand
          const hx = px + (HAND_X - SOLDIER_AX) * fs;
          const hy = y + (HAND_Y - SOLDIER_AY) * fs + by;
          const len = 15 * fs;
          const ex = hx + Math.cos(ang) * len;
          const ey = hy + Math.sin(ang) * len;
          const heavy = t.weaponId === 'axe' || t.weaponId === 'cleaver';
          g.strokeStyle = '#2a1f16';
          g.lineWidth = 3.2 * fs;
          g.beginPath();
          g.moveTo(hx, hy);
          g.lineTo(hx + Math.cos(ang) * len * 0.35, hy + Math.sin(ang) * len * 0.35);
          g.stroke();
          g.strokeStyle = t.blade;
          g.lineWidth = (heavy ? 3.6 : 2.2) * fs;
          g.beginPath();
          g.moveTo(hx + Math.cos(ang) * len * 0.3, hy + Math.sin(ang) * len * 0.3);
          g.lineTo(ex, ey);
          g.stroke();
          if (engaged && ph > 0.75 && ph < 0.86) {
            g.globalAlpha = 0.5;
            g.strokeStyle = '#fff2c8';
            g.lineWidth = 1.2;
            g.beginPath();
            g.arc(hx, hy, len, ang - 0.8, ang);
            g.stroke();
            g.globalAlpha = 1;
          }
        }
      }
      if (flashAmt > 0) {
        g.globalAlpha = flashAmt * 0.5;
        g.fillStyle = '#e0533c';
        g.beginPath();
        g.ellipse(v.cx, v.baseY + 2, 30 * s, 6 * s, 0, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }
      this.drawBanner(g, v, snap);
    }
  }

  /** One soldier sprite at (x, y) feet position, optionally mirrored and tinted red. */
  private drawFigure(g: CanvasRenderingContext2D, race: string, x: number, y: number, s: number, red: number): void {
    const density = this.dpr * 1.5;
    const body = soldierSprite(race, false, density);
    g.drawImage(body.canvas, x - SOLDIER_AX * s, y - SOLDIER_AY * s, SOLDIER_W * s, SOLDIER_H * s);
    if (red > 0.02) {
      g.globalAlpha *= red;
      g.drawImage(soldierSprite(race, true, density).canvas, x - SOLDIER_AX * s, y - SOLDIER_AY * s, SOLDIER_W * s, SOLDIER_H * s);
      g.globalAlpha /= red;
    }
  }

  /** Fallen soldiers tip over and fade; retreating troops walk off to the left. */
  private drawExits(g: CanvasRenderingContext2D): void {
    for (const f of this.fallers) {
      if (!f.active) continue;
      const q = Math.min(1, f.t / 0.45);
      g.save();
      g.translate(f.x, f.y);
      g.rotate(ease(q) * 1.5 * -1);
      g.translate(0, ease(q) * 3);
      g.globalAlpha = Math.max(0, 1 - Math.max(0, f.t - 0.5) / 0.8);
      this.drawFigure(g, f.race, 0, 0, f.s, 0.5 + 0.4 * (1 - q));
      g.restore();
    }
    for (const l of this.leavers) {
      const v = l.v;
      if (!l.active || !v) continue;
      const dx = -l.t * 78;
      const a = Math.max(0, 1 - Math.max(0, l.t - 1.4) / 1);
      for (let i = 0; i < v.shown; i++) {
        const fx = Number.isNaN(v.fx[i]!) ? this.figX(v, i) : v.fx[i]!;
        const fy = Number.isNaN(v.fy[i]!) ? this.figY(v, i) : v.fy[i]!;
        g.save();
        g.globalAlpha = a;
        g.translate(fx + dx, fy - Math.abs(Math.sin(l.t * 9 + v.off[i]! * 6)) * 1.8 * v.scale);
        g.scale(-1, 1);
        this.drawFigure(g, l.race, 0, 0, v.scale, Math.min(0.7, v.wound * 1.4));
        g.restore();
      }
    }
  }

  private drawBanner(g: CanvasRenderingContext2D, v: TroopVis, snap: FieldSnap): void {
    const s = v.scale;
    const front = Math.min(v.perRank, v.shown);
    const poleX = v.cx - ((front - 1) / 2) * v.spacing - 15 * s;
    const bottom = v.baseY + 1;
    const top = v.baseY - 50 * s;
    g.strokeStyle = '#120d0a';
    g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(poleX, bottom);
    g.lineTo(poleX, top);
    g.stroke();
    const pal = racePalette(snap.raceId);
    const sway = this.calm ? 0 : Math.sin(this.clock * 2 + v.cx) * 1.5;
    g.fillStyle = pal.banner;
    g.beginPath();
    g.moveTo(poleX, top);
    g.lineTo(poleX + 38, top + sway);
    g.lineTo(poleX + 33, top + 6 + sway);
    g.lineTo(poleX + 38, top + 12 + sway);
    g.lineTo(poleX, top + 12);
    g.fill();
    g.strokeStyle = '#120d0a';
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = '#f4ead0';
    g.font = 'bold 8px system-ui, sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(v.label, poleX + 3, top + 6.5, 30);
    if (v.data.size > MAX_FIG) {
      g.fillStyle = '#120e12';
      g.strokeStyle = '#c9a24a';
      g.beginPath();
      g.roundRect(poleX + 2, top - 13, 30, 11, 5.5);
      g.fill();
      g.stroke();
      g.fillStyle = '#e3c06a';
      g.font = 'bold 9px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(`×${v.data.size}`, poleX + 17, top - 7);
    }
  }

  private drawEnemy(g: CanvasRenderingContext2D, snap: FieldSnap): void {
    const density = this.dpr * 1.5;
    const boss = !!snap.boss;
    const sc = this.enemyScale(boss, snap.enemyName);
    const sp = enemySprite(snap.enemyId, snap.enemyName, boss, density);
    const baseX = this.enemyX();
    const baseY = this.enemyY();
    // dying copies
    for (const d of this.dying) {
      if (!d.active) continue;
      const ds = this.enemyScale(d.boss, d.name);
      const dsp = enemySprite(d.id, d.name, d.boss, density);
      const q = Math.min(1, d.t / 0.4);
      g.save();
      g.globalAlpha = Math.max(0, 1 - Math.max(0, d.t - 0.25) / 0.7);
      g.translate(baseX + d.t * 14, baseY);
      g.rotate(q * q * 1.45);
      g.drawImage(dsp.canvas, -dsp.ax * ds, -dsp.ay * ds, dsp.w * ds, dsp.h * ds);
      g.restore();
    }
    const age = this.clock - this.enemy.born;
    const walk = age < 0.8 ? 1 - ease(age / 0.8) : 0;
    const e = this.enemy;
    const ranged = rangedKind(snap.enemyName, boss);
    const aq = e.atk >= 0 ? Math.min(1, e.atk / e.atkDur) : 0;
    // melee: wind up a step back, then charge at the troop being hit; ranged: lean back and release
    let lunge = 0;
    if (e.atk >= 0 && !this.calm) {
      if (ranged) lunge = -Math.sin(aq * Math.PI) * 5;
      else if (aq < 0.3) lunge = -8 * (aq / 0.3);
      else if (aq < 0.65) lunge = lerp(-8, e.lunge, ease((aq - 0.3) / 0.35));
      else lunge = lerp(e.lunge, 0, (aq - 0.65) / 0.35);
    }
    const x = baseX + walk * this.w * 0.28 + e.flinch * 22 - lunge;
    const bob = this.calm ? 0 : walk > 0 ? Math.abs(Math.sin(this.clock * 10)) * -3 : Math.sin(this.clock * 2.4) * 1.2;
    const squash = this.enemy.flinch > 0 ? 1 - this.enemy.flinch * 0.5 : 1;
    if (boss && !this.calm) {
      const a = g.createRadialGradient(x, baseY - 40 * sc, 6, x, baseY - 40 * sc, 90 * sc);
      a.addColorStop(0, `rgba(255,70,40,${0.28 + 0.1 * Math.sin(this.clock * 3)})`);
      a.addColorStop(1, 'rgba(255,70,40,0)');
      g.fillStyle = a;
      g.fillRect(x - 100 * sc, baseY - 130 * sc, 200 * sc, 160 * sc);
    }
    g.globalAlpha = walk > 0 ? 1 - walk * 0.6 : 1;
    g.drawImage(sp.canvas, x - sp.ax * sc, baseY - sp.ay * sc * squash + bob, ENEMY_W * sc, ENEMY_H * sc * squash);
    g.globalAlpha = 1;
    if (e.atk >= 0 && !ranged && !this.calm && aq > 0.5 && aq < 0.8) {
      g.globalAlpha = 0.65;
      g.strokeStyle = '#ffd6c0';
      g.lineWidth = 2.4;
      g.beginPath();
      g.arc(x - 18 * sc, baseY - 38 * sc, 26 * sc, Math.PI * 0.85, Math.PI * 1.45);
      g.stroke();
      g.globalAlpha = 1;
    }
  }

  private frac(snap: FieldSnap): number {
    // fraction of hp remaining on the current foe, extrapolated at the real damage rate
    const dt = this.clock - this.syncClock;
    if (snap.boss) return Math.max(0, Math.min(1, (snap.boss.hpLeft - snap.bossDps * dt) / snap.boss.hp));
    const f = snap.totalKills - Math.floor(snap.totalKills);
    return 1 - Math.max(0, Math.min(0.97, f + snap.killsPerSec * dt));
  }

  private drawHud(g: CanvasRenderingContext2D, snap: FieldSnap): void {
    const w = this.w;
    const boss = snap.boss;
    const hp = this.frac(snap);
    g.textBaseline = 'alphabetic';
    if (boss) {
      const bx = 10;
      const bw = w - 20;
      g.font = 'bold 11px Georgia, serif';
      g.textAlign = 'left';
      g.lineWidth = 3;
      g.strokeStyle = '#120a08';
      g.fillStyle = '#e3c06a';
      const t = `Boss · ${snap.enemyName}`;
      g.strokeText(t, bx, 14, bw - 40);
      g.fillText(t, bx, 14, bw - 40);
      g.fillStyle = '#120a08';
      g.fillRect(bx - 1, 18, bw + 2, 11);
      const gr = g.createLinearGradient(bx, 0, bx + bw, 0);
      gr.addColorStop(0, '#6e2219');
      gr.addColorStop(1, '#d4553c');
      g.fillStyle = gr;
      g.fillRect(bx, 19, bw * hp, 9);
      g.textAlign = 'right';
      g.font = 'bold 10px system-ui, sans-serif';
      g.fillStyle = '#f4ead0';
      g.fillText(`${Math.ceil(hp * 100)}%`, w - 12, 14);
      // timer ring
      const dt = this.clock - this.syncClock;
      const left = Math.max(0, boss.timeLeft - dt);
      const q = Math.max(0, Math.min(1, left / boss.limit));
      const rx = w - 26;
      const ry = 56;
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(0,0,0,0.55)';
      g.beginPath();
      g.arc(rx, ry, 15, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = q < 0.25 ? '#e0533c' : '#e3c06a';
      g.beginPath();
      g.arc(rx, ry, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * q);
      g.stroke();
      g.fillStyle = '#f4ead0';
      g.font = 'bold 11px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(`${Math.ceil(left)}`, rx, ry + 0.5);
      return;
    }
    // normal foe label + hp bar above the figure
    const sc = this.enemyScale(false, snap.enemyName);
    const ex = this.enemyX();
    const label = `Nivå ${snap.level} · ${snap.enemyName}`;
    g.font = 'bold 11px Georgia, serif';
    if (label !== this.labelKey) { this.labelKey = label; this.labelW = Math.min(w - 12, g.measureText(label).width); }
    const cx = Math.max(this.labelW / 2 + 6, Math.min(w - this.labelW / 2 - 6, ex));
    const ly = Math.max(24, this.enemyY() - 84 * sc - 10);
    g.textAlign = 'center';
    g.lineWidth = 3;
    g.strokeStyle = '#120a08';
    g.strokeText(label, cx, ly, w - 12);
    g.fillStyle = '#ece2cc';
    g.fillText(label, cx, ly, w - 12);
    const bw = Math.min(84, w * 0.26);
    g.fillStyle = '#120a08';
    g.fillRect(cx - bw / 2 - 1, ly + 4, bw + 2, 8);
    const gr = g.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
    gr.addColorStop(0, '#6e2219');
    gr.addColorStop(1, '#c4503a');
    g.fillStyle = gr;
    g.fillRect(cx - bw / 2, ly + 5, bw * hp, 6);
  }

  private drawTapRing(g: CanvasRenderingContext2D): void {
    const t = this.tap.t;
    if (t > 0.5 || this.calm) return;
    g.globalAlpha = (1 - t / 0.5) * 0.8;
    g.strokeStyle = '#e3c06a';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(this.tap.x, this.tap.y, 18 + t * 50, 5 + t * 14, 0, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
  }

  /** Hit-test a tap (canvas coordinates): troop formations first (nearest centre wins), then the enemy. */
  pick(x: number, y: number): FieldPick | null {
    const snap = this.snap;
    if (!snap || snap.troops.length === 0) return null;
    const pad = 8;
    let best: TroopVis | null = null;
    let bestD = Infinity;
    for (const v of this.vis) {
      const s = v.scale;
      const front = Math.min(v.perRank, v.shown);
      const half = (front / 2) * v.spacing + 24 * s;
      const left = v.cx - half - 18 * s;
      const right = v.cx + half;
      const top = v.baseY - 52 * s;
      const bottom = v.baseY + 10;
      if (x < left - pad || x > right + pad || y < top - pad || y > bottom + pad) continue;
      const d = Math.abs(x - v.cx) + Math.abs(y - (v.baseY - 18 * s)) * 0.5;
      if (d < bestD) { bestD = d; best = v; }
    }
    if (best) {
      this.tap.x = best.cx; this.tap.y = best.baseY + 2; this.tap.t = 0;
      return { kind: 'troop', id: best.id };
    }
    const sc = this.enemyScale(!!snap.boss, snap.enemyName);
    const ex = this.enemyX();
    const ey = this.enemyY();
    if (Math.abs(x - ex) <= 50 * sc + pad && y >= ey - 98 * sc - pad && y <= ey + 8 + pad) {
      this.tap.x = ex; this.tap.y = ey + 2; this.tap.t = 0;
      return { kind: 'enemy' };
    }
    return null;
  }

  private drawSign(g: CanvasRenderingContext2D, snap: FieldSnap | null): void {
    if (!snap || snap.working <= 0) return;
    const t = snap.working === 1 ? '1 trupp arbetar' : `${snap.working} trupper arbetar`;
    g.font = 'bold 10px system-ui, sans-serif';
    const tw = g.measureText(t).width;
    g.fillStyle = 'rgba(18,13,10,0.78)';
    g.strokeStyle = '#6b5233';
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(8, 8, tw + 16, 18, 4);
    g.fill();
    g.stroke();
    g.fillStyle = '#e3c06a';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(t, 16, 17.5);
  }

  private drawCamp(g: CanvasRenderingContext2D, snap: FieldSnap | null): void {
    const { w, h } = this;
    g.fillStyle = 'rgba(4,4,16,0.35)';
    g.fillRect(0, 0, w, h);
    const fx = w * 0.5;
    const fy = h * 0.8;
    // tents
    g.fillStyle = '#17120f';
    for (const [tx, ts] of [[w * 0.2, 1], [w * 0.8, 0.85]] as const) {
      g.beginPath();
      g.moveTo(tx - 34 * ts, fy + 6);
      g.lineTo(tx, fy - 44 * ts);
      g.lineTo(tx + 34 * ts, fy + 6);
      g.fill();
      g.fillStyle = '#0a0706';
      g.beginPath();
      g.moveTo(tx - 7 * ts, fy + 6);
      g.lineTo(tx, fy - 16 * ts);
      g.lineTo(tx + 7 * ts, fy + 6);
      g.fill();
      g.fillStyle = '#17120f';
    }
    // fire glow (cached)
    if (!this.glow) {
      const c = document.createElement('canvas');
      c.width = c.height = 160;
      const gg = c.getContext('2d')!;
      const rg = gg.createRadialGradient(80, 80, 4, 80, 80, 80);
      rg.addColorStop(0, 'rgba(255,170,70,0.55)');
      rg.addColorStop(1, 'rgba(255,120,40,0)');
      gg.fillStyle = rg;
      gg.fillRect(0, 0, 160, 160);
      this.glow = c;
    }
    const fl = this.calm ? 1 : 0.9 + 0.1 * Math.sin(this.clock * 11) + 0.05 * Math.sin(this.clock * 23);
    g.drawImage(this.glow, fx - 90 * fl, fy - 80 * fl, 180 * fl, 180 * fl);
    g.strokeStyle = '#3a2614';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(fx - 14, fy + 6); g.lineTo(fx + 14, fy - 2);
    g.moveTo(fx + 14, fy + 6); g.lineTo(fx - 14, fy - 2);
    g.stroke();
    const cols = ['#c8401c', '#f08a2a', '#ffd870'];
    for (let i = 0; i < 3; i++) {
      const s = (1 - i * 0.28) * fl;
      const sw = this.calm ? 0 : Math.sin(this.clock * (9 + i * 3) + i) * 2;
      g.fillStyle = cols[i]!;
      g.beginPath();
      g.moveTo(fx - 9 * s, fy);
      g.quadraticCurveTo(fx - 8 * s + sw, fy - 14 * s, fx + sw, fy - 28 * s);
      g.quadraticCurveTo(fx + 8 * s + sw, fy - 14 * s, fx + 9 * s, fy);
      g.fill();
    }
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.font = 'bold 15px Georgia, serif';
    g.lineWidth = 4;
    g.strokeStyle = '#120a08';
    const hint = 'Skicka en trupp till strid';
    g.strokeText(hint, w / 2, h * 0.3, w - 24);
    g.fillStyle = '#e3c06a';
    g.fillText(hint, w / 2, h * 0.3, w - 24);
    g.font = '11px system-ui, sans-serif';
    g.fillStyle = '#c9bfa6';
    g.fillText(snap && snap.working > 0 ? 'Trupperna arbetar. Ge en av dem ordern Strid.' : 'Lägret väntar. Ge en trupp ordern Strid.', w / 2, h * 0.3 + 18, w - 24);
  }

  private drawParticles(g: CanvasRenderingContext2D): void {
    for (let i = 0; i < POOL; i++) {
      const p = this.pool[i]!;
      if (!p.active) continue;
      const q = p.t / p.life;
      switch (p.kind) {
        case DMG:
        case TEXT: {
          if (this.calm && p.kind === DMG) break;
          g.globalAlpha = q < 0.7 ? 1 : 1 - (q - 0.7) / 0.3;
          g.font = p.kind === DMG ? 'bold 14px system-ui, sans-serif' : 'bold 13px Georgia, serif';
          g.textAlign = 'center';
          g.textBaseline = 'alphabetic';
          g.lineWidth = 3;
          g.strokeStyle = '#1a0f08';
          g.strokeText(p.text, p.x, p.y);
          g.fillStyle = p.color;
          g.fillText(p.text, p.x, p.y);
          g.globalAlpha = 1;
          break;
        }
        case LOOT: {
          const a = q > 0.85 ? (1 - q) / 0.15 : 1;
          g.globalAlpha = a;
          g.fillStyle = p.color;
          if (p.text === 'wood') g.fillRect(p.x - 4, p.y - 2.5, 8, 5);
          else if (p.text === 'ore' || p.text === 'iron') {
            g.beginPath();
            g.moveTo(p.x, p.y - 5); g.lineTo(p.x + 4.5, p.y); g.lineTo(p.x, p.y + 5); g.lineTo(p.x - 4.5, p.y);
            g.fill();
          } else {
            g.beginPath();
            g.arc(p.x, p.y, 4, 0, Math.PI * 2);
            g.fill();
          }
          g.fillStyle = 'rgba(255,255,255,0.55)';
          g.fillRect(p.x - 1.5, p.y - 2, 2, 2);
          g.globalAlpha = 1;
          break;
        }
        case SPARK:
          g.globalAlpha = 1 - q;
          g.fillStyle = p.color;
          g.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4);
          g.globalAlpha = 1;
          break;
        case MOTE: {
          g.globalAlpha = Math.sin(q * Math.PI) * 0.8;
          g.fillStyle = p.color;
          g.fillRect(p.x, p.y, p.size, p.size);
          g.globalAlpha = 1;
          break;
        }
        case PROJ: {
          const q2 = Math.min(1, q + 0.04);
          if (p.ri === 1) {
            // arrow: a short shaft that points along the flight
            const dx = p.vx - p.sx;
            const dy = p.vy - p.sy;
            const a = Math.atan2(dy, dx);
            g.strokeStyle = p.color;
            g.lineWidth = 1.8;
            g.beginPath();
            g.moveTo(p.x - Math.cos(a) * 9, p.y - Math.sin(a) * 9);
            g.lineTo(p.x, p.y);
            g.stroke();
            g.fillStyle = '#f4ead0';
            g.fillRect(p.x - 1, p.y - 1, 3, 3);
          } else {
            g.globalAlpha = 0.85;
            g.fillStyle = p.color;
            g.beginPath();
            g.arc(p.x, p.y, 4.5 + Math.sin(q2 * 18) * 0.8, 0, Math.PI * 2);
            g.fill();
            g.globalAlpha = 0.35;
            g.beginPath();
            g.arc(p.x, p.y, 8, 0, Math.PI * 2);
            g.fill();
            g.globalAlpha = 1;
          }
          break;
        }
        case RING:
          break;
      }
    }
  }
}
