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
import { calculateRms, decodePcm16Base64, encodePcm16Base64 } from './liveAudio';
import { LiveSessionOrchestrator } from './liveSessionOrchestrator';
import { LiveSessionTransport } from './liveSessionTransport';
import { SCREEN_SHARE_VIDEO_CONSTRAINTS } from './screenGeometry';
import { startScreenFrameStreaming } from './screenFrameStreaming';
import { AliceHud } from './hud/AliceHud';
import { isTauriRuntime } from './tauriRuntime';
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
  'Diga em uma frase curta, em portugues do Brasil, que voce esta ouvindo e recebendo a tela compartilhada.';

const appendTrustedUtterance = (currentUtterance, text) => {
  const normalizedText = String(text || '').trim();
  if (!normalizedText) {
    return currentUtterance;
  }

  const now = Date.now();
  const previousText =
    currentUtterance && now - Number(currentUtterance.timestamp || 0) <= 10000
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

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const screenStreamRef = useRef(null);
  const voiceStreamRef = useRef(null);
  const liveSessionRef = useRef(null);
  const liveOrchestratorRef = useRef(null);
  const liveTransportRef = useRef(new LiveSessionTransport());
  const microphoneCleanupRef = useRef(null);
  const screenCleanupRef = useRef(null);
  const outputPlayerRef = useRef(createPcmOutputPlayer());
  const trustedUtteranceRef = useRef(null);
  const outputTranscriptRef = useRef('');

  const [uiState, dispatchUi] = useReducer(reduceAppUiState, undefined, createInitialAppUiState);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { status, caption, inputCaption, error, diagnostics, sessionNotice } = uiState;

  const noteDiagnostic = (event) => {
    dispatchUi({ type: 'diagnostic-event', event });
  };

  const canUseTauriRuntime = () => isTauriRuntime();

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

  const releaseLiveResources = () => {
    stopStreamingPipelines();
    stopMediaStreams();
    outputPlayerRef.current?.close();
    outputPlayerRef.current = createPcmOutputPlayer();
    trustedUtteranceRef.current = null;
    outputTranscriptRef.current = '';
    liveSessionRef.current = null;
    liveOrchestratorRef.current = null;
    liveTransportRef.current.clear();

    if (videoRef.current) {
      videoRef.current.srcObject = null;
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

  const createLiveOrchestrator = (url) =>
    new LiveSessionOrchestrator({
      buildSetup: ({ resumptionHandle = '' }) =>
        createAliceLiveSetup({
          resumptionHandle,
          tools: [],
        }),
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
      getMemoryPrefixTurns: async () => [],
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
          replayPendingToolResponses: false,
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

  const handleLiveEvent = (event) => {
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
    }

    if (event.toolCalls.length > 0) {
      noteDiagnostic({
        type: 'error',
        message: 'Ferramentas locais estao desligadas no modo conversa e visao.',
      });
    }
  };

  const stopLiveSession = async () => {
    await liveOrchestratorRef.current?.stopLiveSession();
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

  useEffect(() => () => {
    void liveOrchestratorRef.current?.stopLiveSession();
    releaseLiveResources();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isBusy = status === 'starting' || status === 'configuring';
  const isLive = status === 'connected' || status === 'configuring' || status === 'starting' || status === 'reconnecting';

  return (
    <main className={`app-shell app-shell--${status}`}>
      <video ref={videoRef} className="screen-preview" muted playsInline />
      <canvas ref={canvasRef} className="capture-canvas" aria-hidden="true" />

      <AliceHud
        activeHudPage="live"
        caption={caption}
        diagnostics={diagnostics}
        error={error}
        inputCaption={inputCaption}
        isBusy={isBusy}
        isLive={isLive}
        onNavigate={() => {}}
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
