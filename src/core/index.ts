// Public API of the game core.
export * from './types';
export * from './formulas';
export { newGame, cloneState, SAVE_VERSION } from './state';
export { dispatch, recruitCost, maxRecruitable, gearUpgradeCost, type Command, type CommandResult } from './commands';
export { advance, catchUp, secureForOffline, type AdvanceResult } from './simulation';
export { activeObjectives } from './objectives';
export { computeRates, troopStats, currentCap, capLevel, currentEnemy, estimatedBossDamage, stageSafety, zone, enemy, race, type Rates, type TroopStats, type Risk, type StageSafety } from './stats';
export { canAfford } from './mutations';
export { serialize, deserialize } from './save';
