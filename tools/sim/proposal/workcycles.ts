// PROPOSAL PROTOTYPE. Not used by the game. A standalone model of the work-cycle economy in
// docs/PROGRESSION_V2.md, to check that its timeline holds before any game code changes.
// Run: npx tsx tools/sim/proposal/workcycles.ts [humans|orcs]

type Res = 'food' | 'wood' | 'stone' | 'ore';
type Cost = Partial<Record<Res, number>>;
type Activity = 'wood' | 'stone' | 'ore' | 'forage' | 'field' | 'build' | 'smith' | 'combat' | 'idle';

// ------------------------------------------------------------------ proposed content

/** A work site: `cap` soldiers can work it in parallel; each completes a cycle every `sec` seconds. */
const SITES: Record<'wood' | 'stone' | 'ore' | 'forage' | 'field', { cap: number; sec: number; yield: Cost; skill: Skill }> = {
  wood: { cap: 3, sec: 30, yield: { wood: 5 }, skill: 'wood' }, // fell a tree
  stone: { cap: 2, sec: 40, yield: { stone: 4 }, skill: 'mining' }, // break a block in the old quarry
  ore: { cap: 1, sec: 60, yield: { ore: 2 }, skill: 'mining' }, // work an ore vein
  forage: { cap: 2, sec: 20, yield: { food: 2 }, skill: 'food' }, // berries and roots
  field: { cap: 3, sec: 60, yield: { food: 9 }, skill: 'food' }, // farm plots (after the Farm)
};
type Skill = 'wood' | 'mining' | 'food' | 'build' | 'smith';

const RACES = {
  humans: { atk: 1, hp: 10, skills: { wood: 1, mining: 1, food: 1.4, build: 1.2, smith: 1 }, startBeds: 2, bedsPerTent: 1, foodMult: 1, timeMult: 1 },
  orcs: { atk: 0.75, hp: 8, skills: { wood: 1.3, mining: 1, food: 0.8, build: 0.9, smith: 0.7 }, startBeds: 3, bedsPerTent: 2, foodMult: 0.6, timeMult: 0.6 },
} as const;
type RaceId = keyof typeof RACES;

/** Construction: materials up front, then `moments` of 30 s work each; at most 3 builders. */
const BUILD_MOMENT = 30;
const BUILDERS_CAP = 3;
const BUILDINGS: Record<string, { cost: Cost; moments: number }> = {
  tent1: { cost: { wood: 25, stone: 10 }, moments: 2 },
  trainingCamp: { cost: { wood: 40, stone: 25, food: 20 }, moments: 6 },
  tent2: { cost: { wood: 45, stone: 25 }, moments: 3 },
  farm: { cost: { wood: 60, stone: 30 }, moments: 6 },
  forge: { cost: { wood: 50, stone: 50, ore: 6 }, moments: 8 },
  tent3: { cost: { wood: 80, stone: 50 }, moments: 4 },
};
const UPGRADES: Record<string, Cost> = {
  sharpenedAxes: { wood: 15 }, // tree cycle ×0.67
  drill: { food: 20, wood: 20 }, // attack ×1.25
  stonePicks: { wood: 30, stone: 15 }, // stone and ore cycles ×0.75
};

/** The k-th trained soldier (k = soldiers already owned + 1). Food and training time both rise. */
const trainFood = (k: number) => Math.round(20 * Math.pow(1.5, k - 3));
const trainSec = (k: number) => Math.round(90 * Math.pow(1.35, k - 3));

const ENEMIES = [
  { name: 'Vild kyckling', hp: 12, armour: 0, kills: 12, loot: { food: 2 }, xp: 3 },
  { name: 'Arg tupp', hp: 25, armour: 0, kills: 12, loot: { food: 3 }, xp: 5 },
  { name: 'Räv', hp: 45, armour: 1, kills: 12, loot: { food: 3 }, xp: 8 },
  { name: 'Vildsvin', hp: 80, armour: 2, kills: 12, loot: { food: 5, ore: 1 }, xp: 12 },
  { name: 'Gammal galt', hp: 130, armour: 3, kills: 12, loot: { food: 6, ore: 2 }, xp: 18 },
];
const BOSS = { hp: 500, armour: 3, limit: 90 };
const SWORD = { ore: 2, sec: 60, power: 1.25 };
const xpForLevel = (l: number) => 25 * Math.pow(l - 1, 1.7);
/** XP per finished work cycle (combat XP comes from kills). */
const WORK_XP = 2;

// ------------------------------------------------------------------ state

interface Group { id: number; soldiers: number; activity: Activity; xp: number; armed: number }
interface State {
  t: number;
  res: Record<Res, number>;
  groups: Group[];
  groupSlots: number;
  beds: number;
  built: Set<string>;
  upgrades: Set<string>;
  building: { id: string; workLeft: number } | null;
  training: { secLeft: number } | null;
  stage: number; // index of the frontier stage
  kills: number;
  bossDown: boolean;
  swordsQueued: number;
  smithProgress: number;
  armoury: number;
  progress: Partial<Record<Activity, number>>; // fractional cycles in progress, per site
  log: string[];
  combatUnlocked: boolean;
  woodTotal: number;
}

const race = (process.argv[2] ?? 'humans') as RaceId;
const R = RACES[race];

function soldiers(s: State) {
  return s.groups.reduce((n, g) => n + g.soldiers, 0);
}
function level(g: Group) {
  let l = 1;
  while (g.xp >= xpForLevel(l + 1)) l++;
  return l;
}
function afford(s: State, c: Cost) {
  return (Object.entries(c) as [Res, number][]).every(([r, v]) => s.res[r] >= v);
}
function pay(s: State, c: Cost) {
  for (const [r, v] of Object.entries(c) as [Res, number][]) s.res[r] -= v;
}
function note(s: State, text: string) {
  const m = Math.floor(s.t / 60), sec = Math.floor(s.t % 60);
  s.log.push(`${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}  ${text}`);
}

/** Damage per second of a group against an armour value: atk²/(atk+armour) per soldier. */
function groupDps(s: State, g: Group, armour: number) {
  const base = R.atk * (1 + 0.1 * (level(g) - 1)) * (s.upgrades.has('drill') ? 1.25 : 1);
  const per = (a: number) => (a * a) / (a + armour);
  const armed = Math.min(g.armed, g.soldiers);
  return armed * per(base * SWORD.power) + (g.soldiers - armed) * per(base);
}

// ------------------------------------------------------------------ one second of game time

function tick(s: State) {
  s.t += 1;
  // Work sites are shared: groups fill a site's capacity in order; extra soldiers do nothing.
  const used: Partial<Record<Activity, number>> = {};
  for (const g of s.groups) {
    const a = g.activity;
    if (a in SITES) {
      const site = SITES[a as keyof typeof SITES];
      const working = Math.min(g.soldiers, site.cap - (used[a] ?? 0));
      used[a] = (used[a] ?? 0) + working;
      const cycleSec = site.sec * cycleMult(s, a) / R.skills[site.skill];
      s.progress[a] = (s.progress[a] ?? 0) + working / cycleSec;
      while ((s.progress[a] ?? 0) >= 1) {
        s.progress[a]! -= 1;
        g.xp += WORK_XP; // every finished cycle teaches the group a little
        for (const [r, v] of Object.entries(site.yield) as [Res, number][]) {
          s.res[r] += v;
          if (r === 'wood') s.woodTotal += v;
        }
      }
    } else if (a === 'build' && s.building) {
      const builders = Math.min(g.soldiers, BUILDERS_CAP - (used.build ?? 0));
      used.build = (used.build ?? 0) + builders;
      s.building.workLeft -= builders * R.skills.build;
      g.xp += (builders * R.skills.build * WORK_XP) / BUILD_MOMENT;
      if (s.building.workLeft <= 0) {
        s.built.add(s.building.id);
        note(s, `🏗️  ${s.building.id} klar`);
        if (s.building.id.startsWith('tent')) s.beds += R.bedsPerTent;
        if (s.building.id === 'trainingCamp') { s.groupSlots += 1; s.beds += 1; }
        s.building = null;
      }
    } else if (a === 'smith' && s.swordsQueued > 0) {
      const smiths = Math.min(g.soldiers, 1 - (used.smith ?? 0)); // one anvil
      used.smith = (used.smith ?? 0) + smiths;
      s.smithProgress += (smiths * R.skills.smith) / SWORD.sec;
      if (s.smithProgress >= 1) { s.smithProgress -= 1; s.swordsQueued -= 1; s.armoury += 1; }
    } else if (a === 'combat' && !s.bossDown) {
      // After the last stage the troops keep hunting it (loot and XP) until the boss can fall.
      const e = ENEMIES[Math.min(s.stage, ENEMIES.length - 1)]!;
      const kps = groupDps(s, g, e.armour) / e.hp;
      s.kills += kps;
      g.xp += kps * e.xp;
      for (const [r, v] of Object.entries(e.loot) as [Res, number][]) s.res[r] += v * kps;
      if (s.stage < ENEMIES.length && s.kills >= e.kills) {
        s.kills = 0;
        s.stage += 1;
        note(s, `⚔️  steg ${s.stage} rensat (${e.name})`);
        if (s.stage === 1) rescue(s, 1, 'En vilsen bonddräng ansluter');
      }
    }
  }
  // Training: one recruit at a time at the training camp.
  if (s.training) {
    s.training.secLeft -= 1;
    if (s.training.secLeft <= 0) {
      s.training = null;
      const g = [...s.groups].sort((a, b) => a.soldiers - b.soldiers)[0]!;
      g.soldiers += 1;
      note(s, `🛡️  rekryt utbildad → ${soldiers(s)} soldater`);
    }
  }
  // Auto-equip.
  for (const g of s.groups) {
    const take = Math.min(s.armoury, g.soldiers - g.armed);
    g.armed += take;
    s.armoury -= take;
  }
}

function cycleMult(s: State, a: Activity) {
  if (a === 'wood' && s.upgrades.has('sharpenedAxes')) return 0.67;
  if ((a === 'stone' || a === 'ore') && s.upgrades.has('stonePicks')) return 0.75;
  return 1;
}

function rescue(s: State, n: number, why: string) {
  s.groups[0]!.soldiers += n;
  note(s, `✨ ${why} → ${soldiers(s)} soldater`);
}

// ------------------------------------------------------------------ a careful active player

const PLAN: { kind: 'upgrade' | 'build'; id: string; after?: (s: State) => boolean }[] = [
  { kind: 'upgrade', id: 'sharpenedAxes' },
  { kind: 'upgrade', id: 'drill', after: (s) => s.combatUnlocked },
  { kind: 'build', id: 'tent1', after: (s) => s.stage >= 1 },
  { kind: 'upgrade', id: 'stonePicks' },
  { kind: 'build', id: 'trainingCamp' },
  { kind: 'build', id: 'tent2' },
  { kind: 'build', id: 'farm' },
  { kind: 'build', id: 'forge' },
  { kind: 'build', id: 'tent3' },
];

function decide(s: State) {
  if (!s.combatUnlocked && s.woodTotal >= 30) { s.combatUnlocked = true; note(s, '🔓 strid upplåst'); }
  // Buy the next plan step when affordable.
  const next = PLAN.find((p) => (p.kind === 'upgrade' ? !s.upgrades.has(p.id) : !s.built.has(p.id) && s.building?.id !== p.id) && (!p.after || p.after(s)));
  let want: Cost = {};
  if (next) {
    const cost = next.kind === 'upgrade' ? UPGRADES[next.id]! : BUILDINGS[next.id]!.cost;
    if (afford(s, cost) && (next.kind === 'upgrade' || !s.building)) {
      pay(s, cost);
      if (next.kind === 'upgrade') { s.upgrades.add(next.id); note(s, `📜 ${next.id}`); }
      else s.building = { id: next.id, workLeft: BUILDINGS[next.id]!.moments * BUILD_MOMENT };
    } else want = cost;
  }
  // Train a recruit when there is a free bed and food to spare.
  const k = soldiers(s) + 1;
  if (s.built.has('trainingCamp') && !s.training && soldiers(s) < s.beds) {
    const f = trainFood(k) * R.foodMult;
    if (s.res.food >= f + (want.food ?? 0)) {
      s.res.food -= f;
      s.training = { secLeft: trainSec(k) * R.timeMult };
      note(s, `⏳ utbildar soldat ${k} (${Math.round(f)} mat, ${Math.round(trainSec(k) * R.timeMult)} s)`);
    } else want = { ...want, food: (want.food ?? 0) + f };
  }
  // Swords for unarmed soldiers.
  if (s.built.has('forge')) {
    const unarmed = soldiers(s) - s.groups.reduce((n, g) => n + g.armed, 0) - s.armoury - s.swordsQueued;
    if (unarmed > 0 && s.res.ore >= SWORD.ore + (want.ore ?? 0)) { s.res.ore -= SWORD.ore; s.swordsQueued += 1; }
    else if (unarmed > 0) want = { ...want, ore: (want.ore ?? 0) + SWORD.ore };
  }
  // Boss when the estimate says it falls in time.
  const bossReady = s.stage >= ENEMIES.length && !s.bossDown;
  if (bossReady) {
    const dps = s.groups.reduce((n, g) => n + groupDps(s, g, BOSS.armour), 0);
    if (dps * BOSS.limit >= BOSS.hp) {
      s.bossDown = true;
      note(s, `👑 Gamle Betarn fälld (${dps.toFixed(1)} dps)`);
      // Reward: two freed prisoners form a new troop group of their own.
      s.groupSlots += 1;
      s.groups.push({ id: s.groups.length + 1, soldiers: 2, activity: 'idle', xp: 0, armed: 0 });
      note(s, `✨ Två fångar befriade och bildar truppgrupp ${s.groups.length} → ${soldiers(s)} soldater`);
    }
  }
  // Open a new group when a slot is free and a group has 2+ soldiers to split off.
  if (s.groups.length < s.groupSlots) {
    const big = s.groups.find((g) => g.soldiers >= 2);
    if (big) { big.soldiers -= 1; s.groups.push({ id: s.groups.length + 1, soldiers: 1, activity: 'idle', xp: 0, armed: 0 }); note(s, `👥 truppgrupp ${s.groups.length} bildad`); }
  }
  assign(s, want);
}

function assign(s: State, want: Cost) {
  const missing = (Object.entries(want) as [Res, number][]).filter(([r, v]) => s.res[r] < v).map(([r]) => r);
  const gather = (r: Res): Activity => (r === 'wood' ? 'wood' : r === 'stone' ? 'stone' : r === 'ore' ? 'ore' : s.built.has('farm') ? 'field' : 'forage');
  const fight = s.combatUnlocked && !s.bossDown;
  // Economy jobs in order of urgency; the rarest missing material first.
  const scarcity = (r: Res) => (want[r]! - s.res[r]) / Math.max(0.01, SITES[gather(r) as keyof typeof SITES].yield[r]! / SITES[gather(r) as keyof typeof SITES].sec);
  const econ: Activity[] = [];
  if (s.building) econ.push('build');
  if (s.swordsQueued > 0) econ.push('smith');
  for (const r of [...missing].sort((a, b) => scarcity(b) - scarcity(a))) econ.push(gather(r));
  const ordered = [...s.groups].sort((a, b) => b.soldiers - a.soldiers);
  if (ordered.length === 1) {
    // Alone: rescue the first companion, then follow the most urgent need and fight when nothing is missing.
    const g = ordered[0]!;
    g.activity = fight && (s.stage === 0 || econ.length === 0) ? 'combat' : (econ[0] ?? (fight ? 'combat' : 'wood'));
    return;
  }
  // Several groups: the strongest fights while the others build, smith and gather.
  const jobs: Activity[] = fight ? ['combat', ...econ] : econ;
  ordered.forEach((g, i) => (g.activity = jobs[i] ?? (fight ? 'combat' : s.bossDown ? 'idle' : 'forage')));
}

// ------------------------------------------------------------------ run

const s: State = {
  t: 0, res: { food: 0, wood: 0, stone: 0, ore: 0 }, groups: [{ id: 1, soldiers: 1, activity: 'wood', xp: 0, armed: 0 }],
  groupSlots: 1, beds: R.startBeds, built: new Set(), upgrades: new Set(), building: null, training: null,
  stage: 0, kills: 0, bossDown: false, swordsQueued: 0, smithProgress: 0, armoury: 0, progress: {}, log: [], combatUnlocked: false, woodTotal: 0,
};
const checkpoints = [5, 10, 15, 20, 30, 40, 50, 60].map((m) => m * 60);
const rows: string[] = [];
const time: Record<string, number> = {};
for (let i = 0; i < 90 * 60; i++) {
  if (i % 5 === 0) decide(s);
  tick(s);
  if (!s.bossDown) for (const g of s.groups) time[g.activity] = (time[g.activity] ?? 0) + g.soldiers;
  if (checkpoints.includes(s.t)) {
    rows.push(
      `${String(s.t / 60).padStart(3)} min | soldater ${soldiers(s)} i ${s.groups.length} grupper (${s.groups.map((g) => `${g.soldiers}:${g.activity}`).join(', ')}) | ` +
        `steg ${s.stage}/5${s.bossDown ? ' boss✓' : ''} | beväpnade ${s.groups.reduce((n, g) => n + g.armed, 0)} | Nv ${s.groups.map(level).join('/')} | ` +
        `ved ${Math.floor(s.res.wood)} sten ${Math.floor(s.res.stone)} malm ${Math.floor(s.res.ore)} mat ${Math.floor(s.res.food)}`,
    );
  }
}
console.log(`== ${race}: händelser ==`);
console.log(s.log.slice(0, 60).join('\n'));
console.log(`\n== ${race}: läget ==`);
console.log(rows.join('\n'));
const total = Object.values(time).reduce((a, b) => a + b, 0);
console.log(`\nAndel soldattid fram till bossen: ${Object.entries(time).map(([a, v]) => `${a} ${Math.round((100 * v) / total)}%`).join(' · ')}`);
