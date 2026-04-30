import { normalizeAutonomousLearningPolicy } from './autonomousLearningPolicy';

const sensitiveNeed = (need = {}) =>
  /\b(pagamento|payment|comprar|buy|enviar email|send email|mensagem|message|delete|apagar|remover|captcha|login)\b/i
    .test(`${need.description || ''} ${need.text || ''}`);

export const canReuseProcedureAutomatically = ({ need = {}, match = {}, policy = {} } = {}) => {
  const normalizedPolicy = normalizeAutonomousLearningPolicy(policy);
  if (!normalizedPolicy.allowProcedureReuse) {
    return { ok: false, reason: 'procedure_reuse_disabled' };
  }
  if (sensitiveNeed(need)) {
    return { ok: false, reason: 'sensitive_need_requires_user_approval' };
  }
  const procedure = match.procedure || {};
  if (Number(procedure.failureCount || 0) > 0 && procedure.lastFailureContext === need.context) {
    return { ok: false, reason: 'procedure_failed_recently_in_context' };
  }
  if (procedure.status === 'active' && match.matchScore >= normalizedPolicy.activeReuseThreshold) {
    return { ok: true, reason: 'active_procedure_reuse_allowed' };
  }
  if (procedure.status === 'guarded' && match.matchScore >= normalizedPolicy.guardedReuseThreshold) {
    return { ok: true, reason: 'guarded_procedure_reuse_allowed' };
  }
  return { ok: false, reason: 'procedure_match_below_reuse_threshold' };
};
