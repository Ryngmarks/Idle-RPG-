import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { content } from '../../content';
import { currentEnemy, enemy, estimatedBossDamage, normalizeBuckets, secondsPerKill, stageSafety, troopStats, zone, type GameState, type Rates, type StageSafety } from '../../core';
import { EnemyPortrait } from '../art';
import { Icon } from '../art/icons';
import { Battlefield } from '../army';
import { Bar, Chip, Panel, ResAmount } from '../components/common';
import { fmtDuration, fmtInt, fmtRate } from '../format';
import { useStore } from '../game';
import { RESOURCE_LABEL } from '../labels';

const RISK_ICON = { safe: 'dotSafe', risky: 'dotRisky', deadly: 'dotDeadly' } as const;
const RISK_BADGE = { safe: { text: 'Låg risk', tone: 'ok' }, risky: { text: 'Risk', tone: 'slow' }, deadly: { text: 'Hög risk', tone: 'warn' } } as const;

function RiskBadge({ risk }: { risk: StageSafety['risk'] }) {
  return <Chip tone={RISK_BADGE[risk].tone}>{RISK_BADGE[risk].text}</Chip>;
}

function riskText(s: StageSafety): string {
  if (s.risk === 'safe') return 'Säkert: dina trupper läker snabbare än de skadas.';
  const when = fmtDuration(s.secondsToFirstLoss);
  return s.risk === 'risky'
    ? `Riskabelt: första soldaten faller om cirka ${when}.`
    : `Dödligt: första soldaten faller om ${when}. Truppen retirerar när hälften har fallit.`;
}

export function Battle({ state, rates }: { state: GameState; rates: Rates }) {
  const store = useStore();
  const [error, setError] = useState<string | null>(null);
  const z = zone(state, content);
  const c = state.combat;
  const foe = currentEnemy(state, content);
  const fighters = state.troops.filter((t) => t.activity === 'combat');
  // Risk is judged for the troops that are fighting, or for the whole army if nobody is.
  const judged = (fighters.length > 0 ? fighters : state.troops).map((t) => t.id);
  const safetyAt = (i: number) => stageSafety(state, content, { stageIndex: i }, judged);
  const totalDps = fighters.reduce((sum, t) => sum + troopStats(state, t, content).strength, 0);
  const stage = z.stages[Math.min(c.stageIndex, z.stages.length - 1)]!;
  const onFrontier = !c.cleared && c.stageIndex === c.unlockedStage;
  // Current enemy HP is derived from the fractional kill count (the core tracks kills continuously).
  const frac = state.stats.totalKills % 1;
  const showHp = rates.killsPerSec > 0 && rates.killsPerSec < 2;
  const boss = enemy(z.boss.enemyId, content);
  const bossUnlocked = state.unlocks.includes('boss');
  const est = estimatedBossDamage(state, content);
  const bossSafety = stageSafety(state, content, 'boss', judged);
  const here = safetyAt(c.stageIndex);
  const select = (i: number) => setError(store.command({ type: 'selectStage', stageIndex: i }));

  // Celebrate a newly opened stage for a few seconds.
  const [justOpened, setJustOpened] = useState<number | null>(null);
  const prevUnlocked = useRef(c.unlockedStage);
  useEffect(() => {
    if (c.unlockedStage > prevUnlocked.current) {
      setJustOpened(c.unlockedStage);
      const id = setTimeout(() => setJustOpened(null), 3000);
      prevUnlocked.current = c.unlockedStage;
      return () => clearTimeout(id);
    }
    prevUnlocked.current = c.unlockedStage;
  }, [c.unlockedStage]);

  const spk = secondsPerKill(state, content);
  const fighterStats = fighters.map((t) => ({ t, st: troopStats(state, t, content) }));
  const groupMax = fighterStats.reduce((n, x) => n + x.st.maxHp, 0);
  const groupNow = fighterStats.reduce((n, x) => n + x.st.maxHp - x.t.wounds, 0);
  const incoming = fighters.reduce((n, t) => n + Math.max(0, rates.woundsPerSec[t.id] ?? 0), 0);
  const healing = fighters.some((t) => (rates.woundsPerSec[t.id] ?? 0) < 0);
  const foeHp = foe.hp * (1 - frac);
  const soldiers = fighters.reduce((n, t) => n + t.size, 0);

  return (
    <div className="screen">
      <Panel hero icon="swords" title={z.name} aside={<span className="battle-head"><span className="muted small">Steg {c.stageIndex + 1} av {z.stages.length}</span><RiskBadge risk={here.risk} /></span>}>
        <ol className="path" aria-label="Välj steg">
          {z.stages.map((s, i) => {
            const open = i <= c.unlockedStage;
            const cleared = c.cleared || i < c.unlockedStage;
            const frontier = !c.cleared && i === c.unlockedStage;
            const risk = open ? safetyAt(i).risk : null;
            const progress = frontier ? Math.min(100, (c.kills / s.killsToClear) * 100) : cleared ? 100 : 0;
            return (
              <li key={i} className="path__step">
                <button
                  className={`node ${open ? '' : 'node--locked'} ${cleared ? 'node--cleared' : ''} ${i === c.stageIndex ? 'node--current' : ''} ${i === justOpened ? 'node--new' : ''} ${risk ? `node--${risk}` : ''}`}
                  style={{ '--p': progress } as CSSProperties}
                  disabled={!open || !!c.boss}
                  aria-pressed={i === c.stageIndex}
                  aria-label={`Steg ${i + 1}: ${content.enemies[s.enemyId]?.name ?? ''}${open ? '' : ' (låst)'}`}
                  onClick={() => select(i)}
                >
                  <span className="node__ring" />
                  <span className="node__face">{open ? <EnemyPortrait enemyId={s.enemyId} size={40} /> : <Icon name="lock" size={20} />}</span>
                  {i === c.stageIndex && <span className="node__flag" aria-hidden><Icon name="flag" size={20} /></span>}
                  {cleared && <span className="node__badge" aria-hidden><Icon name="check" size={11} /></span>}
                  {risk && !cleared && <span className="node__risk" aria-hidden><Icon name={RISK_ICON[risk]} size={14} /></span>}
                </button>
                <span className="path__label">{i + 1}</span>
              </li>
            );
          })}
          <li className="path__step">
            <span className={`node node--boss ${c.cleared ? '' : 'node--locked'} ${c.bossDefeated ? 'node--cleared' : ''}`} aria-label={boss.name}>
              <span className="node__face">{c.cleared ? <EnemyPortrait enemyId={boss.id} size={46} /> : <Icon name="crown" size={26} />}</span>
              {c.bossDefeated && <span className="node__badge" aria-hidden><Icon name="check" size={11} /></span>}
            </span>
            <span className="path__label">Boss</span>
          </li>
        </ol>
        {onFrontier ? (
          <div className="stage-progress">
            <span className="small">Besegra {stage.killsToClear} för att öppna nästa steg: {fmtInt(Math.floor(c.kills))} / {stage.killsToClear}</span>
            <Bar value={c.kills} max={stage.killsToClear} tone="gold" label="Stegframsteg" />
          </div>
        ) : !c.cleared ? (
          <div className="row">
            <p className="small muted">Här samlar du mat och erfarenhet i lugn takt. Steg {c.unlockedStage + 1} är öppet.</p>
            <button className="btn btn--small" disabled={!!c.boss} onClick={() => select(c.unlockedStage)}>
              Gå till steg {c.unlockedStage + 1} <Icon name={RISK_ICON[safetyAt(c.unlockedStage).risk]} size={14} />
            </button>
          </div>
        ) : (
          !c.bossDefeated && <p className="muted small">Alla steg är rensade. Välj ett säkert steg att hålla medan du förbereder dig för bossen.</p>
        )}
      </Panel>

      {fighters.length === 0 && (
        <div className="cta" role="status"><Icon name="warning" size={22} /> <span>Ingen trupp strider. Ge en trupp ordern <b>Strid</b> under Styrkor.</span></div>
      )}

      <Panel className="enemy enemy-card" title={c.boss ? boss.name : foe.name} aside={<span className="small muted stat"><Icon name="shield" size={16} /> Rustning {foe.armour}</span>}>
        <Battlefield
          race={state.raceId}
          size={soldiers}
          enemyId={c.boss ? boss.id : foe.id}
          hitKey={Math.floor(state.stats.totalKills)}
          fighting={fighters.length > 0}
          boss={!!c.boss}
          equipment={normalizeBuckets(fighters.flatMap((t) => t.equipment), content)}
        />
        {!c.boss && (showHp ? (
          <Bar value={foeHp} max={foe.hp} tone="blood" label="Fiendens HP" inside={`HP ${fmtInt(foeHp)} / ${foe.hp}`} />
        ) : (
          <Bar value={foe.hp} max={foe.hp} tone="blood" label="Fiendens HP" inside={rates.killsPerSec >= 2 ? `${fmtRate(rates.killsPerSec)} fiender/s` : `HP ${foe.hp}`} />
        ))}
        <div className="kv">
          <span className="kv__loot">Ger {Object.entries(foe.loot).map(([r, v]) => <ResAmount key={r} r={r as keyof typeof RESOURCE_LABEL} v={fmtRate(v ?? 0)} />)} <span className="amount"><Icon name="xp" size={16} />{fmtRate(foe.xp)} XP</span></span>
          <span className="sp" style={{ flex: 1 }} />
          {spk !== null && <b>{spk < 1 ? 'Faller på under 1 s' : `Faller om ~${fmtRate(spk)} s`}</b>}
        </div>
        {fighters.length > 0 && <p className="small muted">{fighters.map((t) => t.name).join(', ')} · {fmtRate(totalDps)} DPS</p>}
      </Panel>

      {fighters.length > 0 && <Panel icon="heart" title={`Gruppens liv${soldiers > 0 ? ` · ${soldiers} ${soldiers === 1 ? 'soldat' : 'soldater'}` : ''}`}>
        <Bar value={groupNow} max={groupMax} tone="life" label="Gruppens liv" inside={`${fmtInt(groupNow)} / ${fmtInt(groupMax)}`} />
        <p className="small muted">
          {incoming > 0 ? `Skada mot er ${fmtRate(incoming)}/s` : healing ? 'Läker mellan strider' : 'Ingen skada just nu'}
          {here.risk !== 'safe' && fighters.length > 0 ? ` · ${riskText(here)}` : ''}
        </p>
      </Panel>}

      <Panel icon="crown" title={`Boss: ${boss.name}`} className="boss" aside={bossUnlocked && !c.bossDefeated ? <RiskBadge risk={bossSafety.risk} /> : undefined}>
        <div className="boss__art">
          <EnemyPortrait enemyId={boss.id} size={72} />
        </div>
        {c.bossDefeated ? (
          <p><Icon name="crown" size={20} /> Gamle Betarn är besegrad. Gårdarna är säkra. <span className="muted">Nästa region kommer i en senare version.</span></p>
        ) : c.boss ? (
          <>
            <span className="small">HP {fmtInt(c.boss.hpLeft)} / {fmtInt(boss.hp)}</span>
            <Bar value={c.boss.hpLeft} max={boss.hp} tone="blood" label="Bossens HP" />
            <span className="small">Tid kvar {fmtDuration(c.boss.timeLeft)}</span>
            <Bar value={c.boss.timeLeft} max={z.boss.timeLimitSec} tone="steel" label="Tid kvar" />
            <p className="small">Skada: {fmtRate(rates.bossDps)} per sekund</p>
          </>
        ) : (
          <>
            <p className="muted small">HP {fmtInt(boss.hp)} · Rustning {boss.armour} · Skada mot dig {fmtRate(boss.attack)}/s · Tidsgräns {z.boss.timeLimitSec} s</p>
            {bossUnlocked ? (
              <>
                <p className="small">
                  Dina stridande trupper beräknas göra <strong>{fmtInt(est.damage)}</strong> skada på {z.boss.timeLimitSec} s
                  {est.damage >= est.hp ? ' – det borde räcka.' : ' – det räcker inte än.'}
                </p>
                <p className="small muted">{riskText(bossSafety)}</p>
                <button className="btn btn--primary" onClick={() => setError(store.command({ type: 'challengeBoss' }))}>
                  Utmana bossen
                </button>
              </>
            ) : (
              <p className="muted small"><Icon name="lock" size={16} /> Rensa alla fem stegen för att utmana bossen.</p>
            )}
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </Panel>
    </div>
  );
}
