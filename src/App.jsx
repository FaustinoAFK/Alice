import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { createAliceLiveSetup } from './alice';
import { GeminiLiveSession } from './geminiLive';
import { createLiveDiagnostics, updateLiveDiagnostics } from './liveDiagnostics';
import { calculateRms, decodePcm16Base64, encodePcm16Base64 } from './liveAudio';
import './App.css';

const statusCopy = {
  idle: 'pronta',
  starting: 'iniciando',
  configuring: 'conectando',
  connected: 'ao vivo',
  error: 'erro',
};

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
  const microphoneCleanupRef = useRef(null);
  const screenCleanupRef = useRef(null);
  const outputPlayerRef = useRef(createPcmOutputPlayer());

  const [status, setStatus] = useState('idle');
  const [caption, setCaption] = useState('A Alice fica pronta para ouvir sua voz e observar a tela compartilhada.');
  const [inputCaption, setInputCaption] = useState('');
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState(createLiveDiagnostics);

  const noteDiagnostic = (event) => {
    setDiagnostics((current) => updateLiveDiagnostics(current, event));
  };

  const stopLiveSession = () => {
    microphoneCleanupRef.current?.();
    screenCleanupRef.current?.();
    liveSessionRef.current?.close();
    outputPlayerRef.current?.close();

    stopStream(screenStreamRef.current);
    stopStream(voiceStreamRef.current);

    microphoneCleanupRef.current = null;
    screenCleanupRef.current = null;
    liveSessionRef.current = null;
    screenStreamRef.current = null;
    voiceStreamRef.current = null;
    outputPlayerRef.current = createPcmOutputPlayer();

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setInputCaption('');
    setDiagnostics(createLiveDiagnostics());
    setStatus('idle');
  };

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
      setInputCaption(event.inputTranscript);
    }

    if (event.outputTranscript) {
      setCaption(event.outputTranscript);
    }

    if (event.goAway) {
      setCaption('A sessao da Gemini esta perto de encerrar. Pare e inicie novamente para renovar.');
    }
  };

  const startLiveSession = async () => {
    setError('');
    setStatus('starting');
    setCaption('Escolha a tela ou janela que a Alice deve acompanhar.');
    setDiagnostics(createLiveDiagnostics());
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
      const liveSession = new GeminiLiveSession({
        url: liveAccess.url,
        setup: createAliceLiveSetup(),
        onEvent: handleLiveEvent,
        onStatus: setStatus,
      });

      liveSessionRef.current = liveSession;
      await liveSession.connect();
      noteDiagnostic({ type: 'connected' });
      liveSession.sendText(readyCheckPrompt);

      microphoneCleanupRef.current = startMicrophoneStreaming(voiceStream, (chunk, level) => {
        noteDiagnostic({ type: 'audio-sent', level });
        liveSession.sendAudio(chunk);
      });
      screenCleanupRef.current = startScreenFrameStreaming(videoRef.current, canvasRef.current, (frame) => {
        noteDiagnostic({ type: 'video-sent' });
        liveSession.sendVideo(frame);
      });

      setCaption('Pode falar. A Alice esta ouvindo e vendo sua tela compartilhada.');
    } catch (sessionError) {
      stopLiveSession();
      setStatus('error');
      noteDiagnostic({ type: 'error' });
      setError(sessionError.message || 'Nao foi possivel iniciar a sessao Live.');
      setCaption('Nao consegui abrir a sessao ainda.');
    }
  };

  const toggleLiveSession = () => {
    if (status === 'connected' || status === 'configuring' || status === 'starting') {
      stopLiveSession();
      return;
    }

    startLiveSession();
  };

  useEffect(() => () => stopLiveSession(), []);

  const isBusy = status === 'starting' || status === 'configuring';
  const isLive = status === 'connected';

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
