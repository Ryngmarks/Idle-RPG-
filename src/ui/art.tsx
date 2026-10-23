// Hand-drawn inline SVG art: simple silhouettes in the game's palette.
// Pure presentation. Which picture to show is chosen from ids in state/content.

import type { ReactElement } from 'react';
import type { ActivityKind } from '../core';

const INK = '#141016';
const GOLD = '#c9a24a';
const BONE = '#efe4c8';

// ------------------------------------------------------------------ enemies

function Ground() {
  return (
    <>
      <defs>
        <radialGradient id="vignette" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#3a2b20" />
          <stop offset="100%" stopColor="#120e12" />
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill="url(#vignette)" />
      <ellipse cx="60" cy="102" rx="46" ry="8" fill="#0b090c" opacity="0.7" />
      <path d="M0 100 Q30 94 60 98 T120 96 V120 H0 Z" fill="#231a14" />
    </>
  );
}

function Bird({ body, tail, comb, big = false }: { body: string; tail: string; comb: string; big?: boolean }) {
  const s = big ? 1.12 : 1;
  return (
    <g transform={`translate(60 70) scale(${s}) translate(-60 -70)`}>
      <path d="M38 62 C20 44 22 30 30 26 C34 40 40 46 46 52 Z" fill={tail} />
      {big && <path d="M36 58 C14 50 12 34 18 28 C24 42 34 48 42 52 Z" fill={tail} opacity="0.8" />}
      <ellipse cx="60" cy="70" rx="24" ry="20" fill={body} />
      <path d="M48 68 Q60 82 74 70" stroke={INK} strokeOpacity="0.25" strokeWidth="2" fill="none" />
      <circle cx="78" cy="48" r="11" fill={body} />
      <path d="M72 38 q2 -8 6 -2 q3 -8 6 0 q4 -5 4 3 Z" fill={comb} />
      <path d="M88 48 L97 51 L88 54 Z" fill="#e0a030" />
      <path d="M84 56 q2 6 -2 8 q-3 -3 0 -8 Z" fill={comb} />
      <circle cx="81" cy="46" r="2" fill={INK} />
      {big && <path d="M77 41 L85 43" stroke={INK} strokeWidth="2" strokeLinecap="round" />}
      <path d="M54 88 v10 M66 88 v10 M50 98 h8 M62 98 h8" stroke="#d4902a" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

function Rat({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-14 4 C-30 6 -34 -6 -40 -2" stroke="#8f7f86" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="0" cy="0" rx="16" ry="9" fill="#6d6168" />
      <circle cx="15" cy="-4" r="7" fill="#7a6d74" />
      <circle cx="13" cy="-11" r="3.5" fill="#9b8a92" />
      <circle cx="19" cy="-5" r="1.3" fill="#ff6b5a" />
      <circle cx="22" cy="-2" r="1.2" fill="#d9a3ad" />
    </g>
  );
}

function Boar({ body, tusk, eye, bristle, scale = 1, scars = false, crown = false }: {
  body: string; tusk: string; eye: string; bristle: string; scale?: number; scars?: boolean; crown?: boolean;
}) {
  return (
    <g transform={`translate(60 74) scale(${scale}) translate(-60 -74)`}>
      <path d="M26 60 q6 -14 14 -6 q4 -12 12 -4 q4 -12 12 -4 q6 -10 12 0" stroke={bristle} strokeWidth="5" fill="none" strokeLinecap="round" />
      <ellipse cx="56" cy="74" rx="32" ry="20" fill={body} />
      <path d="M78 58 Q100 56 102 74 Q100 88 82 88 Z" fill={body} />
      <ellipse cx="100" cy="76" rx="6" ry="7" fill="#c9958a" />
      <circle cx="98" cy="74" r="1.4" fill={INK} />
      <circle cx="98" cy="79" r="1.4" fill={INK} />
      <path d="M92 82 q8 0 10 -12" stroke={tusk} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M80 60 l4 -10 l5 9 Z" fill={body} />
      <circle cx="86" cy="66" r="2.6" fill={eye} />
      {crown && <circle cx="86" cy="66" r="6" fill={eye} opacity="0.25" />}
      {scars && <path d="M48 66 l10 10 M54 64 l8 9 M64 70 l6 8" stroke="#2b1d16" strokeWidth="2" strokeLinecap="round" />}
      <path d="M36 90 v10 M50 92 v8 M66 92 v8 M78 88 v10" stroke={body} strokeWidth="6" strokeLinecap="round" />
    </g>
  );
}

export const ENEMY_ART: Record<string, () => ReactElement> = {
  wildChicken: () => <Bird body="#e9dcc0" tail="#b98a4e" comb="#c8392b" />,
  angryRooster: () => <Bird body="#b4562d" tail="#1f3b33" comb="#e0402e" big />,
  ratSwarm: () => (
    <>
      <Rat x={38} y={84} s={0.9} />
      <Rat x={74} y={92} s={1} />
      <Rat x={60} y={70} s={0.75} />
      <Rat x={92} y={74} s={0.65} />
    </>
  ),
  wildBoar: () => <Boar body="#5b3a28" tusk={BONE} eye="#1b0f0a" bristle="#3a2418" />,
  oldBoar: () => <Boar body="#4a4038" tusk={BONE} eye="#1b0f0a" bristle="#2c2620" scars />,
  oldTusker: () => <Boar body="#2e2421" tusk="#f4e7c2" eye="#ff4a2a" bristle="#7a1f16" scale={1.12} scars crown />,
};

export function EnemyPortrait({ enemyId, size = 96 }: { enemyId: string; size?: number }) {
  const Art = ENEMY_ART[enemyId];
  return (
    <svg className="portrait" width={size} height={size} viewBox="0 0 120 120" role="img" aria-hidden>
      <Ground />
      {Art ? <Art /> : <circle cx="60" cy="70" r="24" fill="#555" />}
    </svg>
  );
}

// ------------------------------------------------------------------ race emblems

const SHIELD = 'M50 6 L90 18 V52 C90 76 72 92 50 100 C28 92 10 76 10 52 V18 Z';

const EMBLEM: Record<string, { field: string; sigil: ReactElement }> = {
  humans: {
    field: '#22344a',
    sigil: (
      <g fill={GOLD}>
        <path d="M30 70 V44 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 V70 Z" />
        <rect x="45" y="56" width="10" height="14" fill="#22344a" />
        <path d="M38 34 l4 -8 l4 6 l4 -10 l4 10 l4 -6 l4 8 Z" />
      </g>
    ),
  },
  orcs: {
    field: '#4a1712',
    sigil: (
      <g>
        <path d="M24 44 Q50 30 76 44 Q74 70 50 78 Q26 70 24 44 Z" fill="#7d8a3a" />
        <circle cx="39" cy="50" r="4" fill="#ffcf3d" />
        <circle cx="61" cy="50" r="4" fill="#ffcf3d" />
        <path d="M36 64 q2 -12 6 -2 M64 64 q-2 -12 -6 -2" stroke={BONE} strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>
    ),
  },
  dwarves: {
    field: '#3a3330',
    sigil: (
      <g>
        <path d="M18 76 L40 40 L52 56 L62 44 L82 76 Z" fill="#6f6863" />
        <rect x="47" y="30" width="6" height="40" fill={GOLD} />
        <rect x="36" y="26" width="28" height="12" rx="2" fill={GOLD} />
      </g>
    ),
  },
  elves: {
    field: '#1f3a2c',
    sigil: (
      <g>
        <path d="M50 24 C72 40 70 66 50 82 C30 66 28 40 50 24 Z" fill="#7fb36a" />
        <path d="M50 30 V80 M50 46 l-10 -6 M50 58 l12 -8 M50 68 l-10 -6" stroke="#1f3a2c" strokeWidth="2.5" fill="none" />
      </g>
    ),
  },
};

export function RaceEmblem({ raceId, size = 56 }: { raceId: string; size?: number }) {
  const e = EMBLEM[raceId] ?? EMBLEM.humans!;
  return (
    <svg className="emblem" width={size} height={size * 1.06} viewBox="0 0 100 106" role="img" aria-hidden>
      <path d={SHIELD} fill={e.field} stroke={GOLD} strokeWidth="4" />
      {e.sigil}
    </svg>
  );
}

// ------------------------------------------------------------------ activity scenes (troop cards)

function Pine({ x, h, c = '#1e3a2a' }: { x: number; h: number; c?: string }) {
  return <path className="sway" d={`M${x} ${60 - h} L${x + h * 0.35} 60 H${x - h * 0.35} Z`} fill={c} style={{ transformOrigin: `${x}px 60px` }} />;
}

export const SCENES: Record<ActivityKind | 'idle', { sky: [string, string]; art: ReactElement }> = {
  idle: {
    sky: ['#1a1422', '#2b1d18'],
    art: (
      <>
        <path d="M120 60 L140 34 L160 60 Z" fill="#3b2e24" />
        <path d="M134 60 L140 48 L146 60 Z" fill="#1a1210" />
        <path d="M184 58 h20 M188 54 l12 8 M200 54 l-12 8" stroke="#5a3a22" strokeWidth="3" strokeLinecap="round" />
        <path className="flicker" d="M194 54 q-6 -8 0 -16 q6 8 0 16 Z" fill="#f0a030" style={{ transformOrigin: '194px 54px' }} />
        <path className="smoke" d="M194 36 q4 -6 0 -12 q-4 -6 0 -12" stroke="#6b6070" strokeWidth="2" fill="none" opacity="0.5" />
      </>
    ),
  },
  woodcutting: {
    sky: ['#13221c', '#24331f'],
    art: (
      <>
        <Pine x={30} h={40} />
        <Pine x={62} h={52} c="#173123" />
        <Pine x={250} h={46} />
        <Pine x={282} h={36} c="#173123" />
        <rect x="150" y="48" width="22" height="12" rx="3" fill="#6a4426" />
        <ellipse cx="161" cy="48" rx="11" ry="3" fill="#b58a5a" />
        <path className="chop" d="M178 30 l10 18" stroke="#8a6a44" strokeWidth="3" strokeLinecap="round" style={{ transformOrigin: '188px 48px' }} />
      </>
    ),
  },
  mining: {
    sky: ['#191820', '#2a2626'],
    art: (
      <>
        <path d="M60 60 L130 14 L200 60 Z" fill="#3a3637" />
        <path d="M150 60 L220 24 L290 60 Z" fill="#2e2b2c" />
        <path d="M118 60 v-16 a12 12 0 0 1 24 0 v16 Z" fill="#0d0b0c" stroke="#6b4a2a" strokeWidth="3" />
        <circle className="flicker" cx="130" cy="44" r="2.5" fill="#f0b040" style={{ transformOrigin: '130px 44px' }} />
        <circle cx="236" cy="56" r="3" fill="#7c94a8" />
        <circle cx="244" cy="57" r="2" fill="#7c94a8" />
      </>
    ),
  },
  food: {
    sky: ['#2a2516', '#3a2f17'],
    art: (
      <>
        <circle cx="270" cy="20" r="10" fill="#e8b84a" opacity="0.8" />
        {Array.from({ length: 14 }, (_, i) => (
          <path key={i} className="sway" d={`M${20 + i * 20} 60 q2 -14 0 -22`} stroke="#c9a24a" strokeWidth="3" fill="none" style={{ transformOrigin: `${20 + i * 20}px 60px`, animationDelay: `${(i % 4) * 0.3}s` }} />
        ))}
        <path d="M0 60 h320" stroke="#5a4a22" strokeWidth="3" />
      </>
    ),
  },
  construction: {
    sky: ['#1d1822', '#2d2219'],
    art: (
      <>
        <path d="M110 60 V24 M170 60 V24 M110 24 H170 M110 42 H170 M110 60 L170 24" stroke="#8a6a44" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M100 24 L140 8 L180 24" stroke="#6a4a2a" strokeWidth="4" fill="none" strokeLinecap="round" />
        <rect x="200" y="50" width="30" height="10" fill="#6f6863" />
        <rect x="206" y="42" width="18" height="8" fill="#837a73" />
        <path className="chop" d="M190 30 l8 12" stroke="#c9a24a" strokeWidth="3" strokeLinecap="round" style={{ transformOrigin: '198px 42px' }} />
      </>
    ),
  },
  combat: {
    sky: ['#2a1214', '#3a1a12'],
    art: (
      <>
        <path d="M0 60 Q80 46 160 56 T320 52 V60 Z" fill="#1d1210" />
        <path d="M140 20 L180 56 M180 20 L140 56" stroke="#c9ccd4" strokeWidth="4" strokeLinecap="round" />
        <path d="M134 26 l12 -12 M186 26 l-12 -12" stroke={GOLD} strokeWidth="4" strokeLinecap="round" />
        <path d="M60 60 V22 l22 6 l-22 6" fill="#8a2a1e" stroke="#5a3a22" strokeWidth="2" />
        <path d="M260 60 V26 l-20 6 l20 6" fill="#3a3a5a" stroke="#5a3a22" strokeWidth="2" />
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

// ------------------------------------------------------------------ settlement panorama

/** The outpost grows visibly: each built building adds its piece to the scene. */
export function SettlementScene({ buildings }: { buildings: Record<string, number> }) {
  const has = (id: string) => (buildings[id] ?? 0) > 0;
  const barracks = buildings.barracks ?? 0;
  return (
    <svg className="settlement-scene" viewBox="0 0 320 120" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Din bosättning">
      <defs>
        <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1426" />
          <stop offset="70%" stopColor="#3a2418" />
        </linearGradient>
      </defs>
      <rect width="320" height="120" fill="url(#dusk)" />
      <circle cx="262" cy="30" r="12" fill="#e9d8a6" opacity="0.85" />
      <path d="M0 78 L40 52 L80 74 L130 44 L180 72 L230 50 L280 70 L320 56 V120 H0 Z" fill="#221b22" />
      <path d="M0 100 Q80 90 160 96 T320 92 V120 H0 Z" fill="#2a1f16" />

      {/* Always: the patrol camp */}
      <path d="M128 100 L146 74 L164 100 Z" fill="#6a5238" />
      <path d="M142 100 L146 88 L150 100 Z" fill="#1a1210" />
      <path d="M170 100 L184 82 L198 100 Z" fill="#5a4630" />
      <path d="M150 104 h10" stroke="#5a3a22" strokeWidth="3" />
      <path className="flicker" d="M155 102 q-4 -6 0 -11 q4 5 0 11 Z" fill="#f0a030" style={{ transformOrigin: '155px 102px' }} />

      {has('trainingCamp') && (
        <g>
          <path d="M96 104 V86 M96 90 h-6 M96 90 h6" stroke="#b58a5a" strokeWidth="3" strokeLinecap="round" />
          <circle cx="96" cy="83" r="4" fill="#b58a5a" />
          <path d="M70 106 h46 M74 98 v8 M86 98 v8 M100 98 v8 M112 98 v8" stroke="#6a4426" strokeWidth="2" />
          <path d="M120 70 V100 M120 70 l14 4 l-14 4" stroke="#5a3a22" strokeWidth="2" fill="#8a2a1e" />
        </g>
      )}
      {barracks > 0 && (
        <g>
          <rect x="204" y="84" width={barracks > 1 ? 70 : 48} height="20" fill="#4a3426" />
          <path d={`M200 86 L${barracks > 1 ? 239 : 228} 70 L${barracks > 1 ? 278 : 256} 86 Z`} fill="#6a3a24" />
          <rect x="214" y="92" width="8" height="12" fill="#1a1210" />
          <rect x="234" y="90" width="6" height="5" fill="#f0b040" opacity="0.8" />
        </g>
      )}
      {has('farm') && (
        <g>
          {Array.from({ length: 6 }, (_, i) => (
            <path key={i} d={`M${12 + i * 9} 112 l14 -10`} stroke="#c9a24a" strokeWidth="2" />
          ))}
          <path d="M8 104 h60" stroke="#5a4a22" strokeWidth="2" />
        </g>
      )}
      {has('forge') && (
        <g>
          <rect x="282" y="88" width="28" height="18" fill="#3a3637" />
          <rect x="300" y="72" width="6" height="16" fill="#2e2b2c" />
          <path className="smoke" d="M303 70 q5 -6 0 -12 q-5 -6 0 -12" stroke="#8a8090" strokeWidth="2.5" fill="none" opacity="0.6" />
          <rect x="288" y="96" width="8" height="10" fill="#f07020" opacity="0.8" />
        </g>
      )}
    </svg>
  );
}
