// React bridge: one GameStore for the page, exposed through useSyncExternalStore.

import { createContext, useContext, useSyncExternalStore } from 'react';
import type { KeyValueStorage } from '../app/persistence';
import { GameStore, type StoreSnapshot } from '../app/store';

function browserStorage(): KeyValueStorage | null {
  try {
    const s = window.localStorage;
    const probe = '__idle_rpg_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function createBrowserStore(): GameStore {
  const store = new GameStore({ storage: browserStorage(), now: () => Date.now() });
  // Save when the app is hidden or closed; catch up when it becomes visible again.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') store.save();
    else store.tick();
  });
  window.addEventListener('pagehide', () => store.save());
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* not supported */
  }
  store.start();
  return store;
}

export const StoreContext = createContext<GameStore | null>(null);

export function useStore(): GameStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('StoreContext missing');
  return store;
}

export function useSnapshot(): StoreSnapshot {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
