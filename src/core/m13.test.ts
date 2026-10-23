// M13: zone 1 grows to level 40 (docs/PROGRESSION_V2.md §19): generator, eight bosses, iron, T2, formula buildings,
// the late recruit curve and the v9 -> v10 save migration.
import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { dispatch, recipeBlocker, trainCost, type Command } from './commands';
import { deserialize, serialize } from './save';
import { advance, catchUp, secureForOffline } from './simulation';
import { newGame, SAVE_VERSION } from './state';
import { beds, capacity, computeRates, estimatedBossDamage, nextBoss, stageSafety, troopStats } from './stats';
import type { GameState } from './types';

function run(state: GameState, ...cmds: Command[]): GameState {
  for (const cmd of cmds) {
    const r = dispatch(state, cmd, content);
    if (!r.ok) throw new Error(`${cmd.type}: ${r.error}`);
    state = r.state;
  }
  return state;
}

/** Everything unlocked, tutorial objectives done, `size` soldiers in one group, well fed. */
function sandbox(raceId = 'humans', size = 5): GameState {
  const s = newGame(raceId, content);
  s.unlocks = [
    'activity:combat', 'activity:mining', 'activity:woodcutting', 'activity:food', 'activity:construction', 'activity:smithing',
    'recruit', 'crafting', 'tier:1', 'boss', 'building:tents', 'building:trainingCamp', 'building:barracks', 'building:farm', 'building:forge',
    'building:woodshed', 'building:drillGround',
  ];
  s.objectivesCompleted = content.objectives.map((o) => o.id);
  s.troops[0]!.size = size;
  s.troops[0]!.engagedSize = size;
  s.resources.food = 1_000_000;
  return s;
}

/** The next boss gate is cleared (boss `defeated + 1` is ready) with all of the troop fighting. */
function gate(size: number, defeated = 0, raceId = 'humans'): GameState {
  const s = sandbox(raceId, size);
  const z = content.zones.farmsteads!;
  s.combat.bossesDefeated = defeated;
  s.combat.unlockedStage = (z.bosses[defeated]?.level ?? z.stages.length) - 1;
  s.combat.stageIndex = s.combat.unlockedStage;
  s.combat.cleared = true;
  s.troops[0]!.activity = 'combat';
  return s;
}

const z1 = content.zones.farmsteads!;

describe('M13 enemy generator (levels 6-40)', () => {
  it('has 40 stages, 8 bosses at levels 5, 10, ... 40, and the §19.1 cumulative kills', () => {
    expect(z1.stages).toHaveLength(40);
    expect(z1.bosses.map((b) => b.level)).toEqual([5, 10, 15, 20, 25, 30, 35, 40]);
    const cum = z1.bosses.map((b) => z1.stages.slice(0, b.level).reduce((n, st) => n + st.killsToClear, 0));
    // The first bands keep today's kills (56 and 112 to the first two bosses); tuning only changes the later ones.
    expect(cum.slice(0, 2)).toEqual([56, 112]);
    for (let i = 1; i < cum.length; i++) expect(cum[i]!).toBeGreaterThan(cum[i - 1]!);
  });

  it('levels 1-5 and Gamle Betarn are exactly as before the expansion', () => {
    expect(z1.stages.slice(0, 5).map((st) => [st.enemyId, st.killsToClear])).toEqual([
      ['wildChicken', 12], ['angryRooster', 12], ['fox', 12], ['wildBoar', 12], ['oldBoar', 8],
    ]);
    expect(content.enemies.oldBoar).toEqual({ id: 'oldBoar', name: 'Gammal galt', hp: 130, armour: 3, attack: 1.1, xp: 18, loot: { food: 3, ore: 2.5 } });
    expect(content.enemies.oldTusker).toMatchObject({ hp: 500, armour: 3, attack: 1.2, xp: 0 });
    expect(z1.bosses[0]).toEqual({ level: 5, enemyId: 'oldTusker', timeLimitSec: 90 });
  });

  it('matches the sample values of §19.1 at the elite levels (armour and attack; HP and XP are tuned)', () => {
    const at = (level: number) => content.enemies[z1.stages[level - 1]!.enemyId]!;
    expect(at(10)).toMatchObject({ name: 'Vargalfa', armour: 5 });
    expect(at(30)).toMatchObject({ name: 'Kullkung', armour: 11 });
    expect(at(40)).toMatchObject({ name: 'Borgens elit', armour: 15 });
    expect(at(40).attack).toBeCloseTo(12.9, 1);
    for (const l of [10, 20, 30, 40]) expect(at(l).hp).toBeGreaterThan(at(l - 5).hp);
  });

  it('enemy XP rises from the level-5 boar (18): never lower at level 6, and the 5-level moving average never falls', () => {
    const xp = z1.stages.map((st) => content.enemies[st.enemyId]!.xp);
    expect(xp[4]).toBe(18);
    expect(xp[5]!).toBeGreaterThanOrEqual(xp[4]!);
    let prev = -Infinity;
    for (let i = 4; i < xp.length; i++) {
      const avg = xp.slice(i - 4, i + 1).reduce((n, v) => n + v, 0) / 5;
      expect(avg, `xp window ending at level ${i + 1}`).toBeGreaterThanOrEqual(prev);
      prev = avg;
    }
    expect(xp[39]!).toBeGreaterThan(xp[4]! * 2);
  });

  it('the 5-level moving average of hp and armour never falls, and attack and xp grow with the level band', () => {
    const foes = z1.stages.map((st) => content.enemies[st.enemyId]!);
    for (const key of ['hp', 'armour'] as const) {
      let prev = -Infinity;
      for (let i = 4; i < foes.length; i++) {
        const avg = foes.slice(i - 4, i + 1).reduce((n, f) => n + f[key], 0) / 5;
        expect(avg, `${key} window ending at level ${i + 1}`).toBeGreaterThanOrEqual(prev);
        prev = avg;
      }
    }
    // The elite of each band is tougher than the elite of the band before.
    const elites = [5, 10, 15, 20, 25, 30, 35, 40].map((l) => foes[l - 1]!);
    for (let i = 1; i < elites.length; i++) {
      expect(elites[i]!.hp).toBeGreaterThan(elites[i - 1]!.hp);
      expect(elites[i]!.attack).toBeGreaterThan(elites[i - 1]!.attack);
      expect(elites[i]!.xp).toBeGreaterThan(elites[i - 1]!.xp);
    }
  });

  it('every boss is an enemy of its own: HP 4x the elite, rising HP, armour and attack, timers 90-150 s', () => {
    const bosses = z1.bosses.map((b) => content.enemies[b.enemyId]!);
    expect(bosses[0]!.hp).toBe(500);
    for (let i = 1; i < bosses.length; i++) {
      expect(bosses[i]!.hp).toBeGreaterThan(bosses[i - 1]!.hp);
      expect(bosses[i]!.armour).toBeGreaterThan(bosses[i - 1]!.armour);
      expect(bosses[i]!.attack).toBeGreaterThan(bosses[i - 1]!.attack);
    }
    expect(z1.bosses.map((b) => b.timeLimitSec)).toEqual([90, 90, 120, 120, 120, 150, 150, 150]);
    // Boss armour is the elite's + 2 (the elite of level 10 has armour 5).
    expect(bosses[1]!.armour).toBe(content.enemies[z1.stages[9]!.enemyId]!.armour + 2);
  });

  it('has Swedish family names per band', () => {
    expect(z1.bands?.map((b) => b.name)).toEqual(['Gårdarna', 'Skogsbrynet', 'Rövarstigen', 'Mossen', 'Ödegårdarna', 'Kullarna', 'Gränsmarken', 'Svartborgen']);
    expect(content.enemies[z1.stages[5]!.enemyId]!.name).toBe('Skogsmus-flock');
    expect(content.enemies[z1.stages[39]!.enemyId]!.name).toBe('Borgens elit');
  });
});

describe('M13 recruit curve (§19.5)', () => {
  const cost = (raceId: string, soldiers: number) => {
    const s = sandbox(raceId, soldiers);
    return trainCost(s, content);
  };

  it('soldiers 1-8 cost exactly what they cost before', () => {
    for (const [raceId, p] of [['humans', content.races.humans!.population], ['orcs', content.races.orcs!.population]] as const) {
      for (let n = 2; n <= 8; n++) {
        expect(cost(raceId, n)).toEqual({ food: Math.round(p.trainFood * Math.pow(1.5, n - 2)), sec: Math.round(p.trainSec * Math.pow(1.35, n - 2)) });
      }
    }
    expect(cost('humans', 2)).toEqual({ food: 40, sec: 90 });
  });

  it('continues smoothly after 8: still rising at the late growth factors of the content', () => {
    const lateFood = content.constants.trainFoodGrowthLate;
    const lateSec = content.constants.trainTimeGrowthLate;
    for (const raceId of ['humans', 'orcs']) {
      const at8 = cost(raceId, 8);
      let prev = at8;
      for (let n = 9; n <= 30; n++) {
        const c = cost(raceId, n);
        expect(c.food).toBeGreaterThan(prev.food);
        expect(c.sec).toBeGreaterThan(prev.sec);
        expect(c.food / prev.food).toBeCloseTo(lateFood, 1);
        expect(c.sec / prev.sec).toBeCloseTo(lateSec, 1);
        prev = c;
      }
      // The step from 8 to 9 is the late factor, not the old 1.5 / 1.35.
      expect(cost(raceId, 9).food / at8.food).toBeCloseTo(lateFood, 1);
      expect(lateFood).toBeLessThan(content.constants.trainFoodGrowth);
    }
    // The tail is steep but finite: soldier 29 for Humans costs thousands of food and a long drill.
    expect(cost('humans', 29).food).toBeGreaterThan(cost('humans', 20).food * 2);
    expect(cost('humans', 29).sec).toBeGreaterThan(cost('humans', 20).sec);
  });
});

describe('M13 bosses', () => {
  it('challenge needs a cleared boss level, takes the boss in order, and a boss cannot be repeated', () => {
    let s = sandbox('humans', 5);
    expect(dispatch(s, { type: 'challengeBoss' }, content).ok).toBe(false); // level 5 not cleared yet
    s = gate(5, 1);
    s = run(s, { type: 'challengeBoss' });
    expect(s.combat.boss).toMatchObject({ index: 1, hpLeft: 820, timeLeft: 90 });
    expect(nextBoss(s, content)!.enemy.name).toBe('Gråpäls, flockens ledare');
    const done = gate(5, 8);
    expect(dispatch(done, { type: 'challengeBoss' }, content).ok).toBe(false);
  });

  it('a timeout is a failure: non-lethal, back to level L-1, the boss stays ready, an event bossFailed', () => {
    // 20 soldiers out-heal boss 2 (3.4 dps against 4 hp/s) but are far too weak to kill it in 90 s.
    let s = gate(20, 1);
    s = run(s, { type: 'challengeBoss' });
    const r = advance(s, 200, content);
    const failed = r.events.find((e) => e.type === 'bossFailed');
    expect(failed).toMatchObject({ type: 'bossFailed', index: 1, reason: 'time' });
    expect(r.events.some((e) => e.type === 'soldierLost')).toBe(false);
    expect(r.state.combat.boss).toBeNull();
    expect(r.state.combat.bossesDefeated).toBe(1);
    expect(r.state.combat.stageIndex).toBe(8); // level 9
    expect(r.state.combat.cleared).toBe(true);
    expect(r.state.troops[0]!.size).toBe(20);
    // No cooldown: the player can challenge again at once.
    expect(dispatch(r.state, { type: 'challengeBoss' }, content).ok).toBe(true);
  });

  it('a retreat at 50 % wounds ends the fight early, nobody dies, wounds stay below one soldier', () => {
    let s = gate(10, 7); // the last boss (attack 25.6) against 10 fresh soldiers
    s = run(s, { type: 'challengeBoss' });
    const maxHp = troopStats(s, s.troops[0]!, content).maxHp;
    const r = advance(s, 150, content);
    const failed = r.events.find((e) => e.type === 'bossFailed');
    expect(failed).toMatchObject({ index: 7, reason: 'wounds' });
    expect((failed as { at: number }).at).toBeLessThan(10); // about 50 / 23.6 s
    const failAt = r.events.findIndex((e) => e.type === 'bossFailed');
    expect(r.events.slice(0, failAt).some((e) => e.type === 'soldierLost')).toBe(false);
    expect(maxHp).toBe(100);
    // Stopped right at the retreat point: the army lost half its HP and nobody fell.
    const stop = advance(s, (failed as { at: number }).at, content).state;
    expect(stop.troops[0]!.size).toBe(10);
    expect(stop.troops[0]!.wounds).toBeLessThan(10); // pooled wounds shrink to what one soldier carries
    const before = advance(s, (failed as { at: number }).at - 0.01, content).state;
    expect(before.combat.boss).not.toBeNull();
    expect(before.troops[0]!.wounds).toBeGreaterThan(0.45 * maxHp);
    expect(before.troops[0]!.wounds).toBeLessThan(0.5 * maxHp);
    expect(stop.combat.stageIndex).toBe(38); // level 39
    expect(stop.combat.boss).toBeNull();
  });

  it('wounds in a boss fight stop short of a lost soldier even when the fight goes on', () => {
    let s = gate(1, 7);
    s = run(s, { type: 'challengeBoss' });
    s.troops[0]!.activity = 'combat';
    // One soldier cannot reach 50 % ... it can: 50 % of one soldier is half its HP. The fight fails, nobody dies.
    const r = advance(s, 150, content);
    expect(r.events.some((e) => e.type === 'soldierLost')).toBe(false);
    expect(r.state.troops[0]!.size).toBe(1);
  });

  it('victory: counts the boss, opens the next levels, pays its rewards, records the time', () => {
    let s = gate(300, 1); // boss 2
    s = run(s, { type: 'challengeBoss' });
    const r = advance(s, 90, content);
    expect(r.events.find((e) => e.type === 'bossDefeated')).toMatchObject({ index: 1 });
    expect(r.state.combat).toMatchObject({ bossesDefeated: 2, cleared: false });
    expect(r.state.combat.unlockedStage).toBeGreaterThanOrEqual(10); // level 11 and on
    expect(r.state.stats.bossTimes[1]).toBeGreaterThan(0);
    expect(r.state.stats.bossTimes[0]).toBeNull();
  });

  it('boss objectives pay their rewards: Ekskogen + Exercis II (boss 2), slot 4 + Järngruvan (boss 3), tier 2 (boss 4), region 2 (boss 8)', () => {
    const win = (defeated: number) => {
      const s = gate(5000, defeated);
      s.objectivesCompleted = s.objectivesCompleted.filter((id) => id !== (defeated === 0 ? 'boss' : `boss${defeated + 1}`));
      return advance(run(s, { type: 'challengeBoss' }), content.zones.farmsteads!.bosses[defeated]!.timeLimitSec, content).state;
    };
    const b2 = win(1);
    expect(b2.unlocks).toEqual(expect.arrayContaining(['site:ekskogen', 'upgrade:drillPractice2']));
    expect(b2.troops.reduce((n, t) => n + t.size, 0)).toBe(5002);
    const b3 = win(2);
    expect(b3.troopSlots).toBe(2);
    expect(b3.unlocks).toContain('site:jarngruvan');
    const b4 = win(3);
    expect(b4.unlocks).toEqual(expect.arrayContaining(['tier:2', 'level:forge:3']));
    expect(b4.resources.ore).toBeGreaterThanOrEqual(150);
    const b8 = win(7);
    expect(b8.unlocks).toEqual(expect.arrayContaining(['region:2']));
    expect(b8.combat.bossesDefeated).toBe(8);
    expect(b8.combat.cleared).toBe(true);
    expect(dispatch(b8, { type: 'challengeBoss' }, content).ok).toBe(false);
    // Boss 1 no longer unlocks the region.
    const first = content.objectives.find((o) => o.id === 'boss')!;
    expect(first.rewards.unlocks).not.toContain('region:2');
    expect(first.rewards).toMatchObject({ troopSlots: 1, soldiers: 2 });
  });

  it('estimatedBossDamage compares needed and current dps and says whether the army wins', () => {
    const weak = gate(3, 3); // boss 4: 1500 hp in 120 s needs 12.5 dps
    const strong = gate(300, 3);
    const a = estimatedBossDamage(weak, content);
    const b = estimatedBossDamage(strong, content);
    expect(a).toMatchObject({ index: 3, hp: 1500, timeLimitSec: 120 });
    expect(a.neededDps).toBeCloseTo(12.5);
    expect(a.dps).toBeGreaterThan(0);
    expect(a.damage).toBeCloseTo(a.dps * 120);
    expect(a.canWin).toBe(false);
    expect(b.canWin).toBe(true);
    // The estimate agrees with the real fight.
    expect(advance(run(strong, { type: 'challengeBoss' }), 120, content).events.map((e) => e.type)).toContain('bossDefeated');
    expect(advance(run(weak, { type: 'challengeBoss' }), 120, content).events.map((e) => e.type)).toContain('bossFailed');
    expect(estimatedBossDamage(gate(5, 8), content).index).toBe(-1);
  });

  it('one long advance equals many short ones through a boss fight, a failure and a victory', () => {
    for (const [size, defeated] of [[40, 1], [300, 2]] as const) {
      const s = run(gate(size, defeated), { type: 'challengeBoss' });
      const once = advance(s, 400, content).state;
      let many = s;
      for (let i = 0; i < 800; i++) many = advance(many, 0.5, content).state;
      expect(many.combat.bossesDefeated).toBe(once.combat.bossesDefeated);
      expect(many.combat.stageIndex).toBe(once.combat.stageIndex);
      expect(many.combat.unlockedStage).toBe(once.combat.unlockedStage);
      expect(many.troops.map((t) => t.size)).toEqual(once.troops.map((t) => t.size));
      expect(many.troops[0]!.wounds).toBeCloseTo(once.troops[0]!.wounds, 5);
      expect(many.stats.bossTimes[defeated]?.toFixed(2) ?? null).toBe(once.stats.bossTimes[defeated]?.toFixed(2) ?? null);
    }
  });
});

describe('M13 levels, auto-advance and offline', () => {
  /** Frontier level `level` (1-based) is one kill from cleared, with a big safe army. */
  function oneKillFrom(level: number, size = 400): GameState {
    const s = sandbox('humans', size);
    s.combat.bossesDefeated = Math.floor((level - 1) / 5);
    s.combat.unlockedStage = level - 1;
    s.combat.stageIndex = level - 1;
    s.combat.kills = z1.stages[level - 1]!.killsToClear - 0.5;
    s.troops[0]!.activity = 'combat';
    return s;
  }

  it('clearing a level opens the next and moves the troops up when it is safe (auto-advance on)', () => {
    const r = advance(oneKillFrom(6), 60, content);
    expect(r.events.some((e) => e.type === 'stageCleared' && e.stage === 6)).toBe(true);
    expect(r.state.combat.unlockedStage).toBeGreaterThanOrEqual(6);
    expect(r.state.combat.stageIndex).toBeGreaterThanOrEqual(6);
  });

  it('auto-advance off: the troops keep farming the cleared level', () => {
    const s = oneKillFrom(6);
    s.combat.autoAdvance = false;
    const r = advance(s, 5, content).state;
    expect(r.combat.unlockedStage).toBe(6);
    expect(r.combat.stageIndex).toBe(5);
    expect(run(r, { type: 'setAutoAdvance', on: true }).combat.autoAdvance).toBe(true);
  });

  it('auto-advance stops at an unsafe level', () => {
    const s = oneKillFrom(26, 3); // three soldiers cannot hold level 27
    expect(stageSafety(s, content, { stageIndex: 26 }).risk).not.toBe('safe');
    s.combat.kills = 1e9;
    const r = advance(s, 0.001, content).state;
    expect(r.combat.unlockedStage).toBe(26);
    expect(r.combat.stageIndex).toBe(25);
  });

  it('clearing the boss level makes the boss ready (bossReady) instead of opening more levels', () => {
    const r = advance(oneKillFrom(5), 60, content);
    expect(r.state.combat).toMatchObject({ cleared: true, unlockedStage: 4 });
    expect(r.events.find((e) => e.type === 'bossReady')).toMatchObject({ index: 0 });
    expect(r.events.some((e) => e.type === 'zoneCleared')).toBe(true);
    // Past boss 1, the gate at level 10 waits for boss 2 (and says nothing about the zone).
    const r2 = advance(oneKillFrom(10), 60, content);
    expect(r2.state.combat).toMatchObject({ cleared: true, unlockedStage: 9 });
    expect(r2.events.find((e) => e.type === 'bossReady')).toMatchObject({ index: 1 });
    expect(r2.events.some((e) => e.type === 'zoneCleared')).toBe(false);
  });

  it('offline: a ready boss is never started, a boss in flight is abandoned, the troops farm on', () => {
    const s = gate(30, 2); // boss 3 ready
    const r = catchUp(s, 8 * 3600, 8 * 3600, content);
    expect(r.state.combat.boss).toBeNull();
    expect(r.state.combat.bossesDefeated).toBe(2);
    expect(r.events.some((e) => e.type === 'bossDefeated' || e.type === 'bossFailed')).toBe(false);
    expect(r.state.stats.totalKills).toBeGreaterThan(0);

    const fighting = run(gate(30, 2), { type: 'challengeBoss' });
    const off = catchUp(fighting, 8 * 3600, 8 * 3600, content);
    expect(off.events.find((e) => e.type === 'bossAbandoned')).toMatchObject({ index: 2 });
    expect(off.state.combat.bossesDefeated).toBe(2);
    expect(off.state.combat.boss).toBeNull();
  });

  it('offline: troops on an unsafe level walk down to the highest safe one (up to 40 levels)', () => {
    const s = sandbox('humans', 8);
    s.combat.unlockedStage = 38;
    s.combat.stageIndex = 38;
    s.troops[0]!.activity = 'combat';
    const r = secureForOffline(s, content);
    const stage = r.state.combat.stageIndex;
    expect(stage).toBeLessThan(38);
    expect(stageSafety(r.state, content, { stageIndex: stage }).risk).toBe('safe');
    // ... and it is the highest one.
    for (let i = stage + 1; i < 38; i++) expect(stageSafety(r.state, content, { stageIndex: i }).risk).not.toBe('safe');
    expect(r.events.map((e) => e.type)).toContain('stageChanged');
  });
});

describe('M13 iron and T2', () => {
  const miner = (siteId = 'jarngruvan') => {
    const s = sandbox('humans', 2);
    return run(s, { type: 'assignTroop', troopId: 'troop1', activity: 'mining', siteId });
  };

  it('Järngruvan is locked until boss 3 and then pays iron and stone per cycle of 90 s', () => {
    const locked = sandbox('humans', 2);
    expect(dispatch(locked, { type: 'assignTroop', troopId: 'troop1', activity: 'mining', siteId: 'jarngruvan' }, content).ok).toBe(false);
    const s = sandbox('humans', 2);
    s.unlocks.push('site:jarngruvan');
    const site = content.sites.jarngruvan!;
    expect(site).toMatchObject({ capacity: 2, cycleSec: 90 });
    const { iron, stone } = site.yield;
    const m = run(s, { type: 'assignTroop', troopId: 'troop1', activity: 'mining', siteId: 'jarngruvan' });
    const r = advance(m, 90 * 10 / (computeRates(m, content).siteCycles.jarngruvan! * 90), content).state;
    expect(r.resources.iron).toBeCloseTo(iron! * 10);
    expect(r.resources.stone).toBeCloseTo(stone! * 10);
    expect(r.stats.gathered.iron).toBeCloseTo(iron! * 10);
    expect(newGame('humans', content).resources.iron).toBe(0);
    void miner;
  });

  it('the iron objective fires on the first iron and pays 20 ore', () => {
    const s = sandbox('humans', 2);
    s.unlocks.push('site:jarngruvan');
    s.objectivesCompleted = s.objectivesCompleted.filter((id) => id !== 'iron1');
    const m = run(s, { type: 'assignTroop', troopId: 'troop1', activity: 'mining', siteId: 'jarngruvan' });
    const r = advance(m, 200, content);
    expect(r.state.objectivesCompleted).toContain('iron1');
    expect(r.state.resources.ore).toBeGreaterThanOrEqual(20);
  });

  it('Ekskogen pays 8 wood per 40 s with room for four after boss 2', () => {
    const s = sandbox('humans', 4);
    s.unlocks.push('site:ekskogen');
    expect(content.sites.ekskogen).toMatchObject({ capacity: 4, cycleSec: 40, yield: { wood: 8 } });
    const m = run(s, { type: 'assignTroop', troopId: 'troop1', activity: 'woodcutting', siteId: 'ekskogen' });
    expect(computeRates(m, content).perTroop.troop1!.working).toBe(4);
  });

  it('T2 recipes: iron + ore (bow: iron + wood), twice the smith work, mastery 2 of the same type at T1', () => {
    for (const w of ['sword', 'cleaver', 'axe']) {
      const r = content.equipment.recipes[`${w}_t2`]!;
      expect(r).toMatchObject({ tier: 2, workPerItem: 120, requiresMastery: { level: 2 } });
      expect(r.materials.iron).toBeGreaterThan(0);
      expect(r.materials.ore).toBeGreaterThan(0);
    }
    expect(content.equipment.recipes.bow_t2!.materials.iron).toBeGreaterThan(0);
    expect(content.equipment.recipes.bow_t2!.materials.wood).toBeGreaterThan(0);
    expect(content.equipment.recipes.bow_t2).toMatchObject({ workPerItem: 120 });
    expect(content.equipment.recipes.sword_t1!.workPerItem).toBe(60);
  });

  it('the T2 gate: locked without tier 2, then mastery 2 (80 crafted T1 of the same type), then craftable', () => {
    const s = sandbox('humans', 5);
    s.resources.iron = 1000;
    s.resources.ore = 1000;
    expect(recipeBlocker(s, 'sword_t2', content)).toBe('locked');
    expect(dispatch(s, { type: 'queueCraft', recipeId: 'sword_t2', count: 1 }, content).ok).toBe(false);
    s.unlocks.push('tier:2');
    expect(recipeBlocker(s, 'sword_t2', content)).toBe('mastery');
    s.crafting.crafted['sword:t1'] = 79;
    expect(recipeBlocker(s, 'sword_t2', content)).toBe('mastery');
    // Mastery of another type does not help.
    s.crafting.crafted['axe:t1'] = 500;
    expect(recipeBlocker(s, 'sword_t2', content)).toBe('mastery');
    s.crafting.crafted['sword:t1'] = 80;
    expect(recipeBlocker(s, 'sword_t2', content)).toBeNull();
    expect(recipeBlocker(s, 'cleaver_t2', content)).toBe('type'); // not this race's weapon
    const q = run(s, { type: 'queueCraft', recipeId: 'sword_t2', count: 2 });
    const rec = content.equipment.recipes.sword_t2!.materials;
    expect(q.resources.iron).toBe(1000 - 2 * rec.iron!);
    expect(q.resources.ore).toBe(1000 - 2 * rec.ore!);
  });

  it('a crafted T2 sword is x1.35 over T1 and goes to the troop through auto-equip', () => {
    let s = sandbox('humans', 2);
    s.unlocks.push('tier:2');
    s.crafting.crafted['sword:t1'] = 80;
    s.resources.iron = content.equipment.recipes.sword_t2!.materials.iron!;
    s.resources.ore = content.equipment.recipes.sword_t2!.materials.ore!;
    s.troops[0]!.activity = 'smithing';
    s = run(s, { type: 'queueCraft', recipeId: 'sword_t2', count: 1 });
    const r = advance(s, 400, content);
    expect(r.events.some((e) => e.type === 'weaponCrafted' && e.recipeId === 'sword_t2')).toBe(true);
    expect(r.state.troops[0]!.equipment.some((b) => b.tier === 2)).toBe(true);
    expect(r.state.crafting.crafted['sword:t2']).toBe(1);
    const t1 = content.equipment.tiers[0]!.powerMult;
    expect(content.equipment.tiers[1]!.powerMult / t1).toBeCloseTo(1.35);
    expect(r.state.objectivesCompleted).toContain('t2first');
  });

  it('the objectives mastery3 and t2first read the crafted counts', () => {
    const s = sandbox('humans', 2);
    s.objectivesCompleted = s.objectivesCompleted.filter((id) => id !== 'mastery3' && id !== 't2first');
    s.crafting.crafted['sword:t1'] = 179;
    expect(advance(s, 0, content).state.objectivesCompleted).not.toContain('mastery3');
    s.crafting.crafted['sword:t1'] = 180;
    s.crafting.crafted['sword:t2'] = 1;
    const r = advance(s, 0, content).state;
    expect(r.objectivesCompleted).toEqual(expect.arrayContaining(['mastery3', 't2first']));
  });
});

describe('M13 formula buildings and upgrades', () => {
  const lv = (id: string) => content.buildings[id]!.levels;

  it('level counts: tents 8, farm 6, woodshed 4, forge 5, barracks 5, Övningsplan 5', () => {
    expect([lv('tents').length, lv('farm').length, lv('woodshed').length, lv('forge').length, lv('barracks').length, lv('drillGround').length]).toEqual([8, 6, 4, 5, 5, 5]);
  });

  it('existing levels are unchanged; new ones follow the formulas and grow', () => {
    expect(lv('tents')[2]).toMatchObject({ cost: { wood: 80, stone: 50 }, work: 120 });
    expect(lv('tents')[3]).toMatchObject({ cost: { wood: 108, stone: 68 }, work: 150, requires: 'level:tents:4' });
    expect(lv('farm')[1]).toMatchObject({ cost: { wood: 70, stone: 40 }, work: 300 });
    expect(lv('woodshed')[1]).toMatchObject({ cost: { wood: 75, stone: 30 } });
    expect(lv('barracks')[2]).toMatchObject({ cost: { wood: 800, stone: 600, food: 200 } });
    expect(lv('barracks')[4]!.cost).toEqual({ wood: 3200, stone: 2400, food: 800 });
    expect(lv('forge')[2]!.cost).toMatchObject({ wood: 150, stone: 100, ore: 16 });
    for (const id of ['tents', 'farm', 'woodshed', 'forge', 'barracks', 'drillGround']) {
      for (let i = 1; i < lv(id).length; i++) {
        expect(lv(id)[i]!.work, `${id} ${i + 1}`).toBeGreaterThan(lv(id)[i - 1]!.work);
        expect(lv(id)[i]!.cost.wood ?? lv(id)[i]!.cost.food ?? 0, `${id} ${i + 1}`).toBeGreaterThanOrEqual(lv(id)[i - 1]!.cost.wood ?? lv(id)[i - 1]!.cost.food ?? 0);
      }
    }
  });

  it('a gated level needs its unlock; the levels after it need only resources', () => {
    let s = sandbox('humans', 5);
    s.buildings.tents = 3;
    s.resources = { food: 0, wood: 100_000, stone: 100_000, ore: 100_000, iron: 0 };
    expect(dispatch(s, { type: 'startConstruction', buildingId: 'tents' }, content).ok).toBe(false);
    s.unlocks.push('level:tents:4');
    s = run(s, { type: 'startConstruction', buildingId: 'tents' });
    expect(s.construction).toMatchObject({ buildingId: 'tents', level: 4 });
    s = sandbox('humans', 5);
    s.buildings.tents = 4;
    s.unlocks.push('level:tents:4');
    s.resources = { food: 0, wood: 100_000, stone: 100_000, ore: 0, iron: 0 };
    expect(dispatch(s, { type: 'startConstruction', buildingId: 'tents' }, content).ok).toBe(true); // level 5, no extra gate
  });

  it('beds, anvils, field slots and wood slots follow the levels (Humans: 14 beds today, 34 with everything)', () => {
    const s = sandbox('humans', 5);
    s.buildings = { tents: 3, trainingCamp: 1, barracks: 2 };
    expect(beds(s, content)).toBe(2 + 3 + 1 + 3 + 5);
    s.buildings = { tents: 8, trainingCamp: 1, barracks: 5 };
    expect(beds(s, content)).toBe(2 + 8 + 1 + 3 + 5 + 15);
    expect(beds({ ...s, raceId: 'orcs' }, content)).toBe(3 + 2 * (8 + 1 + 3 + 5 + 15));
    s.buildings = { forge: 5, farm: 6, woodshed: 4 };
    expect(capacity(s, content, 'smithing')).toBe(1 + 4);
    expect(capacity(s, content, 'fields')).toBe(3 + 5);
    expect(capacity(s, content, 'birchGrove')).toBe(3 + 4);
  });

  it('Övningsplan gives +8 % attack per level (additive with other multipliers)', () => {
    const s = sandbox('humans', 5);
    const base = troopStats(s, s.troops[0]!, content).attack;
    s.buildings.drillGround = 1;
    expect(troopStats(s, s.troops[0]!, content).attack / base).toBeCloseTo(1.08);
    s.buildings.drillGround = 5;
    expect(troopStats(s, s.troops[0]!, content).attack / base).toBeCloseTo(1.4);
    s.upgrades.drillPractice = 1;
    expect(troopStats(s, s.troops[0]!, content).attack / base).toBeCloseTo(1.65); // 1 + 0.4 + 0.25
  });

  it('Exercis II and Fältkök II exist; Farm III opens the second kitchen upgrade', () => {
    expect(content.upgrades.drillPractice2).toMatchObject({ cost: { food: 120, wood: 120 }, modifiers: [{ stat: 'attack', op: 'mult', value: 0.25 }] });
    expect(content.upgrades.fieldKitchens2).toMatchObject({ cost: { wood: 200, food: 150 }, modifiers: [{ stat: 'skill.food', op: 'mult', value: 0.3 }] });
    expect(lv('farm')[2]!.effects).toContainEqual({ kind: 'unlock', unlock: 'upgrade:fieldKitchens2' });
  });

  it('the objective list is consistent: unique ids, known requirements, boss goals in order', () => {
    const ids = content.objectives.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const o of content.objectives) for (const r of o.requires) expect(ids, `${o.id} requires ${r}`).toContain(r);
    const boss = content.objectives.filter((o) => o.condition.kind === 'bossDefeated').map((o) => (o.condition.kind === 'bossDefeated' ? (o.condition.index ?? 1) : 0));
    expect(boss).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const id of ['barracks1', 'drill1', 'lvl8', 'soldiers10', 'tents5', 'farm4', 'iron1', 'weapons60', 'soldiers14', 't2first', 'kills300', 'forge4', 'mastery3', 'drill3', 'farm6', 'soldiers22', 'kills500', 'barracks5', 'drill5', 'weapons400', 'soldiers28']) {
      expect(ids, id).toContain(id);
    }
  });
});

describe('M13 save v9 -> v10', () => {
  /** A v9 save: the current state with the old single-boss shape. */
  function v9(mutate: (j: Record<string, any>) => void): GameState {
    const j = JSON.parse(serialize(sandbox('humans', 7))) as Record<string, any>;
    j.version = 9;
    delete j.resources.iron;
    delete j.stats.gathered.iron;
    delete j.stats.bossTimes;
    delete j.combat.bossesDefeated;
    delete j.combat.autoAdvance;
    j.combat.bossDefeated = false;
    j.stats.bossDefeatedAt = null;
    j.resources = { food: 11, wood: 22, stone: 33, ore: 44 };
    mutate(j);
    return deserialize(JSON.stringify(j));
  }


  it('a troop keeps its level across the steeper XP curve above level 12', () => {
    const oldXp = Math.round(25 * Math.pow(19, 1.7)) + 5; // level 20 under the v9 curve
    const s = v9((j) => { j.troops[0].xp = oldXp; });
    expect(troopStats(s, s.troops[0]!, content).level).toBe(20);
    expect(s.troops[0]!.xp).toBeGreaterThan(oldXp);
    const low = v9((j) => { j.troops[0].xp = 300; });
    expect(low.troops[0]!.xp).toBe(300);
  });
  it('a save that beat the boss continues at level 6 with the same soldiers and resources, plus iron 0', () => {
    const s = v9((j) => {
      j.combat.bossDefeated = true;
      j.combat.cleared = false;
      j.combat.unlockedStage = 4;
      j.combat.stageIndex = 3;
      j.combat.kills = 5;
      j.stats.bossDefeatedAt = 2400;
      j.unlocks.push('region:2');
      j.objectivesCompleted = j.objectivesCompleted.filter((id: string) => !/^(boss[2-8]|lvl\d+)$/.test(id));
    });
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.combat).toMatchObject({ bossesDefeated: 1, unlockedStage: 5, stageIndex: 3, kills: 0, cleared: false, autoAdvance: true, boss: null });
    expect(s.troops.reduce((n, t) => n + t.size, 0)).toBe(7);
    expect(s.resources).toEqual({ food: 11, wood: 22, stone: 33, ore: 44, iron: 0 });
    expect(s.stats.gathered.iron).toBe(0);
    expect(s.stats.bossTimes).toEqual([2400, null, null, null, null, null, null, null]);
    expect(s.unlocks).not.toContain('region:2');
    expect(s.unlocks).not.toContain('tier:2');
    expect(s.unlocks).toEqual(expect.arrayContaining(['building:drillGround', 'level:tents:4', 'level:farm:3']));
    expect(s.objectivesCompleted).toContain('boss');
    expect(s.objectivesCompleted).not.toContain('boss2');
    // It plays on: the troops can pick level 6 and the game runs.
    const played = advance(run(s, { type: 'selectStage', stageIndex: 5 }), 60, content).state;
    expect(played.troops.reduce((n, t) => n + t.size, 0)).toBe(7);
  });

  it('a save that cleared the zone but has not beaten the boss can still start boss 1', () => {
    const s = v9((j) => {
      j.combat.cleared = true;
      j.combat.unlockedStage = 4;
      j.unlocks.push('boss');
    });
    expect(s.combat).toMatchObject({ bossesDefeated: 0, cleared: true, unlockedStage: 4 });
    const fight = run(s, { type: 'challengeBoss' });
    expect(fight.combat.boss).toMatchObject({ index: 0, hpLeft: 500 });
  });

  it('a pre-boss save keeps its stage and progress', () => {
    const s = v9((j) => {
      j.combat.stageIndex = 2;
      j.combat.unlockedStage = 3;
      j.combat.kills = 7;
    });
    expect(s.combat).toMatchObject({ stageIndex: 2, unlockedStage: 3, kills: 7, bossesDefeated: 0, cleared: false });
    expect(s.stats.bossTimes).toEqual([null, null, null, null, null, null, null, null]);
  });

  it('a boss fight in flight becomes boss index 0 (and is abandoned on load by the offline rule)', () => {
    const s = v9((j) => {
      j.combat.cleared = true;
      j.combat.unlockedStage = 4;
      j.combat.boss = { hpLeft: 123, timeLeft: 45 };
    });
    expect(s.combat.boss).toEqual({ index: 0, hpLeft: 123, timeLeft: 45 });
    const r = secureForOffline(s, content);
    expect(r.state.combat.boss).toBeNull();
    expect(r.events.find((e) => e.type === 'bossAbandoned')).toMatchObject({ index: 0 });
  });

  it('migrates all the way from version 1 to the current version', () => {
    const j = JSON.parse(serialize(sandbox('orcs', 4))) as Record<string, any>;
    j.version = 1;
    for (const t of j.troops) {
      delete t.wounds;
      delete t.engagedSize;
      delete t.weaponTypeId;
      delete t.equipment;
      t.gearTier = 0;
    }
    delete j.armoury;
    delete j.crafting;
    delete j.combat.unlockedStage;
    delete j.combat.bossesDefeated;
    delete j.combat.autoAdvance;
    j.combat.bossDefeated = true;
    j.resources = { food: 5, wood: 5, stone: 5, ore: 5 };
    j.stats = { totalKills: 3, recruited: 0, gathered: { food: 1, wood: 1, stone: 1, ore: 1 } };
    const s = deserialize(JSON.stringify(j));
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.combat.bossesDefeated).toBe(1);
    expect(s.resources.iron).toBe(0);
    expect(s.stats.bossTimes[0]).not.toBeNull();
  });
});
