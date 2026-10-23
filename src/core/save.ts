// Versioned save format. Migrations run in order from the save's version to SAVE_VERSION.

import { SAVE_VERSION } from './state';
import type { GameState } from './types';

/** migrations[n] upgrades a save from version n to n + 1. */
const migrations: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {};

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): GameState {
  let data = JSON.parse(json) as Record<string, unknown>;
  let version = typeof data.version === 'number' ? data.version : NaN;
  if (!Number.isInteger(version) || version < 1) throw new Error('Invalid save: missing version');
  if (version > SAVE_VERSION) throw new Error(`Save is from a newer version (${version} > ${SAVE_VERSION})`);
  while (version < SAVE_VERSION) {
    const migrate = migrations[version];
    if (!migrate) throw new Error(`No migration from save version ${version}`);
    data = migrate(data);
    version++;
    data.version = version;
  }
  return data as unknown as GameState;
}
