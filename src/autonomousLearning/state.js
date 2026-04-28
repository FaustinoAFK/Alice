import {
  AUTONOMOUS_LIMITS,
  PLAYGROUND_EXECUTION_MODES,
  TASK_STATUSES,
  VM_PROVIDERS,
  VM_RESOURCE_MODES,
  createLogEvent,
} from './contracts';

const bounded = (items = [], limit = AUTONOMOUS_LIMITS.maxLogs) =>
  [...items].filter(Boolean).slice(-limit);

export const createEmptyAutonomousLearningState = () => ({
  autonomousLearningActive: true,
  tasks: [],
  vm: {
    provider: VM_PROVIDERS.NONE,
    providerStatus: 'not_configured',
    isRealVm: false,
    executionMode: PLAYGROUND_EXECUTION_MODES.LOCAL_WORKSPACE_FALLBACK,
    status: 'idle',
    resourceMode: VM_RESOURCE_MODES.IDLE,
    costMode: VM_RESOURCE_MODES.IDLE,
    activeTasks: [],
    workspaceRoot: 'alice-local-workspace',
    providers: [],
    activeProviderCapabilities: {},
    diagnostics: null,
    smokeTest: null,
    guestCommandReady: false,
    requiresUserSetup: true,
    setupReason: 'local_vm_provider_not_configured',
    lastHealthCheck: 0,
    message: 'Nenhuma VM local real configurada. Workspace local fallback disponivel para tarefas permitidas.',
    hostResources: {
      cpuPercent: 0,
      ramAvailableMb: 0,
      diskAvailableMb: 0,
    },
    visualAgent: {
      online: false,
      status: 'unknown',
      capabilities: {},
      lastError: '',
      lastScreenshotPath: '',
      lastReplayId: '',
      lastAction: '',
      lastValidation: '',
    },
    resourcePolicy: {
      maxCpuPercent: 50,
      maxRamMb: 2048,
      maxDiskMb: 4096,
    },
  },
  validationReports: [],
  vmTaskRuns: [],
  rollbacks: [],
  risks: [],
  researchRuns: [],
  procedureCandidates: [],
  procedures: [],
  improvementProposals: [],
  pendingApprovals: [],
  learningMemoryEvents: [],
  hostResourceEvents: [],
  policyDecisions: [],
  visualExecutions: [],
  visualReplays: [],
  logs: [],
  lastUserPriorityAt: 0,
  pausedBackgroundTaskIds: [],
});

export const appendAutonomousLog = (state, type, fields = {}, options = {}) => ({
  ...createEmptyAutonomousLearningState(),
  ...(state || {}),
  logs: bounded(
    [
      ...((state || {}).logs || []),
      createLogEvent(type, fields, options),
    ],
    AUTONOMOUS_LIMITS.maxLogs,
  ),
});

export const mergeAutonomousLearningState = (currentState, patch = {}) => ({
  ...createEmptyAutonomousLearningState(),
  ...(currentState || {}),
  ...patch,
  tasks: bounded(patch.tasks || currentState?.tasks || [], 60),
  validationReports: bounded(patch.validationReports || currentState?.validationReports || [], 40),
  vmTaskRuns: bounded(patch.vmTaskRuns || currentState?.vmTaskRuns || [], 40),
  rollbacks: bounded(patch.rollbacks || currentState?.rollbacks || [], 40),
  risks: bounded(patch.risks || currentState?.risks || [], 40),
  researchRuns: bounded(patch.researchRuns || currentState?.researchRuns || [], 30),
  procedureCandidates: bounded(patch.procedureCandidates || currentState?.procedureCandidates || [], 40),
  procedures: bounded(patch.procedures || currentState?.procedures || [], AUTONOMOUS_LIMITS.maxProcedures),
  improvementProposals: bounded(patch.improvementProposals || currentState?.improvementProposals || [], 40),
  pendingApprovals: bounded(patch.pendingApprovals || currentState?.pendingApprovals || [], 40),
  learningMemoryEvents: bounded(patch.learningMemoryEvents || currentState?.learningMemoryEvents || [], 40),
  hostResourceEvents: bounded(patch.hostResourceEvents || currentState?.hostResourceEvents || [], 40),
  policyDecisions: bounded(patch.policyDecisions || currentState?.policyDecisions || [], 80),
  visualExecutions: bounded(patch.visualExecutions || currentState?.visualExecutions || [], 40),
  visualReplays: bounded(patch.visualReplays || currentState?.visualReplays || [], 20),
  logs: bounded(patch.logs || currentState?.logs || [], AUTONOMOUS_LIMITS.maxLogs),
});

export const summarizeAutonomousState = (state = createEmptyAutonomousLearningState()) => {
  const runningTasks = state.tasks.filter((task) => task.status === TASK_STATUSES.RUNNING);
  const pausedTasks = state.tasks.filter((task) => task.status === TASK_STATUSES.PAUSED);
  const queuedTasks = state.tasks.filter((task) => task.status === TASK_STATUSES.QUEUED);
  const latestRisk = state.risks.at(-1);
  const latestRollback = state.rollbacks.at(-1);

  return {
    active: Boolean(state.autonomousLearningActive),
    runningTasks: runningTasks.length,
    pausedTasks: pausedTasks.length,
    queuedTasks: queuedTasks.length,
    vmStatus: state.vm?.status || 'unknown',
    vmProvider: state.vm?.provider || 'unknown',
    vmProviderStatus: state.vm?.providerStatus || 'unknown',
    vmIsReal: Boolean(state.vm?.isRealVm),
    vmExecutionMode: state.vm?.executionMode || 'unknown',
    vmCostMode: state.vm?.resourceMode || state.vm?.costMode || 'unknown',
    pendingProposals: state.improvementProposals.filter((proposal) => proposal.status === 'pending_approval').length,
    pendingApprovals: state.pendingApprovals.length,
    validatedProcedures: state.procedures.filter((procedure) => procedure.status === 'active').length,
    visualAgentOnline: Boolean(state.vm?.visualAgent?.online),
    visualExecutions: state.visualExecutions.length,
    latestVisualAction: state.vm?.visualAgent?.lastAction || '-',
    latestVisualReplay: state.vm?.visualAgent?.lastReplayId || '-',
    latestRisk: latestRisk?.reason || '-',
    latestRollback: latestRollback?.reason || '-',
    logCount: state.logs.length,
  };
};
