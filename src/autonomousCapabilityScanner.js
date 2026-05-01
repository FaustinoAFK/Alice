import { getExperimentStrategiesForGap } from './autonomousExperimentStrategies';
import { createGapsFromLearningGoals } from './autonomousLearningGoals';
import { normalizeAutonomousLearningPolicy } from './autonomousLearningPolicy';

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const FOUNDATION_CAPABILITY_GAPS = [
  {
    gapId: 'gap-browser-search-address-bar',
    type: 'browser_search',
    capability: 'browser.search',
    description: 'Alice nao tem procedimento confiavel para pesquisar usando a barra do navegador.',
    priority: 'high',
    evidenceKey: 'procedural_memory_missing_browser_search',
    keywords: ['browser.search', 'barra', 'pesquis', 'address bar', 'ctrl+l'],
  },
  {
    gapId: 'gap-text-input-focused-field',
    type: 'text_input',
    capability: 'text.input',
    description: 'Alice nao tem procedimento confiavel para digitar texto em um campo focado e validar o valor inserido.',
    priority: 'high',
    evidenceKey: 'procedural_memory_missing_text_input',
    keywords: ['text.input', 'digitar', 'campo focado', 'type text', 'keyboard_type_text'],
  },
  {
    gapId: 'gap-page-load-validation',
    type: 'page_validation',
    capability: 'page.validate',
    description: 'Alice nao tem procedimento confiavel para validar se uma pagina carregou pelo titulo, URL ou conteudo.',
    priority: 'medium',
    evidenceKey: 'procedural_memory_missing_page_validation',
    keywords: ['page.validate', 'validar pagina', 'titulo', 'url', 'content_loaded'],
  },
  {
    gapId: 'gap-app-launch-safe',
    type: 'app_launch',
    capability: 'app.launch',
    description: 'Alice nao tem procedimento confiavel para abrir um aplicativo seguro em ambiente controlado e validar que iniciou.',
    priority: 'medium',
    evidenceKey: 'procedural_memory_missing_app_launch',
    keywords: ['app.launch', 'abrir aplicativo', 'process_started', 'janela'],
  },
  {
    gapId: 'gap-text-field-interaction',
    type: 'field_interaction',
    capability: 'field.interaction',
    description: 'Alice nao tem procedimento confiavel para focar, preencher e validar um campo de texto em UI controlada.',
    priority: 'medium',
    evidenceKey: 'procedural_memory_missing_field_interaction',
    keywords: ['field.interaction', 'campo de texto', 'focus field', 'field_value_changed'],
  },
  {
    gapId: 'gap-page-read-content',
    type: 'page_read',
    capability: 'page.read',
    description: 'Alice nao tem procedimento confiavel para extrair e validar conteudo textual de uma pagina em ambiente controlado.',
    priority: 'medium',
    evidenceKey: 'procedural_memory_missing_page_read',
    keywords: ['page.read', 'ler pagina', 'extrair conteudo', 'content_marker'],
  },
];

const procedureSupportsPolicyEnvironment = (procedure = {}, policy = {}) => {
  const normalizedPolicy = normalizeAutonomousLearningPolicy(policy);
  const environments = new Set([
    normalizeText(procedure.environment),
    ...normalizeArray(procedure.environments).map(normalizeText),
  ].filter(Boolean));
  if (normalizedPolicy.allowedEnvironments.includes('real_vm') &&
      !normalizedPolicy.allowedEnvironments.includes('local_workspace_fallback') &&
      !normalizedPolicy.allowedEnvironments.includes('local_workspace') &&
      !normalizedPolicy.allowedEnvironments.includes('workspace')) {
    return environments.has('real_vm');
  }
  return true;
};

const hasTrustedProcedureForCapability = (procedures = [], capability = {}, policy = {}) =>
  procedures.some((procedure) => {
    const haystack = normalizeLower([
      procedure.procedureId,
      procedure.title,
      procedure.summary,
      ...(procedure.steps || []),
      ...(procedure.capabilities || []),
    ].join(' '));
    return (
      ['active', 'guarded', 'validated'].includes(procedure.status || '') &&
      Number(procedure.confidence || 0) >= 0.6 &&
      procedureSupportsPolicyEnvironment(procedure, policy) &&
      normalizeArray([capability.capability, ...(capability.keywords || [])])
        .some((keyword) => haystack.includes(normalizeLower(keyword)))
    );
  });

const recentRunnerFailures = (runner = {}) =>
  normalizeArray(runner.audits)
    .filter((event) => {
      const haystack = `${event.type} ${event.reason} ${event.afterState} ${event.summary}`;
      if (event.type === 'evidence_persistence' && event.metadata?.ok === true) {
        return false;
      }
      if (event.type === 'validation' && event.metadata?.passed === true) {
        return false;
      }
      if (event.reason === 'preflight_passed') {
        return false;
      }
      if (['failed', 'blocked', 'waiting_retry'].includes(event.afterState)) {
        return true;
      }
      return /failed|failure|falha|max_attempts|stale|unavailable|blocked|rejected|recusad|validation_failed|evidence_persistence_failed/i.test(haystack);
    })
    .slice(-8);

const existingGapIds = (state = {}) => new Set(normalizeArray(state.knownGaps).map((gap) => gap.gapId));
const runnerAlreadyHasTaskForGap = (runner = {}, gapId = '') =>
  Object.values(runner.tasksById || {}).some((task) =>
    task.metadata?.gapId === gapId &&
    ['planned', 'ready', 'running', 'waiting_retry', 'blocked', 'done'].includes(task.status),
  );

const createGap = (gap, { policy = {} } = {}) => ({
  gapId: gap.gapId,
  type: gap.type,
  capability: gap.capability || gap.type,
  description: gap.description,
  priority: gap.priority || 'medium',
  evidence: normalizeArray(gap.evidence).slice(0, 8),
  suggestedExperiments: getExperimentStrategiesForGap(gap, { policy }).map((strategy) => strategy.strategyId),
  riskLevel: gap.riskLevel || 'low',
  status: gap.status || 'open',
  firstSeenAt: gap.firstSeenAt || new Date().toISOString(),
  lastSeenAt: gap.lastSeenAt || new Date().toISOString(),
});

export const scanAutonomousCapabilityGaps = (memory = {}, { policy = {}, now = new Date().toISOString() } = {}) => {
  const procedures = [
    ...normalizeArray(memory.proceduralMemory?.procedures),
    ...normalizeArray(memory.autonomousAudit?.procedures),
    ...normalizeArray(memory.autonomousLearning?.promotedProcedures),
  ];
  const candidates = [
    ...normalizeArray(memory.autonomousAudit?.skillCandidates),
    ...normalizeArray(memory.autonomousLearning?.procedureCandidates),
  ];
  const knownGapSet = existingGapIds(memory.autonomousLearning);
  const gaps = createGapsFromLearningGoals(memory.autonomousLearning?.learningGoals, { policy, now })
    .filter((gap) => !runnerAlreadyHasTaskForGap(memory.autonomousRunner, gap.gapId));

  FOUNDATION_CAPABILITY_GAPS.forEach((capability) => {
    if (hasTrustedProcedureForCapability(procedures, capability, policy)) {
      return;
    }
    gaps.push(createGap({
      gapId: capability.gapId,
      type: capability.type,
      capability: capability.capability,
      description: capability.description,
      priority: capability.priority,
      evidence: [
        capability.evidenceKey,
        candidates.length ? `learning_candidates=${candidates.length}` : 'no_learning_candidates',
      ],
      riskLevel: 'low',
      firstSeenAt: knownGapSet.has(capability.gapId)
        ? memory.autonomousLearning?.knownGaps?.find((gap) => gap.gapId === capability.gapId)?.firstSeenAt || now
        : now,
      lastSeenAt: now,
    }, { policy }));
  });

  procedures
    .filter((procedure) => Number(procedure.confidence || 0) > 0 && Number(procedure.confidence || 0) < 0.45)
    .slice(0, 4)
    .forEach((procedure) => {
      gaps.push(createGap({
        gapId: `gap-low-confidence-${normalizeLower(procedure.procedureId).replace(/[^a-z0-9]+/g, '-') || 'procedure'}`,
        type: 'procedure_confidence',
        capability: normalizeArray(procedure.capabilities)[0] || 'procedure.reliability',
        description: `Procedimento com baixa confianca: ${procedure.title || procedure.procedureId}.`,
        priority: 'medium',
        evidence: [`confidence=${procedure.confidence}`, `status=${procedure.status}`],
        riskLevel: 'low',
        firstSeenAt: now,
        lastSeenAt: now,
      }, { policy }));
    });

  recentRunnerFailures(memory.autonomousRunner).slice(0, 3).forEach((event) => {
    const task = memory.autonomousRunner?.tasksById?.[event.taskId];
    if (!task || task.status === 'done') {
      return;
    }
    const gapId = `gap-runner-failure-${normalizeLower(event.taskId).replace(/[^a-z0-9]+/g, '-')}`;
    if (runnerAlreadyHasTaskForGap(memory.autonomousRunner, gapId)) {
      return;
    }
    gaps.push(createGap({
      gapId,
      type: 'runner_failure',
      capability: 'runner.recovery',
      description: `Falha recente do Runner precisa de aprendizado: ${task.title || event.taskId}.`,
      priority: 'medium',
      evidence: [event.reason || 'runner_failure', event.summary || ''],
      riskLevel: task.riskLevel || 'low',
      firstSeenAt: now,
      lastSeenAt: now,
    }, { policy }));
  });

  const dedupedGaps = [];
  const seenGapIds = new Set();
  gaps.forEach((gap) => {
    if (seenGapIds.has(gap.gapId) || runnerAlreadyHasTaskForGap(memory.autonomousRunner, gap.gapId)) {
      return;
    }
    seenGapIds.add(gap.gapId);
    dedupedGaps.push(gap);
  });

  return {
    ok: true,
    scannedAt: now,
    gaps: dedupedGaps,
  };
};
