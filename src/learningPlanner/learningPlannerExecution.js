import {
  getAutonomousRunnerState,
  updateAutonomousRunnerState,
} from '../aliceMemory';
import { runAutonomousTaskRunnerTick } from '../autonomousTaskRunner';
import {
  RUNNER_TASK_STATUSES,
  normalizeAutonomousRunnerState,
} from '../autonomousRunnerState';
import {
  getLearningPlannerState,
  updateLearningPlannerState,
} from './learningPlannerRepository';
import { normalizeArray, normalizeText } from './learningPlannerTypes';
import {
  LEARNING_PLANNER_CREATED_BY,
  enqueueCompiledLearningPlanTasks,
} from './learningTaskCompiler';

export const LEARNING_PRACTICE_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  EVIDENCE_COLLECTED: 'evidence_collected',
  EXECUTION_FAILED: 'execution_failed',
  EVIDENCE_FAILED: 'evidence_failed',
  PRACTICE_SUCCESS: 'practice_success',
  NEEDS_USER_REVIEW: 'needs_user_review',
};

const LEARNING_PRACTICE_STATUSES = Object.values(LEARNING_PRACTICE_STATUS);

const normalizePracticeStatus = (status = LEARNING_PRACTICE_STATUS.QUEUED) => {
  const normalized = normalizeText(status).toLowerCase();
  return LEARNING_PRACTICE_STATUSES.includes(normalized) ? normalized : LEARNING_PRACTICE_STATUS.NEEDS_USER_REVIEW;
};

export const createLearningPracticeAttempt = (input = {}) => ({
  attemptId: normalizeText(input.attemptId) ||
    `learning-attempt-${normalizeText(input.learningPlanId)}-${normalizeText(input.runnerTaskId)}`,
  learningRequestId: normalizeText(input.learningRequestId),
  learningPlanId: normalizeText(input.learningPlanId),
  trainingTaskId: normalizeText(input.trainingTaskId),
  skillId: normalizeText(input.skillId),
  runnerTaskId: normalizeText(input.runnerTaskId),
  runnerStepId: normalizeText(input.runnerStepId),
  executionIds: normalizeArray(input.executionIds).map(normalizeText).filter(Boolean).slice(-12),
  evidenceRefIds: normalizeArray(input.evidenceRefIds).map(normalizeText).filter(Boolean).slice(-40),
  status: normalizePracticeStatus(input.status),
  reason: normalizeText(input.reason),
  validationReason: normalizeText(input.validationReason),
  createdAt: normalizeText(input.createdAt),
  updatedAt: normalizeText(input.updatedAt),
});

export const normalizeLearningPracticeAttempts = (attempts = []) =>
  normalizeArray(attempts).map(createLearningPracticeAttempt).filter((attempt) =>
    attempt.learningPlanId && attempt.runnerTaskId);

const upsertAttempt = (attempts = [], patch = {}) => {
  const nextAttempt = createLearningPracticeAttempt(patch);
  const filtered = normalizeLearningPracticeAttempts(attempts).filter((attempt) =>
    attempt.attemptId !== nextAttempt.attemptId &&
    attempt.runnerTaskId !== nextAttempt.runnerTaskId);
  return [...filtered, nextAttempt].slice(-40);
};

const evidenceRefIds = (refs = []) =>
  normalizeArray(refs).map((ref) => normalizeText(ref.id)).filter(Boolean);

const executionIds = (refs = []) => [
  ...new Set(normalizeArray(refs).map((ref) => normalizeText(ref.executionId)).filter(Boolean)),
];

const statusFromRunnerResult = (runnerResult = {}) => {
  const taskStatus = normalizeText(runnerResult.task?.status).toLowerCase();
  const validationPassed = runnerResult.validationResult?.passed === true;
  const evidenceOk = runnerResult.evidencePersistence?.ok === true && normalizeArray(runnerResult.evidenceRefs).length > 0;

  if (taskStatus === RUNNER_TASK_STATUSES.RUNNING) {
    return LEARNING_PRACTICE_STATUS.RUNNING;
  }
  if (evidenceOk && !validationPassed) {
    return LEARNING_PRACTICE_STATUS.EXECUTION_FAILED;
  }
  if (!evidenceOk && runnerResult.executed) {
    return LEARNING_PRACTICE_STATUS.EVIDENCE_FAILED;
  }
  if (taskStatus === RUNNER_TASK_STATUSES.FAILED || runnerResult.executionResult?.ok === false) {
    return LEARNING_PRACTICE_STATUS.EXECUTION_FAILED;
  }
  if (validationPassed && evidenceOk && taskStatus === RUNNER_TASK_STATUSES.DONE) {
    return LEARNING_PRACTICE_STATUS.PRACTICE_SUCCESS;
  }
  if (validationPassed && evidenceOk) {
    return LEARNING_PRACTICE_STATUS.EVIDENCE_COLLECTED;
  }
  return LEARNING_PRACTICE_STATUS.NEEDS_USER_REVIEW;
};

const auditEvent = ({ now, planId, type, reason, summary }) => ({
  id: `${type}-${Date.parse(now) || Date.now()}`,
  timestamp: now,
  type,
  planId,
  reason,
  summary,
});

const practiceStatusAuditEvents = ({ now, planId, taskId, finalStatus, reason, evidenceCollected, executed }) => {
  const statuses = executed ? [LEARNING_PRACTICE_STATUS.RUNNING] : [];
  if (evidenceCollected) {
    statuses.push(LEARNING_PRACTICE_STATUS.EVIDENCE_COLLECTED);
  }
  statuses.push(finalStatus);

  return statuses.map((status) => auditEvent({
    now,
    planId,
    type: 'learning_practice_status',
    reason,
    summary: `${taskId}: ${status}`,
  }));
};

export const enqueueLearningPlanPracticeTasks = (
  memory = {},
  planId = '',
  {
    now = new Date().toISOString(),
    ...compileOptions
  } = {},
) => {
  const state = getLearningPlannerState(memory);
  const targetPlan = state.plansById[normalizeText(planId)] ||
    state.plansById[state.activePlanId] ||
    state.plansById[state.planOrder.at(-1)];
  if (!targetPlan) {
    return { ok: false, reason: 'learning_plan_not_found', memory, taskIds: [] };
  }

  const enqueued = enqueueCompiledLearningPlanTasks(memory, targetPlan, { ...compileOptions, now });
  if (!enqueued.ok) {
    return enqueued;
  }

  const nextMemory = updateLearningPlannerState(enqueued.memory, (nextState) => {
    const currentPlan = nextState.plansById[targetPlan.planId];
    const attempts = enqueued.tasks.reduce((items, task) => upsertAttempt(items, {
      learningRequestId: task.metadata.learningRequestId,
      learningPlanId: task.metadata.learningPlanId,
      trainingTaskId: task.metadata.trainingTaskId,
      skillId: task.metadata.skillId,
      runnerTaskId: task.id,
      runnerStepId: task.steps[0]?.id,
      status: LEARNING_PRACTICE_STATUS.QUEUED,
      reason: 'learning_practice_queued',
      createdAt: now,
      updatedAt: now,
    }), currentPlan.practiceAttempts || []);

    return {
      ...nextState,
      plansById: {
        ...nextState.plansById,
        [targetPlan.planId]: {
          ...currentPlan,
          practiceAttempts: attempts,
          updatedAt: now,
        },
      },
      auditLog: [
        ...nextState.auditLog,
        auditEvent({
          now,
          planId: targetPlan.planId,
          type: 'learning_practice_queued',
          reason: 'runner_tasks_enqueued',
          summary: `Learning practice enfileirado: ${enqueued.taskIds.join(', ')}`,
        }),
      ].slice(-120),
    };
  }, { now });

  return {
    ...enqueued,
    memory: nextMemory,
  };
};

export const recordLearningPracticeRunnerResult = (
  memory = {},
  runnerResult = {},
  { now = new Date().toISOString() } = {},
) => {
  const task = runnerResult.task || {};
  if (task.metadata?.createdBy !== LEARNING_PLANNER_CREATED_BY || task.metadata?.taskType !== 'learning_practice') {
    return { ok: false, reason: 'runner_task_not_learning_practice', memory };
  }

  const planId = normalizeText(task.metadata.learningPlanId);
  const status = statusFromRunnerResult(runnerResult);
  const refs = normalizeArray(runnerResult.evidenceRefs);
  const evidenceCollected = runnerResult.evidencePersistence?.ok === true && refs.length > 0;
  const reason = runnerResult.evidencePersistence?.reason ||
    runnerResult.validationResult?.reason ||
    runnerResult.reason ||
    task.reason ||
    status;

  const nextMemory = updateLearningPlannerState(memory, (state) => {
    const plan = state.plansById[planId];
    if (!plan) {
      return state;
    }
    const attempts = upsertAttempt(plan.practiceAttempts || [], {
      learningRequestId: task.metadata.learningRequestId,
      learningPlanId: planId,
      trainingTaskId: task.metadata.trainingTaskId,
      skillId: task.metadata.skillId,
      runnerTaskId: task.id,
      runnerStepId: runnerResult.step?.id || task.steps?.[0]?.id,
      executionIds: executionIds(refs),
      evidenceRefIds: evidenceRefIds(refs),
      status,
      reason,
      validationReason: runnerResult.validationResult?.reason || '',
      createdAt: plan.practiceAttempts?.find((attempt) => attempt.runnerTaskId === task.id)?.createdAt || now,
      updatedAt: now,
    });

    return {
      ...state,
      plansById: {
        ...state.plansById,
        [planId]: {
          ...plan,
          practiceAttempts: attempts,
          updatedAt: now,
        },
      },
      auditLog: [
        ...state.auditLog,
        ...practiceStatusAuditEvents({
          now,
          planId,
          taskId: task.id,
          finalStatus: status,
          reason,
          evidenceCollected,
          executed: runnerResult.executed === true,
        }),
      ].slice(-120),
    };
  }, { now });

  return {
    ok: true,
    reason,
    status,
    memory: nextMemory,
  };
};

export const runLearningPlanPracticeRunnerTick = async ({
  memory = {},
  vmStatus = {},
  invokeTool = null,
  onRunnerStateChange = null,
  nowMs = Date.now(),
} = {}) => {
  const runnerResult = await runAutonomousTaskRunnerTick({
    runner: getAutonomousRunnerState(memory),
    vmStatus,
    invokeTool,
    onRunnerStateChange,
    nowMs,
  });
  const now = new Date(nowMs).toISOString();
  let nextMemory = updateAutonomousRunnerState(memory, runnerResult.runner, { now });

  if (runnerResult.task?.metadata?.createdBy === LEARNING_PLANNER_CREATED_BY) {
    const recorded = recordLearningPracticeRunnerResult(nextMemory, runnerResult, { now });
    nextMemory = recorded.memory;
    return {
      ...runnerResult,
      memory: nextMemory,
      learningPractice: recorded,
      runner: normalizeAutonomousRunnerState(runnerResult.runner),
    };
  }

  return {
    ...runnerResult,
    memory: nextMemory,
    learningPractice: null,
    runner: normalizeAutonomousRunnerState(runnerResult.runner),
  };
};
