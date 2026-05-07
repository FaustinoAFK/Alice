import {
  enqueueAutonomousRunnerMemoryTask,
  getAutonomousRunnerState,
  setAutonomousRunnerMemoryEnabled,
} from '../aliceMemory';
import { buildNotepadControlledTextInputScript } from '../autonomousLearning/vmTextInputDriver';
import { RUNNER_TASK_STATUSES } from '../autonomousRunnerState';

export const RUNTIME_HARNESS_CREATED_BY = 'runtime_harness';
export const RUNTIME_TEXT_INPUT_SMOKE_SCENARIO = 'text-input-driver-v2-real-vm';
export const RUNTIME_TEXT_INPUT_SMOKE_REQUEST = 'runtime_text_input_smoke';
export const RUNTIME_TEXT_INPUT_NEGATIVE_SMOKE_SCENARIO = 'text-input-driver-v2-negative-real-vm';
export const RUNTIME_TEXT_INPUT_NEGATIVE_SMOKE_REQUEST = 'runtime_text_input_negative_smoke';

const VM_POWERSHELL_EXE = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const FIELD_INTERACTED_MARKER = 'alice-learning-vm:field-interacted';
const COMPLETE_EVIDENCE = {
  kind: 'complete',
  required: ['command', 'stdout', 'stderr', 'exitCode', 'validationResult', 'metadata'],
};

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const toSafeIdPart = (value) =>
  normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'request';

const timestampId = (now) => {
  const parsed = Date.parse(now || '');
  return Number.isFinite(parsed) ? String(parsed) : String(Date.now());
};

const quotePowerShellString = (value = '') =>
  `'${String(value).replace(/'/g, "''")}'`;

const powerShellArgs = (script = '') => [
  '-NoProfile',
  '-ExecutionPolicy',
  'Bypass',
  '-Command',
  script,
];

export const createRuntimeTextInputSmokeRequest = ({
  requestId = '',
  now = new Date().toISOString(),
} = {}) => {
  const safeRequestId = toSafeIdPart(requestId || `runtime-text-input-smoke-${timestampId(now)}`);
  return {
    requestId: safeRequestId,
    type: RUNTIME_TEXT_INPUT_SMOKE_REQUEST,
    createdBy: RUNTIME_HARNESS_CREATED_BY,
    testScenario: RUNTIME_TEXT_INPUT_SMOKE_SCENARIO,
    createdAt: now,
    enableRunner: true,
  };
};

export const createRuntimeTextInputSmokeTask = ({
  requestId = '',
  now = new Date().toISOString(),
} = {}) => {
  const safeRequestId = toSafeIdPart(requestId || `runtime-text-input-smoke-${timestampId(now)}`);
  const expectedText = 'alice text input smoke real vm ok';
  const script = [
    "$ErrorActionPreference = 'Stop'",
    buildNotepadControlledTextInputScript({
      text: expectedText,
      fileName: `alice-runtime-text-input-smoke-${safeRequestId}.txt`,
      marker: FIELD_INTERACTED_MARKER,
    }),
    `Write-Output ${quotePowerShellString(FIELD_INTERACTED_MARKER)}`,
  ].join('; ');

  return {
    id: `runner-runtime-text-input-smoke-${safeRequestId}-${timestampId(now)}`,
    title: 'Smoke real de input de texto na VM',
    description: 'Executa Notepad na VM pelo Runner oficial e valida arquivo fisico com texto controlado.',
    status: RUNNER_TASK_STATUSES.READY,
    priority: 'critical',
    riskLevel: 'harness',
    requiresRealVm: true,
    allowWorkspaceFallback: false,
    maxAttempts: 1,
    requestedResources: {
      harness: {
        createdBy: RUNTIME_HARNESS_CREATED_BY,
        testScenario: RUNTIME_TEXT_INPUT_SMOKE_SCENARIO,
        requestId: safeRequestId,
      },
    },
    metadata: {
      createdBy: RUNTIME_HARNESS_CREATED_BY,
      testScenario: RUNTIME_TEXT_INPUT_SMOKE_SCENARIO,
      requestId: safeRequestId,
      controlledText: expectedText,
      inputDriver: 'vmTextInputDriver',
      expectedPrimaryInputMethod: 'clipboard_paste',
      sendKeysFallbackAllowed: true,
      createdAt: now,
      tags: ['runtime-harness', 'real-vm', 'text-input-driver-v2'],
    },
    steps: [
      {
        id: 'runtime-vm-notepad-text-input',
        title: 'VM: preencher Notepad por clipboard e validar arquivo fisico',
        type: 'visual',
        action: {
          kind: 'visual',
          visualAction: 'run_command',
          parameters: {
            command: VM_POWERSHELL_EXE,
            args: powerShellArgs(script),
            timeout_seconds: 30,
          },
          environment: 'real_vm',
          requestedResources: {
            runtimeHarness: {
              createdBy: RUNTIME_HARNESS_CREATED_BY,
              testScenario: RUNTIME_TEXT_INPUT_SMOKE_SCENARIO,
              requestId: safeRequestId,
              controlledText: expectedText,
            },
          },
        },
        completionCriteria: {
          type: 'file_contains',
          contains: FIELD_INTERACTED_MARKER,
        },
        expectedEvidence: COMPLETE_EVIDENCE,
        retryPolicy: { maxAttempts: 1, backoff: 'none' },
        maxAttempts: 1,
      },
    ],
  };
};

export const createRuntimeTextInputNegativeSmokeRequest = ({
  requestId = '',
  now = new Date().toISOString(),
} = {}) => {
  const safeRequestId = toSafeIdPart(requestId || `runtime-text-input-negative-smoke-${timestampId(now)}`);
  return {
    requestId: safeRequestId,
    type: RUNTIME_TEXT_INPUT_NEGATIVE_SMOKE_REQUEST,
    createdBy: RUNTIME_HARNESS_CREATED_BY,
    testScenario: RUNTIME_TEXT_INPUT_NEGATIVE_SMOKE_SCENARIO,
    createdAt: now,
    enableRunner: true,
  };
};

export const createRuntimeTextInputNegativeSmokeTask = ({
  requestId = '',
  now = new Date().toISOString(),
} = {}) => {
  const safeRequestId = toSafeIdPart(requestId || `runtime-text-input-negative-smoke-${timestampId(now)}`);
  const expectedText = 'alice text input smoke expected real vm ok';
  const actualText = 'alice text input smoke actual real vm mismatch';
  const script = [
    "$ErrorActionPreference = 'Stop'",
    buildNotepadControlledTextInputScript({
      text: expectedText,
      expectedText,
      inputText: actualText,
      fileName: `alice-runtime-text-input-negative-smoke-${safeRequestId}.txt`,
      marker: FIELD_INTERACTED_MARKER,
      allowSendKeysFallback: false,
      closeExistingTargetProcesses: true,
      forceMismatchFileOnActivationFailure: true,
    }),
    `Write-Output ${quotePowerShellString(FIELD_INTERACTED_MARKER)}`,
  ].join('; ');

  return {
    id: `runner-runtime-text-input-negative-smoke-${safeRequestId}-${timestampId(now)}`,
    title: 'Smoke negativo real de input de texto na VM',
    description: 'Executa Notepad na VM pelo Runner oficial e valida que divergencia controlada falha com diagnostico.',
    status: RUNNER_TASK_STATUSES.READY,
    priority: 'critical',
    riskLevel: 'harness',
    requiresRealVm: true,
    allowWorkspaceFallback: false,
    maxAttempts: 1,
    requestedResources: {
      harness: {
        createdBy: RUNTIME_HARNESS_CREATED_BY,
        testScenario: RUNTIME_TEXT_INPUT_NEGATIVE_SMOKE_SCENARIO,
        requestId: safeRequestId,
      },
    },
    metadata: {
      createdBy: RUNTIME_HARNESS_CREATED_BY,
      testScenario: RUNTIME_TEXT_INPUT_NEGATIVE_SMOKE_SCENARIO,
      requestId: safeRequestId,
      controlledExpectedText: expectedText,
      controlledActualText: actualText,
      inputDriver: 'vmTextInputDriver',
      expectedPrimaryInputMethod: 'clipboard_paste',
      sendKeysFallbackAllowed: false,
      closeExistingTargetProcesses: true,
      forceMismatchFileOnActivationFailure: true,
      expectedValidationPassed: false,
      createdAt: now,
      tags: ['runtime-harness', 'real-vm', 'text-input-driver-v2', 'negative-smoke'],
    },
    steps: [
      {
        id: 'runtime-vm-notepad-text-input-negative',
        title: 'VM: preencher Notepad com divergencia controlada e validar falha fisica',
        type: 'visual',
        action: {
          kind: 'visual',
          visualAction: 'run_command',
          parameters: {
            command: VM_POWERSHELL_EXE,
            args: powerShellArgs(script),
            timeout_seconds: 30,
          },
          environment: 'real_vm',
          requestedResources: {
            runtimeHarness: {
              createdBy: RUNTIME_HARNESS_CREATED_BY,
              testScenario: RUNTIME_TEXT_INPUT_NEGATIVE_SMOKE_SCENARIO,
              requestId: safeRequestId,
              controlledExpectedText: expectedText,
              controlledActualText: actualText,
            },
          },
        },
        completionCriteria: {
          type: 'file_contains',
          contains: FIELD_INTERACTED_MARKER,
        },
        expectedEvidence: COMPLETE_EVIDENCE,
        retryPolicy: { maxAttempts: 1, backoff: 'none' },
        maxAttempts: 1,
      },
    ],
  };
};

const normalizeRuntimeRequest = (request = {}) => ({
  requestId: toSafeIdPart(request.requestId || `runtime-request-${Date.now()}`),
  type: normalizeText(request.type),
  createdBy: normalizeText(request.createdBy),
  testScenario: normalizeText(request.testScenario),
  enableRunner: request.enableRunner !== false,
});

export const applyRuntimeHarnessRequests = (
  memory,
  requests = [],
  { now = new Date().toISOString() } = {},
) => {
  let nextMemory = memory;
  const taskIds = [];
  const processedRequestIds = [];
  const ignoredRequestIds = [];

  requests.map(normalizeRuntimeRequest).forEach((request) => {
    const isPositiveTextInputSmoke =
      request.type === RUNTIME_TEXT_INPUT_SMOKE_REQUEST &&
      request.testScenario === RUNTIME_TEXT_INPUT_SMOKE_SCENARIO;
    const isNegativeTextInputSmoke =
      request.type === RUNTIME_TEXT_INPUT_NEGATIVE_SMOKE_REQUEST &&
      request.testScenario === RUNTIME_TEXT_INPUT_NEGATIVE_SMOKE_SCENARIO;

    if (
      request.createdBy !== RUNTIME_HARNESS_CREATED_BY ||
      (!isPositiveTextInputSmoke && !isNegativeTextInputSmoke)
    ) {
      ignoredRequestIds.push(request.requestId);
      return;
    }

    const existing = Object.values(getAutonomousRunnerState(nextMemory).tasksById)
      .find((task) => task.metadata?.requestId === request.requestId &&
        task.metadata?.createdBy === RUNTIME_HARNESS_CREATED_BY);
    if (existing) {
      processedRequestIds.push(request.requestId);
      taskIds.push(existing.id);
      return;
    }

    const task = isNegativeTextInputSmoke
      ? createRuntimeTextInputNegativeSmokeTask({ requestId: request.requestId, now })
      : createRuntimeTextInputSmokeTask({ requestId: request.requestId, now });
    nextMemory = enqueueAutonomousRunnerMemoryTask(nextMemory, task, { now });
    if (request.enableRunner) {
      nextMemory = setAutonomousRunnerMemoryEnabled(nextMemory, true, {
        now,
        reason: isNegativeTextInputSmoke
          ? 'runtime_harness_text_input_negative_smoke'
          : 'runtime_harness_text_input_smoke',
      });
    }
    processedRequestIds.push(request.requestId);
    taskIds.push(task.id);
  });

  return {
    memory: nextMemory,
    taskIds,
    processedRequestIds,
    ignoredRequestIds,
  };
};
