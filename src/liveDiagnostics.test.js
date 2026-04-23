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
});
