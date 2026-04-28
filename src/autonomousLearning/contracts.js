export const ENVIRONMENT_TYPES = {
  LOCAL_VM_PLAYGROUND: 'local_vm_playground',
  LOCAL_WORKSPACE_FALLBACK: 'local_workspace_fallback',
  REAL_PC: 'real_pc',
};

export const PLAYGROUND_EXECUTION_MODES = {
  REAL_VM: 'real_vm',
  LOCAL_WORKSPACE_FALLBACK: 'local_workspace_fallback',
  UNAVAILABLE: 'unavailable',
};

export const VM_RESOURCE_MODES = {
  ACTIVE: 'active',
  LEARNING_LIGHT: 'learning_light',
  IDLE: 'idle',
  SUSPEND_CANDIDATE: 'suspend_candidate',
  SHUTDOWN_CANDIDATE: 'shutdown_candidate',
};

export const VM_PROVIDERS = {
  HYPER_V: 'hyper_v',
  VIRTUALBOX: 'virtualbox',
  VMWARE: 'vmware',
  NONE: 'none',
};

export const AUTONOMY_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

export const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

export const TASK_PRIORITIES = {
  USER_CRITICAL: 'user_critical',
  USER_NORMAL: 'user_normal',
  ROLLBACK: 'rollback',
  VALIDATION: 'validation',
  VM_EXPERIMENT: 'vm_experiment',
  APP_LEARNING: 'app_learning',
  INTERNAL_IMPROVEMENT: 'internal_improvement',
  BACKGROUND_LEARNING: 'background_learning',
  BACKGROUND_OPTIMIZATION: 'background_optimization',
};

export const EXECUTION_MODES = {
  LEARNING: 'learning',
  EXECUTION: 'execution',
  VALIDATION: 'validation',
  PROPOSAL: 'proposal',
  ROLLBACK: 'rollback',
};

export const TASK_STATUSES = {
  QUEUED: 'queued',
  RUNNING: 'running',
  WAITING: 'waiting',
  BLOCKED: 'blocked',
  PAUSED: 'paused',
  CANCELLING: 'cancelling',
  DONE: 'done',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  ROLLING_BACK: 'rolling_back',
};

export const TASK_TYPES = {
  USER_REQUEST: 'user_request',
  VM_EXPERIMENT: 'vm_experiment',
  VM_UI_INTERACTION: 'vm_ui_interaction',
  FILE_ANALYSIS: 'file_analysis',
  RESEARCH: 'research',
  SCRIPT_GENERATION: 'script_generation',
  SCRIPT_VALIDATION: 'script_validation',
  APP_LEARNING: 'app_learning',
  INTERFACE_RELEARNING: 'interface_relearning',
  SELF_IMPROVEMENT: 'self_improvement',
  BACKGROUND_OPTIMIZATION: 'background_optimization',
  ROLLBACK: 'rollback',
};

export const VM_VISUAL_ACTIONS = {
  CAPTURE_SCREEN: 'capture_screen',
  GET_ACTIVE_WINDOW: 'get_active_window',
  MOVE_MOUSE: 'move_mouse',
  CLICK: 'click',
  DOUBLE_CLICK: 'double_click',
  RIGHT_CLICK: 'right_click',
  TYPE_TEXT: 'type_text',
  PRESS_KEY: 'press_key',
  HOTKEY: 'hotkey',
  WAIT: 'wait',
  RUN_COMMAND: 'run_command',
  START_BACKGROUND_COMMAND: 'start_background_command',
  GET_BACKGROUND_COMMAND_STATUS: 'get_background_command_status',
  CANCEL_BACKGROUND_COMMAND: 'cancel_background_command',
  GET_STATUS: 'get_status',
};

export const VM_VISUAL_ACTION_SOURCES = {
  ACCESSIBILITY: 'accessibility',
  OCR: 'ocr',
  IMAGE: 'image',
  HEURISTIC: 'heuristic',
  COORDINATE_FALLBACK: 'coordinate_fallback',
};

export const LEARNING_STATES = {
  OBSERVED: 'observed',
  CANDIDATE: 'candidate',
  TESTING: 'testing',
  VALIDATED: 'validated',
  ACTIVE: 'active',
  DEPRECATED: 'deprecated',
  ARCHIVED: 'archived',
  FAILED: 'failed',
};

export const AUTONOMOUS_LIMITS = {
  maxUserTasks: 1,
  maxVmTasks: 2,
  maxResearchTasks: 2,
  maxBackgroundTasks: 1,
  maxSelfImprovementTasks: 1,
  maxResearchCycles: 3,
  maxResearchSources: 8,
  maxProcedures: 30,
  maxLogs: 80,
};

const ORDERED_PRIORITIES = [
  TASK_PRIORITIES.USER_CRITICAL,
  TASK_PRIORITIES.USER_NORMAL,
  TASK_PRIORITIES.ROLLBACK,
  TASK_PRIORITIES.VALIDATION,
  TASK_PRIORITIES.VM_EXPERIMENT,
  TASK_PRIORITIES.APP_LEARNING,
  TASK_PRIORITIES.INTERNAL_IMPROVEMENT,
  TASK_PRIORITIES.BACKGROUND_LEARNING,
  TASK_PRIORITIES.BACKGROUND_OPTIMIZATION,
];

export const getPriorityRank = (priority) => {
  const index = ORDERED_PRIORITIES.indexOf(priority);
  return index === -1 ? ORDERED_PRIORITIES.length : index;
};

export const isUserPriority = (priority) =>
  priority === TASK_PRIORITIES.USER_CRITICAL || priority === TASK_PRIORITIES.USER_NORMAL;

export const isBackgroundPriority = (priority) =>
  priority === TASK_PRIORITIES.BACKGROUND_LEARNING ||
  priority === TASK_PRIORITIES.BACKGROUND_OPTIMIZATION ||
  priority === TASK_PRIORITIES.INTERNAL_IMPROVEMENT;

export const isHighRisk = (riskLevel) =>
  riskLevel === RISK_LEVELS.HIGH || riskLevel === RISK_LEVELS.CRITICAL;

export const normalizeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

export const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

export const createAutonomousActionRequest = (input = {}, { now = Date.now() } = {}) => ({
  actionId: normalizeText(input.actionId) || `action-${now}`,
  requestedBy: normalizeText(input.requestedBy) || 'alice',
  environment: input.environment || ENVIRONMENT_TYPES.LOCAL_VM_PLAYGROUND,
  actionType: normalizeText(input.actionType) || TASK_TYPES.USER_REQUEST,
  riskLevel: input.riskLevel || RISK_LEVELS.LOW,
  priority: input.priority || TASK_PRIORITIES.USER_NORMAL,
  executionMode: input.executionMode || EXECUTION_MODES.EXECUTION,
  targetFiles: normalizeArray(input.targetFiles).map((file) => normalizeText(file)),
  targetApps: normalizeArray(input.targetApps).map((app) => normalizeText(app)),
  requiresSystemAccess: Boolean(input.requiresSystemAccess),
  affectsOfficialCode: Boolean(input.affectsOfficialCode),
  userVisible: input.userVisible !== false,
  usesRealFilesDirectly: Boolean(input.usesRealFilesDirectly),
  requiresRealVm: Boolean(input.requiresRealVm),
  allowWorkspaceFallback: input.allowWorkspaceFallback !== false,
  reason: normalizeText(input.reason),
  createdAt: now,
});

export const createPolicyDecision = (overrides = {}) => ({
  allowed: Boolean(overrides.allowed),
  requiresConfirmation: Boolean(overrides.requiresConfirmation),
  requiresSnapshot: Boolean(overrides.requiresSnapshot),
  requiresValidation: Boolean(overrides.requiresValidation),
  requiresRollbackPlan: Boolean(overrides.requiresRollbackPlan),
  shouldPauseBackground: Boolean(overrides.shouldPauseBackground),
  reason: normalizeText(overrides.reason) || 'policy_decision',
  policyFlags: normalizeArray(overrides.policyFlags),
});

export const createLogEvent = (type, fields = {}, { now = Date.now() } = {}) => ({
  eventId: `${type}-${now}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  createdAt: now,
  ...fields,
});
