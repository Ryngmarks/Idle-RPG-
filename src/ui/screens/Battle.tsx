import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { content } from '../../content';
import { currentEnemy, enemy, estimatedBossDamage, stageSafety, troopStats, zone, type GameState, type Rates, type StageSafety } from '../../core';
import { EnemyPortrait } from '../art';
import { Battlefield } from '../army';
import { Bar, Panel } from '../components/common';
import { fmtDuration, fmtInt, fmtRate } from '../format';
import { useStore } from '../game';
import { RESOURCE_LABEL } from '../labels';

const RISK_ICON = { safe: '🟢', risky: '🟡', deadly: '🔴' } as const;

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

  return (
    <div className="screen">
      <Panel title={z.name} aside={<span className="muted small">Steg {c.stageIndex + 1} av {z.stages.length}</span>}>
        <Battlefield
          race={state.raceId}
          size={fighters.reduce((n, t) => n + t.size, 0)}
          enemyId={c.boss ? boss.id : foe.id}
          hitKey={Math.floor(state.stats.totalKills)}
          fighting={fighters.length > 0}
          boss={!!c.boss}
        />
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
                  <span className="node__face">{open ? <EnemyPortrait enemyId={s.enemyId} size={40} /> : '🔒'}</span>
                  {i === c.stageIndex && <span className="node__flag" aria-hidden>🚩</span>}
                  {cleared && <span className="node__badge" aria-hidden>✓</span>}
                  {risk && !cleared && <span className="node__risk" aria-hidden>{RISK_ICON[risk]}</span>}
                </button>
                <span className="path__label">{i + 1}</span>
              </li>
            );
          })}
          <li className="path__step">
            <span className={`node node--boss ${c.cleared ? '' : 'node--locked'} ${c.bossDefeated ? 'node--cleared' : ''}`} aria-label={boss.name}>
              <span className="node__face">{c.cleared ? <EnemyPortrait enemyId={boss.id} size={46} /> : '👑'}</span>
              {c.bossDefeated && <span className="node__badge" aria-hidden>✓</span>}
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
              Gå till steg {c.unlockedStage + 1} {RISK_ICON[safetyAt(c.unlockedStage).risk]}
            </button>
          </div>
        ) : (
          !c.bossDefeated && <p className="muted small">Alla steg är rensade. Välj ett säkert steg att hålla medan du förbereder dig för bossen.</p>
        )}
      </Panel>

      <Panel title="Fiende" className="enemy">
        <div className="enemy__row">
          <div className="enemy__info">
            <h3 className="enemy__name">{foe.name}</h3>
            <p className="muted small">
              HP {foe.hp} · Rustning {foe.armour} · Skada mot dig {fmtRate(foe.attack)}/s
            </p>
            <p className="muted small">
              Belöning: {Object.entries(foe.loot).map(([r, v]) => `${RESOURCE_LABEL[r as keyof typeof RESOURCE_LABEL].icon} ${fmtRate(v ?? 0)}`).join(' ')} · ⭐ {fmtRate(foe.xp)} XP
            </p>
          </div>
        </div>
        {showHp ? (
          <div className="enemy__hp">
            <span className="small">HP {fmtInt(foe.hp * (1 - frac))} / {foe.hp}</span>
            <Bar value={foe.hp * (1 - frac)} max={foe.hp} tone="blood" label="Fiendens HP" />
          </div>
        ) : rates.killsPerSec >= 2 ? (
          <p className="small">Dina trupper fäller {fmtRate(rates.killsPerSec)} fiender per sekund.</p>
        ) : null}
        <p className={`risk risk--${here.risk}`}>{RISK_ICON[here.risk]} {riskText(here)}</p>
        <p className="small">
          {fighters.length === 0
            ? '⚠️ Ingen trupp strider. Ge en trupp ordern Strid.'
            : `${fighters.map((t) => t.name).join(', ')} · ${fmtRate(totalDps)} DPS · ${fmtRate(rates.killsPerSec)} besegrade/s`}
        </p>
      </Panel>

      <Panel title={`Boss: ${boss.name}`} className="boss">
        <div className="boss__art">
          <EnemyPortrait enemyId={boss.id} size={132} />
        </div>
        {c.bossDefeated ? (
          <p>👑 Gamle Betarn är besegrad. Gårdarna är säkra. <span className="muted">Nästa region kommer i en senare version.</span></p>
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
                <p className={`risk risk--${bossSafety.risk}`}>{RISK_ICON[bossSafety.risk]} {riskText(bossSafety)}</p>
                <button className="btn btn--primary" onClick={() => setError(store.command({ type: 'challengeBoss' }))}>
                  Utmana bossen
                </button>
              </>
            ) : (
              <p className="muted small">🔒 Rensa alla fem stegen för att utmana bossen.</p>
            )}
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </Panel>
    </div>
  );
}
