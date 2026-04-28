import { describe, expect, it } from 'vitest';
import { createBehaviorContext } from './behaviorContext';
import { createEmptyAutonomousLearningState } from './state';
import { normalizeMindMap } from '../hud/mindMap/utils/mindMapData';

describe('createBehaviorContext mind_map_summary', () => {
  it('summarizes the active mind map without sending the full map', () => {
    const context = createBehaviorContext({
      autonomousState: createEmptyAutonomousLearningState(),
      activeMindMap: normalizeMindMap({
        id: 'map-1',
        title: 'Plano',
        goalId: 'goal-1',
        nodes: [
          { id: 'root', type: 'goal', status: 'pending', data: { label: 'Plano' }, position: { x: 0, y: 0 } },
          { id: 'task', type: 'task', status: 'blocked', data: { label: 'Tarefa', priority: 'critical' }, position: { x: 1, y: 1 } },
          { id: 'done', type: 'task', status: 'done', data: { label: 'Feita' }, position: { x: 2, y: 2 } },
        ],
        edges: [],
      }),
      now: 1,
    });

    expect(context.mind_map_summary).toEqual({
      activeMapId: 'map-1',
      title: 'Plano',
      totalNodes: 3,
      pendingCount: 1,
      inProgressCount: 0,
      doneCount: 1,
      failedCount: 0,
      blockedCount: 1,
      highPriorityPending: 0,
      currentBlockers: [{ id: 'task', label: 'Tarefa', status: 'blocked' }],
      relatedGoalId: 'goal-1',
    });
    expect(context.mind_map_summary).not.toHaveProperty('nodes');
  });

  it('uses an empty summary when no active map is available', () => {
    const context = createBehaviorContext({
      autonomousState: createEmptyAutonomousLearningState(),
      now: 1,
    });

    expect(context.mind_map_summary.totalNodes).toBe(0);
    expect(context.mind_map_summary.currentBlockers).toEqual([]);
  });
});
