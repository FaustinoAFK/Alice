import { describe, expect, it, vi } from 'vitest';
import {
  ALICE_MEMORY_SCHEMA_VERSION,
  buildMemoryPrefixTurns,
  createEmptyAliceMemory,
  extractImportantFacts,
  loadAliceMemory,
  mergeImportantFacts,
  pruneAliceMemory,
  saveAliceMemory,
  validateAliceMemorySchema,
} from './aliceMemory';

describe('validateAliceMemorySchema', () => {
  it('accepts the canonical empty memory shape', () => {
    expect(validateAliceMemorySchema(createEmptyAliceMemory())).toBe(true);
  });

  it('rejects malformed memory payloads', () => {
    expect(validateAliceMemorySchema({ schemaVersion: 999 })).toBe(false);
  });
});

describe('extractImportantFacts', () => {
  it('extracts only durable user preferences, projects, tasks, tool facts and recent summary', () => {
    const facts = extractImportantFacts(
      {
        inputTranscript:
          'eu gosto de interfaces limpas e automacao local. pode me chamar de Fausto. projeto Alice Virtual. tarefa fechar fase 5.',
        outputTranscript: 'Fechado. Vou manter isso em mente.',
        lastCommand: {
          name: 'open_app',
          status: 'executado',
          message: 'Bloco de notas aberto.',
        },
        sessionModel: 'gemini-2.5-flash-native-audio-preview-12-2025',
      },
      { now: '2026-04-23T12:40:00.000Z' },
    );

    expect(facts.stablePreferences.likes).toEqual(['interfaces limpas', 'automacao local']);
    expect(facts.stablePreferences.userConventions).toEqual(['Chamar o usuario de Fausto']);
    expect(facts.activeProjects).toEqual([
      {
        id: 'project:alice virtual',
        title: 'Alice Virtual',
        summary: 'Projeto ativo mencionado pelo usuario: Alice Virtual.',
        status: 'active',
        updatedAt: '2026-04-23T12:40:00.000Z',
      },
    ]);
    expect(facts.activeTasks).toEqual([
      {
        id: 'task:fechar fase 5',
        title: 'fechar fase 5',
        summary: 'Tarefa ativa mencionada pelo usuario: fechar fase 5.',
        status: 'doing',
        updatedAt: '2026-04-23T12:40:00.000Z',
      },
    ]);
    expect(facts.toolFacts).toEqual([
      {
        kind: 'open_app',
        fact: 'Bloco de notas aberto.',
        source: 'tool',
        updatedAt: '2026-04-23T12:40:00.000Z',
      },
    ]);
    expect(facts.recentContextSummary.summary).toContain('Usuario: eu gosto de interfaces limpas');
    expect(facts.bootstrapMeta.lastSessionModel).toBe('gemini-2.5-flash-native-audio-preview-12-2025');
  });

  it('ignores noisy or partial transcripts without durable facts', () => {
    const facts = extractImportantFacts(
      {
        inputTranscript: 'ali ce',
        outputTranscript: '',
        lastCommand: null,
      },
      { now: '2026-04-23T12:41:00.000Z' },
    );

    expect(facts.stablePreferences.likes).toEqual([]);
    expect(facts.activeProjects).toEqual([]);
    expect(facts.activeTasks).toEqual([]);
    expect(facts.toolFacts).toEqual([]);
    expect(facts.recentContextSummary.summary).toBe('Usuario: ali ce');
  });
});

describe('mergeImportantFacts', () => {
  it('merges durable facts without duplicating semantic equivalents', () => {
    const baseMemory = pruneAliceMemory({
      ...createEmptyAliceMemory(),
      stablePreferences: {
        likes: ['interfaces limpas'],
        dislikes: [],
        communicationStyle: [],
        userConventions: [],
      },
      toolFacts: [
        {
          kind: 'open_app',
          fact: 'Bloco de notas aberto.',
          source: 'tool',
          updatedAt: '2026-04-23T12:00:00.000Z',
        },
      ],
    });

    const merged = mergeImportantFacts(
      baseMemory,
      {
        stablePreferences: {
          likes: ['Interfaces limpas', 'automacao local'],
          dislikes: ['menus confusos'],
          communicationStyle: ['Respostas curtas'],
          userConventions: ['Chamar o usuario de Fausto'],
        },
        toolFacts: [
          {
            kind: 'open_app',
            fact: 'Bloco de notas aberto.',
            source: 'tool',
            updatedAt: '2026-04-23T12:10:00.000Z',
          },
          {
            kind: 'open_folder',
            fact: 'Pasta Downloads aberta.',
            source: 'tool',
            updatedAt: '2026-04-23T12:11:00.000Z',
          },
        ],
        recentContextSummary: {
          summary: 'Usuario: continuar fase 5 | Alice: memoria local preparada',
          updatedAt: '2026-04-23T12:11:00.000Z',
        },
        bootstrapMeta: {
          lastSessionModel: 'gemini-demo',
        },
      },
      { now: '2026-04-23T12:11:00.000Z' },
    );

    expect(merged.stablePreferences.likes).toEqual(['interfaces limpas', 'automacao local']);
    expect(merged.stablePreferences.dislikes).toEqual(['menus confusos']);
    expect(merged.toolFacts).toHaveLength(2);
    expect(merged.bootstrapMeta.memoryRevision).toBe(1);
    expect(merged.bootstrapMeta.lastSessionModel).toBe('gemini-demo');
    expect(merged.recentContextSummary.summary).toContain('continuar fase 5');
  });
});

describe('pruneAliceMemory', () => {
  it('limits projects, tasks and tool facts while keeping newest entries first', () => {
    const oversizedMemory = {
      ...createEmptyAliceMemory(),
      activeProjects: Array.from({ length: 12 }, (_, index) => ({
        id: `project-${index}`,
        title: `Projeto ${index}`,
        summary: `Resumo ${index}`,
        status: 'active',
        updatedAt: `2026-04-${String(23 - Math.min(index, 9)).padStart(2, '0')}T12:00:00.000Z`,
      })),
      activeTasks: Array.from({ length: 22 }, (_, index) => ({
        id: `task-${index}`,
        title: `Tarefa ${index}`,
        summary: `Resumo ${index}`,
        status: 'doing',
        updatedAt: `2026-04-${String(23 - Math.min(index, 9)).padStart(2, '0')}T12:00:00.000Z`,
      })),
      toolFacts: Array.from({ length: 55 }, (_, index) => ({
        kind: 'tool',
        fact: `Fato ${index}`,
        source: 'tool',
        updatedAt: `2026-04-${String(23 - Math.min(index, 9)).padStart(2, '0')}T12:00:00.000Z`,
      })),
    };

    const pruned = pruneAliceMemory(oversizedMemory);

    expect(pruned.schemaVersion).toBe(ALICE_MEMORY_SCHEMA_VERSION);
    expect(pruned.activeProjects).toHaveLength(10);
    expect(pruned.activeTasks).toHaveLength(20);
    expect(pruned.toolFacts).toHaveLength(50);
  });
});

describe('buildMemoryPrefixTurns', () => {
  it('builds a concise persisted memory prefix turn', () => {
    const turns = buildMemoryPrefixTurns({
      ...createEmptyAliceMemory(),
      stablePreferences: {
        likes: ['interfaces limpas'],
        dislikes: [],
        communicationStyle: ['Respostas curtas'],
        userConventions: ['Chamar o usuario de Fausto'],
      },
      activeProjects: [
        {
          id: 'project:alice virtual',
          title: 'Alice Virtual',
          summary: 'Projeto principal.',
          status: 'active',
          updatedAt: '2026-04-23T12:00:00.000Z',
        },
      ],
      recentContextSummary: {
        summary: 'Usuario: continuar fase 5 | Alice: memoria local pronta',
        updatedAt: '2026-04-23T12:00:00.000Z',
      },
    });

    expect(turns).toEqual([
      {
        role: 'user',
        parts: [
          {
            text: expect.stringContaining('Memoria persistida relevante da Alice:'),
          },
        ],
      },
    ]);
    expect(turns[0].parts[0].text).toContain('Projetos ativos: Alice Virtual (active).');
    expect(turns[0].parts[0].text).toContain('Resumo recente: Usuario: continuar fase 5');
  });
});

describe('loadAliceMemory', () => {
  it('returns normalized memory when storage contains valid json', async () => {
    const memory = await loadAliceMemory({
      loadJson: vi.fn(async () => JSON.stringify(createEmptyAliceMemory())),
    });

    expect(validateAliceMemorySchema(memory)).toBe(true);
  });

  it('recovers safely from corrupt or invalid memory payloads', async () => {
    const memory = await loadAliceMemory({
      loadJson: vi.fn(async () => '{invalid'),
    });

    expect(memory).toEqual(createEmptyAliceMemory());
  });

  it('recovers safely when the storage layer itself fails during crash recovery', async () => {
    const memory = await loadAliceMemory({
      loadJson: vi.fn(async () => {
        throw new Error('disk read failed');
      }),
    });

    expect(memory).toEqual(createEmptyAliceMemory());
  });
});

describe('saveAliceMemory', () => {
  it('persists the pruned memory json through the provided storage adapter', async () => {
    const saveJson = vi.fn(async () => {});
    const savedMemory = await saveAliceMemory(
      {
        ...createEmptyAliceMemory(),
        stablePreferences: {
          likes: ['interfaces limpas', 'interfaces limpas'],
          dislikes: [],
          communicationStyle: [],
          userConventions: [],
        },
      },
      { saveJson },
    );

    expect(savedMemory.stablePreferences.likes).toEqual(['interfaces limpas']);
    expect(saveJson).toHaveBeenCalledTimes(1);
    expect(JSON.parse(saveJson.mock.calls[0][0])).toEqual(savedMemory);
  });
});
