// Balance simulator CLI.
//   npm run sim                         → all playable races × all strategies, summary
//   npm run sim -- --race orcs --log    → one race, full milestone log and snapshots
//   npm run sim -- --strategy checkin   → the check-in player to level 40 (boss table); --hours <n> sets the horizon (default 40)
//   npm run sim -- --strategy balanced --hours 40 --stop 8   → the active bot to level 40 (slow: it acts every tick)
// Options: --race <id> --strategy balanced|economy|careless|feast|checkin --minutes <n> --hours <n> --stop <boss count> --tick <sec> --log

import { content } from '../../src/content';
import { averageWeaponPower, equippedCount, masteryLevel, newGame } from '../../src/core';
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
const strategies: Strategy[] = opt('strategy') ? [opt('strategy') as Strategy] : ['balanced', 'economy', 'careless', 'feast'];
const hours = opt('hours') ? Number(opt('hours')) : undefined;
const stopOpt = opt('stop') ? Number(opt('stop')) : undefined;
/** Runs that go past the first boss get the boss table instead of the first-hour tables. */
const isLong = (strategy: Strategy) => strategy === 'checkin' || hours !== undefined || (stopOpt ?? 1) > 1;

const mmss = (t: number | undefined) =>
  t === undefined ? '  —  ' : `${String(Math.floor(t / 60)).padStart(2, ' ')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const r0 = (n: number) => String(Math.floor(n));

const results: { race: string; strategy: Strategy; res: RunResult }[] = [];
const longResults: { race: string; strategy: Strategy; res: RunResult }[] = [];

for (const race of races) {
  for (const strategy of strategies) {
    const long = isLong(strategy);
    const res = runBot(newGame(race, content), content, {
      raceId: race,
      strategy,
      maxSeconds: long ? (hours ?? 40) * 3600 : minutes * 60,
      tickSeconds: tick,
      snapshotEverySeconds: long ? 3600 : 5 * 60,
      stopAtBoss: long ? (stopOpt ?? 8) : 1,
    });
    (long ? longResults : results).push({ race, strategy, res });

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

// A check-in run for each race after the default first-hour tables (npm run sim with no strategy).
if (!opt('strategy') && hours === undefined && stopOpt === undefined) {
  for (const race of races) {
    const res = runBot(newGame(race, content), content, { raceId: race, strategy: 'checkin', maxSeconds: 40 * 3600, tickSeconds: tick, snapshotEverySeconds: 3600, stopAtBoss: 8 });
    longResults.push({ race, strategy: 'checkin', res });
  }
}

// ------------------------------------------------------------------ summary
const KEYS: [string, string][] = [
  ['objective:wood60', 'Combat'],
  ['soldiers:2', 'Soldier 2'],
  ['troop:troop2', 'Group 2'],
  ['soldiers:3', 'Soldier 3'],
  ['soldiers:5', 'Soldier 5'],
  ['stage:3', 'Stage 3'],
  ['building:forge:1', 'Forge'],
  ['building:forge:2', 'Forge2'],
  ['objective:zoneCleared', 'Zone clear'],
  ['boss', 'Boss'],
];

const hm = (t: number | null | undefined) => (t == null ? '   -  ' : `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}`.padStart(6));
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : 0);

function printLong(race: string, strategy: Strategy, res: RunResult) {
  const bosses = content.zones[content.constants.startZoneId]!.bosses;
  console.log(`\n=== ${race} · ${strategy} to level ${bosses[bosses.length - 1]!.level} (game time h:mm) ===`);
  console.log('boss  level   time    gap   soldiers  groups  armed  T2 share  tries');
  let prev = 0;
  bosses.forEach((b, i) => {
    const t = res.bossTimes[i] ?? null;
    const starts = res.bossStarts.filter((x) => x.boss === i + 1);
    const ok = starts.find((x) => !x.failed) ?? starts[starts.length - 1];
    const gap = t == null ? null : t - prev;
    if (t != null) prev = t;
    const share = ok && ok.armed > 0 ? `${ok.t2Armed}/${ok.armed}` : '-';
    console.log(
      `${String(i + 1).padStart(4)}  ${String(b.level).padStart(5)} ${hm(t)} ${hm(gap)}  ${String(ok?.soldiers ?? '-').padStart(8)}  ${String(ok?.groups ?? '-').padStart(6)}  ${String(ok?.armed ?? '-').padStart(5)}  ${share.padStart(8)}  ${String(starts.length).padStart(5)}`,
    );
  });
  const per: number[] = [];
  for (let l = 6; l <= 20; l++) if (res.levelTimes[l + 1] !== undefined && res.levelTimes[l] !== undefined) per.push(res.levelTimes[l + 1]! - res.levelTimes[l]!);
  const last = res.bossTimes[bosses.length - 1];
  const s = res.finalState;
  console.log(`level 40 boss defeated: ${last == null ? 'not within the horizon (ended at ' + hm(s.clock) + ')' : hm(last)}; median time per level 6-20: ${(median(per) / 60).toFixed(1)} min; weapons crafted ${s.stats.weaponsCrafted}; longest event gap boss 10-40: ${res.longestEventGap(((res.bossTimes[1] ?? 0) / 60), (res.bossTimes[7] ?? s.clock) / 60).toFixed(0)} min`);
}
for (const { race, strategy, res } of longResults) printLong(race, strategy, res);

console.log(`\nMilestones (simulated time mm:ss, bot decides every ${tick}s, limit ${minutes} min)\n`);
console.log('race     strategy  ' + KEYS.map(([, label]) => label.padStart(11)).join(''));
for (const { race, strategy, res } of results) {
  console.log(`${race.padEnd(8)} ${strategy.padEnd(9)} ` + KEYS.map(([k]) => mmss(res.milestones[k]).padStart(11)).join(''));
}

console.log('\nForge at the end (weapons crafted · armed soldiers · avg weapon power · mastery · quality mix N/G/O/E/M)\n');
for (const { race, strategy, res } of results) {
  const s = res.finalState;
  const soldiers = s.troops.reduce((n, t) => n + t.size, 0);
  const armed = s.troops.reduce((n, t) => n + equippedCount(t), 0);
  const power = soldiers ? s.troops.reduce((p, t) => p + averageWeaponPower(t, content) * t.size, 0) / soldiers : 1;
  const mk = Object.keys(s.crafting.crafted)[0];
  const mastery = mk ? masteryLevel(s.crafting.crafted[mk]!, content) : 0;
  const mix = ['normal', 'good', 'outstanding', 'excellent', 'masterpiece'].map((q) =>
    s.troops.reduce((n, t) => n + t.equipment.filter((b) => b.quality === q).reduce((m, b) => m + b.count, 0), 0) +
    Object.entries(s.armoury).filter(([k]) => k.endsWith(':' + q)).reduce((m, [, v]) => m + v, 0));
  console.log(`${race.padEnd(8)} ${strategy.padEnd(9)} gap15-45 ${res.longestEventGap(15, 45).toFixed(1)}m · ${String(s.stats.weaponsCrafted).padStart(5)} crafted · ${armed}/${soldiers} armed · ×${power.toFixed(2)} · mastery ${mastery} · ${mix.join('/')}`);
}

console.log('\nSoldiers at 15 / 30 / 40 min\n');
for (const { race, strategy, res } of results) {
  const at = (m: number) => {
    const snap = res.snapshots.find((x) => x.t >= m * 60 - 1e-6) ?? res.snapshots[res.snapshots.length - 1]!;
    return snap.troops.reduce((n, t) => n + t.size, 0);
  };
  console.log(`${race.padEnd(8)} ${strategy.padEnd(9)} ${at(15)} / ${at(30)} / ${at(40)}`);
}

console.log('\nShare of troop-time per activity\n');
console.log('race     strategy    combat  mining    wood    food   build   smith    idle   soldiers@end   hungry total / longest');
for (const { race, strategy, res } of results) {
  const total = Object.values(res.activityTime).reduce((a, b) => a + b, 0) || 1;
  const pct = (k: keyof RunResult['activityTime']) => `${Math.round((100 * res.activityTime[k]) / total)}%`.padStart(8);
  const soldiers = res.finalState.troops.map((t) => t.size).join('+');
  console.log(
    `${race.padEnd(8)} ${strategy.padEnd(9)} ${pct('combat')}${pct('mining')}${pct('woodcutting')}${pct('food')}${pct('construction')}${pct('smithing')}${pct('idle')}   ${soldiers.padEnd(12)} ${(res.hungrySec / 60).toFixed(1)}m / ${res.longestHungrySec}s`,
  );
}
