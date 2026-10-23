// Shared kit for the SVG art style: palette, shape helpers and the one global <defs>.
// Style rules (docs/mockups/art-style.html): 2 px ink outline with round joins, base colour plus
// two shared gradients for shade and highlight, a warm rim light, a soft ground shadow, and glow
// ONLY on rare weapons and on danger. Nothing here may create a filter per figure.

import type { ReactElement, ReactNode } from 'react';

export const INK = '#0e0a10';

export const PAL = {
  skin: '#e0b48a',
  orc: '#7a9a3c',
  orcD: '#4a6624',
  steel: '#b4bccb',
  cloth: '#2f5486',
  wood: '#8a5a32',
  woodD: '#6a4426',
  gold: '#c9a24a',
  leather: '#5a3a28',
  red: '#a8402f',
  bone: '#efe4c8',
  stone: '#8a8a96',
} as const;

// ------------------------------------------------------------------ path helpers

export const ellipse = (cx: number, cy: number, rx: number, ry: number): string =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;

export const rect = (x: number, y: number, w: number, h: number, r = 0): string =>
  `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;

// ------------------------------------------------------------------ shapes

/** A filled, shaded and outlined shape. `hi` adds the highlight gradient (skip it on small figures). */
export function Sh({ d, fill, sw = 2, sh = true, hi = false }: { d: string; fill: string; sw?: number; sh?: boolean; hi?: boolean }): ReactElement {
  return (
    <>
      <path d={d} fill={fill} stroke={sw ? INK : undefined} strokeWidth={sw || undefined} strokeLinejoin="round" strokeLinecap="round" />
      {sh && <path d={d} fill="url(#gSh)" />}
      {hi && <path d={d} fill="url(#gHi)" />}
    </>
  );
}

/** A thick line (handle, stalk, leg) with an ink outline. */
export function Ln({ d, color, w, ink = true }: { d: string; color: string; w: number; ink?: boolean }): ReactElement {
  return (
    <>
      {ink && <path d={d} fill="none" stroke={INK} strokeWidth={w + 2} strokeLinecap="round" strokeLinejoin="round" />}
      <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

export function GroundShadow({ cx, cy, rx, ry, op = 0.5 }: { cx: number; cy: number; rx: number; ry: number; op?: number }): ReactElement {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#000" opacity={op} />;
}

/** Wrap static art in the warm rim-light filter. Use once per picture, never per soldier. */
export function Rim({ children }: { children: ReactNode }): ReactElement {
  return <g filter="url(#fRim)">{children}</g>;
}

// ------------------------------------------------------------------ the one global <defs>

/** Rendered once at the root. Every art component references these ids. */
export function ArtDefs(): ReactElement {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden focusable="false">
      <defs>
        <linearGradient id="gSh" x1="0.2" y1="0.1" x2="0.9" y2="1">
          <stop offset="0.35" stopColor="#0a0610" stopOpacity="0" />
          <stop offset="1" stopColor="#0a0610" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="gHi" x1="0" y1="0" x2="0.7" y2="0.7">
          <stop offset="0" stopColor="#fff" stopOpacity="0.36" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id="fRim" x="-15%" y="-15%" width="130%" height="130%">
          <feOffset in="SourceAlpha" dx="1.1" dy="1.1" result="o" />
          <feComposite in="SourceAlpha" in2="o" operator="out" result="edge" />
          <feFlood floodColor="#ffe0a8" floodOpacity="0.6" />
          <feComposite in2="edge" operator="in" result="rim" />
          <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="rim" /></feMerge>
        </filter>
        <filter id="fGlowRed" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="b" />
          <feFlood floodColor="#ff3a22" floodOpacity="1" />
          <feComposite in2="b" operator="in" result="g" />
          <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="bgN" cx="50%" cy="40%" r="70%"><stop offset="0" stopColor="#3a2c22" /><stop offset="1" stopColor="#100c10" /></radialGradient>
        <radialGradient id="bgB" cx="55%" cy="45%" r="70%"><stop offset="0" stopColor="#4a1c18" /><stop offset="1" stopColor="#0f0a0d" /></radialGradient>
        <linearGradient id="gFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a2c20" /><stop offset="1" stopColor="#150f0d" /></linearGradient>
        <radialGradient id="gAura" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#c0301f" stopOpacity="0.55" /><stop offset="1" stopColor="#c0301f" stopOpacity="0" /></radialGradient>
        <radialGradient id="gSun" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#e8e0a0" stopOpacity="0.45" /><stop offset="1" stopColor="#e8e0a0" stopOpacity="0" /></radialGradient>
        <linearGradient id="skyBirch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0e1a17" /><stop offset="1" stopColor="#2c3d26" /></linearGradient>
        <linearGradient id="gGround" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34301c" /><stop offset="1" stopColor="#14110c" /></linearGradient>
      </defs>
    </svg>
  );
}
