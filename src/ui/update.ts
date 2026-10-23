// App updates: find out whether a newer build is deployed, and reload into it.
// Vite gives every build's main script a content hash, so a different script name means a new version.

export type UpdateStatus = 'new' | 'same' | 'unknown';

const BUNDLE = /assets\/index-[\w-]+\.js/;

function currentBundle(): string | null {
  const src = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src ?? '';
  return BUNDLE.exec(src)?.[0] ?? null;
}

/** Fetches index.html past every cache and compares its script with the running one. */
export async function checkForUpdate(): Promise<UpdateStatus> {
  const running = currentBundle();
  if (!running) return 'unknown'; // dev server: no hashed bundle
  try {
    const res = await fetch(`${location.pathname}?check=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return 'unknown';
    const latest = BUNDLE.exec(await res.text())?.[0];
    if (!latest) return 'unknown';
    return latest === running ? 'same' : 'new';
  } catch {
    return 'unknown';
  }
}

/** Reloads into the newest build; the query string makes the browser fetch index.html anew. */
export function reloadToLatest(): void {
  location.replace(`${location.pathname}?v=${Date.now()}${location.hash}`);
}

export function buildLabel(): string {
  const d = new Date(__APP_BUILD__);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });
}
