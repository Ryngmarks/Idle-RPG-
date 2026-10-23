// Resource icons (wood, stone, ore, food, bed) in the shared art style, 48x48 viewBox.

import type { ReactElement } from 'react';
import { GroundShadow, Ln, PAL, Rim, Sh, ellipse, rect } from './kit';

export type IconId = 'wood' | 'stone' | 'ore' | 'food' | 'bed';

function Log({ x, y }: { x: number; y: number }): ReactElement {
  return (
    <>
      <Sh d={rect(x, y, 26, 11, 4)} fill={PAL.wood} hi />
      <Sh d={ellipse(x + 26, y + 5.5, 4.4, 5.5)} fill="#d6a870" hi />
      <ellipse cx={x + 26} cy={y + 5.5} rx="2" ry="2.6" fill="none" stroke={PAL.wood} strokeWidth="1.2" />
      <path d={`M${x + 5} ${y + 4}h9M${x + 8} ${y + 8}h7`} stroke="#5a3820" strokeWidth="1.2" strokeLinecap="round" opacity=".7" />
    </>
  );
}

const SHAPES: Record<IconId, () => ReactElement> = {
  wood: () => (
    <>
      <GroundShadow cx={24} cy={43} rx={19} ry={3} />
      <Log x={5} y={30} />
      <Log x={11} y={20} />
      <Log x={5} y={10} />
    </>
  ),
  stone: () => (
    <>
      <GroundShadow cx={25} cy={43} rx={20} ry={3} />
      <Sh d="M6 40 L8 26 L18 20 L30 22 L36 34 L33 41 Z" fill={PAL.stone} hi />
      <path d="M18 20 L22 32 L36 34 M22 32 L8 26" stroke="#0e0a10" strokeWidth="1.3" fill="none" strokeLinejoin="round" opacity=".7" />
      <Sh d="M26 41 L28 30 L36 25 L43 29 L44 38 L41 42 Z" fill="#6e6e7c" hi />
    </>
  ),
  ore: () => (
    <>
      <GroundShadow cx={24} cy={43} rx={20} ry={3} />
      <Sh d="M5 41 L7 27 L16 17 L29 15 L40 24 L43 36 L38 42 Z" fill="#4d4a52" hi />
      <Sh d="M17 18 L23 30 L14 34 L9 27Z" fill="#8fb0d0" sw={1.6} hi />
      <Sh d="M29 17 L38 25 L31 33 L24 27Z" fill="#c8d6e6" sw={1.6} hi />
      <Sh d="M30 34 L38 33 L36 40 L28 40Z" fill="#e0b04a" sw={1.6} hi />
    </>
  ),
  food: () => (
    <>
      <GroundShadow cx={24} cy={44} rx={14} ry={2.6} />
      {[-18, 0, 18].map((r) => (
        <g key={r} transform={`rotate(${r} 24 42)`}>
          <Ln d="M24 42 V14" color="#a8873a" w={2.2} />
        </g>
      ))}
      {[-18, 0, 18].map((r) => (
        <g key={`h${r}`} transform={`rotate(${r} 24 42)`}>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <Sh d={ellipse(20.5, 11.5 + i * 5.5, 2.6, 4)} fill="#e3bd58" sw={1.3} />
              <Sh d={ellipse(27.5, 11.5 + i * 5.5, 2.6, 4)} fill="#d4a840" sw={1.3} />
            </g>
          ))}
          <Sh d={ellipse(24, 6, 2.4, 4)} fill="#f0cf70" sw={1.3} />
        </g>
      ))}
      <Sh d={rect(17, 36, 14, 5, 2)} fill={PAL.red} sw={1.6} />
    </>
  ),
  bed: () => (
    <>
      <GroundShadow cx={24} cy={43} rx={20} ry={3} />
      <Sh d={rect(5, 16, 5, 26, 1.5)} fill={PAL.woodD} />
      <Sh d={rect(5, 30, 38, 6, 2)} fill={PAL.wood} />
      <Sh d={rect(38, 26, 5, 16, 1.5)} fill={PAL.woodD} />
      <Sh d={rect(10, 22, 28, 10, 3)} fill="#e8e0d0" hi />
      <Sh d={rect(11, 22, 9, 7, 3)} fill="#fff7e6" sw={1.6} />
      <Sh d="M20 24 H38 V32 H20Z" fill="#3f6aa8" />
      <path d="M24 24v8M30 24v8" stroke="#2a4a7a" strokeWidth="1.2" opacity=".7" />
    </>
  ),
};

/** Decorative: always pair with a text label or sr-only name. */
export function ResIcon({ id, size = 20 }: { id: IconId; size?: number }): ReactElement {
  const Shape = SHAPES[id];
  return (
    <svg className="res-icon" width={size} height={size} viewBox="0 0 48 48" aria-hidden focusable="false">
      {size >= 32 ? <Rim><Shape /></Rim> : <Shape />}
    </svg>
  );
}
