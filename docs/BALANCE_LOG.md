# Balance Log

> Record of every simulator-driven tuning pass: what was measured, what changed and why.
> Run it yourself with `npm run sim` (summary) or `npm run sim -- --race orcs --log` (full timeline).
> **Bot times are faster than human play.** The bot decides instantly every 5 s and never reads text. Expect a real player to take roughly **1.5–2×** as long, plus ~1 minute for choosing a race.

---

## How the simulator works

- `tools/sim/bot.ts` plays the game through the **same public core API** the UI will use (`dispatch`, `advance`).
- It follows a priority wishlist (Sharpened Axes → Training Camp → Drill → … → Barracks 2). It gathers the slowest-to-fill missing resource, recruits with spare food, and challenges the boss when its damage estimate is ≥ 105% of the boss's HP.
- **Strategies:**
  - `balanced`: from Troop 2 onward, the strongest troop always fights while the others gather. Once the wishlist is finished, it works towards growth (the next 10 recruits).
  - `economy`: fights only when nothing is needed. This is the "neglect combat" comparison.
- `tools/sim/balance.test.ts` turns the P0 targets into automated tests, so a content change that breaks pacing fails `npm test`.

---

## Pass 1: 2026-10-22, first numbers (from FIRST_15_MINUTES v0.3)

| Milestone (bot time) | Humans | Orcs | Target |
|---|---|---|---|
| Troop 2 | 4:15 | 5:06 | ~6–8 (≈ 10–13 real) |
| Boss | 16:01 | 14:35 | 25–60 (≈ 45–75 real) |
| Soldiers at 10 min | 45 | — | ~12 |

**Problem found: snowballing.** Chickens gave 3 food per kill, and combat income grows with troop size, while each soldier cost a flat 5 food. Every recruit made the next one cheaper to afford, so the army grew exponentially and everything after Troop 2 came far too fast.

## Pass 2: escalating recruitment cost

- Recruit cost per soldier = `foodPerSoldier × (size / startSize)^1.2`. The first recruit still costs 5 food for Humans.

| | Humans | Orcs |
|---|---|---|
| Troop 2 | 4:15 | 5:06 |
| Boss | 30:59 | 30:41 |

**New problem:** the **Food** activity was almost never used (0–1% of troop-time). Combat loot covered all the food, so one of the five activities was pointless.

## Pass 3: combat gives *a little* food; Training Camp slightly more expensive

- Combat food loot was reduced roughly 3× (Wild Chicken 3 → 1, Boar 8 → 3, …), matching the owner's wording "*a little* experience and food".
- Training Camp: 40/20/15 + 400 work → **50 wood / 30 stone / 25 food + 500 work**, so that Troop 2 lands closer to minute 10 of real play.
- Orc construction skill 0.3 → **0.4**, because Orcs reached Troop 2 much later than Humans.

## Pass 4: bot fixes (the content itself was fine)

Two bot behaviours didn't match how a sensible player plays:
1. With nothing to buy, the bot sent everyone to fight instead of growing the army.
2. Equipped Orcs could not recruit because **each new soldier needs 3 ore**. The bot sat on 1,800 food while ore stayed at 3. This is the intended "equipping a horde is expensive" lever, and the bot now treats the next batch of recruits as a goal and mines the ore.

### Current result (all tests green)

```
race     strategy   Combat  Recruit  Troop 2  Barracks 1  Forge  Stage 3  Barracks 2  Zone clear   Boss
humans   balanced     1:40     2:10     5:24       14:13  23:39    14:21       30:05       32:42  35:48
humans   economy      1:40     2:10     5:24       13:43  25:36    32:51       35:16       43:37  60:16
orcs     balanced     1:15     1:50     7:03       14:42  22:22    12:14       29:33       35:26  42:17
orcs     economy      1:15     1:50     7:03       19:28  33:21    32:58       42:19       51:36  70:37

Share of troop-time      combat  mining  wood  food  build   soldiers at end
humans   balanced          38%     16%    20%   14%    12%    55 + 54
orcs     balanced          39%     21%     9%   20%    11%   155 + 153
```

### What this tells us

| Question (ROADMAP §2.1) | Answer from the simulator |
|---|---|
| Do the races play differently? | **Yes.** Orcs field ~3× the soldiers (308 vs 109), clear the rat swarm (stage 3) 2 min earlier, and spend more time mining (ore for a big army's gear) and less time woodcutting late on. Humans spend more time on wood and less on food. |
| Are the races balanced? | **Within target.** Orcs reach the boss 18% later than Humans (target ±25%). Orcs are slower against armour, as designed. |
| Is any activity useless? | **No.** With the balanced bot, all five activities get 9–39% of troop-time. |
| Does neglecting combat pay off? | **No.** `economy` reaches the boss 25–28 min later. Combat matters. |
| Troop 2 timing | 5:24 (Humans) / 7:03 (Orcs) bot time ≈ **9–12 / 11–15 min real**. On target, with Orcs at the upper edge. |
| Total P0 length | 36–42 bot minutes ≈ **55–85 min real**. Inside or slightly above the 45–75 min target. |

### Known limitations / next tuning questions

- ⚠️ **The ×1.4 "gear tier 1" from the Forge is a placeholder that will be removed** ([Equipment §6.5](EQUIPMENT_AND_CRAFTING.md#65-migration-from-todays-code)). The boss pacing above relies on it, so a retune pass is needed after M2.5.

- The bot is better than a human at optimisation and worse at "fun" choices. Real playtests (M4) must confirm the feel.
- Boss HP (7000, armour 3) is untested against human timing. Revisit after the UI exists.
- The balanced bot's "one troop always fights" is a strong rule. A cleverer bot could find better allocations. A dominant-strategy search (many random allocation policies) is a good M2+ extension.

---

## Pass 5: 2026-10-23, owner feedback "too fast", combat with life (D-32…D-36)

**Rule changes (approved by the owner):**
- Both races start with **1 soldier** (Troop 2 starts with 1 Human / 2 Orcs).
- **Soldiers have HP and heal over time:** Humans 10 HP, +0.2 HP/s; Orcs 6 HP, +0.15 HP/s. Every enemy deals damage per second to the fighting troops. If damage > healing, soldiers fall one by one.
- **The player picks the stage.** Clearing a stage opens the next one, but troops stay where they are. Each stage shows 🟢 safe / 🟡 risky / 🔴 deadly.
- **Retreat at half losses, never below 1 soldier. No losses offline:** fall back to a safe stage on leaving.

**Tuning:**
- **Enemy damage/s:** chicken 0.12, rooster 0.5, rats 1.5, boar 4, old boar 7, boss 12.
- **Recruitment:** recruit cost is flat up to 5 (Humans) / 10 (Orcs) soldiers, then escalates.
- **Early pacing for one soldier:** Training Camp back to 40 wood / 20 stone / 20 food + 400 work. The early goals are shorter (15 → 30 wood, 3 chickens).
- **Orc attack:** 0.4 → **0.5**, because a lone Orc was far too weak to get started.

**Bot change:** the bot fights at the highest *safe* stage and grows a troop first while it is under half its cap. A careful player loses no soldiers before the boss (now a test).

```
race     strategy       Combat    Recruit    Troop 2 Barracks 1      Forge    Stage 3 Barracks 2 Zone clear       Boss
humans   balanced         4:10       5:10      11:20      18:52      25:40      13:18      28:23      27:20      30:31
humans   economy          4:10       5:10      12:46      37:35      68:13      75:37      79:06      88:22     104:00
orcs     balanced         6:00       7:30      13:58      20:03      31:42      15:33      34:53      31:49      37:26
orcs     economy          6:00       7:30      28:00      41:57      50:12      46:57      58:25      63:56      74:07

Share of troop-time per activity

race     strategy    combat  mining    wood    food   build    idle   soldiers@end
humans   balanced       50%      6%     15%     23%      6%      0%   52+52
humans   economy        32%     21%     27%      5%     15%      0%   31+31
orcs     balanced       56%      8%     14%     16%      6%      0%   113+112
orcs     economy        45%     22%     16%      2%     15%      0%   87+86
```

| Question | Answer |
|---|---|
| Troop 2 | 11:20 (Humans) / 13:58 (Orcs) bot time ≈ 15–20 real minutes |
| Boss | 30:31 / 37:26 bot ≈ 45–70 real minutes; Orcs +23% (within ±25%) |
| Losses | None for careful play; the boss fight costs soldiers |

---

## Pass 6: 2026-10-23, real weapons replace the ×1.4 placeholder (M5)

- The **forge** is cheaper (80 wood / 80 stone / 10 ore, work 2,500 unchanged) so smithing starts mid-game. The bot builds it right after Barracks 1.
- **T1 Normal = ×1.25** per armed soldier (the old placeholder was ×1.4 for the whole troop at once). A sword costs 2 ore + 1 wood and 15 s at the forge.
- **Mastery max** needs about 800 weapons (≈ 3.3 h of forge time): T1 stays a long climb.
- **Bot:** keeps an order going (spare ore only), re-arms troops whenever the armoury has weapons, and counts ore for unarmed soldiers as a goal.

```
Milestones (simulated time mm:ss, bot decides every 5s, limit 180 min)

race     strategy       Combat    Recruit    Troop 2 Barracks 1      Forge    Stage 3 Barracks 2 Zone clear       Boss
humans   balanced         4:10       5:10      11:20      18:52      24:36      13:18      27:55      28:52      33:31
humans   economy          4:10       5:10      12:46      37:35      57:19     108:29     109:18     119:19     137:26
orcs     balanced         6:00       7:30      13:58      20:03      26:41      15:33      31:16      32:27      39:51
orcs     economy          6:00       7:30      28:00      41:57      46:39      44:03      57:04      65:29      81:30

Forge at the end (weapons crafted · armed soldiers · avg weapon power · mastery · quality mix N/G/O/E/M)

humans   balanced     27 crafted · 27/140 armed · ×1.05 · mastery 1 · 22/4/1/0/0
humans   economy     119 crafted · 65/65 armed · ×1.32 · mastery 3 · 88/20/7/3/1
orcs     balanced     42 crafted · 42/318 armed · ×1.04 · mastery 2 · 33/6/2/1/0
orcs     economy     139 crafted · 135/196 armed · ×1.20 · mastery 4 · 101/24/9/4/1

Share of troop-time per activity

race     strategy    combat  mining    wood    food   build    idle   soldiers@end
humans   balanced       50%      5%     13%     27%      5%      0%   70+70
humans   economy        25%     24%     30%      5%     16%      0%   33+32
orcs     balanced       46%      8%     13%     27%      6%      0%   160+158
orcs     economy        52%     18%     14%      1%     14%      0%   98+98
```

| Question | Answer |
|---|---|
| Boss pacing | 33:31 (Humans) / 39:51 (Orcs) bot time; Orcs +19 % (within ±25 %) |
| Does crafting matter in P0? | Partly. Arming a 140-soldier army takes ~35 min of forge time, so by the boss only part of the army is armed. A player who arms the fighting troop first sees the effect at once (the troop card and battle show weapon power). |
| Long-term T1 | The economy run (more time) shows the climb: ×1.32 average weapon power at mastery 3 with a first Masterpiece |

## Pass 7: 2026-10-23, troops do the smithing (M6, D-41)

Changes: the forge no longer crafts at 1 work/s by itself; a troop on the new *Smithing* activity does the work (soldiers × work × skill × 0.1). Forge construction work 2500 → **3000** (Humans' construction share had dropped to 4.8 % because runs got slightly longer). The bot puts a troop at the forge when orders wait, unless it is the last free troop and something is being saved for.

```
Milestones (simulated time mm:ss, bot decides every 5s, limit 180 min)

race     strategy       Combat    Recruit    Troop 2 Barracks 1      Forge    Stage 3 Barracks 2 Zone clear       Boss
humans   balanced         4:10       5:10      11:20      18:52      24:41      13:18      28:03      29:04      34:57
humans   economy          4:10       5:10      12:46      37:35      59:59        —          —          —          —  
orcs     balanced         6:00       7:30      13:58      20:03      26:50      15:33      31:31      32:57      42:19
orcs     economy          6:00       7:30      28:00      41:57      47:10      44:03      62:03      73:34      89:51

Forge at the end (weapons crafted · armed soldiers · avg weapon power · mastery · quality mix N/G/O/E/M)

humans   balanced     27 crafted · 27/139 armed · ×1.05 · mastery 1 · 22/4/1/0/0
humans   economy      89 crafted · 6/7 armed · ×1.44 · mastery 3 · 67/14/5/2/1
orcs     balanced     43 crafted · 43/311 armed · ×1.04 · mastery 2 · 34/6/2/1/0
orcs     economy     219 crafted · 184/185 armed · ×1.30 · mastery 5 · 150/42/17/7/3

Share of troop-time per activity

race     strategy    combat  mining    wood    food   build   smith    idle   soldiers@end
humans   balanced       50%      5%     12%     25%      5%      3%      0%   70+69
humans   economy         1%     22%     30%      4%     11%     32%      0%   4+3
orcs     balanced       46%      7%     12%     24%      6%      5%      0%   156+155
orcs     economy        41%     16%     13%      1%     13%     16%      0%   93+92
```

| Question | Answer |
|---|---|
| Boss pacing | 34:57 (Humans) / 42:19 (Orcs); Orcs +21 % (within ±25 %). About 1.5–2.5 min slower than pass 6, because a troop now spends time at the forge. |
| Is smithing used? | Yes: 3 % (Humans) and 5 % (Orcs) of troop-time; 27 / 43 weapons by the boss, about the same as the self-running forge in pass 6 |
| Guard change | The 5 % guard now compares the five start activities with each other (smithing only exists after the forge). Mining was 4.98 % of all time and 5.1 % of start-activity time; Humans end with ~490 spare ore, so mining is not useless. A new guard checks that smithing is used (> 1 %) and that more than 10 weapons get made. |

## Pass 8: 2026-10-23, the forge matters before the boss (M8, D-43)

Changes: T1 metal weapons cost 2 ore (no wood); `smithRate` 0.3; mastery step 20 weapons. Bot: it only orders weapons while soldiers are unarmed (a player racing to the boss arms the army and does not grind quality; without this rule the bot smithed 16–20 % of the time and starved recruitment).

```
Milestones (simulated time mm:ss, bot decides every 5s, limit 180 min)

race     strategy       Combat    Recruit    Troop 2 Barracks 1      Forge    Stage 3 Barracks 2 Zone clear       Boss
humans   balanced         4:10       5:10      11:20      18:52      24:41      13:18      28:03      28:50      33:56
humans   economy          4:10       5:10      12:46      37:35      59:59     111:11     110:40     124:05     145:05
orcs     balanced         6:00       7:30      13:58      20:03      26:50      15:33      31:26      32:34      41:30
orcs     economy          6:00       7:30      28:00      41:57      47:10      44:03      58:33      68:05      84:45

Forge at the end (weapons crafted · armed soldiers · avg weapon power · mastery · quality mix N/G/O/E/M)

humans   balanced    105 crafted · 105/106 armed · ×1.27 · mastery 2 · 83/16/4/1/1
humans   economy      67 crafted · 67/67 armed · ×1.27 · mastery 1 · 54/10/2/1/0
orcs     balanced    236 crafted · 236/236 armed · ×1.28 · mastery 3 · 177/39/13/5/2
orcs     economy     186 crafted · 186/186 armed · ×1.28 · mastery 3 · 143/30/9/3/1

Share of troop-time per activity

race     strategy    combat  mining    wood    food   build   smith    idle   soldiers@end
humans   balanced       50%      5%     13%     20%      5%      7%      0%   53+53
humans   economy        26%     23%     27%      5%     17%      3%      0%   34+33
orcs     balanced       46%      7%     12%     17%      6%     12%      0%   118+118
orcs     economy        44%     17%     13%      1%     14%     10%      0%   93+93
```

| Question | Answer |
|---|---|
| Boss pacing | 33:56 (Humans) / 41:30 (Orcs); Orcs +22 % (within ±25 %). About a minute faster than pass 7. |
| Armed at the boss | Humans 105/106, Orcs 236/236 (was 27/139 and 43/311) |
| Cost | Smaller armies (Humans 106 vs 139, Orcs 236 vs 311): troop-time moves from food to the forge, 7 % (Humans) and 12 % (Orcs) |
| Long-term T1 | Maxing mastery now needs 2,000 weapons; at the boss the bot is at mastery 2–3 |

## Pass 9: 2026-10-23, progression v2: work cycles, beds and training (M10a, D-45–D-50)

A new economy (docs/PROGRESSION_V2.md): work sites with capacity and discrete cycles, soldiers from beds + training + rescues, groups as slots, combat rescaled for small armies. The bot was rewritten for it; the old guards were replaced by the ones in PROGRESSION_V2 §11 (soldier 2 at 4–8 min, group 2 at 12–18, Humans 3–6 soldiers at 30 and 40 min, Orcs 1.0–1.6×, boss 40–60 min within ±25 %, boss gives a third group, never more than 90 s without a reward in the first 15 min, every start activity ≥ 5 %, smithing used).

```
Milestones (simulated time mm:ss, bot decides every 5s, limit 90 min)

race     strategy       Combat  Soldier 2    Group 2  Soldier 3  Soldier 5    Stage 3      Forge Zone clear       Boss
humans   balanced         2:30       4:45      14:09      19:40      30:39      32:38      34:46      42:35      43:55
humans   economy          2:30       4:45      14:09      21:05      32:59      40:38      30:11      47:39      48:51
orcs     balanced         2:00       4:51      14:28      18:30      27:13      30:05      35:18      52:43      53:49
orcs     economy          2:00       4:51      14:28      21:40      32:43      46:45      32:20      56:05      57:20

Forge at the end (weapons crafted · armed soldiers · avg weapon power · mastery · quality mix N/G/O/E/M)

humans   balanced      5 crafted · 5/7 armed · ×1.19 · mastery 0 · 4/1/0/0/0
humans   economy       6 crafted · 6/8 armed · ×1.20 · mastery 0 · 5/1/0/0/0
orcs     balanced      7 crafted · 7/9 armed · ×1.20 · mastery 0 · 6/1/0/0/0
orcs     economy       7 crafted · 7/10 armed · ×1.18 · mastery 0 · 6/1/0/0/0

Share of troop-time per activity

race     strategy    combat  mining    wood    food   build   smith    idle   soldiers@end
humans   balanced       46%     19%     17%      7%      7%      5%      0%   3+2+2
humans   economy        26%     25%     21%     17%      6%      5%      0%   3+3+2
orcs     balanced       47%     18%     10%     10%      7%      8%      0%   4+3+2
orcs     economy        25%     22%     13%     26%      7%      7%      0%   4+4+2
```

Soldiers over time (balanced): Humans 1 → 2 (5 min) → 4 (30 min) → 5 (35 min) → 7 after the boss. Orcs 2 (5 min) → 5 (30 min) → 6 (40 min) → 9 after the boss.

| Question | Answer |
|---|---|
| Does growth stay slow? | Yes: soldier count is capped by beds (buildings) and paced by training; production is capped by site capacity |
| Is every activity used? | Combat 46 %, mining 18–19 %, wood 10–17 %, food 7–10 %, building 7 %, smithing 5–8 % |
| Known issues for M10b | ~10 min lull between stage 5 and the boss; 5 of 7 soldiers armed at the boss; the `economy` strategy is now a "builder first" player rather than a strawman |

## Pass 10: 2026-10-23, M10b first-hour upgrade (D-53)

Content from PROGRESSION_V2 §16 (new objectives, forge after two groups, rescue at stage 4, stage 5 = 8 kills, ore loot, Forge II / Farm II / woodshed, Sharp axes II / Stone picks II, level notices). Tuned within the spec's guesses: Forge II 150/100/10 → **90/60/10**, Farm II 120/60 → **70/40**, first mastery step 10 → **6**. Bot build order: forge right after the Training Camp, then tents 2, farm, woodshed, forge 2.

```
Milestones (simulated time mm:ss, bot decides every 5s, limit 70 min)

race     strategy       Combat  Soldier 2    Group 2  Soldier 3  Soldier 5    Stage 3      Forge     Forge2 Zone clear       Boss
humans   balanced         2:30       4:45      14:09      20:05      37:54      33:46      27:10        —        43:28      44:31
humans   economy          2:30       4:45      14:09      25:00      35:34      50:26      23:28      40:08      55:27      56:28
orcs     balanced         2:00       4:51      14:28      18:40      26:43      29:31      27:36        —        49:40      50:35
orcs     economy          2:00       4:51      14:28      26:10      43:38      56:55      24:55      44:22      65:15      66:20

Forge at the end (weapons crafted · armed soldiers · avg weapon power · mastery · quality mix N/G/O/E/M)

humans   balanced  gap15-45 3.3m ·     6 crafted · 6/8 armed · ×1.20 · mastery 1 · 5/1/0/0/0
humans   economy   gap15-45 8.5m ·     7 crafted · 7/9 armed · ×1.20 · mastery 1 · 6/1/0/0/0
orcs     balanced  gap15-45 6.6m ·     8 crafted · 8/10 armed · ×1.21 · mastery 1 · 7/1/0/0/0
orcs     economy   gap15-45 9.9m ·     8 crafted · 8/10 armed · ×1.21 · mastery 1 · 7/1/0/0/0

Soldiers at 15 / 30 / 40 min

humans   balanced  2 / 4 / 5
humans   economy   2 / 4 / 5
orcs     balanced  2 / 5 / 6
orcs     economy   2 / 3 / 4

Share of troop-time per activity

race     strategy    combat  mining    wood    food   build   smith    idle   soldiers@end
humans   balanced       45%     22%     15%      4%      7%      7%      0%   4+2+2
humans   economy        18%     33%     21%     14%      9%      5%      0%   4+3+2
orcs     balanced       46%     17%      9%      9%      7%     11%      0%   5+3+2
orcs     economy        18%     28%     14%     24%     11%      5%      0%   5+3+2
```

| Question | Answer |
|---|---|
| Is the mid-game livelier? | Humans: forge at 27:10 (was 34:46); the longest gap between events in minutes 15–45 is 3.3 min (was ~6). Orcs 6.6 min |
| Boss | Humans 44:31, Orcs 50:35 (+14 %) |
| Soldiers | Humans 2 / 4 / 5 at 15 / 30 / 40 min, rescue at ~41 min, 8 after the boss |
| Forge | Everyone is armed when the boss fight starts; mastery 1 for both races |
| What didn't fit | With 4–6 soldiers the economy can't also afford Forge II and Farm II before the boss; food fell to ~4 % because the farm now comes after the forge |

**Owner decisions after the first measurement (2026-10-23):** (1) Forge II and Farm II are goals after the boss, not required before it; (2) the armed ratio is measured when the boss fight starts (its freed prisoners arrive unarmed); (3) first mastery step at 6 weapons; (4) the food floor is 4 % until food gets a real sink (upkeep) later; (5) the gap guard applies to the balanced bot only, 4 min for Humans and 7 min for Orcs. Optional goals (ore10, farm2) are not required by the guards (Orcs get their ore from loot).


## Pass 11: 2026-10-23, food upkeep (M11, D-55/D-56)

Upkeep per soldier but the first: Humans 0.5, Orcs 0.6 food/min. Balanced bot, 90 bot minutes.

| | Humans | Orcs |
|---|---|---|
| Boss | 45:01 | 51:44 (+15 %) |
| Hungry (balanced) | never | never |
| Food share of start activities | 4 % | 11 % |
| Careless bot (ignores food) | boss 46:16 (+2.8 %), 3.6 min hungry | — |

Raising Human upkeep to 0.8–1.0 did not lift their food share above ~5 % and slowed soldier growth, so it was reverted. Humans are the better farmers (D-13): a short stint on the fields feeds them. **Owner-delegated decision (D-56):** the food floor in the balance guard is per race, Humans 4 %, Orcs 8 %.

## Pass 12: 2026-10-23, M12 gameplay polish (D-57, D-58)

**Starting point**
- Boss: Humans 40:56, Orcs 49:21.
- Orc gap: 4.4 min, from `twoTroops` at 15:15 to recruit 3 at 19:40.
- Orc food share: 7.1 %, under the 8 % floor.
- Feast bot: only 1.6 % faster.

**Findings**
- The Orc gap lies before raid1 can fire, since raid1 requires stage3.
- The bot sent troop 2 mining while a recruit waited only for food.
- With the guessed feast (+15 % work / +10 % attack), the feast bot saved only 0.2 % (Orcs) and 1.4 % (Humans), because the food cost eats the gain.

**Changes**
- Bot:
  - forage first when a recruit is blocked only by food;
  - woodshed before farm 1;
  - the feast bot feasts at food ≥ 70 and wood ≥ 15.
- Content:
  - raid1 60 → 80 kills;
  - raid2 150 → 130 kills;
  - feast +25 % work / +25 % attack.
- Unchanged: horde cap 0.5, adaptable 0.25, feast cost and timers.

**Result, balanced bot**

| | Boss | Soldiers 15/30/40 | Gap 15–45 | Food share |
|---|---|---|---|---|
| Humans | 40:31 | 2/4/6 | 3.3 min | 7 % |
| Orcs | 47:31 | 2/5/6 | 3.3 min | 17 % |

- Orc/Human boss ratio: 1.17.
- Feast bot: Humans −4.5 % (38:41), Orcs −3.9 % (45:41).
- The balanced bot never feasts.

**Margins**
- The Humans boss is only 31 s above the 40-minute floor.
- The Orc feast gain is close to its 3 % floor.
- Results are chaotic, so re-run the sim after any bot or content change.

## Pass 13: 2026-10-23, M13 zone 1 to level 40 (checkin bot, D-59, D-60)

**Bot**
- New `checkin` strategy: plays like `balanced` for 2 h, then acts every 45 min, with one 8 h night per 24 h.
- Groups too weak for the level the strong groups hold go back to work instead of fighting.

**First result:** level 40 at about 11 h, troop levels 300–1300. Troop XP was far too generous.

**Changes**
- Enemies, levels 6–40:
  - HP ×2.4, growth 1.055 per level up to level 20 and 1.115 after;
  - XP growth 1.04 per level from the level-5 boar (18), never falling.
- Kills per level, levels 11–40 (normal level / boss level):

  | Levels | Kills |
  |---|---|
  | 11–15 | 16 / 11 |
  | 16–20 | 18 / 13 |
  | 21–25 | 40 / 25 |
  | 26–30 | 56 / 35 |
  | 31–35 | 80 / 50 |
  | 36–40 | 100 / 64 |

- Boss HP: boss 6 16,000, boss 7 25,200, boss 8 37,000.
- T2 costs 96 iron (bow 64). Järngruvan gives 1 iron per cycle.
- Recruit tail after soldier 8: food ×1.17, time ×1.08 per soldier.
- **Troop XP curve (D-60):** unchanged up to troop level 12, steeper after (exponent 3.4).

**Result, checkin bot**

| Boss | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 |
|---|---|---|---|---|---|---|---|---|
| Humans | 0:40 | 1:29 | 2:45 | 4:15 | 6:30 | 12:32 | 23:47 | 32:47 |
| Orcs | 0:47 | 1:26 | 2:45 | 3:30 | 7:15 | 12:32 | 24:32 | 29:47 |

- At boss 40: Humans 32 soldiers, Orcs 35. Troop level 49 for both, and the whole army on T2.
- Median level time, levels 6–20: Humans 9.9 min, Orcs 8.9 min.
- Longest wait between bosses: about 11–12 h.
- The 90-minute guards are unchanged and pass.
- 8 h offline at level 35 completes in under 2 s.

**Open points**
- Boss times jump with the 45-minute check-in grid and the night, so the run is fragile. Re-run the sim after any economy change.
- T2 spreads faster than the spec targets: about 30–40 % at boss 25, against 20 %.
