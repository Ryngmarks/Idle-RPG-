# Equipment, Tiers & Crafting: Long-Term Design v0.1

> **Status:** Long-term vision (✅ owner) with a proposed technical foundation (💡). **T1–T8 is a structure, not content to build now.** The first prototype stays very small.
> **Inspiration:** Albion Online's tiers, quality levels and crafting specialisation, adapted to aggregated troops in an idle game.
> **Related:** [Troop Model](TROOP_MODEL.md) · [Architecture](ARCHITECTURE.md) · [Roadmap](ROADMAP.md) · [Decisions](DECISIONS.md)

**Labels:** ✅ Confirmed (owner) · 💡 Proposed · ❓ Open

---

## 1. The owner's requirements ✅

| # | Requirement |
|---|---|
| E-1 | **One weapon type per troop** (e.g. a troop of swordsmen) |
| E-2 | Weapons have a **tier (T1–T8)** and a **quality**. A troop can have **mixed quality and possibly mixed tiers**, e.g. 100 swordsmen = 75 Normal + 15 Good + 10 Excellent swords. |
| E-3 | Equipment is handled as **aggregated counts**, never as individual soldier objects |
| E-4 | **Tier progression is very slow and meaningful.** T1 is not something you leave right away, T2 is a real milestone, and T8 is an extremely long-term goal. |
| E-5 | **Meaningful progression within a tier** comes from quality, crafting, soldier count, specialisation and upgrades |
| E-6 | Tiers unlock through **game progression, resources, developed buildings and crafting**, not just waiting |
| E-7 | Crafting and equipment are inspired by **Albion Online** |
| E-8 | No PvP and no advanced race balancing needed |
| E-9 | The first prototype must still be **very small** |

---

## 2. Core model 💡

```
Troop "Norra Väktarna"   (Humans, weapon type: Sword)
├─ size        100 soldiers
└─ equipment   T1 Normal       × 75
               T1 Good         × 15
               T1 Excellent    × 10
               (unarmed        ×  0)  = size − Σ equipped
```

- A troop's equipment is a short list of **buckets**: `(tier, quality) → count`. With 8 tiers × 5 qualities, a troop has at most 40 buckets, and in practice 2–6.
- Soldiers beyond the equipped count are **unarmed** and fight at a heavy penalty. Arming *everyone* is its own small goal.
- Spare weapons live in a shared **armoury**, also as counts: `(weaponType, tier, quality) → count`.
- **Weapon type is a property of the troop** (E-1). Changing it means returning all weapons to the armoury and equipping a different type. That is possible, but a deliberate decision.

### 2.1 Quality levels 💡

Five levels, named in our own words (the owner's example uses Normal, Good, Excellent):

| Quality | Power multiplier (illustrative) | Feel |
|---|---|---|
| Normal | ×1.00 | Standard issue |
| Good | ×1.07 | Noticeably better |
| Outstanding | ×1.15 | Prized |
| Excellent | ×1.24 | Rare |
| Masterpiece | ×1.35 | **Equals Normal of the next tier** |

**Rule:** *the best quality of tier N ≈ the Normal quality of tier N+1.* Quality is therefore a real path *within* a tier, and it bridges to the next tier without replacing it.

### 2.2 Tiers 💡

| Tier | Power (×1.35 per tier) | Pacing target (active-ish player) | Unlocked by (examples, see §4) |
|---|---|---|---|
| **T1** | ×1.00 | The whole first region: **several hours** | Start |
| **T2** | ×1.35 | **First big milestone** (≈ day 1) | Region 1 boss + Smithy 2 + T2 materials + T1 crafting mastery |
| T3 | ×1.82 | Days | Region 2–3 progress, Smithy 3, refined T3 materials |
| T4 | ×2.46 | ~1–2 weeks | … |
| T5 | ×3.32 | Weeks | … |
| T6 | ×4.48 | 1–2 months | … |
| T7 | ×6.05 | Several months | … |
| **T8** | ×8.17 | **Extreme long-term goal** | Endgame buildings, rarest materials, max mastery |

❓ The time targets depend on the open questions about play rhythm (Q-04) and long-term structure / prestige (Q-05).

### 2.3 Weapon types 💡 (illustrative)

Each weapon type is data: a few modifiers on the existing combat formula (attack, armour penetration). No new combat rules.

| Weapon type | Profile | Typical races (identity, not restriction) |
|---|---|---|
| Sword | Balanced | Humans |
| Spear | −10% attack, +25% armour penetration | Humans, Orcs |
| Cleaver / Axe | +15% attack, no penetration: strong against swarms, weak against armour | Orcs, Dwarves |
| Hammer | +40% armour penetration, −15% attack | Dwarves |
| Bow | Precision: +50% armour penetration | Elves, Humans |

In P0: **one weapon type per race** (Humans: Sword, Orcs: Cleaver). More types come later.

---

## 3. How a troop's power is computed (aggregated, exact) 💡

The combat formula is not linear (armour, overkill), so we cannot just average the weapons. Instead each bucket is treated as a **homogeneous sub-group**, and the results are summed:

```
for each bucket b in troop.equipment (+ the unarmed remainder):
    attack_b = race attack × weaponType × tierMult(b.tier) × qualityMult(b.quality) × level × upgrades …
    kills_b  = killsPerSecond(b.count, attack_b, armourPen, enemy)        // existing formula
troop kills/s = Σ kills_b            troop boss DPS = Σ dps_b
```

- The cost is O(buckets), at most 40 and usually a handful. Offline time is unchanged: still one step per *event*.
- **Labour is unaffected** by weapons. Tools for gatherers could reuse the same bucket structure later (see §8).
- **Owner's example:** 75 N + 15 G + 10 E ≈ ×1.035 average weapon power. That is small on purpose. Quality is a steady climb, not a jump. The jumps are tiers.

### 3.1 Sources of progress *within* a tier (E-5)

| Source | What changes | Size of effect | Exists in code |
|---|---|---|---|
| **Soldier count** | More soldiers (cap levels via buildings) | Largest (Humans: cap 20 → 500 over the game) | ✅ |
| **Arming everyone** | Fewer unarmed soldiers | Large while catching up | 💡 |
| **Quality** | Better mix of buckets | Up to ×1.35 | 💡 |
| **Crafting mastery** | Better quality chances, cheaper recipes | Indirect, through quality | 💡 |
| **Troop level** (veterancy) | +10% per level | Steady | ✅ |
| **Specialisation** (doctrine, later weapon mastery) | +% in focus areas | Medium | 💡 P1 |
| **Upgrades & buildings** | Global modifiers | Medium | ✅ |

**Design principle 💡:** a *fully grown, well-equipped* troop at tier N should beat a *freshly converted, half-armed* troop at tier N+1. Reaching a new tier is a milestone that starts a new climb. It does not reset what came before.

---

## 4. Crafting 💡

### 4.1 Recipe

```
Recipe "T1 Sword"    = { weaponType: sword, tier: 1, materials: { ore: 3, wood: 1 }, work: 20 per item,
                         requires: { building: smithy ≥ 1 } }
Recipe "T2 Sword"    = { tier: 2, materials: { iron_bars_t2: 3, planks_t2: 1 }, work: 60 per item,
                         requires: { building: smithy ≥ 2, mastery: sword T1 ≥ level X, unlock: 'recipe:sword:2' } }
```

- **Craft orders are batches** (e.g. 10, 50 or 100 swords), not single items. When an order completes, the whole batch is delivered to the armoury (one event) and auto-equipped by the policy (§5).
- **Labour:** ❓ *who does the work?*
  - **A. 💡 A sixth activity, "Crafting"**, unlocked with the Smithy (P1). Troops do the smithing, which keeps to the pillar that troops are your key resource and creates new allocation decisions.
  - B. The Construction activity also processes the craft queue. No new activity, but building and crafting compete inside one activity.
  - C. Workshops craft by themselves at a fixed rate. Simplest, but it gives the player no decision.

### 4.2 Quality outcome: deterministic, not random 💡

Albion uses random quality rolls. For an idle game with offline progress we propose **expected-value distribution with carry-over**:

```
batch of N items, quality chances p = [Normal, Good, Outstanding, Excellent, Masterpiece]
items_q = floor(N × p_q + carry_q);  carry_q updated with the fractional remainder; leftovers → Normal
```

- Same result online and offline, no save-scumming, no RNG in the core.
- **Quality chances improve** with crafting mastery (per weapon type and tier), Smithy level, and later upgrades or masters.

| Crafting mastery (illustrative) | Normal | Good | Outstanding | Excellent | Masterpiece |
|---|---|---|---|---|---|
| Novice | 80% | 17% | 3% | 0% | 0% |
| Practised | 60% | 27% | 10% | 3% | 0% |
| Expert | 40% | 32% | 18% | 8% | 2% |

### 4.3 Crafting mastery 💡 (Albion's "specialisation", simplified)

- XP is earned **per weapon type and tier** by crafting.
- Mastery of **T(n) is one of the gates for T(n+1)**, so the player spends real time with a tier before moving on (E-4).
- One number per (weapon type, tier) in the save. With 5 types × 8 tiers that is at most 40 numbers.

### 4.4 Materials and refining (later) 💡

- **T1 uses the existing resources** (ore, wood). Nothing new is needed for P0/P1.
- **T2+:** tiered raw materials (e.g. *ore T2*) come from **new nodes** in later regions or deeper mine levels. A **refining** step (Smelter: ore → bars, Sawmill: wood → planks) adds a production chain.
- Gathering a tier requires access (region/node) and possibly a gathering specialisation. Gathering tools are a later option (§8).

### 4.5 What gates a tier (E-6: progression, not waiting)

| Gate | Example for T2 | Why |
|---|---|---|
| **Game progression** | Region 1 boss defeated → Region 2 nodes | Ties tiers to the world |
| **Developed buildings** | Smithy level 2 (built with a lot of labour and T1 materials) | Uses construction and troops |
| **Resources** | T2 ore + refined bars | Uses the gathering economy |
| **Crafting** | T1 sword mastery ≥ X | Rewards time spent *in* T1 |
| ~~Pure timer~~ | — | ❌ Explicitly not used |

---

## 5. Equipping (aggregated) 💡

- **Auto-equip policy (default): best first.** When new weapons arrive in the armoury, or new soldiers are recruited, the troop takes the best available weapons of its type. Displaced lower items go back to the armoury.
- **Recruits** arrive with a **T1 Normal weapon included** in the recruit cost (P0 and P1). Later, with mixed tiers, new recruits take what the armoury has, or fight unarmed.
- **Salvage** (later): unwanted items return ~25% of their materials. This gives a sink for old tiers.
- **Manual control** ("keep the Excellent swords for the 1st Banner") is a possible later UI feature. The data model already supports it.

**Troop card (UI idea):**

```
Norra Väktarna · 100 svärdskrigare
[███████████████░░░░░] T1  Normal 75 · Good 15 · Excellent 10
Styrka 104 DPS · Arbete 100
```

---

## 6. Technical foundation 💡

The goal is a data model that can grow to T1–T8, more weapon types and more equipment categories **without rewrites**, while the first implementation stays tiny.

### 6.1 Content (data)

```ts
interface QualityDef    { id: 'normal' | 'good' | 'outstanding' | 'excellent' | 'masterpiece'; powerMult: number; order: number }
interface TierDef       { tier: number; powerMult: number }                   // T1..T8, only T1 needs content now
interface WeaponTypeDef { id: string; name: string; modifiers: Modifier[] }   // sword, cleaver …
interface RecipeDef     { id: string; weaponTypeId: string; tier: number; materials: Cost; workPerItem: number;
                          requires: { building?: { id: string; level: number }; unlock?: string; masteryLevel?: number } }
interface QualityTable  { masteryLevel: number; chances: number[] }           // per §4.2
```

### 6.2 State

```ts
interface EquipmentBucket { tier: number; quality: QualityId; count: number }   // sparse, sorted best-first

interface TroopState {
  // …existing fields…
  weaponTypeId: string;
  equipment: EquipmentBucket[];                // invariant: Σ count ≤ size, counts are non-negative integers
}

interface GameState {
  // …existing fields…
  armoury: Record<ItemKey, number>;            // ItemKey = `${weaponTypeId}:t${tier}:${quality}`
  crafting: {
    orders: { recipeId: string; count: number; progress: number }[];
    mastery: Record<string, number>;           // `${weaponTypeId}:t${tier}` → xp
    qualityCarry: Record<string, number[]>;    // recipeId → fractional carry per quality
  };
}
```

### 6.3 Core functions (pure, testable)

| Function | Purpose |
|---|---|
| `normalizeBuckets(buckets)` | Merge duplicates, drop zeros, sort best-first |
| `equipBestFirst(troop, armoury)` | Apply the auto-equip policy and return the updated troop + armoury |
| `bucketPower(race, weaponType, bucket, …)` | Per-soldier attack for one bucket |
| `troopCombat(troop, enemy)` | Σ over buckets with the existing `killsPerSecond` / `dpsAgainst` |
| `distributeQuality(n, chances, carry)` | Deterministic batch outcome (§4.2) |

### 6.4 Simulation impact

- **Rates** stay piecewise constant. Crafting progress is linear, like construction.
- **New event:** `craftOrderCompleted`. It delivers the batch, then auto-equips (rates change, so it must be an event).
- **Offline equivalence** and **purity** tests apply unchanged.

### 6.5 Migration from today's code

Today each troop has a single `gearTier: 0 | 1` (P0's Forge gives ×1.4 attack). That gear tier is **a placeholder and conflicts with E-4**: ×1.4 is T2-level power, reached in about 25 minutes.

| Today | Becomes |
|---|---|
| `troop.gearTier` | `troop.weaponTypeId` + `troop.equipment` buckets |
| `content.gearTiers` (×1.4) | `TierDef` + `QualityDef` + `RecipeDef` |
| Forge: "gear tier 1" | **Smithy: craft T1 weapons with better quality** |
| Save v1 | Save v2 via a migration: each troop gets `{ tier 1, normal, count: size }` |

---

## 7. Scope: what to build when

| Step | Content | Size |
|---|---|---|
| **Now (this document)** | Long-term structure, data model, rules | Docs only |
| **M2.5: Equipment foundation** 💡 *(needs approval)* | Replace `gearTier` with weapon type + buckets. Recruits come with T1 Normal. Per-bucket combat. Save v2 migration. Retune with the simulator. **No crafting UI and no T2.** | Small: the core plus tests |
| **P0 or P1: T1 crafting** ❓ | The Smithy crafts T1 weapons in batches. Qualities Normal → Outstanding. Deterministic quality. Mastery. | Medium |
| **P2+: T2** | Region 2, T2 materials, refining, Smithy 2, mastery gate | Large: a real milestone |
| **Later** | T3–T8 content, more weapon types, armour/tools categories, salvage | Ongoing |

**Not planned:** individual items or soldiers, random quality rolls, durability and repair, a player market, PvP, full-loot.

---

## 8. Later extensions (same structure, no new concepts)

| Extension | Reuses |
|---|---|
| **Armour** (second equipment category) | Buckets per category. Gives defence a purpose once casualties or morale exist. |
| **Gathering tools** (picks, axes, sickles) | Buckets per category, affecting labour instead of combat. Could gate gathering tiers. |
| **Enchantment / runes** (speculative) | An extra key dimension on items. Only if T8 needs more depth. |
| **Hero weapons** (with heroes) | A single named item on the hero: the one exception to aggregation |

---

## 9. Open questions ❓

| ID | Question | Proposal |
|---|---|---|
| Q-13 | Who does crafting labour: a sixth activity, the Construction activity, or the buildings themselves? | **A sixth activity "Crafting"**, unlocked with the Smithy |
| Q-14 | Should the P0 prototype include T1 crafting (replacing today's ×1.4 Forge), or only the equipment foundation, with crafting in P1? | Foundation in M2.5. A small T1 crafting test in P0 *only if* it doesn't delay the UI. Otherwise P1. |
| Q-15 | Do recruits come with a free T1 Normal weapon, or arrive unarmed? | Included in the recruit cost (simpler). "Arm everyone" matters from T2 onward. |
| Q-16 | Tier pacing targets (T2 ≈ day 1, T8 ≈ many months) | Confirm together with Q-04 (play rhythm) and Q-05 (prestige) |
| Q-17 | Final names for tiers and qualities | Our own names, not Albion's |
