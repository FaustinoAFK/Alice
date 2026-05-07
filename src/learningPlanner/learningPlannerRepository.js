import {
  LEARNING_PLAN_LIMITS,
  createLearningPlan,
  normalizeText,
} from './learningPlannerTypes';
import {
  normalizeLearningPlannerState,
  transitionLearningPlanStatus,
} from './learningPlannerState';

const getAutonomousLearning = (memory = {}) =>
  memory.autonomousLearning && typeof memory.autonomousLearning === 'object'
    ? memory.autonomousLearning
    : {};

export const getLearningPlannerState = (memory = {}) =>
  normalizeLearningPlannerState(getAutonomousLearning(memory).learningPlanner);

export const updateLearningPlannerState = (
  memory = {},
  patch,
  { now = new Date().toISOString() } = {},
) => {
  const currentState = getLearningPlannerState(memory);
  const nextState = normalizeLearningPlannerState(
    typeof patch === 'function' ? patch(currentState) : { ...currentState, ...(patch || {}) },
  );
  return {
    ...memory,
    autonomousLearning: {
      ...getAutonomousLearning(memory),
      learningPlanner: nextState,
    },
    bootstrapMeta: memory.bootstrapMeta
      ? {
          ...memory.bootstrapMeta,
          lastUpdatedAt: now,
          memoryRevision: Number(memory.bootstrapMeta.memoryRevision || 0) + 1,
        }
      : memory.bootstrapMeta,
  };
};

export const saveLearningPlanRecord = (
  memory = {},
  planInput = {},
  {
    validation = null,
    now = new Date().toISOString(),
  } = {},
) => {
  const plan = createLearningPlan({ ...planInput, updatedAt: now });
  const planRecord = {
    ...plan,
    validation,
  };
  return updateLearningPlannerState(memory, (state) => {
    const planOrder = [
      ...state.planOrder.filter((planId) => planId !== plan.planId),
      plan.planId,
    ].slice(-LEARNING_PLAN_LIMITS.maxPlans);
    const retained = new Set(planOrder);
    const plansById = {
      ...state.plansById,
      [plan.planId]: planRecord,
    };
    Object.keys(plansById).forEach((planId) => {
      if (!retained.has(planId)) {
        delete plansById[planId];
      }
    });
    return {
      ...state,
      plansById,
      planOrder,
      activePlanId: plan.planId,
      auditLog: [
        ...state.auditLog,
        {
          id: `learning-plan-saved-${Date.parse(now) || Date.now()}`,
          timestamp: now,
          type: 'learning_plan_saved',
          planId: plan.planId,
          reason: validation?.reason || 'learning_plan_record_saved',
          summary: plan.objective,
        },
      ].slice(-LEARNING_PLAN_LIMITS.maxAuditEvents),
    };
  }, { now });
};

export const setLearningPlanStatusInMemory = (
  memory = {},
  planId = '',
  status = '',
  { now = new Date().toISOString(), reason = '' } = {},
) => {
  const result = transitionLearningPlanStatus(getLearningPlannerState(memory), normalizeText(planId), status, {
    now,
    reason,
  });
  return {
    ...result,
    memory: updateLearningPlannerState(memory, result.state, { now }),
  };
};
