import { invoke } from '@tauri-apps/api/core';
import { useEffect, useReducer, useRef } from 'react';
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
import {
  appendTrustedUtterance,
  attachCaptureGeometry,
  authorizeDesktopAction,
  getRecentTrustedUtterance,
} from './desktopCommandAuth';
import { buildOcrClickAction, formatOcrFallbackMessage } from './clickTargetResolution';
import { GeminiLiveSession, LIVE_CLOSE_REASONS } from './geminiLive';
import { calculateRms, decodePcm16Base64, encodePcm16Base64 } from './liveAudio';
import { LiveSessionOrchestrator } from './liveSessionOrchestrator';
import { buildSessionRehydrationTurns } from './liveSessionRehydration';
import { createFunctionResponseEnvelope, LiveSessionTransport } from './liveSessionTransport';
import { locateTextInCanvas } from './ocrTextLocator';
import { captureVideoFrameToCanvas } from './screenFrameCapture';
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

const TOOL_TRANSCRIPT_WAIT_MS = 5000;
const TOOL_TRANSCRIPT_POLL_MS = 100;
const ALICE_MEMORY_SAVE_DELAY_MS = 750;

const wait = (durationMs) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });

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
  const ocrCanvasRef = useRef(null);
  const trustedUtteranceRef = useRef(null);
  const outputTranscriptRef = useRef('');
  const lastCommandRef = useRef(null);
  const toolQueueRef = useRef(Promise.resolve());

  const [uiState, dispatchUi] = useReducer(reduceAppUiState, undefined, createInitialAppUiState);
  const { status, caption, inputCaption, error, diagnostics, lastCommand, sessionNotice } = uiState;

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
    lastCommand = lastCommandRef.current,
  } = {}) => {
    const extractedFacts = extractImportantFacts({
      inputTranscript,
      outputTranscript,
      lastCommand,
      sessionModel: ALICE_LIVE_MODEL,
    });

    aliceMemoryRef.current = mergeImportantFacts(aliceMemoryRef.current, extractedFacts);
    scheduleAliceMemorySave();
    return aliceMemoryRef.current;
  };

  const setCommandState = (commandState) => {
    lastCommandRef.current = commandState;
    dispatchUi({ type: 'command-state', commandState });
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
    lastCommandRef.current = null;
    toolQueueRef.current = Promise.resolve();
  };

  const releaseLiveResources = () => {
    stopStreamingPipelines();
    stopMediaStreams();
    outputPlayerRef.current?.close();
    outputPlayerRef.current = createPcmOutputPlayer();

    resetRuntimeRefs();

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const waitForRecentTrustedUtterance = async () => {
    const deadline = Date.now() + TOOL_TRANSCRIPT_WAIT_MS;

    while (!getRecentTrustedUtterance(trustedUtteranceRef.current) && Date.now() < deadline) {
      await wait(TOOL_TRANSCRIPT_POLL_MS);
    }
  };

  const sendToolResponse = (functionCall, response, generation) =>
    liveTransportRef.current.sendToolResponse({
      generation,
      functionResponse: createFunctionResponseEnvelope(functionCall, response),
    });

  const getScreenCaptureGeometry = () => {
    const settings = screenStreamRef.current?.getVideoTracks()[0]?.getSettings?.() || {};
    return {
      width: settings.width || videoRef.current?.videoWidth || 0,
      height: settings.height || videoRef.current?.videoHeight || 0,
    };
  };

  const getOcrCanvas = () => {
    if (!ocrCanvasRef.current) {
      ocrCanvasRef.current = document.createElement('canvas');
    }

    return ocrCanvasRef.current;
  };

  const executeClickTargetAction = async (action) => {
    try {
      const result = await invoke('execute_desktop_action', { action });
      return {
        message: result.message || 'Clique acessivel executado.',
        resolvedAction: action,
      };
    } catch (accessibilityError) {
      const ocrCanvas = getOcrCanvas();
      const capturedFrame = captureVideoFrameToCanvas(videoRef.current, ocrCanvas);
      if (!capturedFrame) {
        throw accessibilityError;
      }

      const locatedText = await locateTextInCanvas(capturedFrame.canvas, action.target);
      if (!locatedText) {
        const accessibilityMessage = accessibilityError.message || String(accessibilityError);
        throw new Error(
          `${accessibilityMessage} OCR nao encontrou '${action.target}' na tela atual.`,
        );
      }

      const ocrClickAction = buildOcrClickAction({
        action,
        locatedText,
        geometry: getScreenCaptureGeometry(),
        attachCaptureGeometry,
      });
      const clickResult = await invoke('execute_desktop_action', { action: ocrClickAction });

      return {
        message: formatOcrFallbackMessage({
          baseMessage: clickResult.message || 'Clique executado.',
          target: action.target,
          locatedText,
        }),
        resolvedAction: ocrClickAction,
      };
    }
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
      lastCommand: lastCommandRef.current,
    }),
  ];

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

  const executeToolCall = async (functionCall, generation) => {
    await waitForRecentTrustedUtterance();

    const authorization = authorizeDesktopAction(functionCall, trustedUtteranceRef.current);
    const commandName = functionCall.name || 'acao_local';

    if (!authorization.authorized) {
      const nextCommandState = {
        name: commandName,
        status: 'negado',
        message: authorization.reason,
      };
      setCommandState(nextCommandState);
      rememberAliceContext({ lastCommand: nextCommandState });
      sendToolResponse(functionCall, { ok: false, message: authorization.reason }, generation);
      return;
    }

    setCommandState({
      name: commandName,
      status: 'executando',
      message: authorization.reason,
    });

    try {
      const action = attachCaptureGeometry(authorization.action, getScreenCaptureGeometry());
      const execution =
        action.type === 'click_target'
          ? await executeClickTargetAction(action)
          : {
              resolvedAction: action,
              message: (await invoke('execute_desktop_action', { action })).message || 'Acao local executada.',
            };
      const message = execution.message || 'Acao local executada.';

      const nextCommandState = {
        name: commandName,
        status: 'executado',
        message,
      };
      setCommandState(nextCommandState);
      rememberAliceContext({ lastCommand: nextCommandState });
      sendToolResponse(
        functionCall,
        { ok: true, message, action: execution.resolvedAction.type },
        generation,
      );
    } catch (actionError) {
      const message = actionError.message || String(actionError);

      const nextCommandState = {
        name: commandName,
        status: 'erro',
        message,
      };
      setCommandState(nextCommandState);
      rememberAliceContext({ lastCommand: nextCommandState });
      sendToolResponse(functionCall, { ok: false, message }, generation);
    }
  };

  const enqueueToolCalls = (toolCalls, generation) => {
    toolQueueRef.current = toolCalls.reduce(
      (queue, functionCall) => queue.then(() => executeToolCall(functionCall, generation)),
      toolQueueRef.current,
    );

    toolQueueRef.current = toolQueueRef.current.catch((toolError) => {
      setCommandState({
        name: 'acao_local',
        status: 'erro',
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
      const nextCommandState = {
        name: 'acao_local',
        status: 'cancelado',
        message: 'A Gemini cancelou uma chamada de ferramenta pendente.',
      };
      setCommandState(nextCommandState);
      rememberAliceContext({ lastCommand: nextCommandState });
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
        video: {
          frameRate: { ideal: 5, max: 10 },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
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
      setCommandState(null);
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
          {lastCommand ? (
            <small className={`command-text command-text--${lastCommand.status}`}>
              Comando {lastCommand.status}: {lastCommand.name} - {lastCommand.message}
            </small>
          ) : null}
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
        <button type="button" className="control-button" onClick={toggleLiveSession} disabled={isBusy}>
          <span
            className={`button-icon ${isLive ? 'button-icon--stop' : 'button-icon--play'}`}
            aria-hidden="true"
          />
          {isLive ? 'Parar' : 'Iniciar'}
        </button>
      </div>
    </main>
  );
}

export default App;
