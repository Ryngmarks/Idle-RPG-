// Creating and copying game state.

import { evaluateObjectives } from './objectives';
import { QUALITY_IDS, type Content, type GameEvent, type GameState, type QualityId } from './types';

export const SAVE_VERSION = 8;

/** State is plain JSON, so a JSON round-trip is a correct deep copy. */
export function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

export function newGame(raceId: string, content: Content): GameState {
  const race = content.races[raceId];
  if (!race) throw new Error(`Unknown race ${raceId}`);
  if (!race.playable) throw new Error(`Race ${raceId} is not playable yet`);
  const state: GameState = {
    version: SAVE_VERSION,
    raceId,
    clock: 0,
    resources: { food: 0, wood: 0, stone: 0, ore: 0 },
    troops: [
      {
        id: 'troop1',
        name: race.troopNames[0] ?? 'Troop 1',
        size: race.population.startSize,
        xp: 0,
        weaponTypeId: race.weaponTypeId,
        equipment: [],
        activity: null,
        wounds: 0,
        engagedSize: race.population.startSize,
        autoEquip: true,
        siteId: null,
      },
    ],
    troopSlots: 1,
    training: null,
    siteProgress: {},
    buildings: {},
    construction: null,
    upgrades: {},
    combat: { zoneId: content.constants.startZoneId, stageIndex: 0, unlockedStage: 0, kills: 0, cleared: false, bossDefeated: false, boss: null },
    armoury: {},
    crafting: { queue: [], progress: 0, crafted: {}, carry: {} },
    unlocks: [...content.constants.startUnlocks],
    objectivesCompleted: [],
    stats: { totalKills: 0, recruited: 0, gathered: { food: 0, wood: 0, stone: 0, ore: 0 }, weaponsCrafted: 0, weaponsByQuality: emptyQualityCounts(), soldiersLost: 0, bossDefeatedAt: null },
  };
  const events: GameEvent[] = [];
  evaluateObjectives(state, content, events);
  return state;
}

export function emptyQualityCounts(): Record<QualityId, number> {
  return Object.fromEntries(QUALITY_IDS.map((q) => [q, 0])) as Record<QualityId, number>;
}
