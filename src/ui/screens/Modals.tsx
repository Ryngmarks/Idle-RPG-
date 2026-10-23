import { useState, type ReactNode } from 'react';
import type { AwayReport } from '../../app/store';
import { RESOURCES, type GameState } from '../../core';
import { fmtAmount, fmtClock, fmtDuration, fmtInt } from '../format';
import { useStore } from '../game';
import { RESOURCE_LABEL, eventText } from '../labels';

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="modal__box panel" onClick={(e) => e.stopPropagation()}>
        <header className="panel__head">
          <h2 className="panel__title">{title}</h2>
          <button className="btn btn--small" onClick={onClose} aria-label="Stäng">✕</button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function AwayReportModal({ report, state, onClose }: { report: AwayReport; state: GameState; onClose: () => void }) {
  const gained = RESOURCES.filter((r) => report.resources[r] >= 1);
  const levelUps = report.events.filter((e) => e.type === 'troopLevelUp').length;
  const notable = report.events.filter((e) => e.type !== 'troopLevelUp').map((e) => eventText(e, state)).filter(Boolean);
  return (
    <Modal title="Medan du var borta" onClose={onClose}>
      <p>
        Du var borta i <strong>{fmtDuration(report.awaySec)}</strong>.
        {report.capped && <> Dina trupper arbetade de första <strong>{fmtDuration(report.simulatedSec)}</strong> (maxgränsen).</>}
      </p>
      {gained.length > 0 ? (
        <ul className="report-list">
          {gained.map((r) => (
            <li key={r}>{RESOURCE_LABEL[r].icon} +{fmtAmount(report.resources[r])} {RESOURCE_LABEL[r].name.toLowerCase()}</li>
          ))}
          {report.kills >= 1 && <li>⚔️ {fmtInt(Math.floor(report.kills))} fiender besegrade</li>}
          {levelUps > 0 && <li>⭐ {levelUps} nivåhöjningar</li>}
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

  return (
    <Modal title="Meny" onClose={onClose}>
      <section className="menu-section">
        <h3>Sparning</h3>
        <p className="small muted">
          {storageOk
            ? 'Spelet sparas automatiskt i den här webbläsaren var tionde sekund och när du stänger appen.'
            : '⚠️ Webbläsaren tillåter inte sparning (t.ex. privat läge). Använd export för att inte förlora framsteg.'}
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
