import { buildSignalGroups } from '../hudViewModel';

export function LiveHudPage({
  caption,
  diagnostics,
  error,
  inputCaption,
  liveActivity,
  sessionNotice,
  statusLabel,
}) {
  const signalGroups = buildSignalGroups(diagnostics);

  return (
    <section className="live-workspace" aria-label="Alice Live">
      <div className="live-panel">
        <div className={`live-activity live-activity--${liveActivity.tone}`}>
          <div className="activity-orbit" aria-hidden="true">
            <span />
          </div>
          <div>
            <span>{liveActivity.label}</span>
            <strong>{statusLabel}</strong>
          </div>
        </div>
        <h2>Alice Live</h2>
        <p>{caption}</p>
        <small className="activity-detail">{liveActivity.detail}</small>
        {sessionNotice ? <small className="session-note">{sessionNotice}</small> : null}
        {inputCaption ? <small className="input-note">Voce: {inputCaption}</small> : null}
        {error ? <small className="error-text">{error}</small> : null}
      </div>

      <section className="signal-panel" aria-label="Sinais da Alice Live">
        {signalGroups.map((group) => (
          <article key={group.title} className="metric-group">
            <div className="section-header">
              <span>{group.subtitle}</span>
              <strong>{group.title}</strong>
            </div>
            <div className="metric-list">
              {group.items.map(([label, value]) => (
                <div key={label} className="metric-row">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </article>
        ))}
        <article className="metric-group metric-group--wide">
          <div className="section-header">
            <span>entrada de voz</span>
            <strong>Nivel do microfone</strong>
          </div>
          <span className="mic-meter" aria-label="Nivel do microfone">
            <i style={{ transform: `scaleX(${Math.min(1, diagnostics.microphoneLevel * 8)})` }} />
          </span>
        </article>
      </section>
    </section>
  );
}
