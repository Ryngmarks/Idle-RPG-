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
}

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
  boss: FieldBoss | null;
}
