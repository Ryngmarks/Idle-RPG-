const int = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1, minimumFractionDigits: 0 });
const dec2 = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** Whole units the player owns (always rounded down so "can afford" matches what is shown). */
export const fmtAmount = (n: number) => int.format(Math.floor(n + 1e-9));
export const fmtInt = (n: number) => int.format(Math.round(n));
export const fmtRate = (n: number) => (Math.abs(n) >= 10 ? int.format(n) : Math.abs(n) >= 1 ? dec1.format(n) : dec2.format(n));
export const fmtCost = (n: number) => (Number.isInteger(n) ? int.format(n) : int.format(Math.ceil(n - 1e-9)));

export function fmtDuration(sec: number): string {
  if (!Number.isFinite(sec)) return '–';
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min ${r.toString().padStart(2, '0')} s`;
  return `${r} s`;
}

export function fmtClock(sec: number): string {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = m.toString().padStart(2, '0');
  const ss = r.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
