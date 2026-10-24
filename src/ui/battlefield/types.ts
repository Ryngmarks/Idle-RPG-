// Plain data the scene reads each frame. Built from core state by snapshot.ts; the scene never touches the store.

export interface FieldTroop {
  id: string;
  name: string;
  size: number;
  /** 0..1 share of the troop's max HP that is currently wounded. */
  wound: number;
  level: number;
  /** Damage per second this troop deals to the current foe (derived from the real kill rate / boss dps). */
  dps: number;
  /** Quality colour of the troop's best weapon, if any. */
  blade: string;
  weaponId: string;
  /** Damage per second the current foe deals to this troop (before healing); drives the rhythm of enemy blows. */
  incoming: number;
  /** Net wounds per second: positive = this troop is actually losing health, negative = healing. */
  wounding: number;
}

/** What a tap on the canvas hit. */
export type FieldPick = { kind: 'troop'; id: string } | { kind: 'enemy' };

export interface FieldBoss {
  hpLeft: number;
  hp: number;
  timeLeft: number;
  limit: number;
}

export interface FieldSnap {
  raceId: string;
  band: number;
  level: number;
  /** Troops that are in combat (the only ones on the field). */
  troops: FieldTroop[];
  /** Troops busy with other work. */
  working: number;
  enemyId: string;
  enemyName: string;
  enemyHp: number;
  loot: string[];
  killsPerSec: number;
  totalKills: number;
  /** Strikes per soldier per second. */
  aps: number;
  bossDps: number;
  /** Damage per second the foe deals to the whole fighting group, and the foe's HP-per-soldier reference for pacing. */
  incoming: number;
  hpPerSoldier: number;
  boss: FieldBoss | null;
}
