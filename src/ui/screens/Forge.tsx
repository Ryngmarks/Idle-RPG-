import { useState } from 'react';
import { content } from '../../content';
import { Icon } from '../art/icons';
import {
  canAfford,
  craftCost,
  craftedForMastery,
  masteryKey,
  masteryLevel,
  maxCraftable,
  parseItemKey,
  QUALITY_IDS,
  qualityChances,
  race,
  recipeAvailable,
  recipeBlocker,
  smithingWork,
  weaponPower,
  type GameEvent,
  type RecipeDef,
  type GameState,
  type Rates,
} from '../../core';
import { Bar, Chip, CostList, Panel } from '../components/common';
import { QualityChip, RARE, TIER_COLOR, WeaponIcon } from '../components/equipment';
import { fmtDuration, fmtInt, fmtRate } from '../format';
import { useStore } from '../game';
import { QUALITY_COLOR, qualityName } from '../labels';

/** Why a recipe can't be ordered, in words. Numbers come from the content and state. */
function blockerText(b: ReturnType<typeof recipeBlocker>, state: GameState, recipe: RecipeDef, weaponName: string): string {
  if (b === 'mastery') {
    const need = recipe.requiresMastery?.level ?? 1;
    const crafted = state.crafting.crafted[masteryKey(recipe.weaponTypeId, recipe.tier - 1)] ?? 0;
    const target = craftedForMastery(need, content);
    return `Kräver mästerskap ${need} i ${weaponName.toLowerCase()} T${recipe.tier - 1} (${fmtInt(crafted)}/${fmtInt(target)} smidda)`;
  }
  if (b === 'locked') {
    if (!state.unlocks.includes('crafting')) return 'Bygg smedjan i bosättningen för att börja smida.';
    if (!state.unlocks.includes(`tier:${recipe.tier}`)) {
      const o = content.objectives.find((x) => x.rewards.unlocks?.includes(`tier:${recipe.tier}`));
      const bossIdx = o?.condition.kind === 'bossDefeated' ? (o.condition.index ?? 1) : null;
      return bossIdx ? `Låses upp av boss ${bossIdx}` : `Kräver T${recipe.tier}: ${o?.text ?? 'framsteg i strid'}`;
    }
  }
  return 'Kan inte smidas just nu.';
}

export function Forge({ state, rates, log }: { state: GameState; rates: Rates; log: GameEvent[] }) {
  const store = useStore();
  const [error, setError] = useState<string | null>(null);
  const weaponTypeId = race(state, content).weaponTypeId;
  const weapon = content.equipment.weaponTypes[weaponTypeId]!;
  const recipes = Object.values(content.equipment.recipes).filter((r) => r.weaponTypeId === weaponTypeId).sort((a, b) => a.tier - b.tier);
  const [tier, setTier] = useState(1);
  const recipe = recipes.find((r) => r.tier === tier) ?? recipes[0]!;
  const available = recipeAvailable(state, recipe.id, content);
  const blocker = recipeBlocker(state, recipe.id, content);
  const T = recipe.tier;
  // Smiths work only while there is an order, so the speed shown is what the assigned troops give.
  const smiths = state.troops.filter((t) => t.activity === 'smithing');
  // With an order the core's rate is exact; without one, show what the best smith would manage at the anvil.
  const speed = rates.craftWorkPerSec > 0 ? rates.craftWorkPerSec : Math.max(0, ...smiths.map((t) => smithingWork(state, t, content)));
  const secPerItem = speed > 0 ? recipe.workPerItem / speed : Infinity;
  const mk = masteryKey(weaponTypeId, T);
  const crafted = state.crafting.crafted[mk] ?? 0;
  const level = masteryLevel(crafted, content);
  const max = content.equipment.maxMastery;
  const from = craftedForMastery(level, content);
  const to = craftedForMastery(Math.min(max, level + 1), content);
  const chances = qualityChances(level, content);
  const queue = state.crafting.queue;
  const queued = queue.reduce((n, o) => n + o.remaining, 0);
  const maxN = maxCraftable(state, recipe.id, content);
  const armoury = recipes.flatMap((r) => QUALITY_IDS.map((q) => ({ q, tier: r.tier, n: state.armoury[`${weaponTypeId}:t${r.tier}:${q}`] ?? 0 })));
  const head = queue[0] ? content.equipment.recipes[queue[0].recipeId] ?? recipe : recipe;
  // The latest weapons off the anvil, oldest first so new ones appear at the end of the row.
  const recent = log
    .filter((e): e is Extract<GameEvent, { type: 'weaponCrafted' }> => e.type === 'weaponCrafted')
    .slice(0, 11)
    .reverse();
  const order = (n: number) => setError(store.command({ type: 'queueCraft', recipeId: recipe.id, count: n }));

  return (
    <div className="screen">
      <Panel hero icon="anvil" title="Smedjan" aside={<span className="battle-head">{smiths.length > 0 && <Chip tone="gold"><Icon name="anvil" size={14} /> {smiths.length}</Chip>}<Chip>Kö {queue.length}</Chip>{speed > 0 && <span className="muted small">{fmtRate(60 / secPerItem)}/min</span>}</span>}>
        {recipes.length > 1 && (
          <div className="seg" role="tablist" aria-label="Vapennivå">
            {recipes.map((r) => {
              const b = recipeBlocker(state, r.id, content);
              return (
                <button key={r.id} role="tab" aria-selected={r.tier === T} className={`seg__btn ${r.tier === T ? 'seg__btn--on' : ''} ${r.tier >= 2 ? 'seg__btn--steel' : ''}`} onClick={() => setTier(r.tier)}>
                  T{r.tier} {b !== null && <Icon name="lock" size={13} label="Låst" />}
                </button>
              );
            })}
          </div>
        )}
        <div className={`recipe ${T >= 2 ? 'recipe--steel' : ''}`}>
          <WeaponIcon weaponTypeId={weaponTypeId} quality="normal" size={44} tier={T} />
          <div className="recipe__info">
            <h3 className="recipe__name">{T >= 2 ? <span className="tier-badge">T{T}</span> : 'T1 '}{weapon.name}</h3>
            <p className="small muted">
              <CostList cost={recipe.materials} state={state} /> · {fmtInt(recipe.workPerItem)} arbete · <Icon name="strength" size={14} /> ×{fmtRate(weaponPower(T, 'normal', content))}
            </p>
          </div>
        </div>
        {available && (
          <p className={`small ${smiths.length > 0 ? '' : 'warn'}`}>
            {smiths.length > 0
              ? <><Icon name="anvil" size={16} /> {smiths.map((t) => t.name).join(', ')} smider · {fmtDuration(secPerItem)} per vapen{queue.length === 0 ? ' · väntar på beställning' : ''}</>
              : <><Icon name="warning" size={16} /> Ingen trupp smider. Ge en trupp aktiviteten Smide under Styrkor.</>}
          </p>
        )}
        {available ? (
          <div className="recruit__buttons">
            {[1, 10, 50].map((n) => (
              <button key={n} className="btn btn--small" disabled={!canAfford(state, craftCost(recipe.id, n, content))} onClick={() => order(n)}>
                +{n} <CostList cost={craftCost(recipe.id, n, content)} state={state} />
              </button>
            ))}
            <button className="btn btn--small" disabled={maxN <= 0} onClick={() => order(maxN)}>Max{maxN > 0 ? ` (+${maxN})` : ''}</button>
          </div>
        ) : (
          <p className="lock-reason small"><Icon name="lock" size={16} /> {blockerText(blocker, state, recipe, weapon.name)}</p>
        )}
        {queue.length > 0 && (
          <div className="queue">
            <div className="forge-now">
              <span className="hex"><WeaponIcon weaponTypeId={weaponTypeId} quality="normal" size={30} tier={head.tier} /></span>
              <div>
                <b>T{head.tier} {weapon.name} × {fmtInt(queue[0]!.remaining)}</b>
                <Bar value={state.crafting.progress} max={head.workPerItem} tone="gold" label="Smider" inside={rates.craftWorkPerSec > 0 ? `Smider · ${fmtDuration((head.workPerItem - state.crafting.progress) / rates.craftWorkPerSec)}` : 'Väntar på smed'} />
              </div>
              <button className="btn btn--small" aria-label="Avbryt beställning" onClick={() => setError(store.command({ type: 'cancelCraft', index: 0 }))}><Icon name="close" size={14} /></button>
            </div>
            {queue.slice(1).map((o, i) => (
              <div key={i} className="forge-next">
                <span className="hex"><WeaponIcon weaponTypeId={weaponTypeId} quality={null} size={22} tier={content.equipment.recipes[o.recipeId]?.tier ?? 1} /></span>
                <span style={{ flex: 1 }}>Näst: T{content.equipment.recipes[o.recipeId]?.tier ?? 1} {weapon.name} × {fmtInt(o.remaining)}</span>
                <button className="btn btn--small btn--ghost" aria-label="Avbryt beställning" onClick={() => setError(store.command({ type: 'cancelCraft', index: i + 1 }))}><Icon name="close" size={14} /></button>
              </div>
            ))}
            <span className="small muted">{fmtInt(queued)} vapen kvar · {rates.craftWorkPerSec > 0 ? `klart om ${fmtDuration(((queued - 1) * head.workPerItem + (head.workPerItem - state.crafting.progress)) / rates.craftWorkPerSec)}` : 'står still utan smeder'}</span>
          </div>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </Panel>

      <Panel title={`Kvalitetschans · T${T}`} aside={<span className="badge">Nivå {level}/{max}</span>}>
        <div className="chance-bar" role="img" aria-label="Kvalitetschanser">
          {QUALITY_IDS.map((q, i) => (chances[i]! > 0 ? <span key={q} className={RARE.has(q) ? 'seg--rare' : ''} style={{ flexGrow: chances[i], background: QUALITY_COLOR[q], ['--q' as string]: QUALITY_COLOR[q] }} /> : null))}
        </div>
        <div className="equip__legend">
          {QUALITY_IDS.map((q, i) => (
            <span key={q} className="legend-dot" style={{ ['--c' as string]: QUALITY_COLOR[q] }}><i style={{ background: QUALITY_COLOR[q] }} />{qualityName(q)} {Math.round(chances[i]! * 100)} %</span>
          ))}
        </div>
        {level < max ? (
          <>
            <span className="small muted">{fmtInt(crafted)} smidda · till nivå {level + 1}: {fmtInt(crafted - from)} / {fmtInt(to - from)}</span>
            <Bar value={crafted - from} max={to - from} tone="xp" label="Smideskunskap" />
          </>
        ) : (
          <p className="small">Högsta skicklighet i T{T}.</p>
        )}
      </Panel>

      {recent.length > 0 && (
        <section className="screen-section" aria-label="Senast smidda vapen">
          <span className="tag">Nyss smitt</span>
          <div className="recent">
            {[...recent].reverse().slice(0, 8).map((e) => (
              <div key={`${e.at}-${e.quality}-${e.recipeId}`} className={`recent__item ${RARE.has(e.quality) ? 'recent__item--rare' : ''} ${e.quality === 'masterpiece' || e.quality === 'excellent' ? 'recent__item--epic' : ''}`} style={{ ['--q' as string]: QUALITY_COLOR[e.quality] }}>
                <span className="hex" style={{ ['--q' as string]: QUALITY_COLOR[e.quality] }}>
                  <WeaponIcon weaponTypeId={content.equipment.recipes[e.recipeId]?.weaponTypeId ?? weaponTypeId} quality={e.quality} size={30} tier={content.equipment.recipes[e.recipeId]?.tier ?? 1} />
                </span>
                <span className="recent__name">{qualityName(e.quality)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <Panel title="Förrådet">
        {armoury.every((a) => a.n === 0) ? (
          <p className="muted small">Tomt. Trupper med Auto tar nya vapen direkt.</p>
        ) : (
          <div className="qchips">
            {armoury.filter((a) => a.n > 0).reverse().map((a) => <QualityChip key={`${a.tier}${a.q}`} quality={a.q} count={a.n} weaponTypeId={weaponTypeId} tier={a.tier} />)}
          </div>
        )}
        {Object.entries(state.armoury).some(([k, n]) => n > 0 && parseItemKey(k)?.weaponTypeId !== weaponTypeId) && (
          <p className="small muted">Det finns även vapen av annan typ i förrådet.</p>
        )}
      </Panel>

      <Panel title="Vapennivåer">
        <ol className="tiers">
          {content.equipment.tiers.map((t) => {
            const open = state.unlocks.includes(`tier:${t.tier}`) || t.tier === 1;
            return (
            <li key={t.tier} className={`tier ${open ? 'tier--open' : ''} ${open && t.tier >= 2 ? 'tier--steel' : ''}`}>
              <strong>T{t.tier}</strong>
              <span className="small"><Icon name="strength" size={14} /> ×{fmtRate(t.powerMult)}</span>
              <span className="small muted">{open ? 'Öppen' : <Icon name="lock" size={14} label="Låst" />}</span>
            </li>
            );
          })}
        </ol>
        <p className="small muted">Fler nivåer låses upp av bossar i nya regioner. Mästerverk ≈ Normal i nästa nivå.</p>
      </Panel>
    </div>
  );
}
