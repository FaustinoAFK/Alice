import { describe, expect, it, vi } from 'vitest';
import {
  ALICE_MEMORY_SCHEMA_VERSION,
  ALICE_MEMORY_MAX_JSON_BYTES,
  buildMemoryPrefixTurns,
  createAliceMemoryPersistenceSnapshot,
  createMindMap,
  createEmptyAliceMemory,
  deleteMindMap,
  estimateAliceMemoryJsonBytes,
  extractImportantFacts,
  getActiveMindMap,
  loadAliceMemory,
  mergeActiveMindMap,
  mergeImportantFacts,
  mergeMindMapFromGoal,
  mergeValidatedProcedures,
  pruneAliceMemory,
  rollbackMindMap,
  saveAliceMemory,
  setActiveMindMap,
  validateAliceMemorySchema,
} from './aliceMemory';
import { createStarterMindMap } from './hud/mindMap/utils/mindMapData';

describe('validateAliceMemorySchema', () => {
  it('accepts the canonical empty memory shape', () => {
    expect(validateAliceMemorySchema(createEmptyAliceMemory())).toBe(true);
  });

  it('rejects malformed memory payloads', () => {
    expect(validateAliceMemorySchema({ schemaVersion: 999 })).toBe(false);
  });
});

describe('alice memory persistence diagnostics', () => {
  it('estimates the formatted JSON payload sent to native storage', () => {
    const memory = { schemaVersion: 8, nested: { value: true } };

    expect(estimateAliceMemoryJsonBytes(memory)).toBe(
      new TextEncoder().encode(JSON.stringify(memory, null, 2)).length,
    );
  });

  it('estimates memory size and warns near the native save limit', () => {
    const small = createAliceMemoryPersistenceSnapshot(createEmptyAliceMemory());
    const large = createAliceMemoryPersistenceSnapshot({
      payload: 'x'.repeat(Math.ceil(ALICE_MEMORY_MAX_JSON_BYTES * 0.9)),
    }, {
      lastMemorySaveError: 'disk full',
    });

    expect(small.status).toBe('ok');
    expect(small.nearLimit).toBe(false);
    expect(large.status).toBe('near_limit');
    expect(large.nearLimit).toBe(true);
    expect(large.lastError).toBe('disk full');
  });
});

describe('extractImportantFacts', () => {
  it('extracts only durable user preferences, projects, tasks and recent summary', () => {
    const facts = extractImportantFacts(
      {
        inputTranscript:
          'eu gosto de interfaces limpas e automacao local. pode me chamar de Fausto. projeto Alice Virtual. tarefa fechar fase 5.',
        outputTranscript: 'Fechado. Vou manter isso em mente.',
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
    expect(facts.toolFacts).toEqual([]);
    expect(facts.recentContextSummary.summary).toContain('Usuario: eu gosto de interfaces limpas');
    expect(facts.bootstrapMeta.lastSessionModel).toBe('gemini-2.5-flash-native-audio-preview-12-2025');
  });

  it('ignores noisy or partial transcripts without durable facts', () => {
    const facts = extractImportantFacts(
      {
        inputTranscript: 'ali ce',
        outputTranscript: '',
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
          kind: 'memory',
          fact: 'Usuario prefere contexto local.',
          source: 'memory',
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
            kind: 'memory',
            fact: 'Usuario prefere contexto local.',
            source: 'memory',
            updatedAt: '2026-04-23T12:10:00.000Z',
          },
          {
            kind: 'memory',
            fact: 'Projeto Alice Virtual segue ativo.',
            source: 'memory',
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
        kind: 'memory',
        fact: `Fato ${index}`,
        source: 'memory',
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

describe('active mind map memory', () => {
  it('stores a valid active mind map in the official Alice memory shape', () => {
    const memory = mergeActiveMindMap(
      createEmptyAliceMemory(),
      {
        version: 1,
        nodes: [
          { id: 'root', data: { label: 'Alice Virtual', onChange: () => {} }, position: { x: 0, y: 0 } },
          { id: 'hud', data: { label: 'HUD' }, position: { x: 200, y: 0 } },
        ],
        edges: [{ id: 'edge-1', source: 'root', target: 'hud' }],
      },
      { now: '2026-04-28T11:00:00.000Z' },
    );

    expect(validateAliceMemorySchema(memory)).toBe(true);
    const activeMindMap = getActiveMindMap(memory);
    expect(activeMindMap.nodes).toHaveLength(2);
    expect(activeMindMap.nodes[0].data).not.toHaveProperty('onChange');
    expect(activeMindMap.edges).toEqual([
      expect.objectContaining({ id: 'edge-1', source: 'root', target: 'hud' }),
    ]);
    expect(memory.bootstrapMeta.memoryRevision).toBe(1);
  });

  it('normalizes invalid active mind map data instead of persisting unsafe state', () => {
    const memory = pruneAliceMemory({
      ...createEmptyAliceMemory(),
      activeMindMap: {
        version: 1,
        nodes: [
          { id: 'dup', data: { label: '', dimmed: true }, position: { x: 'bad', y: 10 } },
          { id: 'dup', data: { label: 'Segundo' }, position: { x: 20, y: 30 } },
        ],
        edges: [
          { id: 'valid', source: 'dup', target: 'dup-2' },
          { id: 'invalid', source: 'dup', target: 'missing' },
        ],
      },
    });

    const activeMindMap = getActiveMindMap(memory);
    expect(activeMindMap.nodes.map((node) => node.id)).toEqual(['dup', 'dup-2']);
    expect(activeMindMap.nodes[0].data.label).toBe('Ideia sem titulo 1');
    expect(activeMindMap.nodes[0].data).not.toHaveProperty('dimmed');
    expect(activeMindMap.nodes[0].position).toEqual({ x: 0, y: 10 });
    expect(activeMindMap.edges).toEqual([
      expect.objectContaining({ id: 'valid', source: 'dup', target: 'dup-2' }),
    ]);
  });

  it('creates a starter map when active mind map state is empty or invalid', () => {
    const memory = pruneAliceMemory({
      ...createEmptyAliceMemory(),
      activeMindMap: { nodes: [], edges: [] },
    });

    expect(getActiveMindMap(memory).nodes).toEqual(createStarterMindMap().nodes);
    expect(getActiveMindMap(memory).edges).toEqual([]);
  });

  it('supports multiple maps and keeps activeId consistent', () => {
    const firstMemory = createMindMap(
      createEmptyAliceMemory(),
      {
        id: 'map-one',
        title: 'Mapa Um',
        nodes: [{ id: 'root', data: { label: 'Mapa Um' }, position: { x: 0, y: 0 } }],
        edges: [],
      },
      { now: '2026-04-28T12:00:00.000Z' },
    );
    const secondMemory = createMindMap(
      firstMemory,
      {
        id: 'map-two',
        title: 'Mapa Dois',
        nodes: [{ id: 'root', data: { label: 'Mapa Dois' }, position: { x: 0, y: 0 } }],
        edges: [],
      },
      { now: '2026-04-28T12:01:00.000Z' },
    );
    const activated = setActiveMindMap(secondMemory, 'map-one');
    const deleted = deleteMindMap(activated, 'map-one');

    expect(Object.keys(secondMemory.mindMaps.byId)).toEqual(expect.arrayContaining(['map-one', 'map-two']));
    expect(activated.mindMaps.activeId).toBe('map-one');
    expect(deleted.mindMaps.activeId).toBe('map-two');
    expect(getActiveMindMap(deleted).title).toBe('Mapa Dois');
  });

  it('keeps lightweight history when the active map is updated', () => {
    const memory = mergeActiveMindMap(
      createEmptyAliceMemory(),
      {
        nodes: [
          { id: 'root', data: { label: 'Alice Virtual' }, position: { x: 0, y: 0 } },
        ],
        edges: [],
      },
      { now: '2026-04-28T12:02:00.000Z' },
    );

    expect(getActiveMindMap(memory).history).toHaveLength(1);
    expect(getActiveMindMap(memory).history[0].nodes[0].data.label).toBe('Minha Ideia Central');
  });

  it('rolls back the active map to the last stored snapshot', () => {
    const updated = mergeActiveMindMap(
      createEmptyAliceMemory(),
      {
        nodes: [
          { id: 'root', data: { label: 'Depois' }, position: { x: 0, y: 0 } },
        ],
        edges: [],
      },
      { now: '2026-04-28T12:02:00.000Z' },
    );
    const rolledBack = rollbackMindMap(updated, updated.mindMaps.activeId, {
      now: '2026-04-28T12:04:00.000Z',
    });

    expect(getActiveMindMap(rolledBack).nodes[0].data.label).toBe('Minha Ideia Central');
    expect(getActiveMindMap(rolledBack).history).toEqual([]);
  });

  it('creates a goal-backed map without replacing the current active map', () => {
    const baseMemory = createEmptyAliceMemory();
    const activeBefore = baseMemory.mindMaps.activeId;
    const memory = mergeMindMapFromGoal(
      baseMemory,
      {
        goalId: 'goal-1',
        title: 'Entregar HUD',
        subtasks: [{ id: 'tests', title: 'Rodar testes' }],
      },
      { now: '2026-04-28T12:03:00.000Z' },
    );

    const goalMap = Object.values(memory.mindMaps.byId).find((map) => map.goalId === 'goal-1');
    expect(memory.mindMaps.activeId).toBe(activeBefore);
    expect(goalMap.nodes.map((node) => node.data.label)).toEqual(['Entregar HUD', 'Rodar testes']);
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

  it('migrates legacy memory into the current shape without preserving command-only state', async () => {
    const legacyMemory = {
      schemaVersion: 2,
      identity: createEmptyAliceMemory().identity,
      stablePreferences: createEmptyAliceMemory().stablePreferences,
      activeProjects: [],
      activeTasks: [],
      toolFacts: [],
      recentContextSummary: {
        summary: 'Usuario: continuar fase 5',
        updatedAt: '2026-04-23T12:00:00.000Z',
      },
      commandPreferences: {
        policyMode: 'hands_free',
      },
      commandFriction: {
        lastScore: 0.8,
      },
      bootstrapMeta: {
        lastUpdatedAt: '2026-04-23T12:00:00.000Z',
        lastSessionModel: 'gemini-demo',
        memoryRevision: 3,
      },
    };

    const memory = await loadAliceMemory({
      loadJson: vi.fn(async () => JSON.stringify(legacyMemory)),
    });

    expect(memory.schemaVersion).toBe(ALICE_MEMORY_SCHEMA_VERSION);
    expect(memory.recentContextSummary.summary).toContain('continuar fase 5');
    expect(memory.proceduralMemory.procedures).toEqual([]);
    expect(memory).not.toHaveProperty('commandPreferences');
    expect(memory).not.toHaveProperty('commandFriction');
  });

  it('recovers safely from corrupt or invalid memory payloads', async () => {
    const memory = await loadAliceMemory({
      loadJson: vi.fn(async () => '{invalid'),
    });

    expect(validateAliceMemorySchema(memory)).toBe(true);
    expect(getActiveMindMap(memory).nodes).toEqual(createStarterMindMap().nodes);
  });

  it('recovers safely when the storage layer itself fails during crash recovery', async () => {
    const memory = await loadAliceMemory({
      loadJson: vi.fn(async () => {
        throw new Error('disk read failed');
      }),
    });

    expect(validateAliceMemorySchema(memory)).toBe(true);
    expect(getActiveMindMap(memory).nodes).toEqual(createStarterMindMap().nodes);
  });
});

describe('mergeValidatedProcedures', () => {
  it('stores validated operational procedures in the official Alice memory shape', () => {
    const memory = mergeValidatedProcedures(
      createEmptyAliceMemory(),
      [
        {
          procedureId: 'procedure:vm-validation',
          title: 'Validar na VM local',
          summary: 'Copia arquivos, testa e so depois aplica.',
          steps: ['copiar arquivos', 'rodar testes', 'gerar rollback'],
          status: 'active',
          confidence: 0.9,
          source: 'validated_operational_learning',
        },
      ],
      { now: '2026-04-28T10:00:00.000Z' },
    );

    expect(validateAliceMemorySchema(memory)).toBe(true);
    expect(memory.proceduralMemory.procedures).toHaveLength(1);
    expect(memory.proceduralMemory.procedures[0].title).toBe('Validar na VM local');
    expect(memory.bootstrapMeta.memoryRevision).toBe(1);
    expect(buildMemoryPrefixTurns(memory)[0].parts[0].text).toContain('Procedimentos validados');
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
