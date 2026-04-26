import { describe, expect, it } from 'vitest';
import { createRecentRequestTracker, parseSseMessages } from './captureEvents';

describe('parseSseMessages', () => {
  it('parses complete SSE frames and preserves an incomplete remainder', () => {
    const payload =
      'event: connected\n' +
      'data: {"ok":true}\n\n' +
      'event: capture_request\n' +
      'data: {"requestId":"capture-1","reason":"inspect_current_page"}\n\n' +
      'event: capture_request\n' +
      'data: {"requestId":"capture-2"';

    const parsed = parseSseMessages(payload);

    expect(parsed.messages).toHaveLength(2);
    expect(parsed.messages[0]).toMatchObject({
      event: 'connected',
      data: { ok: true },
    });
    expect(parsed.messages[1]).toMatchObject({
      event: 'capture_request',
      data: { requestId: 'capture-1', reason: 'inspect_current_page' },
    });
    expect(parsed.remainder).toContain('"requestId":"capture-2"');
  });
});

describe('createRecentRequestTracker', () => {
  it('deduplicates in-flight and recently completed request ids', () => {
    const tracker = createRecentRequestTracker(2);

    expect(tracker.begin('capture-1')).toBe(true);
    expect(tracker.begin('capture-1')).toBe(false);

    tracker.complete('capture-1');
    expect(tracker.isTracked('capture-1')).toBe(true);
    expect(tracker.begin('capture-1')).toBe(false);

    expect(tracker.begin('capture-2')).toBe(true);
    tracker.complete('capture-2');
    expect(tracker.begin('capture-3')).toBe(true);
    tracker.complete('capture-3');

    expect(tracker.isTracked('capture-1')).toBe(false);
    expect(tracker.begin('capture-1')).toBe(true);
  });

  it('releases failed request ids for retry', () => {
    const tracker = createRecentRequestTracker();

    expect(tracker.begin('capture-9')).toBe(true);
    tracker.fail('capture-9');
    expect(tracker.begin('capture-9')).toBe(true);
  });
});
