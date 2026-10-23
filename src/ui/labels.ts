// Presentation text and icons. No game rules here: numbers always come from the core/content.

import { content } from '../content';
import type { ActivityKind, Effect, GameEvent, GameState, Modifier, ObjectiveCondition, ResourceId, TraitId } from '../core';

export const RESOURCE_LABEL: Record<ResourceId, { name: string; icon: string }> = {
  food: { name: 'Mat', icon: '🌾' },
  wood: { name: 'Ved', icon: '🪵' },
  stone: { name: 'Sten', icon: '🪨' },
  ore: { name: 'Malm', icon: '⛓️' },
};

export const ACTIVITY_LABEL: Record<ActivityKind, { name: string; icon: string; verb: string }> = {
  combat: { name: 'Strid', icon: '⚔️', verb: 'Strider' },
  mining: { name: 'Gruva', icon: '⛏️', verb: 'Bryter sten och malm' },
  woodcutting: { name: 'Ved', icon: '🪓', verb: 'Hugger ved' },
  food: { name: 'Mat', icon: '🌾', verb: 'Odlar och samlar mat' },
  construction: { name: 'Bygge', icon: '🔨', verb: 'Bygger' },
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
  foodPerSoldier: 'Rekryteringskostnad',
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

export function effectText(e: Effect, capForLevel: (level: number) => number): string {
  switch (e.kind) {
    case 'capLevel':
      return `Max ${capForLevel(e.level)} soldater per trupp`;
    case 'troopSlot':
      return 'En ny trupp kan bildas';
    case 'modifier':
      return modifierText(e.modifier);
    case 'unlock':
      return e.unlock === 'gear:1' ? 'Låser upp järnvapen för trupperna' : `Låser upp ${e.unlock}`;
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
    case 'troopSizeAtLeast':
      return { current: Math.min(c.size, Math.max(...state.troops.map((t) => t.size))), target: c.size };
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
      return `🚩 En ny trupp har bildats: ${state.troops.find((t) => t.id === e.troopId)?.name ?? ''}`;
    case 'constructionCompleted':
      return `🏰 ${content.buildings[e.buildingId]?.name ?? e.buildingId} färdigbyggd (nivå ${e.level})`;
    case 'stageCleared':
      return `⚔️ Steg ${e.stage} rensat`;
    case 'zoneCleared':
      return `🏳️ ${content.zones[e.zoneId]?.name ?? ''}: alla steg rensade. Bossen väntar.`;
    case 'troopLevelUp':
      return `⭐ ${state.troops.find((t) => t.id === e.troopId)?.name ?? ''} nådde nivå ${e.level}`;
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
  }
}

/** Purely cosmetic name for the settlement's growth stage (D-22). */
export function settlementStage(buildingsBuilt: number): { name: string; text: string } {
  if (buildingsBuilt === 0) return { name: 'Patrulläger', text: 'Några tält och en lägereld i utkanten av kungariket.' };
  if (buildingsBuilt === 1) return { name: 'Utpost', text: 'Ett träningsläger reser sig. Fler kan ansluta till din fana.' };
  if (buildingsBuilt <= 3) return { name: 'Befäst läger', text: 'Palissader, baracker och rök från härdarna.' };
  return { name: 'By', text: 'En fungerande bosättning, redo för större uppgifter.' };
}
