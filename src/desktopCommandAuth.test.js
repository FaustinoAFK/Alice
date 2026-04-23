import { describe, expect, it } from 'vitest';
import {
  appendTrustedUtterance,
  attachCaptureGeometry,
  authorizeDesktopAction,
  recordTrustedUtterance,
} from './desktopCommandAuth';

const now = 10000;

describe('recordTrustedUtterance', () => {
  it('stores local transcript text with its timestamp', () => {
    expect(recordTrustedUtterance('Alice, abre o bloco de notas', now)).toEqual({
      text: 'Alice, abre o bloco de notas',
      timestamp: now,
    });
  });
});

describe('appendTrustedUtterance', () => {
  it('reconstructs a local utterance from recent transcription fragments', () => {
    const first = appendTrustedUtterance(null, 'Alice,', now);
    const second = appendTrustedUtterance(first, 'abre o bloco de notas', now + 500);

    expect(second.text).toBe('Alice, abre o bloco de notas');
  });

  it('reconstructs the Alice wake word when transcription splits it by syllables', () => {
    const first = appendTrustedUtterance(null, 'Ali', now);
    const second = appendTrustedUtterance(first, 'ce, abre o bloco de notas', now + 500);

    expect(second.text).toBe('Alice, abre o bloco de notas');
  });

  it('reconstructs the Alice wake word from single-syllable fragments', () => {
    const trusted = ['A', 'li', 'ce', 'abre o bloco de notas'].reduce(
      (current, fragment, index) => appendTrustedUtterance(current, fragment, now + index * 200),
      null,
    );

    expect(trusted.text).toBe('Alice abre o bloco de notas');
  });
});

describe('authorizeDesktopAction', () => {
  it('rejects a tool call when there is no recent trusted utterance', () => {
    const result = authorizeDesktopAction(
      { id: 'call-1', name: 'open_app', args: { app: 'notepad' } },
      null,
      now,
    );

    expect(result.authorized).toBe(false);
    expect(result.reason).toContain('fala recente');
  });

  it('authorizes a compatible command without requiring the Alice wake prefix', () => {
    const result = authorizeDesktopAction(
      { id: 'call-1', name: 'open_app', args: { app: 'notepad' } },
      recordTrustedUtterance('abre o bloco de notas', now),
      now,
    );

    expect(result).toMatchObject({
      authorized: true,
      action: { type: 'open_app', app: 'notepad' },
      utterance: 'abre o bloco de notas',
    });
  });

  it('rejects a model-provided utterance hint when the local utterance is incompatible', () => {
    const result = authorizeDesktopAction(
      {
        id: 'call-1',
        name: 'open_app',
        args: { app: 'notepad', utteranceHint: 'Alice, abre o bloco de notas' },
      },
      recordTrustedUtterance('que horas sao', now),
      now,
    );

    expect(result.authorized).toBe(false);
    expect(result.reason).toContain('compativel');
  });

  it('rejects actions that are incompatible with the trusted local utterance', () => {
    const result = authorizeDesktopAction(
      { id: 'call-1', name: 'open_app', args: { app: 'calculator' } },
      recordTrustedUtterance('Alice, abre o bloco de notas', now),
      now,
    );

    expect(result.authorized).toBe(false);
    expect(result.reason).toContain('compativel');
  });

  it('authorizes notepad when the trusted local utterance matches the action', () => {
    const result = authorizeDesktopAction(
      { id: 'call-1', name: 'open_app', args: { app: 'notepad' } },
      recordTrustedUtterance('Alice, abre o bloco de notas', now),
      now,
    );

    expect(result).toMatchObject({
      authorized: true,
      action: { type: 'open_app', app: 'notepad' },
      utterance: 'Alice, abre o bloco de notas',
    });
  });

  it('authorizes notepad when Alice and the command arrive as recent transcription fragments', () => {
    const trusted = appendTrustedUtterance(
      appendTrustedUtterance(null, 'Alice,', now),
      'abre o bloco de notas',
      now + 500,
    );
    const result = authorizeDesktopAction(
      { id: 'call-1', name: 'open_app', args: { app: 'notepad' } },
      trusted,
      now + 500,
    );

    expect(result.authorized).toBe(true);
  });

  it('authorizes notepad when the wake word arrives split as Ali and ce', () => {
    const trusted = appendTrustedUtterance(
      appendTrustedUtterance(null, 'Ali', now),
      'ce, abre o bloco de notas',
      now + 500,
    );
    const result = authorizeDesktopAction(
      { id: 'call-1', name: 'open_app', args: { app: 'notepad' } },
      trusted,
      now + 500,
    );

    expect(result.authorized).toBe(true);
  });

  it('authorizes mouse click when the user says a direct click command', () => {
    const result = authorizeDesktopAction(
      { id: 'call-1', name: 'mouse_click', args: { button: 'left' } },
      recordTrustedUtterance('aperta ali', now),
      now,
    );

    expect(result.authorized).toBe(true);
  });

  it('authorizes mouse click when click is transcribed with split syllables', () => {
    const result = authorizeDesktopAction(
      { id: 'call-1', name: 'mouse_click', args: { button: 'left' } },
      recordTrustedUtterance('cli ca ali', now),
      now,
    );

    expect(result.authorized).toBe(true);
  });
});

describe('attachCaptureGeometry', () => {
  it('attaches capture dimensions only to mouse actions', () => {
    expect(
      attachCaptureGeometry({ type: 'mouse_click', button: 'left', x: 500, y: 500 }, { width: 1920, height: 1080 }),
    ).toMatchObject({
      type: 'mouse_click',
      captureWidth: 1920,
      captureHeight: 1080,
    });

    expect(attachCaptureGeometry({ type: 'open_app', app: 'notepad' }, { width: 1920, height: 1080 })).toEqual({
      type: 'open_app',
      app: 'notepad',
    });
  });
});
