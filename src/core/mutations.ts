// Small state helpers shared by commands, simulation and objectives.
// All of them mutate the (already cloned) state passed in.

import { race } from './stats';
import type { Content, Cost, Effect, GameEvent, GameState, ResourceId, Unlock } from './types';

export function canAfford(state: GameState, cost: Cost): boolean {
  return (Object.entries(cost) as [ResourceId, number][]).every(([r, v]) => state.resources[r] + 1e-9 >= v);
}

export function pay(state: GameState, cost: Cost): void {
  for (const [r, v] of Object.entries(cost) as [ResourceId, number][]) {
    state.resources[r] = Math.max(0, state.resources[r] - v);
  }
}

export function gain(state: GameState, amount: Cost): void {
  for (const [r, v] of Object.entries(amount) as [ResourceId, number][]) state.resources[r] += v;
}

export function hasUnlock(state: GameState, unlock: Unlock): boolean {
  return state.unlocks.includes(unlock);
}

export function addUnlock(state: GameState, unlock: Unlock): void {
  if (!state.unlocks.includes(unlock)) state.unlocks.push(unlock);
}

export function formTroop(state: GameState, content: Content, size: number, events: GameEvent[]): void {
  const r = race(state, content);
  const n = state.troops.length + 1;
  const id = `troop${n}`;
  state.troops.push({ id, name: r.troopNames[n - 1] ?? `Troop ${n}`, size, xp: 0, weaponTypeId: r.weaponTypeId, equipment: [], activity: null, wounds: 0, engagedSize: size, autoEquip: true });
  events.push({ type: 'troopFormed', at: state.clock, troopId: id });
}

export function applyEffects(state: GameState, content: Content, effects: readonly Effect[], events: GameEvent[]): void {
  for (const e of effects) {
    if (e.kind === 'unlock') addUnlock(state, e.unlock);
    else if (e.kind === 'troopSlot') formTroop(state, content, race(state, content).population.newTroopSize, events);
    // 'capLevel' and 'modifier' are derived from state.buildings; nothing to store.
  }
}
