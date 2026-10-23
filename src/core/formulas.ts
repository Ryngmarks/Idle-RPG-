// Pure formulas. No state, no content lookups. See docs/TROOP_MODEL.md §5.

import type { Modifier, Stat } from './types';

/** final = (base + Σ add) × (1 + Σ mult) for one stat. */
export function resolveStat(base: number, stat: Stat, modifiers: readonly Modifier[]): number {
  let add = 0;
  let mult = 0;
  for (const m of modifiers) {
    if (m.stat !== stat) continue;
    if (m.op === 'add') add += m.value;
    else mult += m.value;
  }
  return (base + add) * (1 + mult);
}

/** Damage one hit deals after armour: weak hits lose proportionally more. */
export function damagePerHit(attack: number, armour: number, armourPen: number): number {
  if (attack <= 0) return 0;
  const effArmour = Math.max(0, armour * (1 - armourPen));
  return (attack * attack) / (attack + effArmour);
}

/** One hit can kill at most one enemy (overkill is wasted). */
export function hitsPerKill(hp: number, perHit: number): number {
  if (perHit <= 0) return Infinity;
  return Math.max(1, hp / perHit);
}

/** Kills per second of a troop of `size` soldiers against one enemy type. */
export function killsPerSecond(
  size: number,
  attack: number,
  armourPen: number,
  enemy: { hp: number; armour: number },
  attacksPerSecond: number,
): number {
  const perHit = damagePerHit(attack, enemy.armour, armourPen);
  const hits = hitsPerKill(enemy.hp, perHit);
  return hits === Infinity ? 0 : (size * attacksPerSecond) / hits;
}

/** Raw damage per second against a single large target (bosses). */
export function dpsAgainst(size: number, attack: number, armourPen: number, armour: number, attacksPerSecond: number): number {
  return size * attacksPerSecond * damagePerHit(attack, armour, armourPen);
}

/**
 * Food cost of the next soldier when the troop already has `size` soldiers.
 * Flat up to `scaleSize`, then escalates so that combat income (which grows with size) can't snowball.
 */
export function soldierFoodCost(baseCost: number, size: number, scaleSize: number, exponent: number): number {
  return baseCost * Math.pow(Math.max(1, size / Math.max(1, scaleSize)), exponent);
}

/** Total food for recruiting `count` soldiers into a troop of `size`. */
export function recruitFoodCost(baseCost: number, size: number, count: number, scaleSize: number, exponent: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) total += soldierFoodCost(baseCost, size + i, scaleSize, exponent);
  return total;
}

export function troopCap(maxTroopSize: number, capLevel: number, fractions: readonly number[]): number {
  const i = Math.min(Math.max(0, capLevel), fractions.length - 1);
  return Math.round(maxTroopSize * (fractions[i] ?? 0));
}

export function xpForLevel(level: number, base: number, exponent: number): number {
  return level <= 1 ? 0 : Math.round(base * Math.pow(level - 1, exponent));
}

export function levelForXp(xp: number, base: number, exponent: number): number {
  let level = 1;
  while (xp + 1e-9 >= xpForLevel(level + 1, base, exponent)) level++;
  return level;
}
