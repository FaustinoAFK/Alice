import { RISK_LEVELS, normalizeArray, normalizeText } from './contracts';

export const createImprovementProposal = ({
  proposalId = '',
  title = '',
  description = '',
  reason = '',
  affectedFiles = [],
  riskLevel = RISK_LEVELS.MEDIUM,
  beforeMetrics = {},
  afterMetrics = {},
  testsRun = [],
  validationReport = null,
  rollbackPlan = null,
  patchSummary = '',
  patch = '',
  diff = '',
  approvalStatus = 'pending',
  vmTestReport = null,
  comparisonReport = null,
  now = Date.now(),
} = {}) => ({
  proposalId: normalizeText(proposalId) || `proposal-${now}`,
  title: normalizeText(title) || 'Proposta de melhoria da Alice',
  description: normalizeText(description),
  reason: normalizeText(reason),
  affectedFiles: normalizeArray(affectedFiles).map((file) => normalizeText(file)),
  riskLevel,
  beforeMetrics,
  afterMetrics,
  testsRun: normalizeArray(testsRun).map((test) => normalizeText(test)),
  validationReport,
  rollbackPlan,
  patchSummary: normalizeText(patchSummary),
  patch: String(patch || ''),
  diff: String(diff || patch || ''),
  vmTestReport,
  comparisonReport,
  requiresUserApproval: true,
  mayApplyDirectly: false,
  approvalStatus,
  status: 'pending_approval',
  createdAt: now,
});

export const policyAllowsProposalApplication = ({ proposal, userApproved = false } = {}) => ({
  allowed: Boolean(
    proposal?.requiresUserApproval &&
    userApproved &&
    proposal?.validationReport?.passed &&
    (proposal?.patch || proposal?.diff),
  ),
  reason:
    !userApproved
      ? 'self_improvement_requires_user_approval'
      : !proposal?.validationReport?.passed
        ? 'self_improvement_requires_validated_patch'
        : !(proposal?.patch || proposal?.diff)
          ? 'self_improvement_requires_separate_patch'
          : 'user_approved_self_improvement_application',
});

export const approveImprovementProposal = ({ proposal, userApproved = false, now = Date.now() } = {}) => {
  const policy = policyAllowsProposalApplication({ proposal, userApproved });
  return {
    ...proposal,
    approvalStatus: userApproved ? 'approved' : 'rejected',
    status: policy.allowed ? 'approved_ready_to_apply' : userApproved ? 'blocked_after_approval_check' : 'rejected',
    approvalDecisionAt: now,
    approvalPolicyReason: policy.reason,
  };
};
