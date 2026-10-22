// Browser persistence: localStorage + export/import strings.
// Storage is injected so this can be tested without a browser.

import { content } from '../content';
import { deserialize, serialize, type GameState } from '../core';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY = 'idle-rpg:save';

interface Envelope {
  format: 1;
  /** Wall-clock ms when saved; used for offline progress. */
  savedAt: number;
  state: string;
}

export interface LoadedSave {
  state: GameState;
  savedAt: number;
}

export function saveGame(storage: KeyValueStorage, state: GameState, now: number): boolean {
  try {
    const env: Envelope = { format: 1, savedAt: now, state: serialize(state) };
    storage.setItem(KEY, JSON.stringify(env));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(storage: KeyValueStorage): LoadedSave | null {
  let raw: string | null;
  try {
    raw = storage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as Envelope;
    const state = deserialize(env.state);
    if (!content.races[state.raceId]) return null;
    return { state, savedAt: typeof env.savedAt === 'number' ? env.savedAt : 0 };
  } catch {
    return null;
  }
}

export function clearSave(storage: KeyValueStorage): void {
  try {
    storage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- export / import

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64.trim());
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function exportSave(state: GameState, now: number): string {
  const env: Envelope = { format: 1, savedAt: now, state: serialize(state) };
  return toBase64(JSON.stringify(env));
}

/** Throws a user-readable error if the string is not a valid save. */
export function importSave(text: string): LoadedSave {
  let env: Envelope;
  try {
    env = JSON.parse(fromBase64(text)) as Envelope;
  } catch {
    throw new Error('Texten är inte en giltig sparfil.');
  }
  const state = deserialize(env.state);
  if (!content.races[state.raceId]) throw new Error('Sparfilen innehåller en okänd ras.');
  return { state, savedAt: typeof env.savedAt === 'number' ? env.savedAt : 0 };
}
