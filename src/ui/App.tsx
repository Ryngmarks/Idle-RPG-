import { useEffect, useMemo, useRef, useState } from 'react';
import { content } from '../content';
import { computeRates, foodBalance, RESOURCES, type GameEvent, type GameState, type Rates, type ResourceId } from '../core';
import { RaceEmblem } from './art';
import { Icon, type UiIconName } from './art/icons';
import { ResIcon } from './art/resources';
import { fmtAmount, fmtRate } from './format';
import { useRise } from './fx';
import { useSnapshot, useStore } from './game';
import { QUALITY_COLOR, RESOURCE_LABEL, eventText, qualityName } from './labels';
import { RARE } from './components/equipment';
import { Battle } from './screens/Battle';
import { Chronicle } from './screens/Chronicle';
import { Forces } from './screens/Forces';
import { Forge } from './screens/Forge';
import { AwayReportModal, MenuModal } from './screens/Modals';
import { RaceSelect } from './screens/RaceSelect';
import { Settlement } from './screens/Settlement';
import { Upgrades } from './screens/Upgrades';

type Tab = 'forces' | 'battle' | 'settlement' | 'forge' | 'upgrades' | 'chronicle';

const TABS: { id: Tab; label: string; icon: UiIconName; unlock?: string }[] = [
  { id: 'forces', label: 'Styrkor', icon: 'shield' },
  { id: 'battle', label: 'Strid', icon: 'swords', unlock: 'tab:battle' },
  { id: 'settlement', label: 'Bosättning', icon: 'castle', unlock: 'tab:settlement' },
  { id: 'forge', label: 'Smedja', icon: 'anvil', unlock: 'tab:forge' },
  { id: 'upgrades', label: 'Förbättra', icon: 'scroll', unlock: 'tab:upgrades' },
  { id: 'chronicle', label: 'Krönika', icon: 'book' },
];

/** Rate per minute; food shows its net after upkeep (D-55) and warns when it runs out. */
function ResourceRate({ r, state, rates }: { r: ResourceId; state: GameState; rates: Rates }) {
  if (r !== 'food') return <span className="resource__rate">{rates.income[r] > 0 ? `+${fmtRate(rates.income[r] * 60)}/min` : ''}</span>;
  const fb = foodBalance(state, content);
  if (fb.upkeep <= 0) return <span className="resource__rate">{fb.income > 0 ? `+${fmtRate(fb.income * 60)}/min` : ''}</span>;
  const net = fb.net * 60;
  const tone = fb.hungry ? 'resource__rate--bad' : net < 0 ? 'resource__rate--warn' : '';
  const text = fb.hungry ? 'Hungrig' : `${net >= 0 ? '+' : '−'}${fmtRate(Math.abs(net))}/min`;
  return <span className={`resource__rate ${tone}`}>{text}</span>;
}

function ResourceTile({ r, state, rates }: { r: ResourceId; state: GameState; rates: Rates }) {
  const bumps = useRise(state.resources[r], 1);
  return (
    <div className={`resource ${bumps > 0 ? 'resource--bump' : ''}`} key={bumps}>
      <span className="resource__icon" aria-hidden><ResIcon id={r} size={30} /></span>
      <span className="resource__amount">{fmtAmount(state.resources[r])}</span>
      <ResourceRate r={r} state={state} rates={rates} />
      <span className="sr-only">{RESOURCE_LABEL[r].name}</span>
    </div>
  );
}

function ResourceBar({ state, rates }: { state: GameState; rates: Rates }) {
  const shown = RESOURCES.filter(
    (r) =>
      r === 'wood' || state.resources[r] > 0 || state.stats.gathered[r] > 0 || rates.income[r] > 0 ||
      Object.values(content.sites).some((s) => (s.yield[r] ?? 0) > 0 && s.unlock !== undefined && state.unlocks.includes(s.unlock)),
  );
  return (
    <div className="resources" aria-label="Resurser">
      {shown.map((r) => <ResourceTile key={r} r={r} state={state} rates={rates} />)}
    </div>
  );
}

const TOAST_TYPES = new Set<GameEvent['type']>(['objectiveCompleted', 'troopFormed', 'constructionCompleted', 'stageCleared', 'zoneCleared', 'bossDefeated', 'bossFailed', 'bossReady', 'troopRetreated', 'craftOrderCompleted', 'masteryLevelUp', 'levelStep', 'soldiersJoined', 'recruitTrained']);

interface Toast { text: string; color?: string }

function useToast(log: GameEvent[], state: GameState | null): Toast | null {
  const [toast, setToast] = useState<Toast | null>(null);
  const last = useRef<GameEvent | undefined>(log[0]);
  useEffect(() => {
    const newest = log[0];
    if (!newest || newest === last.current || !state) return;
    const fresh: GameEvent[] = [];
    for (const e of log) {
      if (e === last.current) break;
      fresh.push(e);
    }
    last.current = newest;
    const important = fresh.find((e) => TOAST_TYPES.has(e.type));
    // A rare weapon from the forge is worth a moment of its own, in its quality's colour.
    const rare = fresh.find((e): e is Extract<GameEvent, { type: 'weaponCrafted' }> => e.type === 'weaponCrafted' && RARE.has(e.quality));
    if (important) setToast({ text: eventText(important, state) ?? '' });
    else if (rare) {
      const weapon = content.equipment.weaponTypes[content.equipment.recipes[rare.recipeId]?.weaponTypeId ?? '']?.name.toLowerCase() ?? '';
      setToast({ text: `${qualityName(rare.quality)} ${weapon} smitt!`, color: QUALITY_COLOR[rare.quality] });
    } else return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [log, state]);
  return toast;
}

export function App() {
  const store = useStore();
  const snap = useSnapshot();
  const [tab, setTab] = useState<Tab>('forces');
  const [menuOpen, setMenuOpen] = useState(false);
  const [seen, setSeen] = useState<Set<Tab>>(() => new Set(['forces', 'chronicle']));
  const state = snap.state;
  const rates = useMemo(() => (state ? computeRates(state, content) : null), [state]);
  const toast = useToast(snap.log, state);

  if (!state || !rates) return <RaceSelect />;

  const tabs = TABS.filter((t) => !t.unlock || state.unlocks.includes(t.unlock));
  const active = tabs.some((t) => t.id === tab) ? tab : 'forces';
  const race = content.races[state.raceId];
  const open = (t: Tab) => {
    setTab(t);
    setSeen((s) => new Set(s).add(t));
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="crest"><RaceEmblem raceId={state.raceId} size={34} /></span>
          <div className="topbar__title">
            <span className="eyebrow">{race?.name}</span>
            <h1 className="title title--small">Utposten</h1>
          </div>
        </div>
        <button className="btn btn--small btn--menu" onClick={() => setMenuOpen(true)} aria-label="Meny"><Icon name="menu" size={18} /> Meny</button>
      </header>
      <ResourceBar state={state} rates={rates} />
      {!snap.storageOk && <p className="warning"><Icon name="warning" size={18} /> Sparning är inte tillgänglig i den här webbläsaren. Se Meny → Exportera.</p>}

      <div className="layout">
        <main className="layout__main">
          <div key={active} className="pane">
            {active === 'forces' && <Forces state={state} rates={rates} onGo={open} />}
            {active === 'battle' && <Battle state={state} rates={rates} log={snap.log} />}
            {active === 'settlement' && <Settlement state={state} rates={rates} />}
            {active === 'forge' && <Forge state={state} rates={rates} log={snap.log} />}
            {active === 'upgrades' && <Upgrades state={state} />}
            {active === 'chronicle' && <Chronicle state={state} log={snap.log} />}
          </div>
        </main>
        <aside className="layout__aside">
          <Chronicle state={state} log={snap.log} />
        </aside>
      </div>

      <nav className="tabbar" aria-label="Huvudmeny">
        {tabs.map((t) => (
          <button key={t.id} className={`tab ${active === t.id ? 'tab--on' : ''} ${t.id === 'chronicle' ? 'tab--mobile-only' : ''}`} onClick={() => open(t.id)} aria-current={active === t.id ? 'page' : undefined}>
            <span className="tab__icon" aria-hidden><Icon name={t.icon} size={26} /></span>
            <span className="tab__label">{t.label}</span>
            {!seen.has(t.id) && <span className="tab__new" aria-label="ny" />}
          </button>
        ))}
      </nav>

      {toast && (
        <div className={`toast ${toast.color ? 'toast--quality' : ''}`} role="status" style={toast.color ? { ['--q' as string]: toast.color } : undefined}>
          {toast.color && <Icon name="star" size={18} />} {toast.text}
        </div>
      )}
      {snap.report && <AwayReportModal report={snap.report} state={state} onClose={() => store.dismissReport()} />}
      {menuOpen && <MenuModal state={state} storageOk={snap.storageOk} onClose={() => setMenuOpen(false)} />}
    </div>
  );
}
