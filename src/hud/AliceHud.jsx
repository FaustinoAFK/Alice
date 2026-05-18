import { lazy, Suspense } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { LiveHudPage } from './pages/LiveHudPage';
import { buildLiveActivity } from './hudViewModel';

const KnowledgeHudPage = lazy(() => import('./pages/KnowledgeHudPage'));
const MindMapHudPage = lazy(() => import('./pages/MindMapHudPage'));
const AutonomyHudPage = lazy(() => import('./pages/AutonomyHudPage'));
const AutonomousLearningHudPage = lazy(() => import('./pages/AutonomousLearningHudPage'));
const AutonomousRunnerHudPage = lazy(() => import('./pages/AutonomousRunnerHudPage'));
const DebugHudPage = lazy(() => import('./pages/DebugHudPage'));

const renderLazyHudPage = (page, fallbackText) => (
  <Suspense fallback={<section className="hud-page hud-page-loading">{fallbackText}</section>}>
    {page}
  </Suspense>
);

export function AliceHud({
  activeHudPage,
  activeMindMap,
  autonomousLearningState,
  autonomousRunnerState,
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
  onAutonomousLearningAction,
  onNavigate,
  onRejectProposal,
  onRunnerAction,
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

        {activeHudPage === 'knowledge'
          ? renderLazyHudPage(
              <KnowledgeHudPage debugHud={debugHud} />,
              'Carregando conhecimento...',
            )
          : null}

        {activeHudPage === 'mind-map' ? (
          renderLazyHudPage(
            <MindMapHudPage
              activeMindMap={activeMindMap}
              mindMapRevision={mindMapRevision}
              onMindMapChange={onMindMapChange}
            />,
            'Carregando mapa mental...',
          )
        ) : null}

        {activeHudPage === 'autonomy' ? (
          renderLazyHudPage(
            <AutonomyHudPage
              autonomousLearningState={autonomousLearningState}
              debugHud={debugHud}
              onApproveProposal={onApproveProposal}
              onRejectProposal={onRejectProposal}
            />,
            'Carregando autonomia...',
          )
        ) : null}

        {activeHudPage === 'learning' ? (
          renderLazyHudPage(
            <AutonomousLearningHudPage
              debugHud={debugHud}
              onAutonomousLearningAction={onAutonomousLearningAction}
            />,
            'Carregando aprendizado autonomo...',
          )
        ) : null}

        {activeHudPage === 'runner' ? (
          renderLazyHudPage(
            <AutonomousRunnerHudPage
              debugHud={debugHud}
              onRunnerAction={onRunnerAction}
              runnerState={autonomousRunnerState}
            />,
            'Carregando runner autonomo...',
          )
        ) : null}

        {activeHudPage === 'debug'
          ? renderLazyHudPage(
              <DebugHudPage debugHud={debugHud} />,
              'Carregando debug...',
            )
          : null}
      </section>
    </div>
  );
}
