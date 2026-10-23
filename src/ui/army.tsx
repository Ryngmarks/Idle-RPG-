// Soldier figures and army formations. Presentation only: the number of figures follows the
// troop's real size, the pose follows its real activity.

import type { ActivityKind, EquipmentBucket } from '../core';
import { ENEMY_ART, SCENES } from './art';
import { INK, PAL } from './art/kit';
import { SoldierArt, type Tool } from './art/soldier';
import { QUALITY_COLOR } from './labels';

type Pose = 'idle' | 'work' | 'fight';

const TOOL_FOR: Record<ActivityKind, Tool> = {
  combat: 'weapon',
  woodcutting: 'axe',
  mining: 'pick',
  food: 'sickle',
  construction: 'hammer',
  smithing: 'hammer',
};

const WOOD = PAL.wood;

/** Rare qualities glow on the soldiers' weapons, so a well-armed army is visible at a glance. */
const GLOWING = new Set([QUALITY_COLOR.outstanding, QUALITY_COLOR.excellent, QUALITY_COLOR.masterpiece]);

/** One soldier, feet at (0,0), about 36 units tall, facing right. `edge` null = unarmed (a club). */
export function Soldier({ race, tool, edge = '#b8b2a6' }: { race: string; tool: Tool; edge?: string | null }) {
  return <SoldierArt race={race} tool={tool} edge={edge} glow={edge !== null && GLOWING.has(edge)} />;
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
          <path d={`M${cx - width / 2 - 4} ${front - 4} V${front - 58}`} stroke={INK} strokeWidth="4" strokeLinecap="round" />
          <path d={`M${cx - width / 2 - 4} ${front - 4} V${front - 58}`} stroke={WOOD} strokeWidth="2" strokeLinecap="round" />
          <path d={`M${cx - width / 2 - 4} ${front - 58} h18 l-4 6 l4 6 h-18 Z`} fill={race === 'orcs' ? '#a8402f' : '#2f5486'} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
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
