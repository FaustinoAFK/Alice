import {
  TASK_PRIORITIES,
  normalizeText,
} from './contracts';
import { normalizeVmStatus } from './vmController';
import { buildMindMapSummary } from '../hud/mindMap/utils/mindMapData';

const createEmptyMindMapSummary = () => ({
  activeMapId: '',
  title: '',
  totalNodes: 0,
  pendingCount: 0,
  inProgressCount: 0,
  doneCount: 0,
  failedCount: 0,
  blockedCount: 0,
  highPriorityPending: 0,
  currentBlockers: [],
  relatedGoalId: '',
});

const createEmptyAutonomousRunnerSummary = () => ({
  enabled: false,
  runnerState: 'idle',
  activeTaskId: '',
  activeTaskStatus: '',
  queueSize: 0,
  readyCount: 0,
  blockedCount: 0,
  failedCount: 0,
  waitingRetryCount: 0,
  recentFailures: [],
  recentBlockers: [],
  currentRiskLevel: '',
});

export const createBehaviorContext = ({
  turnContext,
  autonomousState,
  vmStatus,
  activeMindMap = null,
  mindMapSummary = null,
  autonomousRunnerSummary = null,
  hostResourcePressure = 'unknown',
  now = Date.now(),
} = {}) => {
  const normalizedVmStatus = normalizeVmStatus(vmStatus || autonomousState?.vm, { now });
  const activeParallelTasks = (autonomousState?.tasks || []).filter((task) => task.status === 'running');
  const pendingImprovementProposals = (autonomousState?.improvementProposals || []).filter(
    (proposal) => proposal.status === 'pending_approval',
  );
  const resolvedMindMapSummary = mindMapSummary ||
    (activeMindMap ? buildMindMapSummary(activeMindMap) : createEmptyMindMapSummary());

  return {
    behaviorContextId: `behavior-${turnContext?.turnId || now}`,
    autonomousLearningActive: autonomousState?.autonomousLearningActive !== false,
    explicitUserRequest: Boolean(turnContext?.explicitUserRequest),
    userPriority:
      turnContext?.explicitUserRequest
        ? TASK_PRIORITIES.USER_CRITICAL
        : TASK_PRIORITIES.BACKGROUND_LEARNING,
    playgroundStatus: normalizedVmStatus,
    backgroundLearningStatus: activeParallelTasks.some((task) => String(task.priority || '').startsWith('background'))
      ? 'active'
      : 'idle',
    pendingImprovementProposals: pendingImprovementProposals.length,
    activeParallelTasks: activeParallelTasks.length,
    riskGuardStatus: (autonomousState?.risks || []).at(-1)?.reason ? 'attention' : 'clear',
    rollbackAvailable: (autonomousState?.rollbacks || []).some((rollback) => rollback.status === 'done' || rollback.status === 'ready'),
    mind_map_summary: resolvedMindMapSummary,
    autonomous_runner_summary: autonomousRunnerSummary || createEmptyAutonomousRunnerSummary(),
    hostResourcePressure: normalizeText(hostResourcePressure) || 'unknown',
    createdAt: now,
  };
};
