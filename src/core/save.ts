// Versioned save format. Migrations run in order from the save's version to SAVE_VERSION.

import { SAVE_VERSION } from './state';
import type { GameState } from './types';

/** migrations[n] upgrades a save from version n to n + 1. */
const migrations: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {
  // v1 → v2: troops get wounds/engagedSize; combat gets unlockedStage (combat with life, M4).
  1: (s) => {
    const troops = (s.troops as Record<string, unknown>[]).map((t) => ({ ...t, wounds: 0, engagedSize: t.size }));
    const combat = s.combat as Record<string, unknown>;
    return { ...s, troops, combat: { ...combat, unlockedStage: combat.stageIndex } };
  },
  // v2 → v3: real weapons replace the ×1.4 "gear tier" placeholder (M5). Troops that had iron
  // weapons keep them as T1 Normal swords/cleavers for every soldier; everyone gets an armoury.
  2: (s) => {
    const weaponFor: Record<string, string> = { humans: 'sword', orcs: 'cleaver', dwarves: 'axe', elves: 'bow' };
    const weaponTypeId = weaponFor[s.raceId as string] ?? 'sword';
    const troops = (s.troops as Record<string, unknown>[]).map(({ gearTier, ...t }) => ({
      ...t,
      weaponTypeId,
      equipment: (gearTier as number) > 0 ? [{ tier: 1, quality: 'normal', count: t.size as number }] : [],
    }));
    const stats = s.stats as Record<string, unknown>;
    const unlocks = (s.unlocks as string[]).filter((u) => u !== 'gear:1');
    if ((s.buildings as Record<string, number>).forge) unlocks.push('crafting', 'tier:1', 'tab:forge');
    return {
      ...s,
      troops,
      unlocks,
      armoury: {},
      crafting: { queue: [], progress: 0, crafted: {}, carry: {} },
      stats: { ...stats, weaponsCrafted: 0 },
    };
  },
  // v3 → v4: troops do the smithing (M6). A built forge now unlocks the smithing activity.
  3: (s) => {
    const unlocks = [...(s.unlocks as string[])];
    if ((s.buildings as Record<string, number>).forge && !unlocks.includes('activity:smithing')) unlocks.push('activity:smithing');
    return { ...s, unlocks };
  },
  // v4 → v5: troops can arm themselves from the armoury (M7); on for every troop.
  4: (s) => ({ ...s, troops: (s.troops as Record<string, unknown>[]).map((t) => ({ ...t, autoEquip: true })) }),
};

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): GameState {
  let data = JSON.parse(json) as Record<string, unknown>;
  let version = typeof data.version === 'number' ? data.version : NaN;
  if (!Number.isInteger(version) || version < 1) throw new Error('Invalid save: missing version');
  if (version > SAVE_VERSION) throw new Error(`Save is from a newer version (${version} > ${SAVE_VERSION})`);
  while (version < SAVE_VERSION) {
    const migrate = migrations[version];
    if (!migrate) throw new Error(`No migration from save version ${version}`);
    data = migrate(data);
    version++;
    data.version = version;
  }
  return data as unknown as GameState;
}
