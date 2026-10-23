import { describe, expect, it } from 'vitest';
import { exportSave, importSave, loadGame, saveGame, type KeyValueStorage } from './persistence';
import { GameStore, OFFLINE_CAP_SEC } from './store';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (sec: number) => (t += sec * 1000) };
}

describe('GameStore', () => {
  it('runs on wall-clock time and autosaves', () => {
    const storage = memoryStorage();
    const c = clock();
    const store = new GameStore({ storage, now: c.now });
    store.startNewGame('humans');
    expect(store.command({ type: 'assignTroop', troopId: 'troop1', activity: 'woodcutting' })).toBeNull();
    c.advance(30);
    store.tick();
    expect(store.getSnapshot().state!.resources.wood).toBe(5); // one tree felled in 30 s
    expect(storage.data.size).toBe(1);
  });

  it('restores a save and applies offline progress with a report', () => {
    const storage = memoryStorage();
    const c = clock();
    const first = new GameStore({ storage, now: c.now });
    first.startNewGame('humans');
    first.command({ type: 'assignTroop', troopId: 'troop1', activity: 'woodcutting' });
    first.save();

    c.advance(600); // app closed for 10 minutes
    const second = new GameStore({ storage, now: c.now });
    const snap = second.getSnapshot();
    expect(snap.state!.troops[0]!.activity).toBe('woodcutting');
    expect(snap.state!.resources.wood).toBe(100); // 20 trees
    expect(snap.report?.awaySec).toBeCloseTo(600);
    expect(snap.report?.resources.wood).toBe(100);
  });

  it('caps offline progress', () => {
    const storage = memoryStorage();
    const c = clock();
    const first = new GameStore({ storage, now: c.now });
    first.startNewGame('orcs');
    first.command({ type: 'assignTroop', troopId: 'troop1', activity: 'woodcutting' });
    c.advance(OFFLINE_CAP_SEC * 3);
    const second = new GameStore({ storage, now: c.now });
    const report = second.getSnapshot().report!;
    expect(report.capped).toBe(true);
    expect(report.simulatedSec).toBe(OFFLINE_CAP_SEC);
  });

  it('treats a long gap between ticks (background tab) as time away', () => {
    const c = clock();
    const store = new GameStore({ storage: memoryStorage(), now: c.now });
    store.startNewGame('humans');
    store.command({ type: 'assignTroop', troopId: 'troop1', activity: 'woodcutting' });
    c.advance(300);
    store.tick();
    expect(store.getSnapshot().report?.awaySec).toBeCloseTo(300);
    expect(store.getSnapshot().state!.resources.wood).toBe(50);
  });

  it('reports command errors from the core', () => {
    const store = new GameStore({ storage: memoryStorage(), now: clock().now });
    store.startNewGame('humans');
    expect(store.command({ type: 'assignTroop', troopId: 'troop1', activity: 'mining' })).toMatch(/locked/);
  });

  it('works without storage (private mode)', () => {
    const store = new GameStore({ storage: null, now: clock().now });
    store.startNewGame('humans');
    expect(store.getSnapshot().storageOk).toBe(false);
  });
});

describe('persistence', () => {
  it('ignores corrupt saves instead of crashing', () => {
    const storage = memoryStorage();
    storage.setItem('idle-rpg:save', '{not json');
    expect(loadGame(storage)).toBeNull();
  });

  it('export/import round-trips, including non-ASCII troop names', () => {
    const storage = memoryStorage();
    const store = new GameStore({ storage, now: clock().now });
    store.startNewGame('humans');
    store.command({ type: 'renameTroop', troopId: 'troop1', name: 'Norra Väktarna åäö' });
    const text = exportSave(store.getSnapshot().state!, 123);
    const back = importSave(text);
    expect(back.state.troops[0]!.name).toBe('Norra Väktarna åäö');
    expect(back.savedAt).toBe(123);
    expect(() => importSave('nonsense')).toThrow();
  });

  it('saveGame reports failure when storage throws (quota/private mode)', () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error('quota');
    };
    const store = new GameStore({ storage: memoryStorage(), now: clock().now });
    store.startNewGame('humans');
    expect(saveGame(storage, store.getSnapshot().state!, 0)).toBe(false);
  });
});
