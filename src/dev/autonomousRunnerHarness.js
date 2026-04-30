import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {
  ALICE_MEMORY_MAX_JSON_BYTES,
  createEmptyAliceMemory,
  cancelAutonomousRunnerMemoryTask,
  enqueueAutonomousRunnerMemoryTask,
  estimateAliceMemoryJsonBytes,
  getAutonomousLearningMemoryState,
  getAutonomousRunnerState,
  pruneAliceMemory,
  setAutonomousRunnerMemoryEnabled,
  setAutonomousRunnerMemoryPaused,
  updateAutonomousLearningMemoryState,
  updateAutonomousRunnerState,
} from '../aliceMemory';
import {
  RUNNER_REASONS,
  RUNNER_STATES,
  RUNNER_TASK_STATUSES,
  appendAutonomousRunnerAudit,
  normalizeAutonomousRunnerState,
  updateAutonomousRunnerTask,
} from '../autonomousRunnerState';
import {
  acquireRunnerLease,
  recoverAutonomousTasksOnStartup,
} from '../autonomousRunnerLease';
import { runAutonomousTaskRunnerTick } from '../autonomousTaskRunner';
import { createProcedureCandidate } from '../autonomousLearning/learning';
import { scanAutonomousCapabilityGaps } from '../autonomousCapabilityScanner';
import {
  clearAutonomousLearningTestData,
  runAutonomousLearningLoop,
} from '../autonomousLearningLoop';
import { createAutonomousReuseTask } from '../autonomousLearningPlanner';
import { resolveProcedureReuseForGap } from '../autonomousProcedureReuseEngine';
import { matchProceduresForNeed } from '../autonomousProcedureMatcher';
import { rebuildProcedureReuseIndex } from '../autonomousReuseIndex';

export const HARNESS_CREATED_BY = 'autonomous_runner_harness';
export const HARNESS_APP_ID = 'com.faustinoafk.alicevirtual';
export const HARNESS_MEMORY_FILE = 'alice-memory.json';

const READ_ONLY_COMMANDS = new Set([
  'print-state',
  'print-task',
  'print-audit',
  'print-evidence',
  'list-running',
  'list-test-tasks',
  'verify-safe-state',
]);

const AUTONOMOUS_LEARNING_READ_ONLY = new Set([
  'print-state',
  'print-gaps',
  'print-experiments',
  'print-procedure',
  'verify-safe-state',
]);

const AUTONOMOUS_REUSE_READ_ONLY = new Set([
  'print-index',
  'match',
  'simulate',
  'print-procedure-usage',
  'verify-safe-state',
]);

const SEED_COMMANDS = new Set([
  'seed-smoke',
  'seed-failure',
  'seed-large-task',
  'seed-vm-unavailable',
  'seed-stale-running',
  'seed-dependency-recovery',
  'seed-learning-candidate',
]);

const COMPACTION_COMMANDS = new Set([
  'compact-runner-memory',
]);

const RUNNER_ACTIVE_STATUSES = new Set([
  RUNNER_TASK_STATUSES.PLANNED,
  RUNNER_TASK_STATUSES.READY,
  RUNNER_TASK_STATUSES.RUNNING,
  RUNNER_TASK_STATUSES.WAITING_RETRY,
  RUNNER_TASK_STATUSES.WAITING_INPUT,
  RUNNER_TASK_STATUSES.BLOCKED,
  RUNNER_TASK_STATUSES.PAUSED,
]);

const RUNNER_TERMINAL_STATUSES = new Set([
  RUNNER_TASK_STATUSES.DONE,
  RUNNER_TASK_STATUSES.FAILED,
  RUNNER_TASK_STATUSES.CANCELLED,
]);

const DEFAULT_COMPACTION_KEEP_AUDITS = 80;
const DEFAULT_COMPACTION_KEEP_EVIDENCE_REFS = 80;
const DEFAULT_COMPACTION_KEEP_TERMINAL_TASKS = 20;

const COMPLETE_EVIDENCE = {
  kind: 'complete',
  required: ['command', 'stdout', 'stderr', 'exitCode', 'validationResult', 'metadata'],
};

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const toIso = (value = Date.now()) => new Date(value).toISOString();

const normalizePositiveInteger = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : fallback;
};

const toSafeIdPart = (value) =>
  normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'scenario';

const timestampId = (now) => {
  const parsed = Date.parse(now || '');
  return Number.isFinite(parsed) ? String(parsed) : String(Date.now());
};

const commandStep = ({
  id,
  title,
  command,
  args = [],
  completionCriteria = { type: 'exit_code', expected: 0 },
  environment = 'local_workspace_fallback',
  maxAttempts = 3,
  timeoutMs,
} = {}) => ({
  id,
  title,
  type: 'command',
  action: {
    kind: 'command',
    command,
    args,
    environment,
  },
  completionCriteria,
  expectedEvidence: COMPLETE_EVIDENCE,
  timeoutPolicy: {
    type: 'dynamic',
    ...(timeoutMs ? { timeoutMs } : {}),
  },
  retryPolicy: {
    maxAttempts,
    backoff: 'dynamic',
  },
  maxAttempts,
});

const harnessMetadata = (scenario, now, extra = {}) => ({
  ...extra,
  createdBy: HARNESS_CREATED_BY,
  testScenario: scenario,
  createdAt: now,
  tags: ['harness', `${scenario}-test`, ...(extra.tags || [])],
});

const createHarnessTaskInput = (scenario, patch = {}, { now = toIso(), suffix = '' } = {}) => {
  const scenarioId = toSafeIdPart(scenario);
  const suffixPart = suffix ? `-${toSafeIdPart(suffix)}` : '';

  return {
    id: `runner-harness-${scenarioId}${suffixPart}-${timestampId(now)}`,
    title: `Harness ${scenario}: ${patch.title || 'Task de teste'}`,
    description: patch.description || `Task criada pelo Dev Harness do Runner (${scenario}).`,
    status: RUNNER_TASK_STATUSES.READY,
    priority: 'medium',
    riskLevel: 'harness',
    maxAttempts: 3,
    allowWorkspaceFallback: true,
    ...patch,
    metadata: harnessMetadata(scenario, now, patch.metadata),
    requestedResources: {
      ...(patch.requestedResources || {}),
      harness: {
        createdBy: HARNESS_CREATED_BY,
        testScenario: scenario,
      },
    },
  };
};

export const resolveMemoryPath = ({
  memoryPath = '',
  env = {},
  platform = os.platform(),
} = {}) => {
  if (memoryPath) {
    return path.resolve(memoryPath);
  }

  if (platform === 'win32') {
    const appData = env.APPDATA || env.LOCALAPPDATA;
    if (appData) {
      return path.join(appData, HARNESS_APP_ID, HARNESS_MEMORY_FILE);
    }
  }

  if (platform === 'darwin' && env.HOME) {
    return path.join(env.HOME, 'Library', 'Application Support', HARNESS_APP_ID, HARNESS_MEMORY_FILE);
  }

  const configRoot = env.XDG_CONFIG_HOME || (env.HOME ? path.join(env.HOME, '.config') : process.cwd());
  return path.join(configRoot, HARNESS_APP_ID, HARNESS_MEMORY_FILE);
};

export const loadHarnessMemory = ({ memoryPath = '' } = {}) => {
  const resolvedPath = resolveMemoryPath({ memoryPath, env: process.env });
  if (!fs.existsSync(resolvedPath)) {
    return {
      memory: createEmptyAliceMemory(),
      memoryPath: resolvedPath,
      existed: false,
    };
  }

  const raw = fs.readFileSync(resolvedPath, 'utf8');
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = createEmptyAliceMemory();
  }
  return {
    memory: pruneAliceMemory(parsed),
    memoryPath: resolvedPath,
    existed: true,
  };
};

export const saveHarnessMemory = (memory, { memoryPath = '' } = {}) => {
  const resolvedPath = resolveMemoryPath({ memoryPath, env: process.env });
  const normalizedMemory = pruneAliceMemory(memory);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, `${JSON.stringify(normalizedMemory, null, 2)}\n`, 'utf8');
  return {
    memory: normalizedMemory,
    memoryPath: resolvedPath,
  };
};

export const createHarnessBackup = (memoryPath, { now = toIso() } = {}) => {
  const resolvedPath = resolveMemoryPath({ memoryPath, env: process.env });
  if (!fs.existsSync(resolvedPath)) {
    return null;
  }

  const stamp = now.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const backupPath = `${resolvedPath}.harness-backup-${stamp}`;
  fs.copyFileSync(resolvedPath, backupPath);
  return backupPath;
};

export const isHarnessTask = (task = {}) =>
  task?.metadata?.createdBy === HARNESS_CREATED_BY ||
  task?.requestedResources?.harness?.createdBy === HARNESS_CREATED_BY ||
  task?.riskLevel === 'harness';

const getActiveRealTasks = (runner = {}) =>
  Object.values(normalizeAutonomousRunnerState(runner).tasksById)
    .filter((task) => !isHarnessTask(task) && RUNNER_ACTIVE_STATUSES.has(task.status));

export const assertSafeForHarnessMutation = (memory, { force = false, seed = false } = {}) => {
  const runner = getAutonomousRunnerState(memory);
  const activeRealTasks = getActiveRealTasks(runner);
  const lockTask = runner.runnerLock?.activeTaskId
    ? runner.tasksById[runner.runnerLock.activeTaskId]
    : null;
  const realLock = lockTask && !isHarnessTask(lockTask);
  const issues = [];

  if (runner.runnerLock && realLock) {
    issues.push(`runnerLock aponta para task real ${lockTask.id}`);
  }
  if (activeRealTasks.length > 0 && seed) {
    issues.push(`existem ${activeRealTasks.length} tasks reais ativas`);
  }

  if (issues.length > 0 && !force) {
    throw new Error(`Harness recusou mutacao insegura: ${issues.join('; ')}. Use --force somente se tiver certeza.`);
  }

  return { ok: true, issues };
};

const maybeEnableRunner = (memory, enable, now) =>
  enable
    ? setAutonomousRunnerMemoryEnabled(memory, true, { now, reason: 'harness_seed' })
    : memory;

export const seedSmokeTask = (memory, { now = toIso(), enable = true } = {}) => {
  let nextMemory = enqueueAutonomousRunnerMemoryTask(memory, createHarnessTaskInput('smoke', {
    title: 'Smoke real do Runner',
    description: 'Criar arquivo runner-smoke-test.txt e validar existencia no workspace controlado.',
    priority: 'high',
    steps: [
      commandStep({
        id: 'create-runner-smoke-file',
        title: 'Criar arquivo runner-smoke-test.txt',
        command: 'node',
        args: [
          '-e',
          "require('fs').writeFileSync('runner-smoke-test.txt', 'runner-smoke-ok'); console.log('runner-smoke-ok')",
        ],
        completionCriteria: {
          type: 'file_exists',
          path: 'runner-smoke-test.txt',
        },
      }),
    ],
  }, { now }), { now });

  nextMemory = maybeEnableRunner(nextMemory, enable, now);
  const taskId = Object.values(getAutonomousRunnerState(nextMemory).tasksById)
    .filter((task) => isHarnessTask(task) && task.metadata.testScenario === 'smoke')
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0]?.id;

  return { memory: nextMemory, taskIds: [taskId].filter(Boolean) };
};

export const seedFailureTask = (memory, { now = toIso(), enable = true, maxAttempts = 3 } = {}) => {
  let nextMemory = enqueueAutonomousRunnerMemoryTask(memory, createHarnessTaskInput('failure', {
    title: 'Smoke de falha controlada do Runner',
    description: 'Executar comando inexistente e confirmar que o Runner nao inventa sucesso.',
    priority: 'high',
    maxAttempts,
    steps: [
      commandStep({
        id: 'run-invalid-command',
        title: 'Executar comando invalido',
        command: 'comando_inexistente_runner_12345',
        completionCriteria: {
          type: 'exit_code',
          expected: 0,
        },
        maxAttempts,
      }),
    ],
  }, { now }), { now });

  nextMemory = maybeEnableRunner(nextMemory, enable, now);
  const taskId = Object.values(getAutonomousRunnerState(nextMemory).tasksById)
    .filter((task) => isHarnessTask(task) && task.metadata.testScenario === 'failure')
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0]?.id;

  return { memory: nextMemory, taskIds: [taskId].filter(Boolean) };
};

export const seedLargeTask = (memory, { now = toIso(), enable = true, heavy = false } = {}) => {
  const steps = [
    commandStep({
      id: 'print-working-directory',
      title: 'Verificar diretorio atual',
      command: 'node',
      args: ['-e', 'console.log(process.cwd())'],
      completionCriteria: { type: 'exit_code', expected: 0 },
    }),
    commandStep({
      id: 'check-node',
      title: 'Verificar Node',
      command: 'node',
      args: ['--version'],
      completionCriteria: { type: 'exit_code', expected: 0 },
    }),
    commandStep({
      id: 'check-npm',
      title: 'Verificar npm',
      command: 'npm',
      args: ['--version'],
      completionCriteria: { type: 'exit_code', expected: 0 },
    }),
    commandStep({
      id: 'check-python',
      title: 'Verificar Python',
      command: 'python',
      args: ['--version'],
      completionCriteria: { type: 'exit_code', expected: 0 },
    }),
    commandStep({
      id: 'create-large-report',
      title: 'Criar relatorio runner-large-report.txt',
      command: 'node',
      args: [
        '-e',
        "require('fs').writeFileSync('runner-large-report.txt', 'runner-large-ok'); console.log('runner-large-ok')",
      ],
      completionCriteria: { type: 'file_exists', path: 'runner-large-report.txt' },
    }),
    commandStep({
      id: 'read-large-report',
      title: 'Ler relatorio criado no step',
      command: 'node',
      args: [
        '-e',
        "const fs=require('fs'); fs.writeFileSync('runner-large-readback.txt','runner-large-readback-ok'); console.log(fs.readFileSync('runner-large-readback.txt','utf8'))",
      ],
      completionCriteria: { type: 'file_contains', contains: 'runner-large-readback-ok' },
    }),
  ];

  if (heavy) {
    steps.push(
      commandStep({
        id: 'npm-test-heavy',
        title: 'Rodar npm test',
        command: 'npm',
        args: ['test'],
        completionCriteria: { type: 'tests_passed' },
        timeoutMs: 600000,
      }),
      commandStep({
        id: 'npm-build-heavy',
        title: 'Rodar npm run build',
        command: 'npm',
        args: ['run', 'build'],
        completionCriteria: { type: 'build_passed' },
        timeoutMs: 600000,
      }),
    );
  }

  let nextMemory = enqueueAutonomousRunnerMemoryTask(memory, createHarnessTaskInput('large-task', {
    title: heavy ? 'Smoke grande pesado do Runner' : 'Smoke grande seguro do Runner',
    description: 'Validar varios steps reais e seguros no workspace controlado.',
    priority: 'medium',
    steps,
  }, { now }), { now });

  nextMemory = maybeEnableRunner(nextMemory, enable, now);
  const taskId = Object.values(getAutonomousRunnerState(nextMemory).tasksById)
    .filter((task) => isHarnessTask(task) && task.metadata.testScenario === 'large-task')
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0]?.id;

  return { memory: nextMemory, taskIds: [taskId].filter(Boolean) };
};

export const seedVmUnavailableScenario = (memory, { now = toIso(), enable = true } = {}) => {
  let nextMemory = updateAutonomousRunnerState(memory, (runner) => ({
    ...runner,
    settings: {
      ...runner.settings,
      devOverrides: {
        ...runner.settings.devOverrides,
        forceVmUnavailable: true,
      },
    },
  }), { now });

  const vmTask = createHarnessTaskInput('vm-unavailable', {
    title: 'Task A exige VM real',
    description: 'Task que deve ir para waiting_retry quando o override de VM indisponivel estiver ativo.',
    priority: 'critical',
    requiresRealVm: true,
    allowWorkspaceFallback: false,
    steps: [
      commandStep({
        id: 'requires-real-vm',
        title: 'Executar comando que exige VM real',
        command: 'node',
        args: ['-e', "console.log('should-not-run-with-vm-unavailable')"],
        environment: 'real_vm',
      }),
    ],
  }, { now, suffix: 'real-vm' });
  const fallbackTask = createHarnessTaskInput('vm-unavailable', {
    title: 'Task B usa workspace fallback',
    description: 'Task elegivel para provar que a fila pode continuar quando outra task espera VM.',
    priority: 'high',
    steps: [
      commandStep({
        id: 'workspace-fallback-after-vm-skip',
        title: 'Executar fallback local',
        command: 'node',
        args: ['-e', "console.log('fallback-ok')"],
      }),
    ],
  }, { now, suffix: 'workspace-fallback' });

  nextMemory = enqueueAutonomousRunnerMemoryTask(nextMemory, vmTask, { now });
  nextMemory = enqueueAutonomousRunnerMemoryTask(nextMemory, fallbackTask, { now });
  nextMemory = maybeEnableRunner(nextMemory, enable, now);

  return { memory: nextMemory, taskIds: [vmTask.id, fallbackTask.id] };
};

export const seedStaleRunningTask = (memory, {
  now = toIso(),
  staleAt = toIso(Date.parse(now) - 600000),
  enable = true,
} = {}) => {
  let nextMemory = enqueueAutonomousRunnerMemoryTask(memory, createHarnessTaskInput('stale-running', {
    title: 'Task stale para recovery',
    description: 'Task criada em running com heartbeat antigo para validar recovery.',
    priority: 'high',
    steps: [
      commandStep({
        id: 'stale-running-step',
        title: 'Step preso simulado',
        command: 'node',
        args: ['-e', "console.log('stale')"],
      }),
    ],
  }, { now }), { now });
  nextMemory = maybeEnableRunner(nextMemory, enable, now);

  let runner = getAutonomousRunnerState(nextMemory);
  const task = Object.values(runner.tasksById)
    .filter((item) => isHarnessTask(item) && item.metadata.testScenario === 'stale-running')
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0];
  const step = task?.steps[0];
  if (!task || !step) {
    return { memory: nextMemory, taskIds: [] };
  }

  const lease = acquireRunnerLease(runner, task.id, step.id, {
    now: staleAt,
    staleTimeoutMs: 1000,
  });
  runner = lease.runner;
  runner = updateAutonomousRunnerTask(runner, task.id, {
    heartbeatAt: staleAt,
    runningStartedAt: staleAt,
    staleTimeoutMs: 1000,
    updatedAt: staleAt,
  });
  runner = {
    ...runner,
    runnerLock: runner.runnerLock
      ? {
          ...runner.runnerLock,
          acquiredAt: staleAt,
          heartbeatAt: staleAt,
        }
      : null,
    runnerState: RUNNER_STATES.RUNNING,
    activeTaskId: task.id,
  };

  nextMemory = updateAutonomousRunnerState(nextMemory, runner, { now });
  return { memory: nextMemory, taskIds: [task.id] };
};

export const seedDependencyRecoveryScenario = (memory, { now = toIso(), enable = true } = {}) => {
  const failedTask = createHarnessTaskInput('dependency-recovery', {
    title: 'Task A falha controlada',
    description: 'Dependencia base falhada para validar bloqueio/recovery.',
    status: RUNNER_TASK_STATUSES.FAILED,
    reason: RUNNER_REASONS.MAX_ATTEMPTS_REACHED,
    steps: [
      {
        ...commandStep({
          id: 'dependency-fails',
          title: 'Falhar dependencia',
          command: 'comando_inexistente_runner_12345',
          completionCriteria: { type: 'exit_code', expected: 0 },
          maxAttempts: 1,
        }),
        status: RUNNER_TASK_STATUSES.FAILED,
        reason: RUNNER_REASONS.MAX_ATTEMPTS_REACHED,
        attempts: 1,
        finishedAt: now,
      },
    ],
    attempts: 1,
    maxAttempts: 1,
    executionHistory: [
      {
        timestamp: now,
        stepId: 'dependency-fails',
        status: 'failed',
        reason: RUNNER_REASONS.MAX_ATTEMPTS_REACHED,
        result: { stderr: 'comando_inexistente_runner_12345' },
        validation: { passed: false, reason: 'exit_code_mismatch' },
      },
    ],
  }, { now, suffix: 'task-a' });
  const recoveryTask = createHarnessTaskInput('dependency-recovery', {
    title: 'Recovery da Task A',
    description: 'Recovery sem execucao automatica; existe para auditoria do cenario.',
    status: RUNNER_TASK_STATUSES.PLANNED,
    reason: RUNNER_REASONS.DEPENDENCY_FAILED,
    recoveryOfTaskId: failedTask.id,
    steps: [],
  }, { now, suffix: 'recovery' });
  const dependentTask = createHarnessTaskInput('dependency-recovery', {
    title: 'Task B depende da Task A',
    description: 'Task dependente deve permanecer bloqueada ate a dependencia estar done.',
    status: RUNNER_TASK_STATUSES.BLOCKED,
    reason: RUNNER_REASONS.DEPENDENCY_FAILED,
    dependencies: [{ taskId: failedTask.id, requiredStatus: RUNNER_TASK_STATUSES.DONE }],
    recoveryAttempts: [recoveryTask.id],
    steps: [
      commandStep({
        id: 'dependent-work',
        title: 'Executar validacao dependente',
        command: 'node',
        args: ['-e', "console.log('dependent')"],
      }),
    ],
  }, { now, suffix: 'task-b' });

  let nextMemory = enqueueAutonomousRunnerMemoryTask(memory, failedTask, { now });
  nextMemory = enqueueAutonomousRunnerMemoryTask(nextMemory, recoveryTask, { now });
  nextMemory = enqueueAutonomousRunnerMemoryTask(nextMemory, dependentTask, { now });
  nextMemory = maybeEnableRunner(nextMemory, enable, now);

  return { memory: nextMemory, taskIds: [failedTask.id, dependentTask.id, recoveryTask.id] };
};

export const seedLearningCandidateScenario = (memory, { now = toIso(), enable = true } = {}) => {
  let nextMemory = memory;
  const taskIds = [];

  for (let index = 0; index < 3; index += 1) {
    const task = createHarnessTaskInput('learning-candidate', {
      title: `Falha repetida ${index + 1}`,
      description: 'Falha repetida controlada para observar candidato de aprendizado.',
      status: RUNNER_TASK_STATUSES.FAILED,
      reason: RUNNER_REASONS.VALIDATION_FAILED,
      steps: [
        {
          ...commandStep({
            id: `learning-failure-${index + 1}`,
            title: 'Falha repetida controlada',
            command: 'comando_inexistente_runner_12345',
            completionCriteria: { type: 'exit_code', expected: 0 },
            maxAttempts: 1,
          }),
          status: RUNNER_TASK_STATUSES.FAILED,
          reason: RUNNER_REASONS.VALIDATION_FAILED,
          attempts: 1,
          finishedAt: now,
        },
      ],
      attempts: 1,
      maxAttempts: 1,
      executionHistory: [
        {
          timestamp: now,
          stepId: `learning-failure-${index + 1}`,
          status: 'failed',
          reason: RUNNER_REASONS.VALIDATION_FAILED,
          result: { stderr: 'comando_inexistente_runner_12345' },
          validation: { passed: false, reason: 'exit_code_mismatch' },
        },
      ],
    }, { now, suffix: `failure-${index + 1}` });
    taskIds.push(task.id);
    nextMemory = enqueueAutonomousRunnerMemoryTask(nextMemory, task, { now });
  }

  const candidate = createProcedureCandidate({
    candidateId: `procedure-candidate-harness-learning-${timestampId(now)}`,
    title: 'Harness: falha repetida em comando inexistente',
    summary: 'Candidato criado por repeticao controlada de falhas no Runner. Nao deve ser aprovado automaticamente.',
    steps: ['comando_inexistente_runner_12345', 'criterio=exit_code'],
    source: 'runner_harness_repeated_failure',
    confidence: 0.2,
    now: Date.parse(now),
  });
  nextMemory = pruneAliceMemory({
    ...nextMemory,
    autonomousAudit: {
      ...nextMemory.autonomousAudit,
      skillCandidates: [
        ...(nextMemory.autonomousAudit?.skillCandidates || []),
        candidate,
      ].slice(-60),
      updatedAt: now,
    },
  });
  nextMemory = maybeEnableRunner(nextMemory, enable, now);

  return { memory: nextMemory, taskIds, candidateId: candidate.candidateId };
};

export const recoverHarnessStartup = (memory, { now = toIso(), nowMs = Date.parse(now) } = {}) => {
  const runner = recoverAutonomousTasksOnStartup(getAutonomousRunnerState(memory), { now, nowMs });
  return {
    memory: updateAutonomousRunnerState(memory, runner, { now }),
    runner,
  };
};

export const tickHarnessRunner = async (memory, {
  count = 1,
  nowMs = Date.now(),
  vmStatus = { realVmAvailable: false, fallbackWorkspaceAvailable: true },
} = {}) => {
  let nextMemory = memory;
  const results = [];

  for (let index = 0; index < Math.max(1, Number(count || 1)); index += 1) {
    const result = await runAutonomousTaskRunnerTick({
      runner: getAutonomousRunnerState(nextMemory),
      vmStatus,
      invokeTool: null,
      nowMs: nowMs + index,
    });
    nextMemory = updateAutonomousRunnerState(nextMemory, result.runner, {
      now: toIso(nowMs + index),
    });
    results.push({
      ok: result.ok,
      executed: result.executed,
      reason: result.reason,
      taskId: result.task?.id || '',
      taskStatus: result.task?.status || '',
      nextIntervalMs: result.nextIntervalMs,
    });
  }

  return { memory: nextMemory, results };
};

export const runHarnessUntilIdle = async (memory, { maxTicks = 20, nowMs = Date.now() } = {}) => {
  let nextMemory = memory;
  const results = [];

  for (let index = 0; index < maxTicks; index += 1) {
    const tick = await tickHarnessRunner(nextMemory, { count: 1, nowMs: nowMs + index });
    nextMemory = tick.memory;
    results.push(tick.results[0]);
    if (!tick.results[0]?.executed) {
      break;
    }
  }

  return { memory: nextMemory, results };
};

export const clearHarnessTasks = (memory, {
  now = toIso(),
  removeEvidence = false,
  memoryPath = '',
} = {}) => {
  const runner = getAutonomousRunnerState(memory);
  const harnessTaskIds = new Set(Object.values(runner.tasksById).filter(isHarnessTask).map((task) => task.id));
  const tasksById = { ...runner.tasksById };

  harnessTaskIds.forEach((taskId) => {
    delete tasksById[taskId];
  });

  const evidenceRefs = runner.evidenceRefs.filter((ref) => !harnessTaskIds.has(ref.taskId));
  const nextRunner = appendAutonomousRunnerAudit({
    ...runner,
    tasksById,
    queue: runner.queue.filter((taskId) => !harnessTaskIds.has(taskId)),
    activeTaskId: harnessTaskIds.has(runner.activeTaskId) ? null : runner.activeTaskId,
    runnerLock: harnessTaskIds.has(runner.runnerLock?.activeTaskId) ? null : runner.runnerLock,
    evidenceRefs,
    settings: {
      ...runner.settings,
      devOverrides: {
        ...runner.settings.devOverrides,
        forceVmUnavailable: false,
      },
    },
  }, {
    timestamp: now,
    type: 'harness_cleanup',
    summary: `Harness removeu ${harnessTaskIds.size} tasks de teste.`,
    reason: 'clear_test_tasks',
    metadata: { removeEvidence },
  });

  if (removeEvidence) {
    removeHarnessEvidenceFiles(runner.evidenceRefs.filter((ref) => harnessTaskIds.has(ref.taskId)), memoryPath);
  }

  return {
    memory: updateAutonomousRunnerState(memory, nextRunner, { now }),
    removedTaskIds: [...harnessTaskIds],
  };
};

const getTaskRecencyMs = (task = {}) => {
  const candidates = [
    task.updatedAt,
    task.finishedAt,
    task.lastAttemptAt,
    task.createdAt,
  ].map((value) => Date.parse(value || '')).filter(Number.isFinite);

  return candidates.length > 0 ? Math.max(...candidates) : 0;
};

const createRunnerMemoryCompactionSummary = ({
  beforeMemory,
  afterMemory,
  removedTaskIds,
  removedEvidenceRefs,
  beforeAuditCount,
  afterAuditCount,
  beforeEvidenceRefCount,
  afterEvidenceRefCount,
  keepAudits,
  keepEvidenceRefs,
  keepTerminalTasks,
} = {}) => {
  const beforeBytes = estimateAliceMemoryJsonBytes(beforeMemory);
  const afterBytes = estimateAliceMemoryJsonBytes(afterMemory);

  return {
    beforeBytes,
    afterBytes,
    maxBytes: ALICE_MEMORY_MAX_JSON_BYTES,
    savedBytes: Math.max(0, beforeBytes - afterBytes),
    beforeStatus: beforeBytes > ALICE_MEMORY_MAX_JSON_BYTES ? 'over_limit' : 'ok',
    afterStatus: afterBytes > ALICE_MEMORY_MAX_JSON_BYTES ? 'over_limit' : 'ok',
    removedTaskIds,
    removedEvidenceRefs,
    beforeAuditCount,
    afterAuditCount,
    beforeEvidenceRefCount,
    afterEvidenceRefCount,
    keepAudits,
    keepEvidenceRefs,
    keepTerminalTasks,
  };
};

export const compactRunnerMemory = (memory, {
  now = toIso(),
  keepAudits = DEFAULT_COMPACTION_KEEP_AUDITS,
  keepEvidenceRefs = DEFAULT_COMPACTION_KEEP_EVIDENCE_REFS,
  keepTerminalTasks = DEFAULT_COMPACTION_KEEP_TERMINAL_TASKS,
  force = false,
} = {}) => {
  const beforeMemory = pruneAliceMemory(memory);
  const safeState = verifySafeState(beforeMemory);
  if (!safeState.ok && !force) {
    throw new Error(`Compactacao recusada: Runner nao esta SAFE (${safeState.issues.join('; ')}).`);
  }

  const runner = getAutonomousRunnerState(beforeMemory);
  const normalizedKeepAudits = normalizePositiveInteger(keepAudits, DEFAULT_COMPACTION_KEEP_AUDITS);
  const normalizedKeepEvidenceRefs = normalizePositiveInteger(keepEvidenceRefs, DEFAULT_COMPACTION_KEEP_EVIDENCE_REFS);
  const normalizedKeepTerminalTasks = normalizePositiveInteger(keepTerminalTasks, DEFAULT_COMPACTION_KEEP_TERMINAL_TASKS);
  const tasks = Object.values(runner.tasksById);
  const terminalTasks = tasks.filter((task) => RUNNER_TERMINAL_STATUSES.has(task.status));
  const terminalTaskIdsToKeep = new Set(
    terminalTasks
      .sort((left, right) => getTaskRecencyMs(right) - getTaskRecencyMs(left))
      .slice(0, normalizedKeepTerminalTasks)
      .map((task) => task.id),
  );
  const taskIdsToKeep = new Set(
    tasks
      .filter((task) => !RUNNER_TERMINAL_STATUSES.has(task.status) || terminalTaskIdsToKeep.has(task.id))
      .map((task) => task.id),
  );
  const tasksById = {};
  const removedTaskIds = [];

  tasks.forEach((task) => {
    if (taskIdsToKeep.has(task.id)) {
      tasksById[task.id] = task;
    } else {
      removedTaskIds.push(task.id);
    }
  });

  const retainedEvidenceRefs = runner.evidenceRefs
    .filter((ref) => !ref.taskId || taskIdsToKeep.has(ref.taskId))
    .slice(-normalizedKeepEvidenceRefs);
  const retainedEvidenceIds = new Set(retainedEvidenceRefs.map((ref) => ref.id));
  const removedEvidenceRefs = runner.evidenceRefs
    .filter((ref) => !retainedEvidenceIds.has(ref.id))
    .map((ref) => ref.id);
  const trimmedAudits = normalizedKeepAudits > 1
    ? runner.audits.slice(-(normalizedKeepAudits - 1))
    : [];
  const trimmedAuditRefs = normalizedKeepAudits > 1
    ? runner.auditRefs.slice(-(normalizedKeepAudits - 1))
    : [];

  let nextRunner = appendAutonomousRunnerAudit({
    ...runner,
    tasksById,
    queue: runner.queue.filter((taskId) => taskIdsToKeep.has(taskId)),
    activeTaskId: taskIdsToKeep.has(runner.activeTaskId) ? runner.activeTaskId : null,
    runnerLock: taskIdsToKeep.has(runner.runnerLock?.activeTaskId) ? runner.runnerLock : null,
    evidenceRefs: retainedEvidenceRefs,
    audits: trimmedAudits,
    auditRefs: trimmedAuditRefs,
  }, {
    timestamp: now,
    type: 'harness_compaction',
    summary: 'Harness compactou historico do Runner preservando evidencias fisicas.',
    reason: 'compact_runner_memory',
    metadata: {
      keepAudits: normalizedKeepAudits,
      keepEvidenceRefs: normalizedKeepEvidenceRefs,
      keepTerminalTasks: normalizedKeepTerminalTasks,
      removedTaskIds,
      removedEvidenceRefs,
      physicalEvidencePreserved: true,
    },
  });

  if (normalizedKeepAudits >= 0) {
    nextRunner = {
      ...nextRunner,
      audits: nextRunner.audits.slice(-normalizedKeepAudits),
      auditRefs: nextRunner.auditRefs.slice(-normalizedKeepAudits),
    };
  }

  const afterMemory = updateAutonomousRunnerState(beforeMemory, nextRunner, { now });
  const afterRunner = getAutonomousRunnerState(afterMemory);

  return {
    memory: afterMemory,
    removedTaskIds,
    compaction: createRunnerMemoryCompactionSummary({
      beforeMemory,
      afterMemory,
      removedTaskIds,
      removedEvidenceRefs,
      beforeAuditCount: runner.audits.length,
      afterAuditCount: afterRunner.audits.length,
      beforeEvidenceRefCount: runner.evidenceRefs.length,
      afterEvidenceRefCount: afterRunner.evidenceRefs.length,
      keepAudits: normalizedKeepAudits,
      keepEvidenceRefs: normalizedKeepEvidenceRefs,
      keepTerminalTasks: normalizedKeepTerminalTasks,
    }),
  };
};

const removeHarnessEvidenceFiles = (refs = [], memoryPath = '') => {
  const baseDir = path.dirname(resolveMemoryPath({ memoryPath, env: process.env }));
  const removed = new Set();

  refs.forEach((ref) => {
    if (!ref.path || removed.has(ref.path)) {
      return;
    }
    const resolvedPath = path.isAbsolute(ref.path)
      ? path.resolve(ref.path)
      : path.resolve(baseDir, ref.path);
    if (!resolvedPath.startsWith(baseDir)) {
      return;
    }
    try {
      fs.rmSync(resolvedPath, { force: true });
      removed.add(ref.path);
    } catch {
      // Evidence cleanup is best effort; state cleanup remains authoritative.
    }
  });
};

export const listHarnessTasks = (memory) =>
  Object.values(getAutonomousRunnerState(memory).tasksById).filter(isHarnessTask);

export const listRunningTasks = (memory) =>
  Object.values(getAutonomousRunnerState(memory).tasksById)
    .filter((task) => task.status === RUNNER_TASK_STATUSES.RUNNING);

export const verifySafeState = (memory) => {
  const runner = getAutonomousRunnerState(memory);
  const issues = [];

  if (runner.runnerLock) {
    issues.push(`runnerLock exists for task ${runner.runnerLock.activeTaskId || 'unknown'}`);
  }
  Object.values(runner.tasksById).forEach((task) => {
    if (task.status === RUNNER_TASK_STATUSES.RUNNING) {
      issues.push(`task ${task.id} is running`);
    }
    if ([RUNNER_TASK_STATUSES.DONE, RUNNER_TASK_STATUSES.FAILED, RUNNER_TASK_STATUSES.CANCELLED].includes(task.status) && task.leaseId) {
      issues.push(`task ${task.id} is finalized with lease ${task.leaseId}`);
    }
    task.steps.forEach((step) => {
      if (step.status === RUNNER_TASK_STATUSES.RUNNING) {
        issues.push(`step ${step.id} is running in task ${task.id}`);
      }
      if ([RUNNER_TASK_STATUSES.DONE, RUNNER_TASK_STATUSES.FAILED, RUNNER_TASK_STATUSES.CANCELLED].includes(task.status) && step.status === RUNNER_TASK_STATUSES.RUNNING) {
        issues.push(`step ${step.id} is running but task ${task.id} is ${task.status}`);
      }
    });
  });
  if (runner.activeTaskId && !runner.tasksById[runner.activeTaskId]) {
    issues.push(`activeTaskId ${runner.activeTaskId} points to a missing task`);
  }
  runner.queue.forEach((taskId) => {
    if (!runner.tasksById[taskId]) {
      issues.push(`queue contains missing task ${taskId}`);
    }
  });
  runner.evidenceRefs.forEach((ref) => {
    if (ref.taskId && !runner.tasksById[ref.taskId]) {
      issues.push(`evidenceRef ${ref.id} points to missing task ${ref.taskId}`);
    }
  });

  return {
    ok: issues.length === 0,
    issues,
  };
};

const createLearningGap = (scenario = 'browser-search', { now = toIso() } = {}) => {
  if (scenario !== 'browser-search') {
    throw new Error(`Gap de aprendizado desconhecido: ${scenario}`);
  }
  return {
    gapId: 'gap-browser-search-address-bar',
    type: 'browser_search',
    capability: 'browser.search',
    description: 'Alice nao tem procedimento confiavel para pesquisar usando a barra do navegador.',
    priority: 'high',
    evidence: ['harness_seed_gap'],
    suggestedExperiments: ['ctrl_l_address_bar', 'visual_click_address_bar', 'controlled_script_browser_search'],
    riskLevel: 'low',
    status: 'open',
    firstSeenAt: now,
    lastSeenAt: now,
  };
};

export const printAutonomousLearningState = (memory) => {
  const learning = getAutonomousLearningMemoryState(memory);
  return {
    enabled: learning.enabled,
    lastStartupRunAt: learning.lastStartupRunAt,
    lastScanAt: learning.lastScanAt,
    lastExperimentAt: learning.lastExperimentAt,
    knownGaps: learning.knownGaps,
    recentExperiments: learning.recentExperiments,
    procedureCandidates: learning.procedureCandidates,
    promotedProcedures: learning.promotedProcedures,
    generatedScripts: learning.generatedScripts,
    stats: learning.stats,
    latestAudit: learning.auditLog.at(-1) || null,
  };
};

export const seedAutonomousLearningGap = (memory, scenario = 'browser-search', { now = toIso() } = {}) => {
  const learning = getAutonomousLearningMemoryState(memory);
  const gap = createLearningGap(scenario, { now });
  const nextLearning = {
    ...learning,
    knownGaps: [
      ...learning.knownGaps.filter((item) => item.gapId !== gap.gapId),
      gap,
    ],
    auditLog: [
      ...learning.auditLog,
      {
        id: `learning-gap-seeded-${timestampId(now)}`,
        timestamp: now,
        type: 'gap_seeded',
        summary: `Gap seedado pelo harness: ${gap.description}`,
        reason: 'harness_seed_gap',
        metadata: { gapId: gap.gapId },
      },
    ].slice(-120),
  };
  return {
    memory: updateAutonomousLearningMemoryState(memory, nextLearning, { now }),
    gapId: gap.gapId,
  };
};

export const scanAutonomousLearningHarness = (memory, { now = toIso() } = {}) => {
  const learning = getAutonomousLearningMemoryState(memory);
  const scan = scanAutonomousCapabilityGaps(memory, { policy: learning.policy, now });
  const nextLearning = {
    ...learning,
    lastScanAt: now,
    knownGaps: scan.gaps,
    stats: {
      ...learning.stats,
      scans: Number(learning.stats?.scans || 0) + 1,
      gapsDetected: scan.gaps.length,
    },
    auditLog: [
      ...learning.auditLog,
      {
        id: `learning-scan-${timestampId(now)}`,
        timestamp: now,
        type: 'capability_scan_completed',
        summary: `Harness scan encontrou ${scan.gaps.length} gaps.`,
        reason: 'harness_scan',
      },
    ].slice(-120),
  };
  return {
    memory: updateAutonomousLearningMemoryState(memory, nextLearning, { now }),
    gaps: scan.gaps,
  };
};

export const verifyAutonomousLearningSafeState = (memory) => {
  const runnerSafe = verifySafeState(memory);
  const runner = getAutonomousRunnerState(memory);
  const activeLearningTasks = Object.values(runner.tasksById)
    .filter((task) => ['autonomous_learning_loop', 'autonomous_procedure_reuse', 'autonomous_procedure_optimizer']
      .includes(task.metadata?.createdBy))
    .filter((task) => task.status === RUNNER_TASK_STATUSES.RUNNING);
  const issues = [
    ...runnerSafe.issues,
    ...activeLearningTasks.map((task) => `learning task ${task.id} is running`),
  ];
  return {
    ok: issues.length === 0,
    issues,
  };
};

const buildNeedFromText = (text = '') => ({
  gapId: `need-${toSafeIdPart(text)}`,
  type: /pesquis|search|browser|navegador|barra/i.test(text) ? 'browser_search' : 'procedure_need',
  capability: /pesquis|search|browser|navegador|barra/i.test(text) ? 'browser.search' : '',
  description: normalizeText(text),
  riskLevel: 'low',
});

export const matchAutonomousReuse = (memory, needText = '') => {
  const learning = getAutonomousLearningMemoryState(memory);
  const need = buildNeedFromText(needText);
  const procedures = [
    ...(memory.proceduralMemory?.procedures || []),
    ...(learning.promotedProcedures || []),
  ];
  const candidates = learning.procedureCandidates || [];
  return {
    need,
    index: rebuildProcedureReuseIndex({ procedures, candidates }),
    matches: matchProceduresForNeed({ need, procedures, candidates, minScore: 0 }),
  };
};

const countTasksByStatus = (tasks = []) =>
  tasks.reduce((counts, task) => ({
    ...counts,
    [task.status]: Number(counts[task.status] || 0) + 1,
  }), {});

export const buildRunnerStateSnapshot = (memory, { memoryPath = '' } = {}) => {
  const runner = getAutonomousRunnerState(memory);
  const tasks = Object.values(runner.tasksById);
  const safeState = verifySafeState(memory);

  return {
    memoryPath: memoryPath || '',
    runner: {
      enabled: runner.enabled,
      runnerState: runner.runnerState,
      activeTaskId: runner.activeTaskId,
      runnerLock: runner.runnerLock,
      devOverrides: runner.settings.devOverrides || {},
    },
    queue: {
      total: runner.queue.length,
      ...countTasksByStatus(tasks),
    },
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      reason: task.reason,
      harness: isHarnessTask(task),
      scenario: task.metadata?.testScenario || '',
      stepsDone: task.steps.filter((step) => step.status === RUNNER_TASK_STATUSES.DONE).length,
      stepsTotal: task.steps.length,
      attempts: task.attempts,
      maxAttempts: task.maxAttempts,
      evidenceRefs: task.evidenceRefs.length,
      nextRunAt: task.nextRunAt,
    })),
    safety: {
      ok: safeState.ok,
      runningTasks: tasks.filter((task) => task.status === RUNNER_TASK_STATUSES.RUNNING).length,
      runningSteps: tasks.reduce(
        (total, task) => total + task.steps.filter((step) => step.status === RUNNER_TASK_STATUSES.RUNNING).length,
        0,
      ),
      issues: safeState.issues,
    },
    latestAudit: runner.audits.at(-1) || null,
    latestEvidence: runner.evidenceRefs.at(-1) || null,
  };
};

export const formatRunnerStateSnapshot = (snapshot) => {
  const lines = [
    'Runner:',
    `  enabled: ${snapshot.runner.enabled}`,
    `  runnerState: ${snapshot.runner.runnerState}`,
    `  activeTaskId: ${snapshot.runner.activeTaskId || 'null'}`,
    `  runnerLock: ${snapshot.runner.runnerLock ? JSON.stringify(snapshot.runner.runnerLock) : 'null'}`,
    `  devOverrides: ${JSON.stringify(snapshot.runner.devOverrides || {})}`,
    '',
    'Queue:',
    `  total: ${snapshot.queue.total}`,
    `  ready: ${snapshot.queue.ready || 0}`,
    `  waiting_retry: ${snapshot.queue.waiting_retry || 0}`,
    `  running: ${snapshot.queue.running || 0}`,
    `  blocked: ${snapshot.queue.blocked || 0}`,
    `  failed: ${snapshot.queue.failed || 0}`,
    '',
    'Tasks:',
  ];

  if (snapshot.tasks.length === 0) {
    lines.push('  - nenhuma task');
  } else {
    snapshot.tasks.forEach((task) => {
      lines.push(
        `  - id: ${task.id}`,
        `    title: ${task.title}`,
        `    status: ${task.status}`,
        `    reason: ${task.reason || 'null'}`,
        `    harness: ${task.harness}${task.scenario ? ` (${task.scenario})` : ''}`,
        `    steps: ${task.stepsDone}/${task.stepsTotal} done`,
        `    attempts: ${task.attempts}/${task.maxAttempts}`,
        `    evidenceRefs: ${task.evidenceRefs}`,
      );
    });
  }

  lines.push(
    '',
    'Safety:',
    `  runningTasks: ${snapshot.safety.runningTasks}`,
    `  runningSteps: ${snapshot.safety.runningSteps}`,
    `  safe: ${snapshot.safety.ok}`,
  );
  snapshot.safety.issues.forEach((issue) => lines.push(`  - ${issue}`));
  return lines.join('\n');
};

export const printTask = (memory, taskId) => {
  const runner = getAutonomousRunnerState(memory);
  return runner.tasksById[taskId] || null;
};

export const printAudit = (memory, { limit = 30 } = {}) =>
  getAutonomousRunnerState(memory).audits.slice(-Math.max(1, Number(limit || 30)));

export const printEvidence = (memory, { memoryPath = '' } = {}) => {
  const runner = getAutonomousRunnerState(memory);
  const baseDir = path.dirname(resolveMemoryPath({ memoryPath, env: process.env }));

  return runner.evidenceRefs.map((ref) => {
    const resolvedPath = ref.path
      ? path.isAbsolute(ref.path)
        ? path.resolve(ref.path)
        : path.resolve(baseDir, ref.path)
      : '';
    return {
      id: ref.id,
      executionId: ref.executionId,
      taskId: ref.taskId,
      stepId: ref.stepId,
      kind: ref.kind,
      path: ref.path,
      exists: resolvedPath ? fs.existsSync(resolvedPath) : false,
      important: ref.important,
      createdAt: ref.createdAt,
    };
  });
};

export const parseHarnessArgs = (argv = []) => {
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
    command: positional[0] || 'print-state',
    positional: positional.slice(1),
    flags,
  };
};

const isReadOnlyHarnessCommand = (command, positional = []) => {
  if (command === 'autonomous-learning') {
    return AUTONOMOUS_LEARNING_READ_ONLY.has(positional[0] || 'print-state');
  }
  if (command === 'autonomous-reuse') {
    return AUTONOMOUS_REUSE_READ_ONLY.has(positional[0] || 'print-index');
  }
  return READ_ONLY_COMMANDS.has(command);
};

const commandNeedsHarnessSafety = (command, positional = []) => {
  if (command === 'autonomous-learning') {
    return !isReadOnlyHarnessCommand(command, positional);
  }
  if (command === 'autonomous-reuse') {
    return !isReadOnlyHarnessCommand(command, positional);
  }
  return SEED_COMMANDS.has(command) || COMPACTION_COMMANDS.has(command) || ['tick', 'run-until-idle'].includes(command);
};

const applyHarnessCommand = async (memory, command, positional, flags, context) => {
  const now = flags.now ? toIso(Date.parse(flags.now)) : toIso();
  const enable = flags['no-enable'] ? false : true;

  switch (command) {
    case 'autonomous-learning': {
      const subcommand = positional[0] || 'print-state';
      const learning = getAutonomousLearningMemoryState(memory);
      if (subcommand === 'enable' || subcommand === 'disable') {
        return {
          memory: updateAutonomousLearningMemoryState(memory, {
            ...learning,
            enabled: subcommand === 'enable',
            policy: {
              ...learning.policy,
              enabled: subcommand === 'enable',
            },
          }, { now }),
        };
      }
      if (subcommand === 'scan') {
        return scanAutonomousLearningHarness(memory, { now });
      }
      if (subcommand === 'seed-gap') {
        return seedAutonomousLearningGap(memory, positional[1] || 'browser-search', { now });
      }
      if (subcommand === 'run-once' || subcommand === 'dry-run') {
        const result = await runAutonomousLearningLoop({
          memory,
          memoryHydrated: true,
          dryRun: subcommand === 'dry-run' || Boolean(flags['dry-run']),
          startup: false,
          nowMs: Date.parse(now),
        });
        return {
          memory: result.memory,
          taskIds: (result.createdTasks || []).map((task) => task.id),
          gaps: result.gaps || [],
          results: [{
            ok: result.ok,
            reason: result.reason,
            started: result.started,
            createdTasks: (result.createdTasks || []).map((task) => task.id),
          }],
        };
      }
      if (subcommand === 'run-until-idle') {
        let nextMemory = memory;
        const results = [];
        for (let index = 0; index < Number(flags.count || 3); index += 1) {
          const result = await runAutonomousLearningLoop({
            memory: nextMemory,
            memoryHydrated: true,
            dryRun: Boolean(flags['dry-run']),
            startup: false,
            nowMs: Date.parse(now) + index,
          });
          nextMemory = result.memory;
          results.push({
            ok: result.ok,
            reason: result.reason,
            createdTasks: (result.createdTasks || []).map((task) => task.id),
          });
          if (!result.createdTasks?.length) {
            break;
          }
        }
        return { memory: nextMemory, results };
      }
      if (subcommand === 'clear-test-learning') {
        return clearAutonomousLearningTestData(memory, { now });
      }
      if (AUTONOMOUS_LEARNING_READ_ONLY.has(subcommand)) {
        return { memory };
      }
      throw new Error(`Comando autonomous-learning desconhecido: ${subcommand}`);
    }
    case 'autonomous-reuse': {
      const subcommand = positional[0] || 'print-index';
      if (subcommand === 'run') {
        const needText = positional.slice(1).join(' ');
        const need = buildNeedFromText(needText);
        const reuse = resolveProcedureReuseForGap({
          gap: need,
          memory,
          policy: getAutonomousLearningMemoryState(memory).policy,
          now,
        });
        if (!reuse.ok || !reuse.match) {
          throw new Error(`Reuso recusado: ${reuse.reason}`);
        }
        const task = reuse.task || createAutonomousReuseTask({ gap: need, match: reuse.match, now });
        return {
          memory: enqueueAutonomousRunnerMemoryTask(memory, task, { now }),
          taskIds: [task.id],
          results: [{ ok: true, reason: reuse.reason, procedureId: reuse.match.procedureId }],
        };
      }
      if (subcommand === 'clear-test-reuse') {
        return clearAutonomousLearningTestData(memory, { now });
      }
      if (AUTONOMOUS_REUSE_READ_ONLY.has(subcommand)) {
        return { memory };
      }
      throw new Error(`Comando autonomous-reuse desconhecido: ${subcommand}`);
    }
    case 'enable':
      return { memory: setAutonomousRunnerMemoryEnabled(memory, true, { now, reason: 'harness_enable' }) };
    case 'disable':
      return { memory: setAutonomousRunnerMemoryEnabled(memory, false, { now, reason: 'harness_disable' }) };
    case 'pause':
      return { memory: setAutonomousRunnerMemoryPaused(memory, true, { now, reason: 'harness_pause' }) };
    case 'resume':
      return { memory: setAutonomousRunnerMemoryPaused(memory, false, { now, reason: 'harness_resume' }) };
    case 'cancel-task':
    case 'archive-task': {
      const taskId = normalizeText(positional[0]);
      if (!taskId) {
        throw new Error(`${command} exige um taskId explicito.`);
      }
      return {
        memory: cancelAutonomousRunnerMemoryTask(memory, taskId, {
          now,
          reason: flags.reason || 'harness_manual_triage',
        }),
        taskIds: [taskId],
      };
    }
    case 'seed-smoke':
      return seedSmokeTask(memory, { now, enable });
    case 'seed-failure':
      return seedFailureTask(memory, { now, enable, maxAttempts: Number(flags['max-attempts'] || 3) });
    case 'seed-large-task':
      return seedLargeTask(memory, { now, enable, heavy: Boolean(flags.heavy) });
    case 'seed-vm-unavailable':
      return seedVmUnavailableScenario(memory, { now, enable });
    case 'seed-stale-running':
      return seedStaleRunningTask(memory, { now, enable });
    case 'seed-dependency-recovery':
      return seedDependencyRecoveryScenario(memory, { now, enable });
    case 'seed-learning-candidate':
      return seedLearningCandidateScenario(memory, { now, enable });
    case 'clear-test-tasks':
      return clearHarnessTasks(memory, {
        now,
        removeEvidence: Boolean(flags['remove-evidence']),
        memoryPath: context.memoryPath,
      });
    case 'compact-runner-memory':
      return compactRunnerMemory(memory, {
        now,
        keepAudits: flags['keep-audits'],
        keepEvidenceRefs: flags['keep-evidence-refs'],
        keepTerminalTasks: flags['keep-terminal-tasks'],
        force: Boolean(flags.force),
      });
    case 'recover-startup':
      return recoverHarnessStartup(memory, { now, nowMs: Date.parse(now) });
    case 'tick':
      return tickHarnessRunner(memory, { count: Number(flags.count || 1), nowMs: Date.parse(now) });
    case 'run-until-idle':
      return runHarnessUntilIdle(memory, { maxTicks: Number(flags.count || 20), nowMs: Date.parse(now) });
    case 'print-state':
    case 'print-task':
    case 'print-audit':
    case 'print-evidence':
    case 'list-running':
    case 'list-test-tasks':
    case 'verify-safe-state':
      return { memory };
    default:
      throw new Error(`Comando desconhecido: ${command}`);
  }
};

const buildReadOnlyOutput = (memory, command, positional, flags, context) => {
  if (command === 'autonomous-learning') {
    const subcommand = positional[0] || 'print-state';
    const learning = printAutonomousLearningState(memory);
    if (subcommand === 'print-gaps') {
      return learning.knownGaps;
    }
    if (subcommand === 'print-experiments') {
      return learning.recentExperiments;
    }
    if (subcommand === 'print-procedure') {
      const id = normalizeText(positional[1]);
      return [
        ...(memory.proceduralMemory?.procedures || []),
        ...(learning.promotedProcedures || []),
        ...(learning.procedureCandidates || []),
      ].find((procedure) => procedure.procedureId === id || procedure.candidateId === id) || null;
    }
    if (subcommand === 'verify-safe-state') {
      return verifyAutonomousLearningSafeState(memory);
    }
    return learning;
  }
  if (command === 'autonomous-reuse') {
    const subcommand = positional[0] || 'print-index';
    if (subcommand === 'print-index') {
      const learning = getAutonomousLearningMemoryState(memory);
      return rebuildProcedureReuseIndex({
        procedures: [
          ...(memory.proceduralMemory?.procedures || []),
          ...(learning.promotedProcedures || []),
        ],
        candidates: learning.procedureCandidates || [],
      });
    }
    if (subcommand === 'match' || subcommand === 'simulate') {
      return matchAutonomousReuse(memory, positional.slice(1).join(' '));
    }
    if (subcommand === 'print-procedure-usage') {
      const id = normalizeText(positional[1]);
      const learning = getAutonomousLearningMemoryState(memory);
      return [
        ...(memory.proceduralMemory?.procedures || []),
        ...(learning.promotedProcedures || []),
      ].find((procedure) => procedure.procedureId === id) || null;
    }
    if (subcommand === 'verify-safe-state') {
      return verifyAutonomousLearningSafeState(memory);
    }
  }
  if (command === 'print-task') {
    return printTask(memory, positional[0]);
  }
  if (command === 'print-audit') {
    return printAudit(memory, { limit: Number(flags.limit || 30) });
  }
  if (command === 'print-evidence') {
    return printEvidence(memory, { memoryPath: context.memoryPath });
  }
  if (command === 'list-running') {
    return listRunningTasks(memory);
  }
  if (command === 'list-test-tasks') {
    return listHarnessTasks(memory);
  }
  if (command === 'verify-safe-state') {
    return verifySafeState(memory);
  }
  return buildRunnerStateSnapshot(memory, { memoryPath: context.memoryPath });
};

const formatCommandOutput = (command, output) => {
  if (command === 'verify-safe-state') {
    return output.ok
      ? 'SAFE'
      : ['UNSAFE:', ...output.issues.map((issue) => `- ${issue}`)].join('\n');
  }
  if (command === 'print-state') {
    return formatRunnerStateSnapshot(output);
  }
  return JSON.stringify(output, null, 2);
};

export const runHarnessCommand = async (argv = [], {
  env = process.env,
  outputJson = null,
} = {}) => {
  const parsed = parseHarnessArgs(argv);
  const memoryPath = resolveMemoryPath({
    memoryPath: parsed.flags['memory-path'] || '',
    env,
  });
  const readOnly = isReadOnlyHarnessCommand(parsed.command, parsed.positional);
  const { memory } = loadHarnessMemory({ memoryPath });
  const force = Boolean(parsed.flags.force);

  if (!readOnly && commandNeedsHarnessSafety(parsed.command, parsed.positional)) {
    assertSafeForHarnessMutation(memory, { force, seed: SEED_COMMANDS.has(parsed.command) });
  }

  const backupPath = readOnly ? null : createHarnessBackup(memoryPath);
  const result = await applyHarnessCommand(memory, parsed.command, parsed.positional, parsed.flags, { memoryPath });

  if (!readOnly) {
    saveHarnessMemory(result.memory, { memoryPath });
  }

  const output = readOnly
    ? buildReadOnlyOutput(result.memory, parsed.command, parsed.positional, parsed.flags, { memoryPath })
    : {
        ok: true,
        command: parsed.command,
        memoryPath,
        backupPath,
        taskIds: result.taskIds || [],
        removedTaskIds: result.removedTaskIds || [],
        candidateId: result.candidateId || '',
        gapId: result.gapId || '',
        compaction: result.compaction || null,
        gaps: result.gaps || [],
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
