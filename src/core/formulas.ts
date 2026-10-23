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
 * XP needed to reach `level`: base × (L−1)^exponent up to the knee level, then the same curve continued with the
 * steeper `lateExponent` (continuous at the knee). Without a knee it is the plain power curve.
 */
export function xpForLevel(level: number, base: number, exponent: number, kneeLevel = Infinity, lateExponent = exponent): number {
  if (level <= 1) return 0;
  if (level <= kneeLevel) return Math.round(base * Math.pow(level - 1, exponent));
  const atKnee = base * Math.pow(kneeLevel - 1, exponent);
  return Math.round(atKnee * Math.pow((level - 1) / (kneeLevel - 1), lateExponent));
}

/** Inverse of xpForLevel: a closed-form guess, then a few steps to land exactly on the rounded table. */
export function levelForXp(xp: number, base: number, exponent: number, kneeLevel = Infinity, lateExponent = exponent): number {
  if (!(xp > 0)) return 1;
  const atKnee = base * Math.pow(kneeLevel - 1, exponent);
  const guess = xp <= atKnee || kneeLevel === Infinity
    ? Math.pow(xp / base, 1 / exponent) + 1
    : (kneeLevel - 1) * Math.pow(xp / atKnee, 1 / lateExponent) + 1;
  let level = Math.max(1, Math.floor(guess));
  while (level > 1 && xp + 1e-9 < xpForLevel(level, base, exponent, kneeLevel, lateExponent)) level--;
  while (xp + 1e-9 >= xpForLevel(level + 1, base, exponent, kneeLevel, lateExponent)) level++;
  return level;
}
