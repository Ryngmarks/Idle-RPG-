import { describe, expect, it } from 'vitest';
import { content as baseContent } from '../content';
import { dispatch, type Command } from './commands';
import { foodBalance, limiters } from './limits';
import { deserialize, serialize } from './save';
import { advance } from './simulation';
import { newGame } from './state';
import { computeRates, upkeepPerSec } from './stats';
import type { Content, GameEvent, GameState } from './types';

const content = baseContent;

function army(size: number, activity: 'woodcutting' | 'food' | 'combat' | 'construction' | null = 'woodcutting', raceId = 'humans', food = 0): GameState {
  const s = newGame(raceId, content);
  s.unlocks = ['activity:combat', 'activity:mining', 'activity:woodcutting', 'activity:food', 'activity:construction', 'recruit'];
  s.objectivesCompleted = content.objectives.map((o) => o.id);
  const t = s.troops[0]!;
  t.size = size;
  t.engagedSize = size;
  t.activity = activity;
  t.siteId = activity === 'woodcutting' ? 'birchGrove' : activity === 'food' ? 'berryThickets' : null;
  s.resources = { food, wood: 0, stone: 0, ore: 0, iron: 0 };
  return s;
}

const run = (state: GameState, cmd: Command): { state: GameState; events: GameEvent[] } => {
  const r = dispatch(state, cmd, content);
  if (!r.ok) throw new Error(r.error);
  return r;
};

/** Many short steps; collects the events. */
function stepped(s: GameState, total: number, dt: number, c: Content = content) {
  const events: GameEvent[] = [];
  let hungrySec = 0;
  let n = Math.floor(total / dt);
  for (let i = 0; i < n; i++) {
    const r = advance(s, dt, c);
    s = r.state;
    events.push(...r.events);
    hungrySec += r.hungrySec;
  }
  const rest = total - n * dt;
  if (rest > 1e-12) {
    const r = advance(s, rest, c);
    s = r.state;
    events.push(...r.events);
    hungrySec += r.hungrySec;
  }
  return { state: s, events, hungrySec };
}

const types = (events: GameEvent[]) => events.map((e) => e.type).filter((t) => t === 'foodEmpty' || t === 'foodRestored');

function sameState(a: GameState, b: GameState) {
  expect(a.resources.food).toBeCloseTo(b.resources.food, 6);
  expect(a.resources.wood).toBeCloseTo(b.resources.wood, 6);
  expect(a.clock).toBeCloseTo(b.clock, 6);
  for (const k of Object.keys(a.siteProgress)) expect(a.siteProgress[k]!).toBeCloseTo(b.siteProgress[k] ?? 0, 6);
  expect(a.troops[0]!.xp).toBeCloseTo(b.troops[0]!.xp, 6);
}

describe('food upkeep (docs/PROGRESSION_V2.md §17)', () => {
  it('every soldier but the first eats; Humans 0.5 and Orcs 0.6 per minute', () => {
    expect(upkeepPerSec(army(1), content)).toBe(0);
    expect(upkeepPerSec(army(5), content)).toBeCloseTo((4 * 0.5) / 60);
    expect(upkeepPerSec(army(5, 'woodcutting', 'orcs'), content)).toBeCloseTo((4 * 0.6) / 60);
    // The whole army counts, not each group: a second group adds its soldiers in full.
    const s = army(3);
    s.troops.push({ ...s.troops[0]!, id: 'troop2', size: 2 });
    expect(upkeepPerSec(s, content)).toBeCloseTo((4 * 0.5) / 60);
  });

  it('a recruit in training does not eat', () => {
    const s = army(3);
    s.training = { troopId: 'troop1', secLeft: 50, totalSec: 90 };
    expect(upkeepPerSec(s, content)).toBeCloseTo((2 * 0.5) / 60);
    expect(computeRates(s, content).upkeepPerSec).toBeCloseTo((2 * 0.5) / 60);
  });

  it('one soldier never goes hungry, even with an empty stock', () => {
    const r = computeRates(army(1), content);
    expect(r.hungry).toBe(false);
    expect(advance(army(1), 600, content).state.resources.food).toBe(0);
  });

  it('the stock drains to 0 at the predicted time, then the army is hungry', () => {
    const s = army(5, 'woodcutting', 'humans', 10);
    const t0 = 10 / upkeepPerSec(s, content);
    const before = advance(s, t0 - 0.01, content);
    expect(before.state.resources.food).toBeGreaterThan(0);
    expect(before.events.map((e) => e.type)).not.toContain('foodEmpty');
    const after = advance(s, t0 + 0.01, content);
    expect(after.state.resources.food).toBe(0);
    expect(types(after.events)).toEqual(['foodEmpty']);
    expect(after.events.find((e) => e.type === 'foodEmpty')!.at).toBeCloseTo(t0, 6);
    expect(after.hungrySec).toBeCloseTo(0.01, 6);
    expect(foodBalance(after.state, content).hungry).toBe(true);
    // Hunger continues without new events, and the stock stays at 0.
    const more = advance(after.state, 500, content);
    expect(more.events.map((e) => e.type)).not.toContain('foodEmpty');
    expect(more.state.resources.food).toBe(0);
  });

  it('is not hungry while average income covers upkeep, even though payouts are discrete', () => {
    const s = army(12, 'food'); // 2 on the berries: 0.28/s vs 0.092/s eaten
    expect(computeRates(s, content).hungry).toBe(false);
    let cur = s;
    for (let i = 0; i < 300; i++) {
      const r = advance(cur, 1, content);
      cur = r.state;
      expect(r.hungrySec).toBe(0);
      expect(r.events.map((e) => e.type)).not.toContain('foodEmpty');
      expect(cur.resources.food).toBeGreaterThanOrEqual(0);
    }
    expect(cur.resources.food).toBeGreaterThan(30);
  });

  it('with an empty stock and a continuous deficit covered by payouts, long and short steps agree', () => {
    // 2 working on berries make 0.28/s on average; 40 soldiers eat 0.325/s... too much, so use 12: covered.
    const s = army(12, 'food');
    for (const dt of [1, 7.3, 0.5]) {
      const long = advance(s, 200, content);
      const short = stepped(s, 200, dt);
      sameState(long.state, short.state);
      expect(long.hungrySec).toBe(0);
    }
  });

  it('hunger at zero coverage: work x0.6 and attack x0.75, food sites exempt', () => {
    const fed = army(5, 'woodcutting', 'humans', 1000);
    const hungry = army(5, 'woodcutting');
    const a = computeRates(fed, content);
    const b = computeRates(hungry, content);
    expect(b.hungry).toBe(true);
    expect(b.coverage).toBe(0);
    expect(b.workMult).toBeCloseTo(0.6);
    expect(b.attackMult).toBeCloseTo(0.75);
    expect(b.siteCycles.birchGrove! / a.siteCycles.birchGrove!).toBeCloseTo(0.6);
    expect(b.perTroop.troop1!.output.wood! / a.perTroop.troop1!.output.wood!).toBeCloseTo(0.6);

    // Construction and combat
    const c1 = army(5, 'construction');
    c1.construction = { buildingId: 'tents', level: 1, progress: 0 };
    const c2 = { ...c1, resources: { ...c1.resources, food: 1000 } };
    expect(computeRates(c1, content).constructionWorkPerSec / computeRates(c2, content).constructionWorkPerSec).toBeCloseTo(0.6);
    // Attack: a boss fight has no loot, so coverage is 0 and the damage is attack x0.75 (damage drops at least that much because armour is subtracted).
    const f1 = army(5, 'combat');
    f1.combat.boss = { index: 0, hpLeft: 100, timeLeft: 90 };
    const f2 = { ...f1, resources: { ...f1.resources, food: 1000 } };
    expect(computeRates(f1, content).attackMult).toBeCloseTo(0.75);
    expect(computeRates(f1, content).bossDps).toBeLessThan(computeRates(f2, content).bossDps);

    // Food sites are never slowed: hungry foragers work at the fed speed.
    const forage = army(40, 'food');
    const forageFed = { ...forage, resources: { ...forage.resources, food: 1000 } };
    const fr = computeRates(forage, content);
    expect(fr.hungry).toBe(true); // 2 foragers make 0.28/s, 39 soldiers eat 0.325/s
    expect(fr.siteCycles.berryThickets).toBeCloseTo(computeRates(forageFed, content).siteCycles.berryThickets!);
    expect(fr.coverage).toBeCloseTo(0.28 / ((39 * 0.5) / 60));
    expect(fr.workMult).toBeCloseTo(1 - 0.4 * (1 - fr.coverage));
  });

  it('coverage 0.5 gives work x0.8 and attack x0.875', () => {
    // 1 forager makes 0.14/s; 10 eaters at 1.68/min eat 0.28/s: exactly half covered.
    const humans = baseContent.races.humans!;
    const c: Content = { ...baseContent, races: { ...baseContent.races, humans: { ...humans, traits: [], population: { ...humans.population, upkeep: 1.68 } } } };
    const s = newGame('humans', c);
    s.unlocks = ['activity:woodcutting', 'activity:food'];
    s.objectivesCompleted = c.objectives.map((o) => o.id);
    s.troopSlots = 2;
    s.troops[0]!.size = 10;
    s.troops[0]!.activity = 'woodcutting';
    s.troops[0]!.siteId = 'birchGrove';
    s.troops.push({ ...s.troops[0]!, id: 'troop2', name: 'Bärplockarna', size: 1, activity: 'food', siteId: 'berryThickets' });
    const r = computeRates(s, c);
    expect(r.hungry).toBe(true);
    expect(r.coverage).toBeCloseTo(0.5);
    expect(r.workMult).toBeCloseTo(0.8);
    expect(r.attackMult).toBeCloseTo(0.875);
    const fed = computeRates({ ...s, resources: { ...s.resources, food: 1000 } }, c);
    expect(r.perTroop.troop1!.output.wood! / fed.perTroop.troop1!.output.wood!).toBeCloseTo(0.8);
    expect(r.perTroop.troop2!.output.food!).toBeCloseTo(fed.perTroop.troop2!.output.food!);
  });

  it('nobody dies or leaves, nothing is lost, and the stock never goes negative', () => {
    let s = army(6, 'woodcutting');
    s.buildings = { tents: 2 };
    const before = JSON.stringify({ b: s.buildings, size: s.troops[0]!.size });
    const r = advance(s, 4 * 3600, content);
    s = r.state;
    expect(r.hungrySec).toBeCloseTo(4 * 3600, 3);
    expect(JSON.stringify({ b: s.buildings, size: s.troops[0]!.size })).toBe(before);
    expect(s.stats.soldiersLost).toBe(0);
    expect(s.resources.food).toBe(0);
    expect(s.resources.wood).toBeGreaterThan(0);
  });

  it('offline equals online across hunger start and end', () => {
    const s0 = army(5, 'woodcutting', 'humans', 10);
    const longA = advance(s0, 600, content);
    const shortA = stepped(s0, 600, 1);
    sameState(longA.state, shortA.state);
    expect(types(longA.events)).toEqual(['foodEmpty']);
    expect(types(shortA.events)).toEqual(['foodEmpty']);
    expect(longA.hungrySec).toBeCloseTo(shortA.hungrySec, 6);
    expect(longA.state.resources.food).toBe(0);

    // The player sends the troop to the berries: hunger ends (event from dispatch), food grows again.
    const sent = run(longA.state, { type: 'assignTroop', troopId: 'troop1', activity: 'food' });
    expect(types(sent.events)).toEqual(['foodRestored']);
    const longB = advance(sent.state, 300, content);
    const shortB = stepped(sent.state, 300, 0.9);
    sameState(longB.state, shortB.state);
    expect(longB.hungrySec).toBe(0);
    expect(longB.state.resources.food).toBeGreaterThan(50);

    // Back to wood and a long offline stretch: same totals as a day of short steps (hungry again later).
    const back = run(longB.state, { type: 'assignTroop', troopId: 'troop1', activity: 'woodcutting' }).state;
    const longC = advance(back, 1200, content);
    const shortC = stepped(back, 1200, 2.5);
    sameState(longC.state, shortC.state);
    expect(longC.hungrySec).toBeCloseTo(shortC.hungrySec, 5);
    expect(types(longC.events)).toEqual(types(shortC.events));
  });

  it('hunger shows up as a limiter: block when hungry, slow when under 2 minutes of food', () => {
    const hungry = limiters(army(5), content).find((l) => l.kind === 'hunger');
    expect(hungry).toMatchObject({ severity: 'block', tab: 'forces' });
    const low = limiters(army(5, 'woodcutting', 'humans', 1), content).find((l) => l.kind === 'hunger')!;
    expect(low).toMatchObject({ severity: 'slow', tab: 'forces' });
    expect(low.secondsLeft).toBeCloseTo(1 / upkeepPerSec(army(5), content));
    expect(limiters(army(5, 'woodcutting', 'humans', 1000), content).some((l) => l.kind === 'hunger')).toBe(false);
    expect(limiters(army(12, 'food'), content).some((l) => l.kind === 'hunger')).toBe(false);
  });

  it('foodBalance reports per-second income, upkeep, net and time left', () => {
    const b = foodBalance(army(5, 'woodcutting', 'humans', 20), content);
    expect(b).toMatchObject({ income: 0, hungry: false, coverage: 0 });
    expect(b.upkeep).toBeCloseTo(1 / 30);
    expect(b.net).toBeCloseTo(-1 / 30);
    expect(b.secondsLeft).toBeCloseTo(600);
    expect(foodBalance(army(12, 'food'), content).secondsLeft).toBeNull();
    expect(foodBalance(army(1), content)).toMatchObject({ upkeep: 0, coverage: 1, hungry: false, secondsLeft: null });
  });

  it('needs no saved state: a round trip keeps stock and hunger', () => {
    const s = army(5);
    const back = deserialize(serialize(s));
    expect(back.resources.food).toBe(s.resources.food);
    expect(computeRates(back, content).hungry).toBe(true);
  });
});
