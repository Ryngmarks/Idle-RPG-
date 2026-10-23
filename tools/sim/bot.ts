// Scripted players for the balance simulator. They only use the public core API,
// exactly like the UI does. See docs/PROGRESSION_V2.md §8 and docs/BALANCE_LOG.md.

import {
  advance,
  availableSites,
  catchUp,
  dispatch,
  estimatedBossDamage,
  averageWeaponPower,
  equippedCount,
  foodBalance,
  maxCraftable,
  masteryKey,
  masteryLevel,
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
 * `feast`: balanced, plus a Feast whenever it is ready and food is above 100 (the balanced bot never feasts).
 */
export type Strategy = 'balanced' | 'economy' | 'careless' | 'feast' | 'checkin';

/**
 * `checkin` (docs/PROGRESSION_V2.md §19.3): balanced for the first 2 h, then it only acts every 45 minutes,
 * with one 8 h blackout per 24 h (clock 15-23 h, 39-47 h, ...) resolved with the offline catch-up.
 */
export const CHECKIN_START_SEC = 2 * 3600;
export const CHECKIN_STEP_SEC = 45 * 60;
export const BLACKOUT_FROM_SEC = 15 * 3600;
export const BLACKOUT_LEN_SEC = 8 * 3600;
export const DAY_SEC = 24 * 3600;

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
  { kind: 'building', id: 'woodshed', level: 1 },
  { kind: 'building', id: 'farm', level: 1 },
  { kind: 'building', id: 'forge', level: 2 },
  { kind: 'upgrade', id: 'sharpenedAxes2' },
  { kind: 'building', id: 'farm', level: 2 },
  { kind: 'upgrade', id: 'stonePicks2' },
  { kind: 'building', id: 'tents', level: 3 },
  { kind: 'upgrade', id: 'fieldKitchens' },
  { kind: 'upgrade', id: 'carpentry' },
  // After boss 1 (docs/PROGRESSION_V2.md §19.5): beds and the army first, then the economy and the forge.
  { kind: 'building', id: 'barracks', level: 1 },
  { kind: 'building', id: 'drillGround', level: 1 },
  { kind: 'building', id: 'tents', level: 4 },
  { kind: 'building', id: 'farm', level: 3 },
  { kind: 'upgrade', id: 'drillPractice2' },
  { kind: 'building', id: 'woodshed', level: 2 },
  { kind: 'building', id: 'drillGround', level: 2 },
  { kind: 'building', id: 'tents', level: 5 },
  { kind: 'upgrade', id: 'fieldKitchens2' },
  { kind: 'building', id: 'farm', level: 4 },
  { kind: 'building', id: 'barracks', level: 2 },
  { kind: 'building', id: 'forge', level: 3 },
  { kind: 'building', id: 'drillGround', level: 3 },
  { kind: 'building', id: 'tents', level: 6 },
  { kind: 'building', id: 'woodshed', level: 3 },
  { kind: 'building', id: 'forge', level: 4 },
  { kind: 'building', id: 'farm', level: 5 },
  { kind: 'building', id: 'barracks', level: 3 },
  { kind: 'building', id: 'tents', level: 7 },
  { kind: 'building', id: 'drillGround', level: 4 },
  { kind: 'building', id: 'woodshed', level: 4 },
  { kind: 'building', id: 'farm', level: 6 },
  { kind: 'building', id: 'forge', level: 5 },
  { kind: 'building', id: 'barracks', level: 4 },
  { kind: 'building', id: 'tents', level: 8 },
  { kind: 'building', id: 'drillGround', level: 5 },
  { kind: 'building', id: 'barracks', level: 5 },
];

/** Buildings that give beds: when recruiting is blocked by a missing bed, these jump the queue. */
const BED_BUILDINGS = new Set(['tents', 'barracks']);

/** T1 weapons to craft before T2 opens: mastery 2 (docs/PROGRESSION_V2.md §19.5) needs 80 of one type. */
const MASTERY_GRIND_TARGET = 80;
/** Labour groups after boss 1 aim at this many soldiers (the work sites hold 2-4). */
const LABOUR_GROUP_SIZE = 3;
/** Iron the bot keeps in stock once T2 is open (10 weapons). */
const IRON_STOCK = 60;

/** The bot sends a group to food when the stock lasts less than this. */
const FOOD_BUFFER_SEC = 180;

/** The feast bot feasts when food covers the feast cost (50) plus a small buffer. */
const FEAST_BUFFER_FOOD = 20;

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
  /** One entry per boss fight started (failed attempts included): the army when the fight begins. */
  bossStarts: BossStart[];
  /** Game clock (s) when boss i+1 fell. */
  bossTimes: (number | null)[];
  /** Game clock (s) when level L first opened for the troops (1-based; index L); a boss level counts until its boss falls. */
  levelTimes: Record<number, number>;
  finalState: GameState;
}

export interface BossStart {
  boss: number;
  t: number;
  soldiers: number;
  groups: number;
  armed: number;
  t2Armed: number;
  /** Highest troop level in the army when the fight starts. */
  troopLevel: number;
  failed: boolean;
}

export interface RunOptions {
  raceId: string;
  strategy: Strategy;
  maxSeconds: number;
  tickSeconds: number;
  snapshotEverySeconds: number;
  /** Stop when this many bosses have fallen (default 1: the first-hour runs end at Gamle Betarn). */
  stopAtBoss?: number;
}

export function runBot(start: GameState, content: Content, opts: RunOptions): RunResult {
  let state = start;
  const log: LogEntry[] = [];
  const snapshots: Snapshot[] = [];
  const milestones: Record<string, number> = {};
  const activityTime = { combat: 0, mining: 0, woodcutting: 0, food: 0, construction: 0, smithing: 0, idle: 0 };
  const stopAt = opts.stopAtBoss ?? 1;
  const checkin = opts.strategy === 'checkin';
  let nextSnapshot = 0;
  let hungrySec = 0;
  let longestHungrySec = 0;
  let hungryRun = 0;
  let armedAtBoss: { armed: number; soldiers: number } | null = null;
  const bossStarts: BossStart[] = [];
  const levelTimes: Record<number, number> = { 1: 0 };
  const memory: Memory = { failedAtDps: 0 };
  let lastReward = 0;
  let longestQuietGapEarly = 0;
  const progressMark = (s: GameState) =>
    Object.values(s.stats.gathered).reduce((a, b) => a + b, 0) + Math.floor(s.stats.totalKills + 1e-9);

  const eventTimes: number[] = [];
  const EVENT_TYPES = new Set(['objectiveCompleted', 'constructionCompleted', 'recruitTrained', 'soldiersJoined', 'stageCleared', 'troopFormed', 'levelStep', 'bossDefeated']);
  const note = (events: GameEvent[]) => {
    for (const e of events) {
      if (EVENT_TYPES.has(e.type as string)) eventTimes.push(e.at);
      if (e.type === 'bossDefeated') {
        milestones[`boss:${e.index + 1}`] = e.at;
        // The level after the boss opens (event times, so the check-in grid does not blur them).
        const lvl = content.zones[state.combat.zoneId]?.bosses[e.index]?.level;
        if (lvl !== undefined && levelTimes[lvl + 1] === undefined) levelTimes[lvl + 1] = e.at;
      }
      if (e.type === 'stageCleared' && e.stage % 5 !== 0 && levelTimes[e.stage + 1] === undefined) levelTimes[e.stage + 1] = e.at;
      if (e.type === 'bossFailed') {
        const last = bossStarts[bossStarts.length - 1];
        if (last) last.failed = true;
      }
      const key = describeEvent(e, state, content);
      if (!key) continue;
      log.push({ t: e.at, text: key.text });
      if (key.milestone && milestones[key.milestone] === undefined) milestones[key.milestone] = e.at;
    }
  };
  let commands = 0;
  const exec = (cmd: Command): boolean => {
    const before = state;
    const r = dispatch(state, cmd, content);
    if (!r.ok) return false;
    state = r.state;
    commands++;
    if (cmd.type === 'challengeBoss' && state.combat.boss) {
      const armed = state.troops.reduce((n, t) => n + equippedCount(t), 0);
      bossStarts.push({
        boss: state.combat.boss.index + 1,
        t: state.clock,
        soldiers: state.troops.reduce((n, t) => n + t.size, 0),
        groups: state.troops.length,
        armed,
        t2Armed: state.troops.reduce((n, t) => n + t.equipment.filter((b) => b.tier >= 2).reduce((m, b) => m + b.count, 0), 0),
        troopLevel: Math.max(...state.troops.map((t) => troopStats(state, t, content).level)),
        failed: false,
      });
      memory.lastDps = estimatedBossDamage(before, content, before.troops.map((t) => t.id)).dps;
    }
    note(r.events);
    return true;
  };
  /** One action: the bot looks around and does everything it wants (the checkin bot repeats until nothing changes). */
  const act = () => {
    const rounds = checkin && state.clock >= CHECKIN_START_SEC ? 12 : 1;
    for (let i = 0; i < rounds; i++) {
      commands = 0;
      decide(state, content, opts.strategy, exec, () => state, memory);
      if (commands === 0) break;
    }
  };
  const stepTo = (dt: number) => {
    for (const t of state.troops) activityTime[t.activity ?? 'idle'] += dt;
    if (state.combat.boss && !armedAtBoss) {
      armedAtBoss = {
        armed: state.troops.reduce((n, t) => n + equippedCount(t), 0),
        soldiers: state.troops.reduce((n, t) => n + t.size, 0),
      };
    }
    if (!state.combat.boss) {
      if (foodBalance(state, content).hungry) {
        hungrySec += dt;
        hungryRun += dt;
        longestHungrySec = Math.max(longestHungrySec, hungryRun);
      } else hungryRun = 0;
    }
    const before = progressMark(state);
    const r = advance(state, dt, content);
    state = r.state;
    note(r.events);
    if (progressMark(state) > before + 1e-9 || r.events.length > 0) lastReward = state.clock;
    if (state.clock <= 15 * 60) longestQuietGapEarly = Math.max(longestQuietGapEarly, state.clock - lastReward);
  };
  /** The next moment the checkin bot wants to act: the 45-minute grid, or the start of a blackout. */
  const nextCheckin = (): { at: number; blackout: boolean } => {
    const k = Math.floor((state.clock - CHECKIN_START_SEC + 1e-3) / CHECKIN_STEP_SEC) + 1;
    const grid = CHECKIN_START_SEC + k * CHECKIN_STEP_SEC;
    // Blackouts start at 15 h, 39 h, ... (every 24 h); the next one that has not started yet.
    const start = BLACKOUT_FROM_SEC + (state.clock < BLACKOUT_FROM_SEC - 1e-3 ? 0 : Math.floor((state.clock - BLACKOUT_FROM_SEC + 1e-3) / DAY_SEC) + 1) * DAY_SEC;
    return start <= grid ? { at: start, blackout: true } : { at: grid, blackout: false };
  };

  while (state.clock < opts.maxSeconds && state.combat.bossesDefeated < stopAt) {
    while (state.clock >= nextSnapshot) {
      snapshots.push(snapshot(state, content));
      nextSnapshot += opts.snapshotEverySeconds;
    }
    if (!checkin || state.clock < CHECKIN_START_SEC - 1e-3) {
      act();
      stepTo(Math.min(opts.tickSeconds, checkin ? CHECKIN_START_SEC - state.clock : Infinity));
    } else {
      const next = nextCheckin();
      stepTo(Math.max(1e-3, next.at - state.clock));
      if (state.clock >= opts.maxSeconds) break;
      act();
      // A boss fight takes a couple of minutes: the player watches it, then carries on with his chores.
      for (let i = 0; i < 20 && state.combat.boss; i++) {
        stepTo(state.combat.boss.timeLeft + 0.5);
        act();
      }
      if (next.blackout) {
        // Asleep for 8 h: the offline rule (abandon a boss fight, fall back to a safe level) and no actions.
        const r = catchUp(state, BLACKOUT_LEN_SEC, BLACKOUT_LEN_SEC, content);
        for (const t of state.troops) activityTime[t.activity ?? 'idle'] += BLACKOUT_LEN_SEC;
        state = r.state;
        note(r.events);
      }
    }
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
  return {
    log, snapshots, milestones, activityTime, longestQuietGapEarly, eventTimes, longestEventGap, armedAtBoss, hungrySec, longestHungrySec,
    bossStarts, bossTimes: state.stats.bossTimes, levelTimes, finalState: state,
  };
}

// ------------------------------------------------------------------ decisions

interface Memory {
  /** Boss dps at the last fight start, and at the last failure: the bot retries only when it got stronger. */
  lastDps?: number;
  failedAtDps: number;
}

/** The work site that gives a resource fastest per worker, among the sites the player can use. */
function gatherJob(state: GameState, content: Content, r: ResourceId): { activity: ActivityKind; siteId?: string } | undefined {
  let best: { activity: ActivityKind; siteId: string; rate: number } | undefined;
  for (const activity of ['woodcutting', 'mining', 'food'] as const) {
    for (const site of availableSites(state, content, activity)) {
      const rate = (site.yield[r] ?? 0) / site.cycleSec;
      if (rate > 0 && (!best || rate > best.rate)) best = { activity, siteId: site.id, rate };
    }
  }
  return best;
}

function t2Armed(state: GameState): number {
  return state.troops.reduce((n, t) => n + t.equipment.filter((b) => b.tier >= 2).reduce((m, b) => m + b.count, 0), 0);
}

function decide(
  initial: GameState,
  content: Content,
  strategy: Strategy,
  exec: (cmd: Command) => boolean,
  current: () => GameState,
  memory: Memory,
): void {
  let state = initial;
  const refresh = () => (state = current());
  const can = (a: ActivityKind) => state.unlocks.includes(`activity:${a}`);
  const zoneDef = content.zones[state.combat.zoneId]!;
  const bossesLeft = state.combat.bossesDefeated < zoneDef.bosses.length;

  // 1. Boss: commit everyone when the estimate says it falls in time.
  if (state.combat.boss) {
    for (const t of state.troops) if (t.activity !== 'combat') exec({ type: 'assignTroop', troopId: t.id, activity: 'combat' });
    return;
  }
  // After a fight: a failure (the boss is still ready) remembers how strong the army was, a win forgets it.
  if (memory.lastDps !== undefined) {
    memory.failedAtDps = state.combat.cleared ? memory.lastDps : 0;
    memory.lastDps = undefined;
  }
  // The check-in player does his chores first and challenges the boss last; the active bot goes straight for it.
  const bossLast = strategy === 'checkin';
  const tryBoss = (): boolean => {
    if (!(state.unlocks.includes('boss') && state.combat.cleared && bossesLeft && !state.combat.boss)) return false;
    const est = estimatedBossDamage(state, content, state.troops.map((t) => t.id));
    const margin = strategy === 'checkin' ? 1.0 : 1.05;
    // After a failed attempt the bot waits until its damage has grown.
    if (!(est.canWin && est.damage >= est.hp * margin && est.dps > memory.failedAtDps * 1.02)) return false;
    for (const t of state.troops) exec({ type: 'assignTroop', troopId: t.id, activity: 'combat' });
    return exec({ type: 'challengeBoss' });
  };
  if (!bossLast && tryBoss()) return;
  const lateGame = state.combat.bossesDefeated >= 1;

  // 1b. Feast whenever it is ready and there is food to spare.

  // 2. Buy the next wish when affordable. A missing bed (after boss 1) moves a bed building to the front.
  const open = WISHLIST.filter((w) => !wishDone(w, state) && wishUnlocked(w, state, content) && !(w.kind === 'building' && state.construction));
  const bedBlocked = lateGame && trainBlocker(state, content) === 'noBed';
  const wish = (bedBlocked ? open.find((w) => w.kind === 'building' && BED_BUILDINGS.has(w.id)) : undefined) ?? open[0];
  let goal: Cost = {};
  if (wish) {
    if (tryBuy(wish, state, content, exec)) refresh();
    else goal = { ...wishCost(wish, state, content) };
  }

  // 3. Train a recruit whenever a bed is free and the food is there (the wish's food stays reserved).
  // After boss 1 recruits join the biggest group: the small labour groups keep their size and the front grows.
  const recruitTo = () => (lateGame ? [...state.troops].sort((a, b) => b.size - a.size)[0]! : [...state.troops].sort((a, b) => a.size - b.size)[0]!);
  const blocker = trainBlocker(state, content);
  const trainFood = trainCost(state, content).food;
  if (blocker === null && state.resources.food - trainFood >= (goal.food ?? 0)) {
    exec({ type: 'trainRecruit', troopId: recruitTo().id });
    refresh();
  } else if (blocker === null || blocker === 'food') {
    goal.food = (goal.food ?? 0) + trainFood;
  }

  // 3b. Feast: the balanced bot never does; the feast bot does it as soon as the cost plus a small buffer is in stock.
  if (strategy === 'feast') {
    const cost = content.constants.feast.cost;
    if (state.resources.food >= (cost.food ?? 0) + FEAST_BUFFER_FOOD && state.resources.wood >= (cost.wood ?? 0)) {
      if (exec({ type: 'startFeast' })) refresh();
    }
  }

  // 4. Forge: weapons for unarmed soldiers (racing to the boss, not grinding quality) ...
  const weaponType = content.races[state.raceId]!.weaponTypeId;
  const t1 = `${weaponType}_t1`;
  const t2 = `${weaponType}_t2`;
  const soldiersNow = () => state.troops.reduce((n, t) => n + t.size, 0);
  const queuedOf = (id: string) => state.crafting.queue.filter((o) => o.recipeId === id).reduce((n, o) => n + o.remaining, 0);
  const queueUpTo = (recipeId: string, want: number, opportunistic = false): number => {
    const recipe = content.equipment.recipes[recipeId]!;
    const free = { ...state.resources };
    for (const [r, v] of Object.entries(goal) as [ResourceId, number][]) free[r] = Math.max(0, free[r] - v);
    const n = Math.min(want, maxCraftable({ ...state, resources: free }, recipeId, content));
    if (n > 0 && exec({ type: 'queueCraft', recipeId, count: n })) {
      refresh();
      return n;
    }
    if (!opportunistic) for (const [r, v] of Object.entries(recipe.materials) as [ResourceId, number][]) goal[r] = (goal[r] ?? 0) + v;
    return 0;
  };
  if (recipeAvailable(state, t1, content)) {
    const queued = state.crafting.queue.reduce((n, o) => n + o.remaining, 0);
    const spare = Object.values(state.armoury).reduce((a, b) => a + b, 0);
    const unarmed = soldiersNow() - state.troops.reduce((n, t) => n + equippedCount(t), 0) - spare - queued;
    if (unarmed > 0) {
      // A T2 weapon is the better buy once the player can make it.
      const useT2 = recipeAvailable(state, t2, content) && maxCraftable(state, t2, content) > 0;
      queueUpTo(useT2 ? t2 : t1, unarmed);
      refresh();
    }
  }
  if (lateGame && recipeAvailable(state, t1, content)) {
    const crafted1 = state.crafting.crafted[masteryKey(weaponType, 1)] ?? 0;
    if (recipeAvailable(state, t2, content)) {
      // T2 is the backbone: replace every soldier's weapon, a few at a time.
      const have2 = t2Armed(state) + Object.entries(state.armoury).filter(([k]) => k.includes(':t2:')).reduce((a, [, v]) => a + v, 0) + queuedOf(t2);
      const want = soldiersNow() - have2;
      if (want > 0) queueUpTo(t2, want);
    }
    // Keep some iron in stock once T2 is open, so the next weapons are never waiting for the mine.
    if (state.unlocks.includes('tier:2') && state.unlocks.includes('site:jarngruvan') && soldiersNow() > t2Armed(state)) {
      goal.iron = Math.max(goal.iron ?? 0, IRON_STOCK);
    }
    // Mastery 2 in this weapon type opens the T2 recipe (80 crafted): grind T1 weapons with spare ore from boss 1 on;
    // the spares also swap in better qualities.
    if (masteryLevel(crafted1, content) < 2 && crafted1 + queuedOf(t1) < MASTERY_GRIND_TARGET && !recipeAvailable(state, t2, content)) {
      queueUpTo(t1, MASTERY_GRIND_TARGET - crafted1 - queuedOf(t1), true);
    }
  }

  // 5. An open group slot: split soldiers off the biggest group.
  if (state.troops.length < state.troopSlots) {
    const big = [...state.troops].sort((a, b) => b.size - a.size)[0];
    const take = lateGame ? Math.max(1, Math.min(LABOUR_GROUP_SIZE, Math.floor((big?.size ?? 0) / 4))) : 1;
    if (big && big.size >= take + 1) exec({ type: 'transferSoldiers', fromTroopId: big.id, toTroopId: null, count: take });
    refresh();
  }
  // 5b. Late game: labour groups top up to a working crew from the biggest group (the front stays at least half).
  if (lateGame && state.troops.length >= 3) {
    const sorted = [...state.troops].sort((a, b) => b.size - a.size);
    const big = sorted[0]!;
    for (const t of sorted.slice(1)) {
      if (t.size >= LABOUR_GROUP_SIZE) continue;
      const total = soldiersNow();
      const give = Math.min(LABOUR_GROUP_SIZE - t.size, big.size - Math.ceil(total / 2));
      if (give > 0) exec({ type: 'transferSoldiers', fromTroopId: big.id, toTroopId: t.id, count: give });
      refresh();
    }
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
  // A recruit that waits only for food: foraging comes first (a player sees "needs 25 food" and sends a group).
  if (blocker === 'food' && state.troops.length >= 2) missing.sort((a, b) => (b.r === 'food' ? 1 : 0) - (a.r === 'food' ? 1 : 0));
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
  // Keep one group on a job only once.
  const seen = new Set<string>();
  const jobsWanted = econ.filter((j) => {
    const k = `${j.activity}:${j.siteId ?? ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const fight = can('combat') && bossesLeft;
  const fallback: Job = fight ? { activity: 'combat' } : gatherJob(state, content, 'food') && can('food') ? gatherJob(state, content, 'food')! : { activity: 'woodcutting' };
  const ordered = [...state.troops].sort((a, b) => b.size - a.size || a.id.localeCompare(b.id));
  const jobs: Job[] =
    ordered.length === 1
      ? // Alone: rescue the first companion, then follow the most urgent need and fight when nothing is missing.
        [fight && (state.combat.unlockedStage === 0 || jobsWanted.length === 0) ? { activity: 'combat' } : (jobsWanted[0] ?? fallback)]
      : strategy !== 'economy' && fight
        ? [{ activity: 'combat' }, ...jobsWanted]
        : jobsWanted;
  ordered.forEach((t, i) => {
    const job = jobs[i] ?? fallback;
    if (t.activity !== job.activity || (job.siteId && t.siteId !== job.siteId)) {
      exec({ type: 'assignTroop', troopId: t.id, activity: job.activity, siteId: job.siteId });
    }
  });

  // 7. Fight at the highest stage that costs no soldiers (a careful player). A group that is too weak for the
  // stage the strong groups can hold (the new group at level 1) goes back to work instead of dragging everyone
  // down to a low level: the army fights with the strongest groups that reach the highest safe stage.
  refresh();
  if (state.troops.some((t) => t.activity === 'combat') && !state.combat.boss) {
    const fighters = state.troops.filter((t) => t.activity === 'combat');
    const byLevel = [...fighters].sort((a, b) => troopStats(state, b, content).level - troopStats(state, a, content).level || b.size - a.size);
    const bestFor = (ids: string[]): number => {
      let best = 0;
      for (let i = 0; i <= state.combat.unlockedStage; i++) {
        if (stageSafety(state, content, { stageIndex: i }, ids).risk === 'safe') best = i;
      }
      return best;
    };
    let chosen = byLevel.length;
    let chosenBest = bestFor(byLevel.map((t) => t.id));
    for (let k = byLevel.length - 1; k >= 1; k--) {
      const b = bestFor(byLevel.slice(0, k).map((t) => t.id));
      if (b > chosenBest) {
        chosen = k;
        chosenBest = b;
      }
    }
    const economyFallback: Job = (gatherJob(state, content, 'food') && can('food') ? gatherJob(state, content, 'food')! : { activity: 'woodcutting' });
    for (const t of byLevel.slice(chosen)) exec({ type: 'assignTroop', troopId: t.id, activity: economyFallback.activity, siteId: economyFallback.siteId });
    if (chosenBest !== state.combat.stageIndex) exec({ type: 'selectStage', stageIndex: chosenBest });
  }

  // 8. Check-in player: the boss comes last, with everyone fighting.
  if (bossLast) {
    refresh();
    tryBoss();
  }
}

function wishDone(w: Wish, state: GameState): boolean {
  if (w.kind === 'upgrade') return (state.upgrades[w.id] ?? 0) > 0;
  const inProgress = state.construction?.buildingId === w.id && state.construction.level >= w.level;
  return (state.buildings[w.id] ?? 0) >= w.level || inProgress;
}

function wishUnlocked(w: Wish, state: GameState, content: Content): boolean {
  if (w.kind === 'upgrade') return state.unlocks.includes(`upgrade:${w.id}`);
  const req = content.buildings[w.id]?.levels[w.level - 1]?.requires;
  return state.unlocks.includes(`building:${w.id}`) && (state.buildings[w.id] ?? 0) === w.level - 1 && (!req || state.unlocks.includes(req));
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
      return { text: `👑 Boss ${e.index + 1} defeated`, milestone: e.index === 0 ? 'boss' : undefined };
    case 'bossFailed':
      return { text: `✖ Boss ${e.index + 1} attempt failed (${e.reason})` };
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
  const stage = state.combat.bossesDefeated >= z.bosses.length
    ? 'zone done'
    : state.combat.cleared
      ? `L${state.combat.unlockedStage + 1} boss`
      : `${state.combat.stageIndex + 1}/${state.combat.unlockedStage + 1}`;
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
