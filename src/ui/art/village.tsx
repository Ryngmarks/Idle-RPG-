// The settlement scene: a dusk outpost on fixed plots. Every building is drawn from its level in
// state.buildings; unbuilt plots show foundation stakes, a running construction shows scaffolding and a
// build-up reveal. Ambient life is pure CSS (classes .v-*), no per-frame JS.

import type { ReactElement, ReactNode } from 'react';
import { content } from '../../content';
import { ellipse, GroundShadow, INK, Ln, PAL, rect, Sh } from './kit';

type Construction = { buildingId: string; level: number; progress: number } | null;

const W = 360;
const H = 218;

// ------------------------------------------------------------------ building pieces (local origin = ground centre-left, y up is negative)

function Tent({ cx, y = 0, w, h, color }: { cx: number; y?: number; w: number; h: number; color: string }) {
  return (
    <g>
      <GroundShadow cx={cx + 3} cy={y + 1} rx={w * 0.55} ry={3} />
      <Sh d={`M${cx - w / 2} ${y} L${cx} ${y - h} L${cx + w / 2} ${y}Z`} fill={color} sw={1.8} hi />
      <Sh d={`M${cx - w * 0.12} ${y} L${cx} ${y - h * 0.5} L${cx + w * 0.12} ${y}Z`} fill="#1a1210" sw={1.2} sh={false} />
      <Ln d={`M${cx} ${y - h} v-6`} color={PAL.woodD} w={1.6} />
      <path d={`M${cx} ${y - h - 6} l7 2 l-7 2Z`} fill={PAL.red} stroke={INK} strokeWidth="1" strokeLinejoin="round" />
    </g>
  );
}

function Tents({ level }: { level: number }) {
  return (
    <g>
      {level >= 3 && <Tent cx={50} y={-9} w={32} h={26} color="#6a5438" />}
      {level === 1 && <Tent cx={50} w={42} h={32} color="#7a6040" />}
      {level >= 2 && <Tent cx={level >= 3 ? 25 : 30} y={level >= 3 ? 2 : 0} w={34} h={28} color="#7a6040" />}
      {level >= 2 && <Tent cx={level >= 3 ? 76 : 70} y={level >= 3 ? 2 : 0} w={34} h={28} color="#8a6a44" />}
    </g>
  );
}

function TrainingCamp() {
  const dummy = (x: number, flip = false) => (
    <g>
      <GroundShadow cx={x + 2} cy={1} rx={8} ry={2.4} />
      <Ln d={`M${x} 0 V-26`} color={PAL.wood} w={3} />
      <Ln d={`M${x - 8} -19 H${x + 8}`} color={PAL.wood} w={3} />
      <Sh d={ellipse(x, -29, 5, 5)} fill="#c9a96a" sw={1.5} />
      <Sh d={rect(x - 5, -20, 10, 12, 2)} fill="#b58a5a" sw={1.4} />
      <Ln d={flip ? `M${x - 3} -26 l6 3` : `M${x + 3} -26 l-6 3`} color={PAL.red} w={1} ink={false} />
    </g>
  );
  return (
    <g>
      {dummy(22)}
      {dummy(52, true)}
      <Ln d="M4 -8 V2 M14 -8 V2 M64 -8 V2 M74 -8 V2" color={PAL.woodD} w={2} />
      <Ln d="M2 -5 H16 M62 -5 H76" color={PAL.wood} w={1.8} />
      <Ln d="M90 0 V-44" color={PAL.wood} w={2.4} />
      <path className="v-flag" d="M90 -44 l16 4 l-4 4 l4 4 l-16 -2Z" fill={PAL.red} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
    </g>
  );
}

/** Övningsplan: a fenced yard with a target and a spear rack; gains a banner from level 3. */
function DrillGround({ level }: { level: number }) {
  return (
    <g>
      <path d="M2 2 H118" stroke="#1a130d" strokeWidth="5" strokeLinecap="round" opacity=".35" />
      <Ln d="M2 -9 V2 M32 -9 V2 M62 -9 V2 M92 -9 V2 M118 -9 V2" color={PAL.woodD} w={2.2} />
      <Ln d="M0 -6 H120" color={PAL.wood} w={1.8} />
      {/* target */}
      <Ln d="M96 0 L90 -30 M96 0 L102 -30" color={PAL.wood} w={2.2} />
      <Sh d={ellipse(96, -32, 11, 11)} fill={PAL.bone} sw={1.5} />
      <circle cx="96" cy="-32" r="7" fill={PAL.red} stroke={INK} strokeWidth="1" />
      <circle cx="96" cy="-32" r="3" fill={PAL.bone} stroke={INK} strokeWidth="0.8" />
      <Ln d="M92 -35 l9 4" color={PAL.leather} w={1.4} ink={false} />
      {/* spear rack */}
      <Ln d="M14 0 V-14 M44 0 V-14 M14 -10 H44" color={PAL.woodD} w={2.2} />
      {[18, 26, 34, 42].map((x) => (
        <g key={x}>
          <Ln d={`M${x} -10 L${x + 3} -34`} color={PAL.wood} w={1.6} />
          <path d={`M${x + 3} -39 l-2 6 h4Z`} fill={PAL.steel} stroke={INK} strokeWidth="0.8" strokeLinejoin="round" />
        </g>
      ))}
      {level >= 3 && (
        <>
          <Ln d="M60 0 V-44" color={PAL.wood} w={2.4} />
          <path className="v-flag" d="M60 -44 l16 4 l-4 4 l4 4 l-16 -2Z" fill={PAL.gold} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
        </>
      )}
    </g>
  );
}

function Farm({ level }: { level: number }) {
  const field = (y: number, i: number) => (
    <g key={i}>
      <Sh d={`M40 ${y} L98 ${y} L102 ${y + 12} L36 ${y + 12}Z`} fill="#4a3822" sw={1.4} />
      {Array.from({ length: 7 }, (_, k) => (
        <path key={k} d={`M${44 + k * 8} ${y + 11} l3 -9`} stroke="#d0ae52" strokeWidth="2" strokeLinecap="round" />
      ))}
    </g>
  );
  return (
    <g>
      {field(-24, 0)}
      {level >= 2 && field(-11, 1)}
      <GroundShadow cx={17} cy={1} rx={22} ry={3.4} />
      <Sh d={rect(2, -22, 30, 22)} fill="#7a5a3a" sw={1.8} />
      <Sh d="M-3 -21 L17 -40 L37 -21Z" fill="#a8402f" sw={1.8} hi />
      <Sh d={rect(13, -13, 8, 13)} fill="#1a1210" sw={1.2} sh={false} />
      <rect x="4" y="-17" width="5" height="5" fill="#f0b040" stroke={INK} strokeWidth="1" />
      {level >= 2 && <Ln d="M96 -27 V-37 M92 -34 h8" color={PAL.wood} w={2} />}
    </g>
  );
}

function Forge({ level }: { level: number }) {
  const ch = level >= 2 ? { x: 56, w: 12, top: -56 } : { x: 58, w: 8, top: -44 };
  return (
    <g>
      <GroundShadow cx={32} cy={1} rx={38} ry={3.6} />
      <Sh d={rect(6, -26, 52, 26)} fill="#5a5658" sw={1.8} />
      <Sh d="M1 -25 L10 -38 H54 L63 -25Z" fill="#3c3638" sw={1.8} hi />
      <Sh d={rect(ch.x, ch.top, ch.w, -ch.top - 30)} fill="#4a4648" sw={1.6} />
      <rect x={ch.x - 1} y={ch.top - 2} width={ch.w + 2} height="4" fill="#3a3637" stroke={INK} strokeWidth="1.2" />
      <Sh d={rect(14, -17, 16, 17, 2)} fill="#1a1210" sw={1.4} sh={false} />
      <rect className="v-glow" x="17" y="-11" width="10" height="8" rx="2" fill="#f07020" />
      <rect x="20" y="-9" width="4" height="4" rx="1" fill="#ffd070" />
      {/* anvil(s) */}
      <Sh d="M38 -8 h14 l-2 4 h-4 v4 h-6 v-4 h-2Z" fill="#8a8a96" sw={1.2} />
      {level >= 2 && <Sh d="M70 -6 h13 l-2 3.4 h-3.6 v2.6 h-5 v-2.6 h-2Z" fill="#8a8a96" sw={1.2} />}
      {level >= 2 && <Sh d={rect(66, -22, 22, 16)} fill="#5a4030" sw={1.6} />}
      {level >= 2 && <Sh d="M63 -21 L77 -32 L91 -21Z" fill="#3c3638" sw={1.6} hi />}
      {[0, 1, 2].map((i) => (
        <circle key={i} className="v-smoke" cx={ch.x + ch.w / 2} cy={ch.top - 4} r={3 + i} fill="#8a8090" style={{ animationDelay: `${i * 1.1}s` }} />
      ))}
    </g>
  );
}

function Woodshed() {
  const log = (x: number, y: number) => (
    <g key={`${x}${y}`}>
      <circle cx={x} cy={y} r="4.4" fill={PAL.wood} stroke={INK} strokeWidth="1.4" />
      <circle cx={x} cy={y} r="2" fill="#d4a870" />
    </g>
  );
  return (
    <g>
      <GroundShadow cx={30} cy={1} rx={34} ry={3.2} />
      <Ln d="M4 0 V-26 M56 0 V-26" color={PAL.woodD} w={3} />
      <Sh d="M-2 -24 L60 -24 L52 -34 L6 -34Z" fill="#6a4426" sw={1.8} hi />
      {[10, 19, 28, 37, 46].map((x) => log(x, -4))}
      {[14, 23, 32, 41].map((x) => log(x, -12))}
      {[19, 28, 37].map((x) => log(x, -20))}
      <Sh d="M62 0 l-2 -8 h10 l-2 8Z" fill="#7a5a3a" sw={1.4} />
      <Ln d="M65 -8 l5 -12" color={PAL.wood} w={2} />
      <Sh d="M65 -22 l9 1 l-2 5 l-8 -2Z" fill={PAL.steel} sw={1.2} sh={false} />
    </g>
  );
}

function Barracks({ level }: { level: number }) {
  const w = level >= 2 ? 92 : 60;
  return (
    <g>
      <GroundShadow cx={w / 2 + 4} cy={1} rx={w / 2 + 8} ry={3.6} />
      <Sh d={rect(4, -26, w, 26)} fill="#5a4030" sw={1.8} />
      <Sh d={`M-2 -25 L${w / 2 + 4} -${level >= 2 ? 50 : 44} L${w + 10} -25Z`} fill="#8a4a2c" sw={1.8} hi />
      <Sh d={rect(14, -15, 10, 15)} fill="#1a1210" sw={1.4} sh={false} />
      <rect x="32" y="-19" width="7" height="6" fill="#f0b040" stroke={INK} strokeWidth="1" />
      {level >= 2 && <rect x="48" y="-19" width="7" height="6" fill="#f0b040" stroke={INK} strokeWidth="1" />}
      {level >= 2 && <Sh d={rect(66, -15, 10, 15)} fill="#1a1210" sw={1.4} sh={false} />}
      {level >= 2 && <rect x="82" y="-19" width="7" height="6" fill="#f0b040" stroke={INK} strokeWidth="1" />}
      <Ln d={`M${w / 2 + 4} -${level >= 2 ? 50 : 44} v-12`} color={PAL.wood} w={1.8} />
      <path className="v-flag" d={`M${w / 2 + 4} -${level >= 2 ? 62 : 56} l11 3 l-3 3 l3 3 l-11 -2Z`} fill={level >= 2 ? PAL.gold : PAL.red} stroke={INK} strokeWidth="1" strokeLinejoin="round" />
    </g>
  );
}

/** Empty plot: four stakes joined by a rope. */
function Foundation({ w, dim }: { w: number; dim: boolean }) {
  return (
    <g opacity={dim ? 0.35 : 0.85}>
      <path d={`M2 -2 Q${w / 2} 4 ${w - 2} -2`} stroke="#6a5a3a" strokeWidth="1.4" strokeDasharray="3 3" fill="none" />
      {[2, w * 0.35, w * 0.7, w - 2].map((x, i) => <Ln key={i} d={`M${x} 3 v-12`} color={PAL.wood} w={2.2} />)}
      <Ln d={`M2 -8 H${w - 2}`} color="#a8402f" w={1} ink={false} />
    </g>
  );
}

function Scaffold({ w, h, frac }: { w: number; h: number; frac: number }) {
  return (
    <g>
      <Ln d={`M2 2 V-${h} M${w - 2} 2 V-${h}`} color={PAL.wood} w={2.4} />
      <Ln d={`M2 -${h * 0.35} H${w - 2} M2 -${h * 0.7} H${w - 2}`} color={PAL.woodD} w={2} />
      <Ln d={`M2 2 L${w - 2} -${h * 0.7}`} color={PAL.woodD} w={1.4} />
      <g transform={`translate(${w / 2 - 18} ${-h - 10})`}>
        <rect width="36" height="6" rx="3" fill="#120d12" stroke={INK} strokeWidth="1.2" />
        <rect x="1.5" y="1.5" width={Math.max(0, 33 * frac)} height="3" rx="1.5" fill={PAL.gold} />
      </g>
      <g className="v-hammer">
        <Ln d={`M${w - 6} -${h * 0.7} l-8 -8`} color={PAL.wood} w={1.8} />
        <rect x={`${w - 22}`} y={-h * 0.7 - 14} width="9" height="5" rx="1" fill={PAL.steel} stroke={INK} strokeWidth="1" transform={`rotate(-40 ${w - 17} ${-h * 0.7 - 11})`} />
      </g>
    </g>
  );
}

// ------------------------------------------------------------------ plots

interface Plot {
  id: string;
  x: number;
  y: number;
  w: number;
  /** Drawn height of the finished building, for scaffolding and the build reveal. */
  h: number;
  draw: (level: number) => ReactElement;
}

const PLOTS: Plot[] = [
  { id: 'tents', x: 6, y: 128, w: 100, h: 44, draw: (l) => <Tents level={l} /> },
  { id: 'barracks', x: 118, y: 128, w: 100, h: 50, draw: (l) => <Barracks level={l} /> },
  { id: 'forge', x: 244, y: 128, w: 100, h: 50, draw: (l) => <Forge level={l} /> },
  { id: 'trainingCamp', x: 4, y: 170, w: 100, h: 40, draw: () => <TrainingCamp /> },
  { id: 'woodshed', x: 172, y: 170, w: 76, h: 34, draw: () => <Woodshed /> },
  { id: 'drillGround', x: 120, y: 212, w: 122, h: 40, draw: (l) => <DrillGround level={l} /> },
  { id: 'farm', x: 256, y: 170, w: 102, h: 40, draw: (l) => <Farm level={l} /> },
];

function PlotView({ plot, level, unlocked, construction }: { plot: Plot; level: number; unlocked: boolean; construction: Construction }) {
  const building = construction?.buildingId === plot.id ? construction : null;
  let inner: ReactNode;
  if (building) {
    const work = content.buildings[plot.id]?.levels[building.level - 1]?.work ?? 1;
    const frac = Math.min(1, building.progress / work);
    if (level > 0) {
      inner = <>{plot.draw(level)}<Scaffold w={plot.w - 10} h={plot.h} frac={frac} /></>;
    } else {
      const clip = `reveal-${plot.id}`;
      inner = (
        <>
          <defs>
            <clipPath id={clip}>
              <rect x="-10" y={-plot.h - 20 + (1 - Math.max(0.12, frac)) * (plot.h + 24)} width={plot.w + 20} height={plot.h + 30} />
            </clipPath>
          </defs>
          <Foundation w={plot.w - 10} dim={false} />
          <g clipPath={`url(#${clip})`} opacity="0.9">{plot.draw(1)}</g>
          <Scaffold w={plot.w - 10} h={plot.h} frac={frac} />
        </>
      );
    }
  } else if (level > 0) {
    inner = plot.draw(level);
  } else {
    inner = <Foundation w={plot.w - 10} dim={!unlocked} />;
  }
  return <g transform={`translate(${plot.x} ${plot.y})`}>{inner}</g>;
}

// ------------------------------------------------------------------ the scene

export function VillageScene({
  buildings,
  construction,
  unlocks,
  compact = false,
}: {
  buildings: Record<string, number>;
  construction: Construction;
  unlocks: string[];
  compact?: boolean;
}) {
  return (
    <svg
      className={`village ${compact ? 'village--compact' : ''}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax slice"
      role="img"
      aria-label="Din bosättning"
    >
      <defs>
        <linearGradient id="vSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#140f22" />
          <stop offset="0.55" stopColor="#3a2036" />
          <stop offset="1" stopColor="#8a4a30" />
        </linearGradient>
        <linearGradient id="vGround" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3020" />
          <stop offset="1" stopColor="#17110d" />
        </linearGradient>
        <radialGradient id="vFire" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#f0a030" stopOpacity="0.5" />
          <stop offset="1" stopColor="#f0a030" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#vSky)" />
      {[[30, 14], [88, 30], [150, 10], [214, 24], [300, 12], [338, 34]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="0.9" fill="#f4e8c0" opacity="0.7" />
      ))}
      <circle cx="288" cy="40" r="22" fill="url(#gSun)" />
      <circle cx="288" cy="40" r="10" fill="#efe0b0" opacity="0.9" />
      <path d="M0 96 L36 66 L74 90 L128 54 L184 88 L240 60 L296 86 L360 64 V130 H0Z" fill="#241a2a" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M0 108 Q90 90 180 102 T360 96 V140 H0Z" fill="#2c2218" stroke={INK} strokeWidth="1.4" />
      <rect y="102" width={W} height={H - 102} fill="url(#vGround)" opacity="0.85" />
      <path d="M0 132 Q120 124 180 138 T360 134" stroke="#1a130d" strokeWidth="1.2" fill="none" opacity="0.7" />
      {/* worn path through the camp */}
      <path d="M130 136 Q170 128 215 140 Q250 150 270 140 L274 146 Q245 160 205 150 Q165 140 128 146Z" fill="#5a4630" opacity="0.5" />
      {/* distant pines */}
      {[18, 112, 226, 340].map((x, i) => (
        <path key={i} d={`M${x} 112 l-8 0 l8 -22 l8 22Z`} fill="#16241c" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      ))}

      {PLOTS.filter((p) => p.y < 150).map((p) => (
        <PlotView key={p.id} plot={p} level={buildings[p.id] ?? 0} unlocked={unlocks.includes(`building:${p.id}`)} construction={construction} />
      ))}
      {PLOTS.filter((p) => p.y >= 150).map((p) => (
        <PlotView key={p.id} plot={p} level={buildings[p.id] ?? 0} unlocked={unlocks.includes(`building:${p.id}`)} construction={construction} />
      ))}

      {/* campfire, always there */}
      <g transform="translate(138 168)">
        <circle className="v-fireglow" cx="0" cy="-8" r="26" fill="url(#vFire)" />
        <GroundShadow cx={0} cy={1} rx={12} ry={3} />
        <Ln d="M-9 0 L9 -4 M-9 -4 L9 0" color={PAL.woodD} w={3} />
        <g className="v-flame">
          <path d="M0 -3 q-8 -8 0 -22 q8 12 0 22Z" fill="#f0a030" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M0 -3 q-3.5 -4 0 -11 q3.5 6 0 11Z" fill="#ffe27a" />
        </g>
      </g>

      {/* two sentries pacing the camp */}
      <g className="v-walk v-walk--a" transform="translate(0 0)">
        <Sentry x={110} y={150} />
      </g>
      <g className="v-walk v-walk--b">
        <Sentry x={196} y={176} tone="#7a2a22" />
      </g>
    </svg>
  );
}

function Sentry({ x, y, tone = '#2f5486' }: { x: number; y: number; tone?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <GroundShadow cx={1} cy={0} rx={5} ry={1.6} />
      <g className="v-step">
        <Ln d="M0 -9 V-24" color={PAL.wood} w={1.2} />
        <path d="M0 -26 l-1.6 4 h3.2Z" fill={PAL.steel} stroke={INK} strokeWidth="0.8" strokeLinejoin="round" />
        <Sh d={rect(-3.5, -15, 7, 10, 2)} fill={tone} sw={1.4} sh={false} />
        <Sh d={ellipse(0, -18, 3.2, 3.2)} fill={PAL.skin} sw={1.2} sh={false} />
        <Ln d="M-1.8 -5 v5 M1.8 -5 v5" color={PAL.leather} w={1.4} />
      </g>
    </g>
  );
}
