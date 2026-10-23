import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { limiters, secondsPerKill, secondsToNextCycle } from './limits';
import { advance } from './simulation';
import { newGame } from './state';
import { computeRates, beds } from './stats';
import type { GameState } from './types';

function base(size = 1): GameState {
  const s = newGame('humans', content);
  s.unlocks = ['activity:combat', 'activity:mining', 'activity:woodcutting', 'activity:food', 'activity:construction', 'recruit'];
  s.troops[0]!.size = size;
  s.troops[0]!.engagedSize = size;
  s.resources.food = 1000;
  return s;
}

const kinds = (s: GameState) => limiters(s, content).map((l) => l.kind);

describe('limiters', () => {
  it('flags an idle troop as a block on the forces tab', () => {
    const l = limiters(base(), content).find((x) => x.kind === 'idleTroop')!;
    expect(l).toMatchObject({ severity: 'block', troopId: 'troop1', tab: 'forces' });
  });

  it('has nothing to report for a busy troop with nothing else going on', () => {
    const s = base();
    s.troops[0]!.activity = 'woodcutting';
    s.troops[0]!.siteId = 'birchGrove';
    s.unlocks = s.unlocks.filter((u) => u !== 'recruit');
    expect(limiters(s, content)).toEqual([]);
  });

  it('flags a project without builders and a queue without smiths', () => {
    const s = base();
    s.troops[0]!.activity = 'combat';
    s.construction = { buildingId: 'tents', level: 1, progress: 0 };
    s.crafting.queue = [{ recipeId: 'sword_t1', remaining: 2 }];
    const l = limiters(s, content);
    expect(l.find((x) => x.kind === 'noBuilder')).toMatchObject({ severity: 'block', tab: 'settlement' });
    expect(l.find((x) => x.kind === 'noSmith')).toMatchObject({ severity: 'block', tab: 'forge' });
    s.troops[0]!.activity = 'construction';
    expect(kinds(s)).not.toContain('noBuilder');
  });

  it('flags full beds, then missing food, and shows training as info', () => {
    const s = base(beds(newGame('humans', content), content));
    s.troops[0]!.activity = 'combat';
    expect(limiters(s, content).find((x) => x.kind === 'beds')).toMatchObject({ severity: 'block', tab: 'settlement', current: s.troops[0]!.size, max: s.troops[0]!.size });

    const s2 = base(1);
    s2.troops[0]!.activity = 'combat';
    s2.resources.food = 0;
    expect(limiters(s2, content).find((x) => x.kind === 'trainingFood')).toMatchObject({ severity: 'slow', current: 0 });
    expect(kinds(s2)).not.toContain('beds');

    const s3 = base(1);
    s3.troops[0]!.activity = 'combat';
    s3.training = { troopId: 'troop1', secLeft: 12, totalSec: 20 };
    const l = limiters(s3, content);
    expect(l.find((x) => x.kind === 'training')).toMatchObject({ severity: 'info', secondsLeft: 12, max: 20, tab: 'forces' });
    expect(kinds(s3)).not.toContain('trainingFood');
  });

  it('flags a gathering troop that does not fit on its site', () => {
    const cap = content.sites.birchGrove!.capacity;
    const s = base(cap + 2);
    s.unlocks = s.unlocks.filter((u) => u !== 'recruit');
    s.troops[0]!.activity = 'woodcutting';
    s.troops[0]!.siteId = 'birchGrove';
    expect(limiters(s, content)).toEqual([
      { kind: 'siteFull', severity: 'slow', troopId: 'troop1', siteId: 'birchGrove', current: cap, max: cap + 2, tab: 'forces' },
    ]);
  });

  it('flags a crew that is bigger than the available builders or smiths', () => {
    const s = base(20);
    s.unlocks = s.unlocks.filter((u) => u !== 'recruit');
    s.troops[0]!.activity = 'construction';
    s.construction = { buildingId: 'tents', level: 1, progress: 0 };
    const c = limiters(s, content).find((x) => x.kind === 'crewFull')!;
    expect(c).toMatchObject({ target: 'construction', severity: 'slow', tab: 'settlement', max: 20 });
    expect(c.current).toBeLessThan(20);

    s.construction = null;
    s.troops[0]!.activity = 'smithing';
    s.crafting.queue = [{ recipeId: 'sword_t1', remaining: 1 }];
    expect(limiters(s, content).find((x) => x.kind === 'crewFull')).toMatchObject({ target: 'smithing', tab: 'forge' });
  });

  it('sorts block before slow before info, keeping troop order', () => {
    const s = base(content.sites.birchGrove!.capacity + 2);
    s.troopSlots = 2;
    s.troops.push({ ...s.troops[0]!, equipment: [], id: 'troop2', name: 'Två', size: 1, activity: null, siteId: null });
    s.troops[0]!.activity = 'woodcutting';
    s.troops[0]!.siteId = 'birchGrove';
    s.training = { troopId: 'troop1', secLeft: 5, totalSec: 10 };
    const l = limiters(s, content);
    expect(l.map((x) => x.severity)).toEqual(['block', 'slow', 'info']);
    expect(l.map((x) => x.kind)).toEqual(['idleTroop', 'siteFull', 'training']);
  });
});

describe('secondsPerKill', () => {
  it('is 1 / killsPerSec while fighting and null otherwise', () => {
    const s = base(3);
    expect(secondsPerKill(s, content)).toBeNull();
    s.troops[0]!.activity = 'combat';
    const k = computeRates(s, content).killsPerSec;
    expect(k).toBeGreaterThan(0);
    expect(secondsPerKill(s, content)).toBeCloseTo(1 / k, 9);
  });

  it('is null during a boss fight', () => {
    const s = base(3);
    s.troops[0]!.activity = 'combat';
    s.combat.boss = { hpLeft: 100, timeLeft: 60 };
    expect(secondsPerKill(s, content)).toBeNull();
  });
});

describe('secondsToNextCycle', () => {
  const grove = content.sites.birchGrove!;

  it('counts down with the carried progress and is null when nobody works the site', () => {
    const s = base(1);
    expect(secondsToNextCycle(s, content, 'birchGrove')).toBeNull();
    s.troops[0]!.activity = 'woodcutting';
    s.troops[0]!.siteId = 'birchGrove';
    expect(secondsToNextCycle(s, content, 'birchGrove')).toBeCloseTo(grove.cycleSec, 9);
    expect(secondsToNextCycle(s, content, 'oldQuarry')).toBeNull();
    const later = advance(s, 10, content).state;
    expect(secondsToNextCycle(later, content, 'birchGrove')).toBeCloseTo(grove.cycleSec - 10, 6);
  });

  it('one long advance equals many short ones', () => {
    const s = base(1);
    s.troops[0]!.activity = 'woodcutting';
    s.troops[0]!.siteId = 'birchGrove';
    let many = s;
    for (let i = 0; i < 7; i++) many = advance(many, 5, content).state;
    const one = advance(s, 35, content).state;
    expect(secondsToNextCycle(many, content, 'birchGrove')).toBeCloseTo(secondsToNextCycle(one, content, 'birchGrove')!, 6);
  });
});
