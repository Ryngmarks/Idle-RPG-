import { useEffect, useState, type ReactNode } from 'react';
import type { AwayReport } from '../../app/store';
import { RESOURCES, type GameState } from '../../core';
import { Icon } from '../art/icons';
import { ResIcon } from '../art/resources';
import { fmtAmount, fmtClock, fmtDuration, fmtInt } from '../format';
import { useStore } from '../game';
import { buildLabel, checkForUpdate, reloadToLatest, type UpdateStatus } from '../update';
import { RESOURCE_LABEL, eventText } from '../labels';

type InstallPrompt = Event & { prompt: () => Promise<void> };
let deferredInstall: InstallPrompt | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e as InstallPrompt; });
  window.addEventListener('appinstalled', () => { deferredInstall = null; });
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="modal__box panel" onClick={(e) => e.stopPropagation()}>
        <header className="panel__head">
          <h2 className="panel__title">{title}</h2>
          <button className="btn btn--small" onClick={onClose} aria-label="Stäng"><Icon name="close" size={16} /></button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function AwayReportModal({ report, state, onClose }: { report: AwayReport; state: GameState; onClose: () => void }) {
  const gained = RESOURCES.filter((r) => report.resources[r] >= 1);
  const levelUps = report.events.filter((e) => e.type === 'troopLevelUp').length;
  const crafted = report.events.filter((e) => e.type === 'weaponCrafted').length;
  const notable = report.events.filter((e) => e.type !== 'troopLevelUp').map((e) => eventText(e, state)).filter(Boolean);
  return (
    <Modal title="Medan du var borta" onClose={onClose}>
      <p>
        Du var borta i <strong>{fmtDuration(report.awaySec)}</strong>.
        {report.capped && <> Dina trupper arbetade de första <strong>{fmtDuration(report.simulatedSec)}</strong> (maxgränsen).</>}
      </p>
      {report.hungrySec > 0 && (
        <p className="small warn">🌾 Maten räckte inte i {fmtDuration(report.hungrySec)}. Trupperna arbetade långsammare, men ingen svalt.</p>
      )}
      {gained.length > 0 || crafted > 0 ? (
        <ul className="report-list">
          {gained.map((r) => (
            <li key={r}><ResIcon id={r} size={20} /> +{fmtAmount(report.resources[r])} {RESOURCE_LABEL[r].name.toLowerCase()}</li>
          ))}
          {report.kills >= 1 && <li><Icon name="swords" size={20} /> {fmtInt(Math.floor(report.kills))} fiender besegrade</li>}
          {levelUps > 0 && <li><Icon name="star" size={20} /> {levelUps} nivåhöjningar</li>}
          {crafted > 0 && <li><Icon name="anvil" size={20} /> {crafted} vapen smidda</li>}
        </ul>
      ) : (
        <p className="muted">Dina trupper hade inga order, så inget samlades in.</p>
      )}
      {notable.length > 0 && (
        <ul className="report-list report-list--events">
          {notable.slice(0, 8).map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      )}
      <button className="btn btn--primary btn--block" onClick={onClose}>Fortsätt</button>
    </Modal>
  );
}

export function MenuModal({ state, storageOk, onClose }: { state: GameState; storageOk: boolean; onClose: () => void }) {
  const store = useStore();
  const [exported, setExported] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [update, setUpdate] = useState<UpdateStatus | 'checking' | null>(null);
  const [canInstall, setCanInstall] = useState(deferredInstall !== null);
  useEffect(() => {
    const on = () => setCanInstall(deferredInstall !== null);
    window.addEventListener('beforeinstallprompt', on);
    window.addEventListener('appinstalled', on);
    return () => { window.removeEventListener('beforeinstallprompt', on); window.removeEventListener('appinstalled', on); };
  }, []);

  return (
    <Modal title="Meny" onClose={onClose}>
      <section className="menu-section">
        <h3>Sparning</h3>
        <p className="small muted">
          {storageOk
            ? 'Spelet sparas automatiskt i den här webbläsaren var tionde sekund och när du stänger appen.'
            : <><Icon name="warning" size={15} /> Webbläsaren tillåter inte sparning (t.ex. privat läge). Använd export för att inte förlora framsteg.</>}
        </p>
        <p className="small muted">Speltid: {fmtClock(state.clock)}</p>
        <div className="row">
          <button className="btn" onClick={() => { store.save(); setMessage('Sparat.'); }}>Spara nu</button>
          <button className="btn" onClick={() => setExported(store.exportString())}>Exportera</button>
        </div>
        {exported && (
          <>
            <textarea className="textarea" readOnly value={exported} rows={3} onFocus={(e) => e.currentTarget.select()} />
            <button
              className="btn btn--small"
              onClick={() => {
                navigator.clipboard?.writeText(exported).then(
                  () => setMessage('Kopierat till urklipp.'),
                  () => setMessage('Markera texten och kopiera manuellt.'),
                );
              }}
            >
              Kopiera
            </button>
          </>
        )}
        <textarea className="textarea" placeholder="Klistra in en exporterad sparfil…" value={importText} rows={2} onChange={(e) => setImportText(e.target.value)} />
        <button
          className="btn"
          disabled={!importText.trim()}
          onClick={() => {
            const err = store.importString(importText);
            setMessage(err ?? 'Sparfilen är inläst.');
            if (!err) setImportText('');
          }}
        >
          Importera
        </button>
      </section>

      <section className="menu-section">
        <h3>Version</h3>
        <p className="small muted">Byggd {buildLabel()}</p>
        {update === 'new' && <p className="small warn">✨ En ny version finns. Spelet sparas innan det uppdateras.</p>}
        {update === 'same' && <p className="small muted">Du har den senaste versionen.</p>}
        {update === 'unknown' && <p className="small muted">Kunde inte kolla just nu. Du kan ändå ladda om.</p>}
        <div className="row">
          <button className="btn" disabled={update === 'checking'} onClick={() => { setUpdate('checking'); void checkForUpdate().then(setUpdate); }}>
            {update === 'checking' ? 'Söker…' : 'Sök efter uppdatering'}
          </button>
          <button className={`btn ${update === 'new' ? 'btn--primary' : ''}`} onClick={() => { store.save(); reloadToLatest(); }}>
            {update === 'new' ? 'Uppdatera nu' : 'Ladda om'}
          </button>
        </div>
      </section>

      <section className="menu-section">
        <h3>Installera</h3>
        <p className="small muted">Välj Dela → Lägg till på hemskärmen (iPhone) eller menyn → Installera app (Android).</p>
        {canInstall && (
          <button className="btn btn--primary" onClick={() => { const d = deferredInstall; deferredInstall = null; setCanInstall(false); void d?.prompt(); }}>Installera</button>
        )}
      </section>

      <section className="menu-section">
        <h3>Testverktyg</h3>
        <p className="small muted">Spola fram tiden med exakt samma regler som när du väntar.</p>
        <div className="row">
          <button className="btn" onClick={() => store.fastForward(60)}>+1 min</button>
          <button className="btn" onClick={() => store.fastForward(600)}>+10 min</button>
        </div>
      </section>

      <section className="menu-section">
        <h3>Nytt spel</h3>
        {confirmReset ? (
          <>
            <p className="small">Allt framsteg i det här spelet raderas. Exportera först om du vill spara det.</p>
            <div className="row">
              <button className="btn btn--danger" onClick={() => { store.reset(); onClose(); }}>Ja, radera och börja om</button>
              <button className="btn" onClick={() => setConfirmReset(false)}>Avbryt</button>
            </div>
          </>
        ) : (
          <button className="btn btn--danger" onClick={() => setConfirmReset(true)}>Börja om</button>
        )}
      </section>
      {message && <p className="small" role="status">{message}</p>}
    </Modal>
  );
}
