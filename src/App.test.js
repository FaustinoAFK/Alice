import { describe, expect, it } from 'vitest';
import { createLiveDiagnostics } from './liveDiagnostics';
import { createInitialAppUiState, reduceAppUiState } from './appUiState';

const buildLiveUiState = () => ({
  ...createInitialAppUiState(),
  status: 'connected',
  caption: 'Estou vendo sua tela.',
  inputCaption: 'continua ai',
  diagnostics: {
    ...createLiveDiagnostics(),
    connection: 'conectada',
    gemini: 'respondendo',
    audioChunksSent: 7,
    videoFramesSent: 3,
    serverMessagesReceived: 5,
  },
});

describe('reduceAppUiState', () => {
  it('moves the UI into reconnecting without dropping captions or diagnostics', () => {
    const currentState = buildLiveUiState();

    const nextState = reduceAppUiState(currentState, {
      type: 'session-reconnecting',
      mode: 'resume',
    });

    expect(nextState.status).toBe('reconnecting');
    expect(nextState.caption).toBe('Estou vendo sua tela.');
    expect(nextState.diagnostics).toEqual(currentState.diagnostics);
    expect(nextState.sessionNotice).toBe('Conexao sendo renovada.');
  });

  it('returns to connected after renew without falling back to idle or clearing captions', () => {
    const reconnectingState = reduceAppUiState(buildLiveUiState(), {
      type: 'session-reconnecting',
      mode: 'resume',
    });

    const nextState = reduceAppUiState(reconnectingState, {
      type: 'session-ready',
      mode: 'resume',
      resumed: true,
      rehydrated: false,
    });

    expect(nextState.status).toBe('connected');
    expect(nextState.status).not.toBe('idle');
    expect(nextState.caption).toBe('Estou vendo sua tela.');
    expect(nextState.diagnostics).toEqual(reconnectingState.diagnostics);
    expect(nextState.sessionNotice).toBe('Conexao renovada.');
  });

  it('shows a discreet recovery notice after rehydration while preserving the last caption', () => {
    const reconnectingState = reduceAppUiState(buildLiveUiState(), {
      type: 'session-reconnecting',
      mode: 'rehydrate',
    });

    const nextState = reduceAppUiState(reconnectingState, {
      type: 'session-ready',
      mode: 'rehydrate',
      resumed: false,
      rehydrated: true,
    });

    expect(nextState.caption).toBe('Estou vendo sua tela.');
    expect(nextState.sessionNotice).toBe('Sessao reconectada com o contexto recente.');
  });

  it('stops the session UI cleanly when Parar is requested', () => {
    const nextState = reduceAppUiState(buildLiveUiState(), {
      type: 'session-stopped',
    });

    expect(nextState.status).toBe('stopped');
    expect(nextState.caption).toBe('Sessao encerrada. A Alice pode voltar quando voce quiser.');
    expect(nextState.inputCaption).toBe('');
    expect(nextState.sessionNotice).toBe('');
    expect(nextState.diagnostics).toEqual(createLiveDiagnostics());
  });
});
