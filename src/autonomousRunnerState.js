import { v4 as uuidv4 } from 'uuid';

export const AUTONOMOUS_RUNNER_SCHEMA_VERSION = 1;
export const MAX_RUNNER_QUEUE = 80;
export const MAX_RUNNER_TASKS = 120;
export const MAX_RUNNER_AUDIT_EVENTS = 160;
export const MAX_RUNNER_EVIDENCE_REFS = 160;
export const DEFAULT_RUNNER_STALE_TIMEOUT_MS = 120000;

export const RUNNER_STATES = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
};

export const RUNNER_TASK_STATUSES = {
  PLANNED: 'planned',
  READY: 'ready',
  RUNNING: 'running',
  WAITING_RETRY: 'waiting_retry',
  WAITING_INPUT: 'waiting_input',
  BLOCKED: 'blocked',
  DONE: 'done',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PAUSED: 'paused',
};

export const RUNNER_STEP_STATUSES = {
  PLANNED: 'planned',
  READY: 'ready',
  RUNNING: 'running',
  WAITING_RETRY: 'waiting_retry',
  BLOCKED: 'blocked',
  DONE: 'done',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PAUSED: 'paused',
};

export const RUNNER_REASONS = {
  VM_UNAVAILABLE: 'vm_unavailable',
  WORKSPACE_UNAVAILABLE: 'workspace_unavailable',
  NO_EXECUTABLE_STEP: 'no_executable_step',
  VALIDATION_FAILED: 'validation_failed',
  POLICY_BLOCKED: 'policy_blocked',
  MISSING_CONTEXT: 'missing_context',
  DEPENDENCY_FAILED: 'dependency_failed',
  DEPENDENCY_UNRESOLVED: 'dependency_unresolved',
  RECOVERY_LOOP_DETECTED: 'recovery_loop_detected',
  MANUAL_PAUSE: 'manual_pause',
  MANUAL_CANCEL: 'manual_cancel',
  STALE_RUNNING_TASK: 'stale_running_task',
  MAX_ATTEMPTS_REACHED: 'max_attempts_reached',
  DRY_RUN_FAILED: 'dry_run_failed',
  COMPLETION_CRITERIA_MISSING: 'completion_criteria_missing',
  EVIDENCE_PERSISTENCE_FAILED: 'evidence_persistence_failed',
  RUNNING_REQUIRES_LEASE: 'running_requires_lease',
  DONE_REQUIRES_EXECUTION_VALIDATION_EVIDENCE: 'done_requires_execution_validation_evidence',
};

export const RUNNER_PRIORITIES = ['low', 'medium', 'high', 'critical'];
export const RUNNER_STEP_TYPES = [
  'analysis',
  'command',
  'build',
  'test',
  'visual',
  'file_operation',
  'dry_run',
  'validation',
];
export const RUNNER_ACTION_KINDS = ['command', 'visual', 'analysis', 'file_check', 'script'];
export const RUNNER_COMPLETION_TYPES = [
  'exit_code',
  'tests_passed',
  'build_passed',
  'file_exists',
  'file_contains',
  'visual_state',
  'custom_validation',
];
export const RUNNER_EVIDENCE_KINDS = ['minimal', 'complete', 'visual'];

const TASK_STATUS_VALUES = Object.values(RUNNER_TASK_STATUSES);
const STEP_STATUS_VALUES = Object.values(RUNNER_STEP_STATUSES);
const RUNNER_STATE_VALUES = Object.values(RUNNER_STATES);

const TASK_TRANSITIONS = {
  [RUNNER_TASK_STATUSES.PLANNED]: [
    RUNNER_TASK_STATUSES.READY,
    RUNNER_TASK_STATUSES.BLOCKED,
    RUNNER_TASK_STATUSES.WAITING_INPUT,
    RUNNER_TASK_STATUSES.CANCELLED,
  ],
  [RUNNER_TASK_STATUSES.READY]: [
    RUNNER_TASK_STATUSES.RUNNING,
    RUNNER_TASK_STATUSES.BLOCKED,
    RUNNER_TASK_STATUSES.PAUSED,
    RUNNER_TASK_STATUSES.CANCELLED,
    RUNNER_TASK_STATUSES.WAITING_RETRY,
  ],
  [RUNNER_TASK_STATUSES.RUNNING]: [
    RUNNER_TASK_STATUSES.DONE,
    RUNNER_TASK_STATUSES.WAITING_RETRY,
    RUNNER_TASK_STATUSES.BLOCKED,
    RUNNER_TASK_STATUSES.FAILED,
    RUNNER_TASK_STATUSES.PAUSED,
    RUNNER_TASK_STATUSES.CANCELLED,
    RUNNER_TASK_STATUSES.READY,
  ],
  [RUNNER_TASK_STATUSES.WAITING_RETRY]: [
    RUNNER_TASK_STATUSES.READY,
    RUNNER_TASK_STATUSES.RUNNING,
    RUNNER_TASK_STATUSES.BLOCKED,
    RUNNER_TASK_STATUSES.FAILED,
    RUNNER_TASK_STATUSES.CANCELLED,
    RUNNER_TASK_STATUSES.PAUSED,
  ],
  [RUNNER_TASK_STATUSES.WAITING_INPUT]: [
    RUNNER_TASK_STATUSES.READY,
    RUNNER_TASK_STATUSES.BLOCKED,
    RUNNER_TASK_STATUSES.CANCELLED,
  ],
  [RUNNER_TASK_STATUSES.BLOCKED]: [
    RUNNER_TASK_STATUSES.READY,
    RUNNER_TASK_STATUSES.CANCELLED,
  ],
  [RUNNER_TASK_STATUSES.PAUSED]: [
    RUNNER_TASK_STATUSES.READY,
    RUNNER_TASK_STATUSES.CANCELLED,
  ],
  [RUNNER_TASK_STATUSES.DONE]: [
    RUNNER_TASK_STATUSES.READY,
  ],
  [RUNNER_TASK_STATUSES.FAILED]: [
    RUNNER_TASK_STATUSES.READY,
    RUNNER_TASK_STATUSES.CANCELLED,
  ],
  [RUNNER_TASK_STATUSES.CANCELLED]: [
    RUNNER_TASK_STATUSES.READY,
  ],
};

const STEP_TRANSITIONS = {
  [RUNNER_STEP_STATUSES.PLANNED]: [
    RUNNER_STEP_STATUSES.READY,
    RUNNER_STEP_STATUSES.BLOCKED,
    RUNNER_STEP_STATUSES.CANCELLED,
  ],
  [RUNNER_STEP_STATUSES.READY]: [
    RUNNER_STEP_STATUSES.RUNNING,
    RUNNER_STEP_STATUSES.BLOCKED,
    RUNNER_STEP_STATUSES.CANCELLED,
    RUNNER_STEP_STATUSES.PAUSED,
  ],
  [RUNNER_STEP_STATUSES.RUNNING]: [
    RUNNER_STEP_STATUSES.DONE,
    RUNNER_STEP_STATUSES.WAITING_RETRY,
    RUNNER_STEP_STATUSES.BLOCKED,
    RUNNER_STEP_STATUSES.FAILED,
    RUNNER_STEP_STATUSES.CANCELLED,
    RUNNER_STEP_STATUSES.PAUSED,
    RUNNER_STEP_STATUSES.READY,
  ],
  [RUNNER_STEP_STATUSES.WAITING_RETRY]: [
    RUNNER_STEP_STATUSES.READY,
    RUNNER_STEP_STATUSES.RUNNING,
    RUNNER_STEP_STATUSES.FAILED,
    RUNNER_STEP_STATUSES.BLOCKED,
    RUNNER_STEP_STATUSES.CANCELLED,
  ],
  [RUNNER_STEP_STATUSES.BLOCKED]: [
    RUNNER_STEP_STATUSES.READY,
    RUNNER_STEP_STATUSES.CANCELLED,
  ],
  [RUNNER_STEP_STATUSES.PAUSED]: [
    RUNNER_STEP_STATUSES.READY,
    RUNNER_STEP_STATUSES.CANCELLED,
  ],
  [RUNNER_STEP_STATUSES.DONE]: [
    RUNNER_STEP_STATUSES.READY,
  ],
  [RUNNER_STEP_STATUSES.FAILED]: [
    RUNNER_STEP_STATUSES.READY,
  ],
  [RUNNER_STEP_STATUSES.CANCELLED]: [
    RUNNER_STEP_STATUSES.READY,
  ],
};

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const normalizeId = (value, prefix) => {
  const id = normalizeText(value);
  return id || `${prefix}-${uuidv4()}`;
};

const normalizeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeNonNegativeInteger = (value, fallback = 0) =>
  Math.max(0, Math.trunc(normalizeNumber(value, fallback)));

const normalizeTimestamp = (value) => normalizeText(value) || null;

const normalizeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const normalizeEnum = (value, validValues, fallback) => {
  const normalized = normalizeText(value);
  return validValues.includes(normalized) ? normalized : fallback;
};

const uniqueIds = (items = []) => {
  const seen = new Set();
  return items
    .map((item) => normalizeText(item))
    .filter((item) => {
      if (!item || seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });
};

export const createEmptyAutonomousRunnerState = () => ({
  schemaVersion: AUTONOMOUS_RUNNER_SCHEMA_VERSION,
  enabled: false,
  runnerState: RUNNER_STATES.IDLE,
  queue: [],
  tasksById: {},
  activeTaskId: null,
  runnerLock: null,
  evidenceRefs: [],
  auditRefs: [],
  audits: [],
  settings: {
    maxConcurrentTasks: 1,
    defaultMaxAttempts: 3,
    dynamicIntervalEnabled: true,
    dynamicTimeoutEnabled: true,
    intervals: {
      idleIntervalMs: 30000,
      readyIntervalMs: 2000,
      pausedIntervalMs: 60000,
      vmUnavailableIntervalMs: 15000,
      heartbeatIntervalMs: 5000,
    },
    retention: {
      keepFailures: true,
      keepBlocked: true,
      keepCritical: true,
      maxSuccessEvidence: 100,
      maxAgeDaysForSuccess: 30,
    },
  },
});

export const resolveStepTimeout = (step = {}) => {
  const explicitTimeout = normalizeNumber(step.timeoutPolicy?.timeoutMs, 0);
  if (explicitTimeout > 0) {
    return Math.max(1000, Math.trunc(explicitTimeout));
  }

  switch (step.type) {
    case 'analysis':
      return 30000;
    case 'build':
    case 'test':
      return 600000;
    case 'visual':
      return 300000;
    case 'dry_run':
      return 60000;
    case 'command':
    default:
      return 120000;
  }
};

const normalizeCompletionCriteria = (criteria = {}) => {
  if (!criteria || typeof criteria !== 'object') {
    return null;
  }

  const type = normalizeEnum(criteria.type, RUNNER_COMPLETION_TYPES, '');
  if (!type) {
    return null;
  }

  return {
    type,
    expected: criteria.expected ?? (type === 'exit_code' ? 0 : null),
    command: normalizeText(criteria.command),
    path: normalizeText(criteria.path),
    contains: normalizeText(criteria.contains),
    description: normalizeText(criteria.description),
  };
};

const normalizeExpectedEvidence = (evidence = {}, stepType = 'command') => {
  if (!evidence || typeof evidence !== 'object') {
    return null;
  }

  const kind = normalizeEnum(
    evidence.kind,
    RUNNER_EVIDENCE_KINDS,
    stepType === 'visual' ? 'visual' : stepType === 'analysis' ? 'minimal' : 'complete',
  );

  return {
    kind,
    required: normalizeArray(evidence.required).map(normalizeText).filter(Boolean).slice(0, 12),
  };
};

const normalizeAction = (action = {}, fallbackCommand = '') => {
  const normalizedAction = action && typeof action === 'object' ? action : {};
  const kind = normalizeEnum(normalizedAction.kind, RUNNER_ACTION_KINDS, fallbackCommand ? 'command' : '');

  return {
    kind,
    command: normalizeText(normalizedAction.command || fallbackCommand),
    args: normalizeArray(normalizedAction.args).map(normalizeText),
    workingDirectory: normalizeText(normalizedAction.workingDirectory),
    sourceFiles: normalizeArray(normalizedAction.sourceFiles),
    requestedResources: normalizedAction.requestedResources || null,
    hostResources: normalizedAction.hostResources || null,
    visualAction: normalizeText(normalizedAction.visualAction || normalizedAction.action),
    parameters: normalizedAction.parameters && typeof normalizedAction.parameters === 'object'
      ? normalizedAction.parameters
      : {},
    environment: normalizeText(normalizedAction.environment),
  };
};

export const normalizeAutonomousRunnerStep = (
  step = {},
  { index = 0, defaultMaxAttempts = 3 } = {},
) => {
  const type = normalizeEnum(step.type, RUNNER_STEP_TYPES, step.command || step.action?.command ? 'command' : 'analysis');
  const action = normalizeAction(step.action, step.command);
  const completionCriteria = normalizeCompletionCriteria(step.completionCriteria);
  const expectedEvidence = normalizeExpectedEvidence(step.expectedEvidence, type);
  const retryPolicy = step.retryPolicy && typeof step.retryPolicy === 'object' ? step.retryPolicy : {};
  const maxAttempts = Math.max(1, normalizeNonNegativeInteger(step.maxAttempts || retryPolicy.maxAttempts, defaultMaxAttempts));
  const timeoutMs = resolveStepTimeout({
    ...step,
    type,
    timeoutPolicy: step.timeoutPolicy,
  });

  return {
    id: normalizeId(step.id, `step-${index + 1}`),
    title: normalizeText(step.title) || `Step ${index + 1}`,
    description: normalizeText(step.description),
    status: normalizeEnum(step.status, STEP_STATUS_VALUES, completionCriteria && action.kind ? RUNNER_STEP_STATUSES.READY : RUNNER_STEP_STATUSES.PLANNED),
    reason: normalizeText(step.reason) || null,
    type,
    action,
    completionCriteria,
    expectedEvidence,
    timeoutPolicy: {
      type: normalizeText(step.timeoutPolicy?.type) || 'dynamic',
      timeoutMs,
    },
    retryPolicy: {
      maxAttempts,
      backoff: normalizeText(retryPolicy.backoff) || 'dynamic',
    },
    attempts: normalizeNonNegativeInteger(step.attempts),
    maxAttempts,
    nextRunAt: normalizeTimestamp(step.nextRunAt),
    startedAt: normalizeTimestamp(step.startedAt),
    finishedAt: normalizeTimestamp(step.finishedAt),
    result: step.result || null,
    evidenceRefs: normalizeArray(step.evidenceRefs).map(normalizeRunnerEvidenceRef).slice(-20),
  };
};

export const stepHasCompletionCriteria = (step = {}) =>
  Boolean(step?.completionCriteria?.type);

export const stepHasExpectedEvidence = (step = {}) =>
  Boolean(step?.expectedEvidence?.kind && Array.isArray(step.expectedEvidence.required));

export const stepHasExecutableAction = (step = {}) => {
  const action = step?.action || {};
  if (!action.kind) {
    return false;
  }
  if (['command', 'script'].includes(action.kind)) {
    return Boolean(action.command);
  }
  if (action.kind === 'visual') {
    return Boolean(action.visualAction || action.command);
  }
  if (action.kind === 'file_check') {
    return Boolean(step?.completionCriteria?.path);
  }
  return Boolean(action.command || step?.completionCriteria?.description);
};

export const isExecutableRunnerStep = (step = {}) =>
  Boolean(step?.title && step?.type && stepHasExecutableAction(step) && stepHasCompletionCriteria(step) && stepHasExpectedEvidence(step));

export const findNextRunnableStep = (task = {}, now = Date.now()) =>
  normalizeArray(task.steps).find((step) => {
    if ([RUNNER_STEP_STATUSES.DONE, RUNNER_STEP_STATUSES.RUNNING, RUNNER_STEP_STATUSES.CANCELLED].includes(step.status)) {
      return false;
    }
    if (step.status === RUNNER_STEP_STATUSES.WAITING_RETRY && step.nextRunAt && Date.parse(step.nextRunAt) > now) {
      return false;
    }
    return isExecutableRunnerStep(step);
  }) || null;

const normalizeDependency = (dependency = {}) => ({
  taskId: normalizeText(dependency.taskId || dependency.id),
  requiredStatus: normalizeEnum(dependency.requiredStatus, TASK_STATUS_VALUES, RUNNER_TASK_STATUSES.DONE),
});

const normalizePlan = (plan = {}) => ({
  summary: normalizeText(plan.summary),
  assumptions: normalizeArray(plan.assumptions).map(normalizeText).filter(Boolean).slice(0, 12),
  risks: normalizeArray(plan.risks).map(normalizeText).filter(Boolean).slice(0, 12),
  dependencies: normalizeArray(plan.dependencies).map(normalizeText).filter(Boolean).slice(0, 12),
  validationReport: plan.validationReport || null,
});

const normalizeTaskMetadata = (metadata = {}) => {
  const source = metadata && typeof metadata === 'object' ? metadata : {};

  return {
    ...source,
    createdBy: normalizeText(source.createdBy),
    testScenario: normalizeText(source.testScenario),
    createdAt: normalizeTimestamp(source.createdAt),
    tags: normalizeArray(source.tags).map(normalizeText).filter(Boolean).slice(0, 20),
  };
};

const sanitizePhysicalEvidenceExecutionId = (value = '') => {
  const sanitized = String(value || '')
    .split('')
    .map((ch) => (/^[a-zA-Z0-9_.-]$/.test(ch) ? ch : '-'))
    .join('')
    .replace(/^-+|-+$/g, '');
  return (sanitized || 'runner-evidence').slice(0, 120);
};

const normalizeRunnerEvidenceRef = (ref = {}) => {
  if (!ref || typeof ref !== 'object') {
    return ref;
  }
  const executionId = normalizeText(ref.executionId);
  const path = normalizeText(ref.path);
  const physicalExecutionId = executionId ? sanitizePhysicalEvidenceExecutionId(executionId) : executionId;
  const logicalPrefix = executionId ? `data/evidence/${executionId}/` : '';
  const shouldUsePhysicalPath = Boolean(
    executionId &&
    physicalExecutionId &&
    physicalExecutionId !== executionId &&
    path.startsWith(logicalPrefix),
  );

  return {
    ...ref,
    executionId: shouldUsePhysicalPath ? physicalExecutionId : executionId,
    path: shouldUsePhysicalPath
      ? `data/evidence/${physicalExecutionId}/${path.slice(logicalPrefix.length)}`
      : path,
  };
};

export const normalizeAutonomousRunnerTask = (
  task = {},
  { now = new Date().toISOString(), defaultMaxAttempts = 3, queueRank = 0 } = {},
) => {
  const id = normalizeId(task.id || task.taskId, 'runner-task');
  const steps = normalizeArray(task.steps).map((step, index) =>
    normalizeAutonomousRunnerStep(step, { index, now, defaultMaxAttempts }),
  );
  const hasExecutableSteps = steps.some(isExecutableRunnerStep);
  const statusFallback = hasExecutableSteps ? RUNNER_TASK_STATUSES.READY : RUNNER_TASK_STATUSES.PLANNED;
  const status = normalizeEnum(
    task.status === 'queued' ? RUNNER_TASK_STATUSES.READY : task.status,
    TASK_STATUS_VALUES,
    statusFallback,
  );
  const minimumAttemptsForSteps = Math.max(1, steps.filter(isExecutableRunnerStep).length);
  const maxAttempts = Math.max(
    minimumAttemptsForSteps,
    normalizeNonNegativeInteger(task.maxAttempts, defaultMaxAttempts),
  );

  return {
    id,
    title: normalizeText(task.title || task.reason || task.taskType) || 'Tarefa autonoma',
    description: normalizeText(task.description || task.actionRequest?.reason),
    status,
    reason: normalizeText(task.reasonCode || task.reasonState || task.reason) || null,
    priority: normalizeEnum(task.priority, RUNNER_PRIORITIES, 'medium'),
    queueRank: normalizeNumber(task.queueRank, queueRank),
    goalId: normalizeText(task.goalId),
    mindMapNodeId: normalizeText(task.mindMapNodeId),
    procedureId: normalizeText(task.procedureId),
    createdAt: normalizeTimestamp(task.createdAt) || now,
    updatedAt: normalizeTimestamp(task.updatedAt) || now,
    attempts: normalizeNonNegativeInteger(task.attempts),
    maxAttempts,
    nextRunAt: normalizeTimestamp(task.nextRunAt),
    lastAttemptAt: normalizeTimestamp(task.lastAttemptAt),
    leaseId: normalizeText(task.leaseId) || null,
    runningStartedAt: normalizeTimestamp(task.runningStartedAt),
    heartbeatAt: normalizeTimestamp(task.heartbeatAt),
    staleTimeoutMs: Math.max(1000, normalizeNumber(task.staleTimeoutMs, DEFAULT_RUNNER_STALE_TIMEOUT_MS)),
    dependencies: normalizeArray(task.dependencies).map(normalizeDependency).filter((dependency) => dependency.taskId),
    recoveryOfTaskId: normalizeText(task.recoveryOfTaskId) || null,
    recoveryAttempts: normalizeArray(task.recoveryAttempts).map(normalizeText).filter(Boolean).slice(-12),
    plan: normalizePlan(task.plan),
    steps,
    executionHistory: normalizeArray(task.executionHistory).slice(-30),
    auditRefs: normalizeArray(task.auditRefs).slice(-40),
    evidenceRefs: normalizeArray(task.evidenceRefs).map(normalizeRunnerEvidenceRef).slice(-40),
    sourceFiles: normalizeArray(task.sourceFiles).slice(0, 40),
    requestedResources: task.requestedResources || null,
    command: normalizeText(task.command),
    args: normalizeArray(task.args).map(normalizeText),
    environment: normalizeText(task.environment),
    requiresRealVm: Boolean(task.requiresRealVm),
    allowWorkspaceFallback: task.allowWorkspaceFallback !== false,
    riskLevel: normalizeText(task.riskLevel) || 'low',
    metadata: normalizeTaskMetadata(task.metadata),
    learningCandidateIds: normalizeArray(task.learningCandidateIds).map(normalizeText).filter(Boolean).slice(-10),
  };
};

export const normalizeAutonomousRunnerState = (runner = {}) => {
  const base = createEmptyAutonomousRunnerState();
  const source = runner && typeof runner === 'object' ? runner : {};
  const settings = {
    ...base.settings,
    ...(source.settings || {}),
    intervals: {
      ...base.settings.intervals,
      ...(source.settings?.intervals || {}),
    },
    retention: {
      ...base.settings.retention,
      ...(source.settings?.retention || {}),
    },
    devOverrides: {
      forceVmUnavailable: Boolean(source.settings?.devOverrides?.forceVmUnavailable),
    },
    maxConcurrentTasks: 1,
    defaultMaxAttempts: Math.max(1, normalizeNonNegativeInteger(source.settings?.defaultMaxAttempts, base.settings.defaultMaxAttempts)),
  };
  const rawTasks = source.tasksById && typeof source.tasksById === 'object'
    ? Object.values(source.tasksById)
    : normalizeArray(source.tasks);
  const tasksById = {};

  rawTasks.slice(-MAX_RUNNER_TASKS).forEach((task, index) => {
    const normalizedTask = normalizeAutonomousRunnerTask(task, {
      defaultMaxAttempts: settings.defaultMaxAttempts,
      queueRank: index,
    });
    tasksById[normalizedTask.id] = normalizedTask;
  });

  const queue = uniqueIds([
    ...(source.queue || []),
    ...Object.values(tasksById)
      .sort((left, right) => left.queueRank - right.queueRank)
      .map((task) => task.id),
  ]).filter((taskId) => tasksById[taskId]).slice(0, MAX_RUNNER_QUEUE);

  Object.values(tasksById).forEach((task) => {
    if (!queue.includes(task.id) && ![
      RUNNER_TASK_STATUSES.DONE,
      RUNNER_TASK_STATUSES.FAILED,
      RUNNER_TASK_STATUSES.CANCELLED,
    ].includes(task.status)) {
      queue.push(task.id);
    }
  });

  const runnerLock = source.runnerLock && typeof source.runnerLock === 'object'
    ? {
        activeTaskId: normalizeText(source.runnerLock.activeTaskId),
        activeStepId: normalizeText(source.runnerLock.activeStepId),
        leaseId: normalizeText(source.runnerLock.leaseId),
        acquiredAt: normalizeTimestamp(source.runnerLock.acquiredAt),
        heartbeatAt: normalizeTimestamp(source.runnerLock.heartbeatAt),
      }
    : null;
  const activeTaskId = normalizeText(source.activeTaskId || runnerLock?.activeTaskId);

  return {
    ...base,
    ...source,
    schemaVersion: AUTONOMOUS_RUNNER_SCHEMA_VERSION,
    enabled: Boolean(source.enabled),
    runnerState: normalizeEnum(source.runnerState, RUNNER_STATE_VALUES, source.enabled ? RUNNER_STATES.IDLE : RUNNER_STATES.IDLE),
    queue,
    tasksById,
    activeTaskId: tasksById[activeTaskId] ? activeTaskId : null,
    runnerLock: runnerLock?.activeTaskId && tasksById[runnerLock.activeTaskId] ? runnerLock : null,
    evidenceRefs: normalizeArray(source.evidenceRefs).map(normalizeRunnerEvidenceRef).slice(-MAX_RUNNER_EVIDENCE_REFS),
    auditRefs: normalizeArray(source.auditRefs).slice(-MAX_RUNNER_AUDIT_EVENTS),
    audits: normalizeArray(source.audits).slice(-MAX_RUNNER_AUDIT_EVENTS),
    settings,
  };
};

export const createAutonomousRunnerAuditEvent = ({
  id = '',
  timestamp = new Date().toISOString(),
  type = 'event',
  taskId = '',
  stepId = '',
  summary = '',
  reason = '',
  beforeState = '',
  afterState = '',
  evidenceRefs = [],
  metadata = {},
} = {}) => ({
  id: normalizeText(id) || `runner-audit-${uuidv4()}`,
  timestamp: normalizeText(timestamp) || new Date().toISOString(),
  type: normalizeText(type) || 'event',
  taskId: normalizeText(taskId),
  stepId: normalizeText(stepId),
  summary: normalizeText(summary),
  reason: normalizeText(reason),
  beforeState: normalizeText(beforeState),
  afterState: normalizeText(afterState),
  evidenceRefs: normalizeArray(evidenceRefs).slice(0, 20),
  metadata: metadata && typeof metadata === 'object' ? metadata : {},
});

export const appendAutonomousRunnerAudit = (runner, event = {}) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const auditEvent = createAutonomousRunnerAuditEvent(event);
  return {
    ...normalizedRunner,
    audits: [...normalizedRunner.audits, auditEvent].slice(-MAX_RUNNER_AUDIT_EVENTS),
    auditRefs: [...normalizedRunner.auditRefs, {
      id: auditEvent.id,
      taskId: auditEvent.taskId,
      stepId: auditEvent.stepId,
      type: auditEvent.type,
      timestamp: auditEvent.timestamp,
    }].slice(-MAX_RUNNER_AUDIT_EVENTS),
  };
};

export const createAutonomousRunnerTask = (input = {}, options = {}) => {
  const now = options.now || new Date().toISOString();
  return normalizeAutonomousRunnerTask(
    {
      ...input,
      id: input.id || input.taskId || `runner-task-${uuidv4()}`,
      createdAt: input.createdAt || now,
      updatedAt: input.updatedAt || now,
    },
    {
      now,
      defaultMaxAttempts: options.defaultMaxAttempts || 3,
      queueRank: options.queueRank || 0,
    },
  );
};

export const enqueueAutonomousRunnerTask = (
  runner,
  input = {},
  { now = new Date().toISOString() } = {},
) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const queueRank = input.queueRank ?? normalizedRunner.queue.length;
  const task = createAutonomousRunnerTask(input, {
    now,
    queueRank,
    defaultMaxAttempts: normalizedRunner.settings.defaultMaxAttempts,
  });
  const nextRunner = {
    ...normalizedRunner,
    queue: uniqueIds([...normalizedRunner.queue, task.id]),
    tasksById: {
      ...normalizedRunner.tasksById,
      [task.id]: task,
    },
  };

  return appendAutonomousRunnerAudit(nextRunner, {
    timestamp: now,
    type: 'task_enqueued',
    taskId: task.id,
    summary: `Task enfileirada: ${task.title}`,
    afterState: task.status,
    metadata: { priority: task.priority, queueRank: task.queueRank },
  });
};

export const updateAutonomousRunnerTask = (
  runner,
  taskId,
  patch = {},
  { now = new Date().toISOString(), audit = null } = {},
) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const currentTask = normalizedRunner.tasksById[normalizeText(taskId)];
  if (!currentTask) {
    return normalizedRunner;
  }
  const nextTask = normalizeAutonomousRunnerTask(
    typeof patch === 'function' ? patch(currentTask) : { ...currentTask, ...patch, updatedAt: now },
    {
      now,
      defaultMaxAttempts: normalizedRunner.settings.defaultMaxAttempts,
      queueRank: currentTask.queueRank,
    },
  );
  const nextRunner = {
    ...normalizedRunner,
    tasksById: {
      ...normalizedRunner.tasksById,
      [currentTask.id]: nextTask,
    },
    activeTaskId: normalizedRunner.activeTaskId === currentTask.id ? nextTask.id : normalizedRunner.activeTaskId,
  };

  return audit
    ? appendAutonomousRunnerAudit(nextRunner, {
        timestamp: now,
        taskId: nextTask.id,
        ...audit,
      })
    : nextRunner;
};

export const updateAutonomousRunnerStep = (
  runner,
  taskId,
  stepId,
  patch = {},
  { now = new Date().toISOString(), audit = null } = {},
) =>
  updateAutonomousRunnerTask(
    runner,
    taskId,
    (task) => ({
      ...task,
      steps: task.steps.map((step) =>
        step.id === stepId
          ? normalizeAutonomousRunnerStep(
              typeof patch === 'function' ? patch(step) : { ...step, ...patch },
              { now, defaultMaxAttempts: task.maxAttempts },
            )
          : step,
      ),
      updatedAt: now,
    }),
    { now, audit: audit ? { stepId, ...audit } : null },
  );

export const canTransitionRunnerTask = (fromStatus, toStatus) =>
  fromStatus === toStatus || Boolean(TASK_TRANSITIONS[fromStatus]?.includes(toStatus));

export const canTransitionRunnerStep = (fromStatus, toStatus) =>
  fromStatus === toStatus || Boolean(STEP_TRANSITIONS[fromStatus]?.includes(toStatus));

const hasLeaseTransitionProof = (metadata = {}) => Boolean(normalizeText(metadata.leaseId));

const hasPersistedEvidenceProof = (metadata = {}) => {
  if (metadata.evidencePersistence?.ok === true) {
    return true;
  }

  if (!Array.isArray(metadata.evidenceRefs) || metadata.evidenceRefs.length === 0) {
    return false;
  }

  return metadata.evidenceRefs.every((ref) =>
    ref?.metadata?.physicalStatus === 'ok' ||
    ref?.metadata?.persistence?.status === 'ok' ||
    ref?.metadata?.persistence?.ok === true,
  );
};

const hasDoneTransitionProof = (metadata = {}) =>
  metadata.executionVerified === true &&
  metadata.validationPassed === true &&
  hasPersistedEvidenceProof(metadata);

const rejectTaskTransition = (runner, task, nextStatus, {
  reason,
  now,
  metadata,
  summary = `Transicao rejeitada: ${task.status} -> ${nextStatus}`,
}) => ({
  ok: false,
  reason,
  runner: appendAutonomousRunnerAudit(runner, {
    timestamp: now,
    type: 'state_transition_rejected',
    taskId: task.id,
    summary,
    reason,
    beforeState: task.status,
    afterState: nextStatus,
    metadata,
  }),
});

const rejectStepTransition = (runner, task, step, nextStatus, {
  reason,
  now,
  metadata,
  summary = `Transicao de step rejeitada: ${step.status} -> ${nextStatus}`,
}) => ({
  ok: false,
  reason,
  runner: appendAutonomousRunnerAudit(runner, {
    timestamp: now,
    type: 'state_transition_rejected',
    taskId: task.id,
    stepId: step.id,
    summary,
    reason,
    beforeState: step.status,
    afterState: nextStatus,
    metadata,
  }),
});

export const transitionAutonomousRunnerTask = (
  runner,
  taskId,
  status,
  { reason = '', now = new Date().toISOString(), metadata = {} } = {},
) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const task = normalizedRunner.tasksById[normalizeText(taskId)];
  const nextStatus = normalizeEnum(status, TASK_STATUS_VALUES, '');

  if (!task || !nextStatus) {
    return {
      ok: false,
      reason: 'task_not_found_or_invalid_status',
      runner: normalizedRunner,
    };
  }

  if (!canTransitionRunnerTask(task.status, nextStatus)) {
    return rejectTaskTransition(normalizedRunner, task, nextStatus, {
      reason: 'invalid_task_transition',
      now,
      metadata,
    });
  }

  if (nextStatus === RUNNER_TASK_STATUSES.RUNNING && !hasLeaseTransitionProof(metadata)) {
    return rejectTaskTransition(normalizedRunner, task, nextStatus, {
      reason: RUNNER_REASONS.RUNNING_REQUIRES_LEASE,
      now,
      metadata,
    });
  }

  if (nextStatus === RUNNER_TASK_STATUSES.DONE && !hasDoneTransitionProof(metadata)) {
    return rejectTaskTransition(normalizedRunner, task, nextStatus, {
      reason: RUNNER_REASONS.DONE_REQUIRES_EXECUTION_VALIDATION_EVIDENCE,
      now,
      metadata,
    });
  }

  const patch = {
    status: nextStatus,
    reason: normalizeText(reason) || null,
    updatedAt: now,
  };

  if ([RUNNER_TASK_STATUSES.DONE, RUNNER_TASK_STATUSES.FAILED, RUNNER_TASK_STATUSES.BLOCKED, RUNNER_TASK_STATUSES.CANCELLED, RUNNER_TASK_STATUSES.PAUSED].includes(nextStatus)) {
    patch.leaseId = null;
    patch.runningStartedAt = null;
    patch.heartbeatAt = null;
  }

  const nextRunner = updateAutonomousRunnerTask(normalizedRunner, task.id, patch, {
    now,
    audit: {
      type: 'state_transition',
      summary: `Task ${task.title}: ${task.status} -> ${nextStatus}`,
      reason,
      beforeState: task.status,
      afterState: nextStatus,
      metadata,
    },
  });

  return {
    ok: true,
    runner: nextRunner,
    task: nextRunner.tasksById[task.id],
  };
};

export const transitionAutonomousRunnerStep = (
  runner,
  taskId,
  stepId,
  status,
  { reason = '', now = new Date().toISOString(), metadata = {} } = {},
) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const task = normalizedRunner.tasksById[normalizeText(taskId)];
  const step = task?.steps.find((item) => item.id === stepId);
  const nextStatus = normalizeEnum(status, STEP_STATUS_VALUES, '');

  if (!task || !step || !nextStatus) {
    return {
      ok: false,
      reason: 'step_not_found_or_invalid_status',
      runner: normalizedRunner,
    };
  }

  if (!canTransitionRunnerStep(step.status, nextStatus)) {
    return rejectStepTransition(normalizedRunner, task, step, nextStatus, {
      reason: 'invalid_step_transition',
      now,
      metadata,
    });
  }

  if (nextStatus === RUNNER_STEP_STATUSES.RUNNING && !hasLeaseTransitionProof(metadata)) {
    return rejectStepTransition(normalizedRunner, task, step, nextStatus, {
      reason: RUNNER_REASONS.RUNNING_REQUIRES_LEASE,
      now,
      metadata,
    });
  }

  if (nextStatus === RUNNER_STEP_STATUSES.DONE && !hasDoneTransitionProof(metadata)) {
    return rejectStepTransition(normalizedRunner, task, step, nextStatus, {
      reason: RUNNER_REASONS.DONE_REQUIRES_EXECUTION_VALIDATION_EVIDENCE,
      now,
      metadata,
    });
  }

  const patch = {
    status: nextStatus,
    reason: normalizeText(reason) || null,
  };

  if (nextStatus === RUNNER_STEP_STATUSES.RUNNING) {
    patch.startedAt = step.startedAt || now;
  }

  if ([RUNNER_STEP_STATUSES.DONE, RUNNER_STEP_STATUSES.FAILED, RUNNER_STEP_STATUSES.BLOCKED, RUNNER_STEP_STATUSES.CANCELLED].includes(nextStatus)) {
    patch.finishedAt = now;
  }

  const nextRunner = updateAutonomousRunnerStep(normalizedRunner, task.id, step.id, patch, {
    now,
    audit: {
      type: 'state_transition',
      summary: `Step ${step.title}: ${step.status} -> ${nextStatus}`,
      reason,
      beforeState: step.status,
      afterState: nextStatus,
      metadata,
    },
  });

  return {
    ok: true,
    runner: nextRunner,
    task: nextRunner.tasksById[task.id],
    step: nextRunner.tasksById[task.id]?.steps.find((item) => item.id === step.id),
  };
};

export const setAutonomousRunnerEnabled = (
  runner,
  enabled,
  { now = new Date().toISOString(), reason = '' } = {},
) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const nextRunner = {
    ...normalizedRunner,
    enabled: Boolean(enabled),
    runnerState: enabled
      ? normalizedRunner.runnerState === RUNNER_STATES.PAUSED
        ? RUNNER_STATES.PAUSED
        : RUNNER_STATES.IDLE
      : RUNNER_STATES.IDLE,
  };

  return appendAutonomousRunnerAudit(nextRunner, {
    timestamp: now,
    type: enabled ? 'runner_enabled' : 'runner_disabled',
    summary: enabled ? 'Runner autonomo ligado.' : 'Runner autonomo desligado.',
    reason,
    beforeState: normalizedRunner.runnerState,
    afterState: nextRunner.runnerState,
  });
};

export const setAutonomousRunnerPaused = (
  runner,
  paused,
  { now = new Date().toISOString(), reason = RUNNER_REASONS.MANUAL_PAUSE } = {},
) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const nextRunner = {
    ...normalizedRunner,
    runnerState: paused ? RUNNER_STATES.PAUSED : RUNNER_STATES.IDLE,
  };

  return appendAutonomousRunnerAudit(nextRunner, {
    timestamp: now,
    type: paused ? 'runner_paused' : 'runner_resumed',
    summary: paused ? 'Runner pausado.' : 'Runner retomado.',
    reason,
    beforeState: normalizedRunner.runnerState,
    afterState: nextRunner.runnerState,
  });
};

export const cancelAutonomousRunnerTask = (
  runner,
  taskId,
  { now = new Date().toISOString(), reason = RUNNER_REASONS.MANUAL_CANCEL } = {},
) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const task = normalizedRunner.tasksById[normalizeText(taskId)];
  if (!task) {
    return normalizedRunner;
  }

  const cancelledSteps = task.steps.map((step) =>
    [RUNNER_STEP_STATUSES.DONE, RUNNER_STEP_STATUSES.FAILED].includes(step.status)
      ? step
      : { ...step, status: RUNNER_STEP_STATUSES.CANCELLED, reason, finishedAt: now },
  );

  const nextRunner = updateAutonomousRunnerTask(
    normalizedRunner,
    task.id,
    {
      status: RUNNER_TASK_STATUSES.CANCELLED,
      reason,
      steps: cancelledSteps,
      leaseId: null,
      runningStartedAt: null,
      heartbeatAt: null,
      updatedAt: now,
    },
    {
      now,
      audit: {
        type: 'state_transition',
        summary: `Task cancelada: ${task.title}`,
        reason,
        beforeState: task.status,
        afterState: RUNNER_TASK_STATUSES.CANCELLED,
      },
    },
  );

  return {
    ...nextRunner,
    activeTaskId: nextRunner.activeTaskId === task.id ? null : nextRunner.activeTaskId,
    runnerLock: nextRunner.runnerLock?.activeTaskId === task.id ? null : nextRunner.runnerLock,
    queue: nextRunner.queue.filter((id) => id !== task.id),
  };
};

export const cancelAutonomousRunnerQueue = (
  runner,
  { now = new Date().toISOString(), reason = RUNNER_REASONS.MANUAL_CANCEL } = {},
) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  let nextRunner = normalizedRunner;

  normalizedRunner.queue.forEach((taskId) => {
    const task = nextRunner.tasksById[taskId];
    if (task && ![
      RUNNER_TASK_STATUSES.RUNNING,
      RUNNER_TASK_STATUSES.DONE,
      RUNNER_TASK_STATUSES.FAILED,
      RUNNER_TASK_STATUSES.CANCELLED,
    ].includes(task.status)) {
      nextRunner = cancelAutonomousRunnerTask(nextRunner, taskId, { now, reason });
    }
  });

  return appendAutonomousRunnerAudit(nextRunner, {
    timestamp: now,
    type: 'queue_cancelled',
    summary: 'Fila do Runner cancelada.',
    reason,
  });
};

export const reorderAutonomousRunnerTask = (
  runner,
  taskId,
  queueRank,
  { now = new Date().toISOString() } = {},
) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const task = normalizedRunner.tasksById[normalizeText(taskId)];
  if (!task) {
    return normalizedRunner;
  }

  return updateAutonomousRunnerTask(normalizedRunner, task.id, { queueRank, updatedAt: now }, {
    now,
    audit: {
      type: 'queue_reordered',
      summary: `Task reordenada: ${task.title}`,
      reason: 'manual_queue_rank',
      beforeState: String(task.queueRank),
      afterState: String(queueRank),
    },
  });
};

export const rerunAutonomousRunnerTask = (
  runner,
  taskId,
  { now = new Date().toISOString() } = {},
) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const task = normalizedRunner.tasksById[normalizeText(taskId)];
  if (!task) {
    return normalizedRunner;
  }
  const resetSteps = task.steps.map((step) => ({
    ...step,
    status: isExecutableRunnerStep(step) ? RUNNER_STEP_STATUSES.READY : RUNNER_STEP_STATUSES.PLANNED,
    reason: null,
    attempts: 0,
    nextRunAt: null,
    startedAt: null,
    finishedAt: null,
    result: null,
  }));
  const nextTaskStatus = resetSteps.some(isExecutableRunnerStep)
    ? RUNNER_TASK_STATUSES.READY
    : RUNNER_TASK_STATUSES.PLANNED;

  return updateAutonomousRunnerTask(
    normalizedRunner,
    task.id,
    {
      status: nextTaskStatus,
      reason: null,
      attempts: 0,
      nextRunAt: null,
      lastAttemptAt: null,
      leaseId: null,
      runningStartedAt: null,
      heartbeatAt: null,
      steps: resetSteps,
      updatedAt: now,
    },
    {
      now,
      audit: {
        type: 'task_rerun_requested',
        summary: `Reexecucao solicitada: ${task.title}`,
        beforeState: task.status,
        afterState: nextTaskStatus,
      },
    },
  );
};

export const createAutonomousRunnerSummary = (runner = {}) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const tasks = Object.values(normalizedRunner.tasksById);
  const activeTask = normalizedRunner.activeTaskId ? normalizedRunner.tasksById[normalizedRunner.activeTaskId] : null;
  const countStatus = (status) => tasks.filter((task) => task.status === status).length;
  const recentFailures = normalizedRunner.audits
    .filter((event) => event.afterState === RUNNER_TASK_STATUSES.FAILED || event.reason === RUNNER_REASONS.VALIDATION_FAILED)
    .slice(-5)
    .map((event) => ({ taskId: event.taskId, reason: event.reason, timestamp: event.timestamp }));
  const recentBlockers = normalizedRunner.audits
    .filter((event) => event.afterState === RUNNER_TASK_STATUSES.BLOCKED || event.reason?.includes('blocked'))
    .slice(-5)
    .map((event) => ({ taskId: event.taskId, reason: event.reason, timestamp: event.timestamp }));

  return {
    enabled: normalizedRunner.enabled,
    runnerState: normalizedRunner.runnerState,
    activeTaskId: normalizedRunner.activeTaskId || '',
    activeTaskStatus: activeTask?.status || '',
    queueSize: normalizedRunner.queue.length,
    readyCount: countStatus(RUNNER_TASK_STATUSES.READY),
    blockedCount: countStatus(RUNNER_TASK_STATUSES.BLOCKED),
    failedCount: countStatus(RUNNER_TASK_STATUSES.FAILED),
    waitingRetryCount: countStatus(RUNNER_TASK_STATUSES.WAITING_RETRY),
    recentFailures,
    recentBlockers,
    currentRiskLevel: activeTask?.riskLevel || '',
  };
};

export const replaceAutonomousRunnerState = (runner, patch = {}) =>
  normalizeAutonomousRunnerState({
    ...normalizeAutonomousRunnerState(runner),
    ...patch,
  });
