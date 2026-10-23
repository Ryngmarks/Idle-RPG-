// Scripted players for the balance simulator. They only use the public core API,
// exactly like the UI will. See docs/ROADMAP.md §3.

import {
  ACTIVITIES,
  advance,
  computeRates,
  currentCap,
  dispatch,
  estimatedBossDamage,
  averageWeaponPower,
  craftCost,
  equippedCount,
  maxCraftable,
  recipeAvailable,
  maxRecruitable,
  recruitCost,
  stageSafety,
  troopStats,
  type ActivityKind,
  type Command,
  type Content,
  type Cost,
  type GameEvent,
  type GameState,
  type ResourceId,
} from '../../src/core';

export type Strategy = 'balanced' | 'economy';

type Wish =
  | { kind: 'upgrade'; id: string }
  | { kind: 'building'; id: string; level: number };

/** What a sensible player works towards in P0, in priority order. */
const WISHLIST: Wish[] = [
  { kind: 'upgrade', id: 'sharpenedAxes' },
  { kind: 'building', id: 'trainingCamp', level: 1 },
  { kind: 'upgrade', id: 'drillPractice' },
  { kind: 'upgrade', id: 'stonePicks' },
  { kind: 'building', id: 'barracks', level: 1 },
  { kind: 'building', id: 'forge', level: 1 },
  { kind: 'upgrade', id: 'carpentry' },
  { kind: 'building', id: 'farm', level: 1 },
  { kind: 'upgrade', id: 'fieldKitchens' },
  { kind: 'building', id: 'barracks', level: 2 },
];

export interface LogEntry {
  t: number;
  text: string;
}

export interface Snapshot {
  t: number;
  troops: { name: string; size: number; level: number; activity: ActivityKind | null; gear: number; armed: number }[];
  resources: Record<ResourceId, number>;
  stage: string;
  buildings: Record<string, number>;
}

export interface RunResult {
  log: LogEntry[];
  snapshots: Snapshot[];
  milestones: Record<string, number>;
  /** Troop-seconds spent per activity. */
  activityTime: Record<ActivityKind | 'idle', number>;
  finalState: GameState;
}

export interface RunOptions {
  raceId: string;
  strategy: Strategy;
  maxSeconds: number;
  tickSeconds: number;
  snapshotEverySeconds: number;
}

export function runBot(start: GameState, content: Content, opts: RunOptions): RunResult {
  let state = start;
  const log: LogEntry[] = [];
  const snapshots: Snapshot[] = [];
  const milestones: Record<string, number> = {};
  const activityTime = { combat: 0, mining: 0, woodcutting: 0, food: 0, construction: 0, idle: 0 };
  let nextSnapshot = 0;

  const note = (events: GameEvent[]) => {
    for (const e of events) {
      const key = describeEvent(e, state, content);
      if (!key) continue;
      log.push({ t: e.at, text: key.text });
      if (key.milestone && milestones[key.milestone] === undefined) milestones[key.milestone] = e.at;
    }
  };
  const exec = (cmd: Command): boolean => {
    const r = dispatch(state, cmd, content);
    if (!r.ok) return false;
    state = r.state;
    note(r.events);
    return true;
  };

  while (state.clock < opts.maxSeconds && !state.combat.bossDefeated) {
    if (state.clock >= nextSnapshot) {
      snapshots.push(snapshot(state, content));
      nextSnapshot += opts.snapshotEverySeconds;
    }
    decide(state, content, opts.strategy, exec, () => state);
    for (const t of state.troops) activityTime[t.activity ?? 'idle'] += opts.tickSeconds;
    const r = advance(state, opts.tickSeconds, content);
    state = r.state;
    note(r.events);
  }
  snapshots.push(snapshot(state, content));
  return { log, snapshots, milestones, activityTime, finalState: state };
}

// ------------------------------------------------------------------ decisions

function decide(
  initial: GameState,
  content: Content,
  strategy: Strategy,
  exec: (cmd: Command) => boolean,
  current: () => GameState,
): void {
  let state = initial;
  const refresh = () => (state = current());

  // 1. Boss: commit everyone when the estimate says we win comfortably.
  if (state.combat.boss) {
    for (const t of state.troops) if (t.activity !== 'combat') exec({ type: 'assignTroop', troopId: t.id, activity: 'combat' });
    return;
  }
  if (state.unlocks.includes('boss') && !state.combat.bossDefeated) {
    const est = estimatedBossDamage(state, content, state.troops.map((t) => t.id));
    if (est.damage >= est.hp * 1.05) {
      for (const t of state.troops) exec({ type: 'assignTroop', troopId: t.id, activity: 'combat' });
      exec({ type: 'challengeBoss' });
      return;
    }
  }

  // 2. The tutorial asks for one recruit; do it as soon as possible.
  if (state.unlocks.includes('recruit') && state.stats.recruited === 0) {
    exec({ type: 'recruit', troopId: state.troops[0]!.id, count: 1 });
    refresh();
  }

  // 3. Buy the current wish if affordable.
  let wish = currentWish(state, content);
  if (wish && tryBuy(wish, state, content, exec)) {
    refresh();
    wish = currentWish(state, content);
  }

  // 3b. Forge: keep a small order going until every soldier is armed, then keep smithing for quality
  // with spare ore; re-arm troops whenever the armoury has something better.
  const recipeId = `${content.races[state.raceId]!.weaponTypeId}_t1`;
  if (recipeAvailable(state, recipeId, content)) {
    const queued = state.crafting.queue.reduce((n, o) => n + o.remaining, 0);
    if (queued < 5) {
      const wishOre = wish ? wishCost(wish, state, content).ore ?? 0 : 0;
      const spare = { ...state, resources: { ...state.resources, ore: Math.max(0, state.resources.ore - wishOre) } };
      const n = Math.min(10, maxCraftable(spare, recipeId, content));
      if (n > 0) exec({ type: 'queueCraft', recipeId, count: n });
    }
    refresh();
    if (Object.values(state.armoury).some((n) => n > 0)) {
      for (const t of state.troops) exec({ type: 'equipTroop', troopId: t.id });
    }
    refresh();
  }

  // 4. Recruit with food not needed for the wish (keep a small reserve).
  if (state.unlocks.includes('recruit')) {
    const reservedFood = (wish ? wishCost(wish, state, content).food ?? 0 : 0) + 5;
    for (const t of [...state.troops].sort((a, b) => a.size - b.size)) {
      refresh();
      const per = recruitCost(state, t.id, 1, content);
      const affordable = Math.floor(Math.max(0, state.resources.food - reservedFood) / (per.food ?? Infinity));
      const n = Math.min(maxRecruitable(state, t.id, content), affordable);
      if (n > 0) exec({ type: 'recruit', troopId: t.id, count: n });
    }
    refresh();
  }

  // 5. Assign troops.
  // Growth goal: the next batch of recruits for the smallest troop. It comes first while that
  // troop is below half its cap (a tiny troop gathers too slowly to be worth saving with),
  // and otherwise once the wishlist is done.
  let goalCost: Cost = wish ? wishCost(wish, state, content) : {};
  if (strategy === 'balanced' && state.unlocks.includes('recruit')) {
    const cap = currentCap(state, content);
    const smallest = [...state.troops].sort((a, b) => a.size - b.size)[0]!;
    const room = cap - smallest.size;
    const growFirst = smallest.size < cap / 2;
    if (room > 0 && (growFirst || (!wish && state.troops.length >= 2))) {
      goalCost = recruitCost(state, smallest.id, Math.min(growFirst ? 3 : 10, room), content);
    }
  }
  // Unarmed soldiers are a goal too: gather the ore for the next batch of weapons.
  // An idle forge is wasted time, so its ore counts even when something else is being saved for.
  if (recipeAvailable(state, recipeId, content) && (!wish || state.crafting.queue.length === 0)) {
    const soldiers = state.troops.reduce((n, t) => n + t.size, 0);
    const armed = state.troops.reduce((n, t) => n + equippedCount(t), 0) + Object.values(state.armoury).reduce((a, b) => a + b, 0);
    const queued = state.crafting.queue.reduce((n, o) => n + o.remaining, 0);
    const want = Math.min(10, soldiers - armed - queued);
    if (want > 0) {
      for (const [r, v] of Object.entries(craftCost(recipeId, want, content)) as [ResourceId, number][]) {
        goalCost = { ...goalCost, [r]: (goalCost[r] ?? 0) + v };
      }
    }
  }
  const missing = missingFor(goalCost, state);
  const free = [...state.troops];
  const assign = (troopId: string, activity: ActivityKind) => {
    const t = state.troops.find((x) => x.id === troopId);
    if (t && t.activity !== activity && exec({ type: 'assignTroop', troopId, activity })) refresh();
    const i = free.findIndex((x) => x.id === troopId);
    if (i >= 0) free.splice(i, 1);
  };
  const can = (a: ActivityKind) => state.unlocks.includes(`activity:${a}`);

  if (state.construction && can('construction')) {
    const builder = [...free].sort((a, b) => troopStats(state, b, content).workTotal - troopStats(state, a, content).workTotal)[0];
    if (builder) assign(builder.id, 'construction');
  }

  const fightNeeded = can('combat') && (!state.combat.cleared || state.unlocks.includes('boss'));
  if (strategy === 'balanced' && free.length >= 2 && fightNeeded) {
    const fighter = [...free].sort((a, b) => troopStats(state, b, content).strength - troopStats(state, a, content).strength)[0]!;
    assign(fighter.id, 'combat');
  }

  for (const t of [...free]) {
    const job = bestGatherJob(state, content, t.id, missing, can);
    if (job) {
      assign(t.id, job);
      // A second troop should cover a different need.
      const res = resourceOf(job);
      for (const r of res) delete missing[r];
    } else if (can('combat')) {
      assign(t.id, 'combat');
    } else {
      assign(t.id, 'woodcutting');
    }
  }

  // 6. Fight at the highest stage that costs no soldiers (a careful player).
  refresh();
  if (state.troops.some((t) => t.activity === 'combat') && !state.combat.boss) {
    let best = 0;
    for (let i = 0; i <= state.combat.unlockedStage; i++) {
      if (stageSafety(state, content, { stageIndex: i }).risk === 'safe') best = i;
    }
    if (best !== state.combat.stageIndex) exec({ type: 'selectStage', stageIndex: best });
  }
}

function currentWish(state: GameState, content: Content): Wish | undefined {
  return WISHLIST.find((w) => !wishDone(w, state) && wishUnlocked(w, state) && !(w.kind === 'building' && state.construction));
}

function wishDone(w: Wish, state: GameState): boolean {
  if (w.kind === 'upgrade') return (state.upgrades[w.id] ?? 0) > 0;
  if (w.kind === 'building') {
    const inProgress = state.construction?.buildingId === w.id && state.construction.level >= w.level;
    return (state.buildings[w.id] ?? 0) >= w.level || inProgress;
  }
  return false;
}

function wishUnlocked(w: Wish, state: GameState): boolean {
  if (w.kind === 'upgrade') return state.unlocks.includes(`upgrade:${w.id}`);
  if (w.kind === 'building') return state.unlocks.includes(`building:${w.id}`) && (state.buildings[w.id] ?? 0) === w.level - 1;
  return false;
}

function wishCost(w: Wish, state: GameState, content: Content): Cost {
  if (w.kind === 'upgrade') return content.upgrades[w.id]?.cost ?? {};
  if (w.kind === 'building') return content.buildings[w.id]?.levels[w.level - 1]?.cost ?? {};
  return {};
}

function tryBuy(w: Wish, state: GameState, content: Content, exec: (cmd: Command) => boolean): boolean {
  if (w.kind === 'upgrade') return exec({ type: 'buyUpgrade', upgradeId: w.id });
  if (w.kind === 'building') return exec({ type: 'startConstruction', buildingId: w.id });
  return false;
}

function missingFor(cost: Cost, state: GameState): Partial<Record<ResourceId, number>> {
  const out: Partial<Record<ResourceId, number>> = {};
  for (const [r, v] of Object.entries(cost) as [ResourceId, number][]) {
    const gap = v - state.resources[r];
    if (gap > 1e-9) out[r] = gap;
  }
  return out;
}

function resourceOf(a: ActivityKind): ResourceId[] {
  switch (a) {
    case 'mining': return ['stone', 'ore'];
    case 'woodcutting': return ['wood'];
    case 'food': return ['food'];
    case 'combat': return ['food'];
    default: return [];
  }
}

/** The activity that fills the slowest-to-fill missing resource fastest for this troop. */
function bestGatherJob(
  state: GameState,
  content: Content,
  troopId: string,
  missing: Partial<Record<ResourceId, number>>,
  can: (a: ActivityKind) => boolean,
): ActivityKind | undefined {
  let best: { activity: ActivityKind; time: number } | undefined;
  for (const [res, gap] of Object.entries(missing) as [ResourceId, number][]) {
    let bestForRes: { activity: ActivityKind; rate: number } | undefined;
    for (const a of ACTIVITIES) {
      if (a === 'construction' || !can(a) || !resourceOf(a).includes(res)) continue;
      const trial = structuredCloneState(state);
      for (const t of trial.troops) t.activity = t.id === troopId ? a : null;
      const rate = computeRates(trial, content).resources[res];
      if (rate > 0 && (!bestForRes || rate > bestForRes.rate)) bestForRes = { activity: a, rate };
    }
    if (!bestForRes) continue;
    const time = gap / bestForRes.rate;
    if (!best || time > best.time) best = { activity: bestForRes.activity, time };
  }
  return best?.activity;
}

function structuredCloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s)) as GameState;
}

// ------------------------------------------------------------------ reporting

function describeEvent(e: GameEvent, state: GameState, content: Content): { text: string; milestone?: string } | undefined {
  switch (e.type) {
    case 'objectiveCompleted': {
      const o = content.objectives.find((x) => x.id === e.objectiveId);
      return { text: `✔ ${o?.text ?? e.objectiveId}`, milestone: `objective:${e.objectiveId}` };
    }
    case 'troopFormed': {
      const t = state.troops.find((x) => x.id === e.troopId);
      return { text: `🎉 New troop formed: ${t?.name ?? e.troopId}`, milestone: `troop:${e.troopId}` };
    }
    case 'constructionCompleted':
      return { text: `🏗  Built ${content.buildings[e.buildingId]?.name ?? e.buildingId} ${e.level}`, milestone: `building:${e.buildingId}:${e.level}` };
    case 'stageCleared':
      return { text: `⚔  Stage ${e.stage} cleared`, milestone: `stage:${e.stage}` };
    case 'bossDefeated':
      return { text: '👑 Boss defeated', milestone: 'boss' };
    case 'bossFailed':
      return { text: '✖ Boss attempt failed' };
    case 'soldierLost':
      return { text: `☠ ${state.troops.find((x) => x.id === e.troopId)?.name ?? e.troopId} lost a soldier`, milestone: 'firstLoss' };
    case 'troopRetreated':
      return { text: `↩ ${state.troops.find((x) => x.id === e.troopId)?.name ?? e.troopId} retreated (${e.reason})` };
    default:
      return undefined;
  }
}

function snapshot(state: GameState, content: Content): Snapshot {
  const z = content.zones[state.combat.zoneId]!;
  const stage = state.combat.bossDefeated
    ? 'boss defeated'
    : state.combat.cleared
      ? 'cleared'
      : `${state.combat.stageIndex + 1}/${z.stages.length}`;
  return {
    t: state.clock,
    troops: state.troops.map((t) => ({
      name: t.name,
      size: t.size,
      level: troopStats(state, t, content).level,
      activity: t.activity,
      gear: Math.round(averageWeaponPower(t, content) * 100) / 100,
      armed: equippedCount(t),
    })),
    resources: { ...state.resources },
    stage,
    buildings: { ...state.buildings },
  };
}
