import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ALICE_MEMORY_SCHEMA_VERSION,
  createEmptyAliceMemory,
  getAutonomousRunnerState,
} from '../aliceMemory';
import {
  RUNNER_TASK_STATUSES,
  createAutonomousRunnerTask,
  enqueueAutonomousRunnerTask,
} from '../autonomousRunnerState';
import {
  HARNESS_CREATED_BY,
  buildRunnerStateSnapshot,
  clearHarnessTasks,
  compactRunnerMemory,
  createHarnessBackup,
  isHarnessTask,
  listHarnessTasks,
  loadHarnessMemory,
  runHarnessCommand,
  saveHarnessMemory,
  seedFailureTask,
  seedLargeTask,
  seedSmokeTask,
  seedStaleRunningTask,
  verifySafeState,
  recoverHarnessStartup,
} from './autonomousRunnerHarness';

const realTask = createAutonomousRunnerTask({
  id: 'real-task',
  title: 'Task real',
  status: 'ready',
  steps: [
    {
      id: 'real-step',
      title: 'Step real',
      type: 'command',
      action: { kind: 'command', command: 'node', args: ['--version'] },
      completionCriteria: { type: 'exit_code', expected: 0 },
      expectedEvidence: { kind: 'complete', required: ['metadata'] },
    },
  ],
}, { now: '2026-04-28T10:00:00.000Z' });

let tempDir = '';

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alice-runner-harness-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('autonomous runner dev harness seeds', () => {
  it('seed-smoke creates a valid harness task without manual JSON edits', () => {
    const { memory, taskIds } = seedSmokeTask(createEmptyAliceMemory(), {
      now: '2026-04-28T10:00:00.000Z',
      enable: false,
    });
    const runner = getAutonomousRunnerState(memory);
    const task = runner.tasksById[taskIds[0]];

    expect(task.status).toBe(RUNNER_TASK_STATUSES.READY);
    expect(task.metadata.createdBy).toBe(HARNESS_CREATED_BY);
    expect(task.metadata.testScenario).toBe('smoke');
    expect(isHarnessTask(task)).toBe(true);
    expect(task.steps[0].completionCriteria.type).toBe('file_exists');
    expect(task.steps[0].expectedEvidence.required).toEqual(
      expect.arrayContaining(['command', 'stdout', 'stderr', 'exitCode', 'validationResult', 'metadata']),
    );
  });

  it('seed-failure creates a controlled failure task that is never pre-marked done', () => {
    const { memory, taskIds } = seedFailureTask(createEmptyAliceMemory(), {
      now: '2026-04-28T10:00:00.000Z',
      enable: false,
      maxAttempts: 1,
    });
    const task = getAutonomousRunnerState(memory).tasksById[taskIds[0]];

    expect(task.status).toBe(RUNNER_TASK_STATUSES.READY);
    expect(task.steps[0].action.command).toBe('comando_inexistente_runner_12345');
    expect(task.steps[0].completionCriteria).toMatchObject({ type: 'exit_code', expected: 0 });
    expect(task.steps[0].status).not.toBe(RUNNER_TASK_STATUSES.DONE);
  });

  it('seed-large-task creates multiple executable steps with criteria and expected evidence', () => {
    const { memory, taskIds } = seedLargeTask(createEmptyAliceMemory(), {
      now: '2026-04-28T10:00:00.000Z',
      enable: false,
    });
    const task = getAutonomousRunnerState(memory).tasksById[taskIds[0]];

    expect(task.steps.length).toBeGreaterThanOrEqual(5);
    expect(task.steps.every((step) => step.completionCriteria?.type)).toBe(true);
    expect(task.steps.every((step) => step.expectedEvidence?.kind === 'complete')).toBe(true);
    expect(task.steps.every((step) => step.action?.kind === 'command')).toBe(true);
  });

  it('seed-stale-running creates a state recoverable by the official startup recovery', () => {
    const seeded = seedStaleRunningTask(createEmptyAliceMemory(), {
      now: '2026-04-28T10:10:00.000Z',
      staleAt: '2026-04-28T10:00:00.000Z',
      enable: true,
    });
    const runner = getAutonomousRunnerState(seeded.memory);
    const task = runner.tasksById[seeded.taskIds[0]];

    expect(task.status).toBe(RUNNER_TASK_STATUSES.RUNNING);
    expect(runner.runnerLock.activeTaskId).toBe(task.id);

    const recovered = recoverHarnessStartup(seeded.memory, {
      now: '2026-04-28T10:20:00.000Z',
      nowMs: Date.parse('2026-04-28T10:20:00.000Z'),
    });
    const recoveredTask = getAutonomousRunnerState(recovered.memory).tasksById[task.id];

    expect(recoveredTask.status).toBe(RUNNER_TASK_STATUSES.WAITING_RETRY);
    expect(recoveredTask.reason).toBe('stale_running_task');
    expect(verifySafeState(recovered.memory).ok).toBe(true);
  });
});

describe('autonomous runner dev harness diagnostics and cleanup', () => {
  it('clear-test-tasks removes only harness tasks and keeps real tasks', () => {
    const seeded = seedSmokeTask(createEmptyAliceMemory(), {
      now: '2026-04-28T10:00:00.000Z',
      enable: false,
    });
    const withRealRunner = enqueueAutonomousRunnerTask(
      getAutonomousRunnerState(seeded.memory),
      realTask,
      { now: '2026-04-28T10:01:00.000Z' },
    );
    const withRealMemory = {
      ...seeded.memory,
      autonomousRunner: withRealRunner,
    };

    const cleared = clearHarnessTasks(withRealMemory, {
      now: '2026-04-28T10:02:00.000Z',
    });
    const runner = getAutonomousRunnerState(cleared.memory);

    expect(Object.keys(runner.tasksById)).toEqual(['real-task']);
    expect(runner.tasksById['real-task'].title).toBe('Task real');
    expect(cleared.removedTaskIds).toHaveLength(1);
  });

  it('compact-runner-memory trims audit history and preserves physical evidence by default', () => {
    const seeded = seedSmokeTask(createEmptyAliceMemory(), {
      now: '2026-04-28T10:00:00.000Z',
      enable: false,
    });
    const runner = getAutonomousRunnerState(seeded.memory);
    const task = runner.tasksById[seeded.taskIds[0]];
    const noisyRunner = {
      ...runner,
      tasksById: {
        ...runner.tasksById,
        [task.id]: {
          ...task,
          status: RUNNER_TASK_STATUSES.DONE,
          updatedAt: '2026-04-28T10:30:00.000Z',
          evidenceRefs: ['kept-ref'],
        },
      },
      evidenceRefs: Array.from({ length: 6 }, (_, index) => ({
        id: `evidence-${index}`,
        taskId: task.id,
        stepId: task.steps[0].id,
        executionId: `exec-${index}`,
        path: `data/evidence/exec-${index}/metadata.json`,
        kind: 'metadata',
        createdAt: `2026-04-28T10:0${index}:00.000Z`,
      })),
      audits: Array.from({ length: 10 }, (_, index) => ({
        id: `audit-${index}`,
        timestamp: `2026-04-28T10:${String(index).padStart(2, '0')}:00.000Z`,
        type: 'event',
        summary: `Audit ${index}`,
        metadata: { payload: 'x'.repeat(500) },
      })),
      auditRefs: Array.from({ length: 10 }, (_, index) => ({
        id: `audit-${index}`,
        timestamp: `2026-04-28T10:${String(index).padStart(2, '0')}:00.000Z`,
        type: 'event',
      })),
    };
    const memory = {
      ...seeded.memory,
      autonomousRunner: noisyRunner,
    };

    const compacted = compactRunnerMemory(memory, {
      now: '2026-04-28T10:40:00.000Z',
      keepAudits: 4,
      keepEvidenceRefs: 3,
      keepTerminalTasks: 1,
    });
    const compactedRunner = getAutonomousRunnerState(compacted.memory);

    expect(compactedRunner.tasksById[task.id]).toBeTruthy();
    expect(compactedRunner.audits).toHaveLength(4);
    expect(compactedRunner.audits.at(-1).type).toBe('harness_compaction');
    expect(compactedRunner.evidenceRefs.map((ref) => ref.id)).toEqual(['evidence-3', 'evidence-4', 'evidence-5']);
    expect(compacted.compaction.savedBytes).toBeGreaterThan(0);
    expect(compacted.compaction.removedEvidenceRefs).toEqual(['evidence-0', 'evidence-1', 'evidence-2']);
    expect(compacted.compaction.afterBytes).toBeLessThan(compacted.compaction.beforeBytes);
  });

  it('compact-runner-memory refuses unsafe running state unless forced', () => {
    const seeded = seedStaleRunningTask(createEmptyAliceMemory(), {
      now: '2026-04-28T10:10:00.000Z',
      staleAt: '2026-04-28T10:00:00.000Z',
      enable: true,
    });

    expect(() => compactRunnerMemory(seeded.memory, {
      now: '2026-04-28T10:20:00.000Z',
    })).toThrow(/nao esta SAFE/);
  });

  it('verify-safe-state detects lock and running tasks', () => {
    const seeded = seedStaleRunningTask(createEmptyAliceMemory(), {
      now: '2026-04-28T10:10:00.000Z',
      staleAt: '2026-04-28T10:00:00.000Z',
      enable: true,
    });
    const safeState = verifySafeState(seeded.memory);

    expect(safeState.ok).toBe(false);
    expect(safeState.issues.some((issue) => issue.includes('runnerLock exists'))).toBe(true);
    expect(safeState.issues.some((issue) => issue.includes('is running'))).toBe(true);
  });

  it('print-state snapshot handles empty memory', () => {
    const snapshot = buildRunnerStateSnapshot(createEmptyAliceMemory());

    expect(snapshot.runner.enabled).toBe(false);
    expect(snapshot.queue.total).toBe(0);
    expect(snapshot.safety.ok).toBe(true);
  });

  it('backup is created before mutation when memory file exists', () => {
    const memoryPath = path.join(tempDir, 'alice-memory.json');
    saveHarnessMemory(createEmptyAliceMemory(), { memoryPath });
    const backupPath = createHarnessBackup(memoryPath, {
      now: '2026-04-28T10:00:00.000Z',
    });

    expect(backupPath).toBeTruthy();
    expect(fs.existsSync(backupPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(backupPath, 'utf8')).schemaVersion).toBe(ALICE_MEMORY_SCHEMA_VERSION);
  });

  it('CLI seed and clear use the same persisted memory path', async () => {
    const memoryPath = path.join(tempDir, 'alice-memory.json');
    saveHarnessMemory(createEmptyAliceMemory(), { memoryPath });

    const seed = await runHarnessCommand([
      'seed-smoke',
      '--memory-path',
      memoryPath,
      '--no-enable',
    ]);
    const loadedAfterSeed = loadHarnessMemory({ memoryPath }).memory;

    expect(seed.output.taskIds).toHaveLength(1);
    expect(listHarnessTasks(loadedAfterSeed)).toHaveLength(1);

    await runHarnessCommand([
      'clear-test-tasks',
      '--memory-path',
      memoryPath,
    ]);
    const loadedAfterClear = loadHarnessMemory({ memoryPath }).memory;

    expect(listHarnessTasks(loadedAfterClear)).toHaveLength(0);
  });

  it('CLI cancel-task cancels an explicit task through memory helpers', async () => {
    const memoryPath = path.join(tempDir, 'alice-memory.json');
    const runner = enqueueAutonomousRunnerTask(
      getAutonomousRunnerState(createEmptyAliceMemory()),
      realTask,
      { now: '2026-04-28T10:00:00.000Z' },
    );
    saveHarnessMemory({
      ...createEmptyAliceMemory(),
      autonomousRunner: runner,
    }, { memoryPath });

    await runHarnessCommand([
      'cancel-task',
      'real-task',
      '--memory-path',
      memoryPath,
      '--reason',
      'test_cancel',
    ]);
    const task = getAutonomousRunnerState(loadHarnessMemory({ memoryPath }).memory).tasksById['real-task'];

    expect(task.status).toBe(RUNNER_TASK_STATUSES.CANCELLED);
    expect(task.reason).toBe('test_cancel');
  });

  it('CLI compact-runner-memory persists a smaller official memory file', async () => {
    const memoryPath = path.join(tempDir, 'alice-memory.json');
    const seeded = seedSmokeTask(createEmptyAliceMemory(), {
      now: '2026-04-28T10:00:00.000Z',
      enable: false,
    });
    const runner = getAutonomousRunnerState(seeded.memory);
    saveHarnessMemory({
      ...seeded.memory,
      autonomousRunner: {
        ...runner,
        audits: Array.from({ length: 12 }, (_, index) => ({
          id: `audit-${index}`,
          timestamp: `2026-04-28T10:${String(index).padStart(2, '0')}:00.000Z`,
          type: 'event',
          summary: `Audit ${index}`,
          metadata: { payload: 'x'.repeat(400) },
        })),
      },
    }, { memoryPath });
    const beforeBytes = fs.statSync(memoryPath).size;

    const result = await runHarnessCommand([
      'compact-runner-memory',
      '--memory-path',
      memoryPath,
      '--keep-audits',
      '3',
    ]);
    const afterBytes = fs.statSync(memoryPath).size;

    expect(result.output.compaction.afterAuditCount).toBe(3);
    expect(afterBytes).toBeLessThan(beforeBytes);
    expect(result.output.compaction.afterBytes).toBe(afterBytes - 1);
  });

  it('CLI autonomous-learning enable, scan, run-once and clear use official helpers', async () => {
    const memoryPath = path.join(tempDir, 'alice-memory.json');
    saveHarnessMemory(createEmptyAliceMemory(), { memoryPath });

    await runHarnessCommand(['autonomous-learning', 'disable', '--memory-path', memoryPath]);
    let state = await runHarnessCommand(['autonomous-learning', 'print-state', '--memory-path', memoryPath], {
      outputJson: true,
    });
    expect(JSON.parse(state.outputText).enabled).toBe(false);

    await runHarnessCommand(['autonomous-learning', 'enable', '--memory-path', memoryPath]);
    await runHarnessCommand([
      'autonomous-learning',
      'set-policy',
      '--memory-path',
      memoryPath,
      '--max-experiments-per-hour',
      '8',
      '--max-experiments-per-startup',
      '2',
      '--max-tasks-created-per-run',
      '2',
      '--max-promotions-per-run',
      '4',
      '--allowed-environments',
      'real_vm',
    ]);
    state = await runHarnessCommand(['autonomous-learning', 'print-state', '--memory-path', memoryPath], {
      outputJson: true,
    });
    expect(JSON.parse(state.outputText).policy).toMatchObject({
      maxExperimentsPerHour: 8,
      maxExperimentsPerStartup: 2,
      maxTasksCreatedPerRun: 2,
      maxPromotionsPerRun: 4,
      allowedEnvironments: ['real_vm'],
    });
    const scan = await runHarnessCommand(['autonomous-learning', 'scan', '--memory-path', memoryPath]);
    expect(scan.output.gaps.some((gap) => gap.gapId === 'gap-browser-search-address-bar')).toBe(true);

    const run = await runHarnessCommand(['autonomous-learning', 'run-once', '--memory-path', memoryPath]);
    expect(run.output.taskIds.length).toBeGreaterThanOrEqual(1);

    await runHarnessCommand(['autonomous-learning', 'clear-test-learning', '--memory-path', memoryPath]);
    const loaded = loadHarnessMemory({ memoryPath }).memory;
    expect(Object.values(getAutonomousRunnerState(loaded).tasksById)
      .some((task) => task.metadata?.createdBy === 'autonomous_learning_loop')).toBe(false);
  });

  it('CLI autonomous-learning add-goal stores broad goals with staged gaps', async () => {
    const memoryPath = path.join(tempDir, 'alice-memory.json');
    saveHarnessMemory(createEmptyAliceMemory(), { memoryPath });

    const result = await runHarnessCommand([
      'autonomous-learning',
      'add-goal',
      'Aprender a pesquisar documentacao em um site, validar a pagina e resumir conteudo',
      '--memory-path',
      memoryPath,
    ], { outputJson: true });
    const output = JSON.parse(result.outputText);
    const loaded = loadHarnessMemory({ memoryPath }).memory;

    expect(output.goalId).toMatch(/^learning-goal-/);
    expect(loaded.autonomousLearning.learningGoals).toHaveLength(1);
    expect(loaded.autonomousLearning.learningGoals[0].broad).toBe(true);
    expect(loaded.autonomousLearning.learningGoals[0].stages.map((stage) => stage.type)).toEqual(
      expect.arrayContaining(['browser_search', 'page_validation', 'page_read']),
    );

    const goals = await runHarnessCommand([
      'autonomous-learning',
      'print-goals',
      '--memory-path',
      memoryPath,
    ], { outputJson: true });
    expect(JSON.parse(goals.outputText)[0].goalId).toBe(output.goalId);
  });

  it('CLI autonomous-learning clear-learned removes learned procedures and can disable learning', async () => {
    const memoryPath = path.join(tempDir, 'alice-memory.json');
    saveHarnessMemory({
      ...createEmptyAliceMemory(),
      proceduralMemory: {
        procedures: [
          {
            procedureId: 'procedure_browser_search',
            title: 'Pesquisar no navegador',
            source: 'autonomous_learning_loop',
            status: 'guarded',
            confidence: 0.8,
            capabilities: ['browser.search'],
          },
          {
            procedureId: 'procedure_user_kept',
            title: 'Procedimento manual',
            source: 'user',
            status: 'active',
            confidence: 0.9,
            capabilities: ['user.preference'],
          },
        ],
      },
      autonomousLearning: {
        ...createEmptyAliceMemory().autonomousLearning,
        procedureCandidates: [{ candidateId: 'candidate-1', procedureId: 'procedure_browser_search' }],
        promotedProcedures: [{
          procedureId: 'procedure_browser_search',
          title: 'Pesquisar no navegador',
          summary: 'Aprendizado autonomo de busca.',
          source: 'autonomous_learning_loop',
          status: 'guarded',
          confidence: 0.8,
          environment: 'real_vm',
          environments: ['real_vm'],
          capabilities: ['browser.search'],
        }],
        generatedScripts: [{ scriptId: 'script-1' }],
      },
    }, { memoryPath });

    const result = await runHarnessCommand([
      'autonomous-learning',
      'clear-learned',
      '--disable',
      '--memory-path',
      memoryPath,
    ], { outputJson: true });
    const output = JSON.parse(result.outputText);
    const loaded = loadHarnessMemory({ memoryPath }).memory;

    expect(output.removedLearning).toMatchObject({
      procedureCandidates: 1,
      promotedProcedures: 1,
      generatedScripts: 1,
      proceduralMemoryProcedures: 1,
      disabled: true,
    });
    expect(loaded.autonomousLearning.enabled).toBe(false);
    expect(loaded.autonomousLearning.procedureCandidates).toEqual([]);
    expect(loaded.autonomousLearning.promotedProcedures).toEqual([]);
    expect(loaded.proceduralMemory.procedures.map((procedure) => procedure.procedureId))
      .toEqual(['procedure_user_kept']);
  });

  it('CLI autonomous-reuse can simulate a match without creating Runner tasks', async () => {
    const memoryPath = path.join(tempDir, 'alice-memory.json');
    saveHarnessMemory({
      ...createEmptyAliceMemory(),
      proceduralMemory: {
        procedures: [
          {
            procedureId: 'procedure_browser_search_address_bar',
            title: 'Pesquisar no navegador pela barra de endereco',
            summary: 'Usa Ctrl+L para pesquisar.',
            steps: ['Ctrl+L', 'digitar', 'Enter'],
            status: 'active',
            confidence: 0.9,
            capabilities: ['browser.search'],
            evidenceRefs: [{ id: 'evidence-1' }],
          },
        ],
      },
    }, { memoryPath });

    const result = await runHarnessCommand([
      'autonomous-reuse',
      'simulate',
      'Pesquisar documentacao sobre erro X',
      '--memory-path',
      memoryPath,
    ], { outputJson: true });
    const output = JSON.parse(result.outputText);

    expect(output.matches[0].procedureId).toBe('procedure_browser_search_address_bar');
    expect(loadHarnessMemory({ memoryPath }).memory.autonomousRunner.queue).toHaveLength(0);
  });
});
