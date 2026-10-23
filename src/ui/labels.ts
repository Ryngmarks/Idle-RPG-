// Presentation text and icons. No game rules here: numbers always come from the core/content.

import { content } from '../content';
import type { IconId } from './art/resources';
import type { UiIconName } from './art/icons';
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
};

export const TRAIT_LABEL: Record<TraitId, string> = {
  horde: 'Horde: starkare ju fullare truppen är',
  raiders: 'Plundrare: mer mat och malm från strid',
  deepDelvers: 'Djupgruvor: mer malm',
  adaptable: 'Anpassningsbara: allround, bäst på mat',
};

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
    default:
      return null;
  }
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
      return `⚔️ Steg ${e.stage} rensat`;
    case 'zoneCleared':
      return `🏳️ ${content.zones[e.zoneId]?.name ?? ''}: alla steg rensade. Bossen väntar.`;
    case 'troopLevelUp':
      return `⭐ ${state.troops.find((t) => t.id === e.troopId)?.name ?? ''} nådde nivå ${e.level}`;
    case 'levelStep': {
      const name = state.troops.find((t) => t.id === e.troopId)?.name ?? '';
      return e.level === 5
        ? `🎖️ ${name} når nivå 5: veteraner. Alla i gruppen har +40 % kraft.`
        : `🎖️ ${name} når nivå 10: eliter. Alla i gruppen har +90 % kraft.`;
    }
    case 'bossDefeated':
      return '👑 Gamle Betarn är besegrad!';
    case 'bossFailed':
      return '✖ Bossen överlevde. Bli starkare och försök igen.';
    case 'bossAbandoned':
      return '↩ Bossstriden avbröts när du lämnade spelet.';
    case 'soldierLost':
      return `☠️ ${state.troops.find((t) => t.id === e.troopId)?.name ?? ''} förlorade en soldat`;
    case 'troopRetreated':
      return e.reason === 'losses'
        ? `↩ ${state.troops.find((t) => t.id === e.troopId)?.name ?? ''} retirerade till lägret efter tunga förluster`
        : `↩ ${state.troops.find((t) => t.id === e.troopId)?.name ?? ''} drog sig tillbaka när du lämnade spelet (inget steg var säkert)`;
    case 'stageChanged':
      return `↩ Trupperna drog sig tillbaka till steg ${e.stage}, det högsta säkra steget, medan du var borta`;
    case 'weaponCrafted':
      return null; // too frequent for the chronicle; summarised in reports
    case 'craftOrderCompleted': {
      const r = content.equipment.recipes[e.recipeId];
      return `⚒️ Smedjan är klar med beställningen: T${r?.tier ?? 1} ${content.equipment.weaponTypes[r?.weaponTypeId ?? '']?.name.toLowerCase() ?? ''}`;
    }
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
