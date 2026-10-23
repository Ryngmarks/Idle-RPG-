import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { dispatch, maxRecruitable, recruitCost, type Command } from './commands';
import { recruitFoodCost } from './formulas';
import { deserialize, serialize } from './save';
import { advance, catchUp } from './simulation';
import { newGame } from './state';
import { computeRates, currentCap, stageSafety, troopStats } from './stats';
import type { GameState } from './types';

function run(state: GameState, ...cmds: Command[]): GameState {
  for (const cmd of cmds) {
    const r = dispatch(state, cmd, content);
    if (!r.ok) throw new Error(`${cmd.type}: ${r.error}`);
    state = r.state;
  }
  return state;
}

/** A state where everything in P0 is unlocked and Troop 1 has `size` soldiers, for focused tests. */
function sandbox(raceId = 'humans', size = 5): GameState {
  const s = newGame(raceId, content);
  s.unlocks = [
    'activity:combat', 'activity:mining', 'activity:woodcutting', 'activity:food', 'activity:construction',
    'recruit', 'building:trainingCamp', 'building:barracks', 'building:farm', 'building:forge', 'gear:1',
  ];
  // Mark the tutorial chain as done so objectives don't interfere.
  s.objectivesCompleted = content.objectives.map((o) => o.id);
  s.troops[0]!.size = size;
  s.troops[0]!.engagedSize = size;
  return s;
}

/** Open stages up to (0-based) `index` and fight there. */
function atStage(s: GameState, index: number): GameState {
  s.combat.unlockedStage = Math.max(s.combat.unlockedStage, index);
  return run(s, { type: 'selectStage', stageIndex: index }, { type: 'assignTroop', troopId: 'troop1', activity: 'combat' });
}

describe('new game', () => {
  it('starts with a single soldier and only woodcutting unlocked', () => {
    const s = newGame('humans', content);
    expect(s.troops).toHaveLength(1);
    expect(s.troops[0]).toMatchObject({ name: 'Norra Väktarna', size: 1, activity: null, wounds: 0 });
    expect(currentCap(s, content)).toBe(20);
    expect(s.unlocks).toEqual(['activity:woodcutting']);
    const stats = troopStats(s, s.troops[0]!, content);
    expect(stats.strength).toBe(1);
    expect(stats.workTotal).toBe(1);
    expect(stats.maxHp).toBe(10);
  });

  it('Orcs also start with one soldier but have a bigger cap', () => {
    const s = newGame('orcs', content);
    expect(s.troops[0]!.size).toBe(1);
    expect(currentCap(s, content)).toBe(40);
  });

  it('locked races cannot be chosen', () => {
    expect(() => newGame('dwarves', content)).toThrow();
  });
});

describe('activities', () => {
  it('one Human cuts 1 wood every 10 seconds, five cut 5', () => {
    let s = run(newGame('humans', content), { type: 'assignTroop', troopId: 'troop1', activity: 'woodcutting' });
    expect(advance(s, 10, content).state.resources.wood).toBeCloseTo(1);
    s = run(sandbox(), { type: 'assignTroop', troopId: 'troop1', activity: 'woodcutting' });
    expect(advance(s, 10, content).state.resources.wood).toBeCloseTo(5);
  });

  it('locked activities are rejected', () => {
    const r = dispatch(newGame('humans', content), { type: 'assignTroop', troopId: 'troop1', activity: 'mining' }, content);
    expect(r.ok).toBe(false);
  });

  it('Humans are better at food, Orcs at wood (D-13), compared at each race\'s cap', () => {
    const output = (raceId: string, activity: 'food' | 'woodcutting') => {
      const s = run(sandbox(raceId), { type: 'assignTroop', troopId: 'troop1', activity });
      s.troops[0]!.size = currentCap(s, content);
      const r = computeRates(s, content);
      return activity === 'food' ? r.gathered.food : r.gathered.wood;
    };
    expect(output('humans', 'food')).toBeGreaterThan(output('orcs', 'food'));
    expect(output('orcs', 'woodcutting')).toBeGreaterThan(output('humans', 'woodcutting'));
  });
});

describe('combat progression', () => {
  const chicken = content.enemies.wildChicken!;
  const stage1 = content.zones.farmsteads!.stages[0]!;

  it('clearing the frontier stage opens the next one, but troops stay until the player advances', () => {
    let s = run(sandbox(), { type: 'assignTroop', troopId: 'troop1', activity: 'combat' });
    const secPerKill = chicken.hp / 5; // 5 soldiers × 1 damage
    s = advance(s, secPerKill * stage1.killsToClear, content).state;
    expect(s.combat.unlockedStage).toBe(1);
    expect(s.combat.stageIndex).toBe(0);
    expect(s.stats.totalKills).toBeCloseTo(stage1.killsToClear);
    expect(s.resources.food).toBeCloseTo(stage1.killsToClear * chicken.loot.food!);
    expect(s.troops[0]!.xp).toBeCloseTo(stage1.killsToClear * chicken.xp);
    s = run(s, { type: 'selectStage', stageIndex: 1 });
    expect(s.combat.stageIndex).toBe(1);
  });

  it('kills on an earlier stage do not count towards the frontier', () => {
    let s = sandbox();
    s.combat.unlockedStage = 1;
    s = run(s, { type: 'assignTroop', troopId: 'troop1', activity: 'combat' });
    s = advance(s, 300, content).state;
    expect(s.combat.kills).toBe(0);
    expect(s.combat.unlockedStage).toBe(1);
    expect(s.stats.totalKills).toBeGreaterThan(50);
  });

  it('locked stages cannot be selected', () => {
    expect(dispatch(sandbox(), { type: 'selectStage', stageIndex: 2 }, content).ok).toBe(false);
  });
});

describe('life, casualties and retreat', () => {
  it('a safe stage costs nothing, even for an hour', () => {
    const s = atStage(sandbox(), 0);
    expect(stageSafety(s, content, { stageIndex: 0 }).risk).toBe('safe');
    const r = advance(s, 3600, content);
    expect(r.state.troops[0]!.size).toBe(5);
    expect(r.events.some((e) => e.type === 'soldierLost')).toBe(false);
  });

  it('a too-hard stage kills soldiers until half the troop has fallen, then it retreats', () => {
    const s = atStage(sandbox('humans', 6), 3); // boars
    const safety = stageSafety(s, content, { stageIndex: 3 });
    expect(safety.risk).toBe('deadly');
    const r = advance(s, 600, content);
    const t = r.state.troops[0]!;
    expect(t.size).toBe(3); // lost half of 6
    expect(t.activity).toBeNull();
    expect(r.events.filter((e) => e.type === 'soldierLost')).toHaveLength(3);
    expect(r.state.stats.soldiersLost).toBe(3);
    expect(r.events.some((e) => e.type === 'troopRetreated')).toBe(true);
  });

  it('a troop never drops below one soldier', () => {
    const s = atStage(sandbox('humans', 1), 1); // a lone soldier against roosters
    const r = advance(s, 600, content);
    expect(r.state.troops[0]!.size).toBe(1);
    expect(r.state.troops[0]!.activity).toBeNull();
    expect(r.events.some((e) => e.type === 'soldierLost')).toBe(false);
  });

  it('wounds heal over time at camp', () => {
    const s = sandbox();
    s.troops[0]!.wounds = 5;
    const heal = troopStats(s, s.troops[0]!, content).healPerSec;
    const r = advance(s, 5 / heal + 1, content);
    expect(r.state.troops[0]!.wounds).toBe(0);
  });
});

describe('offline safety (no losses while away)', () => {
  it('falls back to the highest safe stage before simulating offline time', () => {
    const s = atStage(sandbox('humans', 6), 3);
    const r = catchUp(s, 3600, 8 * 3600, content);
    expect(r.state.combat.stageIndex).toBeLessThan(3);
    expect(r.state.troops[0]!.size).toBe(6);
    expect(r.events.some((e) => e.type === 'stageChanged')).toBe(true);
    expect(r.events.some((e) => e.type === 'soldierLost')).toBe(false);
  });

  it('retreats to camp if no stage is safe, and abandons a boss fight', () => {
    let s = sandbox('humans', 1);
    s.unlocks.push('boss');
    s.combat.cleared = true;
    s.combat.unlockedStage = 4;
    s = run(s, { type: 'selectStage', stageIndex: 1 }, { type: 'assignTroop', troopId: 'troop1', activity: 'combat' }, { type: 'challengeBoss' });
    const r = catchUp(s, 600, 8 * 3600, content);
    expect(r.state.combat.boss).toBeNull();
    expect(r.events.map((e) => e.type)).toContain('bossAbandoned');
    expect(r.state.troops[0]!.size).toBe(1);
  });
});

describe('recruitment', () => {
  it('costs escalating food per soldier and respects the cap', () => {
    let s = sandbox();
    s.resources.food = 1000;
    const scale = content.races.humans!.population.recruitScaleSize;
    expect(recruitCost(s, 'troop1', 1, content).food).toBe(5); // still at the flat base cost
    const cost15 = recruitFoodCost(5, 5, 15, scale, content.constants.recruitExponent);
    expect(cost15).toBeGreaterThan(15 * 5);
    s = run(s, { type: 'recruit', troopId: 'troop1', count: 15 });
    expect(s.troops[0]!.size).toBe(20);
    expect(s.resources.food).toBeCloseTo(1000 - cost15);
    expect(dispatch(s, { type: 'recruit', troopId: 'troop1', count: 1 }, content).ok).toBe(false);
  });

  it('the first recruits of a lone soldier cost the flat base price', () => {
    const s = sandbox('humans', 1);
    expect(recruitCost(s, 'troop1', 3, content).food).toBe(15);
  });

  it('maxRecruitable matches what recruit accepts', () => {
    for (const food of [0, 4, 5, 30, 100, 1000]) {
      const s = sandbox();
      s.resources.food = food;
      const n = maxRecruitable(s, 'troop1', content);
      if (n > 0) expect(dispatch(s, { type: 'recruit', troopId: 'troop1', count: n }, content).ok).toBe(true);
      if (n < 15) expect(dispatch(s, { type: 'recruit', troopId: 'troop1', count: n + 1 }, content).ok).toBe(false);
    }
  });

  it('recruiting into a fighting troop raises its retreat threshold', () => {
    let s = atStage(sandbox(), 0);
    s.resources.food = 100;
    s = run(s, { type: 'recruit', troopId: 'troop1', count: 2 });
    expect(s.troops[0]!.engagedSize).toBe(7);
  });

});

describe('Training Camp milestone', () => {
  it('pays materials, needs labour, then raises the cap and forms Troop 2', () => {
    const camp = content.buildings.trainingCamp!.levels[0]!;
    let s = sandbox();
    s.resources = { food: 0, wood: 0, stone: 0, ore: 0, ...camp.cost };
    s = run(s, { type: 'startConstruction', buildingId: 'trainingCamp' }, { type: 'assignTroop', troopId: 'troop1', activity: 'construction' });
    expect(s.resources).toEqual({ food: 0, wood: 0, stone: 0, ore: 0 });
    // 5 Humans × 1.2 = 6 work/s
    const { state, events } = advance(s, camp.work / 6 + 1, content);
    expect(state.buildings.trainingCamp).toBe(1);
    expect(currentCap(state, content)).toBe(40);
    expect(state.troops).toHaveLength(2);
    expect(state.troops[1]).toMatchObject({ name: 'Skogsarbetarna', size: content.races.humans!.population.newTroopSize });
    expect(events.map((e) => e.type)).toContain('troopFormed');
    const done = events.find((e) => e.type === 'constructionCompleted');
    expect(done?.at).toBeCloseTo(camp.work / 6);
  });
});

describe('objectives drive the tutorial', () => {
  it('woodcutting unlocks upgrades, then combat', () => {
    let s = run(newGame('humans', content), { type: 'assignTroop', troopId: 'troop1', activity: 'woodcutting' });
    expect(s.objectivesCompleted).toContain('sendWood');
    s = advance(s, 150, content).state; // 15 wood
    expect(s.unlocks).toContain('upgrade:sharpenedAxes');
    expect(s.unlocks).not.toContain('activity:combat');
    s = advance(s, 150, content).state; // 30 wood
    expect(s.unlocks).toContain('activity:combat');
  });
});

describe('boss', () => {
  it('can be won or lost within the time limit, and fighting it costs soldiers', () => {
    let s = sandbox('humans', 20);
    s.unlocks.push('boss');
    s = run(s, { type: 'assignTroop', troopId: 'troop1', activity: 'combat' }, { type: 'challengeBoss' });
    const lost = advance(s, 120, content);
    expect(lost.events.map((e) => e.type)).toContain('bossFailed');
    expect(lost.events.some((e) => e.type === 'soldierLost')).toBe(true);
    expect(lost.state.combat.boss).toBeNull();

    s.troops[0]!.size = 20000; // absurd army wins
    s.troops[0]!.engagedSize = 20000;
    const won = advance(s, 60, content);
    expect(won.state.combat.bossDefeated).toBe(true);
    expect(won.state.stats.bossDefeatedAt).toBe(won.events.find((e) => e.type === 'bossDefeated')!.at);
  });
});

describe('offline equivalence', () => {
  it('one long advance equals many short ones', () => {
    let s = sandbox('orcs', 10);
    s.resources = { food: 200, wood: 100, stone: 100, ore: 0 };
    s = run(
      s,
      { type: 'recruit', troopId: 'troop1', count: 30 },
      { type: 'startConstruction', buildingId: 'trainingCamp' },
      { type: 'assignTroop', troopId: 'troop1', activity: 'construction' },
    );
    const once = advance(s, 1800, content).state;
    let many = s;
    for (let i = 0; i < 1800; i++) many = advance(many, 1, content).state;
    expect(many.buildings).toEqual(once.buildings);
    expect(many.troops.map((t) => t.size)).toEqual(once.troops.map((t) => t.size));
    for (const r of ['food', 'wood', 'stone', 'ore'] as const) {
      expect(many.resources[r]).toBeCloseTo(once.resources[r], 6);
    }
  });

  it('combat with stage clears, level-ups, casualties and retreat is step-size independent', () => {
    for (const stage of [0, 3]) {
      const s = atStage(sandbox('humans', 12), stage);
      const once = advance(s, 3600, content).state;
      let many = s;
      for (let i = 0; i < 360; i++) many = advance(many, 10, content).state;
      expect(many.combat.unlockedStage).toBe(once.combat.unlockedStage);
      expect(many.troops[0]!.size).toBe(once.troops[0]!.size);
      expect(many.troops[0]!.activity).toBe(once.troops[0]!.activity);
      expect(many.troops[0]!.xp).toBeCloseTo(once.troops[0]!.xp, 6);
      expect(many.troops[0]!.wounds).toBeCloseTo(once.troops[0]!.wounds, 6);
      expect(many.resources.food).toBeCloseTo(once.resources.food, 6);
    }
  });

  it('catchUp clamps to the offline cap and ignores negative time', () => {
    const s = run(newGame('humans', content), { type: 'assignTroop', troopId: 'troop1', activity: 'woodcutting' });
    expect(catchUp(s, 99_999, 100, content).simulatedSec).toBe(100);
    expect(catchUp(s, -50, 100, content).state.resources.wood).toBe(0);
  });
});

describe('save', () => {
  it('round-trips and rejects saves from the future', () => {
    const s = run(newGame('humans', content), { type: 'renameTroop', troopId: 'troop1', name: 'Gryningsvakten' });
    expect(deserialize(serialize(s))).toEqual(s);
    expect(() => deserialize(JSON.stringify({ ...s, version: 999 }))).toThrow();
    expect(() => deserialize('{}')).toThrow();
  });

  it('migrates a version 1 save (before combat with life and real weapons)', () => {
    const v1 = JSON.parse(serialize(sandbox('orcs', 12))) as Record<string, any>;
    v1.version = 1;
    for (const t of v1.troops) {
      delete t.wounds;
      delete t.engagedSize;
      delete t.weaponTypeId;
      delete t.equipment;
      t.gearTier = 1; // had the old ×1.4 iron weapons
    }
    delete v1.armoury;
    delete v1.crafting;
    delete v1.stats.weaponsCrafted;
    v1.buildings.forge = 1;
    v1.combat.stageIndex = 2;
    delete v1.combat.unlockedStage;
    const s = deserialize(JSON.stringify(v1));
    expect(s.version).toBe(6);
    expect(s.stats).toMatchObject({ soldiersLost: 0, bossDefeatedAt: null, weaponsByQuality: { normal: 0, masterpiece: 0 } });
    expect(s.troops[0]!.autoEquip).toBe(true);
    expect(s.troops[0]).toMatchObject({ wounds: 0, engagedSize: 12, weaponTypeId: 'cleaver' });
    expect(s.troops[0]!.equipment).toEqual([{ tier: 1, quality: 'normal', count: 12 }]);
    expect(s.troops[0]).not.toHaveProperty('gearTier');
    expect(s.combat.unlockedStage).toBe(2);
    expect(s.unlocks).toEqual(expect.arrayContaining(['crafting', 'tier:1', 'activity:smithing']));
    expect(s.crafting).toEqual({ queue: [], progress: 0, crafted: {}, carry: {} });
    expect(advance(s, 60, content).state.clock).toBeGreaterThan(0);
  });
});
