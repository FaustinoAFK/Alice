import { afterEach, describe, expect, it, vi } from 'vitest';
import { NativeGeminiLiveSession, NATIVE_LIVE_EVENTS } from './nativeGeminiLive';

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

const createNativeHarness = () => {
  const calls = [];
  const handlers = new Map();
  const unlisteners = [];
  const invokeFn = vi.fn(async (command, args) => {
    calls.push({ command, args });
  });
  const listenFn = vi.fn(async (eventName, handler) => {
    handlers.set(eventName, handler);
    const unlisten = vi.fn();
    unlisteners.push(unlisten);
    return unlisten;
  });

  return {
    calls,
    handlers,
    invokeFn,
    listenFn,
    unlisteners,
    emit(eventName, value, sessionId = 'session-1') {
      handlers.get(eventName)?.({
        payload: {
          sessionId,
          value,
        },
      });
    },
  };
};

describe('NativeGeminiLiveSession', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses Tauri-safe event names without URL-like separators', () => {
    expect(Object.values(NATIVE_LIVE_EVENTS)).toEqual([
      'alice-gemini-live-message',
      'alice-gemini-live-error',
      'alice-gemini-live-close',
    ]);
    expect(Object.values(NATIVE_LIVE_EVENTS).every((eventName) => !eventName.includes('://'))).toBe(true);
  });

  it('starts the native Live bridge with setup but without exposing an API-key URL', async () => {
    const harness = createNativeHarness();
    const session = new NativeGeminiLiveSession({
      setup: { model: 'models/demo' },
      sessionId: 'session-1',
      invokeFn: harness.invokeFn,
      listenFn: harness.listenFn,
    });

    const connectPromise = session.connect();
    await flushMicrotasks();

    expect(harness.calls[0]).toEqual({
      command: 'start_gemini_live_session',
      args: {
        sessionId: 'session-1',
        setup: { model: 'models/demo' },
      },
    });
    expect(JSON.stringify(harness.calls[0])).not.toContain('key=');

    harness.emit(NATIVE_LIVE_EVENTS.message, { setupComplete: {} });
    await connectPromise;

    expect(session.getConnectionState()).toBe('active');
  });

  it('forwards Live API events from native Tauri events', async () => {
    const harness = createNativeHarness();
    const callbackState = {
      events: [],
      statuses: [],
      goAwayEvents: [],
      resumptionUpdates: [],
    };
    const session = new NativeGeminiLiveSession({
      setup: { model: 'models/demo' },
      sessionId: 'session-1',
      invokeFn: harness.invokeFn,
      listenFn: harness.listenFn,
      onEvent: (event) => callbackState.events.push(event),
      onStatus: (status) => callbackState.statuses.push(status),
      onGoAway: (goAway) => callbackState.goAwayEvents.push(goAway),
      onSessionResumptionUpdate: (update) => callbackState.resumptionUpdates.push(update),
    });

    const connectPromise = session.connect();
    await flushMicrotasks();
    harness.emit(NATIVE_LIVE_EVENTS.message, {
      setupComplete: {},
      goAway: { timeLeft: '30s' },
      sessionResumptionUpdate: { newHandle: 'handle-1', resumable: true },
    });
    await connectPromise;

    expect(callbackState.statuses).toEqual(['configuring', 'connected']);
    expect(callbackState.events[0].setupComplete).toBe(true);
    expect(callbackState.goAwayEvents).toEqual([{ timeLeft: '30s' }]);
    expect(callbackState.resumptionUpdates).toEqual([
      { newHandle: 'handle-1', resumable: true },
    ]);
  });

  it('sends client messages through the native bridge after setup', async () => {
    const harness = createNativeHarness();
    const session = new NativeGeminiLiveSession({
      setup: { model: 'models/demo' },
      sessionId: 'session-1',
      invokeFn: harness.invokeFn,
      listenFn: harness.listenFn,
    });

    const connectPromise = session.connect();
    await flushMicrotasks();
    harness.emit(NATIVE_LIVE_EVENTS.message, { setupComplete: {} });
    await connectPromise;

    session.sendText('ola');

    expect(harness.calls.at(-1)).toEqual({
      command: 'send_gemini_live_message',
      args: {
        sessionId: 'session-1',
        message: {
          clientContent: {
            turns: [{ role: 'user', parts: [{ text: 'ola' }] }],
            turnComplete: true,
          },
        },
      },
    });
  });

  it('closes the native bridge and removes event listeners', async () => {
    const harness = createNativeHarness();
    const session = new NativeGeminiLiveSession({
      setup: { model: 'models/demo' },
      sessionId: 'session-1',
      invokeFn: harness.invokeFn,
      listenFn: harness.listenFn,
    });

    const connectPromise = session.connect();
    await flushMicrotasks();
    harness.emit(NATIVE_LIVE_EVENTS.message, { setupComplete: {} });
    await connectPromise;

    session.close();

    expect(harness.calls.at(-1)).toEqual({
      command: 'close_gemini_live_session',
      args: { sessionId: 'session-1' },
    });
    expect(harness.unlisteners.every((unlisten) => unlisten.mock.calls.length === 1)).toBe(true);
    expect(session.getConnectionState()).toBe('stopped');
  });

  it('cleans up listeners and closes native session on setup timeout', async () => {
    vi.useFakeTimers();
    const harness = createNativeHarness();
    const session = new NativeGeminiLiveSession({
      setup: { model: 'models/demo' },
      sessionId: 'session-1',
      invokeFn: harness.invokeFn,
      listenFn: harness.listenFn,
    });

    const connectPromise = session.connect();
    await Promise.resolve();
    const rejectionExpectation = expect(connectPromise).rejects.toMatchObject({
      message: 'Tempo esgotado aguardando setup da Gemini Live API.',
    });
    await vi.advanceTimersByTimeAsync(15000);
    await rejectionExpectation;

    expect(harness.calls.at(-1)).toEqual({
      command: 'close_gemini_live_session',
      args: { sessionId: 'session-1' },
    });
    expect(harness.unlisteners.every((unlisten) => unlisten.mock.calls.length === 1)).toBe(true);
    expect(session.getConnectionState()).toBe('failed');
  });
});
