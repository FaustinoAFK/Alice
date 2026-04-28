import { PLAYGROUND_EXECUTION_MODES } from './contracts';
import { appendAutonomousLog, mergeAutonomousLearningState } from './state';
import { createLocalWorkspacePlan, buildWorkspaceSessionState } from './localWorkspacePlayground';
import { buildRealVmSessionState, selectPlaygroundExecution } from './vmController';

export const preparePlaygroundExecution = ({
  state,
  task,
  policyDecision,
  vmStatus,
  sourceFiles = [],
  requestedResources,
  hostResources,
  now = Date.now(),
} = {}) => {
  const selection = selectPlaygroundExecution({
    policyDecision,
    vmStatus,
    allowWorkspaceFallback: task?.actionRequest?.allowWorkspaceFallback,
  });

  if (!selection.allowed) {
    return {
      state: appendAutonomousLog(
        state,
        'playground_execution_blocked',
        {
          taskId: task?.taskId,
          reason: selection.reason,
        },
        { now },
      ),
      selection,
      workspacePlan: null,
    };
  }

  if (selection.mode === PLAYGROUND_EXECUTION_MODES.REAL_VM) {
    const vmSession = buildRealVmSessionState({ vmStatus, taskId: task?.taskId, now });
    return {
      state: appendAutonomousLog(
        mergeAutonomousLearningState(state, { vm: vmSession }),
        'real_vm_execution_selected',
        {
          taskId: task?.taskId,
          provider: vmSession.provider,
        },
        { now },
      ),
      selection,
      workspacePlan: null,
    };
  }

  const workspacePlan = createLocalWorkspacePlan({
    taskId: task?.taskId,
    sourceFiles,
    requestedResources,
    hostResources,
  });
  const vmSession = buildWorkspaceSessionState({ workspacePlan, now });

  return {
    state: appendAutonomousLog(
      mergeAutonomousLearningState(state, { vm: vmSession }),
      workspacePlan.ok ? 'workspace_fallback_execution_selected' : 'workspace_fallback_blocked',
      {
        taskId: task?.taskId,
        reason: workspacePlan.message,
      },
      { now },
    ),
    selection,
    workspacePlan,
  };
};
