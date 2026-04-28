import { lazy, Suspense } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { AutonomyHudPage } from './pages/AutonomyHudPage';
import { DebugHudPage } from './pages/DebugHudPage';
import { KnowledgeHudPage } from './pages/KnowledgeHudPage';
import { LiveHudPage } from './pages/LiveHudPage';
import { buildLiveActivity } from './hudViewModel';

const MindMapHudPage = lazy(() => import('./pages/MindMapHudPage'));

export function AliceHud({
  activeHudPage,
  activeMindMap,
  autonomousLearningState,
  caption,
  debugHud,
  diagnostics,
  error,
  inputCaption,
  isBusy,
  isLive,
  mindMapRevision,
  onMindMapChange,
  onApproveProposal,
  onNavigate,
  onRejectProposal,
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
        activeHudPage={activeHudPage}
        isLive={isLive}
        onNavigate={onNavigate}
        onToggleSidebar={onToggleSidebar}
        sidebarCollapsed={sidebarCollapsed}
        statusLabel={statusLabel}
      />

      <section className="hud-main">
        <TopBar
          activeHudPage={activeHudPage}
          isBusy={isBusy}
          isLive={isLive}
          onToggleLiveSession={onToggleLiveSession}
          statusLabel={statusLabel}
        />

        {activeHudPage === 'live' ? (
          <LiveHudPage
            caption={caption}
            diagnostics={diagnostics}
            error={error}
            inputCaption={inputCaption}
            liveActivity={liveActivity}
            sessionNotice={sessionNotice}
            statusLabel={statusLabel}
          />
        ) : null}

        {activeHudPage === 'knowledge' ? <KnowledgeHudPage debugHud={debugHud} /> : null}

        {activeHudPage === 'mind-map' ? (
          <Suspense fallback={<section className="hud-page hud-page-loading">Carregando mapa mental...</section>}>
            <MindMapHudPage
              activeMindMap={activeMindMap}
              mindMapRevision={mindMapRevision}
              onMindMapChange={onMindMapChange}
            />
          </Suspense>
        ) : null}

        {activeHudPage === 'autonomy' ? (
          <AutonomyHudPage
            autonomousLearningState={autonomousLearningState}
            debugHud={debugHud}
            onApproveProposal={onApproveProposal}
            onRejectProposal={onRejectProposal}
          />
        ) : null}

        {activeHudPage === 'debug' ? <DebugHudPage debugHud={debugHud} /> : null}
      </section>
    </div>
  );
}
