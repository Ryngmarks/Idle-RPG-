// Balance simulator CLI.
//   npm run sim                         → all playable races × all strategies, summary
//   npm run sim -- --race orcs --log    → one race, full milestone log and snapshots
// Options: --race <id> --strategy balanced|economy --minutes <n> --tick <sec> --log

import { content } from '../../src/content';
import { newGame } from '../../src/core';
import { runBot, type RunResult, type Strategy } from './bot';

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const showLog = args.includes('--log');
const minutes = Number(opt('minutes') ?? 180);
const tick = Number(opt('tick') ?? 5);
const races = opt('race') ? [opt('race')!] : Object.values(content.races).filter((r) => r.playable).map((r) => r.id);
const strategies: Strategy[] = opt('strategy') ? [opt('strategy') as Strategy] : ['balanced', 'economy'];

const mmss = (t: number | undefined) =>
  t === undefined ? '  —  ' : `${String(Math.floor(t / 60)).padStart(2, ' ')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const r0 = (n: number) => String(Math.floor(n));

const results: { race: string; strategy: Strategy; res: RunResult }[] = [];

for (const race of races) {
  for (const strategy of strategies) {
    const res = runBot(newGame(race, content), content, {
      raceId: race,
      strategy,
      maxSeconds: minutes * 60,
      tickSeconds: tick,
      snapshotEverySeconds: 5 * 60,
    });
    results.push({ race, strategy, res });

    if (showLog) {
      console.log(`\n=== ${race.toUpperCase()} · ${strategy} ===`);
      for (const e of res.log) console.log(`${mmss(e.t)}  ${e.text}`);
      console.log('\n  time   stage        food   wood  stone    ore   troops');
      for (const s of res.snapshots) {
        const troops = s.troops.map((t) => `${t.name} ${t.size} L${t.level}${t.gear ? ' G' + t.gear : ''} ${t.activity ?? 'idle'}`).join(' | ');
        console.log(
          `${mmss(s.t)}  ${s.stage.padEnd(12)} ${r0(s.resources.food).padStart(5)} ${r0(s.resources.wood).padStart(6)} ${r0(s.resources.stone).padStart(6)} ${r0(s.resources.ore).padStart(6)}   ${troops}`,
        );
      }
    }
  }
}

// ------------------------------------------------------------------ summary
const KEYS: [string, string][] = [
  ['objective:wood60', 'Combat'],
  ['objective:recruit1', 'Recruit'],
  ['troop:troop2', 'Troop 2'],
  ['building:barracks:1', 'Barracks 1'],
  ['building:forge:1', 'Forge'],
  ['stage:3', 'Stage 3'],
  ['building:barracks:2', 'Barracks 2'],
  ['objective:zoneCleared', 'Zone clear'],
  ['boss', 'Boss'],
];

console.log(`\nMilestones (simulated time mm:ss, bot decides every ${tick}s, limit ${minutes} min)\n`);
console.log('race     strategy  ' + KEYS.map(([, label]) => label.padStart(11)).join(''));
for (const { race, strategy, res } of results) {
  console.log(`${race.padEnd(8)} ${strategy.padEnd(9)} ` + KEYS.map(([k]) => mmss(res.milestones[k]).padStart(11)).join(''));
}

console.log('\nShare of troop-time per activity\n');
console.log('race     strategy    combat  mining    wood    food   build    idle   soldiers@end');
for (const { race, strategy, res } of results) {
  const total = Object.values(res.activityTime).reduce((a, b) => a + b, 0) || 1;
  const pct = (k: keyof RunResult['activityTime']) => `${Math.round((100 * res.activityTime[k]) / total)}%`.padStart(8);
  const soldiers = res.finalState.troops.map((t) => t.size).join('+');
  console.log(
    `${race.padEnd(8)} ${strategy.padEnd(9)} ${pct('combat')}${pct('mining')}${pct('woodcutting')}${pct('food')}${pct('construction')}${pct('idle')}   ${soldiers}`,
  );
}
