# Idle RPG (working title)

A fantasy idle army RPG for mobile and desktop. Your **troops** (groups of soldiers that grow from a handful to hundreds) fight, mine, cut wood, produce food and build your settlement. Your race decides how big your troops get and what they are good at.

> **Status:** M1–M2 done: a headless game core and a balance simulator. No UI yet.

## Documents

| Document | Contents |
|---|---|
| [Concept v0.2](docs/FANTASY_IDLE_RPG_CONCEPT_V0.2.md) | Vision, core loop, summary of all systems. **Start here.** |
| [First 15 Minutes](docs/FIRST_15_MINUTES.md) | The opening session minute by minute: goals, numbers, settlement presentation |
| [Troop Model](docs/TROOP_MODEL.md) | Troop size, soldier quality, races, recruitment, activities, formulas |
| [Equipment & Crafting](docs/EQUIPMENT_AND_CRAFTING.md) | Long-term T1–T8 tiers, quality, crafting, aggregated equipment model |
| [Architecture](docs/ARCHITECTURE.md) | Game core, simulation, data model, persistence, dependencies |
| [Roadmap & Prototype](docs/ROADMAP.md) | Milestones and the first playable prototype (P0) |
| [Balance Log](docs/BALANCE_LOG.md) | Simulator results and every tuning pass |
| [Decisions](docs/DECISIONS.md) | Confirmed, proposed and open decisions |
| [Concept v0.1 (archive)](docs/archive/FANTASY_IDLE_RPG_CONCEPT_V0.1.md) | Original discovery document |

## Code

```
src/core/      pure TypeScript game core (no UI, no DOM, no Date/Math.random)
src/content/   game data: races, enemies, zone, buildings, upgrades, objectives
tools/sim/     balance simulator: scripted bots play the game headlessly
```

```bash
npm install
npm test            # unit tests + core purity check + balance regression tests
npm run typecheck
npm run sim         # Humans vs Orcs, two strategies, milestone summary
npm run sim -- --race orcs --strategy balanced --log   # full timeline for one run
```

Planned UI tech (M3): React · Vite · PWA.
