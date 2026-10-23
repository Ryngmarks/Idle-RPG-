// Balance regression guard: fails when a content change pushes pacing outside the targets.
// Times are bot times (the bot acts every 5 s); with work cycles a real player is ~1.2–1.5× slower.
// Targets: docs/PROGRESSION_V2.md §11 and docs/BALANCE_LOG.md.
import { describe, expect, it } from 'vitest';
import { content } from '../../src/content';
import { newGame } from '../../src/core';
import { runBot } from './bot';

const run = (raceId: string) =>
  runBot(newGame(raceId, content), content, {
    raceId,
    strategy: 'balanced',
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

  it('the boss frees two prisoners into a third group', () => {
    for (const r of [humans, orcs]) {
      expect(r.finalState.troops).toHaveLength(3);
      expect(r.finalState.troops[2]!.size).toBe(2);
    }
  });

  it('the first 15 minutes never go more than 90 s without something completing', () => {
    for (const r of [humans, orcs]) expect(r.longestQuietGapEarly).toBeLessThanOrEqual(90);
  });

  it('every start activity is used for at least 5 % of its troop-time', () => {
    const start = ['combat', 'mining', 'woodcutting', 'food', 'construction'] as const;
    for (const r of [humans, orcs]) {
      const total = start.reduce((n, a) => n + r.activityTime[a], 0);
      for (const a of start) expect(r.activityTime[a] / total, `${a}`).toBeGreaterThan(0.05);
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
