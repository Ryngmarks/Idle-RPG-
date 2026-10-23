// Aggregated equipment: weapons are counts per (type, tier, quality), never objects per soldier.
// See docs/EQUIPMENT_AND_CRAFTING.md.

import { QUALITY_IDS, type Content, type EquipmentBucket, type GameState, type QualityId, type TroopState } from './types';

export function itemKey(weaponTypeId: string, tier: number, quality: QualityId): string {
  return `${weaponTypeId}:t${tier}:${quality}`;
}

export function parseItemKey(key: string): { weaponTypeId: string; tier: number; quality: QualityId } | null {
  const m = /^(.+):t(\d+):([a-z]+)$/.exec(key);
  if (!m || !QUALITY_IDS.includes(m[3] as QualityId)) return null;
  return { weaponTypeId: m[1]!, tier: Number(m[2]), quality: m[3] as QualityId };
}

export function masteryKey(weaponTypeId: string, tier: number): string {
  return `${weaponTypeId}:t${tier}`;
}

/** Attack multiplier of one weapon. */
export function weaponPower(tier: number, quality: QualityId, content: Content): number {
  const eq = content.equipment;
  const t = eq.tiers.find((x) => x.tier === tier)?.powerMult ?? 1;
  const q = eq.qualities.find((x) => x.id === quality)?.powerMult ?? 1;
  return t * q;
}

export function equippedCount(troop: TroopState): number {
  return troop.equipment.reduce((n, b) => n + b.count, 0);
}

/** Sort best first and merge duplicates; drops empty buckets. */
export function normalizeBuckets(buckets: EquipmentBucket[], content: Content): EquipmentBucket[] {
  const merged = new Map<string, EquipmentBucket>();
  for (const b of buckets) {
    if (b.count <= 0) continue;
    const k = `${b.tier}:${b.quality}`;
    const prev = merged.get(k);
    merged.set(k, { tier: b.tier, quality: b.quality, count: (prev?.count ?? 0) + b.count });
  }
  return [...merged.values()].sort((a, b) => weaponPower(b.tier, b.quality, content) - weaponPower(a.tier, a.quality, content));
}

/** Soldiers grouped by the weapon they hold, including the unarmed remainder (tier 0). */
export function weaponGroups(troop: TroopState, content: Content): { count: number; power: number; tier: number; quality: QualityId | null }[] {
  const groups = troop.equipment.map((b) => ({ count: b.count, power: weaponPower(b.tier, b.quality, content), tier: b.tier, quality: b.quality as QualityId | null }));
  const unarmed = troop.size - equippedCount(troop);
  if (unarmed > 0) groups.push({ count: unarmed, power: content.equipment.unarmedMult, tier: 0, quality: null });
  return groups;
}

/** Average attack multiplier from weapons across the whole troop. */
export function averageWeaponPower(troop: TroopState, content: Content): number {
  if (troop.size <= 0) return content.equipment.unarmedMult;
  return weaponGroups(troop, content).reduce((s, g) => s + g.count * g.power, 0) / troop.size;
}

/**
 * Re-arm a troop with the best weapons of its type available in its own hands plus the armoury.
 * The troop ends up with the best `size` weapons; everything else is in the armoury. Optimal and O(kinds).
 */
export function equipBest(troop: TroopState, armoury: Record<string, number>, content: Content): void {
  const pool = new Map<string, number>();
  for (const b of troop.equipment) {
    const k = itemKey(troop.weaponTypeId, b.tier, b.quality);
    pool.set(k, (pool.get(k) ?? 0) + b.count);
  }
  for (const [k, n] of Object.entries(armoury)) {
    const p = parseItemKey(k);
    if (p && p.weaponTypeId === troop.weaponTypeId && n > 0) pool.set(k, (pool.get(k) ?? 0) + n);
  }
  const ranked = [...pool.entries()]
    .map(([k, n]) => ({ k, n, item: parseItemKey(k)! }))
    .sort((a, b) => weaponPower(b.item.tier, b.item.quality, content) - weaponPower(a.item.tier, a.item.quality, content));
  let slots = troop.size;
  const equipment: EquipmentBucket[] = [];
  for (const r of ranked) {
    const take = Math.min(slots, r.n);
    if (take > 0) equipment.push({ tier: r.item.tier, quality: r.item.quality, count: take });
    slots -= take;
    const rest = r.n - take;
    if (rest > 0) armoury[r.k] = rest;
    else delete armoury[r.k];
  }
  troop.equipment = normalizeBuckets(equipment, content);
}

/**
 * Troops with autoEquip share their weapons and the armoury: everything is pooled and the
 * fighting troops get the best first, then the rest in order. Called after every command and
 * every finished weapon, so the result never depends on who happened to arm first.
 */
export function autoEquipAll(state: GameState, content: Content): void {
  const auto = state.troops.filter((t) => t.autoEquip);
  if (auto.length === 0) return;
  if (!Object.values(state.armoury).some((n) => n > 0) && auto.length === 1) return;
  for (const t of auto) unequipAll(t, state.armoury);
  const ordered = [...auto.filter((t) => t.activity === 'combat'), ...auto.filter((t) => t.activity !== 'combat')];
  for (const t of ordered) equipBest(t, state.armoury, content);
}

/** Put all of a troop's weapons back in the armoury. */
export function unequipAll(troop: TroopState, armoury: Record<string, number>): void {
  for (const b of troop.equipment) {
    const k = itemKey(troop.weaponTypeId, b.tier, b.quality);
    armoury[k] = (armoury[k] ?? 0) + b.count;
  }
  troop.equipment = [];
}

/** After soldiers leave a troop alive, their weapons (the worst first) go back to the armoury. */
export function returnExcessWeapons(troop: TroopState, armoury: Record<string, number>): void {
  let excess = equippedCount(troop) - troop.size;
  for (let i = troop.equipment.length - 1; i >= 0 && excess > 0; i--) {
    const b = troop.equipment[i]!;
    const take = Math.min(b.count, excess);
    b.count -= take;
    excess -= take;
    const k = itemKey(troop.weaponTypeId, b.tier, b.quality);
    armoury[k] = (armoury[k] ?? 0) + take;
  }
  troop.equipment = troop.equipment.filter((b) => b.count > 0);
}

/**
 * After a troop shrinks, drop weapons until Σ equipped ≤ size. The unarmed fall first
 * (only weapons beyond the new size are lost), and the worst weapons are lost before better ones.
 */
export function trimEquipment(troop: TroopState): void {
  let excess = equippedCount(troop) - troop.size;
  for (let i = troop.equipment.length - 1; i >= 0 && excess > 0; i--) {
    const b = troop.equipment[i]!;
    const take = Math.min(b.count, excess);
    b.count -= take;
    excess -= take;
  }
  troop.equipment = troop.equipment.filter((b) => b.count > 0);
}

export function masteryLevel(crafted: number, content: Content): number {
  const eq = content.equipment;
  return Math.min(eq.maxMastery, Math.floor(Math.sqrt(Math.max(0, crafted) / eq.itemsPerMasteryStep)));
}

/** Weapons needed in total to reach a mastery level. */
export function craftedForMastery(level: number, content: Content): number {
  return level * level * content.equipment.itemsPerMasteryStep;
}

export function qualityChances(level: number, content: Content): number[] {
  const eq = content.equipment;
  const f = eq.maxMastery > 0 ? Math.min(1, Math.max(0, level / eq.maxMastery)) : 0;
  return eq.chancesAtMin.map((lo, i) => lo + ((eq.chancesAtMax[i] ?? lo) - lo) * f);
}

/**
 * Deterministic quality pick: every weapon adds the chances to a running carry. The best quality
 * whose carry has reached a whole weapon is produced (so a rare quality is only made once it has
 * been "earned"); otherwise the quality with the largest carry. The chosen carry drops by one.
 * Over many weapons the result matches the chances, with no randomness, so online and offline
 * crafting are identical.
 */
export function pickQuality(carry: number[], chances: number[]): { quality: QualityId; carry: number[] } {
  const next = QUALITY_IDS.map((_, i) => (carry[i] ?? 0) + (chances[i] ?? 0));
  let best = -1;
  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i]! >= 1 - 1e-9) {
      best = i;
      break;
    }
  }
  if (best < 0) {
    best = 0;
    for (let i = 1; i < next.length; i++) if (next[i]! > next[best]! + 1e-12) best = i;
  }
  next[best] = (next[best] ?? 0) - 1;
  return { quality: QUALITY_IDS[best]!, carry: next };
}
