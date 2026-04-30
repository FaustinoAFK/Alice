import { describe, expect, it } from 'vitest';
import {
  formatRunnerEvidencePhysicalStatus,
  getRunnerQueueMove,
  getRunnerEvidencePhysicalStatus,
  isTerminalRunnerTask,
  sortRunnerTasksForHud,
} from './runnerHudViewModel';

const task = (patch) => ({
  id: patch.id,
  title: patch.id,
  status: patch.status || 'ready',
  priority: patch.priority || 'medium',
  queueRank: patch.queueRank || 0,
  createdAt: patch.createdAt || '2026-04-29T10:00:00.000Z',
  ...patch,
});

describe('runner HUD view model', () => {
  it('sorts by operational order instead of queueRank alone', () => {
    const sorted = sortRunnerTasksForHud([
      task({ id: 'done-low-rank', status: 'done', priority: 'critical', queueRank: -10 }),
      task({ id: 'medium-first-rank', priority: 'medium', queueRank: 0 }),
      task({ id: 'critical-later-rank', priority: 'critical', queueRank: 99 }),
      task({ id: 'high-middle-rank', priority: 'high', queueRank: 5 }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual([
      'critical-later-rank',
      'high-middle-rank',
      'medium-first-rank',
      'done-low-rank',
    ]);
  });

  it('moves queue rank only within the same priority lane', () => {
    const tasks = [
      task({ id: 'critical', priority: 'critical', queueRank: 0 }),
      task({ id: 'high-a', priority: 'high', queueRank: 10 }),
      task({ id: 'high-b', priority: 'high', queueRank: 20 }),
      task({ id: 'medium', priority: 'medium', queueRank: 0 }),
    ];

    expect(getRunnerQueueMove(tasks, 'high-b', 'up')).toEqual({
      canMove: true,
      queueRank: 10,
    });
    expect(getRunnerQueueMove(tasks, 'high-a', 'up')).toEqual({
      canMove: false,
      queueRank: 10,
    });
  });

  it('treats final tasks as history, not movable queue items', () => {
    const doneTask = task({ id: 'done', status: 'done', priority: 'critical', queueRank: 0 });

    expect(isTerminalRunnerTask(doneTask)).toBe(true);
    expect(getRunnerQueueMove([doneTask], 'done', 'up')).toEqual({
      canMove: false,
      queueRank: 0,
    });
  });

  it('formats physical evidence status for the HUD', () => {
    expect(getRunnerEvidencePhysicalStatus({
      metadata: { physicalStatus: 'ok' },
    })).toBe('ok');
    expect(formatRunnerEvidencePhysicalStatus({
      metadata: { persistence: { status: 'partial' } },
    })).toBe('parcialmente ausente');
    expect(formatRunnerEvidencePhysicalStatus({})).toBe('nao verificada');
  });
});
