import { RUNNER_COMPLETION_TYPES } from './autonomousRunnerState';

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const normalizeEvidenceToken = (value) =>
  normalizeText(value).toLowerCase().replace(/[^a-z0-9]/g, '');

const getExitCode = (executionResult = {}) => {
  const artifacts = executionResult.artifacts || {};
  const agentResponse = artifacts.agentResponse || {};
  const agentResult = agentResponse.result || {};
  const agentSuccessExitCode = agentResponse.success === true
    ? 0
    : agentResponse.success === false
      ? 1
      : undefined;
  const code = agentResult.exit_code ??
    agentResult.exitCode ??
    agentSuccessExitCode ??
    artifacts.statusCode ??
    artifacts.exitCode ??
    executionResult.exitCode;
  if (Number.isFinite(Number(code))) {
    return Number(code);
  }
  return executionResult.ok ? 0 : 1;
};

const getExecutionOutput = (executionResult = {}) => {
  const artifacts = executionResult.artifacts || {};
  const agentResponse = artifacts.agentResponse || {};
  const agentResult = agentResponse.result || {};
  return [
    executionResult.stdout,
    executionResult.stderr,
    agentResult.stdout,
    agentResult.stderr,
    agentResponse.stdout,
    agentResponse.stderr,
    agentResponse.success !== undefined ? JSON.stringify(agentResponse) : '',
  ].map(normalizeText).filter(Boolean).join('\n');
};

const hasRequiredEvidence = (step = {}, evidenceRefs = []) => {
  const required = (step.expectedEvidence?.required || [])
    .filter((item) => normalizeEvidenceToken(item) !== 'validationresult');
  if (required.length === 0) {
    return evidenceRefs.length > 0;
  }

  return required.every((item) => {
    const token = normalizeEvidenceToken(item);
    const acceptedTokens = token === 'validationresult' ? [token, 'validation'] : [token];
    return evidenceRefs.some((ref) => {
      const metadata = ref.metadata && typeof ref.metadata === 'object' ? ref.metadata : {};
      const haystack = [
        ref.kind,
        ref.label,
        ref.path,
        ...Object.keys(metadata),
      ].map(normalizeEvidenceToken);
      return haystack.some((value) => acceptedTokens.some((acceptedToken) => value.includes(acceptedToken)));
    });
  });
};

export const validateRunnerCompletionCriteria = ({
  step = {},
  executionResult = {},
  evidenceRefs = [],
} = {}) => {
  const criteria = step.completionCriteria;
  if (!criteria?.type || !RUNNER_COMPLETION_TYPES.includes(criteria.type)) {
    return {
      passed: false,
      reason: 'completion_criteria_missing',
      checks: [],
    };
  }

  const exitCode = getExitCode(executionResult);
  const output = getExecutionOutput(executionResult);
  const evidenceOk = hasRequiredEvidence(step, evidenceRefs);
  let criterionPassed = false;
  let reason = '';

  switch (criteria.type) {
    case 'exit_code':
      criterionPassed = exitCode === Number(criteria.expected ?? 0);
      reason = criterionPassed ? 'exit_code_matched' : 'exit_code_mismatch';
      break;
    case 'tests_passed':
      criterionPassed = executionResult.ok === true && exitCode === 0 && !/\bfail(ed|ure)?\b/i.test(output);
      reason = criterionPassed ? 'tests_passed' : 'tests_failed';
      break;
    case 'build_passed':
      criterionPassed = executionResult.ok === true && exitCode === 0 && !/\berror\b/i.test(normalizeText(executionResult.stderr));
      reason = criterionPassed ? 'build_passed' : 'build_failed';
      break;
    case 'file_exists':
      criterionPassed = Boolean(executionResult.artifacts?.files?.includes?.(criteria.path) || executionResult.artifacts?.fileExists);
      reason = criterionPassed ? 'file_exists' : 'file_exists_not_evidenced';
      break;
    case 'file_contains':
      criterionPassed = Boolean(executionResult.artifacts?.fileContains || (criteria.contains && output.includes(criteria.contains)));
      reason = criterionPassed ? 'file_contains' : 'file_contains_not_evidenced';
      break;
    case 'visual_state':
      criterionPassed = Boolean(executionResult.artifacts?.validation?.passed || executionResult.artifacts?.agentResponse?.result?.validation?.passed);
      reason = criterionPassed ? 'visual_state_validated' : 'visual_state_not_validated';
      break;
    case 'custom_validation':
      criterionPassed = Boolean(executionResult.validationReport?.passed || executionResult.artifacts?.validation?.passed);
      reason = criterionPassed ? 'custom_validation_passed' : 'custom_validation_failed';
      break;
    default:
      criterionPassed = false;
      reason = 'unsupported_completion_criteria';
  }

  const passed = criterionPassed && evidenceOk;
  return {
    passed,
    status: passed ? 'passed' : 'failed',
    reason: passed
      ? 'runner_completion_validated'
      : !evidenceOk
        ? 'expected_evidence_missing'
        : reason,
    checks: [
      {
        type: criteria.type,
        passed: criterionPassed,
        evidence: reason,
      },
      {
        type: 'expected_evidence',
        passed: evidenceOk,
        evidence: evidenceRefs.map((ref) => ref.path || ref.kind).join('\n'),
      },
    ],
    commandResult: {
      exitCode,
      stdout: output.slice(0, 1000),
      stderr: normalizeText(executionResult.stderr || executionResult.artifacts?.agentResponse?.result?.stderr).slice(0, 1000),
    },
  };
};
