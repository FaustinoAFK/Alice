import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import {
  createEmptyAliceMemory,
  getAutonomousLearningMemoryState,
  getAutonomousRunnerState,
  setAutonomousRunnerMemoryEnabled,
  updateAutonomousRunnerState,
} from '../aliceMemory';
import { buildDebugHudSnapshot } from '../debugHud';
import { verifySafeState } from '../dev/autonomousRunnerHarness';
import { buildRunnerEvidenceFromExecution } from '../autonomousRunnerEvidence';
import { checkTaskExecutable } from '../autonomousRunnerPreflight';
import { validateRunnerCompletionCriteria } from '../autonomousRunnerValidation';
import { AutonomousLearningHudPage } from '../hud/pages/AutonomousLearningHudPage';
import {
  LEARNING_PLAN_STATUS,
  LEARNING_PLANNER_SCHEMA_VERSION,
} from './learningPlannerTypes';
import { validateLearningPlanSchema } from './learningPlanSchema';
import { LearningPlannerClient } from './learningPlannerClient';
import { createFakeLearningPlannerModelAdapter } from './fakeLearningPlannerModelClient';
import { createLearningPlannerService } from './learningPlannerService';
import {
  LEARNING_PLAN_VALIDATION_DECISION,
  validateLearningPlanForExecution,
} from './learningPlanValidator';
import {
  compileLearningPlanToRunnerTasks,
  enqueueCompiledLearningPlanTasks,
} from './learningTaskCompiler';
import {
  LEARNING_PRACTICE_STATUS,
  enqueueLearningPlanPracticeTasks,
  runLearningPlanPracticeRunnerTick,
} from './learningPlannerExecution';
import {
  LEARNING_SKILL_EVALUATION_STATUS,
  evaluateLearningPlanSkills,
} from './learningEvaluator';
import {
  getLearningPlannerState,
  saveLearningPlanRecord,
  setLearningPlanStatusInMemory,
  updateLearningPlannerState,
} from './learningPlannerRepository';
import {
  canTransitionLearningPlanStatus,
  transitionLearningPlanStatus,
} from './learningPlannerState';
import {
  synthesizeLearningProcedureCandidatesInMemory,
  synthesizeProcedureCandidatesFromLearningPlan,
} from './learningProcedureSynthesizer';

const validPlan = (overrides = {}) => ({
  schemaVersion: LEARNING_PLANNER_SCHEMA_VERSION,
  planId: 'plan-browser-search',
  requestId: 'request-browser-search',
  objective: 'Aprender a pesquisar documentacao no navegador.',
  objectiveSuccessCriteria: ['Alice consegue abrir busca controlada e validar evidencia.'],
  skills: [
    {
      skillId: 'skill-browser-search',
      title: 'Pesquisar no navegador',
      description: 'Usar navegador em contexto controlado.',
      requiredTools: ['browser', 'runner_evidence'],
      successCriteria: ['Busca controlada validada por evidencia.'],
      trainingTaskIds: ['task-browser-search'],
      risk: { level: 'low', decision: 'valid' },
    },
  ],
  trainingTasks: [
    {
      taskId: 'task-browser-search',
      title: 'Executar busca controlada',
      objective: 'Abrir navegador e pesquisar texto controlado.',
      actionKind: 'visual',
      actionSummary: 'Abrir navegador em ambiente controlado.',
      expectedEvidence: [
        {
          evidenceId: 'evidence-validation',
          kind: 'validation_report',
          description: 'Relatorio de validacao do comportamento observado.',
        },
      ],
      risk: { level: 'low', decision: 'valid' },
    },
  ],
  validations: ['Validar evidencia antes de consolidar.'],
  expectedEvidence: [
    {
      evidenceId: 'evidence-validation',
      kind: 'validation_report',
      description: 'Relatorio de validacao do comportamento observado.',
    },
  ],
  blockedActions: ['Nao executar sem evidencia validada'],
  consolidationSuggestions: ['Consolidar apenas apos evidencia validada.'],
  risk: { level: 'low', decision: 'valid' },
  ...overrides,
});

const validModelResponse = (overrides = {}) => ({
  learningGoal: {
    title: 'Pesquisar documentacao',
    objective: 'Aprender a pesquisar documentacao no navegador.',
    successCriteria: ['Resultado validado por relatorio e evidencia persistida.'],
  },
  requiredSkills: [
    {
      skillId: 'skill-browser-search',
      title: 'Pesquisar no navegador',
      description: 'Usar navegador em contexto controlado.',
      requiredTools: ['browser', 'runner_evidence'],
      successCriteria: ['Busca controlada validada.'],
    },
  ],
  trainingTasks: [
    {
      taskId: 'task-browser-search',
      title: 'Executar busca controlada',
      objective: 'Abrir navegador e pesquisar texto controlado.',
      actionKind: 'visual',
      actionSummary: 'Abrir navegador em ambiente controlado.',
      expectedEvidence: [
        {
          evidenceId: 'evidence-validation',
          kind: 'validation_report',
          description: 'Relatorio de validacao do comportamento observado.',
          validationHint: 'Confirmar criterio funcional.',
        },
      ],
      risk: { level: 'low', decision: 'valid', reason: 'Ambiente controlado.', requiresApproval: false },
    },
  ],
  validations: [
    {
      validationId: 'validation-functional',
      criterion: 'A busca controlada foi validada com evidencia fisica.',
      evidenceIds: ['evidence-validation'],
    },
  ],
  expectedEvidence: [
    {
      evidenceId: 'evidence-validation',
      kind: 'validation_report',
      description: 'Relatorio de validacao persistido.',
      validationHint: 'Deve existir antes de consolidar.',
    },
  ],
  risks: [
    {
      riskId: 'risk-low',
      level: 'low',
      decision: 'valid',
      reason: 'Planejamento sem execucao.',
      requiresApproval: false,
    },
  ],
  approvalRequirements: [],
  blockedActions: [],
  consolidationSuggestions: ['Consolidar apenas apos evidencia validada.'],
  ...overrides,
});

const validExecutablePracticePlan = (overrides = {}) => validPlan({
  skills: [
    {
      ...validPlan().skills[0],
      requiredTools: ['runner_evidence', 'runner_evidence_validator'],
    },
  ],
  trainingTasks: [
    {
      ...validPlan().trainingTasks[0],
      actionKind: 'validation',
      actionSummary: 'Record controlled learning practice through the Runner.',
    },
  ],
  ...overrides,
});

const createRunnerInvoke = ({
  executionResult = {},
  saveResult = {},
  verifyResult = {},
  calls = [],
} = {}) => async (name, payload) => {
  calls.push([name, payload]);
  if (name === 'run_local_workspace_playground_task') {
    return {
      ok: true,
      message: 'practice executed',
      stdout: 'alice-learning-practice-ok',
      stderr: '',
      artifacts: { statusCode: 0, ...executionResult.artifacts },
      ...executionResult,
    };
  }
  if (name === 'save_runner_evidence') {
    return {
      ok: true,
      message: 'evidence saved',
      artifacts: { executionId: payload.request.executionId },
      ...saveResult,
    };
  }
  if (name === 'verify_runner_evidence') {
    return {
      ok: true,
      message: 'evidence verified',
      artifacts: {
        executionId: payload.request.executionId,
        status: 'ok',
        files: payload.request.files,
        existingFiles: payload.request.files,
        missingFiles: [],
      },
      ...verifyResult,
    };
  }
  return { ok: false, message: `unexpected tool ${name}` };
};

const learningAttempt = ({
  index = 1,
  status = LEARNING_PRACTICE_STATUS.PRACTICE_SUCCESS,
  skillId = 'skill-browser-search',
  reason = 'runner_task_validated',
  evidence = true,
} = {}) => ({
  attemptId: `attempt-${index}`,
  learningRequestId: 'request-browser-search',
  learningPlanId: 'plan-browser-search',
  trainingTaskId: 'task-browser-search',
  skillId,
  runnerTaskId: `runner-task-${index}`,
  runnerStepId: `runner-step-${index}`,
  executionIds: evidence ? [`runner-exec-${index}`] : [],
  evidenceRefIds: evidence ? [`evidence-${index}`] : [],
  status,
  reason,
  validationReason: reason,
  createdAt: `2026-05-04T01:0${index}:00.000Z`,
  updatedAt: `2026-05-04T01:0${index}:30.000Z`,
});

const runnerTaskForAttempt = (attempt, {
  status = 'done',
  validationPassed = true,
  evidencePersistenceOk = true,
} = {}) => ({
  id: attempt.runnerTaskId,
  title: `Runner ${attempt.runnerTaskId}`,
  status,
  steps: [
    {
      id: attempt.runnerStepId,
      title: 'Learning practice',
      status,
      evidenceRefs: attempt.evidenceRefIds.map((id) => ({
        id,
        executionId: attempt.executionIds[0] || '',
        taskId: attempt.runnerTaskId,
        stepId: attempt.runnerStepId,
        kind: 'validation',
      })),
    },
  ],
  evidenceRefs: attempt.evidenceRefIds.map((id) => ({
    id,
    executionId: attempt.executionIds[0] || '',
    taskId: attempt.runnerTaskId,
    stepId: attempt.runnerStepId,
    kind: 'validation',
  })),
  executionHistory: [
    {
      stepId: attempt.runnerStepId,
      status,
      validation: {
        passed: validationPassed,
        reason: validationPassed ? 'exit_code_matched' : 'exit_code_mismatch',
        evidencePersistence: { ok: evidencePersistenceOk },
      },
      evidenceRefs: attempt.evidenceRefIds.map((id) => ({
        id,
        executionId: attempt.executionIds[0] || '',
        taskId: attempt.runnerTaskId,
        stepId: attempt.runnerStepId,
        kind: 'validation',
      })),
    },
  ],
});

const runnerForAttempts = (attempts = [], overrides = {}) => ({
  enabled: true,
  runnerState: 'idle',
  tasksById: Object.fromEntries(attempts.map((attempt) => [
    attempt.runnerTaskId,
    runnerTaskForAttempt(attempt, overrides[attempt.runnerTaskId] || {}),
  ])),
  queue: [],
  evidenceRefs: attempts.flatMap((attempt) =>
    attempt.evidenceRefIds.map((id) => ({
      id,
      executionId: attempt.executionIds[0] || '',
      taskId: attempt.runnerTaskId,
      stepId: attempt.runnerStepId,
      kind: 'validation',
    }))),
});

const memoryWithConsolidationCandidate = () => {
  const attempts = [
    learningAttempt({ index: 1 }),
    learningAttempt({ index: 2 }),
  ];
  const plan = validExecutablePracticePlan({ practiceAttempts: attempts });
  const withPlanner = updateLearningPlannerState(createEmptyAliceMemory(), {
    activePlanId: plan.planId,
    planOrder: [plan.planId],
    plansById: {
      [plan.planId]: plan,
    },
  }, { now: '2026-05-04T02:00:00.000Z' });

  return updateAutonomousRunnerState(withPlanner, runnerForAttempts(attempts), {
    now: '2026-05-04T02:01:00.000Z',
  });
};

describe('Learning Planner schema validation', () => {
  it('accepts a minimal valid learning plan and normalizes it as validated', () => {
    const result = validateLearningPlanSchema(validPlan());

    expect(result.ok).toBe(true);
    expect(result.status).toBe(LEARNING_PLAN_STATUS.VALIDATED);
    expect(result.reason).toBe('learning_plan_valid');
    expect(result.plan.status).toBe(LEARNING_PLAN_STATUS.VALIDATED);
  });

  it('rejects a LearningPlan without objective success criteria', () => {
    const result = validateLearningPlanSchema(validPlan({ objectiveSuccessCriteria: [] }));

    expect(result.ok).toBe(false);
    expect(result.status).toBe(LEARNING_PLAN_STATUS.REJECTED);
    expect(result.issues.map((issue) => issue.reason)).toContain('objective_success_criteria_missing');
  });

  it('rejects a skill without required tools', () => {
    const plan = validPlan({
      skills: [
        {
          ...validPlan().skills[0],
          requiredTools: [],
        },
      ],
    });
    const result = validateLearningPlanSchema(plan);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.reason)).toContain('skill_required_tools_missing');
  });

  it('rejects a training task without expected evidence', () => {
    const plan = validPlan({
      trainingTasks: [
        {
          ...validPlan().trainingTasks[0],
          expectedEvidence: [],
        },
      ],
    });
    const result = validateLearningPlanSchema(plan);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.reason)).toContain('training_task_expected_evidence_missing');
  });

  it('marks unknown action kinds as approval_required instead of learned', () => {
    const plan = validPlan({
      trainingTasks: [
        {
          ...validPlan().trainingTasks[0],
          actionKind: 'plugin_install',
          risk: { level: 'high', decision: 'approval_required', requiresApproval: true },
        },
      ],
    });
    const result = validateLearningPlanSchema(plan);

    expect(result.ok).toBe(true);
    expect(result.status).toBe(LEARNING_PLAN_STATUS.APPROVAL_REQUIRED);
    expect(result.reason).toBe('learning_plan_approval_required');
    expect(result.plan.status).toBe(LEARNING_PLAN_STATUS.APPROVAL_REQUIRED);
  });

  it('rejects dangerous actions that are not explicitly approval_required or invalid', () => {
    const plan = validPlan({
      trainingTasks: [
        {
          ...validPlan().trainingTasks[0],
          actionKind: 'command',
          actionSummary: 'Run Remove-Item -Recurse on user files.',
          risk: { level: 'low', decision: 'valid' },
        },
      ],
    });
    const result = validateLearningPlanSchema(plan);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.reason)).toContain('dangerous_action_requires_rejection_or_approval');
  });

  it('keeps explicitly approved dangerous or unknown actions in approval_required state', () => {
    const plan = validPlan({
      trainingTasks: [
        {
          ...validPlan().trainingTasks[0],
          actionKind: 'unknown_system_change',
          actionSummary: 'Potentially destructive real_pc_write operation.',
          risk: { level: 'critical', decision: 'approval_required', requiresApproval: true },
        },
      ],
    });
    const result = validateLearningPlanSchema(plan);

    expect(result.ok).toBe(true);
    expect(result.status).toBe(LEARNING_PLAN_STATUS.APPROVAL_REQUIRED);
    expect(result.issues.map((issue) => issue.reason)).toContain('approval_required_for_unknown_or_high_risk_action');
  });
});

describe('Learning Planner state and repository', () => {
  it('saves compact planner records under autonomousLearning.learningPlanner', () => {
    const memory = {
      bootstrapMeta: { memoryRevision: 1, lastUpdatedAt: '' },
      autonomousLearning: { learningGoals: [] },
    };
    const validation = validateLearningPlanSchema(validPlan());
    const nextMemory = saveLearningPlanRecord(memory, validation.plan, {
      validation,
      now: '2026-05-03T20:00:00.000Z',
    });
    const state = getLearningPlannerState(nextMemory);

    expect(state.activePlanId).toBe('plan-browser-search');
    expect(state.plansById['plan-browser-search'].status).toBe(LEARNING_PLAN_STATUS.VALIDATED);
    expect(state.plansById['plan-browser-search'].validation.ok).toBe(true);
    expect(nextMemory.bootstrapMeta.memoryRevision).toBe(2);
  });

  it('allows only guarded state transitions and has no learned status', () => {
    expect(canTransitionLearningPlanStatus(LEARNING_PLAN_STATUS.DRAFT, LEARNING_PLAN_STATUS.VALIDATED)).toBe(true);
    expect(canTransitionLearningPlanStatus(LEARNING_PLAN_STATUS.REJECTED, LEARNING_PLAN_STATUS.VALIDATED)).toBe(false);

    const state = getLearningPlannerState(saveLearningPlanRecord({}, validPlan({ status: 'draft' })));
    const rejected = transitionLearningPlanStatus(state, 'plan-browser-search', 'learned');

    expect(rejected.ok).toBe(false);
    expect(rejected.reason).toBe('learning_plan_not_found_or_invalid_status');
  });

  it('updates plan status through the repository without marking it learned', () => {
    const memory = saveLearningPlanRecord({}, validPlan({ status: 'draft' }));
    const result = setLearningPlanStatusInMemory(memory, 'plan-browser-search', LEARNING_PLAN_STATUS.REJECTED, {
      now: '2026-05-03T20:01:00.000Z',
      reason: 'user_rejected_plan',
    });
    const state = getLearningPlannerState(result.memory);

    expect(result.ok).toBe(true);
    expect(state.plansById['plan-browser-search'].status).toBe(LEARNING_PLAN_STATUS.REJECTED);
    expect(Object.values(state.plansById).some((plan) => plan.status === 'learned')).toBe(false);
  });
});

describe('LearningPlannerClient model planning', () => {
  it('returns a validated LearningPlan from a valid structured response', async () => {
    const client = new LearningPlannerClient({
      modelAdapter: createFakeLearningPlannerModelAdapter({
        response: JSON.stringify(validModelResponse()),
        assertRequest: ({ prompt, responseFormat }) => {
          expect(prompt).toContain('only a planner, not an executor');
          expect(prompt).toContain('Do not call tools');
          expect(responseFormat.strict).toBe(true);
          expect(responseFormat.schema.required).toContain('learningGoal');
        },
      }),
      now: () => '2026-05-03T21:00:00.000Z',
    });

    const result = await client.createPlan({
      requestId: 'request-browser-search',
      objective: 'Aprender a pesquisar documentacao no navegador.',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(LEARNING_PLAN_STATUS.VALIDATED);
    expect(result.plan.planId).toBe('learning-plan-request-browser-search');
    expect(result.plan.validations).toContain('A busca controlada foi validada com evidencia fisica.');
    expect(result.plan.consolidationSuggestions).toContain('Consolidar apenas apos evidencia validada.');
  });

  it('does not crash on invalid JSON and returns plan_failed', async () => {
    const client = new LearningPlannerClient({
      modelAdapter: createFakeLearningPlannerModelAdapter({ response: '{ invalid json' }),
    });

    const result = await client.createPlan({ objective: 'Aprender algo seguro.' });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(LEARNING_PLAN_STATUS.PLAN_FAILED);
    expect(result.reason).toBe('model_response_invalid_json');
    expect(result.plan).toBeNull();
  });

  it('rejects invalid model schema without throwing', async () => {
    const client = new LearningPlannerClient({
      modelAdapter: createFakeLearningPlannerModelAdapter({
        response: { learningGoal: { objective: 'Sem campos obrigatorios.' } },
      }),
    });

    const result = await client.createPlan({ objective: 'Aprender algo seguro.' });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(LEARNING_PLAN_STATUS.PLAN_FAILED);
    expect(result.reason).toBe('model_response_schema_invalid');
    expect(result.validation.issues.map((issue) => issue.reason)).toContain('required_skills_missing');
  });

  it('fails safely when model response is missing validation criteria', async () => {
    const client = new LearningPlannerClient({
      modelAdapter: createFakeLearningPlannerModelAdapter({
        response: validModelResponse({ validations: [] }),
      }),
    });

    const result = await client.createPlan({ objective: 'Aprender algo seguro.' });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(LEARNING_PLAN_STATUS.PLAN_FAILED);
    expect(result.validation.issues.map((issue) => issue.reason)).toContain('validation_criteria_missing');
  });

  it('returns needs_user_review for dangerous actions explicitly requiring approval', async () => {
    const client = new LearningPlannerClient({
      modelAdapter: createFakeLearningPlannerModelAdapter({
        response: validModelResponse({
          trainingTasks: [
            {
              ...validModelResponse().trainingTasks[0],
              actionKind: 'command',
              actionSummary: 'Probe a real_pc_write action that may modify user files.',
              risk: {
                level: 'critical',
                decision: 'approval_required',
                reason: 'Potential real PC write.',
                requiresApproval: true,
              },
            },
          ],
          risks: [
            {
              riskId: 'risk-real-pc-write',
              level: 'critical',
              decision: 'approval_required',
              reason: 'Potential real PC write.',
              requiresApproval: true,
            },
          ],
          approvalRequirements: ['User approval is required before any execution phase.'],
          blockedActions: ['Do not write to the real PC in planning phase.'],
        }),
      }),
    });

    const result = await client.createPlan({ objective: 'Aprender a alterar arquivos reais.' });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(LEARNING_PLAN_STATUS.NEEDS_USER_REVIEW);
    expect(result.plan.status).toBe(LEARNING_PLAN_STATUS.NEEDS_USER_REVIEW);
    expect(result.plan.approvalRequirements).toContain('User approval is required before any execution phase.');
  });

  it('returns plan_failed on model timeout or failure', async () => {
    const timeout = new Error('request timed out');
    timeout.name = 'TimeoutError';
    const client = new LearningPlannerClient({
      modelAdapter: createFakeLearningPlannerModelAdapter({ error: timeout }),
    });

    const result = await client.createPlan({ objective: 'Aprender algo seguro.' });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(LEARNING_PLAN_STATUS.PLAN_FAILED);
    expect(result.reason).toBe('learning_planner_model_timeout');
  });
});

describe('LearningPlannerService HUD integration boundary', () => {
  it('creates and persists a plan without Runner integration', async () => {
    const service = createLearningPlannerService({
      modelAdapter: createFakeLearningPlannerModelAdapter({ response: validModelResponse() }),
      now: () => '2026-05-03T22:00:00.000Z',
    });

    const result = await service.createPlan({}, 'Aprender a pesquisar documentacao.');

    expect(result.ok).toBe(true);
    expect(result.memory.autonomousLearning.learningPlanner.activePlanId).toBe(result.plan.planId);
    expect(result.memory.autonomousRunner).toBeUndefined();
  });

  it('persists invalid model output as a blocked failed plan for HUD review', async () => {
    const service = createLearningPlannerService({
      modelAdapter: createFakeLearningPlannerModelAdapter({ response: '{ invalid json' }),
      now: () => '2026-05-03T22:01:00.000Z',
    });

    const result = await service.createPlan({}, 'Aprender algo.');
    const state = result.memory.autonomousLearning.learningPlanner;
    const activePlan = state.plansById[state.activePlanId];

    expect(result.ok).toBe(false);
    expect(activePlan.status).toBe(LEARNING_PLAN_STATUS.PLAN_FAILED);
    expect(activePlan.blockedActions).toContain('Nao executar plano invalido');
    expect(activePlan.validation.reason).toBe('model_response_invalid_json');
  });

  it('supports cancel and mark-for-review actions on the active plan', async () => {
    const service = createLearningPlannerService({
      modelAdapter: createFakeLearningPlannerModelAdapter({ response: validModelResponse() }),
      now: () => '2026-05-03T22:02:00.000Z',
    });

    const created = await service.createPlan({}, 'Aprender a pesquisar documentacao.');
    const review = service.markActivePlanForReview(created.memory);
    const reviewedState = review.memory.autonomousLearning.learningPlanner;
    const reviewedPlan = reviewedState.plansById[reviewedState.activePlanId];

    expect(review.ok).toBe(true);
    expect(reviewedPlan.status).toBe(LEARNING_PLAN_STATUS.NEEDS_USER_REVIEW);

    const cancelled = service.cancelActivePlan(created.memory);
    const cancelledState = cancelled.memory.autonomousLearning.learningPlanner;
    const cancelledPlan = cancelledState.plansById[cancelledState.activePlanId];

    expect(cancelled.ok).toBe(true);
    expect(cancelledPlan.status).toBe(LEARNING_PLAN_STATUS.CANCELLED);
  });

  it('supports explicit HUD approval and rejection without executing Runner tasks', async () => {
    const service = createLearningPlannerService({
      modelAdapter: createFakeLearningPlannerModelAdapter({ response: validModelResponse() }),
      now: () => '2026-05-03T22:03:00.000Z',
    });

    const created = await service.createPlan({}, 'Aprender a pesquisar documentacao.');
    const review = service.markActivePlanForReview(created.memory);
    const approved = service.approveActivePlan(review.memory);
    const approvedState = approved.memory.autonomousLearning.learningPlanner;
    const approvedPlan = approvedState.plansById[approvedState.activePlanId];

    expect(approved.ok).toBe(true);
    expect(approvedPlan.status).toBe(LEARNING_PLAN_STATUS.VALIDATED);
    expect(approved.memory.autonomousRunner).toBeUndefined();

    const rejected = service.rejectActivePlan(created.memory);
    const rejectedState = rejected.memory.autonomousLearning.learningPlanner;
    const rejectedPlan = rejectedState.plansById[rejectedState.activePlanId];

    expect(rejected.ok).toBe(true);
    expect(rejectedPlan.status).toBe(LEARNING_PLAN_STATUS.REJECTED);
  });

  it('does not approve a blocked plan from the HUD', () => {
    const service = createLearningPlannerService({
      now: () => '2026-05-03T22:04:00.000Z',
    });
    const saved = saveLearningPlanRecord({}, validPlan({
      planId: 'blocked-plan',
      expectedEvidence: [],
      trainingTasks: [
        {
          ...validPlan().trainingTasks[0],
          expectedEvidence: [],
        },
      ],
    }));

    const result = service.approveActivePlan(saved);
    const state = result.memory.autonomousLearning.learningPlanner;

    expect(result.ok).toBe(false);
    expect(result.status).toBe(LEARNING_PLAN_VALIDATION_DECISION.BLOCKED);
    expect(state.plansById[state.activePlanId].status)
      .toBe(saved.autonomousLearning.learningPlanner.plansById['blocked-plan'].status);
  });
});

describe('LearningPlanValidator pre-execution classification', () => {
  it('approves a safe plan', () => {
    const result = validateLearningPlanForExecution(validPlan());

    expect(result.findings).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.decision).toBe(LEARNING_PLAN_VALIDATION_DECISION.APPROVED);
  });

  it('blocks a plan without expected evidence', () => {
    const result = validateLearningPlanForExecution(validPlan({
      expectedEvidence: [],
      trainingTasks: [
        {
          ...validPlan().trainingTasks[0],
          expectedEvidence: [],
        },
      ],
    }));

    expect(result.decision).toBe(LEARNING_PLAN_VALIDATION_DECISION.BLOCKED);
    expect(result.findings.map((finding) => finding.reason)).toContain('expected_evidence_missing');
  });

  it('blocks destructive filesystem commands', () => {
    const result = validateLearningPlanForExecution(validPlan({
      trainingTasks: [
        {
          ...validPlan().trainingTasks[0],
          actionKind: 'command',
          actionSummary: 'Run rm -rf C:\\Users\\alice\\Documents',
        },
      ],
    }));

    expect(result.decision).toBe(LEARNING_PLAN_VALIDATION_DECISION.BLOCKED);
    expect(result.findings.map((finding) => finding.reason)).toContain('destructive_filesystem_action_blocked');
  });

  it('marks login/account actions as approval_required', () => {
    const result = validateLearningPlanForExecution(validPlan({
      trainingTasks: [
        {
          ...validPlan().trainingTasks[0],
          actionSummary: 'Open login page and enter account credentials.',
        },
      ],
    }));

    expect(result.decision).toBe(LEARNING_PLAN_VALIDATION_DECISION.APPROVAL_REQUIRED);
    expect(result.findings.map((finding) => finding.reason)).toContain('login_or_account_action_requires_approval');
  });

  it.each([
    ['installing software', 'Install a browser extension with npm install.', 'software_install_requires_approval'],
    ['sending messages', 'Send email with the learning result.', 'message_or_email_requires_approval'],
    ['payments', 'Open checkout and submit payment details.', 'purchase_or_payment_requires_approval'],
  ])('marks %s actions as approval_required', (_label, actionSummary, reason) => {
    const result = validateLearningPlanForExecution(validPlan({
      trainingTasks: [
        {
          ...validPlan().trainingTasks[0],
          actionSummary,
        },
      ],
    }));

    expect(result.decision).toBe(LEARNING_PLAN_VALIDATION_DECISION.APPROVAL_REQUIRED);
    expect(result.findings.map((finding) => finding.reason)).toContain(reason);
  });

  it('marks plans with missing required tools as needs_user_review', () => {
    const result = validateLearningPlanForExecution(validPlan({
      skills: [
        {
          ...validPlan().skills[0],
          requiredTools: [],
        },
      ],
    }));

    expect(result.decision).toBe(LEARNING_PLAN_VALIDATION_DECISION.NEEDS_USER_REVIEW);
    expect(result.findings.map((finding) => finding.reason)).toContain('required_tools_missing');
  });

  it('blocks plans that require unavailable tools', () => {
    const result = validateLearningPlanForExecution(validPlan({
      skills: [
        {
          ...validPlan().skills[0],
          requiredTools: ['browser', 'root_shell'],
        },
      ],
    }));

    expect(result.decision).toBe(LEARNING_PLAN_VALIDATION_DECISION.BLOCKED);
    expect(result.findings.map((finding) => finding.reason)).toContain('required_tools_unavailable');
  });

  it('blocks plans attempting to bypass the Autonomous Task Runner', () => {
    const result = validateLearningPlanForExecution(validPlan({
      trainingTasks: [
        {
          ...validPlan().trainingTasks[0],
          actionSummary: 'Execute directly with run_local_vm and bypass runner.',
        },
      ],
    }));

    expect(result.decision).toBe(LEARNING_PLAN_VALIDATION_DECISION.BLOCKED);
    expect(result.findings.map((finding) => finding.reason)).toContain('autonomous_runner_bypass_blocked');
  });

  it('blocks plans that directly mark a skill as learned', () => {
    const result = validateLearningPlanForExecution(validPlan({
      consolidationSuggestions: ['Mark learned immediately without evidence.'],
    }));

    expect(result.decision).toBe(LEARNING_PLAN_VALIDATION_DECISION.BLOCKED);
    expect(result.findings.map((finding) => finding.reason)).toContain('direct_learned_status_blocked');
  });
});

describe('Learning TaskCompiler Runner integration boundary', () => {
  it('compiles an approved plan into a Runner task', () => {
    const result = compileLearningPlanToRunnerTasks(validPlan());

    expect(result.ok).toBe(true);
    expect(result.decision).toBe(LEARNING_PLAN_VALIDATION_DECISION.APPROVED);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({
      id: 'learning-plan-plan-browser-search-task-browser-search',
      title: 'Aprender: Executar busca controlada',
      status: 'ready',
      steps: [
        {
          completionCriteria: { type: 'visual_state' },
          expectedEvidence: { kind: 'visual' },
        },
      ],
    });
  });

  it('does not compile blocked plans', () => {
    const result = compileLearningPlanToRunnerTasks(validPlan({
      expectedEvidence: [],
      trainingTasks: [
        {
          ...validPlan().trainingTasks[0],
          expectedEvidence: [],
        },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.decision).toBe(LEARNING_PLAN_VALIDATION_DECISION.BLOCKED);
    expect(result.tasks).toEqual([]);
  });

  it('does not compile approval_required plans without approval', () => {
    const result = compileLearningPlanToRunnerTasks(validPlan({
      trainingTasks: [
        {
          ...validPlan().trainingTasks[0],
          actionSummary: 'Open login page and enter account credentials.',
        },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.decision).toBe(LEARNING_PLAN_VALIDATION_DECISION.APPROVAL_REQUIRED);
    expect(result.tasks).toEqual([]);
  });

  it('includes evidence requirements in compiled Runner tasks', () => {
    const result = compileLearningPlanToRunnerTasks(validPlan());
    const step = result.tasks[0].steps[0];

    expect(step.expectedEvidence.required).toEqual(expect.arrayContaining([
      'validationResult',
      'metadata',
    ]));
    expect(result.tasks[0].plan.validationReport.expectedEvidence[0]).toMatchObject({
      evidenceId: 'evidence-validation',
      kind: 'validation_report',
    });
  });

  it('includes learning metadata on compiled Runner tasks', () => {
    const result = compileLearningPlanToRunnerTasks(validPlan({
      testScenario: 'learning-browser-search-smoke',
    }), {
      now: '2026-05-03T23:00:00.000Z',
    });
    const task = result.tasks[0];

    expect(task.metadata).toMatchObject({
      createdBy: 'learning_planner',
      learningRequestId: 'request-browser-search',
      learningPlanId: 'plan-browser-search',
      trainingTaskId: 'task-browser-search',
      skillId: 'skill-browser-search',
      testScenario: 'learning-browser-search-smoke',
      createdAt: '2026-05-03T23:00:00.000Z',
    });
    expect(task.requestedResources.learningPlanner).toMatchObject({
      learningRequestId: 'request-browser-search',
      learningPlanId: 'plan-browser-search',
      skillId: 'skill-browser-search',
    });
  });

  it('enqueues compiled tasks through the existing Runner state schema', () => {
    const result = enqueueCompiledLearningPlanTasks(createEmptyAliceMemory(), validPlan(), {
      now: '2026-05-03T23:01:00.000Z',
    });
    const runner = getAutonomousRunnerState(result.memory);
    const task = runner.tasksById[result.taskIds[0]];

    expect(result.ok).toBe(true);
    expect(runner.queue).toEqual(result.taskIds);
    expect(task.status).toBe('ready');
    expect(task.metadata.createdBy).toBe('learning_planner');
    expect(task.steps[0].completionCriteria.type).toBe('visual_state');
    expect(task.steps[0].expectedEvidence.required).toContain('validationResult');
    expect(runner.audits.at(-1)).toMatchObject({
      type: 'task_enqueued',
      taskId: task.id,
    });
  });

  it('compiles create_folder learning tasks with safe filesystemName and auditable folder evidence', () => {
    const plan = validPlan({
      objective: 'Aprender a criar uma pasta controlada.',
      skills: [
        {
          ...validPlan().skills[0],
          skillId: 'skill-create-folder',
          requiredTools: ['runner_evidence'],
          trainingTaskIds: ['task-create-folder'],
        },
      ],
      trainingTasks: [
        {
          taskId: 'task-create-folder',
          title: 'Criar pasta solicitada',
          objective: 'Criar pasta com nome vindo do pedido.',
          actionKind: 'create_folder',
          actionSummary: 'Criar pasta no workspace controlado pelo Runner.',
          folder: { displayName: 'teste/pasta' },
          expectedEvidence: [
            {
              evidenceId: 'evidence-folder',
              kind: 'validation_report',
              description: 'Relatorio com nome original, nome sanitizado e existencia fisica.',
            },
          ],
          risk: { level: 'low', decision: 'valid' },
        },
      ],
      expectedEvidence: [
        {
          evidenceId: 'evidence-folder',
          kind: 'validation_report',
          description: 'Relatorio de pasta criada.',
        },
      ],
    });

    const result = compileLearningPlanToRunnerTasks(plan);
    const task = result.tasks[0];
    const step = task.steps[0];

    expect(result.ok).toBe(true);
    expect(step.action.folderCreate).toMatchObject({
      displayName: 'teste/pasta',
      originalRequestedName: 'teste/pasta',
      filesystemName: 'teste-pasta',
      targetPath: 'output/teste-pasta',
      sanitizationWarnings: expect.arrayContaining(['invalid_characters_replaced']),
    });
    expect(step.action.requestedResources.learningPlanner.folder).toMatchObject({
      displayName: 'teste/pasta',
      filesystemName: 'teste-pasta',
      targetPath: 'output/teste-pasta',
    });
    expect(checkTaskExecutable(task).ok).toBe(true);

    const executionResult = {
      ok: true,
      stdout: JSON.stringify({
        originalRequestedName: 'teste/pasta',
        resolvedFilesystemName: 'teste-pasta',
        targetPath: 'output/teste-pasta',
        sanitizationWarnings: ['invalid_characters_replaced'],
        folderExists: true,
        validation: { passed: true, reason: 'folder_exists' },
      }),
      stderr: '',
      artifacts: {
        statusCode: 0,
        files: ['output/teste-pasta/.alice-folder-created.json'],
      },
    };
    const preliminaryEvidence = buildRunnerEvidenceFromExecution({
      task,
      step,
      executionResult,
      executionId: 'runner-exec-folder-test',
    });
    const validation = validateRunnerCompletionCriteria({
      step,
      executionResult,
      evidenceRefs: preliminaryEvidence,
    });
    const finalEvidence = buildRunnerEvidenceFromExecution({
      task,
      step,
      executionResult,
      executionId: 'runner-exec-folder-test',
      validationResult: validation,
    });

    expect(validation.passed).toBe(true);
    expect(validation.folderValidation).toMatchObject({
      originalRequestedName: 'teste/pasta',
      resolvedFilesystemName: 'teste-pasta',
      targetPath: 'output/teste-pasta',
      folderExists: true,
    });
    expect(finalEvidence.find((ref) => ref.label === 'metadata').metadata.folderResolution).toMatchObject({
      originalRequestedName: 'teste/pasta',
      filesystemName: 'teste-pasta',
      targetPath: 'output/teste-pasta',
    });
    expect(finalEvidence.find((ref) => ref.label === 'validation').metadata.folderValidation).toMatchObject({
      originalRequestedName: 'teste/pasta',
      resolvedFilesystemName: 'teste-pasta',
      folderExists: true,
    });
  });
});

describe('Learning Planner execution through Autonomous Task Runner', () => {
  const prepareLearningPracticeMemory = (plan = validExecutablePracticePlan()) => {
    const saved = saveLearningPlanRecord(createEmptyAliceMemory(), plan, {
      now: '2026-05-04T00:00:00.000Z',
    });
    const queued = enqueueLearningPlanPracticeTasks(saved, plan.planId, {
      now: '2026-05-04T00:01:00.000Z',
    });
    const enabledMemory = setAutonomousRunnerMemoryEnabled(queued.memory, true, {
      now: '2026-05-04T00:01:01.000Z',
      reason: 'learning_practice_test',
    });

    return { ...queued, memory: enabledMemory };
  };

  const getLatestAttempt = (memory) => {
    const state = getLearningPlannerState(memory);
    const plan = state.plansById[state.activePlanId];
    return plan.practiceAttempts.at(-1);
  };

  it('successful Runner task updates learning attempt', async () => {
    const queued = prepareLearningPracticeMemory();
    const result = await runLearningPlanPracticeRunnerTick({
      memory: queued.memory,
      invokeTool: createRunnerInvoke(),
      vmStatus: { fallbackWorkspaceAvailable: true },
      nowMs: Date.parse('2026-05-04T00:02:00.000Z'),
    });
    const attempt = getLatestAttempt(result.memory);
    const runner = getAutonomousRunnerState(result.memory);

    expect(result.executed).toBe(true);
    expect(attempt.status).toBe(LEARNING_PRACTICE_STATUS.PRACTICE_SUCCESS);
    expect(attempt.runnerTaskId).toBe(queued.taskIds[0]);
    expect(attempt.executionIds).toHaveLength(1);
    expect(attempt.evidenceRefIds.length).toBeGreaterThan(0);
    expect(runner.tasksById[queued.taskIds[0]].status).toBe('done');
  });

  it('failed Runner task updates learning attempt as failed', async () => {
    const queued = prepareLearningPracticeMemory();
    const result = await runLearningPlanPracticeRunnerTick({
      memory: queued.memory,
      invokeTool: createRunnerInvoke({
        executionResult: {
          ok: false,
          message: 'practice failed',
          stderr: 'failure',
          artifacts: { statusCode: 1 },
        },
      }),
      vmStatus: { fallbackWorkspaceAvailable: true },
      nowMs: Date.parse('2026-05-04T00:03:00.000Z'),
    });
    const attempt = getLatestAttempt(result.memory);

    expect(attempt.status).toBe(LEARNING_PRACTICE_STATUS.EXECUTION_FAILED);
    expect(attempt.validationReason).toBe('exit_code_mismatch');
    expect(getAutonomousRunnerState(result.memory).tasksById[queued.taskIds[0]].status).toBe('failed');
  });

  it('missing evidence prevents success', async () => {
    const queued = prepareLearningPracticeMemory();
    const result = await runLearningPlanPracticeRunnerTick({
      memory: queued.memory,
      invokeTool: createRunnerInvoke({
        saveResult: {
          ok: false,
          message: 'evidence unavailable',
        },
      }),
      vmStatus: { fallbackWorkspaceAvailable: true },
      nowMs: Date.parse('2026-05-04T00:04:00.000Z'),
    });
    const attempt = getLatestAttempt(result.memory);

    expect(attempt.status).toBe(LEARNING_PRACTICE_STATUS.EVIDENCE_FAILED);
    expect(attempt.status).not.toBe(LEARNING_PRACTICE_STATUS.PRACTICE_SUCCESS);
  });

  it('validation failure prevents success', async () => {
    const queued = prepareLearningPracticeMemory();
    const result = await runLearningPlanPracticeRunnerTick({
      memory: queued.memory,
      invokeTool: createRunnerInvoke({
        executionResult: {
          ok: true,
          message: 'bad validation',
          artifacts: { statusCode: 2 },
        },
      }),
      vmStatus: { fallbackWorkspaceAvailable: true },
      nowMs: Date.parse('2026-05-04T00:05:00.000Z'),
    });
    const attempt = getLatestAttempt(result.memory);

    expect(attempt.status).toBe(LEARNING_PRACTICE_STATUS.EXECUTION_FAILED);
    expect(attempt.validationReason).toBe('exit_code_mismatch');
    expect(attempt.status).not.toBe(LEARNING_PRACTICE_STATUS.PRACTICE_SUCCESS);
  });

  it('no lock is left running after failure', async () => {
    const queued = prepareLearningPracticeMemory();
    const result = await runLearningPlanPracticeRunnerTick({
      memory: queued.memory,
      invokeTool: createRunnerInvoke({
        executionResult: {
          ok: false,
          message: 'practice failed',
          artifacts: { statusCode: 1 },
        },
      }),
      vmStatus: { fallbackWorkspaceAvailable: true },
      nowMs: Date.parse('2026-05-04T00:06:00.000Z'),
    });
    const runner = getAutonomousRunnerState(result.memory);
    const task = runner.tasksById[queued.taskIds[0]];

    expect(runner.runnerLock).toBeNull();
    expect(runner.activeTaskId).toBeNull();
    expect(task.leaseId).toBeNull();
    expect(task.steps.some((step) => step.status === 'running')).toBe(false);
  });

  it('safe state verification still passes', async () => {
    const queued = prepareLearningPracticeMemory();
    const result = await runLearningPlanPracticeRunnerTick({
      memory: queued.memory,
      invokeTool: createRunnerInvoke(),
      vmStatus: { fallbackWorkspaceAvailable: true },
      nowMs: Date.parse('2026-05-04T00:07:00.000Z'),
    });
    const safeState = verifySafeState(result.memory);

    expect(safeState.ok).toBe(true);
    expect(safeState.issues).toEqual([]);
  });
});

describe('LearningEvaluator evidence-based skill evaluation', () => {
  it('keeps one success below consolidation_candidate', () => {
    const attempt = learningAttempt({ index: 1 });
    const evaluation = evaluateLearningPlanSkills({
      plan: validExecutablePracticePlan({ practiceAttempts: [attempt] }),
      runner: runnerForAttempts([attempt]),
    });

    expect(evaluation.skills[0]).toMatchObject({
      skillId: 'skill-browser-search',
      status: LEARNING_SKILL_EVALUATION_STATUS.PRACTICE_SUCCESS,
      reason: 'additional_successful_attempt_required_for_consolidation',
      successfulAttempts: 1,
    });
    expect(evaluation.skills[0].status).not.toBe(LEARNING_SKILL_EVALUATION_STATUS.CONSOLIDATION_CANDIDATE);
  });

  it('creates consolidation_candidate after two validated successes', () => {
    const attempts = [
      learningAttempt({ index: 1 }),
      learningAttempt({ index: 2 }),
    ];
    const evaluation = evaluateLearningPlanSkills({
      plan: validExecutablePracticePlan({ practiceAttempts: attempts }),
      runner: runnerForAttempts(attempts),
    });

    expect(evaluation.skills[0]).toMatchObject({
      status: LEARNING_SKILL_EVALUATION_STATUS.CONSOLIDATION_CANDIDATE,
      reason: 'minimum_validated_practice_successes_met',
      successfulAttempts: 2,
    });
    expect(evaluation.skills[0].validatedEvidenceRefIds).toEqual(['evidence-1', 'evidence-2']);
  });

  it('blocks consolidation when successful attempts are missing evidence', () => {
    const attempts = [
      learningAttempt({ index: 1 }),
      learningAttempt({ index: 2, evidence: false }),
    ];
    const evaluation = evaluateLearningPlanSkills({
      plan: validExecutablePracticePlan({ practiceAttempts: attempts }),
      runner: runnerForAttempts(attempts),
    });

    expect(evaluation.skills[0]).toMatchObject({
      status: LEARNING_SKILL_EVALUATION_STATUS.NEEDS_USER_REVIEW,
      reason: 'practice_success_missing_validated_evidence',
      successfulAttempts: 1,
    });
    expect(evaluation.skills[0].status).not.toBe(LEARNING_SKILL_EVALUATION_STATUS.CONSOLIDATION_CANDIDATE);
  });

  it('marks repeated failures as needs_user_review', () => {
    const attempts = [
      learningAttempt({
        index: 1,
        status: LEARNING_PRACTICE_STATUS.EXECUTION_FAILED,
        reason: 'exit_code_mismatch',
      }),
      learningAttempt({
        index: 2,
        status: LEARNING_PRACTICE_STATUS.EVIDENCE_FAILED,
        reason: 'evidence_persistence_failed',
      }),
    ];
    const evaluation = evaluateLearningPlanSkills({
      plan: validExecutablePracticePlan({ practiceAttempts: attempts }),
      runner: runnerForAttempts(attempts, {
        'runner-task-1': { status: 'failed', validationPassed: false },
        'runner-task-2': { status: 'failed', evidencePersistenceOk: false },
      }),
    });

    expect(evaluation.skills[0]).toMatchObject({
      status: LEARNING_SKILL_EVALUATION_STATUS.NEEDS_USER_REVIEW,
      reason: 'repeated_learning_practice_failures',
      failedAttempts: 2,
    });
    expect(evaluation.skills[0].failureReasons).toEqual([
      'exit_code_mismatch',
      'evidence_persistence_failed',
    ]);
  });

  it('produces clear failure reasons for failed attempts', () => {
    const attempts = [
      learningAttempt({
        index: 1,
        status: LEARNING_PRACTICE_STATUS.EXECUTION_FAILED,
        reason: 'runner_validation_failed_exit_code',
      }),
    ];
    const evaluation = evaluateLearningPlanSkills({
      plan: validExecutablePracticePlan({ practiceAttempts: attempts }),
      runner: runnerForAttempts(attempts, {
        'runner-task-1': { status: 'failed', validationPassed: false },
      }),
    });

    expect(evaluation.skills[0]).toMatchObject({
      status: LEARNING_SKILL_EVALUATION_STATUS.FAILED,
      reason: 'runner_validation_failed_exit_code',
      failedAttempts: 1,
      failureReasons: ['runner_validation_failed_exit_code'],
    });
  });
});

describe('Learning ProcedureSynthesizer', () => {
  it('creates a guarded procedure from consolidation_candidate', () => {
    const attempts = [
      learningAttempt({ index: 1 }),
      learningAttempt({ index: 2 }),
    ];
    const plan = validExecutablePracticePlan({ practiceAttempts: attempts });
    const evaluation = evaluateLearningPlanSkills({
      plan,
      runner: runnerForAttempts(attempts),
    });
    const result = synthesizeProcedureCandidatesFromLearningPlan({
      plan,
      evaluation,
      now: 1770000000000,
    });

    expect(result.ok).toBe(true);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      name: 'Pesquisar no navegador',
      title: 'Pesquisar no navegador',
      status: 'guarded',
      sourceLearningRequestId: 'request-browser-search',
      sourceLearningPlanId: 'plan-browser-search',
      sourceSkillId: 'skill-browser-search',
      successRate: 1,
      successfulAttempts: 2,
    });
  });

  it('does not create an active procedure by default', () => {
    const result = synthesizeLearningProcedureCandidatesInMemory(
      memoryWithConsolidationCandidate(),
      'plan-browser-search',
      { now: 1770000000000 },
    );
    const learning = getAutonomousLearningMemoryState(result.memory);
    const candidate = learning.procedureCandidates[0];

    expect(result.ok).toBe(true);
    expect(candidate.status).toBe('guarded');
    expect(candidate.status).not.toBe('active');
    expect(result.memory.proceduralMemory.procedures).toEqual([]);
  });

  it('includes evidence refs on the procedure candidate', () => {
    const result = synthesizeLearningProcedureCandidatesInMemory(
      memoryWithConsolidationCandidate(),
      'plan-browser-search',
      { now: 1770000000000 },
    );
    const candidate = getAutonomousLearningMemoryState(result.memory).procedureCandidates[0];

    expect(candidate.evidenceRefs).toEqual(['evidence-1', 'evidence-2']);
    expect(candidate.metadata).toMatchObject({
      createdBy: 'learning_planner',
      learningRequestId: 'request-browser-search',
      learningPlanId: 'plan-browser-search',
      skillId: 'skill-browser-search',
    });
  });

  it('includes trigger examples and required tools', () => {
    const result = synthesizeLearningProcedureCandidatesInMemory(
      memoryWithConsolidationCandidate(),
      'plan-browser-search',
      { now: 1770000000000 },
    );
    const candidate = getAutonomousLearningMemoryState(result.memory).procedureCandidates[0];

    expect(candidate.triggerExamples.join('\n')).toContain('Pesquisar no navegador');
    expect(candidate.triggerExamples.join('\n')).toContain('Aprender a pesquisar documentacao');
    expect(candidate.requiredTools).toEqual(['runner_evidence', 'runner_evidence_validator']);
    expect(candidate.validationCriteria).toContain('Alice consegue abrir busca controlada e validar evidencia.');
    expect(candidate.steps).toContain('Record controlled learning practice through the Runner.');
  });

  it('can be shown in the existing Autonomous Learning HUD candidate section', () => {
    const result = synthesizeLearningProcedureCandidatesInMemory(
      memoryWithConsolidationCandidate(),
      'plan-browser-search',
      { now: 1770000000000 },
    );
    const learning = getAutonomousLearningMemoryState(result.memory);
    const snapshot = buildDebugHudSnapshot({
      autonomousLearningMemoryState: learning,
    });
    const fullHtml = renderToString(
      createElement(AutonomousLearningHudPage, {
        debugHud: { learningLoop: snapshot.learningLoop },
        onAutonomousLearningAction: () => null,
      }),
    );

    expect(snapshot.learningLoop.candidates).toContain('learning-procedure-plan-browser-search-skill-browser-search');
    expect(snapshot.learningLoop.candidates).toContain('guarded');
    expect(fullHtml).toContain('learning-procedure-plan-browser-search-skill-browser-search');
    expect(fullHtml).toContain('guarded');
  });
});
