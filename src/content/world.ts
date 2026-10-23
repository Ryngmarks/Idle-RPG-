// Start-area content for prototype P0 "The Farmstead Camp".
// See docs/ROADMAP.md §2 and docs/FIRST_15_MINUTES.md. Player-facing text is Swedish for now.

import type { BuildingDef, BuildingLevelDef, EnemyDef, EquipmentContent, ObjectiveDef, UpgradeDef, WorkSiteDef, ZoneDef } from '../core/types';

// Combat is tuned for a handful of soldiers (docs/PROGRESSION_V2.md §8.3).
// Levels 1-5 and Gamle Betarn are hand-written (the tuned first hour); levels 6-40 come from the generator
// below (docs/PROGRESSION_V2.md §19.1). Names and bands are data, the numbers come from the formulas.
const handWritten: Record<string, EnemyDef> = {
  wildChicken: { id: 'wildChicken', name: 'Vild kyckling', hp: 12, armour: 0, attack: 0.12, xp: 3, loot: { food: 1 } },
  angryRooster: { id: 'angryRooster', name: 'Arg tupp', hp: 25, armour: 0, attack: 0.4, xp: 5, loot: { food: 1 } },
  fox: { id: 'fox', name: 'Räv', hp: 45, armour: 1, attack: 0.7, xp: 8, loot: { food: 1.5, ore: 0.5 } },
  wildBoar: { id: 'wildBoar', name: 'Vildsvin', hp: 80, armour: 2, attack: 0.9, xp: 12, loot: { food: 2, ore: 1.5 } },
  oldBoar: { id: 'oldBoar', name: 'Gammal galt', hp: 130, armour: 3, attack: 1.1, xp: 18, loot: { food: 3, ore: 2.5 } },
  oldTusker: { id: 'oldTusker', name: 'Gamle Betarn', hp: 500, armour: 3, attack: 1.2, xp: 0, loot: {} },
};

interface Role { hp: number; armour: number; attack: number; xp: number }

/** By level mod 5: light, normal, heavy, armoured, elite (the boss-level family). */
const ROLES: Record<number, Role> = {
  1: { hp: 0.85, armour: -1, attack: 1.0, xp: 0.8 },
  2: { hp: 1.0, armour: 0, attack: 1.0, xp: 1.0 },
  3: { hp: 1.2, armour: 1, attack: 1.15, xp: 1.2 },
  4: { hp: 1.0, armour: 2, attack: 0.9, xp: 1.1 },
  0: { hp: 1.15, armour: 1, attack: 1.1, xp: 1.5 },
};

/** Bands of five levels with the family names in role order (light, normal, heavy, armoured, elite). */
const BANDS: { name: string; families: string[] }[] = [
  { name: 'Gårdarna', families: ['Vild kyckling', 'Arg tupp', 'Räv', 'Vildsvin', 'Gammal galt'] },
  { name: 'Skogsbrynet', families: ['Skogsmus-flock', 'Vildkatt', 'Brunbjörn', 'Hugget ormbo', 'Vargalfa'] },
  { name: 'Rövarstigen', families: ['Stigtjuv', 'Fredlös bågskytt', 'Rövarhund', 'Skölddräng', 'Rövarkapten'] },
  { name: 'Mossen', families: ['Sumpgroda', 'Dyvarg', 'Mossgast', 'Torvjätte-unge', 'Dimvakt'] },
  { name: 'Ödegårdarna', families: ['Skräckkråka', 'Brandspöke', 'Ruinvaktare', 'Skelettbonde', 'Svedd fogdeknekt'] },
  { name: 'Kullarna', families: ['Klippget', 'Stenhuggare-troll', 'Bergstroll', 'Klippörn', 'Kullkung'] },
  { name: 'Gränsmarken', families: ['Gränsspejare', 'Järnvarg', 'Krigshund', 'Pansarknekt', 'Svartrockskaptenens garde'] },
  { name: 'Svartborgen', families: ['Borgvakt', 'Murbrytare', 'Svartrocksveteran', 'Skuggryttare', 'Borgens elit'] },
];

/** Kills to clear a level per band: the first four levels of the band, then the boss-level elite. */
const KILLS: { normal: number; boss: number }[] = [
  { normal: 12, boss: 8 },
  { normal: 12, boss: 8 },
  { normal: 14, boss: 10 },
  { normal: 16, boss: 12 },
  { normal: 26, boss: 16 },
  { normal: 32, boss: 20 },
  { normal: 38, boss: 24 },
  { normal: 44, boss: 28 },
];

/** Rounds to the nearest integer, halves to even (the armour table in §19.1 is built that way). */
function roundHalfEven(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1;
  return Math.round(x);
}

const round = (x: number, decimals: number) => Math.round(x * 10 ** decimals) / 10 ** decimals;

/** Three significant figures. */
function sig3(x: number): number {
  const mag = 10 ** (Math.floor(Math.log10(Math.abs(x))) - 2);
  return Math.round(x / mag) * mag;
}

/** HP growth: gentle up to level 20 (fast early tempo), steeper after (the tempo knob, §19.1). */
const E = (k: string, d: number) => Number(process.env[k] ?? d);
const G1 = E('G1', 1.065), G2 = E('G2', 1.12), HPA = E('HPA', 1), BOSSM = E('BOSSM', 1);
function hpGrowth(level: number): number {
  return HPA * (level <= 20 ? Math.pow(G1, level - 5) : Math.pow(G1, 15) * Math.pow(G2, level - 20));
}

/** XP of generated enemies (M13 tuning): scale on the anchor and growth per level; keeps troop levels readable (about 20-50 at level 40). */
const XP_SCALE = Number(process.env.XP_SCALE ?? 0.1);
const XP_GROWTH = Number(process.env.XP_GROWTH ?? 1.06);

/** The generated enemy of a level (6-40) in a band of five; anchored on the old boar at level 5. */
export function makeEnemy(level: number, name: string): EnemyDef {
  const role = ROLES[level % 5]!;
  const d = level - 5;
  return {
    id: `level${level}`,
    name,
    hp: sig3(130 * hpGrowth(level) * role.hp),
    armour: roundHalfEven(3 + 0.3 * d) + role.armour,
    attack: round(1.1 * Math.pow(1.07, d) * role.attack, 2),
    xp: round(18 * XP_SCALE * Math.pow(XP_GROWTH, d) * role.xp, 2),
    loot: { food: round(3 * Math.pow(1.04, d), 2), ore: round(2.5 * Math.pow(1.03, d), 2) },
  };
}

/** Level 1-5 ids in order, as before the expansion. */
const FIRST_FIVE = ['wildChicken', 'angryRooster', 'fox', 'wildBoar', 'oldBoar'];

/** Bosses 2-8 (boss 1 is Gamle Betarn): hand-set numbers from §19.2 (HP is 4x the elite, armour elite + 2, attack 2x). */
const bossTable: { id: string; level: number; name: string; hp: number; armour: number; attack: number; timeLimitSec: number }[] = [
  { id: 'greyPelt', level: 10, name: 'Gråpäls, flockens ledare', hp: 820, armour: 7, attack: 3.4, timeLimitSec: 90 },
  { id: 'crowFoot', level: 15, name: 'Kråkfot, rövarhövdingen', hp: 1100, armour: 9, attack: 4.8, timeLimitSec: 120 },
  { id: 'mossWife', level: 20, name: 'Mossfrun', hp: 1500, armour: 11, attack: 6.6, timeLimitSec: 120 },
  { id: 'bailiffBlackfire', level: 25, name: 'Fogde Svartbrand', hp: 2700, armour: 12, attack: 9.2, timeLimitSec: 120 },
  { id: 'trollGrymstorp', level: 30, name: 'Stentrollet Grymstorp', hp: 4800, armour: 13, attack: 13.0, timeLimitSec: 150 },
  { id: 'captainIronhand', level: 35, name: 'Kapten Järnhand', hp: 8400, armour: 15, attack: 18.2, timeLimitSec: 150 },
  { id: 'lordSharpmark', level: 40, name: 'Borgherre Skarpmark', hp: 14800, armour: 17, attack: 25.6, timeLimitSec: 150 },
];

export const enemies: Record<string, EnemyDef> = { ...handWritten };
const stages: ZoneDef['stages'] = [];
const KMULT = (process.env.KMULT ?? '1,1,1,1,1,1,1,1').split(',').map(Number);
for (let level = 1; level <= 40; level++) {
  const band = Math.floor((level - 1) / 5);
  const kills = KILLS[band]!;
  const isBossLevel = level % 5 === 0;
  let enemyId: string;
  if (level <= 5) enemyId = FIRST_FIVE[level - 1]!;
  else {
    const e = makeEnemy(level, BANDS[band]!.families[(level - 1) % 5]!);
    enemies[e.id] = e;
    enemyId = e.id;
  }
  // Levels 1-5 keep today's kills (12, 12, 12, 12, 8), which equal the first band of the table.
  const km = KMULT[band] ?? 1;
  stages.push({ enemyId, killsToClear: Math.round((isBossLevel ? kills.boss : kills.normal) * km) });
}
for (const b of bossTable) enemies[b.id] = { id: b.id, name: b.name, hp: b.hp * BOSSM, armour: b.armour, attack: b.attack, xp: 0, loot: {} };

export const zones: Record<string, ZoneDef> = {
  farmsteads: {
    id: 'farmsteads',
    name: 'Gårdarna',
    sites: ['birchGrove', 'ekskogen', 'oldQuarry', 'oreVein', 'jarngruvan', 'berryThickets', 'fields'],
    stages,
    bosses: [
      { level: 5, enemyId: 'oldTusker', timeLimitSec: 90 },
      ...bossTable.map((b) => ({ level: b.level, enemyId: b.id, timeLimitSec: b.timeLimitSec })),
    ],
    bands: BANDS.map((b, i) => ({ name: b.name, fromLevel: i * 5 + 1, toLevel: i * 5 + 5 })),
  },
};

/** Work sites: one cycle per working soldier every cycleSec / (work × skill); `capacity` soldiers at once. */
export const sites: Record<string, WorkSiteDef> = {
  birchGrove: { id: 'birchGrove', name: 'Björkdungen', activity: 'woodcutting', capacity: 3, cycleSec: 30, yield: { wood: 5 } },
  oldQuarry: { id: 'oldQuarry', name: 'Gamla stenbrottet', activity: 'mining', capacity: 2, cycleSec: 40, yield: { stone: 4 } },
  oreVein: { id: 'oreVein', name: 'Malmådern', activity: 'mining', capacity: 1, cycleSec: 60, yield: { ore: 2 } },
  berryThickets: { id: 'berryThickets', name: 'Bärsnåren', activity: 'food', capacity: 2, cycleSec: 20, yield: { food: 2 } },
  fields: { id: 'fields', name: 'Åkrarna', activity: 'food', capacity: 3, cycleSec: 60, yield: { food: 9 }, unlock: 'site:fields' },
  // Boss rewards (docs/PROGRESSION_V2.md §19.5): Ekskogen after boss 2, Järngruvan (the only source of iron) after boss 3.
  ekskogen: { id: 'ekskogen', name: 'Ekskogen', activity: 'woodcutting', capacity: 4, cycleSec: 40, yield: { wood: 8 }, unlock: 'site:ekskogen' },
  jarngruvan: { id: 'jarngruvan', name: 'Järngruvan', activity: 'mining', capacity: 2, cycleSec: 90, yield: { iron: 2 * E('IRONY', 1), stone: 6 }, unlock: 'site:jarngruvan' },
};

/** Levels `from`..`to` of a building built from a formula, so growth is one line and not a hand-written table. */
function repeatLevels(from: number, to: number, make: (n: number) => BuildingLevelDef): BuildingLevelDef[] {
  return Array.from({ length: to - from + 1 }, (_, i) => make(from + i));
}
const r = Math.round;

// Construction work: one soldier with work 1 and skill 1 does 1 work per second (a 30 s work moment = 30).
export const buildings: Record<string, BuildingDef> = {
  tents: {
    id: 'tents',
    name: 'Tält',
    levels: [
      { cost: { wood: 25, stone: 10 }, work: 60, effects: [{ kind: 'beds', amount: 1 }] },
      { cost: { wood: 45, stone: 25 }, work: 90, effects: [{ kind: 'beds', amount: 1 }] },
      { cost: { wood: 80, stone: 50 }, work: 120, effects: [{ kind: 'beds', amount: 1 }] },
      // Level 4 opens after boss 1; 5-8 by cost only.
      ...repeatLevels(4, 8, (n) => ({
        requires: 'level:tents:4',
        cost: { wood: r(80 * 1.35 ** (n - 3)), stone: r(50 * 1.35 ** (n - 3)) },
        work: r(120 * 1.25 ** (n - 3)),
        effects: [{ kind: 'beds', amount: 1 }],
      })),
    ],
  },
  trainingCamp: {
    id: 'trainingCamp',
    name: 'Träningsläger',
    levels: [
      {
        cost: { wood: 40, stone: 25, food: 20 },
        work: 180,
        effects: [{ kind: 'beds', amount: 1 }, { kind: 'troopSlot' }, { kind: 'unlock', unlock: 'recruit' }],
      },
    ],
  },
  farm: {
    id: 'farm',
    name: 'Gård',
    levels: [
      { cost: { wood: 60, stone: 30 }, work: 180, effects: [{ kind: 'unlock', unlock: 'site:fields' }] },
      { cost: { wood: 70, stone: 40 }, work: 300, effects: [{ kind: 'capacity', target: 'fields', amount: 1 }] },
      // Opens after boss 1. Level 3 also opens Fältkök II.
      ...repeatLevels(3, 6, (n) => ({
        requires: 'level:farm:3',
        cost: { wood: r(70 * 1.4 ** (n - 2)), stone: r(40 * 1.4 ** (n - 2)) },
        work: r(300 * 1.3 ** (n - 2)),
        effects: [
          { kind: 'capacity', target: 'fields', amount: 1 },
          ...(n === 3 ? [{ kind: 'unlock', unlock: 'upgrade:fieldKitchens2' } as const] : []),
        ],
      })),
    ],
  },
  woodshed: {
    id: 'woodshed',
    name: 'Vedskjul',
    levels: [
      { cost: { wood: 50, stone: 20 }, work: 120, effects: [{ kind: 'capacity', target: 'birchGrove', amount: 1 }] },
      ...repeatLevels(2, 4, (n) => ({
        cost: { wood: r(50 * 1.5 ** (n - 1)), stone: r(20 * 1.5 ** (n - 1)) },
        work: r(120 * 1.3 ** (n - 1)),
        effects: [{ kind: 'capacity', target: 'birchGrove', amount: 1 } as const],
      })),
    ],
  },
  forge: {
    id: 'forge',
    name: 'Smedja',
    levels: [
      {
        cost: { wood: 50, stone: 50, ore: 6 },
        work: 240,
        effects: [
          { kind: 'unlock', unlock: 'crafting' },
          { kind: 'unlock', unlock: 'tier:1' },
          { kind: 'unlock', unlock: 'tab:forge' },
          { kind: 'unlock', unlock: 'activity:smithing' },
        ],
      },
      { cost: { wood: 90, stone: 60, ore: 10 }, work: 480, effects: [{ kind: 'capacity', target: 'smithing', amount: 1 }] },
      // Level 3 opens with boss 4 (which also unlocks tier 2); 4-5 by cost only.
      ...repeatLevels(3, 5, (n) => ({
        ...(n === 3 ? { requires: 'level:forge:3' } : {}),
        cost: { wood: 150, stone: 100, ore: r(10 * 1.6 ** (n - 2)) },
        work: r(480 * 1.4 ** (n - 2)),
        effects: [{ kind: 'capacity', target: 'smithing', amount: 1 } as const],
      })),
    ],
  },
  barracks: {
    id: 'barracks',
    name: 'Baracker',
    levels: [
      { cost: { wood: 120, stone: 80, food: 40 }, work: 600, effects: [{ kind: 'beds', amount: 3 }] },
      { cost: { wood: 400, stone: 300, food: 100 }, work: 1500, effects: [{ kind: 'beds', amount: 5 }] },
      // Level 3 opens with boss 5; 4-5 by cost only. Cost doubles per level; the work grows slower (guess).
      ...repeatLevels(3, 5, (n) => ({
        ...(n === 3 ? { requires: 'level:barracks:3' } : {}),
        cost: { wood: 400 * 2 ** (n - 2), stone: 300 * 2 ** (n - 2), food: 100 * 2 ** (n - 2) },
        work: r(1500 * 1.5 ** (n - 2)),
        effects: [{ kind: 'beds', amount: 5 } as const],
      })),
    ],
  },
  // Övningsplan: +8 % attack per level (modifiers of the same stat add). Unlocked by boss 1.
  drillGround: {
    id: 'drillGround',
    name: 'Övningsplan',
    levels: repeatLevels(1, 5, (n) => ({
      cost: { wood: r(150 * 1.5 ** (n - 1)), stone: r(100 * 1.5 ** (n - 1)), food: r(60 * 1.5 ** (n - 1)) },
      work: r(400 * 1.3 ** (n - 1)),
      effects: [{ kind: 'modifier', modifier: { stat: 'attack', op: 'mult', value: 0.08, source: 'building:drillGround' } } as const],
    })),
  },
};

export const upgrades: Record<string, UpgradeDef> = {
  sharpenedAxes: {
    id: 'sharpenedAxes',
    name: 'Vassa yxor',
    cost: { wood: 15 },
    modifiers: [{ stat: 'skill.woodcutting', op: 'mult', value: 0.5, source: 'upgrade:sharpenedAxes' }],
  },
  drillPractice: {
    id: 'drillPractice',
    name: 'Exercis',
    cost: { food: 20, wood: 20 },
    modifiers: [{ stat: 'attack', op: 'mult', value: 0.25, source: 'upgrade:drillPractice' }],
  },
  drillPractice2: {
    id: 'drillPractice2',
    name: 'Exercis II',
    cost: { food: 120, wood: 120 },
    modifiers: [{ stat: 'attack', op: 'mult', value: 0.25, source: 'upgrade:drillPractice2' }],
  },
  fieldKitchens2: {
    id: 'fieldKitchens2',
    name: 'Fältkök II',
    cost: { wood: 200, food: 150 },
    modifiers: [{ stat: 'skill.food', op: 'mult', value: 0.3, source: 'upgrade:fieldKitchens2' }],
  },
  stonePicks: {
    id: 'stonePicks',
    name: 'Stenhackor',
    cost: { wood: 30, stone: 15 },
    modifiers: [{ stat: 'skill.mining', op: 'mult', value: 0.33, source: 'upgrade:stonePicks' }],
  },
  sharpenedAxes2: {
    id: 'sharpenedAxes2',
    name: 'Vassa yxor II',
    cost: { wood: 60, stone: 20 },
    modifiers: [{ stat: 'skill.woodcutting', op: 'mult', value: 0.3, source: 'upgrade:sharpenedAxes2' }],
  },
  stonePicks2: {
    id: 'stonePicks2',
    name: 'Stenhackor II',
    cost: { wood: 60, stone: 40, ore: 4 },
    modifiers: [{ stat: 'skill.mining', op: 'mult', value: 0.25, source: 'upgrade:stonePicks2' }],
  },
  fieldKitchens: {
    id: 'fieldKitchens',
    name: 'Fältkök',
    cost: { wood: 50, food: 30 },
    modifiers: [{ stat: 'skill.food', op: 'mult', value: 0.3, source: 'upgrade:fieldKitchens' }],
  },
  carpentry: {
    id: 'carpentry',
    name: 'Snickarverktyg',
    cost: { wood: 60, stone: 40 },
    modifiers: [{ stat: 'skill.construction', op: 'mult', value: 0.3, source: 'upgrade:carpentry' }],
  },
};

const POWER_STEP = 1.35;

/** Weapons: one type per race; T1–T8 exist in the model, only T1 is unlocked (by the forge). */
export const equipment: EquipmentContent = {
  weaponTypes: {
    sword: { id: 'sword', name: 'Svärd', wielder: 'svärdskrigare' },
    cleaver: { id: 'cleaver', name: 'Klyvyxa', wielder: 'yxkrigare' },
    axe: { id: 'axe', name: 'Stridsyxa', wielder: 'yxkämpar' },
    bow: { id: 'bow', name: 'Båge', wielder: 'bågskyttar' },
  },
  // A T1 Normal weapon gives +25 % over improvised arms; each tier is ×1.35 more.
  tiers: Array.from({ length: 8 }, (_, i) => ({ tier: i + 1, powerMult: 1.25 * Math.pow(POWER_STEP, i) })),
  qualities: [
    { id: 'normal', name: 'Normal', powerMult: 1 },
    { id: 'good', name: 'God', powerMult: 1.07 },
    { id: 'outstanding', name: 'Utmärkt', powerMult: 1.15 },
    { id: 'excellent', name: 'Exceptionell', powerMult: 1.24 },
    { id: 'masterpiece', name: 'Mästerverk', powerMult: POWER_STEP },
  ],
  recipes: {
    sword_t1: { id: 'sword_t1', weaponTypeId: 'sword', tier: 1, materials: { ore: 2 }, workPerItem: 60 },
    cleaver_t1: { id: 'cleaver_t1', weaponTypeId: 'cleaver', tier: 1, materials: { ore: 2 }, workPerItem: 60 },
    axe_t1: { id: 'axe_t1', weaponTypeId: 'axe', tier: 1, materials: { ore: 2 }, workPerItem: 60 },
    bow_t1: { id: 'bow_t1', weaponTypeId: 'bow', tier: 1, materials: { wood: 3 }, workPerItem: 60 },
    // T2 (docs/PROGRESSION_V2.md §19.5): iron from Järngruvan, unlocked by boss 4, gated by T1 mastery 2 of the same type.
    sword_t2: { id: 'sword_t2', weaponTypeId: 'sword', tier: 2, materials: { iron: Math.round(6 * E('IRONM', 1)), ore: 3 }, workPerItem: 120, requiresMastery: { level: 2 } },
    cleaver_t2: { id: 'cleaver_t2', weaponTypeId: 'cleaver', tier: 2, materials: { iron: Math.round(6 * E('IRONM', 1)), ore: 3 }, workPerItem: 120, requiresMastery: { level: 2 } },
    axe_t2: { id: 'axe_t2', weaponTypeId: 'axe', tier: 2, materials: { iron: Math.round(6 * E('IRONM', 1)), ore: 3 }, workPerItem: 120, requiresMastery: { level: 2 } },
    bow_t2: { id: 'bow_t2', weaponTypeId: 'bow', tier: 2, materials: { iron: Math.round(4 * E('IRONM', 1)), wood: 4 }, workPerItem: 120, requiresMastery: { level: 2 } },
  },
  unarmedMult: 1,
  chancesAtMin: [0.85, 0.13, 0.02, 0, 0],
  chancesAtMax: [0.3, 0.33, 0.22, 0.11, 0.04],
  maxMastery: 10,
  itemsPerMasteryStep: 20,
  firstMasteryStep: 6,
};

export const objectives: ObjectiveDef[] = [
  {
    id: 'sendWood',
    text: 'Din soldat väntar på order. Skicka den för att hugga ved.',
    requires: [],
    condition: { kind: 'troopAssigned', activity: 'woodcutting' },
    rewards: {},
  },
  {
    id: 'wood30',
    text: 'Fäll träd: samla 15 ved.',
    requires: ['sendWood'],
    condition: { kind: 'totalGathered', resource: 'wood', amount: 15 },
    rewards: { unlocks: ['tab:upgrades', 'upgrade:sharpenedAxes'] },
  },
  {
    id: 'wood60',
    text: 'Samla 30 ved totalt.',
    requires: ['wood30'],
    condition: { kind: 'totalGathered', resource: 'wood', amount: 30 },
    rewards: { unlocks: ['activity:combat', 'tab:battle'] },
  },
  {
    id: 'kill5',
    text: 'Kycklingar har setts vid den gamla gården. Besegra 3.',
    requires: ['wood60'],
    condition: { kind: 'kills', amount: 3 },
    rewards: { unlocks: ['activity:food', 'upgrade:drillPractice'] },
  },
  {
    id: 'rescue',
    text: 'Någon ropar på hjälp från hönsgården. Rensa steg 1.',
    requires: ['kill5'],
    condition: { kind: 'stageReached', stage: 2 },
    rewards: {
      soldiers: 1,
      unlocks: ['activity:mining', 'activity:construction', 'tab:settlement', 'building:tents'],
    },
  },
  {
    id: 'stone20',
    text: 'Bryt 20 sten i stenbrottet.',
    requires: ['rescue'],
    condition: { kind: 'totalGathered', resource: 'stone', amount: 20 },
    rewards: { unlocks: ['upgrade:stonePicks', 'building:trainingCamp'] },
  },
  {
    id: 'food10',
    text: 'Plocka bär: samla 10 mat.',
    requires: ['kill5'],
    condition: { kind: 'totalGathered', resource: 'food', amount: 10 },
    rewards: { unlocks: ['upgrade:fieldKitchens'] },
  },
  {
    id: 'tent1',
    text: 'Res ett tält: en säng till.',
    requires: ['rescue'],
    condition: { kind: 'buildingLevel', buildingId: 'tents', level: 1 },
    rewards: {},
  },
  {
    id: 'trainingCamp',
    text: 'Bygg ett träningsläger.',
    requires: ['stone20'],
    condition: { kind: 'buildingLevel', buildingId: 'trainingCamp', level: 1 },
    rewards: {},
  },
  {
    id: 'twoTroops',
    text: 'Två grupper: ge båda order.',
    requires: ['trainingCamp'],
    condition: { kind: 'troopsAssigned', count: 2 },
    rewards: { unlocks: ['building:farm', 'building:forge', 'upgrade:carpentry'] },
  },
  {
    id: 'train1',
    text: 'Utbilda en rekryt på träningslägret.',
    requires: ['trainingCamp'],
    condition: { kind: 'recruited', amount: 1 },
    rewards: {},
  },
  {
    id: 'stage3',
    text: 'Rensa gården: klara steg 2 av 5.',
    requires: ['twoTroops'],
    condition: { kind: 'stageReached', stage: 3 },
    rewards: { resources: { food: 20 } },
  },
  {
    id: 'soldiers5',
    text: 'Väx till fem soldater.',
    requires: ['train1'],
    condition: { kind: 'soldiersAtLeast', count: 5 },
    rewards: { resources: { wood: 30 } },
  },
  {
    id: 'farm',
    text: 'Bygg en gård och odla åkrarna.',
    requires: ['twoTroops'],
    condition: { kind: 'buildingLevel', buildingId: 'farm', level: 1 },
    rewards: {},
  },
  {
    id: 'farm2',
    text: 'Valfritt: bygg ut gården, åkrarna får en plats till.',
    requires: ['farm'],
    condition: { kind: 'buildingLevel', buildingId: 'farm', level: 2 },
    rewards: { resources: { wood: 40 } },
  },
  {
    id: 'tent2',
    text: 'Res ett andra tält: fler sängar, fler soldater.',
    requires: ['train1'],
    condition: { kind: 'buildingLevel', buildingId: 'tents', level: 2 },
    rewards: { resources: { wood: 30 }, unlocks: ['building:woodshed'] },
  },
  {
    id: 'woodshed',
    text: 'Bygg ett vedskjul: plats för en yxa till i Björkdungen.',
    requires: ['tent2'],
    condition: { kind: 'buildingLevel', buildingId: 'woodshed', level: 1 },
    rewards: { unlocks: ['upgrade:sharpenedAxes2'] },
  },
  {
    id: 'ore10',
    text: 'Valfritt: gräv fram 10 malm ur Malmådern.',
    requires: ['twoTroops'],
    condition: { kind: 'totalGathered', resource: 'ore', amount: 10 },
    rewards: { resources: { food: 20 }, unlocks: ['upgrade:stonePicks2'] },
  },
  {
    id: 'rescue2',
    text: 'Någon ropar från grisfållan. Rensa steg 4 och befria honom.',
    requires: ['stage3'],
    condition: { kind: 'stageReached', stage: 5 },
    rewards: { soldiers: 1 },
  },
  {
    id: 'forge',
    text: 'Bygg en smedja.',
    requires: ['twoTroops'],
    condition: { kind: 'buildingLevel', buildingId: 'forge', level: 1 },
    rewards: {},
  },
  {
    id: 'smith',
    text: 'Smedjan står klar. Sätt en trupp att smida.',
    requires: ['forge'],
    condition: { kind: 'troopAssigned', activity: 'smithing' },
    rewards: {},
  },
  {
    id: 'gear1',
    text: 'Smid vapen och utrusta en trupp med dem.',
    requires: ['forge'],
    condition: { kind: 'weaponsEquipped', amount: 1 },
    rewards: {},
  },
  {
    id: 'forge2',
    text: 'Bygg ut smedjan: ett städ till, fler vapen.',
    requires: ['gear1'],
    condition: { kind: 'buildingLevel', buildingId: 'forge', level: 2 },
    rewards: { resources: { food: 30 } },
  },
  {
    id: 'raid1',
    text: 'Plundra gårdarna: besegra 80 fiender.',
    requires: ['stage3'],
    condition: { kind: 'kills', amount: 80 },
    rewards: { resources: { wood: 45, stone: 25 } },
  },
  {
    id: 'raid2',
    text: 'Krigsbyte: besegra 130 fiender.',
    requires: ['raid1'],
    condition: { kind: 'kills', amount: 130 },
    rewards: { resources: { food: 40, ore: 6 } },
  },
  {
    id: 'zoneCleared',
    text: 'Rensa alla fem stegen på gårdarna.',
    requires: ['stage3'],
    condition: { kind: 'zoneCleared' },
    rewards: { unlocks: ['boss'] },
  },
  {
    id: 'boss',
    text: 'Besegra Gamle Betarn och befria hans fångar.',
    requires: ['zoneCleared'],
    condition: { kind: 'bossDefeated' },
    rewards: {
      troopSlots: 1,
      soldiers: 2,
      unlocks: ['building:barracks', 'building:drillGround', 'level:tents:4', 'level:farm:3'],
    },
  },
  // ---- M13: zone 1 to level 40 (docs/PROGRESSION_V2.md §19.5). Bosses 2-8, level goals and the economy goals.
  { id: 'barracks1', text: 'Bygg baracker: plats för tre soldater till.', requires: ['boss'], condition: { kind: 'buildingLevel', buildingId: 'barracks', level: 1 }, rewards: { resources: { food: 50 } } },
  { id: 'drill1', text: 'Bygg en övningsplan: soldaterna slår hårdare.', requires: ['boss'], condition: { kind: 'buildingLevel', buildingId: 'drillGround', level: 1 }, rewards: { resources: { wood: 60 } } },
  { id: 'lvl8', text: 'Valfritt: nå nivå 8.', requires: ['boss'], condition: { kind: 'levelReached', level: 8 }, rewards: { resources: { food: 60 } } },
  { id: 'soldiers10', text: 'Väx till tio soldater.', requires: ['boss'], condition: { kind: 'soldiersAtLeast', count: 10 }, rewards: { resources: { wood: 80 } } },
  { id: 'lvl10', text: 'Nå nivå 10: Skogsbrynets ledare väntar.', requires: ['boss'], condition: { kind: 'levelReached', level: 10 }, rewards: {} },
  {
    id: 'boss2',
    text: 'Besegra Gråpäls, flockens ledare.',
    requires: ['lvl10'],
    condition: { kind: 'bossDefeated', index: 2 },
    rewards: { soldiers: 2, unlocks: ['site:ekskogen', 'upgrade:drillPractice2'] },
  },
  { id: 'tents5', text: 'Res det femte tältet.', requires: ['boss2'], condition: { kind: 'buildingLevel', buildingId: 'tents', level: 5 }, rewards: { resources: { stone: 60 } } },
  { id: 'farm4', text: 'Valfritt: bygg ut gården till nivå 4.', requires: ['boss2'], condition: { kind: 'buildingLevel', buildingId: 'farm', level: 4 }, rewards: { resources: { food: 100 } } },
  { id: 'lvl15', text: 'Nå nivå 15: rövarhövdingen håller stigen.', requires: ['boss2'], condition: { kind: 'levelReached', level: 15 }, rewards: {} },
  {
    id: 'boss3',
    text: 'Besegra Kråkfot, rövarhövdingen.',
    requires: ['lvl15'],
    condition: { kind: 'bossDefeated', index: 3 },
    rewards: { soldiers: 1, troopSlots: 1, unlocks: ['site:jarngruvan'] },
  },
  { id: 'iron1', text: 'Bemanna Järngruvan och bryt det första järnet.', requires: ['boss3'], condition: { kind: 'totalGathered', resource: 'iron', amount: 1 }, rewards: { resources: { ore: 20 } } },
  { id: 'weapons60', text: 'Smid 60 vapen.', requires: ['boss3'], condition: { kind: 'weaponsCrafted', amount: 60 }, rewards: { resources: { ore: 20 } } },
  { id: 'soldiers14', text: 'Väx till fjorton soldater.', requires: ['boss3'], condition: { kind: 'soldiersAtLeast', count: 14 }, rewards: { resources: { food: 150 } } },
  { id: 'lvl20', text: 'Nå nivå 20: Mossfrun styr över mossen.', requires: ['boss3'], condition: { kind: 'levelReached', level: 20 }, rewards: {} },
  {
    id: 'boss4',
    text: 'Besegra Mossfrun. Smedjan kan då bygga starkare vapen.',
    requires: ['lvl20'],
    condition: { kind: 'bossDefeated', index: 4 },
    rewards: { resources: { ore: 150, wood: 300 }, unlocks: ['tier:2', 'level:forge:3'] },
  },
  { id: 't2first', text: 'Smid ditt första T2-vapen (järn och mästerskap 2).', requires: ['boss4'], condition: { kind: 'tierCrafted', tier: 2 }, rewards: { resources: { iron: 20 } } },
  { id: 'forge4', text: 'Bygg ut smedjan till nivå 4.', requires: ['boss4'], condition: { kind: 'buildingLevel', buildingId: 'forge', level: 4 }, rewards: { resources: { ore: 30 } } },
  { id: 'kills300', text: 'Valfritt: besegra 300 fiender.', requires: ['boss4'], condition: { kind: 'kills', amount: 300 }, rewards: { resources: { ore: 15 } } },
  { id: 'mastery3', text: 'Valfritt: nå mästerskap 3 med en vapentyp.', requires: ['boss4'], condition: { kind: 'masteryReached', level: 3 }, rewards: { resources: { food: 200 } } },
  { id: 'drill3', text: 'Bygg övningsplanen till nivå 3.', requires: ['boss4'], condition: { kind: 'buildingLevel', buildingId: 'drillGround', level: 3 }, rewards: { resources: { stone: 150 } } },
  { id: 'lvl25', text: 'Nå nivå 25: fogden samlar sina knektar.', requires: ['boss4'], condition: { kind: 'levelReached', level: 25 }, rewards: {} },
  {
    id: 'boss5',
    text: 'Besegra Fogde Svartbrand.',
    requires: ['lvl25'],
    condition: { kind: 'bossDefeated', index: 5 },
    rewards: { soldiers: 2, unlocks: ['level:barracks:3'] },
  },
  { id: 'farm6', text: 'Bygg ut gården till nivå 6.', requires: ['boss5'], condition: { kind: 'buildingLevel', buildingId: 'farm', level: 6 }, rewards: { resources: { food: 250 } } },
  { id: 'barracks3', text: 'Bygg barackerna till nivå 3.', requires: ['boss5'], condition: { kind: 'buildingLevel', buildingId: 'barracks', level: 3 }, rewards: { resources: { wood: 150 } } },
  { id: 'soldiers22', text: 'Väx till 22 soldater.', requires: ['boss5'], condition: { kind: 'soldiersAtLeast', count: 22 }, rewards: { resources: { wood: 200 } } },
  { id: 'kills500', text: 'Valfritt: besegra 500 fiender.', requires: ['boss5'], condition: { kind: 'kills', amount: 500 }, rewards: { resources: { ore: 40 } } },
  { id: 'lvl30', text: 'Nå nivå 30: Grymstorp väntar uppe på kullarna.', requires: ['boss5'], condition: { kind: 'levelReached', level: 30 }, rewards: {} },
  {
    id: 'boss6',
    text: 'Besegra Stentrollet Grymstorp.',
    requires: ['lvl30'],
    condition: { kind: 'bossDefeated', index: 6 },
    rewards: { soldiers: 1, troopSlots: 1, resources: { stone: 400, ore: 40 } },
  },
  { id: 'barracks5', text: 'Bygg barackerna till nivå 5.', requires: ['boss6'], condition: { kind: 'buildingLevel', buildingId: 'barracks', level: 5 }, rewards: { resources: { food: 300 } } },
  { id: 'drill5', text: 'Bygg övningsplanen till nivå 5.', requires: ['boss6'], condition: { kind: 'buildingLevel', buildingId: 'drillGround', level: 5 }, rewards: { resources: { stone: 300 } } },
  { id: 'lvl35', text: 'Nå nivå 35: Kapten Järnhand vaktar gränsmarken.', requires: ['boss6'], condition: { kind: 'levelReached', level: 35 }, rewards: {} },
  {
    id: 'boss7',
    text: 'Besegra Kapten Järnhand.',
    requires: ['lvl35'],
    condition: { kind: 'bossDefeated', index: 7 },
    rewards: { soldiers: 1, troopLevelSteps: 1, resources: { iron: 200, ore: 100 } },
  },
  { id: 'weapons400', text: 'Valfritt: smid 400 vapen.', requires: ['boss7'], condition: { kind: 'weaponsCrafted', amount: 400 }, rewards: { resources: { ore: 80 } } },
  { id: 'soldiers28', text: 'Väx till 28 soldater.', requires: ['boss7'], condition: { kind: 'soldiersAtLeast', count: 28 }, rewards: { resources: { food: 500 } } },
  { id: 'lvl40', text: 'Nå nivå 40: Svartborgen och dess herre.', requires: ['boss7'], condition: { kind: 'levelReached', level: 40 }, rewards: {} },
  {
    id: 'boss8',
    text: 'Besegra Borgherre Skarpmark och öppna bron.',
    requires: ['lvl40'],
    condition: { kind: 'bossDefeated', index: 8 },
    rewards: { soldiers: 2, unlocks: ['region:2', 'key:skarpmark'] },
  },
];
