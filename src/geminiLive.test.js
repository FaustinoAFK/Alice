import { describe, expect, it } from 'vitest';
import {
  buildGeminiLiveUrl,
  buildClientTextMessage,
  buildRealtimeAudioMessage,
  buildRealtimeVideoMessage,
  buildSetupMessage,
  buildToolResponseMessage,
  extractLiveMessage,
  getLiveErrorMessage,
  parseLiveMessageData,
} from './geminiLive';

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
