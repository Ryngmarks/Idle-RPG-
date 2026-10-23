// Player actions. Every state change made by the player goes through dispatch().
// See docs/ARCHITECTURE.md §6.

import { equipBest, unequipAll } from './equipment';
import { canAfford, gain, hasUnlock, pay } from './mutations';
import { evaluateObjectives } from './objectives';
import { cloneState } from './state';
import { recruitFoodCost, resolveStat, soldierFoodCost } from './formulas';
import { currentCap, enemy, globalModifiers, race, zone } from './stats';
import type { ActivityKind, Content, Cost, GameEvent, GameState } from './types';

export type Command =
  | { type: 'assignTroop'; troopId: string; activity: ActivityKind | null }
  | { type: 'recruit'; troopId: string; count: number }
  | { type: 'queueCraft'; recipeId: string; count: number }
  | { type: 'cancelCraft'; index: number }
  | { type: 'equipTroop'; troopId: string }
  | { type: 'unequipTroop'; troopId: string }
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
  return { food };
}

/** Largest number of soldiers the player can recruit into a troop right now. */
export function maxRecruitable(state: GameState, troopId: string, content: Content): number {
  const troop = state.troops.find((t) => t.id === troopId);
  if (!troop) return 0;
  const room = Math.max(0, currentCap(state, content) - troop.size);
  const r = race(state, content);
  const base = resolveStat(r.population.foodPerSoldier, 'foodPerSoldier', globalModifiers(state, content));
  let n = 0;
  let food = 0;
  while (n < room) {
    food += soldierFoodCost(base, troop.size + n, r.population.recruitScaleSize, content.constants.recruitExponent);
    if (food > state.resources.food + 1e-9) break;
    n++;
  }
  return n;
}

/** Materials for `count` weapons of a recipe. */
export function craftCost(recipeId: string, count: number, content: Content): Cost {
  const recipe = content.equipment.recipes[recipeId];
  const cost: Cost = {};
  for (const [res, v] of Object.entries(recipe?.materials ?? {}) as [keyof Cost, number][]) cost[res] = v * count;
  return cost;
}

/** Most weapons of a recipe the player can afford right now. */
export function maxCraftable(state: GameState, recipeId: string, content: Content): number {
  const recipe = content.equipment.recipes[recipeId];
  if (!recipe) return 0;
  let n = Infinity;
  for (const [res, v] of Object.entries(recipe.materials) as [keyof Cost, number][]) {
    if (v > 0) n = Math.min(n, Math.floor(state.resources[res] / v + 1e-9));
  }
  return Number.isFinite(n) ? n : 0;
}

/** A recipe can be crafted once crafting is unlocked and its tier is open (only T1 for now). */
export function recipeAvailable(state: GameState, recipeId: string, content: Content): boolean {
  const recipe = content.equipment.recipes[recipeId];
  return (
    !!recipe &&
    recipe.weaponTypeId === race(state, content).weaponTypeId &&
    hasUnlock(state, 'crafting') &&
    hasUnlock(state, `tier:${recipe.tier}`)
  );
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
    case 'queueCraft': {
      if (!recipeAvailable(state, cmd.recipeId, content)) return fail('Recipe is locked');
      if (!Number.isInteger(cmd.count) || cmd.count <= 0) return fail('Count must be a positive integer');
      const cost = craftCost(cmd.recipeId, cmd.count, content);
      if (!canAfford(state, cost)) return fail('Not enough materials');
      pay(state, cost);
      const last = state.crafting.queue[state.crafting.queue.length - 1];
      if (last && last.recipeId === cmd.recipeId) last.remaining += cmd.count;
      else state.crafting.queue.push({ recipeId: cmd.recipeId, remaining: cmd.count });
      break;
    }
    case 'cancelCraft': {
      const order = state.crafting.queue[cmd.index];
      if (!order) return fail('No such order');
      gain(state, craftCost(order.recipeId, order.remaining, content));
      state.crafting.queue.splice(cmd.index, 1);
      if (cmd.index === 0) state.crafting.progress = 0;
      break;
    }
    case 'equipTroop': {
      const troop = state.troops.find((t) => t.id === cmd.troopId);
      if (!troop) return fail('Unknown troop');
      equipBest(troop, state.armoury, content);
      break;
    }
    case 'unequipTroop': {
      const troop = state.troops.find((t) => t.id === cmd.troopId);
      if (!troop) return fail('Unknown troop');
      unequipAll(troop, state.armoury);
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
