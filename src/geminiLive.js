export const GEMINI_LIVE_WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

export const buildGeminiLiveUrl = (apiKey) => `${GEMINI_LIVE_WS_URL}?key=${encodeURIComponent(apiKey)}`;

export const buildSetupMessage = (setup) => ({
  setup,
});

export const buildClientTextMessage = (text) => ({
  clientContent: {
    turns: [{ role: 'user', parts: [{ text }] }],
    turnComplete: true,
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
    goAway: message.goAway?.timeLeft || '',
  };
};

export class GeminiLiveSession {
  constructor({ url, setup, WebSocketImpl = WebSocket, onEvent = () => {}, onStatus = () => {} }) {
    this.url = url;
    this.setup = setup;
    this.WebSocketImpl = WebSocketImpl;
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.websocket = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const websocket = new this.WebSocketImpl(this.url);
      let setupResolved = false;
      let setupTimer = null;

      const failSetup = (error) => {
        if (!setupResolved) {
          setupResolved = true;
          clearTimeout(setupTimer);
          reject(error);
        }
      };

      websocket.onopen = () => {
        this.onStatus('configuring');
        websocket.send(JSON.stringify(buildSetupMessage(this.setup)));
        setupTimer = setTimeout(() => {
          failSetup(new Error('Tempo esgotado aguardando setup da Gemini Live API.'));
        }, 15000);
      };

      websocket.onmessage = async (event) => {
        let message;

        try {
          message = await parseLiveMessageData(event.data);
        } catch (error) {
          failSetup(new Error(`Resposta invalida da Gemini Live API: ${error.message}`));
          this.onStatus('error');
          return;
        }

        const serverError = getLiveErrorMessage(message);
        if (serverError) {
          failSetup(new Error(serverError));
          this.onStatus('error');
          return;
        }

        const liveEvent = extractLiveMessage(message);
        this.onEvent(liveEvent, message);

        if (liveEvent.setupComplete && !setupResolved) {
          setupResolved = true;
          clearTimeout(setupTimer);
          this.onStatus('connected');
          resolve();
        }
      };

      websocket.onerror = () => {
        failSetup(new Error('Falha na conexao WebSocket com Gemini Live API.'));
        this.onStatus('error');
      };

      websocket.onclose = (event) => {
        clearTimeout(setupTimer);
        if (!setupResolved) {
          failSetup(new Error(event.reason || 'A Gemini fechou a conexao antes de concluir o setup.'));
          this.onStatus('error');
          return;
        }

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
      this.websocket.close();
      this.websocket = null;
    }
  }
}
