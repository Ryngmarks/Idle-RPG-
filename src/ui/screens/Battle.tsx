import { useState } from 'react';
import { content } from '../../content';
import { currentEnemy, enemy, estimatedBossDamage, troopStats, zone, type GameState, type Rates } from '../../core';
import { EnemyPortrait } from '../art';
import { Bar, Panel } from '../components/common';
import { fmtDuration, fmtInt, fmtRate } from '../format';
import { useStore } from '../game';
import { RESOURCE_LABEL } from '../labels';

export function Battle({ state, rates }: { state: GameState; rates: Rates }) {
  const store = useStore();
  const [error, setError] = useState<string | null>(null);
  const z = zone(state, content);
  const c = state.combat;
  const foe = currentEnemy(state, content);
  const fighters = state.troops.filter((t) => t.activity === 'combat');
  const totalDps = fighters.reduce((sum, t) => sum + troopStats(state, t, content).strength, 0);
  const stage = z.stages[Math.min(c.stageIndex, z.stages.length - 1)]!;
  const killsInStage = c.cleared ? stage.killsToClear : c.kills;
  // Current enemy HP is derived from the fractional kill progress (the core tracks kills continuously).
  const frac = (c.cleared ? state.stats.totalKills : c.kills) % 1;
  const showHp = rates.killsPerSec > 0 && rates.killsPerSec < 2;
  const boss = enemy(z.boss.enemyId, content);
  const bossUnlocked = state.unlocks.includes('boss');
  const est = estimatedBossDamage(state, content);

  return (
    <div className="screen">
      <Panel title={z.name} aside={<span className="muted small">Steg {Math.min(c.stageIndex + 1, z.stages.length)} / {z.stages.length}</span>}>
        <ol className="stages">
          {z.stages.map((s, i) => {
            const done = c.cleared || i < c.stageIndex;
            const now = !c.cleared && i === c.stageIndex;
            return (
              <li key={i} className={`stage ${done ? 'stage--done' : ''} ${now ? 'stage--now' : ''}`} title={content.enemies[s.enemyId]?.name}>
                {done ? '✓' : i + 1}
              </li>
            );
          })}
          <li className={`stage stage--boss ${c.bossDefeated ? 'stage--done' : ''}`} title={boss.name}>👑</li>
        </ol>
        {!c.cleared && (
          <div className="stage-progress">
            <span className="small">Besegrade på detta steg: {fmtInt(Math.floor(killsInStage))} / {stage.killsToClear}</span>
            <Bar value={killsInStage} max={stage.killsToClear} tone="gold" label="Stegframsteg" />
          </div>
        )}
        {c.cleared && !c.bossDefeated && <p className="muted small">Alla steg är rensade. Dina trupper håller området medan du förbereder dig för bossen.</p>}
      </Panel>

      <Panel title="Fiende" className="enemy">
        <div className="enemy__row">
          <div key={showHp ? Math.floor(c.cleared ? state.stats.totalKills : c.kills) : 'steady'} className={showHp ? 'portrait-wrap portrait-wrap--hit' : 'portrait-wrap'}>
            <EnemyPortrait enemyId={foe.id} />
          </div>
          <div className="enemy__info">
            <h3 className="enemy__name">{foe.name}</h3>
            <p className="muted small">
              HP {foe.hp} · Rustning {foe.armour} · Belöning:{' '}
              {Object.entries(foe.loot).map(([r, v]) => `${RESOURCE_LABEL[r as keyof typeof RESOURCE_LABEL].icon} ${fmtRate(v ?? 0)}`).join(' ')} · ⭐ {fmtRate(foe.xp)} XP
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
            <p className="muted small">HP {fmtInt(boss.hp)} · Rustning {boss.armour} · Tidsgräns {z.boss.timeLimitSec} s</p>
            {bossUnlocked ? (
              <>
                <p className="small">
                  Dina stridande trupper beräknas göra <strong>{fmtInt(est.damage)}</strong> skada på {z.boss.timeLimitSec} s
                  {est.damage >= est.hp ? ' – det borde räcka.' : ' – det räcker inte än.'}
                </p>
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
