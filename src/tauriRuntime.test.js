import { describe, expect, it } from 'vitest';
import { isTauriRuntime } from './tauriRuntime';

describe('isTauriRuntime', () => {
  it('accepts the Tauri internals global used by older runtime checks', () => {
    expect(isTauriRuntime({ __TAURI_INTERNALS__: {} })).toBe(true);
  });

  it('accepts the Tauri v2 IPC global even when internals is absent', () => {
    expect(isTauriRuntime({ __TAURI_IPC__: () => {} })).toBe(true);
  });

  it('returns false in a plain browser window', () => {
    expect(isTauriRuntime({})).toBe(false);
  });
});
