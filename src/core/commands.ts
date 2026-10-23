// Player actions. Every state change made by the player goes through dispatch().
// See docs/ARCHITECTURE.md §6.

import { autoEquipAll, equipBest, masteryKey, masteryLevel, unequipAll } from './equipment';
import { canAfford, gain, hasUnlock, moveSoldiers, openTroopSlot, pay } from './mutations';
import { evaluateObjectives } from './objectives';
import { cloneState } from './state';
import { availableSites, computeRates, feastActive, freeBeds, nextBoss, race, soldierCount, zone } from './stats';
import type { ActivityKind, Content, Cost, GameEvent, GameState } from './types';


export type Command =
  /** `siteId` picks the work site for woodcutting, mining or food (default: the troop's or the first one). */
  | { type: 'assignTroop'; troopId: string; activity: ActivityKind | null; siteId?: string }
  /** Train one soldier at the Training Camp; they join `troopId` when ready. */
  | { type: 'trainRecruit'; troopId: string }
  /** Move soldiers between groups; `toTroopId` null forms a new group in an open slot. */
  | { type: 'transferSoldiers'; fromTroopId: string; toTroopId: string | null; count: number }
  | { type: 'queueCraft'; recipeId: string; count: number }
  | { type: 'cancelCraft'; index: number }
  | { type: 'equipTroop'; troopId: string }
  | { type: 'unequipTroop'; troopId: string }
  | { type: 'setAutoEquip'; troopId: string; on: boolean }
  | { type: 'startConstruction'; buildingId: string }
  | { type: 'buyUpgrade'; upgradeId: string }
  /** Throw a Feast: temporary work and attack bonus (docs/PROGRESSION_V2.md §18.3). */
  | { type: 'startFeast' }
  | { type: 'challengeBoss' }
  | { type: 'selectStage'; stageIndex: number }
  /** Turn auto-advance (move up to the next level after a clear when it is safe) on or off. */
  | { type: 'setAutoAdvance'; on: boolean }
  | { type: 'renameTroop'; troopId: string; name: string };

export type CommandResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: string };

const fail = (error: string): CommandResult => ({ ok: false, error });

/** Food and training time for the next soldier. Both grow with every soldier the army has (D-45). */
export function trainCost(state: GameState, content: Content): { food: number; sec: number } {
  const p = race(state, content).population;
  const c = content.constants;
  const n = soldierCount(state) + (state.training ? 1 : 0);
  if (n > c.lateFrom) {
    // Gentler tail after soldier 8 (docs/PROGRESSION_V2.md §19.5): continues from the cost at `lateFrom`.
    const k = n - c.lateFrom;
    return {
      food: Math.round(p.trainFood * Math.pow(c.trainFoodGrowth, c.lateFrom - 2) * Math.pow(c.trainFoodGrowthLate, k)),
      sec: Math.round(p.trainSec * Math.pow(c.trainTimeGrowth, c.lateFrom - 2) * Math.pow(c.trainTimeGrowthLate, k)),
    };
  }
  return {
    food: Math.round(p.trainFood * Math.pow(c.trainFoodGrowth, n - 2)),
    sec: Math.round(p.trainSec * Math.pow(c.trainTimeGrowth, n - 2)),
  };
}

/** Why a recruit can't be trained right now, or null if they can. */
export function trainBlocker(state: GameState, content: Content): 'locked' | 'busy' | 'noBed' | 'food' | null {
  if (!hasUnlock(state, 'recruit')) return 'locked';
  if (state.training) return 'busy';
  if (freeBeds(state, content) <= 0) return 'noBed';
  if (state.resources.food + 1e-9 < trainCost(state, content).food) return 'food';
  return null;
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

/**
 * Why a recipe can't be queued, or null if it can: another race's weapon ('type'), forge or tier not open
 * ('locked'), or the same weapon type's mastery one tier below is too low ('mastery').
 */
export function recipeBlocker(state: GameState, recipeId: string, content: Content): 'type' | 'locked' | 'mastery' | null {
  const recipe = content.equipment.recipes[recipeId];
  if (!recipe || recipe.weaponTypeId !== race(state, content).weaponTypeId) return 'type';
  if (!hasUnlock(state, 'crafting') || !hasUnlock(state, `tier:${recipe.tier}`)) return 'locked';
  if (recipe.requiresMastery) {
    const have = masteryLevel(state.crafting.crafted[masteryKey(recipe.weaponTypeId, recipe.tier - 1)] ?? 0, content);
    if (have < recipe.requiresMastery.level) return 'mastery';
  }
  return null;
}

/** A recipe can be crafted once crafting and its tier are unlocked and the mastery gate (if any) is met. */
export function recipeAvailable(state: GameState, recipeId: string, content: Content): boolean {
  return recipeBlocker(state, recipeId, content) === null;
}

/** Why the Feast can't start right now, or null if it can. */
export function feastBlocker(state: GameState, content: Content): 'locked' | 'active' | 'cooldown' | 'resources' | null {
  const f = content.constants.feast;
  if ((state.buildings[f.requiresBuilding] ?? 0) < 1) return 'locked';
  if (feastActive(state)) return 'active';
  if (state.clock + 1e-9 < state.feast.readyAt) return 'cooldown';
  if (!canAfford(state, f.cost)) return 'resources';
  return null;
}

export function dispatch(input: GameState, cmd: Command, content: Content): CommandResult {
  const state = cloneState(input);
  const events: GameEvent[] = [];

  switch (cmd.type) {
    case 'assignTroop': {
      const troop = state.troops.find((t) => t.id === cmd.troopId);
      if (!troop) return fail('Unknown troop');
      if (cmd.activity && !hasUnlock(state, `activity:${cmd.activity}`)) return fail(`Activity ${cmd.activity} is locked`);
      let siteId: string | null = null;
      if (cmd.activity === 'woodcutting' || cmd.activity === 'mining' || cmd.activity === 'food') {
        const sites = availableSites(state, content, cmd.activity);
        const site = sites.find((x) => x.id === (cmd.siteId ?? troop.siteId)) ?? (cmd.siteId ? undefined : sites[0]);
        if (!site) return fail('No such work site here');
        siteId = site.id;
      }
      if (cmd.activity === 'combat' && troop.activity !== 'combat') troop.engagedSize = troop.size;
      troop.activity = cmd.activity;
      troop.siteId = siteId;
      break;
    }
    case 'trainRecruit': {
      if (!state.troops.some((t) => t.id === cmd.troopId)) return fail('Unknown troop');
      const blocker = trainBlocker(state, content);
      if (blocker === 'locked') return fail('Training is locked');
      if (blocker === 'busy') return fail('A recruit is already in training');
      if (blocker === 'noBed') return fail('No free bed');
      if (blocker === 'food') return fail('Not enough food');
      const cost = trainCost(state, content);
      pay(state, { food: cost.food });
      state.training = { troopId: cmd.troopId, secLeft: cost.sec, totalSec: cost.sec };
      break;
    }
    case 'transferSoldiers': {
      const from = state.troops.find((t) => t.id === cmd.fromTroopId);
      if (!from) return fail('Unknown troop');
      if (!Number.isInteger(cmd.count) || cmd.count <= 0) return fail('Count must be a positive integer');
      if (from.size - cmd.count < 1) return fail('A group keeps at least one soldier');
      let to = null;
      if (cmd.toTroopId !== null) {
        to = state.troops.find((t) => t.id === cmd.toTroopId);
        if (!to || to === from) return fail('Unknown target troop');
      } else if (!openTroopSlot(state)) return fail('No free troop slot');
      moveSoldiers(state, content, from, to ?? null, cmd.count, events);
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
      // Emptying a troop by hand means the player wants it unarmed, so it stops arming itself.
      troop.autoEquip = false;
      unequipAll(troop, state.armoury);
      break;
    }
    case 'setAutoEquip': {
      const troop = state.troops.find((t) => t.id === cmd.troopId);
      if (!troop) return fail('Unknown troop');
      troop.autoEquip = cmd.on;
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
      if (levelDef.requires && !hasUnlock(state, levelDef.requires)) return fail('Building level is locked');
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
    case 'startFeast': {
      const blocker = feastBlocker(state, content);
      if (blocker === 'locked') return fail('The feast is locked');
      if (blocker === 'active') return fail('A feast is already on');
      if (blocker === 'cooldown') return fail('The feast is not ready yet');
      if (blocker === 'resources') return fail('Not enough resources');
      const f = content.constants.feast;
      pay(state, f.cost);
      state.feast = { until: state.clock + f.durationSec, readyAt: state.clock + f.cooldownSec };
      break;
    }
    case 'challengeBoss': {
      const c = state.combat;
      if (!hasUnlock(state, 'boss')) return fail('Boss is locked');
      if (c.boss) return fail('Boss fight already in progress');
      const nb = nextBoss(state, content);
      if (!nb) return fail('Boss already defeated');
      if (!c.cleared) return fail('The boss level is not cleared yet');
      c.boss = { index: nb.index, hpLeft: nb.enemy.hp, timeLeft: nb.timeLimitSec };
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
    case 'setAutoAdvance':
      state.combat.autoAdvance = cmd.on;
      break;
    case 'renameTroop': {
      const troop = state.troops.find((t) => t.id === cmd.troopId);
      if (!troop) return fail('Unknown troop');
      const name = cmd.name.trim();
      if (name.length === 0 || name.length > 32) return fail('Name must be 1–32 characters');
      troop.name = name;
      break;
    }
  }

  autoEquipAll(state, content);
  evaluateObjectives(state, content, events);
  // Hunger is derived: a command (a forager sent out, a recruit paid for) can start or end it.
  const hungryBefore = computeRates(input, content).hungry;
  const hungryAfter = computeRates(state, content).hungry;
  if (hungryBefore !== hungryAfter) events.push({ type: hungryAfter ? 'foodEmpty' : 'foodRestored', at: state.clock });
  return { ok: true, state, events };
}
