import { content } from '../../content';
import { troopCap, type LabourActivity, type RaceDef } from '../../core';
import { useStore } from '../game';
import { ACTIVITY_LABEL, TRAIT_LABEL } from '../labels';

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
  const fractions = content.constants.capLevelFractions;
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
            <h2 className="race-card__name">{r.name}</h2>
            <p className="race-card__flavour">{FLAVOUR[r.id]}</p>
            <dl className="race-card__stats">
              <div><dt>Första truppen</dt><dd>{r.population.startSize} soldater</dd></div>
              <div><dt>Max per trupp</dt><dd>{r.population.maxTroopSize}</dd></div>
              <div><dt>Startgräns</dt><dd>{troopCap(r.population.maxTroopSize, 0, fractions)}</dd></div>
              <div><dt>Styrka/soldat</dt><dd>{r.soldier.attack}</dd></div>
              <div><dt>Bäst på</dt><dd>{bestSkills(r)}</dd></div>
            </dl>
            {r.traits.length > 0 && (
              <ul className="race-card__traits">
                {r.traits.map((t) => <li key={t}>{TRAIT_LABEL[t]}</li>)}
              </ul>
            )}
            {r.playable ? (
              <button className="btn btn--primary btn--block" onClick={() => store.startNewGame(r.id)}>
                Spela som {r.name.toLowerCase()}
              </button>
            ) : (
              <button className="btn btn--block" disabled>🔒 Kommer senare</button>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
