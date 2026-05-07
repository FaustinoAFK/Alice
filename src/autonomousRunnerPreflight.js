import {
  RUNNER_REASONS,
  RUNNER_TASK_STATUSES,
  appendAutonomousRunnerAudit,
  findNextRunnableStep,
  isExecutableRunnerStep,
  normalizeAutonomousRunnerState,
} from './autonomousRunnerState';
import { hasActiveRunnerLock } from './autonomousRunnerLease';
import { resolveRunnerDependencies } from './autonomousRunnerScheduler';
import { normalizeVmStatus } from './autonomousLearning';
import { validateResolvedFolderTarget } from './filesystem/filesystemNameSanitizer';

const commandLooksUnsafe = (command = '') =>
  /\b(rm\s+-rf|del\s+\/[fsq]|format\b|shutdown\b|restart-computer\b|reg\s+delete)\b/i.test(command);

export const checkRunnerPolicy = (runner = {}) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  if (!normalizedRunner.enabled) {
    return { ok: false, state: 'blocked', reason: 'runner_disabled' };
  }
  if (normalizedRunner.runnerState === 'paused') {
    return { ok: false, state: 'blocked', reason: RUNNER_REASONS.MANUAL_PAUSE };
  }
  if (hasActiveRunnerLock(normalizedRunner)) {
    return { ok: false, state: 'blocked', reason: 'runner_lock_active' };
  }
  return { ok: true };
};

export const checkDependencies = (task = {}, tasksById = {}) => {
  const dependencyState = resolveRunnerDependencies(task, tasksById);
  if (dependencyState.failed.length > 0) {
    return {
      ok: false,
      state: RUNNER_TASK_STATUSES.BLOCKED,
      reason: RUNNER_REASONS.DEPENDENCY_FAILED,
      dependencyState,
    };
  }
  if (dependencyState.unresolved.length > 0) {
    return {
      ok: false,
      state: 'skip',
      reason: RUNNER_REASONS.DEPENDENCY_UNRESOLVED,
      dependencyState,
    };
  }
  return { ok: true, dependencyState };
};

export const checkTaskExecutable = (task = {}, nowMs = Date.now()) => {
  const step = findNextRunnableStep(task, nowMs);
  if (!step) {
    return {
      ok: false,
      state: RUNNER_TASK_STATUSES.BLOCKED,
      reason: RUNNER_REASONS.NO_EXECUTABLE_STEP,
      step: null,
    };
  }
  if (!isExecutableRunnerStep(step)) {
    return {
      ok: false,
      state: RUNNER_TASK_STATUSES.BLOCKED,
      reason: !step.completionCriteria
        ? RUNNER_REASONS.COMPLETION_CRITERIA_MISSING
        : RUNNER_REASONS.NO_EXECUTABLE_STEP,
      step,
    };
  }
  if (commandLooksUnsafe(step.action?.command)) {
    return {
      ok: false,
      state: RUNNER_TASK_STATUSES.BLOCKED,
      reason: RUNNER_REASONS.POLICY_BLOCKED,
      step,
    };
  }
  if (step.action?.folderCreate) {
    const folderValidation = validateResolvedFolderTarget({
      filesystemName: step.action.folderCreate.filesystemName,
      targetPath: step.action.folderCreate.targetPath,
    });
    if (!folderValidation.ok) {
      return {
        ok: false,
        state: RUNNER_TASK_STATUSES.BLOCKED,
        reason: 'folder_target_invalid',
        step: {
          ...step,
          folderValidation,
        },
      };
    }
  }
  return { ok: true, step };
};

export const checkVmAvailability = (task = {}, step = {}, vmStatus = {}) => {
  const normalizedVm = normalizeVmStatus(vmStatus);
  const requestsWorkspaceFallback = ['local_workspace', 'local_workspace_fallback', 'workspace']
    .includes(step.action?.environment);
  const requiresRealVm =
    !requestsWorkspaceFallback &&
    (
      Boolean(task.requiresRealVm) ||
      step.type === 'visual' ||
      step.action?.kind === 'visual' ||
      step.action?.environment === 'real_vm'
    );

  if (requiresRealVm && !normalizedVm.realVmAvailable) {
    return {
      ok: false,
      state: RUNNER_TASK_STATUSES.WAITING_RETRY,
      reason: RUNNER_REASONS.VM_UNAVAILABLE,
      vmStatus: normalizedVm,
    };
  }
  if (requiresRealVm && !normalizedVm.guestCommandReady) {
    return {
      ok: false,
      state: RUNNER_TASK_STATUSES.WAITING_RETRY,
      reason: RUNNER_REASONS.VM_UNAVAILABLE,
      vmStatus: normalizedVm,
    };
  }
  if (
    !requiresRealVm &&
    !normalizedVm.fallbackWorkspaceAvailable &&
    (requestsWorkspaceFallback || !(normalizedVm.realVmAvailable && normalizedVm.guestCommandReady))
  ) {
    return {
      ok: false,
      state: RUNNER_TASK_STATUSES.WAITING_RETRY,
      reason: RUNNER_REASONS.WORKSPACE_UNAVAILABLE,
      vmStatus: normalizedVm,
    };
  }

  return {
    ok: true,
    vmStatus: normalizedVm,
    executionMode: requiresRealVm || (!requestsWorkspaceFallback && normalizedVm.realVmAvailable && normalizedVm.guestCommandReady)
      ? 'real_vm'
      : 'local_workspace_fallback',
  };
};

export const checkWorkspaceReady = (task = {}, step = {}, vmDecision = {}) => {
  if (vmDecision.executionMode === 'real_vm') {
    return { ok: true };
  }
  if (task.allowWorkspaceFallback === false) {
    return {
      ok: false,
      state: RUNNER_TASK_STATUSES.WAITING_RETRY,
      reason: RUNNER_REASONS.WORKSPACE_UNAVAILABLE,
    };
  }
  if (step.action?.kind === 'visual') {
    return {
      ok: false,
      state: RUNNER_TASK_STATUSES.BLOCKED,
      reason: RUNNER_REASONS.NO_EXECUTABLE_STEP,
    };
  }
  return { ok: true };
};

export const runAutonomousRunnerPreflight = (
  runner,
  task,
  {
    vmStatus = {},
    now = new Date().toISOString(),
    nowMs = Date.now(),
  } = {},
) => {
  let nextRunner = normalizeAutonomousRunnerState(runner);
  const policy = checkRunnerPolicy(nextRunner);
  if (!policy.ok) {
    return { ok: false, state: policy.state, reason: policy.reason, runner: nextRunner };
  }

  const dependencies = checkDependencies(task, nextRunner.tasksById);
  if (!dependencies.ok) {
    return {
      ok: false,
      state: dependencies.state,
      reason: dependencies.reason,
      dependencyState: dependencies.dependencyState,
      runner: appendAutonomousRunnerAudit(nextRunner, {
        timestamp: now,
        type: 'preflight',
        taskId: task.id,
        summary: `Preflight bloqueou dependencia de ${task.title}.`,
        reason: dependencies.reason,
        metadata: dependencies.dependencyState,
      }),
    };
  }

  const executable = checkTaskExecutable(task, nowMs);
  if (!executable.ok) {
    return {
      ok: false,
      state: executable.state,
      reason: executable.reason,
      step: executable.step,
      runner: appendAutonomousRunnerAudit(nextRunner, {
        timestamp: now,
        type: 'preflight',
        taskId: task.id,
        stepId: executable.step?.id || '',
        summary: `Preflight rejeitou step de ${task.title}.`,
        reason: executable.reason,
      }),
    };
  }

  const vm = checkVmAvailability(task, executable.step, vmStatus);
  if (!vm.ok) {
    return {
      ok: false,
      state: vm.state,
      reason: vm.reason,
      step: executable.step,
      vmStatus: vm.vmStatus,
      runner: appendAutonomousRunnerAudit(nextRunner, {
        timestamp: now,
        type: 'preflight',
        taskId: task.id,
        stepId: executable.step.id,
        summary: `Preflight aguardando ambiente para ${task.title}.`,
        reason: vm.reason,
        metadata: { provider: vm.vmStatus.provider, status: vm.vmStatus.status },
      }),
    };
  }

  const workspace = checkWorkspaceReady(task, executable.step, vm);
  if (!workspace.ok) {
    return {
      ok: false,
      state: workspace.state,
      reason: workspace.reason,
      step: executable.step,
      vmStatus: vm.vmStatus,
      runner: appendAutonomousRunnerAudit(nextRunner, {
        timestamp: now,
        type: 'preflight',
        taskId: task.id,
        stepId: executable.step.id,
        summary: `Workspace indisponivel para ${task.title}.`,
        reason: workspace.reason,
      }),
    };
  }

  nextRunner = appendAutonomousRunnerAudit(nextRunner, {
    timestamp: now,
    type: 'preflight',
    taskId: task.id,
    stepId: executable.step.id,
    summary: `Preflight aprovado para ${task.title}.`,
    reason: 'preflight_passed',
    metadata: { executionMode: vm.executionMode },
  });

  return {
    ok: true,
    runner: nextRunner,
    task,
    step: executable.step,
    vmStatus: vm.vmStatus,
    executionMode: vm.executionMode,
  };
};
