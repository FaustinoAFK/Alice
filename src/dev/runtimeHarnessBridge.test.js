import { describe, expect, it } from 'vitest';
import {
  createEmptyAliceMemory,
  getAutonomousRunnerState,
} from '../aliceMemory';
import {
  RUNTIME_HARNESS_CREATED_BY,
  RUNTIME_TEXT_INPUT_NEGATIVE_SMOKE_REQUEST,
  RUNTIME_TEXT_INPUT_NEGATIVE_SMOKE_SCENARIO,
  RUNTIME_TEXT_INPUT_SMOKE_REQUEST,
  RUNTIME_TEXT_INPUT_SMOKE_SCENARIO,
  applyRuntimeHarnessRequests,
  createRuntimeTextInputNegativeSmokeTask,
  createRuntimeTextInputSmokeTask,
} from './runtimeHarnessBridge';

describe('runtime harness bridge', () => {
  it('creates a real VM text input smoke task with runtime metadata', () => {
    const task = createRuntimeTextInputSmokeTask({
      requestId: 'request-1',
      now: '2026-05-04T10:00:00.000Z',
    });

    expect(task.requiresRealVm).toBe(true);
    expect(task.allowWorkspaceFallback).toBe(false);
    expect(task.metadata).toMatchObject({
      createdBy: RUNTIME_HARNESS_CREATED_BY,
      testScenario: RUNTIME_TEXT_INPUT_SMOKE_SCENARIO,
      requestId: 'request-1',
      inputDriver: 'vmTextInputDriver',
    });
    expect(task.steps[0].action.kind).toBe('visual');
    expect(task.steps[0].action.parameters.args.join(' ')).toContain('vmTextInputDriver');
    expect(task.steps[0].completionCriteria).toMatchObject({
      type: 'file_contains',
      contains: 'alice-learning-vm:field-interacted',
    });
  });

  it('creates a negative real VM text input smoke task with expected and actual text separated', () => {
    const task = createRuntimeTextInputNegativeSmokeTask({
      requestId: 'negative-request-1',
      now: '2026-05-04T10:00:00.000Z',
    });
    const script = task.steps[0].action.parameters.args.join(' ');

    expect(task.requiresRealVm).toBe(true);
    expect(task.allowWorkspaceFallback).toBe(false);
    expect(task.metadata).toMatchObject({
      createdBy: RUNTIME_HARNESS_CREATED_BY,
      testScenario: RUNTIME_TEXT_INPUT_NEGATIVE_SMOKE_SCENARIO,
      requestId: 'negative-request-1',
      inputDriver: 'vmTextInputDriver',
      expectedValidationPassed: false,
      sendKeysFallbackAllowed: false,
      closeExistingTargetProcesses: true,
      forceMismatchFileOnActivationFailure: true,
    });
    expect(task.metadata.controlledExpectedText).not.toBe(task.metadata.controlledActualText);
    expect(script).toContain('$text = ');
    expect(script).toContain('$inputText = ');
    expect(script).toContain('alice text input smoke expected real vm ok');
    expect(script).toContain('alice text input smoke actual real vm mismatch');
    expect(script).toContain('$allowSendKeysFallback = $false');
    expect(script).toContain('$closeExistingTargetProcesses = $true');
    expect(script).toContain('$forceMismatchFileOnActivationFailure = $true');
    expect(script).toContain('controlled_text_file_mismatch');
  });

  it('applies a runtime request through official runner state helpers', () => {
    const result = applyRuntimeHarnessRequests(createEmptyAliceMemory(), [{
      requestId: 'runtime-request-1',
      type: RUNTIME_TEXT_INPUT_SMOKE_REQUEST,
      createdBy: RUNTIME_HARNESS_CREATED_BY,
      testScenario: RUNTIME_TEXT_INPUT_SMOKE_SCENARIO,
      enableRunner: true,
    }], {
      now: '2026-05-04T10:00:00.000Z',
    });
    const runner = getAutonomousRunnerState(result.memory);
    const task = runner.tasksById[result.taskIds[0]];

    expect(result.processedRequestIds).toEqual(['runtime-request-1']);
    expect(runner.enabled).toBe(true);
    expect(task.metadata.createdBy).toBe(RUNTIME_HARNESS_CREATED_BY);
    expect(task.metadata.testScenario).toBe(RUNTIME_TEXT_INPUT_SMOKE_SCENARIO);
    expect(task.status).toBe('ready');
  });

  it('applies a negative runtime request through official runner state helpers', () => {
    const result = applyRuntimeHarnessRequests(createEmptyAliceMemory(), [{
      requestId: 'runtime-negative-request-1',
      type: RUNTIME_TEXT_INPUT_NEGATIVE_SMOKE_REQUEST,
      createdBy: RUNTIME_HARNESS_CREATED_BY,
      testScenario: RUNTIME_TEXT_INPUT_NEGATIVE_SMOKE_SCENARIO,
      enableRunner: true,
    }], {
      now: '2026-05-04T10:00:00.000Z',
    });
    const runner = getAutonomousRunnerState(result.memory);
    const task = runner.tasksById[result.taskIds[0]];

    expect(result.processedRequestIds).toEqual(['runtime-negative-request-1']);
    expect(runner.enabled).toBe(true);
    expect(task.metadata.createdBy).toBe(RUNTIME_HARNESS_CREATED_BY);
    expect(task.metadata.testScenario).toBe(RUNTIME_TEXT_INPUT_NEGATIVE_SMOKE_SCENARIO);
    expect(task.status).toBe('ready');
  });

  it('deduplicates repeated runtime requests by requestId', () => {
    const request = {
      requestId: 'runtime-request-1',
      type: RUNTIME_TEXT_INPUT_SMOKE_REQUEST,
      createdBy: RUNTIME_HARNESS_CREATED_BY,
      testScenario: RUNTIME_TEXT_INPUT_SMOKE_SCENARIO,
    };
    const first = applyRuntimeHarnessRequests(createEmptyAliceMemory(), [request], {
      now: '2026-05-04T10:00:00.000Z',
    });
    const second = applyRuntimeHarnessRequests(first.memory, [request], {
      now: '2026-05-04T10:01:00.000Z',
    });

    expect(Object.values(getAutonomousRunnerState(second.memory).tasksById)
      .filter((task) => task.metadata?.requestId === 'runtime-request-1')).toHaveLength(1);
    expect(second.taskIds).toEqual(first.taskIds);
  });
});
