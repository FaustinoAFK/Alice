import { describe, expect, it, vi } from 'vitest';
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

describe('startLiveSession double-start guard', () => {
  const makeStartLiveSession = ({ startingRef, onMediaAccess }) => async () => {
    if (startingRef.current) return;
    startingRef.current = true;

    try {
      await onMediaAccess();
    } finally {
      startingRef.current = false;
    }
  };

  it('ignores the second call while the first is still awaiting media access', async () => {
    const startingRef = { current: false };
    const onMediaAccess = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const startLiveSession = makeStartLiveSession({ startingRef, onMediaAccess });

    await Promise.all([startLiveSession(), startLiveSession()]);

    expect(onMediaAccess).toHaveBeenCalledTimes(1);
  });

  it('releases the lock after a successful start so a later call proceeds', async () => {
    const startingRef = { current: false };
    const onMediaAccess = vi.fn(async () => {});

    const startLiveSession = makeStartLiveSession({ startingRef, onMediaAccess });

    await startLiveSession();
    await startLiveSession();

    expect(onMediaAccess).toHaveBeenCalledTimes(2);
  });

  it('releases the lock even when media access throws', async () => {
    const startingRef = { current: false };
    const onMediaAccess = vi.fn(async () => {
      throw new Error('permission denied');
    });

    const startLiveSession = makeStartLiveSession({ startingRef, onMediaAccess });

    await startLiveSession().catch(() => {});
    await startLiveSession().catch(() => {});

    expect(onMediaAccess).toHaveBeenCalledTimes(2);
  });
});

describe('stopLiveSession mounted guard', () => {
  // Simula o padrao isMounted: dispatchUi so e chamado se o componente ainda estiver montado
  const makeStopLiveSession = ({ mountedRef, onStop, dispatchUi }) => async () => {
    await onStop();
    if (!mountedRef.current) return;
    dispatchUi({ type: 'session-stopped' });
  };

  it('does not call dispatchUi if the component unmounted before the stop Promise resolved', async () => {
    const mountedRef = { current: true };
    const dispatchUi = vi.fn();
    const onStop = vi.fn(async () => {
      // simula desmonte acontecendo durante a operacao assincrona
      mountedRef.current = false;
    });

    const stopLiveSession = makeStopLiveSession({ mountedRef, onStop, dispatchUi });
    await stopLiveSession();

    expect(dispatchUi).not.toHaveBeenCalled();
  });

  it('calls dispatchUi normally when the component remains mounted throughout stop', async () => {
    const mountedRef = { current: true };
    const dispatchUi = vi.fn();
    const onStop = vi.fn(async () => {});

    const stopLiveSession = makeStopLiveSession({ mountedRef, onStop, dispatchUi });
    await stopLiveSession();

    expect(dispatchUi).toHaveBeenCalledOnce();
    expect(dispatchUi).toHaveBeenCalledWith({ type: 'session-stopped' });
  });
});

describe('handleLiveEvent with tool calls', () => {
  // Simula apenas a logica de despacho de tool calls do handleLiveEvent real
  const makeHandleLiveEvent = ({ enqueueToolCalls, recordToolInteraction, rememberAliceContext }) =>
    (event, generation) => {
      if (event.outputTranscript) {
        rememberAliceContext({ inputTranscript: '', outputTranscript: event.outputTranscript });
      }

      if (event.toolCalls && event.toolCalls.length > 0) {
        event.toolCalls.forEach((toolCall) => recordToolInteraction(toolCall));
        enqueueToolCalls(event.toolCalls, generation);
      }
    };

  it('calls enqueueToolCalls when the event contains toolCalls', () => {
    const enqueueToolCalls = vi.fn();
    const recordToolInteraction = vi.fn(() => 'interaction-1');
    const rememberAliceContext = vi.fn();

    const handleLiveEvent = makeHandleLiveEvent({ enqueueToolCalls, recordToolInteraction, rememberAliceContext });
    const event = {
      toolCalls: [{ name: 'inspect_current_page', args: { question: 'teste' } }],
      audioChunks: [],
      outputTranscript: '',
    };

    handleLiveEvent(event, 1);

    expect(enqueueToolCalls).toHaveBeenCalledTimes(1);
    expect(enqueueToolCalls).toHaveBeenCalledWith(event.toolCalls, 1);
  });

  it('creates a tool interaction entry with kind=tool and status=running for each tool call', () => {
    const interactions = [];
    const enqueueToolCalls = vi.fn();
    const recordToolInteraction = vi.fn((toolCall) => {
      const entry = {
        kind: 'tool',
        status: 'running',
        toolName: toolCall.name,
        ok: null,
      };
      interactions.push(entry);
      return `id-${interactions.length}`;
    });
    const rememberAliceContext = vi.fn();

    const handleLiveEvent = makeHandleLiveEvent({ enqueueToolCalls, recordToolInteraction, rememberAliceContext });
    handleLiveEvent(
      { toolCalls: [{ name: 'inspect_current_page', args: { question: 'teste' } }], audioChunks: [], outputTranscript: '' },
      1,
    );

    expect(interactions).toHaveLength(1);
    expect(interactions[0]).toMatchObject({ kind: 'tool', status: 'running', toolName: 'inspect_current_page' });
  });

  it('does not call enqueueToolCalls when toolCalls is empty', () => {
    const enqueueToolCalls = vi.fn();
    const recordToolInteraction = vi.fn();
    const rememberAliceContext = vi.fn();

    const handleLiveEvent = makeHandleLiveEvent({ enqueueToolCalls, recordToolInteraction, rememberAliceContext });
    handleLiveEvent({ toolCalls: [], audioChunks: [], outputTranscript: '' }, 1);

    expect(enqueueToolCalls).not.toHaveBeenCalled();
  });
});

describe('handleLiveEvent memory cycle — rememberAliceContext', () => {
  // Simula apenas a logica de outputTranscript do handleLiveEvent real
  const makeHandleLiveEvent = ({ rememberAliceContext }) => (event) => {
    if (event.outputTranscript) {
      rememberAliceContext({ inputTranscript: '', outputTranscript: event.outputTranscript });
    }
  };

  it('calls rememberAliceContext with the correct outputTranscript', () => {
    const rememberAliceContext = vi.fn();
    const handleLiveEvent = makeHandleLiveEvent({ rememberAliceContext });

    handleLiveEvent({ outputTranscript: 'resposta da alice', toolCalls: [], audioChunks: [] });

    expect(rememberAliceContext).toHaveBeenCalledTimes(1);
    expect(rememberAliceContext).toHaveBeenCalledWith(
      expect.objectContaining({ outputTranscript: 'resposta da alice' }),
    );
  });

  it('does not call rememberAliceContext when outputTranscript is absent', () => {
    const rememberAliceContext = vi.fn();
    const handleLiveEvent = makeHandleLiveEvent({ rememberAliceContext });

    handleLiveEvent({ outputTranscript: '', toolCalls: [], audioChunks: [] });

    expect(rememberAliceContext).not.toHaveBeenCalled();
  });
});
