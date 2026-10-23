import { useState } from 'react';
import { content } from '../../content';
import { canAfford, type GameState } from '../../core';
import { Icon } from '../art/icons';
import { CostList, Panel } from '../components/common';
import { useStore } from '../game';
import { modifierText } from '../labels';

export function Upgrades({ state }: { state: GameState }) {
  const store = useStore();
  const [error, setError] = useState<string | null>(null);
  const list = Object.values(content.upgrades).filter((u) => state.unlocks.includes(`upgrade:${u.id}`));
  return (
    <div className="screen">
      <Panel title="Förbättringar">
        {list.length === 0 && <p className="muted">Inga förbättringar tillgängliga än.</p>}
        <ul className="upgrade-list">
          {list.map((u) => {
            const owned = (state.upgrades[u.id] ?? 0) > 0;
            return (
              <li key={u.id} className={`upgrade ${owned ? 'upgrade--owned' : ''}`}>
                <div>
                  <h3 className="upgrade__name"><Icon name="scroll" size={20} /> {u.name}</h3>
                  <p className="small">{u.modifiers.map(modifierText).join(' · ')}</p>
                  {!owned && <p className="small"><CostList cost={u.cost} state={state} /></p>}
                </div>
                {owned ? (
                  <span className="badge badge--ok"><Icon name="check" size={14} /> Köpt</span>
                ) : (
                  <button className="btn btn--primary" disabled={!canAfford(state, u.cost)} onClick={() => setError(store.command({ type: 'buyUpgrade', upgradeId: u.id }))}>
                    Köp
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {error && <p className="error" role="alert">{error}</p>}
      </Panel>
    </div>
  );
}
