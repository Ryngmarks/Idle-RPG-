import { useState, type ReactNode } from 'react';
import { content } from '../../content';
import {
  ACTIVITIES,
  activeObjectives,
  availableSites,
  beds,
  capacity,
  limiters,
  secondsToNextCycle,
  soldierCount,
  trainBlocker,
  trainCost,
  troopStats,
  xpForLevel,
  type ActivityKind,
  type GameState,
  type Limiter,
  type ObjectiveDef,
  type Rates,
  type ResourceId,
  type TroopState,
} from '../../core';
import { TroopScene } from '../army';
import { Icon } from '../art/icons';
import { ResIcon } from '../art/resources';
import { Bar, Chip, CostList, ResAmount, Slots } from '../components/common';
import { EquipmentBar, Switch } from '../components/equipment';
import { fmtDuration, fmtInt, fmtRate } from '../format';
import { useStore } from '../game';
import { ACTIVITY_LABEL, RESOURCE_LABEL, effectText, objectiveProgress } from '../labels';

function rewardText(o: ObjectiveDef): ReactNode {
  const r = o.rewards;
  const parts: ReactNode[] = [];
  for (const [res, v] of Object.entries(r.resources ?? {})) if ((v ?? 0) > 0) parts.push(<ResAmount key={res} r={res as ResourceId} v={v} />);
  if (r.soldiers) parts.push(<span key="sol" className="amount"><Icon name="soldier" size={16} />+{r.soldiers}<span className="sr-only"> soldater</span></span>);
  if (r.troopSlots) parts.push(<span key="slot" className="amount"><Icon name="shield" size={16} />+{r.troopSlots} grupp</span>);
  for (const u of r.unlocks ?? []) {
    const t = effectText({ type: 'unlock', unlock: u } as never);
    if (t) parts.push(<span key={u}>{t.toLowerCase()}</span>);
  }
  return parts.map((p, i) => <span key={i} className="rw">{p}</span>);
}

export function Objectives({ state }: { state: GameState }) {
  const goals = activeObjectives(state, content);
  if (goals.length === 0) return null;
  return (
    <section className="screen-section" aria-label="Mål">
      <span className="tag">Mål</span>
      <div className="limits">
        {goals.map((o) => {
          const p = objectiveProgress(state, o.condition);
          const reward = rewardText(o);
          return (
            <div key={o.id} className="goal">
              <div className="goal__row">
                <span className="goal__icon" aria-hidden><Icon name="target" size={30} /></span>
                <div className="goal__body">
                  <b>{o.text}</b>
                  {p && <Bar value={p.current} max={p.target} tone="gold" label={o.text} />}
                </div>
                {p && <b className="small">{Math.floor(p.current)}/{p.target}</b>}
              </div>
              {reward && <div className="small muted goal__reward">Belöning: {reward}</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

type GoTab = Limiter['tab'];

function limiterView(l: Limiter, state: GameState): { icon: ReactNode; title: string; hint: string; action: string } {
  const troop = state.troops.find((t) => t.id === l.troopId);
  const site = l.siteId ? content.sites[l.siteId] : undefined;
  switch (l.kind) {
    case 'idleTroop': return { icon: <Icon name="zzz" size={26} />, title: `${troop?.name ?? 'Trupp'} saknar order`, hint: 'Ge en aktivitet', action: 'Ge order' };
    case 'noBuilder': return { icon: <Icon name="hammer" size={26} />, title: 'Ingen bygger', hint: 'Bygget står still', action: 'Bygg' };
    case 'noSmith': return { icon: <Icon name="anvil" size={26} />, title: 'Ingen smed', hint: 'Kön står still', action: 'Smedjan' };
    case 'beds': return { icon: <ResIcon id="bed" size={28} />, title: `Sängar ${l.current ?? 0}/${l.max ?? 0}`, hint: 'Ingen ny soldat utan fler sängar', action: 'Bygg säng' };
    case 'trainingFood': return { icon: <ResIcon id="food" size={28} />, title: 'Mat saknas', hint: `${Math.floor(l.current ?? 0)} av ${Math.ceil(l.max ?? 0)} till utbildning`, action: 'Samla mat' };
    case 'siteFull': return { icon: <Icon name="tree" size={26} />, title: `${site?.name ?? 'Platsen'} full`, hint: `${l.current ?? 0} av ${l.max ?? 0} får plats`, action: 'Byt plats' };
    case 'crewFull': return { icon: <Icon name={l.target === 'smithing' ? 'anvil' : 'hammer'} size={26} />, title: l.target === 'smithing' ? 'Smedjan full' : 'Bygget fullt', hint: `${l.current ?? 0} av ${l.max ?? 0} får arbeta`, action: l.target === 'smithing' ? 'Till Smedjan' : 'Till Bosättning' };
    case 'training': return { icon: <Icon name="hourglass" size={26} />, title: 'Rekryt utbildas', hint: l.secondsLeft !== undefined ? `klar om ${fmtDuration(l.secondsLeft)}` : '', action: '' };
  }
}

/** "What limits you now": at most three rows, each with one action pill that jumps to the fix. */
export function Limits({ state, onGo }: { state: GameState; onGo: (t: GoTab) => void }) {
  const list = limiters(state, content).slice(0, 3);
  if (list.length === 0) return null;
  return (
    <section className="screen-section" aria-label="Det som begränsar dig nu">
      <span className="tag">Det som begränsar dig nu</span>
      <div className="limits">
        {list.map((l, i) => {
          const v = limiterView(l, state);
          return (
            <div key={`${l.kind}-${l.troopId ?? l.siteId ?? i}`} className={`limit limit--${l.severity}`}>
              <span className="limit__icon" aria-hidden>{v.icon}</span>
              <div className="limit__text"><b>{v.title}</b><span className="small muted">{v.hint}</span></div>
              {v.action && (
                <button className={`chip limit__go ${l.severity === 'block' ? 'chip--warn' : ''}`} onClick={() => onGo(l.tab)}>{v.action}</button>
              )}
            </div>
          );
        })}
      </div>
    </section>
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

/** The hero of a working troop: site, slots, big cycle bar and the next reward. */
function CycleHero({ troop, state, rates }: { troop: TroopState; state: GameState; rates: Rates }) {
  const site = troop.siteId ? content.sites[troop.siteId] : undefined;
  const cycles = site ? (rates.siteCycles[site.id] ?? 0) : 0;
  if (!site || cycles <= 0) return <p className="troop__output">{outputText(troop, rates, state)}</p>;
  const reward = Object.entries(site.yield).map(([r, v]) => <ResAmount key={r} r={r as ResourceId} v={v} />);
  const left = secondsToNextCycle(state, content, site.id) ?? 0;
  const cap = capacity(state, content, site.id);
  const working = rates.perTroop[troop.id]?.working ?? 0;
  const perMin = Object.entries(rates.perTroop[troop.id]?.output ?? {})
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([r, v]) => `+${fmtRate((v ?? 0) * 60)} ${RESOURCE_LABEL[r as ResourceId].name.toLowerCase()}/min`)
    .join(' · ');
  return (
    <div className="hero-cycle">
      <div className="hero-cycle__site">
        <b>{site.name}</b>
        <span className="sp" style={{ flex: 1 }} />
        <span className="small muted">{working} av {cap} {cap === 1 ? 'plats' : 'platser'}</span>
        <Slots used={Math.min(working, cap)} total={cap} label={`${working} av ${cap} platser`} />
      </div>
      <Bar value={state.siteProgress[site.id] ?? 0} max={1} tone="gold" label={`${site.name}: arbetscykel`} inside={fmtDuration(left)} />
      <div className="hero-cycle__next">
        <strong className="hero-cycle__reward">nästa {reward} om {fmtDuration(left)}</strong>
        <span className="small muted">{perMin}</span>
      </div>
    </div>
  );
}

function LifeStatus({ troop, rates, hpPerSoldier }: { troop: TroopState; rates: Rates; hpPerSoldier: number }) {
  const net = rates.woundsPerSec[troop.id] ?? 0;
  if (net > 0) {
    const secs = Math.max(0, hpPerSoldier - troop.wounds) / net;
    const text = troop.size > 1 ? `nästa soldat faller om ${fmtDuration(secs)}` : `retirerar om ${fmtDuration(secs)}`;
    return <span className="life-status life-status--danger"><Icon name="warning" size={16} /> Tar skada: {text}</span>;
  }
  if (net < 0) return <span className="life-status life-status--healing"><Icon name="heal" size={14} /> Läker</span>;
  return null;
}

function LifeChip({ troop, rates, hpPerSoldier }: { troop: TroopState; rates: Rates; hpPerSoldier: number }) {
  const net = rates.woundsPerSec[troop.id] ?? 0;
  if (net > 0) return <Chip tone="warn"><Icon name="warning" size={14} /> Skadas</Chip>;
  if (net < 0) return <Chip tone="ok"><Icon name="heal" size={13} /> Läker</Chip>;
  return <Chip tone="ok"><Icon name="heal" size={13} /> Frisk</Chip>;
}

function TroopCard({ troop, state, rates, hero }: { troop: TroopState; state: GameState; rates: Rates; hero: boolean }) {
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
    <article className={`troop ${hero ? 'troop--hero' : ''}`}>
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
            {troop.name} <span className="troop__edit" aria-hidden><Icon name="pencil" size={15} /></span>
          </button>
        )}
        <span className="badge badge--lvl" title={`${Math.floor(troop.xp)} / ${lvlTo} XP`}><Icon name="star" size={13} /> Nv {stats.level}</span>
        <LifeChip troop={troop} rates={rates} hpPerSoldier={stats.hp} />
      </header>
      <div className="troop__mini">
        <span className="stat"><Icon name="soldier" size={18} /><strong>{troop.size}</strong><span className="sr-only">{troop.size === 1 ? 'soldat' : 'soldater'}</span></span>
        <span className="stat" title="Styrka (skada per sekund)"><Icon name="strength" size={18} />{fmtRate(stats.strength)}<span className="sr-only"> styrka</span></span>
        <span className="stat" title="Arbete"><Icon name="work" size={18} />{fmtRate(stats.workTotal)}<span className="sr-only"> arbete</span></span>
        <span className="stat" title="Liv"><Icon name="heart" size={18} />{fmtRate(stats.maxHp - troop.wounds)}/{fmtRate(stats.maxHp)}<span className="sr-only"> liv</span></span>
      </div>
      <Bar value={stats.maxHp - troop.wounds} max={stats.maxHp} tone="life" label="Liv" />
      <Bar value={troop.xp - lvlFrom} max={lvlTo - lvlFrom} tone="xp" label="Erfarenhet" />
      <LifeStatus troop={troop} rates={rates} hpPerSoldier={stats.hp} />

      <CycleHero troop={troop} state={state} rates={rates} />

      <div className="activity-picker" role="group" aria-label="Välj aktivitet">
        {unlocked.map((a) => (
          <button
            key={a}
            className={`activity ${troop.activity === a ? 'activity--on' : ''}`}
            aria-pressed={troop.activity === a}
            onClick={() => assign(a)}
          >
            <span className="activity__icon" aria-hidden><Icon name={ACTIVITY_LABEL[a].icon} size={22} /></span>
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
              {site.name} · {Object.entries(site.yield).map(([r, v]) => <ResAmount key={r} r={r as ResourceId} v={v} />)} · {capacity(state, content, site.id)} pl.
            </button>
          ))}
        </div>
      )}

      {canRecruit && (
        <div className="train">
          <div className="train__main">
            <span className="tag">Träning</span>
            {trainingHere ? (
              <>
                <span className="small">Ny soldat · klar om {fmtDuration(trainingHere.secLeft)}</span>
                <Bar value={trainingHere.totalSec - trainingHere.secLeft} max={trainingHere.totalSec} tone="xp" label="Utbildning" />
              </>
            ) : (
              <button className="btn btn--small" disabled={blocker !== null} onClick={() => run(() => store.command({ type: 'trainRecruit', troopId: troop.id }))}>
                Utbilda soldat <CostList cost={{ food: cost.food }} state={state} /> · {fmtDuration(cost.sec)}
              </button>
            )}
          </div>
          <Chip tone={blocker === 'noBed' ? 'warn' : 'ok'} title="Soldater / sängar i lägret"><ResIcon id="bed" size={16} /> {soldierCount(state)}/{beds(state, content)}{blocker === 'noBed' ? ' – bygg säng' : ''}</Chip>
        </div>
      )}

      {(others.length > 0 || openSlot) && troop.size > 1 && (
        <div className="recruit">
          <span className="recruit__label">Flytta en soldat</span>
          <div className="recruit__buttons">
            {others.map((o) => (
              <button key={o.id} className="btn btn--small btn--ghost" onClick={() => move(o.id)}><Icon name="arrow" size={14} /> {o.name}</button>
            ))}
            {openSlot && <button className="btn btn--small" onClick={() => move(null)}><Icon name="arrow" size={14} /> Ny grupp</button>}
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

export function Forces({ state, rates, onGo }: { state: GameState; rates: Rates; onGo: (t: Limiter['tab']) => void }) {
  return (
    <div className="screen">
      <Limits state={state} onGo={onGo} />
      <Objectives state={state} />
      <section className="screen-section" aria-label={state.troops.length > 1 ? 'Dina styrkor' : 'Din trupp'}>
        <span className="tag">{state.troops.length > 1 ? 'Dina styrkor' : 'Din trupp'}</span>
        <div className="troop-list">
          {state.troops.map((t, i) => <TroopCard key={t.id} troop={t} state={state} rates={rates} hero={i === 0} />)}
        </div>
      </section>
    </div>
  );
}
