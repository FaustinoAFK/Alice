import {
  LEARNING_PLAN_LIMITS,
  LEARNING_PLAN_STATUS,
  LEARNING_PLAN_STATUSES,
  createLearningPlan,
  normalizeArray,
  normalizeText,
} from './learningPlannerTypes';

export const createEmptyLearningPlannerState = () => ({
  schemaVersion: 1,
  plansById: {},
  planOrder: [],
  activePlanId: '',
  auditLog: [],
});

const bounded = (items = [], limit = 40) => normalizeArray(items).slice(-limit);

const normalizePracticeAttempt = (attempt = {}) => ({
  attemptId: normalizeText(attempt.attemptId),
  learningRequestId: normalizeText(attempt.learningRequestId),
  learningPlanId: normalizeText(attempt.learningPlanId),
  trainingTaskId: normalizeText(attempt.trainingTaskId),
  skillId: normalizeText(attempt.skillId),
  runnerTaskId: normalizeText(attempt.runnerTaskId),
  runnerStepId: normalizeText(attempt.runnerStepId),
  executionIds: normalizeArray(attempt.executionIds).map(normalizeText).filter(Boolean).slice(-12),
  evidenceRefIds: normalizeArray(attempt.evidenceRefIds).map(normalizeText).filter(Boolean).slice(-40),
  status: normalizeText(attempt.status),
  reason: normalizeText(attempt.reason),
  validationReason: normalizeText(attempt.validationReason),
  createdAt: normalizeText(attempt.createdAt),
  updatedAt: normalizeText(attempt.updatedAt),
});

const normalizePlanRecord = (plan = {}) => {
  const normalized = createLearningPlan(plan);
  return {
    ...normalized,
    practiceAttempts: bounded(plan.practiceAttempts, 40)
      .map(normalizePracticeAttempt)
      .filter((attempt) => attempt.runnerTaskId),
    validation: plan.validation && typeof plan.validation === 'object'
      ? {
          ok: Boolean(plan.validation.ok),
          reason: normalizeText(plan.validation.reason),
          issues: bounded(plan.validation.issues, 40).map((issue) => ({
            path: normalizeText(issue.path),
            reason: normalizeText(issue.reason),
            message: normalizeText(issue.message || issue.reason),
          })),
        }
      : null,
  };
};

export const normalizeLearningPlannerState = (state = {}) => {
  const base = createEmptyLearningPlannerState();
  const source = state && typeof state === 'object' ? state : {};
  const plansById = {};
  const sourcePlans = source.plansById && typeof source.plansById === 'object'
    ? Object.values(source.plansById)
    : normalizeArray(source.plans);

  sourcePlans.forEach((plan) => {
    const normalized = normalizePlanRecord(plan);
    if (normalized.planId) {
      plansById[normalized.planId] = normalized;
    }
  });

  const planOrder = [
    ...normalizeArray(source.planOrder).map(normalizeText),
    ...Object.keys(plansById),
  ].filter((planId, index, all) => planId && plansById[planId] && all.indexOf(planId) === index)
    .slice(-LEARNING_PLAN_LIMITS.maxPlans);
  const retainedPlanIds = new Set(planOrder);
  Object.keys(plansById).forEach((planId) => {
    if (!retainedPlanIds.has(planId)) {
      delete plansById[planId];
    }
  });

  const activePlanId = plansById[normalizeText(source.activePlanId)] ? normalizeText(source.activePlanId) : '';

  return {
    ...base,
    ...source,
    schemaVersion: 1,
    plansById,
    planOrder,
    activePlanId,
    auditLog: bounded(source.auditLog, LEARNING_PLAN_LIMITS.maxAuditEvents).map((event) => ({
      id: normalizeText(event.id),
      timestamp: normalizeText(event.timestamp),
      type: normalizeText(event.type),
      planId: normalizeText(event.planId),
      reason: normalizeText(event.reason),
      summary: normalizeText(event.summary),
    })),
  };
};

export const canTransitionLearningPlanStatus = (fromStatus = LEARNING_PLAN_STATUS.DRAFT, toStatus = '') => {
  const from = normalizeText(fromStatus).toLowerCase() || LEARNING_PLAN_STATUS.DRAFT;
  const to = normalizeText(toStatus).toLowerCase();
  if (!LEARNING_PLAN_STATUSES.includes(from) || !LEARNING_PLAN_STATUSES.includes(to)) {
    return false;
  }
  if (from === to) {
    return true;
  }
  const transitions = {
    [LEARNING_PLAN_STATUS.DRAFT]: [
      LEARNING_PLAN_STATUS.VALIDATED,
      LEARNING_PLAN_STATUS.APPROVAL_REQUIRED,
      LEARNING_PLAN_STATUS.REJECTED,
      LEARNING_PLAN_STATUS.PLAN_FAILED,
      LEARNING_PLAN_STATUS.NEEDS_USER_REVIEW,
      LEARNING_PLAN_STATUS.CANCELLED,
    ],
    [LEARNING_PLAN_STATUS.VALIDATED]: [
      LEARNING_PLAN_STATUS.APPROVAL_REQUIRED,
      LEARNING_PLAN_STATUS.REJECTED,
      LEARNING_PLAN_STATUS.NEEDS_USER_REVIEW,
      LEARNING_PLAN_STATUS.CANCELLED,
    ],
    [LEARNING_PLAN_STATUS.APPROVAL_REQUIRED]: [
      LEARNING_PLAN_STATUS.VALIDATED,
      LEARNING_PLAN_STATUS.REJECTED,
      LEARNING_PLAN_STATUS.NEEDS_USER_REVIEW,
      LEARNING_PLAN_STATUS.CANCELLED,
    ],
    [LEARNING_PLAN_STATUS.REJECTED]: [],
    [LEARNING_PLAN_STATUS.PLAN_FAILED]: [],
    [LEARNING_PLAN_STATUS.CANCELLED]: [],
    [LEARNING_PLAN_STATUS.NEEDS_USER_REVIEW]: [
      LEARNING_PLAN_STATUS.VALIDATED,
      LEARNING_PLAN_STATUS.REJECTED,
    ],
  };
  return transitions[from]?.includes(to) || false;
};

export const transitionLearningPlanStatus = (
  state,
  planId,
  status,
  { now = new Date().toISOString(), reason = '' } = {},
) => {
  const normalizedState = normalizeLearningPlannerState(state);
  const targetPlan = normalizedState.plansById[normalizeText(planId)];
  const nextStatus = normalizeText(status).toLowerCase();
  if (!targetPlan || !LEARNING_PLAN_STATUSES.includes(nextStatus)) {
    return {
      ok: false,
      reason: 'learning_plan_not_found_or_invalid_status',
      state: normalizedState,
    };
  }
  if (!canTransitionLearningPlanStatus(targetPlan.status, nextStatus)) {
    return {
      ok: false,
      reason: 'invalid_learning_plan_status_transition',
      state: {
        ...normalizedState,
        auditLog: bounded([
          ...normalizedState.auditLog,
          {
            id: `learning-plan-transition-rejected-${Date.parse(now) || Date.now()}`,
            timestamp: now,
            type: 'state_transition_rejected',
            planId: targetPlan.planId,
            reason: reason || 'invalid_learning_plan_status_transition',
            summary: `${targetPlan.status} -> ${nextStatus}`,
          },
        ], LEARNING_PLAN_LIMITS.maxAuditEvents),
      },
    };
  }

  return {
    ok: true,
    reason: 'learning_plan_status_transitioned',
    state: normalizeLearningPlannerState({
      ...normalizedState,
      plansById: {
        ...normalizedState.plansById,
        [targetPlan.planId]: {
          ...targetPlan,
          status: nextStatus,
          updatedAt: now,
        },
      },
      auditLog: bounded([
        ...normalizedState.auditLog,
        {
          id: `learning-plan-transition-${Date.parse(now) || Date.now()}`,
          timestamp: now,
          type: 'state_transition',
          planId: targetPlan.planId,
          reason: reason || 'learning_plan_status_transitioned',
          summary: `${targetPlan.status} -> ${nextStatus}`,
        },
      ], LEARNING_PLAN_LIMITS.maxAuditEvents),
    }),
  };
};
