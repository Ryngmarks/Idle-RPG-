// Offline robustness at the end of zone 1 (M13): an 8 h catch-up with the bot's late-game army at level 35 must
// finish (advance throws when its event loop exceeds MAX_STEPS) and must be fast enough for a phone.
import { describe, expect, it } from 'vitest';
import { content } from '../../src/content';
import { catchUp, cloneState, newGame } from '../../src/core';
import { runBot } from './bot';

describe('M13 offline catch-up at level 35', () => {
  for (const raceId of ['humans', 'orcs']) {
    it(`${raceId}: 8 h catch-up completes quickly with the army of boss 6`, () => {
      const r = runBot(newGame(raceId, content), content, {
        raceId,
        strategy: 'checkin',
        maxSeconds: 60 * 3600,
        tickSeconds: 5,
        snapshotEverySeconds: 3600,
        stopAtBoss: 6,
      });
      const state = cloneState(r.finalState);
      // Put the troops on the frontier of level 35, the hardest level they could be farming.
      state.combat.unlockedStage = 34;
      state.combat.stageIndex = 34;
      state.combat.kills = 0;
      state.combat.cleared = false;
      state.combat.boss = null;
      const before = state.clock;
      const t0 = Date.now();
      const out = catchUp(state, 8 * 3600, 8 * 3600, content);
      const ms = Date.now() - t0;
      expect(out.simulatedSec).toBe(8 * 3600);
      expect(out.state.clock - before).toBeCloseTo(8 * 3600, 3);
      expect(ms, `${ms} ms`).toBeLessThan(2000);
      expect(out.events.length, 'events in 8 h').toBeLessThan(20000);
    });
  }
});
