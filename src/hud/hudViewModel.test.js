import { describe, expect, it } from 'vitest';
import {
  buildDebugSummaryCards,
  buildLiveActivity,
  buildSignalGroups,
  HUD_PAGES,
} from './hudViewModel';

describe('HUD_PAGES', () => {
  it('keeps the HUD navigation explicit and stable', () => {
    expect(HUD_PAGES.map((page) => page.id)).toEqual(['live']);
  });
});

describe('buildLiveActivity', () => {
  it('prioritizes error state and keeps a useful detail message', () => {
    expect(buildLiveActivity({
      status: 'error',
      diagnostics: { lastError: 'falha local' },
    })).toEqual({
      label: 'Erro',
      detail: 'falha local',
      tone: 'error',
    });
  });

  it('shows listening when the connected microphone level is meaningful', () => {
    expect(buildLiveActivity({
      status: 'connected',
      diagnostics: { microphoneLevel: 0.1 },
    }).label).toBe('Ouvindo');
  });
});

describe('buildSignalGroups', () => {
  it('groups diagnostics by operational meaning and clamps microphone percentage', () => {
    const groups = buildSignalGroups({
      microphone: 'enviando',
      screen: 'enviando',
      microphoneLevel: 2,
      connection: 'conectada',
      gemini: 'respondendo',
      outputAudioChunksReceived: 3,
      videoFramesSent: 7,
      audioChunksSent: 11,
      serverMessagesReceived: 13,
      successfulResumptions: 1,
      rehydratedReconnects: 2,
      lastCloseReason: 'nenhum',
    });

    expect(groups.map((group) => group.title)).toEqual(['Entrada', 'Modelo', 'Fluxo', 'Resiliencia']);
    expect(groups[0].items).toContainEqual(['Nivel', '100%']);
  });
});

describe('buildDebugSummaryCards', () => {
  it('builds compact debug cards from the normalized debug snapshot', () => {
    const cards = buildDebugSummaryCards({
      session: { status: 'connected', screenWidth: 1920, screenHeight: 1080 },
      diagnostics: {
        videoFramesSent: 10,
        audioChunksSent: 20,
        reconnectAttempts: 1,
        lastError: '-',
      },
    });

    expect(cards).toContainEqual(['Tela', '1920x1080']);
    expect(cards).toContainEqual(['Reconexoes', 1]);
  });
});
