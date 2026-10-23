import { content } from '../../src/content';
import { newGame } from '../../src/core';
import { runBot } from './bot';
const race = process.argv[2]!; const strat = (process.argv[3] ?? 'balanced') as any;
const r = runBot(newGame(race, content), content, { raceId: race, strategy: strat, maxSeconds: 90*60, tickSeconds: 5, snapshotEverySeconds: Number(process.argv[4] ?? 60) });
for (const s of r.snapshots) if (s.t>=13*60 && s.t<=22*60) console.log(Math.floor(s.t/60), JSON.stringify(s.resources), s.troops.map(t=>`${t.size}:${t.activity}`).join('|'));
