// Start-area content for prototype P0 "The Farmstead Camp".
// See docs/ROADMAP.md §2 and docs/FIRST_15_MINUTES.md. Player-facing text is Swedish for now.

import type { BuildingDef, EnemyDef, EquipmentContent, ObjectiveDef, UpgradeDef, WorkSiteDef, ZoneDef } from '../core/types';

// Combat is tuned for a handful of soldiers (docs/PROGRESSION_V2.md §8.3).
export const enemies: Record<string, EnemyDef> = {
  wildChicken: { id: 'wildChicken', name: 'Vild kyckling', hp: 12, armour: 0, attack: 0.12, xp: 3, loot: { food: 1 } },
  angryRooster: { id: 'angryRooster', name: 'Arg tupp', hp: 25, armour: 0, attack: 0.4, xp: 5, loot: { food: 1 } },
  fox: { id: 'fox', name: 'Räv', hp: 45, armour: 1, attack: 0.7, xp: 8, loot: { food: 1.5, ore: 0.5 } },
  wildBoar: { id: 'wildBoar', name: 'Vildsvin', hp: 80, armour: 2, attack: 0.9, xp: 12, loot: { food: 2, ore: 1.5 } },
  oldBoar: { id: 'oldBoar', name: 'Gammal galt', hp: 130, armour: 3, attack: 1.1, xp: 18, loot: { food: 3, ore: 2.5 } },
  oldTusker: { id: 'oldTusker', name: 'Gamle Betarn', hp: 500, armour: 3, attack: 1.2, xp: 0, loot: {} },
};

export const zones: Record<string, ZoneDef> = {
  farmsteads: {
    id: 'farmsteads',
    name: 'Gårdarna',
    sites: ['birchGrove', 'oldQuarry', 'oreVein', 'berryThickets', 'fields'],
    stages: [
      { enemyId: 'wildChicken', killsToClear: 12 },
      { enemyId: 'angryRooster', killsToClear: 12 },
      { enemyId: 'fox', killsToClear: 12 },
      { enemyId: 'wildBoar', killsToClear: 12 },
      { enemyId: 'oldBoar', killsToClear: 8 },
    ],
    boss: { enemyId: 'oldTusker', timeLimitSec: 90 },
  },
};

/** Work sites: one cycle per working soldier every cycleSec / (work × skill); `capacity` soldiers at once. */
export const sites: Record<string, WorkSiteDef> = {
  birchGrove: { id: 'birchGrove', name: 'Björkdungen', activity: 'woodcutting', capacity: 3, cycleSec: 30, yield: { wood: 5 } },
  oldQuarry: { id: 'oldQuarry', name: 'Gamla stenbrottet', activity: 'mining', capacity: 2, cycleSec: 40, yield: { stone: 4 } },
  oreVein: { id: 'oreVein', name: 'Malmådern', activity: 'mining', capacity: 1, cycleSec: 60, yield: { ore: 2 } },
  berryThickets: { id: 'berryThickets', name: 'Bärsnåren', activity: 'food', capacity: 2, cycleSec: 20, yield: { food: 2 } },
  fields: { id: 'fields', name: 'Åkrarna', activity: 'food', capacity: 3, cycleSec: 60, yield: { food: 9 }, unlock: 'site:fields' },
};

// Construction work: one soldier with work 1 and skill 1 does 1 work per second (a 30 s work moment = 30).
export const buildings: Record<string, BuildingDef> = {
  tents: {
    id: 'tents',
    name: 'Tält',
    levels: [
      { cost: { wood: 25, stone: 10 }, work: 60, effects: [{ kind: 'beds', amount: 1 }] },
      { cost: { wood: 45, stone: 25 }, work: 90, effects: [{ kind: 'beds', amount: 1 }] },
      { cost: { wood: 80, stone: 50 }, work: 120, effects: [{ kind: 'beds', amount: 1 }] },
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
    ],
  },
  woodshed: {
    id: 'woodshed',
    name: 'Vedskjul',
    levels: [{ cost: { wood: 50, stone: 20 }, work: 120, effects: [{ kind: 'capacity', target: 'birchGrove', amount: 1 }] }],
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
    ],
  },
  barracks: {
    id: 'barracks',
    name: 'Baracker',
    levels: [
      { cost: { wood: 120, stone: 80, food: 40 }, work: 600, effects: [{ kind: 'beds', amount: 3 }] },
      { cost: { wood: 400, stone: 300, food: 100 }, work: 1500, effects: [{ kind: 'beds', amount: 5 }] },
    ],
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
    rewards: { troopSlots: 1, soldiers: 2, unlocks: ['region:2', 'building:barracks'] },
  },
];
