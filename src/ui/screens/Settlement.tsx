import { useState } from 'react';
import { useRise } from '../fx';
import { content } from '../../content';
import { canAfford, race, type BuildingDef, type GameState, type Rates } from '../../core';
import { Icon } from '../art/icons';
import { VillageScene } from '../art/village';
import { Bar, CostList, Panel } from '../components/common';
import { fmtDuration, fmtInt } from '../format';
import { useStore } from '../game';
import { BUILDING_ICON, effectText, settlementStage } from '../labels';

const PLOTS = 6;
const MAX_EMPTY_SHOWN = 2;

function BuildingPlot({ def, state, rates }: { def: BuildingDef; state: GameState; rates: Rates }) {
  const store = useStore();
  const [error, setError] = useState<string | null>(null);
  const level = state.buildings[def.id] ?? 0;
  const next = def.levels[level];
  const built = useRise(level);
  const building = state.construction?.buildingId === def.id ? state.construction : null;
  const busy = state.construction !== null && !building;
  const r = race(state, content);
  const builders = state.troops.filter((t) => t.activity === 'construction');

  return (
    <article className={`plot ${!next && !building ? 'plot--done' : ''} ${level > 0 ? 'plot--built' : ''}`}>
      <header className="plot__head">
        <span className="plot__icon" aria-hidden><Icon name={BUILDING_ICON[def.id] ?? 'castle'} size={34} /></span>
        <div className="plot__title">
          <h3 className="plot__name">{def.name}</h3>
          <span className="pips" role="img" aria-label={`Nivå ${level} av ${def.levels.length}`}>
            {def.levels.map((_, i) => (
              <i key={i} className={`pip ${i < level ? 'pip--on' : building && i === level ? 'pip--build' : ''}`} />
            ))}
          </span>
        </div>
        <span className="badge plot__level">{level > 0 ? `Nivå ${level}/${def.levels.length}` : 'Ej byggd'}</span>
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
                    : <><Icon name="warning" size={15} /> Ingen trupp bygger. Ge en trupp ordern Bygge.</>}
                </span>
              </>
            );
          })()}
        </div>
      ) : next ? (
        <>
          <p className="plot__next small">{level > 0 ? `Nivå ${level + 1} ger` : 'Ger'}</p>
          <ul className="plot__effects">
            {next.effects.map((e) => effectText(e, r.population.bedMult)).filter(Boolean).map((t, i) => <li key={i}>{t}</li>)}
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
        <p className="plot__done"><Icon name="check" size={18} /> Färdig <span className="muted small">Fullt utbyggd</span></p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {built > 0 && <span key={built} className="plot__shine" aria-hidden />}
    </article>
  );
}

export function Settlement({ state, rates }: { state: GameState; rates: Rates }) {
  const visible = Object.values(content.buildings).filter((b) => state.unlocks.includes(`building:${b.id}`) || (state.buildings[b.id] ?? 0) > 0);
  const built = Object.values(state.buildings).filter((l) => l > 0).length;
  const stage = settlementStage(built);
  return (
    <div className="screen">
      <Panel icon="castle" title={stage.name} className="settlement-head">
        <VillageScene buildings={state.buildings} construction={state.construction} unlocks={state.unlocks} />
        <p className="muted">{stage.text}</p>
      </Panel>
      <div className="plots">
        {visible.map((b) => <BuildingPlot key={b.id} def={b} state={state} rates={rates} />)}
        {Array.from({ length: Math.min(MAX_EMPTY_SHOWN, Math.max(0, PLOTS - visible.length)) }, (_, i) => (
          <article key={`empty${i}`} className="plot plot--empty">
            <h3 className="plot__name"><Icon name="lock" size={18} /> Tom tomt</h3>
            <p className="muted small">Låses upp när bosättningen växer.</p>
          </article>
        ))}
      </div>
    </div>
  );
}
