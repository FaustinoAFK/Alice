import {
  RUNNER_REASONS,
  resolveStepTimeout,
} from './autonomousRunnerState';

const normalizeText = (value) => String(value || '').trim();

const buildCommandRequest = ({ task = {}, step = {}, timeoutMs }) => ({
  taskId: `${task.id}:${step.id}`,
  sourceFiles: step.action?.sourceFiles || task.sourceFiles || [],
  command: step.action?.command,
  args: step.action?.args || [],
  timeoutMs,
  requestedResources: step.action?.requestedResources || task.requestedResources || undefined,
  hostResources: step.action?.hostResources || undefined,
});

export const executeAutonomousRunnerStep = async ({
  task = {},
  step = {},
  executionMode = 'local_workspace_fallback',
  invokeTool = null,
  now = new Date().toISOString(),
} = {}) => {
  if (typeof invokeTool !== 'function') {
    return {
      ok: false,
      message: 'Runner exige runtime Tauri para executar VM/workspace.',
      reason: RUNNER_REASONS.RUNTIME_INVOKE_UNAVAILABLE,
      stdout: '',
      stderr: '',
      artifacts: {
        executionMode,
        runtimeRequired: true,
        runtimeAvailable: false,
        startedAt: now,
        finishedAt: new Date().toISOString(),
      },
    };
  }

  const timeoutMs = resolveStepTimeout(step);
  const startedAt = now;

  try {
    if (step.action?.kind === 'visual') {
      const nativeResult = await invokeTool('run_vm_guest_agent_action', {
        request: {
          action: normalizeText(step.action.visualAction || step.action.command),
          parameters: step.action.parameters || {},
          timeoutMs,
          taskId: `${task.id}:${step.id}`,
          correlationId: `${task.id}:${step.id}`,
        },
      });
      return {
        ...nativeResult,
        artifacts: {
          ...(nativeResult?.artifacts || {}),
          executionMode: 'real_vm',
          startedAt,
          finishedAt: new Date().toISOString(),
        },
      };
    }

    if (!step.action?.command) {
      return {
        ok: false,
        message: 'Step sem comando executavel.',
        reason: RUNNER_REASONS.NO_EXECUTABLE_STEP,
        stdout: '',
        stderr: '',
        artifacts: {
          executionMode,
          startedAt,
          finishedAt: new Date().toISOString(),
        },
      };
    }

    if (executionMode === 'real_vm') {
      const nativeResult = await invokeTool('run_local_vm_guest_task', {
        request: buildCommandRequest({ task, step, timeoutMs }),
      });
      return {
        ...nativeResult,
        artifacts: {
          ...(nativeResult?.artifacts || {}),
          executionMode: 'real_vm',
          startedAt,
          finishedAt: new Date().toISOString(),
        },
      };
    }

    const nativeResult = await invokeTool('run_local_workspace_playground_task', {
      request: buildCommandRequest({ task, step, timeoutMs }),
    });
    return {
      ...nativeResult,
      artifacts: {
        ...(nativeResult?.artifacts || {}),
        executionMode: 'local_workspace_fallback',
        startedAt,
        finishedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: error?.message || String(error),
      reason: 'step_execution_exception',
      stdout: '',
      stderr: error?.stack || error?.message || String(error),
      artifacts: {
        executionMode,
        startedAt,
        finishedAt: new Date().toISOString(),
      },
    };
  }
};
