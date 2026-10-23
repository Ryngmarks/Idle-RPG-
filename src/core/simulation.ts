// Event-driven simulation: one function for online ticks and offline catch-up.
// Rates are constant between events, so a long Δt costs one step per event, not per second.
// See docs/ARCHITECTURE.md §4.

import { autoEquipAll, itemKey, masteryKey, masteryLevel, pickQuality, qualityChances, trimEquipment } from './equipment';
import { xpForLevel } from './formulas';
import { addSoldiers, applyEffects } from './mutations';
import { evaluateObjectives } from './objectives';
import { cloneState } from './state';
import { computeRates, FOOD_EPS, globalModifiers, stageSafety, troopLevel, troopStats, zone, type Rates } from './stats';
import { RESOURCES, type Content, type GameEvent, type GameState } from './types';

const MAX_STEPS = 100_000;

/** Kills only count towards clearing a stage when fighting at the highest reached stage. */
function onFrontier(state: GameState): boolean {
  const c = state.combat;
  return !c.cleared && !c.boss && c.stageIndex === c.unlockedStage;
}

interface Pending {
  t: number;
  /** Sets the value to its exact threshold, avoiding float drift. */
  snap: (s: GameState) => void;
}

function pendingEvents(state: GameState, rates: Rates, content: Content): Pending[] {
  const out: Pending[] = [];
  const c = state.combat;
  const z = zone(state, content);

  if (c.boss) {
    out.push({ t: c.boss.timeLeft, snap: (s) => s.combat.boss && (s.combat.boss.timeLeft = 0) });
    if (rates.bossDps > 0) out.push({ t: c.boss.hpLeft / rates.bossDps, snap: (s) => s.combat.boss && (s.combat.boss.hpLeft = 0) });
  } else if (onFrontier(state) && rates.killsPerSec > 0) {
    const need = z.stages[c.stageIndex]?.killsToClear ?? Infinity;
    out.push({ t: (need - c.kills) / rates.killsPerSec, snap: (s) => (s.combat.kills = need) });
  }

  const mods = globalModifiers(state, content);
  for (const t of state.troops) {
    const rate = rates.woundsPerSec[t.id] ?? 0;
    const id = t.id;
    if (rate > 0) {
      const hp = troopStats(state, t, content, mods).hp;
      out.push({ t: (hp - t.wounds) / rate, snap: (s) => { const x = s.troops.find((y) => y.id === id); if (x) x.wounds = hp; } });
    } else if (rate < 0 && t.wounds > 0) {
      out.push({ t: t.wounds / -rate, snap: (s) => { const x = s.troops.find((y) => y.id === id); if (x) x.wounds = 0; } });
    }
  }

  // Food: the stock drains continuously (loot minus upkeep) and hits 0 at an exact moment. A payout that
  // lands in the same step keeps it above 0, so only snap values that are really empty.
  const emptyFood = (s: GameState) => {
    if (Math.abs(s.resources.food) < 1e-7) s.resources.food = 0;
  };
  if (state.resources.food > FOOD_EPS && rates.foodPerSec < 0) {
    out.push({ t: state.resources.food / -rates.foodPerSec, snap: emptyFood });
  } else if (state.resources.food <= FOOD_EPS && !rates.hungry && rates.upkeepPerSec > rates.resources.food) {
    // Empty stock, upkeep covered by average income: the clamp ends at the next food payout, so stop there.
    for (const [siteId, cycles] of Object.entries(rates.siteCycles)) {
      if (cycles <= 0 || !(content.sites[siteId]?.yield.food)) continue;
      const progress = state.siteProgress[siteId] ?? 0;
      out.push({ t: (Math.floor(progress + 1e-9) + 1 - progress) / cycles, snap: () => {} });
    }
  }

  const order = state.crafting.queue[0];
  const recipe = order ? content.equipment.recipes[order.recipeId] : undefined;
  if (recipe && rates.craftWorkPerSec > 0) {
    const work = recipe.workPerItem;
    out.push({ t: (work - state.crafting.progress) / rates.craftWorkPerSec, snap: (s) => (s.crafting.progress = work) });
  }

  if (state.training) out.push({ t: state.training.secLeft, snap: (s) => s.training && (s.training.secLeft = 0) });

  if (state.construction && rates.constructionWorkPerSec > 0) {
    const proj = state.construction;
    const work = content.buildings[proj.buildingId]?.levels[proj.level - 1]?.work ?? 0;
    out.push({
      t: (work - proj.progress) / rates.constructionWorkPerSec,
      snap: (s) => s.construction && (s.construction.progress = work),
    });
  }

  for (const t of state.troops) {
    const xpRate = rates.xpPerSec[t.id] ?? 0;
    if (xpRate <= 0) continue;
    const next = xpForLevel(troopLevel(t, content) + 1, content.constants.xpBase, content.constants.xpExponent);
    const id = t.id;
    out.push({
      t: (next - t.xp) / xpRate,
      snap: (s) => {
        const troop = s.troops.find((x) => x.id === id);
        if (troop) troop.xp = next;
      },
    });
  }
  return out;
}

function integrate(state: GameState, rates: Rates, dt: number, content: Content): void {
  for (const r of RESOURCES) state.resources[r] += (r === 'food' ? rates.foodPerSec : rates.resources[r]) * dt;
  // Work cycles: progress is kept per site and every whole cycle pays its reward at once.
  // The remainder carries over, so many small steps and one big step pay the same.
  for (const [siteId, cycles] of Object.entries(rates.siteCycles)) {
    const site = content.sites[siteId];
    if (!site || cycles <= 0) continue;
    const progress = (state.siteProgress[siteId] ?? 0) + cycles * dt;
    const done = Math.floor(progress + 1e-9);
    state.siteProgress[siteId] = Math.max(0, progress - done);
    if (done <= 0) continue;
    for (const [r, v] of Object.entries(site.yield) as [keyof typeof state.resources, number][]) {
      state.resources[r] += v * done;
      state.stats.gathered[r] += v * done;
    }
  }
  // Hungry: the stock stays at 0, whatever arrives is eaten. Never negative.
  if (rates.hungry || state.resources.food < 0) state.resources.food = 0;
  if (state.training) state.training.secLeft -= dt;
  const c = state.combat;
  if (c.boss) {
    c.boss.hpLeft -= rates.bossDps * dt;
    c.boss.timeLeft -= dt;
  } else if (rates.killsPerSec > 0) {
    if (onFrontier(state)) c.kills += rates.killsPerSec * dt;
    state.stats.totalKills += rates.killsPerSec * dt;
  }
  for (const t of state.troops) t.wounds = Math.max(0, t.wounds + (rates.woundsPerSec[t.id] ?? 0) * dt);
  if (state.construction) state.construction.progress += rates.constructionWorkPerSec * dt;
  state.crafting.progress += rates.craftWorkPerSec * dt;
  for (const t of state.troops) t.xp += (rates.xpPerSec[t.id] ?? 0) * dt;
  state.clock += dt;
}

function processEvents(state: GameState, content: Content, levelsBefore: Map<string, number>, events: GameEvent[]): void {
  const c = state.combat;
  const z = zone(state, content);
  const EPS = 1e-9;

  if (c.boss) {
    if (c.boss.hpLeft <= EPS) {
      c.boss = null;
      c.bossDefeated = true;
      state.stats.bossDefeatedAt = state.clock;
      events.push({ type: 'bossDefeated', at: state.clock, zoneId: z.id });
    } else if (c.boss.timeLeft <= EPS) {
      c.boss = null;
      events.push({ type: 'bossFailed', at: state.clock, zoneId: z.id });
    }
  } else if (onFrontier(state)) {
    const need = z.stages[c.stageIndex]?.killsToClear ?? Infinity;
    if (c.kills >= need - EPS) {
      events.push({ type: 'stageCleared', at: state.clock, zoneId: z.id, stage: c.stageIndex + 1 });
      c.kills = 0;
      if (c.unlockedStage >= z.stages.length - 1) {
        c.cleared = true;
        events.push({ type: 'zoneCleared', at: state.clock, zoneId: z.id });
      } else {
        // The next stage opens, but the troops stay where they are: the player decides when to advance.
        c.unlockedStage++;
      }
    }
  }

  // Casualties: a troop loses a soldier each time its wounds reach one soldier's HP.
  // It never drops below one soldier, and it retreats to camp after losing half its engaged size.
  const mods = globalModifiers(state, content);
  for (const t of state.troops) {
    const hp = troopStats(state, t, content, mods).hp;
    if (t.wounds < hp - EPS) continue;
    if (t.size > 1) {
      t.size -= 1;
      t.wounds = Math.max(0, t.wounds - hp);
      trimEquipment(t);
      state.stats.soldiersLost += 1;
      events.push({ type: 'soldierLost', at: state.clock, troopId: t.id });
      if (t.size <= Math.floor(t.engagedSize / 2) && t.activity === 'combat') {
        t.activity = null;
        events.push({ type: 'troopRetreated', at: state.clock, troopId: t.id, reason: 'losses' });
      }
    } else {
      t.wounds = hp;
      if (t.activity === 'combat') {
        t.activity = null;
        events.push({ type: 'troopRetreated', at: state.clock, troopId: t.id, reason: 'losses' });
      }
    }
  }

  if (state.training && state.training.secLeft <= EPS) {
    const troop = addSoldiers(state, content, 1, events, state.training.troopId);
    state.training = null;
    state.stats.recruited += 1;
    events.push({ type: 'recruitTrained', at: state.clock, troopId: troop.id });
    autoEquipAll(state, content);
  }

  const proj = state.construction;
  if (proj) {
    const def = content.buildings[proj.buildingId];
    const level = def?.levels[proj.level - 1];
    if (def && level && proj.progress >= level.work - EPS) {
      state.buildings[proj.buildingId] = proj.level;
      state.construction = null;
      events.push({ type: 'constructionCompleted', at: state.clock, buildingId: def.id, level: proj.level });
      applyEffects(state, content, level.effects, events);
    }
  }

  // Forge: one finished weapon goes to the armoury; its quality follows the smith's mastery.
  const order = state.crafting.queue[0];
  const recipe = order ? content.equipment.recipes[order.recipeId] : undefined;
  if (order && recipe && state.crafting.progress >= recipe.workPerItem - EPS) {
    const mk = masteryKey(recipe.weaponTypeId, recipe.tier);
    const crafted = state.crafting.crafted[mk] ?? 0;
    const level = masteryLevel(crafted, content);
    const pick = pickQuality(state.crafting.carry[mk] ?? [], qualityChances(level, content));
    state.crafting.carry[mk] = pick.carry;
    const key = itemKey(recipe.weaponTypeId, recipe.tier, pick.quality);
    state.armoury[key] = (state.armoury[key] ?? 0) + 1;
    state.crafting.crafted[mk] = crafted + 1;
    state.stats.weaponsCrafted += 1;
    state.stats.weaponsByQuality[pick.quality] += 1;
    state.crafting.progress = 0;
    events.push({ type: 'weaponCrafted', at: state.clock, recipeId: recipe.id, quality: pick.quality });
    const newLevel = masteryLevel(crafted + 1, content);
    if (newLevel > level) events.push({ type: 'masteryLevelUp', at: state.clock, weaponTypeId: recipe.weaponTypeId, tier: recipe.tier, level: newLevel });
    autoEquipAll(state, content);
    order.remaining -= 1;
    if (order.remaining <= 0) {
      state.crafting.queue.shift();
      events.push({ type: 'craftOrderCompleted', at: state.clock, recipeId: recipe.id });
    }
  }

  for (const t of state.troops) {
    const before = levelsBefore.get(t.id);
    const now = troopLevel(t, content);
    if (before !== undefined && now > before) {
      events.push({ type: 'troopLevelUp', at: state.clock, troopId: t.id, level: now });
      for (const step of [5, 10] as const) if (before < step && now >= step) events.push({ type: 'levelStep', at: state.clock, troopId: t.id, level: step });
    }
  }
}

export interface AdvanceResult {
  state: GameState;
  events: GameEvent[];
  /** Simulated seconds spent hungry (food at 0, income below upkeep). Not saved; for the away report. */
  hungrySec: number;
}

/** Advance the game by `dt` simulated seconds. Pure: returns a new state. */
export function advance(input: GameState, dt: number, content: Content): AdvanceResult {
  const state = cloneState(input);
  const events: GameEvent[] = [];
  let remaining = Math.max(0, dt);
  let steps = 0;
  let hungrySec = 0;

  evaluateObjectives(state, content, events);
  // Hunger is derived, never stored: events only fire on transitions seen while advancing.
  let wasHungry = computeRates(state, content).hungry;
  const noteHunger = (hungry: boolean) => {
    if (hungry === wasHungry) return;
    wasHungry = hungry;
    events.push({ type: hungry ? 'foodEmpty' : 'foodRestored', at: state.clock });
  };
  while (remaining > 1e-12) {
    if (++steps > MAX_STEPS) throw new Error('advance: too many steps (event loop did not converge)');
    const rates = computeRates(state, content);
    noteHunger(rates.hungry);
    const pending = pendingEvents(state, rates, content);
    let step = remaining;
    for (const p of pending) step = Math.min(step, Math.max(0, p.t));

    const levelsBefore = new Map(state.troops.map((t) => [t.id, troopLevel(t, content)]));
    integrate(state, rates, step, content);
    if (rates.hungry) hungrySec += step;
    for (const p of pending) if (p.t <= step + 1e-12) p.snap(state);
    remaining -= step;

    processEvents(state, content, levelsBefore, events);
    evaluateObjectives(state, content, events);
  }
  noteHunger(computeRates(state, content).hungry);
  return { state, events, hungrySec };
}

/**
 * Offline rule (owner decision): no losses while away. Before simulating offline time,
 * an unfinished boss fight is abandoned, and fighting troops on a stage where they would lose
 * soldiers fall back to the highest safe stage, or retreat to camp if no stage is safe.
 */
export function secureForOffline(input: GameState, content: Content): AdvanceResult {
  const state = cloneState(input);
  const events: GameEvent[] = [];
  const c = state.combat;
  if (c.boss) {
    c.boss = null;
    events.push({ type: 'bossAbandoned', at: state.clock, zoneId: c.zoneId });
  }
  const fighters = state.troops.filter((t) => t.activity === 'combat');
  if (fighters.length > 0 && stageSafety(state, content, { stageIndex: c.stageIndex }).risk !== 'safe') {
    let safeStage = -1;
    for (let i = c.stageIndex - 1; i >= 0; i--) {
      if (stageSafety(state, content, { stageIndex: i }).risk === 'safe') {
        safeStage = i;
        break;
      }
    }
    if (safeStage >= 0) {
      c.stageIndex = safeStage;
      events.push({ type: 'stageChanged', at: state.clock, stage: safeStage + 1, reason: 'offlineSafety' });
    } else {
      for (const t of fighters) {
        t.activity = null;
        events.push({ type: 'troopRetreated', at: state.clock, troopId: t.id, reason: 'offlineSafety' });
      }
    }
  }
  return { state, events, hungrySec: 0 };
}

/** Offline catch-up: secures the troops, clamps elapsed real time to [0, cap] and advances. */
export function catchUp(state: GameState, elapsedSec: number, offlineCapSec: number, content: Content): AdvanceResult & { simulatedSec: number } {
  const simulatedSec = Math.min(Math.max(0, elapsedSec), offlineCapSec);
  const secured = secureForOffline(state, content);
  const r = advance(secured.state, simulatedSec, content);
  return { state: r.state, events: [...secured.events, ...r.events], hungrySec: r.hungrySec, simulatedSec };
}
