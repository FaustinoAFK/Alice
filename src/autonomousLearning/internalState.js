import { createEmptyAutonomousLearningState, mergeAutonomousLearningState } from './state';

export const createInternalStateSnapshot = ({
  autonomousState = createEmptyAutonomousLearningState(),
  turnContext = null,
  behaviorContext = null,
  now = Date.now(),
} = {}) => ({
  internalStateId: `internal-state-${now}`,
  turnContext,
  behaviorContext,
  autonomous: {
    taskCount: autonomousState.tasks.length,
    activeTasks: autonomousState.tasks.filter((task) => task.status === 'running').length,
    pendingApprovals: autonomousState.pendingApprovals.length,
    rollbackAvailable: autonomousState.rollbacks.some((rollback) => rollback.status === 'done' || rollback.status === 'ready'),
    vm: autonomousState.vm,
  },
  createdAt: now,
});

export const attachInternalStateSnapshot = (autonomousState, snapshot) =>
  mergeAutonomousLearningState(autonomousState, {
    lastInternalState: snapshot,
  });
