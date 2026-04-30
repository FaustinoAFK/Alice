import { getExperimentStrategiesForGap } from './autonomousExperimentStrategies';

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const hasBrowserSearchProcedure = (procedures = []) =>
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
      (haystack.includes('browser.search') ||
        haystack.includes('barra') ||
        haystack.includes('pesquis') ||
        haystack.includes('address bar') ||
        haystack.includes('ctrl+l'))
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
  const gaps = [];

  if (!hasBrowserSearchProcedure(procedures)) {
    gaps.push(createGap({
      gapId: 'gap-browser-search-address-bar',
      type: 'browser_search',
      capability: 'browser.search',
      description: 'Alice nao tem procedimento confiavel para pesquisar usando a barra do navegador.',
      priority: 'high',
      evidence: [
        'procedural_memory_missing_browser_search',
        candidates.length ? `learning_candidates=${candidates.length}` : 'no_learning_candidates',
      ],
      riskLevel: 'low',
      firstSeenAt: knownGapSet.has('gap-browser-search-address-bar')
        ? memory.autonomousLearning?.knownGaps?.find((gap) => gap.gapId === 'gap-browser-search-address-bar')?.firstSeenAt || now
        : now,
      lastSeenAt: now,
    }, { policy }));
  }

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
    if (!task) {
      return;
    }
    gaps.push(createGap({
      gapId: `gap-runner-failure-${normalizeLower(event.taskId).replace(/[^a-z0-9]+/g, '-')}`,
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
    if (seenGapIds.has(gap.gapId)) {
      return;
    }
    seenGapIds.add(gap.gapId);
    dedupedGaps.push(gap);
  });

  return {
    ok: true,
    scannedAt: now,
    gaps: dedupedGaps.slice(0, 12),
  };
};
