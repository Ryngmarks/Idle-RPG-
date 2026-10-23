import { useEffect, useRef, useState } from 'react';
import { content } from '../../content';
import { currentEnemy, enemy, estimatedBossDamage, nextBoss, normalizeBuckets, secondsPerKill, stageSafety, troopStats, zone, type GameEvent, type GameState, type Rates, type StageSafety } from '../../core';
import { EnemyPortrait } from '../art';
import { Icon } from '../art/icons';
import { Battlefield } from '../army';
import { Bar, Chip, Panel, ResAmount } from '../components/common';
import { fmtDuration, fmtInt, fmtRate } from '../format';
import { useStore } from '../game';
import { BOSS_FAIL_TEXT, RESOURCE_LABEL } from '../labels';

const RISK_ICON = { safe: 'dotSafe', risky: 'dotRisky', deadly: 'dotDeadly' } as const;
const RISK_BADGE = { safe: { text: 'Låg risk', tone: 'ok' }, risky: { text: 'Risk', tone: 'slow' }, deadly: { text: 'Hög risk', tone: 'warn' } } as const;

function RiskBadge({ risk }: { risk: StageSafety['risk'] }) {
  return <Chip tone={RISK_BADGE[risk].tone}>{RISK_BADGE[risk].text}</Chip>;
}

function riskText(s: StageSafety): string {
  if (s.risk === 'safe') return 'Säkert: dina trupper läker snabbare än de skadas.';
  const when = fmtDuration(s.secondsToFirstLoss);
  return s.risk === 'risky'
    ? `Riskabelt: första soldaten faller om cirka ${when}.`
    : `Dödligt: första soldaten faller om ${when}. Truppen retirerar när hälften har fallit.`;
}

/** Compact level picker: levels grouped by band, five per row, scrolls inside its own box. */
function LevelPicker({ state, safetyAt, justOpened, onSelect }: { state: GameState; safetyAt: (i: number) => StageSafety; justOpened: number | null; onSelect: (i: number) => void }) {
  const z = zone(state, content);
  const c = state.combat;
  const bands = z.bands ?? [{ name: z.name, fromLevel: 1, toLevel: z.stages.length }];
  const bossAt = new Map(z.bosses.map((b, i) => [b.level, i] as const));
  const box = useRef<HTMLDivElement>(null);
  // Bring the current band into view when the screen opens.
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>('[data-band="current"]');
    const parent = box.current;
    if (el && parent) parent.scrollTop = Math.max(0, el.offsetTop - parent.offsetTop - 6);
  }, []);
  return (
    <div className="levels" ref={box} role="group" aria-label="Välj nivå">
      {bands.map((b) => {
        const lvls = Array.from({ length: b.toLevel - b.fromLevel + 1 }, (_, k) => b.fromLevel + k);
        const bandOpen = b.fromLevel - 1 <= c.unlockedStage;
        return (
          <section key={b.name} data-band={c.stageIndex + 1 >= b.fromLevel && c.stageIndex + 1 <= b.toLevel ? 'current' : undefined} className={`band ${bandOpen ? '' : 'band--locked'}`}>
            <h3 className="band__name">{b.name} <span className="muted">{b.fromLevel}–{b.toLevel}</span></h3>
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
        );
      })}
    </div>
  );
}

function BossFailure({ log, state }: { log: GameEvent[]; state: GameState }) {
  const last = log.find((e) => e.type === 'bossFailed' || e.type === 'bossDefeated' || e.type === 'bossReady');
  if (!last || last.type !== 'bossFailed' || state.combat.boss) return null;
  return <p className="boss__fail" role="status"><Icon name="warning" size={16} /> {BOSS_FAIL_TEXT[last.reason]}</p>;
}


export function Battle({ state, rates, log }: { state: GameState; rates: Rates; log: GameEvent[] }) {
  const store = useStore();
  const [error, setError] = useState<string | null>(null);
  const z = zone(state, content);
  const c = state.combat;
  const foe = currentEnemy(state, content);
  const fighters = state.troops.filter((t) => t.activity === 'combat');
  // Risk is judged for the troops that are fighting, or for the whole army if nobody is.
  const judged = (fighters.length > 0 ? fighters : state.troops).map((t) => t.id);
  const safetyAt = (i: number) => stageSafety(state, content, { stageIndex: i }, judged);
  const totalDps = fighters.reduce((sum, t) => sum + troopStats(state, t, content).strength, 0);
  const stage = z.stages[Math.min(c.stageIndex, z.stages.length - 1)]!;
  const onFrontier = !c.cleared && c.stageIndex === c.unlockedStage;
  // Current enemy HP is derived from the fractional kill count (the core tracks kills continuously).
  const frac = state.stats.totalKills % 1;
  const showHp = rates.killsPerSec > 0 && rates.killsPerSec < 2;
  const nb = nextBoss(state, content);
  const fightIdx = c.boss ? c.boss.index : nb?.index ?? z.bosses.length - 1;
  const bossDef = z.bosses[Math.min(fightIdx, z.bosses.length - 1)]!;
  const boss = enemy(bossDef.enemyId, content);
  const allBossesDown = nb === null && !c.boss;
  const est = estimatedBossDamage(state, content);
  const bossSafety = stageSafety(state, content, 'boss', judged);
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

  const spk = secondsPerKill(state, content);
  const fighterStats = fighters.map((t) => ({ t, st: troopStats(state, t, content) }));
  const groupMax = fighterStats.reduce((n, x) => n + x.st.maxHp, 0);
  const groupNow = fighterStats.reduce((n, x) => n + x.st.maxHp - x.t.wounds, 0);
  const incoming = fighters.reduce((n, t) => n + Math.max(0, rates.woundsPerSec[t.id] ?? 0), 0);
  const healing = fighters.some((t) => (rates.woundsPerSec[t.id] ?? 0) < 0);
  const foeHp = foe.hp * (1 - frac);
  const soldiers = fighters.reduce((n, t) => n + t.size, 0);
  const badge = <span className="badge boss__badge">Boss {fightIdx + 1} / {z.bosses.length}</span>;

  return (
    <div className="screen">
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
          <div className="stage-progress">
            <span className="small">Besegra {stage.killsToClear} för att öppna nästa nivå: {fmtInt(Math.floor(c.kills))} / {stage.killsToClear}</span>
            <Bar value={c.kills} max={stage.killsToClear} tone="gold" label="Nivåframsteg" />
          </div>
        ) : !c.cleared ? (
          <div className="row">
            <p className="small muted">Här samlar du mat och erfarenhet i lugn takt. Nivå {c.unlockedStage + 1} är öppen.</p>
            <button className="btn btn--small" disabled={!!c.boss} onClick={() => select(c.unlockedStage)}>
              Gå till nivå {c.unlockedStage + 1} <Icon name={RISK_ICON[safetyAt(c.unlockedStage).risk]} size={14} />
            </button>
          </div>
        ) : (
          nb && <p className="small"><Icon name="crown" size={16} /> En boss väntar: <b>{boss.name}</b></p>
        )}
      </Panel>

      {fighters.length === 0 && (
        <div className="cta" role="status"><Icon name="warning" size={22} /> <span>Ingen trupp strider. Ge en trupp ordern <b>Strid</b> under Styrkor.</span></div>
      )}

      <Panel className="enemy enemy-card" title={c.boss ? boss.name : foe.name} aside={<span className="small muted stat"><Icon name="shield" size={16} /> Rustning {c.boss ? boss.armour : foe.armour}</span>}>
        <Battlefield
          race={state.raceId}
          size={soldiers}
          enemyId={c.boss ? boss.id : foe.id}
          hitKey={Math.floor(state.stats.totalKills)}
          strikeSec={rates.killsPerSec > 0 ? Math.max(0.5, Math.min(1.4, 1 / rates.killsPerSec)) : undefined}
          dmg={rates.killsPerSec < 1 ? `-${fmtRate(c.boss ? rates.bossDps : totalDps)}/s` : undefined}
          fighting={fighters.length > 0}
          boss={!!c.boss}
          equipment={normalizeBuckets(fighters.flatMap((t) => t.equipment), content)}
        />
        {!c.boss && (showHp ? (
          <Bar value={foeHp} max={foe.hp} tone="blood" label="Fiendens HP" inside={`HP ${fmtInt(foeHp)} / ${foe.hp}`} />
        ) : (
          <Bar value={foe.hp} max={foe.hp} tone="blood" label="Fiendens HP" inside={rates.killsPerSec >= 2 ? `${fmtRate(rates.killsPerSec)} fiender/s` : `HP ${foe.hp}`} />
        ))}
        <div className="kv">
          <span className="kv__loot">Ger {Object.entries(foe.loot).map(([r, v]) => <ResAmount key={r} r={r as keyof typeof RESOURCE_LABEL} v={fmtRate(v ?? 0)} />)} <span className="amount"><Icon name="xp" size={16} />{fmtRate(foe.xp)} XP</span></span>
          <span className="sp" style={{ flex: 1 }} />
          {spk !== null && <b>{spk < 1 ? 'Faller på under 1 s' : `Faller om ~${fmtRate(spk)} s`}</b>}
        </div>
        {fighters.length > 0 && <p className="small muted">{fighters.map((t) => t.name).join(', ')} · {fmtRate(totalDps)} DPS</p>}
      </Panel>

      {fighters.length > 0 && <Panel icon="heart" title={`Gruppens liv${soldiers > 0 ? ` · ${soldiers} ${soldiers === 1 ? 'soldat' : 'soldater'}` : ''}`}>
        <Bar value={groupNow} max={groupMax} tone="life" label="Gruppens liv" inside={`${fmtInt(groupNow)} / ${fmtInt(groupMax)}`} />
        <p className="small muted">
          {incoming > 0 ? `Skada mot er ${fmtRate(incoming)}/s` : healing ? 'Läker mellan strider' : 'Ingen skada just nu'}
          {here.risk !== 'safe' && fighters.length > 0 ? ` · ${riskText(here)}` : ''}
        </p>
      </Panel>}

      <Panel icon="crown" title={allBossesDown ? 'Alla bossar besegrade' : `Boss: ${boss.name}`} className={`boss ${c.cleared && nb ? 'boss--ready' : ''}`} aside={allBossesDown ? undefined : badge}>
        {allBossesDown ? (
          <p><Icon name="crown" size={20} /> Gårdarna är säkra. <span className="muted">Nästa region kommer i en senare version.</span></p>
        ) : (
          <>
            <div className="boss__top">
              <div className="boss__art"><EnemyPortrait enemyId={boss.id} size={72} /></div>
              <div className="boss__facts small">
                <span><Icon name="heart" size={14} /> HP {fmtInt(boss.hp)}</span>
                <span><Icon name="shield" size={14} /> Rustning {boss.armour}</span>
                <span><Icon name="clock" size={14} /> {fmtDuration(bossDef.timeLimitSec)}</span>
                <span className="muted">Nivå {bossDef.level}</span>
              </div>
            </div>
            {c.boss ? (
              <>
                <span className="small">HP {fmtInt(c.boss.hpLeft)} / {fmtInt(boss.hp)}</span>
                <Bar value={c.boss.hpLeft} max={boss.hp} tone="blood" label="Bossens HP" />
                <span className="small">Tid kvar {fmtDuration(c.boss.timeLeft)}</span>
                <Bar value={c.boss.timeLeft} max={bossDef.timeLimitSec} tone="steel" label="Tid kvar" />
                <p className="small">Skada: {fmtRate(rates.bossDps)} per sekund</p>
              </>
            ) : (
              <>
                <p className={`boss__need ${est.canWin ? 'boss__need--ok' : 'boss__need--no'}`}>
                  <Icon name={est.canWin ? 'check' : 'warning'} size={16} />{' '}
                  Behövs <b>{fmtRate(est.neededDps)}</b> skada/s, ni har <b>{fmtRate(est.dps)}</b>
                  <span className="boss__verdict">{est.canWin ? 'Redo' : 'Inte redo'}</span>
                </p>
                <Bar value={Math.min(est.dps, est.neededDps)} max={est.neededDps} tone={est.canWin ? 'life' : 'blood'} label="Skada mot behov" />
                {!est.canWin && est.dps > 0 && est.damage >= est.hp && <p className="small muted">Truppen orkar inte hela striden: de retirerar efter ~{fmtDuration(est.secondsToRetreat)}.</p>}
                <BossFailure log={log} state={state} />
                {c.cleared ? (
                  <button className="btn btn--primary btn--block" onClick={() => setError(store.command({ type: 'challengeBoss' }))}>
                    Utmana bossen
                  </button>
                ) : (
                  <p className="muted small"><Icon name="lock" size={16} /> Rensa nivå {bossDef.level} för att utmana bossen.</p>
                )}
                {c.cleared && bossSafety.risk !== 'safe' && <p className="small muted">{riskText(bossSafety)}</p>}
              </>
            )}
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </Panel>
    </div>
  );
}
