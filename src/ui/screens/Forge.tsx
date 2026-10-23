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
  smithingWork,
  weaponPower,
  type GameEvent,
  type GameState,
  type Rates,
} from '../../core';
import { Bar, Chip, CostList, Panel } from '../components/common';
import { QualityChip, RARE, WeaponIcon } from '../components/equipment';
import { fmtDuration, fmtInt, fmtRate } from '../format';
import { useStore } from '../game';
import { QUALITY_COLOR, qualityName } from '../labels';

export function Forge({ state, rates, log }: { state: GameState; rates: Rates; log: GameEvent[] }) {
  const store = useStore();
  const [error, setError] = useState<string | null>(null);
  const weaponTypeId = race(state, content).weaponTypeId;
  const weapon = content.equipment.weaponTypes[weaponTypeId]!;
  const recipe = Object.values(content.equipment.recipes).find((r) => r.weaponTypeId === weaponTypeId && r.tier === 1)!;
  const available = recipeAvailable(state, recipe.id, content);
  // Smiths work only while there is an order, so the speed shown is what the assigned troops give.
  const smiths = state.troops.filter((t) => t.activity === 'smithing');
  // With an order the core's rate is exact; without one, show what the best smith would manage at the anvil.
  const speed = rates.craftWorkPerSec > 0 ? rates.craftWorkPerSec : Math.max(0, ...smiths.map((t) => smithingWork(state, t, content)));
  const secPerItem = speed > 0 ? recipe.workPerItem / speed : Infinity;
  const mk = masteryKey(weaponTypeId, 1);
  const crafted = state.crafting.crafted[mk] ?? 0;
  const level = masteryLevel(crafted, content);
  const max = content.equipment.maxMastery;
  const from = craftedForMastery(level, content);
  const to = craftedForMastery(Math.min(max, level + 1), content);
  const chances = qualityChances(level, content);
  const queue = state.crafting.queue;
  const queued = queue.reduce((n, o) => n + o.remaining, 0);
  const maxN = maxCraftable(state, recipe.id, content);
  const armoury = QUALITY_IDS.map((q) => ({ q, n: state.armoury[`${weaponTypeId}:t1:${q}`] ?? 0 }));
  // The latest weapons off the anvil, oldest first so new ones appear at the end of the row.
  const recent = log
    .filter((e): e is Extract<GameEvent, { type: 'weaponCrafted' }> => e.type === 'weaponCrafted')
    .slice(0, 11)
    .reverse();
  const order = (n: number) => setError(store.command({ type: 'queueCraft', recipeId: recipe.id, count: n }));

  return (
    <div className="screen">
      <Panel hero icon="anvil" title="Smedjan" aside={<span className="battle-head">{smiths.length > 0 && <Chip tone="gold"><Icon name="anvil" size={14} /> {smiths.length}</Chip>}<Chip>Kö {queue.length}</Chip>{speed > 0 && <span className="muted small">{fmtRate(60 / secPerItem)}/min</span>}</span>}>
        <div className="recipe">
          <WeaponIcon weaponTypeId={weaponTypeId} quality="normal" size={44} />
          <div className="recipe__info">
            <h3 className="recipe__name">T1 {weapon.name}</h3>
            <p className="small muted">
              <CostList cost={recipe.materials} state={state} /> · {fmtInt(recipe.workPerItem)} arbete · <Icon name="strength" size={14} /> ×{fmtRate(weaponPower(1, 'normal', content))}
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
          <p className="muted small"><Icon name="lock" size={16} /> Bygg smedjan i bosättningen för att börja smida.</p>
        )}
        {queue.length > 0 && (
          <div className="queue">
            <div className="forge-now">
              <span className="hex"><WeaponIcon weaponTypeId={weaponTypeId} quality="normal" size={30} /></span>
              <div>
                <b>T1 {weapon.name} × {fmtInt(queue[0]!.remaining)}</b>
                <Bar value={state.crafting.progress} max={recipe.workPerItem} tone="gold" label="Smider" inside={rates.craftWorkPerSec > 0 ? `Smider · ${fmtDuration((recipe.workPerItem - state.crafting.progress) / rates.craftWorkPerSec)}` : 'Väntar på smed'} />
              </div>
              <button className="btn btn--small" aria-label="Avbryt beställning" onClick={() => setError(store.command({ type: 'cancelCraft', index: 0 }))}><Icon name="close" size={14} /></button>
            </div>
            {queue.slice(1).map((o, i) => (
              <div key={i} className="forge-next">
                <span className="hex"><WeaponIcon weaponTypeId={weaponTypeId} quality={null} size={22} /></span>
                <span style={{ flex: 1 }}>Näst: T1 {weapon.name} × {fmtInt(o.remaining)}</span>
                <button className="btn btn--small btn--ghost" aria-label="Avbryt beställning" onClick={() => setError(store.command({ type: 'cancelCraft', index: i + 1 }))}><Icon name="close" size={14} /></button>
              </div>
            ))}
            <span className="small muted">{fmtInt(queued)} vapen kvar · {rates.craftWorkPerSec > 0 ? `klart om ${fmtDuration(((queued - 1) * recipe.workPerItem + (recipe.workPerItem - state.crafting.progress)) / rates.craftWorkPerSec)}` : 'står still utan smeder'}</span>
          </div>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </Panel>

      <Panel title="Kvalitetschans" aside={<span className="badge">Nivå {level}/{max}</span>}>
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
          <p className="small">Högsta skicklighet i T1.</p>
        )}
      </Panel>

      {recent.length > 0 && (
        <section className="screen-section" aria-label="Senast smidda vapen">
          <span className="tag">Nyss smitt</span>
          <div className="recent">
            {[...recent].reverse().slice(0, 8).map((e) => (
              <div key={`${e.at}-${e.quality}`} className={`recent__item ${RARE.has(e.quality) ? 'recent__item--rare' : ''} ${e.quality === 'masterpiece' || e.quality === 'excellent' ? 'recent__item--epic' : ''}`} style={{ ['--q' as string]: QUALITY_COLOR[e.quality] }}>
                <span className="hex" style={{ ['--q' as string]: QUALITY_COLOR[e.quality] }}>
                  <WeaponIcon weaponTypeId={content.equipment.recipes[e.recipeId]?.weaponTypeId ?? weaponTypeId} quality={e.quality} size={30} />
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
            {armoury.filter((a) => a.n > 0).reverse().map((a) => <QualityChip key={a.q} quality={a.q} count={a.n} weaponTypeId={weaponTypeId} />)}
          </div>
        )}
        {Object.entries(state.armoury).some(([k, n]) => n > 0 && parseItemKey(k)?.weaponTypeId !== weaponTypeId) && (
          <p className="small muted">Det finns även vapen av annan typ i förrådet.</p>
        )}
      </Panel>

      <Panel title="Vapennivåer">
        <ol className="tiers">
          {content.equipment.tiers.map((t) => (
            <li key={t.tier} className={`tier ${t.tier === 1 ? 'tier--open' : ''}`}>
              <strong>T{t.tier}</strong>
              <span className="small"><Icon name="strength" size={14} /> ×{fmtRate(t.powerMult)}</span>
              <span className="small muted">{t.tier === 1 ? 'Öppen' : <Icon name="lock" size={14} label="Låst" />}</span>
            </li>
          ))}
        </ol>
        <p className="small muted">T2–T8 låses upp i nya regioner. Mästerverk ≈ Normal i nästa nivå.</p>
      </Panel>
    </div>
  );
}
