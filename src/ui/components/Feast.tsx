import { useState } from 'react';
import { content } from '../../content';
import { canAfford, feastActive, feastBlocker, type GameState, type ResourceId } from '../../core';
import { Icon } from '../art/icons';
import { Bar, CostList } from '../components/common';
import { fmtDuration } from '../format';
import { useStore } from '../game';
import { RESOURCE_LABEL } from '../labels';

/** The feast (PROGRESSION_V2 §18): a timed work/attack boost. All numbers come from content.constants.feast. */
export function FeastPanel({ state }: { state: GameState }) {
  const store = useStore();
  const [error, setError] = useState<string | null>(null);
  const f = content.constants.feast;
  const blocker = feastBlocker(state, content);
  const active = feastActive(state);
  const pct = (m: number) => Math.round((m - 1) * 100);
  const effect = `+${pct(f.workMult)} % arbete, +${pct(f.attackMult)} % anfall i ${Math.round(f.durationSec / 60)} min`;
  const reqName = content.buildings[f.requiresBuilding]?.name ?? 'Träningslägret';
  const missing = (Object.entries(f.cost) as [ResourceId, number][])
    .filter(([r, v]) => v > 0 && state.resources[r] + 1e-9 < v)
    .map(([r, v]) => `${Math.ceil(v - state.resources[r])} ${RESOURCE_LABEL[r].name.toLowerCase()}`);

  return (
    <section className={`feast ${active ? 'feast--on' : ''} ${blocker === 'locked' ? 'feast--locked' : ''}`} aria-label="Fest">
      <header className="feast__head">
        <span className="feast__icon" aria-hidden><Icon name={blocker === 'locked' ? 'lock' : 'tankard'} size={34} /></span>
        <div className="feast__title">
          <h3 className="plot__name">Fest</h3>
          <span className="small muted">{blocker === 'locked' ? `Kräver ${reqName}` : effect}</span>
        </div>
        {active && <span className="chip chip--feast"><Icon name="tankard" size={14} /> Fest</span>}
      </header>
      {active && (
        <>
          <p className="feast__timer" role="timer">Fest! {fmtDuration(Math.max(0, state.feast.until - state.clock))} kvar</p>
          <Bar value={state.feast.until - state.clock} max={f.durationSec} tone="gold" label="Festens tid kvar" />
        </>
      )}
      {blocker === 'cooldown' && <p className="small">Nästa fest om {fmtDuration(Math.max(0, state.feast.readyAt - state.clock))}</p>}
      {(blocker === null || blocker === 'resources') && (
        <>
          <p className="small">Kostnad: <CostList cost={f.cost} state={state} /></p>
          <button className="btn btn--primary btn--block" disabled={blocker !== null || !canAfford(state, f.cost)} onClick={() => setError(store.command({ type: 'startFeast' }))}>
            <Icon name="tankard" size={18} /> Håll fest
          </button>
          {blocker === 'resources' && missing.length > 0 && <p className="small warn">Saknar {missing.join(' och ')}</p>}
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
