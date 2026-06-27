import { useEffect, useReducer, useRef, useState } from 'react';
import {
  createInitialAppUiState,
  reduceAppUiState,
  statusCopy,
} from './appUiState';
import { LiveSessionTransport } from './liveSessionTransport';
import { buildDebugHudSnapshot } from './debugHud';
import { AliceHud } from './hud/AliceHud';
import { useAliceMemory } from './useAliceMemory';
import { useDebugInteractions } from './useDebugInteractions';
import { useKnowledgeState } from './useKnowledgeState';
import { useScreenCapture } from './useScreenCapture';
import { useLiveSession } from './useLiveSession';
import { createPcmOutputPlayer, stopStream } from './appLiveHelpers';
import './App.css';

function App() {
  const voiceStreamRef = useRef(null);
  const liveSessionRef = useRef(null);
  const liveTransportRef = useRef(new LiveSessionTransport());
  const microphoneCleanupRef = useRef(null);
  const outputPlayerRef = useRef(createPcmOutputPlayer());
  const trustedUtteranceRef = useRef(null);
  const outputTranscriptRef = useRef('');
  const mountedRef = useRef(true);

  const {
    aliceMemoryRef,
    activeMindMap,
    mindMapRevision,
    persistenceDiagnostics,
    canUseTauriRuntime,
    clearAliceMemorySaveTimer,
    flushAliceMemory,
    rememberAliceContext,
    handleMindMapChange,
  } = useAliceMemory();

  const [uiState, dispatchUi] = useReducer(reduceAppUiState, undefined, createInitialAppUiState);
  const [activeHudPage, setActiveHudPage] = useState('live');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { knowledgeState, knowledgeStateRef, updateKnowledgeState } = useKnowledgeState();

  const {
    debugInteractions,
    debugInteractionsRef,
    recordUserInteraction,
    recordAliceInteraction,
    recordToolInteraction,
  } = useDebugInteractions({ trustedUtteranceRef });

  const { videoRef, canvasRef, screenStreamRef, getScreenCaptureGeometry } = useScreenCapture();

  const { liveOrchestratorRef, screenCleanupRef, startLiveSession, stopLiveSession } = useLiveSession({
    liveSessionRef,
    liveTransportRef,
    microphoneCleanupRef,
    outputPlayerRef,
    voiceStreamRef,
    trustedUtteranceRef,
    outputTranscriptRef,
    mountedRef,
    aliceMemoryRef,
    clearAliceMemorySaveTimer,
    flushAliceMemory,
    rememberAliceContext,
    canUseTauriRuntime,
    debugInteractionsRef,
    recordUserInteraction,
    recordAliceInteraction,
    recordToolInteraction,
    knowledgeStateRef,
    updateKnowledgeState,
    screenStreamRef,
    videoRef,
    canvasRef,
    getScreenCaptureGeometry,
    dispatchUi,
  });

  const { status, caption, inputCaption, error, diagnostics, sessionNotice } = uiState;

  const toggleLiveSession = () => {
    if (status === 'connected' || status === 'configuring' || status === 'starting' || status === 'reconnecting') {
      void stopLiveSession();
      return;
    }

    void startLiveSession();
  };

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      void liveOrchestratorRef.current?.stopLiveSession();
      microphoneCleanupRef.current?.();
      screenCleanupRef.current?.();
      outputPlayerRef.current?.close();
      stopStream(screenStreamRef.current);
      stopStream(voiceStreamRef.current);
    };
  }, []);

  const isBusy = status === 'starting' || status === 'configuring';
  const isLive = status === 'connected' || status === 'configuring' || status === 'starting' || status === 'reconnecting';
  // Diagnostic-only snapshot: these refs mirror runtime state that should not drive normal rendering.
  /* eslint-disable react-hooks/refs */
  const debugHud = buildDebugHudSnapshot({
    status,
    caption,
    inputCaption,
    diagnostics,
    trustedUtterance: trustedUtteranceRef.current,
    outputTranscript: outputTranscriptRef.current,
    screenGeometry: getScreenCaptureGeometry(),
    memorySummary: aliceMemoryRef.current.recentContextSummary?.summary || '',
    knowledgeState,
    persistenceDiagnostics,
    interactions: debugInteractions,
  });
  /* eslint-enable react-hooks/refs */

  return (
    <main className={`app-shell app-shell--${status}`}>
      <video ref={videoRef} className="screen-preview" muted playsInline />
      <canvas ref={canvasRef} className="capture-canvas" aria-hidden="true" />

      <AliceHud
        activeHudPage={activeHudPage}
        activeMindMap={activeMindMap}
        caption={caption}
        debugHud={debugHud}
        diagnostics={diagnostics}
        error={error}
        inputCaption={inputCaption}
        isBusy={isBusy}
        isLive={isLive}
        mindMapRevision={mindMapRevision}
        onNavigate={setActiveHudPage}
        onMindMapChange={handleMindMapChange}
        onToggleLiveSession={toggleLiveSession}
        onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
        sessionNotice={sessionNotice}
        sidebarCollapsed={sidebarCollapsed}
        status={status}
        statusLabel={statusCopy[status]}
      />
    </main>
  );
}

export default App;
