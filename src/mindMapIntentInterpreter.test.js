import { describe, expect, it } from 'vitest';
import { createStarterMindMap } from './hud/mindMap/utils/mindMapData';
import { interpretMindMapIntent } from './mindMapIntentInterpreter';

describe('interpretMindMapIntent', () => {
  it('turns create-map requests into a safe replace operation', () => {
    const operations = interpretMindMapIntent('cria um mapa sobre arquitetura da Alice');

    expect(operations).toHaveLength(1);
    expect(operations[0].operation).toBe('replace');
    expect(operations[0].payload.mindMap.nodes[0].data.label).toBe('arquitetura da Alice');
  });

  it('uses context to add implicit content as a node', () => {
    const operations = interpretMindMapIntent('adiciona isso', {
      currentText: 'Persistencia robusta',
      parentNodeId: 'root',
      targetMapId: 'map-1',
    });

    expect(operations).toEqual([
      {
        operation: 'add_node',
        targetMapId: 'map-1',
        payload: {
          label: 'Persistencia robusta',
          parentId: 'root',
        },
      },
    ]);
  });

  it('only creates edge and rename operations when referenced nodes exist', () => {
    const mindMap = {
      ...createStarterMindMap(),
      nodes: [
        { id: 'root', data: { label: 'Alice' }, position: { x: 0, y: 0 } },
        { id: 'goals', data: { label: 'Goals' }, position: { x: 1, y: 1 } },
      ],
      edges: [],
    };

    expect(interpretMindMapIntent('conecta Alice com Goals', { mindMap })[0]).toEqual({
      operation: 'add_edge',
      payload: {
        source: 'root',
        target: 'goals',
      },
    });
    expect(interpretMindMapIntent('renomeia Goals para Objetivos', { mindMap })[0]).toEqual({
      operation: 'rename_node',
      payload: {
        id: 'goals',
        label: 'Objetivos',
      },
    });
    expect(interpretMindMapIntent('conecta Alice com Ausente', { mindMap })).toEqual([]);
  });

  it('supports layout requests with priority intent', () => {
    expect(interpretMindMapIntent('organize por prioridade')).toEqual([
      {
        operation: 'layout',
        payload: { strategy: 'priority' },
      },
    ]);
  });

  it('marks contextual references as done, failed or blocked', () => {
    const mindMap = {
      ...createStarterMindMap(),
      nodes: [
        { id: 'root', data: { label: 'Alice' }, position: { x: 0, y: 0 } },
        { id: 'tests', data: { label: 'Testes' }, position: { x: 1, y: 1 } },
      ],
      edges: [],
    };

    expect(interpretMindMapIntent('marca isso como feito', { mindMap, selectedNodeId: 'tests' })[0]).toEqual({
      operation: 'mark_done',
      payload: { nodeId: 'tests' },
    });
    expect(interpretMindMapIntent('essa parte falhou', { mindMap, selectedNodeId: 'tests' })[0]).toEqual({
      operation: 'mark_failed',
      payload: { nodeId: 'tests' },
    });
    expect(interpretMindMapIntent('isso está bloqueado', { mindMap, selectedNodeId: 'tests' })[0]).toEqual({
      operation: 'mark_blocked',
      payload: { nodeId: 'tests' },
    });
  });

  it('returns clarification for ambiguous status references', () => {
    const mindMap = {
      ...createStarterMindMap(),
      nodes: [
        { id: 'a', data: { label: 'Teste API' }, position: { x: 0, y: 0 } },
        { id: 'b', data: { label: 'Teste HUD' }, position: { x: 1, y: 1 } },
      ],
      edges: [],
    };

    expect(interpretMindMapIntent('teste falhou', { mindMap })[0]).toMatchObject({
      operation: 'needs_clarification',
      payload: {
        candidates: [
          { id: 'a', label: 'Teste API' },
          { id: 'b', label: 'Teste HUD' },
        ],
      },
    });
  });

  it('turns dependency statements into edges', () => {
    const mindMap = {
      ...createStarterMindMap(),
      nodes: [
        { id: 'api', data: { label: 'API' }, position: { x: 0, y: 0 } },
        { id: 'hud', data: { label: 'HUD' }, position: { x: 1, y: 1 } },
      ],
      edges: [],
    };

    expect(interpretMindMapIntent('HUD depende da API', { mindMap })[0]).toEqual({
      operation: 'add_edge',
      payload: {
        source: 'api',
        target: 'hud',
        label: 'depende',
      },
    });
  });
});
