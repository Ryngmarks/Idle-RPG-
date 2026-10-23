// Core types: static content definitions and the serialisable game state.
// The core never imports UI, DOM or time APIs; see docs/ARCHITECTURE.md.

export type ActivityKind = 'combat' | 'mining' | 'woodcutting' | 'food' | 'construction';
export type LabourActivity = Exclude<ActivityKind, 'combat'>;
export type ResourceId = 'food' | 'wood' | 'stone' | 'ore';
export type Resources = Record<ResourceId, number>;
export type Cost = Partial<Resources>;

export const ACTIVITIES: readonly ActivityKind[] = ['combat', 'mining', 'woodcutting', 'food', 'construction'];
export const RESOURCES: readonly ResourceId[] = ['food', 'wood', 'stone', 'ore'];

// ---------------------------------------------------------------- modifiers

export type Stat =
  | 'attack'
  | 'work'
  | 'armourPen'
  | 'skill.mining'
  | 'skill.woodcutting'
  | 'skill.food'
  | 'skill.construction'
  | 'foodPerSoldier'
  | 'loot.food'
  | 'loot.ore';

export interface Modifier {
  stat: Stat;
  op: 'add' | 'mult';
  value: number;
  /** For tooltips and debugging, e.g. 'upgrade:sharpenedAxes'. */
  source: string;
}

// ---------------------------------------------------------------- content

export type TraitId = 'horde' | 'raiders' | 'deepDelvers' | 'adaptable';

export interface RaceDef {
  id: string;
  name: string;
  /** Shown in the race picker but not selectable when false (Dwarves/Elves in P0). */
  playable: boolean;
  population: {
    maxTroopSize: number;
    startSize: number;
    /** Soldiers a newly formed troop starts with (e.g. Troop 2 from the Training Camp). */
    newTroopSize: number;
    foodPerSoldier: number;
  };
  soldier: {
    attack: number;
    work: number;
    armourPen: number;
    skills: Record<LabourActivity, number>;
  };
  modifiers: Modifier[];
  traits: TraitId[];
  /** Default name for troop N (1-based). */
  troopNames: string[];
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  armour: number;
  xp: number;
  loot: Cost;
}

export interface ZoneDef {
  id: string;
  name: string;
  stages: { enemyId: string; killsToClear: number }[];
  boss: { enemyId: string; timeLimitSec: number };
}

export type Unlock = string; // 'activity:mining', 'tab:upgrades', 'upgrade:x', 'building:x', 'recruit', 'gear:1', 'boss', ...

export type Effect =
  | { kind: 'capLevel'; level: number }
  | { kind: 'modifier'; modifier: Modifier }
  | { kind: 'unlock'; unlock: Unlock }
  | { kind: 'troopSlot' };

export interface BuildingLevelDef {
  cost: Cost;
  work: number;
  effects: Effect[];
}

export interface BuildingDef {
  id: string;
  name: string;
  levels: BuildingLevelDef[];
}

export interface UpgradeDef {
  id: string;
  name: string;
  cost: Cost;
  modifiers: Modifier[];
}

export interface GearTierDef {
  attackMult: number;
  orePerSoldier: number;
}

export type ObjectiveCondition =
  | { kind: 'troopAssigned'; activity: ActivityKind }
  | { kind: 'troopsAssigned'; count: number }
  | { kind: 'totalGathered'; resource: ResourceId; amount: number }
  | { kind: 'kills'; amount: number }
  | { kind: 'recruited'; amount: number }
  | { kind: 'buildingLevel'; buildingId: string; level: number }
  | { kind: 'upgradeBought'; upgradeId: string }
  | { kind: 'troopSizeAtLeast'; size: number }
  | { kind: 'stageReached'; stage: number }
  | { kind: 'zoneCleared' }
  | { kind: 'bossDefeated' }
  | { kind: 'gearTier'; tier: number };

export interface ObjectiveDef {
  id: string;
  text: string;
  requires: string[];
  condition: ObjectiveCondition;
  rewards: { unlocks?: Unlock[]; resources?: Cost };
}

export interface Content {
  races: Record<string, RaceDef>;
  enemies: Record<string, EnemyDef>;
  zones: Record<string, ZoneDef>;
  buildings: Record<string, BuildingDef>;
  upgrades: Record<string, UpgradeDef>;
  gearTiers: GearTierDef[];
  objectives: ObjectiveDef[];
  constants: {
    /** Recruit cost per soldier = foodPerSoldier × (size / startSize)^recruitExponent. */
    recruitExponent: number;
    /** Fraction of the race's max troop size per cap level. */
    capLevelFractions: number[];
    /** Resource per second per (work × skill). */
    gatherRate: number;
    /** Attacks per second per soldier. */
    attacksPerSecond: number;
    /** Share of mining output that becomes ore (rest is stone). */
    miningOreShare: number;
    /** XP needed to reach level L is xpBase × (L−1)^xpExponent. */
    xpBase: number;
    xpExponent: number;
    levelBonus: number;
    startZoneId: string;
    startUnlocks: Unlock[];
  };
}

// ---------------------------------------------------------------- state

export interface TroopState {
  id: string;
  name: string;
  size: number;
  xp: number;
  gearTier: number;
  activity: ActivityKind | null;
}

export interface BossFight {
  hpLeft: number;
  timeLeft: number;
}

export interface GameState {
  version: number;
  raceId: string;
  /** Simulated seconds since the game started. */
  clock: number;
  resources: Resources;
  troops: TroopState[];
  buildings: Record<string, number>;
  construction: { buildingId: string; level: number; progress: number } | null;
  upgrades: Record<string, number>;
  combat: {
    zoneId: string;
    stageIndex: number;
    kills: number;
    cleared: boolean;
    bossDefeated: boolean;
    boss: BossFight | null;
  };
  unlocks: Unlock[];
  objectivesCompleted: string[];
  stats: {
    totalKills: number;
    recruited: number;
    gathered: Resources;
  };
}

export type GameEvent =
  | { type: 'stageCleared'; at: number; zoneId: string; stage: number }
  | { type: 'zoneCleared'; at: number; zoneId: string }
  | { type: 'constructionCompleted'; at: number; buildingId: string; level: number }
  | { type: 'troopFormed'; at: number; troopId: string }
  | { type: 'troopLevelUp'; at: number; troopId: string; level: number }
  | { type: 'bossDefeated'; at: number; zoneId: string }
  | { type: 'bossFailed'; at: number; zoneId: string }
  | { type: 'objectiveCompleted'; at: number; objectiveId: string };
