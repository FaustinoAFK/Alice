import { invoke } from '@tauri-apps/api/core';
import { useEffect, useReducer, useRef, useState } from 'react';
import { ALICE_LIVE_MODEL, createAliceLiveSetup } from './alice';
import {
  buildMemoryPrefixTurns,
  createEmptyAliceMemory,
  extractImportantFacts,
  loadAliceMemory,
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
import { calculateRms, decodePcm16Base64, encodePcm16Base64 } from './liveAudio';
import { LiveSessionOrchestrator } from './liveSessionOrchestrator';
import { buildSessionRehydrationTurns } from './liveSessionRehydration';
import { createFunctionResponseEnvelope, LiveSessionTransport } from './liveSessionTransport';
import { resolveScreenCaptureGeometry, SCREEN_SHARE_VIDEO_CONSTRAINTS } from './screenGeometry';
import { buildDebugHudSnapshot } from './debugHud';
import {
  createEmptyKnowledgeState,
  mergeKnowledgeState,
} from './webKnowledge';
import { executeKnowledgeTool } from './knowledgePipeline';
import './App.css';

const stopStream = (stream) => {
  stream?.getTracks().forEach((track) => track.stop());
};

const createPcmOutputPlayer = () => {
  let audioContext = null;
  let playheadTime = 0;
  let sources = [];

  const ensureContext = async () => {
    if (!audioContext) {
      audioContext = new AudioContext({ latencyHint: 'interactive', sampleRate: 24000 });
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    return audioContext;
  };

  return {
    async play(base64Audio) {
      const context = await ensureContext();
      const samples = decodePcm16Base64(base64Audio);
      const buffer = context.createBuffer(1, samples.length, 24000);
      buffer.copyToChannel(samples, 0);

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);

      const startAt = Math.max(context.currentTime + 0.02, playheadTime);
      source.start(startAt);
      playheadTime = startAt + buffer.duration;
      sources.push(source);
      source.onended = () => {
        sources = sources.filter((item) => item !== source);
      };
    },
    interrupt() {
      sources.forEach((source) => {
        try {
          source.stop();
        } catch {
          // The source may have already ended.
        }
      });
      sources = [];
      playheadTime = audioContext?.currentTime || 0;
    },
    close() {
      this.interrupt();
      audioContext?.close();
      audioContext = null;
    },
  };
};

const readyCheckPrompt =
  'Diga em uma frase curta, em portugues do Brasil, que voce esta ouvindo e vendo a tela compartilhada.';

const ALICE_MEMORY_SAVE_DELAY_MS = 750;
const TRUSTED_UTTERANCE_WINDOW_MS = 10000;

const appendTrustedUtterance = (currentUtterance, text) => {
  const normalizedText = String(text || '').trim();
  if (!normalizedText) {
    return currentUtterance;
  }

  const now = Date.now();
  const previousText =
    currentUtterance && now - Number(currentUtterance.timestamp || 0) <= TRUSTED_UTTERANCE_WINDOW_MS
      ? String(currentUtterance.text || '').trim()
      : '';

  return {
    text: previousText ? `${previousText} ${normalizedText}` : normalizedText,
    timestamp: now,
  };
};

const startMicrophoneStreaming = (voiceStream, onChunk) => {
  const audioTracks = voiceStream.getAudioTracks();

  if (audioTracks.length === 0) {
    return () => {};
  }

  const audioContext = new AudioContext({ latencyHint: 'interactive' });
  const source = audioContext.createMediaStreamSource(new MediaStream(audioTracks));
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const mutedOutput = audioContext.createGain();

  mutedOutput.gain.value = 0;
  processor.onaudioprocess = (event) => {
    const channel = event.inputBuffer.getChannelData(0);
    onChunk(encodePcm16Base64(channel, audioContext.sampleRate), calculateRms(channel));
  };

  source.connect(processor);
  processor.connect(mutedOutput);
  mutedOutput.connect(audioContext.destination);

  return () => {
    processor.disconnect();
    source.disconnect();
    mutedOutput.disconnect();
    audioContext.close();
  };
};

const startScreenFrameStreaming = (video, canvas, onFrame) => {
  const context = canvas.getContext('2d', { alpha: false });

  const sendFrame = () => {
    if (!video.videoWidth || !video.videoHeight) {
      return;
    }

    const width = 640;
    const height = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * width));
    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0, width, height);

    const [, base64Frame] = canvas.toDataURL('image/jpeg', 0.68).split(',');
    if (base64Frame) {
      onFrame(base64Frame);
    }
  };

  const intervalId = window.setInterval(sendFrame, 1000);
  sendFrame();

  return () => window.clearInterval(intervalId);
};

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
  const microphoneCleanupRef = useRef(null);
  const screenCleanupRef = useRef(null);
  const outputPlayerRef = useRef(createPcmOutputPlayer());
  const trustedUtteranceRef = useRef(null);
  const outputTranscriptRef = useRef('');
  const toolQueueRef = useRef(Promise.resolve());
  const knowledgeStateRef = useRef(createEmptyKnowledgeState());

  const [uiState, dispatchUi] = useReducer(reduceAppUiState, undefined, createInitialAppUiState);
  const [debugHudOpen, setDebugHudOpen] = useState(false);
  const [knowledgeState, setKnowledgeState] = useState(createEmptyKnowledgeState);
  const { status, caption, inputCaption, error, diagnostics, sessionNotice } = uiState;

  useEffect(() => {
    knowledgeStateRef.current = knowledgeState;
  }, [knowledgeState]);

  const noteDiagnostic = (event) => {
    dispatchUi({ type: 'diagnostic-event', event });
  };

  const clearAliceMemorySaveTimer = () => {
    if (memorySaveTimerRef.current) {
      window.clearTimeout(memorySaveTimerRef.current);
      memorySaveTimerRef.current = null;
    }
  };

  const flushAliceMemory = async () => {
    clearAliceMemorySaveTimer();

    if (!window.__TAURI_INTERNALS__) {
      return aliceMemoryRef.current;
    }

    aliceMemoryRef.current = await saveAliceMemory(aliceMemoryRef.current);
    return aliceMemoryRef.current;
  };

  const scheduleAliceMemorySave = () => {
    if (!window.__TAURI_INTERNALS__) {
      return;
    }

    clearAliceMemorySaveTimer();
    memorySaveTimerRef.current = window.setTimeout(() => {
      void flushAliceMemory().catch(() => {
        // Memory persistence should not break the live session flow.
      });
    }, ALICE_MEMORY_SAVE_DELAY_MS);
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

  const normalizeKnowledgeToolResponse = (toolName, nativeResponse) => {
    const artifacts = nativeResponse?.artifacts || {};

    switch (toolName) {
      case 'get_navigation_context':
        return {
          ok: nativeResponse.ok,
          message: nativeResponse.message,
          context: artifacts.context || null,
        };
      case 'inspect_current_page':
        return {
          ok: nativeResponse.ok,
          message: nativeResponse.message,
          context: artifacts.context || null,
          page: artifacts.page || null,
          matchedSections: artifacts.matchedSections || [],
          matchedLinks: artifacts.matchedLinks || [],
          sufficiency: artifacts.sufficiency || 'insufficient',
          initialScope: artifacts.initialScope || 'global',
          finalScope: artifacts.finalScope || artifacts.initialScope || 'global',
          initialSufficiency: artifacts.initialSufficiency || artifacts.sufficiency || 'insufficient',
          finalSufficiency: artifacts.finalSufficiency || artifacts.sufficiency || 'insufficient',
          finalOrigin: artifacts.finalOrigin || 'pagina_atual',
          consultedSources: artifacts.consultedSources || [],
          expansionPath: artifacts.expansionPath || [],
          responseGuidance: artifacts.responseGuidance || null,
          fallbackReason: artifacts.fallbackReason || '',
        };
      case 'search_same_domain':
      case 'search_web':
        return {
          ok: nativeResponse.ok,
          message: nativeResponse.message,
          query: artifacts.query || '',
          domain: artifacts.domain || '',
          results: artifacts.results || [],
          consultedSources: artifacts.consultedSources || [],
          fetchedPages: artifacts.fetchedPages || [],
          initialScope: artifacts.initialScope || (toolName === 'search_same_domain' ? 'same_domain' : 'global'),
          finalScope: artifacts.finalScope || (toolName === 'search_same_domain' ? 'same_domain' : 'global'),
          initialSufficiency: artifacts.initialSufficiency || 'insufficient',
          finalSufficiency: artifacts.finalSufficiency || 'insufficient',
          finalOrigin: artifacts.finalOrigin || (toolName === 'search_same_domain' ? 'mesmo_dominio' : 'web_geral'),
          expansionPath: artifacts.expansionPath || [],
          responseGuidance: artifacts.responseGuidance || null,
          summaryHint: artifacts.summaryHint || '',
        };
      case 'fetch_web_page':
        return {
          ok: nativeResponse.ok,
          message: nativeResponse.message,
          page: artifacts.page || null,
          consultedSources: artifacts.consultedSources || [],
          responseGuidance: artifacts.responseGuidance || null,
        };
      case 'refresh_current_page_snapshot':
        return {
          ok: nativeResponse.ok,
          message: nativeResponse.message,
          context: artifacts.context || null,
          page: artifacts.page || null,
          requestId: artifacts.requestId || '',
          refreshMode: artifacts.refreshMode || '',
          refreshLatencyMs: Number(artifacts.refreshLatencyMs || 0),
          extensionSeenAt: Number(artifacts.extensionSeenAt || 0),
          fallbackReason: artifacts.fallbackReason || '',
        };
      default:
        return {
          ok: Boolean(nativeResponse?.ok),
          message: nativeResponse?.message || 'Resposta local recebida.',
        };
    }
  };

  const updateKnowledgeState = (patch) => {
    setKnowledgeState((current) => {
      const nextState = mergeKnowledgeState(current, patch);
      knowledgeStateRef.current = nextState;
      return nextState;
    });
  };

  const rejectUnexpectedToolCall = async (functionCall, generation) => {
    noteDiagnostic({
      type: 'error',
      message: `Ferramenta inesperada recebida: ${functionCall?.name || 'desconhecida'}.`,
    });

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
          send: (activeSession) => activeSession.sendVideo(frame),
        });

        if (sent) {
          noteDiagnostic({ type: 'video-sent' });
        }
      });
    }
  };

  const buildLiveMemoryPrefixTurns = () => [
    ...buildMemoryPrefixTurns(aliceMemoryRef.current),
    ...buildSessionRehydrationTurns({
      trustedUtterance: trustedUtteranceRef.current,
      outputTranscript: outputTranscriptRef.current,
    }),
  ];

  const executeKnowledgeToolCall = async (functionCall, generation) => {
    const toolName = functionCall?.name || '';

    try {
      const args = functionCall?.args || {};
      const responseExecutor = async (name, payload = {}) =>
        normalizeKnowledgeToolResponse(name, await invoke(name, payload));

      if (![
        'get_navigation_context',
        'inspect_current_page',
        'search_same_domain',
        'search_web',
        'fetch_web_page',
      ].includes(toolName)) {
        await rejectUnexpectedToolCall(functionCall, generation);
        return;
      }

      const { response, statePatch } = await executeKnowledgeTool({
        toolName,
        args,
        trustedUtterance: trustedUtteranceRef.current?.text || '',
        knowledgeState: knowledgeStateRef.current,
        invokeTool: responseExecutor,
      });
      updateKnowledgeState(statePatch);

      await sendToolResponse(functionCall, response, generation);
    } catch (toolError) {
      const message = toolError?.message || String(toolError);
      noteDiagnostic({
        type: 'error',
        message,
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
      getMemoryPrefixTurns: async () => buildLiveMemoryPrefixTurns(),
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
        liveTransportRef.current.beginReconnect();
        stopStreamingPipelines();
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
      onCloseReason: (reason) => {
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
      (queue, functionCall) => queue.then(() => executeKnowledgeToolCall(functionCall, generation)),
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
      dispatchUi({ type: 'session-input-caption', inputCaption: trustedUtteranceRef.current.text });
    }

    if (event.outputTranscript) {
      outputTranscriptRef.current = event.outputTranscript;
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
      if (!window.__TAURI_INTERNALS__) {
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
      noteDiagnostic({ type: 'screen-started' });
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

    if (window.__TAURI_INTERNALS__) {
      void loadAliceMemory().then((memory) => {
        if (!disposed) {
          aliceMemoryRef.current = memory;
        }
      });
    }

    return () => {
      disposed = true;
      if (memorySaveTimerRef.current) {
        window.clearTimeout(memorySaveTimerRef.current);
        memorySaveTimerRef.current = null;
      }
      if (window.__TAURI_INTERNALS__) {
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
  }, []);

  const isBusy = status === 'starting' || status === 'configuring';
  const isLive = status === 'connected' || status === 'configuring' || status === 'starting' || status === 'reconnecting';
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
  });

  return (
    <main className={`app-shell app-shell--${status}`}>
      <video ref={videoRef} className="screen-preview" muted playsInline />
      <canvas ref={canvasRef} className="capture-canvas" aria-hidden="true" />

      <section className="alice-live" aria-label="Alice Live">
        <div className="alice-orb" aria-hidden="true">
          <span />
        </div>

        <div className="live-copy">
          <p className="live-name">Alice</p>
          <h1>Voz e tela ao vivo</h1>
          <p>{caption}</p>
          {sessionNotice ? <small className="session-note">{sessionNotice}</small> : null}
          {inputCaption ? <small>Voce: {inputCaption}</small> : null}
          {error ? <small className="error-text">{error}</small> : null}
        </div>
      </section>

      <section className="signal-panel" aria-label="Sinais da Alice Live">
        <span>Conexao: {diagnostics.connection}</span>
        <span>Microfone: {diagnostics.microphone}</span>
        <span>Tela: {diagnostics.screen}</span>
        <span>Gemini: {diagnostics.gemini}</span>
        <span>Audio enviado: {diagnostics.audioChunksSent}</span>
        <span>Frames: {diagnostics.videoFramesSent}</span>
        <span>Eventos: {diagnostics.serverMessagesReceived}</span>
        <span>Voz Alice: {diagnostics.outputAudioChunksReceived}</span>
        <span>Renovacoes: {diagnostics.reconnectAttempts}</span>
        <span>Retomadas: {diagnostics.successfulResumptions}</span>
        <span>Fallbacks: {diagnostics.rehydratedReconnects}</span>
        <span>Ult. fechamento: {diagnostics.lastCloseReason}</span>
        <span className="mic-meter" aria-label="Nivel do microfone">
          <i style={{ transform: `scaleX(${Math.min(1, diagnostics.microphoneLevel * 8)})` }} />
        </span>
      </section>

      <div className="control-bar" aria-label="Controles da Alice Live">
        <span className="status-pill">{statusCopy[status]}</span>
        <button
          type="button"
          className="control-button control-button--secondary"
          onClick={() => setDebugHudOpen((current) => !current)}
        >
          Debug
        </button>
        <button type="button" className="control-button" onClick={toggleLiveSession} disabled={isBusy}>
          <span
            className={`button-icon ${isLive ? 'button-icon--stop' : 'button-icon--play'}`}
            aria-hidden="true"
          />
          {isLive ? 'Parar' : 'Iniciar'}
        </button>
      </div>

      {debugHudOpen ? (
        <aside className="debug-hud" aria-label="Debug HUD">
          <div className="debug-hud__header">
            <strong>Debug HUD</strong>
            <div className="debug-hud__controls">
              <button
                type="button"
                className="debug-hud__close"
                onClick={() => setDebugHudOpen(false)}
                aria-label="Fechar debug"
              >
                Fechar
              </button>
            </div>
          </div>

          <div className="debug-hud__grid">
            <section className="debug-hud__section">
              <h2>Sessao</h2>
              <dl>
                <div><dt>Status</dt><dd>{debugHud.session.status}</dd></div>
                <div><dt>Legenda</dt><dd>{debugHud.session.caption}</dd></div>
                <div><dt>Entrada</dt><dd>{debugHud.session.inputCaption}</dd></div>
                <div><dt>Fala confiavel</dt><dd>{debugHud.session.trustedUtterance}</dd></div>
                <div><dt>Saida</dt><dd>{debugHud.session.outputTranscript}</dd></div>
                <div><dt>Tela</dt><dd>{debugHud.session.screenWidth}x{debugHud.session.screenHeight}</dd></div>
              </dl>
            </section>

            <section className="debug-hud__section">
              <h2>Diagnosticos</h2>
              <dl>
                <div><dt>Conexao</dt><dd>{debugHud.diagnostics.connection}</dd></div>
                <div><dt>Microfone</dt><dd>{debugHud.diagnostics.microphone}</dd></div>
                <div><dt>Tela</dt><dd>{debugHud.diagnostics.screen}</dd></div>
                <div><dt>Gemini</dt><dd>{debugHud.diagnostics.gemini}</dd></div>
                <div><dt>Audio</dt><dd>{debugHud.diagnostics.audioChunksSent}</dd></div>
                <div><dt>Frames</dt><dd>{debugHud.diagnostics.videoFramesSent}</dd></div>
                <div><dt>Eventos</dt><dd>{debugHud.diagnostics.serverMessagesReceived}</dd></div>
                <div><dt>Voz Alice</dt><dd>{debugHud.diagnostics.outputAudioChunksReceived}</dd></div>
                <div><dt>Reconexoes</dt><dd>{debugHud.diagnostics.reconnectAttempts}</dd></div>
                <div><dt>Retomadas</dt><dd>{debugHud.diagnostics.successfulResumptions}</dd></div>
                <div><dt>Fallbacks</dt><dd>{debugHud.diagnostics.rehydratedReconnects}</dd></div>
                <div><dt>Fechamento</dt><dd>{debugHud.diagnostics.lastCloseReason}</dd></div>
                <div><dt>Ult. erro</dt><dd>{debugHud.diagnostics.lastError}</dd></div>
              </dl>
            </section>

            <section className="debug-hud__section debug-hud__section--wide">
              <h2>Conhecimento web</h2>
              <dl>
                <div><dt>URL</dt><dd>{debugHud.knowledge.url}</dd></div>
                <div><dt>Dominio</dt><dd>{debugHud.knowledge.domain}</dd></div>
                <div><dt>Titulo</dt><dd>{debugHud.knowledge.title}</dd></div>
                <div><dt>Selecao</dt><dd>{debugHud.knowledge.selectedText}</dd></div>
                <div><dt>Idade contexto</dt><dd>{debugHud.knowledge.navigationContextAge}</dd></div>
                <div><dt>Idade snapshot</dt><dd>{debugHud.knowledge.pageSnapshotAge}</dd></div>
                <div><dt>Escopo inicial</dt><dd>{debugHud.knowledge.initialScope}</dd></div>
                <div><dt>Suficiencia inicial</dt><dd>{debugHud.knowledge.initialSufficiency}</dd></div>
                <div><dt>Escopo final</dt><dd>{debugHud.knowledge.scope}</dd></div>
                <div><dt>Suficiencia final</dt><dd>{debugHud.knowledge.sufficiency}</dd></div>
                <div><dt>Origem</dt><dd>{debugHud.knowledge.origin}</dd></div>
                <div><dt>Refresh</dt><dd>{debugHud.knowledge.refreshMode}</dd></div>
                <div><dt>Latencia refresh</dt><dd>{debugHud.knowledge.refreshLatency}</dd></div>
                <div><dt>Extensao vista</dt><dd>{debugHud.knowledge.extensionSeenAge}</dd></div>
                <div><dt>Expansao</dt><dd>{debugHud.knowledge.expansionPath}</dd></div>
                <div><dt>Fallback</dt><dd>{debugHud.knowledge.fallbackReason}</dd></div>
                <div><dt>Fontes</dt><dd><pre>{debugHud.knowledge.sources}</pre></dd></div>
                <div><dt>Paginas lidas</dt><dd><pre>{debugHud.knowledge.fetchedPages}</pre></dd></div>
                <div><dt>Resumo operacional</dt><dd>{debugHud.knowledge.summaryHint}</dd></div>
              </dl>
            </section>

            <section className="debug-hud__section debug-hud__section--wide">
              <h2>Memoria recente</h2>
              <pre>{debugHud.memorySummary}</pre>
            </section>
          </div>
        </aside>
      ) : null}
    </main>
  );
}

export default App;
