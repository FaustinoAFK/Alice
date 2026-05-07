import { v4 as uuidv4 } from 'uuid';
import {
  MAX_RUNNER_EVIDENCE_REFS,
  normalizeAutonomousRunnerState,
} from './autonomousRunnerState';
import { parseTextInputDiagnosticsOutput } from './autonomousRunnerTextInputDiagnostics';

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const truncatePreview = (value, maxLength = 600) => normalizeText(value).slice(0, maxLength);
const hashText = (value = '') => {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};
const safeEvidenceSegment = (value = '', fallback = 'item', maxLength = 32) => {
  const normalized = String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
  if (normalized.length <= maxLength) {
    return normalized;
  }
  const suffix = hashText(normalized);
  return `${normalized.slice(0, Math.max(1, maxLength - suffix.length - 1)).replace(/-+$/g, '')}-${suffix}`;
};

const requiredEvidenceIncludes = (step = {}, token = '') =>
  (step.expectedEvidence?.required || [])
    .map((item) => normalizeText(item).toLowerCase())
    .includes(token);

const parseFolderEvidenceFromOutput = (output = '') => {
  const lines = String(output || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines.reverse()) {
    if (!line.startsWith('{') || !line.endsWith('}')) {
      continue;
    }
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === 'object' && parsed.resolvedFilesystemName && parsed.targetPath) {
        return parsed;
      }
    } catch {
      // Ignore non-JSON command output.
    }
  }
  return null;
};

const getEvidenceOutput = (executionResult = {}) => {
  const agentResult = executionResult.artifacts?.agentResponse?.result || {};
  return [
    executionResult.stdout,
    executionResult.stderr,
    agentResult.stdout,
    agentResult.stderr,
  ].map((value) => String(value || '')).filter(Boolean).join('\n');
};

export const RUNNER_PHYSICAL_EVIDENCE_STATUS = {
  OK: 'ok',
  PARTIAL: 'partial',
  MISSING: 'missing',
  UNAVAILABLE: 'unavailable',
  NOT_VERIFIED: 'not_verified',
};

export const createRunnerExecutionId = (taskId = '', stepId = '') =>
  `runner-exec-${safeEvidenceSegment(taskId, 'task')}-${safeEvidenceSegment(stepId, 'step')}-${uuidv4()}`;

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
  const includeCompleteTextRefs = kind === 'complete';
  const textInputDiagnostics = validationResult?.textInputDiagnostics ||
    parseTextInputDiagnosticsOutput(getEvidenceOutput(executionResult));

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
      folderResolution: step.action?.folderCreate || null,
      folderExecution: parseFolderEvidenceFromOutput(executionResult?.stdout),
      textInputDiagnostics,
    },
    createdAt: finishedAt,
  }));

  if (executionResult?.stdout || includeCompleteTextRefs || requiredEvidenceIncludes(step, 'stdout')) {
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

  if (executionResult?.stderr || includeCompleteTextRefs || requiredEvidenceIncludes(step, 'stderr')) {
    refs.push(createRunnerEvidenceRef({
      executionId,
      taskId: task.id,
      stepId: step.id,
      kind: 'stderr',
      path: `${basePath}/stderr.txt`,
      label: 'stderr',
      important: Boolean(executionResult?.stderr),
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
        folderResolution: step.action?.folderCreate || null,
        folderValidation: validationResult.folderValidation || null,
        textInputDiagnostics,
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

export const applyRunnerEvidencePersistenceMetadata = (refs = [], persistence = {}) => {
  const status = normalizeText(persistence.status) || (
    persistence.ok ? RUNNER_PHYSICAL_EVIDENCE_STATUS.OK : RUNNER_PHYSICAL_EVIDENCE_STATUS.UNAVAILABLE
  );
  const persistedExecutionId = normalizeText(persistence.executionId);
  const persistedFiles = new Set((Array.isArray(persistence.files) ? persistence.files : [])
    .map((file) => (typeof file === 'string' ? file : file?.file || ''))
    .filter(Boolean));

  return refs.filter(Boolean).map((ref) => {
    const originalExecutionId = normalizeText(ref.executionId);
    const originalPath = normalizeText(ref.path);
    const originalPrefix = `data/evidence/${originalExecutionId}/`;
    const shouldUsePersistedPath = persistedExecutionId &&
      originalExecutionId &&
      persistedExecutionId !== originalExecutionId &&
      originalPath.startsWith(originalPrefix);
    const path = shouldUsePersistedPath
      ? `data/evidence/${persistedExecutionId}/${originalPath.slice(originalPrefix.length)}`
      : originalPath;
    const fileName = path.split(/[\\/]/).filter(Boolean).at(-1);
    const isPersistedFile = persistedExecutionId &&
      path.startsWith(`data/evidence/${persistedExecutionId}/`) &&
      persistedFiles.has(fileName);
    const physicalStatus = isPersistedFile ? status : RUNNER_PHYSICAL_EVIDENCE_STATUS.NOT_VERIFIED;

    return {
      ...ref,
      executionId: shouldUsePersistedPath ? persistedExecutionId : ref.executionId,
      path,
      metadata: {
        ...(ref.metadata || {}),
        physicalStatus,
        persistence: {
          ok: Boolean(persistence.ok),
          status: physicalStatus,
          reason: normalizeText(persistence.reason),
          message: truncatePreview(persistence.message, 300),
          checkedAt: normalizeText(persistence.checkedAt),
          files: Array.isArray(persistence.files) ? persistence.files : [],
          missingFiles: Array.isArray(persistence.missingFiles) ? persistence.missingFiles : [],
        },
      },
    };
  });
};

export const summarizeRunnerEvidencePhysicalStatus = (refs = []) => {
  const normalizedRefs = refs.filter(Boolean);
  if (normalizedRefs.length === 0) {
    return {
      status: RUNNER_PHYSICAL_EVIDENCE_STATUS.NOT_VERIFIED,
      label: 'nao verificada',
      total: 0,
      confirmed: 0,
      partial: 0,
      missing: 0,
      unavailable: 0,
      notVerified: 0,
    };
  }

  const counts = normalizedRefs.reduce((acc, ref) => {
    const status =
      ref?.metadata?.physicalStatus ||
      ref?.metadata?.persistence?.status ||
      RUNNER_PHYSICAL_EVIDENCE_STATUS.NOT_VERIFIED;
    if (status === RUNNER_PHYSICAL_EVIDENCE_STATUS.OK) {
      acc.confirmed += 1;
    } else if (status === RUNNER_PHYSICAL_EVIDENCE_STATUS.PARTIAL) {
      acc.partial += 1;
    } else if (status === RUNNER_PHYSICAL_EVIDENCE_STATUS.MISSING) {
      acc.missing += 1;
    } else if (status === RUNNER_PHYSICAL_EVIDENCE_STATUS.UNAVAILABLE) {
      acc.unavailable += 1;
    } else {
      acc.notVerified += 1;
    }
    return acc;
  }, {
    confirmed: 0,
    partial: 0,
    missing: 0,
    unavailable: 0,
    notVerified: 0,
  });

  let status = RUNNER_PHYSICAL_EVIDENCE_STATUS.OK;
  if (counts.missing > 0) {
    status = RUNNER_PHYSICAL_EVIDENCE_STATUS.MISSING;
  } else if (counts.partial > 0) {
    status = RUNNER_PHYSICAL_EVIDENCE_STATUS.PARTIAL;
  } else if (counts.unavailable > 0) {
    status = RUNNER_PHYSICAL_EVIDENCE_STATUS.UNAVAILABLE;
  } else if (counts.notVerified > 0) {
    status = RUNNER_PHYSICAL_EVIDENCE_STATUS.NOT_VERIFIED;
  }

  const labels = {
    [RUNNER_PHYSICAL_EVIDENCE_STATUS.OK]: 'confirmada',
    [RUNNER_PHYSICAL_EVIDENCE_STATUS.PARTIAL]: 'parcialmente ausente',
    [RUNNER_PHYSICAL_EVIDENCE_STATUS.MISSING]: 'ausente',
    [RUNNER_PHYSICAL_EVIDENCE_STATUS.UNAVAILABLE]: 'indisponivel',
    [RUNNER_PHYSICAL_EVIDENCE_STATUS.NOT_VERIFIED]: 'nao verificada',
  };

  return {
    status,
    label: labels[status],
    total: normalizedRefs.length,
    ...counts,
  };
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
