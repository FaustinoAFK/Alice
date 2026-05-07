import {
  getAutonomousLearningMemoryState,
  updateAutonomousLearningMemoryState,
} from '../aliceMemory';
import { createProcedureCandidate } from '../autonomousLearning/learning';
import { LEARNING_SKILL_EVALUATION_STATUS, evaluateLearningPlanFromMemory } from './learningEvaluator';
import { normalizeArray, normalizeText } from './learningPlannerTypes';

export const LEARNING_PROCEDURE_STATUS = {
  GUARDED: 'guarded',
  CANDIDATE: 'candidate',
};

const toSafeIdPart = (value = '', fallback = 'item') =>
  (normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || fallback)
    .slice(0, 80);

const uniqueTexts = (items = []) => {
  const seen = new Set();
  return normalizeArray(items)
    .map(normalizeText)
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

const skillTrainingTasks = (plan = {}, skill = {}) => {
  const taskIds = new Set(normalizeArray(skill.trainingTaskIds).map(normalizeText).filter(Boolean));
  const tasks = normalizeArray(plan.trainingTasks);
  const matched = taskIds.size > 0
    ? tasks.filter((task) => taskIds.has(normalizeText(task.taskId || task.id)))
    : [];
  return matched.length > 0 ? matched : tasks;
};

const triggerExamplesForSkill = (plan = {}, skill = {}) =>
  uniqueTexts([
    skill.title ? `Quando eu pedir: ${skill.title}` : '',
    plan.objective ? `Aprender ou executar: ${plan.objective}` : '',
    ...normalizeArray(skill.successCriteria).map((criterion) => `Validar: ${criterion}`),
  ]).slice(0, 8);

const stepsForSkill = (plan = {}, skill = {}) =>
  uniqueTexts(skillTrainingTasks(plan, skill).flatMap((task) => [
    task.actionSummary,
    task.objective,
    task.title,
  ])).slice(0, 20);

const validationCriteriaForSkill = (plan = {}, skill = {}) =>
  uniqueTexts([
    ...normalizeArray(plan.objectiveSuccessCriteria),
    ...normalizeArray(plan.validations),
    ...normalizeArray(skill.successCriteria),
  ]).slice(0, 20);

const successRateForEvaluation = (evaluation = {}) => {
  const successes = Number(evaluation.successfulAttempts || 0);
  const failures = Number(evaluation.failedAttempts || 0);
  const total = successes + failures;
  return total > 0 ? successes / total : 0;
};

export const synthesizeProcedureCandidateFromLearningSkill = ({
  plan = {},
  skill = {},
  evaluation = {},
  now = Date.now(),
  status = LEARNING_PROCEDURE_STATUS.GUARDED,
} = {}) => {
  if (evaluation.status !== LEARNING_SKILL_EVALUATION_STATUS.CONSOLIDATION_CANDIDATE) {
    return {
      ok: false,
      reason: 'skill_not_consolidation_candidate',
      candidate: null,
    };
  }

  const evidenceRefs = uniqueTexts(evaluation.validatedEvidenceRefIds);
  if (evidenceRefs.length === 0) {
    return {
      ok: false,
      reason: 'procedure_candidate_requires_evidence',
      candidate: null,
    };
  }

  const skillId = normalizeText(skill.skillId || skill.id || evaluation.skillId);
  const successRate = successRateForEvaluation(evaluation);
  const candidateId = `learning-procedure-${toSafeIdPart(plan.planId)}-${toSafeIdPart(skillId)}`;
  const title = normalizeText(skill.title) || normalizeText(plan.objective) || 'Procedimento aprendido';
  const summary = normalizeText(skill.description) ||
    `Procedimento candidato sintetizado do Learning Planner para ${title}.`;
  const triggerExamples = triggerExamplesForSkill(plan, skill);
  const requiredTools = uniqueTexts(skill.requiredTools).slice(0, 12);
  const steps = stepsForSkill(plan, skill);
  const validationCriteria = validationCriteriaForSkill(plan, skill);
  const guardedStatus = status === LEARNING_PROCEDURE_STATUS.CANDIDATE
    ? LEARNING_PROCEDURE_STATUS.CANDIDATE
    : LEARNING_PROCEDURE_STATUS.GUARDED;

  const baseCandidate = createProcedureCandidate({
    candidateId,
    title,
    summary,
    steps,
    source: 'learning_planner',
    confidence: Math.min(0.85, Math.max(0.2, successRate)),
    now,
  });

  return {
    ok: true,
    reason: 'learning_procedure_candidate_synthesized',
    candidate: {
      ...baseCandidate,
      procedureId: `procedure:${candidateId}`,
      name: title,
      status: guardedStatus,
      triggerExamples,
      requiredTools,
      validationCriteria,
      evidenceRefs,
      sourceLearningRequestId: normalizeText(plan.requestId),
      sourceLearningPlanId: normalizeText(plan.planId),
      sourceSkillId: skillId,
      successRate,
      successfulAttempts: Number(evaluation.successfulAttempts || 0),
      failedAttempts: Number(evaluation.failedAttempts || 0),
      metadata: {
        createdBy: 'learning_planner',
        learningRequestId: normalizeText(plan.requestId),
        learningPlanId: normalizeText(plan.planId),
        skillId,
      },
      updatedAt: now,
    },
  };
};

export const synthesizeProcedureCandidatesFromLearningPlan = ({
  plan = {},
  evaluation = {},
  now = Date.now(),
  status = LEARNING_PROCEDURE_STATUS.GUARDED,
} = {}) => {
  const evaluationsBySkillId = new Map(
    normalizeArray(evaluation.skills).map((item) => [normalizeText(item.skillId), item]),
  );
  const results = normalizeArray(plan.skills).map((skill) =>
    synthesizeProcedureCandidateFromLearningSkill({
      plan,
      skill,
      evaluation: evaluationsBySkillId.get(normalizeText(skill.skillId || skill.id)) || {},
      now,
      status,
    }));
  const candidates = results.filter((result) => result.ok).map((result) => result.candidate);

  return {
    ok: candidates.length > 0,
    reason: candidates.length > 0
      ? 'learning_procedure_candidates_synthesized'
      : 'no_consolidation_candidates',
    candidates,
    results,
  };
};

const mergeProcedureCandidates = (existing = [], incoming = []) => {
  const merged = new Map();
  [...normalizeArray(existing), ...normalizeArray(incoming)].forEach((candidate) => {
    const candidateId = normalizeText(candidate.candidateId || candidate.procedureId);
    if (candidateId) {
      merged.set(candidateId, candidate);
    }
  });
  return [...merged.values()].slice(-60);
};

export const synthesizeLearningProcedureCandidatesInMemory = (
  memory = {},
  planId = '',
  { now = Date.now(), status = LEARNING_PROCEDURE_STATUS.GUARDED } = {},
) => {
  const evaluation = evaluateLearningPlanFromMemory(memory, planId);
  if (!evaluation.ok) {
    return {
      ok: false,
      reason: evaluation.reason,
      memory,
      candidates: [],
      evaluation,
    };
  }

  const learning = getAutonomousLearningMemoryState(memory);
  const plan = learning.learningPlanner?.plansById?.[evaluation.planId];
  const synthesized = synthesizeProcedureCandidatesFromLearningPlan({
    plan,
    evaluation,
    now,
    status,
  });

  if (!synthesized.ok) {
    return {
      ...synthesized,
      memory,
      evaluation,
    };
  }

  const nextMemory = updateAutonomousLearningMemoryState(memory, (state) => ({
    ...state,
    procedureCandidates: mergeProcedureCandidates(state.procedureCandidates, synthesized.candidates),
    auditLog: [
      ...normalizeArray(state.auditLog),
      {
        id: `learning-procedure-synthesized-${now}`,
        timestamp: new Date(now).toISOString(),
        type: 'learning_procedure_candidate_synthesized',
        reason: synthesized.reason,
        summary: synthesized.candidates.map((candidate) => candidate.candidateId).join(', '),
        candidateIds: synthesized.candidates.map((candidate) => candidate.candidateId),
        planId: evaluation.planId,
      },
    ].slice(-1000),
  }), { now: new Date(now).toISOString() });

  return {
    ...synthesized,
    memory: nextMemory,
    evaluation,
  };
};
