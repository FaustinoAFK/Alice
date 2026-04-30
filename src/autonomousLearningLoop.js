import {
  enqueueAutonomousRunnerMemoryTask,
  getAutonomousLearningMemoryState,
  getAutonomousOptimizationMemoryState,
  getAutonomousRunnerState,
  pruneAliceMemory,
  updateAutonomousLearningMemoryState,
  updateAutonomousOptimizationMemoryState,
  updateAutonomousRunnerState,
} from './aliceMemory';
import { scanAutonomousCapabilityGaps } from './autonomousCapabilityScanner';
import {
  AUTONOMOUS_LEARNING_CREATED_BY,
  AUTONOMOUS_OPTIMIZER_CREATED_BY,
  AUTONOMOUS_REUSE_CREATED_BY,
  canStartAutonomousLearningCycle,
  normalizeAutonomousLearningPolicy,
} from './autonomousLearningPolicy';
import {
  createAutonomousLearningTaskForGap,
} from './autonomousLearningPlanner';
import { validateLearningExperimentTask } from './autonomousLearningValidator';
import { promoteLearningValidation } from './autonomousProcedurePromoter';
import { resolveProcedureReuseForGap } from './autonomousProcedureReuseEngine';
import { planProcedureOptimizationTasks } from './autonomousProcedureOptimizer';
import { rebuildProcedureReuseIndex } from './autonomousReuseIndex';
import {
  RUNNER_STEP_STATUSES,
  RUNNER_TASK_STATUSES,
  appendAutonomousRunnerAudit,
  normalizeAutonomousRunnerState,
} from './autonomousRunnerState';

const TERMINAL_TASK_STATUSES = new Set([
  RUNNER_TASK_STATUSES.DONE,
  RUNNER_TASK_STATUSES.FAILED,
  RUNNER_TASK_STATUSES.CANCELLED,
]);

const normalizeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const createdBySet = new Set([
  AUTONOMOUS_LEARNING_CREATED_BY,
  AUTONOMOUS_REUSE_CREATED_BY,
  AUTONOMOUS_OPTIMIZER_CREATED_BY,
]);

export const isRunnerSafeForAutonomousLearning = (runner = {}) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const issues = [];
  if (normalizedRunner.runnerLock) {
    issues.push('runner_lock_active');
  }
  Object.values(normalizedRunner.tasksById).forEach((task) => {
    if (task.status === RUNNER_TASK_STATUSES.RUNNING) {
      issues.push(`task_running:${task.id}`);
    }
    task.steps.forEach((step) => {
      if (step.status === RUNNER_STEP_STATUSES.RUNNING) {
        issues.push(`step_running:${task.id}:${step.id}`);
      }
    });
  });
  return {
    ok: issues.length === 0,
    issues,
  };
};

const appendLearningAudit = (state = {}, event = {}) => ({
  ...state,
  auditLog: [
    ...normalizeArray(state.auditLog),
    {
      id: event.id || `learning-audit-${Date.now()}-${normalizeArray(state.auditLog).length + 1}`,
      timestamp: event.timestamp || new Date().toISOString(),
      type: event.type || 'event',
      summary: normalizeText(event.summary),
      reason: normalizeText(event.reason),
      metadata: event.metadata && typeof event.metadata === 'object' ? event.metadata : {},
    },
  ].slice(-120),
});

const activeLoopTasks = (runner = {}) =>
  Object.values(normalizeAutonomousRunnerState(runner).tasksById)
    .filter((task) => createdBySet.has(task.metadata?.createdBy))
    .filter((task) => !TERMINAL_TASK_STATUSES.has(task.status));

const isTerminalExperimentRecord = (experiment = {}) =>
  ['validated', 'rejected', 'promoted'].includes(normalizeText(experiment.status));

const completedUnprocessedLearningTasks = (runner = {}, learningState = {}) => {
  const processed = new Set(
    normalizeArray(learningState.recentExperiments)
      .filter(isTerminalExperimentRecord)
      .map((experiment) => experiment.taskId),
  );
  return Object.values(normalizeAutonomousRunnerState(runner).tasksById)
    .filter((task) => task.metadata?.createdBy === AUTONOMOUS_LEARNING_CREATED_BY)
    .filter((task) => task.status === RUNNER_TASK_STATUSES.DONE)
    .filter((task) => !processed.has(task.id));
};

const buildVerificationAdapter = (verifyRunnerEvidence) => {
  if (typeof verifyRunnerEvidence === 'function') {
    return verifyRunnerEvidence;
  }
  return null;
};

const processCompletedLearningTasks = async ({
  memory,
  verifyRunnerEvidence,
  now,
} = {}) => {
  let nextMemory = pruneAliceMemory(memory);
  let learningState = getAutonomousLearningMemoryState(nextMemory);
  const runner = getAutonomousRunnerState(nextMemory);
  const tasks = completedUnprocessedLearningTasks(runner, learningState).slice(0, learningState.policy.maxPromotionsPerRun || 2);
  const promotions = [];

  for (const task of tasks) {
    const validation = await validateLearningExperimentTask({
      runner,
      task,
      verifyRunnerEvidence: buildVerificationAdapter(verifyRunnerEvidence),
      now,
    });
    const gap = normalizeArray(learningState.knownGaps).find((item) => item.gapId === task.metadata?.gapId) || {
      gapId: task.metadata?.gapId || '',
      capability: task.metadata?.capability || '',
      description: task.description,
    };
    const experimentRecord = {
      experimentId: `experiment-${task.id}`,
      taskId: task.id,
      gapId: task.metadata?.gapId || '',
      createdBy: task.metadata?.createdBy || AUTONOMOUS_LEARNING_CREATED_BY,
      status: validation.ok ? 'validated' : 'rejected',
      reason: validation.reason,
      evidenceRefs: normalizeArray(validation.evidenceRefs).map((ref) => ref.id || ref.path),
      updatedAt: now,
    };

    if (validation.ok) {
      const promotion = promoteLearningValidation({
        memory: nextMemory,
        validation,
        gap,
        task,
        now,
      });
      nextMemory = promotion.memory;
      promotions.push(promotion);
      learningState = getAutonomousLearningMemoryState(nextMemory);
    }

    learningState = appendLearningAudit({
      ...learningState,
      recentExperiments: [
        ...normalizeArray(learningState.recentExperiments),
        experimentRecord,
      ].slice(-60),
      stats: {
        ...(learningState.stats || {}),
        experimentsValidated: Number(learningState.stats?.experimentsValidated || 0) + (validation.ok ? 1 : 0),
        experimentsRejected: Number(learningState.stats?.experimentsRejected || 0) + (validation.ok ? 0 : 1),
      },
    }, {
      timestamp: now,
      type: validation.ok ? 'learning_experiment_validated' : 'learning_experiment_rejected',
      summary: validation.ok ? 'Experimento de aprendizado validado.' : 'Experimento de aprendizado recusado.',
      reason: validation.reason,
      metadata: { taskId: task.id, gapId: task.metadata?.gapId || '' },
    });
    nextMemory = updateAutonomousLearningMemoryState(nextMemory, learningState, { now });
  }

  return {
    memory: nextMemory,
    promotions,
  };
};

const enqueueTaskWithAudit = (memory, task, { now, auditType = 'learning_task_created' } = {}) => {
  let nextMemory = enqueueAutonomousRunnerMemoryTask(memory, task, { now });
  const runner = appendAutonomousRunnerAudit(getAutonomousRunnerState(nextMemory), {
    timestamp: now,
    type: auditType,
    taskId: task.id,
    summary: `Task criada por aprendizado governado: ${task.title}`,
    reason: task.metadata?.createdBy || AUTONOMOUS_LEARNING_CREATED_BY,
    metadata: {
      gapId: task.metadata?.gapId || '',
      procedureId: task.metadata?.procedureId || '',
      variantId: task.metadata?.variantId || '',
    },
  });
  return updateAutonomousRunnerState(nextMemory, runner, { now });
};

export const runAutonomousLearningLoop = async ({
  memory,
  memoryHydrated = false,
  verifyRunnerEvidence = null,
  dryRun = null,
  startup = false,
  nowMs = Date.now(),
} = {}) => {
  const now = new Date(nowMs).toISOString();
  let nextMemory = pruneAliceMemory(memory);
  let learningState = getAutonomousLearningMemoryState(nextMemory);
  const runner = getAutonomousRunnerState(nextMemory);
  const runnerSafety = isRunnerSafeForAutonomousLearning(runner);
  const policy = normalizeAutonomousLearningPolicy(learningState.policy);
  const canStart = canStartAutonomousLearningCycle({
    memoryHydrated,
    runnerSafe: runnerSafety.ok,
    hasRunnerLock: Boolean(runner.runnerLock),
    hasRunningTasks: !runnerSafety.ok,
    recoveryPending: false,
    policy,
    recentExperiments: learningState.recentExperiments,
    nowMs,
  });

  learningState = appendLearningAudit(learningState, {
    timestamp: now,
    type: 'learning_loop_checked',
    summary: canStart.ok ? 'Loop de aprendizado autorizado.' : 'Loop de aprendizado nao iniciou.',
    reason: canStart.reason,
    metadata: { startup, runnerSafety },
  });
  nextMemory = updateAutonomousLearningMemoryState(nextMemory, learningState, { now });

  if (!canStart.ok) {
    return {
      ok: true,
      started: false,
      reason: canStart.reason,
      memory: nextMemory,
      createdTasks: [],
      promotions: [],
      gaps: learningState.knownGaps || [],
    };
  }

  const processed = await processCompletedLearningTasks({
    memory: nextMemory,
    verifyRunnerEvidence,
    now,
  });
  nextMemory = processed.memory;
  learningState = getAutonomousLearningMemoryState(nextMemory);

  if (activeLoopTasks(getAutonomousRunnerState(nextMemory)).length > 0) {
    learningState = appendLearningAudit(learningState, {
      timestamp: now,
      type: 'learning_loop_idle',
      summary: 'Ja existe task autonoma de aprendizado/reuso/otimizacao ativa.',
      reason: 'learning_task_already_active',
    });
    nextMemory = updateAutonomousLearningMemoryState(nextMemory, learningState, { now });
    return {
      ok: true,
      started: true,
      reason: 'learning_task_already_active',
      memory: nextMemory,
      createdTasks: [],
      promotions: processed.promotions,
      gaps: learningState.knownGaps || [],
    };
  }

  const scan = scanAutonomousCapabilityGaps(nextMemory, { policy, now });
  const knownGaps = scan.gaps;
  const reuseIndex = rebuildProcedureReuseIndex({
    procedures: [
      ...(nextMemory.proceduralMemory?.procedures || []),
      ...(learningState.promotedProcedures || []),
    ],
    candidates: learningState.procedureCandidates || [],
  });
  learningState = appendLearningAudit({
    ...learningState,
    lastStartupRunAt: startup ? now : learningState.lastStartupRunAt,
    lastScanAt: now,
    knownGaps,
    stats: {
      ...(learningState.stats || {}),
      scans: Number(learningState.stats?.scans || 0) + 1,
      gapsDetected: knownGaps.length,
    },
  }, {
    timestamp: now,
    type: 'capability_scan_completed',
    summary: `Scanner encontrou ${knownGaps.length} lacunas.`,
    reason: 'scan_completed',
  });
  nextMemory = {
    ...updateAutonomousLearningMemoryState(nextMemory, learningState, { now }),
    procedureReuseIndex: reuseIndex,
  };

  const dryRunEffective = dryRun ?? policy.dryRunDefault;
  const createdTasks = [];
  if (!dryRunEffective) {
    for (const gap of knownGaps.slice(0, policy.maxExperimentsPerStartup)) {
      if (createdTasks.length >= policy.maxTasksCreatedPerRun) {
        break;
      }
      const reuse = resolveProcedureReuseForGap({ gap, memory: nextMemory, policy, now });
      if (reuse.ok && reuse.task) {
        nextMemory = enqueueTaskWithAudit(nextMemory, reuse.task, { now, auditType: 'learning_reuse_task_created' });
        createdTasks.push(reuse.task);
        continue;
      }
      const planned = createAutonomousLearningTaskForGap(gap, { policy, now, dryRun: dryRunEffective });
      if (planned.ok && planned.task) {
        nextMemory = enqueueTaskWithAudit(nextMemory, planned.task, { now, auditType: 'learning_experiment_task_created' });
        createdTasks.push(planned.task);
      }
    }

    if (policy.allowProcedureOptimization && createdTasks.length < policy.maxTasksCreatedPerRun) {
      const optimizationState = getAutonomousOptimizationMemoryState(nextMemory);
      const plannedOptimizations = planProcedureOptimizationTasks({
        procedures: nextMemory.proceduralMemory?.procedures || [],
        now,
      }).slice(0, policy.maxTasksCreatedPerRun - createdTasks.length);
      plannedOptimizations.forEach(({ task, procedure, variant, benchmark }) => {
        nextMemory = enqueueTaskWithAudit(nextMemory, task, { now, auditType: 'procedure_optimization_task_created' });
        createdTasks.push(task);
        const nextOptimization = {
          ...optimizationState,
          lastOptimizationRunAt: now,
          candidates: [
            ...normalizeArray(optimizationState.candidates),
            {
              procedureId: procedure.procedureId,
              variantId: variant.variantId,
              benchmark,
              taskId: task.id,
              status: 'task_created',
              createdAt: now,
            },
          ].slice(-40),
          stats: {
            ...(optimizationState.stats || {}),
            tasksCreated: Number(optimizationState.stats?.tasksCreated || 0) + 1,
          },
        };
        nextMemory = updateAutonomousOptimizationMemoryState(nextMemory, nextOptimization, { now });
      });
    }
  }

  learningState = getAutonomousLearningMemoryState(nextMemory);
  learningState = appendLearningAudit({
    ...learningState,
    lastExperimentAt: createdTasks.length ? now : learningState.lastExperimentAt,
    recentExperiments: [
      ...normalizeArray(learningState.recentExperiments),
      ...createdTasks.map((task) => ({
        experimentId: `experiment-${task.id}`,
        taskId: task.id,
        gapId: task.metadata?.gapId || '',
        createdBy: task.metadata?.createdBy || '',
        status: 'task_created',
        createdAt: now,
      })),
    ].slice(-60),
    stats: {
      ...(learningState.stats || {}),
      tasksCreated: Number(learningState.stats?.tasksCreated || 0) + createdTasks.length,
      dryRuns: Number(learningState.stats?.dryRuns || 0) + (dryRunEffective ? 1 : 0),
    },
  }, {
    timestamp: now,
    type: dryRunEffective ? 'learning_loop_dry_run' : 'learning_loop_completed',
    summary: dryRunEffective
      ? 'Loop de aprendizado rodou em dry-run.'
      : `Loop criou ${createdTasks.length} task(s) oficiais do Runner.`,
    reason: dryRunEffective ? 'dry_run' : 'tasks_enqueued',
    metadata: { createdTaskIds: createdTasks.map((task) => task.id) },
  });
  nextMemory = updateAutonomousLearningMemoryState(nextMemory, learningState, { now });

  return {
    ok: true,
    started: true,
    reason: dryRunEffective ? 'dry_run' : 'learning_loop_completed',
    memory: nextMemory,
    createdTasks,
    promotions: processed.promotions,
    gaps: knownGaps,
  };
};

export const clearAutonomousLearningTestData = (memory, { now = new Date().toISOString() } = {}) => {
  const normalizedMemory = pruneAliceMemory(memory);
  const runner = getAutonomousRunnerState(normalizedMemory);
  const taskIdsToRemove = new Set(
    Object.values(runner.tasksById)
      .filter((task) => createdBySet.has(task.metadata?.createdBy))
      .map((task) => task.id),
  );
  const tasksById = { ...runner.tasksById };
  taskIdsToRemove.forEach((taskId) => {
    delete tasksById[taskId];
  });
  const nextRunner = appendAutonomousRunnerAudit({
    ...runner,
    tasksById,
    queue: runner.queue.filter((taskId) => !taskIdsToRemove.has(taskId)),
    activeTaskId: taskIdsToRemove.has(runner.activeTaskId) ? null : runner.activeTaskId,
    runnerLock: taskIdsToRemove.has(runner.runnerLock?.activeTaskId) ? null : runner.runnerLock,
    evidenceRefs: runner.evidenceRefs.filter((ref) => !taskIdsToRemove.has(ref.taskId)),
  }, {
    timestamp: now,
    type: 'learning_cleanup',
    summary: `Removidas ${taskIdsToRemove.size} tasks de aprendizado/reuso/otimizacao.`,
    reason: 'clear_test_learning',
  });
  const learningState = getAutonomousLearningMemoryState(normalizedMemory);
  return {
    memory: updateAutonomousLearningMemoryState(
      updateAutonomousRunnerState(normalizedMemory, nextRunner, { now }),
      appendLearningAudit({
        ...learningState,
        knownGaps: [],
        recentExperiments: normalizeArray(learningState.recentExperiments)
          .filter((experiment) => !taskIdsToRemove.has(experiment.taskId)),
      }, {
        timestamp: now,
        type: 'learning_cleanup',
        summary: 'Estado de teste do aprendizado limpo.',
        reason: 'clear_test_learning',
      }),
      { now },
    ),
    removedTaskIds: [...taskIdsToRemove],
  };
};
