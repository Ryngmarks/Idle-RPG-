import type { Content } from '../core/types';
import { races } from './races';
import { buildings, enemies, equipment, objectives, sites, upgrades, zones } from './world';

export const content: Content = {
  races,
  enemies,
  zones,
  buildings,
  upgrades,
  equipment,
  objectives,
  sites,
  constants: {
    trainFoodGrowth: 1.5,
    trainTimeGrowth: 1.35,
    crews: { construction: 3, smithing: 1 },
    workXp: 2,
    workMoment: 30,
    attacksPerSecond: 1,
    smithRate: 1,
    xpBase: 25,
    xpExponent: 1.7,
    levelBonus: 0.1,
    startZoneId: 'farmsteads',
    startUnlocks: ['activity:woodcutting'],
    feast: { cost: { food: Number(process.env.FC ?? 50), wood: Number(process.env.WC ?? 15) }, durationSec: 600, cooldownSec: 1200, workMult: Number(process.env.WM ?? 1.15), attackMult: Number(process.env.AM ?? 1.1), requiresBuilding: 'trainingCamp' },
  },
};
