import {
  LEARNING_STATES,
  normalizeArray,
  normalizeText,
} from './contracts';
import { validationAllowsLearningPromotion } from './validation';

export const createProcedureCandidate = ({
  candidateId = '',
  title = '',
  summary = '',
  steps = [],
  source = 'observed',
  confidence = 0.2,
  now = Date.now(),
} = {}) => ({
  candidateId: normalizeText(candidateId) || `procedure-candidate-${now}`,
  title: normalizeText(title),
  summary: normalizeText(summary),
  steps: normalizeArray(steps).map((step) => normalizeText(step)),
  source: normalizeText(source) || 'observed',
  confidence: Math.min(1, Math.max(0, Number(confidence || 0))),
  status: LEARNING_STATES.CANDIDATE,
  validationHistory: [],
  createdAt: now,
  updatedAt: now,
});

export const advanceLearningState = ({
  item,
  validationReport = null,
  success = false,
  failureReason = '',
  now = Date.now(),
} = {}) => {
  const currentStatus = item?.status || LEARNING_STATES.OBSERVED;
  const failureCount = Number(item?.failureCount || 0) + (success ? 0 : 1);
  const successCount = Number(item?.successCount || 0) + (success ? 1 : 0);
  const nextConfidence = Math.min(
    1,
    Math.max(
      0,
      Number(item?.confidence || 0.2) + (success ? 0.12 : -0.18),
    ),
  );
  const nextStatus = (() => {
    if (validationAllowsLearningPromotion(validationReport)) {
      return LEARNING_STATES.VALIDATED;
    }
    if (failureCount >= 3) {
      return LEARNING_STATES.FAILED;
    }
    if (currentStatus === LEARNING_STATES.OBSERVED) {
      return LEARNING_STATES.CANDIDATE;
    }
    if (currentStatus === LEARNING_STATES.CANDIDATE && validationReport) {
      return LEARNING_STATES.TESTING;
    }
    return currentStatus;
  })();

  return {
    ...item,
    status: nextStatus,
    confidence: nextConfidence,
    successCount,
    failureCount,
    lastFailureReason: success ? '' : normalizeText(failureReason) || item?.lastFailureReason || '',
    validationHistory: [
      ...(item?.validationHistory || []),
      validationReport,
    ].filter(Boolean).slice(-8),
    updatedAt: now,
  };
};

export const promoteValidatedProcedure = ({
  candidate,
  validationReport,
  now = Date.now(),
} = {}) => {
  if (!candidate?.candidateId || !validationAllowsLearningPromotion(validationReport)) {
    return {
      promoted: false,
      reason: 'procedure_requires_validated_evidence',
      procedure: null,
    };
  }

  return {
    promoted: true,
    reason: 'procedure_promoted_after_validation',
    procedure: {
      procedureId: `procedure:${candidate.candidateId}`,
      title: candidate.title,
      summary: candidate.summary,
      steps: candidate.steps,
      status: LEARNING_STATES.ACTIVE,
      confidence: Math.max(candidate.confidence || 0, 0.75),
      source: 'validated_operational_learning',
      validationHistory: [validationReport],
      createdAt: candidate.createdAt || now,
      updatedAt: now,
    },
  };
};

export const degradeProcedure = ({ procedure, reason = '', now = Date.now() } = {}) => {
  const currentStatus = procedure?.status || LEARNING_STATES.CANDIDATE;

  return {
    ...procedure,
    status:
      currentStatus === LEARNING_STATES.ACTIVE || currentStatus === LEARNING_STATES.DEPRECATED
        ? LEARNING_STATES.DEPRECATED
        : LEARNING_STATES.FAILED,
    degradationReason: normalizeText(reason) || 'low_quality_or_repeated_failure',
    failureCount: Number(procedure?.failureCount || 0) + 1,
    confidence: Math.max(0, Number(procedure?.confidence || 0) - 0.18),
    updatedAt: now,
  };
};

export const archiveDeprecatedProcedures = ({ procedures = [], now = Date.now() } = {}) =>
  normalizeArray(procedures).map((procedure) => {
    if (
      procedure.status === LEARNING_STATES.DEPRECATED &&
      (Number(procedure.failureCount || 0) >= 4 || Number(procedure.confidence || 0) < 0.2)
    ) {
      return {
        ...procedure,
        status: LEARNING_STATES.ARCHIVED,
        archivedAt: now,
        archiveReason: procedure.degradationReason || 'deprecated_low_confidence',
        updatedAt: now,
      };
    }

    return procedure;
  });

export const pruneOperationalLearning = ({ procedures = [], candidates = [], now = Date.now() } = {}) => {
  const originallyDeprecatedProcedureIds = new Set(
    procedures
      .filter((procedure) => procedure.status === LEARNING_STATES.DEPRECATED)
      .map((procedure) => procedure.procedureId),
  );
  const degradedProcedures = procedures.map((procedure) => {
    if (Number(procedure.failureCount || 0) >= 3 || Number(procedure.confidence || 0) < 0.35) {
      return degradeProcedure({ procedure, reason: 'low_confidence_or_repeated_failure', now });
    }
    return procedure;
  });
  const retainedCandidates = candidates
    .map((candidate) =>
      Number(candidate.failureCount || 0) >= 3
        ? { ...candidate, status: LEARNING_STATES.FAILED, updatedAt: now }
        : candidate,
    )
    .filter((candidate) => candidate.status !== LEARNING_STATES.FAILED || Number(candidate.confidence || 0) > 0.1);

  return {
    procedures: degradedProcedures.map((procedure) =>
      originallyDeprecatedProcedureIds.has(procedure.procedureId)
        ? archiveDeprecatedProcedures({ procedures: [procedure], now })[0]
        : procedure,
    ),
    candidates: retainedCandidates,
  };
};
