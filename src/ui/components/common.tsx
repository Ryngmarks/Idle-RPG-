import type { ReactNode } from 'react';
import type { Cost, GameState, ResourceId } from '../../core';
import { fmtCost } from '../format';
import { RESOURCE_LABEL } from '../labels';

export function Bar({ value, max, tone = 'gold', label }: { value: number; max: number; tone?: string; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`bar bar--${tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <div className="bar__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Panel({ title, children, className = '', aside }: { title?: ReactNode; children: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <section className={`panel ${className}`}>
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
          {RESOURCE_LABEL[r].icon} {fmtCost(v)}
        </span>
      ))}
    </span>
  );
}
