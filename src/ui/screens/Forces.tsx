import { useState } from 'react';
import { content } from '../../content';
import {
  ACTIVITIES,
  activeObjectives,
  availableSites,
  beds,
  capacity,
  soldierCount,
  trainBlocker,
  trainCost,
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
import { EquipmentBar, Switch } from '../components/equipment';
import { fmtDuration, fmtInt, fmtRate } from '../format';
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
    case 'smithing':
      return state.crafting.queue.length > 0 ? `+${fmtRate(t.work)} smidesarbete/s` : 'Ingen beställning i smedjan';
    default: {
      const per = Object.entries(t.output)
        .filter(([, v]) => (v ?? 0) > 0)
        .map(([r, v]) => `+${fmtRate((v ?? 0) * 60)} ${RESOURCE_LABEL[r as ResourceId].name.toLowerCase()}/min`)
        .join(' · ');
      return t.working < troop.size ? `${per} · ${t.working} av ${troop.size} arbetar, platsen är full` : per;
    }
  }
}

/** The current work cycle at a site: a felled tree, a broken block… */
function CycleBar({ troop, state, rates }: { troop: TroopState; state: GameState; rates: Rates }) {
  const site = troop.siteId ? content.sites[troop.siteId] : undefined;
  const cycles = site ? (rates.siteCycles[site.id] ?? 0) : 0;
  if (!site || cycles <= 0) return null;
  const reward = Object.entries(site.yield).map(([r, v]) => `${RESOURCE_LABEL[r as ResourceId].icon} ${v}`).join(' ');
  const left = (1 - (state.siteProgress[site.id] ?? 0)) / cycles;
  return (
    <div className="cycle">
      <span className="small">{site.name} · nästa {reward} om {fmtDuration(left)}</span>
      <Bar value={state.siteProgress[site.id] ?? 0} max={1} tone="gold" label={`${site.name}: arbetscykel`} />
    </div>
  );
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
  const c = content.constants;
  const lvlFrom = xpForLevel(stats.level, c.xpBase, c.xpExponent);
  const lvlTo = xpForLevel(stats.level + 1, c.xpBase, c.xpExponent);
  const unlocked = ACTIVITIES.filter((a) => state.unlocks.includes(`activity:${a}`));
  const canRecruit = state.unlocks.includes('recruit');
  const blocker = trainBlocker(state, content);
  const cost = trainCost(state, content);
  const trainingHere = state.training?.troopId === troop.id ? state.training : null;
  const sites = troop.activity ? availableSites(state, content, troop.activity) : [];
  const others = state.troops.filter((t) => t.id !== troop.id);
  const openSlot = state.troops.length < state.troopSlots;
  const inArmoury = Object.entries(state.armoury)
    .filter(([k]) => k.startsWith(`${troop.weaponTypeId}:`))
    .reduce((n, [, v]) => n + v, 0);
  const showEquipment = state.unlocks.includes('crafting') || troop.equipment.length > 0;

  const run = (fn: () => string | null) => setError(fn());
  const assign = (activity: ActivityKind) => run(() => store.command({ type: 'assignTroop', troopId: troop.id, activity }));
  const move = (to: string | null) => run(() => store.command({ type: 'transferSoldiers', fromTroopId: troop.id, toTroopId: to, count: 1 }));

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
          <strong>{troop.size}</strong> {troop.size === 1 ? 'soldat' : 'soldater'}
        </span>
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
      <CycleBar troop={troop} state={state} rates={rates} />

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

      {sites.length > 1 && (
        <div className="site-picker" role="group" aria-label="Välj arbetsplats">
          {sites.map((site) => (
            <button
              key={site.id}
              className={`btn btn--small ${troop.siteId === site.id ? 'btn--on' : ''}`}
              aria-pressed={troop.siteId === site.id}
              onClick={() => run(() => store.command({ type: 'assignTroop', troopId: troop.id, activity: troop.activity, siteId: site.id }))}
            >
              {site.name} · {Object.entries(site.yield).map(([r, v]) => `${RESOURCE_LABEL[r as ResourceId].icon}${v}`).join(' ')} · {capacity(state, content, site.id)} {capacity(state, content, site.id) === 1 ? 'plats' : 'platser'}
            </button>
          ))}
        </div>
      )}

      {canRecruit && (
        <div className="recruit">
          <span className="recruit__label">Rekryter</span>
          {trainingHere ? (
            <>
              <span className="small">⏳ En rekryt utbildas för {troop.name}: klar om {fmtDuration(trainingHere.secLeft)}</span>
              <Bar value={trainingHere.totalSec - trainingHere.secLeft} max={trainingHere.totalSec} tone="xp" label="Utbildning" />
            </>
          ) : (
            <div className="recruit__buttons">
              <button className="btn btn--small" disabled={blocker !== null} onClick={() => run(() => store.command({ type: 'trainRecruit', troopId: troop.id }))}>
                Utbilda rekryt <CostList cost={{ food: cost.food }} state={state} /> · {fmtDuration(cost.sec)}
              </button>
              {blocker === 'noBed' && <span className="muted small">Ingen ledig säng. Bygg tält.</span>}
              {blocker === 'busy' && <span className="muted small">Lägret utbildar redan en rekryt.</span>}
            </div>
          )}
        </div>
      )}

      {(others.length > 0 || openSlot) && troop.size > 1 && (
        <div className="recruit">
          <span className="recruit__label">Flytta en soldat</span>
          <div className="recruit__buttons">
            {others.map((o) => (
              <button key={o.id} className="btn btn--small btn--ghost" onClick={() => move(o.id)}>→ {o.name}</button>
            ))}
            {openSlot && <button className="btn btn--small" onClick={() => move(null)}>→ Ny grupp</button>}
          </div>
        </div>
      )}

      {showEquipment && (
        <div className="recruit">
          <div className="section-head">
            <span className="recruit__label">Utrustning</span>
            <Switch
              on={troop.autoEquip}
              label="Auto"
              title="Truppen tar själv de bästa vapnen från förrådet"
              onChange={(on) => run(() => store.command({ type: 'setAutoEquip', troopId: troop.id, on }))}
            />
          </div>
          <EquipmentBar troop={troop} />
          {(!troop.autoEquip && inArmoury > 0) || troop.equipment.length > 0 ? (
            <div className="recruit__buttons">
              {!troop.autoEquip && inArmoury > 0 && (
                <button className="btn btn--small" onClick={() => run(() => store.command({ type: 'equipTroop', troopId: troop.id }))}>
                  Utrusta ({fmtInt(inArmoury)})
                </button>
              )}
              {troop.equipment.length > 0 && (
                <button className="btn btn--small btn--ghost" title="Lägger vapnen i förrådet och stänger av Auto" onClick={() => run(() => store.command({ type: 'unequipTroop', troopId: troop.id }))}>
                  Töm
                </button>
              )}
            </div>
          ) : null}
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
      <Panel
        title={state.troops.length > 1 ? 'Dina styrkor' : 'Din trupp'}
        aside={<span className="badge" title="Soldater / sängar i lägret">🛏 {soldierCount(state)} / {beds(state, content)}</span>}
      >
        <div className="troop-list">
          {state.troops.map((t) => <TroopCard key={t.id} troop={t} state={state} rates={rates} />)}
        </div>
      </Panel>
    </div>
  );
}
