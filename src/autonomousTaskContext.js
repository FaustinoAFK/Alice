const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
const toSafeIdPart = (value) =>
  normalizeLower(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'task';

const terminalFailureStatuses = new Set(['failed', 'blocked', 'waiting_retry']);

const inferGapTypeFromCapability = (capability = '', fallback = '') => {
  const text = normalizeLower(`${capability} ${fallback}`);
  if (/install|winget|package/.test(text)) {
    return 'app_install';
  }
  if (/file|folder|explorer|arquivo|pasta/.test(text)) {
    return 'file_management';
  }
  if (/launch|abrir aplicativo|app/.test(text)) {
    return 'app_launch';
  }
  if (/browser|search|pesquis|url|address/.test(text)) {
    return 'browser_search';
  }
  if (/page|pagina|title|content/.test(text)) {
    return 'page_validation';
  }
  if (/field|input|texto|digitar/.test(text)) {
    return 'field_interaction';
  }
  return 'field_interaction';
};

const collectStepSignals = (task = {}) =>
  normalizeArray(task.steps)
    .filter((step) => ['failed', 'blocked', 'waiting_retry'].includes(normalizeText(step.status)))
    .map((step) => [
      `step=${normalizeText(step.id)}`,
      `status=${normalizeText(step.status)}`,
      step.reason ? `reason=${normalizeText(step.reason)}` : '',
      step.result?.validation?.reason ? `validation=${normalizeText(step.result.validation.reason)}` : '',
    ].filter(Boolean).join('|'))
    .slice(0, 6);

const tokenizeForAffinity = (value = '') =>
  normalizeLower(value)
    .split(/[^a-z0-9]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length >= 5);

const hasObservedTargetAffinity = ({ task = {}, metadata = {}, target = {} } = {}) => {
  const targetTokens = tokenizeForAffinity(target.label);
  if (targetTokens.length === 0) {
    return false;
  }
  const haystack = normalizeLower([
    task.title,
    task.description,
    task.reason,
    task.status,
    metadata.capability,
    metadata.learningScenario,
    metadata.targetLabel,
  ].filter(Boolean).join(' '));
  return targetTokens.some((token) => haystack.includes(token.slice(0, 5)));
};

const resolveRelatedObservedTargets = ({ metadata = {}, learning = {} } = {}) => {
  const contextObservedTargets = normalizeArray(metadata.context?.observedTargets)
    .map((item) => ({
      targetId: normalizeText(item.targetId),
      kind: normalizeText(item.kind),
      label: normalizeText(item.label),
      seenCount: Number(item.seenCount || 0),
      lastSeenAt: normalizeText(item.lastSeenAt),
    }))
    .filter((item) => item.label);
  if (contextObservedTargets.length > 0) {
    return contextObservedTargets.slice(0, 3);
  }

  const observedTargetId = normalizeText(metadata.observedTargetId);
  if (!observedTargetId) {
    return [];
  }

  return normalizeArray(learning.observedTargets)
    .filter((item) => normalizeText(item.targetId) === observedTargetId)
    .slice(0, 3)
    .map((item) => ({
      targetId: item.targetId,
      kind: item.kind,
      label: item.label,
      seenCount: item.seenCount || 0,
      lastSeenAt: item.lastSeenAt || '',
    }));
};

export const extractAutonomousTaskContext = ({ task = {}, memory = {} } = {}) => {
  const learning = memory.autonomousLearning || {};
  const metadata = task.metadata || {};
  let observedTargets = resolveRelatedObservedTargets({ metadata, learning });
  const explicitTarget = normalizeText(
    metadata.observedTargetLabel ||
    metadata.targetLabel ||
    metadata.appName ||
    metadata.site ||
    metadata.domain ||
    metadata.context?.target,
  );
  if (!explicitTarget && observedTargets.length === 0) {
    const recentObservedTargets = normalizeArray(learning.observedTargets)
      .slice()
      .sort((a, b) => Date.parse(b.lastSeenAt || '') - Date.parse(a.lastSeenAt || ''))
      .slice(0, 2);
    if (recentObservedTargets.length === 1 && hasObservedTargetAffinity({
      task,
      metadata,
      target: recentObservedTargets[0],
    })) {
      observedTargets = [{
        targetId: recentObservedTargets[0].targetId,
        kind: recentObservedTargets[0].kind,
        label: recentObservedTargets[0].label,
        seenCount: recentObservedTargets[0].seenCount || 0,
        lastSeenAt: recentObservedTargets[0].lastSeenAt || '',
      }];
    }
  }
  const target = explicitTarget || observedTargets[0]?.label || '';
  const capability = normalizeText(metadata.capability || task.capability || metadata.learningScenario);
  const failureSignals = [
    task.reason ? `reason=${normalizeText(task.reason)}` : '',
    task.status ? `status=${normalizeText(task.status)}` : '',
    ...collectStepSignals(task),
  ].filter(Boolean).slice(0, 8);

  return {
    taskId: normalizeText(task.id),
    title: normalizeText(task.title || task.description || task.id),
    status: normalizeText(task.status),
    capability,
    target,
    observedTargets,
    failureSignals,
    summary: [
      capability ? `capability=${capability}` : '',
      target ? `target=${target}` : '',
      failureSignals[0] || '',
    ].filter(Boolean).join(' | '),
  };
};

export const createContextualLearningGapForTask = (
  task = {},
  { memory = {}, now = new Date().toISOString() } = {},
) => {
  if (!terminalFailureStatuses.has(normalizeText(task.status))) {
    return null;
  }
  const context = extractAutonomousTaskContext({ task, memory });
  if (!context.taskId) {
    return null;
  }
  const gapType = inferGapTypeFromCapability(context.capability, `${task.title || ''} ${task.description || ''}`);
  const capability = context.capability || `${gapType}.context_adaptation`;
  const targetPart = context.target ? ` no contexto "${context.target}"` : '';

  return {
    gapId: `gap-context-repair-${toSafeIdPart(context.taskId)}`,
    type: gapType,
    capability,
    description: `Aprender uma adaptacao contextual para executar "${context.title}"${targetPart} sem repetir a falha atual.`,
    priority: task.status === 'blocked' ? 'high' : 'medium',
    riskLevel: task.riskLevel || task.metadata?.riskLevel || 'low',
    status: 'open',
    firstSeenAt: now,
    lastSeenAt: now,
    evidence: [
      `sourceTaskId=${context.taskId}`,
      context.summary,
      ...context.failureSignals,
    ].filter(Boolean).slice(0, 10),
    metadata: {
      source: 'runner_context_adaptation',
      sourceTaskId: context.taskId,
      sourceTaskStatus: context.status,
      context,
    },
  };
};
