// The app shell: owns the current GameState, runs the real-time loop on wall-clock time,
// autosaves, and turns long gaps (closed app, background tab) into offline catch-up.
// It contains no game rules; everything goes through the core's dispatch/advance/catchUp.

import { content } from '../content';
import { advance, catchUp, dispatch, newGame, RESOURCES, type Command, type GameEvent, type GameState, type Resources } from '../core';
import { exportSave, importSave, loadGame, saveGame, clearSave, type KeyValueStorage } from './persistence';

export const OFFLINE_CAP_SEC = 8 * 3600;
/** A gap longer than this between ticks is reported as "while you were away"; shorter gaps are simulated silently. */
const AWAY_THRESHOLD_SEC = 60;
const TICK_MS = 250;
const AUTOSAVE_MS = 10_000;
const LOG_LIMIT = 40;

export interface AwayReport {
  awaySec: number;
  simulatedSec: number;
  capped: boolean;
  resources: Resources;
  kills: number;
  /** Seconds the troops were hungry while away (not saved). */
  hungrySec: number;
  events: GameEvent[];
}

export interface StoreSnapshot {
  state: GameState | null;
  log: GameEvent[];
  report: AwayReport | null;
  storageOk: boolean;
}

export interface StoreDeps {
  storage: KeyValueStorage | null;
  now: () => number;
}

export class GameStore {
  private snapshot: StoreSnapshot;
  private listeners = new Set<() => void>();
  private lastTick: number;
  private lastSave = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private deps: StoreDeps) {
    this.lastTick = deps.now();
    this.snapshot = { state: null, log: [], report: null, storageOk: deps.storage !== null };
    const loaded = deps.storage ? loadGame(deps.storage) : null;
    if (loaded) {
      this.snapshot = { ...this.snapshot, state: loaded.state };
      this.catchUpFrom(loaded.savedAt);
    }
  }

  // ------------------------------------------------------------ subscription (useSyncExternalStore)

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): StoreSnapshot => this.snapshot;

  private set(patch: Partial<StoreSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const fn of this.listeners) fn();
  }

  // ------------------------------------------------------------ loop

  start(): void {
    if (this.timer) return;
    this.lastTick = this.deps.now();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Advance by real elapsed time. Public for tests and for visibility changes. */
  tick(): void {
    const now = this.deps.now();
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;
    const state = this.snapshot.state;
    if (!state || dt <= 0) return;
    if (dt > AWAY_THRESHOLD_SEC) {
      this.catchUpFrom(now - dt * 1000);
    } else {
      const r = advance(state, dt, content);
      this.set({ state: r.state, log: appendLog(this.snapshot.log, r.events) });
    }
    if (now - this.lastSave >= AUTOSAVE_MS) this.save();
  }

  private catchUpFrom(savedAt: number): void {
    const state = this.snapshot.state;
    if (!state) return;
    const now = this.deps.now();
    const awaySec = Math.max(0, (now - savedAt) / 1000);
    const r = catchUp(state, awaySec, OFFLINE_CAP_SEC, content);
    const resources = {} as Resources;
    for (const k of RESOURCES) resources[k] = r.state.resources[k] - state.resources[k];
    const report: AwayReport | null =
      awaySec >= AWAY_THRESHOLD_SEC
        ? {
            awaySec,
            simulatedSec: r.simulatedSec,
            capped: awaySec > OFFLINE_CAP_SEC,
            resources,
            kills: r.state.stats.totalKills - state.stats.totalKills,
            hungrySec: r.hungrySec,
            events: r.events,
          }
        : this.snapshot.report;
    this.lastTick = now;
    this.set({ state: r.state, log: appendLog(this.snapshot.log, r.events), report });
  }

  // ------------------------------------------------------------ actions

  /** Returns an error message, or null on success. */
  command(cmd: Command): string | null {
    const state = this.snapshot.state;
    if (!state) return 'Inget spel pågår';
    this.tick(); // apply elapsed time first so the command acts on the current state
    const current = this.snapshot.state ?? state;
    const r = dispatch(current, cmd, content);
    if (!r.ok) return r.error;
    this.set({ state: r.state, log: appendLog(this.snapshot.log, r.events) });
    this.save();
    return null;
  }

  startNewGame(raceId: string): void {
    this.lastTick = this.deps.now();
    this.set({ state: newGame(raceId, content), log: [], report: null });
    this.save();
  }

  dismissReport(): void {
    this.set({ report: null });
  }

  save(): void {
    const state = this.snapshot.state;
    if (!state || !this.deps.storage) return;
    const now = this.deps.now();
    const ok = saveGame(this.deps.storage, state, now);
    this.lastSave = now;
    if (ok !== this.snapshot.storageOk) this.set({ storageOk: ok });
  }

  reset(): void {
    if (this.deps.storage) clearSave(this.deps.storage);
    this.set({ state: null, log: [], report: null });
  }

  exportString(): string | null {
    const state = this.snapshot.state;
    return state ? exportSave(state, this.deps.now()) : null;
  }

  /** Returns an error message, or null on success. */
  importString(text: string): string | null {
    try {
      const loaded = importSave(text);
      this.set({ state: loaded.state, log: [], report: null });
      this.lastTick = this.deps.now();
      this.save();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Kunde inte läsa sparfilen.';
    }
  }

  /** Test helper: simulate `seconds` of play instantly (same rules as real time). */
  fastForward(seconds: number): void {
    const state = this.snapshot.state;
    if (!state) return;
    const r = advance(state, seconds, content);
    this.set({ state: r.state, log: appendLog(this.snapshot.log, r.events) });
    this.save();
  }
}

function appendLog(log: GameEvent[], events: GameEvent[]): GameEvent[] {
  if (events.length === 0) return log;
  return [...[...events].reverse(), ...log].slice(0, LOG_LIMIT);
}
