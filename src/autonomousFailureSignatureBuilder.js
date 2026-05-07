const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const toSignaturePart = (value, fallback = '') =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '_')
    .replace(/^_+|_+$/g, '') ||
  fallback;

const latestFailedStep = (task = {}) =>
  normalizeArray(task.steps)
    .filter((step) => ['failed', 'blocked', 'waiting_retry'].includes(normalizeText(step.status)))
    .at(-1) || null;

const latestFailedExecution = (task = {}) =>
  normalizeArray(task.executionHistory)
    .filter((entry) =>
      ['failed', 'blocked', 'waiting_retry'].includes(normalizeText(entry.status)) ||
      entry.validation?.passed === false,
    )
    .at(-1) || null;

const executionText = (execution = {}) => normalizeText([
  execution.reason,
  execution.result?.message,
  execution.result?.stderr,
  execution.validation?.reason,
  execution.validation?.commandResult?.stderr,
  execution.validation?.commandResult?.stdout,
].filter(Boolean).join(' '));

const operationalErrorText = ({ step = {}, execution = {} } = {}) => normalizeText([
  execution?.validation?.commandResult?.stderr,
  execution?.validation?.commandResult?.stdout,
  execution?.result?.stderr,
  execution?.result?.message,
  step?.result?.stderrPreview,
  step?.result?.stdoutPreview,
].filter(Boolean).join(' '));

const extractKnownErrorCode = (value = '') => {
  const text = normalizeText(value);
  const known = text.match(/\b(controlled_text_file_mismatch|file_contains_not_evidenced|evidence_persistence_failed|runtime_invoke_unavailable|invoke_unavailable|vm_unavailable|workspace_unavailable|max_attempts_reached|recovery_loop_detected)\b/i);
  if (known?.[1]) {
    return known[1];
  }
  const thrown = text.match(/\b([a-z][a-z0-9]+(?:_[a-z0-9]+){1,})\b/i);
  return thrown?.[1] || '';
};

const resolveSkillOrGap = (task = {}) => {
  const metadata = task.metadata || {};
  return metadata.capability ||
    task.capability ||
    metadata.learningScenario ||
    metadata.gapId ||
    task.requestedResources?.autonomousLearning?.capability ||
    task.requestedResources?.autonomousLearning?.gapId ||
    task.id ||
    'unknown_gap';
};

const resolveValidationError = ({ step = {}, execution = {} } = {}) =>
  execution?.validation?.reason ||
  step?.result?.validation?.reason ||
  step?.reason ||
  execution?.reason ||
  '';

const resolveErrorCode = ({ task = {}, step = {}, execution = {} } = {}) => {
  const fromFields = task.errorCode ||
    step?.errorCode ||
    execution?.errorCode ||
    execution?.validation?.errorCode ||
    execution?.result?.errorCode ||
    '';
  if (fromFields) {
    return fromFields;
  }
  return extractKnownErrorCode(operationalErrorText({ step, execution })) ||
    extractKnownErrorCode(executionText(execution)) ||
    task.reason ||
    step?.reason ||
    execution?.reason ||
    'unknown_error';
};

const resolveToolOrMethod = ({ task = {}, step = {}, execution = {} } = {}) => {
  const metadata = task.metadata || {};
  const action = step.action || {};
  const actionMetadata = action.requestedResources?.autonomousLearning || {};
  const explicitMethod = action.parameters?.method ||
    actionMetadata.method ||
    actionMetadata.inputMethod ||
    metadata.method ||
    metadata.inputMethod ||
    '';
  if (explicitMethod) {
    return explicitMethod;
  }
  const haystack = normalizeText([
    step.id,
    step.title,
    action.visualAction,
    action.command,
    actionMetadata.strategyId,
    actionMetadata.actionKind,
    actionMetadata.controlledTarget?.profileId,
    executionText(execution),
  ].filter(Boolean).join(' ')).toLowerCase();
  if (
    haystack.includes('sendkeys') ||
    haystack.includes('controlled_text_file_mismatch') ||
    haystack.includes('notepad') ||
    haystack.includes('validate_text_field_interaction')
  ) {
    return 'sendkeys';
  }
  return action.visualAction || action.command || action.kind || metadata.createdBy || 'unknown_method';
};

const resolveEnvironment = ({ task = {}, step = {}, execution = {} } = {}) =>
  step.action?.environment ||
  task.environment ||
  execution.artifacts?.executionMode ||
  (task.requiresRealVm || step.type === 'visual' || step.action?.kind === 'visual' ? 'real_vm' : '');

export const buildFailureSignature = ({
  task = {},
  step = latestFailedStep(task),
  execution = latestFailedExecution(task),
} = {}) => {
  const safeStep = step || {};
  const safeExecution = execution || {};
  const coreParts = [
    resolveSkillOrGap(task),
    resolveErrorCode({ task, step: safeStep, execution: safeExecution }),
    resolveValidationError({ step: safeStep, execution: safeExecution }),
    resolveToolOrMethod({ task, step: safeStep, execution: safeExecution }),
  ].map((part) => toSignaturePart(part, 'unknown')).filter(Boolean);
  const environment = toSignaturePart(resolveEnvironment({ task, step: safeStep, execution: safeExecution }));
  const parts = environment ? [...coreParts, environment] : coreParts;

  return parts.join('|');
};

export const buildTaskFailureSignature = (task = {}) => buildFailureSignature({ task });
