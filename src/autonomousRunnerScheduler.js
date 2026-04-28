import {
  RUNNER_STATES,
  RUNNER_TASK_STATUSES,
  appendAutonomousRunnerAudit,
  findNextRunnableStep,
  normalizeAutonomousRunnerState,
} from './autonomousRunnerState';
import { hasActiveRunnerLock } from './autonomousRunnerLease';

const PRIORITY_RANK = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const toMs = (timestamp) => {
  const parsed = Date.parse(timestamp || '');
  return Number.isFinite(parsed) ? parsed : 0;
};

export const isRetryDue = (task = {}, nowMs = Date.now()) =>
  !task.nextRunAt || toMs(task.nextRunAt) <= nowMs;

export const resolveRunnerDependencies = (task = {}, tasksById = {}) => {
  const unresolved = [];
  const failed = [];

  (task.dependencies || []).forEach((dependency) => {
    const requiredTask = tasksById[dependency.taskId];
    if (!requiredTask) {
      unresolved.push({ ...dependency, reason: 'missing_dependency' });
      return;
    }
    if ([RUNNER_TASK_STATUSES.FAILED, RUNNER_TASK_STATUSES.BLOCKED, RUNNER_TASK_STATUSES.CANCELLED].includes(requiredTask.status)) {
      failed.push({ ...dependency, actualStatus: requiredTask.status });
      return;
    }
    if (requiredTask.status !== dependency.requiredStatus) {
      unresolved.push({ ...dependency, actualStatus: requiredTask.status });
    }
  });

  return {
    satisfied: unresolved.length === 0 && failed.length === 0,
    unresolved,
    failed,
  };
};

export const isTaskEligibleByStatus = (task = {}, nowMs = Date.now()) => {
  if (task.status === RUNNER_TASK_STATUSES.READY) {
    return true;
  }
  if (task.status === RUNNER_TASK_STATUSES.PLANNED) {
    return true;
  }
  if (task.status === RUNNER_TASK_STATUSES.WAITING_RETRY) {
    return isRetryDue(task, nowMs);
  }
  return false;
};

export const getEligibleRunnerTasks = (runner, { nowMs = Date.now() } = {}) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const tasks = normalizedRunner.queue
    .map((taskId) => normalizedRunner.tasksById[taskId])
    .filter(Boolean);
  const skipped = [];
  const eligible = [];

  tasks.forEach((task) => {
    const dependencyState = resolveRunnerDependencies(task, normalizedRunner.tasksById);
    if (!isTaskEligibleByStatus(task, nowMs)) {
      skipped.push({ taskId: task.id, reason: `status:${task.status}` });
      return;
    }
    if (task.status === RUNNER_TASK_STATUSES.WAITING_RETRY && !isRetryDue(task, nowMs)) {
      skipped.push({ taskId: task.id, reason: 'retry_not_due' });
      return;
    }
    if (!dependencyState.satisfied) {
      skipped.push({
        taskId: task.id,
        reason: dependencyState.failed.length ? 'dependency_failed' : 'dependency_unresolved',
        dependencies: dependencyState,
      });
      return;
    }
    if (task.status !== RUNNER_TASK_STATUSES.PLANNED && !findNextRunnableStep(task, nowMs)) {
      skipped.push({ taskId: task.id, reason: 'no_executable_step' });
      return;
    }
    if (task.attempts >= task.maxAttempts) {
      skipped.push({ taskId: task.id, reason: 'max_attempts_reached' });
      return;
    }
    eligible.push(task);
  });

  return {
    eligible: eligible.sort((left, right) =>
      (PRIORITY_RANK[left.priority] ?? 99) - (PRIORITY_RANK[right.priority] ?? 99) ||
      Number(left.queueRank || 0) - Number(right.queueRank || 0) ||
      toMs(left.nextRunAt) - toMs(right.nextRunAt) ||
      toMs(left.createdAt) - toMs(right.createdAt),
    ),
    skipped,
  };
};

export const selectNextEligibleTask = (runner, { now = new Date().toISOString(), nowMs = Date.now() } = {}) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const result = getEligibleRunnerTasks(normalizedRunner, { nowMs });
  const selected = result.eligible[0] || null;

  return {
    task: selected,
    skipped: result.skipped,
    runner: appendAutonomousRunnerAudit(normalizedRunner, {
      timestamp: now,
      type: 'queue_decision',
      taskId: selected?.id || '',
      summary: selected ? `Task escolhida: ${selected.title}` : 'Nenhuma task elegivel no momento.',
      reason: selected ? 'task_selected' : 'no_eligible_task',
      metadata: {
        selectedTaskId: selected?.id || '',
        skipped: result.skipped.slice(0, 12),
      },
    }),
  };
};

export const computeNextRunnerIntervalMs = (
  runner,
  { nowMs = Date.now(), lastReason = '' } = {},
) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const intervals = normalizedRunner.settings.intervals;
  if (!normalizedRunner.enabled) {
    return intervals.pausedIntervalMs;
  }
  if (normalizedRunner.runnerState === RUNNER_STATES.PAUSED) {
    return intervals.pausedIntervalMs;
  }
  if (hasActiveRunnerLock(normalizedRunner)) {
    return intervals.heartbeatIntervalMs;
  }
  if (lastReason === 'vm_unavailable' || lastReason === 'workspace_unavailable') {
    return intervals.vmUnavailableIntervalMs;
  }
  const { eligible } = getEligibleRunnerTasks(normalizedRunner, { nowMs });
  if (eligible.length > 0) {
    return intervals.readyIntervalMs;
  }
  const retryTimes = Object.values(normalizedRunner.tasksById)
    .filter((task) => task.status === RUNNER_TASK_STATUSES.WAITING_RETRY && task.nextRunAt)
    .map((task) => toMs(task.nextRunAt))
    .filter((time) => time > nowMs)
    .sort((left, right) => left - right);
  if (retryTimes.length > 0) {
    return Math.max(1000, Math.min(intervals.idleIntervalMs, retryTimes[0] - nowMs));
  }
  return intervals.idleIntervalMs;
};
