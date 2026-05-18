import { describe, expect, it } from 'vitest';
import { createStarterMindMap, normalizeMindMap } from './hud/mindMap/utils/mindMapData';
import { executeMindMapFunctionCall } from './mindMapToolExecutor';

describe('executeMindMapFunctionCall', () => {
  it('adds a node and connects it to an existing parent', async () => {
    const result = await executeMindMapFunctionCall({
      functionCall: {
        name: 'update_mind_map',
        args: {
          operation: 'add_node',
          payload: {
            id: 'hud',
            label: 'HUD',
            parentId: 'root',
          },
        },
      },
      currentMindMap: createStarterMindMap(),
    });

    expect(result.handled).toBe(true);
    expect(result.response.ok).toBe(true);
    expect(result.mindMap.nodes.map((node) => node.id)).toEqual(['root', 'hud']);
    expect(result.mindMap.edges).toEqual([
      expect.objectContaining({ source: 'root', target: 'hud' }),
    ]);
  });

  it('adds one node already interlinked with multiple existing modules', async () => {
    const result = await executeMindMapFunctionCall({
      functionCall: {
        name: 'update_mind_map',
        args: {
          operation: 'add_node',
          payload: {
            id: 'runner',
            label: 'Runner',
            parentId: 'root',
            linkedToIds: ['vm', 'learning'],
          },
        },
      },
      currentMindMap: {
        ...createStarterMindMap(),
        nodes: [
          { id: 'root', data: { label: 'Alice' }, position: { x: 0, y: 0 } },
          { id: 'vm', data: { label: 'VM' }, position: { x: 1, y: 1 } },
          { id: 'learning', data: { label: 'Learning' }, position: { x: 2, y: 2 } },
        ],
        edges: [],
      },
    });

    expect(result.response.ok).toBe(true);
    expect(result.mindMap.nodes.map((node) => node.id)).toEqual(['root', 'vm', 'learning', 'runner']);
    expect(result.mindMap.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'root', target: 'runner' }),
      expect.objectContaining({ source: 'vm', target: 'runner' }),
      expect.objectContaining({ source: 'learning', target: 'runner' }),
    ]));
  });

  it('rejects invalid edges without changing the current map', async () => {
    const currentMindMap = createStarterMindMap();
    const result = await executeMindMapFunctionCall({
      functionCall: {
        name: 'update_mind_map',
        args: {
          operation: 'add_edge',
          payload: {
            source: 'root',
            target: 'missing',
          },
        },
      },
      currentMindMap,
    });

    expect(result.response.ok).toBe(false);
    expect(result.response.reason).toBe('invalid_edge_endpoints');
    expect(result.mindMap).toEqual(normalizeMindMap(currentMindMap));
  });

  it('adds multiple edges in one operation when the payload carries connections', async () => {
    const currentMindMap = {
      ...createStarterMindMap(),
      nodes: [
        { id: 'root', data: { label: 'Alice' }, position: { x: 0, y: 0 } },
        { id: 'vm', data: { label: 'VM' }, position: { x: 1, y: 1 } },
        { id: 'runner', data: { label: 'Runner' }, position: { x: 2, y: 2 } },
        { id: 'learning', data: { label: 'Learning' }, position: { x: 3, y: 3 } },
      ],
      edges: [],
    };
    const result = await executeMindMapFunctionCall({
      functionCall: {
        name: 'update_mind_map',
        args: {
          operation: 'add_edge',
          payload: {
            connections: [
              { source: 'vm', target: 'runner' },
              { source: 'learning', target: 'runner', label: 'depende' },
            ],
          },
        },
      },
      currentMindMap,
    });

    expect(result.response.ok).toBe(true);
    expect(result.mindMap.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'vm', target: 'runner' }),
      expect.objectContaining({ source: 'learning', target: 'runner', label: 'depende' }),
    ]));
  });

  it('renames, removes and exports map data through structured operations', async () => {
    const renamed = await executeMindMapFunctionCall({
      functionCall: {
        name: 'update_mind_map',
        args: {
          operation: 'rename_node',
          payload: {
            id: 'root',
            label: 'Alice Virtual',
          },
        },
      },
      currentMindMap: createStarterMindMap(),
    });

    expect(renamed.response.ok).toBe(true);
    expect(renamed.mindMap.nodes[0].data.label).toBe('Alice Virtual');

    const exported = await executeMindMapFunctionCall({
      functionCall: {
        name: 'update_mind_map',
        args: {
          operation: 'export',
          payload: {
            format: 'markdown',
          },
        },
      },
      currentMindMap: renamed.mindMap,
    });

    expect(exported.response.ok).toBe(true);
    expect(exported.response.export).toEqual({
      format: 'markdown',
      content: expect.stringContaining('- Alice Virtual'),
    });

    const removed = await executeMindMapFunctionCall({
      functionCall: {
        name: 'update_mind_map',
        args: {
          operation: 'remove_node',
          payload: {
            id: 'root',
          },
        },
      },
      currentMindMap: renamed.mindMap,
    });

    expect(removed.response.ok).toBe(true);
    expect(removed.mindMap.nodes[0].id).toBe('root');
    expect(removed.mindMap.nodes[0].data.label).toBe('Minha Ideia Central');
  });

  it('removes edges and respects targetMapId when a memory collection is provided', async () => {
    const mapA = {
      ...createStarterMindMap(),
      id: 'map-a',
      nodes: [
        { id: 'root', data: { label: 'A' }, position: { x: 0, y: 0 } },
        { id: 'child', data: { label: 'Child' }, position: { x: 1, y: 1 } },
      ],
      edges: [{ id: 'edge-a', source: 'root', target: 'child' }],
    };
    const mapB = {
      ...createStarterMindMap(),
      id: 'map-b',
      nodes: [{ id: 'root', data: { label: 'B' }, position: { x: 0, y: 0 } }],
      edges: [],
    };

    const result = await executeMindMapFunctionCall({
      functionCall: {
        name: 'update_mind_map',
        args: {
          operation: 'remove_edge',
          targetMapId: 'map-a',
          payload: { id: 'edge-a' },
        },
      },
      currentMemory: {
        mindMaps: {
          byId: { 'map-a': mapA, 'map-b': mapB },
          activeId: 'map-b',
        },
      },
    });

    expect(result.response.ok).toBe(true);
    expect(result.targetMapId).toBe('map-a');
    expect(result.mindMap.edges).toEqual([]);
  });

  it('updates node status through structured operations', async () => {
    const result = await executeMindMapFunctionCall({
      functionCall: {
        name: 'update_mind_map',
        args: {
          operation: 'mark_done',
          payload: {
            nodeId: 'root',
            metadata: { executionId: 'exec-1' },
          },
        },
      },
      currentMindMap: createStarterMindMap(),
    });

    expect(result.response.ok).toBe(true);
    expect(result.mindMap.nodes[0].status).toBe('done');
    expect(result.mindMap.nodes[0].metadata.executionId).toBe('exec-1');
    expect(result.mindMap.history).toHaveLength(1);
    expect(result.mindMap.evolution.changes.at(-1).type).toBe('status_changed');
  });

  it('applies batch transactionally and records history once', async () => {
    const result = await executeMindMapFunctionCall({
      functionCall: {
        name: 'update_mind_map',
        args: {
          operation: 'batch',
          payload: {
            operations: [
              { operation: 'add_node', payload: { id: 'task', label: 'Testar', parentId: 'root' } },
              { operation: 'set_status', payload: { nodeId: 'task', status: 'in_progress' } },
            ],
          },
        },
      },
      currentMindMap: createStarterMindMap(),
    });

    expect(result.response.ok).toBe(true);
    expect(result.response.appliedOperations).toEqual(['add_node', 'set_status']);
    expect(result.mindMap.nodes.find((node) => node.id === 'task').status).toBe('in_progress');
    expect(result.mindMap.history).toHaveLength(1);
  });

  it('keeps batch transactional when a critical mini operation fails', async () => {
    const result = await executeMindMapFunctionCall({
      functionCall: {
        name: 'update_mind_map',
        args: {
          operation: 'batch',
          payload: {
            operations: [
              { operation: 'add_node', payload: { id: 'task', label: 'Testar' } },
              { operation: 'set_status', payload: { nodeId: 'missing', status: 'done' } },
            ],
          },
        },
      },
      currentMindMap: createStarterMindMap(),
    });

    expect(result.response.ok).toBe(false);
    expect(result.mindMap.nodes).toHaveLength(1);
  });

  it('rolls back to the last map snapshot', async () => {
    const updated = await executeMindMapFunctionCall({
      functionCall: {
        name: 'update_mind_map',
        args: {
          operation: 'mark_failed',
          payload: { nodeId: 'root' },
        },
      },
      currentMindMap: createStarterMindMap(),
    });
    const rolledBack = await executeMindMapFunctionCall({
      functionCall: {
        name: 'update_mind_map',
        args: {
          operation: 'rollback',
          payload: {},
        },
      },
      currentMindMap: updated.mindMap,
    });

    expect(rolledBack.response.ok).toBe(true);
    expect(rolledBack.mindMap.nodes[0].status).toBe('unknown');
    expect(rolledBack.mindMap.history).toEqual([]);
  });

  it('rejects missing target maps without corrupting the active map', async () => {
    const activeMap = { ...createStarterMindMap(), id: 'map-b' };
    const result = await executeMindMapFunctionCall({
      functionCall: {
        name: 'update_mind_map',
        args: {
          operation: 'add_node',
          targetMapId: 'missing',
          payload: { label: 'Nao aplicar' },
        },
      },
      currentMemory: {
        mindMaps: {
          byId: { 'map-b': activeMap },
          activeId: 'map-b',
        },
      },
    });

    expect(result.response.ok).toBe(false);
    expect(result.response.reason).toBe('target_map_not_found');
    expect(result.mindMap.nodes).toHaveLength(1);
  });

  it('replaces generated map data with normalization and automatic layout', async () => {
    const result = await executeMindMapFunctionCall({
      functionCall: {
        name: 'update_mind_map',
        args: {
          operation: 'replace',
          payload: {
            version: 1,
            nodes: [
              { id: 'root', data: { label: 'Projeto' }, position: { x: 999, y: 999 } },
              { id: 'task', data: { label: 'Tarefa' }, position: { x: 999, y: 999 } },
            ],
            edges: [{ source: 'root', target: 'task' }],
          },
        },
      },
      currentMindMap: createStarterMindMap(),
    });

    expect(result.response.ok).toBe(true);
    expect(result.mindMap.nodes).toHaveLength(2);
    expect(result.mindMap.edges).toHaveLength(1);
    expect(result.mindMap.nodes[0].position).not.toEqual({ x: 999, y: 999 });
  });
});
