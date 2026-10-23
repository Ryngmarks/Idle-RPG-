// One soldier in the new art style. Drawn in a 74x96 box (feet at y 91, body centre x 31), facing right,
// then scaled to the old "feet at 0,0, ~36 units tall" contract used by the formations.
// Performance: no filters here. Dozens of these are on screen, so shade is one extra path per shape
// and the rare-weapon glow is a wide translucent stroke behind the blade, not an SVG filter.

import type { ReactElement } from 'react';
import { GroundShadow, INK, Ln, PAL, Sh, ellipse, rect } from './kit';

export type Tool = 'weapon' | 'axe' | 'pick' | 'sickle' | 'hammer';

const HANDLE = (d: string, w = 3.4) => <Ln d={d} color={PAL.wood} w={w} />;

/** `edge` is the weapon's quality colour; `glow` is true for outstanding and better. */
function ToolArt({ tool, race, edge, glow }: { tool: Tool; race: string; edge: string | null; glow: boolean }): ReactElement {
  switch (tool) {
    case 'axe':
      return (
        <>
          {HANDLE('M48 60 L58 22')}
          <Sh d="M56 18 Q71 14 70 32 Q62 32 57 27Z" fill={PAL.steel} />
          <path d="M70 32 Q71 14 56 18" fill="none" stroke="#e8eef8" strokeWidth="1.2" strokeLinecap="round" />
        </>
      );
    case 'pick':
      return (
        <>
          {HANDLE('M48 60 L58 22')}
          <Sh d="M42 28 Q58 10 74 26 Q58 20 42 28Z" fill={PAL.steel} />
        </>
      );
    case 'sickle':
      return (
        <>
          {HANDLE('M48 60 L54 36', 3.2)}
          <Sh d="M53 37 Q73 33 70 12 Q66 25 51 29Z" fill={PAL.steel} />
        </>
      );
    case 'hammer':
      return (
        <>
          {HANDLE('M48 60 L58 22')}
          <Sh d={rect(48, 12, 20, 12, 2)} fill="#8a8f9a" />
        </>
      );
    case 'weapon':
      if (!edge) {
        // Unarmed: a rough wooden club.
        return (
          <>
            <Ln d="M49 58 L58 30" color={PAL.wood} w={4.6} />
            <Sh d="M55 34 L60 26 L65 30 L60 40Z" fill={PAL.wood} sw={1.8} />
          </>
        );
      }
      if (race === 'orcs') {
        const head = 'M55 18 Q73 12 72 36 Q62 38 56 30Z';
        return (
          <>
            {HANDLE('M48 62 L58 24')}
            {glow && <path d={head} fill="none" stroke={edge} strokeWidth="6" strokeLinejoin="round" opacity="0.5" />}
            <Sh d={head} fill="#8a8f9a" />
            <path d="M72 36 Q73 12 55 18" fill="none" stroke={edge} strokeWidth="2.2" strokeLinecap="round" />
          </>
        );
      }
      {
        const blade = 'M51 52 L58 5 L63 8 L57 53Z';
        return (
          <>
            {glow && <path d={blade} fill="none" stroke={edge} strokeWidth="6" strokeLinejoin="round" opacity="0.5" />}
            <Sh d={blade} fill="#dfe5ee" />
            <path d="M58 6 L52 51" stroke={edge} strokeWidth="1.6" strokeLinecap="round" />
            <Sh d="M44 50 L60 44 L61 49 L45 55Z" fill={PAL.gold} sw={1.8} sh={false} />
            <Ln d="M50 55 L47 64" color="#5a3820" w={3.4} />
            <Sh d={ellipse(46.5, 65.5, 2.4, 2.4)} fill={PAL.gold} sw={1.5} sh={false} />
          </>
        );
      }
  }
}

interface Look { cloth: string; shield: string; sleeve: string; helm: string; plume: string | null; skin: string; beard: string | null }

const LOOK: Record<string, Look> = {
  humans: { cloth: PAL.cloth, shield: '#233a5e', sleeve: '#3f6aa8', helm: PAL.steel, plume: PAL.red, skin: PAL.skin, beard: null },
  dwarves: { cloth: '#7a4a2a', shield: '#4a3426', sleeve: '#8a5a32', helm: '#8a8f9a', plume: null, skin: '#d9a47a', beard: '#c8793a' },
  elves: { cloth: '#2f6a48', shield: '#1f3a2c', sleeve: '#3f8a5c', helm: '#e0cf84', plume: '#7fb36a', skin: '#ecc9a2', beard: null },
};

function Human({ look, tool, race, edge, glow }: { look: Look; tool: Tool; race: string; edge: string | null; glow: boolean }): ReactElement {
  return (
    <>
      <GroundShadow cx={30} cy={91} rx={17} ry={3.4} op={0.55} />
      <Sh d={rect(21, 62, 9, 26, 3)} fill="#3d3040" />
      <Sh d={rect(33, 62, 9, 26, 3)} fill="#3d3040" />
      <Sh d={rect(19, 84, 13, 7, 2.5)} fill="#2a1c16" sh={false} />
      <Sh d={rect(32, 84, 14, 7, 2.5)} fill="#2a1c16" sh={false} />
      <Sh d="M18 36 Q31 31 44 36 L47 68 Q31 73 15 68Z" fill={look.cloth} />
      <path d="M31 38V60" stroke={PAL.gold} strokeWidth="2.2" strokeLinecap="round" />
      <Sh d={rect(15, 61, 33, 5.5, 1.5)} fill="#6a4a28" sh={false} />
      <Sh d={rect(28, 60.5, 7, 6.5, 1.5)} fill={PAL.gold} sw={1.5} sh={false} />
      <Sh d="M3 40 H22 V57 Q12.5 70 3 57Z" fill={look.shield} />
      <Sh d={ellipse(12.5, 50, 3.4, 3.4)} fill={PAL.gold} sw={1.6} sh={false} />
      <Sh d={ellipse(31, 24, 9, 10)} fill={look.skin} />
      {look.beard && <Sh d="M22.5 26 Q31 46 39.5 26 Q31 32 22.5 26Z" fill={look.beard} sw={1.6} />}
      <Sh d="M21.5 24 Q21 9 31 9 Q41 9 40.6 24 L38 20 H25Z" fill={look.helm} />
      {look.plume && <Sh d="M29 9 Q30 0 40 4 Q36 6 34 10Z" fill={look.plume} sw={1.6} sh={false} />}
      <Sh d={rect(33.5, 18, 3, 11, 1)} fill={look.helm} sw={1.5} sh={false} />
      <circle cx="37.4" cy="26" r="1.5" fill={INK} />
      {!look.beard && <path d="M33 31 q3 2 6 0" stroke="#7a4a3a" strokeWidth="1.2" fill="none" strokeLinecap="round" />}
      <g className="tool">
        <Sh d="M41 40 L52 53 L47 58 L38 47Z" fill={look.sleeve} sw={1.8} />
        <ToolArt tool={tool} race={race} edge={edge} glow={glow} />
        <Sh d={ellipse(49.5, 56, 3.8, 3.8)} fill={look.skin} sw={1.6} sh={false} />
      </g>
    </>
  );
}

function Orc({ tool, race, edge, glow }: { tool: Tool; race: string; edge: string | null; glow: boolean }): ReactElement {
  return (
    <>
      <GroundShadow cx={30} cy={91} rx={19} ry={3.6} op={0.55} />
      <Sh d={rect(19, 62, 11, 26, 4)} fill="#3a2a20" />
      <Sh d={rect(33, 62, 12, 26, 4)} fill="#3a2a20" />
      <Sh d={rect(17, 84, 14, 7, 2.5)} fill="#241812" sh={false} />
      <Sh d={rect(32, 84, 15, 7, 2.5)} fill="#241812" sh={false} />
      <Sh d="M13 38 Q31 30 49 38 L52 70 Q31 77 11 70Z" fill={PAL.orc} />
      <Sh d="M16 38 L28 36 L31 62 L14 66Z" fill="#5a3a28" sw={0} />
      <Sh d="M46 38 L34 36 L31 62 L49 66Z" fill="#5a3a28" sw={0} />
      <path d="M31 40V62" stroke={INK} strokeWidth="1.5" />
      <path d="M19 48l7 3M20 55l7 3M43 48l-7 3M42 55l-7 3" stroke="#8a6a44" strokeWidth="1.4" strokeLinecap="round" />
      <Sh d={rect(11, 62, 40, 6, 2)} fill="#8a2a1e" sw={1.8} sh={false} />
      <Sh d="M3 36 Q9 28 18 34 L16 46 Q8 48 3 42Z" fill="#4a3a34" />
      <path d="M7 31 l2 -6 l3 5 M12 31 l3 -5 l1 6" stroke={INK} strokeWidth="1.6" fill={PAL.steel} strokeLinejoin="round" />
      <Sh d="M25 14 Q31 6 37 14 L35 18 L27 18Z" fill="#1a1210" sw={1.6} sh={false} />
      <Sh d={ellipse(31, 25, 10.5, 10)} fill={PAL.orc} />
      <path d="M25 21 L36 19" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      <Sh d="M21 24 L14 20 L20 30Z" fill={PAL.orc} sw={1.5} />
      <circle cx="35.5" cy="24" r="1.9" fill="#ff4a2a" />
      <circle cx="36" cy="23.6" r=".6" fill="#fff" />
      <Sh d={rect(24, 29, 14, 4, 1.5)} fill="#3a2a20" sw={1.5} sh={false} />
      <Sh d="M26 29 L27 24.5 L29 29Z" fill={PAL.bone} sw={1.2} sh={false} />
      <Sh d="M34 29 L35.5 24.5 L37 29Z" fill={PAL.bone} sw={1.2} sh={false} />
      <g className="tool">
        <Sh d="M42 38 L53 52 L47 59 L37 46Z" fill={PAL.orc} sw={1.8} />
        <ToolArt tool={tool} race={race} edge={edge} glow={glow} />
        <Sh d={ellipse(50, 56.5, 4.6, 4.4)} fill={PAL.orc} sw={1.6} sh={false} />
      </g>
    </>
  );
}

/** One soldier, feet at (0,0), about 36 units tall, facing right. */
export function SoldierArt({ race, tool, edge, glow }: { race: string; tool: Tool; edge: string | null; glow: boolean }): ReactElement {
  return (
    <g transform="scale(0.42) translate(-31 -91)">
      {race === 'orcs' ? <Orc tool={tool} race={race} edge={edge} glow={glow} /> : <Human look={LOOK[race] ?? LOOK.humans!} tool={tool} race={race} edge={edge} glow={glow} />}
    </g>
  );
}
