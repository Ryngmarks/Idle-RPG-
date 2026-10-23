# Progression & Economy v2: work cycles, slow soldiers, troop groups

> **Status:** ✅ Approved by the owner on 2026-10-23 (every recommendation in §13: D-45–D-50). **M10a implemented**, see §15.
> **Prototype:** `tools/sim/proposal/workcycles.ts` (standalone model, not used by the game): `npx tsx tools/sim/proposal/workcycles.ts humans|orcs`
> **Related:** [Troop Model](TROOP_MODEL.md) · [First 15 Minutes](FIRST_15_MINUTES.md) · [Equipment](EQUIPMENT_AND_CRAFTING.md) · [Balance Log](BALANCE_LOG.md) · [Decisions](DECISIONS.md)

Legend: ✅ confirmed by the owner · 💡 new proposal · ❓ open question · ⚠️ risk

---

## 0. Summary

| | Today (master, bot) | Proposal (prototype bot) |
|---|---|---|
| Soldiers after 15 / 30 min, and at the boss (Humans) | 26 / 87 / 106 (boss at 34 min) | **2 / 5 / 7** (boss at 47 min) |
| Troop groups | 2 from ~11 min | 1 → **2 at ~15 min** → **3 from the boss** |
| How the economy produces | `size × work × skill × 0.1` per second, unlimited | **Work cycles** (a tree, a block, a vein) with **site capacity** |
| How soldiers arrive | Food button, +1 / +10 / Max | **Rescues** (milestones) + **training** (food + time + a free bed) |
| Boss (Humans / Orcs) | 34 / 42 min | **47 / 56 min**, +19 % |

**Recommendation in one sentence:** break the loop "soldiers make food → food buys soldiers" by making soldier count depend on **beds (buildings) and training time**, and make each soldier produce through **concrete work cycles at work sites with limited capacity**, so one soldier feels like one woodcutter and 500 soldiers need 500 places to work.

---

## 1. Diagnosis: why soldiers grow too fast today

The core of the current economy (`src/core/stats.ts`, `src/core/formulas.ts`):

- Every gathering activity produces **`size × work × skill × gatherRate`** per second: linear in troop size, with no ceiling.
- The k-th soldier costs **`5 × max(1, k/5)^1.2`** food (Humans).

Soldiers are paid for with what soldiers produce. Production grows like *n*, cost like *n*^1.2, so the time to the next soldier grows only like *n*^0.2. That is close to **exponential growth**, damped a little. Raising the cost or lowering production only moves the curve: it is the same snowball, just later. This is why the owner is right that "just raise costs" will not work.

Other things that push the same way:

| Mechanism | Effect |
|---|---|
| Combat food loot also scales with troop size | A second food source that grows with soldiers |
| Troop cap levels are fractions of 500 (4 %, 8 %, 15 % → 20, 40, 75) | The caps *invite* dozens of soldiers within the first half hour |
| Content is tuned for big numbers | Rat swarm (1 HP × 1,500 kills) and the 7,000 HP boss only work with ~100 soldiers. **The combat content must be rescaled together with any soldier change.** |
| `Max` button | Buying 40 soldiers at once is the opposite of "every soldier matters" |

---

## 2. Goals and constraints

### Confirmed ✅
- Start with **one soldier** who can only cut wood at first (D-32).
- Troop ≠ soldier; soldiers are never simulated individually (D-04, D-27).
- One activity per troop group; groups work in parallel (D-06).
- Troop 2 around **minute 15** of active play (D-33). Progress driven by goals, not timers (D-17).
- Combat has life, retreat at half losses, never below 1, no offline losses (D-34–D-36).
- T1 is a long, slow tier; T2 is a real milestone (D-29, D-39).
- Offline progress must work and match online play.

### New owner goals (this review)
- **About 3–5 soldiers after 30–40 minutes**, in one or two groups (a target, not a hard limit).
- **Every new soldier should feel significant.** Soldiers 1, 2, 3 and 5 are moments.
- Activities are **work cycles with concrete rewards**: a felled tree gives wood when it falls.
- The same system must scale from 1 to hundreds of soldiers per group, without 500 soldiers on one tree.
- Recruitment is not a button that buys hundreds.
- The first boss can give **a new group and/or rescued soldiers**.
- The game must stay **active and rewarding** without artificial slowness.

### Decisions this proposal would supersede ⚠️ (owner must confirm)
| Old | Why it conflicts | Proposed replacement |
|---|---|---|
| D-14: ~12 soldiers after 15 min | New target: ~2 at 15 min, 3–5 at 30–40 | P-V2-01 |
| D-16: troop starts at ~5 / cap 20 | Single soldier, beds instead of size caps | P-V2-05 |
| D-24: Troop 2 forms with 3 / 6 free soldiers | Soldiers are too precious to hand out like that | Group 2 starts with a soldier you move (P-V2-07) |
| D-05: five activities | Smithing is already a sixth (D-41) | Unchanged in this proposal; listed for completeness |

---

## 3. The model in one picture

```
            ┌──────────── BEDS (housing) ────────────┐
            │  Camp 2 · Tent +1 · Training Camp +1 … │  ← built with wood/stone (construction)
            └────────────────────┬───────────────────┘
                                 │ a free bed is required
 RESCUES (milestones) ──┐        ▼
                        ├──► SOLDIERS ──► TROOP GROUPS (slots from buildings/boss)
 TRAINING (food+time) ──┘                       │ one activity each
                                                ▼
              WORK SITES with CAPACITY  ── cycles ──►  wood · stone · ore · food · weapons
              (forest 3, quarry 2, vein 1, berries 2, fields 3, anvil 1, builders 3)
                                                │
                                   COMBAT (uncapped) ──► food, ore, XP, stage progress, boss
```

Three separate limits replace the single snowball:
1. **Beds** cap the number of soldiers. Beds come from buildings, so soldier growth follows construction, not food.
2. **Training time** paces soldiers inside that cap (one at a time per training camp).
3. **Site capacity** caps what soldiers can produce in one area. Extra soldiers are free for combat, other sites, or other regions.

---

## 4. Work cycles per activity 💡

One soldier completes a cycle in the listed time (divided by the race skill and upgrades). The reward arrives **when the cycle completes**.

| Activity | Work site (Gårdarna) | Cycle (1 soldier, skill 1) | Reward per cycle | Capacity | Upgrades / later |
|---|---|---|---|---|---|
| **Woodcutting** | *Björkdungen* (birch grove) | Fell a tree: **30 s** | **5 wood** | 3 | *Sharp axes* −33 % time · *Sawmill* +capacity · later forests: bigger trees (more wood per cycle, longer cycle) |
| **Mining: stone** | *Gamla stenbrottet* (old quarry) | Break a block: **40 s** | **4 stone** | 2 | *Stone picks* −25 % time |
| **Mining: ore** | *Malmådern* (ore vein) | Work the vein: **60 s** | **2 ore** | 1 | *Stone picks* −25 % · deeper veins in later regions give better ore (T2 materials) |
| **Food: gathering** | *Bärsnåren* (berry thickets) | Forage: **20 s** | **2 food** | 2 | Available from the start of Food |
| **Food: farming** | *Åkrarna* (fields; after the Farm) | Tend and harvest a plot: **60 s** | **9 food** | 3 | *Farm* unlocks, *Field kitchens* +yield; bigger farms later |
| **Food: hunting** | (combat loot) | Each kill | Food per enemy type | uncapped | Hunting *is* combat in Gårdarna; no separate activity needed |
| **Construction** | The building project | Work moments of **30 s** | Building done after N moments | 3 builders per project | *Carpentry* +speed |
| **Smithing** | The forge's **anvil** | T1 sword: **60 s** + 2 ore | 1 weapon to the armoury | 1 anvil (forge level 2: 2) | Quality from mastery (unchanged) |
| **Combat** | Current stage | Continuous (DPS vs HP) | Loot + XP per kill; stage progress | **uncapped** | The place where big armies matter |

**Why these numbers:** with one soldier the first reward comes within **20–30 seconds**, and something completes every half minute. That keeps the first minutes active even though soldiers arrive slowly. The numbers are starting points that the prototype shows to be roughly consistent (§8), not final balance.

**Mining as two sites** 💡: the player chooses stone or ore. Today mining always gives 75 % stone and 25 % ore. Separate sites make the forge's ore a real decision, and the single-capacity vein makes ore the deliberately scarce T1 material. The alternative, one site whose cycle gives "4 stone + every 4th cycle 1 ore", is simpler for the UI but removes that decision.

**Food** 💡: recommend **Gathering → Farming** (building upgrade) **+ Hunting via combat**. Hunting as its own activity would duplicate combat. ⚠️ The prototype shows a risk: combat loot alone feeds a small army, so the Food activity is almost unused (1–2 % of time). See §12.

**Work XP** 💡: every finished cycle gives the group a little XP (prototype: 2 XP per cycle), and combat gives more. Without it, a group that only works never levels up and the boss check fails for no good reason. It also gives "my troops develop" a meaning outside combat.

---

## 5. Scaling: 1, 2, 5 and hundreds of soldiers

### 5.1 Options compared

| Option | 1 → 500 soldiers on "one tree" | Logic | Offline cost | Verdict |
|---|---|---|---|---|
| **A. More soldiers = faster cycle** on one shared object | 500 soldiers fell a tree in 0.06 s → unlimited output | Breaks immersion and the economy | O(1) | ❌ Only for **one-off projects**: construction, boss |
| **B. Parallel cycles** (each soldier works their own tree) | 500 parallel trees = 500× output | Logical | O(1) per site | ✅ but needs a cap |
| **C. Site capacity** (a grove has room for 3 woodcutters) | Extra soldiers do nothing at that site | Logical, readable ("3 of 5 working") | O(1) | ✅ the cap for B |
| **D. Better regions = bigger capacity and richer resources** | Large armies need large lands | Gives exploration a purpose | O(sites) | ✅ the long-term lever |
| E. Diminishing returns (√n) | Smooth but invisible | Hard to explain to players | O(1) | ❌ opaque |

**Recommendation: B + C + D, with A only for construction (capped builders) and combat.**

- Gathering: `cycles per second = min(soldiers, free capacity) × skill / cycleTime`.
- Construction: shared work with a builder cap (3 in Gårdarna; more with better tools and buildings).
- Combat: uncapped. **This is where numbers shine**, which keeps the horde fantasy and the Orc identity.
- Capacity grows with **buildings** (Sawmill, Mine shaft, more fields) and **regions** (a forest region might have a grove for 40 woodcutters). Hundreds of soldiers become useful when there are hundreds of places to work, or enemies big enough to need them.

### 5.2 What 1, 2, 5 and hundreds look like

| Soldiers | Woodcutting in Gårdarna (capacity 3, 30 s, 5 wood) | Feel |
|---|---|---|
| 1 | One tree every 30 s = 10 wood/min, a visible progress bar per tree | "My woodcutter is chopping" |
| 2 | Two trees in parallel = 20 wood/min | The new soldier doubles output: a big moment |
| 5 | 3 chop (30 wood/min), **2 idle**; the UI says "Björkdungen is full: 3 of 5 working" | A nudge to split groups or send the rest to fight |
| 100s | The grove gives the same 30 wood/min; real output needs a Sawmill, a forest region, and several groups | Growth is **wide** (more sites, regions, groups), not just tall |

### 5.3 Simulation and offline (fits the current event-driven core) ✅

- Rates stay **piecewise constant**: `min(n, free capacity)` only changes when soldiers, assignments, capacity or upgrades change. These are the same kinds of events `advance()` already handles.
- **Discrete rewards** without per-soldier simulation: each site keeps one **progress counter** in cycles. `advance(dt)` adds `rate × dt` and pays out `floor(progress)` cycles, then keeps the remainder. Offline over 8 hours is one multiplication per site: O(sites), not O(soldiers) or O(cycles).
- Capacity shared by several groups at one site is filled in a fixed order (fighting groups first, then troop order), which is deterministic, like auto-equip.
- The UI shows a progress bar per site with 1–3 workers, and "N trees/min" with many.

---

## 6. Recruitment v2 💡

### 6.1 Three sources of soldiers
1. **Rescues and milestones (free, story):** soldier 2 is *"a lost farmhand"* who joins after the first stage is cleared. The boss frees **two prisoners**. Later quests can rescue more. This is the strongest emotional source.
2. **Training at the Training Camp (repeatable):** needs a **free bed**, **food** and **training time**. One recruit at a time per camp (a second camp or a Barracks upgrade could allow two).
3. **Later, not P0:** hiring with gold, a racial "call to arms" (Orcs), heroes.

### 6.2 Costs (prototype values, Humans)

| Soldier # | Source | Food | Training time | Needs |
|---|---|---|---|---|
| 1 | Start | – | – | – |
| 2 | Rescued (stage 1 cleared, ~5 min) | – | – | Free bed (camp has 2) |
| 3 | Trained | 20 | 1 min 30 s | Training Camp + a bed (camp +1) |
| 4 | Trained | 30 | 2 min | Tent 2 |
| 5 | Trained | 45 | 2 min 45 s | Bed |
| 6 | Trained | 68 | 3 min 40 s | Tent 3 |
| 7–8 | Boss: 2 freed prisoners | – | – | Beds from boss reward |

Formula: `food = 20 × 1.5^(k−3)`, `time = 90 s × 1.35^(k−3)`, where k is the soldier's number in the whole army. These are **counted per army, not per group**, so splitting groups does not make soldiers cheaper.

**Why beds and not a bigger food cost:** a bed is a building, and buildings need wood, stone and construction work. Soldier growth therefore pulls the whole economy (woodcutting, mining, building) instead of only food. That is the "activities hang together" the owner asked for, and it is what breaks the snowball: more soldiers do not build beds faster once sites are full.

### 6.3 How soldiers 1, 2, 3 and 5 should feel
- **Soldier 1 (0:00):** alone at the edge of the farmsteads. The first tree falls after 30 s: *"+5 wood"*. Every action is visible.
- **Soldier 2 (~5 min):** a reward, not a purchase. Clearing the chickens frees a farmhand, with a named toast and a second figure in the art. Output doubles at once.
- **Soldier 3 (~17 min):** the **first soldier you train**. The Training Camp is your first big building; the bar fills over 90 s while you watch, then the recruit walks in. The first time the player makes a soldier.
- **Soldier 5 (~29 min):** has to be planned: a second tent (beds), 45 food, and almost three minutes of training. Five soldiers is a full grove plus a fighter: the first time capacity matters.
- **Later:** each soldier stays a decision (bed + food + time) until regions and buildings scale beds and training into the dozens and hundreds (§10).

### 6.4 Races 💡
| | Humans | Orcs |
|---|---|---|
| Beds | Camp 2, tent +1 | Camp 3, tent **+2** (orcs pile into tents) |
| Training | Normal food and time | **×0.6 food and time**: hordes grow faster |
| Per soldier | Stronger (atk 1, hp 10), good at food (1.4), building (1.2) | Weaker (atk 0.75, hp 8), **better woodcutters (1.3)** ✅ D-13, weaker at food (0.8) |
| Prototype at 30 / 45 min | 5 / 6 soldiers | 6 / 7–8 soldiers |

This keeps D-08 and D-13 (Orcs: more and weaker; Humans: fewer and better at food) at small numbers. The **×2 soldiers** identity grows over time as bed and training multipliers compound. The race skills need a retune (Orcs woodcutting 0.7 → 1.3): with capacity limits, a horde can no longer make up for bad skills just by being big.

---

## 7. Troop groups 💡

**Soldiers and groups are separate:** groups are **slots** (how many activities run in parallel); soldiers are **people** you place in them.

| Group | Unlock | When (prototype) | Why |
|---|---|---|---|
| 1 | Start | 0:00 | – |
| 2 | **Training Camp** ✅ (D-20/D-33) | ~15 min | The first parallel decision: one group fights, one gathers or builds |
| 3 | **First boss**: the freed prisoners form a new group | ~47 min | The boss reward the owner liked; a natural step into region 2 |
| 4+ | Barracks levels, region milestones, quests | Hours | Long-term |

**Recommendation: keep group 2 from the Training Camp and give group 3 from the boss**, rather than making the boss the *first* way to get group 2.

- **Why not group 2 only from the boss:** 40–50 minutes with one group means one activity at a time. Every building would need the same soldiers to gather wood, then stone, then build, then fight. The prototype's single-group phase (5–15 min) is already the most switch-heavy part. Stretching it to the boss makes the core decision of P0 ("how do I split my groups?", Roadmap §2.1 Q3) impossible for most of the first hour.
- **The owner's idea still fits:** the boss gives a whole new group *with its own soldiers* (two freed prisoners). That is a stronger reward than an empty slot.

**New command needed: move soldiers between groups** (`transferSoldiers`, min 1 per group). With 2–8 soldiers the player must be able to put the third soldier where it is needed. Today soldiers are locked to their troop and new troops arrive with free soldiers (D-24).

---

## 8. Simulated progression (prototype) 💡

The prototype models §4–§7 with a careful bot that acts every 5 seconds. Like the current balance bot, it is faster than a real player; with work cycles most time is spent waiting for cycles rather than reacting, so a real player is probably **~1.2–1.5×** slower.

### 8.1 Humans

| Time | Event |
|---|---|
| 01:35 | Sharp axes (15 wood) |
| 03:15 | Combat unlocked (30 wood gathered) |
| 05:30 | Stage 1 cleared → **soldier 2 rescued** |
| 07:41 | Tent 1 |
| 10:05 | Stone picks |
| 15:10 | **Training Camp** → **group 2** |
| 18:20 | **Soldier 3** trained (20 food, 90 s) |
| 21:57 | Soldier 4 |
| 22:30 | Stage 3 |
| 28:59 | **Soldier 5** |
| 33:55 | Forge |
| 40:21 | Stage 5 |
| 46:45 | **Boss** → two prisoners form **group 3** (7 soldiers) |

| Min | Soldiers | Groups | Stage | Armed | Levels |
|---|---|---|---|---|---|
| 5 | 1 | 1 | 0/5 | 0 | 2 |
| 10 | 2 | 1 | 1/5 | 0 | 3 |
| 15 | 2 | 1 → 2 | 1/5 | 0 | 3 |
| 20 | 3 | 2 | 2/5 | 0 | 4 / 1 |
| 30 | **5** | 2 | 3/5 | 0 | 6 / 3 |
| 40 | **5** | 2 | 4/5 | 5 | 7 / 3 |
| 50 | 8 | 3 | boss ✓ | 7 | 9 / 4 / 1 |

Share of soldier-time until the boss: combat 52 %, stone 17 %, wood 16 %, building 8 %, smithing 6 %, food 1 % ⚠️.

### 8.2 Orcs

Soldier 2 at 5:40, group 2 at 15:40, **6 soldiers at 30 min, 7 at 40 min**, forge at 34:39, boss at **55:30 (+19 % vs Humans)**, then 10 soldiers in 3 groups. Share: combat 52 %, smithing 14 %, stone 13 %, wood 7 %, building 6 %, food 7 %.

### 8.3 Combat rescaled for small armies (prototype values)

| Stage | Enemy | HP | Armour | Kills | Loot |
|---|---|---|---|---|---|
| 1 | Wild chicken | 12 | 0 | 12 | 2 food |
| 2 | Angry rooster | 25 | 0 | 12 | 3 food |
| 3 | **Fox** (replaces the rat swarm, which only made sense for huge troops) | 45 | 1 | 12 | 3 food |
| 4 | Wild boar | 80 | 2 | 12 | 5 food, 1 ore |
| 5 | Old boar | 130 | 3 | 12 | 6 food, 2 ore |
| Boss | The Old Tusker | **500** (was 7,000) | 3 | 90 s limit | Group 3 + 2 soldiers |

Soldier power grows from **levels (+10 %/level), upgrades and weapons**, so a level-9 soldier with a sword hits ~2.5× harder than at the start. That growth is what replaces "more soldiers" as the main power curve in the first hour.

---

## 9. The first 15, 30 and 60 minutes 💡

**0–15 min: the lone soldier.** One woodcutter; a tree falls every 30 s (20 s with sharp axes). Combat opens at 30 wood: chickens take ~15 s each, and level 2 comes fast. Clearing stage 1 rescues the farmhand (soldier 2). Stone, a tent, stone picks, then the **Training Camp**, built by two soldiers over a couple of minutes. Rewards every 20–60 s; a milestone every 2–4 minutes.

**15–30 min: two groups.** Group 2 opens (move a soldier into it). Soldiers 3, 4 and 5 are trained one by one, each with a visible training bar. One group fights through stages 2–3 while the other builds tents and the farm. The first full site ("Björkdungen: 3 of 3 working") shows that more soldiers must spread out.

**30–60 min: arming and the boss.** The forge, five swords (each 60 s on the single anvil: a short, visible queue), stages 4–5 with armoured boars where swords and levels matter. The boss falls around 45–55 min. Reward: group 3 with two freed prisoners, and region 2 (later content).

---

## 10. From the first hour to months 💡

Soldier numbers grow by **widening**: more beds, more training slots, more sites, more regions. Not by one exponent.

| Phase | Soldiers (Humans) | What scales | Example sources |
|---|---|---|---|
| Hour 1 (Gårdarna, T1 intro) | 5–8 | Beds: tents; one training slot | Rescues, Training Camp |
| Day 1–3 (region 2) | 15–40 | Barracks (beds ×5), 2 training slots, forest and mine sites with capacity 10–20 | Quests, region milestones |
| Week 1–2 (regions 3–4, **T2**) | 60–150 | Districts of houses, a War camp (train 5 at once), capacity 40+ sites, T2 materials | Boss rewards, conscription (Orcs) |
| Months (T4+) | 200–500 (Humans) / 400–1,000 (Orcs) | Fortress beds, mass training, regional colonies | Endgame buildings |

T2 stays hard because it needs **region-2+ materials from limited-capacity sites** (e.g. a deep vein with capacity 2 that gives iron), plus a Forge level 2 and mastery. Capacity is the long-term lever: every new region opens new sites, so the economy grows in steps the designer controls.

---

## 11. What has to change in rules, code and tests

| Area | Change | Size |
|---|---|---|
| **Types / state** | `WorkSiteDef` (cap, cycleSec, yield, skill) per zone; per-site progress counters; `beds`; `training` queue; `groupSlots`; group XP from work | Medium |
| **`computeRates` / `advance`** | Replace `size × work × skill × gatherRate` with `min(n, free capacity) × skill / cycle`; capacity filled in a fixed order; payout `floor(progress)`; work XP | Medium |
| **Recruitment** | Remove `recruitCost` / `maxRecruitable` / `recruit` with count; add `trainRecruit` (one at a time; bed, food, time) and rescue rewards in objectives | Medium |
| **Groups** | `transferSoldiers`; groups from slots (Training Camp, boss) instead of buildings creating a troop with free soldiers | Small–medium |
| **Content** | Sites for Gårdarna; buildings: tents, Training Camp (+bed, +slot), farm (fields site); rescaled enemies and boss; race skills and bed/training multipliers; new objectives (rescue, tents, train) | Medium |
| **Caps** | Troop cap fractions (`capLevelFractions`) replaced by beds | Small |
| **Equipment** | Unchanged (auto-equip, quality, mastery). Forge: one anvil, 60 s per sword at skill 1 | Small |
| **Save** | v7 migration: map old soldiers to beds (keep everyone; existing armies get "grandfathered" beds) | Small |
| **UI** | Site cards with a cycle progress bar and "3 of 5 working"; a training bar; beds in the resource bar; move-soldier control; smaller numbers in the art | Medium |
| **Tests** | Rewrite recruitment, cap, rate and balance tests. New tests: capacity sharing, discrete payout = continuous over time, offline = online with cycles, training queue, beds, transfer | Medium |
| **Balance simulator** | The bot must handle training and site capacity; new targets in `balance.test.ts` (below) | Medium |

Proposed new balance guards (replacing the old ones):
- Soldier 2 between 4 and 8 min; group 2 between 12 and 18 min.
- **3–6 soldiers at 30 and at 40 min** (Humans); Orcs 1.0–1.6× Humans.
- Boss between 40 and 60 min; Orcs within ±25 %.
- No "nothing completed" gap longer than 90 s in the first 15 min (activity-feel guard).
- Every start activity used ≥ 5 % (food needs a fix first, §12).

---

## 12. Risks ⚠️ and mitigations

| Risk | Where the prototype shows it | Mitigation |
|---|---|---|
| **Food activity unused**: combat loot feeds a 5-soldier army | Food 1 % of Human time | Lower chicken and rooster food loot; make training and **upkeep** (P1) need more food; *Field kitchens* give real value. Target: food ≥ 8 % of time |
| **Long lull** before the boss: stage 5 and the forge take ~10 min with little new | Humans 33:55 → 46:45 | One more mid-goal (a Watchtower, a second anvil, or a rescue quest at stage 4); shorter stage 5 |
| **Single-group switching** in minutes 5–15 feels fiddly | Bot switches wood → stone → build → fight | Clear objectives that queue the next need; optionally a simple "work order" (finish this building, then return) |
| **Bottleneck on ore** (capacity 1) for the forge | Orcs smith 14 % of time, waiting for ore | Boar loot gives ore; *Stone picks*; a second vein in region 2 |
| **Idle soldiers** when sites are full | Not reached at 5–8 soldiers; real at 15+ | The UI must say so clearly and suggest combat or another site; region 2 opens new sites before beds pass capacity |
| **Over-production later**: many regions × many sites | Not simulated | Capacity, cycle yield and T2 material scarcity are separate knobs; balance per region |
| **Waiting for training** feels like a timer, against D-17 (goals, not timers) | Training takes 90 s → 3.7 min | Training is short and runs in parallel with play; beds (goals) are the real gate. Never more than one short timer on screen early on |
| **Few soldiers make combat swingy**: one death is 20 % of the army | Not modelled (prototype has no deaths) | Safe-stage logic stays; boss and boar damage tuned to small groups; healing between fights |
| **Orcs too weak per soldier** at small numbers | +19 % boss time is fine, but their early combat is slow | Orc training ×0.6 and extra beds; check feel in playtests |

---

## 13. Open questions for the owner ❓

1. **Group 2 timing:** keep group 2 from the Training Camp (~15 min) and give **group 3** from the boss (recommended), or make the boss the first way to get group 2?
2. **Mining:** two sites (stone / ore) for a real decision (recommended), or one site with a fixed mix?
3. **Training time:** OK as a short visible bar (90 s → a few minutes), or should soldiers come only from beds + food (no timer)?
4. **Hunting:** keep food from combat as "hunting" (recommended), or a separate hunting activity?
5. **Moving soldiers between groups:** add it (recommended, needed with few soldiers)?
6. **Is 6–8 soldiers after the boss** (7 Humans, ~10 Orcs) the right size for region 2?

---

## 14. Suggested next steps (after approval)

1. Owner answers §13; record decisions as D-45+ (and mark D-14, D-16, D-24 as superseded).
2. **M10a** (core only): work sites + cycles + capacity, beds + training, transfer, save v7, tests. The UI keeps working with minimal changes.
3. **M10b:** content retune (enemies, boss, races, buildings) and the new balance bot and guards.
4. **M10c:** UI: site cards, training bar, beds, move soldiers, smaller-army art.
5. Playtest the first hour with both races before adding region 2.

---

## 15. Implemented in M10a (2026-10-23)

The core, content, save, bot and a minimal UI now follow this document. Differences from the proposal, found while building:

| Topic | Proposal | Built | Why |
|---|---|---|---|
| Training food | 20 × 1.5^(k−3) | **40** (Humans) / **30** (Orcs) × 1.5^(n−2) | With 20, the Food activity was used only 1–4 % of the time (risk §12). With 40, food is 7 % (Humans) / 10 % (Orcs), and soldier 5 lands at ~31 min |
| Orc training | ×0.6 food and time | 30 food, **70 s** | Orcs had 8 soldiers at 30 min (1.6×); now ~5 (1.25×) |
| Combat food loot | 2 / 3 / 3 / 5 / 6 | **1 / 1 / 1.5 / 2 / 3** | Same reason: hunting fed the whole army |
| Cycle speed | skill only | skill × **work** (work includes +10 %/level) | Levels from work XP now speed up work too |
| Group 2 | Player moves a soldier in | Formed **automatically** from the biggest group when the Training Camp is done (if it can spare one), otherwise by the next soldier | Keeps the existing "two groups" objective working with no extra step; the player can move soldiers back with *Flytta en soldat* |
| Horde trait | n/a | +50 % attack at ten or more soldiers in one group | The old trait scaled with the troop cap, which no longer exists |

New core API: `WorkSiteDef` and `content.sites`, `troop.siteId`, `state.siteProgress`, `state.troopSlots`, `state.training`, `beds` / `freeBeds` / `capacity` / `availableSites`, commands `trainRecruit` and `transferSoldiers`, `assignTroop { siteId }`, objective rewards `soldiers` / `troopSlots`, effects `beds` / `capacity`. Removed: `recruit`, `recruitCost`, `maxRecruitable`, cap levels and `gatherRate`. Save **v7** keeps every soldier of an old save.

Simulated (bot, balanced), see [Balance Log pass 9](BALANCE_LOG.md):

| | Humans | Orcs |
|---|---|---|
| Soldier 2 (rescue) | 4:45 | 4:51 |
| Group 2 | 14:09 | 14:28 |
| Soldiers at 15 / 30 / 40 min | 2 / 4 / 5 | 2 / 5 / 6 |
| Soldier 5 | 30:39 | 27:13 |
| Boss | 43:55 | 53:49 (+22 %) |
| After the boss | 7 soldiers in 3 groups | 9 in 3 groups |

Still open for **M10b** (tuning): the lull before the boss (stage 5 → boss ~10 min), only 5 of 7 soldiers armed by the boss, Orcs' slower late game, and real playtests. **M10c** (UI): site cards with capacity, nicer training and bed display, smaller-army art.


---

## 16. M10b spec (✅ approved by the owner 2026-10-23, D-53)

Status: **approved** with the lead's recommendations on §16.6: (1) 6 Human soldiers at 40 min is accepted; (2) the forge unlocks after two groups; (3) old saves get no rescue soldier and no retroactive level notices. Scope chosen by the owner: R-01, R-02 (rescue at stage 4), R-03, R-04, R-08-lite (see [IDLE_RESEARCH.md](IDLE_RESEARCH.md) §3.1). Out of scope: race traits, work orders, stage variety, region 2. Baseline = Balance Log pass 9 (Humans balanced: forge 34:46, stage 3 at 32:38, stage 4 at 36:52, stage 5 at 42:35, boss 43:55; Orcs boss 53:49). **Every number marked (guess) is a starting point for QA to tune with `npm run sim`.**

Findings from the baseline that shape the spec:
- Events in the Humans timeline have two holes after minute 15: 14:10 to 19:40 (5.5 min) and 23:12 to 29:02 (5.8 min), plus the pre-boss lull 36:52 to 42:35 and the forge only at 34:46.
- Boars **already drop ore** (wild boar 1, old boar 2). Boars are stages 4 and 5, so that ore comes after the forge is built. The real fix is a forge that opens earlier plus ore from the fox (stage 3).
- Mastery level is `floor(sqrt(crafted / 20))`: step 1 at 20 weapons, step 2 at 80, step 3 at 180 (D-40/D-43). Step 1 only moves the quality chances 1/10 of the way, so it is a small power gain (normal 85 % to about 79 %); its value is the visible payoff.
- The bot crafts only 5 to 7 weapons and ends with 5/7 (Humans) armed, mostly because the forge is late, has one anvil and ore is thin.

### 16.1 Changes

| id | What | Exact numbers | Why | Balance effect |
|---|---|---|---|---|
| M1 | New objective `tent2` (guiding) | requires `twoTroops`; tents level 2; reward wood 30 and unlock `building:woodshed` | Soldier 4 needs the bed anyway; turns a silent build (23:03) into an event | None on soldiers (bed was needed already); +30 wood (guess) |
| M2 | New objective `woodshed` (guiding) | requires `tent2`; woodshed level 1; reward unlock `upgrade:sharpenedAxes2` | Fills the 23 to 29 min hole; leads to R-04 | See R-04 rows |
| M3 | New objective `ore10` (optional) | requires `twoTroops`; total ore gathered 10; reward food 20 and unlock `upgrade:stonePicks2` | An optional goal that also feeds the forge | +20 food (guess) |
| M4 | New objective `farm2` (optional) | requires `farm`; farm level 2; reward wood 40 | Visible payoff in the 30 to 35 min window | +1 field slot (see B3) |
| M5 | Forge opens earlier | Objective `forge` requires `twoTroops` (not `farm`); `twoTroops` also unlocks `building:forge`; `farm` keeps its own reward without the forge unlock | The forge is the most important mid-game payoff and is now reached at ~34 min; expected ~24 to 28 min (guess) | Large: more weapons, armed ratio up; forge cost (50 wood, 50 stone, 6 ore) stays |
| M6 | Rescue at stage 4 (R-02, owner decided) | New objective `rescue2`: requires `stage3`, condition `stageReached 5`, reward `soldiers: 1`, text in 16.2. Needs a free bed? **No**: like the stage-1 rescue and the boss, it must not depend on beds (Systems to verify) | Pre-boss goal; fills the lull | **+1 soldier**: Humans 6 at 40 min (limit 6), 8 after the boss; Orcs 7 at 40 min (1.17x) |
| M7 | Shorter stage 5 | `oldBoar` stage `killsToClear` 12 to 8; objective `zoneCleared` text unchanged | Stage 5 took 5.7 min | Boss about 2 min earlier (guess) |
| M8 | First mastery step at 10 weapons (R-03) | New content field `equipment.firstMasteryStep: 10`. Rule: `masteryLevel(c) = c < first ? 0 : min(max, max(1, floor(sqrt(c / itemsPerMasteryStep))))`; `craftedForLevel(1) = first`, `craftedForLevel(L>=2) = L^2 * itemsPerMasteryStep` (unchanged: 80, 180, 320 ...). Level 2 and up and D-40's "~2,000 weapons to max" are unchanged | The first step arrives with the first useful batch | Tiny power (about 5 % of the quality spread); mostly a notice. Fallback if bot still stays under 10: 8 (guess) |
| M9 | Ore loot (R-03) | `fox` loot adds `ore: 0.5`; `wildBoar` ore 1 to 1.5; `oldBoar` ore 2 to 2.5 (all guess; fractions are already used for food loot) | Boar ore already exists; fox ore gives stock before the forge | About +6 to 8 ore by the boss |
| M10 | Forge level 2 (R-04) | New level 2: cost wood 150, stone 100, ore 10; work 480; effect `capacity` target `smithing` amount 1. Appears in the Settlement list once level 1 is built; objective `forge2` (guiding, requires `gear1`, text 16.2) | Two anvils; also a goal in the 35 to 40 min lull | Weapons about 2x faster; the armed guard |
| M11 | Farm level 2 (R-04) | New level 2: cost wood 120, stone 60; work 300; effect `capacity` target `fields` amount 1 (3 to 4) | Wider food (fields yield 9 per 60 s) | +1/3 field food, small. Watch food use (target 7 %+) |
| M12 | New building Vedskjul `woodshed` | One level: cost wood 50, stone 20; work 120; effect `capacity` target `birchGrove` amount 1 (3 to 4). Unlocked by `tent2` reward | Capacity growth for wood | Wood +33 % at a full grove (the grove is rarely full at 2 to 5 soldiers, so low impact; keep, because capacity must be visible) |
| M13 | Upgrade Vassa yxor II `sharpenedAxes2` | cost wood 60, stone 20; `skill.woodcutting` mult +0.3 (guess; Vassa yxor I is +0.5); unlocked by `woodshed` reward; Swedish name "Vassa yxor II" | Second level of the upgrade | Wood +~15 % (guess) |
| M14 | Upgrade Stenhackor II `stonePicks2` | cost wood 60, stone 40, ore 4; `skill.mining` mult +0.25 (guess; I is +0.33); unlocked by `ore10` reward | Helps the one-slot ore vein | Ore +~12 % |
| M15 | R-08-lite level steps | Core emits one event `levelStep` when a troop's level crosses **5** or **10** (never replayed on load). Player text 16.2. Power is only the existing +10 %/level, stated in the text ("+40 %" at 5, "+90 %" at 10); no new bonus | Visible payoff for XP | None; counts as an event for the gap guard (about 20 and about 40 min) |

Not changed: soldier training costs and timing, beds, group slots, the boss HP/timer, D-50 targets.

### 16.2 New and changed objectives, chain order (Swedish player text)

| # | id | Type | requires | Condition | Reward | Text |
|---|---|---|---|---|---|---|
| 1 | `forge` (changed) | guiding | `twoTroops` | forge level 1 | none | "Bygg en smedja." |
| 2 | `tent2` | guiding | `twoTroops` | tents level 2 | wood 30, unlock `building:woodshed` | "Res ett andra tält: fler sängar, fler soldater." |
| 3 | `ore10` | optional | `twoTroops` | total ore 10 | food 20, unlock `upgrade:stonePicks2` | "Valfritt: gräv fram 10 malm ur Malmådern." |
| 4 | `woodshed` | guiding | `tent2` | woodshed level 1 | unlock `upgrade:sharpenedAxes2` | "Bygg ett vedskjul: plats för en yxa till i Björkdungen." |
| 5 | `farm2` | optional | `farm` | farm level 2 | wood 40 | "Valfritt: bygg ut gården, åkrarna får en plats till." |
| 6 | `rescue2` | guiding | `stage3` | `stageReached 5` | `soldiers: 1` | "Någon ropar från grisfållan. Rensa steg 4 och befria honom." |
| 7 | `forge2` | guiding | `gear1` | forge level 2 | food 30 | "Bygg ut smedjan: ett städ till, fler vapen." |

Existing `farm` objective keeps `requires: twoTroops` but its reward changes from `unlock building:forge` to none (the forge unlock moves to `twoTroops`). `zoneCleared` still requires `stage3`. Guiding goals: 1, 2, 4, 6, 7 (each is the natural next step). Optional challenges: 3, 5 (gifts, never block the chain).

Level-step notices (R-08-lite, not objectives, shown in the chronicle):
- Level 5: "{Trupp} når nivå 5: veteraner. Alla i gruppen har +40 % kraft."
- Level 10: "{Trupp} når nivå 10: eliter. Alla i gruppen har +90 % kraft."

### 16.3 Expected timeline (Humans, balanced; all after-values are guesses)

| Minute | Before (pass 9) | After (expected) |
|---|---|---|
| 15 | 2 soldiers, 2 groups (group 2 at 14:09), 5 objectives behind | Same; no change before minute 14 |
| 30 | 4 soldiers (soldier 5 at 30:39), stage 3 at 32:38, forge not built, 0 weapons; farm 29:02 | 4 soldiers; forge built ~25 to 28; tent2, woodshed, ore10 done; 2 to 3 weapons; stage 3 ~32; Sharp axes II bought |
| 45 | 7 soldiers after boss at 43:55 (3+2+2), 5 weapons, 5/7 armed, mastery 0 | Boss ~40 to 43; **8 soldiers** (3+3 +2; one from rescue, two from the boss), 7 to 8 weapons, 7/8 armed, mastery 1, forge level 2 |
| Boss | 43:55 (Humans), 53:49 (Orcs, +22 %) | ~41 to 43 Humans (limit 40), ~47 to 51 Orcs (ratio about 1.15) |

Soldiers at 30 and 40 min stay 4 and 6 (D-50: 3 to 6). The rescue soldier arrives at ~37 min, so 40 min is the edge: if the bot lands at 7, move the rescue to stage 5 (stage reached 6, i.e. clear 5) or raise training cost. No soldier is added in minutes 0 to 30.

### 16.4 Balance guards (new or changed)

Existing guards in §11 stay, with these changes:
- **New: event gap.** Between minute 15 and 45, at most 4:00 (240 s) between two events. Event = objective done, building done, recruit, stage clear, rescue/join, level step. Both races, `balanced` and `economy`.
- **New: armed at the boss.** At the end of the run (after boss rewards), armed soldiers / soldiers >= 0.80 (Humans: 7 of 8). Also mastery >= 1 for `balanced`.
- **Changed: boss window.** Humans 40 to 60 min stays; add Humans balanced must be >= 40 and <= 48 (the point is no lull). Orcs within +-25 % stays.
- **Changed: soldiers.** Humans 3 to 6 at 30 and at 40 min stays (the rescue puts 40 min at 6); Orcs 1.0 to 1.6x stays.
- **New: forge window.** Forge built <= 30 min (Humans balanced). Forge level 2 built before the boss.
- **New: objective coverage.** Every new objective is done by the `balanced` bot by minute 50; optional ones may be skipped by `economy`.
- The 90 s first-15-minutes gap guard stays unchanged.

### 16.5 Save notes

- Objective completion is stored by id, so the save shape does not change. `SAVE_VERSION` +1 is still recommended, with a migration (Systems to confirm) that evaluates the new objectives against an old save, as below.
- **Immediate firing:** an old save may already satisfy `tent2` (tents level 2), `farm2` is impossible (level 2 does not exist), `rescue2` (stage >= 5), `forge2` impossible, `ore10` (ore gathered >= 10). The migration marks these **done silently**: grant unlocks (woodshed, Sharp axes II, Stone picks II) so nothing is locked, but **not** resources and **not** the `rescue2` soldier (no free soldiers to old saves; no surprise growth beyond D-50). Open question 3.
- `forge`'s changed `requires` only matters for saves that have `twoTroops` done and `farm` not: the forge becomes available at once, which is intended. Saves that built the forge already keep it.
- `firstMasteryStep`: mastery is derived from `weaponsCrafted`, so a save with 10 to 19 weapons gains level 1 on load. Harmless, no migration.
- `levelStep` is an event on crossing only, never derived from the level on load, so old saves do not replay notices. Old saves with level 5 or higher get no retroactive notice.
- Test needed: a v(N) save with stage 5 reached, tents 2 and ore 12 loads with the new objectives done, same soldier count, and no resources added.

### 16.6 Open questions for the owner

1. **Soldier count at 40 min:** is Humans at 6 soldiers at ~40 min (rescue at stage 4) acceptable, or should the stage-4 rescue replace some other future soldier so the army is 5 at 40 min?
2. **Forge earlier:** may the forge unlock right after "two groups" (~14 min) instead of after the farm? This is the biggest timeline change in the spec (the farm stays as a goal but no longer opens the forge).
3. **Old saves:** do players with stage 5 already reached get the stage-4 rescue soldier as a gift (recommended: no, mark done without a soldier), and should the level-5/10 notices be silent for already-high groups?

### 16.7 Built and tuned (M10b, 2026-10-23)

Implemented as specified, with these tunings and owner decisions (see [Balance Log pass 10](BALANCE_LOG.md)): Forge II costs 90 wood / 60 stone / 10 ore, Farm II 70 wood / 40 stone, the first mastery step is at **6** weapons (D-40 still holds: level 2 at 80, max at ~2,000). Forge II and Farm II are **post-boss goals** (a bridge to region 2). Guards: armed ratio measured when the boss fight starts; food floor 4 % until upkeep exists; event gap 4 min (Humans) / 7 min (Orcs) for the balanced bot; optional goals are not required. Save version 8.


---

## 17. M11 food upkeep spec (✅ approved by the owner 2026-10-23, D-55)

Status: **approved** with the recommendations (D-57): horde full at 5, Humans trait for food and building only, feast as specified. Owner decisions it builds on: path A (soldiers eat; no food means slower, never dead), D-35 / D-36 (no losses, online or offline), D-13 (Humans better at food), D-50 (soldier targets), D-54 (food floor 4 % until upkeep). Out of scope: feasts and rations (surplus sink), new regions. **Every number marked (guess) is a starting point for QA to tune with `npm run sim`.**

Baseline (balanced bot, 70 min sim, M10b): Humans food 4 % of troop-time, 2 / 4 / 5 soldiers at 15 / 30 / 40, boss 44:31; Orcs food 9 %, 2 / 5 / 6, boss 50:35 (+14 %). Food stock is often idle (Humans 77 at 30 min, 142 at 35). Food skill: Humans 1.4, Orcs 0.8. Per forager: berries 2 per 20 s (6 per min at skill 1), fields 9 per 60 s; so a Human forager gives about 8.4 per min on berries, an Orc about 4.8.

### 17.1 Upkeep rule

- Every soldier **in a troop** eats `u` food per minute, **except the first `F` soldiers of the player's whole army** (free allowance). Recruits still in the training queue do not eat. Rescued and boss prisoners eat from the moment they join.
- `upkeep/min = u_race * max(0, totalSoldiers - F)`. Total soldiers only change at events (recruit finished, rescue, boss, transfer does not change it), so upkeep is a **constant rate between events**: `upkeepPerSec = u * max(0, n - F) / 60`, summed over all troops and added to `computeRates` as a negative food rate.
- Proposed (guess): `F = 1` (the starting soldier is free, so minute 0 to 4:45 has no upkeep and the first rescue adds only 0.5 food per min), `u = 0.5` (Humans), `u = 0.6` (Orcs; they eat more, forage 0.8 vs 1.4).
- Why 0.5: a Human forager makes 8.4 per min on berries, so one forager feeds 16 soldiers; 8 soldiers cost 3.5 per min, about 5 % of army time on food. Together with training (40/60/90 food) this should reach 8 to 10 % food share. Not fed by sleeping or training state: simple and readable ("0,5 mat per soldat och minut").
- UI wording: "Underhåll: 3,5 mat/min (7 ätande soldater)".

### 17.2 Hunger

- **Trigger (derived, no state):** hunger is active when `food stock == 0` **and** `foodIncome < upkeep`. `foodIncome` is the expected food rate already known to the rate code (site cycle yield / cycle time, plus average combat loot if the core exposes it; if loot is not a smooth rate, leave it out and let lumps simply lift the stock above 0).
- **Coverage ratio** `c = min(1, foodIncome / upkeep)`. A small deficit costs little, so no cliff and no flicker when lumps arrive:
  - Work speed (all site cycles, construction, smithing, work-cycle XP): `x 1 - 0.4 * (1 - c)`, so **x0.6 at zero income** (guess).
  - Attack (damage dealt): `x 1 - 0.25 * (1 - c)`, so **x0.75 at zero income** (guess). Enemy damage unchanged.
  - Training time: unchanged (it needs food to start anyway). Regeneration, healing and loot unchanged.
  - **Exempt: the food sites (berries, fields).** Hunger can never trap the player: one forager always works at full speed.
- **Stock while hungry:** stock is pinned at 0 and food consumed equals food produced (income is eaten as it arrives). Stock cannot go negative.
- **Start:** a continuous drain `stock / (upkeep - income)` seconds after the last event gives a new event `foodEmpty` (needed for the event-driven loop). **End:** as soon as `income >= upkeep` (a forager is assigned, a farm is built, a combat loot lump arrives and income rises); stock then grows above 0 and the factor is 1 again. No timers, no recovery period.
- **Never:** no soldier dies or leaves, no building or resource is lost, no progress is reset, no objective fails. A fight lost because of slower attack follows the existing retreat rules (D-35).
- **UI (Swedish text, proposal):** food chip in the resource bar shows the net rate (`-1,2/min`) in ember when negative; below 3 minutes of food left: "Maten räcker i 2 min". When hungry: red "Hungrig" badge on every troop card and a line in the "what limits you now" strip (D-52): "Trupperna är hungriga: arbete -40 %, anfall -25 %. Skicka någon till bären." Chronicle: "Maten tog slut." and "Maten räcker igen." **Away report:** "Maten tog slut efter 12 min. Trupperna arbetade långsammare i 38 min. Ingen svalt." (needs `hungrySec` summed in the offline catch-up, not saved).
- Spending is allowed down to 0. A buy or training that would leave food at 0 with upkeep above income shows "Maten tar slut: trupperna blir hungriga" before confirming (UI warning only).

### 17.3 Levers that grow in value

| Lever | Change | Why |
|---|---|---|
| Berries (cap 2) | None | Cheap and always open; enough for the first 8 soldiers. Cap 2 is the hunger cure early |
| Farm / fields (cap 3, Farm II +1) | None to yield; objective `farm` stays | Fields give 9 per min per forager, 54 to 63 per min at full room: covers 100+ soldiers. This is the long-term answer; Farm II becomes a real goal |
| Field kitchens (+0.3 food skill) | Keep +0.3; consider also **-10 % upkeep** (guess, optional) | Gives a reason to buy it before the boss. QA decides if needed |
| Combat loot | None | Hunting already feeds ~1 soldier-min per stage; upkeep makes it count |
| Training food (40 Humans / 30 Orcs, x1.5 per soldier) | **Unchanged first.** Fallback if soldier 5 slips past 42 min: 35 (Humans) / 27 (Orcs) | Upkeep and training both draw on food; do not lower both at once without a sim |

### 17.4 Targets and guards (guesses marked)

- **Food share** of start-activity troop-time, balanced bot: **>= 8 %** for both races (floor goes from 4 % to 8 %); expected Humans 8 to 10 %, Orcs 14 to 17 %. Orcs above 20 % means `u` too high.
- **Hunger time before the boss, balanced bot:** total <= **4 min** (guess), longest stretch <= 90 s. Economy bot: <= 8 min. A new **careless bot** (never assigns food on purpose) must still kill the boss, in <= **+40 %** time, which proves there is no death spiral.
- Bot rule to add: assign a forager when food left < 3 min of upkeep or when hungry; keep a reserve of about 3 min of upkeep when buying.
- Unchanged guards: D-50 soldiers 3 to 6 at 30 and 40 min (Humans), Orcs 1.0 to 1.6 x Humans; Humans boss 40 to 48 min, Orcs within +-25 %; M10b event-gap guards (Humans 4 min, Orcs 7 min); armed ratio >= 0.80 at the boss; first-15-minute 90 s gap guard; every start activity used.
- Test needed: with `u = 0` or `n <= F` results equal today's (pins the old behaviour); with stock 0 and zero income, work speed is exactly x0.6 and food sites are unaffected; offline = online hunger time.

### 17.5 Expected timeline, before to after (guesses)

| | Humans before | Humans after | Orcs before | Orcs after |
|---|---|---|---|---|
| Soldiers at 15 / 30 / 40 | 2 / 4 / 5 | 2 / 4 / 5 (soldier 5 at ~38 to 41) | 2 / 5 / 6 | 2 / 4 to 5 / 6 |
| Soldier 5 | 37:54 | 38 to 41 | 26:43 | 27 to 30 |
| Boss | 44:31 | 45 to 47 | 50:35 | 52 to 56 (+18 to 22 %) |
| Food share | 4 % | 8 to 10 % | 9 % | 14 to 17 % |
| Hungry time before boss | n/a | 0 to 2 min | n/a | 0 to 3 min |

The extra food time is taken mostly from mining and wood, so the boss slips by 1 to 3 min (guess). If Orcs exceed +25 %, lower Orc `u` to 0.5 before touching other numbers.

### 17.6 Save and offline notes

- **No new state.** Food stock already exists; `upkeep`, `foodIncome`, `c` and the hunger factors are all derived from soldiers, sites and stock. **No `SAVE_VERSION` bump or migration is needed** (Systems to confirm). Test: an old save loads with the same stock and soldiers.
- Old saves with large armies start with upkeep from the first load. They may be hungry at once, but only slower, and one forager ends it. Optional (open question): no grace needed.
- **Offline stays O(events):** upkeep is a constant rate per segment, so `foodEmpty` is one more event in the existing loop (time `stock / (upkeep - income)`); after it the segment runs with the constant hunger factors and stock pinned at 0. No per-minute stepping. Offline follows D-36 (troops fall back to the highest safe stage); hunger changes only speed. The away report adds `hungrySec` and the moment food ran out.

### 17.7 Risks

- Upkeep is linear in soldiers while a forager's yield is flat; at 50+ soldiers the Farm and later rations must carry it (out of scope now, flagged).
- Hunger lowers attack during the boss (limit 90 s): the UI warning before the boss objective matters; the coverage ratio keeps small deficits mild.
- Food is a hidden new chore if the UI is quiet: the "what limits you now" strip and the food chip must show it, or it feels like a silent penalty.

### 17.8 Open questions for the owner

1. **Strength of hunger:** work -40 % and attack -25 % at zero income (guess). Milder (-30 % / -15 %) or stronger?
2. **Allowance and race rates:** first soldier free, Humans 0.5, Orcs 0.6 food per soldier per minute. Fine, or should Orcs eat the same as Humans?
3. **Offline:** hunger applies offline the same as online (recommended, simple), or should offline be milder (for example never below x0.8)?

**Owner decisions (2026-10-23):** hunger strength work ×0.6 / attack ×0.75 at zero coverage; the first soldier eats for free, Humans 0.5 and Orcs 0.6 food per soldier per minute; offline uses the same rule as online (offline must equal online). Feasts/rations come later.


---

## 18. M12 gameplay polish spec (approved, D-57)

Status: **approved** with the recommendations (D-57): horde full at 5, Humans trait for food and building only, feast as specified. Builds on D-08 / D-13 (race identity, Humans food, Orcs wood), D-50 (soldier targets stay), D-53 / D-54 (event-gap guards), D-55 (food upkeep, §17 on branch `m11-food-upkeep`; this section is written to merge after it), R-05 and R-14 in IDLE_RESEARCH.md. **Every number marked (guess) is a starting point for QA to tune with `npm run sim`.** Measured baseline (balanced bot, M10b): Orcs events at 29:31 (stage 3) then 36:06 (tent 2) = **6.6 min gap**, and 37:57 to 42:31 = 4.5 min; Orcs soldiers 2 / 5 / 6 at 15 / 30 / 40, boss 50:35 (+14 % vs Humans 44:31).

### 18.1 Small-army race traits (R-05)

**Problem.** Today `adaptable` (Humans) is only a label, and `horde` reaches its full +50 % at 10 in one group (`fullness = size / 10`), so it gives Orcs +5 to +25 % at 1 to 5 soldiers: race identity is invisible in the first hour (D-08).

| Option | Pro | Con |
|---|---|---|
| A. Keep traits, tune thresholds only | Tiny change | Humans still have no real trait |
| B. Data-driven traits with parameters, one felt trait per race at 1 to 5 soldiers (recommended) | Visible from minute 1, no new state, extensible to Dwarves and Elves | Small schema change in `RaceDef.traits` |
| C. First-cycle bonuses per site and stage (R-05 example) | Flavourful | Needs per-stage state and a save migration |

**Recommendation: B.** Change `traits: TraitId[]` to parameterised entries (guess at shape: `{ id: 'horde', perSoldier: 0.125, cap: 0.5 }`), resolved in `troopStats` as modifiers with a troop-size condition (same place as today's horde code). Pure and derived, so no state.

- **Orcs, Hjordmod (`horde`, changed):** attack bonus = `min(0.5, 0.125 * (size - 1))` per troop. Full +50 % at **5** soldiers instead of 10; size 2 = +12.5 %, 3 = +25 %, 4 = +37.5 % (today +10 / +15 / +20 %). Splitting an Orc army costs attack, so grouping matters. Text: "Hjordmod: +12,5 % anfall per kamrat i truppen, max +50 % vid fem."
- **Orcs, Plundrare (`raiders`):** unchanged (+50 % food and ore loot).
- **Humans, Anpassningsbara (`adaptable`, changed from label to effect):** troops of **3 or fewer** soldiers get **+25 % food skill and +25 % construction skill** (guess; multiplies with the race skills 1.4 and 1.2). Text: "Anpassningsbara: små trupper bygger och samlar mat 25 % snabbare (tre eller färre)." Fits D-13 (food) and builders; affects the first 25 minutes the most, then fades as troops grow, so it never scales into late game. Deliberately not attack or mining so Humans' boss time barely moves.
- Dwarves and Elves: out of scope (not playable). Same schema carries them later.

**Balance effect (guess).** Orcs: troops of 5 hit +20 % harder than today's +25 %->+50 %, i.e. about 20 % more attack at 5 soldiers and about 8 to 12 % faster stage 3 to boss; boss 50:35 -> about 47 to 49 (ratio 1.08 to 1.12, partly cancelling the +18 to 22 % that food upkeep adds). Humans: food and building -25 % time while small; boss -0 to 1 min (44:31 stays inside 40 to 48). Soldier counts must not move (training is not touched).
**QA.** Unit tests: horde bonus at sizes 1, 2, 3, 5, 10 (0, 12.5, 25, 50, 50 %); adaptable applies at size 3 and not at 4; no change for other races. Sim: D-50 soldiers (Humans 3 to 6 at 30 and 40 min, Orcs 1.0 to 1.6 x), Humans boss 40 to 48, Orcs boss ratio vs Humans in 0.95 to 1.25, boss window Orcs +-25 %. If Orcs boss falls below Humans x 0.95, lower cap to +40 %.

### 18.2 Orcs' mid-game gap (minutes 15 to 45)

**Problem.** Orcs have no event between stage 3 (29:31) and tent 2 (36:06), 6.6 min; and 37:57 to 42:31 (4.5 min) also breaks the 4 min guard. Humans pass at under 4 min because their later soldiers and rescue fall in these windows.

| Option | Pro | Con |
|---|---|---|
| A. Race-specific tent/woodshed start | Directly targets Orcs | Race branches in content; does not add anything to do |
| B. Two new generic "raid" objectives with resource rewards that pay for the next building (recommended) | Gives the player a goal and funds tent 2 earlier; no race branching; Humans just get extra events | Reward amounts need tuning |
| C. A level step at 7 | Free | Cosmetic; no goal |

**Recommendation: B**, using the existing `kills` condition and no new core code:
1. `raid1` "Plundra gårdarna: besegra 60 fiender." (guess count; kills so far must land at about 30 to 32 min for Orcs). `requires: ['stage3']`. Reward `{ wood: 45, stone: 25 }` (exactly tent 2: it removes the reason tent 2 waits) plus the unlock stays on `tent2`.
2. `raid2` "Hjordens byte: besegra 150 fiender." (guess). `requires: ['raid1']`. Reward `{ food: 40, ore: 6 }` and nothing permanent. Target time for Orcs about 38 to 41 min, filling the 37:57 to 42:31 hole.
3. Make `tent2` also awaitable earlier: change its `requires` from `['twoTroops']` to `['train1']` (about 18:40 for Orcs), so it appears before the forge crowds the screen. Soldier 6 is limited by beds at 36:17 for Orcs today; the earlier tent can move soldier 6 earlier, so keep training cost unchanged and **check 40-min soldiers stay <= 6** (D-50; if 7, leave `requires` as is).

**Expected effect (guess).** Orcs longest gap 15 to 45 min: 6.6 -> 3.0 to 3.8 min. Humans: +2 events, gap unchanged or smaller. Soldier targets and boss unchanged (rewards are small materials; sim effect on boss under 1 min).
**QA.** Tighten the event-gap guard from 7 min to **4 min for Orcs** (balanced bot) and keep Humans at 4; add `raid1/raid2` to the objective-coverage check (done by the balanced bot by minute 50). Check kills curve for both races so thresholds fit; report the longest gap and which two events bound it. Run `balanced` and `economy`.

### 18.3 Feast and rations (surplus sink, R-14)

**Problem.** Food stock is often idle (Humans 77 at 30 min, 142 at 35); upkeep (D-55) turns food into a need, but surplus beyond it has no use. The owner wants a sink that is optional and never required.

| Option | Pro | Con |
|---|---|---|
| A. Passive ration upgrade (-x % upkeep) | Simple | Permanent, not a choice |
| B. Active "Fest" with timed buff and cooldown (recommended) | A visible, satisfying action; offline-safe if timed in state | Needs 2 state fields and a command |
| C. Renown / cosmetic plots | Long-term | Larger scope, later |

**Recommendation: B.**
- **Unlock:** after `trainingCamp` is built (about 14 min); button "Fest" in the camp/overview.
- **Cost:** `50 food + 15 wood` (guess). Optionally `+8 food per soldier` (guess) so it keeps scaling; v1: flat.
- **Effect:** for **10 min** all troops get **+15 % work speed and +10 % attack** (guess); multiplies with hunger factors from §17 (a hungry army can still feast). Message: "Fest! Trupperna arbetar 15 % snabbare i 10 min."
- **Cooldown:** 20 min from the start of the feast (about 50 % uptime at most). Cannot be stacked or extended.
- **Value check (guess):** at 4 soldiers, 15 % x 10 min = 6 soldier-minutes for 50 food and 15 wood (about 7 min of one Human forager): break-even at ~4 soldiers, clearly positive at 8+. So it is a surplus sink, not an optimal early play.
- **Offline:** the feast is a timed state, so its end is one more event in the O(events) loop (rates change at `feastUntil`). Offline equals online, matching D-36 and D-55's rule.
- **Never mandatory:** the `balanced` bot does not use it; a new `feast` bot option uses it whenever it is ready and food > 100. D-50 targets are measured without feast.

**Balance effect (guess).** With the feast bot: boss 3 to 6 % earlier (about 1.5 to 3 min), soldiers unchanged (training time is not boosted; food spent is small). Without feast: no change at all.
**QA.** Tests: cost deducted once; cooldown blocks a second feast; effect factors exact at x1.15 work and x1.10 attack inside the window and 1.0 outside; one 8 h offline advance equals the same time online (state, stock, timers); save round-trip mid-feast. Sim: feast bot boss time between 3 % and 10 % faster than balanced; balanced results identical before and after (pins "optional").

### 18.4 Save notes

- **Items 18.1 and 18.2: no state.** Traits are derived; objectives are stored by id. New objectives `raid1`/`raid2` complete from `kills` already stored; old saves evaluate them on load and could fire at once. Migration marks them done **silently without rewards** if kills already exceed the thresholds (same rule as §16.5; no free resources to old saves). Changing `tent2.requires` only affects the order of display.
- **Item 18.3: new state** `feast: { until: number, readyAt: number }` (clock seconds, 0 = none). `SAVE_VERSION` +1 (next free after §17; §17 itself needs no bump, so v8 -> v9) with a migration that adds `{ until: 0, readyAt: 0 }`, plus a migration test (old save loads, no feast active, same resources).
- New command `startFeast` (pure; checks unlock, cost, `readyAt`). Offline catch-up must include `feastUntil` as a segment boundary.

### 18.5 Expected combined sim effect (all guesses)

| | Humans | Orcs |
|---|---|---|
| Longest gap 15 to 45 | <= 4 min (unchanged) | 6.6 -> 3.0 to 3.8 min |
| Soldiers at 15 / 30 / 40 | 2 / 4 / 5 (unchanged) | 2 / 4 to 5 / 6 (unchanged) |
| Boss (balanced, with §17) | 45 to 47 | 49 to 53 (ratio about 1.10 to 1.17) |
| Boss (feast bot) | about 3 to 6 % earlier | about 3 to 6 % earlier |

### 18.6 Open questions for the owner

1. **Orc horde:** is full +50 % at five soldiers (instead of ten) right, even though it makes splitting an Orc army costly and the boss a few minutes faster?
2. **Humans trait scope:** food and building only for troops of 3 or fewer (recommended, safe), or also a small work-speed bonus (stronger, may push the Humans boss toward the 40 min lower limit)?
3. **Feast strength:** +15 % work and +10 % attack for 10 min, 20 min cooldown, 50 food + 15 wood. Milder, stronger, or should it scale its cost with army size?

### 18.7 As built (balance pass 12, D-58)

The (guess) numbers above were tuned with the simulator; these are the shipped values:
- `raid1` 80 kills (was 60), `raid2` 130 kills (was 150). Rewards unchanged.
- Feast: **+25 % work and +25 % attack** (was +15 % / +10 %). With the guessed values the feast saved only 0.2–1.4 % of boss time, because its food cost eats the gain; the spec's own target is 3–10 %. Cost, duration and cooldown unchanged.
- The feast bot feasts when food ≥ 70 and wood ≥ 15 (was food > 100).
- `tent2.requires` is `['train1']`.
- Horde (+12.5 %/soldier, cap 50 %) and adaptable (+25 %, size ≤ 3) unchanged.
- Bot fixes: forage first when a recruit waits only for food; woodshed before farm 1.


---

## 19. M13 zone 1 to level 40 (proposal)

Status: **proposal, nothing here is decided.** Owner decisions it builds on (approved in the brief): zone 1 grows to **level 40** with a boss every 5 levels (5 … 35 mini-bosses, 40 the final boss); zone 1 takes **1–2 days** of play, offline counts; zone 2 later reaches about level 100 (outline only, §19.9). Lead decisions: the tuned first hour stays untouched, Gamle Betarn becomes the level-5 mini-boss, players who beat him continue at level 6. Lessons applied from [IDLE_RESEARCH.md](IDLE_RESEARCH.md) §6 (R-17 to R-21): readable numbers (about 1.1x HP per level), walls are checks on the army and never plain waiting, a failed boss sends you back to farm and nobody dies (D-15), no classic prestige, soldiers are never reset (D-04). **Every number marked (guess) is a starting point for QA to tune with `npm run sim`.**

Findings from the current code that shape the spec:
- Recruit cost is `trainFood x 1.5^(n-2)` and time `trainSec x 1.35^(n-2)` (`trainCost`). That is right for 8 soldiers but breaks beyond: soldier 16 would cost about 11,700 food and 100 min, soldier 20 about 59,000 food and 9 h. **Reaching 20-30 soldiers is impossible without a gentler curve after soldier 8** (§19.5).
- Beds today (Humans): 2 + tents 3 + camp 1 + barracks 3 and 5 = **14**. Stone from the quarry (capacity 2, 4 per 40 s) would take hours per barracks level. Capacity, not new buildings, must grow (§19.5).
- `selectStage` and `unlockedStage` already generalise to any count of stages; `secureForOffline` already walks down to the highest safe stage and abandons a boss (D-36). `Effect` already has `modifier`, so a drill building needs no new effect kind.

### 19.1 Level structure

A **level** is one existing `stage`: kill N enemies of that level's family, then the next level opens. Every 5th level (a **boss level**) is a short elite stage followed by the boss gate. Levels 1-5 are today's `wildChicken, angryRooster, fox, wildBoar, oldBoar` with today's numbers and kills (12, 12, 12, 12, 8), unchanged.

| Levels | Kills per level (guess) | Boss level |
|---|---|---|
| 1-5 | 12 / 12 / 12 / 12 / 8 (as today) | 8 kills, then Gamle Betarn |
| 6-15 | 25 | 12 |
| 16-25 | 30 | 15 |
| 26-35 | 35 | 18 |
| 36-40 | 40 | 20 |

Total about 1,000 kills in the zone. Auto-advance: after a level is cleared the troops move to the next one **only if it is `safe`** (stageSafety); otherwise they keep farming and the strip shows the wall (§19.6).

**Enemy generator, levels 6-40** (`m = 1.10^(L-5)`, anchored on the old boar at level 5: hp 130, armour 3, attack 1.1, xp 18, food 3, ore 2.5):

| Value | Formula (guess) |
|---|---|
| hp | `round(130 x m x role.hp)`, rounded to 2 significant figures |
| armour | `round(3 + 0.3 x (L-5)) + role.armour` |
| attack (dps on the troop) | `1.1 x 1.07^(L-5) x role.attack` |
| xp | `18 x 1.06^(L-5) x role.xp` |
| loot | food `3 x 1.04^(L-5)`, ore `2.5 x 1.03^(L-5)` (Orc raiders +50 % as today) |

Five roles by `L mod 5` give each band five families (the 5th is the boss-level elite):

| L mod 5 | Role | hp x | armour + | attack x | xp x |
|---|---|---|---|---|---|
| 1 | Lätt (light) | 0.85 | -1 | 1.0 | 0.8 |
| 2 | Normal | 1.0 | 0 | 1.0 | 1.0 |
| 3 | Tung (heavy) | 1.2 | +1 | 1.15 | 1.2 |
| 4 | Pansrad (armoured) | 1.0 | +2 | 0.9 | 1.1 |
| 0 | Elit | 1.15 | +1 | 1.1 | 1.5 |

Bands and Swedish family names (roles in order 1-2-3-4-5; names are content, the numbers come from the generator):

| Levels | Band | Families |
|---|---|---|
| 1-5 | Gårdarna (today) | Vild kyckling, Arg tupp, Räv, Vildsvin, Gammal galt |
| 6-10 | Skogsbrynet | Skogsmus-flock, Vildkatt, Brunbjörn, Hugget ormbo, Vargalfa |
| 11-15 | Rövarstigen | Stigtjuv, Fredlös bågskytt, Rövarhund, Skölddräng, Rövarkapten |
| 16-20 | Mossen | Sumpgroda, Dyvarg, Mossgast, Torvjätte-unge, Dimvakt |
| 21-25 | Ödegårdarna | Skräckkråka, Brandspöke, Ruinvaktare, Skelettbonde, Svedd fogdeknekt |
| 26-30 | Kullarna | Klippget, Stenhuggare-troll, Bergstroll, Klippörn, Kullkung |
| 31-35 | Gränsmarken | Gränsspejare, Järnvarg, Krigshund, Pansarknekt, Svartrockskaptenens garde |
| 36-40 | Svartborgen | Borgvakt, Murbrytare, Svartrocksveteran, Skuggryttare, Borgens elit |

Sample values (readable check: hp grows 32x from level 5 to 40 and 330x from the chicken; numbers stay under 5 digits; the player sees "Pansrad, 190 HP, rustning 6" not exponents):

| Level | Enemy | hp | armour | attack | xp | food / ore |
|---|---|---|---|---|---|---|
| 1 | Vild kyckling (today) | 12 | 0 | 0.12 | 3 | 1 / 0 |
| 5 | Gammal galt (today) | 130 | 3 | 1.1 | 18 | 3 / 2.5 |
| 10 | Vargalfa (elit) | 240 | 5 | 1.7 | 36 | 3.6 / 2.9 |
| 20 | Dimvakt (elit) | 620 | 9 | 3.3 | 65 | 5.4 / 3.9 |
| 30 | Kullkung (elit) | 1,600 | 11 | 6.5 | 116 | 8.0 / 5.2 |
| 40 | Borgens elit | 4,200 | 15 | 12.8 | 208 | 11.8 / 7.0 |

Notes for QA: the role table makes level 6 (120 hp) slightly weaker than level 5 (130), which is intended as a breather; add a guard that the 5-level moving average of hp and armour never falls. Time to kill at the top is the real pacing knob: HP growth range to tune is **1.09-1.11**; 1.12 is the researched ceiling.

### 19.2 Bosses

Boss HP = 4 x the boss-level elite's hp (Gamle Betarn keeps his 500). Armour = elite + 2, attack = 2 x elite attack (Betarn unchanged: 3 and 1.2). A boss is an `EnemyDef` of its own with a name and a timer.

| # | Level | Boss | HP | Armour | Atk | Timer | Needed dps | Reward (after victory) | What it checks |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 5 | Gamle Betarn (today) | 500 | 3 | 1.2 | 90 s | 5.6 | As today: 2 prisoners, group slot 3, Barracks I, Drill ground unlocked. **Remove the `region:2` unlock** (moves to boss 8) | First weapons, 5-6 soldiers |
| 2 | 10 | Gråpäls, flockens ledare | 960 | 7 | 3.4 | 90 s | 10.7 | 2 prisoners; unlock **Ekskogen** (wood site) | Armed ratio, drill 1 |
| 3 | 15 | Kråkfot, rövarhövdingen | 1,550 | 9 | 4.8 | 120 s | 12.9 | 1 prisoner; **group slot 4**; unlock Djupa brottet (stone/ore site) | Second fighting group |
| 4 | 20 | Mossfrun | 2,500 | 11 | 6.6 | 120 s | 20.8 | Resources (150 ore, 300 wood); unlock **Forge III-V** | Weapon quality, mastery 2 |
| 5 | 25 | Fogde Svartbrand | 4,000 | 12 | 9.2 | 120 s | 33.3 | 2 prisoners; unlock Barracks III | Troop level, 3 weapons groups |
| 6 | 30 | Stentrollet Grymstorp | 6,400 | 13 | 13.0 | 150 s | 42.7 | 1 prisoner; **group slot 5**; 400 stone, 40 ore | Big front army, food upkeep |
| 7 | 35 | Kapten Järnhand | 10,400 | 15 | 18.2 | 150 s | 69.3 | 1 prisoner + 1 officer troop gets +1 level step; **T2 blueprint becomes visible** (locked, §19.5) | Nearly everyone fights |
| 8 | 40 | Borgherre Skarpmark | 16,800 | 17 | 25.6 | 150 s | 112 | 2 prisoners; **unlock region 2**; Skarpmarks nyckel (bridge, §19.9) | The whole army, armed, fed, feast |

Prisoners per boss: 2, 2, 1, 0, 2, 1, 1, 2 (about half of the late soldier growth comes from rescues, the rest from beds and training; guess).

**Failure rule.** The fight ends as a failure when the timer runs out **or** when the fighting troops' wounds reach half of their max HP (a "retreat", D-35). Nobody dies in a boss fight (D-15): wounds heal, soldiers stay. Effect: `boss = null`, event `bossFailed`, the troops go back to level L-1 (a safe level) and farm; the player may challenge again at any time with no cooldown. The fight is deterministic dps against HP, so retrying is only useful when the numbers have changed; the boss card shows "behövs X dps, ni har Y" (`estimatedBossDamage`). Normal levels keep the D-34/D-35 loss rules.

### 19.3 Pacing targets

**What "1-2 days" means in sim time.** The game clock includes offline time. A real player checks in about 10-14 times a day, plays actively for the first 2 hours, and sleeps once per day (one 8 h gap, the offline cap). Target: **level 40 boss defeated at about 32 h of game time for the check-in bot (accepted window 24-40 h)**, which is roughly 1.3-1.7 days of wall-clock. The existing active `balanced` bot (acts every 5 s) is faster: **about 22-26 h (window 18-30 h)**, a lower bound on how fast anyone can go.

New bot mode `checkin`: identical to `balanced` for the first 2 h; after that it acts only at 45-min steps (`t = 2 h + k x 45 min`), plus one 8 h blackout per 24 h (clock 15-23 h, 39-47 h) resolved with `catchUp(secureForOffline)`. At each action it collects, queues all buildings it can afford, assigns every group, tries the next boss if `estimatedBossDamage >= 1.0 x hp`, and nothing else. Results are compared for Humans and Orcs.

Boss times (check-in bot, Humans, game time; Orcs +15-20 %, as in pass 12; guess):

| Boss | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 |
|---|---|---|---|---|---|---|---|---|
| Time | 0:41 (today) | 2:30 | 5:00 | 8:30 | 13:00 | 18:30 | 25:00 | 32:00 |
| Gap to previous | | 1:50 | 2:30 | 3:30 | 4:30 | 5:30 | 6:30 | 7:00 |
| Active bot (about x0.72) | 0:41 | 1:50 | 3:40 | 6:10 | 9:20 | 13:20 | 18:00 | 23:00 |

Gaps grow because bosses are heavier and the late recruit curve is steeper; a wall of 1.5-2.5 h of build-up before each late boss is the intent, with something to buy every 30-60 min (§19.5). Level 1-5 numbers stay: Humans boss 40-48 min (existing guard).

Army at each boss (Humans; soldiers counted when the fight starts, then after the reward; guess):

| Boss | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 |
|---|---|---|---|---|---|---|---|---|
| Soldiers at start | 6 | 10 | 13 | 16 | 19 | 23 | 26 | 29 |
| After rewards | 8 | 12 | 14 | 16 | 21 | 24 | 27 | 31 |
| Groups | 2 -> 3 | 3 | 4 | 4 | 4 | 5 | 5 | 5 |
| Armed | 5/6 | 9/10 | 12/13 | 15/16 | 18/19 | 21/23 | 24/26 | 27/29 |
| Fighting troop level (about) | 9 | 12 | 15 | 18 | 21 | 24 | 27 | 30 |
| Weapons crafted (cumulative) | 8 | 25 | 60 | 120 | 200 | 300 | 420 | 560 |

Orcs: 1.2-1.3x the soldiers (more beds per building, higher upkeep), boss times +15-20 %. Soldiers stay readable: 6 -> 29 in a day and a half, never more than 5 groups; recruits per boss are 2-3, so the player sees roughly one new soldier every 1-2 hours.

Guards for `tools/sim/balance.test.ts` (new): boss times inside +-20 % of the row above for `checkin`, and +-30 % for `balanced`; soldiers at start within +-2 of the row; armed ratio >= 0.85 at every boss; event gap <= 60 min between boss 10 and 40 (`checkin`: <= 60 min between **bot actions' results**, i.e. there is always something finished or purchasable at each check-in); first 45 min unchanged (existing guards).

### 19.4 Walls as army checks

A wall exists when the next level is not `safe` (stageSafety) or when the boss estimate is below 1.0. The "what limits you" strip names the cause in Swedish: "Nivå 23: för många sår, fler soldater eller bättre vapen behövs", "Boss: behöver 33 dps, ni har 27". Each cause points at a lever the player owns: soldiers (beds, food, training), weapons (forge, mastery, armed ratio), levels (fight more), drills (Exercis, Drill ground), second group in combat, feast (+25 % attack, D-58). **No timer gates progress**: a wall is crossed by building, never by waiting alone.

### 19.5 Economy growth

Principle: **extend what exists with formula levels, add almost nothing new.** New content in total: **1 new building (Drill ground), 2 new upgrades, 2 new work sites** (the sites are boss rewards, not buildings; if the owner wants a strict three, drop Ekskogen and give the woodshed two more levels instead).

*Repeatable building levels* (`repeatLevels(base, n, growth)` in content, so no hand-written tables):

| Building | New levels | Effect per level | Cost formula for level n (guess) | Opens |
|---|---|---|---|---|
| Tält | 4-8 | +1 bed (x race bed multiplier) | wood `80 x 1.35^(n-3)`, stone `50 x 1.35^(n-3)`, work `120 x 1.25^(n-3)` | Tent 4 after boss 1 |
| Baracker | 3-5 | +5 beds | x2.0 per level from level 2 (400/300/100 food, work 1,500) | III boss 5, IV/V by cost only |
| Gård | 3-6 | +1 field slot | wood `70 x 1.4^(n-2)`, stone `40 x 1.4^(n-2)`, work `300 x 1.3^(n-2)` | After boss 1 |
| Smedja | 3-5 | +1 anvil | wood 150 / stone 100 / ore `10 x 1.6^(n-2)` | Boss 4 |
| Vedskjul | 2-4 | +1 slot in Björkdungen | wood `50 x 1.5^(n-1)`, stone `20 x 1.5^(n-1)` | After woodshed 1 |

Humans beds: 14 today + 5 (tents) + 15 (barracks III-V) = **34**, enough for 31 soldiers. Extra work sites: **Ekskogen** (woodcutting, capacity 4, 8 wood per 40 s, boss 2) and **Djupa brottet** (mining, capacity 3, 5 stone per 40 s, boss 3). They fix the stone/wood bottleneck of the barracks.

*New building:* **Övningsplan (Drill ground)**, 5 levels, each `modifier attack mult +0.08` (level 5 = +40 %; assumes modifiers of the same stat add, QA to verify), wood `150 x 1.5^(n-1)`, stone `100 x 1.5^(n-1)`, food `60 x 1.5^(n-1)`, work `400 x 1.3^(n-1)`. Unlocked by boss 1.
*New upgrades:* **Exercis II** (attack +0.25, food 120 + wood 120, unlocked by boss 2) and **Fältkök II** (food skill +0.3, wood 200 + food 150, unlocked by Farm III).

*Recruit curve (needs owner approval, §19.10).* Keep today's `1.5^(n-2)` / `1.35^(n-2)` up to n = 8 and use a gentler tail: food `456 x 1.12^(n-8)`, time `546 s x 1.06^(n-8)` (soldier 16 about 1,400 food and 15 min; soldier 29 about 4,900 food and 30 min; whole tail about 40,000 food and 6 h of training; guess). Implement as `trainFoodGrowthLate` and `trainTimeGrowthLate` after `lateFrom: 8` in constants.

*Troop slots:* 3 (boss 1, today), 4 (boss 3, level 15), 5 (boss 6, level 30). Slots 4-5 give the player "one group per job".

*New objectives* (about one per 30-60 min; `G` guiding, `O` optional; times are for the check-in bot; rewards are small resources so no goal pays for a wall):

| id | Type | requires | Condition | Reward (guess) | Time |
|---|---|---|---|---|---|
| `barracks1` | G | boss | Barracks level 1 | food 50 | 0:55 |
| `drill1` | G | boss | Drill ground level 1 | wood 60 | 1:15 |
| `lvl8` | O | boss | reach level 8 | food 60 | 1:30 |
| `soldiers10` | G | boss | 10 soldiers | wood 80 | 2:10 |
| `boss2` | G | `lvl10` | beat boss 2 | see §19.2 | 2:30 |
| `tents5` | G | boss2 | Tent level 5 | stone 60 | 3:00 |
| `farm4` | O | boss2 | Farm level 4 | food 100 | 3:40 |
| `kills300` | O | boss2 | 300 kills | ore 15 | 4:10 |
| `boss3` | G | `lvl15` | beat boss 3 | | 5:00 |
| `weapons60` | G | boss3 | 60 weapons crafted | ore 20 | 5:50 |
| `soldiers14` | G | boss3 | 14 soldiers | food 150 | 6:40 |
| `barracks3` | G | boss3 | Barracks level 3 | wood 150 | 7:30 |
| `boss4` | G | `lvl20` | beat boss 4 | | 8:30 |
| `forge4` | G | boss4 | Forge level 4 | ore 30 | 10:00 |
| `mastery3` | O | boss4 | mastery step 3 (180 weapons) | food 200 | 11:00 |
| `drill3` | G | boss4 | Drill ground level 3 | stone 150 | 11:45 |
| `boss5` | G | `lvl25` | beat boss 5 | | 13:00 |
| `farm6` | G | boss5 | Farm level 6 | food 250 | 14:30 |
| `kills700` | O | boss5 | 700 kills | ore 40 | 16:00 |
| `soldiers22` | G | boss5 | 22 soldiers | wood 200 | 17:10 |
| `boss6` | G | `lvl30` | beat boss 6 | | 18:30 |
| `barracks5` | G | boss6 | Barracks level 5 | food 300 | 21:00 |
| `drill5` | G | boss6 | Drill ground level 5 | stone 300 | 23:00 |
| `boss7` | G | `lvl35` | beat boss 7 | | 25:00 |
| `weapons500` | O | boss7 | 500 weapons crafted | ore 80 | 28:00 |
| `soldiers28` | G | boss7 | 28 soldiers | food 500 | 29:30 |
| `boss8` | G | `lvl40` | beat boss 8, "Öppna bron" | region 2 | 32:00 |

Boss objectives need `{ kind: 'bossDefeated', index }` (index optional, default 1) and a `levelReached` condition (or reuse `stageReached`, 1-based). `boss` (id kept) is boss 1.

**T2 weapons: recommendation is to wait for zone 2.** Reasons: D-29/D-39 make T2 a real milestone, D-30 gates it on region progress and tiered materials (a T2 recipe needs iron/refined material from a zone-2 site), and zone 1's power already grows through soldiers (6 -> 31), troop levels, quality and mastery (about x1.2 from quality, x25 from all sources combined, see risks). Zone 1 only **shows** the T2 blueprint after boss 7 as a goal ("kräver järn från Älvdalen") so the player sees the horizon. This keeps T1 as the whole of zone 1 and zone 2's first hour as a clear upgrade moment.

### 19.6 Offline

Everything is deterministic: `advance` is event-driven and bosses are plain dps-against-HP with a timer, so no randomness is needed.
- **Leaving during a boss fight:** abandoned (`secureForOffline`, D-36, event `bossAbandoned`); it is **not** a failure.
- **Offline progress:** kills still count only at the highest level; auto-advance clears levels up to the next boss gate when they are `safe`, then the troops keep farming that level (xp, loot, and the other groups keep working). The boss is **never started offline** (D-36 stays), so an 8 h absence ends at "boss ready" at worst, with resources banked.
- **Unsafe level:** if the level the troops stood on is not safe for the army at leave time (for example the player moved a soldier out), `secureForOffline` walks down to the highest safe level (up to 40 checks) and farms it; no clearing progress, but xp and loot. No safe level means retreat to camp, as today.
- **Failure and farm-back:** both happen online only. After a failure the troops sit on level L-1 and, if the player leaves, that level is already safe, so offline farming continues from there.
- **Offline cap (R-16, open question).** Today `OFFLINE_CAP_SEC` is 8 h. With one 8 h night per day the cap is just enough; a 10 h absence loses 2 h (about 5 % of a day). **Recommendation:** keep 8 h in M13, show the "capped, you were away 10 h, 8 h counted" notice, and measure with the `checkin` bot with a 9-10 h blackout before deciding on 12 h. Not decided.

### 19.7 Engine changes (for the systems agent)

1. **Multiple bosses per zone.** `ZoneDef.boss` -> `bosses: { level; enemyId; timeLimitSec }[]`. Rewards stay in objectives (`boss`, `boss2` ... `boss8`).
2. **Enemy generator in content.** `world.ts` builds `enemies` and `zones.farmsteads.stages` (40 entries) with `makeEnemy(level, band, role)` from the tables in §19.1; levels 1-5 and Betarn are hand-written overrides. Names and bands are data; no generator code in `src/core`.
3. **Combat state.** `bossDefeated: boolean` -> `bossesDefeated: number` (0-8). `unlockedStage` max is `5 x (bossesDefeated + 1) - 1` (0-based). `cleared` means "the boss-level stage is cleared and the next boss is ready". `boss: BossFight | null` gains `index`. New `autoAdvance: boolean` (default true). `startBoss` uses boss `bossesDefeated + 1`; `stageSafety(..., 'boss')` and `estimatedBossDamage` use the same.
4. **Events.** `bossDefeated`, `bossFailed`, `bossAbandoned` carry `index`. New condition kinds `bossDefeated{index}` and (if not reusing `stageReached`) `levelReached`.
5. **Boss fight rules.** Non-lethal (§19.2): no soldier loss during a boss fight, failure on timer or on wounds >= 50 %. Hidden on normal levels: unchanged.
6. **Buildings and constants.** `repeatLevels` helper; Drill ground, Exercis II, Fältkök II, two sites; late recruit curve constants.
7. **Save 9 -> 10** (`SAVE_VERSION` 10):
   - `combat.bossDefeated: true` -> `bossesDefeated = 1`, `unlockedStage = max(unlockedStage, 5)` (level 6), `stageIndex` kept, `kills = 0`, `cleared = false`; the unlock `region:2` is removed;
   - `bossDefeated: false` -> `bossesDefeated = 0`, `cleared` and `unlockedStage` unchanged (boss 1 ready if `cleared`);
   - `stats.bossDefeatedAt` -> `stats.bossTimes: (number | null)[]` with the old value at index 0; `boss: BossFight` in flight gets `index = 0` (it is abandoned on load anyway);
   - new objectives are not marked done; `boss` stays done for beaten saves; no free soldiers (as in 16.5).
   - Tests: a v9 save with the boss beaten loads at level 6 with the same soldiers and resources; a v9 save at "cleared, boss not beaten" can still start boss 1; a pre-boss save keeps `stageIndex`.
8. **UI.**
   - Level picker for 40 levels: horizontal strip grouped by band of 5 with the band name above; chips show cleared / current / locked and a safety colour (safe / risky / deadly) from `stageSafety`; boss levels get a shield marker; tapping a chip calls `selectStage`.
   - Boss card: name, HP, timer, needed vs actual dps, reward preview, "Utmana" button; after a failure a "Gå tillbaka till nivå N-1" button.
   - Strip "what limits you": wall causes (§19.4).
   - Settings: auto-advance toggle.
   - Chronicle: boss times 1-8.
9. **Sim.** `checkin` bot mode (§19.3), boss list awareness in `bot.ts`, new guards.

### 19.8 Pacing risks (summary in §19.10)

The main danger is that all five conditions must hold at once: HP growth, recruit curve, building costs, kill counts and the check-in rhythm decide the clock. Knobs for QA, in order: (1) HP growth 1.09-1.11, (2) kills per level 20-50, (3) late recruit growth 1.10-1.15, (4) building cost growth 1.25-1.45, (5) boss timers 90-180 s. Power budget (guess) at boss 40 against level 5: fighting soldiers x5, troop level x2.1, armed x1.25, drills and Drill ground about x1.8, quality x1.1, feast x1.25 for the final boss = about x25-30 against HP x32 and armour 3 -> 15 (damage per hit efficiency x0.8). That is deliberately tight at the top: the final boss needs nearly everyone fighting plus the feast.

### 19.9 Zone 2 outline (levels 41-100)

Zone 2 continues the same pattern (generator, boss every 5 levels, formula building levels) with a wider army and tier 2: about 4-6 more days, soldiers about 30 -> 100, groups 5 -> 7, T2 unlocked in its first quarter and T3 hinted at the end. The final boss of zone 1 gives the key to the bridge. No numbers beyond these rough targets; a separate spec follows.

| Levels | Working name | Theme | Rough targets |
|---|---|---|---|
| 41-55 | Älvdalen | River lands, ferrymen, wolves, first iron seams | T2 materials, soldiers 30-50 |
| 56-70 | Bergspassen | Cold mountain pass, ogres, rock-slides | Barracks VI+, second forge line, T2 mastery |
| 71-85 | Svartskogen | Dark forest, spiders, cursed hunters | Troop size 20+, armour matters |
| 86-100 | Askslätten | Burned plain, war camps, the real enemy | Final boss, T3 hint, soldiers about 100 |

### 19.10 Risks and open questions

Risks:
- **Pacing is a guess.** 1-2 days is only reachable if the recruit curve, building costs and kills interact as modelled; the `checkin` mode adds idle time the old bot never had. Expect two to three tuning passes.
- **Late recruit curve changes D-45's feel** for soldiers 9+ (cheaper than the old formula would have been); soldiers 1-8 are unchanged.
- **Check-in rhythm** hides waste: if a player misses a purchase window the clock still runs. The strip and notices ("redo att köpa") must show what is affordable.
- **Non-lethal bosses** differ from D-34/D-35 for normal levels, so the rule is boss-only.
- **Save migration** touches `combat`, `stats`, `unlocks`; migration tests are mandatory.
- **UI crowding**: 40 chips on a phone; grouping by band mitigates it.
- **Scope**: the two work sites go beyond "2-3 new buildings or upgrades" unless counted as boss rewards.

Open questions for the owner (max 5), each with a recommendation:
1. **Does "1-2 days" mean about 32 h of game time with the check-in rhythm (window 24-40 h)?** Recommendation: yes; a faster active player at about 22 h is fine.
2. **T2 weapons: zone 1 late levels or zone 2?** Recommendation: zone 2; zone 1 only shows the blueprint after boss 7.
3. **May the recruit curve for soldiers 9+ be gentler (food x1.12 and time x1.06 per soldier)?** Recommendation: yes; without it 20+ soldiers cannot be reached.
4. **Offline cap: keep 8 h or move to 12 h?** Recommendation: keep 8 h with a visible "capped" notice, revisit after the sim; do not auto-start bosses offline (D-36 stays).
5. **Are boss fights non-lethal and are the two extra work sites (Ekskogen, Djupa brottet) acceptable?** Recommendation: yes to both; they solve stone/wood limits without new buildings.
