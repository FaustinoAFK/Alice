export const createFunctionResponseEnvelope = (functionCall, response) => ({
  id: functionCall.id,
  name: functionCall.name,
  response,
});

export class LiveSessionTransport {
  constructor() {
    this.activeSession = null;
    this.activeGeneration = 0;
    this.frozen = false;
    this.pendingToolResponses = new Map();
    this.acceptedToolResponseGenerations = new Set();
  }

  getActiveGeneration() {
    return this.activeGeneration;
  }

  isFrozen() {
    return this.frozen;
  }

  canSendToLive(generation) {
    return Boolean(this.activeSession) && !this.frozen && generation === this.activeGeneration;
  }

  beginReconnect() {
    this.frozen = true;
    this.activeSession = null;
  }

  activateSession({
    session,
    generation,
    replayPendingToolResponses = true,
    preserveAcceptedToolResponseGenerations = false,
  }) {
    this.activeSession = session || null;
    this.activeGeneration = generation || 0;
    this.frozen = false;
    this.acceptedToolResponseGenerations = preserveAcceptedToolResponseGenerations
      ? new Set([...this.acceptedToolResponseGenerations, this.activeGeneration])
      : new Set([this.activeGeneration]);

    if (!replayPendingToolResponses) {
      this.pendingToolResponses.clear();
      return [];
    }

    return this.flushPendingToolResponses();
  }

  clear() {
    this.activeSession = null;
    this.activeGeneration = 0;
    this.frozen = false;
    this.pendingToolResponses.clear();
    this.acceptedToolResponseGenerations.clear();
  }

  sendRealtime({ generation, send }) {
    if (!this.canSendToLive(generation)) {
      return false;
    }

    send(this.activeSession);
    return true;
  }

  sendToolResponse({ generation, functionResponse }) {
    if (
      this.activeSession &&
      !this.frozen &&
      this.acceptedToolResponseGenerations.has(generation)
    ) {
      this.activeSession.sendToolResponse([functionResponse]);
      return { delivered: true, queued: false };
    }

    if (!this.frozen) {
      return { delivered: false, queued: false };
    }

    this.pendingToolResponses.set(functionResponse.id, functionResponse);
    return { delivered: false, queued: true };
  }

  cancelPendingToolResponses(ids = []) {
    ids.forEach((id) => {
      this.pendingToolResponses.delete(id);
    });
  }

  flushPendingToolResponses() {
    if (!this.activeSession || this.frozen || this.pendingToolResponses.size === 0) {
      return [];
    }

    const functionResponses = [...this.pendingToolResponses.values()];
    this.pendingToolResponses.clear();
    this.activeSession.sendToolResponse(functionResponses);
    return functionResponses;
  }
}
