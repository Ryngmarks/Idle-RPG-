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

const soldiersAt = (r: ReturnType<typeof run>, minute: number) => {
  const snap = r.snapshots.find((x) => x.t >= minute * 60 - 1e-6) ?? r.snapshots[r.snapshots.length - 1]!;
  return snap.troops.reduce((n, t) => n + t.size, 0);
};

describe('Gårdarna pacing, progression v2 (balanced bot, docs/PROGRESSION_V2.md §11)', () => {
  const humans = run('humans');
  const orcs = run('orcs');
  const humansEco = runEconomy('humans');
  const orcsEco = runEconomy('orcs');

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
  // the economy bot barely fights and is a comparison, not a player. Orcs get 7 minutes.
  it('M10b: no long gap between events in minutes 15–45 (balanced: Humans 4 min, Orcs 7 min)', () => {
    expect(humans.longestEventGap(15, 45) * 60, 'humans').toBeLessThanOrEqual(240);
    expect(orcs.longestEventGap(15, 45) * 60, 'orcs').toBeLessThanOrEqual(420);
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
      for (const id of ['tent2', 'woodshed', 'rescue2']) {
        const t = r.milestones[`objective:${id}`];
        expect(t, id).toBeDefined();
        expect(t, id).toBeLessThanOrEqual(50 * 60);
      }
    }
  });

  it('the first 15 minutes never go more than 90 s without something completing', () => {
    for (const r of [humans, orcs]) expect(r.longestQuietGapEarly).toBeLessThanOrEqual(90);
  });

  // Owner decision (M10b): food needs a real sink (upkeep) later; until then the floor for food is 4 %.
  it('every start activity is used for at least 5 % of its troop-time (food 4 %)', () => {
    const start = ['combat', 'mining', 'woodcutting', 'food', 'construction'] as const;
    for (const r of [humans, orcs]) {
      const total = start.reduce((n, a) => n + r.activityTime[a], 0);
      for (const a of start) expect(r.activityTime[a] / total, `${a}`).toBeGreaterThan(a === 'food' ? 0.04 : 0.05);
    }
  });

  it('troops smith: the forge job is used and the army gets weapons', () => {
    for (const r of [humans, orcs]) {
      const total = Object.values(r.activityTime).reduce((a, b) => a + b, 0);
      expect(r.activityTime.smithing / total).toBeGreaterThan(0.01);
      expect(r.finalState.stats.weaponsCrafted).toBeGreaterThan(3);
    }
  });
});
