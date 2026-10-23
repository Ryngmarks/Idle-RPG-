// UI icon set in the shared art style (kit.tsx): ink outline, base colour + shade/highlight
// gradients, no filters (so dozens can sit on one screen). 32x32 viewBox, readable at 16-32 px.
// Resource icons (wood, stone, ore, food, bed) live in resources.tsx; `Icon` forwards to them.

import type { ReactElement } from 'react';
import { INK, Ln, PAL, Sh, ellipse, rect } from './kit';
import { ResIcon, type IconId } from './resources';

export type UiIconName =
  | 'sword' | 'swords' | 'pickaxe' | 'axe' | 'hammer' | 'anvil' | 'wheat'
  | 'shield' | 'castle' | 'scroll' | 'book'
  | 'strength' | 'work' | 'heart' | 'star' | 'xp'
  | 'target' | 'tent' | 'trainingCamp' | 'farm' | 'woodshed' | 'barracks'
  | 'menu' | 'lock' | 'crown' | 'check' | 'warning' | 'hourglass' | 'flag' | 'skull'
  | 'heal' | 'zzz' | 'soldier' | 'horn' | 'pencil' | 'close' | 'arrow' | 'tree' | 'clock'
  | 'tankard' | 'dotSafe' | 'dotRisky' | 'dotDeadly';

const STEEL = '#c4ccd9';
const GOLD = PAL.gold;

const Blade = ({ d }: { d: string }): ReactElement => <Sh d={d} fill={STEEL} sw={1.4} hi />;

const SHAPES: Record<UiIconName, () => ReactElement> = {
  sword: () => (
    <>
      <Blade d="M16 3 L19 6 V21 H13 V6 Z" />
      <path d="M16 5 V20" stroke="#8a93a4" strokeWidth="1" />
      <Sh d={rect(8, 21, 16, 3.5, 1.5)} fill={GOLD} sw={1.4} hi />
      <Ln d="M16 24.5 V28" color={PAL.leather} w={3} />
      <Sh d={ellipse(16, 29, 2.2, 1.8)} fill={GOLD} sw={1.2} sh={false} />
    </>
  ),
  swords: () => (
    <>
      <g transform="rotate(-42 16 16)">
        <Blade d="M16 2 L18.6 5 V19 H13.4 V5 Z" />
        <Sh d={rect(9.5, 19, 13, 3, 1.4)} fill={GOLD} sw={1.3} />
        <Ln d="M16 22 V26.5" color={PAL.leather} w={2.8} />
      </g>
      <g transform="rotate(42 16 16)">
        <Blade d="M16 2 L18.6 5 V19 H13.4 V5 Z" />
        <Sh d={rect(9.5, 19, 13, 3, 1.4)} fill={GOLD} sw={1.3} />
        <Ln d="M16 22 V26.5" color={PAL.leather} w={2.8} />
      </g>
    </>
  ),
  pickaxe: () => (
    <>
      <Ln d="M9 28 L21 9" color={PAL.wood} w={3.2} />
      <Sh d="M4 12 Q14 1 28 11 Q16 8 9 16 Z" fill={STEEL} sw={1.5} hi />
    </>
  ),
  axe: () => (
    <>
      <Ln d="M8 29 L21 5" color={PAL.wood} w={3.2} />
      <Sh d="M17 4 Q29 4 28 15 Q22 16 17 13 Q20 9 17 4 Z" fill={STEEL} sw={1.5} hi />
    </>
  ),
  hammer: () => (
    <>
      <Ln d="M9 28 L19 13" color={PAL.wood} w={3.2} />
      <g transform="rotate(35 20 10)">
        <Sh d={rect(11, 4, 18, 10, 2)} fill={STEEL} sw={1.5} hi />
        <path d="M17 4 V14" stroke="#8a93a4" strokeWidth="1" />
      </g>
    </>
  ),
  anvil: () => (
    <>
      <ellipse cx="16" cy="28.5" rx="11" ry="2" fill="#000" opacity=".45" />
      <Sh d="M3 9 H24 Q29 9 29 13 Q22 13 21 16 V21 H24 L25 26 H7 L8 21 H11 V16 Q11 13 3 13 Z" fill="#6d7280" sw={1.6} hi />
      <path d="M5 10.4 H24" stroke="#c4ccd9" strokeWidth="1.2" strokeLinecap="round" opacity=".7" />
    </>
  ),
  wheat: () => (
    <>
      <Ln d="M16 29 V8" color="#a8873a" w={1.8} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <Sh d={ellipse(12.5, 10 + i * 4.8, 2.6, 3.4)} fill="#e3bd58" sw={1.2} />
          <Sh d={ellipse(19.5, 10 + i * 4.8, 2.6, 3.4)} fill="#d4a840" sw={1.2} />
        </g>
      ))}
      <Sh d={ellipse(16, 5, 2.3, 3.6)} fill="#f0cf70" sw={1.2} />
    </>
  ),
  shield: () => (
    <>
      <Sh d="M16 3 L28 7 V16 Q28 25 16 30 Q4 25 4 16 V7 Z" fill={PAL.cloth} sw={1.7} hi />
      <path d="M16 3 V30" stroke={INK} strokeWidth="1" opacity=".5" />
      <path d="M16 8 V24 M9 14 H23" stroke={GOLD} strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  castle: () => (
    <>
      <Sh d="M4 29 V12 H8 V9 H11 V12 H14 V9 H18 V12 H21 V9 H24 V12 H28 V29 Z" fill="#8a8a96" sw={1.6} hi />
      <Sh d="M12.5 29 V21 Q16 16 19.5 21 V29 Z" fill="#1a1210" sw={1.4} sh={false} />
      <Ln d="M16 9 V3" color={PAL.woodD} w={1.6} />
      <Sh d="M16 3 L23 5 L16 7 Z" fill={PAL.red} sw={1.1} sh={false} />
    </>
  ),
  scroll: () => (
    <>
      <Sh d="M8 5 H25 V24 Q25 28 21 28 H7 Q11 28 11 24 V9 Q11 5 8 5 Z" fill={PAL.bone} sw={1.6} hi />
      <Sh d="M5 5 Q5 3 8 3 Q11 3 11 5 Q11 8 8 8 H5 Z" fill="#d9c9a0" sw={1.3} sh={false} />
      <path d="M14 11 H22 M14 15 H22 M14 19 H20" stroke="#7a5a30" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  book: () => (
    <>
      <Sh d="M4 6 Q10 4 16 7 Q22 4 28 6 V25 Q22 23 16 26 Q10 23 4 25 Z" fill={PAL.bone} sw={1.6} hi />
      <path d="M16 7 V26" stroke={INK} strokeWidth="1.3" />
      <path d="M7 10 Q11 9 13.5 10.5 M7 14 Q11 13 13.5 14.5 M18.5 10.5 Q21 9 25 10 M18.5 14.5 Q21 13 25 14" stroke="#7a5a30" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </>
  ),
  strength: () => (
    <g transform="rotate(45 16 16)">
      <Blade d="M16 1 L19 4 V20 H13 V4 Z" />
      <Sh d={rect(8, 20, 16, 3.5, 1.5)} fill={GOLD} sw={1.4} hi />
      <Ln d="M16 23.5 V27" color={PAL.leather} w={3} />
    </g>
  ),
  work: () => (
    <>
      <Sh d="M16 3 L19 5 L21 4 L23.5 7 L22.5 9 L25 11 L28 11 V15 L25 16 L24 18.5 L26 21 L23 24 L20.5 22.5 L18.5 24 L18 27 H14 L13 24 L11 22.5 L8.5 24 L5.5 21 L7.5 18.5 L6.5 16 L4 15 V11 L7 10.5 L8.5 8 L7 5.5 L10 3.5 L12.5 5 Z" fill="#9aa2b2" sw={1.5} hi />
      <circle cx="16" cy="15" r="4.5" fill="#1a1620" stroke={INK} strokeWidth="1.4" />
    </>
  ),
  heart: () => (
    <Sh d="M16 28 C4 19 3 10 8.5 6.5 C12 4.5 15 6.5 16 9 C17 6.5 20 4.5 23.5 6.5 C29 10 28 19 16 28 Z" fill="#c8402f" sw={1.6} hi />
  ),
  star: () => (
    <Sh d="M16 3 L19.6 11.2 L28.5 12 L21.8 17.9 L23.8 26.6 L16 22 L8.2 26.6 L10.2 17.9 L3.5 12 L12.4 11.2 Z" fill="#e8b84a" sw={1.6} hi />
  ),
  xp: () => (
    <>
      <Sh d="M16 3 L19.6 11.2 L28.5 12 L21.8 17.9 L23.8 26.6 L16 22 L8.2 26.6 L10.2 17.9 L3.5 12 L12.4 11.2 Z" fill="#8a6bbf" sw={1.6} hi />
    </>
  ),
  target: () => (
    <>
      <circle cx="15" cy="17" r="11" fill="#e8e0d0" stroke={INK} strokeWidth="1.6" />
      <circle cx="15" cy="17" r="7.6" fill={PAL.red} stroke={INK} strokeWidth="1.2" />
      <circle cx="15" cy="17" r="4.4" fill="#e8e0d0" stroke={INK} strokeWidth="1.2" />
      <circle cx="15" cy="17" r="1.8" fill={PAL.red} />
      <Ln d="M15 17 L26 6" color={PAL.woodD} w={1.8} />
      <Sh d="M24 3 L29 3 L29 8 L26.5 7 L25 5.5 Z" fill={GOLD} sw={1.1} sh={false} />
    </>
  ),
  tent: () => (
    <>
      <ellipse cx="16" cy="28.5" rx="13" ry="2" fill="#000" opacity=".45" />
      <Sh d="M2 28 L16 5 L30 28 Z" fill="#a98a5e" sw={1.7} hi />
      <Sh d="M12 28 L16 15 L20 28 Z" fill="#1a1210" sw={1.4} sh={false} />
      <Ln d="M16 5 V2" color={PAL.woodD} w={1.6} />
    </>
  ),
  trainingCamp: () => (
    <>
      <ellipse cx="16" cy="29" rx="11" ry="1.8" fill="#000" opacity=".45" />
      <Ln d="M16 28 V13" color={PAL.woodD} w={3} />
      <Ln d="M8 14 H24" color={PAL.wood} w={3} />
      <Sh d={ellipse(16, 9, 4.6, 4.8)} fill="#c49a5e" sw={1.5} hi />
      <g transform="rotate(30 24 24)"><Blade d="M24 14 L25.8 16 V25 H22.2 V16 Z" /></g>
    </>
  ),
  farm: () => (
    <>
      <ellipse cx="16" cy="29" rx="13" ry="2" fill="#000" opacity=".45" />
      <Sh d="M3 28 V14 L16 4 L29 14 V28 Z" fill={PAL.red} sw={1.7} hi />
      <path d="M3 14 L16 4 L29 14" fill="none" stroke="#7a2a20" strokeWidth="2" />
      <Sh d="M10 28 V17 H22 V28 Z" fill="#e8dcc0" sw={1.4} sh={false} />
      <path d="M10 17 L22 28 M22 17 L10 28" stroke={INK} strokeWidth="1.3" />
    </>
  ),
  woodshed: () => (
    <>
      <ellipse cx="16" cy="29" rx="13" ry="2" fill="#000" opacity=".45" />
      <Sh d="M2 12 L16 5 L30 12 V15 H2 Z" fill="#7a4a2a" sw={1.6} hi />
      {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => (
        <Sh key={`${r}${c}`} d={ellipse(7 + c * 6 + (r % 2) * 3, 24 - r * 4.2, 3, 2.1)} fill={r % 2 ? '#d6a870' : PAL.wood} sw={1.1} sh={false} />
      )))}
      <Ln d="M3 28 V14 M29 28 V14" color={PAL.woodD} w={2.4} />
    </>
  ),
  barracks: () => (
    <>
      <ellipse cx="16" cy="29" rx="13.5" ry="2" fill="#000" opacity=".45" />
      <Sh d="M2 14 L16 5 L30 14 Z" fill="#8a4a2c" sw={1.7} hi />
      <Sh d="M4 28 V14 H28 V28 Z" fill="#5a4030" sw={1.7} hi />
      <Sh d="M13 28 V19 Q16 15.5 19 19 V28 Z" fill="#1a1210" sw={1.3} sh={false} />
      <Ln d="M16 5 V1.5" color={PAL.woodD} w={1.4} />
      <Sh d="M16 1.5 L22 3 L16 4.5 Z" fill={PAL.red} sw={1} sh={false} />
    </>
  ),
  menu: () => (
    <path d="M5 8 H27 M5 16 H27 M5 24 H27" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  ),
  lock: () => (
    <>
      <path d="M10 14 V10 Q10 4 16 4 Q22 4 22 10 V14" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M10 14 V10 Q10 4 16 4 Q22 4 22 10 V14" fill="none" stroke="#a9a290" strokeWidth="2.6" strokeLinecap="round" />
      <Sh d={rect(6, 14, 20, 14, 3)} fill={GOLD} sw={1.6} hi />
      <circle cx="16" cy="20" r="2.2" fill={INK} />
      <path d="M16 20 V24" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  crown: () => (
    <>
      <Sh d="M3 11 L10 17 L16 6 L22 17 L29 11 L26 26 H6 Z" fill="#e8b84a" sw={1.6} hi />
      <path d="M6 22 H26" stroke="#9a6e1a" strokeWidth="1.5" />
      <circle cx="16" cy="6" r="2.2" fill={PAL.red} stroke={INK} strokeWidth="1.1" />
      <circle cx="3" cy="11" r="1.8" fill={PAL.red} stroke={INK} strokeWidth="1" />
      <circle cx="29" cy="11" r="1.8" fill={PAL.red} stroke={INK} strokeWidth="1" />
    </>
  ),
  check: () => (
    <>
      <path d="M6 17 L13 24 L26 8" fill="none" stroke={INK} strokeWidth="6.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 17 L13 24 L26 8" fill="none" stroke="#8fc060" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  warning: () => (
    <>
      <Sh d="M16 3.5 L29.5 27 H2.5 Z" fill="#e0a43a" sw={1.7} hi />
      <path d="M16 11 V19" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="16" cy="23.2" r="1.7" fill={INK} />
    </>
  ),
  tankard: () => (
    <>
      <path d="M23 10 H27 Q30 10 30 14 V19 Q30 23 26 23 H23" fill="none" stroke={INK} strokeWidth="4.2" strokeLinecap="round" />
      <path d="M23 10 H27 Q30 10 30 14 V19 Q30 23 26 23 H23" fill="none" stroke={STEEL} strokeWidth="2" strokeLinecap="round" />
      <Sh d="M5 8 H23 V26 Q23 29 20 29 H8 Q5 29 5 26 Z" fill={PAL.wood} sw={1.6} hi />
      <path d="M5 14 H23 M5 22 H23" stroke={GOLD} strokeWidth="1.8" />
      <Sh d="M4 8 Q4 3 9 4 Q11 1.5 14 3.5 Q18 1.5 20 4.5 Q24 5 24 8 Z" fill="#f6efd8" sw={1.4} hi />
    </>
  ),
  hourglass: () => (
    <>
      <Sh d="M7 3 H25 V6 Q25 12 18.5 16 Q25 20 25 26 V29 H7 V26 Q7 20 13.5 16 Q7 12 7 6 Z" fill="#d8e4ee" sw={1.6} hi />
      <path d="M10 6 H22 Q21 10 16 14 Q11 10 10 6 Z" fill="#e0b04a" />
      <path d="M16 18 Q12 21 10 27 H22 Q20 21 16 18 Z" fill="#e0b04a" />
      <Sh d={rect(5, 1.5, 22, 3, 1)} fill={PAL.wood} sw={1.3} sh={false} />
      <Sh d={rect(5, 27.5, 22, 3, 1)} fill={PAL.wood} sw={1.3} sh={false} />
    </>
  ),
  flag: () => (
    <>
      <Ln d="M9 29 V4" color={PAL.woodD} w={2.4} />
      <Sh d="M9 5 Q17 2 21 5 Q25 8 28 6 V17 Q25 19 21 16 Q17 13 9 16 Z" fill={PAL.red} sw={1.5} hi />
    </>
  ),
  skull: () => (
    <>
      <Sh d="M16 3 C8 3 5 9 5 14 C5 18 7 20 9 21 V27 H23 V21 C25 20 27 18 27 14 C27 9 24 3 16 3 Z" fill={PAL.bone} sw={1.6} hi />
      <ellipse cx="11.5" cy="15" rx="3" ry="3.3" fill={INK} />
      <ellipse cx="20.5" cy="15" rx="3" ry="3.3" fill={INK} />
      <path d="M16 18 L14.5 21.5 H17.5 Z M12.5 24 V27 M16 24 V27 M19.5 24 V27" stroke={INK} strokeWidth="1.4" fill={INK} />
    </>
  ),
  heal: () => (
    <Sh d="M12 3 H20 V12 H29 V20 H20 V29 H12 V20 H3 V12 H12 Z" fill="#6fbf5a" sw={1.6} hi />
  ),
  zzz: () => (
    <>
      <path d="M5 6 H14 L5 17 H15" fill="none" stroke={INK} strokeWidth="5.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 6 H14 L5 17 H15" fill="none" stroke="#9ab0d8" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 15 H25 L18 23 H26" fill="none" stroke={INK} strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 15 H25 L18 23 H26" fill="none" stroke="#7b8fb8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  soldier: () => (
    <>
      <Sh d={ellipse(16, 10, 5.5, 5.8)} fill={PAL.skin} sw={1.5} hi />
      <Sh d="M10.5 9 Q10.5 3 16 3 Q21.5 3 21.5 9 Z" fill={STEEL} sw={1.4} hi />
      <Sh d="M5 29 Q5 18 16 17 Q27 18 27 29 Z" fill={PAL.cloth} sw={1.6} hi />
    </>
  ),
  horn: () => (
    <>
      <Sh d="M3 12 Q4 8 8 9 L26 5 Q30 5 29 10 L29 18 Q30 23 26 23 L8 19 Q4 20 3 16 Z" fill="#d9c9a0" sw={1.6} hi />
      <Sh d="M23 5 L29 5 L29 23 L23 23 Z" fill={GOLD} sw={1.4} sh={false} />
    </>
  ),
  pencil: () => (
    <>
      <Sh d="M5 27 L7 20 L22 5 L27 10 L12 25 Z" fill="#e0b04a" sw={1.5} hi />
      <path d="M20 7 L25 12" stroke={INK} strokeWidth="1.3" />
      <path d="M5 27 L7 20 L12 25 Z" fill={PAL.skin} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
    </>
  ),
  close: () => (
    <>
      <path d="M8 8 L24 24 M24 8 L8 24" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
    </>
  ),
  arrow: () => (
    <path d="M5 16 H25 M18 8 L26 16 L18 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
  ),
  tree: () => (
    <>
      <ellipse cx="16" cy="29" rx="9" ry="1.8" fill="#000" opacity=".45" />
      <Sh d={rect(14, 21, 4, 8, 1)} fill={PAL.wood} sw={1.4} />
      <Sh d="M16 2 L25 13 H20 L27 22 H5 L12 13 H7 Z" fill="#3f7a3a" sw={1.6} hi />
    </>
  ),
  clock: () => (
    <>
      <circle cx="16" cy="16" r="12.5" fill="#e8e0d0" stroke={INK} strokeWidth="1.7" />
      <circle cx="16" cy="16" r="12.5" fill="url(#gSh)" />
      <path d="M16 8 V16 L22 19" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  dotSafe: () => <circle cx="16" cy="16" r="9" fill="#6fbf5a" stroke={INK} strokeWidth="2" />,
  dotRisky: () => <circle cx="16" cy="16" r="9" fill="#e0b04a" stroke={INK} strokeWidth="2" />,
  dotDeadly: () => <circle cx="16" cy="16" r="9" fill="#c8402f" stroke={INK} strokeWidth="2" />,
};

const RES_IDS = new Set<string>(['wood', 'stone', 'ore', 'food', 'bed']);

/** Decorative by default (pair with a text label); pass `label` to expose an accessible name. */
export function Icon({ name, size = 24, label, className }: { name: UiIconName | IconId; size?: number; label?: string; className?: string }): ReactElement {
  if (RES_IDS.has(name)) return <ResIcon id={name as IconId} size={size} />;
  const Shape = SHAPES[name as UiIconName];
  return (
    <svg
      className={`ico ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <Shape />
    </svg>
  );
}
