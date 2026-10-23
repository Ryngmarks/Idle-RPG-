import { content } from '../../content';
import { QUALITY_IDS, zone, type GameEvent, type GameState } from '../../core';
import { Icon, type UiIconName } from '../art/icons';
import { Panel } from '../components/common';
import { RARE } from '../components/equipment';
import { fmtClock, fmtInt } from '../format';
import { QUALITY_COLOR, eventText, qualityName } from '../labels';

function Stats({ state }: { state: GameState }) {
  const bossTotal = zone(state, content).bosses.length;
  const s = state.stats;
  const soldiers = state.troops.reduce((n, t) => n + t.size, 0);
  const tiles = [
    { icon: 'clock' as UiIconName, label: 'Speltid', value: fmtClock(state.clock) },
    { icon: 'crown' as UiIconName, label: 'Bossar', value: `${s.bossTimes.filter((t) => t !== null).length} / ${bossTotal}` },
    { icon: 'swords' as UiIconName, label: 'Besegrade', value: fmtInt(s.totalKills) },
    { icon: 'shield' as UiIconName, label: 'Soldater', value: fmtInt(soldiers) },
    { icon: 'horn' as UiIconName, label: 'Rekryterade', value: fmtInt(s.recruited) },
    { icon: 'skull' as UiIconName, label: 'Stupade', value: fmtInt(s.soldiersLost) },
  ];
  const byQuality = QUALITY_IDS.map((q) => ({ q, n: s.weaponsByQuality[q] })).filter((x) => x.n > 0).reverse();
  return (
    <Panel icon="star" title="Statistik">
      <dl className="stat-grid">
        {tiles.map((t) => (
          <div key={t.label} className="stat-tile">
            <dt><Icon name={t.icon} size={18} /> {t.label}</dt>
            <dd>{t.value}</dd>
          </div>
        ))}
      </dl>
      {s.weaponsCrafted > 0 && (
        <div className="stat-forge">
          <span className="small"><Icon name="anvil" size={18} /> {fmtInt(s.weaponsCrafted)} vapen smidda</span>
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
      <Panel icon="book" title="Krönika" className="chronicle">
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
