import { verifyLearningEvidenceRefs } from './autonomousLearningValidator';

export const validateProcedureReuseResult = async ({
  task,
  evidenceRefs = [],
  verifyRunnerEvidence = null,
  now = new Date().toISOString(),
} = {}) => {
  if (task?.status !== 'done') {
    return { ok: false, reason: 'reuse_task_not_done', checkedAt: now };
  }
  const verification = await verifyLearningEvidenceRefs({ evidenceRefs, verifyRunnerEvidence });
  if (!verification.ok) {
    return { ok: false, reason: verification.reason, checkedAt: now, verification };
  }
  return { ok: true, reason: 'procedure_reuse_validated', checkedAt: now, verification };
};

export const applyProcedureReuseOutcome = ({
  procedure = {},
  success = false,
  context = '',
  evidenceRefs = [],
  now = new Date().toISOString(),
} = {}) => ({
  ...procedure,
  usageCount: Number(procedure.usageCount || 0) + 1,
  successCount: Number(procedure.successCount || 0) + (success ? 1 : 0),
  failureCount: Number(procedure.failureCount || 0) + (success ? 0 : 1),
  confidence: Math.min(1, Math.max(0, Number(procedure.confidence || 0.5) + (success ? 0.03 : -0.12))),
  lastUsedAt: now,
  lastFailureContext: success ? '' : context,
  evidenceRefs: [...(procedure.evidenceRefs || []), ...evidenceRefs].slice(-16),
  updatedAt: now,
});
