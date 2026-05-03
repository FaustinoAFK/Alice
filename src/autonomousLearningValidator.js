import {
  RUNNER_STEP_STATUSES,
  RUNNER_TASK_STATUSES,
  normalizeAutonomousRunnerState,
} from './autonomousRunnerState';
import {
  AUTONOMOUS_LEARNING_CREATED_BY,
  AUTONOMOUS_REUSE_CREATED_BY,
} from './autonomousLearningPolicy';

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const allowedEvidenceFile = (path = '') => {
  const fileName = normalizeText(path).split(/[\\/]/).filter(Boolean).at(-1);
  return ['metadata.json', 'stdout.txt', 'stderr.txt', 'validation.json'].includes(fileName);
};

export const filesFromRunnerEvidenceRefs = (executionId = '', refs = []) => {
  const prefix = `data/evidence/${normalizeText(executionId)}/`;
  return [...new Set(
    normalizeArray(refs)
      .map((ref) => normalizeText(ref.path))
      .filter((path) => path.startsWith(prefix) && allowedEvidenceFile(path))
      .map((path) => path.slice(prefix.length).split(/[\\/]/).filter(Boolean).at(-1)),
  )];
};

const physicalStatusOk = (refs = []) =>
  refs.length > 0 &&
  refs.every((ref) => {
    const status = ref.metadata?.physicalStatus || ref.metadata?.persistence?.status;
    return status === 'ok';
  });

const stepValidationPassed = (step = {}) =>
  step.status === RUNNER_STEP_STATUSES.DONE &&
  step.result?.validation?.passed === true &&
  step.result?.validation?.evidencePersistence?.ok === true;

const isProcedureReuseTask = (task = {}) =>
  task.metadata?.createdBy === AUTONOMOUS_REUSE_CREATED_BY ||
  task.metadata?.learningScenario === 'procedure_reuse';

const hasSubstantiveReuseValidation = (task = {}) =>
  task.metadata?.substantiveValidation === true &&
  task.metadata?.validationKind !== 'infrastructure_marker';

const isAutonomousLearningTask = (task = {}) =>
  task.metadata?.createdBy === AUTONOMOUS_LEARNING_CREATED_BY ||
  task.metadata?.learningScenario === 'capability_gap' ||
  normalizeText(task.metadata?.createdBy) === 'autonomous_learning_loop';

const hasSubstantiveLearningValidation = (task = {}) => {
  if (task.metadata?.requiresSubstantiveValidation !== true) {
    return true;
  }
  if (task.metadata?.substantiveValidation !== true) {
    return false;
  }
  return normalizeArray(task.steps).some((step) =>
    step.status === RUNNER_STEP_STATUSES.DONE &&
    step.action?.requestedResources?.autonomousLearning?.phase === 'substantive_validation' &&
    step.result?.validation?.passed === true &&
    step.result?.validation?.evidencePersistence?.ok === true);
};

const groupRefsByExecutionId = (refs = []) =>
  normalizeArray(refs).reduce((groups, ref) => {
    const executionId = normalizeText(ref.executionId);
    if (!executionId) {
      return groups;
    }
    return {
      ...groups,
      [executionId]: [...(groups[executionId] || []), ref],
    };
  }, {});

export const verifyLearningEvidenceRefs = async ({
  evidenceRefs = [],
  verifyRunnerEvidence = null,
} = {}) => {
  if (typeof verifyRunnerEvidence !== 'function') {
    return {
      ok: false,
      reason: 'verify_runner_evidence_required',
      verifications: [],
    };
  }

  const groups = groupRefsByExecutionId(evidenceRefs);
  const verifications = [];
  for (const [executionId, refs] of Object.entries(groups)) {
    const files = filesFromRunnerEvidenceRefs(executionId, refs);
    if (files.length === 0) {
      return {
        ok: false,
        reason: 'evidence_refs_without_expected_files',
        verifications,
      };
    }
    const result = await verifyRunnerEvidence({ executionId, files });
    const status = result?.artifacts?.status || result?.status || (result?.ok ? 'ok' : 'unavailable');
    verifications.push({ executionId, files, ok: result?.ok === true && status === 'ok', status, result });
  }

  if (verifications.length === 0) {
    return {
      ok: false,
      reason: 'evidence_refs_missing',
      verifications,
    };
  }

  return {
    ok: verifications.every((verification) => verification.ok),
    reason: verifications.every((verification) => verification.ok)
      ? 'verify_runner_evidence_ok'
      : 'verify_runner_evidence_failed',
    verifications,
  };
};

export const validateLearningExperimentTask = async ({
  runner,
  taskId = '',
  task = null,
  verifyRunnerEvidence = null,
  now = new Date().toISOString(),
} = {}) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner || {});
  const targetTask = task || normalizedRunner.tasksById[taskId];
  if (!targetTask) {
    return { ok: false, status: 'failed', reason: 'learning_task_missing', checkedAt: now };
  }
  if (targetTask.status !== RUNNER_TASK_STATUSES.DONE) {
    return {
      ok: false,
      status: 'pending',
      reason: 'learning_task_not_done',
      taskId: targetTask.id,
      checkedAt: now,
    };
  }
  if (!targetTask.steps.length || !targetTask.steps.every(stepValidationPassed)) {
    return {
      ok: false,
      status: 'failed',
      reason: 'learning_step_validation_missing',
      taskId: targetTask.id,
      checkedAt: now,
    };
  }
  if (isProcedureReuseTask(targetTask) && !hasSubstantiveReuseValidation(targetTask)) {
    return {
      ok: false,
      status: 'failed',
      reason: 'procedure_reuse_requires_substantive_validation',
      taskId: targetTask.id,
      procedureId: targetTask.metadata?.procedureId || targetTask.procedureId || '',
      validationKind: targetTask.metadata?.validationKind || 'unknown',
      checkedAt: now,
    };
  }
  if (isAutonomousLearningTask(targetTask) && !hasSubstantiveLearningValidation(targetTask)) {
    return {
      ok: false,
      status: 'failed',
      reason: 'learning_requires_substantive_validation',
      taskId: targetTask.id,
      gapId: targetTask.metadata?.gapId || '',
      validationKind: targetTask.metadata?.validationKind || 'unknown',
      checkedAt: now,
    };
  }
  const refs = normalizeArray(targetTask.evidenceRefs)
    .map((refIdOrRef) => (typeof refIdOrRef === 'string'
      ? normalizedRunner.evidenceRefs.find((ref) => ref.id === refIdOrRef || ref.path === refIdOrRef)
      : refIdOrRef))
    .filter(Boolean);
  const stepRefs = targetTask.steps.flatMap((step) =>
    normalizeArray(step.evidenceRefs)
      .map((refIdOrRef) => (typeof refIdOrRef === 'string'
        ? normalizedRunner.evidenceRefs.find((ref) => ref.id === refIdOrRef || ref.path === refIdOrRef)
        : refIdOrRef))
      .filter(Boolean),
  );
  const evidenceRefs = [...refs, ...stepRefs].filter(Boolean);
  if (!physicalStatusOk(evidenceRefs)) {
    return {
      ok: false,
      status: 'failed',
      reason: 'physical_evidence_not_confirmed',
      taskId: targetTask.id,
      evidenceRefs,
      checkedAt: now,
    };
  }
  const evidenceVerification = await verifyLearningEvidenceRefs({
    evidenceRefs,
    verifyRunnerEvidence,
  });
  if (!evidenceVerification.ok) {
    return {
      ok: false,
      status: 'failed',
      reason: evidenceVerification.reason,
      taskId: targetTask.id,
      evidenceRefs,
      evidenceVerification,
      checkedAt: now,
    };
  }
  if (normalizedRunner.runnerLock) {
    return {
      ok: false,
      status: 'failed',
      reason: 'runner_lock_active_after_learning_task',
      taskId: targetTask.id,
      checkedAt: now,
    };
  }
  const runningTasks = Object.values(normalizedRunner.tasksById).filter((item) => item.status === RUNNER_TASK_STATUSES.RUNNING);
  const runningSteps = Object.values(normalizedRunner.tasksById)
    .flatMap((item) => item.steps.map((step) => ({ taskId: item.id, step })))
    .filter((item) => item.step.status === RUNNER_STEP_STATUSES.RUNNING);
  if (runningTasks.length || runningSteps.length) {
    return {
      ok: false,
      status: 'failed',
      reason: 'runner_not_idle_after_learning_task',
      taskId: targetTask.id,
      runningTasks: runningTasks.map((item) => item.id),
      runningSteps: runningSteps.map((item) => `${item.taskId}:${item.step.id}`),
      checkedAt: now,
    };
  }

  return {
    ok: true,
    status: 'passed',
    reason: 'learning_experiment_validated',
    taskId: targetTask.id,
    gapId: targetTask.metadata?.gapId || '',
    capability: targetTask.metadata?.capability || '',
    evidenceRefs,
    evidenceVerification,
    confidence: 0.62,
    substantive: targetTask.metadata?.substantiveValidation === true,
    validationKind: targetTask.metadata?.validationKind || 'controlled_experiment',
    checkedAt: now,
  };
};
