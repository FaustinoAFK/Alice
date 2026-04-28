import { describe, expect, it } from 'vitest';
import { generateMindMapFromGoal } from './hud/mindMap/utils/mindMapData';
import { syncMindMapWithExecution } from './mindMapExecutionSync';

const createGoalMap = () =>
  generateMindMapFromGoal({
    goalId: 'task-1',
    title: 'Rodar validacao',
    subtasks: [{ id: 'step-1', title: 'Executar teste', executionId: 'exec-1' }],
  });

describe('syncMindMapWithExecution', () => {
  it('marks a node done when execution evidence succeeds', () => {
    const result = syncMindMapWithExecution(
      { ok: true, taskId: 'task-1', message: 'ok' },
      { activeMap: createGoalMap(), goalId: 'task-1' },
    );

    expect(result.updated).toBe(true);
    expect(result.status).toBe('done');
    expect(result.mindMap.nodes[0].status).toBe('done');
  });

  it('marks a node failed when execution evidence fails', () => {
    const result = syncMindMapWithExecution(
      { ok: false, executionId: 'exec-1', stderr: 'boom' },
      { activeMap: createGoalMap() },
    );

    expect(result.updated).toBe(true);
    expect(result.status).toBe('failed');
    expect(result.mindMap.nodes.find((node) => node.id === 'step-1').status).toBe('failed');
  });

  it('marks a node blocked when execution is blocked by setup or runner evidence', () => {
    const result = syncMindMapWithExecution(
      {
        ok: false,
        taskId: 'task-1',
        message: 'guest runner not ready',
        artifacts: { requiresUserSetup: true },
      },
      { activeMap: createGoalMap(), goalId: 'task-1' },
    );

    expect(result.updated).toBe(true);
    expect(result.status).toBe('blocked');
  });

  it('does not update the map without enough evidence or matching node', () => {
    const result = syncMindMapWithExecution(
      { message: 'sem status claro' },
      { activeMap: createGoalMap(), goalId: 'other' },
    );

    expect(result.updated).toBe(false);
    expect(result.reason).toBe('insufficient_execution_evidence');
  });
});
