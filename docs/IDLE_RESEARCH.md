# Idle Research and Design Proposals

> 💡 Research summary and proposals, nothing decided. Sources are search snippets (full pages could not be fetched); verify before relying on specifics.

Author: Game Designer agent, reviewed by the lead. Every change to balance or vision needs the owner's approval (CLAUDE.md). Scope: how comparable idle games structure long-term progress, how Utposten compares, and what to do in three horizons. Confirmed decisions are cited as **D-xx** (see [DECISIONS.md](DECISIONS.md)); everything else is a proposal (**R-xx**) and needs the owner.

Legend: ✅ supported by a snippet of the named source · 💬 community or secondary claim · 💡 our inference.

---

## 1. What idle games do (the whole arc)

1. **Active phase, then a conversion reset (prestige).** Cookie Clicker converts progress into permanent currency and upgrades through Ascension. ✅ (cookieclicker.wiki.gg/wiki/Prestige)
2. **Stacked reset layers, each with a bigger multiplier; challenges restrict mechanics.** Antimatter Dimensions. ✅ moderate confidence (antimatter-dimensions.fandom.com/wiki/Guide)
3. **Costs grow exponentially, production roughly linearly; a reset restarts with a persistent multiplier and "must hurt just enough".** 💬 (gamedeveloper.com, "Math of idle games", snippet)
4. **Offline progress is simulated, but capped.** Melvor Idle is said to cap at ~24 h (an 18 h claim conflicts). 💬 (Steam discussions). Players mod caps away, so tight caps read as punitive. 💬
5. **Daily rewards are capped on purpose so nobody is forced to log in daily.** AFK Arena developers, 28/10/2019. ✅ (afk-arena.fandom.com). Monetisation walls are the common complaint (AFK Journey reviews). 💬
6. **Mastery in layers.** Melvor: skill XP, per-item mastery XP, a per-skill mastery pool with checkpoints at ~10/25/50/95 % (values conflict). ✅ Clicker Heroes: hero milestone upgrades at levels 25/50/75/100; souls drive prestige. ✅
7. **Population and capacity as the growth axis.** Kittens Game: huts and log houses raise the population cap, kittens take jobs, seasons modify production. ✅ low-quality snippet. Albion: tier, enchant sub-tier and quality are separate axes, item power is additive (+100 per tier or enchant). ✅ (guildorder.com; an older forum claim conflicts)
8. **Surplus needs a sink.** Satisfactory's AWESOME sink turns surplus into coupons ✅; an ONI forum idea trades surplus for temporary buffs 💬.

Not found: concrete unlock pacing data (when the next layer opens, in minutes or days).

---

## 2. How Utposten compares

| Pattern | Idle games | Utposten today | Fit | Why |
|---|---|---|---|---|
| Prestige reset | Core loop of Cookie Clicker, Antimatter Dimensions, Clicker Heroes | None; progress is kept (D-29, D-45 to D-50). Q-05 (persistent realm vs prestige) is open | **Avoid** classic form; **adapt** a soft variant later (see 3.3) | Resetting named, slow soldiers contradicts the vision; "hurt just enough" is hard to square with D-15 |
| Persistent currency at tier transitions | Souls, heavenly chips | T2 is gated by materials, forge level, mastery, never a timer (P-28, D-30) | **Adapt** | Keep gates as goals; a non-resetting "renown" is an option, not a multiplier wall |
| Exponential cost curves | Universal | Recruit food grows 1.5^n (M10a); training time grows | **Adopt** (already) | Fits "slow meaningful soldiers" |
| Growth by multiplier | Dominant | Growth by beds, slots, sites (PROGRESSION_V2 §10) | **Avoid** multipliers | Matches the research lesson: widen, not stack |
| Offline cap | 8 h to 24 h, controversial | No losses offline (D-36); 8 h cap only proposed (P-12) | **Adapt** | Cap must be visible in the UI; prefer generous |
| Daily caps vs login pressure | AFK Arena | No daily system | **Adopt** as principle | Matches idle, mobile-friendly play (Q-04) |
| Population cap + jobs | Kittens Game | Beds (D-45), work sites with capacity (D-47) | **Adopt** (already) | Our binding constraint is visible in principle; UI is M10c |
| Layered mastery | Melvor | Forge mastery per type/tier, 20 weapons per step (D-43, P-27); group XP (D-48) | **Adapt** | Add a capped pool with checkpoints; avoid raw level totals as currency |
| Tier x quality axes | Albion | Tiers T1 to T8 and 5 qualities (D-26, D-28, P-25) | **Adopt** (already) | Needs one documented rule on which axis drives combat |
| Milestone upgrades | Clicker Heroes 25/50/75/100 | Objectives; few upgrades, mostly single level | **Adapt** | Group levels could unlock visible steps |
| Surplus sink | Satisfactory, ONI | None; stone and wood pile up later | **Adopt** | Design early, before region 2 |
| Monetisation walls | AFK Journey complaints | Q-06 open | **Avoid** | Pacing stays goal-based (D-17) |
| Seasonal modifiers | Kittens Game | None | **Avoid** for now | Extra complexity with little payoff at 5 soldiers |

---

## 3. Proposed direction

### 3.0 Confirmed constraints the proposals must respect

- Few, slow, meaningful soldiers: ~2 at 15 min, 3 to 5 at 30 to 40 min (D-50); soldiers come from beds, food and training (D-45).
- Groups are slots, separate from soldiers (D-46). Work is cycles at sites with capacity (D-47). Cycles give group XP (D-48).
- Goals and dependencies, not timers (D-17); no losses offline (D-36); tiers are very slow and gated by progression (D-29, D-30); only T1 is unlockable (D-39).
- Core already supports building effects of kind `capacity` targeting a site id, `construction` or `smithing`. More anvils, builders and site room need **content only**. Training is one slot today; n slots needs a small hook.
- Correction noted: D-43's "smithRate 0.3" is outdated. M10a uses smithRate 1 with 60 work per sword (the lead is fixing the doc).

### 3.1 Now: M10b, upgrade the first hour

Evidence (internal review, sim bot Humans): events every 1 to 3 min in minutes 0 to 10; weak stretch 10 to 35 min (stage 2 to 3 takes 11.5 min); lull stage 4/5 to boss (forge 34:46, stage 4 36:52, stage 5 42:35, boss 43:55); forge barely matters (5 weapons, 5 of 7 armed, mastery 0, x1.19); five thin upgrades; horde trait never fires under 10 soldiers; Orcs boss +22 %.

| # | Proposal | Merges research lesson |
|---|---|---|
| R-01 | **Mid-game objectives with rewards in minutes 15 to 35**, each ending in a visible gain (a site, a slot, a building level, a rescue) | Idle games keep a payoff every few minutes; milestone steps (Clicker Heroes) |
| R-02 | **A pre-boss goal** (stage-4 rescue quest or a Watchtower) and a shorter stage 5 | Fixes the 10-minute lull (PROGRESSION_V2 §12) |
| R-03 | **Earlier forge payoff**: first mastery step sooner (e.g. 10 instead of 20 weapons for step 1) and boar ore loot (fighting groups already get the best weapons first, via auto-equip, D-42) | Melvor: early checkpoint; Q: forge relevance |
| R-04 | **Second levels for buildings and upgrades** using existing `capacity`/`construction`/`smithing` effects: Workshop II (+1 anvil), Lodge (+1 builder), Stone picks, wider woodland site | Capacity as the growth axis (Kittens) |
| R-05 | **Small-army race traits**: replace the horde threshold of 10 with traits that work at 1 to 5 (e.g. Humans: first cycle of a site per stage gives +25 %; Orcs: +attack when outnumbered) | Race identity must show at small numbers (D-08) |
| R-06 | **Simple work orders**: "finish this building, then return to X"; one queued follow-up per group | Reduces switching in minutes 5 to 15 (§12 risk) |
| R-07 | **Stage variety**: a stage-specific modifier or enemy (e.g. a ranged fox, a herd that drops hides) so stages differ in more than numbers | Avoids a number-only grind |
| R-08 | **Visible level payoffs**: group level-ups show a named step (e.g. level 3: +1 carry, level 5: a trait) | Clicker Heroes milestones; avoid raw totals |
| R-09 | **Show the constraint**: bed count, training queue and ETA, and full sites ("2 idle here") on the main screen; offline cap shown if one is introduced | Make the binding constraint visible; recruit gate shows queue/ETA (training bar exists) |

Balance guard: keep soldiers at D-50 targets. Rewards in R-01 to R-04 are **capacity and speed**, not extra soldiers, except rescues that are already planned.

### 3.2 Next: region 2, about day 1 to 3

| # | Proposal | Notes |
|---|---|---|
| R-10 | **Capacity buildings in chains**: Barracks (beds x5), War camp (2 training slots, needs the n-slot hook), larger forest and mine sites | PROGRESSION_V2 §10 targets 15 to 40 soldiers |
| R-11 | **Two-layer mastery**: per-item mastery as today plus a **capped per-type pool** with checkpoints (suggest 10/25/50/95 %) giving permanent bonuses such as +1 anvil speed step, a quality chance step, or a cheaper material; no raw level total as currency | Melvor pattern; values are placeholders |
| R-12 | **One axis rule**: tier sets base power, quality is a visible step (named, with an icon), and enchant-like sub-tiers are not added before T2. Document it in EQUIPMENT_AND_CRAFTING.md | Albion lesson; avoid a third axis |
| R-13 | **Work orders v2**: standing orders per group ("keep ore above 20", "build then smith") | Idle management without login pressure |
| R-14 | **Surplus sink**: a Hall / Feast building that burns surplus food, wood and stone for a **temporary buff** (a few cycles of speed or morale) or for town "renown" that unlocks cosmetic plot stages | Satisfactory/ONI; buffs are short so they never become mandatory |
| R-15 | **Visible constraints panel**: per group, what limits it right now (bed, site room, ore, anvil, builder) | Kittens Game cap feedback |
| R-16 | **Offline rules**: simulate up to a cap, show "capped in X h" and the amount earned; no login-streak rewards, any daily bonus capped | AFK Arena lesson; P-12 proposed 8 h, owner to decide |

### 3.3 Long term: T2 to T8, months

**Tiers.** Keep D-29 and D-30. T2 needs region-2 materials from low-capacity sites, Forge level 2 and mastery pool checkpoints (R-11). Each tier opens a new set of sites and recipes rather than a multiplier on the old ones; T(n) mastery is one gate for T(n+1) (P-27).

**Regions.** Each region adds sites, capacity, enemies and a boss that frees a group or soldiers (extends D-46). Growth is by widening (PROGRESSION_V2 §10), controlled per region.

**Prestige, evaluated critically.**

| Option | Verdict | Reasons |
|---|---|---|
| Classic reset (lose soldiers, buildings, gear for a permanent multiplier) | **Reject** | Soldiers are few and meaningful (D-15, D-50); resetting five named soldiers erases the emotional core. Multipliers also fight "grow by capacity". Raises F2P-style grind and conflicts with D-36's no-loss spirit |
| Persistent currency at tier transitions that spends away progress | **Reject** | Conflicts with "keep everything" and D-29 |
| **Non-resetting legacy layer** (renown earned from bosses, tier firsts and chronicle milestones; spent on permanent options such as a new starting perk or unlocking cosmetic plot stages) | **Adapt, later** | Gives long-term sinks without loss; must not be a power multiplier |
| **New realm with a different race** (Dwarves, Elves; D-23) as a second save slot sharing renown | **Adapt, preferred** | Provides "start over" appeal for those who want it, while the main realm is never lost; Q-05 can then be answered as "persistent realm, optional fresh realms" |
| Challenge runs (restricted rules, Antimatter Dimensions style) | **Consider** | Optional modes such as "no forge" or "one group" for renown; low risk, but only after T2 |

**Recommendation:** no prestige reset. Prefer a persistent realm plus an optional second realm (new race) and a small renown layer. Revisit only if playtests show a late-game stall that capacity cannot fix.

---

## 4. Prioritised list

| # | Proposal | Value | Size | Balance impact | Owner decision |
|---|---|---|---|---|---|
| 1 | R-02 pre-boss goal + shorter stage 5 | High (fixes lull) | S | Low (boss time ~−5 min, guess) | Yes (balance) |
| 2 | R-01 mid-game objectives 15 to 35 min | High | M | Medium (gives visible gains) | Yes (balance) |
| 3 | R-03 earlier forge payoff + boar ore | High | S | Medium (more armed soldiers, x1.19 rises) | Yes (balance) |
| 4 | R-04 second building/upgrade levels | High | S (content only) | Medium | Yes (balance) |
| 5 | R-09 / R-15 visible constraints and queue/ETA | High | M (UI, M10c) | None | Scope only |
| 6 | R-05 small-army race traits | Medium | S | Medium (Orc boss +22 % may close) | Yes (balance, race identity) |
| 7 | R-08 visible level payoffs | Medium | M | Low | Yes if steps add power |
| 8 | R-06 work orders (single follow-up) | Medium | M | None | Scope only |
| 9 | R-07 stage variety | Medium | M | Medium | Yes (balance) |
| 10 | R-16 offline rules and cap display | Medium | S to M | Medium | **Yes** (cap length) |
| 11 | R-10 capacity chains + n training slots | High | M to L | High (core of soldier growth) | Yes (targets at day 1 to 3) |
| 12 | R-11 two-layer mastery pool | Medium | M | Medium | Yes |
| 13 | R-14 surplus sink | Medium | M | Low | Yes (buff vs renown) |
| 14 | R-12 tier/quality axis rule | Medium (clarity) | S (doc) | None | Yes |
| 15 | Prestige position (reject classic; optional realm/renown) | High (direction) | n/a | Long term | **Yes** (Q-05) |

---

## 5. Open questions for the owner

1. **Q-05 (prestige):** Do you accept "no reset, persistent realm", with an optional second realm for another race and a non-multiplying renown layer later?
2. **Offline cap:** Should offline progress be capped (P-12 proposed 8 h), and should we show it? Is a generous cap (24 h or more) preferred over a tight one?
3. **Play rhythm (Q-04):** Mostly idle with few check-ins, or semi-active? This sets work orders, queue length and how much help the UI gives.
4. **Surplus sink:** Temporary buffs, town renown, or both? Should surplus ever convert into something permanent?
5. **Tier vs quality:** Which axis should drive combat power? Proposal: tier sets base, quality is a visible step, no third axis before T2.
6. **Soldier targets for day 1 to 3:** Is 15 to 40 soldiers (PROGRESSION_V2 §10) still right given D-50, or should region 2 stay under ~15?

## 6. Clicker Heroes: zones, bosses and prestige (2026-10-23, for the zone 1 expansion)

Sources: the research agent used search snippets only, because the Clicker Heroes wiki and blog could not be opened from this environment. Facts marked (general knowledge) are well known in the community but were not verified against an opened page here.

| Topic | Clicker Heroes | Source / status |
|---|---|---|
| Zone size | 10 monster kills advance a zone; later +0.1 monster per 500 zones | blog.clickerheroes.com monsters guide (snippet) |
| Bosses | Every 5th zone is a boss zone; beat it within the timer to advance | same (snippet) |
| Boss timer | 30 s; on failure you stay one zone below and farm until stronger | (general knowledge), timer unconfirmed |
| Boss HP | About 10× a normal monster | Steam discussion (opinion) |
| HP growth | About 1.6× per zone up to zone 140, then about 1.15× ("the wall softens"), steeper again much later | Reddit (opinion) + (general knowledge) |
| Primal bosses | From about zone 100, some bosses are "primal" and drop Hero Souls, the prestige currency | search summary, unverified |
| Ascension | Soft reset: gold, heroes and zone reset; Hero Souls (+10 % DPS each) and Ancients (permanent upgrades) are kept; 1 soul per 2,000 hero levels | blog.clickerheroes.com (snippets) |
| Transcendence | Second reset layer: also resets souls and Ancients, gives Ancient Souls and Outsiders | wiki talk page, trueachievements (snippets); details disputed |
| Realm Grinder | Three soft-reset layers; reviewers find the sense of achievement short-lived | toucharcade review, fandom wiki |

**Why it works:** a boss every 5 zones gives a short goal loop: 5 zones, a boss, a small reward. HP grows faster than income, so the player hits a wall. A wall pushes the player to reset, and the re-climb is quick and satisfying with the new permanent bonus.

**Lessons for Utposten (R-17 to R-21)**

| # | Lesson | Fit |
|---|---|---|
| R-17 | **A boss every 5 levels** in a zone, with a short visible goal loop of 5 levels → boss → reward. The current Gamle Betarn becomes the first mini-boss at level 5, so the tuned first hour is untouched | Adopt |
| R-18 | **Walls are deliberate:** each mini-boss checks the army (soldiers, weapons, troop size), so a wall means "build up", not "wait for numbers". Failing a boss sends the player back to farm the level below; nobody dies (D-15) | Adapt |
| R-19 | **No timed boss for offline play**, or a timer the offline loop resolves deterministically; the current 90 s boss fight already works this way | Keep |
| R-20 | **Readable numbers:** HP growth of about 1.12–1.2× per level gives level 40 roughly 100–1,000× level 1, not Clicker Heroes' exponents | Adapt |
| R-21 | **No classic prestige** (it would wipe named soldiers). A soft variant could come later: a "campaign" layer per zone that keeps the army and rewards replaying a cleared zone faster, or a realm/legacy layer for a second race. Revisit Q-05 after zone 2 | Avoid classic, adapt soft later |
