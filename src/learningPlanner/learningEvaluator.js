import { getAutonomousRunnerState } from '../aliceMemory';
import { RUNNER_TASK_STATUSES, normalizeAutonomousRunnerState } from '../autonomousRunnerState';
import { getLearningPlannerState } from './learningPlannerRepository';
import { LEARNING_PRACTICE_STATUS } from './learningPlannerExecution';
import { normalizeArray, normalizeText } from './learningPlannerTypes';

export const LEARNING_SKILL_EVALUATION_STATUS = {
  NOT_STARTED: 'not_started',
  PRACTICING: 'practicing',
  PRACTICE_SUCCESS: 'practice_success',
  FAILED: 'failed',
  CONSOLIDATION_CANDIDATE: 'consolidation_candidate',
  NEEDS_USER_REVIEW: 'needs_user_review',
};

const SUCCESSFUL_ATTEMPTS_FOR_CONSOLIDATION = 2;
const FAILURES_BEFORE_REVIEW = 2;

const evidenceIdsFromRunnerTask = (task = {}) =>
  new Set([
    ...normalizeArray(task.evidenceRefs).map((ref) => normalizeText(ref.id || ref)),
    ...normalizeArray(task.steps).flatMap((step) =>
      normalizeArray(step.evidenceRefs).map((ref) => normalizeText(ref.id || ref))),
    ...normalizeArray(task.executionHistory).flatMap((entry) =>
      normalizeArray(entry.evidenceRefs).map((ref) => normalizeText(ref.id || ref))),
  ].filter(Boolean));

const latestValidationForAttempt = (task = {}, attempt = {}) => {
  const stepId = normalizeText(attempt.runnerStepId);
  const history = normalizeArray(task.executionHistory).filter((entry) =>
    !stepId || normalizeText(entry.stepId) === stepId);
  return history.at(-1)?.validation || null;
};

const hasValidatedEvidence = (attempt = {}, task = {}) => {
  const validation = latestValidationForAttempt(task, attempt);
  const runnerEvidenceIds = evidenceIdsFromRunnerTask(task);
  const attemptEvidenceIds = normalizeArray(attempt.evidenceRefIds).map(normalizeText).filter(Boolean);

  return Boolean(
    attempt.status === LEARNING_PRACTICE_STATUS.PRACTICE_SUCCESS &&
    task.status === RUNNER_TASK_STATUSES.DONE &&
    validation?.passed === true &&
    validation?.evidencePersistence?.ok === true &&
    attemptEvidenceIds.length > 0 &&
    attemptEvidenceIds.every((id) => runnerEvidenceIds.has(id)),
  );
};

const attemptFailureReason = (attempt = {}, task = {}) =>
  normalizeText(attempt.reason) ||
  normalizeText(attempt.validationReason) ||
  normalizeText(task.reason) ||
  latestValidationForAttempt(task, attempt)?.reason ||
  'learning_attempt_failed';

const attemptsForSkill = (plan = {}, skillId = '') =>
  normalizeArray(plan.practiceAttempts).filter((attempt) =>
    normalizeText(attempt.skillId) === normalizeText(skillId));

const runnerTaskForAttempt = (runner = {}, attempt = {}) =>
  runner.tasksById?.[normalizeText(attempt.runnerTaskId)] || null;

export const evaluateLearningSkill = ({
  plan = {},
  skill = {},
  runner = {},
} = {}) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const skillId = normalizeText(skill.skillId || skill.id);
  const attempts = attemptsForSkill(plan, skillId);

  if (attempts.length === 0) {
    return {
      skillId,
      status: LEARNING_SKILL_EVALUATION_STATUS.NOT_STARTED,
      reason: 'no_learning_practice_attempts',
      successfulAttempts: 0,
      failedAttempts: 0,
      validatedEvidenceRefIds: [],
      failureReasons: [],
    };
  }

  const validatedAttempts = [];
  const claimedSuccessWithoutEvidence = [];
  const failedAttempts = [];
  const activeAttempts = [];

  attempts.forEach((attempt) => {
    const task = runnerTaskForAttempt(normalizedRunner, attempt);
    if (hasValidatedEvidence(attempt, task || {})) {
      validatedAttempts.push({ attempt, task });
      return;
    }
    if (attempt.status === LEARNING_PRACTICE_STATUS.PRACTICE_SUCCESS) {
      claimedSuccessWithoutEvidence.push({ attempt, task });
      return;
    }
    if ([
      LEARNING_PRACTICE_STATUS.EXECUTION_FAILED,
      LEARNING_PRACTICE_STATUS.EVIDENCE_FAILED,
    ].includes(attempt.status)) {
      failedAttempts.push({ attempt, task });
      return;
    }
    if ([
      LEARNING_PRACTICE_STATUS.QUEUED,
      LEARNING_PRACTICE_STATUS.RUNNING,
      LEARNING_PRACTICE_STATUS.EVIDENCE_COLLECTED,
    ].includes(attempt.status)) {
      activeAttempts.push({ attempt, task });
    }
  });

  const failureReasons = failedAttempts.map(({ attempt, task }) =>
    attemptFailureReason(attempt, task || {}));
  const validatedEvidenceRefIds = [
    ...new Set(validatedAttempts.flatMap(({ attempt }) =>
      normalizeArray(attempt.evidenceRefIds).map(normalizeText).filter(Boolean))),
  ];

  if (failedAttempts.length >= FAILURES_BEFORE_REVIEW) {
    return {
      skillId,
      status: LEARNING_SKILL_EVALUATION_STATUS.NEEDS_USER_REVIEW,
      reason: 'repeated_learning_practice_failures',
      successfulAttempts: validatedAttempts.length,
      failedAttempts: failedAttempts.length,
      validatedEvidenceRefIds,
      failureReasons,
    };
  }

  if (claimedSuccessWithoutEvidence.length > 0) {
    return {
      skillId,
      status: LEARNING_SKILL_EVALUATION_STATUS.NEEDS_USER_REVIEW,
      reason: 'practice_success_missing_validated_evidence',
      successfulAttempts: validatedAttempts.length,
      failedAttempts: failedAttempts.length,
      validatedEvidenceRefIds,
      failureReasons,
    };
  }

  if (validatedAttempts.length >= SUCCESSFUL_ATTEMPTS_FOR_CONSOLIDATION) {
    return {
      skillId,
      status: LEARNING_SKILL_EVALUATION_STATUS.CONSOLIDATION_CANDIDATE,
      reason: 'minimum_validated_practice_successes_met',
      successfulAttempts: validatedAttempts.length,
      failedAttempts: failedAttempts.length,
      validatedEvidenceRefIds,
      failureReasons,
    };
  }

  if (validatedAttempts.length > 0) {
    return {
      skillId,
      status: LEARNING_SKILL_EVALUATION_STATUS.PRACTICE_SUCCESS,
      reason: 'additional_successful_attempt_required_for_consolidation',
      successfulAttempts: validatedAttempts.length,
      failedAttempts: failedAttempts.length,
      validatedEvidenceRefIds,
      failureReasons,
    };
  }

  if (activeAttempts.length > 0) {
    return {
      skillId,
      status: LEARNING_SKILL_EVALUATION_STATUS.PRACTICING,
      reason: 'learning_practice_in_progress',
      successfulAttempts: 0,
      failedAttempts: failedAttempts.length,
      validatedEvidenceRefIds,
      failureReasons,
    };
  }

  return {
    skillId,
    status: LEARNING_SKILL_EVALUATION_STATUS.FAILED,
    reason: failureReasons[0] || 'no_validated_successful_attempts',
    successfulAttempts: 0,
    failedAttempts: failedAttempts.length,
    validatedEvidenceRefIds,
    failureReasons,
  };
};

export const evaluateLearningPlanSkills = ({
  plan = {},
  runner = {},
} = {}) => ({
  planId: normalizeText(plan.planId),
  skills: normalizeArray(plan.skills).map((skill) =>
    evaluateLearningSkill({ plan, skill, runner })),
});

export const evaluateLearningPlanFromMemory = (
  memory = {},
  planId = '',
) => {
  const learningState = getLearningPlannerState(memory);
  const activePlanId = normalizeText(planId) || learningState.activePlanId || learningState.planOrder.at(-1);
  const plan = learningState.plansById[activePlanId] || null;
  if (!plan) {
    return {
      ok: false,
      reason: 'learning_plan_not_found',
      planId: activePlanId || '',
      skills: [],
    };
  }

  return {
    ok: true,
    reason: 'learning_plan_evaluated',
    ...evaluateLearningPlanSkills({
      plan,
      runner: getAutonomousRunnerState(memory),
    }),
  };
};
