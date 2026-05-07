import process from 'node:process';
import {
  createEmptyAliceMemory,
  getAutonomousLearningMemoryState,
  getAutonomousRunnerState,
  setAutonomousRunnerMemoryEnabled,
  updateAutonomousLearningMemoryState,
  updateAutonomousRunnerState,
} from '../aliceMemory';
import { normalizeAutonomousRunnerState } from '../autonomousRunnerState';
import { runLearningPlanPracticeRunnerTick } from '../learningPlanner/learningPlannerExecution';
import { compileLearningPlanToRunnerTasks, enqueueCompiledLearningPlanTasks } from '../learningPlanner/learningTaskCompiler';
import { validateLearningPlanSchema } from '../learningPlanner/learningPlanSchema';
import { validateLearningPlanForExecution } from '../learningPlanner/learningPlanValidator';
import {
  LEARNING_PLAN_STATUS,
  LEARNING_PLANNER_SCHEMA_VERSION,
  createLearningPlan,
  createLearningRequest,
  normalizeArray,
  normalizeText,
} from '../learningPlanner/learningPlannerTypes';
import {
  getLearningPlannerState,
  saveLearningPlanRecord,
  updateLearningPlannerState,
} from '../learningPlanner/learningPlannerRepository';
import {
  createHarnessBackup,
  loadHarnessMemory,
  resolveMemoryPath,
  saveHarnessMemory,
  verifySafeState,
} from './autonomousRunnerHarness';

export const LEARNING_HARNESS_CREATED_BY = 'learning_planner_harness';
export const LEARNING_HARNESS_SCENARIO = 'learning-planner-harness';

const READ_ONLY_COMMANDS = new Set([
  'print-learning-state',
  'validate-plan',
  'compile-plan',
  'print-learning-request',
  'print-learning-plan',
  'print-learning-attempts',
  'verify-learning-safe-state',
]);

const toIso = (value = Date.now()) => new Date(value).toISOString();

const toSafeIdPart = (value = '') =>
  normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'learning';

export const parseLearningHarnessArgs = (argv = []) => {
  const positional = [];
  const flags = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    index += 1;
  }

  return {
    command: positional[0] || 'print-learning-state',
    positional: positional.slice(1),
    flags,
  };
};

const getLearningRequests = (memory = {}) =>
  normalizeArray(getLearningPlannerState(memory).learningRequests);

const upsertLearningRequest = (memory = {}, request = {}, { now = new Date().toISOString() } = {}) =>
  updateLearningPlannerState(memory, (state) => {
    const learningRequests = [
      ...getLearningRequests({ autonomousLearning: { learningPlanner: state } })
        .filter((item) => item.requestId !== request.requestId),
      request,
    ].slice(-40);

    return {
      ...state,
      learningRequests,
      auditLog: [
        ...state.auditLog,
        {
          id: `learning-harness-request-${Date.parse(now) || Date.now()}`,
          timestamp: now,
          type: 'learning_harness_request_seeded',
          planId: '',
          reason: request.requestId,
          summary: request.objective,
        },
      ].slice(-120),
    };
  }, { now });

const findLearningRequest = (memory = {}, requestId = '') => {
  const requests = getLearningRequests(memory);
  const normalizedId = normalizeText(requestId);
  return requests.find((request) => request.requestId === normalizedId) || requests.at(-1) || null;
};

const findLearningPlan = (memory = {}, planId = '') => {
  const state = getLearningPlannerState(memory);
  const normalizedId = normalizeText(planId);
  return state.plansById[normalizedId] ||
    state.plansById[state.activePlanId] ||
    state.plansById[state.planOrder.at(-1)] ||
    null;
};

export const createHarnessLearningRequest = ({
  objective = 'Aprender a validar uma pratica controlada pelo Runner.',
  requestId = '',
  now = new Date().toISOString(),
} = {}) => createLearningRequest({
  requestId: requestId || `learning-harness-request-${Date.parse(now) || Date.now()}`,
  objective,
  requestedBy: LEARNING_HARNESS_CREATED_BY,
  context: {
    createdBy: LEARNING_HARNESS_CREATED_BY,
    testScenario: LEARNING_HARNESS_SCENARIO,
  },
  createdAt: now,
}, { now });

export const createHarnessLearningPlan = (request = {}, { now = new Date().toISOString() } = {}) => {
  const safeId = toSafeIdPart(request.requestId || request.objective);
  return createLearningPlan({
    schemaVersion: LEARNING_PLANNER_SCHEMA_VERSION,
    planId: `learning-harness-plan-${safeId}`,
    requestId: request.requestId,
    objective: request.objective,
    objectiveSuccessCriteria: [
      'A pratica controlada executa pelo Autonomous Task Runner.',
      'A evidencia fisica do Runner foi persistida e validada.',
    ],
    status: LEARNING_PLAN_STATUS.VALIDATED,
    skills: [
      {
        skillId: `learning-harness-skill-${safeId}`,
        title: 'Pratica controlada pelo Runner',
        description: 'Executar e validar uma pratica segura usando o Runner oficial.',
        requiredTools: ['runner_evidence', 'runner_evidence_validator'],
        successCriteria: ['Duas tentativas futuras devem passar com evidencia validada.'],
        trainingTaskIds: [`learning-harness-training-${safeId}`],
        risk: { level: 'low', decision: 'valid', reason: 'Harness controlado.' },
      },
    ],
    trainingTasks: [
      {
        taskId: `learning-harness-training-${safeId}`,
        title: 'Executar pratica controlada',
        objective: request.objective,
        actionKind: 'validation',
        actionSummary: 'Executar pratica controlada via comando seguro do Runner.',
        expectedEvidence: [
          {
            evidenceId: `learning-harness-evidence-${safeId}`,
            kind: 'validation_report',
            description: 'Relatorio de validacao e evidencia persistida pelo Runner.',
            validationHint: 'Precisa conter validacao positiva e arquivos de evidencia do Runner.',
          },
        ],
        risk: { level: 'low', decision: 'valid', reason: 'Sem acao destrutiva.' },
      },
    ],
    validations: ['Validacao do Runner precisa passar antes de qualquer consolidacao.'],
    expectedEvidence: [
      {
        evidenceId: `learning-harness-evidence-${safeId}`,
        kind: 'validation_report',
        description: 'Evidencia persistida pelo Runner.',
      },
    ],
    blockedActions: ['Nao executar fora do Autonomous Task Runner', 'Nao marcar como learned'],
    consolidationSuggestions: ['Consolidar apenas como guarded/candidate apos evidencia validada.'],
    risk: { level: 'low', decision: 'valid', reason: 'Harness controlado.' },
    createdBy: LEARNING_HARNESS_CREATED_BY,
    createdAt: now,
    updatedAt: now,
  }, { now });
};

const createHarnessRunnerInvoke = () => async (name, payload) => {
  if (name === 'run_local_workspace_playground_task') {
    return {
      ok: true,
      message: 'learning harness practice executed',
      stdout: 'learning-harness-practice-ok',
      stderr: '',
      artifacts: { statusCode: 0 },
    };
  }
  if (name === 'save_runner_evidence') {
    return {
      ok: true,
      message: 'learning harness evidence saved',
      artifacts: { executionId: payload.request.executionId },
    };
  }
  if (name === 'verify_runner_evidence') {
    return {
      ok: true,
      message: 'learning harness evidence verified',
      artifacts: {
        executionId: payload.request.executionId,
        status: 'ok',
        files: payload.request.files,
        existingFiles: payload.request.files,
        missingFiles: [],
      },
    };
  }
  return { ok: false, message: `unexpected harness tool ${name}` };
};

export const printLearningState = (memory = {}) => {
  const state = getLearningPlannerState(memory);
  const runner = getAutonomousRunnerState(memory);
  const learning = getAutonomousLearningMemoryState(memory);
  return {
    activePlanId: state.activePlanId,
    requests: getLearningRequests(memory).map((request) => ({
      requestId: request.requestId,
      objective: request.objective,
      requestedBy: request.requestedBy,
      testScenario: request.context?.testScenario || '',
    })),
    plans: state.planOrder.map((planId) => {
      const plan = state.plansById[planId];
      return {
        planId,
        requestId: plan.requestId,
        status: plan.status,
        createdBy: plan.createdBy,
        attempts: normalizeArray(plan.practiceAttempts).length,
      };
    }),
    runnerTasks: Object.values(runner.tasksById)
      .filter((task) => task.metadata?.createdBy === 'learning_planner')
      .map((task) => ({
        taskId: task.id,
        status: task.status,
        testScenario: task.metadata?.testScenario || '',
      })),
    procedureCandidates: normalizeArray(learning.procedureCandidates)
      .filter((candidate) => candidate.metadata?.createdBy === 'learning_planner' || candidate.source === 'learning_planner')
      .map((candidate) => ({
        candidateId: candidate.candidateId,
        status: candidate.status,
        sourceLearningRequestId: candidate.sourceLearningRequestId,
      })),
  };
};

export const verifyLearningSafeState = (memory = {}) => {
  const runnerSafe = verifySafeState(memory);
  const state = getLearningPlannerState(memory);
  const issues = [...runnerSafe.issues];

  Object.values(state.plansById).forEach((plan) => {
    normalizeArray(plan.practiceAttempts).forEach((attempt) => {
      if (attempt.status === 'practice_success' && normalizeArray(attempt.evidenceRefIds).length === 0) {
        issues.push(`learning attempt ${attempt.attemptId || attempt.runnerTaskId} is success without evidence refs`);
      }
    });
  });

  return {
    ok: issues.length === 0,
    issues,
    runner: runnerSafe,
  };
};

const isHarnessRequest = (request = {}) =>
  request.requestedBy === LEARNING_HARNESS_CREATED_BY ||
  request.context?.createdBy === LEARNING_HARNESS_CREATED_BY ||
  request.context?.testScenario === LEARNING_HARNESS_SCENARIO;

const isHarnessPlan = (plan = {}) =>
  plan.createdBy === LEARNING_HARNESS_CREATED_BY ||
  String(plan.planId || '').startsWith('learning-harness-plan-') ||
  isHarnessRequest({ requestId: plan.requestId, requestedBy: plan.requestedBy, context: plan.context });

const isHarnessRunnerTask = (task = {}) =>
  task.metadata?.createdBy === 'learning_planner' &&
  task.metadata?.testScenario === LEARNING_HARNESS_SCENARIO;

const isHarnessCandidate = (candidate = {}) =>
  candidate.metadata?.createdBy === 'learning_planner' &&
  candidate.metadata?.testScenario === LEARNING_HARNESS_SCENARIO;

export const clearLearningHarnessTestData = (memory = {}, { now = new Date().toISOString() } = {}) => {
  const state = getLearningPlannerState(memory);
  const harnessRequestIds = new Set(getLearningRequests(memory).filter(isHarnessRequest).map((request) => request.requestId));
  const harnessPlanIds = new Set(Object.values(state.plansById)
    .filter((plan) => isHarnessPlan(plan) || harnessRequestIds.has(plan.requestId))
    .map((plan) => plan.planId));
  const runner = getAutonomousRunnerState(memory);
  const harnessTaskIds = new Set(Object.values(runner.tasksById)
    .filter(isHarnessRunnerTask)
    .map((task) => task.id));

  const nextPlannerMemory = updateLearningPlannerState(memory, (current) => {
    const plansById = { ...current.plansById };
    harnessPlanIds.forEach((planId) => delete plansById[planId]);
    return {
      ...current,
      learningRequests: getLearningRequests({ autonomousLearning: { learningPlanner: current } })
        .filter((request) => !harnessRequestIds.has(request.requestId)),
      plansById,
      planOrder: current.planOrder.filter((planId) => !harnessPlanIds.has(planId)),
      activePlanId: harnessPlanIds.has(current.activePlanId) ? '' : current.activePlanId,
      auditLog: [
        ...current.auditLog,
        {
          id: `learning-harness-clear-${Date.parse(now) || Date.now()}`,
          timestamp: now,
          type: 'learning_harness_clear_test_data',
          reason: 'clear_learning_test_data',
          summary: `requests=${harnessRequestIds.size} plans=${harnessPlanIds.size} tasks=${harnessTaskIds.size}`,
        },
      ].slice(-120),
    };
  }, { now });

  const nextRunnerMemory = updateAutonomousRunnerState(nextPlannerMemory, (currentRunner) => {
    const tasksById = { ...currentRunner.tasksById };
    harnessTaskIds.forEach((taskId) => delete tasksById[taskId]);
    return normalizeAutonomousRunnerState({
      ...currentRunner,
      tasksById,
      queue: currentRunner.queue.filter((taskId) => !harnessTaskIds.has(taskId)),
      activeTaskId: harnessTaskIds.has(currentRunner.activeTaskId) ? null : currentRunner.activeTaskId,
      runnerLock: harnessTaskIds.has(currentRunner.runnerLock?.activeTaskId) ? null : currentRunner.runnerLock,
      evidenceRefs: currentRunner.evidenceRefs.filter((ref) => !harnessTaskIds.has(ref.taskId)),
    });
  }, { now });

  const nextLearningMemory = updateAutonomousLearningMemoryState(nextRunnerMemory, (learning) => ({
    ...learning,
    procedureCandidates: learning.procedureCandidates.filter((candidate) => !isHarnessCandidate(candidate)),
    auditLog: [
      ...learning.auditLog,
      {
        id: `learning-harness-clear-learning-${Date.parse(now) || Date.now()}`,
        timestamp: now,
        type: 'learning_harness_clear_test_data',
        reason: 'clear_learning_test_data',
        summary: 'Harness Learning Planner data removed.',
      },
    ].slice(-1000),
  }), { now });

  return {
    memory: nextLearningMemory,
    removedLearning: {
      requests: harnessRequestIds.size,
      plans: harnessPlanIds.size,
      runnerTasks: harnessTaskIds.size,
    },
  };
};

const seedLearningRequest = (memory, positional, flags, { now }) => {
  const objective = normalizeText(positional.join(' ')) ||
    normalizeText(flags.objective) ||
    'Aprender pratica segura pelo Runner.';
  const request = createHarnessLearningRequest({
    objective,
    requestId: flags.requestId || flags['request-id'] || '',
    now,
  });
  return {
    memory: upsertLearningRequest(memory, request, { now }),
    request,
  };
};

const generatePlan = async (memory, positional, flags, { now }) => {
  const request = findLearningRequest(memory, positional[0] || flags.requestId || flags['request-id']);
  if (!request) {
    throw new Error('generate-plan exige uma LearningRequest existente.');
  }
  const plan = createHarnessLearningPlan(request, { now });
  const validation = validateLearningPlanSchema(plan);
  return {
    memory: saveLearningPlanRecord(memory, validation.plan || plan, {
      validation,
      now,
    }),
    plan,
    validation,
  };
};

const validatePlan = (memory, positional, flags) => {
  const plan = findLearningPlan(memory, positional[0] || flags.planId || flags['plan-id']);
  if (!plan) {
    throw new Error('validate-plan exige plano existente.');
  }
  return validateLearningPlanForExecution(plan);
};

const compilePlan = (memory, positional, flags) => {
  const plan = findLearningPlan(memory, positional[0] || flags.planId || flags['plan-id']);
  if (!plan) {
    throw new Error('compile-plan exige plano existente.');
  }
  return compileLearningPlanToRunnerTasks(plan, {
    now: flags.now ? toIso(Date.parse(flags.now)) : toIso(),
  });
};

const enqueueLearningTask = (memory, positional, flags, { now }) => {
  const plan = findLearningPlan(memory, positional[0] || flags.planId || flags['plan-id']);
  if (!plan) {
    throw new Error('enqueue-learning-task exige plano existente.');
  }
  const result = enqueueCompiledLearningPlanTasks(memory, {
    ...plan,
    testScenario: LEARNING_HARNESS_SCENARIO,
  }, { now });
  return {
    ...result,
    memory: setAutonomousRunnerMemoryEnabled(result.memory, true, { now, reason: 'learning_harness_enable' }),
  };
};

const runLearningUntilIdle = async (memory, flags, { now }) => {
  let nextMemory = memory;
  const results = [];
  const maxTicks = Math.max(1, Number(flags.count || 20));
  const startMs = Date.parse(now);

  for (let index = 0; index < maxTicks; index += 1) {
    const result = await runLearningPlanPracticeRunnerTick({
      memory: nextMemory,
      vmStatus: { fallbackWorkspaceAvailable: true },
      invokeTool: createHarnessRunnerInvoke(),
      nowMs: startMs + index,
    });
    nextMemory = result.memory;
    results.push({
      executed: Boolean(result.executed),
      reason: result.reason,
      taskId: result.task?.id || '',
      learningStatus: result.learningPractice?.status || '',
    });
    if (!result.executed) {
      break;
    }
  }

  return { memory: nextMemory, results };
};

export const applyLearningHarnessCommand = async (memory, command, positional, flags) => {
  const now = flags.now ? toIso(Date.parse(flags.now)) : toIso();

  switch (command) {
    case 'seed-learning-request':
      return seedLearningRequest(memory, positional, flags, { now });
    case 'generate-plan':
      return generatePlan(memory, positional, flags, { now });
    case 'enqueue-learning-task':
      return enqueueLearningTask(memory, positional, flags, { now });
    case 'run-learning-until-idle':
      return runLearningUntilIdle(memory, flags, { now });
    case 'clear-learning-test-data':
      return clearLearningHarnessTestData(memory, { now });
    case 'print-learning-state':
    case 'validate-plan':
    case 'compile-plan':
    case 'print-learning-request':
    case 'print-learning-plan':
    case 'print-learning-attempts':
    case 'verify-learning-safe-state':
      return { memory };
    default:
      throw new Error(`Comando Learning Planner desconhecido: ${command}`);
  }
};

const buildReadOnlyOutput = (memory, command, positional, flags) => {
  if (command === 'print-learning-state') {
    return printLearningState(memory);
  }
  if (command === 'validate-plan') {
    return validatePlan(memory, positional, flags);
  }
  if (command === 'compile-plan') {
    return compilePlan(memory, positional, flags);
  }
  if (command === 'print-learning-request') {
    return findLearningRequest(memory, positional[0] || flags.requestId || flags['request-id']);
  }
  if (command === 'print-learning-plan') {
    return findLearningPlan(memory, positional[0] || flags.planId || flags['plan-id']);
  }
  if (command === 'print-learning-attempts') {
    return normalizeArray(findLearningPlan(memory, positional[0] || flags.planId || flags['plan-id'])?.practiceAttempts);
  }
  if (command === 'verify-learning-safe-state') {
    return verifyLearningSafeState(memory);
  }
  return printLearningState(memory);
};

const formatCommandOutput = (command, output) => {
  if (command === 'verify-learning-safe-state') {
    return output.ok
      ? 'SAFE'
      : ['UNSAFE:', ...output.issues.map((issue) => `- ${issue}`)].join('\n');
  }
  return JSON.stringify(output, null, 2);
};

export const runLearningHarnessCommand = async (argv = [], {
  env = process.env,
  outputJson = null,
} = {}) => {
  const parsed = parseLearningHarnessArgs(argv);
  const memoryPath = resolveMemoryPath({
    memoryPath: parsed.flags['memory-path'] || '',
    env,
  });
  const readOnly = READ_ONLY_COMMANDS.has(parsed.command);
  const { memory } = loadHarnessMemory({ memoryPath });
  const backupPath = readOnly ? null : createHarnessBackup(memoryPath);
  const result = await applyLearningHarnessCommand(memory, parsed.command, parsed.positional, parsed.flags);

  if (!readOnly) {
    saveHarnessMemory(result.memory, { memoryPath });
  }

  const output = readOnly
    ? buildReadOnlyOutput(result.memory, parsed.command, parsed.positional, parsed.flags)
    : {
        ok: true,
        command: parsed.command,
        memoryPath,
        backupPath,
        requestId: result.request?.requestId || '',
        planId: result.plan?.planId || '',
        taskIds: result.taskIds || [],
        removedLearning: result.removedLearning || null,
        results: result.results || [],
      };

  return {
    ok: true,
    command: parsed.command,
    memoryPath,
    backupPath,
    output,
    outputText: (outputJson ?? Boolean(parsed.flags.json))
      ? JSON.stringify(output, null, 2)
      : formatCommandOutput(parsed.command, output),
  };
};

export const createFreshLearningHarnessMemory = () => createEmptyAliceMemory();
