import { QUALITY_IDS, type GameEvent, type GameState } from '../../core';
import { Panel } from '../components/common';
import { RARE } from '../components/equipment';
import { fmtClock, fmtInt } from '../format';
import { QUALITY_COLOR, eventText, qualityName } from '../labels';

function Stats({ state }: { state: GameState }) {
  const s = state.stats;
  const soldiers = state.troops.reduce((n, t) => n + t.size, 0);
  const tiles = [
    { icon: '⏱️', label: 'Speltid', value: fmtClock(state.clock) },
    { icon: '👑', label: 'Bossen', value: s.bossDefeatedAt === null ? '–' : fmtClock(s.bossDefeatedAt) },
    { icon: '⚔️', label: 'Besegrade', value: fmtInt(s.totalKills) },
    { icon: '🛡️', label: 'Soldater', value: fmtInt(soldiers) },
    { icon: '📯', label: 'Rekryterade', value: fmtInt(s.recruited) },
    { icon: '🪦', label: 'Stupade', value: fmtInt(s.soldiersLost) },
  ];
  const byQuality = QUALITY_IDS.map((q) => ({ q, n: s.weaponsByQuality[q] })).filter((x) => x.n > 0).reverse();
  return (
    <Panel title="Statistik">
      <dl className="stat-grid">
        {tiles.map((t) => (
          <div key={t.label} className="stat-tile">
            <dt><span aria-hidden>{t.icon}</span> {t.label}</dt>
            <dd>{t.value}</dd>
          </div>
        ))}
      </dl>
      {s.weaponsCrafted > 0 && (
        <div className="stat-forge">
          <span className="small"><span aria-hidden>⚒️</span> {fmtInt(s.weaponsCrafted)} vapen smidda</span>
          <span className="equip__pills">
            {byQuality.map(({ q, n }) => (
              <span key={q} className={`qpill ${RARE.has(q) ? 'qpill--rare' : ''}`} style={{ ['--q' as string]: QUALITY_COLOR[q] }} title={qualityName(q)}>
                {fmtInt(n)}
              </span>
            ))}
          </span>
        </div>
      )}
    </Panel>
  );
}

export function Chronicle({ state, log }: { state: GameState; log: GameEvent[] }) {
  const entries = log.map((e) => ({ e, text: eventText(e, state) })).filter((x) => x.text);
  return (
    <>
      <Stats state={state} />
      <Panel title="Krönika" className="chronicle">
        {entries.length === 0 ? (
          <p className="muted small">Inget har hänt än. Ge dina trupper order.</p>
        ) : (
          <ol className="chronicle__list">
            {entries.map(({ e, text }, i) => (
              <li key={i}>
                <time className="chronicle__time">{fmtClock(e.at)}</time> {text}
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </>
  );
}
