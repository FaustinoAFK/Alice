import { v4 as uuidv4 } from 'uuid';
import {
  MAX_RUNNER_EVIDENCE_REFS,
  normalizeAutonomousRunnerState,
} from './autonomousRunnerState';

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const truncatePreview = (value, maxLength = 600) => normalizeText(value).slice(0, maxLength);

export const createRunnerExecutionId = (taskId = '', stepId = '') =>
  `runner-exec-${normalizeText(taskId) || 'task'}-${normalizeText(stepId) || 'step'}-${uuidv4()}`;

export const createRunnerEvidenceRef = ({
  executionId = '',
  taskId = '',
  stepId = '',
  kind = 'minimal',
  path = '',
  label = '',
  important = false,
  metadata = {},
  createdAt = new Date().toISOString(),
} = {}) => ({
  id: `runner-evidence-${uuidv4()}`,
  executionId: normalizeText(executionId),
  taskId: normalizeText(taskId),
  stepId: normalizeText(stepId),
  kind: normalizeText(kind) || 'minimal',
  path: normalizeText(path),
  label: normalizeText(label),
  important: Boolean(important),
  metadata: metadata && typeof metadata === 'object' ? metadata : {},
  createdAt,
});

export const buildRunnerEvidenceFromExecution = ({
  task = {},
  step = {},
  executionResult = {},
  executionId = createRunnerExecutionId(task.id, step.id),
  validationResult = null,
  startedAt = new Date().toISOString(),
  finishedAt = new Date().toISOString(),
} = {}) => {
  const artifacts = executionResult?.artifacts || {};
  const basePath = `data/evidence/${executionId}`;
  const kind = step.expectedEvidence?.kind || (step.type === 'visual' ? 'visual' : 'complete');
  const refs = [];

  refs.push(createRunnerEvidenceRef({
    executionId,
    taskId: task.id,
    stepId: step.id,
    kind,
    path: `${basePath}/metadata.json`,
    label: 'metadata',
    important: !executionResult?.ok || task.priority === 'critical',
    metadata: {
      command: step.action?.command || step.action?.visualAction || '',
      exitCode: artifacts.statusCode ?? (executionResult?.ok ? 0 : 1),
      message: truncatePreview(executionResult?.message),
      startedAt,
      finishedAt,
    },
    createdAt: finishedAt,
  }));

  if (executionResult?.stdout) {
    refs.push(createRunnerEvidenceRef({
      executionId,
      taskId: task.id,
      stepId: step.id,
      kind: 'stdout',
      path: `${basePath}/stdout.txt`,
      label: 'stdout',
      metadata: { preview: truncatePreview(executionResult.stdout) },
      createdAt: finishedAt,
    }));
  }

  if (executionResult?.stderr) {
    refs.push(createRunnerEvidenceRef({
      executionId,
      taskId: task.id,
      stepId: step.id,
      kind: 'stderr',
      path: `${basePath}/stderr.txt`,
      label: 'stderr',
      important: true,
      metadata: { preview: truncatePreview(executionResult.stderr) },
      createdAt: finishedAt,
    }));
  }

  if (validationResult) {
    refs.push(createRunnerEvidenceRef({
      executionId,
      taskId: task.id,
      stepId: step.id,
      kind: 'validation',
      path: `${basePath}/validation.json`,
      label: 'validation',
      important: !validationResult.passed,
      metadata: {
        passed: Boolean(validationResult.passed),
        reason: validationResult.reason || '',
      },
      createdAt: finishedAt,
    }));
  }

  [
    artifacts.hostScreenshotPath,
    artifacts.guestScreenshotPath,
    artifacts.screenshotPath,
  ].filter(Boolean).forEach((path, index) => {
    refs.push(createRunnerEvidenceRef({
      executionId,
      taskId: task.id,
      stepId: step.id,
      kind: 'screenshot',
      path,
      label: `screenshot-${index + 1}`,
      important: step.type === 'visual',
      createdAt: finishedAt,
    }));
  });

  return refs;
};

export const attachRunnerEvidenceRefs = (runner, refs = []) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const normalizedRefs = refs.filter(Boolean);
  if (normalizedRefs.length === 0) {
    return normalizedRunner;
  }

  return {
    ...normalizedRunner,
    evidenceRefs: [...normalizedRunner.evidenceRefs, ...normalizedRefs].slice(-MAX_RUNNER_EVIDENCE_REFS),
  };
};

export const applyRunnerEvidenceRetention = (runner) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const activeTaskIds = new Set([
    normalizedRunner.activeTaskId,
    normalizedRunner.runnerLock?.activeTaskId,
  ].filter(Boolean));
  const successRefs = [];
  const retainedRefs = [];

  normalizedRunner.evidenceRefs.forEach((ref) => {
    if (activeTaskIds.has(ref.taskId) || ref.important) {
      retainedRefs.push(ref);
      return;
    }
    successRefs.push(ref);
  });

  return {
    ...normalizedRunner,
    evidenceRefs: [
      ...retainedRefs,
      ...successRefs.slice(-normalizedRunner.settings.retention.maxSuccessEvidence),
    ].slice(-MAX_RUNNER_EVIDENCE_REFS),
  };
};
