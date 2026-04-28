export function TopBar({ activeHudPage, isBusy, isLive, onToggleLiveSession, statusLabel }) {
  const title =
    activeHudPage === 'debug'
      ? 'Debug do runtime'
      : activeHudPage === 'knowledge'
        ? 'Conhecimento web'
        : 'Voz e tela ao vivo';

  return (
    <header className="app-topbar">
      <div>
        <p className="topbar-kicker">Painel vivo</p>
        <h1>{title}</h1>
      </div>

      <div className="topbar-actions" aria-label="Controles da Alice Live">
        <span className="status-pill">{statusLabel}</span>
        <button type="button" className="control-button" onClick={onToggleLiveSession} disabled={isBusy}>
          <span className={`button-icon ${isLive ? 'button-icon--stop' : 'button-icon--play'}`} aria-hidden="true" />
          {isLive ? 'Parar' : 'Iniciar'}
        </button>
      </div>
    </header>
  );
}
