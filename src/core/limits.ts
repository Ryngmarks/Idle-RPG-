// Read-only helpers that explain what is slowing the player down, so the UI never computes game rules.
// Nothing here changes state or is saved.

import { trainCost } from './commands';
import { computeRates, freeBeds } from './stats';
import type { Content, GameState } from './types';

export type LimiterKind =
  | 'idleTroop' // a troop has no activity (block)
  | 'noBuilder' // a construction project exists but no troop has activity 'construction' (block)
  | 'noSmith' // the forge queue has orders but no troop has activity 'smithing' (block)
  | 'beds' // 'recruit' unlocked, no training running, freeBeds <= 0 (block)
  | 'trainingFood' // 'recruit' unlocked, a bed is free, no training running, food < trainCost.food (slow)
  | 'siteFull' // a gathering troop has working < size at its site (slow)
  | 'crewFull' // a construction or smithing troop has working < size (slow)
  | 'training' // a recruit is in training (info)
  | 'hunger'; // food is 0 and income is below upkeep (block), or the stock runs out within 2 minutes (slow); secondsLeft set when slow

export interface Limiter {
  kind: LimiterKind;
  severity: 'block' | 'slow' | 'info';
  troopId?: string;
  siteId?: string;
  target?: 'construction' | 'smithing';
  current?: number;
  max?: number;
  secondsLeft?: number;
  tab: 'forces' | 'settlement' | 'forge';
}

const ORDER: Record<Limiter['severity'], number> = { block: 0, slow: 1, info: 2 };

export interface FoodBalance {
  /** Average food income per second (site cycles + combat loot). */
  income: number;
  /** Food eaten per second. */
  upkeep: number;
  /** income - upkeep. */
  net: number;
  /** min(1, income / upkeep); 1 when nobody eats. Below 1 only while hungry. */
  coverage: number;
  /** Food stock is 0 and income is below upkeep: work and attack are slowed. */
  hungry: boolean;
  /** Seconds until the stock reaches 0 at the average net rate; 0 while hungry; null when it is not falling. */
  secondsLeft: number | null;
}

/** Food income, upkeep and hunger, all per second. Derived; nothing is saved. */
export function foodBalance(state: GameState, content: Content): FoodBalance {
  const rates = computeRates(state, content);
  const income = rates.income.food;
  const upkeep = rates.upkeepPerSec;
  const net = income - upkeep;
  const stock = state.resources.food;
  const secondsLeft = rates.hungry ? 0 : net < 0 && upkeep > 0 ? Math.max(0, stock) / -net : null;
  return { income, upkeep, net, coverage: rates.coverage, hungry: rates.hungry, secondsLeft };
}

/** Everything that is slowing the player right now, most severe first (block, slow, info), stable order within a severity (troop order). */
export function limiters(state: GameState, content: Content): Limiter[] {
  const out: Limiter[] = [];
  const rates = computeRates(state, content);

  for (const t of state.troops) {
    if (t.activity === null) out.push({ kind: 'idleTroop', severity: 'block', troopId: t.id, current: t.size, tab: 'forces' });
  }
  if (state.construction && !state.troops.some((t) => t.activity === 'construction')) {
    out.push({ kind: 'noBuilder', severity: 'block', tab: 'settlement' });
  }
  if (state.crafting.queue.length > 0 && !state.troops.some((t) => t.activity === 'smithing')) {
    out.push({ kind: 'noSmith', severity: 'block', tab: 'forge' });
  }

  const food = foodBalance(state, content);
  if (food.hungry) out.push({ kind: 'hunger', severity: 'block', current: food.income * 60, max: food.upkeep * 60, tab: 'forces' });
  else if (food.secondsLeft !== null && food.secondsLeft < 120) out.push({ kind: 'hunger', severity: 'slow', secondsLeft: food.secondsLeft, current: food.income * 60, max: food.upkeep * 60, tab: 'forces' });

  if (state.unlocks.includes('recruit') && !state.training) {
    const free = freeBeds(state, content);
    if (free <= 0) {
      const total = state.troops.reduce((n, t) => n + t.size, 0);
      out.push({ kind: 'beds', severity: 'block', current: total, max: total + free, tab: 'settlement' });
    } else {
      const need = trainCost(state, content).food;
      if (state.resources.food + 1e-9 < need) {
        out.push({ kind: 'trainingFood', severity: 'slow', current: state.resources.food, max: need, tab: 'forces' });
      }
    }
  }

  for (const t of state.troops) {
    const r = rates.perTroop[t.id];
    if (!r || r.working >= t.size) continue;
    if ((t.activity === 'mining' || t.activity === 'woodcutting' || t.activity === 'food') && r.siteId) {
      out.push({ kind: 'siteFull', severity: 'slow', troopId: t.id, siteId: r.siteId, current: r.working, max: t.size, tab: 'forces' });
    } else if (t.activity === 'construction' && state.construction) {
      out.push({ kind: 'crewFull', severity: 'slow', troopId: t.id, target: 'construction', current: r.working, max: t.size, tab: 'settlement' });
    } else if (t.activity === 'smithing' && state.crafting.queue.length > 0) {
      out.push({ kind: 'crewFull', severity: 'slow', troopId: t.id, target: 'smithing', current: r.working, max: t.size, tab: 'forge' });
    }
  }

  if (state.training) {
    out.push({ kind: 'training', severity: 'info', troopId: state.training.troopId, secondsLeft: state.training.secLeft, current: state.training.totalSec - state.training.secLeft, max: state.training.totalSec, tab: 'forces' });
  }

  // Array.prototype.sort is stable, so troop order is kept within a severity.
  return out.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}

/** Seconds until the combat troops' next kill at the current stage (1 / killsPerSec), or null if nobody is fighting or kills/s is 0; boss fights: null. */
export function secondsPerKill(state: GameState, content: Content): number | null {
  if (state.combat.boss) return null;
  const k = computeRates(state, content).killsPerSec;
  return k > 0 ? 1 / k : null;
}

/** Seconds until the next completed work cycle at a site (progress carried in state.siteProgress), or null if nobody works it. */
export function secondsToNextCycle(state: GameState, content: Content, siteId: string): number | null {
  const rate = computeRates(state, content).siteCycles[siteId] ?? 0;
  if (rate <= 0) return null;
  const progress = state.siteProgress[siteId] ?? 0;
  return Math.max(0, 1 - progress) / rate;
}
