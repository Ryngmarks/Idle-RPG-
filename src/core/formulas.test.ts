import { describe, expect, it } from 'vitest';
import { damagePerHit, dpsAgainst, killsPerSecond, levelForXp, resolveStat, xpForLevel } from './formulas';

describe('combat formulas (docs/TROOP_MODEL.md §5.3 worked example)', () => {
  const rats = { hp: 1, armour: 0 };
  const boar = { hp: 20, armour: 2 };

  it('armour hurts weak hits proportionally more', () => {
    expect(damagePerHit(1, 0, 0)).toBe(1);
    expect(damagePerHit(1, 2, 0)).toBeCloseTo(1 / 3);
    expect(damagePerHit(2.5, 2, 0)).toBeCloseTo(6.25 / 4.5);
    expect(damagePerHit(2.6, 2, 0.5)).toBeCloseTo(6.76 / 3.6);
  });

  it('overkill: one hit kills at most one enemy, so hordes win against swarms', () => {
    expect(killsPerSecond(500, 1, 0, rats, 1)).toBeCloseTo(500); // Humans
    expect(killsPerSecond(1000, 0.6, 0, rats, 1)).toBeCloseTo(600); // Orcs with full Horde
    expect(killsPerSecond(200, 2.5, 0, rats, 1)).toBeCloseTo(200); // Dwarves waste damage
  });

  it('quality wins against armour', () => {
    expect(killsPerSecond(500, 1, 0, boar, 1)).toBeCloseTo(8.33, 1);
    expect(killsPerSecond(1000, 0.6, 0, boar, 1)).toBeCloseTo(6.92, 1);
    expect(killsPerSecond(200, 2.5, 0, boar, 1)).toBeCloseTo(13.9, 1);
    expect(killsPerSecond(150, 2.6, 0.5, boar, 1)).toBeCloseTo(14.1, 1);
  });

  it('boss DPS matches the worked example', () => {
    expect(dpsAgainst(500, 1, 0, 1, 1)).toBeCloseTo(250);
    expect(dpsAgainst(1000, 0.6, 0, 1, 1)).toBeCloseTo(225);
    expect(dpsAgainst(200, 2.5, 0, 1, 1)).toBeCloseTo(357, 0);
  });

  it('zero attack deals no damage instead of dividing by zero', () => {
    expect(killsPerSecond(10, 0, 0, rats, 1)).toBe(0);
  });
});

describe('modifiers', () => {
  it('resolves (base + Σadd) × (1 + Σmult) for the matching stat only', () => {
    const mods = [
      { stat: 'attack' as const, op: 'add' as const, value: 1, source: 'a' },
      { stat: 'attack' as const, op: 'mult' as const, value: 0.5, source: 'b' },
      { stat: 'attack' as const, op: 'mult' as const, value: 0.25, source: 'c' },
      { stat: 'work' as const, op: 'mult' as const, value: 10, source: 'd' },
    ];
    expect(resolveStat(2, 'attack', mods)).toBeCloseTo(3 * 1.75);
  });
});

describe('caps and levels', () => {
  it('xp thresholds and levels are consistent', () => {
    expect(xpForLevel(1, 30, 1.8)).toBe(0);
    expect(xpForLevel(2, 30, 1.8)).toBe(30);
    expect(levelForXp(29.9, 30, 1.8)).toBe(1);
    expect(levelForXp(30, 30, 1.8)).toBe(2);
    expect(levelForXp(xpForLevel(5, 30, 1.8), 30, 1.8)).toBe(5);
  });
});
