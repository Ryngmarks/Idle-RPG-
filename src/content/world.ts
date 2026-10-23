// Start-area content for prototype P0 "The Farmstead Camp".
// See docs/ROADMAP.md §2 and docs/FIRST_15_MINUTES.md. Player-facing text is Swedish for now.

import type { BuildingDef, EnemyDef, GearTierDef, ObjectiveDef, UpgradeDef, ZoneDef } from '../core/types';

export const enemies: Record<string, EnemyDef> = {
  wildChicken: { id: 'wildChicken', name: 'Vild kyckling', hp: 15, armour: 0, attack: 0.12, xp: 2, loot: { food: 1 } },
  angryRooster: { id: 'angryRooster', name: 'Arg tupp', hp: 30, armour: 0, attack: 0.5, xp: 3, loot: { food: 1.5 } },
  ratSwarm: { id: 'ratSwarm', name: 'Råttsvärm', hp: 1, armour: 0, attack: 1.5, xp: 0.05, loot: { food: 0.01 } },
  wildBoar: { id: 'wildBoar', name: 'Vildsvin', hp: 150, armour: 2, attack: 4, xp: 10, loot: { food: 3, ore: 2 } },
  oldBoar: { id: 'oldBoar', name: 'Gammal galt', hp: 300, armour: 3, attack: 7, xp: 15, loot: { food: 4, ore: 3 } },
  oldTusker: { id: 'oldTusker', name: 'Gamle Betarn', hp: 7000, armour: 3, attack: 12, xp: 0, loot: {} },
};

export const zones: Record<string, ZoneDef> = {
  farmsteads: {
    id: 'farmsteads',
    name: 'Gårdarna',
    stages: [
      { enemyId: 'wildChicken', killsToClear: 15 },
      { enemyId: 'angryRooster', killsToClear: 25 },
      { enemyId: 'ratSwarm', killsToClear: 1500 },
      { enemyId: 'wildBoar', killsToClear: 30 },
      { enemyId: 'oldBoar', killsToClear: 40 },
    ],
    boss: { enemyId: 'oldTusker', timeLimitSec: 60 },
  },
};

export const buildings: Record<string, BuildingDef> = {
  trainingCamp: {
    id: 'trainingCamp',
    name: 'Träningsläger',
    levels: [{ cost: { wood: 40, stone: 20, food: 20 }, work: 400, effects: [{ kind: 'capLevel', level: 1 }, { kind: 'troopSlot' }] }],
  },
  barracks: {
    id: 'barracks',
    name: 'Baracker',
    levels: [
      { cost: { wood: 120, stone: 80, food: 40 }, work: 1500, effects: [{ kind: 'capLevel', level: 2 }] },
      { cost: { wood: 400, stone: 300, food: 100 }, work: 5000, effects: [{ kind: 'capLevel', level: 3 }] },
    ],
  },
  farm: {
    id: 'farm',
    name: 'Gård',
    levels: [
      {
        cost: { wood: 80, stone: 30, food: 20 },
        work: 800,
        effects: [{ kind: 'modifier', modifier: { stat: 'skill.food', op: 'mult', value: 0.5, source: 'building:farm' } }],
      },
    ],
  },
  forge: {
    id: 'forge',
    name: 'Smedja',
    levels: [{ cost: { wood: 150, stone: 150, ore: 20 }, work: 2500, effects: [{ kind: 'unlock', unlock: 'gear:1' }] }],
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
    cost: { wood: 40, stone: 20 },
    modifiers: [{ stat: 'skill.mining', op: 'mult', value: 0.5, source: 'upgrade:stonePicks' }],
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

export const gearTiers: GearTierDef[] = [
  { attackMult: 1, orePerSoldier: 0 },
  { attackMult: 1.4, orePerSoldier: 3 },
];

export const objectives: ObjectiveDef[] = [
  {
    id: 'sendWood',
    text: 'Din soldat väntar på order. Skicka den för att samla ved.',
    requires: [],
    condition: { kind: 'troopAssigned', activity: 'woodcutting' },
    rewards: {},
  },
  {
    id: 'wood30',
    text: 'Samla 15 ved.',
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
    rewards: { unlocks: ['recruit', 'activity:food', 'upgrade:drillPractice'] },
  },
  {
    id: 'recruit1',
    text: 'Rekrytera en soldat.',
    requires: ['kill5'],
    condition: { kind: 'recruited', amount: 1 },
    rewards: {
      unlocks: ['activity:mining', 'activity:construction', 'tab:settlement', 'building:trainingCamp'],
    },
  },
  {
    id: 'stone20',
    text: 'Bryt 20 sten.',
    requires: ['recruit1'],
    condition: { kind: 'totalGathered', resource: 'stone', amount: 20 },
    rewards: { unlocks: ['upgrade:stonePicks'] },
  },
  {
    id: 'food10',
    text: 'Producera mat på fälten.',
    requires: ['kill5'],
    condition: { kind: 'totalGathered', resource: 'food', amount: 10 },
    rewards: { unlocks: ['upgrade:fieldKitchens'] },
  },
  {
    id: 'trainingCamp',
    text: 'Bygg ett träningsläger.',
    requires: ['recruit1'],
    condition: { kind: 'buildingLevel', buildingId: 'trainingCamp', level: 1 },
    rewards: {},
  },
  {
    id: 'twoTroops',
    text: 'Ge din nya trupp order.',
    requires: ['trainingCamp'],
    condition: { kind: 'troopsAssigned', count: 2 },
    rewards: { unlocks: ['building:barracks', 'building:farm', 'upgrade:carpentry'] },
  },
  {
    id: 'stage3',
    text: 'Rensa gården: klara steg 2 av 5.',
    requires: ['twoTroops'],
    condition: { kind: 'stageReached', stage: 3 },
    rewards: { resources: { food: 20 } },
  },
  {
    id: 'size15',
    text: 'Låt en trupp växa till 15 soldater.',
    requires: ['twoTroops'],
    condition: { kind: 'troopSizeAtLeast', size: 15 },
    rewards: { resources: { wood: 30 } },
  },
  {
    id: 'barracks1',
    text: 'Bygg baracker.',
    requires: ['twoTroops'],
    condition: { kind: 'buildingLevel', buildingId: 'barracks', level: 1 },
    rewards: { unlocks: ['building:forge'] },
  },
  {
    id: 'forge',
    text: 'Bygg en smedja.',
    requires: ['barracks1'],
    condition: { kind: 'buildingLevel', buildingId: 'forge', level: 1 },
    rewards: {},
  },
  {
    id: 'gear1',
    text: 'Utrusta en trupp med järnvapen.',
    requires: ['forge'],
    condition: { kind: 'gearTier', tier: 1 },
    rewards: {},
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
    text: 'Besegra Gamle Betarn.',
    requires: ['zoneCleared'],
    condition: { kind: 'bossDefeated' },
    rewards: { unlocks: ['region:2'] },
  },
];
