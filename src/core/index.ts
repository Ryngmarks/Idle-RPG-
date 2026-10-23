// Public API of the game core.
export * from './types';
export * from './formulas';
export { newGame, cloneState, SAVE_VERSION } from './state';
export { dispatch, trainCost, trainBlocker, craftCost, maxCraftable, recipeAvailable, type Command, type CommandResult } from './commands';
export * from './equipment';
export { advance, catchUp, secureForOffline, type AdvanceResult } from './simulation';
export { activeObjectives } from './objectives';
export { computeRates, troopStats, smithingWork, beds, freeBeds, soldierCount, capacity, availableSites, currentEnemy, estimatedBossDamage, stageSafety, zone, enemy, race, type Rates, type TroopStats, type Risk, type StageSafety } from './stats';
export { limiters, secondsPerKill, secondsToNextCycle, type Limiter, type LimiterKind } from './limits';
export { canAfford } from './mutations';
export { serialize, deserialize } from './save';
