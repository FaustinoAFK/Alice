const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const toProcedureId = (capability = '', fallback = '') => {
  const base = normalizeText(capability || fallback || 'learned-procedure')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `procedure_${base || 'learned'}`;
};

const procedureMatches = (procedure = {}, procedureId = '') =>
  normalizeText(procedure.procedureId) === normalizeText(procedureId);

const inferTaskEnvironments = (task = {}) => {
  const environments = new Set(
    normalizeArray(task.steps)
      .map((step) => normalizeText(step.action?.environment))
      .filter(Boolean),
  );
  if (task.requiresRealVm) {
    environments.add('real_vm');
  }
  return [...environments];
};

const validationIsSubstantive = (validation = {}, task = {}) =>
  validation.substantive === true ||
  task.metadata?.substantiveValidation === true ||
  task.metadata?.requiresSubstantiveValidation === true;

export const createProcedureCandidateFromValidation = ({
  validation = {},
  gap = {},
  task = {},
  now = new Date().toISOString(),
} = {}) => {
  const capability = normalizeText(validation.capability || gap.capability || task.metadata?.capability || 'learned.capability');
  const procedureId = toProcedureId(capability, validation.taskId || task.id);
  const environments = inferTaskEnvironments(task);
  const primaryEnvironment = environments.includes('real_vm')
    ? 'real_vm'
    : environments[0] || 'unknown';
  const evidenceRefs = normalizeArray(validation.evidenceRefs).map((ref) => ({
    id: ref.id,
    executionId: ref.executionId,
    taskId: ref.taskId,
    stepId: ref.stepId,
    path: ref.path,
    kind: ref.kind,
    physicalStatus: ref.metadata?.physicalStatus || ref.metadata?.persistence?.status || 'ok',
  }));

  return {
    candidate: {
      candidateId: `candidate_${procedureId}`,
      procedureId,
      title: capability === 'browser.search'
        ? 'Pesquisar no navegador pela barra de endereco'
        : `Procedimento para ${capability}`,
      summary: gap.description || task.description || `Procedimento aprendido para ${capability}.`,
      capability,
      capabilities: [capability],
      steps: normalizeArray(task.steps).map((step) => step.title || step.id).slice(0, 12),
      status: 'candidate',
      confidence: Math.max(0.55, Number(validation.confidence || 0.55)),
      source: 'autonomous_learning_loop',
      environment: primaryEnvironment,
      environments,
      evidenceRefs,
      validation: {
        reason: validation.reason,
        checkedAt: validation.checkedAt || now,
        substantive: validationIsSubstantive(validation, task),
        validationKind: validation.validationKind || task.metadata?.validationKind || 'controlled_experiment',
      },
      reuseValidation: {
        substantive: false,
        reason: 'reuse_requires_context_specific_validation',
      },
      usageCount: 0,
      successCount: 1,
      failureCount: 0,
      knownLimits: ['baixo risco', 'exige ambiente controlado', 'exige evidencia fisica'],
      fallbackStrategy: task.metadata?.strategies?.[1] || '',
      createdAt: now,
      updatedAt: now,
    },
    guardedProcedure: {
      procedureId,
      title: capability === 'browser.search'
        ? 'Pesquisar no navegador pela barra de endereco'
        : `Procedimento para ${capability}`,
      summary: gap.description || task.description || `Procedimento aprendido para ${capability}.`,
      steps: normalizeArray(task.steps).map((step) => step.title || step.id).slice(0, 12),
      status: 'guarded',
      confidence: Math.max(0.55, Number(validation.confidence || 0.55)),
      source: 'autonomous_learning_loop',
      environment: primaryEnvironment,
      environments,
      capabilities: [capability],
      evidenceRefs,
      validation: {
        reason: validation.reason,
        checkedAt: validation.checkedAt || now,
        substantive: validationIsSubstantive(validation, task),
        validationKind: validation.validationKind || task.metadata?.validationKind || 'controlled_experiment',
      },
      reuseValidation: {
        substantive: false,
        reason: 'reuse_requires_context_specific_validation',
      },
      usageCount: 0,
      successCount: 1,
      failureCount: 0,
      fallbackStrategy: task.metadata?.strategies?.[1] || '',
      createdAt: now,
      updatedAt: now,
    },
  };
};

export const promoteLearningValidation = ({
  memory = {},
  validation = {},
  gap = {},
  task = {},
  now = new Date().toISOString(),
} = {}) => {
  if (!validation.ok) {
    return {
      ok: false,
      reason: validation.reason || 'validation_required',
      memory,
      candidate: null,
      procedure: null,
    };
  }
  const { candidate, guardedProcedure } = createProcedureCandidateFromValidation({
    validation,
    gap,
    task,
    now,
  });
  const existingProcedures = normalizeArray(memory.proceduralMemory?.procedures);
  const duplicate = existingProcedures.find((procedure) => procedureMatches(procedure, guardedProcedure.procedureId));
  const nextProcedure = duplicate
    ? {
        ...duplicate,
        status: duplicate.status === 'active' ? 'active' : 'guarded',
        confidence: Math.min(1, Math.max(Number(duplicate.confidence || 0), guardedProcedure.confidence) + 0.04),
        evidenceRefs: [...normalizeArray(duplicate.evidenceRefs), ...guardedProcedure.evidenceRefs].slice(-12),
        environment: guardedProcedure.environment || duplicate.environment,
        environments: [...new Set([
          ...normalizeArray(duplicate.environments),
          ...normalizeArray(guardedProcedure.environments),
          guardedProcedure.environment,
        ].filter(Boolean))],
        validation: {
          ...(duplicate.validation || {}),
          substantive: duplicate.validation?.substantive === true,
          validationKind: duplicate.validation?.validationKind || 'controlled_experiment',
        },
        reuseValidation: {
          ...(duplicate.reuseValidation || {}),
          substantive: duplicate.reuseValidation?.substantive === true,
          reason: duplicate.reuseValidation?.reason || 'reuse_requires_context_specific_validation',
        },
        successCount: Number(duplicate.successCount || 0) + 1,
        updatedAt: now,
      }
    : guardedProcedure;
  const nextProcedures = duplicate
    ? existingProcedures.map((procedure) => (procedureMatches(procedure, nextProcedure.procedureId) ? nextProcedure : procedure))
    : [...existingProcedures, nextProcedure];
  const previousLearning = memory.autonomousLearning || {};
  const previousCandidates = normalizeArray(previousLearning.procedureCandidates);
  const nextCandidates = [
    ...previousCandidates.filter((item) => item.candidateId !== candidate.candidateId),
    candidate,
  ].slice(-40);

  return {
    ok: true,
    reason: duplicate ? 'procedure_confidence_reinforced' : 'guarded_procedure_created',
    memory: {
      ...memory,
      proceduralMemory: {
        ...(memory.proceduralMemory || {}),
        procedures: nextProcedures,
      },
      autonomousLearning: {
        ...previousLearning,
        procedureCandidates: nextCandidates,
        promotedProcedures: [
          ...normalizeArray(previousLearning.promotedProcedures).filter((item) => item.procedureId !== nextProcedure.procedureId),
          nextProcedure,
        ].slice(-40),
        stats: {
          ...(previousLearning.stats || {}),
          promotions: Number(previousLearning.stats?.promotions || 0) + (duplicate ? 0 : 1),
          reinforcements: Number(previousLearning.stats?.reinforcements || 0) + (duplicate ? 1 : 0),
        },
      },
      autonomousAudit: {
        ...(memory.autonomousAudit || {}),
        skillCandidates: [
          ...normalizeArray(memory.autonomousAudit?.skillCandidates).filter((item) => item.candidateId !== candidate.candidateId),
          candidate,
        ].slice(-60),
        procedures: [
          ...normalizeArray(memory.autonomousAudit?.procedures).filter((item) => item.procedureId !== nextProcedure.procedureId),
          nextProcedure,
        ].slice(-60),
        learningMemoryEvents: [
          ...normalizeArray(memory.autonomousAudit?.learningMemoryEvents),
          {
            eventId: `learning-promotion-${Date.parse(now) || Date.now()}`,
            type: duplicate ? 'procedure_reinforced' : 'guarded_procedure_created',
            procedureId: nextProcedure.procedureId,
            candidateId: candidate.candidateId,
            evidenceRefs: candidate.evidenceRefs,
            createdAt: now,
          },
        ].slice(-60),
        updatedAt: now,
      },
    },
    candidate,
    procedure: nextProcedure,
  };
};
