import { useEffect, useMemo, useRef, useState } from 'react';
import { content } from '../content';
import { computeRates, RESOURCES, type GameEvent, type GameState, type Rates } from '../core';
import { fmtAmount, fmtRate } from './format';
import { useSnapshot, useStore } from './game';
import { RESOURCE_LABEL, eventText } from './labels';
import { Battle } from './screens/Battle';
import { Chronicle } from './screens/Chronicle';
import { Forces } from './screens/Forces';
import { AwayReportModal, MenuModal } from './screens/Modals';
import { RaceSelect } from './screens/RaceSelect';
import { Settlement } from './screens/Settlement';
import { Upgrades } from './screens/Upgrades';

type Tab = 'forces' | 'battle' | 'settlement' | 'upgrades' | 'chronicle';

const TABS: { id: Tab; label: string; icon: string; unlock?: string }[] = [
  { id: 'forces', label: 'Styrkor', icon: '🛡️' },
  { id: 'battle', label: 'Strid', icon: '⚔️', unlock: 'tab:battle' },
  { id: 'settlement', label: 'Bosättning', icon: '🏰', unlock: 'tab:settlement' },
  { id: 'upgrades', label: 'Förbättra', icon: '📜', unlock: 'tab:upgrades' },
  { id: 'chronicle', label: 'Krönika', icon: '📖' },
];

function ResourceBar({ state, rates }: { state: GameState; rates: Rates }) {
  const shown = RESOURCES.filter(
    (r) => r === 'wood' || state.resources[r] > 0 || state.stats.gathered[r] > 0 || rates.resources[r] > 0,
  );
  return (
    <div className="resources" aria-label="Resurser">
      {shown.map((r) => (
        <div key={r} className="resource">
          <span className="resource__icon" aria-hidden>{RESOURCE_LABEL[r].icon}</span>
          <span className="resource__amount">{fmtAmount(state.resources[r])}</span>
          <span className="resource__rate">{rates.resources[r] > 0 ? `+${fmtRate(rates.resources[r])}/s` : ''}</span>
          <span className="sr-only">{RESOURCE_LABEL[r].name}</span>
        </div>
      ))}
    </div>
  );
}

const TOAST_TYPES = new Set<GameEvent['type']>(['objectiveCompleted', 'troopFormed', 'constructionCompleted', 'stageCleared', 'zoneCleared', 'bossDefeated', 'bossFailed']);

function useToast(log: GameEvent[], state: GameState | null): string | null {
  const [toast, setToast] = useState<string | null>(null);
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
    if (!important) return;
    setToast(eventText(important, state));
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
        <div className="topbar__title">
          <span className="eyebrow">{race?.name}</span>
          <h1 className="title title--small">Utposten</h1>
        </div>
        <button className="btn btn--small" onClick={() => setMenuOpen(true)} aria-label="Meny">☰ Meny</button>
      </header>
      <ResourceBar state={state} rates={rates} />
      {!snap.storageOk && <p className="warning">⚠️ Sparning är inte tillgänglig i den här webbläsaren. Se Meny → Exportera.</p>}

      <div className="layout">
        <main className="layout__main">
          {active === 'forces' && <Forces state={state} rates={rates} />}
          {active === 'battle' && <Battle state={state} rates={rates} />}
          {active === 'settlement' && <Settlement state={state} rates={rates} />}
          {active === 'upgrades' && <Upgrades state={state} />}
          {active === 'chronicle' && <Chronicle state={state} log={snap.log} />}
        </main>
        <aside className="layout__aside">
          <Chronicle state={state} log={snap.log} />
        </aside>
      </div>

      <nav className="tabbar" aria-label="Huvudmeny">
        {tabs.map((t) => (
          <button key={t.id} className={`tab ${active === t.id ? 'tab--on' : ''} ${t.id === 'chronicle' ? 'tab--mobile-only' : ''}`} onClick={() => open(t.id)} aria-current={active === t.id ? 'page' : undefined}>
            <span className="tab__icon" aria-hidden>{t.icon}</span>
            <span className="tab__label">{t.label}</span>
            {!seen.has(t.id) && <span className="tab__new" aria-label="ny" />}
          </button>
        ))}
      </nav>

      {toast && <div className="toast" role="status">{toast}</div>}
      {snap.report && <AwayReportModal report={snap.report} state={state} onClose={() => store.dismissReport()} />}
      {menuOpen && <MenuModal state={state} storageOk={snap.storageOk} onClose={() => setMenuOpen(false)} />}
    </div>
  );
}
