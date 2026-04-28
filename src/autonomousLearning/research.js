import { AUTONOMOUS_LIMITS, normalizeText } from './contracts';

export const createResearchPlan = ({
  query = '',
  reason = '',
  maxCycles = AUTONOMOUS_LIMITS.maxResearchCycles,
  maxSources = AUTONOMOUS_LIMITS.maxResearchSources,
  preferredScope = 'global',
  now = Date.now(),
} = {}) => {
  const limitedCycles = Math.max(1, Math.min(AUTONOMOUS_LIMITS.maxResearchCycles, Math.trunc(Number(maxCycles) || 1)));
  const limitedSources = Math.max(1, Math.min(AUTONOMOUS_LIMITS.maxResearchSources, Math.trunc(Number(maxSources) || 1)));

  return {
    researchId: `research-${now}`,
    query: normalizeText(query),
    reason: normalizeText(reason),
    preferredScope,
    limits: {
      cycles: limitedCycles,
      sources: limitedSources,
    },
    status: normalizeText(query) ? 'planned' : 'blocked',
    blockReason: normalizeText(query) ? '' : 'missing_query',
    createdAt: now,
  };
};

export const shouldStopResearch = ({ cyclesCompleted = 0, sourcesRead = 0, plan } = {}) => {
  const cycleLimit = Number(plan?.limits?.cycles || AUTONOMOUS_LIMITS.maxResearchCycles);
  const sourceLimit = Number(plan?.limits?.sources || AUTONOMOUS_LIMITS.maxResearchSources);

  if (cyclesCompleted >= cycleLimit) {
    return {
      stop: true,
      reason: 'research_cycle_limit_reached',
    };
  }

  if (sourcesRead >= sourceLimit) {
    return {
      stop: true,
      reason: 'research_source_limit_reached',
    };
  }

  return {
    stop: false,
    reason: '',
  };
};

export const recordResearchFinding = ({ plan, findings = [], now = Date.now() } = {}) => ({
  researchId: plan?.researchId || `research-${now}`,
  query: plan?.query || '',
  findings: findings.slice(0, Number(plan?.limits?.sources || AUTONOMOUS_LIMITS.maxResearchSources)).map((finding) => ({
    title: normalizeText(finding.title),
    url: normalizeText(finding.url),
    summary: normalizeText(finding.summary || finding.snippet),
    confidence: Math.min(1, Math.max(0, Number(finding.confidence || 0))),
  })),
  cyclesUsed: Math.min(Number(plan?.limits?.cycles || 1), Math.max(1, Number(plan?.cyclesUsed || 1))),
  status: findings.length > 0 ? 'done' : 'empty',
  createdAt: now,
});

export const createActionableResearchCycle = ({
  query = '',
  findings = [],
  recommendedApproach = '',
  alternatives = [],
  risks = [],
  confidence = 0,
  testPlan = [],
  plan = null,
  now = Date.now(),
} = {}) => {
  const researchPlan = plan || createResearchPlan({ query, now });
  const findingRecord = recordResearchFinding({ plan: researchPlan, findings, now });
  const limitedAlternatives = alternatives.slice(0, 3).map((alternative) => normalizeText(alternative));
  const limitedRisks = risks.slice(0, 5).map((risk) => normalizeText(risk));
  const limitedTestPlan = testPlan.slice(0, 8).map((step) => normalizeText(step));
  const actionable = Boolean(normalizeText(recommendedApproach) && limitedTestPlan.length > 0);

  return {
    ...findingRecord,
    recommendedApproach: normalizeText(recommendedApproach),
    alternatives: limitedAlternatives,
    risks: limitedRisks,
    confidence: Math.min(1, Math.max(0, Number(confidence || 0))),
    testPlan: limitedTestPlan,
    actionable,
    status: actionable ? findingRecord.status : 'needs_testable_plan',
    nextStep: actionable ? 'test_in_playground' : 'refine_once_with_limits',
  };
};
