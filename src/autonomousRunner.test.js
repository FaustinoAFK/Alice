import { describe, expect, it } from 'vitest';
import {
  createEmptyAliceMemory,
  enqueueAutonomousRunnerMemoryTask,
  getAutonomousRunnerState,
} from './aliceMemory';
import {
  RUNNER_REASONS,
  RUNNER_TASK_STATUSES,
  createAutonomousRunnerTask,
  createEmptyAutonomousRunnerState,
  enqueueAutonomousRunnerTask,
  normalizeAutonomousRunnerState,
  transitionAutonomousRunnerStep,
  transitionAutonomousRunnerTask,
} from './autonomousRunnerState';
import {
  acquireRunnerLease,
  heartbeatRunnerLease,
  recoverAutonomousTasksOnStartup,
  releaseRunnerLease,
} from './autonomousRunnerLease';
import { getEligibleRunnerTasks } from './autonomousRunnerScheduler';
import { runAutonomousRunnerPreflight } from './autonomousRunnerPreflight';
import { runAutonomousTaskRunnerTick } from './autonomousTaskRunner';
import { generateOperationalPlanForTask } from './autonomousRunnerPlanner';
import { detectRecoveryLoop } from './autonomousRunnerRecoveryPlanner';
import { syncMindMapWithRunnerTask } from './autonomousRunnerMindMap';
import { createStarterMindMap } from './hud/mindMap/utils/mindMapData';
import { executeAutonomousRunnerFunctionCall } from './autonomousRunnerToolExecutor';
import { executeAutonomousLearningFunctionCall } from './autonomousLearningToolExecutor';
import {
  applyRunnerEvidencePersistenceMetadata,
  applyRunnerEvidenceRetention,
  buildRunnerEvidenceFromExecution,
  createRunnerEvidenceRef,
  createRunnerExecutionId,
  summarizeRunnerEvidencePhysicalStatus,
} from './autonomousRunnerEvidence';
import { validateRunnerCompletionCriteria } from './autonomousRunnerValidation';

const executableStep = {
  id: 'step-test',
  title: 'Rodar testes',
  type: 'test',
  action: {
    kind: 'command',
    command: 'npm',
    args: ['test'],
  },
  completionCriteria: {
    type: 'tests_passed',
  },
  expectedEvidence: {
    kind: 'complete',
    required: ['metadata'],
  },
  timeoutPolicy: {
    type: 'dynamic',
    timeoutMs: 60000,
  },
  retryPolicy: {
    maxAttempts: 3,
    backoff: 'dynamic',
  },
};

const createReadyTask = (patch = {}) =>
  createAutonomousRunnerTask({
    id: 'task-a',
    title: 'Tarefa A',
    priority: 'medium',
    status: 'ready',
    steps: [executableStep],
    ...patch,
  }, { now: '2026-04-28T10:00:00.000Z' });

const createSuccessfulRunnerInvoke = ({ calls = [], executionResult = {} } = {}) => async (name, payload) => {
  calls.push([name, payload]);
  if (name === 'save_runner_evidence') {
    return {
      ok: true,
      message: 'evidence saved',
      artifacts: { executionId: payload.request.executionId },
    };
  }
  if (name === 'verify_runner_evidence') {
    return {
      ok: true,
      message: 'evidence verified',
      artifacts: {
        executionId: payload.request.executionId,
        status: 'ok',
        files: payload.request.files || ['metadata.json', 'stdout.txt', 'stderr.txt', 'validation.json'],
        existingFiles: payload.request.files || [],
        missingFiles: [],
      },
    };
  }
  return {
    ok: true,
    message: 'tests passed',
    stdout: 'Tests passed',
    stderr: '',
    artifacts: { statusCode: 0, workspacePath: 'copy', ...executionResult.artifacts },
    ...executionResult,
  };
};

describe('autonomous runner state', () => {
  it('creates and normalizes runner tasks with mandatory step contracts', () => {
    const task = createReadyTask();

    expect(task.status).toBe('ready');
    expect(task.steps[0]).toMatchObject({
      title: 'Rodar testes',
      type: 'test',
      status: 'ready',
      completionCriteria: { type: 'tests_passed' },
      expectedEvidence: { kind: 'complete' },
    });
  });

  it('normalizes multi-step task attempt budget so each executable step can run', () => {
    const task = createReadyTask({
      maxAttempts: 1,
      steps: [
        { ...executableStep, id: 'step-one' },
        { ...executableStep, id: 'step-two' },
        { ...executableStep, id: 'step-three' },
      ],
    });

    expect(task.maxAttempts).toBe(3);
  });

  it('normalizes legacy long evidence refs to the native physical directory segment', () => {
    const longExecutionId = `runner-exec-${'a'.repeat(140)}`;
    const runner = normalizeAutonomousRunnerState({
      evidenceRefs: [
        createRunnerEvidenceRef({
          executionId: longExecutionId,
          taskId: 'task-a',
          stepId: 'step-test',
          path: `data/evidence/${longExecutionId}/metadata.json`,
        }),
      ],
    });

    expect(runner.evidenceRefs[0].executionId).toHaveLength(120);
    expect(runner.evidenceRefs[0].path).toBe(`data/evidence/${longExecutionId.slice(0, 120)}/metadata.json`);
  });

  it('migrates legacy autonomous task shape without marking it running', () => {
    const runner = normalizeAutonomousRunnerState({
      tasks: [
        {
          taskId: 'legacy',
          reason: 'rodar build',
          status: 'queued',
          command: 'npm',
          args: ['run', 'build'],
        },
      ],
    });

    expect(runner.tasksById.legacy.status).toBe('ready');
    expect(runner.tasksById.legacy.status).not.toBe('running');
  });

  it('rejects invalid task transition and records audit', () => {
    const runner = enqueueAutonomousRunnerTask(createEmptyAutonomousRunnerState(), createReadyTask());
    const result = transitionAutonomousRunnerTask(runner, 'task-a', 'done', {
      now: '2026-04-28T10:01:00.000Z',
      reason: 'without_execution',
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid_task_transition');
    expect(result.runner.audits.at(-1).type).toBe('state_transition_rejected');
  });

  it('rejects running transitions without a lease proof', () => {
    const runner = enqueueAutonomousRunnerTask(createEmptyAutonomousRunnerState(), createReadyTask());

    const taskResult = transitionAutonomousRunnerTask(runner, 'task-a', 'running', {
      now: '2026-04-28T10:01:00.000Z',
      reason: 'manual_running_without_lease',
    });
    const stepResult = transitionAutonomousRunnerStep(runner, 'task-a', 'step-test', 'running', {
      now: '2026-04-28T10:01:00.000Z',
      reason: 'manual_running_without_lease',
    });

    expect(taskResult.ok).toBe(false);
    expect(taskResult.reason).toBe(RUNNER_REASONS.RUNNING_REQUIRES_LEASE);
    expect(stepResult.ok).toBe(false);
    expect(stepResult.reason).toBe(RUNNER_REASONS.RUNNING_REQUIRES_LEASE);
  });

  it('rejects done transitions without execution, validation and evidence proof', () => {
    let runner = enqueueAutonomousRunnerTask(createEmptyAutonomousRunnerState(), createReadyTask());
    runner = acquireRunnerLease(runner, 'task-a', 'step-test', {
      now: '2026-04-28T10:01:00.000Z',
    }).runner;

    const stepResult = transitionAutonomousRunnerStep(runner, 'task-a', 'step-test', 'done', {
      now: '2026-04-28T10:02:00.000Z',
      reason: 'manual_done_without_proof',
      metadata: { validationPassed: true },
    });
    const taskResult = transitionAutonomousRunnerTask(runner, 'task-a', 'done', {
      now: '2026-04-28T10:02:00.000Z',
      reason: 'manual_done_without_proof',
      metadata: { executionVerified: true, validationPassed: true },
    });

    expect(stepResult.ok).toBe(false);
    expect(stepResult.reason).toBe(RUNNER_REASONS.DONE_REQUIRES_EXECUTION_VALIDATION_EVIDENCE);
    expect(taskResult.ok).toBe(false);
    expect(taskResult.reason).toBe(RUNNER_REASONS.DONE_REQUIRES_EXECUTION_VALIDATION_EVIDENCE);
  });
});

describe('autonomous runner lease and recovery', () => {
  it('creates lease and updates heartbeat', () => {
    const runner = enqueueAutonomousRunnerTask(createEmptyAutonomousRunnerState(), createReadyTask());
    const lease = acquireRunnerLease(runner, 'task-a', 'step-test', {
      now: '2026-04-28T10:00:00.000Z',
    });
    const heartbeat = heartbeatRunnerLease(lease.runner, lease.leaseId, {
      now: '2026-04-28T10:00:05.000Z',
    });

    expect(lease.ok).toBe(true);
    expect(heartbeat.runnerLock.heartbeatAt).toBe('2026-04-28T10:00:05.000Z');
    expect(heartbeat.tasksById['task-a'].status).toBe('running');
  });

  it('releases lease from lock and task record without leaving a stale task lease', () => {
    let runner = enqueueAutonomousRunnerTask(createEmptyAutonomousRunnerState(), createReadyTask());
    const lease = acquireRunnerLease(runner, 'task-a', 'step-test', {
      now: '2026-04-28T10:00:00.000Z',
    });
    runner = releaseRunnerLease(lease.runner, lease.leaseId, {
      now: '2026-04-28T10:00:10.000Z',
      reason: 'test_release',
    });

    expect(runner.runnerLock).toBeNull();
    expect(runner.activeTaskId).toBeNull();
    expect(runner.tasksById['task-a'].leaseId).toBeNull();
    expect(runner.tasksById['task-a'].heartbeatAt).toBeNull();
  });

  it('recovers stale running tasks on startup without assuming success', () => {
    let runner = enqueueAutonomousRunnerTask(createEmptyAutonomousRunnerState(), createReadyTask());
    runner = acquireRunnerLease(runner, 'task-a', 'step-test', {
      now: '2026-04-28T10:00:00.000Z',
      staleTimeoutMs: 1000,
    }).runner;
    const recovered = recoverAutonomousTasksOnStartup(runner, {
      now: '2026-04-28T10:10:00.000Z',
      nowMs: Date.parse('2026-04-28T10:10:00.000Z'),
    });

    expect(recovered.tasksById['task-a'].status).toBe('waiting_retry');
    expect(recovered.tasksById['task-a'].reason).toBe(RUNNER_REASONS.STALE_RUNNING_TASK);
    expect(recovered.tasksById['task-a'].steps[0].status).toBe('waiting_retry');
    expect(recovered.tasksById['task-a'].steps[0].reason).toBe(RUNNER_REASONS.STALE_RUNNING_TASK);
    expect(recovered.runnerLock).toBeNull();
  });

  it('does not record startup recovery noise during a clean tick', async () => {
    const result = await runAutonomousTaskRunnerTick({
      runner: { ...createEmptyAutonomousRunnerState(), enabled: true },
      nowMs: Date.parse('2026-04-28T10:00:00.000Z'),
    });

    expect(result.executed).toBe(false);
    expect(result.reason).toBe('no_eligible_task');
    expect(result.runner.audits.some((event) => event.type === 'startup_recovery')).toBe(false);
    expect(result.runner.audits.some((event) => event.type === 'runner_recovery')).toBe(false);
  });
});

describe('autonomous runner scheduler and preflight', () => {
  it('selects eligible tasks by priority and queueRank', () => {
    let runner = createEmptyAutonomousRunnerState();
    runner = enqueueAutonomousRunnerTask(runner, createReadyTask({ id: 'low', priority: 'low', queueRank: 0 }));
    runner = enqueueAutonomousRunnerTask(runner, createReadyTask({ id: 'critical', priority: 'critical', queueRank: 9 }));
    runner = enqueueAutonomousRunnerTask(runner, createReadyTask({ id: 'high', priority: 'high', queueRank: -1 }));

    const { eligible } = getEligibleRunnerTasks(runner);

    expect(eligible.map((task) => task.id)).toEqual(['critical', 'high', 'low']);
  });

  it('does not run task without completion criteria', () => {
    const task = createAutonomousRunnerTask({
      id: 'bad',
      title: 'Sem criterio',
      status: 'ready',
      steps: [{ ...executableStep, id: 'bad-step', completionCriteria: null }],
    });
    const runner = enqueueAutonomousRunnerTask(createEmptyAutonomousRunnerState(), task);
    const preflight = runAutonomousRunnerPreflight(
      { ...runner, enabled: true },
      runner.tasksById.bad,
      { vmStatus: { fallbackWorkspaceAvailable: true } },
    );

    expect(preflight.ok).toBe(false);
    expect(preflight.reason).toBe(RUNNER_REASONS.NO_EXECUTABLE_STEP);
  });

  it('moves VM-only task to waiting retry when VM is unavailable', () => {
    const task = createReadyTask({ requiresRealVm: true });
    const runner = enqueueAutonomousRunnerTask({ ...createEmptyAutonomousRunnerState(), enabled: true }, task);
    const preflight = runAutonomousRunnerPreflight(
      runner,
      runner.tasksById['task-a'],
      { vmStatus: { realVmAvailable: false, fallbackWorkspaceAvailable: true } },
    );

    expect(preflight.ok).toBe(false);
    expect(preflight.state).toBe('waiting_retry');
    expect(preflight.reason).toBe(RUNNER_REASONS.VM_UNAVAILABLE);
  });

  it('uses workspace fallback when VM is detected but guest commands are not ready', () => {
    const runner = enqueueAutonomousRunnerTask({ ...createEmptyAutonomousRunnerState(), enabled: true }, createReadyTask());
    const preflight = runAutonomousRunnerPreflight(
      runner,
      runner.tasksById['task-a'],
      {
        vmStatus: {
          realVmAvailable: true,
          guestCommandReady: false,
          fallbackWorkspaceAvailable: true,
        },
      },
    );

    expect(preflight.ok).toBe(true);
    expect(preflight.executionMode).toBe('local_workspace_fallback');
  });

  it('honors explicit workspace fallback environment even when guest commands are ready', () => {
    const task = createReadyTask({
      steps: [{
        ...executableStep,
        action: {
          ...executableStep.action,
          environment: 'local_workspace_fallback',
        },
      }],
    });
    const runner = enqueueAutonomousRunnerTask({ ...createEmptyAutonomousRunnerState(), enabled: true }, task);
    const preflight = runAutonomousRunnerPreflight(
      runner,
      runner.tasksById['task-a'],
      {
        vmStatus: {
          realVmAvailable: true,
          guestCommandReady: true,
          fallbackWorkspaceAvailable: true,
        },
      },
    );

    expect(preflight.ok).toBe(true);
    expect(preflight.executionMode).toBe('local_workspace_fallback');
  });
});

describe('autonomous runner execution', () => {
  it('executes a step, creates evidence and marks task done only after validation', async () => {
    const runner = enqueueAutonomousRunnerTask({ ...createEmptyAutonomousRunnerState(), enabled: true }, createReadyTask());
    const calls = [];
    const result = await runAutonomousTaskRunnerTick({
      runner,
      vmStatus: { realVmAvailable: false, fallbackWorkspaceAvailable: true },
      nowMs: Date.parse('2026-04-28T10:00:00.000Z'),
      invokeTool: createSuccessfulRunnerInvoke({ calls }),
    });

    expect(calls[0][0]).toBe('run_local_workspace_playground_task');
    expect(calls.some((call) => call[0] === 'save_runner_evidence')).toBe(true);
    expect(calls.some((call) => call[0] === 'verify_runner_evidence')).toBe(true);
    expect(result.task.status).toBe('done');
    expect(result.task.leaseId).toBeNull();
    expect(result.runner.runnerLock).toBeNull();
    expect(result.runner.evidenceRefs.length).toBeGreaterThan(0);
    expect(result.validationResult.passed).toBe(true);
    expect(result.validationResult.evidencePersistence.ok).toBe(true);
    expect(result.learningCandidates[0].status).toBe('candidate');
  });

  it('does not mark a step done when physical evidence persistence fails', async () => {
    const runner = enqueueAutonomousRunnerTask({ ...createEmptyAutonomousRunnerState(), enabled: true }, createReadyTask());
    const calls = [];
    const result = await runAutonomousTaskRunnerTick({
      runner,
      vmStatus: { realVmAvailable: false, fallbackWorkspaceAvailable: true },
      nowMs: Date.parse('2026-04-28T10:00:00.000Z'),
      invokeTool: async (name, payload) => {
        calls.push([name, payload]);
        if (name === 'save_runner_evidence') {
          throw new Error('disk full');
        }
        return {
          ok: true,
          message: 'tests passed',
          stdout: 'Tests passed',
          stderr: '',
          artifacts: { statusCode: 0, workspacePath: 'copy' },
        };
      },
    });

    expect(calls.some((call) => call[0] === 'save_runner_evidence')).toBe(true);
    expect(result.task.status).toBe('waiting_retry');
    expect(result.step.status).toBe('waiting_retry');
    expect(result.validationResult.reason).toBe(RUNNER_REASONS.EVIDENCE_PERSISTENCE_FAILED);
    expect(result.validationResult.evidencePersistence.ok).toBe(false);
    expect(result.evidenceRefs).toEqual([]);
    expect(result.runner.evidenceRefs).toEqual([]);
    expect(result.runner.audits.some((event) =>
      event.type === 'evidence_persistence' &&
      event.reason === RUNNER_REASONS.EVIDENCE_PERSISTENCE_FAILED &&
      event.summary.includes('Falha'),
    )).toBe(true);
  });

  it('does not mark a step done when physical evidence verification is partial', async () => {
    const runner = enqueueAutonomousRunnerTask({ ...createEmptyAutonomousRunnerState(), enabled: true }, createReadyTask());
    const result = await runAutonomousTaskRunnerTick({
      runner,
      vmStatus: { realVmAvailable: false, fallbackWorkspaceAvailable: true },
      nowMs: Date.parse('2026-04-28T10:00:00.000Z'),
      invokeTool: async (name, payload) => {
        if (name === 'save_runner_evidence') {
          return { ok: true, message: 'saved', artifacts: { executionId: payload.request.executionId } };
        }
        if (name === 'verify_runner_evidence') {
          return {
            ok: false,
            message: 'partial evidence',
            artifacts: {
              executionId: payload.request.executionId,
              status: 'partial',
              files: payload.request.files,
              existingFiles: ['metadata.json'],
              missingFiles: ['validation.json'],
            },
          };
        }
        return {
          ok: true,
          message: 'tests passed',
          stdout: 'Tests passed',
          stderr: '',
          artifacts: { statusCode: 0, workspacePath: 'copy' },
        };
      },
    });

    expect(result.task.status).toBe('waiting_retry');
    expect(result.validationResult.reason).toBe(RUNNER_REASONS.EVIDENCE_PERSISTENCE_FAILED);
    expect(result.evidencePersistence.status).toBe('partial');
    expect(result.evidencePersistence.missingFiles).toEqual(['validation.json']);
    expect(result.evidenceRefs).toEqual([]);
  });

  it('does not let an unavailable VM task block the next ready workspace task', async () => {
    let runner = { ...createEmptyAutonomousRunnerState(), enabled: true };
    runner = enqueueAutonomousRunnerTask(runner, createReadyTask({
      id: 'needs-vm',
      requiresRealVm: true,
      queueRank: 0,
      priority: 'critical',
    }));
    runner = enqueueAutonomousRunnerTask(runner, createReadyTask({
      id: 'workspace-ok',
      queueRank: 1,
      priority: 'high',
    }));

    const result = await runAutonomousTaskRunnerTick({
      runner,
      vmStatus: { realVmAvailable: false, fallbackWorkspaceAvailable: true },
      nowMs: Date.parse('2026-04-28T10:00:00.000Z'),
      invokeTool: createSuccessfulRunnerInvoke(),
    });

    expect(result.runner.tasksById['needs-vm'].status).toBe('waiting_retry');
    expect(result.task.id).toBe('workspace-ok');
    expect(result.task.status).toBe('done');
  });

  it('validation failure schedules retry and later respects max attempts', async () => {
    const task = createReadyTask({
      maxAttempts: 1,
      steps: [{ ...executableStep, maxAttempts: 1, retryPolicy: { maxAttempts: 1 } }],
    });
    const runner = enqueueAutonomousRunnerTask({ ...createEmptyAutonomousRunnerState(), enabled: true }, task);
    const result = await runAutonomousTaskRunnerTick({
      runner,
      vmStatus: { fallbackWorkspaceAvailable: true },
      nowMs: Date.parse('2026-04-28T10:00:00.000Z'),
      invokeTool: createSuccessfulRunnerInvoke({
        executionResult: {
          ok: false,
          message: 'tests failed',
          stdout: '',
          stderr: 'FAIL',
          artifacts: { statusCode: 1 },
        },
      }),
    });

    expect(result.task.status).toBe('failed');
    expect(result.task.reason).toBe(RUNNER_REASONS.MAX_ATTEMPTS_REACHED);
  });

  it('passes a file_exists smoke step with complete evidence requirements', async () => {
    const smokeStep = {
      ...executableStep,
      id: 'smoke-file-step',
      title: 'Criar arquivo smoke',
      type: 'command',
      action: {
        kind: 'command',
        command: 'node',
        args: ['-e', "require('fs').writeFileSync('runner-smoke-test.txt', 'runner-smoke-ok'); console.log('runner-smoke-ok')"],
      },
      completionCriteria: {
        type: 'file_exists',
        path: 'runner-smoke-test.txt',
      },
      expectedEvidence: {
        kind: 'complete',
        required: ['command', 'stdout', 'stderr', 'exitCode', 'validationResult'],
      },
    };
    const runner = enqueueAutonomousRunnerTask(
      { ...createEmptyAutonomousRunnerState(), enabled: true },
      createReadyTask({ id: 'smoke-file-task', steps: [smokeStep] }),
    );
    const calls = [];
    const result = await runAutonomousTaskRunnerTick({
      runner,
      vmStatus: { realVmAvailable: true, guestCommandReady: false, fallbackWorkspaceAvailable: true },
      nowMs: Date.parse('2026-04-28T10:00:00.000Z'),
      invokeTool: async (name, payload) => {
        calls.push([name, payload]);
        if (name === 'save_runner_evidence') {
          return { ok: true, artifacts: { evidenceDir: 'data/evidence/test' } };
        }
        if (name === 'verify_runner_evidence') {
          return {
            ok: true,
            message: 'verified',
            artifacts: {
              executionId: payload.request.executionId,
              status: 'ok',
              files: payload.request.files,
              existingFiles: payload.request.files,
              missingFiles: [],
            },
          };
        }
        return {
          ok: true,
          message: 'smoke created',
          stdout: 'runner-smoke-ok',
          stderr: '',
          artifacts: {
            statusCode: 0,
            files: ['runner-smoke-test.txt', 'input/runner-smoke-test.txt'],
          },
        };
      },
    });

    expect(calls[0][0]).toBe('run_local_workspace_playground_task');
    expect(calls.some((call) => call[0] === 'save_runner_evidence')).toBe(true);
    expect(calls.some((call) => call[0] === 'verify_runner_evidence')).toBe(true);
    expect(result.task.status).toBe('done');
    expect(result.step.status).toBe('done');
    expect(result.validationResult.passed).toBe(true);
    expect(result.evidenceRefs.map((ref) => ref.label)).toEqual(
      expect.arrayContaining(['metadata', 'stdout', 'stderr', 'validation']),
    );
  });

  it('stores evidence refs with the physical execution id returned by Tauri', async () => {
    const runner = enqueueAutonomousRunnerTask(
      { ...createEmptyAutonomousRunnerState(), enabled: true },
      createReadyTask({
        id: 'long-learning-task-id-that-would-be-sanitized-by-the-native-side',
        steps: [{
          ...executableStep,
          id: 'long-learning-step-id-that-would-also-be-sanitized-by-the-native-side',
        }],
      }),
    );
    const calls = [];
    const result = await runAutonomousTaskRunnerTick({
      runner,
      vmStatus: { fallbackWorkspaceAvailable: true },
      nowMs: Date.parse('2026-04-28T10:00:00.000Z'),
      invokeTool: async (name, payload) => {
        calls.push([name, payload]);
        if (name === 'save_runner_evidence') {
          return {
            ok: true,
            message: 'saved with native id',
            artifacts: { executionId: 'runner-exec-native-physical-id' },
          };
        }
        if (name === 'verify_runner_evidence') {
          return {
            ok: true,
            message: 'verified',
            artifacts: {
              executionId: payload.request.executionId,
              status: 'ok',
              files: payload.request.files,
              existingFiles: payload.request.files,
              missingFiles: [],
            },
          };
        }
        return {
          ok: true,
          message: 'tests passed',
          stdout: 'Tests passed',
          stderr: '',
          artifacts: { statusCode: 0, workspacePath: 'copy' },
        };
      },
    });

    const verifyCall = calls.find((call) => call[0] === 'verify_runner_evidence');
    expect(verifyCall[1].request.executionId).toBe('runner-exec-native-physical-id');
    expect(result.task.status).toBe('done');
    expect(result.evidenceRefs.every((ref) =>
      ref.executionId === 'runner-exec-native-physical-id' &&
      ref.path.startsWith('data/evidence/runner-exec-native-physical-id/'),
    )).toBe(true);
    expect(result.evidenceRefs.every((ref) => ref.metadata.physicalStatus === 'ok')).toBe(true);
  });
});

describe('autonomous runner evidence retention and volume hardening', () => {
  it('treats validationResult as produced evidence and still requires final validation ref', () => {
    const step = {
      ...executableStep,
      completionCriteria: { type: 'file_exists', path: 'runner-smoke-test.txt' },
      expectedEvidence: {
        kind: 'complete',
        required: ['command', 'stdout', 'stderr', 'exitCode', 'validationResult'],
      },
    };
    const task = createReadyTask({ steps: [step] });
    const executionResult = {
      ok: true,
      stdout: '',
      stderr: '',
      artifacts: {
        statusCode: 0,
        files: ['runner-smoke-test.txt'],
      },
    };
    const preliminaryEvidence = buildRunnerEvidenceFromExecution({
      task,
      step,
      executionResult,
      executionId: 'evidence-smoke',
      validationResult: null,
    });
    const validationResult = validateRunnerCompletionCriteria({
      step,
      executionResult,
      evidenceRefs: preliminaryEvidence,
    });
    const finalEvidence = buildRunnerEvidenceFromExecution({
      task,
      step,
      executionResult,
      executionId: 'evidence-smoke',
      validationResult,
    });

    expect(validationResult.passed).toBe(true);
    expect(finalEvidence.map((ref) => ref.label)).toEqual(
      expect.arrayContaining(['metadata', 'stdout', 'stderr', 'validation']),
    );
  });

  it('validates visual agent run_command output instead of treating HTTP 200 as the command exit code', () => {
    const step = {
      ...executableStep,
      completionCriteria: {
        type: 'file_contains',
        contains: 'alice-learning-vm:app-opened',
      },
      expectedEvidence: {
        kind: 'complete',
        required: ['stdout'],
      },
    };
    const validationResult = validateRunnerCompletionCriteria({
      step,
      executionResult: {
        ok: true,
        stdout: '',
        stderr: '',
        artifacts: {
          statusCode: 200,
          agentResponse: {
            success: true,
            result: {
              exit_code: 0,
              stdout: 'alice-learning-vm:app-opened\nprocess_id=123\nwindow_handle=456',
              stderr: '',
            },
          },
        },
      },
      evidenceRefs: [{
        id: 'stdout-ref',
        kind: 'stdout',
        label: 'stdout',
        path: 'data/evidence/exec/stdout.txt',
      }],
    });

    expect(validationResult.passed).toBe(true);
    expect(validationResult.commandResult.exitCode).toBe(0);
    expect(validationResult.commandResult.stdout).toContain('window_handle=456');
  });

  it('uses visual agent success as exit code for actions that do not return a process exit code', () => {
    const step = {
      ...executableStep,
      completionCriteria: { type: 'exit_code', expected: 0 },
      expectedEvidence: {
        kind: 'complete',
        required: ['stdout'],
      },
    };
    const validationResult = validateRunnerCompletionCriteria({
      step,
      executionResult: {
        ok: true,
        stdout: '',
        stderr: '',
        artifacts: {
          statusCode: 200,
          agentResponse: {
            success: true,
            result: {
              typed_length: 23,
              method: 'clipboard_paste',
            },
          },
        },
      },
      evidenceRefs: [{
        id: 'stdout-ref',
        kind: 'stdout',
        label: 'stdout',
        path: 'data/evidence/exec/stdout.txt',
      }],
    });

    expect(validationResult.passed).toBe(true);
    expect(validationResult.commandResult.exitCode).toBe(0);
    expect(validationResult.commandResult.stdout).toContain('clipboard_paste');
  });

  it('marks evidence refs with physical persistence status for HUD summaries', () => {
    const refs = applyRunnerEvidencePersistenceMetadata([
      createRunnerEvidenceRef({
        executionId: 'exec-1',
        taskId: 'task-a',
        stepId: 'step-test',
        kind: 'metadata',
        label: 'metadata',
        path: 'data/evidence/exec-1/metadata.json',
      }),
    ], {
      ok: true,
      status: 'ok',
      reason: 'evidence_persisted',
      executionId: 'exec-1',
      files: ['metadata.json'],
      checkedAt: '2026-04-28T10:00:00.000Z',
    });

    expect(refs[0].metadata.physicalStatus).toBe('ok');
    expect(summarizeRunnerEvidencePhysicalStatus(refs)).toMatchObject({
      status: 'ok',
      label: 'confirmada',
      confirmed: 1,
    });
    expect(summarizeRunnerEvidencePhysicalStatus([
      { ...refs[0], metadata: { physicalStatus: 'missing' } },
    ])).toMatchObject({
      status: 'missing',
      label: 'ausente',
    });
  });

  it('remaps evidence refs when native persistence returns a shortened physical execution id', () => {
    const refs = applyRunnerEvidencePersistenceMetadata([
      createRunnerEvidenceRef({
        executionId: 'runner-exec-very-long-logical-id',
        taskId: 'task-a',
        stepId: 'step-test',
        kind: 'metadata',
        label: 'metadata',
        path: 'data/evidence/runner-exec-very-long-logical-id/metadata.json',
      }),
    ], {
      ok: true,
      status: 'ok',
      reason: 'evidence_persisted',
      executionId: 'runner-exec-short-physical-id',
      files: ['metadata.json'],
      checkedAt: '2026-04-28T10:00:00.000Z',
    });

    expect(refs[0].executionId).toBe('runner-exec-short-physical-id');
    expect(refs[0].path).toBe('data/evidence/runner-exec-short-physical-id/metadata.json');
    expect(refs[0].metadata.physicalStatus).toBe('ok');
  });

  it('creates execution ids that fit the native evidence directory segment limit', () => {
    const executionId = createRunnerExecutionId(
      'learning-gap-browser-search-address-bar-with-a-very-long-task-id-that-would-otherwise-overflow',
      'prepare-learning-experiment-with-a-very-long-step-id-that-would-otherwise-overflow',
    );

    expect(executionId.length).toBeLessThanOrEqual(120);
    expect(executionId).toMatch(/^runner-exec-/);
  });

  it('preserves important and active evidence while pruning old success refs', () => {
    const baseRunner = enqueueAutonomousRunnerTask(
      createEmptyAutonomousRunnerState(),
      createReadyTask({
        id: 'active-task',
        status: 'running',
        leaseId: 'lease-active',
        activeStepId: 'step-test',
        heartbeatAt: '2026-04-28T10:00:00.000Z',
      }),
    );
    const successRef = (index) => createRunnerEvidenceRef({
      executionId: `success-${index}`,
      taskId: `success-task-${index}`,
      stepId: 'step-test',
      kind: 'metadata',
      label: `success-${index}`,
    });
    const activeRef = createRunnerEvidenceRef({
      executionId: 'active-exec',
      taskId: 'active-task',
      stepId: 'step-test',
      kind: 'metadata',
      label: 'active',
    });
    const failureRef = createRunnerEvidenceRef({
      executionId: 'failure-exec',
      taskId: 'failed-task',
      stepId: 'step-test',
      kind: 'stderr',
      label: 'failure',
      important: true,
    });

    const retained = applyRunnerEvidenceRetention({
      ...baseRunner,
      activeTaskId: 'active-task',
      runnerLock: {
        activeTaskId: 'active-task',
        activeStepId: 'step-test',
        leaseId: 'lease-active',
        acquiredAt: '2026-04-28T10:00:00.000Z',
        heartbeatAt: '2026-04-28T10:00:00.000Z',
      },
      settings: {
        ...baseRunner.settings,
        retention: {
          ...baseRunner.settings.retention,
          maxSuccessEvidence: 2,
        },
      },
      evidenceRefs: [
        successRef(1),
        successRef(2),
        successRef(3),
        activeRef,
        failureRef,
      ],
    });

    expect(retained.evidenceRefs.map((ref) => ref.label)).toEqual([
      'active',
      'failure',
      'success-2',
      'success-3',
    ]);
  });

  it('keeps scheduler ordering stable with many tasks and steps', () => {
    let runner = createEmptyAutonomousRunnerState();

    Array.from({ length: 50 }).forEach((_, index) => {
      runner = enqueueAutonomousRunnerTask(runner, createReadyTask({
        id: `task-${index}`,
        priority: index === 49 ? 'critical' : index % 3 === 0 ? 'high' : 'medium',
        queueRank: index,
        steps: [
          { ...executableStep, id: `step-${index}-a` },
          { ...executableStep, id: `step-${index}-b` },
        ],
      }));
    });

    const { eligible } = getEligibleRunnerTasks(runner);
    const totalSteps = Object.values(runner.tasksById)
      .reduce((sum, task) => sum + task.steps.length, 0);

    expect(Object.values(runner.tasksById)).toHaveLength(50);
    expect(totalSteps).toBe(100);
    expect(eligible[0].id).toBe('task-49');
    expect(eligible.every((task) => task.status === 'ready')).toBe(true);
  });
});

describe('autonomous runner planning, dependencies, map and tool', () => {
  it('autoplans command tasks and blocks tasks without executable context', () => {
    const planned = generateOperationalPlanForTask({
      id: 'planned',
      title: 'Build',
      command: 'npm',
      args: ['run', 'build'],
    });
    const missing = generateOperationalPlanForTask({ id: 'missing', title: 'Fazer algo' });

    expect(planned.ok).toBe(true);
    expect(planned.steps[0].completionCriteria.type).toBe('build_passed');
    expect(missing.ok).toBe(false);
    expect(missing.reason).toBe(RUNNER_REASONS.MISSING_CONTEXT);
  });

  it('keeps dependency waiting and detects recovery loop signatures', () => {
    const dependent = createReadyTask({
      id: 'dependent',
      dependencies: [{ taskId: 'base', requiredStatus: 'done' }],
    });
    const failedBase = createReadyTask({
      id: 'base',
      status: 'failed',
      executionHistory: [
        { command: 'npm test', validation: { reason: 'tests_failed' }, result: { stderr: 'same' } },
        { command: 'npm test', validation: { reason: 'tests_failed' }, result: { stderr: 'same' } },
      ],
    });
    let runner = createEmptyAutonomousRunnerState();
    runner = enqueueAutonomousRunnerTask(runner, failedBase);
    runner = enqueueAutonomousRunnerTask(runner, dependent);

    const { eligible, skipped } = getEligibleRunnerTasks(runner);

    expect(eligible.map((task) => task.id)).not.toContain('dependent');
    expect(skipped.find((item) => item.taskId === 'dependent').reason).toBe('dependency_failed');
    expect(detectRecoveryLoop(failedBase)).toBe(true);
  });

  it('syncs task and step status into the existing mind map model', () => {
    const map = syncMindMapWithRunnerTask(createStarterMindMap(), {
      ...createReadyTask({ status: 'running' }),
      steps: [{ ...createReadyTask().steps[0], status: 'running' }],
    });

    expect(map.nodes.some((node) => node.id === 'runner-task-task-a' && node.status === 'in_progress')).toBe(true);
    expect(map.edges.some((edge) => edge.label === 'step')).toBe(true);
  });

  it('compacts autonomous learning tasks in the mind map instead of creating one module per step', () => {
    const learningTask = {
      ...createReadyTask({
        id: 'learning-gap-field-1',
        title: 'Aprender campo de texto',
        status: 'done',
        metadata: {
          createdBy: 'autonomous_learning_loop',
          gapId: 'gap-text-field-interaction',
          capability: 'field.interaction',
          learningScenario: 'field_interaction',
        },
        steps: [
          { ...executableStep, id: 'prepare', title: 'Preparar', status: 'done' },
          { ...executableStep, id: 'try-field', title: 'Testar campo', status: 'done' },
        ],
      }),
    };

    const firstMap = syncMindMapWithRunnerTask(createStarterMindMap(), learningTask);
    const secondMap = syncMindMapWithRunnerTask(firstMap, {
      ...learningTask,
      id: 'learning-gap-field-2',
      title: 'Revalidar campo de texto',
      evidenceRefs: ['evidence-latest'],
    });
    const compactNodes = secondMap.nodes.filter((node) =>
      node.id === 'runner-compact-autonomous-learning-loop-field-interaction',
    );

    expect(firstMap.nodes.some((node) => node.id.startsWith('runner-step-learning-gap-field-1'))).toBe(false);
    expect(compactNodes).toHaveLength(1);
    expect(compactNodes[0].data.latestTaskId).toBe('learning-gap-field-2');
    expect(compactNodes[0].data.syncMode).toBe('compact_runner_task');
    expect(secondMap.edges.some((edge) => edge.label === 'aprendizado')).toBe(true);
  });

  it('replaces legacy detailed nodes for the same autonomous task with the compact summary', () => {
    const learningTask = createReadyTask({
      id: 'learning-gap-app-launch-safe-1',
      title: 'Aprender app launch',
      status: 'done',
      metadata: {
        createdBy: 'autonomous_learning_loop',
        gapId: 'gap-app-launch-safe',
        capability: 'app.launch',
      },
      steps: [
        { ...executableStep, id: 'prepare', title: 'Preparar', status: 'done' },
        { ...executableStep, id: 'launch', title: 'Abrir app', status: 'done' },
      ],
    });
    const legacyDetailedMap = syncMindMapWithRunnerTask(createStarterMindMap(), learningTask, {
      compactAutonomousTasks: false,
    });

    const compactedMap = syncMindMapWithRunnerTask(legacyDetailedMap, learningTask);

    expect(legacyDetailedMap.nodes.some((node) => node.id === 'runner-task-learning-gap-app-launch-safe-1')).toBe(true);
    expect(compactedMap.nodes.some((node) => node.id === 'runner-task-learning-gap-app-launch-safe-1')).toBe(false);
    expect(compactedMap.nodes.some((node) => node.id.startsWith('runner-step-learning-gap-app-launch-safe-1'))).toBe(false);
    expect(compactedMap.nodes.some((node) => node.id === 'runner-compact-autonomous-learning-loop-app-launch')).toBe(true);
  });

  it('enqueues and enables runner through the local tool executor', () => {
    let memory = createEmptyAliceMemory();
    const enabled = executeAutonomousRunnerFunctionCall({
      functionCall: { name: 'manage_autonomous_runner', args: { operation: 'enable' } },
      currentMemory: memory,
    });
    memory = enabled.memory;
    const enqueued = executeAutonomousRunnerFunctionCall({
      functionCall: {
        name: 'manage_autonomous_runner',
        args: {
          operation: 'enqueue_task',
          title: 'Rodar testes',
          command: 'npm',
          args: ['test'],
        },
      },
      currentMemory: memory,
    });

    const runner = getAutonomousRunnerState(enqueued.memory);
    expect(runner.enabled).toBe(true);
    expect(Object.values(runner.tasksById)).toHaveLength(1);
    expect(enqueued.response.summary.queueSize).toBe(1);
  });

  it('keeps manage_autonomous_runner routed to the Runner executor instead of legacy autonomy', async () => {
    const memory = createEmptyAliceMemory();
    const functionCall = { name: 'manage_autonomous_runner', args: { operation: 'status' } };
    const runnerResult = executeAutonomousRunnerFunctionCall({
      functionCall,
      currentMemory: memory,
    });
    const legacyResult = await executeAutonomousLearningFunctionCall({
      functionCall,
      currentMemory: memory,
      autonomousLearningState: {},
    });

    expect(runnerResult.handled).toBe(true);
    expect(runnerResult.response.runner).toBeTruthy();
    expect(legacyResult.handled).toBe(false);
  });

  it('persists runner state through aliceMemory helpers', () => {
    const memory = enqueueAutonomousRunnerMemoryTask(createEmptyAliceMemory(), {
      title: 'Persistida',
      command: 'npm',
      args: ['test'],
    });

    expect(getAutonomousRunnerState(memory).queue).toHaveLength(1);
  });
});
