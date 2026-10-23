import { useState } from 'react';
import { content } from '../../content';
import { canAfford, race, troopCap, type BuildingDef, type GameState, type Rates } from '../../core';
import { SettlementScene } from '../art';
import { Bar, CostList, Panel } from '../components/common';
import { fmtDuration, fmtInt } from '../format';
import { useStore } from '../game';
import { effectText, settlementStage } from '../labels';

const PLOTS = 6;
const MAX_EMPTY_SHOWN = 2;

function BuildingPlot({ def, state, rates }: { def: BuildingDef; state: GameState; rates: Rates }) {
  const store = useStore();
  const [error, setError] = useState<string | null>(null);
  const level = state.buildings[def.id] ?? 0;
  const next = def.levels[level];
  const building = state.construction?.buildingId === def.id ? state.construction : null;
  const busy = state.construction !== null && !building;
  const r = race(state, content);
  const capFor = (l: number) => troopCap(r.population.maxTroopSize, l, content.constants.capLevelFractions);
  const builders = state.troops.filter((t) => t.activity === 'construction');

  return (
    <article className={`plot ${level > 0 ? 'plot--built' : ''}`}>
      <header className="plot__head">
        <h3 className="plot__name">{def.name}</h3>
        <span className="badge">{level > 0 ? `Nivå ${level}/${def.levels.length}` : 'Ej byggd'}</span>
      </header>
      {building ? (
        <div className="plot__progress">
          {(() => {
            const work = def.levels[building.level - 1]!.work;
            const rate = rates.constructionWorkPerSec;
            return (
              <>
                <span className="small">Bygger nivå {building.level}: {fmtInt(building.progress)} / {fmtInt(work)} arbete</span>
                <Bar value={building.progress} max={work} tone="gold" label="Byggframsteg" />
                <span className="small">
                  {rate > 0
                    ? `${builders.map((t) => t.name).join(', ')} bygger · klart om ${fmtDuration((work - building.progress) / rate)}`
                    : '⚠️ Ingen trupp bygger. Ge en trupp ordern Bygge.'}
                </span>
              </>
            );
          })()}
        </div>
      ) : next ? (
        <>
          <ul className="plot__effects">
            {next.effects.map((e) => effectText(e, capFor)).filter(Boolean).map((t, i) => <li key={i}>{t}</li>)}
          </ul>
          <p className="small">
            Kostnad: <CostList cost={next.cost} state={state} /> · {fmtInt(next.work)} arbete
          </p>
          <button
            className="btn btn--primary btn--block"
            disabled={busy || !canAfford(state, next.cost)}
            onClick={() => setError(store.command({ type: 'startConstruction', buildingId: def.id }))}
          >
            {busy ? 'Ett annat bygge pågår' : level > 0 ? `Bygg ut till nivå ${level + 1}` : 'Bygg'}
          </button>
        </>
      ) : (
        <p className="muted small">Fullt utbyggd.</p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </article>
  );
}

export function Settlement({ state, rates }: { state: GameState; rates: Rates }) {
  const visible = Object.values(content.buildings).filter((b) => state.unlocks.includes(`building:${b.id}`) || (state.buildings[b.id] ?? 0) > 0);
  const built = Object.values(state.buildings).filter((l) => l > 0).length;
  const stage = settlementStage(built);
  return (
    <div className="screen">
      <Panel title={stage.name} className="settlement-head">
        <SettlementScene buildings={state.buildings} />
        <p className="muted">{stage.text}</p>
      </Panel>
      <div className="plots">
        {visible.map((b) => <BuildingPlot key={b.id} def={b} state={state} rates={rates} />)}
        {Array.from({ length: Math.min(MAX_EMPTY_SHOWN, Math.max(0, PLOTS - visible.length)) }, (_, i) => (
          <article key={`empty${i}`} className="plot plot--empty">
            <h3 className="plot__name">Tom tomt</h3>
            <p className="muted small">Låses upp när bosättningen växer.</p>
          </article>
        ))}
      </div>
    </div>
  );
}
