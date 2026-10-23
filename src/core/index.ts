// Public API of the game core.
export * from './types';
export * from './formulas';
export { newGame, cloneState, SAVE_VERSION } from './state';
export { dispatch, recruitCost, maxRecruitable, gearUpgradeCost, type Command, type CommandResult } from './commands';
export { advance, catchUp, type AdvanceResult } from './simulation';
export { activeObjectives } from './objectives';
export { computeRates, troopStats, currentCap, capLevel, currentEnemy, estimatedBossDamage, type Rates, type TroopStats } from './stats';
export { serialize, deserialize } from './save';
