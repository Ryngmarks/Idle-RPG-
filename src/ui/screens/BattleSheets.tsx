import { useState } from 'react';
import { content } from '../../content';
import { ACTIVITIES, currentEnemy, enemy, secondsPerKill, stageSafety, troopStats, zone, type GameState, type Rates, type StageSafety } from '../../core';
import { EnemyPortrait } from '../art';
import { Icon } from '../art/icons';
import { Bar, Chip, ResAmount } from '../components/common';
import { EquipmentBar } from '../components/equipment';
import { fmtDuration, fmtInt, fmtRate } from '../format';
import { useStore } from '../game';
import { ACTIVITY_LABEL, RESOURCE_LABEL } from '../labels';
import { TraitChips } from './Forces';
import { Modal } from './Modals';

const RISK_BADGE = { safe: { text: 'Låg risk', tone: 'ok' }, risky: { text: 'Risk', tone: 'slow' }, deadly: { text: 'Hög risk', tone: 'warn' } } as const;

export function RiskBadge({ risk }: { risk: StageSafety['risk'] }) {
  return <Chip tone={RISK_BADGE[risk].tone}>{RISK_BADGE[risk].text}</Chip>;
}

/** Risk wording. Bosses are non-lethal (D-34/D-35): nobody falls, troops retreat with wounds. */
export function riskText(s: StageSafety, boss: boolean): string {
  if (s.risk === 'safe') return 'Säkert: dina trupper läker snabbare än de skadas.';
  if (boss) return 'Ingen faller i en bossstrid: trupperna retirerar med sår om de inte orkar.';
  const when = fmtDuration(s.secondsToFirstLoss);
  return s.risk === 'risky'
    ? `Riskabelt: första soldaten faller om cirka ${when}.`
    : `Dödligt: första soldaten faller om ${when}. Truppen retirerar när hälften har fallit.`;
}

function Stat({ icon, label, value }: { icon: Parameters<typeof Icon>[0]['name']; label: string; value: React.ReactNode }) {
  return (
    <div className="sheet-stat">
      <span className="sheet-stat__label"><Icon name={icon} size={15} /> {label}</span>
      <b className="sheet-stat__value">{value}</b>
    </div>
  );
}

export function TroopSheet({ state, rates, troopId, onClose, onForces }: { state: GameState; rates: Rates; troopId: string; onClose: () => void; onForces: () => void }) {
  const store = useStore();
  const [error, setError] = useState<string | null>(null);
  const troop = state.troops.find((t) => t.id === troopId);
  if (!troop) return null;
  const st = troopStats(state, troop, content);
  const net = rates.woundsPerSec[troop.id] ?? 0;
  const per = rates.perTroop[troop.id];
  const unlocked = ACTIVITIES.filter((a) => state.unlocks.includes(`activity:${a}`));
  const life = st.maxHp - troop.wounds;
  const dealt = state.combat.boss ? `${fmtRate(per?.bossDps ?? 0)} skada/s mot bossen` : (per?.killsPerSec ?? 0) < 0.005 ? 'för svag för att fälla den här fienden' : `${fmtRate(per?.killsPerSec ?? 0)} besegrade/s`;
  return (
    <Modal title={troop.name} onClose={onClose}>
      <div className="sheet-chips">
        <Chip tone="gold"><Icon name="star" size={13} /> Nivå {st.level}</Chip>
        {troop.activity && <Chip><Icon name={ACTIVITY_LABEL[troop.activity].icon} size={13} /> {ACTIVITY_LABEL[troop.activity].name}</Chip>}
        <Chip><Icon name="soldier" size={13} /> {troop.size} {troop.size === 1 ? 'soldat' : 'soldater'}</Chip>
        {net > 0 ? <Chip tone="warn"><Icon name="warning" size={13} /> Skadas</Chip> : net < 0 ? <Chip tone="ok"><Icon name="heal" size={13} /> Läker</Chip> : <Chip tone="ok"><Icon name="heal" size={13} /> Frisk</Chip>}
      </div>
      <div className="sheet-grid">
        <Stat icon="strength" label="Attack" value={`${fmtRate(st.attack * st.weaponMult)} / soldat`} />
        <Stat icon="swords" label="Styrka" value={`${fmtRate(st.strength)}/s`} />
        <Stat icon="heart" label="Liv" value={`${fmtRate(st.hp)} / soldat`} />
        <Stat icon="warning" label="Sår" value={troop.wounds > 0.05 ? fmtRate(troop.wounds) : 'Inga'} />
      </div>
      <Bar value={life} max={st.maxHp} tone="life" label="Liv" inside={`${fmtInt(life)} / ${fmtInt(st.maxHp)}`} />
      {troop.activity === 'combat' && (
        <p className="small muted">
          {dealt} · {net > 0 ? `förlorar ${fmtRate(net)} liv/s` : net < 0 ? 'läker mellan strider' : 'ingen skada just nu'}
        </p>
      )}
      <EquipmentBar troop={troop} />
      <TraitChips troop={troop} state={state} />
      <div className="activity-picker" role="group" aria-label="Byt aktivitet">
        {unlocked.map((a) => (
          <button
            key={a}
            className={`activity ${troop.activity === a ? 'activity--on' : ''}`}
            aria-pressed={troop.activity === a}
            onClick={() => setError(store.command({ type: 'assignTroop', troopId: troop.id, activity: a }))}
          >
            <span className="activity__icon" aria-hidden><Icon name={ACTIVITY_LABEL[a].icon} size={22} /></span>
            <span className="activity__name">{ACTIVITY_LABEL[a].name}</span>
          </button>
        ))}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn btn--block" onClick={onForces}>Öppna i Styrkor <Icon name="shield" size={16} /></button>
    </Modal>
  );
}

export function EnemySheet({ state, rates, onClose }: { state: GameState; rates: Rates; onClose: () => void }) {
  const z = zone(state, content);
  const c = state.combat;
  const bossDef = c.boss ? z.bosses[Math.min(c.boss.index, z.bosses.length - 1)]! : null;
  const foe = bossDef ? enemy(bossDef.enemyId, content) : currentEnemy(state, content);
  const fighters = state.troops.filter((t) => t.activity === 'combat');
  const judged = (fighters.length > 0 ? fighters : state.troops).map((t) => t.id);
  const safety = stageSafety(state, content, bossDef ? 'boss' : { stageIndex: c.stageIndex }, judged);
  const totalDps = fighters.reduce((n, t) => n + troopStats(state, t, content).strength, 0);
  const groupMax = fighters.reduce((n, t) => n + troopStats(state, t, content).maxHp, 0);
  const groupNow = fighters.reduce((n, t) => n + troopStats(state, t, content).maxHp - t.wounds, 0);
  const incoming = fighters.reduce((n, t) => n + Math.max(0, rates.woundsPerSec[t.id] ?? 0), 0);
  const healing = fighters.some((t) => (rates.woundsPerSec[t.id] ?? 0) < 0);
  const spk = secondsPerKill(state, content);
  const frac = state.stats.totalKills % 1;
  const hpNow = c.boss ? c.boss.hpLeft : foe.hp * (1 - frac);
  const lootEntries = Object.entries(foe.loot).filter(([, v]) => (v ?? 0) > 0) as [keyof typeof RESOURCE_LABEL, number][];
  return (
    <Modal title={foe.name} onClose={onClose}>
      <div className="sheet-head">
        <EnemyPortrait enemyId={foe.id} size={64} />
        <div className="sheet-chips">
          {bossDef ? <Chip tone="warn"><Icon name="crown" size={13} /> Boss</Chip> : null}
          <Chip tone="gold">Nivå {bossDef ? bossDef.level : c.stageIndex + 1}</Chip>
          <RiskBadge risk={safety.risk} />
        </div>
      </div>
      <Bar value={hpNow} max={foe.hp} tone="blood" label="Fiendens HP" inside={`HP ${fmtInt(hpNow)} / ${fmtInt(foe.hp)}`} />
      {c.boss && bossDef && (
        <>
          <p className="small">Tid kvar {fmtDuration(c.boss.timeLeft)}</p>
          <Bar value={c.boss.timeLeft} max={bossDef.timeLimitSec} tone="steel" label="Tid kvar" />
        </>
      )}
      <div className="sheet-grid">
        <Stat icon="shield" label="Rustning" value={foe.armour} />
        <Stat icon="swords" label="Attack" value={`${fmtRate(foe.attack)}/s`} />
        {!bossDef && <Stat icon="xp" label="XP / fiende" value={fmtRate(foe.xp)} />}
        {!bossDef && spk !== null && <Stat icon="clock" label="Faller" value={spk < 1 ? '< 1 s' : `~${fmtRate(spk)} s`} />}
        {bossDef && <Stat icon="clock" label="Tidsgräns" value={fmtDuration(bossDef.timeLimitSec)} />}
        {bossDef && <Stat icon="strength" label="Er skada" value={`${fmtRate(rates.bossDps)}/s`} />}
      </div>
      {lootEntries.length > 0 && (
        <p className="kv__loot">Ger per fiende: {lootEntries.map(([r, v]) => <ResAmount key={r} r={r} v={fmtRate(v)} />)}</p>
      )}
      {fighters.length > 0 && (
        <>
          <Bar value={groupNow} max={groupMax} tone="life" label="Truppernas liv" inside={`Trupperna ${fmtInt(groupNow)} / ${fmtInt(groupMax)}`} />
          <p className="small muted">
            {fighters.map((t) => t.name).join(', ')} · {fmtRate(totalDps)} skada/s ·{' '}
            {incoming > 0 ? `skada mot er ${fmtRate(incoming)}/s` : healing ? 'läker mellan strider' : 'ingen skada just nu'}
          </p>
        </>
      )}
      <p className={`sheet-risk sheet-risk--${safety.risk}`}><Icon name={safety.risk === 'safe' ? 'check' : 'warning'} size={16} /> {riskText(safety, !!bossDef)}</p>
    </Modal>
  );
}
