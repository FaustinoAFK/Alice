import {
  RUNNER_REASONS,
  RUNNER_TASK_STATUSES,
  enqueueAutonomousRunnerTask,
  normalizeAutonomousRunnerState,
  updateAutonomousRunnerTask,
} from './autonomousRunnerState';

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const latestFailureSignature = (task = {}) => {
  const history = task.executionHistory || [];
  const latest = history.at(-1);
  const command = normalizeText(latest?.step?.action?.command || latest?.command);
  const reason = normalizeText(latest?.validation?.reason || latest?.reason);
  const stderr = normalizeText(latest?.result?.stderr).slice(0, 160);
  return [command, reason, stderr].filter(Boolean).join('|');
};

export const detectRecoveryLoop = (task = {}) => {
  const history = task.executionHistory || [];
  if (history.length < 2) {
    return false;
  }

  const latestSignature = latestFailureSignature(task);
  if (!latestSignature) {
    return false;
  }

  const repeated = history
    .slice(0, -1)
    .filter((entry) => {
      const signature = [
        normalizeText(entry?.step?.action?.command || entry?.command),
        normalizeText(entry?.validation?.reason || entry?.reason),
        normalizeText(entry?.result?.stderr).slice(0, 160),
      ].filter(Boolean).join('|');
      return signature === latestSignature;
    });

  return repeated.length >= 1;
};

export const createRecoveryTaskForDependencyFailure = (
  runner,
  task,
  dependency,
  { now = new Date().toISOString() } = {},
) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const failedDependency = normalizedRunner.tasksById[dependency.taskId];
  if (!failedDependency) {
    return normalizedRunner;
  }

  if ((task.recoveryAttempts || []).some((recoveryTaskId) => normalizedRunner.tasksById[recoveryTaskId]?.status !== RUNNER_TASK_STATUSES.FAILED)) {
    return normalizedRunner;
  }

  const recoveryInput = {
    title: `Recuperar dependencia: ${failedDependency.title}`,
    description: `Task de recuperacao criada para liberar ${task.title}.`,
    status: RUNNER_TASK_STATUSES.PLANNED,
    priority: task.priority,
    queueRank: Number(task.queueRank || 0) - 0.1,
    recoveryOfTaskId: failedDependency.id,
    maxAttempts: 2,
    plan: {
      summary: 'Recovery precisa de plano operacional revisavel antes de executar.',
      assumptions: [],
      risks: ['Recovery automatico nao deve inventar sucesso.'],
      dependencies: [],
    },
    steps: [],
    reason: RUNNER_REASONS.DEPENDENCY_FAILED,
  };
  const withRecovery = enqueueAutonomousRunnerTask(normalizedRunner, recoveryInput, { now });
  const recoveryTask = Object.values(withRecovery.tasksById)
    .filter((item) => item.recoveryOfTaskId === failedDependency.id)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0];

  return updateAutonomousRunnerTask(withRecovery, task.id, {
    recoveryAttempts: [...(task.recoveryAttempts || []), recoveryTask?.id].filter(Boolean),
    status: RUNNER_TASK_STATUSES.BLOCKED,
    reason: RUNNER_REASONS.DEPENDENCY_FAILED,
    updatedAt: now,
  }, {
    now,
    audit: {
      type: 'recovery',
      summary: `Recovery criada para dependencia de ${task.title}.`,
      reason: RUNNER_REASONS.DEPENDENCY_FAILED,
      metadata: {
        dependencyTaskId: dependency.taskId,
        recoveryTaskId: recoveryTask?.id || '',
      },
    },
  });
};

export const applyRecoveryLoopGuard = (
  runner,
  taskId,
  { now = new Date().toISOString() } = {},
) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const task = normalizedRunner.tasksById[taskId];
  if (!task || !detectRecoveryLoop(task)) {
    return normalizedRunner;
  }

  return updateAutonomousRunnerTask(normalizedRunner, task.id, {
    status: RUNNER_TASK_STATUSES.BLOCKED,
    reason: RUNNER_REASONS.RECOVERY_LOOP_DETECTED,
    updatedAt: now,
  }, {
    now,
    audit: {
      type: 'recovery',
      summary: `Loop de recovery detectado em ${task.title}.`,
      reason: RUNNER_REASONS.RECOVERY_LOOP_DETECTED,
    },
  });
};
