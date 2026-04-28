import { AUTONOMOUS_LIMITS } from './contracts';
import { createEmptyAutonomousLearningState, mergeAutonomousLearningState } from './state';

const bounded = (items = [], limit = AUTONOMOUS_LIMITS.maxLogs) =>
  Array.isArray(items) ? items.filter(Boolean).slice(-limit) : [];

export const createEmptyAutonomousAudit = () => ({
  schemaVersion: 1,
  autonomousTasks: [],
  localVmSessions: [],
  vmTaskRuns: [],
  validationReports: [],
  rollbackEvents: [],
  researchFindings: [],
  skillCandidates: [],
  improvementProposals: [],
  pendingApprovals: [],
  risks: [],
  procedures: [],
  learningMemoryEvents: [],
  hostResourceEvents: [],
  policyDecisions: [],
  visualExecutions: [],
  visualReplays: [],
  auditLogs: [],
  updatedAt: '',
});

export const serializeAutonomousStateForAudit = (
  state = createEmptyAutonomousLearningState(),
  { now = new Date().toISOString() } = {},
) => ({
  ...createEmptyAutonomousAudit(),
  autonomousTasks: bounded(state.tasks, 80),
  localVmSessions: bounded(state.vm ? [state.vm] : [], 20),
  vmTaskRuns: bounded(state.vmTaskRuns, 60),
  validationReports: bounded(state.validationReports, 60),
  rollbackEvents: bounded(state.rollbacks, 60),
  researchFindings: bounded(state.researchRuns, 60),
  skillCandidates: bounded(state.procedureCandidates, 60),
  improvementProposals: bounded(state.improvementProposals, 60),
  pendingApprovals: bounded(state.pendingApprovals, 60),
  risks: bounded(state.risks, 60),
  procedures: bounded(state.procedures, 60),
  learningMemoryEvents: bounded(state.learningMemoryEvents, 60),
  hostResourceEvents: bounded(state.hostResourceEvents, 60),
  visualExecutions: bounded(state.visualExecutions, 60),
  visualReplays: bounded(state.visualReplays, 40),
  policyDecisions: bounded(
    [
      ...(state.policyDecisions || []),
      ...state.tasks.map((task) => ({
        taskId: task.taskId,
        reason: task.policyDecision?.reason || '',
        flags: task.policyDecision?.policyFlags || [],
        allowed: Boolean(task.policyDecision?.allowed),
        createdAt: task.createdAt,
      })),
    ],
    80,
  ),
  auditLogs: bounded(state.logs, AUTONOMOUS_LIMITS.maxLogs),
  updatedAt: now,
});

export const hydrateAutonomousStateFromAudit = (audit = createEmptyAutonomousAudit()) => {
  const base = createEmptyAutonomousLearningState();
  const latestVm = bounded(audit.localVmSessions, 20).at(-1);

  return mergeAutonomousLearningState(base, {
    tasks: bounded(audit.autonomousTasks, 80),
    vm: latestVm || base.vm,
    vmTaskRuns: bounded(audit.vmTaskRuns, 60),
    validationReports: bounded(audit.validationReports, 60),
    rollbacks: bounded(audit.rollbackEvents, 60),
    researchRuns: bounded(audit.researchFindings, 60),
    procedureCandidates: bounded(audit.skillCandidates, 60),
    improvementProposals: bounded(audit.improvementProposals, 60),
    learningMemoryEvents: bounded(audit.learningMemoryEvents, 60),
    hostResourceEvents: bounded(audit.hostResourceEvents, 60),
    visualExecutions: bounded(audit.visualExecutions, 60),
    visualReplays: bounded(audit.visualReplays, 40),
    policyDecisions: bounded(audit.policyDecisions, 80),
    procedures: bounded(audit.procedures, 60),
    pendingApprovals: bounded(audit.pendingApprovals, 60),
    risks: bounded(audit.risks, 60),
    logs: bounded(audit.auditLogs, AUTONOMOUS_LIMITS.maxLogs),
  });
};
