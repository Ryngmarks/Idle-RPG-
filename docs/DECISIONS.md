# Decision Log

> Single source of truth for what has been decided. Update this whenever a decision is made or changed.
> **Status:** ✅ Confirmed (by the owner) · 💡 Proposed (awaiting confirmation) · ❓ Open · 🗄️ Superseded

## Confirmed ✅

| ID | Decision | Date | Source |
|---|---|---|---|
| D-01 | Original fantasy IP, inspired by but not copying Tolkien | 2026-10-22 | Brief v0.1 |
| D-02 | Gameplay before graphics; static art, no complex animation initially | 2026-10-22 | Brief v0.1 |
| D-03 | Tech direction: React + TypeScript + Vite + PWA with a separate, framework-independent Game Core | 2026-10-22 | Owner, v0.2 |
| D-04 | **Troop ≠ soldier.** A troop is a group whose *size* grows (e.g. to 500). Soldiers are never simulated individually, and the UI never shows 500 rows. | 2026-10-22 | Owner, v0.2 |
| D-05 | Five activities: **Combat, Mining, Woodcutting, Food, Construction** | 2026-10-22 | Owner, v0.2 |
| D-06 | One activity per troop. Multiple troops work in parallel. | 2026-10-22 | Owner, v0.2 |
| D-07 | Troops can specialise and improve at certain activities | 2026-10-22 | Owner, v0.2 |
| D-08 | Races differ substantially in population size, strengths and weaknesses, far beyond "a few % damage" | 2026-10-22 | Owner, v0.2 |
| D-09 | Start area: one troop, free switching between the five activities | 2026-10-22 | Owner, v0.2 |
| D-10 | Travel time between regions, specialisations and advanced army management come *later* | 2026-10-22 | Owner, v0.2 |
| D-11 | Claude may create and update Markdown docs, commit and push documentation. **No large implementations or new dependencies without approval.** | 2026-10-22 | Owner, v0.2 |
| D-12 | **P0 races: Humans and Orcs** | 2026-10-22 | Owner, v0.2.1 |
| D-13 | **Humans are better at Food; Orcs are better at Woodcutting** | 2026-10-22 | Owner, v0.2.1 |

## Proposed 💡 (awaiting confirmation)

| ID | Proposal | Details |
|---|---|---|
| P-01 | Race identity comes from six levers: overkill, armour, recruitment cost/cap, per-soldier gear cost, upkeep, activity skill profile + 1–2 traits | [Troop Model §2](TROOP_MODEL.md#2-the-central-design-problem-size--quality-must-not-cancel-out) |
| P-02 | Combat formula: `damagePerHit = atk²/(atk+armour)`, `hitsPerKill = max(1, hp/damagePerHit)` | [Troop Model §5.3](TROOP_MODEL.md#53-combat-the-overkillarmour-model) |
| P-03 | Race max troop size scales the cap. Barracks levels unlock the same *fraction* for every race. | [Troop Model §4.1](TROOP_MODEL.md#41-caps-are-race-scaled-but-progress-is-shared) |
| P-04 | Recruitment = manual purchase with food (+ ore per soldier when equipped) | [Troop Model §4.2](TROOP_MODEL.md#42-recruitment) |
| P-05 | Troops do not shrink (no casualties) in P0/P1 | |
| P-06 | Troop 2 is unlocked by building Training Grounds. Troop 3 by defeating the start-area boss. | [Troop Model §4.3](TROOP_MODEL.md#43-troop-slots) |
| P-07 | Resources: Food, Wood, Stone, Ore. **No gold** for now. | [Concept v0.2 §4](FANTASY_IDLE_RPG_CONCEPT_V0.2.md) |
| P-08 | Specialisation via **Doctrine** (chosen) first, in P1. Proficiency (learned) later, if at all. | [Troop Model §7](TROOP_MODEL.md#7-specialisation-p1-not-in-the-first-prototype) |
| P-09 | Event-driven `advance(state, Δt)`, the same code online and offline | [Architecture §4](ARCHITECTURE.md#4-simulation-model) |
| P-10 | Prototype P0 = Humans + Orcs (races ✅ D-12), 1 zone, 4 buildings, max 2 troops | [Roadmap §2](ROADMAP.md#2-prototype-p0-the-farmstead-camp) |
| P-11 | Build the headless core + simulator (M1–M2) before any UI | [Roadmap §3](ROADMAP.md#3-m1--m2-in-more-detail-recommended-next-step) |
| P-12 | Offline: no boss fights, no auto-recruitment, 8 h cap in P0 | [Troop Model §10](TROOP_MODEL.md#10-idle-and-offline-implications) |
| P-13 | Food upkeep in P1, **soft** only (efficiency loss, never deaths) | |
| P-14 | Code work happens on branches + PRs from M1 onward. Docs are pushed directly. | [Roadmap §4](ROADMAP.md#4-working-method-owner-on-mobile) |

## Open ❓

| ID | Question | Notes / current lean |
|---|---|---|
| Q-01 | Do Orcs start at ~1000 soldiers, or start biggest and grow fastest? | Lean: start at 30, grow fast (keeps the growth reward) |
| Q-02 | Recruitment: manual purchase, continuous mustering, or both? | Lean: manual in P0, auto-recruit as a later upgrade |
| Q-03 | Should races have different *numbers* of troop slots (e.g. Elves many small, Orcs few huge)? | Strong identity, but doubles balancing. Lean: later. |
| Q-04 | Play rhythm: mostly idle (few short check-ins) or semi-active? | Affects offline cap, timers, cost curves |
| Q-05 | Long-term structure: one persistent realm, or prestige resets? | Affects number scale and race choice per save/run |
| Q-06 | Monetisation direction: premium or free-to-play? | Affects pacing |
| Q-07 | Documentation language: English (current) or Swedish? | |
| Q-08 | Final names for the world, races and regions | Before the art phase |

## Superseded 🗄️

| Was (v0.1) | Now (v0.2) | Why |
|---|---|---|
| March time between all activities | Free switching in the start area. Travel time only between regions, later. | Owner decision D-09/D-10 |
| 3 activities (Fight, Mine, Log) | 5 activities, including Food and Construction | D-05 |
| Resources Gold / Wood / Iron | Food / Wood / Stone / Ore | Food and Construction are now activities, and every resource has one clear use |
| MVG with 1 race | P0 with 2 races (Humans + Orcs) | Race contrast is now a core hypothesis (D-08) |
| Generic "troop group size + slots" | Explicit population model per race | D-04, D-08 |
| Upkeep: open, leaning "not in MVG" | Soft upkeep planned for P1 | Food is now an activity that needs a purpose beyond recruitment |
