import { normalizeArray, normalizeText } from './contracts';

const SUBSTANTIVE_CHECK_TYPES = new Set([
  'assertion',
  'test',
  'file_diff',
  'semantic_output',
  'user_visible_result',
  'rollback_verification',
  'vm_reproduction',
  'functional',
  'impact',
  'regression',
  'performance',
  'quality',
  'environment_compatibility',
]);

export const VALIDATION_CHECK_TYPES = {
  RESULT: 'functional',
  IMPACT: 'impact',
  REGRESSION: 'regression',
  PERFORMANCE: 'performance',
  QUALITY: 'quality',
  ENVIRONMENT_COMPATIBILITY: 'environment_compatibility',
};

export const createValidationCheck = (input = {}) => ({
  checkId: normalizeText(input.checkId) || `check-${Date.now()}`,
  type: normalizeText(input.type) || 'assertion',
  label: normalizeText(input.label),
  passed: Boolean(input.passed),
  evidence: normalizeText(input.evidence),
});

export const evaluateValidationReport = ({
  validationId = `validation-${Date.now()}`,
  actionId = '',
  checks = [],
  commandResult = null,
  requiredEvidence = [],
  now = Date.now(),
} = {}) => {
  const normalizedChecks = normalizeArray(checks).map(createValidationCheck);
  const substantiveChecks = normalizedChecks.filter((check) => SUBSTANTIVE_CHECK_TYPES.has(check.type));
  const failedChecks = normalizedChecks.filter((check) => !check.passed);
  const hasOnlyNoErrorSignal =
    normalizedChecks.length === 0 ||
    (normalizedChecks.length === 1 && normalizedChecks[0].type === 'exit_code' && normalizedChecks[0].passed);
  const missingEvidence = normalizeArray(requiredEvidence).filter(
    (required) =>
      !normalizedChecks.some(
        (check) => check.passed && (check.type === required || check.label === required),
      ),
  );

  const passed =
    substantiveChecks.length > 0 &&
    !hasOnlyNoErrorSignal &&
    failedChecks.length === 0 &&
    missingEvidence.length === 0;

  return {
    validationId,
    actionId: normalizeText(actionId),
    status: passed ? 'passed' : 'failed',
    passed,
    createdAt: now,
    checks: normalizedChecks,
    commandResult: commandResult
      ? {
          exitCode: Number(commandResult.exitCode ?? 0),
          stdout: normalizeText(commandResult.stdout),
          stderr: normalizeText(commandResult.stderr),
        }
      : null,
    failedChecks,
    missingEvidence,
    reason: passed
      ? 'validation_passed_with_substantive_evidence'
      : hasOnlyNoErrorSignal
        ? 'validation_rejected_exit_code_only'
        : failedChecks.length > 0
          ? 'validation_checks_failed'
          : 'validation_missing_required_evidence',
  };
};

export const validationAllowsLearningPromotion = (validationReport) =>
  Boolean(validationReport?.passed) &&
  (
    validationReport.reason === 'validation_passed_with_substantive_evidence' ||
    validationReport.reason === 'validation_pipeline_passed'
  );

const countPassed = (checks) => checks.filter((check) => check.passed).length;

const buildChecker = ({ type, label, checks = [] } = {}) => {
  const scopedChecks = checks.filter((check) => check.type === type || check.label === label);
  const passed = scopedChecks.length > 0 && scopedChecks.every((check) => check.passed);

  return {
    checker: label || type,
    type,
    passed,
    evidence: scopedChecks.map((check) => check.evidence).filter(Boolean).join('\n'),
    checkCount: scopedChecks.length,
  };
};

export const ResultChecker = ({ checks = [] } = {}) =>
  buildChecker({ type: VALIDATION_CHECK_TYPES.RESULT, checks });

export const ImpactChecker = ({ checks = [] } = {}) =>
  buildChecker({ type: VALIDATION_CHECK_TYPES.IMPACT, checks });

export const RegressionChecker = ({ checks = [] } = {}) =>
  buildChecker({ type: VALIDATION_CHECK_TYPES.REGRESSION, checks });

export const PerformanceChecker = ({ checks = [] } = {}) =>
  buildChecker({ type: VALIDATION_CHECK_TYPES.PERFORMANCE, checks });

export const QualityChecker = ({ checks = [] } = {}) =>
  buildChecker({ type: VALIDATION_CHECK_TYPES.QUALITY, checks });

export const EnvironmentCompatibilityChecker = ({ checks = [] } = {}) =>
  buildChecker({ type: VALIDATION_CHECK_TYPES.ENVIRONMENT_COMPATIBILITY, checks });

export const calculateSolutionScore = ({
  checks = [],
  commandResult = null,
  diffSummary = [],
  hostImpact = {},
} = {}) => {
  const substantiveChecks = checks.filter((check) => SUBSTANTIVE_CHECK_TYPES.has(check.type));
  const passRatio = checks.length > 0 ? countPassed(checks) / checks.length : 0;
  const substantiveRatio =
    substantiveChecks.length > 0 ? countPassed(substantiveChecks) / substantiveChecks.length : 0;
  const stderrPenalty = commandResult?.stderr ? 0.08 : 0;
  const diffPenalty = diffSummary.length > 20 ? 0.1 : 0;
  const hostPenalty =
    Number(hostImpact.cpuPercent || 0) > 80 ||
    Number(hostImpact.ramPressurePercent || 0) > 85 ||
    Number(hostImpact.diskPressurePercent || 0) > 90
      ? 0.15
      : 0;
  const score = Math.max(0, Math.min(1, (passRatio * 0.45) + (substantiveRatio * 0.55) - stderrPenalty - diffPenalty - hostPenalty));

  return {
    score: Math.round(score * 100) / 100,
    passRatio,
    substantiveRatio,
    penalties: {
      stderrPenalty,
      diffPenalty,
      hostPenalty,
    },
  };
};

export const evaluateValidationPipeline = ({
  validationId = `validation-${Date.now()}`,
  actionId = '',
  checks = [],
  commandResult = null,
  diffSummary = [],
  hostImpact = {},
  vmEnvironment = {},
  hostEnvironment = {},
  requiredEvidence = [
    VALIDATION_CHECK_TYPES.RESULT,
    VALIDATION_CHECK_TYPES.IMPACT,
  ],
  now = Date.now(),
} = {}) => {
  const normalizedChecks = normalizeArray(checks).map(createValidationCheck);
  const compatibilityEvidence = normalizeText(vmEnvironment.os) && normalizeText(hostEnvironment.os)
    ? {
        type: VALIDATION_CHECK_TYPES.ENVIRONMENT_COMPATIBILITY,
        label: VALIDATION_CHECK_TYPES.ENVIRONMENT_COMPATIBILITY,
        passed: normalizeText(vmEnvironment.os) === normalizeText(hostEnvironment.os) ||
          normalizeText(vmEnvironment.family) === normalizeText(hostEnvironment.family),
        evidence: `vm=${normalizeText(vmEnvironment.os || vmEnvironment.family)} host=${normalizeText(hostEnvironment.os || hostEnvironment.family)}`,
      }
    : null;
  const allChecks = compatibilityEvidence
    ? [...normalizedChecks, createValidationCheck(compatibilityEvidence)]
    : normalizedChecks;
  const baseReport = evaluateValidationReport({
    validationId,
    actionId,
    checks: allChecks,
    commandResult,
    requiredEvidence,
    now,
  });
  const checkers = [
    ResultChecker({ checks: allChecks }),
    ImpactChecker({ checks: allChecks }),
    RegressionChecker({ checks: allChecks }),
    PerformanceChecker({ checks: allChecks }),
    QualityChecker({ checks: allChecks }),
    EnvironmentCompatibilityChecker({ checks: allChecks }),
  ];
  const solutionScore = calculateSolutionScore({
    checks: allChecks,
    commandResult,
    diffSummary,
    hostImpact,
  });

  return {
    ...baseReport,
    pipeline: {
      resultChecker: checkers[0],
      impactChecker: checkers[1],
      regressionChecker: checkers[2],
      performanceChecker: checkers[3],
      qualityChecker: checkers[4],
      environmentCompatibilityChecker: checkers[5],
    },
    diffSummary,
    hostImpact,
    vmEnvironment,
    hostEnvironment,
    solutionScore,
    passed: baseReport.passed && solutionScore.score >= 0.65,
    status: baseReport.passed && solutionScore.score >= 0.65 ? 'passed' : 'failed',
    reason:
      baseReport.passed && solutionScore.score >= 0.65
        ? 'validation_pipeline_passed'
        : baseReport.reason === 'validation_passed_with_substantive_evidence'
          ? 'validation_score_too_low'
          : baseReport.reason,
  };
};

export const ValidationReport = evaluateValidationReport;
export const ValidationPipeline = evaluateValidationPipeline;
export const SolutionScore = calculateSolutionScore;
