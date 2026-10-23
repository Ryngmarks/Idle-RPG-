import { content } from '../../content';
import { currentEnemy, enemy, troopStats, zone, type GameState, type Rates } from '../../core';
import { QUALITY_COLOR } from '../labels';
import type { FieldSnap } from './types';

/** Reads derived numbers from the core and flattens them for the scene. No rules computed here. */
export function buildFieldSnap(state: GameState, rates: Rates): FieldSnap {
  const z = zone(state, content);
  const c = state.combat;
  const level = c.stageIndex + 1;
  const bands = z.bands ?? [];
  const band = Math.max(0, bands.findIndex((b) => level >= b.fromLevel && level <= b.toLevel));
  const boss = c.boss ? enemy(z.bosses[Math.min(c.boss.index, z.bosses.length - 1)]!.enemyId, content) : null;
  const foe = boss ?? currentEnemy(state, content);
  const fighters = state.troops.filter((t) => t.activity === 'combat');
  const troops = fighters.map((t) => {
    const st = troopStats(state, t, content);
    const per = rates.perTroop[t.id];
    return {
      id: t.id,
      name: t.name,
      size: t.size,
      wound: st.maxHp > 0 ? Math.max(0, Math.min(1, t.wounds / st.maxHp)) : 0,
      level: st.level,
      dps: boss ? per?.bossDps ?? 0 : (per?.killsPerSec ?? 0) * foe.hp,
      blade: t.equipment[0] ? QUALITY_COLOR[t.equipment[0].quality] : QUALITY_COLOR.normal,
      weaponId: t.weaponTypeId,
    };
  });
  const bossDef = c.boss ? z.bosses[Math.min(c.boss.index, z.bosses.length - 1)]! : null;
  return {
    raceId: state.raceId,
    band,
    level,
    troops,
    working: state.troops.filter((t) => t.activity !== null && t.activity !== 'combat').length,
    enemyId: foe.id,
    enemyName: foe.name,
    enemyHp: foe.hp,
    loot: Object.keys(foe.loot),
    killsPerSec: rates.killsPerSec,
    totalKills: state.stats.totalKills,
    aps: content.constants.attacksPerSecond,
    bossDps: rates.bossDps,
    boss: c.boss && bossDef ? { hpLeft: c.boss.hpLeft, hp: foe.hp, timeLeft: c.boss.timeLeft, limit: bossDef.timeLimitSec } : null,
  };
}
