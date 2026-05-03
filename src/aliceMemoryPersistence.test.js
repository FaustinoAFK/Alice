import { describe, expect, it, vi } from 'vitest';
import { createEmptyAliceMemory } from './aliceMemory';
import {
  flushAliceMemoryToRuntime,
  loadAliceMemoryFromRuntime,
} from './aliceMemoryPersistence';

describe('loadAliceMemoryFromRuntime', () => {
  it('returns an empty memory shape when runtime storage is empty', async () => {
    const memory = await loadAliceMemoryFromRuntime({
      invokeFn: vi.fn(async () => ''),
    });

    expect(memory.schemaVersion).toBe(createEmptyAliceMemory().schemaVersion);
    expect(memory.activeProjects).toEqual([]);
    expect(memory.activeTasks).toEqual([]);
    expect(memory.toolFacts).toEqual([]);
    expect(memory.mindMaps.activeId).toBeTruthy();
  });

  it('normalizes json returned by the Tauri boundary', async () => {
    const memory = await loadAliceMemoryFromRuntime({
      invokeFn: vi.fn(async () => JSON.stringify({
        ...createEmptyAliceMemory(),
        stablePreferences: {
          likes: ['interfaces limpas', 'interfaces limpas'],
          dislikes: [],
          communicationStyle: [],
          userConventions: [],
        },
      })),
    });

    expect(memory.stablePreferences.likes).toEqual(['interfaces limpas']);
  });

  it('recovers an empty memory shape when runtime storage contains corrupt json', async () => {
    const memory = await loadAliceMemoryFromRuntime({
      invokeFn: vi.fn(async () => '{not-valid-json'),
    });

    expect(memory.schemaVersion).toBe(createEmptyAliceMemory().schemaVersion);
    expect(memory.activeProjects).toEqual([]);
    expect(memory.activeTasks).toEqual([]);
    expect(memory.toolFacts).toEqual([]);
    expect(memory.mindMaps.activeId).toBeTruthy();
  });

  it('keeps runtime read errors visible to the caller', async () => {
    const readError = new Error('storage unavailable');

    await expect(loadAliceMemoryFromRuntime({
      invokeFn: vi.fn(async () => {
        throw readError;
      }),
    })).rejects.toBe(readError);
  });
});

describe('flushAliceMemoryToRuntime', () => {
  it('skips persistence cleanly when runtime persistence is unavailable', async () => {
    const memory = createEmptyAliceMemory();
    const onSkipped = vi.fn();
    const saveMemory = vi.fn();

    const flushed = await flushAliceMemoryToRuntime({
      memory,
      canUseTauriRuntime: false,
      memoryHydrated: true,
      saveMemory,
      onSkipped,
    });

    expect(flushed).toBe(memory);
    expect(onSkipped).toHaveBeenCalledWith(memory);
    expect(saveMemory).not.toHaveBeenCalled();
  });

  it('persists memory and reports success through the callback', async () => {
    const memory = createEmptyAliceMemory();
    const onSaved = vi.fn();
    const savedMemory = { ...memory, bootstrapMeta: { ...memory.bootstrapMeta, memoryRevision: 1 } };

    const flushed = await flushAliceMemoryToRuntime({
      memory,
      canUseTauriRuntime: true,
      memoryHydrated: true,
      saveMemory: vi.fn(async () => savedMemory),
      onSaved,
    });

    expect(flushed).toEqual(savedMemory);
    expect(onSaved).toHaveBeenCalledWith(savedMemory);
  });
});
