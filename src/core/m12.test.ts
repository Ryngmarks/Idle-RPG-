import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { dispatch } from './commands';
import { deserialize, serialize } from './save';
import { advance } from './simulation';
import { newGame } from './state';
import { computeRates, troopStats } from './stats';
import type { GameState } from './types';

function army(size: number, activity: 'woodcutting' | 'food' | 'combat' | 'construction' | null = 'woodcutting', raceId = 'humans'): GameState {
  const s = newGame(raceId, content);
  s.unlocks = ['activity:combat', 'activity:mining', 'activity:woodcutting', 'activity:food', 'activity:construction', 'recruit'];
  s.objectivesCompleted = content.objectives.map((o) => o.id);
  const t = s.troops[0]!;
  t.size = size;
  t.engagedSize = size;
  t.activity = activity;
  t.siteId = activity === 'woodcutting' ? 'birchGrove' : activity === 'food' ? 'berryThickets' : null;
  s.resources = { food: 500, wood: 500, stone: 0, ore: 0 };
  s.buildings = { trainingCamp: 1 };
  return s;
}

const feastOk = (s: GameState) => {
  const r = dispatch(s, { type: 'startFeast' }, content);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

/** Many short steps (online play). */
function stepped(s: GameState, total: number, dt: number) {
  for (let t = 0; t < total - 1e-9; t += dt) s = advance(s, Math.min(dt, total - t), content).state;
  return s;
}

describe('race traits (docs/PROGRESSION_V2.md §18.1)', () => {
  it('horde: +12.5 % attack per comrade, full +50 % at five', () => {
    const base = troopStats(army(1, null, 'orcs'), army(1, null, 'orcs').troops[0]!, content).attack;
    const at = (n: number) => {
      const s = army(n, null, 'orcs');
      return troopStats(s, s.troops[0]!, content).attack / base - 1;
    };
    for (const [n, bonus] of [[1, 0], [2, 0.125], [3, 0.25], [5, 0.5], [10, 0.5]] as const) expect(at(n)).toBeCloseTo(bonus, 9);
  });

  it('adaptable: +25 % food and construction skill for troops of three or fewer, not four', () => {
    const skills = (n: number) => {
      const s = army(n, null);
      return troopStats(s, s.troops[0]!, content).skills;
    };
    expect(skills(3).food).toBeCloseTo(1.4 * 1.25);
    expect(skills(3).construction).toBeCloseTo(1.2 * 1.25);
    expect(skills(4).food).toBeCloseTo(1.4);
    expect(skills(4).construction).toBeCloseTo(1.2);
    expect(skills(3).mining).toBe(1);
  });

  it('other races get no adaptable bonus', () => {
    const s = army(2, null, 'orcs');
    expect(troopStats(s, s.troops[0]!, content).skills.food).toBeCloseTo(0.8);
  });
});

describe('raid objectives (§18.2)', () => {
  it('raid1 needs stage3 and 80 kills and pays wood and stone; raid2 follows with food and ore', () => {
    const s = army(3, null);
    s.objectivesCompleted = s.objectivesCompleted.filter((o) => o !== 'raid1' && o !== 'raid2');
    s.resources = { food: 0, wood: 0, stone: 0, ore: 0 };
    s.stats.totalKills = 81;
    let r = advance(s, 0, content);
    expect(r.state.objectivesCompleted).toContain('raid1');
    expect(r.state.objectivesCompleted).not.toContain('raid2');
    expect(r.state.resources).toEqual({ food: 0, wood: 45, stone: 25, ore: 0 });
    r.state.stats.totalKills = 130;
    r = advance(r.state, 0, content);
    expect(r.state.objectivesCompleted).toContain('raid2');
    expect(r.state.resources).toEqual({ food: 40, wood: 45, stone: 25, ore: 6 });
  });
});

describe('the Feast (§18.3)', () => {
  it('needs the training camp and the resources, deducts the cost once, and blocks a second feast', () => {
    const noCamp = army(3);
    noCamp.buildings = {};
    expect(dispatch(noCamp, { type: 'startFeast' }, content).ok).toBe(false);
    const poor = army(3);
    poor.resources.food = 49;
    expect(dispatch(poor, { type: 'startFeast' }, content).ok).toBe(false);

    const s = feastOk(army(3));
    expect(s.resources.food).toBe(450);
    expect(s.resources.wood).toBe(485);
    expect(s.feast).toEqual({ until: 600, readyAt: 1200 });
    expect(dispatch(s, { type: 'startFeast' }, content).ok).toBe(false);
    // After it ends the cooldown still blocks until readyAt.
    const later = advance(s, 700, content).state;
    expect(later.feast.until).toBe(0);
    expect(dispatch(later, { type: 'startFeast' }, content).ok).toBe(false);
    const ready = advance(later, 500, content).state;
    expect(dispatch(ready, { type: 'startFeast' }, content).ok).toBe(true);
  });

  it('factors are exact inside the window and 1 outside', () => {
    const base = army(3, 'combat');
    const plain = computeRates(base, content);
    expect(plain.feastActive).toBe(false);
    expect(plain.feastWorkMult).toBe(1);
    expect(plain.feastAttackMult).toBe(1);

    const s = feastOk(base);
    const on = computeRates(s, content);
    expect(on.feastActive).toBe(true);
    expect(on.feastWorkMult).toBe(1.25);
    expect(on.feastAttackMult).toBe(1.25);
    expect(on.killsPerSec).toBeGreaterThan(plain.killsPerSec);

    const wood = feastOk(army(3));
    const w0 = computeRates(army(3), content).siteCycles.birchGrove!;
    expect(computeRates(wood, content).siteCycles.birchGrove! / w0).toBeCloseTo(1.25, 9);

    const over = advance(s, 600, content);
    expect(over.events.some((e) => e.type === 'feastEnded')).toBe(true);
    expect(computeRates(over.state, content).feastActive).toBe(false);
  });

  it('multiplies with hunger instead of replacing it', () => {
    const s = feastOk(army(5));
    s.resources.food = 0;
    const r = computeRates(s, content);
    expect(r.hungry).toBe(true);
    expect(r.workMult).toBeCloseTo(0.6);
    expect(r.feastWorkMult).toBe(1.25);
    const base = army(5);
    base.resources.food = 0;
    const b = computeRates(base, content);
    expect(r.siteCycles.birchGrove! / b.siteCycles.birchGrove!).toBeCloseTo(1.25, 9);
  });

  it('one 8 h advance equals the same time stepped online', () => {
    for (const activity of ['woodcutting', 'combat'] as const) {
      const start = feastOk(army(4, activity));
      const long = advance(start, 8 * 3600, content).state;
      const short = stepped(start, 8 * 3600, 30);
      expect(long.clock).toBeCloseTo(short.clock, 6);
      expect(long.feast).toEqual(short.feast);
      expect(long.resources.wood).toBeCloseTo(short.resources.wood, 3);
      expect(long.resources.food).toBeCloseTo(short.resources.food, 3);
      expect(long.stats.totalKills).toBeCloseTo(short.stats.totalKills, 3);
      expect(long.troops[0]!.xp).toBeCloseTo(short.troops[0]!.xp, 3);
    }
  });

  it('survives a save round-trip mid-feast', () => {
    const mid = advance(feastOk(army(3)), 200, content).state;
    const loaded = deserialize(serialize(mid));
    expect(loaded.feast).toEqual({ until: 600, readyAt: 1200 });
    const a = advance(mid, 500, content);
    const b = advance(loaded, 500, content);
    expect(b.state.feast).toEqual(a.state.feast);
    expect(b.state.resources.wood).toBeCloseTo(a.state.resources.wood, 9);
    expect(b.events.some((e) => e.type === 'feastEnded')).toBe(true);
  });
});

describe('save v8 -> v9', () => {
  const v8 = (done: string[], kills: number) => {
    const j = JSON.parse(serialize(army(4))) as Record<string, any>;
    delete j.feast;
    j.version = 8;
    j.objectivesCompleted = done;
    j.stats.totalKills = kills;
    j.resources = { food: 11, wood: 22, stone: 33, ore: 4 };
    return deserialize(JSON.stringify(j));
  };

  it('adds an unused feast and keeps resources', () => {
    const s = v8(['stage3'], 0);
    expect(s.version).toBe(9);
    expect(s.feast).toEqual({ until: 0, readyAt: 0 });
    expect(s.resources).toEqual({ food: 11, wood: 22, stone: 33, ore: 4 });
  });

  it('marks raids already passed as done silently, with no rewards', () => {
    const s = v8(['stage3'], 200);
    expect(s.objectivesCompleted).toEqual(expect.arrayContaining(['raid1', 'raid2']));
    const after = advance(s, 1, content).state;
    expect(after.resources.stone).toBe(33);
    expect(after.resources.ore).toBe(4);
  });

  it('leaves raids open below the thresholds or before stage3', () => {
    expect(v8(['stage3'], 100).objectivesCompleted).toEqual(expect.arrayContaining(['raid1']));
    expect(v8(['stage3'], 100).objectivesCompleted).not.toContain('raid2');
    expect(v8([], 500).objectivesCompleted).not.toContain('raid1');
  });
});
