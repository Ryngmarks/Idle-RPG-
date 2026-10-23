// Scripted players for the balance simulator. They only use the public core API,
// exactly like the UI does. See docs/PROGRESSION_V2.md §8 and docs/BALANCE_LOG.md.

import {
  advance,
  availableSites,
  dispatch,
  estimatedBossDamage,
  averageWeaponPower,
  equippedCount,
  foodBalance,
  maxCraftable,
  recipeAvailable,
  stageSafety,
  trainBlocker,
  trainCost,
  troopStats,
  type ActivityKind,
  type Command,
  type Content,
  type Cost,
  type GameEvent,
  type GameState,
  type ResourceId,
} from '../../src/core';

/**
 * `balanced`: a careful active player (also watches the food). `economy`: builds first and only fights when
 * nothing is missing. `careless`: like balanced but never reacts to hunger (proves hunger cannot lock the game).
 */
export type Strategy = 'balanced' | 'economy' | 'careless';

type Wish =
  | { kind: 'upgrade'; id: string }
  | { kind: 'building'; id: string; level: number };

/** What a sensible player works towards in Gårdarna, in priority order. */
const WISHLIST: Wish[] = [
  { kind: 'upgrade', id: 'sharpenedAxes' },
  { kind: 'upgrade', id: 'drillPractice' },
  { kind: 'building', id: 'tents', level: 1 },
  { kind: 'upgrade', id: 'stonePicks' },
  { kind: 'building', id: 'trainingCamp', level: 1 },
  { kind: 'building', id: 'forge', level: 1 },
  { kind: 'building', id: 'tents', level: 2 },
  { kind: 'building', id: 'farm', level: 1 },
  { kind: 'building', id: 'woodshed', level: 1 },
  { kind: 'building', id: 'forge', level: 2 },
  { kind: 'upgrade', id: 'sharpenedAxes2' },
  { kind: 'building', id: 'farm', level: 2 },
  { kind: 'upgrade', id: 'stonePicks2' },
  { kind: 'building', id: 'tents', level: 3 },
  { kind: 'upgrade', id: 'fieldKitchens' },
  { kind: 'upgrade', id: 'carpentry' },
];

/** The bot sends a group to food when the stock lasts less than this. */
const FOOD_BUFFER_SEC = 180;

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
  /** Longest stretch in the first 15 minutes without anything completing (a cycle, a kill, an event). */
  longestQuietGapEarly: number;
  /** Times (s) of every "event" a player sees: objective, building, recruit, join, stage clear, new troop, level step. */
  eventTimes: number[];
  /** Longest stretch in minutes between two events inside [fromMin, toMin] (capped at the end of the run). */
  /** Armed soldiers and soldiers when the boss fight starts (before its rewards add unarmed prisoners). */
  armedAtBoss: { armed: number; soldiers: number } | null;
  /** Seconds the army was hungry before the boss fight started (sampled every tick). */
  hungrySec: number;
  /** Longest unbroken hungry stretch (s) before the boss fight started. */
  longestHungrySec: number;
  longestEventGap: (fromMin: number, toMin: number) => number;
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
  const activityTime = { combat: 0, mining: 0, woodcutting: 0, food: 0, construction: 0, smithing: 0, idle: 0 };
  let nextSnapshot = 0;
  let hungrySec = 0;
  let longestHungrySec = 0;
  let hungryRun = 0;
  let armedAtBoss: { armed: number; soldiers: number } | null = null;
  let lastReward = 0;
  let longestQuietGapEarly = 0;
  const progressMark = (s: GameState) =>
    Object.values(s.stats.gathered).reduce((a, b) => a + b, 0) + Math.floor(s.stats.totalKills + 1e-9);

  const eventTimes: number[] = [];
  const EVENT_TYPES = new Set(['objectiveCompleted', 'constructionCompleted', 'recruitTrained', 'soldiersJoined', 'stageCleared', 'troopFormed', 'levelStep']);
  const note = (events: GameEvent[]) => {
    for (const e of events) {
      if (EVENT_TYPES.has(e.type as string)) eventTimes.push(e.at);
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
    if (state.combat.boss && !armedAtBoss) {
      armedAtBoss = {
        armed: state.troops.reduce((n, t) => n + equippedCount(t), 0),
        soldiers: state.troops.reduce((n, t) => n + t.size, 0),
      };
    }
    if (!state.combat.boss) {
      if (foodBalance(state, content).hungry) {
        hungrySec += opts.tickSeconds;
        hungryRun += opts.tickSeconds;
        longestHungrySec = Math.max(longestHungrySec, hungryRun);
      } else hungryRun = 0;
    }
    const before = progressMark(state);
    const r = advance(state, opts.tickSeconds, content);
    state = r.state;
    note(r.events);
    if (progressMark(state) > before + 1e-9 || r.events.length > 0) lastReward = state.clock;
    if (state.clock <= 15 * 60) longestQuietGapEarly = Math.max(longestQuietGapEarly, state.clock - lastReward);
  }
  snapshots.push(snapshot(state, content));
  const endClock = state.clock;
  const longestEventGap = (fromMin: number, toMin: number) => {
    const from = fromMin * 60;
    const to = Math.min(toMin * 60, endClock);
    if (to <= from) return 0;
    const pts = [from, ...eventTimes.filter((t) => t > from && t < to), to].sort((x, y) => x - y);
    let gap = 0;
    for (let i = 1; i < pts.length; i++) gap = Math.max(gap, pts[i]! - pts[i - 1]!);
    return gap / 60;
  };
  return { log, snapshots, milestones, activityTime, longestQuietGapEarly, eventTimes, longestEventGap, armedAtBoss, hungrySec, longestHungrySec, finalState: state };
}

// ------------------------------------------------------------------ decisions

/** Where a resource is gathered, as an activity and a work site. */
function gatherJob(state: GameState, content: Content, r: ResourceId): { activity: ActivityKind; siteId?: string } | undefined {
  if (r === 'wood') return { activity: 'woodcutting', siteId: 'birchGrove' };
  if (r === 'stone') return { activity: 'mining', siteId: 'oldQuarry' };
  if (r === 'ore') return { activity: 'mining', siteId: 'oreVein' };
  const food = availableSites(state, content, 'food');
  const best = [...food].sort((a, b) => b.yield.food! / b.cycleSec - a.yield.food! / a.cycleSec)[0];
  return best ? { activity: 'food', siteId: best.id } : undefined;
}

function decide(
  initial: GameState,
  content: Content,
  strategy: Strategy,
  exec: (cmd: Command) => boolean,
  current: () => GameState,
): void {
  let state = initial;
  const refresh = () => (state = current());
  const can = (a: ActivityKind) => state.unlocks.includes(`activity:${a}`);

  // 1. Boss: commit everyone when the estimate says it falls in time.
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

  // 2. Buy the next wish when affordable.
  const wish = WISHLIST.find((w) => !wishDone(w, state) && wishUnlocked(w, state) && !(w.kind === 'building' && state.construction));
  let goal: Cost = {};
  if (wish) {
    if (tryBuy(wish, state, content, exec)) refresh();
    else goal = { ...wishCost(wish, state, content) };
  }

  // 3. Train a recruit whenever a bed is free and the food is there (the wish's food stays reserved).
  const smallest = () => [...state.troops].sort((a, b) => a.size - b.size)[0]!;
  const blocker = trainBlocker(state, content);
  const trainFood = trainCost(state, content).food;
  if (blocker === null && state.resources.food - trainFood >= (goal.food ?? 0)) {
    exec({ type: 'trainRecruit', troopId: smallest().id });
    refresh();
  } else if (blocker === null || blocker === 'food') {
    goal.food = (goal.food ?? 0) + trainFood;
  }

  // 4. Forge: weapons for unarmed soldiers only (racing to the boss, not grinding quality).
  const recipeId = `${content.races[state.raceId]!.weaponTypeId}_t1`;
  if (recipeAvailable(state, recipeId, content)) {
    const soldiers = state.troops.reduce((n, t) => n + t.size, 0);
    const queued = state.crafting.queue.reduce((n, o) => n + o.remaining, 0);
    const spare = Object.values(state.armoury).reduce((a, b) => a + b, 0);
    const unarmed = soldiers - state.troops.reduce((n, t) => n + equippedCount(t), 0) - spare - queued;
    if (unarmed > 0) {
      const n = Math.min(unarmed, maxCraftable({ ...state, resources: { ...state.resources, ore: Math.max(0, state.resources.ore - (goal.ore ?? 0)) } }, recipeId, content));
      if (n > 0) exec({ type: 'queueCraft', recipeId, count: n });
      else goal.ore = (goal.ore ?? 0) + (content.equipment.recipes[recipeId]?.materials.ore ?? 0);
      refresh();
    }
  }

  // 5. An open group slot: split a soldier off the biggest group.
  if (state.troops.length < state.troopSlots) {
    const big = [...state.troops].sort((a, b) => b.size - a.size)[0];
    if (big && big.size >= 2) exec({ type: 'transferSoldiers', fromTroopId: big.id, toTroopId: null, count: 1 });
    refresh();
  }

  // 6. Assign groups: economy jobs in order of urgency, the rarest missing material first.
  const missing = (Object.entries(goal) as [ResourceId, number][])
    .map(([r, v]) => ({ r, gap: v - state.resources[r] }))
    .filter((x) => x.gap > 1e-9);
  const perSec = (r: ResourceId) => {
    const job = gatherJob(state, content, r);
    const site = job?.siteId ? content.sites[job.siteId] : undefined;
    return site ? (site.yield[r] ?? 0) / site.cycleSec : 0;
  };
  missing.sort((a, b) => b.gap / Math.max(1e-6, perSec(b.r)) - a.gap / Math.max(1e-6, perSec(a.r)));
  type Job = { activity: ActivityKind; siteId?: string };
  const econ: Job[] = [];
  // Food watch (not for the careless player): send a group to food when it is empty or about to run out.
  if (strategy !== 'careless' && can('food')) {
    const fb = foodBalance(state, content);
    const foodJob = gatherJob(state, content, 'food');
    if (foodJob && (fb.hungry || (fb.net < 0 && fb.secondsLeft !== null && fb.secondsLeft < FOOD_BUFFER_SEC))) econ.push(foodJob);
  }
  if (state.construction && can('construction')) econ.push({ activity: 'construction' });
  if (state.crafting.queue.length > 0 && can('smithing')) econ.push({ activity: 'smithing' });
  for (const m of missing) {
    const job = gatherJob(state, content, m.r);
    if (job && can(job.activity)) econ.push(job);
  }
  const fight = can('combat') && !state.combat.bossDefeated;
  const fallback: Job = fight ? { activity: 'combat' } : gatherJob(state, content, 'food') && can('food') ? gatherJob(state, content, 'food')! : { activity: 'woodcutting' };
  const ordered = [...state.troops].sort((a, b) => b.size - a.size || a.id.localeCompare(b.id));
  const jobs: Job[] =
    ordered.length === 1
      ? // Alone: rescue the first companion, then follow the most urgent need and fight when nothing is missing.
        [fight && (state.combat.unlockedStage === 0 || econ.length === 0) ? { activity: 'combat' } : (econ[0] ?? fallback)]
      : strategy !== 'economy' && fight
        ? [{ activity: 'combat' }, ...econ]
        : econ;
  ordered.forEach((t, i) => {
    const job = jobs[i] ?? fallback;
    if (t.activity !== job.activity || (job.siteId && t.siteId !== job.siteId)) {
      exec({ type: 'assignTroop', troopId: t.id, activity: job.activity, siteId: job.siteId });
    }
  });

  // 7. Fight at the highest stage that costs no soldiers (a careful player).
  refresh();
  if (state.troops.some((t) => t.activity === 'combat') && !state.combat.boss) {
    let best = 0;
    for (let i = 0; i <= state.combat.unlockedStage; i++) {
      if (stageSafety(state, content, { stageIndex: i }).risk === 'safe') best = i;
    }
    if (best !== state.combat.stageIndex) exec({ type: 'selectStage', stageIndex: best });
  }
}

function wishDone(w: Wish, state: GameState): boolean {
  if (w.kind === 'upgrade') return (state.upgrades[w.id] ?? 0) > 0;
  const inProgress = state.construction?.buildingId === w.id && state.construction.level >= w.level;
  return (state.buildings[w.id] ?? 0) >= w.level || inProgress;
}

function wishUnlocked(w: Wish, state: GameState): boolean {
  if (w.kind === 'upgrade') return state.unlocks.includes(`upgrade:${w.id}`);
  return state.unlocks.includes(`building:${w.id}`) && (state.buildings[w.id] ?? 0) === w.level - 1;
}

function wishCost(w: Wish, state: GameState, content: Content): Cost {
  if (w.kind === 'upgrade') return content.upgrades[w.id]?.cost ?? {};
  return content.buildings[w.id]?.levels[w.level - 1]?.cost ?? {};
}

function tryBuy(w: Wish, state: GameState, content: Content, exec: (cmd: Command) => boolean): boolean {
  if (w.kind === 'upgrade') return exec({ type: 'buyUpgrade', upgradeId: w.id });
  return exec({ type: 'startConstruction', buildingId: w.id });
}

// ------------------------------------------------------------------ reporting

function describeEvent(e: GameEvent, state: GameState, content: Content): { text: string; milestone?: string } | undefined {
  switch (e.type) {
    case 'objectiveCompleted': {
      const o = content.objectives.find((x) => x.id === e.objectiveId);
      return { text: `✔ ${o?.text ?? e.objectiveId}`, milestone: `objective:${e.objectiveId}` };
    }
    case 'recruitTrained': {
      const n = state.troops.reduce((a, t) => a + t.size, 0);
      return { text: `🛡  Recruit trained (${n} soldiers)`, milestone: `soldiers:${n}` };
    }
    case 'soldiersJoined': {
      const n = state.troops.reduce((a, t) => a + t.size, 0);
      return { text: `✨ ${e.count} soldier(s) joined (${n} soldiers)`, milestone: `soldiers:${n}` };
    }
    case 'troopFormed': {
      const t = state.troops.find((x) => x.id === e.troopId);
      return { text: `🎉 New troop formed: ${t?.name ?? e.troopId}`, milestone: `troop:${e.troopId}` };
    }
    case 'constructionCompleted':
      return { text: `🏗  Built ${content.buildings[e.buildingId]?.name ?? e.buildingId} ${e.level}`, milestone: `building:${e.buildingId}:${e.level}` };
    case 'stageCleared':
      return { text: `⚔  Stage ${e.stage} cleared`, milestone: `stage:${e.stage}` };
    case 'levelStep' as GameEvent['type']:
      return { text: '⭐ Level step', milestone: 'levelStep' };
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
