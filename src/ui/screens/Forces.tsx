import { useState } from 'react';
import { content } from '../../content';
import {
  ACTIVITIES,
  activeObjectives,
  canAfford,
  currentCap,
  maxRecruitable,
  recruitCost,
  troopStats,
  xpForLevel,
  type ActivityKind,
  type GameState,
  type Rates,
  type ResourceId,
  type TroopState,
} from '../../core';
import { TroopScene } from '../army';
import { Bar, CostList, Panel } from '../components/common';
import { EquipmentBar } from '../components/equipment';
import { fmtDuration, fmtRate } from '../format';
import { useStore } from '../game';
import { ACTIVITY_LABEL, RESOURCE_LABEL, objectiveProgress } from '../labels';

export function Objectives({ state }: { state: GameState }) {
  const goals = activeObjectives(state, content);
  if (goals.length === 0) return null;
  return (
    <Panel title="Mål" className="objectives">
      <ul className="objective-list">
        {goals.map((o) => {
          const p = objectiveProgress(state, o.condition);
          return (
            <li key={o.id} className="objective">
              <span className="objective__text">🎯 {o.text}</span>
              {p && (
                <span className="objective__progress">
                  <Bar value={p.current} max={p.target} tone="gold" label={o.text} />
                  <span className="objective__count">{Math.floor(p.current)} / {p.target}</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function outputText(troop: TroopState, rates: Rates, state: GameState): string {
  const t = rates.perTroop[troop.id];
  if (!t || !troop.activity) return 'Väntar på order';
  switch (troop.activity) {
    case 'combat':
      if (state.combat.boss) return `${fmtRate(t.bossDps)} skada/s mot bossen`;
      return `${fmtRate(t.killsPerSec)} besegrade/s`;
    case 'construction':
      return state.construction ? `+${fmtRate(t.work)} arbete/s` : 'Inget bygge pågår';
    default:
      return Object.entries(t.output)
        .filter(([, v]) => (v ?? 0) > 0)
        .map(([r, v]) => `+${fmtRate(v ?? 0)} ${RESOURCE_LABEL[r as ResourceId].name.toLowerCase()}/s`)
        .join(' · ');
  }
}

function LifeStatus({ troop, rates, hpPerSoldier }: { troop: TroopState; rates: Rates; hpPerSoldier: number }) {
  const net = rates.woundsPerSec[troop.id] ?? 0;
  if (net > 0) {
    const secs = Math.max(0, hpPerSoldier - troop.wounds) / net;
    const text = troop.size > 1 ? `nästa soldat faller om ${fmtDuration(secs)}` : `retirerar om ${fmtDuration(secs)}`;
    return <span className="life-status life-status--danger">⚠️ Tar skada: {text}</span>;
  }
  if (net < 0) return <span className="life-status life-status--healing">✚ Läker</span>;
  return null;
}

function TroopCard({ troop, state, rates }: { troop: TroopState; state: GameState; rates: Rates }) {
  const store = useStore();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(troop.name);
  const stats = troopStats(state, troop, content);
  const cap = currentCap(state, content);
  const c = content.constants;
  const lvlFrom = xpForLevel(stats.level, c.xpBase, c.xpExponent);
  const lvlTo = xpForLevel(stats.level + 1, c.xpBase, c.xpExponent);
  const unlocked = ACTIVITIES.filter((a) => state.unlocks.includes(`activity:${a}`));
  const canRecruit = state.unlocks.includes('recruit');
  const room = cap - troop.size;
  const maxN = maxRecruitable(state, troop.id, content);
  const inArmoury = Object.entries(state.armoury)
    .filter(([k]) => k.startsWith(`${troop.weaponTypeId}:`))
    .reduce((n, [, v]) => n + v, 0);
  const showEquipment = state.unlocks.includes('crafting') || troop.equipment.length > 0;

  const run = (fn: () => string | null) => setError(fn());
  const assign = (activity: ActivityKind) => run(() => store.command({ type: 'assignTroop', troopId: troop.id, activity }));
  const recruit = (n: number) => run(() => store.command({ type: 'recruit', troopId: troop.id, count: n }));

  return (
    <article className="troop">
      <TroopScene race={state.raceId} size={troop.size} activity={troop.activity} equipment={troop.equipment} />
      <header className="troop__head">
        {editing ? (
          <form
            className="troop__rename"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => store.command({ type: 'renameTroop', troopId: troop.id, name }));
              setEditing(false);
            }}
          >
            <input value={name} maxLength={32} autoFocus onChange={(e) => setName(e.target.value)} aria-label="Truppens namn" />
            <button className="btn btn--small" type="submit">OK</button>
          </form>
        ) : (
          <button className="troop__name" onClick={() => { setName(troop.name); setEditing(true); }} title="Byt namn">
            {troop.name} <span className="troop__edit">✎</span>
          </button>
        )}
        <span className="badge" title={`${Math.floor(troop.xp)} / ${lvlTo} XP`}>Nv {stats.level}</span>
      </header>

      <div className="troop__size">
        <span className="troop__count">
          <strong>{troop.size}</strong> / {cap} soldater
        </span>
        <Bar value={troop.size} max={cap} tone="steel" label="Soldater" />
      </div>
      <Bar value={troop.xp - lvlFrom} max={lvlTo - lvlFrom} tone="xp" label="Erfarenhet" />
      <div className="troop__life">
        <span className="small">❤️ Liv {fmtRate(stats.maxHp - troop.wounds)} / {fmtRate(stats.maxHp)}</span>
        <Bar value={stats.maxHp - troop.wounds} max={stats.maxHp} tone="life" label="Liv" />
        <LifeStatus troop={troop} rates={rates} hpPerSoldier={stats.hp} />
      </div>

      <dl className="troop__stats">
        <div><dt>Styrka</dt><dd>{fmtRate(stats.strength)} DPS</dd></div>
        <div><dt>Arbete</dt><dd>{fmtRate(stats.workTotal)}</dd></div>
        <div className="troop__activity">
          <dt>Aktivitet</dt>
          <dd>{troop.activity ? `${ACTIVITY_LABEL[troop.activity].icon} ${ACTIVITY_LABEL[troop.activity].name}` : 'Ingen'}</dd>
        </div>
      </dl>
      <p className="troop__output">{outputText(troop, rates, state)}</p>

      <div className="activity-picker" role="group" aria-label="Välj aktivitet">
        {unlocked.map((a) => (
          <button
            key={a}
            className={`activity ${troop.activity === a ? 'activity--on' : ''}`}
            aria-pressed={troop.activity === a}
            onClick={() => assign(a)}
          >
            <span className="activity__icon" aria-hidden>{ACTIVITY_LABEL[a].icon}</span>
            <span className="activity__name">{ACTIVITY_LABEL[a].name}</span>
          </button>
        ))}
      </div>

      {canRecruit && (
        <div className="recruit">
          <span className="recruit__label">Rekrytera</span>
          {room <= 0 ? (
            <span className="muted">Truppen är full. Bygg för att höja gränsen.</span>
          ) : (
            <div className="recruit__buttons">
              {[1, 10].filter((n) => n <= room).map((n) => {
                const cost = recruitCost(state, troop.id, n, content);
                return (
                  <button key={n} className="btn btn--small" disabled={!canAfford(state, cost)} onClick={() => recruit(n)}>
                    +{n} <CostList cost={cost} state={state} />
                  </button>
                );
              })}
              <button className="btn btn--small" disabled={maxN <= 0} onClick={() => recruit(maxN)}>
                Max{maxN > 0 ? ` (+${maxN})` : ''}
              </button>
            </div>
          )}
        </div>
      )}

      {showEquipment && (
        <div className="recruit">
          <span className="recruit__label">Utrustning</span>
          <EquipmentBar troop={troop} />
          <div className="recruit__buttons">
            <button className="btn btn--small" disabled={inArmoury === 0} onClick={() => run(() => store.command({ type: 'equipTroop', troopId: troop.id }))}>
              Utrusta bästa från förrådet ({inArmoury})
            </button>
            <button className="btn btn--small" disabled={troop.equipment.length === 0} onClick={() => run(() => store.command({ type: 'unequipTroop', troopId: troop.id }))}>
              Lägg i förrådet
            </button>
          </div>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </article>
  );
}

export function Forces({ state, rates }: { state: GameState; rates: Rates }) {
  return (
    <div className="screen">
      <Objectives state={state} />
      <Panel title={state.troops.length > 1 ? 'Dina styrkor' : 'Din trupp'}>
        <div className="troop-list">
          {state.troops.map((t) => <TroopCard key={t.id} troop={t} state={state} rates={rates} />)}
        </div>
      </Panel>
    </div>
  );
}
