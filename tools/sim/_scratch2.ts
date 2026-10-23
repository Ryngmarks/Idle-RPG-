import { content } from '../../src/content';
import { newGame } from '../../src/core';
import { runBot } from './bot';
const out: string[] = [];
for (const race of ['humans','orcs']) {
  const res: any = {};
  for (const strat of ['balanced','feast'] as const) {
    const r = runBot(newGame(race, content), content, { raceId: race, strategy: strat, maxSeconds: 90*60, tickSeconds: 5, snapshotEverySeconds: 300 });
    const tot = (['combat','mining','woodcutting','food','construction'] as const).reduce((n,a)=>n+r.activityTime[a],0);
    res[strat]=r;
    const sold=(m:number)=>{const s=r.snapshots.find(x=>x.t>=m*60-1e-6)??r.snapshots.at(-1)!;return s.troops.reduce((n,t)=>n+t.size,0)};
    // gap bounds
    const pts=[900,...r.eventTimes.filter(t=>t>900&&t<2700).sort((a,b)=>a-b),2700]; let g=0,gi=0; for(let i=1;i<pts.length;i++) if(pts[i]-pts[i-1]>g){g=pts[i]-pts[i-1];gi=i}
    const m=(t:number)=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
    out.push(`${race} ${strat} boss ${m(r.milestones.boss)} sold ${sold(15)}/${sold(30)}/${sold(40)} gap ${(g/60).toFixed(2)} [${m(pts[gi-1])}..${m(pts[gi])}] food ${(100*r.activityTime.food/tot).toFixed(2)}% raid1 ${m(r.milestones['objective:raid1'])} raid2 ${m(r.milestones['objective:raid2'])} tent2 ${m(r.milestones['objective:tent2'])}`);
  }
  out.push(`  feast gain ${(100*(1-res.feast.milestones.boss/res.balanced.milestones.boss)).toFixed(2)}%`);
}
console.log(out.join('\n'));
