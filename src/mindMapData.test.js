import { describe, expect, it } from 'vitest';
import {
  MAX_MIND_MAP_EDGES,
  MAX_MIND_MAP_NODES,
  generateMindMapFromGoal,
  generateMindMapFromText,
  normalizeMindMap,
  upgradeMindMapSchema,
} from './hud/mindMap/utils/mindMapData';

describe('mind map schema and normalization', () => {
  it('upgrades legacy maps with defaults and required structural fields', () => {
    const upgraded = upgradeMindMapSchema({
      nodes: [{ id: 'root', data: { label: 'Legado' }, position: { x: 0, y: 0 } }],
      edges: [],
    });

    expect(upgraded.version).toBe(1);
    expect(upgraded.title).toBe('Legado');
    expect(upgraded.history).toEqual([]);
  });

  it('removes runtime data, fixes duplicate ids and drops invalid edges', () => {
    const normalized = normalizeMindMap({
      version: 1,
      nodes: [
        { id: 'dup', data: { label: '', onDelete: () => {}, dimmed: true }, position: { x: 'bad', y: 10 } },
        { id: 'dup', data: { label: 'Segundo' }, position: { x: 20, y: 30 } },
      ],
      edges: [
        { id: 'valid', source: 'dup', target: 'dup-2', onClick: () => {} },
        { id: 'invalid', source: 'missing', target: 'dup' },
      ],
    });

    expect(normalized.nodes.map((node) => node.id)).toEqual(['dup', 'dup-2']);
    expect(normalized.nodes[0].data).not.toHaveProperty('onDelete');
    expect(normalized.nodes[0].data).not.toHaveProperty('dimmed');
    expect(normalized.nodes[0].position).toEqual({ x: 0, y: 10 });
    expect(normalized.edges).toEqual([
      expect.objectContaining({ id: 'valid', source: 'dup', target: 'dup-2' }),
    ]);
  });

  it('migrates legacy nodes with safe type/status defaults and strips runtime fields', () => {
    const normalized = normalizeMindMap({
      nodes: [
        {
          id: 'old',
          type: 'custom',
          data: {
            label: 'Legado',
            status: 'bad',
            priority: 'critical',
            onChange: () => {},
          },
          position: { x: 1, y: 2 },
        },
      ],
      edges: [],
    });

    expect(normalized.nodes[0]).toMatchObject({
      id: 'old',
      type: 'idea',
      status: 'unknown',
      data: {
        label: 'Legado',
        priority: 'critical',
        source: 'manual',
      },
      metadata: {
        tags: [],
      },
    });
    expect(normalized.nodes[0].data).not.toHaveProperty('onChange');
  });

  it('limits oversized maps', () => {
    const normalized = normalizeMindMap({
      nodes: Array.from({ length: MAX_MIND_MAP_NODES + 10 }, (_, index) => ({
        id: `node-${index}`,
        data: { label: `Node ${index}` },
        position: { x: index, y: index },
      })),
      edges: Array.from({ length: MAX_MIND_MAP_EDGES + 10 }, (_, index) => ({
        id: `edge-${index}`,
        source: 'node-0',
        target: `node-${Math.min(index + 1, MAX_MIND_MAP_NODES - 1)}`,
      })),
    });

    expect(normalized.nodes).toHaveLength(MAX_MIND_MAP_NODES);
    expect(normalized.edges).toHaveLength(MAX_MIND_MAP_EDGES);
  });
});

describe('mind map generation', () => {
  it('generates a normalized map from text with bounded nodes', () => {
    const mindMap = generateMindMapFromText('Plano principal. Testar memoria. Validar HUD.', {
      title: 'Plano',
      maxNodes: 3,
    });

    expect(mindMap.nodes.map((node) => node.data.label)).toEqual(['Plano', 'Plano principal', 'Testar memoria']);
    expect(mindMap.edges).toHaveLength(2);
  });

  it('generates a goal map with subtasks and dependency cleanup', () => {
    const mindMap = generateMindMapFromGoal({
      goalId: 'goal-1',
      title: 'Entregar Alice',
      subtasks: [{ id: 'tests', title: 'Testes' }],
      dependencies: [{ source: 'tests', target: 'missing' }],
    });

    expect(mindMap.goalId).toBe('goal-1');
    expect(mindMap.nodes.map((node) => node.data.label)).toEqual(['Entregar Alice', 'Testes']);
    expect(mindMap.nodes[0]).toMatchObject({ type: 'goal', status: 'pending' });
    expect(mindMap.nodes[1]).toMatchObject({ type: 'task', status: 'pending' });
    expect(mindMap.edges).toEqual([
      expect.objectContaining({ source: 'root', target: 'tests' }),
    ]);
  });
});
