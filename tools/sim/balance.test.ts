// Balance regression guard: fails when a content change pushes pacing outside the P0 targets.
// Times are bot times (the bot acts instantly every 5 s); real players are roughly 1.5–2× slower.
// Targets: docs/ROADMAP.md §2.6 and docs/BALANCE_LOG.md.
import { describe, expect, it } from 'vitest';
import { content } from '../../src/content';
import { newGame } from '../../src/core';
import { runBot } from './bot';

const run = (raceId: string) =>
  runBot(newGame(raceId, content), content, {
    raceId,
    strategy: 'balanced',
    maxSeconds: 3 * 3600,
    tickSeconds: 5,
    snapshotEverySeconds: 300,
  });

describe('P0 pacing (balanced bot)', () => {
  const humans = run('humans');
  const orcs = run('orcs');

  it('Troop 2 arrives within 9–16 bot minutes for both races (≈ 15–20 real minutes)', () => {
    for (const r of [humans, orcs]) {
      const t = r.milestones['troop:troop2'];
      expect(t).toBeDefined();
      expect(t!).toBeGreaterThan(9 * 60);
      expect(t!).toBeLessThan(16 * 60);
    }
  });

  it('a careful player loses no soldiers before the boss fight', () => {
    for (const r of [humans, orcs]) {
      const firstLoss = r.milestones['firstLoss'];
      if (firstLoss !== undefined) expect(firstLoss).toBeGreaterThanOrEqual(r.milestones['objective:zoneCleared']!);
    }
  });

  it('both races defeat the boss within 25–60 bot minutes', () => {
    for (const r of [humans, orcs]) {
      const t = r.milestones['boss'];
      expect(t).toBeDefined();
      expect(t!).toBeGreaterThan(25 * 60);
      expect(t!).toBeLessThan(60 * 60);
    }
  });

  it('Humans and Orcs reach the boss within ±25% of each other', () => {
    const h = humans.milestones['boss']!;
    const o = orcs.milestones['boss']!;
    expect(Math.abs(o - h) / h).toBeLessThan(0.25);
  });

  it('Orcs field clearly more soldiers than Humans', () => {
    const size = (r: typeof humans) => r.finalState.troops.reduce((a, t) => a + t.size, 0);
    expect(size(orcs)).toBeGreaterThan(2 * size(humans));
  });

  // The forge job only exists once the forge is built, so the five start activities are
  // compared on their own time; smithing has its own guard below.
  it('every start activity is used for at least 5% of its troop-time', () => {
    const start = ['combat', 'mining', 'woodcutting', 'food', 'construction'] as const;
    for (const r of [humans, orcs]) {
      const total = start.reduce((n, a) => n + r.activityTime[a], 0);
      for (const a of start) {
        expect(r.activityTime[a] / total, `${a}`).toBeGreaterThan(0.05);
      }
    }
  });

  it('troops actually smith: the forge job is used and weapons get made', () => {
    for (const r of [humans, orcs]) {
      const total = Object.values(r.activityTime).reduce((a, b) => a + b, 0);
      expect(r.activityTime.smithing / total).toBeGreaterThan(0.01);
      expect(r.finalState.stats.weaponsCrafted).toBeGreaterThan(10);
    }
  });
});
