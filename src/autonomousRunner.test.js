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
  transitionAutonomousRunnerTask,
} from './autonomousRunnerState';
import {
  acquireRunnerLease,
  heartbeatRunnerLease,
  recoverAutonomousTasksOnStartup,
} from './autonomousRunnerLease';
import { getEligibleRunnerTasks } from './autonomousRunnerScheduler';
import { runAutonomousRunnerPreflight } from './autonomousRunnerPreflight';
import { runAutonomousTaskRunnerTick } from './autonomousTaskRunner';
import { generateOperationalPlanForTask } from './autonomousRunnerPlanner';
import { detectRecoveryLoop } from './autonomousRunnerRecoveryPlanner';
import { syncMindMapWithRunnerTask } from './autonomousRunnerMindMap';
import { createStarterMindMap } from './hud/mindMap/utils/mindMapData';
import { executeAutonomousRunnerFunctionCall } from './autonomousRunnerToolExecutor';

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
    expect(recovered.runnerLock).toBeNull();
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
});

describe('autonomous runner execution', () => {
  it('executes a step, creates evidence and marks task done only after validation', async () => {
    const runner = enqueueAutonomousRunnerTask({ ...createEmptyAutonomousRunnerState(), enabled: true }, createReadyTask());
    const calls = [];
    const result = await runAutonomousTaskRunnerTick({
      runner,
      vmStatus: { realVmAvailable: false, fallbackWorkspaceAvailable: true },
      nowMs: Date.parse('2026-04-28T10:00:00.000Z'),
      invokeTool: async (name, payload) => {
        calls.push([name, payload]);
        return {
          ok: true,
          message: 'tests passed',
          stdout: 'Tests passed',
          stderr: '',
          artifacts: { statusCode: 0, workspacePath: 'copy' },
        };
      },
    });

    expect(calls[0][0]).toBe('run_local_workspace_playground_task');
    expect(result.task.status).toBe('done');
    expect(result.runner.evidenceRefs.length).toBeGreaterThan(0);
    expect(result.validationResult.passed).toBe(true);
    expect(result.learningCandidates[0].status).toBe('candidate');
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
      invokeTool: async () => ({
        ok: true,
        message: 'ok',
        stdout: 'Tests passed',
        stderr: '',
        artifacts: { statusCode: 0 },
      }),
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
      invokeTool: async () => ({
        ok: false,
        message: 'tests failed',
        stdout: '',
        stderr: 'FAIL',
        artifacts: { statusCode: 1 },
      }),
    });

    expect(result.task.status).toBe('failed');
    expect(result.task.reason).toBe(RUNNER_REASONS.MAX_ATTEMPTS_REACHED);
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

  it('persists runner state through aliceMemory helpers', () => {
    const memory = enqueueAutonomousRunnerMemoryTask(createEmptyAliceMemory(), {
      title: 'Persistida',
      command: 'npm',
      args: ['test'],
    });

    expect(getAutonomousRunnerState(memory).queue).toHaveLength(1);
  });
});
