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

