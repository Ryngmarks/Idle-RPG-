import type { Content } from '../core/types';
import { races } from './races';
import { buildings, enemies, equipment, objectives, upgrades, zones } from './world';

export const content: Content = {
  races,
  enemies,
  zones,
  buildings,
  upgrades,
  equipment,
  objectives,
  constants: {
    recruitExponent: 1.2,
    capLevelFractions: [0.04, 0.08, 0.15, 0.3, 0.5, 0.75, 1],
    gatherRate: 0.1,
    attacksPerSecond: 1,
    smithRate: 0.3,
    miningOreShare: 0.25,
    xpBase: 30,
    xpExponent: 1.8,
    levelBonus: 0.1,
    startZoneId: 'farmsteads',
    startUnlocks: ['activity:woodcutting'],
  },
};
