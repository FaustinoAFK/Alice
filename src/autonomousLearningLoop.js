import {
  createEmptyAutonomousLearningMemoryState,
  createEmptyAutonomousOptimizationMemoryState,
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
import { createProcedureVariantVersion } from './autonomousProcedureVersioning';
import { normalizeProcedureReuseIndex, rebuildProcedureReuseIndex } from './autonomousReuseIndex';
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

const learnedSourceSet = new Set([
  ...createdBySet,
  'autonomous_learning_loop',
  'autonomous_learning',
  'autonomous_procedure_reuse',
  'autonomous_procedure_optimizer',
]);

const isLearnedProcedure = (procedure = {}, learnedProcedureIds = new Set()) => {
  const procedureId = normalizeText(procedure.procedureId || procedure.id);
  const source = normalizeText(procedure.source || procedure.metadata?.createdBy || procedure.createdBy);
  return (
    (procedureId && learnedProcedureIds.has(procedureId)) ||
    learnedSourceSet.has(source) ||
    source.startsWith('autonomous_')
  );
};

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

const terminalUnprocessedTasksByCreatedBy = (runner = {}, learningState = {}, createdBy = '') => {
  const processed = new Set(
    normalizeArray(learningState.recentExperiments)
      .filter(isTerminalExperimentRecord)
      .map((experiment) => experiment.taskId),
  );
  return Object.values(normalizeAutonomousRunnerState(runner).tasksById)
    .filter((task) => task.metadata?.createdBy === createdBy)
    .filter((task) => TERMINAL_TASK_STATUSES.has(task.status))
    .filter((task) => !processed.has(task.id));
};

const terminalUnprocessedLearningTasks = (runner = {}, learningState = {}) =>
  terminalUnprocessedTasksByCreatedBy(runner, learningState, AUTONOMOUS_LEARNING_CREATED_BY);

const terminalUnprocessedReuseTasks = (runner = {}, learningState = {}) =>
  terminalUnprocessedTasksByCreatedBy(runner, learningState, AUTONOMOUS_REUSE_CREATED_BY);

const terminalUnprocessedOptimizationTasks = (runner = {}, learningState = {}) =>
  terminalUnprocessedTasksByCreatedBy(runner, learningState, AUTONOMOUS_OPTIMIZER_CREATED_BY);

const recentlyRejectedGapIds = (learningState = {}, { nowMs = Date.now(), windowMs = 3600000 } = {}) =>
  new Set(
    normalizeArray(learningState.recentExperiments)
      .filter((experiment) => normalizeText(experiment.status) === 'rejected')
      .filter((experiment) => {
        const timestamp = Date.parse(experiment.updatedAt || experiment.createdAt || '');
        return Number.isFinite(timestamp) && nowMs - timestamp <= windowMs;
      })
      .map((experiment) => normalizeText(experiment.gapId))
      .filter(Boolean),
  );

export const shouldRunAutonomousLearningAfterRunnerTick = ({ result = null, task = null } = {}) => {
  const completedTask = task || result?.task || null;
  return Boolean(
    completedTask &&
    createdBySet.has(completedTask.metadata?.createdBy) &&
    TERMINAL_TASK_STATUSES.has(completedTask.status),
  );
};

const buildVerificationAdapter = (verifyRunnerEvidence) => {
  if (typeof verifyRunnerEvidence === 'function') {
    return verifyRunnerEvidence;
  }
  return null;
};

const withRealVmEnvironment = (procedure = {}, validation = {}, now = new Date().toISOString()) => ({
  ...procedure,
  environment: 'real_vm',
  environments: [...new Set([
    ...normalizeArray(procedure.environments),
    normalizeText(procedure.environment),
    'real_vm',
  ].filter(Boolean))],
  confidence: Math.min(1, Math.max(Number(procedure.confidence || 0), 0.62) + 0.02),
  evidenceRefs: [
    ...normalizeArray(procedure.evidenceRefs),
    ...normalizeArray(validation.evidenceRefs).map((ref) => ({
      id: ref.id,
      executionId: ref.executionId,
      taskId: ref.taskId,
      stepId: ref.stepId,
      path: ref.path,
      kind: ref.kind,
      physicalStatus: ref.metadata?.physicalStatus || ref.metadata?.persistence?.status || 'ok',
    })),
  ].slice(-12),
  usageCount: Number(procedure.usageCount || 0) + 1,
  successCount: Number(procedure.successCount || 0) + 1,
  lastUsedAt: now,
  updatedAt: now,
});

const reinforceProcedureFromReuse = ({ memory, task = {}, validation = {}, now } = {}) => {
  const procedureId = normalizeText(task.metadata?.procedureId || task.procedureId);
  if (!procedureId || !validation.ok || task.metadata?.substantiveValidation !== true) {
    return memory;
  }
  const updateList = (items = []) =>
    normalizeArray(items).map((procedure) =>
      normalizeText(procedure.procedureId) === procedureId
        ? withRealVmEnvironment(procedure, validation, now)
        : procedure);

  return {
    ...memory,
    proceduralMemory: {
      ...(memory.proceduralMemory || {}),
      procedures: updateList(memory.proceduralMemory?.procedures),
    },
    autonomousLearning: {
      ...(memory.autonomousLearning || {}),
      promotedProcedures: updateList(memory.autonomousLearning?.promotedProcedures),
    },
    autonomousAudit: {
      ...(memory.autonomousAudit || {}),
      procedures: updateList(memory.autonomousAudit?.procedures),
      learningMemoryEvents: [
        ...normalizeArray(memory.autonomousAudit?.learningMemoryEvents),
        {
          eventId: `reuse-reinforcement-${Date.parse(now) || Date.now()}`,
          type: 'procedure_reuse_reinforced',
          procedureId,
          taskId: task.id,
          evidenceRefs: normalizeArray(validation.evidenceRefs).map((ref) => ref.id || ref.path),
          createdAt: now,
        },
      ].slice(-60),
      updatedAt: now,
    },
  };
};

const processCompletedLearningTasks = async ({
  memory,
  verifyRunnerEvidence,
  now,
} = {}) => {
  let nextMemory = pruneAliceMemory(memory);
  let learningState = getAutonomousLearningMemoryState(nextMemory);
  const runner = getAutonomousRunnerState(nextMemory);
  const tasks = terminalUnprocessedLearningTasks(runner, learningState).slice(0, learningState.policy.maxPromotionsPerRun || 2);
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

  const reuseTasks = terminalUnprocessedReuseTasks(runner, learningState).slice(0, learningState.policy.maxPromotionsPerRun || 2);
  for (const task of reuseTasks) {
    const validation = await validateLearningExperimentTask({
      runner,
      task,
      verifyRunnerEvidence: buildVerificationAdapter(verifyRunnerEvidence),
      now,
    });
    if (validation.ok) {
      nextMemory = reinforceProcedureFromReuse({ memory: nextMemory, task, validation, now });
      learningState = getAutonomousLearningMemoryState(nextMemory);
    }
    const experimentRecord = {
      experimentId: `experiment-${task.id}`,
      taskId: task.id,
      gapId: task.metadata?.gapId || '',
      createdBy: task.metadata?.createdBy || AUTONOMOUS_REUSE_CREATED_BY,
      procedureId: task.metadata?.procedureId || '',
      status: validation.ok ? 'validated' : 'rejected',
      reason: validation.reason,
      evidenceRefs: normalizeArray(validation.evidenceRefs).map((ref) => ref.id || ref.path),
      updatedAt: now,
    };
    learningState = appendLearningAudit({
      ...learningState,
      recentExperiments: [
        ...normalizeArray(learningState.recentExperiments),
        experimentRecord,
      ].slice(-60),
      stats: {
        ...(learningState.stats || {}),
        reuseValidated: Number(learningState.stats?.reuseValidated || 0) + (validation.ok ? 1 : 0),
        reuseRejected: Number(learningState.stats?.reuseRejected || 0) + (validation.ok ? 0 : 1),
      },
    }, {
      timestamp: now,
      type: validation.ok ? 'procedure_reuse_validated' : 'procedure_reuse_rejected',
      summary: validation.ok ? 'Reuso de procedimento validado na VM.' : 'Reuso de procedimento recusado.',
      reason: validation.reason,
      metadata: {
        taskId: task.id,
        gapId: task.metadata?.gapId || '',
        procedureId: task.metadata?.procedureId || '',
      },
    });
    nextMemory = updateAutonomousLearningMemoryState(nextMemory, learningState, { now });
  }

  const optimizationTasks = terminalUnprocessedOptimizationTasks(runner, learningState)
    .slice(0, learningState.policy.maxPromotionsPerRun || 2);
  for (const task of optimizationTasks) {
    const validation = await validateLearningExperimentTask({
      runner,
      task,
      verifyRunnerEvidence: buildVerificationAdapter(verifyRunnerEvidence),
      now,
    });
    const currentOptimizationState = getAutonomousOptimizationMemoryState(nextMemory);
    const candidate = normalizeArray(currentOptimizationState.candidates)
      .find((item) => item.taskId === task.id || item.variantId === task.metadata?.variantId);
    const procedures = [
      ...normalizeArray(nextMemory.proceduralMemory?.procedures),
      ...normalizeArray(learningState.promotedProcedures),
    ];
    const procedure = procedures.find((item) =>
      normalizeText(item.procedureId) === normalizeText(task.metadata?.procedureId || candidate?.procedureId));
    const variant = candidate?.variant || {
      variantId: task.metadata?.variantId || '',
      title: task.title,
      steps: normalizeArray(task.metadata?.variantSteps),
    };
    let nextOptimizationState = getAutonomousOptimizationMemoryState(nextMemory);
    const benchmarkRecord = {
      benchmarkId: `benchmark-${task.id}`,
      taskId: task.id,
      procedureId: task.metadata?.procedureId || candidate?.procedureId || '',
      variantId: task.metadata?.variantId || candidate?.variantId || '',
      status: validation.ok ? 'validated' : 'rejected',
      reason: validation.reason,
      benchmark: candidate?.benchmark || variant.benchmark || {},
      evidenceRefs: normalizeArray(validation.evidenceRefs).map((ref) => ref.id || ref.path),
      createdAt: now,
    };

    if (validation.ok && procedure && variant.variantId) {
      const promotedVariant = createProcedureVariantVersion({
        procedure,
        variant: {
          ...variant,
          version: variant.version || 'v2_guarded',
          confidence: Math.max(Number(procedure.confidence || 0), Number(variant.confidence || 0), validation.confidence || 0.62),
          evidenceRefs: [
            ...normalizeArray(procedure.evidenceRefs),
            ...normalizeArray(validation.evidenceRefs),
          ].slice(-12),
          validation: {
            substantive: false,
            validationKind: 'optimization_benchmark',
            evidenceVerified: true,
          },
        },
        status: 'guarded',
        now,
      });
      nextOptimizationState = {
        ...nextOptimizationState,
        recentBenchmarks: [...normalizeArray(nextOptimizationState.recentBenchmarks), benchmarkRecord].slice(-40),
        promotedVariants: [...normalizeArray(nextOptimizationState.promotedVariants), promotedVariant].slice(-40),
        candidates: normalizeArray(nextOptimizationState.candidates)
          .map((item) => item.taskId === task.id ? { ...item, status: 'validated', validatedAt: now } : item)
          .slice(-40),
        stats: {
          ...(nextOptimizationState.stats || {}),
          variantsPromoted: Number(nextOptimizationState.stats?.variantsPromoted || 0) + 1,
        },
      };
      learningState = getAutonomousLearningMemoryState(nextMemory);
      learningState = appendLearningAudit({
        ...learningState,
        procedureCandidates: [
          ...normalizeArray(learningState.procedureCandidates),
          {
            candidateId: `optimization-${promotedVariant.procedureId}-${promotedVariant.version}`,
            procedureId: promotedVariant.procedureId,
            variantId: variant.variantId,
            title: promotedVariant.title || variant.title || procedure.title,
            status: 'guarded',
            confidence: promotedVariant.confidence,
            source: AUTONOMOUS_OPTIMIZER_CREATED_BY,
            evidenceRefs: benchmarkRecord.evidenceRefs,
            createdAt: now,
          },
        ].slice(-60),
      }, {
        timestamp: now,
        type: 'procedure_optimization_validated',
        summary: 'Variante de procedimento validada como guarded.',
        reason: validation.reason,
        metadata: { taskId: task.id, procedureId: promotedVariant.procedureId, variantId: variant.variantId },
      });
    } else {
      nextOptimizationState = {
        ...nextOptimizationState,
        recentBenchmarks: [...normalizeArray(nextOptimizationState.recentBenchmarks), benchmarkRecord].slice(-40),
        rejectedVariants: [
          ...normalizeArray(nextOptimizationState.rejectedVariants),
          {
            procedureId: benchmarkRecord.procedureId,
            variantId: benchmarkRecord.variantId,
            taskId: task.id,
            reason: validation.reason,
            rejectedAt: now,
          },
        ].slice(-40),
        candidates: normalizeArray(nextOptimizationState.candidates)
          .map((item) => item.taskId === task.id ? { ...item, status: 'rejected', reason: validation.reason, rejectedAt: now } : item)
          .slice(-40),
        stats: {
          ...(nextOptimizationState.stats || {}),
          variantsRejected: Number(nextOptimizationState.stats?.variantsRejected || 0) + 1,
        },
      };
      learningState = appendLearningAudit(getAutonomousLearningMemoryState(nextMemory), {
        timestamp: now,
        type: 'procedure_optimization_rejected',
        summary: 'Variante de procedimento recusada pela validacao.',
        reason: validation.reason,
        metadata: { taskId: task.id, procedureId: benchmarkRecord.procedureId, variantId: benchmarkRecord.variantId },
      });
    }

    nextMemory = updateAutonomousOptimizationMemoryState(nextMemory, nextOptimizationState, { now });
    nextMemory = updateAutonomousLearningMemoryState(nextMemory, {
      ...learningState,
      recentExperiments: [
        ...normalizeArray(learningState.recentExperiments),
        {
          experimentId: `experiment-${task.id}`,
          taskId: task.id,
          createdBy: AUTONOMOUS_OPTIMIZER_CREATED_BY,
          procedureId: benchmarkRecord.procedureId,
          variantId: benchmarkRecord.variantId,
          status: validation.ok ? 'validated' : 'rejected',
          reason: validation.reason,
          evidenceRefs: benchmarkRecord.evidenceRefs,
          updatedAt: now,
        },
      ].slice(-60),
    }, { now });
    learningState = getAutonomousLearningMemoryState(nextMemory);
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
  const initialCanStart = canStartAutonomousLearningCycle({
    memoryHydrated,
    runnerSafe: runnerSafety.ok,
    hasRunnerLock: Boolean(runner.runnerLock),
    hasRunningTasks: !runnerSafety.ok,
    recoveryPending: false,
    policy,
    recentExperiments: learningState.recentExperiments,
    nowMs,
  });

  const hardBlocked = !initialCanStart.ok && initialCanStart.reason !== 'learning_rate_limited';

  learningState = appendLearningAudit(learningState, {
    timestamp: now,
    type: 'learning_loop_checked',
    summary: hardBlocked ? 'Loop de aprendizado nao iniciou.' : 'Loop de aprendizado autorizado para verificar pendencias.',
    reason: initialCanStart.reason,
    metadata: { startup, runnerSafety },
  });
  nextMemory = updateAutonomousLearningMemoryState(nextMemory, learningState, { now });

  if (hardBlocked) {
    return {
      ok: true,
      started: false,
      reason: initialCanStart.reason,
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

  if (!canStart.ok) {
    const scan = scanAutonomousCapabilityGaps(nextMemory, { policy, now });
    learningState = getAutonomousLearningMemoryState(nextMemory);
    learningState = appendLearningAudit({
      ...learningState,
      lastScanAt: now,
      knownGaps: scan.gaps,
      stats: {
        ...(learningState.stats || {}),
        scans: Number(learningState.stats?.scans || 0) + 1,
        gapsDetected: scan.gaps.length,
      },
    }, {
      timestamp: now,
      type: 'learning_loop_idle',
      summary: processed.promotions.length
        ? 'Pendencias de aprendizado foram consolidadas; novas tasks aguardam limite seguro.'
        : 'Loop de aprendizado nao criou novas tasks.',
      reason: canStart.reason,
      metadata: {
        promotions: processed.promotions.map((promotion) => promotion.procedure?.procedureId || ''),
      },
    });
    nextMemory = updateAutonomousLearningMemoryState(nextMemory, learningState, { now });
    return {
      ok: true,
      started: processed.promotions.length > 0,
      reason: canStart.reason,
      memory: nextMemory,
      createdTasks: [],
      promotions: processed.promotions,
      gaps: learningState.knownGaps || [],
    };
  }

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
  const rejectedGapCooldown = recentlyRejectedGapIds(learningState, { nowMs });
  if (!dryRunEffective) {
    for (const gap of knownGaps.slice(0, policy.maxExperimentsPerStartup)) {
      if (createdTasks.length >= policy.maxTasksCreatedPerRun) {
        break;
      }
      if (rejectedGapCooldown.has(gap.gapId)) {
        continue;
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
      const plannedOptimizations = planProcedureOptimizationTasks({
        procedures: [
          ...normalizeArray(nextMemory.proceduralMemory?.procedures),
          ...normalizeArray(getAutonomousLearningMemoryState(nextMemory).promotedProcedures),
        ],
        existingTasks: Object.values(getAutonomousRunnerState(nextMemory).tasksById),
        optimizationState: getAutonomousOptimizationMemoryState(nextMemory),
        now,
      }).slice(0, policy.maxTasksCreatedPerRun - createdTasks.length);
      plannedOptimizations.forEach(({ task, procedure, variant, benchmark }) => {
        nextMemory = enqueueTaskWithAudit(nextMemory, task, { now, auditType: 'procedure_optimization_task_created' });
        createdTasks.push(task);
        const currentOptimizationState = getAutonomousOptimizationMemoryState(nextMemory);
        const nextOptimization = {
          ...currentOptimizationState,
          lastOptimizationRunAt: now,
          candidates: [
            ...normalizeArray(currentOptimizationState.candidates),
            {
              procedureId: procedure.procedureId,
              variantId: variant.variantId,
              variant,
              benchmark,
              taskId: task.id,
              status: 'task_created',
              createdAt: now,
            },
          ].slice(-40),
          stats: {
            ...(currentOptimizationState.stats || {}),
            tasksCreated: Number(currentOptimizationState.stats?.tasksCreated || 0) + 1,
          },
        };
        nextMemory = updateAutonomousOptimizationMemoryState(nextMemory, nextOptimization, { now });
      });
    }
  }

  learningState = getAutonomousLearningMemoryState(nextMemory);
  const completionAuditType = dryRunEffective
    ? 'learning_loop_dry_run'
    : createdTasks.length > 0
      ? 'learning_loop_completed'
      : 'learning_loop_idle';
  const completionAuditReason = dryRunEffective
    ? 'dry_run'
    : createdTasks.length > 0
      ? 'tasks_enqueued'
      : 'no_tasks_created';
  const completionAuditSummary = dryRunEffective
    ? 'Loop de aprendizado rodou em dry-run.'
    : createdTasks.length > 0
      ? `Loop criou ${createdTasks.length} task(s) oficiais do Runner.`
      : 'Loop de aprendizado terminou sem criar tasks.';

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
    type: completionAuditType,
    summary: completionAuditSummary,
    reason: completionAuditReason,
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

export const clearAutonomousLearnedData = (
  memory,
  {
    now = new Date().toISOString(),
    disableLearning = false,
    preserveGoals = false,
  } = {},
) => {
  const cleared = clearAutonomousLearningTestData(memory, { now });
  const normalizedMemory = pruneAliceMemory(cleared.memory);
  const learning = getAutonomousLearningMemoryState(normalizedMemory);
  const optimization = getAutonomousOptimizationMemoryState(normalizedMemory);
  const learnedProcedureIds = new Set([
    ...normalizeArray(learning.procedureCandidates).map((item) => normalizeText(item.procedureId || item.candidateId)),
    ...normalizeArray(learning.promotedProcedures).map((item) => normalizeText(item.procedureId || item.id)),
    ...normalizeArray(normalizedMemory.autonomousAudit?.procedures).map((item) => normalizeText(item.procedureId || item.id)),
  ].filter(Boolean));
  const currentProcedures = normalizeArray(normalizedMemory.proceduralMemory?.procedures);
  const retainedProcedures = currentProcedures
    .filter((procedure) => !isLearnedProcedure(procedure, learnedProcedureIds));
  const removedProcedures = currentProcedures.length - retainedProcedures.length;
  const emptyLearning = createEmptyAutonomousLearningMemoryState();
  const emptyOptimization = createEmptyAutonomousOptimizationMemoryState();
  const nextPolicy = {
    ...learning.policy,
    enabled: disableLearning ? false : learning.enabled,
  };
  const nextLearning = {
    ...emptyLearning,
    enabled: !disableLearning && learning.enabled,
    policy: nextPolicy,
    learningGoals: preserveGoals ? normalizeArray(learning.learningGoals) : emptyLearning.learningGoals,
    auditLog: [
      {
        id: `learning-cleared-${String(Date.parse(now) || Date.now())}`,
        timestamp: now,
        type: 'learning_memory_cleared',
        summary: 'Aprendizado autonomo, candidatos, procedures e scripts foram apagados.',
        reason: disableLearning ? 'clear_learned_data_and_disable' : 'clear_learned_data',
        metadata: {
          removedTaskIds: cleared.removedTaskIds,
          removedProcedureCandidates: learning.procedureCandidates.length,
          removedPromotedProcedures: learning.promotedProcedures.length,
          removedGeneratedScripts: learning.generatedScripts.length,
          removedProceduralMemoryProcedures: removedProcedures,
          removedOptimizationCandidates: optimization.candidates.length,
          removedRecentBenchmarks: optimization.recentBenchmarks.length,
          preservedLearningGoals: preserveGoals ? normalizeArray(learning.learningGoals).length : 0,
          disabled: disableLearning,
        },
      },
    ],
  };
  const nextOptimization = {
    ...emptyOptimization,
    enabled: !disableLearning && optimization.enabled,
    policy: optimization.policy || emptyOptimization.policy,
  };
  const nextAutonomousAudit = {
    ...(normalizedMemory.autonomousAudit || {}),
    skillCandidates: [],
    improvementProposals: [],
    pendingApprovals: [],
    researchFindings: [],
    validationReports: [],
    procedures: normalizeArray(normalizedMemory.autonomousAudit?.procedures)
      .filter((procedure) => !isLearnedProcedure(procedure, learnedProcedureIds)),
    learningMemoryEvents: [],
    auditLogs: [],
    updatedAt: now,
  };

  return {
    memory: {
      ...normalizedMemory,
      proceduralMemory: {
        ...(normalizedMemory.proceduralMemory || {}),
        procedures: retainedProcedures,
      },
      autonomousAudit: nextAutonomousAudit,
      autonomousLearning: nextLearning,
      autonomousOptimization: nextOptimization,
      procedureReuseIndex: normalizeProcedureReuseIndex(),
    },
    removedTaskIds: cleared.removedTaskIds,
    removedLearning: {
      procedureCandidates: learning.procedureCandidates.length,
      promotedProcedures: learning.promotedProcedures.length,
      generatedScripts: learning.generatedScripts.length,
      proceduralMemoryProcedures: removedProcedures,
      optimizationCandidates: optimization.candidates.length,
      recentBenchmarks: optimization.recentBenchmarks.length,
      preservedLearningGoals: preserveGoals ? normalizeArray(learning.learningGoals).length : 0,
      disabled: disableLearning,
    },
  };
};
