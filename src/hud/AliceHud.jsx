import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { LiveHudPage } from './pages/LiveHudPage';
import { buildLiveActivity } from './hudViewModel';

export function AliceHud({
  caption,
  diagnostics,
  error,
  inputCaption,
  isBusy,
  isLive,
  onNavigate,
  onToggleLiveSession,
  onToggleSidebar,
  sessionNotice,
  sidebarCollapsed,
  status,
  statusLabel,
}) {
  const liveActivity = buildLiveActivity({ status, error, diagnostics });

  return (
    <div className={`hud-layout ${sidebarCollapsed ? 'hud-layout--collapsed' : ''}`}>
      <Sidebar
        activeHudPage="live"
        isLive={isLive}
        onNavigate={onNavigate}
        onToggleSidebar={onToggleSidebar}
        sidebarCollapsed={sidebarCollapsed}
        statusLabel={statusLabel}
      />

      <section className="hud-main">
        <TopBar
          activeHudPage="live"
          isBusy={isBusy}
          isLive={isLive}
          onToggleLiveSession={onToggleLiveSession}
          statusLabel={statusLabel}
        />

        <LiveHudPage
          caption={caption}
          diagnostics={diagnostics}
          error={error}
          inputCaption={inputCaption}
          liveActivity={liveActivity}
          sessionNotice={sessionNotice}
          statusLabel={statusLabel}
        />
      </section>
    </div>
  );
}
