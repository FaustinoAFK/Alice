import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIVE_CLOSE_REASONS } from './geminiLive';
import {
  GO_AWAY_RENEW_BUFFER_MS,
  LiveSessionOrchestrator,
  parseDurationToMs,
} from './liveSessionOrchestrator';

const buildSetupStub = ({ resumptionHandle = '', memoryPrefixTurns = [] } = {}) => {
  const setup = {
    model: 'models/demo',
    contextWindowCompression: { slidingWindow: {} },
  };

  if (resumptionHandle) {
    setup.sessionResumption = { handle: resumptionHandle };
  }

  if (memoryPrefixTurns.length > 0) {
    setup.historyConfig = {
      initialHistoryInClientContent: true,
    };
  }

  return setup;
};

const buildConnectError = (message, liveCloseReason) => {
  const error = new Error(message);
  error.liveCloseReason = liveCloseReason;
  return error;
};

const createSessionFactory = ({ connectBehaviors = [] } = {}) => {
  const sessions = [];
  let connectIndex = 0;

  const createSession = vi.fn((options) => {
    const behavior = connectBehaviors[connectIndex] || {};
    connectIndex += 1;

    const session = {
      id: `session-${sessions.length + 1}`,
      setup: options.setup,
      options,
      connect: vi.fn(async () => {
        if (behavior.connectError) {
          throw behavior.connectError;
        }

        await behavior.connect?.();
      }),
      sendClientContent: vi.fn(() => {}),
      close: vi.fn(() => {}),
    };

    sessions.push(session);
    return session;
  });

  return {
    sessions,
    createSession,
  };
};

describe('parseDurationToMs', () => {
  it('converts Live API duration strings to milliseconds', () => {
    expect(parseDurationToMs('1.5s')).toBe(1500);
  });

  it('returns zero for invalid duration payloads', () => {
    expect(parseDurationToMs('nope')).toBe(0);
  });
});

describe('LiveSessionOrchestrator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('schedules a renew after goAway using the latest resumption handle', async () => {
    const sessionReady = vi.fn();
    const { createSession, sessions } = createSessionFactory();
    const orchestrator = new LiveSessionOrchestrator({
      buildSetup: buildSetupStub,
      createSession,
      onSessionReady: sessionReady,
    });

    await orchestrator.startLiveSession();
    sessions[0].options.onSessionResumptionUpdate({
      newHandle: 'handle-1',
      resumable: true,
    });

    orchestrator.handleGoAway({ timeLeft: '7s' });
    await vi.advanceTimersByTimeAsync(1999);
    expect(createSession).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2001);

    expect(createSession).toHaveBeenCalledTimes(2);
    expect(sessions[1].setup.sessionResumption).toEqual({ handle: 'handle-1' });
    expect(sessions[0].close).toHaveBeenCalledTimes(1);
    expect(sessionReady).toHaveBeenLastCalledWith({
      session: sessions[1],
      mode: 'resume',
      generation: 2,
      resumed: true,
      rehydrated: false,
    });
  });

  it('runs only one reconnect at a time even with concurrent resume requests', async () => {
    let resolveReconnect;
    const reconnectGate = new Promise((resolve) => {
      resolveReconnect = resolve;
    });
    const { createSession, sessions } = createSessionFactory({
      connectBehaviors: [{}, { connect: () => reconnectGate }],
    });
    const orchestrator = new LiveSessionOrchestrator({
      buildSetup: buildSetupStub,
      createSession,
    });

    await orchestrator.startLiveSession();
    sessions[0].options.onSessionResumptionUpdate({
      newHandle: 'handle-2',
      resumable: true,
    });

    const firstReconnect = orchestrator.resumeLiveSession();
    const secondReconnect = orchestrator.resumeLiveSession();
    await Promise.resolve();
    await Promise.resolve();

    expect(createSession).toHaveBeenCalledTimes(2);

    resolveReconnect();
    await Promise.all([firstReconnect, secondReconnect]);
    expect(sessions[0].close).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending goAway renew when the user stops manually', async () => {
    const statusUpdates = [];
    const { createSession, sessions } = createSessionFactory();
    const orchestrator = new LiveSessionOrchestrator({
      buildSetup: buildSetupStub,
      createSession,
      onStatus: (status) => statusUpdates.push(status),
    });

    await orchestrator.startLiveSession();
    sessions[0].options.onSessionResumptionUpdate({
      newHandle: 'handle-3',
      resumable: true,
    });

    orchestrator.handleGoAway({ timeLeft: `${(GO_AWAY_RENEW_BUFFER_MS + 500) / 1000}s` });
    await orchestrator.stopLiveSession();
    await vi.runAllTimersAsync();

    expect(createSession).toHaveBeenCalledTimes(1);
    expect(orchestrator.getResumptionHandle()).toBe('');
    expect(statusUpdates.at(-1)).toBe('idle');
    expect(sessions[0].close).toHaveBeenCalledTimes(1);
  });

  it('reports the closing session to the close callback during overlap reconnects', async () => {
    const closeEvents = [];
    const { createSession, sessions } = createSessionFactory();
    const orchestrator = new LiveSessionOrchestrator({
      buildSetup: buildSetupStub,
      createSession,
      onCloseReason: (reason, _event, session) => {
        closeEvents.push({ reason, sessionId: session?.id || '' });
      },
    });

    await orchestrator.startLiveSession();
    sessions[0].options.onCloseReason(LIVE_CLOSE_REASONS.remoteClose, { code: 1006, reason: '' });
    await Promise.resolve();

    expect(closeEvents).toEqual([
      {
        reason: LIVE_CLOSE_REASONS.remoteClose,
        sessionId: 'session-1',
      },
    ]);
  });

  it('falls back to rehydration when a resume attempt fails', async () => {
    const memoryPrefixTurns = [{ role: 'user', parts: [{ text: 'Resumo local.' }] }];
    const sessionReady = vi.fn();
    const { createSession, sessions } = createSessionFactory({
      connectBehaviors: [{}, { connectError: new Error('resume failed') }, {}],
    });
    const orchestrator = new LiveSessionOrchestrator({
      buildSetup: buildSetupStub,
      createSession,
      getMemoryPrefixTurns: vi.fn(async () => memoryPrefixTurns),
      onSessionReady: sessionReady,
    });

    await orchestrator.startLiveSession();
    sessions[0].options.onSessionResumptionUpdate({
      newHandle: 'handle-4',
      resumable: true,
    });

    await orchestrator.resumeLiveSession();

    expect(createSession).toHaveBeenCalledTimes(3);
    expect(sessions[1].setup.sessionResumption).toEqual({ handle: 'handle-4' });
    expect(sessions[2].setup.historyConfig).toEqual({
      initialHistoryInClientContent: true,
    });
    expect(sessions[2].setup).not.toHaveProperty('sessionResumption');
    expect(sessions[2].sendClientContent).toHaveBeenCalledWith(memoryPrefixTurns, true);
    expect(sessionReady).toHaveBeenLastCalledWith({
      session: sessions[2],
      mode: 'rehydrate',
      generation: 2,
      resumed: false,
      rehydrated: true,
    });
  });

  it('starts a new session with local memory immediately when no resumption handle exists', async () => {
    const memoryPrefixTurns = [{ role: 'user', parts: [{ text: 'Memoria local.' }] }];
    const { createSession, sessions } = createSessionFactory();
    const orchestrator = new LiveSessionOrchestrator({
      buildSetup: buildSetupStub,
      createSession,
      getMemoryPrefixTurns: vi.fn(async () => memoryPrefixTurns),
    });

    await orchestrator.startLiveSession();
    await orchestrator.resumeLiveSession();

    expect(createSession).toHaveBeenCalledTimes(2);
    expect(sessions[1].setup.historyConfig).toEqual({
      initialHistoryInClientContent: true,
    });
    expect(sessions[1].setup).not.toHaveProperty('sessionResumption');
    expect(sessions[1].sendClientContent).toHaveBeenCalledWith(memoryPrefixTurns, true);
  });

  it('clears an invalid resumption handle and falls back to rehydration', async () => {
    const memoryPrefixTurns = [{ role: 'user', parts: [{ text: 'Resumo local.' }] }];
    const { createSession, sessions } = createSessionFactory();
    const orchestrator = new LiveSessionOrchestrator({
      buildSetup: buildSetupStub,
      createSession,
      getMemoryPrefixTurns: vi.fn(async () => memoryPrefixTurns),
    });

    await orchestrator.startLiveSession();
    sessions[0].options.onSessionResumptionUpdate({
      newHandle: 'handle-invalido',
      resumable: true,
    });

    await orchestrator.handleSocketClose(LIVE_CLOSE_REASONS.resumptionRejected, sessions[0]);

    expect(orchestrator.getResumptionHandle()).toBe('');
    expect(createSession).toHaveBeenCalledTimes(2);
    expect(sessions[1].setup.historyConfig).toEqual({
      initialHistoryInClientContent: true,
    });
    expect(sessions[1].setup).not.toHaveProperty('sessionResumption');
    expect(sessions[1].sendClientContent).toHaveBeenCalledWith(memoryPrefixTurns, true);
  });

  it('retries one setup timeout before falling back to rehydration', async () => {
    const memoryPrefixTurns = [{ role: 'user', parts: [{ text: 'Resumo local.' }] }];
    const { createSession, sessions } = createSessionFactory({
      connectBehaviors: [
        {},
        {
          connectError: buildConnectError(
            'Tempo esgotado aguardando setup da Gemini Live API.',
            LIVE_CLOSE_REASONS.setupTimeout,
          ),
        },
        {
          connectError: buildConnectError(
            'Tempo esgotado aguardando setup da Gemini Live API.',
            LIVE_CLOSE_REASONS.setupTimeout,
          ),
        },
        {},
      ],
    });
    const orchestrator = new LiveSessionOrchestrator({
      buildSetup: buildSetupStub,
      createSession,
      getMemoryPrefixTurns: vi.fn(async () => memoryPrefixTurns),
    });

    await orchestrator.startLiveSession();
    sessions[0].options.onSessionResumptionUpdate({
      newHandle: 'handle-timeout',
      resumable: true,
    });

    await orchestrator.resumeLiveSession();

    expect(createSession).toHaveBeenCalledTimes(4);
    expect(sessions[1].setup.sessionResumption).toEqual({ handle: 'handle-timeout' });
    expect(sessions[2].setup.sessionResumption).toEqual({ handle: 'handle-timeout' });
    expect(sessions[3].setup.historyConfig).toEqual({
      initialHistoryInClientContent: true,
    });
    expect(sessions[3].setup).not.toHaveProperty('sessionResumption');
    expect(sessions[3].sendClientContent).toHaveBeenCalledWith(memoryPrefixTurns, true);
  });

  it('resumes automatically after an unexpected close reason', async () => {
    const closeReasons = [];
    const { createSession, sessions } = createSessionFactory();
    const orchestrator = new LiveSessionOrchestrator({
      buildSetup: buildSetupStub,
      createSession,
      onCloseReason: (reason) => closeReasons.push(reason),
    });

    await orchestrator.startLiveSession();
    sessions[0].options.onSessionResumptionUpdate({
      newHandle: 'handle-5',
      resumable: true,
    });

    sessions[0].options.onCloseReason(LIVE_CLOSE_REASONS.remoteClose, { code: 1006, reason: '' });
    await Promise.resolve();
    await Promise.resolve();

    expect(closeReasons).toEqual([LIVE_CLOSE_REASONS.remoteClose]);
    expect(createSession).toHaveBeenCalledTimes(2);
    expect(sessions[1].setup.sessionResumption).toEqual({ handle: 'handle-5' });
  });

  it('increments the connection generation every time a new session becomes active', async () => {
    const sessionReady = vi.fn();
    const { createSession, sessions } = createSessionFactory();
    const orchestrator = new LiveSessionOrchestrator({
      buildSetup: buildSetupStub,
      createSession,
      onSessionReady: sessionReady,
    });

    await orchestrator.startLiveSession();
    sessions[0].options.onSessionResumptionUpdate({
      newHandle: 'handle-6',
      resumable: true,
    });
    await orchestrator.resumeLiveSession();

    expect(orchestrator.getConnectionGeneration()).toBe(2);
    expect(sessionReady).toHaveBeenNthCalledWith(1, {
      session: sessions[0],
      mode: 'fresh',
      generation: 1,
      resumed: false,
      rehydrated: false,
    });
    expect(sessionReady).toHaveBeenNthCalledWith(2, {
      session: sessions[1],
      mode: 'resume',
      generation: 2,
      resumed: true,
      rehydrated: false,
    });
  });

  it('includes the actual attempt limit in the max-attempts error message', async () => {
    const errors = [];
    const { createSession } = createSessionFactory({
      connectBehaviors: [
        {},
        { connectError: buildConnectError('network failure') },
      ],
    });

    const orchestrator = new LiveSessionOrchestrator({
      buildSetup: buildSetupStub,
      createSession,
      onError: (error) => errors.push(error),
      reconnectMaxAttempts: 1,
      reconnectBaseDelayMs: 0,
      reconnectJitterFactor: 0,
    });

    await orchestrator.startLiveSession();
    await orchestrator.reconnectWithFallback('rehydrate').catch(() => {});

    expect(errors[0].message).toMatch(/Max reconnect attempts \(1\) reached/);
  });
});
