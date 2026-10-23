// Presentation text and icons. No game rules here: numbers always come from the core/content.

import { content } from '../content';
import type { IconId } from './art/resources';
import type { UiIconName } from './art/icons';
import { masteryLevel } from '../core';
import type { ActivityKind, Effect, GameEvent, GameState, Modifier, ObjectiveCondition, QualityId, ResourceId, TraitId } from '../core';

/** Quality colours (grey → green → blue → purple → gold), readable on the dark theme. */
export const QUALITY_COLOR: Record<QualityId, string> = {
  normal: '#b8b2a6',
  good: '#6fbf5a',
  outstanding: '#4f9be0',
  excellent: '#b07ce8',
  masterpiece: '#f0a63a',
};
export const UNARMED_COLOR = '#4a4248';

export function qualityName(q: QualityId): string {
  return content.equipment.qualities.find((x) => x.id === q)?.name ?? q;
}

export const RESOURCE_LABEL: Record<ResourceId, { name: string }> = {
  food: { name: 'Mat' },
  wood: { name: 'Ved' },
  stone: { name: 'Sten' },
  ore: { name: 'Malm' },
  iron: { name: 'Järn' },
};

export const ACTIVITY_LABEL: Record<ActivityKind, { name: string; icon: UiIconName | IconId; verb: string }> = {
  combat: { name: 'Strid', icon: 'swords', verb: 'Strider' },
  mining: { name: 'Gruva', icon: 'pickaxe', verb: 'Bryter sten och malm' },
  woodcutting: { name: 'Ved', icon: 'axe', verb: 'Hugger ved' },
  food: { name: 'Mat', icon: 'wheat', verb: 'Odlar och samlar mat' },
  construction: { name: 'Bygge', icon: 'hammer', verb: 'Bygger' },
  smithing: { name: 'Smide', icon: 'anvil', verb: 'Smider vapen' },
};

export const BUILDING_ICON: Record<string, UiIconName> = {
  tents: 'tent',
  trainingCamp: 'trainingCamp',
  farm: 'farm',
  woodshed: 'woodshed',
  forge: 'anvil',
  barracks: 'barracks',
  drillGround: 'trainingCamp',
};

export const TRAIT_LABEL: Record<TraitId, string> = {
  horde: 'Hjordmod: +12,5 % anfall per kamrat i truppen, max +50 % vid fem.',
  raiders: 'Plundrare: mer mat och malm från strid',
  deepDelvers: 'Djupgruvor: mer malm',
  adaptable: 'Anpassningsbara: små trupper bygger och samlar mat 25 % snabbare (tre eller färre).',
};

/** Race card text: prefers the content's own wording, falls back to the generic label. */
export function traitText(r: { traitTexts?: Partial<Record<TraitId, string>> }, t: TraitId): string {
  return r.traitTexts?.[t] ?? TRAIT_LABEL[t];
}

const STAT_LABEL: Record<Modifier['stat'], string> = {
  attack: 'Styrka',
  work: 'Arbete',
  armourPen: 'Rustningsgenomträngning',
  'skill.mining': 'Gruvdrift',
  'skill.woodcutting': 'Vedhuggning',
  'skill.food': 'Matproduktion',
  'skill.construction': 'Byggande',
  'skill.smithing': 'Smide',
  'loot.food': 'Mat från strid',
  'loot.ore': 'Malm från strid',
  hp: 'Liv',
  regen: 'Läkning',
};

export function modifierText(m: Modifier): string {
  const sign = m.value >= 0 ? '+' : '−';
  const v = Math.abs(m.value);
  return m.op === 'mult' ? `${STAT_LABEL[m.stat]} ${sign}${Math.round(v * 100)} %` : `${STAT_LABEL[m.stat]} ${sign}${v}`;
}

export function effectText(e: Effect, bedMult = 1): string {
  switch (e.kind) {
    case 'beds': {
      const n = e.amount * bedMult;
      return `+${n} ${n === 1 ? 'säng' : 'sängar'} i lägret`;
    }
    case 'capacity':
      if (e.target === 'smithing') return `+${e.amount} städ i smedjan`;
      if (e.target === 'construction') return `+${e.amount} byggare per bygge`;
      return `+${e.amount} ${e.amount === 1 ? 'plats' : 'platser'}: ${content.sites[e.target]?.name ?? e.target}`;
    case 'troopSlot':
      return 'En ny truppgrupp kan bildas';
    case 'modifier':
      return modifierText(e.modifier);
    case 'unlock':
      if (e.unlock === 'crafting') return 'Låser upp vapensmide';
      if (e.unlock === 'recruit') return 'Utbilda rekryter';
      if (e.unlock.startsWith('site:')) return `Ny arbetsplats: ${content.sites[e.unlock.slice(5)]?.name ?? e.unlock.slice(5)}`;
      if (e.unlock.startsWith('tier:')) return `Låser upp T${e.unlock.slice(5)}-vapen`;
      if (e.unlock.startsWith('tab:')) return '';
      if (e.unlock.startsWith('activity:')) return `Ny aktivitet: ${ACTIVITY_LABEL[e.unlock.slice(9) as ActivityKind]?.name ?? e.unlock.slice(9)}`;
      return `Låser upp ${e.unlock}`;
  }
}

/** Presentation only: how far along an objective is, read from state. */
export function objectiveProgress(state: GameState, c: ObjectiveCondition): { current: number; target: number } | null {
  switch (c.kind) {
    case 'totalGathered':
      return { current: Math.min(c.amount, state.stats.gathered[c.resource]), target: c.amount };
    case 'kills':
      return { current: Math.min(c.amount, Math.floor(state.stats.totalKills)), target: c.amount };
    case 'recruited':
      return { current: Math.min(c.amount, state.stats.recruited), target: c.amount };
    case 'soldiersAtLeast':
      return { current: Math.min(c.count, state.troops.reduce((n, t) => n + t.size, 0)), target: c.count };
    case 'troopsAssigned':
      return { current: Math.min(c.count, state.troops.filter((t) => t.activity).length), target: c.count };
    case 'stageReached':
      return { current: Math.min(c.stage, state.combat.stageIndex + 1), target: c.stage };
    case 'levelReached':
      return { current: Math.min(c.level, state.combat.unlockedStage + 1), target: c.level };
    case 'bossDefeated':
      return { current: Math.min(c.index ?? 1, state.combat.bossesDefeated), target: c.index ?? 1 };
    case 'tierCrafted':
      return { current: Object.entries(state.crafting.crafted).some(([k, n]) => n > 0 && k.endsWith(`:t${c.tier}`)) ? 1 : 0, target: 1 };
    case 'masteryReached': {
      let best = 0;
      for (const [k, n] of Object.entries(state.crafting.crafted)) if (k.endsWith(':t1')) best = Math.max(best, masteryLevel(n, content));
      return { current: Math.min(c.level, best), target: c.level };
    }
    default:
      return null;
  }
}

/** Failure messages of a boss fight, by reason. */
export const BOSS_FAIL_TEXT = {
  time: 'Bossen höll stånd. Trupperna drar sig tillbaka.',
  wounds: 'Trupperna retirerade med sår. Ingen föll.',
} as const;

function bossName(zoneId: string, index: number): string {
  const id = content.zones[zoneId]?.bosses[index]?.enemyId;
  return (id && content.enemies[id]?.name) || `Boss ${index + 1}`;
}

/** Why a building level is locked by an unlock, in words (e.g. "Låses upp av boss 4"). */
export function unlockReason(unlock: string): string {
  const o = content.objectives.find((x) => x.rewards.unlocks?.includes(unlock));
  if (o?.condition.kind === 'bossDefeated') return `Låses upp av boss ${o.condition.index ?? 1}`;
  if (o) return `Låses upp av: ${o.text}`;
  return 'Låst';
}

export function eventText(e: GameEvent, state: GameState): string | null {
  switch (e.type) {
    case 'objectiveCompleted':
      return `✔ ${content.objectives.find((o) => o.id === e.objectiveId)?.text ?? e.objectiveId}`;
    case 'troopFormed':
      return `🚩 En ny truppgrupp har bildats: ${state.troops.find((t) => t.id === e.troopId)?.name ?? ''}`;
    case 'recruitTrained':
      return `🛡️ En ny rekryt är färdigutbildad och ansluter till ${state.troops.find((t) => t.id === e.troopId)?.name ?? ''}`;
    case 'soldiersJoined':
      return e.count === 1
        ? `✨ En räddad bonddräng ansluter till ${state.troops.find((t) => t.id === e.troopId)?.name ?? ''}`
        : `✨ ${e.count} befriade fångar ansluter: ${state.troops.find((t) => t.id === e.troopId)?.name ?? ''}`;
    case 'constructionCompleted':
      return `🏰 ${content.buildings[e.buildingId]?.name ?? e.buildingId} färdigbyggd (nivå ${e.level})`;
    case 'stageCleared':
      return `⚔️ Nivå ${e.stage} rensad`;
    case 'zoneCleared':
      return `🏳️ ${content.zones[e.zoneId]?.name ?? ''}: alla nivåer rensade.`;
    case 'bossReady':
      return `👑 En boss väntar: ${bossName(e.zoneId, e.index)}`;
    case 'troopLevelUp':
      return `⭐ ${state.troops.find((t) => t.id === e.troopId)?.name ?? ''} nådde nivå ${e.level}`;
    case 'foodEmpty':
      return '🌾 Maten är slut. Trupperna arbetar och slåss långsammare tills någon samlar mat.';
    case 'foodRestored':
      return '🌾 Maten räcker igen. Trupperna är mätta.';
    case 'levelStep': {
      const name = state.troops.find((t) => t.id === e.troopId)?.name ?? '';
      return e.level === 5
        ? `🎖️ ${name} når nivå 5: veteraner. Alla i gruppen har +40 % kraft.`
        : `🎖️ ${name} når nivå 10: eliter. Alla i gruppen har +90 % kraft.`;
    }
    case 'bossDefeated':
      return `👑 ${bossName(e.zoneId, e.index)} är besegrad! (Boss ${e.index + 1})`;
    case 'bossFailed':
      return e.reason === 'time' ? BOSS_FAIL_TEXT.time : BOSS_FAIL_TEXT.wounds;
    case 'bossAbandoned':
      return '↩ Bossstriden avbröts när du lämnade spelet.';
    case 'soldierLost':
      return `☠️ ${state.troops.find((t) => t.id === e.troopId)?.name ?? ''} förlorade en soldat`;
    case 'troopRetreated':
      return e.reason === 'losses'
        ? `↩ ${state.troops.find((t) => t.id === e.troopId)?.name ?? ''} retirerade till lägret efter tunga förluster`
        : `↩ ${state.troops.find((t) => t.id === e.troopId)?.name ?? ''} drog sig tillbaka när du lämnade spelet (inget steg var säkert)`;
    case 'stageChanged':
      return e.reason === 'autoAdvance'
        ? `➡️ Trupperna gick vidare till nivå ${e.stage}`
        : `↩ Trupperna drog sig tillbaka till nivå ${e.stage}, den högsta säkra nivån, medan du var borta`;
    case 'weaponCrafted':
      return null; // too frequent for the chronicle; summarised in reports
    case 'craftOrderCompleted': {
      const r = content.equipment.recipes[e.recipeId];
      return `⚒️ Smedjan är klar med beställningen: T${r?.tier ?? 1} ${content.equipment.weaponTypes[r?.weaponTypeId ?? '']?.name.toLowerCase() ?? ''}`;
    }
    case 'feastEnded':
      return 'Festen är över.';
    case 'masteryLevelUp':
      return `⚒️ Smideskunskap (${content.equipment.weaponTypes[e.weaponTypeId]?.name.toLowerCase() ?? ''} T${e.tier}) nådde nivå ${e.level}: bättre kvalitet`;
  }
}

/** Purely cosmetic name for the settlement's growth stage (D-22). */
export function settlementStage(buildingsBuilt: number): { name: string; text: string } {
  if (buildingsBuilt === 0) return { name: 'Patrulläger', text: 'Några tält och en lägereld i utkanten av kungariket.' };
  if (buildingsBuilt === 1) return { name: 'Utpost', text: 'Ett träningsläger reser sig. Fler kan ansluta till din fana.' };
  if (buildingsBuilt <= 3) return { name: 'Befäst läger', text: 'Palissader, baracker och rök från härdarna.' };
  return { name: 'By', text: 'En fungerande bosättning, redo för större uppgifter.' };
}
