// Balance regression guard: fails when a content change pushes pacing outside the targets.
// Times are bot times (the bot acts every 5 s); with work cycles a real player is ~1.2–1.5× slower.
// Targets: docs/PROGRESSION_V2.md §11 and docs/BALANCE_LOG.md.
import { describe, expect, it } from 'vitest';
import { content } from '../../src/content';
import { equippedCount, masteryLevel, newGame } from '../../src/core';
import { runBot } from './bot';

const run = (raceId: string) =>
  runBot(newGame(raceId, content), content, {
    raceId,
    strategy: 'balanced',
    maxSeconds: 90 * 60,
    tickSeconds: 5,
    snapshotEverySeconds: 300,
  });

const runEconomy = (raceId: string) =>
  runBot(newGame(raceId, content), content, {
    raceId,
    strategy: 'economy',
    maxSeconds: 90 * 60,
    tickSeconds: 5,
    snapshotEverySeconds: 300,
  });

const runCareless = (raceId: string) =>
  runBot(newGame(raceId, content), content, {
    raceId,
    strategy: 'careless',
    maxSeconds: 120 * 60,
    tickSeconds: 5,
    snapshotEverySeconds: 300,
  });

const runFeast = (raceId: string) =>
  runBot(newGame(raceId, content), content, {
    raceId,
    strategy: 'feast',
    maxSeconds: 90 * 60,
    tickSeconds: 5,
    snapshotEverySeconds: 300,
  });

const soldiersAt = (r: ReturnType<typeof run>, minute: number) => {
  const snap = r.snapshots.find((x) => x.t >= minute * 60 - 1e-6) ?? r.snapshots[r.snapshots.length - 1]!;
  return snap.troops.reduce((n, t) => n + t.size, 0);
};

describe('Gårdarna pacing, progression v2 (balanced bot, docs/PROGRESSION_V2.md §11)', () => {
  const humans = run('humans');
  const orcs = run('orcs');
  const humansEco = runEconomy('humans');
  const orcsEco = runEconomy('orcs');
  const humansCareless = runCareless('humans');
  const orcsCareless = runCareless('orcs');
  const humansFeast = runFeast('humans');
  const orcsFeast = runFeast('orcs');

  it('soldier 2 is rescued within 4–8 bot minutes', () => {
    for (const r of [humans, orcs]) {
      expect(r.milestones['soldiers:2']).toBeGreaterThan(4 * 60);
      expect(r.milestones['soldiers:2']).toBeLessThan(8 * 60);
    }
  });

  it('group 2 opens within 12–18 bot minutes (D-33)', () => {
    for (const r of [humans, orcs]) {
      const t = r.milestones['troop:troop2'];
      expect(t).toBeGreaterThan(12 * 60);
      expect(t).toBeLessThan(18 * 60);
    }
  });

  it('Humans have 3–6 soldiers at 30 and at 40 minutes; Orcs 1.0–1.6× as many', () => {
    for (const m of [30, 40]) {
      expect(soldiersAt(humans, m)).toBeGreaterThanOrEqual(3);
      expect(soldiersAt(humans, m)).toBeLessThanOrEqual(6);
    }
    const ratio = soldiersAt(orcs, 30) / soldiersAt(humans, 30);
    expect(ratio).toBeGreaterThanOrEqual(1);
    expect(ratio).toBeLessThanOrEqual(1.6);
  });

  it('a careful player loses no soldiers before the boss fight', () => {
    for (const r of [humans, orcs]) {
      const firstLoss = r.milestones['firstLoss'];
      if (firstLoss !== undefined) expect(firstLoss).toBeGreaterThanOrEqual(r.milestones['objective:zoneCleared']!);
    }
  });

  it('both races defeat the boss within 40–60 bot minutes, within ±25 % of each other', () => {
    for (const r of [humans, orcs]) {
      expect(r.milestones['boss']).toBeGreaterThan(40 * 60);
      expect(r.milestones['boss']).toBeLessThan(60 * 60);
    }
    const h = humans.milestones['boss']!;
    const o = orcs.milestones['boss']!;
    expect(Math.abs(o - h) / h).toBeLessThan(0.25);
  });

  it('the boss frees two prisoners into a third group (M10b: its size may differ, but it exists)', () => {
    for (const r of [humans, orcs]) {
      expect(r.finalState.troops).toHaveLength(3);
      expect(r.finalState.troops[2]!.size).toBeGreaterThanOrEqual(2);
    }
  });

  // Owner decision (M10b, D-53 follow-up): the gap guard applies to the careful (balanced) player;
  // the economy bot barely fights and is a comparison, not a player. M12 (§18.2): the raid objectives
  // close the Orcs' mid-game hole, so both races now get 4 minutes.
  it('M12: no long gap between events in minutes 15–45 (balanced: Humans 4 min, Orcs 4 min)', () => {
    expect(humans.longestEventGap(15, 45) * 60, 'humans').toBeLessThanOrEqual(240);
    expect(orcs.longestEventGap(15, 45) * 60, 'orcs').toBeLessThanOrEqual(240);
  });

  // Measured when the boss fight starts: the boss's freed prisoners arrive unarmed afterwards.
  it('M10b: at least 80 % of the soldiers are armed when the boss fight starts, and mastery reaches 1', () => {
    for (const r of [humans, orcs]) {
      const a = r.armedAtBoss!;
      expect(a, 'boss fight started').not.toBeNull();
      expect(a.armed / a.soldiers, `${a.armed}/${a.soldiers}`).toBeGreaterThanOrEqual(0.8);
      const s = r.finalState;
      const mk = Object.keys(s.crafting.crafted)[0];
      expect(mk ? masteryLevel(s.crafting.crafted[mk]!, content) : 0).toBeGreaterThanOrEqual(1);
    }
  });

  it('M10b: Humans build the forge by minute 30 and beat the boss by minute 48', () => {
    expect(humans.milestones['building:forge:1']).toBeLessThanOrEqual(30 * 60);
    expect(humans.milestones['boss']).toBeLessThanOrEqual(48 * 60);
  });

  // Guiding goals only: Forge II and Farm II are goals after the boss (a bridge to region 2), and the
  // optional goals (ore10, farm2) never block (Orcs get their ore from loot and skip ore10).
  it('M10b: the balanced bot completes the new guiding pre-boss objectives by minute 50', () => {
    for (const r of [humans, orcs]) {
      for (const id of ['tent2', 'woodshed', 'rescue2', 'raid1', 'raid2']) {
        const t = r.milestones[`objective:${id}`];
        expect(t, id).toBeDefined();
        expect(t, id).toBeLessThanOrEqual(50 * 60);
      }
    }
  });

  it('the first 15 minutes never go more than 90 s without something completing', () => {
    for (const r of [humans, orcs]) expect(r.longestQuietGapEarly).toBeLessThanOrEqual(90);
  });

  // M11 (D-55/D-56): upkeep is a real food sink. Humans are the better farmers (D-13), so a short
  // stint on the fields covers them: their food floor is 4 %, the Orcs' 8 %.
  it('every start activity is used for at least 5 % of its troop-time (food: Humans 4 %, Orcs 8 %)', () => {
    const start = ['combat', 'mining', 'woodcutting', 'food', 'construction'] as const;
    for (const [name, r, foodFloor] of [['humans', humans, 0.04], ['orcs', orcs, 0.08]] as const) {
      const total = start.reduce((n, a) => n + r.activityTime[a], 0);
      for (const a of start) expect(r.activityTime[a] / total, `${name} ${a}`).toBeGreaterThan(a === 'food' ? foodFloor : 0.05);
    }
  });

  it('troops smith: the forge job is used and the army gets weapons', () => {
    for (const r of [humans, orcs]) {
      const total = Object.values(r.activityTime).reduce((a, b) => a + b, 0);
      expect(r.activityTime.smithing / total).toBeGreaterThan(0.01);
      expect(r.finalState.stats.weaponsCrafted).toBeGreaterThan(3);
    }
  });

  // M11 (D-55, §17.4): the careful player keeps the army fed.
  it('M11: the balanced bot is hungry at most 4 min in total before the boss, never more than 90 s at a time', () => {
    for (const [name, r] of [['humans', humans], ['orcs', orcs]] as const) {
      expect(r.hungrySec, `${name} total`).toBeLessThanOrEqual(4 * 60);
      expect(r.longestHungrySec, `${name} longest`).toBeLessThanOrEqual(90);
    }
  });

  // Hunger only slows: a player who never reacts still wins, within +40 % of the balanced time.
  it('M11: a careless bot that ignores food still beats the boss within +40 % of the balanced time', () => {
    for (const [name, c, b] of [['humans', humansCareless, humans], ['orcs', orcsCareless, orcs]] as const) {
      expect(c.milestones['boss'], `${name} boss`).toBeDefined();
      expect(c.milestones['boss']!, name).toBeLessThanOrEqual(b.milestones['boss']! * 1.4);
    }
  });

  // M12 (D-57, §18.3): the Feast is optional. The balanced bot never feasts, so its results do not depend on it.
  it('M12: the balanced bot never feasts', () => {
    for (const r of [humans, orcs, humansCareless, orcsCareless]) expect(r.finalState.feast).toEqual({ until: 0, readyAt: 0 });
  });

  it('M12: the feast bot does feast, and beats the boss 3–10 % faster than the balanced bot', () => {
    for (const [name, f, b] of [['humans', humansFeast, humans], ['orcs', orcsFeast, orcs]] as const) {
      expect(f.finalState.feast.readyAt, `${name} feasted`).toBeGreaterThan(0);
      const gain = 1 - f.milestones['boss']! / b.milestones['boss']!;
      expect(gain, `${name} gain ${(gain * 100).toFixed(1)} %`).toBeGreaterThanOrEqual(0.03);
      expect(gain, `${name} gain ${(gain * 100).toFixed(1)} %`).toBeLessThanOrEqual(0.1);
    }
  });
});

// M13 (docs/PROGRESSION_V2.md §19.3, D-59): zone 1 grows to level 40. The check-in player (acts every 45 minutes
// after the first two hours, sleeps 8 h per day) should take about 32 h; the window is 24-40 h.
describe('M13 zone 1 to level 40 (checkin bot, docs/PROGRESSION_V2.md §19.3)', () => {
  const runCheckin = (raceId: string) =>
    runBot(newGame(raceId, content), content, {
      raceId,
      strategy: 'checkin',
      maxSeconds: 60 * 3600,
      tickSeconds: 5,
      snapshotEverySeconds: 3600,
      stopAtBoss: 8,
    });
  const humans = runCheckin('humans');
  const orcs = runCheckin('orcs');
  const HOUR = 3600;
  /** The army when the fight that won the boss started (the first fight if only one was needed). */
  const startOf = (r: ReturnType<typeof runCheckin>, boss: number) => {
    const starts = r.bossStarts.filter((x) => x.boss === boss);
    return starts.find((x) => !x.failed) ?? starts[starts.length - 1]!;
  };
  const medianLevelMinutes = (r: ReturnType<typeof runCheckin>) => {
    const per: number[] = [];
    for (let l = 6; l <= 20; l++) per.push((r.levelTimes[l + 1]! - r.levelTimes[l]!) / 60);
    per.sort((a, b) => a - b);
    return per[Math.floor(per.length / 2)]!;
  };

  it('both races beat the level-40 boss at 24-40 h of game time', () => {
    for (const [name, r] of [['humans', humans], ['orcs', orcs]] as const) {
      const t = r.bossTimes[7];
      expect(t, `${name} boss 8`).not.toBeNull();
      expect(t! / HOUR, name).toBeGreaterThanOrEqual(24);
      expect(t! / HOUR, name).toBeLessThanOrEqual(40);
    }
  });

  it('levels 6-20 take a median of 8-18 minutes each', () => {
    for (const [name, r] of [['humans', humans], ['orcs', orcs]] as const) {
      const m = medianLevelMinutes(r);
      expect(m, name).toBeGreaterThanOrEqual(8);
      expect(m, name).toBeLessThanOrEqual(18);
    }
  });

  it('22-35 soldiers, at least 60 % of the armed on T2 and troop level at most 60 when the last boss fight starts', () => {
    for (const [name, r] of [['humans', humans], ['orcs', orcs]] as const) {
      const s = startOf(r, 8);
      expect(s.soldiers, `${name} soldiers`).toBeGreaterThanOrEqual(22);
      expect(s.soldiers, `${name} soldiers`).toBeLessThanOrEqual(35);
      expect(s.t2Armed / s.armed, `${name} T2 ${s.t2Armed}/${s.armed}`).toBeGreaterThanOrEqual(0.6);
      expect(s.troopLevel, `${name} troop level`).toBeLessThanOrEqual(60);
    }
  });

  it('Orcs finish level 40 within 0.85-1.25x of the Humans time', () => {
    const ratio = orcs.bossTimes[7]! / humans.bossTimes[7]!;
    expect(ratio, `ratio ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(0.85);
    expect(ratio, `ratio ${ratio.toFixed(2)}`).toBeLessThanOrEqual(1.25);
  });

  it('no wait between two consecutive bosses is longer than 12 h', () => {
    for (const [name, r] of [['humans', humans], ['orcs', orcs]] as const) {
      for (let i = 1; i < 8; i++) {
        const gap = (r.bossTimes[i]! - r.bossTimes[i - 1]!) / HOUR;
        expect(gap, `${name} boss ${i} to ${i + 1}`).toBeLessThanOrEqual(12);
      }
    }
  });
});
