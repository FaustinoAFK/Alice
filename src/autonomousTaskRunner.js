import {
  RUNNER_REASONS,
  RUNNER_STATES,
  RUNNER_TASK_STATUSES,
  appendAutonomousRunnerAudit,
  normalizeAutonomousRunnerState,
  transitionAutonomousRunnerStep,
  transitionAutonomousRunnerTask,
  updateAutonomousRunnerStep,
  updateAutonomousRunnerTask,
} from './autonomousRunnerState';
import {
  acquireRunnerLease,
  heartbeatRunnerLease,
  hasActiveRunnerLock,
  recoverAutonomousTasksOnStartup,
  releaseRunnerLease,
} from './autonomousRunnerLease';
import {
  computeNextRunnerIntervalMs,
  getEligibleRunnerTasks,
  selectNextEligibleTask,
} from './autonomousRunnerScheduler';
import { autoPlanAutonomousRunnerTask } from './autonomousRunnerPlanner';
import { runAutonomousRunnerPreflight } from './autonomousRunnerPreflight';
import { executeAutonomousRunnerStep } from './autonomousRunnerExecutor';
import {
  applyRunnerEvidencePersistenceMetadata,
  attachRunnerEvidenceRefs,
  buildRunnerEvidenceFromExecution,
  createRunnerExecutionId,
} from './autonomousRunnerEvidence';
import { validateRunnerCompletionCriteria } from './autonomousRunnerValidation';
import {
  applyRecoveryLoopGuard,
  createRecoveryTaskForDependencyFailure,
} from './autonomousRunnerRecoveryPlanner';
import { createProcedureCandidate } from './autonomousLearning';

const retryDelayMsForAttempt = (attempt) => {
  if (attempt <= 1) {
    return 5000;
  }
  if (attempt === 2) {
    return 30000;
  }
  return 120000;
};

const toIso = (value) => new Date(value).toISOString();

const getLatestTask = (runner, taskId) => normalizeAutonomousRunnerState(runner).tasksById[taskId];

const getLatestStep = (runner, taskId, stepId) =>
  getLatestTask(runner, taskId)?.steps.find((step) => step.id === stepId);

const resolveEffectiveVmStatus = (runner, vmStatus = {}) => {
  if (!runner?.settings?.devOverrides?.forceVmUnavailable) {
    return vmStatus;
  }

  return {
    ...vmStatus,
    realVmAvailable: false,
    guestCommandReady: false,
    fallbackWorkspaceAvailable: vmStatus.fallbackWorkspaceAvailable !== false,
    provider: 'autonomous_runner_harness',
    status: 'forced_vm_unavailable',
  };
};

const createLearningCandidateForRunnerResult = ({ task, step, validationResult, nowMs }) => {
  if (!task || !step) {
    return null;
  }

  return createProcedureCandidate({
    title: validationResult?.passed
      ? `Runner: sequencia validada para ${task.title}`
      : `Runner: falha observada em ${step.title}`,
    summary: validationResult?.passed
      ? `Step ${step.title} passou com criterio ${step.completionCriteria?.type}.`
      : `Step ${step.title} falhou: ${validationResult?.reason || task.reason || 'falha sem detalhe'}.`,
    steps: [
      step.action?.command || step.action?.visualAction || step.title,
      `criterio=${step.completionCriteria?.type || 'unknown'}`,
    ],
    source: validationResult?.passed ? 'runner_success_candidate' : 'runner_failure_candidate',
    confidence: validationResult?.passed ? 0.35 : 0.2,
    now: nowMs,
  });
};

const normalizeErrorMessage = (error, fallback = 'Falha desconhecida.') =>
  String(error?.message || error || fallback).trim();
const normalizeText = (value, fallback = '') => String(value || fallback || '').trim();

const createEvidencePersistenceResult = ({
  ok = false,
  status = 'unavailable',
  reason = RUNNER_REASONS.EVIDENCE_PERSISTENCE_FAILED,
  message = '',
  executionId = '',
  files = [],
  missingFiles = [],
  artifacts = null,
  checkedAt = new Date().toISOString(),
} = {}) => ({
  ok: Boolean(ok),
  status,
  reason,
  message: String(message || ''),
  executionId,
  files: Array.isArray(files) ? files : [],
  missingFiles: Array.isArray(missingFiles) ? missingFiles : [],
  artifacts,
  checkedAt,
});

const runnerEvidenceFilesFromRefs = (executionId, evidenceRefs = []) => {
  const prefix = `data/evidence/${executionId}/`;
  const allowedFiles = new Set(['metadata.json', 'stdout.txt', 'stderr.txt', 'validation.json']);
  const files = new Set();

  evidenceRefs.forEach((ref) => {
    const path = String(ref?.path || '');
    if (!path.startsWith(prefix)) {
      return;
    }
    const fileName = path.slice(prefix.length).split(/[\\/]/).filter(Boolean).at(-1);
    if (allowedFiles.has(fileName)) {
      files.add(fileName);
    }
  });

  return [...files];
};

const formatPersistenceFiles = (files = []) =>
  files
    .map((file) => (typeof file === 'string' ? file : file?.file || ''))
    .filter(Boolean)
    .join(', ');

const withEvidencePersistenceCheck = (validationResult = {}, persistenceResult = {}, executionResult = {}) => {
  const persistenceOk = persistenceResult.ok === true;
  const persistenceCheck = {
    type: 'evidence_persistence',
    passed: persistenceOk,
    evidence: persistenceOk
      ? `evidencia fisica confirmada: ${formatPersistenceFiles(persistenceResult.files || [])}`
      : persistenceResult.message || persistenceResult.reason || RUNNER_REASONS.EVIDENCE_PERSISTENCE_FAILED,
  };

  return {
    ...validationResult,
    passed: validationResult.passed === true && persistenceOk,
    status: validationResult.passed === true && persistenceOk ? 'passed' : 'failed',
    reason: validationResult.passed === true && !persistenceOk
      ? RUNNER_REASONS.EVIDENCE_PERSISTENCE_FAILED
      : validationResult.reason,
    checks: [
      ...(Array.isArray(validationResult.checks) ? validationResult.checks : []),
      persistenceCheck,
    ],
    execution: {
      ok: Boolean(executionResult.ok),
      reason: executionResult.reason || executionResult.message || '',
    },
    evidencePersistence: {
      ok: persistenceOk,
      status: persistenceResult.status || 'unavailable',
      reason: persistenceResult.reason || '',
      message: persistenceResult.message || '',
      executionId: persistenceResult.executionId || '',
      files: persistenceResult.files || [],
      missingFiles: persistenceResult.missingFiles || [],
      checkedAt: persistenceResult.checkedAt || '',
    },
  };
};

const persistRunnerEvidenceFiles = async ({
  invokeTool,
  executionId,
  executionResult,
  validationResult,
  task,
  step,
  evidenceRefs = [],
} = {}) => {
  const expectedFiles = runnerEvidenceFilesFromRefs(executionId, evidenceRefs);
  if (typeof invokeTool !== 'function') {
    return createEvidencePersistenceResult({
      status: 'unavailable',
      message: 'Runtime Tauri indisponivel para salvar evidencia do Runner.',
      executionId,
      files: expectedFiles,
    });
  }

  let saveResult = null;
  try {
    saveResult = await invokeTool('save_runner_evidence', {
      request: {
        executionId,
        stdout: executionResult?.stdout || '',
        stderr: executionResult?.stderr || '',
        validation: validationResult || null,
        metadata: {
          taskId: task?.id || '',
          stepId: step?.id || '',
          command: step?.action?.command || step?.action?.visualAction || '',
          artifacts: executionResult?.artifacts || {},
        },
      },
    });
  } catch (error) {
    return createEvidencePersistenceResult({
      status: 'unavailable',
      message: normalizeErrorMessage(error, 'Falha ao salvar evidencia do Runner.'),
      executionId,
      files: expectedFiles,
      artifacts: { save: null },
    });
  }

  if (!saveResult?.ok) {
    return createEvidencePersistenceResult({
      status: 'unavailable',
      message: saveResult?.message || 'save_runner_evidence retornou falha.',
      executionId,
      files: expectedFiles,
      artifacts: { save: saveResult || null },
    });
  }
  const persistedExecutionId = normalizeText(
    saveResult?.artifacts?.executionId || executionId,
    executionId,
  );

  try {
    const verification = await invokeTool('verify_runner_evidence', {
      request: {
        executionId: persistedExecutionId,
        files: expectedFiles,
      },
    });
    const artifacts = verification?.artifacts || {};
    const status = artifacts.status || (verification?.ok ? 'ok' : 'unavailable');
    const missingFiles = Array.isArray(artifacts.missingFiles) ? artifacts.missingFiles : [];
    const files = Array.isArray(artifacts.files) ? artifacts.files : expectedFiles;
    const verifiedExecutionId = normalizeText(
      artifacts.executionId || persistedExecutionId,
      persistedExecutionId,
    );
    if (!verification?.ok || status !== 'ok') {
      return createEvidencePersistenceResult({
        status,
        message: verification?.message || 'Verificacao fisica de evidencia falhou.',
        executionId: verifiedExecutionId,
        files,
        missingFiles,
        artifacts: { save: saveResult, verification },
      });
    }

    return createEvidencePersistenceResult({
      ok: true,
      status: 'ok',
      reason: 'evidence_persisted',
      message: verification.message || saveResult.message || 'Evidencia fisica confirmada.',
      executionId: verifiedExecutionId,
      files,
      missingFiles,
      artifacts: { save: saveResult, verification },
    });
  } catch (error) {
    return createEvidencePersistenceResult({
      status: 'unavailable',
      message: normalizeErrorMessage(error, 'Falha ao verificar evidencia fisica do Runner.'),
      executionId,
      files: expectedFiles,
      artifacts: { save: saveResult, verification: null },
    });
  }
};

const updateTaskAfterPreflightFailure = (runner, task, preflight, { now, nowMs }) => {
  if (preflight.reason === RUNNER_REASONS.DEPENDENCY_FAILED && preflight.dependencyState?.failed?.[0]) {
    return createRecoveryTaskForDependencyFailure(
      runner,
      task,
      preflight.dependencyState.failed[0],
      { now },
    );
  }

  if (preflight.state === 'skip') {
    return runner;
  }

  if (preflight.state === RUNNER_TASK_STATUSES.WAITING_RETRY) {
    const nextRunAt = toIso(nowMs + retryDelayMsForAttempt(Number(task.attempts || 0) + 1));
    return updateAutonomousRunnerTask(runner, task.id, {
      status: RUNNER_TASK_STATUSES.WAITING_RETRY,
      reason: preflight.reason,
      nextRunAt,
      updatedAt: now,
    }, {
      now,
      audit: {
        type: 'retry',
        summary: `Task aguardando retry: ${task.title}`,
        reason: preflight.reason,
        beforeState: task.status,
        afterState: RUNNER_TASK_STATUSES.WAITING_RETRY,
        metadata: { nextRunAt },
      },
    });
  }

  return updateAutonomousRunnerTask(runner, task.id, {
    status: preflight.state || RUNNER_TASK_STATUSES.BLOCKED,
    reason: preflight.reason || RUNNER_REASONS.NO_EXECUTABLE_STEP,
    updatedAt: now,
  }, {
    now,
    audit: {
      type: 'preflight',
      summary: `Task bloqueada no preflight: ${task.title}`,
      reason: preflight.reason || RUNNER_REASONS.NO_EXECUTABLE_STEP,
      beforeState: task.status,
      afterState: preflight.state || RUNNER_TASK_STATUSES.BLOCKED,
    },
  });
};

const finalizeSuccessfulStep = (runner, taskId, stepId, {
  evidenceRefs,
  executionResult,
  validationResult,
  now,
}) => {
  let nextRunner = updateAutonomousRunnerStep(runner, taskId, stepId, (step) => ({
    ...step,
    status: 'running',
    result: {
      ok: Boolean(executionResult.ok),
      message: executionResult.message || '',
      stdoutPreview: String(executionResult.stdout || '').slice(0, 500),
      stderrPreview: String(executionResult.stderr || '').slice(0, 500),
      artifacts: executionResult.artifacts || null,
      validation: validationResult,
    },
    evidenceRefs: [...(step.evidenceRefs || []), ...evidenceRefs],
  }), { now });
  const stepTransition = transitionAutonomousRunnerStep(nextRunner, taskId, stepId, 'done', {
    now,
    reason: 'runner_completion_validated',
    metadata: {
      ...validationResult,
      executionVerified: Boolean(executionResult),
      validationPassed: validationResult.passed === true,
      evidencePersistence: validationResult.evidencePersistence || null,
      evidenceRefs,
    },
  });
  nextRunner = stepTransition.runner;

  const task = getLatestTask(nextRunner, taskId);
  const allDone = task.steps.every((step) => step.status === 'done');
  nextRunner = updateAutonomousRunnerTask(nextRunner, taskId, {
    evidenceRefs: [...(task.evidenceRefs || []), ...evidenceRefs],
    executionHistory: [
      ...(task.executionHistory || []),
      {
        timestamp: now,
        stepId,
        status: 'done',
        result: {
          ok: Boolean(executionResult.ok),
          message: executionResult.message || '',
        },
        validation: validationResult,
        evidenceRefs,
      },
    ],
    updatedAt: now,
  });

  const taskTransition = transitionAutonomousRunnerTask(
    nextRunner,
    taskId,
    allDone ? RUNNER_TASK_STATUSES.DONE : RUNNER_TASK_STATUSES.READY,
    {
      now,
      reason: allDone ? 'runner_task_validated' : 'next_step_ready',
      metadata: {
        stepId,
        validation: validationResult.reason,
        executionVerified: Boolean(executionResult),
        validationPassed: validationResult.passed === true,
        evidencePersistence: validationResult.evidencePersistence || null,
        evidenceRefs,
      },
    },
  );

  return taskTransition.runner;
};

const finalizeFailedStep = (runner, taskId, stepId, {
  evidenceRefs,
  executionResult,
  validationResult,
  now,
  nowMs,
}) => {
  const task = getLatestTask(runner, taskId);
  const step = getLatestStep(runner, taskId, stepId);
  const nextStepAttempts = Number(step.attempts || 0) + 1;
  const canRetry = nextStepAttempts < Number(step.maxAttempts || 1) && Number(task.attempts || 0) < Number(task.maxAttempts || 1);
  const retryReason = validationResult.reason || RUNNER_REASONS.VALIDATION_FAILED;
  const reason = canRetry ? retryReason : RUNNER_REASONS.MAX_ATTEMPTS_REACHED;
  const nextRunAt = canRetry ? toIso(nowMs + retryDelayMsForAttempt(nextStepAttempts)) : null;

  let nextRunner = updateAutonomousRunnerStep(runner, taskId, stepId, (currentStep) => ({
    ...currentStep,
    attempts: nextStepAttempts,
    status: 'running',
    reason,
    nextRunAt,
    result: {
      ok: Boolean(executionResult.ok),
      message: executionResult.message || '',
      stdoutPreview: String(executionResult.stdout || '').slice(0, 500),
      stderrPreview: String(executionResult.stderr || '').slice(0, 500),
      artifacts: executionResult.artifacts || null,
      validation: validationResult,
    },
    evidenceRefs: [...(currentStep.evidenceRefs || []), ...evidenceRefs],
  }), { now });
  const stepTransition = transitionAutonomousRunnerStep(
    nextRunner,
    taskId,
    stepId,
    canRetry ? 'waiting_retry' : 'failed',
    { now, reason, metadata: validationResult },
  );
  nextRunner = stepTransition.runner;

  nextRunner = updateAutonomousRunnerTask(nextRunner, taskId, {
    status: canRetry ? RUNNER_TASK_STATUSES.WAITING_RETRY : RUNNER_TASK_STATUSES.FAILED,
    reason,
    nextRunAt,
    evidenceRefs: [...(task.evidenceRefs || []), ...evidenceRefs],
    executionHistory: [
      ...(task.executionHistory || []),
      {
        timestamp: now,
        stepId,
        status: canRetry ? 'waiting_retry' : 'failed',
        reason,
        result: {
          ok: Boolean(executionResult.ok),
          message: executionResult.message || '',
          stderr: String(executionResult.stderr || '').slice(0, 500),
        },
        validation: validationResult,
        evidenceRefs,
      },
    ],
    updatedAt: now,
  }, {
    now,
    audit: {
      type: canRetry ? 'retry' : 'validation',
      summary: canRetry ? `Retry agendado para ${task.title}.` : `Task falhou: ${task.title}.`,
      reason,
      beforeState: RUNNER_TASK_STATUSES.RUNNING,
      afterState: canRetry ? RUNNER_TASK_STATUSES.WAITING_RETRY : RUNNER_TASK_STATUSES.FAILED,
      evidenceRefs,
      metadata: { nextRunAt, validation: validationResult.reason },
    },
  });

  return applyRecoveryLoopGuard(nextRunner, taskId, { now });
};

const processTask = async ({
  task,
  preflight,
  invokeTool,
  onRunnerStateChange,
  now,
  nowMs,
}) => {
  let nextRunner = preflight.runner;
  const lease = acquireRunnerLease(nextRunner, task.id, preflight.step.id, { now });
  if (!lease.ok) {
    return {
      runner: lease.runner,
      executed: false,
      reason: lease.reason,
      learningCandidates: [],
    };
  }

  nextRunner = lease.runner;
  onRunnerStateChange?.(nextRunner);

  let heartbeatTimer = null;
  let heartbeatRunner = nextRunner;
  const heartbeatIntervalMs = heartbeatRunner.settings.intervals.heartbeatIntervalMs;
  if (typeof onRunnerStateChange === 'function' && heartbeatIntervalMs > 0) {
    heartbeatTimer = setInterval(() => {
      heartbeatRunner = heartbeatRunnerLease(heartbeatRunner, lease.leaseId);
      onRunnerStateChange(heartbeatRunner);
    }, heartbeatIntervalMs);
  }

  const executionResult = await executeAutonomousRunnerStep({
    task,
    step: preflight.step,
    executionMode: preflight.executionMode,
    invokeTool,
    now,
  });

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }
  nextRunner = heartbeatRunnerLease(heartbeatRunner, lease.leaseId, { now: new Date().toISOString() });

  const executionId = createRunnerExecutionId(task.id, preflight.step.id);
  const preliminaryEvidenceRefs = buildRunnerEvidenceFromExecution({
    task,
    step: preflight.step,
    executionResult,
    executionId,
    validationResult: null,
    startedAt: executionResult.artifacts?.startedAt || now,
    finishedAt: executionResult.artifacts?.finishedAt || new Date().toISOString(),
  });
  const validationResult = validateRunnerCompletionCriteria({
    step: preflight.step,
    executionResult,
    evidenceRefs: preliminaryEvidenceRefs,
  });
  const candidateEvidenceRefs = buildRunnerEvidenceFromExecution({
    task,
    step: preflight.step,
    executionResult,
    executionId,
    validationResult,
    startedAt: executionResult.artifacts?.startedAt || now,
    finishedAt: executionResult.artifacts?.finishedAt || new Date().toISOString(),
  });
  const persistenceResult = await persistRunnerEvidenceFiles({
    invokeTool,
    executionId,
    executionResult,
    validationResult,
    task,
    step: preflight.step,
    evidenceRefs: candidateEvidenceRefs,
  });
  const finalValidationResult = withEvidencePersistenceCheck(validationResult, persistenceResult, executionResult);
  const evidenceRefs = persistenceResult.ok
    ? applyRunnerEvidencePersistenceMetadata(candidateEvidenceRefs, persistenceResult)
    : [];

  if (evidenceRefs.length > 0) {
    nextRunner = attachRunnerEvidenceRefs(nextRunner, evidenceRefs);
  }
  nextRunner = appendAutonomousRunnerAudit(nextRunner, {
    timestamp: now,
    type: 'execution',
    taskId: task.id,
    stepId: preflight.step.id,
    summary: executionResult.ok ? 'Step executou no ambiente controlado.' : 'Step executou e retornou falha.',
    reason: executionResult.reason || executionResult.message || '',
    evidenceRefs,
    metadata: {
      executionMode: preflight.executionMode,
      ok: Boolean(executionResult.ok),
      exitCode: executionResult.artifacts?.statusCode ?? (executionResult.ok ? 0 : 1),
    },
  });
  nextRunner = appendAutonomousRunnerAudit(nextRunner, {
    timestamp: now,
    type: 'evidence_persistence',
    taskId: task.id,
    stepId: preflight.step.id,
    summary: persistenceResult.ok
      ? 'Evidencia fisica do Runner confirmada.'
      : 'Falha ao persistir/verificar evidencia fisica do Runner.',
    reason: persistenceResult.reason || RUNNER_REASONS.EVIDENCE_PERSISTENCE_FAILED,
    evidenceRefs,
    metadata: persistenceResult,
  });
  nextRunner = appendAutonomousRunnerAudit(nextRunner, {
    timestamp: now,
    type: 'validation',
    taskId: task.id,
    stepId: preflight.step.id,
    summary: finalValidationResult.passed ? 'Validacao do step aprovada.' : 'Validacao do step falhou.',
    reason: finalValidationResult.reason,
    evidenceRefs,
    metadata: finalValidationResult,
  });

  nextRunner = finalValidationResult.passed
    ? finalizeSuccessfulStep(nextRunner, task.id, preflight.step.id, {
        evidenceRefs,
        executionResult,
        validationResult: finalValidationResult,
        now,
      })
    : finalizeFailedStep(nextRunner, task.id, preflight.step.id, {
        evidenceRefs,
        executionResult,
        validationResult: finalValidationResult,
        now,
        nowMs,
      });

  nextRunner = releaseRunnerLease(nextRunner, lease.leaseId, {
    now,
    reason: finalValidationResult.passed ? 'step_finished' : finalValidationResult.reason,
  });

  const learningCandidate = createLearningCandidateForRunnerResult({
    task: getLatestTask(nextRunner, task.id),
    step: getLatestStep(nextRunner, task.id, preflight.step.id),
    validationResult: finalValidationResult,
    nowMs,
  });

  return {
    runner: nextRunner,
    executed: true,
    reason: finalValidationResult.reason,
    task: getLatestTask(nextRunner, task.id),
    step: getLatestStep(nextRunner, task.id, preflight.step.id),
    evidenceRefs,
    validationResult: finalValidationResult,
    executionResult,
    evidencePersistence: persistenceResult,
    learningCandidates: learningCandidate ? [learningCandidate] : [],
  };
};

export const runAutonomousTaskRunnerTick = async ({
  runner,
  vmStatus = {},
  invokeTool = null,
  onRunnerStateChange = null,
  nowMs = Date.now(),
} = {}) => {
  const now = new Date(nowMs).toISOString();
  let nextRunner = normalizeAutonomousRunnerState(runner);

  if (!nextRunner.enabled) {
    return {
      ok: true,
      executed: false,
      reason: 'runner_disabled',
      runner: nextRunner,
      nextIntervalMs: computeNextRunnerIntervalMs(nextRunner, { nowMs }),
      learningCandidates: [],
    };
  }

  nextRunner = recoverAutonomousTasksOnStartup(nextRunner, { now, nowMs, auditContext: 'tick' });
  if (nextRunner.runnerState === RUNNER_STATES.PAUSED) {
    return {
      ok: true,
      executed: false,
      reason: 'runner_paused',
      runner: nextRunner,
      nextIntervalMs: computeNextRunnerIntervalMs(nextRunner, { nowMs }),
      learningCandidates: [],
    };
  }
  if (hasActiveRunnerLock(nextRunner)) {
    return {
      ok: true,
      executed: false,
      reason: 'runner_lock_active',
      runner: nextRunner,
      nextIntervalMs: computeNextRunnerIntervalMs(nextRunner, { nowMs }),
      learningCandidates: [],
    };
  }

  const queueDecision = selectNextEligibleTask(nextRunner, { now, nowMs });
  nextRunner = queueDecision.runner;
  const { eligible } = getEligibleRunnerTasks(nextRunner, { nowMs });
  const effectiveVmStatus = resolveEffectiveVmStatus(nextRunner, vmStatus);

  for (const candidate of eligible) {
    let task = nextRunner.tasksById[candidate.id];
    if (task.status === RUNNER_TASK_STATUSES.PLANNED) {
      const planned = autoPlanAutonomousRunnerTask(nextRunner, task.id, { now });
      nextRunner = planned.runner;
      task = nextRunner.tasksById[task.id];
      if (!planned.ok) {
        continue;
      }
    }

    const preflight = runAutonomousRunnerPreflight(nextRunner, task, { vmStatus: effectiveVmStatus, now, nowMs });
    nextRunner = preflight.runner;
    if (!preflight.ok) {
      nextRunner = updateTaskAfterPreflightFailure(nextRunner, task, preflight, { now, nowMs });
      if (preflight.state === RUNNER_TASK_STATUSES.WAITING_RETRY || preflight.state === 'skip') {
        continue;
      }
      continue;
    }

    const processed = await processTask({
        runner: nextRunner,
        task,
        preflight,
        invokeTool,
        onRunnerStateChange,
        now,
        nowMs,
      });

    return {
      ok: true,
      ...processed,
      nextIntervalMs: computeNextRunnerIntervalMs(processed.runner, { nowMs }),
    };
  }

  return {
    ok: true,
    executed: false,
    reason: queueDecision.task ? 'no_task_passed_preflight' : 'no_eligible_task',
    runner: appendAutonomousRunnerAudit(nextRunner, {
      timestamp: now,
      type: 'runner_tick',
      summary: 'Tick do Runner terminou sem execucao.',
      reason: queueDecision.task ? 'no_task_passed_preflight' : 'no_eligible_task',
    }),
    nextIntervalMs: computeNextRunnerIntervalMs(nextRunner, { nowMs }),
    learningCandidates: [],
  };
};
