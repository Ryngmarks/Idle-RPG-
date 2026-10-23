// Soldier figures and army formations. Presentation only: the number of figures follows the
// troop's real size, the pose follows its real activity.

import type { ReactElement } from 'react';
import type { ActivityKind, EquipmentBucket } from '../core';
import { ENEMY_ART, SCENES } from './art';
import { QUALITY_COLOR } from './labels';

type Pose = 'idle' | 'work' | 'fight';
type Tool = 'weapon' | 'axe' | 'pick' | 'sickle' | 'hammer';

const TOOL_FOR: Record<ActivityKind, Tool> = {
  combat: 'weapon',
  woodcutting: 'axe',
  mining: 'pick',
  food: 'sickle',
  construction: 'hammer',
  smithing: 'hammer',
};

const WOOD = '#8a6a44';
const STEEL = '#c9ccd4';

/** Rare qualities glow on the soldiers, so a well-armed army is visible at a glance. */
const GLOWING = new Set([QUALITY_COLOR.outstanding, QUALITY_COLOR.excellent, QUALITY_COLOR.masterpiece]);

/** `edge` is the weapon's quality colour, or null for an unarmed soldier (a wooden club). */
function ToolArt({ tool, race, edge }: { tool: Tool; race: string; edge: string | null }): ReactElement {
  switch (tool) {
    case 'axe':
      return (
        <g>
          <path d="M5 -10 L9 -28" stroke={WOOD} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M8 -28 q5 -1 5 4 q-4 0 -6 -1 Z" fill={STEEL} />
        </g>
      );
    case 'pick':
      return (
        <g>
          <path d="M5 -10 L8 -28" stroke={WOOD} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M2 -27 Q8 -32 14 -26" stroke={STEEL} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'sickle':
      return (
        <g>
          <path d="M5 -12 L6 -20" stroke={WOOD} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M6 -20 q7 -2 6 -9 q-1 5 -6 6" fill={STEEL} />
        </g>
      );
    case 'hammer':
      return (
        <g>
          <path d="M5 -10 L7 -25" stroke={WOOD} strokeWidth="1.6" strokeLinecap="round" />
          <rect x="3.5" y="-29" width="7" height="4" rx="1" fill="#837a73" />
        </g>
      );
    case 'weapon':
      if (!edge) {
        return <path d="M5 -10 L9 -27" stroke="#6a4a2a" strokeWidth="3" strokeLinecap="round" />;
      }
      return race === 'orcs' ? (
        <g className={GLOWING.has(edge) ? 'blade--rare' : undefined} style={{ ['--q' as string]: edge }}>
          <path d="M5 -8 L8 -26" stroke={WOOD} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M7 -27 q8 0 8 7 q-5 1 -8 -1 Z" fill="#a8a29a" stroke={edge} strokeWidth="1.2" />
        </g>
      ) : (
        <g className={GLOWING.has(edge) ? 'blade--rare' : undefined} style={{ ['--q' as string]: edge }}>
          <path d="M6 -14 L6 -36" stroke={STEEL} strokeWidth="2" strokeLinecap="round" />
          <path d="M6 -36 L6 -38" stroke={edge} strokeWidth="2" strokeLinecap="round" />
          <path d="M3 -14 H9" stroke={edge} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M6 -14 V-10" stroke={WOOD} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
  }
}

/** One soldier, feet at (0,0), about 36 units tall, facing right. */
export function Soldier({ race, tool, edge = '#b8b2a6' }: { race: string; tool: Tool; edge?: string | null }) {
  const orc = race === 'orcs';
  return orc ? (
    <g>
      <path d="M-5 -12 v11 h3 v-11 M2 -12 v11 h3 v-11" fill="#2b1d16" stroke="#2b1d16" strokeWidth="2" />
      <path d="M-8 -26 Q0 -30 8 -26 L8 -11 L-8 -11 Z" fill="#4a2f22" />
      <path d="M-8 -15 h16" stroke="#8a2a1e" strokeWidth="2" />
      <path d="M-10 -25 q-3 6 -1 12" stroke="#6f8a3a" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <circle cx="1" cy="-31" r="5.5" fill="#6f8a3a" />
      <path d="M-1 -37 q1 -5 3 0" fill="#1a1210" />
      <circle cx="3.5" cy="-32" r="0.9" fill="#ff4a2a" />
      <path d="M3 -27.5 l1 -2 M5.5 -27.5 l0.5 -2" stroke="#efe4c8" strokeWidth="1" strokeLinecap="round" />
      <g className="tool">
        <path d="M8 -24 q0 6 -2 10" stroke="#6f8a3a" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <ToolArt tool={tool} race={race} edge={edge} />
      </g>
    </g>
  ) : (
    <g>
      <path d="M-3.5 -11 v10 M2.5 -11 v10" stroke="#3a2a20" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M-6 -24 L6 -24 L7 -10 L-7 -10 Z" fill="#2c4a6e" />
      <path d="M-7 -14 h14" stroke="#c9a24a" strokeWidth="1" />
      <circle cx="0" cy="-28.5" r="4.3" fill="#e0b48a" />
      <path d="M-4.8 -29 a4.8 4.8 0 0 1 9.6 0 Z" fill="#9aa4ae" />
      <rect x="1.6" y="-30" width="1.2" height="4" fill="#9aa4ae" />
      <circle cx="-6" cy="-17" r="5" fill="#22344a" stroke="#c9a24a" strokeWidth="1.1" />
      <circle cx="-6" cy="-17" r="1.2" fill="#c9a24a" />
      <g className="tool">
        <ToolArt tool={tool} race={race} edge={edge} />
      </g>
    </g>
  );
}

interface Placed {
  x: number;
  y: number;
  s: number;
  i: number;
}

/** Formation: few soldiers stand large in a row; many form ranks that shrink towards the back. */
function formation(count: number, cx: number, baseline: number, width: number): Placed[] {
  const perRank = count <= 6 ? count : count <= 16 ? Math.ceil(count / 2) : Math.ceil(count / 3);
  const ranks = Math.ceil(count / perRank);
  const base = count <= 2 ? 1.45 : count <= 6 ? 1.2 : count <= 16 ? 1 : 0.8;
  const out: Placed[] = [];
  let i = 0;
  for (let r = 0; r < ranks; r++) {
    const inRank = Math.min(perRank, count - r * perRank);
    const s = base * (1 - 0.14 * r);
    const spacing = Math.min(24 * s, width / Math.max(1, inRank));
    const offset = r % 2 ? spacing / 2 : 0;
    for (let k = 0; k < inRank; k++) {
      out.push({ x: cx + (k - (inRank - 1) / 2) * spacing + offset, y: baseline - 8 * r, s, i: i++ });
    }
  }
  return out.sort((a, b) => a.y - b.y); // back ranks first
}

const MAX_DRAWN = 36;

/** Quality colour (or null = unarmed) for figure i of `drawn`, sampled proportionally from the troop. */
function edgeFor(i: number, drawn: number, size: number, equipment: EquipmentBucket[]): string | null {
  const soldier = Math.floor(((i + 0.5) * size) / drawn);
  let seen = 0;
  for (const b of equipment) {
    seen += b.count;
    if (soldier < seen) return QUALITY_COLOR[b.quality];
  }
  return null;
}

export function ArmyFigures({
  race, size, activity, cx, baseline, width, flip = false, equipment = [],
}: { race: string; size: number; activity: ActivityKind | null; cx: number; baseline: number; width: number; flip?: boolean; equipment?: EquipmentBucket[] }) {
  const drawn = Math.min(size, MAX_DRAWN);
  const pose: Pose = activity === 'combat' ? 'fight' : activity ? 'work' : 'idle';
  const tool: Tool = activity ? TOOL_FOR[activity] : 'weapon';
  const placed = formation(drawn, cx, baseline, width);
  const front = placed.length ? Math.max(...placed.map((p) => p.y)) : baseline;
  const banner = size >= 10;
  return (
    <g>
      {banner && (
        <g className="fig fig--idle">
          <path d={`M${cx - width / 2 - 4} ${front - 4} V${front - 58}`} stroke={WOOD} strokeWidth="2" />
          <path d={`M${cx - width / 2 - 4} ${front - 58} h18 l-4 6 l4 6 h-18 Z`} fill={race === 'orcs' ? '#7a1f16' : '#22344a'} stroke="#c9a24a" strokeWidth="1" />
        </g>
      )}
      {placed.map((p) => (
        <g key={p.i} transform={`translate(${p.x} ${p.y}) scale(${flip ? -p.s : p.s} ${p.s})`} opacity={1 - (front - p.y) / 60}>
          <g className={`fig fig--${pose}`} style={{ animationDelay: `${(p.i * 137) % 900}ms` }}>
            <Soldier race={race} tool={tool} edge={edgeFor(p.i, drawn, size, equipment)} />
          </g>
        </g>
      ))}
    </g>
  );
}

/** The troop card banner: the activity's scene with the troop's soldiers in front of it. */
export function TroopScene({ race, size, activity, equipment }: { race: string; size: number; activity: ActivityKind | null; equipment: EquipmentBucket[] }) {
  const scene = SCENES[activity ?? 'idle'];
  const id = `tsky-${activity ?? 'idle'}`;
  return (
    <svg className="troop-scene" viewBox="0 0 320 96" preserveAspectRatio="xMidYMax slice" role="img" aria-label={`${size} soldater`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={scene.sky[0]} />
          <stop offset="100%" stopColor={scene.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="320" height="96" fill={`url(#${id})`} />
      <g transform="translate(0 30)" opacity="0.75">{scene.art}</g>
      <rect y="86" width="320" height="10" fill="#1a130f" />
      <ArmyFigures race={race} size={size} activity={activity} cx={170} baseline={92} width={220} equipment={equipment} />
      {size > MAX_DRAWN && (
        <g>
          <rect x="262" y="6" width="52" height="18" rx="9" fill="#120e12" stroke="#c9a24a" strokeWidth="1" />
          <text x="288" y="19" textAnchor="middle" fill="#e3c06a" fontSize="11" fontWeight="700">×{size}</text>
        </g>
      )}
    </svg>
  );
}

/** The battle: your fighting soldiers on the left, the current enemy on the right. */
export function Battlefield({
  race, size, enemyId, hitKey, fighting, boss, equipment = [],
}: { race: string; size: number; enemyId: string; hitKey: string | number; fighting: boolean; boss: boolean; equipment?: EquipmentBucket[] }) {
  const Enemy = ENEMY_ART[enemyId];
  return (
    <svg className="battlefield" viewBox="0 0 320 130" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Slagfältet">
      <defs>
        <linearGradient id="bf-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={boss ? '#2a0f12' : '#1c1622'} />
          <stop offset="100%" stopColor={boss ? '#3a1a10' : '#2e2218'} />
        </linearGradient>
      </defs>
      <rect width="320" height="130" fill="url(#bf-sky)" />
      <path d="M0 104 Q80 96 160 102 T320 98 V130 H0 Z" fill="#231a14" />
      <path d="M0 116 Q100 110 200 116 T320 112 V130 H0 Z" fill="#1a130f" />
      {size > 0 ? (
        <ArmyFigures race={race} size={size} activity={fighting ? 'combat' : null} cx={84} baseline={122} width={140} equipment={equipment} />
      ) : (
        <text x="84" y="90" textAnchor="middle" fill="#a99d86" fontSize="11">Ingen trupp strider</text>
      )}
      <g transform={`translate(${boss ? 168 : 190} ${boss ? -6 : 14}) scale(${boss ? 1.25 : 1})`}>
        <g key={hitKey} className={fighting ? 'foe foe--hit' : 'foe'}>
          {Enemy ? <Enemy /> : null}
        </g>
      </g>
      {fighting && size > 0 && (
        <g key={`spark-${hitKey}`} className="spark">
          <path d="M168 78 l4 -10 l2 8 l8 -4 l-6 8 l8 4 l-10 0 l-2 8 l-2 -8 Z" fill="#f0c060" />
          <text x="214" y="40" className="float-num" fill="#ffd27a" fontSize="12" fontWeight="700">⚔</text>
        </g>
      )}
    </svg>
  );
}
