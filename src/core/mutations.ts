// Small state helpers shared by commands, simulation and objectives.
// All of them mutate the (already cloned) state passed in.

import { returnExcessWeapons } from './equipment';
import { race } from './stats';
import type { Content, Cost, Effect, GameEvent, GameState, ResourceId, TroopState, Unlock } from './types';

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

function formTroop(state: GameState, content: Content, size: number, events: GameEvent[]): TroopState {
  const r = race(state, content);
  const n = state.troops.length + 1;
  const id = `troop${n}`;
  const troop: TroopState = { id, name: r.troopNames[n - 1] ?? `Troop ${n}`, size, xp: 0, weaponTypeId: r.weaponTypeId, equipment: [], activity: null, wounds: 0, engagedSize: size, autoEquip: true, siteId: null };
  state.troops.push(troop);
  events.push({ type: 'troopFormed', at: state.clock, troopId: id });
  return troop;
}

/** True when a troop group slot is free. */
export function openTroopSlot(state: GameState): boolean {
  return state.troops.length < state.troopSlots;
}

/**
 * New soldiers (trained or rescued). They form a new group when a slot is open, otherwise
 * they join the preferred troop (or the smallest one). Returns the troop they joined.
 */
export function addSoldiers(state: GameState, content: Content, count: number, events: GameEvent[], preferredTroopId?: string): TroopState {
  if (openTroopSlot(state)) return formTroop(state, content, count, events);
  const troop = state.troops.find((t) => t.id === preferredTroopId) ?? [...state.troops].sort((a, b) => a.size - b.size)[0]!;
  troop.size += count;
  if (troop.activity === 'combat') troop.engagedSize += count;
  return troop;
}

/**
 * Move soldiers from one group to another, or into a new group (`to` null, needs an open slot).
 * The source keeps at least one soldier; weapons beyond its new size go to the armoury.
 */
export function moveSoldiers(state: GameState, content: Content, from: TroopState, to: TroopState | null, count: number, events: GameEvent[]): TroopState {
  from.size -= count;
  from.engagedSize = Math.max(from.size, from.engagedSize - count);
  returnExcessWeapons(from, state.armoury);
  if (!to) return formTroop(state, content, count, events);
  to.size += count;
  if (to.activity === 'combat') to.engagedSize += count;
  return to;
}

export function applyEffects(state: GameState, content: Content, effects: readonly Effect[], events: GameEvent[]): void {
  for (const e of effects) {
    if (e.kind === 'unlock') addUnlock(state, e.unlock);
    else if (e.kind === 'troopSlot') {
      state.troopSlots += 1;
      // The new group forms at once when a group can spare a soldier; otherwise the next soldier forms it.
      const donor = [...state.troops].sort((a, b) => b.size - a.size)[0];
      if (donor && donor.size >= 2) moveSoldiers(state, content, donor, null, 1, events);
    }
    // 'beds', 'capacity' and 'modifier' are derived from state.buildings; nothing to store.
  }
}
