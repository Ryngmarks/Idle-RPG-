import { useState } from 'react';
import { content } from '../../content';
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
  troopStats,
  weaponPower,
  type GameState,
  type Rates,
} from '../../core';
import { Bar, CostList, Panel } from '../components/common';
import { QualityChip, WeaponIcon } from '../components/equipment';
import { fmtDuration, fmtInt, fmtRate } from '../format';
import { useStore } from '../game';
import { QUALITY_COLOR, qualityName } from '../labels';

export function Forge({ state, rates }: { state: GameState; rates: Rates }) {
  const store = useStore();
  const [error, setError] = useState<string | null>(null);
  const weaponTypeId = race(state, content).weaponTypeId;
  const weapon = content.equipment.weaponTypes[weaponTypeId]!;
  const recipe = Object.values(content.equipment.recipes).find((r) => r.weaponTypeId === weaponTypeId && r.tier === 1)!;
  const available = recipeAvailable(state, recipe.id, content);
  // Smiths work only while there is an order, so the speed shown is what the assigned troops give.
  const smiths = state.troops.filter((t) => t.activity === 'smithing');
  const speed = smiths.reduce((n, t) => n + smithingWork(troopStats(state, t, content), content), 0);
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
  const order = (n: number) => setError(store.command({ type: 'queueCraft', recipeId: recipe.id, count: n }));

  return (
    <div className="screen">
      <Panel title="Smedjan" aside={<span className="muted small">{speed > 0 ? `${fmtRate(60 / secPerItem)} vapen/min` : ''}</span>}>
        <div className="recipe">
          <WeaponIcon weaponTypeId={weaponTypeId} quality="normal" size={44} />
          <div className="recipe__info">
            <h3 className="recipe__name">T1 {weapon.name}</h3>
            <p className="small muted">
              Per vapen: <CostList cost={recipe.materials} state={state} /> · {fmtInt(recipe.workPerItem)} arbete · ⚔ ×{fmtRate(weaponPower(1, 'normal', content))} (Normal)
            </p>
          </div>
        </div>
        {available && (
          <p className={`small ${smiths.length > 0 ? '' : 'warn'}`}>
            {smiths.length > 0
              ? `⚒️ ${smiths.map((t) => t.name).join(', ')} smider · ${fmtDuration(secPerItem)} per vapen${queue.length === 0 ? ' · väntar på beställning' : ''}`
              : '⚒️ Ingen trupp smider. Ge en trupp aktiviteten Smide under Styrkor.'}
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
          <p className="muted small">🔒 Bygg smedjan i bosättningen för att börja smida.</p>
        )}
        {queue.length > 0 && (
          <div className="queue">
            <span className="recruit__label">Beställningar · {fmtInt(queued)} vapen kvar · {rates.craftWorkPerSec > 0 ? `klart om ${fmtDuration(((queued - 1) * recipe.workPerItem + (recipe.workPerItem - state.crafting.progress)) / rates.craftWorkPerSec)}` : 'står still utan smeder'}</span>
            {queue.map((o, i) => (
              <div key={i} className="queue__row">
                <span className="small">T1 {weapon.name} × {fmtInt(o.remaining)}</span>
                {i === 0 && <Bar value={state.crafting.progress} max={recipe.workPerItem} tone="gold" label="Smider" />}
                <button className="btn btn--small" aria-label="Avbryt beställning" onClick={() => setError(store.command({ type: 'cancelCraft', index: i }))}>✕</button>
              </div>
            ))}
          </div>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </Panel>

      <Panel title="Smideskunskap" aside={<span className="badge">Nivå {level}/{max}</span>}>
        <p className="small muted">Ju fler {weapon.name.toLowerCase()} du smider, desto bättre blir kvaliteten. {fmtInt(crafted)} smidda totalt.</p>
        {level < max ? (
          <>
            <span className="small">Till nivå {level + 1}: {fmtInt(crafted - from)} / {fmtInt(to - from)}</span>
            <Bar value={crafted - from} max={to - from} tone="xp" label="Smideskunskap" />
          </>
        ) : (
          <p className="small">Högsta skicklighet i T1.</p>
        )}
        <span className="recruit__label">Chans per vapen</span>
        <div className="chance-bar" role="img" aria-label="Kvalitetschanser">
          {QUALITY_IDS.map((q, i) => (chances[i]! > 0 ? <span key={q} style={{ flexGrow: chances[i], background: QUALITY_COLOR[q] }} /> : null))}
        </div>
        <div className="equip__legend">
          {QUALITY_IDS.map((q, i) => (
            <span key={q} className="legend-dot"><i style={{ background: QUALITY_COLOR[q] }} />{qualityName(q)} {Math.round(chances[i]! * 100)} %</span>
          ))}
        </div>
      </Panel>

      <Panel title="Förrådet">
        {armoury.every((a) => a.n === 0) ? (
          <p className="muted small">Inga vapen i förrådet. Färdiga vapen hamnar här; utrusta dem från truppkorten.</p>
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
              <span className="small">⚔ ×{fmtRate(t.powerMult)}</span>
              <span className="small muted">{t.tier === 1 ? 'Öppen' : '🔒'}</span>
            </li>
          ))}
        </ol>
        <p className="small muted">T2–T8 låses upp senare genom nya regioner, bättre smedjor, nya material och skicklighet. Ett Mästerverk i en nivå är lika starkt som Normal i nästa.</p>
      </Panel>
    </div>
  );
}
