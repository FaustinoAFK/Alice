export const GEMINI_LIVE_WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

export const LIVE_CLOSE_REASONS = {
  manualStop: 'manual_stop',
  goAwayRotation: 'go_away_rotation',
  remoteClose: 'remote_close',
  socketError: 'socket_error',
  setupTimeout: 'setup_timeout',
  resumptionRejected: 'resumption_rejected',
  unknownClose: 'unknown_close',
};

export const buildGeminiLiveUrl = (apiKey) => `${GEMINI_LIVE_WS_URL}?key=${encodeURIComponent(apiKey)}`;

export const buildSetupMessage = (setup) => ({
  setup,
});

export const buildClientContentMessage = (turns, turnComplete = true) => ({
  clientContent: {
    turns,
    turnComplete,
  },
});

export const buildClientTextMessage = (text) =>
  buildClientContentMessage([{ role: 'user', parts: [{ text }] }], true);

export const buildToolResponseMessage = (functionResponses) => ({
  toolResponse: {
    functionResponses,
  },
});

export const buildRealtimeAudioMessage = (base64Audio, sampleRate = 16000) => ({
  realtimeInput: {
    audio: {
      data: base64Audio,
      mimeType: `audio/pcm;rate=${sampleRate}`,
    },
  },
});

export const buildRealtimeVideoMessage = (base64Frame, mimeType = 'image/jpeg') => ({
  realtimeInput: {
    video: {
      data: base64Frame,
      mimeType,
    },
  },
});

export const parseLiveMessageData = async (data) => {
  if (typeof data === 'string') {
    return JSON.parse(data);
  }

  if (data instanceof ArrayBuffer) {
    return JSON.parse(new TextDecoder().decode(data));
  }

  if (data?.text) {
    return JSON.parse(await data.text());
  }

  return JSON.parse(String(data));
};

export const getLiveErrorMessage = (message) => message.error?.message || message.error || '';

const normalizeGoAway = (goAway) =>
  goAway
    ? {
        timeLeft: goAway.timeLeft || '',
      }
    : null;

const normalizeSessionResumptionUpdate = (sessionResumptionUpdate) =>
  sessionResumptionUpdate
    ? {
        newHandle: sessionResumptionUpdate.newHandle || '',
        resumable: Boolean(sessionResumptionUpdate.resumable),
      }
    : null;

export const extractLiveMessage = (message) => {
  const serverContent = message.serverContent || {};
  const parts = serverContent.modelTurn?.parts || [];

  return {
    setupComplete: Boolean(message.setupComplete),
    interrupted: Boolean(serverContent.interrupted),
    turnComplete: Boolean(serverContent.turnComplete),
    generationComplete: Boolean(serverContent.generationComplete),
    inputTranscript: serverContent.inputTranscription?.text || '',
    outputTranscript: serverContent.outputTranscription?.text || '',
    audioChunks: parts
      .filter((part) => part.inlineData?.data)
      .map((part) => part.inlineData.data),
    toolCalls: message.toolCall?.functionCalls || [],
    toolCallCancellation: message.toolCallCancellation || null,
    goAway: normalizeGoAway(message.goAway),
    sessionResumptionUpdate: normalizeSessionResumptionUpdate(message.sessionResumptionUpdate),
  };
};

export const classifyLiveCloseReason = ({
  event = {},
  setupResolved = false,
  manuallyClosed = false,
  sawGoAway = false,
  setupTimedOut = false,
  socketErrored = false,
}) => {
  const normalizedReason = String(event.reason || '').toLowerCase();

  if (manuallyClosed) {
    return LIVE_CLOSE_REASONS.manualStop;
  }

  if (setupTimedOut) {
    return LIVE_CLOSE_REASONS.setupTimeout;
  }

  if (normalizedReason.includes('resumption') || normalizedReason.includes('resume')) {
    return LIVE_CLOSE_REASONS.resumptionRejected;
  }

  if (sawGoAway || normalizedReason.includes('goaway')) {
    return LIVE_CLOSE_REASONS.goAwayRotation;
  }

  if (socketErrored) {
    return LIVE_CLOSE_REASONS.socketError;
  }

  if (setupResolved || event.reason || event.code) {
    return LIVE_CLOSE_REASONS.remoteClose;
  }

  return LIVE_CLOSE_REASONS.unknownClose;
};

const createLiveSessionError = (message, liveCloseReason = '') => {
  const error = new Error(message);

  if (liveCloseReason) {
    error.liveCloseReason = liveCloseReason;
  }

  return error;
};

export class GeminiLiveSession {
  constructor({
    url,
    setup,
    WebSocketImpl = WebSocket,
    onEvent = () => {},
    onStatus = () => {},
    onSetupComplete = () => {},
    onGoAway = () => {},
    onSessionResumptionUpdate = () => {},
    onCloseReason = () => {},
    onError = () => {},
  }) {
    this.url = url;
    this.setup = setup;
    this.WebSocketImpl = WebSocketImpl;
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.onSetupComplete = onSetupComplete;
    this.onGoAway = onGoAway;
    this.onSessionResumptionUpdate = onSessionResumptionUpdate;
    this.onCloseReason = onCloseReason;
    this.onError = onError;
    this.websocket = null;
    this.connectionState = 'idle';
    this.closedByClient = false;
  }

  getConnectionState() {
    return this.connectionState;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const websocket = new this.WebSocketImpl(this.url);
      let setupResolved = false;
      let setupFailureNotified = false;
      let setupTimer = null;
      let setupTimedOut = false;
      let socketErrored = false;
      let sawGoAway = false;
      this.closedByClient = false;
      this.connectionState = 'connecting';

      const failSetup = (error) => {
        if (!setupResolved) {
          setupResolved = true;
          clearTimeout(setupTimer);
          reject(error);
        }

        this.connectionState = 'failed';
        if (!setupFailureNotified) {
          setupFailureNotified = true;
          this.onError(error);
        }
      };

      websocket.onopen = () => {
        this.connectionState = 'awaiting_setup_complete';
        this.onStatus('configuring');
        websocket.send(JSON.stringify(buildSetupMessage(this.setup)));
        setupTimer = setTimeout(() => {
          setupTimedOut = true;
          failSetup(
            createLiveSessionError(
              'Tempo esgotado aguardando setup da Gemini Live API.',
              LIVE_CLOSE_REASONS.setupTimeout,
            ),
          );
          this.onStatus('error');

          try {
            websocket.close(1011, LIVE_CLOSE_REASONS.setupTimeout);
          } catch {
            // Ignore close failures on a dead websocket.
          }
        }, 15000);
      };

      websocket.onmessage = async (event) => {
        let message;

        try {
          message = await parseLiveMessageData(event.data);
        } catch (error) {
          failSetup(createLiveSessionError(`Resposta invalida da Gemini Live API: ${error.message}`));
          this.onStatus('error');
          return;
        }

        const serverError = getLiveErrorMessage(message);
        if (serverError) {
          failSetup(createLiveSessionError(serverError));
          this.onStatus('error');
          return;
        }

        const liveEvent = extractLiveMessage(message);
        this.onEvent(liveEvent, message);

        if (liveEvent.goAway) {
          sawGoAway = true;
          this.onGoAway(liveEvent.goAway, message);
        }

        if (liveEvent.sessionResumptionUpdate) {
          this.onSessionResumptionUpdate(liveEvent.sessionResumptionUpdate, message);
        }

        if (liveEvent.setupComplete && !setupResolved) {
          setupResolved = true;
          clearTimeout(setupTimer);
          this.connectionState = 'active';
          this.onSetupComplete(message);
          this.onStatus('connected');
          resolve();
        }
      };

      websocket.onerror = () => {
        socketErrored = true;
        failSetup(
          createLiveSessionError(
            'Falha na conexao WebSocket com Gemini Live API.',
            LIVE_CLOSE_REASONS.socketError,
          ),
        );
        this.onStatus('error');
      };

      websocket.onclose = (event) => {
        clearTimeout(setupTimer);
        const closeReason = classifyLiveCloseReason({
          event,
          setupResolved,
          manuallyClosed: this.closedByClient,
          sawGoAway,
          setupTimedOut,
          socketErrored,
        });
        this.onCloseReason(closeReason, event);

        if (!setupResolved) {
          failSetup(
            createLiveSessionError(
              event.reason || 'A Gemini fechou a conexao antes de concluir o setup.',
              closeReason,
            ),
          );
          this.onStatus('error');
          return;
        }

        this.connectionState = closeReason === LIVE_CLOSE_REASONS.manualStop ? 'stopped' : 'idle';
        this.onStatus('idle');
      };

      this.websocket = websocket;
    });
  }

  sendAudio(base64Audio) {
    this.sendJson(buildRealtimeAudioMessage(base64Audio));
  }

  sendText(text) {
    this.sendJson(buildClientTextMessage(text));
  }

  sendClientContent(turns, turnComplete = true) {
    this.sendJson(buildClientContentMessage(turns, turnComplete));
  }

  sendToolResponse(functionResponses) {
    this.sendJson(buildToolResponseMessage(functionResponses));
  }

  sendVideo(base64Frame) {
    this.sendJson(buildRealtimeVideoMessage(base64Frame));
  }

  sendJson(payload) {
    const openState = this.WebSocketImpl.OPEN ?? 1;

    if (this.websocket?.readyState === openState) {
      this.websocket.send(JSON.stringify(payload));
    }
  }

  close() {
    if (this.websocket) {
      this.closedByClient = true;
      this.connectionState = 'stopping';
      this.websocket.close();
      this.websocket = null;
    }
  }
}
