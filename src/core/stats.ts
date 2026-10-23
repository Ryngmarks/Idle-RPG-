// Derived values: global modifiers, troop stats and all rates.
// Nothing here is stored in the save; it is always recomputed from state + content.

import { averageWeaponPower, weaponGroups } from './equipment';
import { damagePerHit, dpsAgainst, killsPerSecond, levelForXp, resolveStat } from './formulas';
import type {
  ActivityKind,
  Content,
  Effect,
  EnemyDef,
  GameState,
  LabourActivity,
  Modifier,
  RaceDef,
  Resources,
  TroopState,
  WorkSiteDef,
  ZoneDef,
} from './types';

export function race(state: GameState, content: Content): RaceDef {
  const r = content.races[state.raceId];
  if (!r) throw new Error(`Unknown race ${state.raceId}`);
  return r;
}

export function zone(state: GameState, content: Content): ZoneDef {
  const z = content.zones[state.combat.zoneId];
  if (!z) throw new Error(`Unknown zone ${state.combat.zoneId}`);
  return z;
}

export function enemy(id: string, content: Content): EnemyDef {
  const e = content.enemies[id];
  if (!e) throw new Error(`Unknown enemy ${id}`);
  return e;
}

/** The enemy the combat troops are currently farming. */
export function currentEnemy(state: GameState, content: Content): EnemyDef {
  const z = zone(state, content);
  const i = Math.min(state.combat.stageIndex, z.stages.length - 1);
  const stage = z.stages[i];
  if (!stage) throw new Error(`Zone ${z.id} has no stages`);
  return enemy(stage.enemyId, content);
}

/** The boss the troops would fight next (bosses are fought in order), or null when the zone has none left. */
export function nextBoss(state: GameState, content: Content): { index: number; level: number; timeLimitSec: number; enemy: EnemyDef } | null {
  const z = zone(state, content);
  const def = z.bosses[state.combat.bossesDefeated];
  return def ? { index: state.combat.bossesDefeated, level: def.level, timeLimitSec: def.timeLimitSec, enemy: enemy(def.enemyId, content) } : null;
}

/** During a boss fight a troop's wounds stop short of a lost soldier: bosses are not lethal (docs/PROGRESSION_V2.md §19.2). */
export const BOSS_WOUND_CAP = 0.99;
/** The fight is lost when the fighting troops' wounds reach this share of their max HP. */
export const BOSS_RETREAT_SHARE = 0.5;

/** Modifiers from race, completed buildings and bought upgrades. */
export function globalModifiers(state: GameState, content: Content): Modifier[] {
  const mods: Modifier[] = [...race(state, content).modifiers];
  for (const [id, level] of Object.entries(state.buildings)) {
    const def = content.buildings[id];
    if (!def) continue;
    for (let l = 0; l < level; l++) {
      for (const e of def.levels[l]?.effects ?? []) if (e.kind === 'modifier') mods.push(e.modifier);
    }
  }
  for (const [id, level] of Object.entries(state.upgrades)) {
    if (level > 0) mods.push(...(content.upgrades[id]?.modifiers ?? []));
  }
  return mods;
}

/** Effects of every completed building level. */
function buildingEffects(state: GameState, content: Content): Effect[] {
  const out: Effect[] = [];
  for (const [id, built] of Object.entries(state.buildings)) {
    const def = content.buildings[id];
    for (let l = 0; l < built; l++) out.push(...(def?.levels[l]?.effects ?? []));
  }
  return out;
}

/** Soldiers in every troop group. */
export function soldierCount(state: GameState): number {
  return state.troops.reduce((n, t) => n + t.size, 0);
}

/** The first soldier of the whole army eats for free. */
export const FREE_SOLDIERS = 1;
/** Hunger at zero coverage: work speed loses 40 %, attack 25 % (owner decision, D-55). */
export const HUNGER_WORK_PENALTY = 0.4;
export const HUNGER_ATTACK_PENALTY = 0.25;
export const FOOD_EPS = 1e-9;

/** The Feast is running (clock seconds; its end is an event boundary in `advance`). */
export function feastActive(state: GameState): boolean {
  return state.feast.until > state.clock + 1e-9;
}

/** Food per second the army eats. Recruits in training are not soldiers yet and do not eat. */
export function upkeepPerSec(state: GameState, content: Content): number {
  const n = Math.max(0, soldierCount(state) - FREE_SOLDIERS);
  return (race(state, content).population.upkeep * n) / 60;
}

/** Beds in the camp: the race's start beds plus what buildings add (× the race's bed multiplier). */
export function beds(state: GameState, content: Content): number {
  const r = race(state, content);
  const built = buildingEffects(state, content).reduce((n, e) => n + (e.kind === 'beds' ? e.amount : 0), 0);
  return r.population.startBeds + built * r.population.bedMult;
}

/** Beds nobody sleeps in, counting the recruit in training. */
export function freeBeds(state: GameState, content: Content): number {
  return beds(state, content) - soldierCount(state) - (state.training ? 1 : 0);
}

/** How many soldiers can work a site (or build / smith) at once, across all troop groups. */
export function capacity(state: GameState, content: Content, target: string): number {
  const c = content.constants;
  const base = target === 'construction' ? c.crews.construction : target === 'smithing' ? c.crews.smithing : (content.sites[target]?.capacity ?? 0);
  return base + buildingEffects(state, content).reduce((n, e) => n + (e.kind === 'capacity' && e.target === target ? e.amount : 0), 0);
}

/** Sites in the current zone a troop may work for this activity, in default order. */
export function availableSites(state: GameState, content: Content, activity: ActivityKind): WorkSiteDef[] {
  return zone(state, content)
    .sites.map((id) => content.sites[id])
    .filter((s): s is WorkSiteDef => !!s && s.activity === activity && (!s.unlock || state.unlocks.includes(s.unlock)));
}

export function troopLevel(troop: TroopState, content: Content): number {
  return levelForXp(troop.xp, content.constants.xpBase, content.constants.xpExponent);
}

export interface TroopStats {
  level: number;
  /** Effective per-soldier values. `attack` is before weapons; `weaponMult` is the troop's average weapon power. */
  attack: number;
  weaponMult: number;
  armourPen: number;
  work: number;
  skills: Record<LabourActivity, number>;
  /** HP and healing per soldier. */
  hp: number;
  regen: number;
  /** Headline numbers shown on the troop card. */
  strength: number;
  workTotal: number;
  maxHp: number;
  healPerSec: number;
}

/** Forge work per second a troop would give at the anvils (ignoring other smiths and the queue). */
export function smithingWork(state: GameState, troop: TroopState, content: Content): number {
  const s = troopStats(state, troop, content);
  return Math.min(troop.size, capacity(state, content, 'smithing')) * s.work * s.skills.smithing * content.constants.smithRate;
}

export function troopStats(state: GameState, troop: TroopState, content: Content, mods = globalModifiers(state, content)): TroopStats {
  const r = race(state, content);
  const c = content.constants;
  const level = troopLevel(troop, content);
  const levelMult = 1 + c.levelBonus * (level - 1);

  // Racial traits that depend on the troop itself.
  const troopMods: Modifier[] = [];
  const horde = r.traitParams?.horde;
  if (r.traits.includes('horde') && horde) {
    // A horde hits harder the more of it there is in one group (Orcs: +12.5 % per comrade, full +50 % at five).
    const bonus = Math.min(horde.cap, horde.perSoldier * (troop.size - 1));
    if (bonus > 0) troopMods.push({ stat: 'attack', op: 'mult', value: bonus, source: 'trait:horde' });
  }
  const adaptable = r.traitParams?.adaptable;
  if (r.traits.includes('adaptable') && adaptable && troop.size <= adaptable.maxSize) {
    // Small troops adapt fast: more food and building skill (Humans).
    troopMods.push({ stat: 'skill.food', op: 'mult', value: adaptable.bonus, source: 'trait:adaptable' });
    troopMods.push({ stat: 'skill.construction', op: 'mult', value: adaptable.bonus, source: 'trait:adaptable' });
  }
  const all = troopMods.length ? [...mods, ...troopMods] : mods;

  // Per-soldier attack before weapons; each weapon group multiplies it by its weapon's power.
  const attack = resolveStat(r.soldier.attack, 'attack', all) * levelMult;
  const weaponMult = averageWeaponPower(troop, content);
  const work = resolveStat(r.soldier.work, 'work', all) * levelMult;
  const skills = {
    mining: resolveStat(r.soldier.skills.mining, 'skill.mining', all),
    woodcutting: resolveStat(r.soldier.skills.woodcutting, 'skill.woodcutting', all),
    food: resolveStat(r.soldier.skills.food, 'skill.food', all),
    construction: resolveStat(r.soldier.skills.construction, 'skill.construction', all),
    smithing: resolveStat(r.soldier.skills.smithing, 'skill.smithing', all),
  };
  const armourPen = Math.min(1, resolveStat(r.soldier.armourPen, 'armourPen', all));
  const hp = resolveStat(r.soldier.hp, 'hp', all) * levelMult;
  const regen = resolveStat(r.soldier.regen, 'regen', all) * levelMult;
  return {
    level,
    attack,
    armourPen,
    work,
    skills,
    hp,
    regen,
    weaponMult,
    strength: troop.size * attack * weaponMult * c.attacksPerSecond,
    workTotal: troop.size * work,
    maxHp: troop.size * hp,
    healPerSec: troop.size * regen,
  };
}

export interface Rates {
  /** Resources per second that flow continuously (combat loot). */
  resources: Resources;
  /** Average resources per second from work cycles (paid out a whole cycle at a time). */
  gathered: Resources;
  /** Everything per second on average: `resources` + `gathered`. For display and planning. */
  income: Resources;
  /** Work cycles per second per work site. */
  siteCycles: Record<string, number>;
  killsPerSec: number;
  constructionWorkPerSec: number;
  bossDps: number;
  /** XP per second per troop id. */
  xpPerSec: Record<string, number>;
  /** Forge work per second (0 when the queue is empty or there is no forge). */
  craftWorkPerSec: number;
  /** Net wounds per second per troop id: positive = taking damage, negative = healing. */
  woundsPerSec: Record<string, number>;
  /** Food the army eats per second (constant between events). */
  upkeepPerSec: number;
  /** Net continuous food flow per second that `advance` integrates: loot minus upkeep, clamped so the stock never goes below 0. Site payouts come on top, a whole cycle at a time. */
  foodPerSec: number;
  /** Food stock is 0 and average income is below upkeep. */
  hungry: boolean;
  /** min(1, income / upkeep); below 1 only while hungry. */
  coverage: number;
  /** Multipliers hunger puts on work speed (not food sites) and attack; 1 when not hungry. */
  workMult: number;
  attackMult: number;
  /** The Feast is on; its work (all work, food sites too) and attack multipliers, 1 when off. They multiply with the hunger ones. */
  feastActive: boolean;
  feastWorkMult: number;
  feastAttackMult: number;
  /** Per-troop output, useful for UI and the simulator. */
  perTroop: Record<string, { killsPerSec: number; bossDps: number; output: Partial<Resources>; work: number; working: number; siteId: string | null }>;
}

export function emptyResources(): Resources {
  return { food: 0, wood: 0, stone: 0, ore: 0, iron: 0 };
}

export function computeRates(state: GameState, content: Content): Rates {
  const upkeep = upkeepPerSec(state, content);
  const feast = feastActive(state);
  const fw = feast ? content.constants.feast.workMult : 1;
  const fa = feast ? content.constants.feast.attackMult : 1;
  let rates = computeBase(state, content, 1, 1, fw, fa);
  rates.upkeepPerSec = upkeep;
  const stock = state.resources.food;
  if (upkeep > 0 && stock <= FOOD_EPS && rates.income.food < upkeep - 1e-12) {
    // Hungry. Coverage uses average income only (never the discrete payouts). Food sites are exempt from the
    // work penalty; loot depends on attack, so solve c = (F + (1 - a·(1 - c))·L) / u for c.
    let sites = 0;
    for (const t of state.troops) if (t.activity === 'food') sites += rates.perTroop[t.id]?.output.food ?? 0;
    const loot = rates.resources.food;
    const a = HUNGER_ATTACK_PENALTY;
    const c = Math.max(0, Math.min(1, (sites + (1 - a) * loot) / (upkeep - a * loot)));
    const workMult = 1 - HUNGER_WORK_PENALTY * (1 - c);
    const attackMult = 1 - a * (1 - c);
    rates = computeBase(state, content, workMult, attackMult, fw, fa);
    rates.upkeepPerSec = upkeep;
    rates.hungry = true;
    rates.coverage = c;
    rates.workMult = workMult;
    rates.attackMult = attackMult;
    rates.foodPerSec = 0; // pinned at 0: income is eaten as it arrives
    return rates;
  }
  rates.coverage = upkeep > 0 ? Math.min(1, rates.income.food / upkeep) : 1;
  const loot = rates.resources.food;
  rates.foodPerSec = stock > FOOD_EPS ? loot - upkeep : Math.max(0, loot - upkeep);
  return rates;
}

function computeBase(state: GameState, content: Content, hungerWork: number, hungerAttack: number, feastWork: number, feastAttack: number): Rates {
  const c = content.constants;
  const r = race(state, content);
  const mods = globalModifiers(state, content);
  const rates: Rates = {
    resources: emptyResources(),
    gathered: emptyResources(),
    income: emptyResources(),
    siteCycles: {},
    killsPerSec: 0,
    constructionWorkPerSec: 0,
    bossDps: 0,
    xpPerSec: {},
    craftWorkPerSec: 0,
    woundsPerSec: {},
    upkeepPerSec: 0,
    foodPerSec: 0,
    hungry: false,
    coverage: 1,
    workMult: 1,
    attackMult: 1,
    feastActive: feastWork !== 1 || feastAttack !== 1,
    feastWorkMult: feastWork,
    feastAttackMult: feastAttack,
    perTroop: {},
  };
  const workMult = hungerWork * feastWork;
  const attackMult = hungerAttack * feastAttack;
  const foe = currentEnemy(state, content);
  const bossDef = state.combat.boss ? zone(state, content).bosses[state.combat.boss.index] : undefined;
  const boss = bossDef ? enemy(bossDef.enemyId, content) : null;
  const fighting = state.troops.filter((t) => t.activity === 'combat');
  const fightingSize = fighting.reduce((sum, t) => sum + t.size, 0);
  const incomingTotal = fightingSize > 0 ? (boss ?? foe).attack : 0;

  // Sites, builders and anvils have room for a limited number of soldiers, filled in troop order.
  const used: Record<string, number> = {};
  const take = (target: string, wanted: number) => {
    const n = Math.max(0, Math.min(wanted, capacity(state, content, target) - (used[target] ?? 0)));
    used[target] = (used[target] ?? 0) + n;
    return n;
  };
  const addXp = (id: string, xp: number) => (rates.xpPerSec[id] = (rates.xpPerSec[id] ?? 0) + xp);

  for (const t of state.troops) {
    const s = troopStats(state, t, content, mods);
    const entry = { killsPerSec: 0, bossDps: 0, output: {} as Partial<Resources>, work: 0, working: 0, siteId: null as string | null };
    rates.perTroop[t.id] = entry;
    switch (t.activity) {
      case 'combat':
        // Each weapon group (and the unarmed remainder) fights with its own attack: exact, O(groups).
        for (const g of weaponGroups(t, content)) {
          const atk = s.attack * g.power * attackMult;
          if (boss) entry.bossDps += dpsAgainst(g.count, atk, s.armourPen, boss.armour, c.attacksPerSecond);
          else entry.killsPerSec += killsPerSecond(g.count, atk, s.armourPen, foe, c.attacksPerSecond);
        }
        entry.working = t.size;
        rates.bossDps += entry.bossDps;
        rates.killsPerSec += entry.killsPerSec;
        break;
      case 'mining':
      case 'woodcutting':
      case 'food': {
        const site = t.siteId ? content.sites[t.siteId] : undefined;
        if (!site || !availableSites(state, content, t.activity).includes(site)) break;
        entry.siteId = site.id;
        entry.working = take(site.id, t.size);
        // Each working soldier finishes a cycle every cycleSec / (work × skill) seconds.
        const cycles = (entry.working * s.work * s.skills[t.activity] * (t.activity === 'food' ? feastWork : workMult)) / site.cycleSec;
        rates.siteCycles[site.id] = (rates.siteCycles[site.id] ?? 0) + cycles;
        for (const [res, v] of Object.entries(site.yield) as [keyof Resources, number][]) entry.output[res] = v * cycles;
        addXp(t.id, cycles * c.workXp);
        break;
      }
      case 'construction':
        if (!state.construction) break;
        entry.working = take('construction', t.size);
        entry.work = entry.working * s.work * s.skills.construction * workMult;
        rates.constructionWorkPerSec += entry.work;
        addXp(t.id, (entry.work / c.workMoment) * c.workXp);
        break;
      case 'smithing':
        // Smiths work only while there is an order; the anvils limit how many can work.
        if (state.crafting.queue.length === 0) break;
        entry.working = take('smithing', t.size);
        entry.work = entry.working * s.work * s.skills.smithing * c.smithRate * workMult;
        rates.craftWorkPerSec += entry.work;
        addXp(t.id, (entry.work / c.workMoment) * c.workXp);
        break;
      case null:
        break;
    }
    for (const [res, v] of Object.entries(entry.output) as [keyof Resources, number][]) rates.gathered[res] += v;
    // Damage is shared by the fighting troops in proportion to their size; everyone heals.
    const incoming = t.activity === 'combat' && fightingSize > 0 ? (incomingTotal * t.size) / fightingSize : 0;
    const net = incoming - s.healPerSec;
    const capped = net > 0 && state.combat.boss && t.wounds >= s.hp * BOSS_WOUND_CAP - 1e-9;
    rates.woundsPerSec[t.id] = (net < 0 && t.wounds <= 0) || capped ? 0 : net;
  }

  // Combat loot and XP (farming only; boss rewards are milestones, not loot).
  if (rates.killsPerSec > 0) {
    const lootFood = resolveStat(foe.loot.food ?? 0, 'loot.food', withRaiders(r, mods));
    const lootOre = resolveStat(foe.loot.ore ?? 0, 'loot.ore', withRaiders(r, mods));
    rates.resources.food += rates.killsPerSec * lootFood;
    rates.resources.ore += rates.killsPerSec * lootOre;
    rates.resources.wood += rates.killsPerSec * (foe.loot.wood ?? 0);
    rates.resources.stone += rates.killsPerSec * (foe.loot.stone ?? 0);
    for (const t of state.troops) {
      const k = rates.perTroop[t.id]?.killsPerSec ?? 0;
      if (k > 0) addXp(t.id, k * foe.xp);
    }
  }
  for (const r of Object.keys(rates.income) as (keyof Resources)[]) rates.income[r] = rates.resources[r] + rates.gathered[r];
  return rates;
}

function withRaiders(r: RaceDef, mods: Modifier[]): Modifier[] {
  if (!r.traits.includes('raiders')) return mods;
  return [
    ...mods,
    { stat: 'loot.food', op: 'mult', value: 0.5, source: 'trait:raiders' },
    { stat: 'loot.ore', op: 'mult', value: 0.5, source: 'trait:raiders' },
  ];
}

export type Risk = 'safe' | 'risky' | 'deadly';

export interface StageSafety {
  risk: Risk;
  /** Net damage per second for the whole group (≤ 0 means no losses). */
  netDamagePerSec: number;
  /** Seconds until the first soldier falls (Infinity if safe). */
  secondsToFirstLoss: number;
}

/**
 * How dangerous a stage (or the boss) would be for the given troops, all fighting together.
 * Used by the UI risk badges, by offline safety and by the simulator. Ignores current wounds
 * except for the time to the first loss.
 */
export function stageSafety(
  state: GameState,
  content: Content,
  target: { stageIndex: number } | 'boss',
  troopIds: string[] = state.troops.filter((t) => t.activity === 'combat').map((t) => t.id),
): StageSafety {
  const z = zone(state, content);
  const bossDef = z.bosses[Math.min(state.combat.bossesDefeated, z.bosses.length - 1)];
  const foe = target === 'boss' ? enemy(bossDef!.enemyId, content) : enemy(z.stages[Math.min(target.stageIndex, z.stages.length - 1)]!.enemyId, content);
  const mods = globalModifiers(state, content);
  const troops = state.troops.filter((t) => troopIds.includes(t.id));
  const total = troops.reduce((sum, t) => sum + t.size, 0);
  if (total === 0) return { risk: 'safe', netDamagePerSec: 0, secondsToFirstLoss: Infinity };
  let worstNet = -Infinity;
  let firstLoss = Infinity;
  let groupNet = 0;
  for (const t of troops) {
    const s = troopStats(state, t, content, mods);
    const net = (foe.attack * t.size) / total - s.healPerSec;
    groupNet += net;
    worstNet = Math.max(worstNet, net);
    if (net > 0) firstLoss = Math.min(firstLoss, Math.max(0, s.hp - t.wounds) / net);
  }
  const risk: Risk = worstNet <= 0 ? 'safe' : firstLoss >= 120 ? 'risky' : 'deadly';
  return { risk, netDamagePerSec: groupNet, secondsToFirstLoss: firstLoss };
}

export interface BossEstimate {
  /** 0-based index of the boss that would be fought (the next one); -1 when every boss has fallen. */
  index: number;
  hp: number;
  timeLimitSec: number;
  /** Damage per second the chosen troops deal to the boss, and the dps needed to kill it within the time limit. */
  dps: number;
  neededDps: number;
  /** dps x time limit, to compare with `hp`. */
  damage: number;
  /** Seconds until the fighting troops have lost half their HP (Infinity when they out-heal the boss). */
  secondsToRetreat: number;
  /** The boss falls before both the timer and the retreat point (hunger and the Feast are included). */
  canWin: boolean;
}

/**
 * Convenience used by the UI/simulator: would the given troops (default: the combat troops) beat the next boss?
 * Includes the current hunger and Feast multipliers on attack.
 */
export function estimatedBossDamage(state: GameState, content: Content, troopIds?: string[]): BossEstimate {
  const nb = nextBoss(state, content);
  if (!nb) return { index: -1, hp: 0, timeLimitSec: 0, dps: 0, neededDps: 0, damage: 0, secondsToRetreat: Infinity, canWin: false };
  const b = nb.enemy;
  const mods = globalModifiers(state, content);
  const rates = computeRates(state, content);
  const attackMult = rates.attackMult * rates.feastAttackMult;
  let dps = 0;
  let maxHp = 0;
  let wounds = 0;
  let heal = 0;
  for (const t of state.troops) {
    if (troopIds ? !troopIds.includes(t.id) : t.activity !== 'combat') continue;
    const s = troopStats(state, t, content, mods);
    for (const g of weaponGroups(t, content)) {
      dps += g.count * content.constants.attacksPerSecond * damagePerHit(s.attack * g.power * attackMult, b.armour, s.armourPen);
    }
    maxHp += s.maxHp;
    wounds += t.wounds;
    heal += s.healPerSec;
  }
  const net = maxHp > 0 ? b.attack - heal : 0;
  const secondsToRetreat = net > 0 ? Math.max(0, (BOSS_RETREAT_SHARE * maxHp - wounds) / net) : Infinity;
  const timeToKill = dps > 0 ? b.hp / dps : Infinity;
  return {
    index: nb.index,
    hp: b.hp,
    timeLimitSec: nb.timeLimitSec,
    dps,
    neededDps: b.hp / nb.timeLimitSec,
    damage: dps * nb.timeLimitSec,
    secondsToRetreat,
    canWin: timeToKill <= nb.timeLimitSec && timeToKill < secondsToRetreat,
  };
}
