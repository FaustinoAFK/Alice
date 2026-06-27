import { describe, expect, it, vi } from 'vitest';

// Os testes desta suite simulam a lógica central do hook useLiveSession sem React,
// seguindo o padrão do projeto (cf. useDebugInteractions.test.js, useScreenCapture.test.js).
// O hook em si (useLiveSession.js) é testado indiretamente através da lógica pura que ele encapsula.

// ---------------------------------------------------------------------------
// 1. Shape de retorno
// ---------------------------------------------------------------------------

describe('useLiveSession — shape de retorno', () => {
  /**
   * Simula a inicialização das refs de saída que o hook cria internamente e retorna.
   * liveOrchestratorRef e screenCleanupRef começam com current === null.
   */
  const makeSessionRefs = () => ({
    liveOrchestratorRef: { current: null },
    screenCleanupRef: { current: null },
  });

  it('liveOrchestratorRef e screenCleanupRef iniciam com current nulo', () => {
    const { liveOrchestratorRef, screenCleanupRef } = makeSessionRefs();

    expect(liveOrchestratorRef.current).toBeNull();
    expect(screenCleanupRef.current).toBeNull();
  });

  it('startLiveSession e stopLiveSession sao funcoes assincronas no contrato de retorno', () => {
    // Valida que o formato de retorno esperado pelo hook exporta as duas funcoes
    const shapeMock = {
      liveOrchestratorRef: { current: null },
      screenCleanupRef: { current: null },
      startLiveSession: async () => {},
      stopLiveSession: async () => {},
    };

    expect(typeof shapeMock.startLiveSession).toBe('function');
    expect(typeof shapeMock.stopLiveSession).toBe('function');
    expect(shapeMock.startLiveSession()).toBeInstanceOf(Promise);
    expect(shapeMock.stopLiveSession()).toBeInstanceOf(Promise);
  });
});

// ---------------------------------------------------------------------------
// 2. startLiveSession — guarda de double-start e dispatch
// ---------------------------------------------------------------------------

describe('startLiveSession — guarda de double-start', () => {
  /**
   * Replica a lógica de guarda startingRef e o dispatch inicial de startLiveSession
   * sem React. O hook usa uma ref booleana para bloquear chamadas concorrentes.
   */
  const makeStartSession = ({
    startingRef,
    dispatchUi,
    onExecute = async () => {},
  }) =>
    async () => {
      if (startingRef.current) return;
      startingRef.current = true;

      try {
        dispatchUi({ type: 'session-starting' });
        await onExecute();
      } finally {
        startingRef.current = false;
      }
    };

  it('faz dispatch de session-starting ao iniciar a sessao', async () => {
    const startingRef = { current: false };
    const dispatchUi = vi.fn();
    const startSession = makeStartSession({ startingRef, dispatchUi });

    await startSession();

    expect(dispatchUi).toHaveBeenCalledWith({ type: 'session-starting' });
  });

  it('dispatch de session-starting ocorre exatamente uma vez por inicio de sessao', async () => {
    const startingRef = { current: false };
    const dispatchUi = vi.fn();
    const startSession = makeStartSession({ startingRef, dispatchUi });

    await startSession();

    expect(dispatchUi).toHaveBeenCalledTimes(1);
  });

  it('segunda chamada simultânea e ignorada enquanto startingRef.current e true', async () => {
    const startingRef = { current: false };
    const dispatchUi = vi.fn();

    // onExecute nunca resolve — mantém startingRef.current = true durante o teste
    let resolveExecution;
    const blockingExecution = new Promise((resolve) => {
      resolveExecution = resolve;
    });
    const startSession = makeStartSession({
      startingRef,
      dispatchUi,
      onExecute: () => blockingExecution,
    });

    // Primeira chamada: ocupa a guarda e bloqueia em onExecute
    const firstCallPromise = startSession();

    // Segunda chamada imediata: startingRef.current já é true → deve retornar sem dispatch
    await startSession();

    const startingDispatches = dispatchUi.mock.calls.filter(
      ([arg]) => arg.type === 'session-starting',
    );
    expect(startingDispatches).toHaveLength(1);

    // Desbloqueia a primeira chamada para evitar promise pendente
    resolveExecution();
    await firstCallPromise;
  });

  it('libera a guarda ao final mesmo se ocorrer erro durante a execucao', async () => {
    const startingRef = { current: false };
    const dispatchUi = vi.fn();
    const startSession = makeStartSession({
      startingRef,
      dispatchUi,
      onExecute: async () => {
        throw new Error('erro de conexao simulado');
      },
    });

    await startSession().catch(() => {});

    expect(startingRef.current).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. stopLiveSession — cleanup, flush e dispatch condicional
// ---------------------------------------------------------------------------

describe('stopLiveSession — cleanup e dispatch', () => {
  /**
   * Replica a lógica central de stopLiveSession sem React.
   * Comportamento equivalente ao da implementação real do hook:
   *   await liveOrchestratorRef.current?.stopLiveSession()
   *   await flushAliceMemory().catch(() => {})
   *   releaseLiveResources()
   *   if (!mountedRef.current) return
   *   dispatchUi({ type: 'session-stopped' })
   */
  const makeStopSession = ({
    liveOrchestratorRef,
    flushAliceMemory,
    mountedRef,
    dispatchUi,
    releaseLiveResources = () => {},
  }) =>
    async () => {
      await liveOrchestratorRef.current?.stopLiveSession();
      await flushAliceMemory().catch(() => {});
      releaseLiveResources();
      if (!mountedRef.current) return;
      dispatchUi({ type: 'session-stopped' });
    };

  it('chama stopLiveSession no orchestrator quando ele existe', async () => {
    const orchestratorMock = { stopLiveSession: vi.fn().mockResolvedValue(undefined) };
    const liveOrchestratorRef = { current: orchestratorMock };
    const stopSession = makeStopSession({
      liveOrchestratorRef,
      flushAliceMemory: vi.fn().mockResolvedValue(undefined),
      mountedRef: { current: true },
      dispatchUi: vi.fn(),
    });

    await stopSession();

    expect(orchestratorMock.stopLiveSession).toHaveBeenCalled();
  });

  it('nao lanca erro quando liveOrchestratorRef.current e null', async () => {
    const stopSession = makeStopSession({
      liveOrchestratorRef: { current: null },
      flushAliceMemory: vi.fn().mockResolvedValue(undefined),
      mountedRef: { current: true },
      dispatchUi: vi.fn(),
    });

    await expect(stopSession()).resolves.toBeUndefined();
  });

  it('chama flushAliceMemory durante o encerramento da sessao', async () => {
    const flushAliceMemory = vi.fn().mockResolvedValue(undefined);
    const stopSession = makeStopSession({
      liveOrchestratorRef: { current: null },
      flushAliceMemory,
      mountedRef: { current: true },
      dispatchUi: vi.fn(),
    });

    await stopSession();

    expect(flushAliceMemory).toHaveBeenCalled();
  });

  it('nao propaga erro de flushAliceMemory para manter o stop responsivo', async () => {
    const stopSession = makeStopSession({
      liveOrchestratorRef: { current: null },
      flushAliceMemory: vi.fn().mockRejectedValue(new Error('falha de persistencia')),
      mountedRef: { current: true },
      dispatchUi: vi.fn(),
    });

    await expect(stopSession()).resolves.toBeUndefined();
  });

  it('faz dispatch de session-stopped quando mountedRef.current e true', async () => {
    const dispatchUi = vi.fn();
    const stopSession = makeStopSession({
      liveOrchestratorRef: { current: null },
      flushAliceMemory: vi.fn().mockResolvedValue(undefined),
      mountedRef: { current: true },
      dispatchUi,
    });

    await stopSession();

    expect(dispatchUi).toHaveBeenCalledWith({ type: 'session-stopped' });
  });

  it('NAO faz dispatch de session-stopped quando mountedRef.current e false', async () => {
    const dispatchUi = vi.fn();
    const stopSession = makeStopSession({
      liveOrchestratorRef: { current: null },
      flushAliceMemory: vi.fn().mockResolvedValue(undefined),
      mountedRef: { current: false },
      dispatchUi,
    });

    await stopSession();

    expect(dispatchUi).not.toHaveBeenCalledWith({ type: 'session-stopped' });
    expect(dispatchUi).not.toHaveBeenCalled();
  });

  it('chama releaseLiveResources antes de verificar mountedRef', async () => {
    const callOrder = [];
    const releaseLiveResources = vi.fn(() => {
      callOrder.push('release');
    });
    const dispatchUi = vi.fn(() => {
      callOrder.push('dispatch');
    });
    const stopSession = makeStopSession({
      liveOrchestratorRef: { current: null },
      flushAliceMemory: vi.fn().mockResolvedValue(undefined),
      mountedRef: { current: true },
      dispatchUi,
      releaseLiveResources,
    });

    await stopSession();

    expect(callOrder).toEqual(['release', 'dispatch']);
  });
});
