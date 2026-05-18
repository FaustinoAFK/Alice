import { describe, expect, it, vi } from 'vitest';
import {
  createFunctionResponseEnvelope,
  LiveSessionTransport,
} from './liveSessionTransport';

describe('createFunctionResponseEnvelope', () => {
  it('builds a Gemini tool response envelope from a function call', () => {
    expect(
      createFunctionResponseEnvelope(
        { id: 'call-1', name: 'local_tool' },
        { ok: true, message: 'Tudo certo.' },
      ),
    ).toEqual({
      id: 'call-1',
      name: 'local_tool',
      response: { ok: true, message: 'Tudo certo.' },
    });
  });
});

describe('LiveSessionTransport', () => {
  it('only allows realtime sends for the active generation when not frozen', () => {
    const transport = new LiveSessionTransport();
    const session = { sendAudio: vi.fn() };

    transport.activateSession({ session, generation: 3 });

    expect(
      transport.sendRealtime({
        generation: 2,
        send: (activeSession) => activeSession.sendAudio('old-chunk'),
      }),
    ).toBe(false);

    expect(
      transport.sendRealtime({
        generation: 3,
        send: (activeSession) => activeSession.sendAudio('new-chunk'),
      }),
    ).toBe(true);
    expect(session.sendAudio).toHaveBeenCalledWith('new-chunk');
  });

  it('freezes sends during reconnect and resumes on the next generation', () => {
    const transport = new LiveSessionTransport();
    const session = { sendVideo: vi.fn() };

    transport.activateSession({ session, generation: 1 });
    transport.beginReconnect();

    expect(
      transport.sendRealtime({
        generation: 1,
        send: (activeSession) => activeSession.sendVideo('frame'),
      }),
    ).toBe(false);
    expect(transport.isFrozen()).toBe(true);

    transport.activateSession({ session, generation: 2 });
    expect(
      transport.sendRealtime({
        generation: 2,
        send: (activeSession) => activeSession.sendVideo('frame-2'),
      }),
    ).toBe(true);
    expect(session.sendVideo).toHaveBeenCalledWith('frame-2');
  });

  it('keeps the current generation sending during a preserved reconnect handoff', () => {
    const transport = new LiveSessionTransport();
    const session = { sendAudio: vi.fn(), sendToolResponse: vi.fn() };

    transport.activateSession({ session, generation: 4 });
    transport.beginReconnect({ preserveActiveSession: true });

    expect(
      transport.sendRealtime({
        generation: 4,
        send: (activeSession) => activeSession.sendAudio('handoff-chunk'),
      }),
    ).toBe(true);

    expect(
      transport.sendToolResponse({
        generation: 4,
        functionResponse: createFunctionResponseEnvelope(
          { id: 'call-handoff', name: 'local_tool' },
          { ok: true, message: 'Ainda na sessao antiga.' },
        ),
      }),
    ).toEqual({ delivered: true, queued: false });

    expect(session.sendAudio).toHaveBeenCalledWith('handoff-chunk');
    expect(session.sendToolResponse).toHaveBeenCalledWith([
      {
        id: 'call-handoff',
        name: 'local_tool',
        response: { ok: true, message: 'Ainda na sessao antiga.' },
      },
    ]);
  });

  it('stops sending when the preserved session finally closes during reconnect', () => {
    const transport = new LiveSessionTransport();
    const session = { sendAudio: vi.fn() };

    transport.activateSession({ session, generation: 7 });
    transport.beginReconnect({ preserveActiveSession: true });
    transport.deactivateSession(session);

    expect(
      transport.sendRealtime({
        generation: 7,
        send: (activeSession) => activeSession.sendAudio('late-chunk'),
      }),
    ).toBe(false);
  });

  it('queues tool responses while reconnecting and replays them once on resume', () => {
    const previousSession = { sendToolResponse: vi.fn() };
    const resumedSession = { sendToolResponse: vi.fn() };
    const transport = new LiveSessionTransport();

    transport.activateSession({ session: previousSession, generation: 1 });
    transport.beginReconnect();

    const functionResponse = createFunctionResponseEnvelope(
      { id: 'call-2', name: 'local_tool' },
      { ok: true, message: 'Ferramenta executada.' },
    );

    expect(transport.sendToolResponse({ generation: 1, functionResponse })).toEqual({
      delivered: false,
      queued: true,
    });

    const replayedResponses = transport.activateSession({
      session: resumedSession,
      generation: 2,
      replayPendingToolResponses: true,
      preserveAcceptedToolResponseGenerations: true,
    });

    expect(replayedResponses).toEqual([functionResponse]);
    expect(resumedSession.sendToolResponse).toHaveBeenCalledWith([functionResponse]);
    expect(previousSession.sendToolResponse).not.toHaveBeenCalled();
  });

  it('drops pending tool responses when the session is recreated without replay', () => {
    const session = { sendToolResponse: vi.fn() };
    const recreatedSession = { sendToolResponse: vi.fn() };
    const transport = new LiveSessionTransport();

    transport.activateSession({ session, generation: 1 });
    transport.beginReconnect();
    transport.sendToolResponse({
      generation: 1,
        functionResponse: createFunctionResponseEnvelope(
        { id: 'call-3', name: 'local_tool' },
        { ok: true, message: 'Ferramenta executada.' },
      ),
    });

    const replayedResponses = transport.activateSession({
      session: recreatedSession,
      generation: 2,
      replayPendingToolResponses: false,
    });

    expect(replayedResponses).toEqual([]);
    expect(recreatedSession.sendToolResponse).not.toHaveBeenCalled();
  });

  it('cancels queued tool responses when Gemini cancels the function call', () => {
    const resumedSession = { sendToolResponse: vi.fn() };
    const transport = new LiveSessionTransport();

    transport.beginReconnect();
    transport.sendToolResponse({
      generation: 1,
        functionResponse: createFunctionResponseEnvelope(
        { id: 'call-4', name: 'local_tool' },
        { ok: false, message: 'Cancelado.' },
      ),
    });

    transport.cancelPendingToolResponses(['call-4']);
    transport.activateSession({
      session: resumedSession,
      generation: 2,
      replayPendingToolResponses: true,
    });

    expect(resumedSession.sendToolResponse).not.toHaveBeenCalled();
  });

  it('still delivers a late tool response from an older generation after a resumed session becomes active', () => {
    const firstSession = { sendToolResponse: vi.fn() };
    const resumedSession = { sendToolResponse: vi.fn() };
    const transport = new LiveSessionTransport();

    transport.activateSession({ session: firstSession, generation: 1 });
    transport.beginReconnect();
    transport.activateSession({
      session: resumedSession,
      generation: 2,
      replayPendingToolResponses: true,
      preserveAcceptedToolResponseGenerations: true,
    });

    const result = transport.sendToolResponse({
      generation: 1,
        functionResponse: createFunctionResponseEnvelope(
        { id: 'call-5', name: 'local_tool' },
        { ok: true, message: 'Ferramenta executada.' },
      ),
    });

    expect(result).toEqual({ delivered: true, queued: false });
    expect(resumedSession.sendToolResponse).toHaveBeenCalledWith([
      {
        id: 'call-5',
        name: 'local_tool',
        response: { ok: true, message: 'Ferramenta executada.' },
      },
    ]);
  });
});
