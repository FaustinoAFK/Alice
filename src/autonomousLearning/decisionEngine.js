import { evaluateAutonomousPolicy } from './policies';
import { createAutonomousActionRequest } from './contracts';

export const createDecisionEngineInput = ({
  actionInput = {},
  behaviorContext,
  now = Date.now(),
} = {}) => {
  const request = createAutonomousActionRequest(actionInput, { now });
  const basePolicyDecision = evaluateAutonomousPolicy(request, {
    now,
    userConfirmed: Boolean(actionInput.userConfirmed),
    realVmAvailable: Boolean(behaviorContext?.playgroundStatus?.realVmAvailable),
  });
  const mindMapSummary = behaviorContext?.mind_map_summary || {};
  const runnerSummary = behaviorContext?.autonomous_runner_summary || {};
  const mindMapPolicyFlags = [
    Number(mindMapSummary.blockedCount || 0) > 0 ? 'mind_map_blockers_present' : '',
    Number(mindMapSummary.failedCount || 0) > 0 ? 'mind_map_failures_present' : '',
    Number(mindMapSummary.highPriorityPending || 0) > 0 ? 'mind_map_high_priority_pending' : '',
  ].filter(Boolean);
  const runnerPolicyFlags = [
    runnerSummary.enabled && runnerSummary.activeTaskId ? 'runner_active_task_present' : '',
    Number(runnerSummary.waitingRetryCount || 0) > 0 ? 'runner_waiting_retry_present' : '',
    Number(runnerSummary.blockedCount || 0) > 0 ? 'runner_blockers_present' : '',
    Number(runnerSummary.failedCount || 0) > 0 ? 'runner_failures_present' : '',
  ].filter(Boolean);
  const policyDecision = {
    ...basePolicyDecision,
    requiresValidation:
      Boolean(basePolicyDecision.requiresValidation) ||
      Number(mindMapSummary.blockedCount || 0) > 0 ||
      Number(mindMapSummary.failedCount || 0) > 0 ||
      Number(runnerSummary.blockedCount || 0) > 0 ||
      Number(runnerSummary.failedCount || 0) > 0,
    policyFlags: [
      ...(basePolicyDecision.policyFlags || []),
      ...mindMapPolicyFlags,
      ...runnerPolicyFlags,
    ],
  };

  return {
    request,
    policyDecision,
    decisionTrace: [
      {
        step: 'turn_context',
        explicitUserRequest: Boolean(behaviorContext?.explicitUserRequest),
      },
      {
        step: 'vm_context',
        realVmAvailable: Boolean(behaviorContext?.playgroundStatus?.realVmAvailable),
        provider: behaviorContext?.playgroundStatus?.provider || 'none',
      },
      {
        step: 'mind_map_context',
        activeMapId: behaviorContext?.mind_map_summary?.activeMapId || '',
        blockedCount: behaviorContext?.mind_map_summary?.blockedCount || 0,
        failedCount: behaviorContext?.mind_map_summary?.failedCount || 0,
        inProgressCount: behaviorContext?.mind_map_summary?.inProgressCount || 0,
        highPriorityPending: behaviorContext?.mind_map_summary?.highPriorityPending || 0,
      },
      {
        step: 'autonomous_runner_context',
        enabled: Boolean(runnerSummary.enabled),
        runnerState: runnerSummary.runnerState || 'idle',
        activeTaskId: runnerSummary.activeTaskId || '',
        queueSize: runnerSummary.queueSize || 0,
        readyCount: runnerSummary.readyCount || 0,
        waitingRetryCount: runnerSummary.waitingRetryCount || 0,
        blockedCount: runnerSummary.blockedCount || 0,
        failedCount: runnerSummary.failedCount || 0,
      },
      {
        step: 'policy',
        allowed: policyDecision.allowed,
        reason: policyDecision.reason,
        flags: policyDecision.policyFlags,
      },
    ],
  };
};
