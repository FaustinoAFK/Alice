import { invoke } from '@tauri-apps/api/core';
import { useEffect, useReducer, useRef, useState } from 'react';
import { createAliceLiveSetup } from './alice';
import {
  createInitialAppUiState,
  readyCaption,
  reduceAppUiState,
  statusCopy,
} from './appUiState';
import { GeminiLiveSession, LIVE_CLOSE_REASONS } from './geminiLive';
import { LiveSessionOrchestrator } from './liveSessionOrchestrator';
import { buildLiveMemoryPrefixTurns } from './liveMemoryPrefixTurns';
import { createFunctionResponseEnvelope, LiveSessionTransport } from './liveSessionTransport';
import { SCREEN_SHARE_VIDEO_CONSTRAINTS } from './screenGeometry';
import { startScreenFrameStreaming } from './screenFrameStreaming';
import { buildDebugHudSnapshot } from './debugHud';
import { createEmptyKnowledgeState } from './webKnowledge';
import { executeKnowledgeFunctionCall } from './tools/knowledge/knowledgeToolExecutor';
import { AliceHud } from './hud/AliceHud';
import { useAliceMemory } from './useAliceMemory';
import { useDebugInteractions } from './useDebugInteractions';
import { useKnowledgeState } from './useKnowledgeState';
import { useScreenCapture } from './useScreenCapture';
import {
  appendTrustedUtterance,
  classifyToolDebugStatus,
  createPcmOutputPlayer,
  startMicrophoneStreaming,
  stopStream,
  summarizeDebugPayload,
} from './appLiveHelpers';
import './App.css';

const readyCheckPrompt =
  'Diga em uma frase curta, em portugues do Brasil, que voce esta ouvindo e recebendo a tela compartilhada. Nao descreva a tela ainda.';

function App() {
  const voiceStreamRef = useRef(null);
  const liveSessionRef = useRef(null);
  const liveOrchestratorRef = useRef(null);
  const liveTransportRef = useRef(new LiveSessionTransport());
  const microphoneCleanupRef = useRef(null);
  const screenCleanupRef = useRef(null);
  const outputPlayerRef = useRef(createPcmOutputPlayer());
  const trustedUtteranceRef = useRef(null);
  const outputTranscriptRef = useRef('');
  const toolQueueRef = useRef(Promise.resolve());
  const startingRef = useRef(false);
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

  const { status, caption, inputCaption, error, diagnostics, sessionNotice } = uiState;

  const noteDiagnostic = (event) => {
    dispatchUi({ type: 'diagnostic-event', event });
  };

  const stopStreamingPipelines = () => {
    microphoneCleanupRef.current?.();
    screenCleanupRef.current?.();

    microphoneCleanupRef.current = null;
    screenCleanupRef.current = null;
  };

  const stopMediaStreams = () => {
    stopStream(screenStreamRef.current);
    stopStream(voiceStreamRef.current);

    screenStreamRef.current = null;
    voiceStreamRef.current = null;
  };

  const resetRuntimeRefs = () => {
    liveSessionRef.current = null;
    liveOrchestratorRef.current = null;
    liveTransportRef.current.clear();
    clearAliceMemorySaveTimer();
    trustedUtteranceRef.current = null;
    outputTranscriptRef.current = '';
    toolQueueRef.current = Promise.resolve();
  };

  const releaseLiveResources = () => {
    stopStreamingPipelines();
    stopMediaStreams();
    outputPlayerRef.current?.close();
    outputPlayerRef.current = createPcmOutputPlayer();
    updateKnowledgeState(createEmptyKnowledgeState());

    resetRuntimeRefs();

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const sendToolResponse = (functionCall, response, generation) =>
    liveTransportRef.current.sendToolResponse({
      generation,
      functionResponse: createFunctionResponseEnvelope(functionCall, response),
    });

  const rejectUnexpectedToolCall = async (functionCall, generation, debugInteractionId = '') => {
    noteDiagnostic({
      type: 'error',
      message: `Ferramenta inesperada recebida: ${functionCall?.name || 'desconhecida'}.`,
    });
    if (debugInteractionId) {
      recordToolInteraction(functionCall, {
        id: debugInteractionId,
        status: 'failed',
        ok: false,
        message: 'Ferramenta local desconhecida para a Alice.',
        reason: 'unexpected_tool_call',
      });
    }

    await sendToolResponse(
      functionCall,
      {
        ok: false,
        message: 'Ferramenta local desconhecida para a Alice.',
      },
      generation,
    );
  };

  const restartStreamingPipelines = (generation) => {
    stopStreamingPipelines();

    if (voiceStreamRef.current) {
      microphoneCleanupRef.current = startMicrophoneStreaming(voiceStreamRef.current, (chunk, level) => {
        const sent = liveTransportRef.current.sendRealtime({
          generation,
          send: (activeSession) => activeSession.sendAudio(chunk),
        });

        if (sent) {
          noteDiagnostic({ type: 'audio-sent', level });
        }
      });
    }

    if (videoRef.current && canvasRef.current) {
      screenCleanupRef.current = startScreenFrameStreaming(videoRef.current, canvasRef.current, (frame) => {
        const sent = liveTransportRef.current.sendRealtime({
          generation,
          send: (activeSession) => activeSession.sendVideo(frame.base64),
        });

        if (sent) {
          noteDiagnostic({
            type: 'video-sent',
            width: frame.width,
            height: frame.height,
            sourceWidth: frame.sourceWidth,
            sourceHeight: frame.sourceHeight,
          });
        }
      });
    }
  };

  const getLiveMemoryPrefixTurns = ({ mode = 'fresh' } = {}) =>
    buildLiveMemoryPrefixTurns({
      mode,
      memory: aliceMemoryRef.current,
      interactions: debugInteractionsRef.current,
      trustedUtterance: trustedUtteranceRef.current,
      outputTranscript: outputTranscriptRef.current,
      knowledgeState: knowledgeStateRef.current,
      screenGeometry: getScreenCaptureGeometry(),
    });

  const executeLocalToolCall = async (functionCall, generation) => {
    const debugInteractionId = recordToolInteraction(functionCall);
    try {
      const result = await executeKnowledgeFunctionCall({
        functionCall,
        trustedUtterance: trustedUtteranceRef.current?.text || '',
        knowledgeState: knowledgeStateRef.current,
        invokeTool: invoke,
      });

      if (result.handled) {
        updateKnowledgeState(result.statePatch);
        const debugStatus = classifyToolDebugStatus(result.response);
        recordToolInteraction(functionCall, {
          id: debugInteractionId,
          status: debugStatus.status,
          ok: debugStatus.ok,
          message: result.response?.message || '',
          reason: debugStatus.reason || result.response?.reason || '',
          responseSummary: summarizeDebugPayload(result.response),
        });

        await sendToolResponse(functionCall, result.response, generation);
        return;
      }

      await rejectUnexpectedToolCall(functionCall, generation, debugInteractionId);
    } catch (toolError) {
      const message = toolError?.message || String(toolError);
      noteDiagnostic({
        type: 'error',
        message,
      });
      recordToolInteraction(functionCall, {
        id: debugInteractionId,
        status: 'failed',
        ok: false,
        message,
        reason: 'tool_exception',
      });
      await sendToolResponse(
        functionCall,
        {
          ok: false,
          message,
        },
        generation,
      );
    }
  };

  const createLiveOrchestrator = (url) =>
    new LiveSessionOrchestrator({
      buildSetup: ({ resumptionHandle = '', memoryPrefixTurns = [] }) =>
        createAliceLiveSetup({ resumptionHandle, memoryPrefixTurns }),
      createSession: ({
        setup,
        onEvent,
        onStatus,
        onGoAway,
        onSessionResumptionUpdate,
        onCloseReason,
        onError,
      }) =>
        new GeminiLiveSession({
          url,
          setup,
          onEvent,
          onStatus,
          onGoAway,
          onSessionResumptionUpdate,
          onCloseReason,
          onError,
        }),
      getMemoryPrefixTurns: async ({ mode } = {}) => getLiveMemoryPrefixTurns({ mode }),
      onEvent: handleLiveEvent,
      onStatus: (nextStatus) => {
        if (nextStatus !== 'idle') {
          dispatchUi({ type: 'session-live-status', status: nextStatus });
        }

        if (nextStatus === 'error') {
          stopStreamingPipelines();
          liveSessionRef.current = null;
        }
      },
      onGoAway: (goAway) => {
        noteDiagnostic({ type: 'go-away', timeLeft: goAway?.timeLeft || '' });
      },
      onError: (sessionError) => {
        noteDiagnostic({
          type: 'error',
          message: sessionError.message || 'Nao foi possivel manter a sessao Live.',
        });
        dispatchUi({
          type: 'session-error',
          error: sessionError.message || 'Nao foi possivel manter a sessao Live.',
        });
      },
      onPrepareReconnect: async ({ mode }) => {
        liveTransportRef.current.beginReconnect({
          preserveActiveSession: mode === 'resume',
        });
        noteDiagnostic({ type: 'reconnecting' });
        dispatchUi({ type: 'session-reconnecting', mode });
      },
      onSessionReady: async ({ session, mode, generation, resumed, rehydrated }) => {
        liveTransportRef.current.activateSession({
          session,
          generation,
          replayPendingToolResponses: resumed,
          preserveAcceptedToolResponseGenerations: resumed,
        });
        liveSessionRef.current = session;
        restartStreamingPipelines(generation);
        noteDiagnostic({ type: 'connected' });
        if (resumed) {
          noteDiagnostic({ type: 'session-resumed' });
        } else if (rehydrated) {
          noteDiagnostic({ type: 'session-rehydrated' });
        }
        dispatchUi({
          type: 'session-ready',
          mode,
          resumed,
          rehydrated,
          caption: readyCaption,
        });

        if (mode === 'fresh' && liveTransportRef.current.canSendToLive(generation)) {
          session.sendText(readyCheckPrompt);
        }
      },
      onCloseReason: (reason, _event, session) => {
        liveTransportRef.current.deactivateSession(session);
        if (reason !== LIVE_CLOSE_REASONS.manualStop) {
          noteDiagnostic({ type: 'close-reason', reason });
        }
      },
      onSessionResumptionUpdate: () => {
        noteDiagnostic({ type: 'resumption-updated' });
      },
    });

  const enqueueToolCalls = (toolCalls, generation) => {
    toolQueueRef.current = toolCalls.reduce(
      (queue, functionCall) => queue.then(() => executeLocalToolCall(functionCall, generation)),
      toolQueueRef.current,
    );

    toolQueueRef.current = toolQueueRef.current.catch((toolError) => {
      noteDiagnostic({
        type: 'error',
        message: toolError.message || String(toolError),
      });
    });
  };

  const handleLiveEvent = (event, _message, _session, generation) => {
    noteDiagnostic({
      type: 'server-message',
      outputAudioChunksReceived: event.audioChunks.length,
    });

    if (event.interrupted) {
      outputPlayerRef.current.interrupt();
    }

    event.audioChunks.forEach((chunk) => {
      outputPlayerRef.current.play(chunk);
    });

    if (event.inputTranscript) {
      trustedUtteranceRef.current = appendTrustedUtterance(trustedUtteranceRef.current, event.inputTranscript);
      recordUserInteraction(trustedUtteranceRef.current.text);
      dispatchUi({ type: 'session-input-caption', inputCaption: trustedUtteranceRef.current.text });
    }

    if (event.outputTranscript) {
      outputTranscriptRef.current = event.outputTranscript;
      recordAliceInteraction(event.outputTranscript);
      dispatchUi({ type: 'session-caption', caption: event.outputTranscript });
      rememberAliceContext({ inputTranscript: trustedUtteranceRef.current?.text || '', outputTranscript: event.outputTranscript });
    }

    if (event.toolCallCancellation) {
      liveTransportRef.current.cancelPendingToolResponses(event.toolCallCancellation.ids || []);
      noteDiagnostic({
        type: 'error',
        message: 'A Gemini cancelou uma chamada de ferramenta pendente.',
      });
    }

    if (event.toolCalls.length > 0) {
      enqueueToolCalls(event.toolCalls, generation);
    }
  };

  const stopLiveSession = async () => {
    await liveOrchestratorRef.current?.stopLiveSession();
    await flushAliceMemory().catch(() => {
      // Ignore persistence errors during shutdown to keep stop responsive.
    });
    releaseLiveResources();
    if (!mountedRef.current) return;
    dispatchUi({ type: 'session-stopped' });
  };

  const startLiveSession = async () => {
    if (startingRef.current) return;
    startingRef.current = true;

    if (liveOrchestratorRef.current || screenStreamRef.current || voiceStreamRef.current) {
      await stopLiveSession();
    }

    dispatchUi({ type: 'session-starting' });
    noteDiagnostic({ type: 'connecting' });

    try {
      if (!canUseTauriRuntime()) {
        throw new Error('Abra pelo aplicativo desktop da Alice para usar a chave do ambiente.');
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: SCREEN_SHARE_VIDEO_CONSTRAINTS,
        audio: false,
      });
      const voiceStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      screenStreamRef.current = screenStream;
      voiceStreamRef.current = voiceStream;
      const screenTrack = screenStream.getVideoTracks()[0];
      const screenSettings = screenTrack?.getSettings?.() || {};
      noteDiagnostic({
        type: 'screen-started',
        label: screenTrack?.label || '',
        displaySurface: screenSettings.displaySurface || '',
      });
      noteDiagnostic({ type: 'microphone-started' });
      videoRef.current.srcObject = screenStream;
      await videoRef.current.play();

      screenStream.getVideoTracks()[0]?.addEventListener('ended', stopLiveSession, { once: true });

      const liveAccess = await invoke('create_gemini_live_url');
      const liveOrchestrator = createLiveOrchestrator(liveAccess.url);

      liveTransportRef.current.clear();
      liveOrchestratorRef.current = liveOrchestrator;
      await liveOrchestrator.startLiveSession();
    } catch (sessionError) {
      await liveOrchestratorRef.current?.stopLiveSession();
      releaseLiveResources();
      noteDiagnostic({ type: 'error' });
      dispatchUi({
        type: 'session-error',
        error: sessionError.message || 'Nao foi possivel iniciar a sessao Live.',
        caption: 'Nao consegui abrir a sessao ainda.',
      });
    } finally {
      startingRef.current = false;
    }
  };

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
