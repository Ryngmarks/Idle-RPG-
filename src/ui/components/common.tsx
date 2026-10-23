import type { ReactNode } from 'react';
import type { Cost, GameState, ResourceId } from '../../core';
import { fmtCost } from '../format';
import { ResIcon } from '../art/resources';
import { RESOURCE_LABEL } from '../labels';

/** `inside` makes it a big hero bar with text on top of the fill. */
export function Bar({ value, max, tone = 'gold', label, inside }: { value: number; max: number; tone?: string; label?: string; inside?: ReactNode }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`bar bar--${tone} ${inside !== undefined ? 'bar--big' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <div className="bar__fill" style={{ width: `${pct}%` }} />
      {inside !== undefined && <span className="bar__text">{inside}</span>}
    </div>
  );
}

/** Small status pill. tone: ok (green), warn (blood red, blocking), slow (amber), gold (key). */
export function Chip({ tone, children, title }: { tone?: 'ok' | 'warn' | 'slow' | 'gold'; children: ReactNode; title?: string }) {
  return <span className={`chip ${tone ? `chip--${tone}` : ''}`} title={title}>{children}</span>;
}

/** Limited places as dots: filled = used. */
export function Slots({ used, total, icon = '👤', label }: { used: number; total: number; icon?: string; label: string }) {
  const n = Math.max(0, Math.min(12, Math.round(total)));
  return (
    <span className="slots" role="img" aria-label={label}>
      {Array.from({ length: n }, (_, i) => <i key={i} className={i < used ? 'slots__f' : ''}>{i < used ? icon : '·'}</i>)}
    </span>
  );
}

/** `hero` = the one primary card of a screen (gold edge); other panels stay secondary. */
export function Panel({ title, children, className = '', aside, hero }: { title?: ReactNode; children: ReactNode; className?: string; aside?: ReactNode; hero?: boolean }) {
  return (
    <section className={`panel ${hero ? 'panel--hero' : ''} ${className}`}>
      {title !== undefined && (
        <header className="panel__head">
          <h2 className="panel__title">{title}</h2>
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}

/** A cost list that marks what the player can't afford yet. */
export function CostList({ cost, state }: { cost: Cost; state: GameState }) {
  const entries = Object.entries(cost).filter(([, v]) => (v ?? 0) > 0) as [ResourceId, number][];
  if (entries.length === 0) return <span className="muted">Gratis</span>;
  return (
    <span className="cost">
      {entries.map(([r, v]) => (
        <span key={r} className={state.resources[r] + 1e-9 >= v ? 'cost__item' : 'cost__item cost__item--short'}>
          <ResIcon id={r} size={18} /> {fmtCost(v)}<span className="sr-only"> {RESOURCE_LABEL[r].name}</span>
        </span>
      ))}
    </span>
  );
}
