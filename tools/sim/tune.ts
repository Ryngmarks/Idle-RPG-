import { content } from '../../src/content';
import { newGame } from '../../src/core';
import { runBot } from './bot';
const hm = (t: number | null | undefined) => (t == null ? '  -  ' : `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}`);
const out: Record<string, unknown> = {};
for (const race of ['humans', 'orcs']) {
  const res = runBot(newGame(race, content), content, { raceId: race, strategy: 'checkin', maxSeconds: 60 * 3600, tickSeconds: 5, snapshotEverySeconds: 3600, stopAtBoss: 8 });
  const row = (f: (i: number) => string) => Array.from({ length: 8 }, (_, i) => f(i).padStart(6)).join('');
  const st = (i: number) => res.bossStarts.filter((x) => x.boss === i + 1);
  const ok = (i: number) => st(i).find((x) => !x.failed) ?? st(i)[st(i).length - 1];
  const per: number[] = [];
  for (let l = 6; l <= 20; l++) if (res.levelTimes[l + 1] !== undefined && res.levelTimes[l] !== undefined) per.push(res.levelTimes[l + 1]! - res.levelTimes[l]!);
  per.sort((a, b) => a - b);
  out[race] = { t: res.bossTimes.map((x) => (x == null ? null : x / 3600)), sold: Array.from({ length: 8 }, (_, i) => ok(i)?.soldiers ?? 0), t2: Array.from({ length: 8 }, (_, i) => (ok(i) ? ok(i)!.t2Armed / Math.max(1, ok(i)!.armed) : 0)), tl: ok(7)?.troopLevel ?? 0, med: per[Math.floor(per.length / 2)]! / 60, end: res.finalState.clock / 3600, gap: res.longestEventGap(0, 1e9) };
  if (process.env.TUNE_JSON) continue;
  console.log(`${race.padEnd(6)} time ${row((i) => hm(res.bossTimes[i]))}  med ${(per[Math.floor(per.length / 2)]! / 60).toFixed(1)}`);
  console.log(`       sold ${row((i) => String(ok(i)?.soldiers ?? '-'))}`);
  console.log(`       grp  ${row((i) => String(ok(i)?.groups ?? '-'))}`);
  console.log(`       T2%  ${row((i) => (ok(i) && ok(i)!.armed ? Math.round((100 * ok(i)!.t2Armed) / ok(i)!.soldiers) + '' : '-'))}`);
  console.log(`       tLv  ${row((i) => String(ok(i)?.troopLevel ?? '-'))}`);
  console.log(`       tries${row((i) => String(st(i).length))}`);
  const lv = [10, 15, 20, 25, 30, 35, 40].map((l) => `L${l}@${hm(res.levelTimes[l])}`).join(' ');
  console.log(`       ${lv}`);
}

if (process.env.TUNE_JSON) console.log(JSON.stringify(out));
