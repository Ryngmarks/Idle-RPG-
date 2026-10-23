import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { craftCost, dispatch, maxCraftable, type Command } from './commands';
import {
  averageWeaponPower,
  craftedForMastery,
  equipBest,
  equippedCount,
  itemKey,
  masteryLevel,
  pickQuality,
  qualityChances,
  trimEquipment,
  weaponPower,
} from './equipment';
import { advance, catchUp } from './simulation';
import { newGame } from './state';
import { computeRates, troopStats } from './stats';
import { QUALITY_IDS, type GameState, type TroopState } from './types';

const recipe = content.equipment.recipes.sword_t1!;

function run(state: GameState, ...cmds: Command[]): GameState {
  for (const cmd of cmds) {
    const r = dispatch(state, cmd, content);
    if (!r.ok) throw new Error(`${cmd.type}: ${r.error}`);
    state = r.state;
  }
  return state;
}

/** Humans with a built forge, one troop of `size` soldiers smithing, and plenty of materials. */
function withForge(size = 20, raceId = 'humans'): GameState {
  const s = newGame(raceId, content);
  s.unlocks.push('activity:combat', 'activity:smithing', 'recruit', 'crafting', 'tier:1');
  s.objectivesCompleted = content.objectives.map((o) => o.id);
  s.buildings.forge = 1;
  s.troops[0]!.size = size;
  s.troops[0]!.engagedSize = size;
  s.troops[0]!.activity = 'smithing';
  // Most tests look at the armoury itself; auto-equip has its own tests.
  s.troops[0]!.autoEquip = false;
  s.resources = { food: 0, wood: 10_000, stone: 0, ore: 10_000 };
  return s;
}

/** Seconds per weapon with the current smiths. */
function secPerItem(s: GameState): number {
  return recipe.workPerItem / computeRates(s, content).craftWorkPerSec;
}

function troop(state: GameState): TroopState {
  return state.troops[0]!;
}

describe('weapon model (T1–T8 × 5 qualities)', () => {
  it('has eight tiers and five qualities; Masterpiece of tier N equals Normal of tier N+1', () => {
    expect(content.equipment.tiers).toHaveLength(8);
    expect(content.equipment.qualities.map((q) => q.id)).toEqual([...QUALITY_IDS]);
    for (let t = 1; t < 8; t++) {
      expect(weaponPower(t, 'masterpiece', content)).toBeCloseTo(weaponPower(t + 1, 'normal', content));
    }
    expect(weaponPower(1, 'normal', content)).toBeGreaterThan(content.equipment.unarmedMult);
  });

  it('only T1 recipes exist to craft; T2+ are data only', () => {
    expect(Object.values(content.equipment.recipes).every((r) => r.tier === 1)).toBe(true);
    const s = withForge();
    expect(s.unlocks).not.toContain('tier:2');
  });

  it('each race uses its own weapon type and cannot craft the others', () => {
    const s = withForge();
    expect(troop(s).weaponTypeId).toBe('sword');
    expect(dispatch(s, { type: 'queueCraft', recipeId: 'cleaver_t1', count: 1 }, content).ok).toBe(false);
    expect(newGame('orcs', content).troops[0]!.weaponTypeId).toBe('cleaver');
  });
});

describe('crafting', () => {
  it('needs the forge, pays materials up front and makes weapons over time into the armoury', () => {
    expect(dispatch(newGame('humans', content), { type: 'queueCraft', recipeId: 'sword_t1', count: 1 }, content).ok).toBe(false);
    let s = run(withForge(), { type: 'queueCraft', recipeId: 'sword_t1', count: 3 });
    expect(s.resources.ore).toBe(10_000 - 3 * recipe.materials.ore!);
    expect(s.resources.wood).toBe(10_000 - 3 * recipe.materials.wood!);
    const perItem = secPerItem(s);
    s = advance(s, perItem * 2 + 0.5, content).state;
    expect(s.stats.weaponsCrafted).toBe(2);
    expect(s.armoury[itemKey('sword', 1, 'normal')]).toBe(2);
    s = advance(s, perItem, content).state;
    expect(s.stats.weaponsCrafted).toBe(3);
    expect(s.crafting.queue).toHaveLength(0);
  });

  it('the forge only works while a troop is smithing', () => {
    let s = run(withForge(), { type: 'queueCraft', recipeId: 'sword_t1', count: 5 });
    s.troops[0]!.activity = 'combat';
    expect(computeRates(s, content).craftWorkPerSec).toBe(0);
    s = advance(s, 600, content).state;
    expect(s.stats.weaponsCrafted).toBe(0);
    s = run(s, { type: 'assignTroop', troopId: 'troop1', activity: 'smithing' });
    s = advance(s, 600, content).state;
    expect(s.stats.weaponsCrafted).toBe(5);
  });

  it('smithing speed grows with troop size and follows the race skill', () => {
    const rate = (size: number, raceId: string) => {
      const s = run(withForge(size, raceId), { type: 'queueCraft', recipeId: raceId === 'orcs' ? 'cleaver_t1' : 'sword_t1', count: 1 });
      return computeRates(s, content).craftWorkPerSec;
    };
    expect(rate(20, 'humans')).toBeCloseTo(2 * rate(10, 'humans'));
    expect(rate(10, 'humans')).toBeCloseTo(10 * 1 * content.races.humans!.soldier.skills.smithing * content.constants.smithRate);
    expect(rate(10, 'orcs')).toBeLessThan(rate(10, 'humans')); // Orcs are cruder smiths per soldier
  });

  it('smiths without an order produce no work', () => {
    expect(computeRates(withForge(), content).craftWorkPerSec).toBe(0);
  });

  it('cancelling refunds the materials of the remaining weapons', () => {
    let s = run(withForge(), { type: 'queueCraft', recipeId: 'sword_t1', count: 4 });
    s = run(s, { type: 'cancelCraft', index: 0 });
    expect(s.resources).toMatchObject({ ore: 10_000, wood: 10_000 });
  });

  it('maxCraftable and craftCost agree with what queueCraft accepts', () => {
    const s = withForge();
    s.resources.ore = 7;
    const n = maxCraftable(s, 'sword_t1', content);
    expect(n).toBe(Math.floor(7 / recipe.materials.ore!));
    expect(craftCost('sword_t1', n, content).ore).toBeLessThanOrEqual(7);
    expect(dispatch(s, { type: 'queueCraft', recipeId: 'sword_t1', count: n + 1 }, content).ok).toBe(false);
  });

  it('quality follows mastery deterministically: a novice makes mostly Normal, never Masterpiece', () => {
    let s = run(withForge(), { type: 'queueCraft', recipeId: 'sword_t1', count: 40 });
    s = advance(s, 40 * secPerItem(s) + 1, content).state;
    const count = (q: string) => s.armoury[itemKey('sword', 1, q as never)] ?? 0;
    expect(count('normal')).toBeGreaterThan(25);
    expect(count('masterpiece')).toBe(0);
    expect(QUALITY_IDS.reduce((n, q) => n + count(q), 0)).toBe(40);
  });

  it('the distribution matches the chances exactly over many weapons', () => {
    const chances = qualityChances(5, content);
    let carry: number[] = [];
    const tally = [0, 0, 0, 0, 0];
    for (let i = 0; i < 1000; i++) {
      const p = pickQuality(carry, chances);
      carry = p.carry;
      tally[QUALITY_IDS.indexOf(p.quality)]!++;
    }
    tally.forEach((n, i) => expect(Math.abs(n - chances[i]! * 1000)).toBeLessThanOrEqual(1));
  });

  it('mastery grows slowly: max quality chances need hundreds of weapons', () => {
    expect(masteryLevel(0, content)).toBe(0);
    expect(masteryLevel(craftedForMastery(1, content), content)).toBe(1);
    const toMax = craftedForMastery(content.equipment.maxMastery, content);
    expect(toMax).toBeGreaterThanOrEqual(500);
    const tenSmiths = 10 * content.races.humans!.soldier.skills.smithing * content.constants.smithRate;
    const hours = (toMax * recipe.workPerItem) / tenSmiths / 3600;
    expect(hours).toBeGreaterThan(2); // ten Human smiths need hours of smithing to max T1
    expect(qualityChances(content.equipment.maxMastery, content)[4]).toBeGreaterThan(0);
    expect(qualityChances(0, content)[4]).toBe(0);
  });

  it('crafting is step-size independent (offline equals online)', () => {
    const s = run(withForge(), { type: 'queueCraft', recipeId: 'sword_t1', count: 120 });
    const once = advance(s, 3600, content).state;
    let many = s;
    for (let i = 0; i < 360; i++) many = advance(many, 10, content).state;
    expect(many.armoury).toEqual(once.armoury);
    expect(many.crafting.crafted).toEqual(once.crafting.crafted);
    expect(catchUp(s, 3600, 8 * 3600, content).state.armoury).toEqual(once.armoury);
  });
});

describe('equipping from the armoury', () => {
  it('arms the troop with the best weapons and leaves the rest in the armoury', () => {
    const s = withForge(10);
    s.armoury = { [itemKey('sword', 1, 'normal')]: 8, [itemKey('sword', 1, 'excellent')]: 3, [itemKey('cleaver', 1, 'masterpiece')]: 5 };
    const r = run(s, { type: 'equipTroop', troopId: 'troop1' });
    expect(troop(r).equipment).toEqual([
      { tier: 1, quality: 'excellent', count: 3 },
      { tier: 1, quality: 'normal', count: 7 },
    ]);
    expect(r.armoury).toEqual({ [itemKey('sword', 1, 'normal')]: 1, [itemKey('cleaver', 1, 'masterpiece')]: 5 });
  });

  it('upgrades: better weapons replace worse ones, which go back to the armoury', () => {
    const s = withForge(5);
    troop(s).equipment = [{ tier: 1, quality: 'normal', count: 5 }];
    s.armoury = { [itemKey('sword', 1, 'good')]: 2 };
    const r = run(s, { type: 'equipTroop', troopId: 'troop1' });
    expect(troop(r).equipment).toEqual([
      { tier: 1, quality: 'good', count: 2 },
      { tier: 1, quality: 'normal', count: 3 },
    ]);
    expect(r.armoury).toEqual({ [itemKey('sword', 1, 'normal')]: 2 });
  });

  it('unequip returns everything to the armoury', () => {
    const s = withForge(5);
    troop(s).equipment = [{ tier: 1, quality: 'good', count: 4 }];
    const r = run(s, { type: 'unequipTroop', troopId: 'troop1' });
    expect(troop(r).equipment).toEqual([]);
    expect(r.armoury[itemKey('sword', 1, 'good')]).toBe(4);
  });

  it('a troop can mix qualities (owner example: 75 Normal, 15 Good, 10 Excellent)', () => {
    const s = withForge(100);
    s.armoury = { [itemKey('sword', 1, 'normal')]: 75, [itemKey('sword', 1, 'good')]: 15, [itemKey('sword', 1, 'excellent')]: 10 };
    const r = run(s, { type: 'equipTroop', troopId: 'troop1' });
    expect(equippedCount(troop(r))).toBe(100);
    const expected = (75 * weaponPower(1, 'normal', content) + 15 * weaponPower(1, 'good', content) + 10 * weaponPower(1, 'excellent', content)) / 100;
    expect(averageWeaponPower(troop(r), content)).toBeCloseTo(expected);
  });

  it('handles thousands of soldiers with a handful of buckets', () => {
    const s = withForge(5000);
    s.armoury = Object.fromEntries(QUALITY_IDS.map((q) => [itemKey('sword', 1, q), 1200]));
    const r = run(s, { type: 'equipTroop', troopId: 'troop1' });
    expect(troop(r).equipment.length).toBeLessThanOrEqual(5);
    expect(equippedCount(troop(r))).toBe(5000);
    expect(troop(r).equipment[0]!.quality).toBe('masterpiece');
  });
});

describe('auto-equip', () => {
  const auto = (s: GameState) => {
    for (const t of s.troops) t.autoEquip = true;
    return s;
  };

  it('finished weapons go straight into the hands of a troop that arms itself', () => {
    const s = auto(withForge(20));
    const r = advance(run(s, { type: 'queueCraft', recipeId: recipe.id, count: 5 }), 5 * secPerItem(s) + 1, content).state;
    expect(equippedCount(troop(r))).toBe(5);
    expect(Object.values(r.armoury).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('swaps worse weapons for better ones and keeps the rest in the armoury', () => {
    const s = auto(withForge(3));
    troop(s).equipment = [{ tier: 1, quality: 'normal', count: 3 }];
    s.armoury = { [itemKey('sword', 1, 'excellent')]: 1 };
    const r = run(s, { type: 'renameTroop', troopId: 'troop1', name: 'Test' });
    expect(troop(r).equipment[0]).toEqual({ tier: 1, quality: 'excellent', count: 1 });
    expect(r.armoury).toEqual({ [itemKey('sword', 1, 'normal')]: 1 });
  });

  it('new recruits are armed from the armoury at once', () => {
    const s = auto(withForge(5));
    s.unlocks.push('recruit');
    s.resources.food = 1000;
    s.armoury = { [itemKey('sword', 1, 'normal')]: 10 };
    const r = run(s, { type: 'recruit', troopId: 'troop1', count: 3 });
    expect(equippedCount(troop(r))).toBe(8);
  });

  it('the fighting troop chooses first', () => {
    const s = auto(withForge(4));
    s.troops.push({ ...troop(s), id: 'troop2', name: 'B', activity: 'combat', equipment: [] });
    s.armoury = { [itemKey('sword', 1, 'good')]: 4 };
    const r = run(s, { type: 'setAutoEquip', troopId: 'troop1', on: true });
    expect(equippedCount(r.troops[1]!)).toBe(4);
    expect(equippedCount(r.troops[0]!)).toBe(0);
  });

  it('switching activity hands the best weapons to whoever fights', () => {
    const s = auto(withForge(4));
    s.unlocks.push('activity:food');
    troop(s).equipment = [{ tier: 1, quality: 'excellent', count: 4 }];
    s.troops.push({ ...troop(s), id: 'troop2', name: 'B', activity: 'food', equipment: [{ tier: 1, quality: 'normal', count: 4 }] });
    const r = run(s, { type: 'assignTroop', troopId: 'troop2', activity: 'combat' });
    expect(r.troops[1]!.equipment).toEqual([{ tier: 1, quality: 'excellent', count: 4 }]);
    expect(r.troops[0]!.equipment).toEqual([{ tier: 1, quality: 'normal', count: 4 }]);
  });

  it('emptying a troop by hand turns auto-equip off, so the weapons stay in the armoury', () => {
    const s = auto(withForge(5));
    troop(s).equipment = [{ tier: 1, quality: 'good', count: 5 }];
    const r = run(s, { type: 'unequipTroop', troopId: 'troop1' });
    expect(troop(r).autoEquip).toBe(false);
    expect(equippedCount(troop(r))).toBe(0);
    const back = run(r, { type: 'setAutoEquip', troopId: 'troop1', on: true });
    expect(equippedCount(troop(back))).toBe(5);
  });

  it('offline crafting arms the troop exactly like online play', () => {
    const s = run(auto(withForge(30)), { type: 'queueCraft', recipeId: recipe.id, count: 20 });
    const online = Array.from({ length: 60 }).reduce<GameState>((st) => advance(st, 5, content).state, s);
    const offline = advance(s, 300, content).state;
    expect(troop(offline).equipment).toEqual(troop(online).equipment);
  });
});

describe('combat uses the actual equipment', () => {
  it('armed soldiers kill faster than unarmed, better quality faster still, unarmed remainder still fights', () => {
    const kills = (equip: TroopState['equipment']) => {
      const s = withForge(10);
      troop(s).equipment = equip;
      troop(s).activity = 'combat';
      s.combat.unlockedStage = 3;
      s.combat.stageIndex = 3; // boars: armour makes attack matter
      return computeRates(s, content).killsPerSec;
    };
    const none = kills([]);
    const half = kills([{ tier: 1, quality: 'normal', count: 5 }]);
    const normal = kills([{ tier: 1, quality: 'normal', count: 10 }]);
    const excellent = kills([{ tier: 1, quality: 'excellent', count: 10 }]);
    expect(half).toBeGreaterThan(none);
    expect(normal).toBeGreaterThan(half);
    expect(excellent).toBeGreaterThan(normal);
  });

  it('troop strength shows the weapons', () => {
    const s = withForge(10);
    const before = troopStats(s, troop(s), content).strength;
    troop(s).equipment = [{ tier: 1, quality: 'normal', count: 10 }];
    expect(troopStats(s, troop(s), content).strength).toBeCloseTo(before * weaponPower(1, 'normal', content));
  });

  it('fallen soldiers lose weapons, unarmed first and then the worst', () => {
    const t = { ...troop(withForge(6)) };
    t.equipment = [{ tier: 1, quality: 'excellent', count: 2 }, { tier: 1, quality: 'normal', count: 2 }];
    t.size = 4; // two unarmed fell: no weapon lost
    trimEquipment(t);
    expect(equippedCount(t)).toBe(4);
    t.size = 3; // one more falls: a Normal sword is lost
    trimEquipment(t);
    expect(t.equipment).toEqual([{ tier: 1, quality: 'excellent', count: 2 }, { tier: 1, quality: 'normal', count: 1 }]);
  });

  it('casualties in the simulation keep Σ equipped ≤ size', () => {
    const s = withForge(8);
    troop(s).equipment = [{ tier: 1, quality: 'good', count: 8 }];
    s.combat.unlockedStage = 4;
    s.combat.stageIndex = 4;
    troop(s).activity = 'combat';
    const r = advance(s, 600, content).state;
    expect(troop(r).size).toBeLessThan(8);
    expect(equippedCount(troop(r))).toBeLessThanOrEqual(troop(r).size);
  });

  it('equipBest is idempotent', () => {
    const s = withForge(10);
    s.armoury = { [itemKey('sword', 1, 'good')]: 4, [itemKey('sword', 1, 'normal')]: 9 };
    equipBest(troop(s), s.armoury, content);
    const first = JSON.stringify([troop(s).equipment, s.armoury]);
    equipBest(troop(s), s.armoury, content);
    expect(JSON.stringify([troop(s).equipment, s.armoury])).toBe(first);
  });
});
