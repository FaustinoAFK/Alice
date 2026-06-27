import { describe, expect, it, vi } from 'vitest';
import { buildLiveMemoryPrefixTurns } from './liveMemoryPrefixTurns';

vi.mock('./aliceMemory', () => ({
  ALICE_MEMORY_ACTIVE_PROJECT_RECENCY_MS: 86400000,
  ALICE_MEMORY_ACTIVE_TASK_RECENCY_MS: 86400000,
  buildMemoryPrefixTurns: vi.fn(() => [{ role: 'user', parts: [{ text: 'persistent-memory' }] }]),
  getActiveMindMap: vi.fn(() => null),
}));

vi.mock('./liveSessionRehydration', () => ({
  buildSessionRehydrationTurns: vi.fn(() => [{ role: 'user', parts: [{ text: 'rehydration' }] }]),
}));

vi.mock('./liveSessionRecentTurns', () => ({
  buildRecentSessionTurns: vi.fn(() => [{ role: 'user', parts: [{ text: 'recent-turns' }] }]),
}));

vi.mock('./operationalContext', () => ({
  buildOperationalContextTurns: vi.fn(() => [{ role: 'user', parts: [{ text: 'operational' }] }]),
}));

const emptyMemory = { recentContextSummary: null };

const textOf = (turn) => turn.parts[0].text;

describe('buildLiveMemoryPrefixTurns', () => {
  it('omits rehydration turns when mode is resume — server session retains context', () => {
    const turns = buildLiveMemoryPrefixTurns({ mode: 'resume', memory: emptyMemory });

    const texts = turns.map(textOf);
    expect(texts).not.toContain('rehydration');
    expect(texts).toContain('operational');
    expect(texts).toContain('recent-turns');
    expect(texts).toContain('persistent-memory');
  });

  it('includes rehydration turns when mode is fresh', () => {
    const turns = buildLiveMemoryPrefixTurns({ mode: 'fresh', memory: emptyMemory });

    const texts = turns.map(textOf);
    expect(texts).toContain('rehydration');
    expect(texts).toContain('operational');
    expect(texts).toContain('recent-turns');
    expect(texts).toContain('persistent-memory');
  });

  it('includes rehydration turns when mode is rehydrate', () => {
    const turns = buildLiveMemoryPrefixTurns({ mode: 'rehydrate', memory: emptyMemory });

    const texts = turns.map(textOf);
    expect(texts).toContain('rehydration');
  });

  it('defaults to fresh mode when mode is not specified', () => {
    const turns = buildLiveMemoryPrefixTurns({ memory: emptyMemory });

    const texts = turns.map(textOf);
    expect(texts).toContain('rehydration');
  });

  it('resume turns appear in order: operational, recent, persistent', () => {
    const turns = buildLiveMemoryPrefixTurns({ mode: 'resume', memory: emptyMemory });

    expect(turns).toHaveLength(3);
    expect(textOf(turns[0])).toBe('operational');
    expect(textOf(turns[1])).toBe('recent-turns');
    expect(textOf(turns[2])).toBe('persistent-memory');
  });

  it('fresh turns appear in order: operational, recent, persistent, rehydration', () => {
    const turns = buildLiveMemoryPrefixTurns({ mode: 'fresh', memory: emptyMemory });

    expect(turns).toHaveLength(4);
    expect(textOf(turns[0])).toBe('operational');
    expect(textOf(turns[1])).toBe('recent-turns');
    expect(textOf(turns[2])).toBe('persistent-memory');
    expect(textOf(turns[3])).toBe('rehydration');
  });
});
