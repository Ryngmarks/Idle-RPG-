import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { content } from '../../content';
import { enemy, estimatedBossDamage, nextBoss, stageSafety, zone, type GameEvent, type GameState, type Rates, type StageSafety } from '../../core';
import { EnemyPortrait } from '../art';
import { Icon } from '../art/icons';
import { buildFieldSnap, LivingBattlefield, type FieldPick } from '../battlefield';
import { Bar, Panel } from '../components/common';
import { fmtDuration, fmtInt, fmtRate } from '../format';
import { useStore } from '../game';
import { BOSS_FAIL_TEXT } from '../labels';
import { EnemySheet, RiskBadge, TroopSheet } from './BattleSheets';

const RISK_ICON = { safe: 'dotSafe', risky: 'dotRisky', deadly: 'dotDeadly' } as const;
const HINT_KEY = 'utposten:bf-hint';
const HINT_SHOWS = 4;

/** Tap hint: shown the first few visits, gone after the first tap. Storage may be unavailable, so every access is guarded. */
function readHint(): boolean {
  try {
    const n = Number(localStorage.getItem(HINT_KEY) ?? '0');
    return n < HINT_SHOWS;
  } catch {
    return false;
  }
}
function writeHint(n: number): void {
  try {
    localStorage.setItem(HINT_KEY, String(n));
  } catch {
    /* ignore */
  }
}

/** Compact level picker: levels grouped by band, five per row, scrolls inside its own box. */
function LevelPicker({ state, safetyAt, justOpened, onSelect }: { state: GameState; safetyAt: (i: number) => StageSafety; justOpened: number | null; onSelect: (i: number) => void }) {
  const z = zone(state, content);
  const c = state.combat;
  const bands = z.bands ?? [{ name: z.name, fromLevel: 1, toLevel: z.stages.length }];
  const bossAt = new Map(z.bosses.map((b, i) => [b.level, i] as const));
  // Only the band of the current level is shown; the arrows browse the other open bands.
  const currentBand = Math.max(0, bands.findIndex((b) => c.stageIndex + 1 >= b.fromLevel && c.stageIndex + 1 <= b.toLevel));
  const lastOpenBand = Math.max(0, bands.findIndex((b) => b.fromLevel - 1 > c.unlockedStage) - 1);
  const maxBand = bands.findIndex((b) => b.fromLevel - 1 > c.unlockedStage) === -1 ? bands.length - 1 : lastOpenBand;
  const [view, setView] = useState(currentBand);
  useEffect(() => setView(currentBand), [currentBand]);
  const b = bands[Math.min(view, bands.length - 1)]!;
  const lvls = Array.from({ length: b.toLevel - b.fromLevel + 1 }, (_, k) => b.fromLevel + k);
  return (
    <div className="levels" role="group" aria-label="Välj nivå">
      <section className="band">
        <div className="band__head">
          <button className="band__nav" disabled={view <= 0} aria-label="Föregående område" onClick={() => setView((v) => Math.max(0, v - 1))}>‹</button>
          <h3 className="band__name">{b.name} <span className="muted">{b.fromLevel}–{b.toLevel}</span></h3>
          <button className="band__nav" disabled={view >= maxBand} aria-label="Nästa område" onClick={() => setView((v) => Math.min(maxBand, v + 1))}>›</button>
        </div>
        <div className="band__chips">
          {lvls.map((lv) => {
            const i = lv - 1;
            const open = i <= c.unlockedStage;
            const cleared = i < c.unlockedStage || (c.cleared && i === c.unlockedStage);
            const current = i === c.stageIndex;
            const highest = i === c.unlockedStage;
            const bi = bossAt.get(lv);
            const bossDone = bi !== undefined && bi < c.bossesDefeated;
            const risk = open && !cleared ? safetyAt(i).risk : null;
            const name = content.enemies[z.stages[i]!.enemyId]?.name ?? '';
            return (
              <button
                key={lv}
                data-current={current}
                className={`lvl ${open ? '' : 'lvl--locked'} ${cleared ? 'lvl--cleared' : ''} ${current ? 'lvl--current' : ''} ${highest ? 'lvl--top' : ''} ${bi !== undefined ? 'lvl--boss' : ''} ${lv === justOpened ? 'lvl--new' : ''} ${risk ? `lvl--${risk}` : ''}`}
                disabled={!open || !!c.boss}
                aria-pressed={current}
                aria-label={`Nivå ${lv}: ${name}${bi !== undefined ? `, boss ${bi + 1}${bossDone ? ' besegrad' : ''}` : ''}${open ? '' : ' (låst)'}`}
                onClick={() => onSelect(i)}
              >
                <span className="lvl__n">{open ? lv : <Icon name="lock" size={14} />}</span>
                {bi !== undefined && <span className={`lvl__mark ${bossDone ? 'lvl__mark--done' : ''}`} aria-hidden><Icon name="crown" size={14} /></span>}
                {cleared && <span className="lvl__tick" aria-hidden><Icon name="check" size={10} /></span>}
                {current && <span className="lvl__flag" aria-hidden><Icon name="flag" size={14} /></span>}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function BossFailure({ log, state }: { log: GameEvent[]; state: GameState }) {
  const last = log.find((e) => e.type === 'bossFailed' || e.type === 'bossDefeated' || e.type === 'bossReady');
  if (!last || last.type !== 'bossFailed' || state.combat.boss) return null;
  return <p className="boss__fail" role="status"><Icon name="warning" size={16} /> {BOSS_FAIL_TEXT[last.reason]}</p>;
}


export function Battle({ state, rates, log, onOpenForces }: { state: GameState; rates: Rates; log: GameEvent[]; onOpenForces: () => void }) {
  const store = useStore();
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<FieldPick | null>(null);
  const [hint, setHint] = useState(readHint);
  const z = zone(state, content);
  const c = state.combat;
  const fighters = state.troops.filter((t) => t.activity === 'combat');
  // Risk is judged for the troops that are fighting, or for the whole army if nobody is.
  const judged = (fighters.length > 0 ? fighters : state.troops).map((t) => t.id);
  const safetyAt = (i: number) => stageSafety(state, content, { stageIndex: i }, judged);
  const stage = z.stages[Math.min(c.stageIndex, z.stages.length - 1)]!;
  const onFrontier = !c.cleared && c.stageIndex === c.unlockedStage;
  const nb = nextBoss(state, content);
  const fightIdx = c.boss ? c.boss.index : nb?.index ?? z.bosses.length - 1;
  const bossDef = z.bosses[Math.min(fightIdx, z.bosses.length - 1)]!;
  const boss = enemy(bossDef.enemyId, content);
  const allBossesDown = nb === null && !c.boss;
  const est = estimatedBossDamage(state, content);
  const here = safetyAt(c.stageIndex);
  const select = (i: number) => setError(store.command({ type: 'selectStage', stageIndex: i }));
  const highest = Math.min(z.stages.length, c.unlockedStage + 1);

  // Celebrate a newly opened level for a few seconds.
  const [justOpened, setJustOpened] = useState<number | null>(null);
  const prevUnlocked = useRef(c.unlockedStage);
  useEffect(() => {
    if (c.unlockedStage > prevUnlocked.current) {
      setJustOpened(c.unlockedStage + 1);
      const id = setTimeout(() => setJustOpened(null), 3000);
      prevUnlocked.current = c.unlockedStage;
      return () => clearTimeout(id);
    }
    prevUnlocked.current = c.unlockedStage;
  }, [c.unlockedStage]);

  // Count this visit for the tap hint.
  useEffect(() => {
    try {
      writeHint(Number(localStorage.getItem(HINT_KEY) ?? '0') + 1);
    } catch {
      /* ignore */
    }
  }, []);
  const pick = (p: FieldPick) => {
    setSheet(p);
    if (hint) { setHint(false); writeHint(99); }
  };

  const fieldSnap = useMemo(() => buildFieldSnap(state, rates), [state, rates]);
  const foeName = c.boss ? boss.name : fieldSnap.enemyName;
  const badge = <span className="badge boss__badge">Boss {fightIdx + 1} / {z.bosses.length}</span>;

  return (
    <div className="screen">
      <LivingBattlefield snap={fieldSnap} onPick={pick} />
      {fighters.length > 0 && (
        <div className="bf-details" role="group" aria-label="Detaljer">
          {hint && <span className="bf-hint" role="note"><Icon name="arrow" size={13} /> Tryck på en trupp eller fiende</span>}
          {fighters.map((t) => (
            <button key={t.id} className="bf-chip" onClick={() => pick({ kind: 'troop', id: t.id })} aria-label={`Visa detaljer: ${t.name}, ${t.size} soldater`}>
              <Icon name="soldier" size={14} /> {t.name} <b>{t.size}</b>
            </button>
          ))}
          <button className="bf-chip bf-chip--foe" onClick={() => pick({ kind: 'enemy' })} aria-label={`Visa detaljer: ${foeName}`}>
            <Icon name={c.boss ? 'crown' : 'swords'} size={14} /> {foeName}
          </button>
        </div>
      )}

      <Panel hero icon="swords" title={z.name} aside={<span className="battle-head"><RiskBadge risk={here.risk} /></span>}>
        <div className="zone-progress">
          <div className="zone-progress__row">
            <b>Nivå {highest} / {z.stages.length}</b>
            <span className="small muted"><Icon name="crown" size={14} /> {c.bossesDefeated} / {z.bosses.length} bossar</span>
          </div>
          <Bar value={highest} max={z.stages.length} tone="gold" label="Zonframsteg" />
        </div>
        {justOpened !== null && <div key={justOpened} className="stage-banner" role="status"><Icon name="flag" size={18} /> Nivå {justOpened} öppen!</div>}
        <LevelPicker state={state} safetyAt={safetyAt} justOpened={justOpened} onSelect={select} />
        <button
          className={`switch ${c.autoAdvance ? 'switch--on' : ''}`}
          role="switch"
          aria-checked={c.autoAdvance}
          onClick={() => setError(store.command({ type: 'setAutoAdvance', on: !c.autoAdvance }))}
        >
          <span className="switch__track"><i /></span> Gå vidare automatiskt
        </button>
        {onFrontier ? (
          <div className="kill-line">
            <span className="small">Till nästa nivå <b>{fmtInt(Math.floor(c.kills))} / {stage.killsToClear}</b></span>
            <Bar value={c.kills} max={stage.killsToClear} tone="gold" label="Nivåframsteg" />
          </div>
        ) : !c.cleared ? (
          <div className="kill-line">
            <span className="small muted">Du övar på en lägre nivå.</span>
            <button className="btn btn--small" disabled={!!c.boss} onClick={() => select(c.unlockedStage)}>
              Till nivå {c.unlockedStage + 1} <Icon name={RISK_ICON[safetyAt(c.unlockedStage).risk]} size={14} />
            </button>
          </div>
        ) : (
          <p className="small kill-line"><Icon name="check" size={14} /> Nivån är klar.</p>
        )}
      </Panel>

      {fighters.length === 0 && (
        <div className="cta" role="status"><Icon name="warning" size={22} /> <span>Ingen trupp strider. Ge en trupp ordern <b>Strid</b> under Styrkor.</span></div>
      )}

      <Panel icon="crown" title={allBossesDown ? 'Alla bossar besegrade' : `Boss: ${boss.name}`} className={`boss boss--compact ${c.cleared && nb && est.canWin ? 'boss--ready' : ''}`} aside={allBossesDown ? undefined : badge}>
        {allBossesDown ? (
          <p><Icon name="crown" size={20} /> Gårdarna är säkra. <span className="muted">Nästa region kommer i en senare version.</span></p>
        ) : (
          <>
            <div className="boss__top">
              <div className="boss__art"><EnemyPortrait enemyId={boss.id} size={48} /></div>
              <div className="boss__facts small">
                <span className="boss__facts-row"><Icon name="heart" size={14} /> {fmtInt(boss.hp)} <Icon name="shield" size={14} /> {boss.armour} <Icon name="clock" size={14} /> {fmtDuration(bossDef.timeLimitSec)}</span>
                <span className="muted">Nivå {bossDef.level}</span>
              </div>
            </div>
            {c.boss ? (
              <p className="small"><Icon name="swords" size={14} /> Bossstriden pågår: {fmtRate(rates.bossDps)} skada/s. Tryck på bossen för detaljer.</p>
            ) : (
              <>
                <p className={`boss__need ${est.canWin ? 'boss__need--ok' : 'boss__need--no'}`}>
                  <Icon name={est.canWin ? 'check' : 'warning'} size={16} />{' '}
                  Behövs <b>{fmtRate(est.neededDps)}</b>/s, ni har <b>{fmtRate(est.dps)}</b>/s
                  <span className="boss__verdict">{est.canWin ? 'Redo' : 'Inte redo'}</span>
                </p>
                <Bar value={Math.min(est.dps, est.neededDps)} max={est.neededDps} tone={est.canWin ? 'life' : 'blood'} label="Skada mot behov" />
                {!est.canWin && est.dps > 0 && est.damage >= est.hp && <p className="small muted">Truppen orkar inte hela striden: de retirerar efter ~{fmtDuration(est.secondsToRetreat)}.</p>}
                <BossFailure log={log} state={state} />
                {c.cleared ? (
                  <button className={`btn btn--block ${est.canWin ? 'btn--primary' : 'btn--ghost btn--notready'}`} onClick={() => setError(store.command({ type: 'challengeBoss' }))}>
                    Utmana bossen
                  </button>
                ) : (
                  <p className="muted small"><Icon name="lock" size={16} /> Rensa nivå {bossDef.level} för att utmana bossen.</p>
                )}
              </>
            )}
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </Panel>

      {sheet && createPortal(
        <>
          {sheet?.kind === 'troop' && <TroopSheet state={state} rates={rates} troopId={sheet.id} onClose={() => setSheet(null)} onForces={() => { setSheet(null); onOpenForces(); }} />}
          {sheet?.kind === 'enemy' && <EnemySheet state={state} rates={rates} onClose={() => setSheet(null)} />}
        </>,
        document.body,
      )}
    </div>
  );
}
