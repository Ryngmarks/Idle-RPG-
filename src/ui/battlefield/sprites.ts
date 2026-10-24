// Offscreen sprite caches: soldiers, enemies and the static background layers are drawn once and blitted per frame.

import { BANDS, racePalette, type BandPalette } from './palette';

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Logical size and anchor (feet) in logical units. */
  w: number;
  h: number;
  ax: number;
  ay: number;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

// ---------- soldiers ----------

export const SOLDIER_W = 28;
export const SOLDIER_H = 40;
export const SOLDIER_AX = 14;
export const SOLDIER_AY = 38;
/** Right hand position inside the soldier sprite (weapon is drawn live from here). */
export const HAND_X = 20;
export const HAND_Y = 22;

function soldierBody(g: CanvasRenderingContext2D, race: string, mono: string | null): void {
  const p = racePalette(race);
  const f = (c: string) => mono ?? c;
  // legs
  g.fillStyle = f('#2a2430');
  g.fillRect(10, 28, 4, 10);
  g.fillRect(15, 28, 4, 10);
  g.fillStyle = f('#14100f');
  g.fillRect(9.5, 36, 5, 2.4);
  g.fillRect(14.5, 36, 5, 2.4);
  // torso
  g.fillStyle = f(p.tunic);
  g.beginPath();
  g.roundRect(9, 15.5, 11, 14, 2);
  g.fill();
  g.fillStyle = f('#241a12');
  g.fillRect(9, 25.5, 11, 1.8);
  // front arm
  g.fillStyle = f(p.skin);
  g.fillRect(18.5, 19, 3.2, 4);
  // head
  g.fillStyle = f(p.skin);
  g.beginPath();
  g.arc(14.5, 11, 5, 0, Math.PI * 2);
  g.fill();
  // helmet
  g.fillStyle = f(p.helm);
  g.beginPath();
  g.arc(14.5, 10.5, 5.5, Math.PI, 0);
  g.closePath();
  g.fill();
  g.fillRect(17.6, 9.5, 1.6, 5);
  if (race === 'orcs') {
    g.fillStyle = f('#ddd6c0');
    g.beginPath();
    g.moveTo(16, 14);
    g.lineTo(17.2, 16.6);
    g.lineTo(18.4, 14);
    g.fill();
    g.fillStyle = f('#8a8a7a');
    g.beginPath();
    g.moveTo(10.5, 7);
    g.lineTo(9, 3);
    g.lineTo(12.5, 5.6);
    g.fill();
  } else if (race === 'dwarves') {
    g.fillStyle = f('#b4572a');
    g.beginPath();
    g.moveTo(11, 12);
    g.lineTo(18.5, 12);
    g.lineTo(17, 18.5);
    g.lineTo(12.5, 18.5);
    g.fill();
  }
  if (!mono) {
    g.fillStyle = '#1a1210';
    g.fillRect(16.4, 10.4, 1.4, 1.4);
  }
  // shield on the near side
  g.fillStyle = f(p.shield);
  g.beginPath();
  g.arc(9.5, 23, 6.4, 0, Math.PI * 2);
  g.fill();
  if (!mono) {
    g.strokeStyle = p.trim;
    g.lineWidth = 1.2;
    g.stroke();
    g.fillStyle = p.trim;
    g.beginPath();
    g.arc(9.5, 23, 1.6, 0, Math.PI * 2);
    g.fill();
  }
}

const soldierCache = new Map<string, Sprite>();

/** Body sprite per race; `hurt` is a solid red silhouette to be drawn over it with partial alpha. */
export function soldierSprite(race: string, hurt: boolean, density: number): Sprite {
  const key = `${race}|${hurt ? 1 : 0}|${density}`;
  let s = soldierCache.get(key);
  if (s) return s;
  const canvas = makeCanvas(SOLDIER_W * density, SOLDIER_H * density);
  const g = canvas.getContext('2d')!;
  g.scale(density, density);
  if (!hurt) {
    g.fillStyle = 'rgba(0,0,0,0.38)';
    g.beginPath();
    g.ellipse(14, 38, 9.5, 2.6, 0, 0, Math.PI * 2);
    g.fill();
  }
  soldierBody(g, race, hurt ? '#d03a2a' : null);
  s = { canvas, w: SOLDIER_W, h: SOLDIER_H, ax: SOLDIER_AX, ay: SOLDIER_AY };
  soldierCache.set(key, s);
  return s;
}

// ---------- enemies ----------

export type Family = 'bird' | 'beast' | 'human' | 'brute' | 'spirit' | 'frog' | 'swarm';

export function familyOf(name: string, boss: boolean): Family {
  const n = name.toLowerCase();
  if (/kyckling|tupp|kråka|örn/.test(n)) return 'bird';
  if (/gast|spöke|dimvakt|skelett|frun/.test(n)) return 'spirit';
  if (/flock|mus\b|svärm/.test(n)) return 'swarm';
  if (/groda|ormbo/.test(n)) return 'frog';
  if (/troll|jätte|kung|murbryt/.test(n)) return 'brute';
  if (/räv|katt|varg|hund|get\b|svin|galt|björn|betarn|päls/.test(n)) return 'beast';
  return boss ? 'brute' : 'human';
}

/** Enemies that shoot or cast instead of closing in: arrows from archers, orbs from spirits. */
export function rangedKind(name: string, boss: boolean): 'arrow' | 'orb' | null {
  const n = name.toLowerCase();
  if (/skytt|båge/.test(n)) return 'arrow';
  if (familyOf(name, boss) === 'spirit') return 'orb';
  return null;
}

export const ENEMY_W = 96;
export const ENEMY_H = 90;
const ENEMY_GROUND = 84;

function beast(g: CanvasRenderingContext2D, body: string, dark: string, scale = 1, ox = 0, oy = 0): void {
  g.save();
  g.translate(ox, oy);
  g.scale(scale, scale);
  g.fillStyle = dark;
  g.fillRect(34, 66, 5, 18);
  g.fillRect(44, 68, 5, 16);
  g.fillRect(62, 68, 5, 16);
  g.fillRect(70, 66, 5, 18);
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(54, 58, 26, 15, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath(); // tail
  g.moveTo(78, 52);
  g.quadraticCurveTo(92, 44, 90, 60);
  g.quadraticCurveTo(84, 52, 76, 60);
  g.fill();
  g.beginPath(); // head
  g.ellipse(30, 50, 13, 11, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = dark;
  g.beginPath();
  g.moveTo(24, 42);
  g.lineTo(22, 30);
  g.lineTo(32, 40);
  g.moveTo(36, 40);
  g.lineTo(40, 30);
  g.lineTo(43, 44);
  g.fill();
  g.beginPath();
  g.ellipse(19, 55, 7, 5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ff5a3a';
  g.fillRect(24, 46, 3.4, 3);
  g.fillStyle = '#efe6d0';
  g.beginPath();
  g.moveTo(16, 58);
  g.lineTo(18, 63);
  g.lineTo(20, 58);
  g.fill();
  g.restore();
}

function drawEnemy(g: CanvasRenderingContext2D, fam: Family, id: string, boss: boolean): void {
  const hue = Math.round(hash(id) * 360);
  const sat = boss ? 30 : 24;
  const body = `hsl(${hue} ${sat}% 34%)`;
  const dark = `hsl(${hue} ${sat}% 20%)`;
  const light = `hsl(${hue} ${sat}% 46%)`;
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.beginPath();
  g.ellipse(52, ENEMY_GROUND, 32, 5, 0, 0, Math.PI * 2);
  g.fill();
  const eye = boss ? '#ff3a2a' : '#ffb04a';
  switch (fam) {
    case 'bird': {
      g.strokeStyle = '#c8963e';
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(46, 66); g.lineTo(44, 84); g.moveTo(58, 66); g.lineTo(60, 84);
      g.stroke();
      g.fillStyle = dark;
      g.beginPath();
      g.moveTo(66, 52); g.quadraticCurveTo(90, 34, 84, 62); g.quadraticCurveTo(76, 56, 66, 64);
      g.fill();
      g.fillStyle = body;
      g.beginPath(); g.ellipse(54, 58, 19, 15, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(38, 40, 8.5, 10, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = light;
      g.beginPath(); g.ellipse(52, 62, 11, 7, 0.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d9392b';
      g.beginPath(); g.moveTo(34, 31); g.lineTo(37, 24); g.lineTo(40, 30); g.lineTo(43, 25); g.lineTo(43, 33); g.fill();
      g.fillStyle = '#e0a030';
      g.beginPath(); g.moveTo(31, 40); g.lineTo(22, 43); g.lineTo(31, 46); g.fill();
      g.fillStyle = eye; g.fillRect(34, 37, 3, 3);
      break;
    }
    case 'beast':
      beast(g, body, dark);
      break;
    case 'swarm':
      beast(g, body, dark, 0.5, 0, 28);
      beast(g, light, dark, 0.46, 30, 38);
      beast(g, body, dark, 0.52, 12, 14);
      break;
    case 'frog': {
      g.fillStyle = dark;
      g.beginPath(); g.ellipse(30, 76, 10, 6, 0, 0, Math.PI * 2); g.ellipse(74, 76, 10, 6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = body;
      g.beginPath(); g.ellipse(52, 62, 28, 20, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = light;
      g.beginPath(); g.ellipse(52, 70, 17, 9, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = body;
      g.beginPath(); g.arc(38, 44, 8, 0, Math.PI * 2); g.arc(66, 44, 8, 0, Math.PI * 2); g.fill();
      g.fillStyle = eye;
      g.beginPath(); g.arc(37, 44, 4, 0, Math.PI * 2); g.arc(67, 44, 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#120c0c'; g.fillRect(36, 42, 2, 5); g.fillRect(66, 42, 2, 5);
      break;
    }
    case 'spirit': {
      const halo = g.createRadialGradient(52, 46, 4, 52, 46, 40);
      halo.addColorStop(0, boss ? 'rgba(255,90,60,0.35)' : 'rgba(140,255,210,0.28)');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = halo;
      g.fillRect(0, 0, ENEMY_W, ENEMY_H);
      g.fillStyle = `hsla(${hue},22%,28%,0.92)`;
      g.beginPath();
      g.moveTo(52, 8);
      g.bezierCurveTo(78, 10, 82, 44, 86, 78);
      for (let i = 0; i < 5; i++) g.quadraticCurveTo(80 - i * 14 - 4, 90, 72 - i * 14, 76);
      g.bezierCurveTo(18, 44, 26, 10, 52, 8);
      g.fill();
      g.fillStyle = '#0c0a10';
      g.beginPath(); g.ellipse(52, 30, 13, 15, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = boss ? '#ff6a4a' : '#9affd8';
      g.beginPath(); g.arc(46, 29, 3, 0, Math.PI * 2); g.arc(58, 29, 3, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'brute': {
      g.fillStyle = dark;
      g.fillRect(36, 64, 10, 20); g.fillRect(58, 64, 10, 20);
      g.fillStyle = body;
      g.beginPath(); g.ellipse(52, 46, 27, 28, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = light;
      g.beginPath(); g.ellipse(50, 52, 15, 14, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = body;
      g.beginPath(); g.ellipse(36, 18, 12, 11, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = dark; // arms and club
      g.fillRect(14, 34, 22, 9);
      g.fillStyle = '#5a3e22';
      g.beginPath(); g.moveTo(10, 14); g.lineTo(20, 12); g.lineTo(26, 40); g.lineTo(16, 44); g.fill();
      g.fillStyle = eye; g.fillRect(28, 15, 3.6, 3.6); g.fillRect(36, 15, 3.6, 3.6);
      g.fillStyle = '#e8e0c8';
      g.fillRect(29, 23, 2.4, 3.6); g.fillRect(35, 23, 2.4, 3.6);
      break;
    }
    default: {
      g.fillStyle = '#17121a';
      g.fillRect(38, 62, 7, 22); g.fillRect(52, 62, 7, 22);
      g.fillStyle = body;
      g.beginPath(); g.roundRect(34, 30, 28, 36, 4); g.fill();
      g.fillStyle = dark;
      g.fillRect(34, 52, 28, 3);
      g.fillStyle = '#c9a888';
      g.beginPath(); g.arc(48, 22, 8, 0, Math.PI * 2); g.fill();
      g.fillStyle = dark; // hood / helm
      g.beginPath(); g.arc(48, 20, 9.5, Math.PI, 0); g.fill();
      g.fillStyle = eye; g.fillRect(41, 21, 3, 2.6);
      g.strokeStyle = '#b8b2a6'; // weapon, held forward
      g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(32, 44); g.lineTo(10, 24); g.stroke();
      g.strokeStyle = '#5a3e22'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(32, 44); g.lineTo(36, 48); g.stroke();
      g.fillStyle = dark; g.fillRect(52, 36, 10, 18); // shield arm
      break;
    }
  }
  if (boss) {
    // spiked crown reads as "boss" for every family
    const cx = fam === 'brute' ? 36 : fam === 'bird' ? 38 : fam === 'beast' || fam === 'swarm' ? 30 : 48;
    const cy = fam === 'brute' ? 7 : fam === 'bird' ? 28 : fam === 'beast' || fam === 'swarm' ? 36 : fam === 'frog' ? 34 : 10;
    g.fillStyle = '#e3c06a';
    g.beginPath();
    g.moveTo(cx - 9, cy + 4); g.lineTo(cx - 9, cy - 5); g.lineTo(cx - 4, cy); g.lineTo(cx, cy - 7);
    g.lineTo(cx + 4, cy); g.lineTo(cx + 9, cy - 5); g.lineTo(cx + 9, cy + 4);
    g.fill();
  }
}

const enemyCache = new Map<string, Sprite>();

export function enemySprite(id: string, name: string, boss: boolean, density: number): Sprite {
  const key = `${id}|${boss ? 1 : 0}|${density}`;
  let s = enemyCache.get(key);
  if (s) return s;
  const canvas = makeCanvas(ENEMY_W * density, ENEMY_H * density);
  const g = canvas.getContext('2d')!;
  g.scale(density, density);
  drawEnemy(g, familyOf(name, boss), id, boss);
  s = { canvas, w: ENEMY_W, h: ENEMY_H, ax: 52, ay: ENEMY_GROUND };
  enemyCache.set(key, s);
  return s;
}

// ---------- background ----------

function mountains(g: CanvasRenderingContext2D, w: number, base: number, amp: number, step: number, seed: number, color: string, jag: boolean): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, base);
  for (let x = 0; x <= w + step; x += step) {
    const r = hash(`${seed}:${x}`);
    g.lineTo(x, base - amp * (0.35 + 0.65 * r) * (jag ? 1 : 0.6));
  }
  g.lineTo(w + step, base);
  g.fill();
}

function fir(g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y - 34 * s);
  g.lineTo(x + 8 * s, y - 14 * s);
  g.lineTo(x + 4 * s, y - 14 * s);
  g.lineTo(x + 11 * s, y);
  g.lineTo(x - 11 * s, y);
  g.lineTo(x - 4 * s, y - 14 * s);
  g.lineTo(x - 8 * s, y - 14 * s);
  g.fill();
}

/** Static background for a band at the given size: sky, stars, far hills, feature silhouettes, ground. */
export function renderBackground(band: number, w: number, h: number, dpr: number, boss: boolean): HTMLCanvasElement {
  const p: BandPalette = BANDS[Math.min(band, BANDS.length - 1)]!;
  const canvas = makeCanvas(w * dpr, h * dpr);
  const g = canvas.getContext('2d')!;
  g.scale(dpr, dpr);
  const horizon = Math.round(h * 0.5);
  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, boss ? '#2a0e12' : p.skyTop);
  sky.addColorStop(1, boss ? '#6a2a1c' : p.skyBottom);
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  if (p.stars) {
    g.fillStyle = 'rgba(255,245,220,0.7)';
    for (let i = 0; i < 26; i++) g.fillRect(hash(`s${band}${i}`) * w, hash(`t${band}${i}`) * horizon * 0.6, 1.2, 1.2);
  }
  // moon / sun glow
  const gx = w * (0.18 + hash(`m${band}`) * 0.3);
  const glow = g.createRadialGradient(gx, horizon * 0.5, 2, gx, horizon * 0.5, 34);
  glow.addColorStop(0, 'rgba(255,230,180,0.22)');
  glow.addColorStop(1, 'rgba(255,230,180,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, horizon);
  mountains(g, w, horizon + 2, 46, 22, band, p.far, p.feature === 'peaks' || p.feature === 'castle');
  // feature layer
  const f = p.feature;
  if (f === 'firs' || f === 'sparse' || f === 'bog') {
    const gap = f === 'firs' ? 15 : f === 'sparse' ? 38 : 46;
    for (let x = -6; x < w + 20; x += gap) {
      const r = hash(`f${band}${x}`);
      if (f === 'bog') {
        g.strokeStyle = p.near;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x, horizon + 4);
        g.lineTo(x + 3, horizon - 26 - r * 14);
        g.moveTo(x + 2, horizon - 14 - r * 6);
        g.lineTo(x + 12, horizon - 24 - r * 6);
        g.stroke();
      } else fir(g, x + r * 6, horizon + 4, 0.9 + r * 0.6, p.near);
    }
  } else if (f === 'fence') {
    g.fillStyle = p.near;
    g.fillRect(0, horizon - 4, w, 5);
    for (let x = 6; x < w; x += 18) g.fillRect(x, horizon - 14, 3, 15);
    g.fillRect(0, horizon - 11, w, 2);
    g.fillRect(w * 0.62, horizon - 36, 36, 32); // barn
    g.beginPath(); g.moveTo(w * 0.62 - 4, horizon - 34); g.lineTo(w * 0.62 + 18, horizon - 52); g.lineTo(w * 0.62 + 40, horizon - 34); g.fill();
  } else if (f === 'ruins') {
    g.fillStyle = p.near;
    for (let i = 0; i < 6; i++) {
      const x = (i + 0.5) * (w / 6) + (hash(`r${i}`) - 0.5) * 18;
      const bh = 16 + hash(`q${i}`) * 34;
      g.fillRect(x - 11, horizon - bh, 22, bh + 4);
      g.clearRect(x - 3, horizon - bh + 6, 6, 9);
      g.fillStyle = p.far; g.fillRect(x - 3, horizon - bh + 6, 6, 9); g.fillStyle = p.near;
    }
  } else if (f === 'peaks') {
    mountains(g, w, horizon + 4, 70, 38, band + 9, p.near, true);
  } else if (f === 'towers' || f === 'castle') {
    g.fillStyle = p.near;
    const n = f === 'castle' ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * (w / n);
      const th = (f === 'castle' ? 40 : 34) + hash(`w${i}`) * 22;
      g.fillRect(x - 9, horizon - th, 18, th + 4);
      for (let k = 0; k < 3; k++) g.fillRect(x - 9 + k * 7, horizon - th - 5, 4, 6);
      g.fillStyle = '#ffb04a'; g.fillRect(x - 1.5, horizon - th + 8, 3, 5); g.fillStyle = p.near;
    }
    if (f === 'castle') g.fillRect(0, horizon - 10, w, 14);
  }
  // ground
  const gr = g.createLinearGradient(0, horizon, 0, h);
  gr.addColorStop(0, p.ground);
  gr.addColorStop(1, p.groundDark);
  g.fillStyle = gr;
  g.fillRect(0, horizon, w, h - horizon);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, horizon, w, 2);
  // grass tufts / pebbles
  g.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 0; i < 40; i++) {
    const x = hash(`g${band}${i}`) * w;
    const y = horizon + 6 + hash(`h${band}${i}`) * (h - horizon - 8);
    g.fillRect(x, y, 3 + hash(`k${i}`) * 4, 1.5);
  }
  // vignette
  const v = g.createRadialGradient(w / 2, h * 0.55, h * 0.3, w / 2, h * 0.55, w * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
  return canvas;
}

/** A soft horizontal mist strip that tiles seamlessly; drifted by the scene. */
export function renderMist(band: number, w: number, h: number, dpr: number): HTMLCanvasElement {
  const p = BANDS[Math.min(band, BANDS.length - 1)]!;
  const canvas = makeCanvas(w * dpr, h * dpr);
  const g = canvas.getContext('2d')!;
  g.scale(dpr, dpr);
  g.fillStyle = p.mist;
  for (let i = 0; i < 7; i++) {
    const x = (i + hash(`x${band}${i}`) * 0.6) * (w / 7);
    const y = h * (0.3 + hash(`y${band}${i}`) * 0.5);
    const rx = 50 + hash(`z${i}`) * 80;
    for (const off of [-w, 0, w]) {
      g.beginPath();
      g.ellipse(x + off, y, rx, 5 + hash(`u${i}`) * 6, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  return canvas;
}
