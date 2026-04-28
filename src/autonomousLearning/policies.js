import {
  ENVIRONMENT_TYPES,
  EXECUTION_MODES,
  RISK_LEVELS,
  TASK_PRIORITIES,
  createAutonomousActionRequest,
  createPolicyDecision,
  isHighRisk,
  isUserPriority,
} from './contracts';

const IMPORTANT_REAL_PC_ACTIONS = new Set([
  'script_generation',
  'script_validation',
  'file_analysis',
  'user_request',
  'vm_ui_interaction',
  'rollback',
]);

export const evaluateAutonomousPolicy = (rawRequest = {}, context = {}) => {
  const request = createAutonomousActionRequest(rawRequest, {
    now: context.now || Date.now(),
  });
  const flags = [];
  const shouldPauseBackground = isUserPriority(request.priority);

  if (request.environment === ENVIRONMENT_TYPES.LOCAL_VM_PLAYGROUND) {
    if (request.usesRealFilesDirectly) {
      return createPolicyDecision({
        allowed: false,
        shouldPauseBackground,
        reason: 'local_vm_playground_must_use_copies',
        policyFlags: ['real_vm_copy_only'],
      });
    }

    if (!context.realVmAvailable) {
      if (request.requiresRealVm || request.riskLevel === RISK_LEVELS.HIGH || request.riskLevel === RISK_LEVELS.CRITICAL) {
        return createPolicyDecision({
          allowed: false,
          shouldPauseBackground,
          requiresValidation: true,
          reason: 'real_local_vm_unavailable',
          policyFlags: ['real_vm_required', 'provider_unavailable'],
        });
      }

      if (!request.allowWorkspaceFallback) {
        return createPolicyDecision({
          allowed: false,
          shouldPauseBackground,
          requiresValidation: true,
          reason: 'workspace_fallback_not_allowed',
          policyFlags: ['provider_unavailable', 'fallback_denied'],
        });
      }

      return createPolicyDecision({
        allowed: true,
        requiresConfirmation: false,
        requiresSnapshot: false,
        requiresValidation: request.executionMode !== EXECUTION_MODES.PROPOSAL,
        requiresRollbackPlan: false,
        shouldPauseBackground,
        reason: 'real_vm_unavailable_workspace_fallback_allowed',
        policyFlags: ['real_vm_unavailable', 'local_workspace_fallback', 'copy_workspace'],
      });
    }

    return createPolicyDecision({
      allowed: true,
      requiresConfirmation: false,
      requiresSnapshot: false,
      requiresValidation: request.executionMode !== EXECUTION_MODES.PROPOSAL,
      requiresRollbackPlan: false,
      shouldPauseBackground,
      reason: 'local_vm_playground_allows_controlled_experiment',
      policyFlags: ['real_local_vm', 'copy_workspace'],
    });
  }

  if (request.environment === ENVIRONMENT_TYPES.LOCAL_WORKSPACE_FALLBACK) {
    if (request.usesRealFilesDirectly) {
      return createPolicyDecision({
        allowed: false,
        shouldPauseBackground,
        reason: 'workspace_fallback_must_use_copies',
        policyFlags: ['workspace_copy_only'],
      });
    }

    if (isHighRisk(request.riskLevel) || request.requiresSystemAccess || request.requiresRealVm) {
      return createPolicyDecision({
        allowed: false,
        shouldPauseBackground,
        requiresValidation: true,
        reason: 'workspace_fallback_cannot_run_high_risk_or_vm_required_task',
        policyFlags: ['workspace_fallback', 'insufficient_isolation'],
      });
    }

    return createPolicyDecision({
      allowed: true,
      requiresConfirmation: false,
      requiresSnapshot: false,
      requiresValidation: request.executionMode !== EXECUTION_MODES.PROPOSAL,
      requiresRollbackPlan: false,
      shouldPauseBackground,
      reason: 'local_workspace_fallback_allowed_for_low_medium_risk_copy_task',
      policyFlags: ['local_workspace_fallback', 'copy_workspace', 'not_real_vm'],
    });
  }

  if (request.environment !== ENVIRONMENT_TYPES.REAL_PC) {
    return createPolicyDecision({
      allowed: false,
      shouldPauseBackground,
      reason: 'unknown_environment',
      policyFlags: ['invalid_environment'],
    });
  }

  if (request.affectsOfficialCode && request.executionMode !== EXECUTION_MODES.PROPOSAL) {
    return createPolicyDecision({
      allowed: false,
      requiresConfirmation: true,
      requiresSnapshot: true,
      requiresValidation: true,
      requiresRollbackPlan: true,
      shouldPauseBackground,
      reason: 'official_code_changes_require_proposal_first',
      policyFlags: ['official_code', 'proposal_required'],
    });
  }

  const touchesFiles = request.targetFiles.length > 0;
  const importantAction = IMPORTANT_REAL_PC_ACTIONS.has(request.actionType);
  const riskNeedsGuard = request.riskLevel === RISK_LEVELS.MEDIUM || isHighRisk(request.riskLevel);

  if (touchesFiles || importantAction || riskNeedsGuard) {
    flags.push('real_pc_guarded');
  }

  if (request.requiresSystemAccess) {
    flags.push('system_access');
  }

  const requiresConfirmation =
    isHighRisk(request.riskLevel) ||
    request.requiresSystemAccess ||
    (request.affectsOfficialCode && request.executionMode === EXECUTION_MODES.PROPOSAL);

  if (requiresConfirmation && !context.userConfirmed) {
    return createPolicyDecision({
      allowed: false,
      requiresConfirmation: true,
      requiresSnapshot: true,
      requiresValidation: true,
      requiresRollbackPlan: true,
      shouldPauseBackground,
      reason: isHighRisk(request.riskLevel)
        ? 'high_risk_real_pc_action_requires_confirmation'
        : 'real_pc_action_requires_confirmation',
      policyFlags: [...flags, 'confirmation_required'],
    });
  }

  return createPolicyDecision({
    allowed: true,
    requiresConfirmation,
    requiresSnapshot: touchesFiles || importantAction || riskNeedsGuard,
    requiresValidation: touchesFiles || importantAction || riskNeedsGuard,
    requiresRollbackPlan: touchesFiles || importantAction || riskNeedsGuard,
    shouldPauseBackground,
    reason: 'real_pc_action_allowed_with_guards',
    policyFlags: flags,
  });
};

export const shouldTaskYieldToUserRequest = (task) =>
  task?.priority === TASK_PRIORITIES.BACKGROUND_LEARNING ||
  task?.priority === TASK_PRIORITIES.BACKGROUND_OPTIMIZATION ||
  task?.priority === TASK_PRIORITIES.INTERNAL_IMPROVEMENT;
