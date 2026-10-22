// Event-driven simulation: one function for online ticks and offline catch-up.
// Rates are constant between events, so a long Δt costs one step per event, not per second.
// See docs/ARCHITECTURE.md §4.

import { xpForLevel } from './formulas';
import { applyEffects } from './mutations';
import { evaluateObjectives } from './objectives';
import { cloneState } from './state';
import { computeRates, troopLevel, zone, type Rates } from './stats';
import { RESOURCES, type Content, type GameEvent, type GameState } from './types';

const MAX_STEPS = 100_000;

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
  } else if (!c.cleared && rates.killsPerSec > 0) {
    const need = z.stages[c.stageIndex]?.killsToClear ?? Infinity;
    out.push({ t: (need - c.kills) / rates.killsPerSec, snap: (s) => (s.combat.kills = need) });
  }

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

function integrate(state: GameState, rates: Rates, dt: number): void {
  for (const r of RESOURCES) {
    state.resources[r] += rates.resources[r] * dt;
    state.stats.gathered[r] += rates.gathered[r] * dt;
  }
  const c = state.combat;
  if (c.boss) {
    c.boss.hpLeft -= rates.bossDps * dt;
    c.boss.timeLeft -= dt;
  } else if (rates.killsPerSec > 0) {
    if (!c.cleared) c.kills += rates.killsPerSec * dt;
    state.stats.totalKills += rates.killsPerSec * dt;
  }
  if (state.construction) state.construction.progress += rates.constructionWorkPerSec * dt;
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
      events.push({ type: 'bossDefeated', at: state.clock, zoneId: z.id });
    } else if (c.boss.timeLeft <= EPS) {
      c.boss = null;
      events.push({ type: 'bossFailed', at: state.clock, zoneId: z.id });
    }
  } else if (!c.cleared) {
    const need = z.stages[c.stageIndex]?.killsToClear ?? Infinity;
    if (c.kills >= need - EPS) {
      events.push({ type: 'stageCleared', at: state.clock, zoneId: z.id, stage: c.stageIndex + 1 });
      c.kills = 0;
      if (c.stageIndex >= z.stages.length - 1) {
        c.cleared = true;
        events.push({ type: 'zoneCleared', at: state.clock, zoneId: z.id });
      } else {
        c.stageIndex++;
      }
    }
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

  for (const t of state.troops) {
    const before = levelsBefore.get(t.id);
    const now = troopLevel(t, content);
    if (before !== undefined && now > before) events.push({ type: 'troopLevelUp', at: state.clock, troopId: t.id, level: now });
  }
}

export interface AdvanceResult {
  state: GameState;
  events: GameEvent[];
}

/** Advance the game by `dt` simulated seconds. Pure: returns a new state. */
export function advance(input: GameState, dt: number, content: Content): AdvanceResult {
  const state = cloneState(input);
  const events: GameEvent[] = [];
  let remaining = Math.max(0, dt);
  let steps = 0;

  evaluateObjectives(state, content, events);
  while (remaining > 1e-12) {
    if (++steps > MAX_STEPS) throw new Error('advance: too many steps (event loop did not converge)');
    const rates = computeRates(state, content);
    const pending = pendingEvents(state, rates, content);
    let step = remaining;
    for (const p of pending) step = Math.min(step, Math.max(0, p.t));

    const levelsBefore = new Map(state.troops.map((t) => [t.id, troopLevel(t, content)]));
    integrate(state, rates, step);
    for (const p of pending) if (p.t <= step + 1e-12) p.snap(state);
    remaining -= step;

    processEvents(state, content, levelsBefore, events);
    evaluateObjectives(state, content, events);
  }
  return { state, events };
}

/** Offline catch-up: clamps elapsed real time to [0, cap] and advances. */
export function catchUp(state: GameState, elapsedSec: number, offlineCapSec: number, content: Content): AdvanceResult & { simulatedSec: number } {
  const simulatedSec = Math.min(Math.max(0, elapsedSec), offlineCapSec);
  return { ...advance(state, simulatedSec, content), simulatedSec };
}
