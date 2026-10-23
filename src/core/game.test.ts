import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { dispatch, trainBlocker, trainCost, type Command } from './commands';
import { deserialize, serialize } from './save';
import { advance, catchUp } from './simulation';
import { newGame } from './state';
import { xpForLevel } from './formulas';
import { beds, capacity, computeRates, freeBeds, stageSafety, troopStats } from './stats';
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
    'recruit', 'building:tents', 'building:trainingCamp', 'building:barracks', 'building:farm', 'building:forge',
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
  it('starts with a single soldier, one group and only woodcutting unlocked', () => {
    const s = newGame('humans', content);
    expect(s.troops).toHaveLength(1);
    expect(s.troops[0]).toMatchObject({ name: 'Norra Väktarna', size: 1, activity: null, wounds: 0, siteId: null });
    expect(s.troopSlots).toBe(1);
    expect(beds(s, content)).toBe(2);
    expect(s.unlocks).toEqual(['activity:woodcutting']);
    const stats = troopStats(s, s.troops[0]!, content);
    expect(stats.strength).toBe(1);
    expect(stats.workTotal).toBe(1);
    expect(stats.maxHp).toBe(10);
  });

  it('Orcs also start with one soldier but have more beds', () => {
    const s = newGame('orcs', content);
    expect(s.troops[0]!.size).toBe(1);
    expect(beds(s, content)).toBe(3);
  });

  it('locked races cannot be chosen', () => {
    expect(() => newGame('dwarves', content)).toThrow();
  });
});

describe('work cycles (docs/PROGRESSION_V2.md §4–5)', () => {
  const grove = content.sites.birchGrove!;

  it('a felled tree pays its wood when the cycle completes, not before', () => {
    const s = run(newGame('humans', content), { type: 'assignTroop', troopId: 'troop1', activity: 'woodcutting' });
    expect(s.troops[0]!.siteId).toBe('birchGrove');
    expect(advance(s, grove.cycleSec - 1, content).state.resources.wood).toBe(0);
    expect(advance(s, grove.cycleSec, content).state.resources.wood).toBe(grove.yield.wood);
    expect(advance(s, grove.cycleSec * 3, content).state.resources.wood).toBe(3 * grove.yield.wood!);
  });

  it('soldiers work in parallel up to the site capacity; the rest wait', () => {
    const s = run(sandbox('humans', 5), { type: 'assignTroop', troopId: 'troop1', activity: 'woodcutting' });
    const r = computeRates(s, content);
    expect(r.perTroop.troop1!.working).toBe(grove.capacity);
    expect(advance(s, grove.cycleSec, content).state.resources.wood).toBe(grove.capacity * grove.yield.wood!);
  });

  it('two groups share a site in troop order', () => {
    let s = sandbox('humans', 3);
    s.troopSlots = 2;
    s = run(s, { type: 'transferSoldiers', fromTroopId: 'troop1', toTroopId: null, count: 1 });
    s = run(s, { type: 'assignTroop', troopId: 'troop1', activity: 'woodcutting' }, { type: 'assignTroop', troopId: 'troop2', activity: 'woodcutting' });
    s.troops[0]!.size = 3; // troop1 fills the grove
    const r = computeRates(s, content);
    expect(r.perTroop.troop1!.working).toBe(3);
    expect(r.perTroop.troop2!.working).toBe(0);
  });

  it('mining picks a site: the quarry gives stone, the vein gives ore', () => {
    const quarry = content.sites.oldQuarry!;
    const vein = content.sites.oreVein!;
    let s = run(sandbox('humans', 1), { type: 'assignTroop', troopId: 'troop1', activity: 'mining' });
    expect(s.troops[0]!.siteId).toBe('oldQuarry');
    expect(advance(s, quarry.cycleSec, content).state.resources).toMatchObject({ stone: quarry.yield.stone, ore: 0 });
    s = run(s, { type: 'assignTroop', troopId: 'troop1', activity: 'mining', siteId: 'oreVein' });
    expect(advance(s, vein.cycleSec, content).state.resources).toMatchObject({ stone: 0, ore: vein.yield.ore });
  });

  it('a site of another activity or a locked site is rejected', () => {
    const s = sandbox();
    expect(dispatch(s, { type: 'assignTroop', troopId: 'troop1', activity: 'mining', siteId: 'birchGrove' }, content).ok).toBe(false);
    expect(dispatch(s, { type: 'assignTroop', troopId: 'troop1', activity: 'food', siteId: 'fields' }, content).ok).toBe(false);
    s.unlocks.push('site:fields');
    expect(dispatch(s, { type: 'assignTroop', troopId: 'troop1', activity: 'food', siteId: 'fields' }, content).ok).toBe(true);
  });

  it('skill speeds up cycles: Humans are better at food, Orcs at wood (D-13)', () => {
    const cycles = (raceId: string, activity: 'food' | 'woodcutting') => {
      const s = run(sandbox(raceId, 1), { type: 'assignTroop', troopId: 'troop1', activity });
      return Object.values(computeRates(s, content).siteCycles)[0]!;
    };
    expect(cycles('humans', 'food')).toBeGreaterThan(cycles('orcs', 'food'));
    expect(cycles('orcs', 'woodcutting')).toBeGreaterThan(cycles('humans', 'woodcutting'));
  });

  it('every finished cycle teaches the group a little', () => {
    const s = run(newGame('humans', content), { type: 'assignTroop', troopId: 'troop1', activity: 'woodcutting' });
    expect(advance(s, grove.cycleSec * 10, content).state.troops[0]!.xp).toBeCloseTo(10 * content.constants.workXp);
  });

  it('locked activities are rejected', () => {
    const r = dispatch(newGame('humans', content), { type: 'assignTroop', troopId: 'troop1', activity: 'mining' }, content);
    expect(r.ok).toBe(false);
  });

  it('construction is limited to a crew of builders', () => {
    const camp = content.buildings.trainingCamp!.levels[0]!;
    let s = sandbox('humans', 6);
    s.resources = { food: 100, wood: 100, stone: 100, ore: 0 };
    s = run(s, { type: 'startConstruction', buildingId: 'trainingCamp' }, { type: 'assignTroop', troopId: 'troop1', activity: 'construction' });
    const r = computeRates(s, content);
    expect(r.perTroop.troop1!.working).toBe(content.constants.crews.construction);
    expect(r.constructionWorkPerSec).toBeCloseTo(3 * 1.2);
    expect(advance(s, camp.work / 3.6 + 1, content).state.buildings.trainingCamp).toBe(1);
  });
});

describe('combat progression', () => {
  const chicken = content.enemies.wildChicken!;
  const stage1 = content.zones.farmsteads!.stages[0]!;

  it('clearing the frontier stage opens the next one, but troops stay until the player advances', () => {
    let s = run(sandbox(), { type: 'assignTroop', troopId: 'troop1', activity: 'combat' });
    const secPerKill = chicken.hp / 5; // 5 soldiers × 1 damage
    s = advance(s, secPerKill * stage1.killsToClear, content).state;
    // Level 2 comes during the stage (+10 % attack), so the stage clears a little early.
    expect(s.combat.unlockedStage).toBe(1);
    expect(s.combat.stageIndex).toBe(0);
    expect(s.stats.totalKills).toBeGreaterThanOrEqual(stage1.killsToClear);
    expect(s.resources.food).toBeCloseTo(s.stats.totalKills * chicken.loot.food!);
    expect(s.troops[0]!.xp).toBeCloseTo(s.stats.totalKills * chicken.xp);
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
    const s = atStage(sandbox('humans', 4), 4); // old boars
    const safety = stageSafety(s, content, { stageIndex: 4 });
    expect(safety.risk).toBe('deadly');
    const r = advance(s, 600, content);
    const t = r.state.troops[0]!;
    expect(t.size).toBe(2); // lost half of 4
    expect(t.activity).toBeNull();
    expect(r.events.filter((e) => e.type === 'soldierLost')).toHaveLength(2);
    expect(r.state.stats.soldiersLost).toBe(2);
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
    const s = atStage(sandbox('humans', 4), 4);
    const r = catchUp(s, 3600, 8 * 3600, content);
    expect(r.state.combat.stageIndex).toBeLessThan(4);
    expect(r.state.troops[0]!.size).toBe(4);
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

describe('beds and training (D-45)', () => {
  function campReady(raceId = 'humans', size = 2): GameState {
    const s = sandbox(raceId, size);
    s.buildings.trainingCamp = 1;
    s.troopSlots = 2;
    s.resources.food = 1000;
    return s;
  }

  it('trains one recruit at a time for food and time; they join when ready', () => {
    let s = campReady('humans', 2);
    const cost = trainCost(s, content);
    const pop = content.races.humans!.population;
    expect(cost).toEqual({ food: pop.trainFood, sec: pop.trainSec });
    s = run(s, { type: 'trainRecruit', troopId: 'troop1' });
    expect(s.resources.food).toBe(1000 - pop.trainFood);
    expect(trainBlocker(s, content)).toBe('busy');
    expect(advance(s, cost.sec - 1, content).state.troops.reduce((n, t) => n + t.size, 0)).toBe(2);
    const done = advance(s, cost.sec, content);
    expect(done.state.training).toBeNull();
    expect(done.state.stats.recruited).toBe(1);
    expect(done.events.map((e) => e.type)).toContain('recruitTrained');
    // A group slot was open, so the recruit forms group 2.
    expect(done.state.troops).toHaveLength(2);
    expect(done.state.troops[1]!.size).toBe(1);
  });

  it('every soldier costs more food and time than the last', () => {
    const s = campReady('humans', 2);
    const a = trainCost(s, content);
    s.troops[0]!.size = 4;
    const b = trainCost(s, content);
    expect(b.food).toBeGreaterThan(a.food);
    expect(b.sec).toBeGreaterThan(a.sec);
  });

  it('needs a free bed: the camp has 2 + 1, tents add more (Orcs get double)', () => {
    const s = campReady('humans', 3);
    expect(beds(s, content)).toBe(3);
    expect(freeBeds(s, content)).toBe(0);
    expect(trainBlocker(s, content)).toBe('noBed');
    s.buildings.tents = 2;
    expect(beds(s, content)).toBe(5);
    expect(trainBlocker(s, content)).toBeNull();
    const o = campReady('orcs', 3);
    o.buildings.tents = 1;
    expect(beds(o, content)).toBe(3 + 2 + 2);
  });

  it('cannot train before the Training Camp unlocks recruitment', () => {
    const s = newGame('humans', content);
    expect(dispatch(s, { type: 'trainRecruit', troopId: 'troop1' }, content).ok).toBe(false);
  });

  it('a recruit for a fighting troop raises its retreat threshold', () => {
    let s = campReady('humans', 2);
    s.troopSlots = 1;
    s = atStage(s, 0);
    s = run(s, { type: 'trainRecruit', troopId: 'troop1' });
    s = advance(s, 90, content).state;
    expect(s.troops[0]!.engagedSize).toBe(3);
  });
});

describe('troop groups (D-46)', () => {
  it('the Training Camp opens group 2 and moves a soldier into it when one can be spared', () => {
    const camp = content.buildings.trainingCamp!.levels[0]!;
    let s = sandbox('humans', 2);
    s.resources = { food: 0, wood: 0, stone: 0, ore: 0, ...camp.cost };
    s = run(s, { type: 'startConstruction', buildingId: 'trainingCamp' }, { type: 'assignTroop', troopId: 'troop1', activity: 'construction' });
    const { state, events } = advance(s, camp.work / 2.4 + 1, content);
    expect(state.buildings.trainingCamp).toBe(1);
    expect(state.troopSlots).toBe(2);
    expect(state.troops.map((t) => t.size)).toEqual([1, 1]);
    expect(state.troops[1]!.name).toBe('Skogsarbetarna');
    expect(state.unlocks).toContain('recruit');
    expect(events.map((e) => e.type)).toContain('troopFormed');
  });

  it('a lone soldier keeps the slot open; the next soldier forms the group', () => {
    let s = sandbox('humans', 1);
    s.buildings.trainingCamp = 1;
    s.troopSlots = 2;
    s.resources.food = 100;
    s = run(s, { type: 'trainRecruit', troopId: 'troop1' });
    expect(s.troops).toHaveLength(1);
    s = advance(s, 120, content).state;
    expect(s.troops.map((t) => t.size)).toEqual([1, 1]);
  });

  it('soldiers move between groups; a group keeps at least one, and their weapons go to the armoury', () => {
    let s = sandbox('humans', 4);
    s.troopSlots = 2;
    s.troops[0]!.autoEquip = false;
    s.troops[0]!.equipment = [{ tier: 1, quality: 'good', count: 4 }];
    s = run(s, { type: 'transferSoldiers', fromTroopId: 'troop1', toTroopId: null, count: 2 });
    expect(s.troops.map((t) => t.size)).toEqual([2, 2]);
    // The moving soldiers leave their weapons; the new group (Auto on) picks them up again.
    expect(s.troops[0]!.equipment).toEqual([{ tier: 1, quality: 'good', count: 2 }]);
    expect(s.troops[1]!.equipment).toEqual([{ tier: 1, quality: 'good', count: 2 }]);
    s = run(s, { type: 'transferSoldiers', fromTroopId: 'troop2', toTroopId: 'troop1', count: 1 });
    expect(s.troops.map((t) => t.size)).toEqual([3, 1]);
    expect(dispatch(s, { type: 'transferSoldiers', fromTroopId: 'troop2', toTroopId: 'troop1', count: 1 }, content).ok).toBe(false);
    expect(dispatch(s, { type: 'transferSoldiers', fromTroopId: 'troop1', toTroopId: null, count: 1 }, content).ok).toBe(false);
  });
});

describe('objectives drive the tutorial', () => {
  it('woodcutting unlocks upgrades, then combat', () => {
    let s = run(newGame('humans', content), { type: 'assignTroop', troopId: 'troop1', activity: 'woodcutting' });
    expect(s.objectivesCompleted).toContain('sendWood');
    s = advance(s, 90, content).state; // 15 wood
    expect(s.unlocks).toContain('upgrade:sharpenedAxes');
    expect(s.unlocks).not.toContain('activity:combat');
    s = advance(s, 90, content).state; // 30 wood
    expect(s.unlocks).toContain('activity:combat');
  });

  it('clearing the first stage rescues soldier 2', () => {
    let s = newGame('humans', content);
    s.objectivesCompleted = ['sendWood', 'wood30', 'wood60', 'kill5'];
    s.unlocks.push('activity:combat');
    s = run(s, { type: 'assignTroop', troopId: 'troop1', activity: 'combat' });
    const r = advance(s, 600, content);
    expect(r.state.troops[0]!.size).toBe(2);
    expect(r.events.map((e) => e.type)).toContain('soldiersJoined');
    expect(r.state.unlocks).toContain('building:tents');
  });
});

describe('boss', () => {
  it('can be won or lost within the time limit, and fighting it costs soldiers', () => {
    let s = sandbox('humans', 2);
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

  it('the boss frees two prisoners who form a new group', () => {
    let s = sandbox('humans', 6);
    s.objectivesCompleted = s.objectivesCompleted.filter((id) => id !== 'boss');
    s.unlocks.push('boss');
    s.troops[0]!.size = 200;
    s.troops[0]!.engagedSize = 200;
    s = run(s, { type: 'assignTroop', troopId: 'troop1', activity: 'combat' }, { type: 'challengeBoss' });
    const r = advance(s, 90, content).state;
    expect(r.troopSlots).toBe(2);
    expect(r.troops).toHaveLength(2);
    expect(r.troops[1]!.size).toBe(2);
  });
});

describe('offline equivalence', () => {
  it('one long advance equals many short ones (cycles, training, construction)', () => {
    let s = sandbox('orcs', 6);
    s.buildings.trainingCamp = 1;
    s.buildings.tents = 1;
    s.troopSlots = 2;
    s.resources = { food: 200, wood: 100, stone: 100, ore: 0 };
    s = run(
      s,
      { type: 'transferSoldiers', fromTroopId: 'troop1', toTroopId: null, count: 3 },
      { type: 'trainRecruit', troopId: 'troop2' },
      { type: 'startConstruction', buildingId: 'farm' },
      { type: 'assignTroop', troopId: 'troop1', activity: 'construction' },
      { type: 'assignTroop', troopId: 'troop2', activity: 'woodcutting' },
    );
    const once = advance(s, 1800, content).state;
    let many = s;
    for (let i = 0; i < 1800; i++) many = advance(many, 1, content).state;
    expect(many.buildings).toEqual(once.buildings);
    expect(many.troops.map((t) => t.size)).toEqual(once.troops.map((t) => t.size));
    expect(many.troops.map((t) => t.xp)).toEqual(once.troops.map((t) => expect.closeTo(t.xp, 6)));
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

  it('migrates a v6 save to work cycles: every soldier kept, gatherers get a site, no second rescue', () => {
    const v6 = JSON.parse(serialize(sandbox('humans', 40))) as Record<string, any>;
    v6.version = 6;
    v6.troops[0].activity = 'mining';
    delete v6.troops[0].siteId;
    delete v6.troopSlots;
    delete v6.training;
    delete v6.siteProgress;
    v6.buildings = { trainingCamp: 1 };
    v6.objectivesCompleted = ['sendWood', 'wood30', 'wood60', 'kill5', 'recruit1'];
    const s = deserialize(JSON.stringify(v6));
    expect(s.version).toBe(8);
    expect(s.troops[0]).toMatchObject({ size: 40, siteId: 'oldQuarry' });
    expect(s.troopSlots).toBe(1);
    expect(s.objectivesCompleted).toContain('rescue');
    expect(s.unlocks).toEqual(expect.arrayContaining(['recruit', 'building:tents']));
    expect(trainBlocker(s, content)).toBe('noBed');
    expect(advance(s, 60, content).state.troops[0]!.size).toBe(40);
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
    expect(s.version).toBe(8);
    expect(s.troops[0]).toMatchObject({ siteId: null });
    expect(s.troopSlots).toBe(1);
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

describe('M10b first hour (docs/PROGRESSION_V2.md §16)', () => {
  const xpFor = (level: number) => xpForLevel(level, content.constants.xpBase, content.constants.xpExponent);

  /** An early-game state with the chain up to `twoTroops` done and the matching unlocks. */
  function afterTwoTroops(): GameState {
    const s = sandbox('humans', 5);
    s.objectivesCompleted = ['sendWood', 'wood30', 'wood60', 'kill5', 'rescue', 'stone20', 'trainingCamp', 'twoTroops'];
    s.unlocks = ['activity:woodcutting', 'activity:mining', 'activity:construction', 'building:tents', 'building:trainingCamp'];
    s.buildings = { trainingCamp: 1, tents: 1 };
    return s;
  }

  it('twoTroops unlocks the forge and the forge objective follows at once', () => {
    let s = newGame('humans', content);
    s.objectivesCompleted = ['sendWood', 'wood30', 'wood60', 'kill5', 'rescue', 'stone20', 'trainingCamp'];
    s.troopSlots = 2;
    s.troops.push({ ...s.troops[0]!, id: 'troop2', name: 'Andra', activity: null });
    s.troops[0]!.activity = 'woodcutting';
    s.troops[1]!.activity = 'woodcutting';
    s = advance(s, 1, content).state;
    expect(s.objectivesCompleted).toContain('twoTroops');
    expect(s.unlocks).toContain('building:forge');
    const ids = (c = content) => c.objectives.find((o) => o.id === 'forge')!.requires;
    expect(ids()).toEqual(['twoTroops']);
    expect(content.objectives.find((o) => o.id === 'farm')!.rewards.unlocks).toBeUndefined();
  });

  it('rescue2 gives +1 soldier at stage 5 even with no free bed', () => {
    const s = afterTwoTroops();
    s.objectivesCompleted.push('stage3');
    s.troops[0]!.size = beds(s, content); // all beds taken
    expect(freeBeds(s, content)).toBe(0);
    const before = s.troops.reduce((n, t) => n + t.size, 0);
    s.combat.unlockedStage = 4; // stage 5 reached = stages 1-4 cleared
    const r = advance(s, 1, content);
    expect(r.state.objectivesCompleted).toContain('rescue2');
    expect(r.state.troops.reduce((n, t) => n + t.size, 0)).toBe(before + 1);
    expect(r.events.map((e) => e.type)).toContain('soldiersJoined');
  });

  it('stage 5 needs 8 kills; the new ore loot is in place', () => {
    const stages = content.zones.farmsteads!.stages;
    expect(stages[4]).toMatchObject({ enemyId: 'oldBoar', killsToClear: 8 });
    expect(content.enemies.fox!.loot.ore).toBe(0.5);
    expect(content.enemies.wildBoar!.loot.ore).toBe(1.5);
    expect(content.enemies.oldBoar!.loot.ore).toBe(2.5);
  });

  it('tent2 -> woodshed chain unlocks the building and Sharp axes II; ore10 unlocks Stone picks II', () => {
    let s = afterTwoTroops();
    s.resources = { food: 0, wood: 0, stone: 0, ore: 0 };
    s.buildings.tents = 2;
    s = advance(s, 1, content).state;
    expect(s.objectivesCompleted).toContain('tent2');
    expect(s.resources.wood).toBe(30);
    expect(s.unlocks).toContain('building:woodshed');
    s.buildings.woodshed = 1;
    s = advance(s, 1, content).state;
    expect(s.objectivesCompleted).toContain('woodshed');
    expect(s.unlocks).toContain('upgrade:sharpenedAxes2');
    s.stats.gathered.ore = 10;
    s = advance(s, 1, content).state;
    expect(s.objectivesCompleted).toContain('ore10');
    expect(s.resources.food).toBe(20);
    expect(s.unlocks).toContain('upgrade:stonePicks2');
  });

  it('Forge II adds a smithing slot, Farm II a field slot, the woodshed a grove slot', () => {
    const s = sandbox('humans', 5);
    s.buildings = { forge: 1, farm: 1, woodshed: 0 };
    const smith = capacity(s, content, 'smithing');
    const fields = capacity(s, content, 'fields');
    const grove = capacity(s, content, 'birchGrove');
    s.buildings = { forge: 2, farm: 2, woodshed: 1 };
    expect(capacity(s, content, 'smithing')).toBe(smith + 1);
    expect(capacity(s, content, 'fields')).toBe(fields + 1);
    expect(capacity(s, content, 'birchGrove')).toBe(grove + 1);
    expect(capacity(s, content, 'fields')).toBe(4);
    expect(capacity(s, content, 'birchGrove')).toBe(4);
  });

  it('the two new upgrades raise woodcutting and mining skill', () => {
    const s = sandbox('humans', 5);
    s.upgrades = {};
    const skill = (k: 'woodcutting' | 'mining') => troopStats(s, s.troops[0]!, content).skills[k];
    const w = skill('woodcutting');
    const m = skill('mining');
    s.upgrades = { sharpenedAxes2: 1, stonePicks2: 1 };
    expect(skill('woodcutting')).toBeCloseTo(w * (1 + 0.3), 6);
    expect(skill('mining')).toBeCloseTo(m * (1 + 0.25), 6);
  });

  it('levelStep fires once at level 5 and once at 10, and offline equals online', () => {
    for (const [from, step] of [[4, 5], [9, 10]] as const) {
      let s = atStage(sandbox('humans', 12), 0);
      s.troops[0]!.xp = xpFor(from + 1) - 1;
      const count = (evs: { type: string; level?: number }[]) => evs.filter((e) => e.type === 'levelStep' && e.level === step).length;
      const once = advance(s, 1800, content);
      expect(count(once.events)).toBe(1);
      let n = 0;
      let many = s;
      for (let i = 0; i < 180; i++) {
        const r = advance(many, 10, content);
        many = r.state;
        n += count(r.events);
      }
      expect(n).toBe(1);
    }
    // a save already at level 5 or higher is never notified on load or on later advances
    const loaded = deserialize(serialize(atStage(Object.assign(sandbox('humans', 12), {}), 0)));
    loaded.troops[0]!.xp = xpFor(7);
    expect(advance(loaded, 60, content).events.some((e) => e.type === 'levelStep')).toBe(false);
  });

  it('migrates a v7 save: new objectives done silently, same soldiers and resources, forge unlocked', () => {
    const v7 = JSON.parse(serialize(sandbox('humans', 6))) as Record<string, any>;
    v7.version = 7;
    v7.objectivesCompleted = ['sendWood', 'wood30', 'wood60', 'kill5', 'rescue', 'stone20', 'trainingCamp', 'twoTroops', 'stage3', 'farm'];
    v7.unlocks = ['activity:woodcutting', 'building:tents', 'building:farm'];
    v7.buildings = { tents: 2, trainingCamp: 1, farm: 1 };
    v7.combat.unlockedStage = 4;
    v7.stats.gathered.ore = 12;
    v7.resources = { food: 11, wood: 22, stone: 33, ore: 4 };
    const s = deserialize(JSON.stringify(v7));
    expect(s.version).toBe(8);
    expect(s.objectivesCompleted).toEqual(expect.arrayContaining(['tent2', 'ore10', 'rescue2']));
    expect(s.objectivesCompleted).not.toContain('woodshed');
    expect(s.unlocks).toEqual(expect.arrayContaining(['building:forge', 'building:woodshed', 'upgrade:stonePicks2']));
    expect(s.troops.reduce((n, t) => n + t.size, 0)).toBe(6);
    expect(s.resources).toEqual({ food: 11, wood: 22, stone: 33, ore: 4 });
    const after = advance(s, 1, content).state;
    expect(after.troops.reduce((n, t) => n + t.size, 0)).toBe(6);
    expect(after.resources.wood).toBe(22);
  });
});
