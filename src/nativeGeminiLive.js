import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  buildClientContentMessage,
  buildClientTextMessage,
  buildRealtimeAudioMessage,
  buildRealtimeVideoMessage,
  buildToolResponseMessage,
  classifyLiveCloseReason,
  extractLiveMessage,
  getLiveErrorMessage,
  LIVE_CLOSE_REASONS,
  parseLiveMessageData,
} from './geminiLive';

export const NATIVE_LIVE_EVENTS = {
  message: 'alice-gemini-live-message',
  error: 'alice-gemini-live-error',
  close: 'alice-gemini-live-close',
};

export const NATIVE_SETUP_TIMEOUT_MS = 60000;

const createNativeSessionId = () =>
  `alice-live-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const isEventForSession = (event, sessionId) => event?.payload?.sessionId === sessionId;

const eventValue = (event) => event?.payload?.value || {};

const createLiveSessionError = (message, liveCloseReason = '') => {
  const error = new Error(message);

  if (liveCloseReason) {
    error.liveCloseReason = liveCloseReason;
  }

  return error;
};

export class NativeGeminiLiveSession {
  constructor({
    setup,
    sessionId = createNativeSessionId(),
    invokeFn = invoke,
    listenFn = listen,
    onEvent = () => {},
    onStatus = () => {},
    onSetupComplete = () => {},
    onGoAway = () => {},
    onSessionResumptionUpdate = () => {},
    onCloseReason = () => {},
    onError = () => {},
  }) {
    this.setup = setup;
    this.sessionId = sessionId;
    this.invokeFn = invokeFn;
    this.listenFn = listenFn;
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.onSetupComplete = onSetupComplete;
    this.onGoAway = onGoAway;
    this.onSessionResumptionUpdate = onSessionResumptionUpdate;
    this.onCloseReason = onCloseReason;
    this.onError = onError;
    this.connectionState = 'idle';
    this.closedByClient = false;
    this.unlistenCallbacks = [];
  }

  getConnectionState() {
    return this.connectionState;
  }

  cleanupListeners() {
    this.unlistenCallbacks.forEach((unlisten) => {
      try {
        unlisten();
      } catch {
        // Listener cleanup should not block shutdown.
      }
    });
    this.unlistenCallbacks = [];
  }

  async processServerMessage(message, { resolve, failSetup, markSetupComplete }) {
    const parsedMessage = await parseLiveMessageData(message);
    const serverError = getLiveErrorMessage(parsedMessage);
    if (serverError) {
      failSetup(createLiveSessionError(serverError));
      this.onStatus('error');
      return;
    }

    const liveEvent = extractLiveMessage(parsedMessage);
    this.onEvent(liveEvent, parsedMessage);

    if (liveEvent.goAway) {
      this.onGoAway(liveEvent.goAway, parsedMessage);
    }

    if (liveEvent.sessionResumptionUpdate) {
      this.onSessionResumptionUpdate(liveEvent.sessionResumptionUpdate, parsedMessage);
    }

    if (liveEvent.setupComplete) {
      const completed = markSetupComplete();
      if (completed) {
        this.connectionState = 'active';
        this.onSetupComplete(parsedMessage);
        this.onStatus('connected');
        resolve();
      }
    }
  }

  async registerListeners({ resolve, reject, failSetup, markSetupComplete, markSocketErrored }) {
    const unlistenMessage = await this.listenFn(NATIVE_LIVE_EVENTS.message, async (event) => {
      if (!isEventForSession(event, this.sessionId)) {
        return;
      }

      try {
        await this.processServerMessage(eventValue(event), {
          resolve,
          failSetup,
          markSetupComplete,
        });
      } catch (error) {
        failSetup(createLiveSessionError(`Resposta invalida da Gemini Live API: ${error.message}`));
        this.onStatus('error');
      }
    });

    const unlistenError = await this.listenFn(NATIVE_LIVE_EVENTS.error, (event) => {
      if (!isEventForSession(event, this.sessionId)) {
        return;
      }

      markSocketErrored();
      const message = eventValue(event).message || 'Falha na conexao nativa com Gemini Live API.';
      const error = createLiveSessionError(message, LIVE_CLOSE_REASONS.socketError);
      failSetup(error);
      this.onStatus('error');
    });

    const unlistenClose = await this.listenFn(NATIVE_LIVE_EVENTS.close, (event) => {
      if (!isEventForSession(event, this.sessionId)) {
        return;
      }

      const payload = eventValue(event);
      const closeReason = classifyLiveCloseReason({
        event: payload,
        setupResolved: this.connectionState === 'active',
        manuallyClosed: this.closedByClient,
        socketErrored: payload.reason === LIVE_CLOSE_REASONS.socketError,
      });
      this.onCloseReason(closeReason, payload);

      if (this.connectionState !== 'active') {
        failSetup(
          createLiveSessionError(
            payload.reason || 'A Gemini fechou a conexao antes de concluir o setup.',
            closeReason,
          ),
        );
        this.onStatus('error');
        return;
      }

      this.connectionState = closeReason === LIVE_CLOSE_REASONS.manualStop ? 'stopped' : 'idle';
      this.onStatus('idle');
    });

    this.unlistenCallbacks.push(unlistenMessage, unlistenError, unlistenClose);
  }

  async connect() {
    this.closedByClient = false;
    this.connectionState = 'connecting';

    return new Promise((resolve, reject) => {
      let setupResolved = false;
      let setupFailureNotified = false;
      let socketErrored = false;
      let setupTimer = null;

      const cleanupSetupTimer = () => {
        if (setupTimer) {
          clearTimeout(setupTimer);
          setupTimer = null;
        }
      };

      const failSetup = (error) => {
        if (!setupResolved) {
          setupResolved = true;
          cleanupSetupTimer();
          this.cleanupListeners();
          reject(error);
        }

        this.connectionState = 'failed';
        if (!setupFailureNotified) {
          setupFailureNotified = true;
          this.onError(error);
        }
      };

      const markSetupComplete = () => {
        if (setupResolved) {
          return false;
        }

        setupResolved = true;
        cleanupSetupTimer();
        return true;
      };

      const markSocketErrored = () => {
        socketErrored = true;
      };

      this.registerListeners({
        resolve,
        reject,
        failSetup,
        markSetupComplete,
        markSocketErrored,
      })
        .then(async () => {
          this.connectionState = 'awaiting_setup_complete';
          this.onStatus('configuring');
          setupTimer = setTimeout(() => {
            const error = createLiveSessionError(
              'Tempo esgotado aguardando setup da Gemini Live API.',
              LIVE_CLOSE_REASONS.setupTimeout,
            );
            failSetup(error);
            this.onStatus('error');
            void this.invokeFn('close_gemini_live_session', { sessionId: this.sessionId });
          }, NATIVE_SETUP_TIMEOUT_MS);

          const startResult = await this.invokeFn('start_gemini_live_session', {
            sessionId: this.sessionId,
            setup: this.setup,
          });
          await this.processServerMessage(startResult?.firstMessage, {
            resolve,
            failSetup,
            markSetupComplete,
          });
        })
        .catch((error) => {
          const liveCloseReason = socketErrored ? LIVE_CLOSE_REASONS.socketError : '';
          failSetup(createLiveSessionError(error.message || String(error), liveCloseReason));
          this.onStatus('error');
        });
    });
  }

  sendJson(payload) {
    if (this.connectionState !== 'active') {
      return;
    }

    void this.invokeFn('send_gemini_live_message', {
      sessionId: this.sessionId,
      message: payload,
    }).catch((error) => {
      this.onError(createLiveSessionError(error.message || String(error), LIVE_CLOSE_REASONS.socketError));
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

  close() {
    this.closedByClient = true;
    this.connectionState = 'stopping';
    void this.invokeFn('close_gemini_live_session', { sessionId: this.sessionId });
    this.cleanupListeners();
    this.connectionState = 'stopped';
  }
}
