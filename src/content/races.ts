// Race data. Numbers follow docs/TROOP_MODEL.md and docs/FIRST_15_MINUTES.md (tuning starting points).

import type { RaceDef } from '../core/types';

export const races: Record<string, RaceDef> = {
  humans: {
    id: 'humans',
    name: 'Människor',
    playable: true,
    population: { maxTroopSize: 500, startSize: 5, newTroopSize: 3, foodPerSoldier: 5 },
    soldier: {
      attack: 1,
      work: 1,
      armourPen: 0,
      skills: { mining: 1, woodcutting: 1, food: 1.5, construction: 1.2 },
    },
    modifiers: [],
    traits: ['adaptable'],
    troopNames: ['Norra Väktarna', 'Skogsarbetarna', 'Tredje Fanan', 'Fjärde Fanan'],
  },
  orcs: {
    id: 'orcs',
    name: 'Orcher',
    playable: true,
    population: { maxTroopSize: 1000, startSize: 10, newTroopSize: 6, foodPerSoldier: 1.25 },
    soldier: {
      attack: 0.4,
      work: 1,
      armourPen: 0,
      skills: { mining: 0.3, woodcutting: 0.7, food: 0.3, construction: 0.4 },
    },
    modifiers: [],
    traits: ['horde', 'raiders'],
    troopNames: ['Blodtänderna', 'Yxbröderna', 'Tredje Hjorden', 'Fjärde Hjorden'],
  },
  dwarves: {
    id: 'dwarves',
    name: 'Dvärgar',
    playable: false,
    population: { maxTroopSize: 200, startSize: 2, newTroopSize: 1, foodPerSoldier: 15 },
    soldier: {
      attack: 2.5,
      work: 1,
      armourPen: 0,
      skills: { mining: 3, woodcutting: 1, food: 0.8, construction: 3 },
    },
    modifiers: [],
    traits: ['deepDelvers'],
    troopNames: ['Stenvakten', 'Djupgruvan'],
  },
  elves: {
    id: 'elves',
    name: 'Alver',
    playable: false,
    population: { maxTroopSize: 150, startSize: 2, newTroopSize: 1, foodPerSoldier: 19 },
    soldier: {
      attack: 2.6,
      work: 1,
      armourPen: 0.5,
      skills: { mining: 1, woodcutting: 3.5, food: 3.5, construction: 1.5 },
    },
    modifiers: [],
    traits: [],
    troopNames: ['Lövskuggorna', 'Silverpilarna'],
  },
};
