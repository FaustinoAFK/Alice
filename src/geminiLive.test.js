import { describe, expect, it } from 'vitest';
import {
  buildClientContentMessage,
  buildGeminiLiveUrl,
  buildClientTextMessage,
  classifyLiveCloseReason,
  GeminiLiveSession,
  buildRealtimeAudioMessage,
  buildRealtimeVideoMessage,
  buildSetupMessage,
  buildToolResponseMessage,
  extractLiveMessage,
  getLiveErrorMessage,
  LIVE_CLOSE_REASONS,
  parseLiveMessageData,
} from './geminiLive';

class FakeWebSocket {
  static OPEN = 1;

  static instances = [];

  constructor(url) {
    this.url = url;
    this.sent = [];
    this.readyState = FakeWebSocket.OPEN;
    FakeWebSocket.instances.push(this);
  }

  send(payload) {
    this.sent.push(payload);
  }

  close(code = 1000, reason = '') {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }

  emitOpen() {
    this.onopen?.();
  }

  emitMessage(message) {
    return this.onmessage?.({ data: JSON.stringify(message) });
  }

  emitClose(event = { code: 1000, reason: '' }) {
    this.readyState = 3;
    this.onclose?.(event);
  }

  emitError() {
    this.onerror?.();
  }
}

describe('buildGeminiLiveUrl', () => {
  it('uses the v1beta websocket endpoint with an encoded API key', () => {
    const url = buildGeminiLiveUrl('key with spaces');

    expect(url).toBe(
      'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=key%20with%20spaces',
    );
  });
});

describe('buildSetupMessage', () => {
  it('wraps setup as the first Live API websocket message', () => {
    expect(buildSetupMessage({ model: 'models/demo' })).toEqual({
      setup: { model: 'models/demo' },
    });
  });
});

describe('buildClientTextMessage', () => {
  it('builds a completed user text turn for the Live API', () => {
    expect(buildClientTextMessage('teste')).toEqual({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text: 'teste' }] }],
        turnComplete: true,
      },
    });
  });
});

describe('buildClientContentMessage', () => {
  it('builds an arbitrary client content payload for the Live API', () => {
    expect(
      buildClientContentMessage([
        { role: 'user', parts: [{ text: 'Memoria local.' }] },
      ]),
    ).toEqual({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text: 'Memoria local.' }] }],
        turnComplete: true,
      },
    });
  });
});

describe('buildRealtimeAudioMessage', () => {
  it('builds a realtime PCM audio chunk message', () => {
    expect(buildRealtimeAudioMessage('abc123')).toEqual({
      realtimeInput: {
        audio: {
          data: 'abc123',
          mimeType: 'audio/pcm;rate=16000',
        },
      },
    });
  });
});

describe('buildRealtimeVideoMessage', () => {
  it('builds a realtime jpeg video frame message', () => {
    expect(buildRealtimeVideoMessage('frame-data')).toEqual({
      realtimeInput: {
        video: {
          data: 'frame-data',
          mimeType: 'image/jpeg',
        },
      },
    });
  });
});

describe('extractLiveMessage', () => {
  it('extracts setup state, transcripts, interruption, and audio chunks', () => {
    const event = extractLiveMessage({
      setupComplete: {},
      serverContent: {
        interrupted: true,
        inputTranscription: { text: 'minha fala' },
        outputTranscription: { text: 'fala da alice' },
        modelTurn: {
          parts: [{ inlineData: { data: 'audio-base64', mimeType: 'audio/pcm;rate=24000' } }],
        },
      },
    });

    expect(event.setupComplete).toBe(true);
    expect(event.interrupted).toBe(true);
    expect(event.inputTranscript).toBe('minha fala');
    expect(event.outputTranscript).toBe('fala da alice');
    expect(event.audioChunks).toEqual(['audio-base64']);
  });

  it('extracts tool calls and tool call cancellations', () => {
    const event = extractLiveMessage({
      toolCall: {
        functionCalls: [{ id: 'call-1', name: 'open_app', args: { app: 'notepad' } }],
      },
      toolCallCancellation: {
        ids: ['call-2'],
      },
    });

    expect(event.toolCalls).toEqual([{ id: 'call-1', name: 'open_app', args: { app: 'notepad' } }]);
    expect(event.toolCallCancellation.ids).toEqual(['call-2']);
  });

  it('extracts goAway and session resumption updates', () => {
    const event = extractLiveMessage({
      goAway: {
        timeLeft: '30s',
      },
      sessionResumptionUpdate: {
        newHandle: 'handle-1',
        resumable: true,
      },
    });

    expect(event.goAway).toEqual({ timeLeft: '30s' });
    expect(event.sessionResumptionUpdate).toEqual({
      newHandle: 'handle-1',
      resumable: true,
    });
  });
});

describe('buildToolResponseMessage', () => {
  it('builds a Live API tool response message', () => {
    expect(
      buildToolResponseMessage([
        {
          id: 'call-1',
          name: 'open_app',
          response: { ok: true, message: 'aberto' },
        },
      ]),
    ).toEqual({
      toolResponse: {
        functionResponses: [
          {
            id: 'call-1',
            name: 'open_app',
            response: { ok: true, message: 'aberto' },
          },
        ],
      },
    });
  });
});

describe('parseLiveMessageData', () => {
  it('parses websocket text payloads', async () => {
    await expect(parseLiveMessageData('{"setupComplete":{}}')).resolves.toEqual({
      setupComplete: {},
    });
  });
});

describe('getLiveErrorMessage', () => {
  it('extracts server error details from websocket messages', () => {
    expect(getLiveErrorMessage({ error: { message: 'payload invalido' } })).toBe('payload invalido');
  });
});

describe('classifyLiveCloseReason', () => {
  it('classifies a manual close', () => {
    expect(
      classifyLiveCloseReason({
        manuallyClosed: true,
      }),
    ).toBe(LIVE_CLOSE_REASONS.manualStop);
  });

  it('classifies a goAway-driven close', () => {
    expect(
      classifyLiveCloseReason({
        setupResolved: true,
        sawGoAway: true,
      }),
    ).toBe(LIVE_CLOSE_REASONS.goAwayRotation);
  });

  it('classifies a setup timeout', () => {
    expect(
      classifyLiveCloseReason({
        setupTimedOut: true,
      }),
    ).toBe(LIVE_CLOSE_REASONS.setupTimeout);
  });
});

describe('GeminiLiveSession', () => {
  it('sends setup, exposes setup completion, and forwards goAway/session resumption updates', async () => {
    const callbackState = {
      statuses: [],
      goAwayEvents: [],
      resumptionUpdates: [],
      setupCompleteCount: 0,
      closeReasons: [],
      events: [],
    };
    const session = new GeminiLiveSession({
      url: 'wss://example.test/live',
      setup: { model: 'models/demo' },
      WebSocketImpl: FakeWebSocket,
      onStatus: (status) => callbackState.statuses.push(status),
      onGoAway: (goAway) => callbackState.goAwayEvents.push(goAway),
      onSessionResumptionUpdate: (update) => callbackState.resumptionUpdates.push(update),
      onSetupComplete: () => {
        callbackState.setupCompleteCount += 1;
      },
      onCloseReason: (reason) => callbackState.closeReasons.push(reason),
      onEvent: (event) => callbackState.events.push(event),
    });

    const connectPromise = session.connect();
    const socket = FakeWebSocket.instances.at(-1);
    socket.emitOpen();
    expect(socket.sent).toEqual([JSON.stringify({ setup: { model: 'models/demo' } })]);
    expect(session.getConnectionState()).toBe('awaiting_setup_complete');

    await socket.emitMessage({
      setupComplete: {},
      goAway: { timeLeft: '45s' },
      sessionResumptionUpdate: { newHandle: 'handle-2', resumable: true },
    });
    await connectPromise;

    expect(session.getConnectionState()).toBe('active');
    expect(callbackState.setupCompleteCount).toBe(1);
    expect(callbackState.goAwayEvents).toEqual([{ timeLeft: '45s' }]);
    expect(callbackState.resumptionUpdates).toEqual([
      { newHandle: 'handle-2', resumable: true },
    ]);
    expect(callbackState.statuses).toEqual(['configuring', 'connected']);

    socket.emitClose({ code: 1001, reason: '' });
    expect(callbackState.closeReasons).toEqual([LIVE_CLOSE_REASONS.goAwayRotation]);
    expect(callbackState.statuses.at(-1)).toBe('idle');
  });

  it('classifies close() as manual stop', async () => {
    const closeReasons = [];
    const session = new GeminiLiveSession({
      url: 'wss://example.test/live',
      setup: { model: 'models/demo' },
      WebSocketImpl: FakeWebSocket,
      onCloseReason: (reason) => closeReasons.push(reason),
    });

    const connectPromise = session.connect();
    const socket = FakeWebSocket.instances.at(-1);
    socket.emitOpen();
    await socket.emitMessage({ setupComplete: {} });
    await connectPromise;

    session.close();

    expect(closeReasons).toEqual([LIVE_CLOSE_REASONS.manualStop]);
    expect(session.getConnectionState()).toBe('stopped');
  });

  it('sends arbitrary client content turns over the websocket', async () => {
    const session = new GeminiLiveSession({
      url: 'wss://example.test/live',
      setup: { model: 'models/demo' },
      WebSocketImpl: FakeWebSocket,
    });

    const connectPromise = session.connect();
    const socket = FakeWebSocket.instances.at(-1);
    socket.emitOpen();
    await socket.emitMessage({ setupComplete: {} });
    await connectPromise;

    session.sendClientContent([{ role: 'user', parts: [{ text: 'Contexto restaurado.' }] }], true);

    expect(socket.sent.at(-1)).toBe(
      JSON.stringify({
        clientContent: {
          turns: [{ role: 'user', parts: [{ text: 'Contexto restaurado.' }] }],
          turnComplete: true,
        },
      }),
    );
  });

  it('rejects setup timeout with a classified error only once', async () => {
    const errors = [];
    const session = new GeminiLiveSession({
      url: 'wss://example.test/live',
      setup: { model: 'models/demo' },
      WebSocketImpl: FakeWebSocket,
      onError: (error) => errors.push(error),
    });

    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (callback) => {
      callback();
      return 1;
    };

    try {
      const connectPromise = session.connect();
      const socket = FakeWebSocket.instances.at(-1);
      socket.emitOpen();

      await expect(connectPromise).rejects.toMatchObject({
        message: 'Tempo esgotado aguardando setup da Gemini Live API.',
        liveCloseReason: LIVE_CLOSE_REASONS.setupTimeout,
      });
      expect(errors).toHaveLength(1);
      expect(errors[0].liveCloseReason).toBe(LIVE_CLOSE_REASONS.setupTimeout);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });

  it('rejects a resumption rejection before setup with the classified close reason', async () => {
    const session = new GeminiLiveSession({
      url: 'wss://example.test/live',
      setup: { model: 'models/demo' },
      WebSocketImpl: FakeWebSocket,
    });

    const connectPromise = session.connect();
    const socket = FakeWebSocket.instances.at(-1);
    socket.emitOpen();
    socket.emitClose({ code: 4001, reason: 'resumption rejected by server' });

    await expect(connectPromise).rejects.toMatchObject({
      liveCloseReason: LIVE_CLOSE_REASONS.resumptionRejected,
    });
  });
});
