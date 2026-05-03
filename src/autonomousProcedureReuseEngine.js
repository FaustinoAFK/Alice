import { createAutonomousReuseTask } from './autonomousLearningPlanner';
import {
  AUTONOMOUS_REUSE_CREATED_BY,
  normalizeAutonomousLearningPolicy,
} from './autonomousLearningPolicy';
import { matchProceduresForNeed } from './autonomousProcedureMatcher';
import { canReuseProcedureAutomatically } from './autonomousReusePolicy';

const normalizeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
const normalizeText = (value) => String(value || '').trim();

export const procedureHasSubstantiveReuseValidation = (procedure = {}) =>
  procedure.reuseValidation?.substantive === true ||
  procedure.validation?.substantive === true ||
  procedure.metadata?.substantiveValidation === true ||
  procedure.substantiveValidation === true;

const reuseAlreadyAttempted = ({ memory = {}, gap = {}, procedureId = '' } = {}) => {
  const gapId = normalizeText(gap.gapId);
  const targetProcedureId = normalizeText(procedureId);
  return Object.values(memory.autonomousRunner?.tasksById || {}).some((task) =>
    task.metadata?.createdBy === AUTONOMOUS_REUSE_CREATED_BY &&
    normalizeText(task.metadata?.gapId) === gapId &&
    normalizeText(task.metadata?.procedureId || task.procedureId) === targetProcedureId &&
    ['planned', 'ready', 'running', 'waiting_retry', 'blocked', 'done'].includes(task.status),
  );
};

export const resolveProcedureReuseForGap = ({
  gap = {},
  memory = {},
  policy = {},
  now = new Date().toISOString(),
} = {}) => {
  const normalizedPolicy = normalizeAutonomousLearningPolicy(policy);
  const procedures = [
    ...normalizeArray(memory.proceduralMemory?.procedures),
    ...normalizeArray(memory.autonomousLearning?.promotedProcedures),
  ];
  const candidates = normalizeArray(memory.autonomousLearning?.procedureCandidates)
    .filter((candidate) => ['guarded', 'candidate'].includes(candidate.status));
  const matches = matchProceduresForNeed({
    need: gap,
    procedures,
    candidates,
    minScore: normalizedPolicy.minReuseConfidence,
  });
  const policyAllowedMatches = matches.filter((match) =>
    canReuseProcedureAutomatically({ need: gap, match, policy: normalizedPolicy }).ok);
  const reusable = policyAllowedMatches.find((match) =>
    procedureHasSubstantiveReuseValidation(match.procedure));
  if (!reusable) {
    return {
      ok: false,
      reason: policyAllowedMatches.length
        ? 'procedure_missing_substantive_reuse_validation'
        : matches.length
          ? 'matches_not_reusable_by_policy'
          : 'no_reusable_procedure',
      matches,
      task: null,
    };
  }
  if (reuseAlreadyAttempted({ memory, gap, procedureId: reusable.procedureId })) {
    return {
      ok: false,
      reason: 'reuse_already_attempted_for_gap',
      match: reusable,
      matches,
      task: null,
    };
  }
  return {
    ok: true,
    reason: 'reusable_procedure_found',
    match: reusable,
    matches,
    task: createAutonomousReuseTask({ gap, match: reusable, now }),
  };
};
