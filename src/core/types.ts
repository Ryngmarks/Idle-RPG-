// Core types: static content definitions and the serialisable game state.
// The core never imports UI, DOM or time APIs; see docs/ARCHITECTURE.md.

export type ActivityKind = 'combat' | 'mining' | 'woodcutting' | 'food' | 'construction' | 'smithing';
export type LabourActivity = Exclude<ActivityKind, 'combat'>;
export type ResourceId = 'food' | 'wood' | 'stone' | 'ore' | 'iron';
export type Resources = Record<ResourceId, number>;
export type Cost = Partial<Resources>;

export const ACTIVITIES: readonly ActivityKind[] = ['combat', 'mining', 'woodcutting', 'food', 'construction', 'smithing'];
export const RESOURCES: readonly ResourceId[] = ['food', 'wood', 'stone', 'ore', 'iron'];

/** Weapon quality, worst to best. See docs/EQUIPMENT_AND_CRAFTING.md. */
export type QualityId = 'normal' | 'good' | 'outstanding' | 'excellent' | 'masterpiece';
export const QUALITY_IDS: readonly QualityId[] = ['normal', 'good', 'outstanding', 'excellent', 'masterpiece'];

// ---------------------------------------------------------------- modifiers

export type Stat =
  | 'attack'
  | 'work'
  | 'armourPen'
  | 'skill.mining'
  | 'skill.woodcutting'
  | 'skill.food'
  | 'skill.construction'
  | 'skill.smithing'
  | 'loot.food'
  | 'loot.ore'
  | 'hp'
  | 'regen';

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
    /** Hard ceiling for one troop group (long term). */
    maxTroopSize: number;
    startSize: number;
    /** Beds in the starting camp; soldiers can only be trained into a free bed. */
    startBeds: number;
    /** Multiplies the beds every building gives (Orcs pile into tents). */
    bedMult: number;
    /** Food and seconds to train the next soldier when the army has two; both grow per soldier. */
    trainFood: number;
    trainSec: number;
    /** Food per minute each soldier eats, except the first one of the whole army (docs/PROGRESSION_V2.md §17). */
    upkeep: number;
  };
  soldier: {
    attack: number;
    work: number;
    armourPen: number;
    /** Hit points per soldier. Damage beyond a soldier's HP kills one soldier. */
    hp: number;
    /** HP healed per second per soldier (in and out of combat). */
    regen: number;
    skills: Record<LabourActivity, number>;
  };
  modifiers: Modifier[];
  traits: TraitId[];
  /** Numbers behind the traits (docs/PROGRESSION_V2.md §18.1). A trait without parameters has no troop-size effect. */
  traitParams?: {
    /** Attack +perSoldier per soldier beyond the first in one troop, capped at `cap`. */
    horde?: { perSoldier: number; cap: number };
    /** Troops of `maxSize` or fewer get `bonus` more food and construction skill. */
    adaptable?: { maxSize: number; bonus: number };
  };
  /** Swedish trait descriptions shown to the player. */
  traitTexts?: Partial<Record<TraitId, string>>;
  /** Every troop of this race uses this weapon type (D-26). */
  weaponTypeId: string;
  /** Default name for troop N (1-based). */
  troopNames: string[];
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  armour: number;
  /** Damage per second dealt to the player's fighting troops while they fight this enemy. */
  attack: number;
  xp: number;
  loot: Cost;
}

/**
 * A place where soldiers gather: each working soldier completes one cycle every `cycleSec`
 * (divided by work × skill) and the reward arrives when the cycle completes. At most
 * `capacity` soldiers can work it at once, across all troop groups.
 */
export interface WorkSiteDef {
  id: string;
  name: string;
  activity: 'woodcutting' | 'mining' | 'food';
  capacity: number;
  cycleSec: number;
  yield: Cost;
  /** Needed before troops can work here (e.g. 'site:fields' from the Farm). */
  unlock?: Unlock;
}

export interface ZoneDef {
  id: string;
  name: string;
  /** Work sites in this zone, in the order a troop picks them by default. */
  sites: string[];
  /** One stage per level (stage index = level - 1). */
  stages: { enemyId: string; killsToClear: number }[];
  /** Bosses in order; boss i stands at `level` (1-based, a multiple of 5) and opens the levels after it. */
  bosses: { level: number; enemyId: string; timeLimitSec: number }[];
  /** Names for groups of levels, for the level picker (1-based, inclusive). */
  bands?: { name: string; fromLevel: number; toLevel: number }[];
}

export type Unlock = string; // 'activity:mining', 'tab:upgrades', 'upgrade:x', 'building:x', 'recruit', 'gear:1', 'boss', ...

export type Effect =
  | { kind: 'beds'; amount: number }
  /** More room at a work site, or more builders/smiths ('construction' / 'smithing'). */
  | { kind: 'capacity'; target: string; amount: number }
  | { kind: 'modifier'; modifier: Modifier }
  | { kind: 'unlock'; unlock: Unlock }
  /** One more troop group may exist. */
  | { kind: 'troopSlot' };

export interface BuildingLevelDef {
  /** An unlock needed before this level can be started (e.g. 'level:tents:4'); none = open once the building is. */
  requires?: Unlock;
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

export interface WeaponTypeDef {
  id: string;
  name: string;
  /** Name of one soldier using it, e.g. "svärdskrigare". */
  wielder: string;
}

export interface TierDef {
  tier: number;
  /** Attack multiplier of a Normal-quality weapon of this tier. */
  powerMult: number;
}

export interface QualityDef {
  id: QualityId;
  name: string;
  /** Multiplies the tier's power. Masterpiece of tier N ≈ Normal of tier N+1. */
  powerMult: number;
}

export interface RecipeDef {
  id: string;
  weaponTypeId: string;
  tier: number;
  /** Materials per weapon, paid when the order is placed. */
  materials: Cost;
  /** Forge work needed per weapon. */
  workPerItem: number;
  /** Mastery level needed in the same weapon type at the tier below (T2 needs T1 mastery 2). */
  requiresMastery?: { level: number };
}

export interface EquipmentContent {
  weaponTypes: Record<string, WeaponTypeDef>;
  /** T1–T8. Only tiers listed in state.unlocks as 'tier:N' can be crafted. */
  tiers: TierDef[];
  qualities: QualityDef[];
  recipes: Record<string, RecipeDef>;
  /** Attack multiplier for a soldier without a weapon (improvised arms). */
  unarmedMult: number;
  /** Quality chances [normal … masterpiece] at mastery level 0 and at maxMastery; linear in between. */
  chancesAtMin: number[];
  chancesAtMax: number[];
  maxMastery: number;
  /** Mastery level 0 below firstMasteryStep, then max(1, floor(sqrt(weaponsCrafted / itemsPerMasteryStep))). */
  itemsPerMasteryStep: number;
  /** Weapons crafted for mastery level 1 (levels 2+ follow L² × itemsPerMasteryStep). */
  firstMasteryStep: number;
}

export type ObjectiveCondition =
  | { kind: 'troopAssigned'; activity: ActivityKind }
  | { kind: 'troopsAssigned'; count: number }
  | { kind: 'totalGathered'; resource: ResourceId; amount: number }
  | { kind: 'kills'; amount: number }
  | { kind: 'recruited'; amount: number }
  | { kind: 'buildingLevel'; buildingId: string; level: number }
  | { kind: 'upgradeBought'; upgradeId: string }
  | { kind: 'soldiersAtLeast'; count: number }
  | { kind: 'stageReached'; stage: number }
  | { kind: 'zoneCleared' }
  /** Boss number `index` (1-based, default 1) has fallen. */
  | { kind: 'bossDefeated'; index?: number }
  /** The highest level the troops have reached (1-based) is at least `level`. */
  | { kind: 'levelReached'; level: number }
  /** At least one weapon of this tier has been crafted. */
  | { kind: 'tierCrafted'; tier: number }
  /** Some weapon type has this mastery level or more at tier 1. */
  | { kind: 'masteryReached'; level: number }
  | { kind: 'weaponsEquipped'; amount: number }
  | { kind: 'weaponsCrafted'; amount: number };

export interface ObjectiveDef {
  id: string;
  text: string;
  requires: string[];
  condition: ObjectiveCondition;
  rewards: {
    unlocks?: Unlock[];
    resources?: Cost;
    /** Soldiers who join (rescued); they fill an open group slot first. */
    soldiers?: number;
    /** Extra troop group slots. */
    troopSlots?: number;
    /** The biggest troop gains this many levels (an officer joins). */
    troopLevelSteps?: number;
  };
}

export interface Content {
  races: Record<string, RaceDef>;
  enemies: Record<string, EnemyDef>;
  zones: Record<string, ZoneDef>;
  buildings: Record<string, BuildingDef>;
  upgrades: Record<string, UpgradeDef>;
  equipment: EquipmentContent;
  objectives: ObjectiveDef[];
  sites: Record<string, WorkSiteDef>;
  constants: {
    /** Each further trained soldier costs this many times more food / training time. */
    trainFoodGrowth: number;
    trainTimeGrowth: number;
    /** From the army size `lateFrom` on, the cost grows by these gentler factors instead (docs/PROGRESSION_V2.md §19.5). */
    lateFrom: number;
    trainFoodGrowthLate: number;
    trainTimeGrowthLate: number;
    /** Builders per construction project and smiths per forge before buildings add more. */
    crews: { construction: number; smithing: number };
    /** XP a troop gets per finished work cycle; construction and smithing count `workMoment` work as one cycle. */
    workXp: number;
    workMoment: number;
    /** Attacks per second per soldier. */
    attacksPerSecond: number;
    /** Forge work per second per (work × smithing skill) of each smith at an anvil. */
    smithRate: number;
    /** XP needed to reach level L is xpBase × (L−1)^xpExponent. */
    xpBase: number;
    xpExponent: number;
    levelBonus: number;
    startZoneId: string;
    startUnlocks: Unlock[];
    /** The Feast (docs/PROGRESSION_V2.md §18.3). */
    feast: FeastConfig;
  };
}

export interface FeastConfig {
  cost: Cost;
  durationSec: number;
  /** Seconds from the start of one feast until the next may start. */
  cooldownSec: number;
  /** Multipliers on work speed (all work, food sites included) and attack while it lasts. */
  workMult: number;
  attackMult: number;
  /** Building that must be built before the feast is available. */
  requiresBuilding: string;
}

// ---------------------------------------------------------------- state

/** Aggregated equipment: `count` soldiers carry a weapon of this tier and quality. */
export interface EquipmentBucket {
  tier: number;
  quality: QualityId;
  count: number;
}

export interface TroopState {
  id: string;
  name: string;
  size: number;
  xp: number;
  weaponTypeId: string;
  /** Sorted best first. Invariant: Σ count ≤ size; the rest fight with improvised arms. */
  equipment: EquipmentBucket[];
  activity: ActivityKind | null;
  /** Damage taken but not yet healed (0 … hp per soldier). */
  wounds: number;
  /** Size when the troop last went into combat; it retreats after losing half of it. */
  engagedSize: number;
  /** Takes better weapons from the armoury by itself whenever they are there. */
  autoEquip: boolean;
  /** Work site for woodcutting, mining or food; null for other activities. */
  siteId: string | null;
}

export interface BossFight {
  /** 0-based index into the zone's `bosses`. */
  index: number;
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
  /** How many troop groups may exist (start 1; Training Camp, boss, …). */
  troopSlots: number;
  /** The recruit being trained at the Training Camp (one at a time). */
  training: { troopId: string; secLeft: number; totalSec: number } | null;
  /** Fractional work cycles in progress per work site; whole cycles pay out at once. */
  siteProgress: Record<string, number>;
  buildings: Record<string, number>;
  construction: { buildingId: string; level: number; progress: number } | null;
  upgrades: Record<string, number>;
  combat: {
    zoneId: string;
    /** The stage the combat troops are fighting (0-based); any stage up to unlockedStage. */
    stageIndex: number;
    /** Highest stage the player has reached; kills there count towards clearing it. */
    unlockedStage: number;
    kills: number;
    /** The boss level is cleared and the next boss is ready (or all bosses have fallen). */
    cleared: boolean;
    /** Bosses defeated in this zone (0 … zone.bosses.length). */
    bossesDefeated: number;
    /** Move the troops up to the next level after a clear, if it is safe. */
    autoAdvance: boolean;
    boss: BossFight | null;
  };
  /** Spare weapons, by item key `${weaponTypeId}:t${tier}:${quality}`. */
  armoury: Record<string, number>;
  crafting: {
    queue: { recipeId: string; remaining: number }[];
    /** Work done on the weapon currently being made. */
    progress: number;
    /** Weapons crafted per `${weaponTypeId}:t${tier}`; drives mastery. */
    crafted: Record<string, number>;
    /** Deterministic quality distribution carry per mastery key (see equipment.ts). */
    carry: Record<string, number[]>;
  };
  /** The Feast, in clock seconds: active while clock < until; may start again once clock >= readyAt. 0 = none. */
  feast: { until: number; readyAt: number };
  unlocks: Unlock[];
  objectivesCompleted: string[];
  stats: {
    totalKills: number;
    recruited: number;
    gathered: Resources;
    weaponsCrafted: number;
    /** Finished weapons per quality (counted from save v6; older weapons are only in the total). */
    weaponsByQuality: Record<QualityId, number>;
    soldiersLost: number;
    /** Game clock when boss i fell, or null; one entry per boss of the zone. */
    bossTimes: (number | null)[];
  };
}

export type GameEvent =
  | { type: 'stageCleared'; at: number; zoneId: string; stage: number }
  | { type: 'zoneCleared'; at: number; zoneId: string }
  | { type: 'constructionCompleted'; at: number; buildingId: string; level: number }
  | { type: 'troopFormed'; at: number; troopId: string }
  | { type: 'recruitTrained'; at: number; troopId: string }
  | { type: 'soldiersJoined'; at: number; troopId: string; count: number }
  | { type: 'troopLevelUp'; at: number; troopId: string; level: number }
  /** `index` is 0-based. */
  | { type: 'bossDefeated'; at: number; zoneId: string; index: number }
  /** Timer ran out or the fighting troops lost half their HP; nobody dies. The troops go back one level. */
  | { type: 'bossFailed'; at: number; zoneId: string; index: number; reason: 'time' | 'wounds' }
  /** The boss level is cleared: the next boss can be challenged. */
  | { type: 'bossReady'; at: number; zoneId: string; index: number }
  | { type: 'soldierLost'; at: number; troopId: string }
  | { type: 'troopRetreated'; at: number; troopId: string; reason: 'losses' | 'offlineSafety' }
  | { type: 'stageChanged'; at: number; stage: number; reason: 'offlineSafety' | 'autoAdvance' }
  | { type: 'bossAbandoned'; at: number; zoneId: string; index: number }
  | { type: 'weaponCrafted'; at: number; recipeId: string; quality: QualityId }
  | { type: 'craftOrderCompleted'; at: number; recipeId: string }
  | { type: 'levelStep'; at: number; troopId: string; level: 5 | 10 }
  | { type: 'masteryLevelUp'; at: number; weaponTypeId: string; tier: number; level: number }
  | { type: 'objectiveCompleted'; at: number; objectiveId: string }
  /** Hunger starts (food stock 0 and average income below upkeep) / ends. Only emitted on transitions. */
  | { type: 'foodEmpty'; at: number }
  | { type: 'foodRestored'; at: number }
  | { type: 'feastEnded'; at: number };
