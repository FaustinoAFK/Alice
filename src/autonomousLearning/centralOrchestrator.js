import { appendAutonomousLog } from './state';
import { enqueueAutonomousTask, startRunnableTasks } from './taskOrchestrator';

export const routeAutonomousTask = (
  state,
  {
    actionInput,
    behaviorContext,
    decision,
    now = Date.now(),
  } = {},
) => {
  const queued = enqueueAutonomousTask(
    state,
    {
      ...actionInput,
      actionId: decision?.request?.actionId || actionInput?.actionId,
    },
    {
      now,
      userConfirmed: Boolean(actionInput?.userConfirmed),
      realVmAvailable: Boolean(behaviorContext?.playgroundStatus?.realVmAvailable),
    },
  );
  const runnable = startRunnableTasks(queued.state, { now });
  const nextState = appendAutonomousLog(
    runnable.state,
    'central_orchestrator_routed_task',
    {
      taskId: queued.task.taskId,
      policyReason: queued.policyDecision.reason,
      startedTaskIds: runnable.startedTaskIds,
    },
    { now },
  );

  return {
    state: nextState,
    task: queued.task,
    policyDecision: queued.policyDecision,
    startedTaskIds: runnable.startedTaskIds,
  };
};
