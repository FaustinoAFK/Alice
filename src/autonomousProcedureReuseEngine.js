import { createAutonomousReuseTask } from './autonomousLearningPlanner';
import { normalizeAutonomousLearningPolicy } from './autonomousLearningPolicy';
import { matchProceduresForNeed } from './autonomousProcedureMatcher';
import { canReuseProcedureAutomatically } from './autonomousReusePolicy';

const normalizeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

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
  const reusable = matches.find((match) =>
    canReuseProcedureAutomatically({ need: gap, match, policy: normalizedPolicy }).ok);
  if (!reusable) {
    return {
      ok: false,
      reason: matches.length ? 'matches_not_reusable_by_policy' : 'no_reusable_procedure',
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
