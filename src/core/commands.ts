// Player actions. Every state change made by the player goes through dispatch().
// See docs/ARCHITECTURE.md §6.

import { canAfford, hasUnlock, pay } from './mutations';
import { evaluateObjectives } from './objectives';
import { cloneState } from './state';
import { recruitFoodCost, resolveStat, soldierFoodCost } from './formulas';
import { currentCap, enemy, globalModifiers, race, zone } from './stats';
import type { ActivityKind, Content, Cost, GameEvent, GameState } from './types';

export type Command =
  | { type: 'assignTroop'; troopId: string; activity: ActivityKind | null }
  | { type: 'recruit'; troopId: string; count: number }
  | { type: 'upgradeGear'; troopId: string }
  | { type: 'startConstruction'; buildingId: string }
  | { type: 'buyUpgrade'; upgradeId: string }
  | { type: 'challengeBoss' }
  | { type: 'selectStage'; stageIndex: number }
  | { type: 'renameTroop'; troopId: string; name: string };

export type CommandResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: string };

const fail = (error: string): CommandResult => ({ ok: false, error });

export function recruitCost(state: GameState, troopId: string, count: number, content: Content): Cost {
  const troop = state.troops.find((t) => t.id === troopId);
  const r = race(state, content);
  const base = resolveStat(r.population.foodPerSoldier, 'foodPerSoldier', globalModifiers(state, content));
  const food = recruitFoodCost(base, troop?.size ?? 0, count, r.population.recruitScaleSize, content.constants.recruitExponent);
  const ore = content.gearTiers[troop?.gearTier ?? 0]?.orePerSoldier ?? 0;
  const cost: Cost = { food };
  if (ore > 0) cost.ore = count * ore;
  return cost;
}

/** Largest number of soldiers the player can recruit into a troop right now. */
export function maxRecruitable(state: GameState, troopId: string, content: Content): number {
  const troop = state.troops.find((t) => t.id === troopId);
  if (!troop) return 0;
  const room = Math.max(0, currentCap(state, content) - troop.size);
  const r = race(state, content);
  const base = resolveStat(r.population.foodPerSoldier, 'foodPerSoldier', globalModifiers(state, content));
  const orePer = content.gearTiers[troop.gearTier]?.orePerSoldier ?? 0;
  let n = 0;
  let food = 0;
  while (n < room) {
    food += soldierFoodCost(base, troop.size + n, r.population.recruitScaleSize, content.constants.recruitExponent);
    if (food > state.resources.food + 1e-9 || (n + 1) * orePer > state.resources.ore + 1e-9) break;
    n++;
  }
  return n;
}

export function gearUpgradeCost(state: GameState, troopId: string, content: Content): Cost | null {
  const troop = state.troops.find((t) => t.id === troopId);
  const next = troop ? content.gearTiers[troop.gearTier + 1] : undefined;
  if (!troop || !next) return null;
  return { ore: troop.size * next.orePerSoldier };
}

export function dispatch(input: GameState, cmd: Command, content: Content): CommandResult {
  const state = cloneState(input);
  const events: GameEvent[] = [];

  switch (cmd.type) {
    case 'assignTroop': {
      const troop = state.troops.find((t) => t.id === cmd.troopId);
      if (!troop) return fail('Unknown troop');
      if (cmd.activity && !hasUnlock(state, `activity:${cmd.activity}`)) return fail(`Activity ${cmd.activity} is locked`);
      if (cmd.activity === 'combat' && troop.activity !== 'combat') troop.engagedSize = troop.size;
      troop.activity = cmd.activity;
      break;
    }
    case 'recruit': {
      const troop = state.troops.find((t) => t.id === cmd.troopId);
      if (!troop) return fail('Unknown troop');
      if (!hasUnlock(state, 'recruit')) return fail('Recruitment is locked');
      if (!Number.isInteger(cmd.count) || cmd.count <= 0) return fail('Count must be a positive integer');
      if (troop.size + cmd.count > currentCap(state, content)) return fail('Troop is at its cap');
      const cost = recruitCost(state, troop.id, cmd.count, content);
      if (!canAfford(state, cost)) return fail('Not enough resources');
      pay(state, cost);
      troop.size += cmd.count;
      if (troop.activity === 'combat') troop.engagedSize += cmd.count;
      state.stats.recruited += cmd.count;
      break;
    }
    case 'upgradeGear': {
      const troop = state.troops.find((t) => t.id === cmd.troopId);
      if (!troop) return fail('Unknown troop');
      const cost = gearUpgradeCost(state, troop.id, content);
      if (!cost) return fail('No higher gear tier');
      if (!hasUnlock(state, `gear:${troop.gearTier + 1}`)) return fail('Gear tier is locked');
      if (!canAfford(state, cost)) return fail('Not enough ore');
      pay(state, cost);
      troop.gearTier++;
      break;
    }
    case 'startConstruction': {
      if (state.construction) return fail('Another building is under construction');
      const def = content.buildings[cmd.buildingId];
      if (!def) return fail('Unknown building');
      if (!hasUnlock(state, `building:${def.id}`)) return fail('Building is locked');
      const level = (state.buildings[def.id] ?? 0) + 1;
      const levelDef = def.levels[level - 1];
      if (!levelDef) return fail('Building is at max level');
      if (!canAfford(state, levelDef.cost)) return fail('Not enough resources');
      pay(state, levelDef.cost);
      state.construction = { buildingId: def.id, level, progress: 0 };
      break;
    }
    case 'buyUpgrade': {
      const def = content.upgrades[cmd.upgradeId];
      if (!def) return fail('Unknown upgrade');
      if (!hasUnlock(state, `upgrade:${def.id}`)) return fail('Upgrade is locked');
      if ((state.upgrades[def.id] ?? 0) > 0) return fail('Already bought');
      if (!canAfford(state, def.cost)) return fail('Not enough resources');
      pay(state, def.cost);
      state.upgrades[def.id] = 1;
      break;
    }
    case 'challengeBoss': {
      const c = state.combat;
      if (!hasUnlock(state, 'boss')) return fail('Boss is locked');
      if (c.boss) return fail('Boss fight already in progress');
      if (c.bossDefeated) return fail('Boss already defeated');
      const b = enemy(zone(state, content).boss.enemyId, content);
      c.boss = { hpLeft: b.hp, timeLeft: zone(state, content).boss.timeLimitSec };
      for (const t of state.troops) if (t.activity === 'combat') t.engagedSize = t.size;
      break;
    }
    case 'selectStage': {
      const c = state.combat;
      if (c.boss) return fail('Cannot change stage during a boss fight');
      if (!Number.isInteger(cmd.stageIndex) || cmd.stageIndex < 0 || cmd.stageIndex > c.unlockedStage) return fail('Stage is locked');
      c.stageIndex = cmd.stageIndex;
      break;
    }
    case 'renameTroop': {
      const troop = state.troops.find((t) => t.id === cmd.troopId);
      if (!troop) return fail('Unknown troop');
      const name = cmd.name.trim();
      if (name.length === 0 || name.length > 32) return fail('Name must be 1–32 characters');
      troop.name = name;
      break;
    }
  }

  evaluateObjectives(state, content, events);
  return { ok: true, state, events };
}
