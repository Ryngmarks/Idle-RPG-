// Derived values: global modifiers, troop stats and all rates.
// Nothing here is stored in the save; it is always recomputed from state + content.

import { averageWeaponPower, weaponGroups } from './equipment';
import { damagePerHit, dpsAgainst, killsPerSecond, levelForXp, resolveStat, troopCap } from './formulas';
import type {
  Content,
  EnemyDef,
  GameState,
  LabourActivity,
  Modifier,
  RaceDef,
  Resources,
  TroopState,
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

export function capLevel(state: GameState, content: Content): number {
  let level = 0;
  for (const [id, built] of Object.entries(state.buildings)) {
    const def = content.buildings[id];
    for (let l = 0; l < built; l++) {
      for (const e of def?.levels[l]?.effects ?? []) if (e.kind === 'capLevel') level = Math.max(level, e.level);
    }
  }
  return level;
}

/** Crafting work per second from built buildings with a craftSpeed effect. */
export function forgeSpeed(state: GameState, content: Content): number {
  let speed = 0;
  for (const [id, built] of Object.entries(state.buildings)) {
    const def = content.buildings[id];
    for (let l = 0; l < built; l++) {
      for (const e of def?.levels[l]?.effects ?? []) if (e.kind === 'craftSpeed') speed += e.workPerSec;
    }
  }
  return speed;
}

export function currentCap(state: GameState, content: Content): number {
  return troopCap(race(state, content).population.maxTroopSize, capLevel(state, content), content.constants.capLevelFractions);
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

export function troopStats(state: GameState, troop: TroopState, content: Content, mods = globalModifiers(state, content)): TroopStats {
  const r = race(state, content);
  const c = content.constants;
  const level = troopLevel(troop, content);
  const levelMult = 1 + c.levelBonus * (level - 1);

  // Racial traits that depend on the troop itself.
  const troopMods: Modifier[] = [];
  if (r.traits.includes('horde')) {
    const cap = currentCap(state, content);
    const fullness = cap > 0 ? Math.min(1, troop.size / cap) : 0;
    troopMods.push({ stat: 'attack', op: 'mult', value: 0.5 * fullness, source: 'trait:horde' });
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
  /** Resources per second from labour activities and combat loot. */
  resources: Resources;
  /** Resources per second from labour only (for "gathered" stats/objectives). */
  gathered: Resources;
  killsPerSec: number;
  constructionWorkPerSec: number;
  bossDps: number;
  /** XP per second per troop id. */
  xpPerSec: Record<string, number>;
  /** Forge work per second (0 when the queue is empty or there is no forge). */
  craftWorkPerSec: number;
  /** Net wounds per second per troop id: positive = taking damage, negative = healing. */
  woundsPerSec: Record<string, number>;
  /** Per-troop output, useful for UI and the simulator. */
  perTroop: Record<string, { killsPerSec: number; bossDps: number; output: Partial<Resources>; work: number }>;
}

export function emptyResources(): Resources {
  return { food: 0, wood: 0, stone: 0, ore: 0 };
}

export function computeRates(state: GameState, content: Content): Rates {
  const c = content.constants;
  const r = race(state, content);
  const mods = globalModifiers(state, content);
  const rates: Rates = {
    resources: emptyResources(),
    gathered: emptyResources(),
    killsPerSec: 0,
    constructionWorkPerSec: 0,
    bossDps: 0,
    xpPerSec: {},
    craftWorkPerSec: state.crafting.queue.length > 0 ? forgeSpeed(state, content) : 0,
    woundsPerSec: {},
    perTroop: {},
  };
  const foe = currentEnemy(state, content);
  const boss = state.combat.boss ? enemy(zone(state, content).boss.enemyId, content) : null;
  const oreShare = Math.min(0.9, c.miningOreShare + (r.traits.includes('deepDelvers') ? 0.15 : 0));
  const fighting = state.troops.filter((t) => t.activity === 'combat');
  const fightingSize = fighting.reduce((sum, t) => sum + t.size, 0);
  const incomingTotal = fightingSize > 0 ? (boss ?? foe).attack : 0;

  for (const t of state.troops) {
    const s = troopStats(state, t, content, mods);
    const entry = { killsPerSec: 0, bossDps: 0, output: {} as Partial<Resources>, work: 0 };
    rates.perTroop[t.id] = entry;
    const labour = (skill: number) => t.size * s.work * skill * c.gatherRate;
    switch (t.activity) {
      case 'combat':
        // Each weapon group (and the unarmed remainder) fights with its own attack: exact, O(groups).
        for (const g of weaponGroups(t, content)) {
          const atk = s.attack * g.power;
          if (boss) entry.bossDps += dpsAgainst(g.count, atk, s.armourPen, boss.armour, c.attacksPerSecond);
          else entry.killsPerSec += killsPerSecond(g.count, atk, s.armourPen, foe, c.attacksPerSecond);
        }
        rates.bossDps += entry.bossDps;
        rates.killsPerSec += entry.killsPerSec;
        break;
      case 'mining': {
        const total = labour(s.skills.mining);
        entry.output = { stone: total * (1 - oreShare), ore: total * oreShare };
        break;
      }
      case 'woodcutting':
        entry.output = { wood: labour(s.skills.woodcutting) };
        break;
      case 'food':
        entry.output = { food: labour(s.skills.food) };
        break;
      case 'construction':
        entry.work = state.construction ? t.size * s.work * s.skills.construction : 0;
        rates.constructionWorkPerSec += entry.work;
        break;
      case null:
        break;
    }
    for (const [res, v] of Object.entries(entry.output) as [keyof Resources, number][]) {
      rates.gathered[res] += v;
      rates.resources[res] += v;
    }
    // Damage is shared by the fighting troops in proportion to their size; everyone heals.
    const incoming = t.activity === 'combat' && fightingSize > 0 ? (incomingTotal * t.size) / fightingSize : 0;
    const net = incoming - s.healPerSec;
    rates.woundsPerSec[t.id] = net < 0 && t.wounds <= 0 ? 0 : net;
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
      if (k > 0) rates.xpPerSec[t.id] = k * foe.xp;
    }
  }
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
  const foe = target === 'boss' ? enemy(z.boss.enemyId, content) : enemy(z.stages[Math.min(target.stageIndex, z.stages.length - 1)]!.enemyId, content);
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

/** Convenience used by the UI/simulator: would the current combat troops beat the boss? */
export function estimatedBossDamage(state: GameState, content: Content, troopIds?: string[]): { damage: number; hp: number } {
  const z = zone(state, content);
  const b = enemy(z.boss.enemyId, content);
  const mods = globalModifiers(state, content);
  let dps = 0;
  for (const t of state.troops) {
    if (troopIds ? !troopIds.includes(t.id) : t.activity !== 'combat') continue;
    const s = troopStats(state, t, content, mods);
    for (const g of weaponGroups(t, content)) {
      dps += g.count * content.constants.attacksPerSecond * damagePerHit(s.attack * g.power, b.armour, s.armourPen);
    }
  }
  return { damage: dps * z.boss.timeLimitSec, hp: b.hp };
}
