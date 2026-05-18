import { LIVE_CLOSE_REASONS } from './geminiLive';

export const GO_AWAY_RENEW_BUFFER_MS = 5000;
export const MAX_SETUP_TIMEOUT_RETRIES = 1;
const timerHost = globalThis.window || globalThis;

export const parseDurationToMs = (durationText) => {
  const match = /^(-?\d+(?:\.\d+)?)s$/.exec(String(durationText || '').trim());
  if (!match) {
    return 0;
  }

  return Math.max(0, Math.round(Number.parseFloat(match[1]) * 1000));
};

export class LiveSessionOrchestrator {
  constructor({
    buildSetup,
    createSession,
    getMemoryPrefixTurns = async () => [],
    onEvent = () => {},
    onStatus = () => {},
    onError = () => {},
    onGoAway = () => {},
    onPrepareReconnect = async () => {},
    onSessionReady = async () => {},
    onCloseReason = () => {},
    onSessionResumptionUpdate = () => {},
    goAwayRenewBufferMs = GO_AWAY_RENEW_BUFFER_MS,
    maxSetupTimeoutRetries = MAX_SETUP_TIMEOUT_RETRIES,
  }) {
    this.buildSetup = buildSetup;
    this.createSession = createSession;
    this.getMemoryPrefixTurns = getMemoryPrefixTurns;
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.onError = onError;
    this.onGoAway = onGoAway;
    this.onPrepareReconnect = onPrepareReconnect;
    this.onSessionReady = onSessionReady;
    this.onCloseReason = onCloseReason;
    this.onSessionResumptionUpdate = onSessionResumptionUpdate;
    this.goAwayRenewBufferMs = goAwayRenewBufferMs;
    this.maxSetupTimeoutRetries = maxSetupTimeoutRetries;

    this.currentSession = null;
    this.resumptionHandle = '';
    this.manualStopRequested = false;
    this.reconnectPromise = null;
    this.reconnectTimer = null;
    this.lifecycleToken = 0;
    this.connectionGeneration = 0;
    this.sessionStates = new WeakMap();
  }

  getCurrentSession() {
    return this.currentSession;
  }

  getResumptionHandle() {
    return this.resumptionHandle;
  }

  getConnectionGeneration() {
    return this.connectionGeneration;
  }

  async startLiveSession() {
    this.clearReconnectTimer();
    this.manualStopRequested = false;
    this.lifecycleToken += 1;
    return this.connectWithRecovery('fresh', this.lifecycleToken, true);
  }

  async renewLiveConnection() {
    if (!this.resumptionHandle) {
      return this.reconnectWithFallback('rehydrate', false);
    }

    return this.reconnectWithFallback('resume');
  }

  async resumeLiveSession() {
    if (!this.resumptionHandle) {
      return this.reconnectWithFallback('rehydrate', false);
    }

    return this.reconnectWithFallback('resume');
  }

  async restartLiveSessionWithRehydration() {
    return this.reconnectWithFallback('rehydrate', false);
  }

  handleGoAway(goAway) {
    if (this.manualStopRequested) {
      return;
    }

    const delayMs = Math.max(0, parseDurationToMs(goAway?.timeLeft) - this.goAwayRenewBufferMs);
    this.clearReconnectTimer();
    this.reconnectTimer = timerHost.setTimeout(() => {
      this.renewLiveConnection().catch((error) => {
        this.onError(error);
      });
    }, delayMs);
  }

  async handleSocketClose(closeReason, session = this.currentSession) {
    if (this.manualStopRequested || closeReason === LIVE_CLOSE_REASONS.manualStop) {
      return null;
    }

    if (session && this.currentSession === session) {
      this.currentSession = null;
    }

    this.clearReconnectTimer();

    if (closeReason === LIVE_CLOSE_REASONS.resumptionRejected) {
      this.resumptionHandle = '';
      return this.restartLiveSessionWithRehydration();
    }

    if (closeReason === LIVE_CLOSE_REASONS.setupTimeout) {
      return this.handleSetupFailure();
    }

    if (!this.resumptionHandle) {
      return this.restartLiveSessionWithRehydration();
    }

    return this.resumeLiveSession();
  }

  async handleSetupFailure() {
    if (this.manualStopRequested) {
      return null;
    }

    return this.restartLiveSessionWithRehydration();
  }

  async stopLiveSession() {
    this.manualStopRequested = true;
    this.lifecycleToken += 1;
    this.resumptionHandle = '';
    this.clearReconnectTimer();

    const session = this.currentSession;
    this.currentSession = null;
    if (session) {
      session.close();
    }

    this.connectionGeneration = 0;
    this.onStatus('idle');
    return null;
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      timerHost.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  async reconnectWithFallback(primaryMode, allowFallback = true) {
    if (this.reconnectPromise) {
      return this.reconnectPromise;
    }

    this.reconnectPromise = this.performReconnect(primaryMode, allowFallback).finally(() => {
      this.reconnectPromise = null;
    });

    return this.reconnectPromise;
  }

  async performReconnect(primaryMode, allowFallback) {
    const reconnectToken = this.lifecycleToken;
    this.onStatus('reconnecting');
    await this.onPrepareReconnect({ mode: primaryMode });

    try {
      return await this.connectWithRecovery(primaryMode, reconnectToken, allowFallback);
    } catch (primaryError) {
      this.onError(primaryError);
      this.onStatus('error');
      throw primaryError;
    }
  }

  getErrorCloseReason(error) {
    return error?.liveCloseReason || '';
  }

  shouldRetrySetupTimeout(error, attempt) {
    return (
      !this.manualStopRequested &&
      this.getErrorCloseReason(error) === LIVE_CLOSE_REASONS.setupTimeout &&
      attempt < this.maxSetupTimeoutRetries
    );
  }

  async connectWithRecovery(mode, token, allowFallback, attempt = 0) {
    try {
      return await this.connectWithMode(mode, token);
    } catch (error) {
      if (this.shouldRetrySetupTimeout(error, attempt)) {
        return this.connectWithRecovery(mode, token, allowFallback, attempt + 1);
      }

      if (this.getErrorCloseReason(error) === LIVE_CLOSE_REASONS.resumptionRejected) {
        this.resumptionHandle = '';
      }

      if (allowFallback && mode !== 'rehydrate' && !this.manualStopRequested) {
        return this.connectWithRecovery('rehydrate', token, false);
      }

      throw error;
    }
  }

  async connectWithMode(mode, token) {
    const nextGeneration = this.connectionGeneration + 1;
    const initialHistoryTurns = await this.getMemoryPrefixTurns({ mode });
    const setup = this.buildSetup({
      resumptionHandle: mode === 'resume' ? this.resumptionHandle : '',
      memoryPrefixTurns: initialHistoryTurns,
    });
    const previousSession = this.currentSession;

    const session = this.createSession({
      setup,
      onEvent: (event, message) => {
        if (this.currentSession !== session) {
          return;
        }

        this.onEvent(event, message, session, nextGeneration);
      },
      onStatus: (status) => {
        if (status === 'configuring') {
          this.onStatus(mode === 'fresh' ? 'configuring' : 'reconnecting');
        } else if (status === 'connected') {
          this.onStatus('connected');
        } else if (status === 'error') {
          this.onStatus('error');
        }
      },
      onGoAway: (goAway) => {
        if (this.currentSession !== session) {
          return;
        }

        this.onGoAway(goAway);
        this.handleGoAway(goAway);
      },
      onSessionResumptionUpdate: (update) => {
        if (this.currentSession !== session) {
          return;
        }

        if (update?.resumable && update.newHandle) {
          this.resumptionHandle = update.newHandle;
        }
        this.onSessionResumptionUpdate(update);
      },
      onCloseReason: (reason, event) => {
        if (reason === LIVE_CLOSE_REASONS.resumptionRejected) {
          this.resumptionHandle = '';
        }

        this.onCloseReason(reason, event, session);
        if (this.sessionStates.get(session) !== 'active' && reason !== LIVE_CLOSE_REASONS.manualStop) {
          return;
        }

        if (this.currentSession !== session && reason !== LIVE_CLOSE_REASONS.manualStop) {
          return;
        }

        void this.handleSocketClose(reason, session);
      },
      onError: (error) => {
        if (this.sessionStates.get(session) !== 'active') {
          return;
        }

        this.onError(error);
      },
    });

    this.sessionStates.set(session, 'connecting');
    this.currentSession = session;

    try {
      await session.connect();
    } catch (error) {
      this.sessionStates.set(session, 'failed');
      if (this.currentSession === session) {
        this.currentSession = previousSession || null;
      }
      throw error;
    }

    if (this.manualStopRequested || token !== this.lifecycleToken) {
      this.sessionStates.set(session, 'stopped');
      session.close();
      if (this.currentSession === session) {
        this.currentSession = null;
      }
      return null;
    }

    if (previousSession && previousSession !== session) {
      previousSession.close();
    }

    if (initialHistoryTurns.length > 0) {
      session.sendClientContent(initialHistoryTurns, true);
    }

    this.sessionStates.set(session, 'active');
    this.connectionGeneration = nextGeneration;
    await this.onSessionReady({
      session,
      mode,
      generation: nextGeneration,
      resumed: mode === 'resume',
      rehydrated: mode === 'rehydrate',
    });

    return session;
  }
}
