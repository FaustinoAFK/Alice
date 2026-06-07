import { invoke } from '@tauri-apps/api/core';
import { useEffect, useReducer, useRef, useState } from 'react';
import { ALICE_LIVE_MODEL, createAliceLiveSetup } from './alice';
import {
  ALICE_MEMORY_ACTIVE_PROJECT_RECENCY_MS,
  ALICE_MEMORY_ACTIVE_TASK_RECENCY_MS,
  buildMemoryPrefixTurns,
  createAliceMemoryPersistenceSnapshot,
  createEmptyAliceMemory,
  extractImportantFacts,
  getActiveMindMap,
  mergeActiveMindMap,
  mergeImportantFacts,
  saveAliceMemory,
} from './aliceMemory';
import {
  createInitialAppUiState,
  readyCaption,
  reduceAppUiState,
  statusCopy,
} from './appUiState';
import { GeminiLiveSession, LIVE_CLOSE_REASONS } from './geminiLive';
import { LiveSessionOrchestrator } from './liveSessionOrchestrator';
import { buildSessionRehydrationTurns } from './liveSessionRehydration';
import { buildRecentSessionTurns } from './liveSessionRecentTurns';
import { createFunctionResponseEnvelope, LiveSessionTransport } from './liveSessionTransport';
import { buildOperationalContextTurns } from './operationalContext';
import { resolveScreenCaptureGeometry, SCREEN_SHARE_VIDEO_CONSTRAINTS } from './screenGeometry';
import { startScreenFrameStreaming } from './screenFrameStreaming';
import { buildDebugHudSnapshot } from './debugHud';
import {
  createEmptyKnowledgeState,
  mergeKnowledgeState,
} from './webKnowledge';
import { executeKnowledgeFunctionCall } from './knowledgeToolExecutor';
import { AliceHud } from './hud/AliceHud';
import { isTauriRuntime } from './tauriRuntime';
import {
  flushAliceMemoryToRuntime,
  loadAliceMemoryFromRuntime as loadAliceMemoryFromRuntimeBoundary,
} from './aliceMemoryPersistence';
import {
  appendTrustedUtterance,
  classifyToolDebugStatus,
  createDebugInteractionId,
  createPcmOutputPlayer,
  startMicrophoneStreaming,
  stopStream,
  summarizeDebugPayload,
} from './appLiveHelpers';
import './App.css';

const readyCheckPrompt =
  'Diga em uma frase curta, em portugues do Brasil, que voce esta ouvindo e recebendo a tela compartilhada. Nao descreva a tela ainda.';

const ALICE_MEMORY_SAVE_DELAY_MS = 750;
const MAX_DEBUG_INTERACTIONS = 80;

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const screenStreamRef = useRef(null);
  const voiceStreamRef = useRef(null);
  const liveSessionRef = useRef(null);
  const liveOrchestratorRef = useRef(null);
  const liveTransportRef = useRef(new LiveSessionTransport());
  const aliceMemoryRef = useRef(createEmptyAliceMemory());
  const memorySaveTimerRef = useRef(null);
  const memoryHydratedRef = useRef(false);
  const microphoneCleanupRef = useRef(null);
  const screenCleanupRef = useRef(null);
  const outputPlayerRef = useRef(createPcmOutputPlayer());
  const trustedUtteranceRef = useRef(null);
  const outputTranscriptRef = useRef('');
  const toolQueueRef = useRef(Promise.resolve());
  const knowledgeStateRef = useRef(createEmptyKnowledgeState());
  const tauriRuntimeAvailableRef = useRef(false);
  const persistenceDiagnosticsRef = useRef(
    createAliceMemoryPersistenceSnapshot(createEmptyAliceMemory()),
  );
  const debugInteractionsRef = useRef([]);
  const latestConversationInteractionIdRef = useRef('');

  const [uiState, dispatchUi] = useReducer(reduceAppUiState, undefined, createInitialAppUiState);
  const [activeHudPage, setActiveHudPage] = useState('live');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [knowledgeState, setKnowledgeState] = useState(createEmptyKnowledgeState);
  const [activeMindMap, setActiveMindMap] = useState(() => getActiveMindMap(createEmptyAliceMemory()));
  const [mindMapRevision, setMindMapRevision] = useState(0);
  const [debugInteractions, setDebugInteractions] = useState([]);
  const [persistenceDiagnostics, setPersistenceDiagnostics] = useState(
    () => createAliceMemoryPersistenceSnapshot(createEmptyAliceMemory()),
  );
  const { status, caption, inputCaption, error, diagnostics, sessionNotice } = uiState;

  useEffect(() => {
    knowledgeStateRef.current = knowledgeState;
  }, [knowledgeState]);

  const noteDiagnostic = (event) => {
    dispatchUi({ type: 'diagnostic-event', event });
  };

  const commitDebugInteractions = (updater) => {
    const nextInteractions = updater(debugInteractionsRef.current).slice(-MAX_DEBUG_INTERACTIONS);
    debugInteractionsRef.current = nextInteractions;
    setDebugInteractions(nextInteractions);
  };

  const canUseTauriRuntime = () => tauriRuntimeAvailableRef.current || isTauriRuntime();

  const recordUserInteraction = (userText) => {
    const normalizedText = String(userText || '').trim();
    if (!normalizedText) {
      return;
    }

    commitDebugInteractions((current) => {
      const latestId = latestConversationInteractionIdRef.current;
      const latest = current.find((interaction) => interaction.id === latestId);
      if (latest && latest.kind === 'conversation' && !latest.aliceText) {
        return current.map((interaction) =>
          interaction.id === latestId
            ? { ...interaction, userText: normalizedText, status: 'listening', timestamp: Date.now() }
            : interaction,
        );
      }

      const interaction = {
        id: createDebugInteractionId(),
        kind: 'conversation',
        timestamp: Date.now(),
        status: 'listening',
        userText: normalizedText,
        aliceText: '',
      };
      latestConversationInteractionIdRef.current = interaction.id;
      return [...current, interaction];
    });
  };

  const recordAliceInteraction = (aliceText) => {
    const normalizedText = String(aliceText || '').trim();
    if (!normalizedText) {
      return;
    }

    commitDebugInteractions((current) => {
      const latestId = latestConversationInteractionIdRef.current;
      const latest = current.find((interaction) => interaction.id === latestId);
      if (latest && latest.kind === 'conversation') {
        return current.map((interaction) =>
          interaction.id === latestId
            ? { ...interaction, aliceText: normalizedText, status: 'answered', timestamp: Date.now() }
            : interaction,
        );
      }

      const interaction = {
        id: createDebugInteractionId(),
        kind: 'conversation',
        timestamp: Date.now(),
        status: 'answered',
        userText: trustedUtteranceRef.current?.text || '',
        aliceText: normalizedText,
      };
      latestConversationInteractionIdRef.current = interaction.id;
      return [...current, interaction];
    });
  };

  const recordToolInteraction = (functionCall, patch = {}) => {
    const toolName = functionCall?.name || 'ferramenta_desconhecida';
    const args = functionCall?.args || {};
    const existingId = patch.id;

    commitDebugInteractions((current) => {
      if (existingId) {
        return current.map((interaction) =>
          interaction.id === existingId
            ? {
                ...interaction,
                ...patch,
                timestamp: Date.now(),
              }
            : interaction,
        );
      }

      const interaction = {
        id: createDebugInteractionId(),
        kind: 'tool',
        timestamp: Date.now(),
        status: 'running',
        toolName,
        operation: args.operation || args.taskKind || args.action || '',
        ok: null,
        userText: trustedUtteranceRef.current?.text || '',
        argsSummary: summarizeDebugPayload(args),
        responseSummary: '',
        message: '',
        reason: '',
      };
      return [...current, interaction];
    });

    return existingId || debugInteractionsRef.current.at(-1)?.id || '';
  };

  const clearAliceMemorySaveTimer = () => {
    if (memorySaveTimerRef.current) {
      window.clearTimeout(memorySaveTimerRef.current);
      memorySaveTimerRef.current = null;
    }
  };

  const updatePersistenceDiagnostics = (patch = {}) => {
    const nextDiagnostics = createAliceMemoryPersistenceSnapshot(aliceMemoryRef.current, {
      ...persistenceDiagnosticsRef.current,
      ...patch,
    });
    persistenceDiagnosticsRef.current = nextDiagnostics;
    setPersistenceDiagnostics(nextDiagnostics);
    return nextDiagnostics;
  };

  const flushAliceMemory = async () => {
    clearAliceMemorySaveTimer();
    aliceMemoryRef.current = await flushAliceMemoryToRuntime({
      memory: aliceMemoryRef.current,
      canUseTauriRuntime: canUseTauriRuntime(),
      memoryHydrated: memoryHydratedRef.current,
      saveMemory: saveAliceMemory,
      onSkipped: () => {
        updatePersistenceDiagnostics();
      },
      onSaved: () => {
        updatePersistenceDiagnostics({
          lastMemorySaveAt: new Date().toISOString(),
          lastMemorySaveError: '',
        });
      },
      onSaveError: (saveError) => {
        updatePersistenceDiagnostics({
          lastMemorySaveError: String(saveError?.message || saveError || 'Falha ao salvar memoria.'),
        });
      },
    });
    return aliceMemoryRef.current;
  };

  const scheduleAliceMemorySave = () => {
    if (!canUseTauriRuntime()) {
      return;
    }

    clearAliceMemorySaveTimer();
    memorySaveTimerRef.current = window.setTimeout(() => {
      void flushAliceMemory().catch(() => {
        // Memory persistence should not break the live session flow.
      });
    }, ALICE_MEMORY_SAVE_DELAY_MS);
  };

  const loadAliceMemoryFromRuntime = async () => {
    try {
      const memory = await loadAliceMemoryFromRuntimeBoundary({ invokeFn: invoke });
      tauriRuntimeAvailableRef.current = true;
      return memory;
    } catch (loadError) {
      tauriRuntimeAvailableRef.current = false;
      throw loadError;
    }
  };

  const rememberAliceContext = ({
    inputTranscript = trustedUtteranceRef.current?.text || '',
    outputTranscript = outputTranscriptRef.current,
  } = {}) => {
    const extractedFacts = extractImportantFacts({
      inputTranscript,
      outputTranscript,
      sessionModel: ALICE_LIVE_MODEL,
    });

    aliceMemoryRef.current = mergeImportantFacts(aliceMemoryRef.current, extractedFacts);
    scheduleAliceMemorySave();
    return aliceMemoryRef.current;
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
    setKnowledgeState(createEmptyKnowledgeState());
    knowledgeStateRef.current = createEmptyKnowledgeState();

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

  const updateKnowledgeState = (patch) => {
    const nextState = mergeKnowledgeState(knowledgeStateRef.current, patch);
    knowledgeStateRef.current = nextState;
    setKnowledgeState(nextState);
  };

  const handleMindMapChange = (mindMapData) => {
    aliceMemoryRef.current = mergeActiveMindMap(aliceMemoryRef.current, mindMapData);
    setActiveMindMap(getActiveMindMap(aliceMemoryRef.current));
    scheduleAliceMemorySave();
  };

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

  const getScreenCaptureGeometry = () => {
    const settings = screenStreamRef.current?.getVideoTracks()[0]?.getSettings?.() || {};
    return resolveScreenCaptureGeometry(settings, videoRef.current);
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

  const buildLiveMemoryPrefixTurns = ({ mode = 'fresh' } = {}) => {
    const currentMemory = aliceMemoryRef.current;
    const currentMindMap = getActiveMindMap(currentMemory);
    const operationalTurns = buildOperationalContextTurns({
      trustedUtterance: trustedUtteranceRef.current,
      outputTranscript: outputTranscriptRef.current,
      memorySummary: currentMemory.recentContextSummary?.summary || '',
      knowledgeState: knowledgeStateRef.current,
      activeMindMap: currentMindMap,
      screenGeometry: getScreenCaptureGeometry(),
    });
    const recentSessionTurns = buildRecentSessionTurns({
      interactions: debugInteractionsRef.current,
      trustedUtterance: trustedUtteranceRef.current,
      outputTranscript: outputTranscriptRef.current,
    });
    const persistentMemoryTurns = buildMemoryPrefixTurns(currentMemory, {
      supplementalOnly: mode !== 'fresh',
      includeRecentContext: mode === 'fresh',
      includeActiveProjects: mode === 'fresh',
      includeActiveTasks: mode === 'fresh',
      filterActiveItemsByRecency: true,
      activeProjectRecencyMs: ALICE_MEMORY_ACTIVE_PROJECT_RECENCY_MS,
      activeTaskRecencyMs: ALICE_MEMORY_ACTIVE_TASK_RECENCY_MS,
    });
    const rehydrationTurns = buildSessionRehydrationTurns({
      trustedUtterance: trustedUtteranceRef.current,
      outputTranscript: outputTranscriptRef.current,
      memorySummary: currentMemory.recentContextSummary?.summary || '',
      knowledgeState: knowledgeStateRef.current,
      activeMindMap: currentMindMap,
    });

    if (mode === 'resume') {
      return [
        ...operationalTurns,
        ...recentSessionTurns,
        ...persistentMemoryTurns,
        ...rehydrationTurns,
      ];
    }

    return [
      ...operationalTurns,
      ...recentSessionTurns,
      ...persistentMemoryTurns,
      ...rehydrationTurns,
    ];
  };

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
      getMemoryPrefixTurns: async ({ mode } = {}) => buildLiveMemoryPrefixTurns({ mode }),
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
      rememberAliceContext({ outputTranscript: event.outputTranscript });
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
    dispatchUi({ type: 'session-stopped' });
  };

  const startLiveSession = async () => {
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
    let disposed = false;

    void loadAliceMemoryFromRuntime().then((memory) => {
        if (!disposed) {
          aliceMemoryRef.current = memory;
          setActiveMindMap(getActiveMindMap(memory));
          setMindMapRevision((current) => current + 1);
          memoryHydratedRef.current = true;
          updatePersistenceDiagnostics();
          scheduleAliceMemorySave();
        }
      })
      .catch((loadError) => {
        memoryHydratedRef.current = true;
        // Browser-only previews cannot persist diagnostics, but this console line helps local debugging.
        console.info('[Alice] app_runtime_not_tauri', {
          message: loadError?.message || String(loadError),
        });
      });

    return () => {
      disposed = true;
      if (memorySaveTimerRef.current) {
        window.clearTimeout(memorySaveTimerRef.current);
        memorySaveTimerRef.current = null;
      }
      if (canUseTauriRuntime() && memoryHydratedRef.current) {
        void saveAliceMemory(aliceMemoryRef.current)
          .then((memory) => {
            aliceMemoryRef.current = memory;
          })
          .catch(() => {
            // Ignore persistence errors during unmount.
          });
      }
      void liveOrchestratorRef.current?.stopLiveSession();
      microphoneCleanupRef.current?.();
      screenCleanupRef.current?.();
      outputPlayerRef.current?.close();
      stopStream(screenStreamRef.current);
      stopStream(voiceStreamRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
