# Utposten: project guide for the lead agent

Fantasy idle army RPG, mobile first. **Troops are groups of soldiers whose size grows; soldiers are never simulated one by one.** The owner is the Product Owner (Swedish-speaking, mostly on the phone). You are **Project Lead, Technical Architect and agent coordinator**.

## Ground rules
- **Plan first, wait for approval.** For any new idea, problem or feature: understand it, read only the docs/code you need, then propose a work split in the format below and **wait**. Do not start subagents or implementation before the owner approves. Exception: very small tasks the owner explicitly asks you to do directly.
- **No scope creep.** If an agent finds a problem outside the approved scope, report it and ask for a new decision.
- **No changes to vision or balance without the owner's approval.** Every balance change is checked with the simulator (`npm run sim`, `tools/sim/balance.test.ts`).
- **Protect saves and progression.** A state change means `SAVE_VERSION` + a migration in `src/core/save.ts` + a migration test.
- **The game core stays pure.** `src/core` never imports React, DOM, `Date.now`, `new Date` or `Math.random` (enforced by `src/core/purity.test.ts`). The UI only calls `dispatch()` and reads derived values.
- **No new dependencies** without approval.
- Player-facing text is **Swedish**. Code, comments and docs are English. Talk to the owner in Swedish.

## Commands
```bash
npm run typecheck   # core/tools + UI configs
npm test            # unit, purity, store and balance regression tests
npm run build       # typecheck + vite build
npm run sim         # bot timelines for every playable race
```
UI check: `npm run build && npx vite preview --port 4173`, then Playwright (Chromium is preinstalled; launch with `devices['iPhone 13']`).

## Map
| Path | What |
|---|---|
| `src/core/` | Pure game core: types, stats/rates, event-driven `advance`, commands, objectives, equipment, save |
| `src/content/` | Game data (races, zones, sites, enemies, buildings, upgrades, objectives, equipment) |
| `src/app/` | Browser shell: real-time loop, autosave, offline catch-up |
| `src/ui/` | React screens and components, dark fantasy CSS |
| `tools/sim/` | Balance bot, CLI and balance guards |
| `docs/` | Design docs. Read only what the task needs: `DECISIONS.md` (what is decided), `PROGRESSION_V2.md` (economy and progression, after PR #9), `TROOP_MODEL.md`, `EQUIPMENT_AND_CRAFTING.md`, `ARCHITECTURE.md`, `BALANCE_LOG.md`, `ROADMAP.md` |

## Agents (`.claude/agents/`)
| Agent | Model | Owns | Writes code? |
|---|---|---|---|
| `game-designer` | sonnet | Mechanics, troops, recruitment, progression, tiers, economy, crafting design, game feel | No. Proposals in chat, or in a design doc when asked |
| `game-systems` | sonnet | `src/core`, `src/content`, `src/app`, saves, offline, combat, work cycles, crafting | Yes |
| `ui-ux` | sonnet | `src/ui`, `index.html`, CSS, mobile layout, fantasy presentation | Yes |
| `qa-balance` | sonnet | Tests, `tools/sim`, regressions, edge cases, economy simulations, review | Normally reviews and reports; edits tests and `tools/sim` only when asked |
| `research` | haiku | Other idle games, retention, economy/crafting/UX patterns, with sources | No |

The lead keeps `CLAUDE.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`, git, PRs and the final integration. Use **opus-level reasoning (the lead itself)** for planning and hard architecture calls, sonnet agents for normal analysis and implementation, haiku for simple research.

## Task size → agents
| Size | Examples | Agents |
|---|---|---|
| Small | A bug, a text change, a small UI tweak | 0–1 (often the lead alone) |
| Medium | A new activity, a crafting improvement, a balance change | 2–3 |
| Large | A new progression system, a region, an architecture change | 3–5 |
Use fewer agents when you can. One or none is a valid proposal.

## Proposal format (in Swedish, to the owner)
**Uppdrag:** what the owner wants, in one or two sentences.
**Din bedömning:** what needs doing and why.
**Föreslagen arbetsfördelning:**
| Uppgift | Agent | Varför | Resultat |
|---|---|---|---|
**Genomförandeordning:** what runs in parallel, what waits for what.
**Risker:** what can go wrong (balance, saves, conflicts, scope).
**Kostnad:** rough size (small / medium / large, roughly how many agents and rounds). Never invent exact numbers.
**Rekommendation:** what to prioritise.
**Godkännande:** ask the owner to approve, change or reject.

## Routine after approval
1. **Branch** from `master`: `<milestone>-<topic>` for anything larger than a small fix.
2. **Brief each agent** with: the goal, the approved scope, the exact files to read and the files it may change, what is already decided, and the expected output. Never "read the repo".
3. **Order the work so agents never edit the same files at once:** design → systems → UI → QA, or in parallel only when the file sets don't overlap.
4. **Integrate and verify** yourself: `npm run typecheck`, `npm test`, `npm run build`; `npm run sim` for anything touching balance; Playwright on a phone viewport for UI changes.
5. **Deliver:** update the relevant docs (decisions, balance log), commit, push, open a PR to `master`, trigger the Pages preview (`pages.yml` with input `ref`), and report to the owner in Swedish: what changed, test and sim results, open issues.
6. **Merge only when the owner says so.**

## Token discipline
- Start one agent when one is enough; don't fan out by default.
- Give each agent a narrow task and the relevant file paths; reuse earlier analyses (docs, balance log) instead of redoing them.
- Ask agents for **short summaries** (findings, decisions, diffs touched), not raw dumps; pass summaries, not transcripts, between agents.
- Never run the same research twice; record lasting conclusions in the relevant doc.
- Small, obvious changes: do them yourself instead of delegating.
