// Hand-drawn inline SVG art in the shared style (see ./art/kit.tsx): ink outline, shade gradient,
// warm rim light, soft ground shadow. Pure presentation. Which picture to show is chosen from ids
// in state/content. Gradients and filters live once in <ArtDefs/> at the app root.

import type { ReactElement } from 'react';
import type { ActivityKind } from '../core';
import { GroundShadow, INK, Ln, PAL, Rim, Sh, ellipse, rect } from './art/kit';

const GOLD = PAL.gold;
const BONE = PAL.bone;

// ------------------------------------------------------------------ enemies

function Floor({ boss }: { boss: boolean }) {
  return (
    <>
      <rect width="120" height="120" fill={boss ? 'url(#bgB)' : 'url(#bgN)'} />
      <path d="M0 96 Q30 90 60 94 T120 92 V120 H0Z" fill="url(#gFloor)" />
      <path d="M0 96 Q30 90 60 94 T120 92" stroke="#6a5038" strokeWidth="1" fill="none" opacity=".5" />
      {boss && <ellipse cx="62" cy="66" rx="58" ry="46" fill="url(#gAura)" />}
    </>
  );
}

function Bird({ body, bodyD, tail, tailD, comb, big = false }: { body: string; bodyD: string; tail: string; tailD: string; comb: string; big?: boolean }) {
  const s = big ? 1.1 : 1;
  return (
    <Rim>
      <g transform={`translate(60 100) scale(${s}) translate(-60 -100)`}>
        <GroundShadow cx={58} cy={103} rx={32} ry={5} op={0.6} />
        <Sh d="M37 68 C18 66 12 52 14 42 C24 48 30 52 42 58Z" fill={tailD} hi />
        <Sh d="M38 64 C20 52 20 36 28 28 C32 40 38 46 46 54Z" fill={tail} hi />
        <Ln d="M53 90 V102" color="#e0a030" w={3.4} />
        <Ln d="M66 90 V102" color="#e0a030" w={3.4} />
        <Ln d="M46 103 H58 M60 103 H73" color="#e0a030" w={3.2} />
        <Sh d="M35 68 C33 52 50 45 66 51 C82 57 88 74 76 86 C65 95 41 92 35 68Z" fill={body} hi />
        <Sh d="M42 66 C50 59 66 62 72 72 C64 84 47 82 42 66Z" fill={bodyD} />
        <path d="M48 70 q8 6 18 2 M50 76 q8 5 16 1" stroke="#000" strokeOpacity=".25" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <Sh d="M69 58 C65 45 72 34 83 34 C94 34 96 47 91 56 C85 63 74 63 69 58Z" fill={body} hi />
        <Sh d="M73 38 C70 30 76 27 79 32 C80 25 87 25 87 33 C92 30 95 35 90 40Z" fill={comb} />
        <Sh d="M91 43 L103 48 L91 53 Z" fill="#e8a030" sw={1.8} />
        <Sh d="M87 54 C92 57 91 65 86 63 C83 60 84 56 87 54Z" fill="#c0392b" sw={1.8} />
        <circle cx="84.5" cy="44.5" r="2.7" fill={INK} />
        <circle cx="85.3" cy="43.6" r=".9" fill="#fff" />
        {big && <path d="M79 39 L90 44" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />}
      </g>
    </Rim>
  );
}

function Fox() {
  return (
    <Rim>
      <GroundShadow cx={60} cy={102} rx={38} ry={5} op={0.6} />
      <Sh d="M36 82 C12 84 6 60 20 48 C22 64 34 66 46 70Z" fill="#d9692a" hi />
      <Sh d="M16 52 C13 54 15 58 19 60 C23 58 22 51 20 48Z" fill="#f4ecdc" sw={1.6} />
      <Sh d={rect(72, 86, 8, 15, 3)} fill="#2a1a14" />
      <Sh d={rect(40, 86, 8, 15, 3)} fill="#2a1a14" />
      <Sh d="M34 84 C30 66 46 58 66 60 C84 62 90 76 82 88 L40 90Z" fill="#e07a30" hi />
      <Sh d="M72 66 C82 66 88 76 82 88 C76 84 72 76 72 66Z" fill="#f4ecdc" sw={1.6} hi />
      <Sh d={rect(50, 88, 9, 14, 3.5)} fill="#e07a30" />
      <Sh d={rect(50, 96, 9, 6, 3)} fill="#3a2018" sw={1.6} />
      <Sh d={rect(70, 88, 9, 14, 3.5)} fill="#e07a30" />
      <Sh d={rect(70, 96, 9, 6, 3)} fill="#3a2018" sw={1.6} />
      <Sh d="M80 54 L82 36 L92 49Z" fill="#e07a30" />
      <Sh d="M76 50 C84 46 98 52 106 62 L96 71 C88 73 80 69 76 63Z" fill="#e07a30" hi />
      <Sh d="M96 60 L112 67 L97 72Z" fill="#f4ecdc" sw={1.8} />
      <circle cx="111" cy="67" r="2.3" fill={INK} />
      <circle cx="91" cy="59" r="2.6" fill={INK} />
      <circle cx="91.8" cy="58.2" r=".9" fill="#fff" />
      <path d="M86 54 L95 57" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    </Rim>
  );
}

function Boar({ body, bodyD, mane, scale = 1, scars = false, boss = false, eye = '#1b0f0a' }: {
  body: string; bodyD: string; mane: string; scale?: number; scars?: boolean; boss?: boolean; eye?: string;
}) {
  return (
    <Rim>
      <g transform={`translate(60 104) scale(${scale}) translate(-60 -104)`}>
        <GroundShadow cx={60} cy={104} rx={44} ry={5} op={0.65} />
        <Sh d={rect(46, 92, 9, 11, 3)} fill={bodyD} />
        <Sh d={rect(80, 90, 9, 13, 3)} fill={bodyD} />
        <Sh d="M22 70 L18 54 L30 60 L30 44 L42 54 L48 38 L58 52 L68 40 L74 54 L86 48 L86 64Z" fill={mane} />
        <Sh d="M20 80 C18 60 38 52 62 53 C86 53 98 62 98 76 C98 90 86 97 70 97 L40 97 C27 97 20 91 20 80Z" fill={body} hi />
        <Sh d="M24 82 C22 70 30 62 40 60 C34 70 36 84 44 94 C32 94 25 90 24 82Z" fill={bodyD} sw={0} sh={false} />
        <Sh d="M84 58 C97 50 111 60 113 76 C113 87 106 93 95 92 L84 90Z" fill={body} hi />
        <Sh d={ellipse(109, 78, 7, 8.5)} fill="#a8786c" />
        <circle cx="107" cy="75" r="1.5" fill={INK} />
        <circle cx="107" cy="81" r="1.5" fill={INK} />
        <Sh d="M80 60 L83 42 L96 56Z" fill={bodyD} />
        <Sh d="M92 90 C102 95 116 88 116 68 C110 80 103 83 93 82Z" fill="#f4e7c2" hi />
        {scars && <path d="M44 66 l12 14 M51 63 l11 13 M62 68 l8 12" stroke="#8a5a4a" strokeWidth="2" strokeLinecap="round" opacity=".85" />}
        {boss ? (
          <>
            <g filter="url(#fGlowRed)"><circle cx="94" cy="68" r="3.2" fill="#ff4a2a" /></g>
            <circle cx="94.8" cy="67.2" r="1" fill="#ffe0c0" />
          </>
        ) : (
          <>
            <circle cx="94" cy="68" r="3" fill={eye} />
            <circle cx="94.8" cy="67.2" r="1" fill="#fff" opacity=".8" />
          </>
        )}
        <path d="M88 62 L99 66" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
        <Sh d={rect(30, 90, 10, 14, 3.5)} fill={body} />
        <Sh d={rect(68, 92, 10, 12, 3.5)} fill={body} />
      </g>
    </Rim>
  );
}

function RatOne({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <GroundShadow cx={0} cy={10} rx={20} ry={3} />
      <Ln d="M-14 4 C-30 6 -34 -6 -40 -2" color="#9b8a92" w={2} />
      <Sh d={ellipse(0, 0, 16, 9)} fill="#6d6168" />
      <Sh d={ellipse(15, -4, 7, 7)} fill="#7a6d74" />
      <Sh d={ellipse(13, -11, 3.5, 3.5)} fill="#b79ba4" sw={1.6} />
      <circle cx="19" cy="-5" r="1.4" fill="#ff6b5a" />
      <circle cx="22" cy="-2" r="1.2" fill="#d9a3ad" />
    </g>
  );
}

export const ENEMY_ART: Record<string, () => ReactElement> = {
  wildChicken: () => <Bird body="#efe3c6" bodyD="#d2bf96" tail="#c8963e" tailD="#8a6a3a" comb="#c8392b" />,
  angryRooster: () => <Bird body="#b4562d" bodyD="#8a3e1f" tail="#2f6a58" tailD="#1f3b33" comb="#e0402e" big />,
  fox: () => <Fox />,
  ratSwarm: () => (
    <Rim>
      <RatOne x={38} y={84} s={0.9} />
      <RatOne x={74} y={92} s={1} />
      <RatOne x={60} y={70} s={0.75} />
      <RatOne x={92} y={74} s={0.65} />
    </Rim>
  ),
  wildBoar: () => <Boar body="#6b4630" bodyD="#4a2f20" mane="#3a2418" />,
  oldBoar: () => <Boar body="#5a5048" bodyD="#3a322c" mane="#2c2620" scars scale={1.05} />,
  oldTusker: () => <Boar body="#3a2c28" bodyD="#2a201d" mane="#7a1f16" scale={1.12} scars boss />,
};

export function EnemyPortrait({ enemyId, size = 96 }: { enemyId: string; size?: number }) {
  const Art = ENEMY_ART[enemyId];
  return (
    <svg className="portrait" width={size} height={size} viewBox="0 0 120 120" role="img" aria-hidden>
      <Floor boss={enemyId === 'oldTusker'} />
      {Art ? <Art /> : <circle cx="60" cy="70" r="24" fill="#555" />}
    </svg>
  );
}

// ------------------------------------------------------------------ race emblems

const SHIELD = 'M50 6 L90 18 V52 C90 76 72 92 50 100 C28 92 10 76 10 52 V18 Z';

const EMBLEM: Record<string, { field: string; sigil: ReactElement }> = {
  humans: {
    field: '#2f5486',
    sigil: (
      <>
        <Sh d="M30 70 V44 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 V70 Z" fill={GOLD} sw={2.4} hi />
        <Sh d="M45 56 h10 v14 h-10Z" fill="#22344a" sw={2} sh={false} />
        <Sh d="M38 34 l4 -8 l4 6 l4 -10 l4 10 l4 -6 l4 8 Z" fill={GOLD} sw={2.2} hi />
      </>
    ),
  },
  orcs: {
    field: '#7a2a1e',
    sigil: (
      <>
        <Sh d="M24 44 Q50 30 76 44 Q74 70 50 78 Q26 70 24 44 Z" fill={PAL.orc} sw={2.4} hi />
        <circle cx="39" cy="50" r="4.2" fill="#ffcf3d" stroke={INK} strokeWidth="1.6" />
        <circle cx="61" cy="50" r="4.2" fill="#ffcf3d" stroke={INK} strokeWidth="1.6" />
        <Ln d="M36 66 q2 -12 6 -2 M64 66 q-2 -12 -6 -2" color={BONE} w={3.4} />
      </>
    ),
  },
  dwarves: {
    field: '#4a3f38',
    sigil: (
      <>
        <Sh d="M18 76 L40 40 L52 56 L62 44 L82 76 Z" fill="#8a8a96" sw={2.4} hi />
        <Sh d={rect(47, 30, 6, 40)} fill={GOLD} sw={2} />
        <Sh d={rect(36, 26, 28, 12, 2)} fill={GOLD} sw={2.2} hi />
      </>
    ),
  },
  elves: {
    field: '#2a6044',
    sigil: (
      <>
        <Sh d="M50 24 C72 40 70 66 50 82 C30 66 28 40 50 24 Z" fill="#7fb36a" sw={2.4} hi />
        <path d="M50 30 V80 M50 46 l-10 -6 M50 58 l12 -8 M50 68 l-10 -6" stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      </>
    ),
  },
};

export function RaceEmblem({ raceId, size = 56 }: { raceId: string; size?: number }) {
  const e = EMBLEM[raceId] ?? EMBLEM.humans!;
  return (
    <svg className="emblem" width={size} height={size * 1.06} viewBox="0 0 100 106" role="img" aria-hidden>
      <Sh d={SHIELD} fill={e.field} sw={3.5} hi />
      <path d={SHIELD} fill="none" stroke={GOLD} strokeWidth="2" transform="translate(50 53) scale(0.9) translate(-50 -53)" />
      {e.sigil}
    </svg>
  );
}

// ------------------------------------------------------------------ activity scenes (troop cards)

function Birch({ x, top, base, w, leaf = true }: { x: number; top: number; base: number; w: number; leaf?: boolean }) {
  const tw = w * 0.65;
  const marks: ReactElement[] = [];
  for (let y = base - 8, k = 0; y > top + 6; y -= 7 + ((k * 29) % 6), k++) {
    const wd = w * (0.35 + 0.3 * (((k * 37) % 10) / 10));
    marks.push(<path key={k} d={`M${x - wd / 2} ${y} h${wd}`} stroke="#2a2630" strokeWidth={Math.max(1, w * 0.17)} strokeLinecap="round" />);
  }
  const r = w * 2.4;
  return (
    <g>
      <Sh d={`M${x - w / 2} ${base} L${x - tw / 2} ${top} L${x + tw / 2} ${top} L${x + w / 2} ${base}Z`} fill="#ddd8c8" sw={1.6} />
      {marks}
      {leaf && (
        <g className="sway" style={{ transformOrigin: `${x}px ${top + 6}px` }}>
          <Sh d={ellipse(x - r * 0.6, top + 3, r * 0.8, r * 0.68)} fill="#587a2c" sw={1.6} />
          <Sh d={ellipse(x + r * 0.6, top + 5, r * 0.75, r * 0.64)} fill="#6a8c34" sw={1.6} />
          <Sh d={ellipse(x, top - r * 0.52, r * 0.95, r * 0.8)} fill="#7ea03c" sw={1.6} />
        </g>
      )}
    </g>
  );
}

function Pine({ x, h, c = '#2c5a3e' }: { x: number; h: number; c?: string }) {
  return (
    <g className="sway" style={{ transformOrigin: `${x}px 60px` }}>
      <Sh d={`M${x} ${60 - h} L${x + h * 0.35} 60 H${x - h * 0.35} Z`} fill={c} sw={1.6} />
    </g>
  );
}

function Flame({ x, y, s = 1, delay = 0 }: { x: number; y: number; s?: number; delay?: number }) {
  return (
    <g className="flicker" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${delay}s` }}>
      <path d={`M${x} ${y} q${-7 * s} ${-8 * s} 0 ${-18 * s} q${7 * s} ${10 * s} 0 ${18 * s}Z`} fill="#f0a030" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      <path d={`M${x} ${y} q${-3 * s} ${-4 * s} 0 ${-9 * s} q${3 * s} ${5 * s} 0 ${9 * s}Z`} fill="#ffe27a" />
    </g>
  );
}

export const SCENES: Record<ActivityKind | 'idle', { sky: [string, string]; art: ReactElement }> = {
  idle: {
    sky: ['#1a1422', '#2f2018'],
    art: (
      <>
        <Sh d="M110 60 L136 30 L162 60 Z" fill="#6a5238" sw={1.8} hi />
        <Sh d="M130 60 L136 44 L142 60 Z" fill="#1a1210" sw={1.4} sh={false} />
        <Ln d="M184 58 h22 M188 54 l14 8 M202 54 l-14 8" color="#6a4426" w={3} />
        <Flame x={195} y={55} />
        <path className="smoke" d="M196 34 q4 -6 0 -12 q-4 -6 0 -12" stroke="#6b6070" strokeWidth="2" fill="none" opacity="0.5" />
        <Sh d="M222 60 L238 40 L254 60 Z" fill="#5a4630" sw={1.8} />
      </>
    ),
  },
  woodcutting: {
    sky: ['#0e1a17', '#2c3d26'],
    art: (
      <>
        <ellipse cx="270" cy="6" rx="90" ry="50" fill="url(#gSun)" />
        {Array.from({ length: 12 }, (_, i) => (
          <g key={i} opacity=".7">
            <rect x={10 + i * 28} y={26 - (i % 3) * 3} width="4" height={34 + (i % 3) * 3} fill="#23382c" />
            <ellipse cx={12 + i * 28} cy={26 - (i % 3) * 3} rx="10" ry="9" fill="#1e3828" />
          </g>
        ))}
        <rect x="0" y="52" width="320" height="8" fill="#1a2a20" />
        <Birch x={26} top={4} base={60} w={8} />
        <Birch x={58} top={16} base={60} w={5} />
        <Birch x={266} top={6} base={60} w={8} />
        <Birch x={298} top={18} base={60} w={5} />
        <Birch x={160} top={2} base={60} w={9} />
        <Sh d="M156 40 L162 44 L156 48Z" fill="#c9a070" sw={1.4} />
        <Sh d={rect(222, 46, 14, 14, 3)} fill={PAL.wood} sw={1.6} />
        <Sh d={ellipse(229, 46, 7, 2.8)} fill="#d6a870" sw={1.4} />
        <Sh d={rect(236, 52, 24, 8, 3)} fill={PAL.wood} sw={1.5} />
        <Sh d={rect(240, 44, 24, 8, 3)} fill={PAL.woodD} sw={1.5} />
        <path d="M120 54 l4 -2 l1 3Z M196 50 l3 -3 l2 3Z" fill="#d6a870" stroke={INK} strokeWidth="1" />
      </>
    ),
  },
  mining: {
    sky: ['#191820', '#2a2626'],
    art: (
      <>
        <Sh d="M50 60 L128 12 L206 60 Z" fill="#5a5660" sw={1.8} hi />
        <Sh d="M150 60 L226 22 L300 60 Z" fill="#46424a" sw={1.8} hi />
        <Sh d="M116 60 v-16 a13 13 0 0 1 26 0 v16 Z" fill="#0d0b0c" sw={2.2} sh={false} />
        <path d="M112 60 V42 M146 60 V42 M112 40 H146" stroke={PAL.woodD} strokeWidth="3.4" strokeLinecap="round" fill="none" />
        <circle className="flicker" cx="129" cy="46" r="3" fill="#f0b040" stroke={INK} strokeWidth="1.2" style={{ transformOrigin: '129px 46px' }} />
        <Sh d="M232 60 L236 48 L244 44 L252 50 L254 60Z" fill="#4d4a52" sw={1.6} />
        <Sh d="M238 50 L244 56 L236 58Z" fill="#8fb0d0" sw={1.2} sh={false} />
        <Sh d="M246 48 L252 53 L247 58 L243 53Z" fill="#c8d6e6" sw={1.2} sh={false} />
        <Sh d="M24 60 L28 50 L38 48 L44 56 L42 60Z" fill={PAL.stone} sw={1.6} />
      </>
    ),
  },
  food: {
    sky: ['#2a2516', '#3f3318'],
    art: (
      <>
        <circle cx="270" cy="18" r="22" fill="url(#gSun)" />
        <Sh d={ellipse(270, 20, 10, 10)} fill="#f0cf70" sw={1.8} />
        {Array.from({ length: 14 }, (_, i) => (
          <g key={i} className="sway" style={{ transformOrigin: `${20 + i * 21}px 60px`, animationDelay: `${(i % 4) * 0.3}s` }}>
            <Ln d={`M${20 + i * 21} 60 q2 -12 0 -22`} color="#a8873a" w={2} />
            <Sh d={ellipse(20 + i * 21, 36, 2.6, 5)} fill="#e3bd58" sw={1.4} />
          </g>
        ))}
        <path d="M0 60 h320" stroke="#5a4a22" strokeWidth="3" />
        <Sh d={rect(168, 46, 22, 12, 3)} fill="#c9a24a" sw={1.6} />
        <path d="M172 46 v12 M179 46 v12 M186 46 v12" stroke={INK} strokeWidth="1" opacity=".5" />
      </>
    ),
  },
  construction: {
    sky: ['#1d1822', '#33261c'],
    art: (
      <>
        <path d="M108 60 V22 M168 60 V22 M108 22 H168 M108 42 H168 M108 60 L168 22" stroke={INK} strokeWidth="6.4" strokeLinecap="round" fill="none" />
        <path d="M108 60 V22 M168 60 V22 M108 22 H168 M108 42 H168 M108 60 L168 22" stroke={PAL.wood} strokeWidth="4" strokeLinecap="round" fill="none" />
        <Ln d="M98 24 L138 6 L178 24" color={PAL.woodD} w={4} />
        <Sh d={rect(200, 50, 32, 10, 1.5)} fill="#8a8a96" sw={1.6} />
        <Sh d={rect(206, 41, 20, 9, 1.5)} fill="#a0a0ac" sw={1.6} />
        <Sh d={rect(236, 52, 20, 8, 1.5)} fill={PAL.woodD} sw={1.5} />
        <g className="chop" style={{ transformOrigin: '198px 42px' }}>
          <Ln d="M190 30 l8 12" color={GOLD} w={3} />
        </g>
      </>
    ),
  },
  smithing: {
    sky: ['#1f1412', '#3f1e10'],
    art: (
      <>
        <Sh d={rect(40, 30, 46, 30, 2)} fill="#5a4e4a" sw={1.8} hi />
        <Sh d="M38 30 L63 16 L88 30 Z" fill="#3a3030" sw={1.8} />
        <Sh d="M52 60 v-14 a11 11 0 0 1 22 0 v14Z" fill="#1a0e0a" sw={1.6} sh={false} />
        <Flame x={63} y={58} s={1.1} />
        <Sh d="M138 40 h46 l-6 7 h-34 Z" fill="#7a7a86" sw={1.8} hi />
        <Sh d={rect(150, 47, 22, 13, 1.5)} fill="#45454c" sw={1.8} />
        <path d="M148 40 h26" stroke="#e8742a" strokeWidth="3" strokeLinecap="round" />
        <g className="chop" style={{ transformOrigin: '176px 38px' }}>
          <Ln d="M186 20 l-10 18" color={PAL.wood} w={3} />
        </g>
        <circle cx="188" cy="38" r="2" fill="#f7c64a" opacity="0.9" />
        <circle cx="196" cy="34" r="1.4" fill="#f7c64a" opacity="0.7" />
        <Sh d={rect(230, 44, 14, 16, 2)} fill={PAL.woodD} sw={1.6} />
        <path d="M233 44 V30 M237 44 V28 M241 44 V31" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        <path d="M233 44 V30 M237 44 V28 M241 44 V31" stroke={PAL.steel} strokeWidth="2" strokeLinecap="round" />
      </>
    ),
  },
  combat: {
    sky: ['#2a1214', '#451e14'],
    art: (
      <>
        <path d="M0 60 Q80 46 160 56 T320 52 V60 Z" fill="#1d1210" />
        <Ln d="M140 18 L180 56 M180 18 L140 56" color="#dfe5ee" w={4} />
        <Ln d="M132 28 l14 -10 M188 28 l-14 -10" color={GOLD} w={4} />
        <Ln d="M60 60 V20" color={PAL.wood} w={2.4} />
        <Sh d="M60 22 l24 6 l-24 7Z" fill={PAL.red} sw={1.8} />
        <Ln d="M260 60 V24" color={PAL.wood} w={2.4} />
        <Sh d="M260 26 l-22 6 l22 7Z" fill="#3f4a7a" sw={1.8} />
      </>
    ),
  },
};

export function ActivityScene({ activity }: { activity: ActivityKind | null }) {
  const scene = SCENES[activity ?? 'idle'];
  const id = `sky-${activity ?? 'idle'}`;
  return (
    <svg className="scene" viewBox="0 0 320 60" preserveAspectRatio="xMidYMax slice" role="img" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={scene.sky[0]} />
          <stop offset="100%" stopColor={scene.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="320" height="60" fill={`url(#${id})`} />
      {scene.art}
    </svg>
  );
}
