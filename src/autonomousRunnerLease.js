import { v4 as uuidv4 } from 'uuid';
import {
  DEFAULT_RUNNER_STALE_TIMEOUT_MS,
  RUNNER_REASONS,
  RUNNER_STATES,
  RUNNER_TASK_STATUSES,
  appendAutonomousRunnerAudit,
  normalizeAutonomousRunnerState,
  transitionAutonomousRunnerStep,
  transitionAutonomousRunnerTask,
  updateAutonomousRunnerTask,
} from './autonomousRunnerState';

const normalizeText = (value) => String(value || '').trim();

const toMs = (timestamp) => {
  const parsed = Date.parse(timestamp || '');
  return Number.isFinite(parsed) ? parsed : 0;
};

export const createRunnerLeaseId = () => `runner-lease-${uuidv4()}`;

export const isRunnerHeartbeatStale = (task = {}, nowMs = Date.now()) => {
  const heartbeatAt = toMs(task.heartbeatAt);
  const staleTimeoutMs = Math.max(1000, Number(task.staleTimeoutMs || DEFAULT_RUNNER_STALE_TIMEOUT_MS));
  return !heartbeatAt || nowMs - heartbeatAt > staleTimeoutMs;
};

export const hasActiveRunnerLock = (runner = {}) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const lock = normalizedRunner.runnerLock;
  if (!lock?.activeTaskId || !lock?.leaseId) {
    return false;
  }

  const task = normalizedRunner.tasksById[lock.activeTaskId];
  return Boolean(task && task.status === RUNNER_TASK_STATUSES.RUNNING && task.leaseId === lock.leaseId);
};

export const acquireRunnerLease = (
  runner,
  taskId,
  stepId,
  { now = new Date().toISOString(), staleTimeoutMs = DEFAULT_RUNNER_STALE_TIMEOUT_MS } = {},
) => {
  let nextRunner = normalizeAutonomousRunnerState(runner);
  if (hasActiveRunnerLock(nextRunner)) {
    return {
      ok: false,
      reason: 'runner_lock_active',
      runner: appendAutonomousRunnerAudit(nextRunner, {
        timestamp: now,
        type: 'lease_rejected',
        taskId,
        stepId,
        summary: 'Lease rejeitado porque ja existe lock ativo.',
        reason: 'runner_lock_active',
      }),
    };
  }

  const task = nextRunner.tasksById[normalizeText(taskId)];
  const step = task?.steps.find((item) => item.id === stepId);
  if (!task || !step) {
    return {
      ok: false,
      reason: 'task_or_step_not_found',
      runner: nextRunner,
    };
  }

  const leaseId = createRunnerLeaseId();
  const taskTransition = transitionAutonomousRunnerTask(nextRunner, task.id, RUNNER_TASK_STATUSES.RUNNING, {
    now,
    reason: 'lease_acquired',
    metadata: { leaseId, stepId },
  });
  if (!taskTransition.ok) {
    return {
      ok: false,
      reason: taskTransition.reason,
      runner: taskTransition.runner,
    };
  }

  const stepTransition = transitionAutonomousRunnerStep(taskTransition.runner, task.id, step.id, 'running', {
    now,
    reason: 'lease_acquired',
    metadata: { leaseId },
  });
  if (!stepTransition.ok) {
    return {
      ok: false,
      reason: stepTransition.reason,
      runner: stepTransition.runner,
    };
  }

  nextRunner = updateAutonomousRunnerTask(stepTransition.runner, task.id, {
    leaseId,
    runningStartedAt: now,
    heartbeatAt: now,
    staleTimeoutMs,
    activeStepId: step.id,
    lastAttemptAt: now,
    attempts: Number(task.attempts || 0) + 1,
    updatedAt: now,
  });

  nextRunner = {
    ...nextRunner,
    runnerState: RUNNER_STATES.RUNNING,
    activeTaskId: task.id,
    runnerLock: {
      activeTaskId: task.id,
      activeStepId: step.id,
      leaseId,
      acquiredAt: now,
      heartbeatAt: now,
    },
  };

  return {
    ok: true,
    leaseId,
    runner: appendAutonomousRunnerAudit(nextRunner, {
      timestamp: now,
      type: 'lease_acquired',
      taskId: task.id,
      stepId: step.id,
      summary: `Lease adquirido para ${task.title}.`,
      reason: 'lease_acquired',
      metadata: { leaseId },
    }),
  };
};

export const heartbeatRunnerLease = (
  runner,
  leaseId,
  { now = new Date().toISOString() } = {},
) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const lock = normalizedRunner.runnerLock;
  if (!lock || lock.leaseId !== leaseId) {
    return normalizedRunner;
  }

  const nextRunner = updateAutonomousRunnerTask(normalizedRunner, lock.activeTaskId, {
    heartbeatAt: now,
    updatedAt: now,
  });

  return {
    ...nextRunner,
    runnerLock: {
      ...lock,
      heartbeatAt: now,
    },
  };
};

export const releaseRunnerLease = (
  runner,
  leaseId,
  { now = new Date().toISOString(), reason = 'lease_released' } = {},
) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const lock = normalizedRunner.runnerLock;

  if (!lock || (leaseId && lock.leaseId !== leaseId)) {
    return normalizedRunner;
  }

  return appendAutonomousRunnerAudit(
    {
      ...normalizedRunner,
      runnerState: normalizedRunner.enabled ? RUNNER_STATES.IDLE : RUNNER_STATES.IDLE,
      activeTaskId: null,
      runnerLock: null,
    },
    {
      timestamp: now,
      type: 'lease_released',
      taskId: lock.activeTaskId,
      stepId: lock.activeStepId,
      summary: 'Lease liberado.',
      reason,
      metadata: { leaseId: lock.leaseId },
    },
  );
};

export const recoverAutonomousTasksOnStartup = (
  runner,
  { now = new Date().toISOString(), nowMs = Date.now() } = {},
) => {
  let nextRunner = normalizeAutonomousRunnerState(runner);
  const runningTasks = Object.values(nextRunner.tasksById).filter(
    (task) => task.status === RUNNER_TASK_STATUSES.RUNNING,
  );
  let recovered = false;

  runningTasks.forEach((task) => {
    const lockMatches =
      nextRunner.runnerLock?.activeTaskId === task.id &&
      nextRunner.runnerLock?.leaseId &&
      nextRunner.runnerLock?.leaseId === task.leaseId;
    const stale = isRunnerHeartbeatStale(task, nowMs);
    const nextStatus = task.attempts >= task.maxAttempts
      ? RUNNER_TASK_STATUSES.FAILED
      : RUNNER_TASK_STATUSES.WAITING_RETRY;

    if (!lockMatches || stale) {
      const transition = transitionAutonomousRunnerTask(nextRunner, task.id, nextStatus, {
        now,
        reason: stale ? RUNNER_REASONS.STALE_RUNNING_TASK : 'invalid_runner_lock',
        metadata: {
          previousLeaseId: task.leaseId,
          lockMatches,
          stale,
        },
      });
      nextRunner = transition.runner;
      nextRunner = updateAutonomousRunnerTask(nextRunner, task.id, {
        leaseId: null,
        runningStartedAt: null,
        heartbeatAt: null,
        nextRunAt: nextStatus === RUNNER_TASK_STATUSES.WAITING_RETRY
          ? new Date(Date.parse(now) + 5000).toISOString()
          : task.nextRunAt,
      });
      recovered = true;
    }
  });

  if (recovered || !hasActiveRunnerLock(nextRunner)) {
    nextRunner = {
      ...nextRunner,
      activeTaskId: hasActiveRunnerLock(nextRunner) ? nextRunner.activeTaskId : null,
      runnerLock: hasActiveRunnerLock(nextRunner) ? nextRunner.runnerLock : null,
      runnerState: nextRunner.enabled ? RUNNER_STATES.IDLE : RUNNER_STATES.IDLE,
    };
  }

  return appendAutonomousRunnerAudit(nextRunner, {
    timestamp: now,
    type: 'startup_recovery',
    summary: recovered
      ? 'Recovery de startup recuperou tasks running sem heartbeat valido.'
      : 'Recovery de startup verificou runner sem tasks presas.',
    reason: recovered ? RUNNER_REASONS.STALE_RUNNING_TASK : 'no_stale_task',
    metadata: { recovered },
  });
};
