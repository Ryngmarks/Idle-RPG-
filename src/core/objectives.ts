// Objectives: the tutorial, the unlock gates and the "what next?" list in one system.
// See docs/FIRST_15_MINUTES.md §4.

import { autoEquipAll } from './equipment';
import { addSoldiers, addUnlock, gain } from './mutations';
import type { Content, GameEvent, GameState, ObjectiveCondition, ObjectiveDef } from './types';

export function conditionMet(state: GameState, c: ObjectiveCondition): boolean {
  switch (c.kind) {
    case 'troopAssigned':
      return state.troops.some((t) => t.activity === c.activity);
    case 'troopsAssigned':
      return state.troops.filter((t) => t.activity !== null).length >= c.count;
    case 'totalGathered':
      return state.stats.gathered[c.resource] + 1e-9 >= c.amount;
    case 'kills':
      return state.stats.totalKills + 1e-9 >= c.amount;
    case 'recruited':
      return state.stats.recruited >= c.amount;
    case 'buildingLevel':
      return (state.buildings[c.buildingId] ?? 0) >= c.level;
    case 'upgradeBought':
      return (state.upgrades[c.upgradeId] ?? 0) > 0;
    case 'soldiersAtLeast':
      return state.troops.reduce((n, t) => n + t.size, 0) >= c.count;
    case 'stageReached':
      // stage is 1-based; reaching stage N means stages 1..N-1 are cleared.
      return state.combat.cleared || state.combat.unlockedStage + 1 >= c.stage;
    case 'zoneCleared':
      return state.combat.cleared;
    case 'bossDefeated':
      return state.combat.bossDefeated;
    case 'weaponsEquipped':
      return state.troops.reduce((n, t) => n + t.equipment.reduce((m, b) => m + b.count, 0), 0) >= c.amount;
    case 'weaponsCrafted':
      return state.stats.weaponsCrafted >= c.amount;
  }
}

/** Objectives whose requirements are complete but which are not yet completed. */
export function activeObjectives(state: GameState, content: Content): ObjectiveDef[] {
  const done = new Set(state.objectivesCompleted);
  return content.objectives.filter((o) => !done.has(o.id) && o.requires.every((r) => done.has(r)));
}

/** Completes every satisfied objective (repeatedly, since one can enable the next). */
export function evaluateObjectives(state: GameState, content: Content, events: GameEvent[]): void {
  for (;;) {
    const ready = activeObjectives(state, content).filter((o) => conditionMet(state, o.condition));
    if (ready.length === 0) return;
    for (const o of ready) {
      state.objectivesCompleted.push(o.id);
      for (const u of o.rewards.unlocks ?? []) addUnlock(state, u);
      if (o.rewards.resources) gain(state, o.rewards.resources);
      events.push({ type: 'objectiveCompleted', at: state.clock, objectiveId: o.id });
      if (o.rewards.troopSlots) state.troopSlots += o.rewards.troopSlots;
      if (o.rewards.soldiers) {
        const troop = addSoldiers(state, content, o.rewards.soldiers, events, state.troops[0]?.id);
        events.push({ type: 'soldiersJoined', at: state.clock, troopId: troop.id, count: o.rewards.soldiers });
        autoEquipAll(state, content);
      }
    }
  }
}
