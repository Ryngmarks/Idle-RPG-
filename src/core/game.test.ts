import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { dispatch, maxRecruitable, recruitCost, type Command } from './commands';
import { recruitFoodCost } from './formulas';
import { deserialize, serialize } from './save';
import { advance, catchUp } from './simulation';
import { newGame } from './state';
import { computeRates, currentCap, troopStats } from './stats';
import type { GameState } from './types';

function run(state: GameState, ...cmds: Command[]): GameState {
  for (const cmd of cmds) {
    const r = dispatch(state, cmd, content);
    if (!r.ok) throw new Error(`${cmd.type}: ${r.error}`);
    state = r.state;
  }
  return state;
}

/** A state where everything in P0 is unlocked, for focused tests. */
function sandbox(raceId = 'humans'): GameState {
  const s = newGame(raceId, content);
  s.unlocks = [
    'activity:combat', 'activity:mining', 'activity:woodcutting', 'activity:food', 'activity:construction',
    'recruit', 'building:trainingCamp', 'building:barracks', 'building:farm', 'building:forge', 'gear:1',
  ];
  // Mark the tutorial chain as done so objectives don't interfere.
  s.objectivesCompleted = content.objectives.map((o) => o.id);
  return s;
}

describe('new game', () => {
  it('starts with one small troop and only woodcutting unlocked (FIRST_15_MINUTES §2)', () => {
    const s = newGame('humans', content);
    expect(s.troops).toHaveLength(1);
    expect(s.troops[0]).toMatchObject({ name: 'Norra Väktarna', size: 5, activity: null });
    expect(currentCap(s, content)).toBe(20);
    expect(s.unlocks).toEqual(['activity:woodcutting']);
    const stats = troopStats(s, s.troops[0]!, content);
    expect(stats.strength).toBe(5);
    expect(stats.workTotal).toBe(5);
  });

  it('Orcs start bigger with a bigger cap', () => {
    const s = newGame('orcs', content);
    expect(s.troops[0]!.size).toBe(10);
    expect(currentCap(s, content)).toBe(40);
  });

  it('locked races cannot be chosen', () => {
    expect(() => newGame('dwarves', content)).toThrow();
  });
});

describe('activities', () => {
  it('5 Humans cut 5 wood every 10 seconds', () => {
    let s = run(newGame('humans', content), { type: 'assignTroop', troopId: 'troop1', activity: 'woodcutting' });
    s = advance(s, 10, content).state;
    expect(s.resources.wood).toBeCloseTo(5);
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

  it('combat yields food and XP and clears stages', () => {
    let s = run(sandbox(), { type: 'assignTroop', troopId: 'troop1', activity: 'combat' });
    // 5 DPS vs 30 HP chicken: one kill per 6 s; stage 1 needs 15 kills.
    s = advance(s, 6 * 15, content).state;
    expect(s.combat.stageIndex).toBe(1);
    expect(s.stats.totalKills).toBeCloseTo(15);
    const chicken = content.enemies.wildChicken!;
    expect(s.resources.food).toBeCloseTo(15 * chicken.loot.food!);
    expect(s.troops[0]!.xp).toBeCloseTo(15 * chicken.xp);
  });
});

describe('recruitment', () => {
  it('costs escalating food per soldier and respects the cap', () => {
    let s = sandbox();
    s.resources.food = 1000;
    expect(recruitCost(s, 'troop1', 1, content).food).toBe(5); // first recruit: base cost
    const cost15 = recruitFoodCost(5, 5, 15, 5, content.constants.recruitExponent);
    expect(cost15).toBeGreaterThan(15 * 5);
    s = run(s, { type: 'recruit', troopId: 'troop1', count: 15 });
    expect(s.troops[0]!.size).toBe(20);
    expect(s.resources.food).toBeCloseTo(1000 - cost15);
    expect(dispatch(s, { type: 'recruit', troopId: 'troop1', count: 1 }, content).ok).toBe(false);
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

  it('equipped troops also pay ore for new recruits', () => {
    let s = sandbox();
    s.resources = { food: 100, wood: 0, stone: 0, ore: 100 };
    s = run(s, { type: 'upgradeGear', troopId: 'troop1' });
    expect(s.resources.ore).toBe(100 - 5 * 3);
    s = run(s, { type: 'recruit', troopId: 'troop1', count: 2 });
    expect(s.resources.ore).toBe(85 - 2 * 3);
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
    expect(state.troops[1]).toMatchObject({ name: 'Skogsarbetarna', size: 3 });
    expect(events.map((e) => e.type)).toContain('troopFormed');
    const done = events.find((e) => e.type === 'constructionCompleted');
    expect(done?.at).toBeCloseTo(camp.work / 6);
  });
});

describe('objectives drive the tutorial', () => {
  it('woodcutting unlocks upgrades, then combat', () => {
    let s = run(newGame('humans', content), { type: 'assignTroop', troopId: 'troop1', activity: 'woodcutting' });
    expect(s.objectivesCompleted).toContain('sendWood');
    s = advance(s, 60, content).state; // 30 wood
    expect(s.unlocks).toContain('upgrade:sharpenedAxes');
    expect(s.unlocks).not.toContain('activity:combat');
    s = advance(s, 60, content).state; // 60 wood
    expect(s.unlocks).toContain('activity:combat');
  });
});

describe('boss', () => {
  it('can be won or lost within the time limit', () => {
    let s = sandbox();
    s.unlocks.push('boss');
    s.troops[0]!.size = 20;
    s = run(s, { type: 'assignTroop', troopId: 'troop1', activity: 'combat' }, { type: 'challengeBoss' });
    const lost = advance(s, 120, content);
    expect(lost.events.map((e) => e.type)).toContain('bossFailed');
    expect(lost.state.combat.boss).toBeNull();

    s.troops[0]!.size = 20000; // absurd army wins
    const won = advance(s, 60, content);
    expect(won.state.combat.bossDefeated).toBe(true);
  });
});

describe('offline equivalence', () => {
  it('one long advance equals many short ones', () => {
    let s = sandbox('orcs');
    s.resources = { food: 200, wood: 100, stone: 100, ore: 0 };
    s = run(
      s,
      { type: 'recruit', troopId: 'troop1', count: 30 },
      { type: 'startConstruction', buildingId: 'trainingCamp' },
      { type: 'assignTroop', troopId: 'troop1', activity: 'construction' },
    );
    const once = advance(s, 1800, content).state;
    let many = s;
    for (let i = 0; i < 1800; i++) {
      many = advance(many, 1, content).state;
    }
    expect(many.buildings).toEqual(once.buildings);
    expect(many.troops.map((t) => t.size)).toEqual(once.troops.map((t) => t.size));
    for (const r of ['food', 'wood', 'stone', 'ore'] as const) {
      expect(many.resources[r]).toBeCloseTo(once.resources[r], 6);
    }
  });

  it('combat with stage changes and level-ups is step-size independent', () => {
    const s = run(sandbox(), { type: 'assignTroop', troopId: 'troop1', activity: 'combat' });
    const once = advance(s, 3600, content).state;
    let many = s;
    for (let i = 0; i < 360; i++) many = advance(many, 10, content).state;
    expect(many.combat.stageIndex).toBe(once.combat.stageIndex);
    expect(many.troops[0]!.xp).toBeCloseTo(once.troops[0]!.xp, 6);
    expect(many.resources.food).toBeCloseTo(once.resources.food, 6);
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
});
