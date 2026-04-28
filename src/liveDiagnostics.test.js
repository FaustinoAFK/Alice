import { describe, expect, it } from 'vitest';
import { createLiveDiagnostics, updateLiveDiagnostics } from './liveDiagnostics';

describe('createLiveDiagnostics', () => {
  it('starts every live signal in a waiting state', () => {
    expect(createLiveDiagnostics()).toEqual({
      connection: 'aguardando',
      microphone: 'aguardando',
      screen: 'aguardando',
      gemini: 'aguardando',
      audioChunksSent: 0,
      videoFramesSent: 0,
      serverMessagesReceived: 0,
      outputAudioChunksReceived: 0,
      microphoneLevel: 0,
      lastVideoFrameWidth: 0,
      lastVideoFrameHeight: 0,
      lastVideoSourceWidth: 0,
      lastVideoSourceHeight: 0,
      goAwayEvents: 0,
      reconnectAttempts: 0,
      successfulResumptions: 0,
      rehydratedReconnects: 0,
      resumptionUpdates: 0,
      setupTimeouts: 0,
      resumptionRejections: 0,
      lastCloseReason: 'nenhum',
      lastError: '',
    });
  });
});

describe('updateLiveDiagnostics', () => {
  it('increments audio traffic without changing unrelated counters', () => {
    const diagnostics = updateLiveDiagnostics(createLiveDiagnostics(), {
      type: 'audio-sent',
      level: 0.42,
    });

    expect(diagnostics.microphone).toBe('enviando');
    expect(diagnostics.audioChunksSent).toBe(1);
    expect(diagnostics.microphoneLevel).toBe(0.42);
    expect(diagnostics.videoFramesSent).toBe(0);
  });

  it('stores visual frame diagnostics when a screen frame is sent', () => {
    const diagnostics = updateLiveDiagnostics(createLiveDiagnostics(), {
      type: 'video-sent',
      width: 1280,
      height: 720,
      sourceWidth: 1920,
      sourceHeight: 1080,
    });

    expect(diagnostics.screen).toBe('enviando');
    expect(diagnostics.videoFramesSent).toBe(1);
    expect(diagnostics.lastVideoFrameWidth).toBe(1280);
    expect(diagnostics.lastVideoFrameHeight).toBe(720);
    expect(diagnostics.lastVideoSourceWidth).toBe(1920);
    expect(diagnostics.lastVideoSourceHeight).toBe(1080);
  });

  it('marks the connection as renewing without resetting counters', () => {
    const diagnostics = updateLiveDiagnostics(
      {
        ...createLiveDiagnostics(),
        connection: 'conectada',
        gemini: 'respondendo',
        audioChunksSent: 4,
      },
      {
        type: 'reconnecting',
      },
    );

    expect(diagnostics.connection).toBe('renovando');
    expect(diagnostics.gemini).toBe('renovando');
    expect(diagnostics.audioChunksSent).toBe(4);
    expect(diagnostics.reconnectAttempts).toBe(1);
  });

  it('records close reasons and resumption metrics without mutating unrelated fields', () => {
    const diagnostics = updateLiveDiagnostics(
      updateLiveDiagnostics(
        updateLiveDiagnostics(createLiveDiagnostics(), { type: 'go-away' }),
        { type: 'resumption-updated' },
      ),
      { type: 'close-reason', reason: 'resumption_rejected' },
    );

    expect(diagnostics.goAwayEvents).toBe(1);
    expect(diagnostics.resumptionUpdates).toBe(1);
    expect(diagnostics.resumptionRejections).toBe(1);
    expect(diagnostics.lastCloseReason).toBe('resume_negado');
    expect(diagnostics.setupTimeouts).toBe(0);
  });

  it('stores the last setup timeout and error message for final diagnostics', () => {
    const diagnostics = updateLiveDiagnostics(
      updateLiveDiagnostics(createLiveDiagnostics(), {
        type: 'close-reason',
        reason: 'setup_timeout',
      }),
      {
        type: 'error',
        message: 'Tempo esgotado aguardando setup da Gemini Live API.',
      },
    );

    expect(diagnostics.setupTimeouts).toBe(1);
    expect(diagnostics.lastCloseReason).toBe('timeout');
    expect(diagnostics.lastError).toBe('Tempo esgotado aguardando setup da Gemini Live API.');
  });
});
