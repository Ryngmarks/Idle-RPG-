import { content } from '../../content';
import type { LabourActivity, RaceDef } from '../../core';
import { RaceEmblem } from '../art';
import { Icon } from '../art/icons';
import { useStore } from '../game';
import { ACTIVITY_LABEL, traitText } from '../labels';

const FLAVOUR: Record<string, string> = {
  humans: 'Anpassningsbara kungariken. Stadiga arméer och den bästa matförsörjningen.',
  orcs: 'Ändlösa krigshorder. Många, billiga och hungriga, men starka vedhuggare.',
  dwarves: 'Bergsfästen, tunga krigare och mästerliga gruvor.',
  elves: 'Uråldriga skogar, få men precisa krigare.',
};

function bestSkills(r: RaceDef): string {
  const skills = Object.entries(r.soldier.skills) as [LabourActivity, number][];
  const top = [...skills].sort((a, b) => b[1] - a[1]).slice(0, 2);
  return top.map(([a]) => ACTIVITY_LABEL[a].name).join(' och ');
}

export function RaceSelect() {
  const store = useStore();
  return (
    <main className="race-select">
      <header className="race-select__head">
        <p className="eyebrow">En utpost i utkanten av kungariket</p>
        <h1 className="title">Välj ditt folk</h1>
        <p className="muted">Ditt folk avgör hur stora dina trupper blir och vad de är bra på.</p>
      </header>
      <div className="race-grid">
        {Object.values(content.races).map((r) => (
          <article key={r.id} className={`race-card ${r.playable ? '' : 'race-card--locked'}`}>
            <header className="race-card__head">
              <RaceEmblem raceId={r.id} size={88} />
              {!r.playable && <span className="race-card__lock"><Icon name="lock" size={22} /></span>}
              <h2 className="race-card__name">{r.name}</h2>
            </header>
            <p className="race-card__flavour">{FLAVOUR[r.id]}</p>
            <ul className="race-chips" aria-label="Nyckeltal">
              <li className="race-chip" title="Första truppen"><Icon name="soldier" size={20} />{r.population.startSize} <small>soldater</small></li>
              <li className="race-chip" title="Max per trupp"><Icon name="flag" size={20} />{r.population.maxTroopSize} <small>max</small></li>
              <li className="race-chip" title="Sängar från start"><Icon name="tent" size={20} />{r.population.startBeds} <small>sängar</small></li>
              <li className="race-chip" title="Styrka per soldat"><Icon name="strength" size={20} />{r.soldier.attack} <small>styrka</small></li>
              <li className="race-chip" title="Bäst på"><Icon name="star" size={20} />{bestSkills(r)}</li>
            </ul>
            {r.traits.length > 0 && (
              <ul className="race-card__traits">
                {r.traits.map((t) => <li key={t}>{traitText(r, t)}</li>)}
              </ul>
            )}
            {r.playable ? (
              <button className="btn btn--primary btn--block" onClick={() => store.startNewGame(r.id)}>
                Spela som {r.name.toLowerCase()}
              </button>
            ) : (
              <button className="btn btn--block" disabled><Icon name="lock" size={18} /> Kommer senare</button>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
