import {
  TASK_TYPES,
  VM_VISUAL_ACTIONS,
  normalizeText,
} from './contracts';
import {
  appendVmVisualReplayStep,
  createVmVisualReplay,
  finishVmVisualReplay,
} from './replayRecorder';
import {
  createVisualContext,
  validateVmVisualActionProposal,
} from './vmUiModels';

const DEFAULT_MAX_STEPS = 8;
const DEFAULT_TOTAL_TIMEOUT_MS = 60000;

export const runVmVisualLoop = async ({
  objective = '',
  taskId = '',
  provider = '',
  vmName = '',
  capabilities = {},
  agent,
  planner,
  validateStep,
  maxSteps = DEFAULT_MAX_STEPS,
  timeoutTotalMs = DEFAULT_TOTAL_TIMEOUT_MS,
  now = Date.now,
} = {}) => {
  if (!agent || typeof agent.captureScreen !== 'function' || typeof agent.executeAction !== 'function') {
    return {
      ok: false,
      reason: 'vm_visual_agent_unavailable',
      replay: finishVmVisualReplay(createVmVisualReplay({ taskId, objective, provider, vmName, startedAt: now() }), {
        status: 'failed',
        finishedAt: now(),
        error: 'vm_visual_agent_unavailable',
      }),
    };
  }

  const startedAt = now();
  let replay = createVmVisualReplay({ taskId, objective, provider, vmName, startedAt });
  let visualContext = createVisualContext(await agent.captureScreen({ taskId, objective }));
  let finalReason = 'max_steps_reached';

  for (let index = 0; index < maxSteps; index += 1) {
    if (now() - startedAt > timeoutTotalMs) {
      finalReason = 'vm_visual_loop_timeout';
      break;
    }

    const proposedAction =
      typeof planner === 'function'
        ? await planner({ objective, visualContext, replay, stepIndex: index })
        : { action: VM_VISUAL_ACTIONS.WAIT, parameters: { durationMs: 250 }, reason: 'no_planner_available' };

    const decisionResult = validateVmVisualActionProposal({
      proposedAction,
      visualContext,
      previousSteps: replay.steps,
      capabilities,
    });

    if (!decisionResult.allowed) {
      replay = appendVmVisualReplayStep(replay, {
        stepId: `step-${index + 1}`,
        partialObjective: objective,
        visualContextBefore: visualContext,
        proposedAction,
        decisionResult,
        error: decisionResult.reason,
        timestamp: now(),
      });
      finalReason = decisionResult.reason;
      break;
    }

    const actionStartedAt = now();
    const actionResult = await agent.executeAction(proposedAction);
    const visualContextAfter = createVisualContext(await agent.captureScreen({ taskId, objective, afterAction: true }));
    const validationResult =
      typeof validateStep === 'function'
        ? await validateStep({ objective, proposedAction, actionResult, visualContext, visualContextAfter, replay })
        : { passed: Boolean(actionResult?.success ?? actionResult?.ok), reason: 'agent_action_result' };

    replay = appendVmVisualReplayStep(replay, {
      stepId: `step-${index + 1}`,
      partialObjective: objective,
      visualContextBefore: visualContext,
      proposedAction,
      decisionResult,
      executedAction: proposedAction,
      visualContextAfter,
      validationResult,
      error: actionResult?.error || '',
      timestamp: actionStartedAt,
      durationMs: now() - actionStartedAt,
    });

    visualContext = visualContextAfter;

    if (validationResult?.completed) {
      finalReason = 'objective_completed';
      replay = finishVmVisualReplay(replay, { status: 'done', finishedAt: now() });
      return {
        ok: true,
        taskType: TASK_TYPES.VM_UI_INTERACTION,
        reason: finalReason,
        replay,
        visualContext,
      };
    }

    if (validationResult && validationResult.passed === false) {
      finalReason = normalizeText(validationResult.reason) || 'visual_validation_failed';
      break;
    }
  }

  replay = finishVmVisualReplay(replay, {
    status: finalReason === 'objective_completed' ? 'done' : 'failed',
    finishedAt: now(),
    error: finalReason === 'objective_completed' ? '' : finalReason,
  });

  return {
    ok: finalReason === 'objective_completed',
    taskType: TASK_TYPES.VM_UI_INTERACTION,
    reason: finalReason,
    replay,
    visualContext,
  };
};
