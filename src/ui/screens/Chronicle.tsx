import type { GameEvent, GameState } from '../../core';
import { Panel } from '../components/common';
import { fmtClock } from '../format';
import { eventText } from '../labels';

export function Chronicle({ state, log }: { state: GameState; log: GameEvent[] }) {
  const entries = log.map((e) => ({ e, text: eventText(e, state) })).filter((x) => x.text);
  return (
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
  );
}
