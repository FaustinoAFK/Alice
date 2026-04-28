import { pauseBackgroundForUserRequest } from './taskOrchestrator';
import { appendAutonomousLog } from './state';

export const runUserPriorityHooks = (
  state,
  {
    turnContext,
    cancelTask = null,
    now = Date.now(),
  } = {},
) => {
  if (!turnContext?.explicitUserRequest) {
    return { state, pausedTaskIds: [], cancelRequests: [] };
  }

  const paused = pauseBackgroundForUserRequest(state, {
    userRequest: turnContext.userUtterance,
    now,
  });
  const cancelRequests = paused.pausedTaskIds.map((taskId) => ({ taskId, reason: 'user_request_preemption' }));

  cancelRequests.forEach((request) => {
    if (typeof cancelTask === 'function') {
      cancelTask(request.taskId, request.reason);
    }
  });

  return {
    state: appendAutonomousLog(
      paused.state,
      'user_priority_hooks_completed',
      {
        pausedTaskIds: paused.pausedTaskIds,
        cancelRequests,
      },
      { now },
    ),
    pausedTaskIds: paused.pausedTaskIds,
    cancelRequests,
  };
};
