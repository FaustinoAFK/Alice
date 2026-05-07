import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createEmptyAliceMemory,
  getAutonomousLearningMemoryState,
  getAutonomousRunnerState,
} from '../aliceMemory';
import {
  LEARNING_HARNESS_CREATED_BY,
  LEARNING_HARNESS_SCENARIO,
  applyLearningHarnessCommand,
  clearLearningHarnessTestData,
  createHarnessLearningRequest,
  printLearningState,
  runLearningHarnessCommand,
  verifyLearningSafeState,
} from './learningPlannerHarness';
import {
  loadHarnessMemory,
  saveHarnessMemory,
} from './autonomousRunnerHarness';

let tempDir = '';

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alice-learning-harness-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

const runSeedAndPlan = async (memory = createEmptyAliceMemory()) => {
  const seeded = await applyLearningHarnessCommand(
    memory,
    'seed-learning-request',
    ['Aprender rotina segura pelo harness'],
    {},
  );
  const generated = await applyLearningHarnessCommand(
    seeded.memory,
    'generate-plan',
    [seeded.request.requestId],
    {},
  );
  return { seeded, generated };
};

describe('Learning Planner dev harness', () => {
  it('seeds a marked learning request', async () => {
    const result = await applyLearningHarnessCommand(
      createEmptyAliceMemory(),
      'seed-learning-request',
      ['Aprender browser controlado'],
      { now: '2026-05-04T03:00:00.000Z' },
    );
    const state = printLearningState(result.memory);

    expect(result.request.requestedBy).toBe(LEARNING_HARNESS_CREATED_BY);
    expect(result.request.context.testScenario).toBe(LEARNING_HARNESS_SCENARIO);
    expect(state.requests[0]).toMatchObject({
      requestId: result.request.requestId,
      requestedBy: LEARNING_HARNESS_CREATED_BY,
      testScenario: LEARNING_HARNESS_SCENARIO,
    });
  });

  it('generates a mock harness plan', async () => {
    const { seeded, generated } = await runSeedAndPlan();
    const state = printLearningState(generated.memory);

    expect(generated.plan.requestId).toBe(seeded.request.requestId);
    expect(generated.plan.createdBy).toBe(LEARNING_HARNESS_CREATED_BY);
    expect(generated.validation.ok).toBe(true);
    expect(state.plans[0]).toMatchObject({
      planId: generated.plan.planId,
      createdBy: LEARNING_HARNESS_CREATED_BY,
      status: 'validated',
    });
  });

  it('validates a safe generated plan', async () => {
    const { generated } = await runSeedAndPlan();
    const validation = await applyLearningHarnessCommand(
      generated.memory,
      'validate-plan',
      [generated.plan.planId],
      {},
    );

    expect(validation.memory).toBe(generated.memory);
    expect(verifyLearningSafeState(generated.memory).ok).toBe(true);
  });

  it('compiles a dry-run task without enqueueing it', async () => {
    const { generated } = await runSeedAndPlan();
    const compiled = await applyLearningHarnessCommand(
      generated.memory,
      'compile-plan',
      [generated.plan.planId],
      {},
    );
    const runner = getAutonomousRunnerState(generated.memory);

    expect(compiled.memory).toBe(generated.memory);
    expect(runner.queue).toEqual([]);
  });

  it('CLI validate-plan and compile-plan expose safe dry-run output', async () => {
    const memoryPath = path.join(tempDir, 'alice-memory.json');
    saveHarnessMemory(createEmptyAliceMemory(), { memoryPath });
    const seed = await runLearningHarnessCommand([
      'seed-learning-request',
      'Aprender via CLI',
      '--memory-path',
      memoryPath,
    ], { outputJson: true });
    const requestId = JSON.parse(seed.outputText).requestId;
    const generated = await runLearningHarnessCommand([
      'generate-plan',
      requestId,
      '--memory-path',
      memoryPath,
    ], { outputJson: true });
    const planId = JSON.parse(generated.outputText).planId;
    const validation = await runLearningHarnessCommand([
      'validate-plan',
      planId,
      '--memory-path',
      memoryPath,
    ], { outputJson: true });
    const compiled = await runLearningHarnessCommand([
      'compile-plan',
      planId,
      '--memory-path',
      memoryPath,
    ], { outputJson: true });

    expect(JSON.parse(validation.outputText).decision).toBe('approved');
    expect(JSON.parse(compiled.outputText).tasks).toHaveLength(1);
    expect(loadHarnessMemory({ memoryPath }).memory.autonomousRunner.queue).toEqual([]);
    expect(seed.backupPath).toBeTruthy();
    expect(fs.existsSync(seed.backupPath)).toBe(true);
  });

  it('verifies learning safe state', async () => {
    const { generated } = await runSeedAndPlan();
    const safeState = verifyLearningSafeState(generated.memory);

    expect(safeState.ok).toBe(true);
    expect(safeState.issues).toEqual([]);
  });

  it('clears only harness-created data', async () => {
    const { generated } = await runSeedAndPlan({
      ...createEmptyAliceMemory(),
      autonomousLearning: {
        ...createEmptyAliceMemory().autonomousLearning,
        procedureCandidates: [
          {
            candidateId: 'real-candidate',
            title: 'Real candidate',
            status: 'candidate',
            source: 'user',
          },
        ],
      },
    });
    const enqueued = await applyLearningHarnessCommand(
      generated.memory,
      'enqueue-learning-task',
      [generated.plan.planId],
      {},
    );
    const realRequest = createHarnessLearningRequest({
      requestId: 'real-looking-request',
      objective: 'Nao remover se nao estiver no estado',
    });
    const withRealPlan = {
      ...enqueued.memory,
      autonomousLearning: {
        ...enqueued.memory.autonomousLearning,
        learningPlanner: {
          ...enqueued.memory.autonomousLearning.learningPlanner,
          learningRequests: [
            ...(enqueued.memory.autonomousLearning.learningPlanner.learningRequests || []),
            { ...realRequest, requestedBy: 'user', context: {} },
          ],
        },
      },
    };
    const cleared = clearLearningHarnessTestData(withRealPlan, {
      now: '2026-05-04T03:30:00.000Z',
    });
    const state = printLearningState(cleared.memory);
    const learning = getAutonomousLearningMemoryState(cleared.memory);
    const runner = getAutonomousRunnerState(cleared.memory);

    expect(cleared.removedLearning.requests).toBe(1);
    expect(cleared.removedLearning.plans).toBe(1);
    expect(cleared.removedLearning.runnerTasks).toBe(1);
    expect(state.plans).toEqual([]);
    expect(state.requests.map((request) => request.requestId)).toEqual(['real-looking-request']);
    expect(Object.values(runner.tasksById)).toEqual([]);
    expect(learning.procedureCandidates.map((candidate) => candidate.candidateId)).toEqual(['real-candidate']);
  });
});
