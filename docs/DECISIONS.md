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
| D-14 | First session arc: *a small patrol → the beginning of a working settlement*. After 15 min: ~2 troops, ~12 soldiers, 1 building. No flood of content. | 2026-10-22 | Owner, v0.3 |
| D-15 | Core message: *"My troops are my most important resource; what I tell them to do shapes my realm."* | 2026-10-22 | Owner, v0.3 |
| D-16 | Troop 1 starts small (example: 5 / 20 soldiers). The troop card shows damage (DPS), work and current activity. | 2026-10-22 | Owner, v0.3 |
| D-17 | Progress is driven by **goals and dependencies, not timers** | 2026-10-22 | Owner, v0.3 |
| D-18 | Guided at first, then freedom after a few minutes. No forced fixed order through all five activities. | 2026-10-22 | Owner, v0.3 |
| D-19 | Combat feels different from gathering: enemies with HP, rewards (food + XP), progression | 2026-10-22 | Owner, v0.3 |
| D-20 | The first building is the **Training Camp** (example: 40 wood, 20 stone, 15 food, ~30–60 s of construction). It raises the troop cap and unlocks **Troop 2**. | 2026-10-22 | Owner, v0.3 |
| D-21 | Troop 2 arrives around **minute 10–15 of active play** and is the first big milestone. Later milestones (Troop 3, a new area) take considerably longer. | 2026-10-22 | Owner, v0.3 |
| D-22 | **Settlement as fixed plots** with named growth stages (was P-20 / Q-09) | 2026-10-22 | Owner, v0.4 |
| D-23 | **Dwarves & Elves are shown but locked** in the P0 race picker (was Q-10) | 2026-10-22 | Owner, v0.4 |
| D-24 | **Troop 2 forms with free soldiers**: 3 Humans / 6 Orcs (was Q-11) | 2026-10-22 | Owner, v0.4 |
| D-25 | Start M1–M2. Dev dependencies approved: `typescript`, `vitest`, `tsx` | 2026-10-22 | Owner, v0.4 |
| D-26 | **One weapon type per troop**; weapons have a **tier (T1–T8)** and a **quality**; a troop can mix qualities and possibly tiers | 2026-10-22 | Owner, v0.5 |
| D-27 | Equipment is **aggregated counts**, never individual soldier objects | 2026-10-22 | Owner, v0.5 |
| D-28 | **Albion Online-inspired** crafting & equipment (tiers, quality, crafting) | 2026-10-22 | Owner, v0.5 |
| D-29 | Tier progression is **very slow**: T1 lasts, T2 is a real milestone, T8 is an extreme long-term goal. Meaningful progress *within* a tier comes from quality, crafting, soldier count, specialisation and upgrades. | 2026-10-22 | Owner, v0.5 |
| D-30 | Tiers unlock through **progression, resources, developed buildings and crafting**, not just waiting | 2026-10-22 | Owner, v0.5 |
| D-31 | T1–T8 is a long-term structure. No PvP, no advanced race balancing. The first prototype stays very small. | 2026-10-22 | Owner, v0.5 |
| D-32 | **Start with a single soldier** (Humans and Orcs) who can only cut wood at first | 2026-10-23 | Owner, M4 feedback |
| D-33 | Troop 2 after **~15 minutes** of active play (the first version felt too fast) | 2026-10-23 | Owner, M4 feedback |
| D-34 | **Combat has life:** enemies hit back, soldiers can die, and the player picks a stage they can handle | 2026-10-23 | Owner, M4 feedback |
| D-35 | A troop **retreats to camp after losing half** its soldiers and **never drops below one soldier** | 2026-10-23 | Owner, M4 feedback |
| D-36 | **No losses while offline:** troops fall back to the highest safe stage (or camp) and an unfinished boss fight is abandoned when the player leaves | 2026-10-23 | Owner, M4 feedback |
| D-37 | **The forge produces actual weapons**, counted per type/tier/quality, never a troop-wide bonus | 2026-10-23 | Owner, M5 |
| D-38 | One weapon type per troop; every soldier can carry one weapon; mixed qualities within a troop; equip from a shared armoury | 2026-10-23 | Owner, M5 |
| D-39 | **Only T1** with five qualities for now; T2–T8 exist in the data model and plan but are not unlockable | 2026-10-23 | Owner, M5 |
| D-40 | Combat uses each troop's actual equipment; the ×1.4 placeholder is removed; T1 quality must take a long time to max out | 2026-10-23 | Owner, M5 |
| D-41 | **Troops do the smithing:** a sixth activity *Smithing* (unlocked by the forge). The forge only works while a troop smiths and an order is queued; speed = soldiers × work × race smithing skill × 0.1. Humans skill 1, Orcs 0.4 (Dwarves 3 later). | 2026-10-23 | Owner, M6 |
| D-42 | **Auto-equip per troop** (on by default): troops with Auto pool their weapons with the armoury and the fighting troops get the best first. Emptying a troop by hand turns Auto off. Runs after every command and every finished weapon, so offline equals online. | 2026-10-23 | Owner, M7 |
| D-43 | **The forge matters before the boss:** T1 metal weapons cost ore only (2 ore, no wood); `smithRate` 0.1 → 0.3 (M10a: one smith per anvil with `smithRate` 1 and 60 work per sword, D-47); mastery steps 8 → 20 weapons, so maxing T1 quality still takes ~2,000 weapons | 2026-10-23 | Owner, M8 |
| D-44 | **Chronicle statistics:** play time, boss time, kills, soldiers, recruited, fallen and weapons per quality. Stored in `state.stats` (save v6); losses and qualities count from v6 on. | 2026-10-23 | Owner, M9 |
| D-45 | **Soldiers come from beds and training, not a buy button:** a free bed (buildings), food and a short training time, one recruit at a time; both cost and time grow with every soldier. Plus rescues as milestones. | 2026-10-23 | Owner, progression v2 |
| D-46 | **Troop groups are slots, separate from soldiers:** the Training Camp opens group 2 (~15 min), the first boss frees two prisoners who form group 3. Soldiers can be moved between groups (each keeps ≥ 1). | 2026-10-23 | Owner, progression v2 |
| D-47 | **Activities are work cycles at work sites with capacity** (a tree, a block, a vein): the reward comes when the cycle completes; extra soldiers beyond a site's room do nothing there. Mining has two sites (stone / ore). Food = berries, fields (Farm) and hunting through combat loot. Builders and smiths have crew limits. | 2026-10-23 | Owner, progression v2 |
| D-48 | Every finished work cycle gives the group a little XP, so working groups develop too | 2026-10-23 | Owner, progression v2 |
| D-49 | Combat in Gårdarna is tuned for a handful of soldiers: the rat swarm becomes a fox, the boss has 500 HP and a 90 s limit | 2026-10-23 | Owner, progression v2 |
| D-50 | **Supersedes** D-14 (~12 soldiers after 15 min), D-16 (troop starts at ~5 / cap 20) and D-24 (Troop 2 forms with free soldiers). Target: ~2 soldiers at 15 min, 3–5 (Humans) at 30–40 min. | 2026-10-23 | Owner, progression v2 |
| D-51 | **Working method with agents:** the lead proposes a work split (task, agent, why, result, order, risks, cost) and waits for the owner's approval before starting agents or implementation. Agents: Game Designer, Game Systems, UI/UX, QA & Balance (sonnet), Research (haiku). See CLAUDE.md. | 2026-10-23 | Owner |
| D-52 | **UI and art direction (M10c):** the layout from docs/mockups/ui-v2.html (work cycle as the hero, a "what limits you now" strip, combat and forge cards) and the custom SVG art style from docs/mockups/art-style.html (shared palette, ink outlines, two-tone shading, glow only on rare or dangerous things). Own SVG instead of icon packs; the UI reads timers and limits from core helpers. | 2026-10-23 | Owner, M10c |
| D-53 | **M10b first-hour upgrade** as specified in PROGRESSION_V2 §16: new objectives (forge after two groups, tent 2, woodshed, optional ore and farm goals, forge 2), a rescue at stage 4 (+1 soldier; 6 Humans at 40 min accepted), stage 5 shortened, first mastery step at 10 weapons, more ore loot, second levels for forge and farm, woodshed, Sharp axes II, Stone picks II, level notices at 5 and 10. Old saves: no rescue soldier, no retroactive notices. | 2026-10-23 | Owner, M10b |
| D-54 | M10b follow-up: Forge II and Farm II are goals after the boss; armed ratio measured at the start of the boss fight; first mastery step at 6 weapons; food floor 4 % until upkeep; event-gap guard for the balanced bot only (Humans 4 min, Orcs 7 min) | 2026-10-23 | Owner, M10b |
| D-55 | **Food upkeep (M11):** every soldier but the first eats food per minute (Humans 0.5, Orcs 0.6); when food runs out and income is short, work slows to ×0.6 and attack to ×0.75 in proportion to the shortfall; food sites are exempt; nobody ever dies of hunger; offline uses the same rule. Feasts and rations later. Spec: PROGRESSION_V2 §17 | 2026-10-23 | Owner, M11 |
| D-56 | Food floor in the balance guard is per race: Humans 4 %, Orcs 8 % (Humans farm efficiently, D-13; higher Human upkeep only slowed them) | 2026-10-23 | Lead, delegated by owner |
| D-57 | **M12 gameplay polish** per PROGRESSION_V2 §18 with the recommendations: Orc horde +12.5 % attack per extra soldier, full +50 % at 5; Humans adaptable +25 % food and construction skill for troops of 3 or fewer; Orc raid objectives raid1/raid2; feast (after the Training Camp, 50 food + 15 wood, +15 % work / +10 % attack for 10 min, 20 min cooldown, never required); save v9. Also: install as app (PWA) without new dependencies | 2026-10-23 | Owner ("kör fullt ut"), M12 |
| D-58 | M12 tuning (balance pass 12): raid1 80 kills, raid2 130 kills; feast +25 % work / +25 % attack (the guessed +15 %/+10 % saved under 1.5 % against the spec target of 3–10 %). Can be reverted to +15 %/+10 % if the owner prefers a milder feast | 2026-10-23 | Lead, within the approved spec target; flagged to owner |

## Proposed 💡 (awaiting confirmation)

> **Progression v2 (2026-10-23):** approved and recorded as D-45–D-50; see [PROGRESSION_V2.md](PROGRESSION_V2.md).

| ID | Proposal | Details |
|---|---|---|
| P-01 | Race identity comes from six levers: overkill, armour, recruitment cost/cap, per-soldier gear cost, upkeep, activity skill profile + 1–2 traits | [Troop Model §2](TROOP_MODEL.md#2-the-central-design-problem-size--quality-must-not-cancel-out) |
| P-02 | Combat formula: `damagePerHit = atk²/(atk+armour)`, `hitsPerKill = max(1, hp/damagePerHit)` | [Troop Model §5.3](TROOP_MODEL.md#53-combat-the-overkillarmour-model) |
| P-03 | Race max troop size scales the cap. Barracks levels unlock the same *fraction* for every race. | [Troop Model §4.1](TROOP_MODEL.md#41-caps-are-race-scaled-but-progress-is-shared) |
| P-04 | Recruitment = manual purchase with food (+ ore per soldier when equipped) | [Troop Model §4.2](TROOP_MODEL.md#42-recruitment) |
| P-05 | Troops do not shrink (no casualties) in P0/P1 | |
| P-06 | Troop 3 is unlocked by defeating the start-area boss (Troop 2: see D-20) | [Troop Model §4.3](TROOP_MODEL.md#43-troop-slots) |
| P-07 | Resources: Food, Wood, Stone, Ore. **No gold** for now. | [Concept v0.2 §4](FANTASY_IDLE_RPG_CONCEPT_V0.2.md) |
| P-08 | Specialisation via **Doctrine** (chosen) first, in P1. Proficiency (learned) later, if at all. | [Troop Model §7](TROOP_MODEL.md#7-specialisation-p1-not-in-the-first-prototype) |
| P-09 | Event-driven `advance(state, Δt)`, the same code online and offline | [Architecture §4](ARCHITECTURE.md#4-simulation-model) |
| P-10 | Prototype P0 = Humans + Orcs (races ✅ D-12), 1 zone, 4 buildings, max 2 troops | [Roadmap §2](ROADMAP.md#2-prototype-p0-the-farmstead-camp) |
| P-11 | Build the headless core + simulator (M1–M2) before any UI | [Roadmap §3](ROADMAP.md#3-m1--m2-in-more-detail-recommended-next-step) |
| P-12 | Offline: no boss fights, no auto-recruitment, 8 h cap in P0 | [Troop Model §10](TROOP_MODEL.md#10-idle-and-offline-implications) |
| P-13 | Food upkeep in P1, **soft** only (efficiency loss, never deaths) | |
| P-14 | Code work happens on branches + PRs from M1 onward. Docs are pushed directly. | [Roadmap §4](ROADMAP.md#4-working-method-owner-on-mobile) |
| P-15 | Tutorial-scale base numbers: 1 attack and 1 work per soldier; gathering = work × skill × 0.1/s; Humans recruit for 5 food | [First 15 Minutes §2](FIRST_15_MINUTES.md#2-base-numbers-humans-tutorial-scale-) |
| P-16 | A data-driven **objectives system** is the tutorial, the unlock gate and the "what next?" list | [First 15 Minutes §4](FIRST_15_MINUTES.md#4-the-objectives-system-replaces-timers-and-a-tutorial-engine-) |
| P-17 | Troops gain **XP from combat → levels** (+10% Strength & Work per level) | [First 15 Minutes §2](FIRST_15_MINUTES.md#2-base-numbers-humans-tutorial-scale-) |
| P-18 | Cap levels start at 4% of the race max (Humans 20, Orcs 40). Training Camp → 8%. | [Troop Model §4.1](TROOP_MODEL.md#41-caps-are-race-scaled-but-progress-is-shared) |
| P-19 | The player names troops | [First 15 Minutes §7](FIRST_15_MINUTES.md#7-differences-from-the-previous-plan-v02) |
| P-21 | **Recruit cost escalates with troop size**: `foodPerSoldier × (size/startSize)^1.2` (found by the simulator; flat costs snowball) | [Balance Log](BALANCE_LOG.md) |
| P-22 | Tuned numbers: combat food loot ÷3, Training Camp 50/30/25 + 500 work, Orc construction 0.4 | [Balance Log](BALANCE_LOG.md) |
| P-23 | Pacing targets are enforced by an automated balance test (`tools/sim/balance.test.ts`) | [Balance Log](BALANCE_LOG.md) |
| P-24 | Equipment as **buckets** `(tier, quality) → count` per troop + a shared armoury; combat computed per bucket and summed | [Equipment §2–3](EQUIPMENT_AND_CRAFTING.md#2-core-model-) |
| P-25 | Five qualities (Normal → Masterpiece, ×1.00–×1.35); **Masterpiece of tier N ≈ Normal of tier N+1**; tiers ×1.35 each (T8 ≈ ×8.2) | [Equipment §2](EQUIPMENT_AND_CRAFTING.md#2-core-model-) |
| P-26 | Crafting in **batches**, with **deterministic quality distribution** (expected value + carry-over, no RNG) | [Equipment §4.2](EQUIPMENT_AND_CRAFTING.md#42-quality-outcome-deterministic-not-random-) |
| P-27 | **Crafting mastery** per weapon type and tier; T(n) mastery is one gate for T(n+1) | [Equipment §4.3](EQUIPMENT_AND_CRAFTING.md#43-crafting-mastery--albions-specialisation-simplified) |
| P-28 | Tier gates: region progress + Smithy level + tiered materials (+ refining from T2) + mastery; never a pure timer | [Equipment §4.5](EQUIPMENT_AND_CRAFTING.md#45-what-gates-a-tier-e-6-progression-not-waiting) |
| P-29 | **M2.5 Equipment foundation** before the UI: replace the `gearTier` placeholder (×1.4 = T2-level power after 25 min, which conflicts with D-29) | [Equipment §6.5, §7](EQUIPMENT_AND_CRAFTING.md#7-scope-what-to-build-when) |

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
| Q-12 | Should XP also be a spendable currency? | No, per-troop levels only |
| Q-13 | Who does crafting labour: a 6th activity "Crafting", the Construction activity, or the buildings themselves? | ✅ **A 6th activity, Smithing (D-41, M6).** The forge no longer works by itself. |
| Q-14 | T1 crafting in P0, or only the equipment foundation now and crafting in P1? | **Resolved: T1 crafting built in M5** |
| Q-15 | Do recruits come with a free T1 Normal weapon? | **No (M5): recruits arrive unarmed; arm them from the armoury** |
| Q-16 | Tier pacing targets (T2 ≈ day 1 … T8 ≈ many months) | Tie to Q-04 / Q-05 |
| Q-17 | Names for tiers and qualities | Our own, not Albion's |

## Superseded 🗄️

| Was | Now | Why |
|---|---|---|
| Flat recruit cost (5 food per Human soldier) | Escalating cost (P-21) | Simulator: armies snowballed (45 soldiers at 10 min instead of ~12) |
| Training Camp 40 wood / 20 stone / 15 food + 400 work (owner's example) | 50 / 30 / 25 + 500 work (P-22) | Simulator: Troop 2 came too early |


**From v0.1 to v0.2:**

| Was (v0.1) | Now (v0.2) | Why |
|---|---|---|
| March time between all activities | Free switching in the start area. Travel time only between regions, later. | Owner decision D-09/D-10 |
| 3 activities (Fight, Mine, Log) | 5 activities, including Food and Construction | D-05 |
| Resources Gold / Wood / Iron | Food / Wood / Stone / Ore | Food and Construction are now activities, and every resource has one clear use |
| MVG with 1 race | P0 with 2 races (Humans + Orcs) | Race contrast is now a core hypothesis (D-08) |
| Generic "troop group size + slots" | Explicit population model per race | D-04, D-08 |
| Start: Humans 10 / cap 50; first choice Barracks *or* Training Grounds | Humans 5 / cap 20; **Training Camp** gives cap + Troop 2 | D-16, D-20 |
| Tutorial = "a few hint texts" | Objectives system (P-16) | D-17, D-18 |
| Start-area chickens as the swarm example (HP 1) | Chickens are HP-30 tutorial enemies; the swarm example is now a rat swarm | D-19 |
| Upkeep: open, leaning "not in MVG" | Soft upkeep planned for P1 | Food is now an activity that needs a purpose beyond recruitment |
