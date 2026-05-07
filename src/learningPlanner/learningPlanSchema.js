import {
  LEARNING_EVIDENCE_KINDS,
  LEARNING_PLAN_STATUS,
  LEARNING_PLAN_STATUSES,
  LEARNING_PLANNER_SCHEMA_VERSION,
  LEARNING_RISK_DECISION,
  LEARNING_RISK_DECISIONS,
  LEARNING_RISK_LEVEL,
  LEARNING_RISK_LEVELS,
  LEARNING_TRAINING_ACTION_KINDS,
  createLearningPlan,
  normalizeArray,
  normalizeText,
} from './learningPlannerTypes';

const DANGEROUS_ACTION_PATTERN =
  /\b(rm\s+-rf|remove-item\s+-recurse|del\s+\/[fsq]|format\b|shutdown\b|restart-computer\b|reg\s+delete|diskpart|bcdedit|takeown\b|icacls\b|payment|purchase|send\s+email|send_message|bypass_login|bypass_captcha|real_pc_write|delete_real_files)\b/i;

const addIssue = (issues, path, reason, message = reason) => {
  issues.push({ path, reason, message });
};

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const includesEnum = (validValues, value) => validValues.includes(normalizeText(value).toLowerCase());

const validateText = (issues, value, path, reason) => {
  if (!normalizeText(value)) {
    addIssue(issues, path, reason);
  }
};

const riskRank = (level = LEARNING_RISK_LEVEL.LOW) => {
  const index = LEARNING_RISK_LEVELS.indexOf(normalizeText(level).toLowerCase());
  return index >= 0 ? index : 0;
};

const classifyActionRisk = ({ actionKind = '', actionSummary = '', risk = {} } = {}) => {
  const normalizedKind = normalizeText(actionKind).toLowerCase();
  const text = normalizeText(actionSummary).toLowerCase();
  const explicitDecision = normalizeText(risk.decision).toLowerCase();
  const level = normalizeText(risk.level).toLowerCase() || LEARNING_RISK_LEVEL.LOW;
  const dangerous = DANGEROUS_ACTION_PATTERN.test(`${normalizedKind} ${text}`);
  const unknownAction = Boolean(normalizedKind) && !LEARNING_TRAINING_ACTION_KINDS.includes(normalizedKind);

  if (explicitDecision === LEARNING_RISK_DECISION.INVALID) {
    return { ok: false, approvalRequired: false, reason: 'risk_marked_invalid' };
  }
  if (explicitDecision === LEARNING_RISK_DECISION.APPROVAL_REQUIRED) {
    return { ok: true, approvalRequired: true, reason: 'approval_required' };
  }
  if (dangerous && explicitDecision !== LEARNING_RISK_DECISION.APPROVAL_REQUIRED) {
    return { ok: false, approvalRequired: false, reason: 'dangerous_action_requires_rejection_or_approval' };
  }
  if (unknownAction && dangerous) {
    return { ok: false, approvalRequired: false, reason: 'unknown_dangerous_action' };
  }
  if (unknownAction || riskRank(level) >= riskRank(LEARNING_RISK_LEVEL.HIGH) || risk.requiresApproval) {
    if (explicitDecision !== LEARNING_RISK_DECISION.APPROVAL_REQUIRED) {
      return { ok: false, approvalRequired: true, reason: 'approval_required_for_unknown_or_high_risk_action' };
    }
    return { ok: true, approvalRequired: true, reason: 'approval_required' };
  }
  return { ok: true, approvalRequired: false, reason: 'risk_accepted' };
};

const validateEvidenceRequirement = (issues, evidence = {}, path = '') => {
  if (!isObject(evidence)) {
    addIssue(issues, path, 'evidence_requirement_malformed');
    return;
  }
  validateText(issues, evidence.evidenceId || evidence.id, `${path}.evidenceId`, 'evidence_id_required');
  if (!includesEnum(LEARNING_EVIDENCE_KINDS, evidence.kind)) {
    addIssue(issues, `${path}.kind`, 'evidence_kind_invalid');
  }
  validateText(issues, evidence.description, `${path}.description`, 'evidence_description_required');
};

const validateRisk = (issues, risk = {}, path = '') => {
  if (!isObject(risk)) {
    addIssue(issues, path, 'risk_malformed');
    return;
  }
  if (!includesEnum(LEARNING_RISK_LEVELS, risk.level || LEARNING_RISK_LEVEL.LOW)) {
    addIssue(issues, `${path}.level`, 'risk_level_invalid');
  }
  if (!includesEnum(LEARNING_RISK_DECISIONS, risk.decision || LEARNING_RISK_DECISION.VALID)) {
    addIssue(issues, `${path}.decision`, 'risk_decision_invalid');
  }
};

const validateSkill = (issues, skill = {}, path = '') => {
  if (!isObject(skill)) {
    addIssue(issues, path, 'skill_malformed');
    return;
  }
  validateText(issues, skill.skillId || skill.id, `${path}.skillId`, 'skill_id_required');
  validateText(issues, skill.title, `${path}.title`, 'skill_title_required');
  if (normalizeArray(skill.requiredTools).map(normalizeText).filter(Boolean).length === 0) {
    addIssue(issues, `${path}.requiredTools`, 'skill_required_tools_missing');
  }
  if (normalizeArray(skill.successCriteria).map(normalizeText).filter(Boolean).length === 0) {
    addIssue(issues, `${path}.successCriteria`, 'skill_success_criteria_missing');
  }
  validateRisk(issues, skill.risk || {}, `${path}.risk`);
};

const validateTrainingTask = (issues, task = {}, path = '') => {
  if (!isObject(task)) {
    addIssue(issues, path, 'training_task_malformed');
    return;
  }
  validateText(issues, task.taskId || task.id, `${path}.taskId`, 'training_task_id_required');
  validateText(issues, task.title, `${path}.title`, 'training_task_title_required');
  validateText(issues, task.objective, `${path}.objective`, 'training_task_objective_required');
  const actionKindKnown = includesEnum(LEARNING_TRAINING_ACTION_KINDS, task.actionKind || task.kind);
  const riskDecisionText = normalizeText(task.risk?.decision).toLowerCase();
  if (!actionKindKnown && riskDecisionText !== LEARNING_RISK_DECISION.APPROVAL_REQUIRED) {
    addIssue(issues, `${path}.actionKind`, 'training_task_action_kind_invalid');
  }
  const expectedEvidence = normalizeArray(task.expectedEvidence);
  if (expectedEvidence.length === 0) {
    addIssue(issues, `${path}.expectedEvidence`, 'training_task_expected_evidence_missing');
  }
  expectedEvidence.forEach((evidence, index) =>
    validateEvidenceRequirement(issues, evidence, `${path}.expectedEvidence.${index}`));
  validateRisk(issues, task.risk || {}, `${path}.risk`);
  const riskDecision = classifyActionRisk({
    actionKind: task.actionKind || task.kind,
    actionSummary: task.actionSummary || task.summary || task.objective,
    risk: task.risk || {},
  });
  if (!riskDecision.ok) {
    addIssue(issues, `${path}.risk`, riskDecision.reason);
  } else if (riskDecision.approvalRequired) {
    addIssue(issues, `${path}.risk`, 'approval_required_for_unknown_or_high_risk_action');
  }
};

export const validateLearningPlanSchema = (candidate = {}) => {
  const issues = [];

  if (!isObject(candidate)) {
    return {
      ok: false,
      status: LEARNING_PLAN_STATUS.REJECTED,
      reason: 'learning_plan_malformed',
      issues: [{ path: 'plan', reason: 'learning_plan_malformed', message: 'learning_plan_malformed' }],
      plan: null,
    };
  }

  if (Number(candidate.schemaVersion) !== LEARNING_PLANNER_SCHEMA_VERSION) {
    addIssue(issues, 'schemaVersion', 'learning_plan_schema_version_invalid');
  }
  validateText(issues, candidate.planId || candidate.id, 'planId', 'learning_plan_id_required');
  validateText(issues, candidate.requestId, 'requestId', 'learning_plan_request_id_required');
  validateText(issues, candidate.objective, 'objective', 'learning_plan_objective_required');
  if (normalizeArray(candidate.objectiveSuccessCriteria).map(normalizeText).filter(Boolean).length === 0) {
    addIssue(issues, 'objectiveSuccessCriteria', 'objective_success_criteria_missing');
  }
  if (candidate.status && !LEARNING_PLAN_STATUSES.includes(normalizeText(candidate.status).toLowerCase())) {
    addIssue(issues, 'status', 'learning_plan_status_invalid');
  }
  const skills = normalizeArray(candidate.skills);
  if (skills.length === 0) {
    addIssue(issues, 'skills', 'learning_plan_skills_missing');
  }
  skills.forEach((skill, index) => validateSkill(issues, skill, `skills.${index}`));
  const tasks = normalizeArray(candidate.trainingTasks);
  if (tasks.length === 0) {
    addIssue(issues, 'trainingTasks', 'learning_plan_training_tasks_missing');
  }
  tasks.forEach((task, index) => validateTrainingTask(issues, task, `trainingTasks.${index}`));
  validateRisk(issues, candidate.risk || {}, 'risk');

  const hasApprovalIssues = issues.some((issue) => issue.reason.includes('approval_required'));
  const hardIssues = issues.filter((issue) => !issue.reason.includes('approval_required'));
  const status = hardIssues.length > 0
    ? LEARNING_PLAN_STATUS.REJECTED
    : hasApprovalIssues
      ? LEARNING_PLAN_STATUS.APPROVAL_REQUIRED
      : LEARNING_PLAN_STATUS.VALIDATED;

  return {
    ok: hardIssues.length === 0,
    status,
    reason: issues.length === 0
      ? 'learning_plan_valid'
      : hasApprovalIssues && hardIssues.length === 0
        ? 'learning_plan_approval_required'
        : 'learning_plan_invalid',
    issues,
    plan: issues.length === 0 || hardIssues.length === 0
      ? createLearningPlan({ ...candidate, status })
      : null,
  };
};

export const assertValidLearningPlanSchema = (candidate = {}) => {
  const validation = validateLearningPlanSchema(candidate);
  if (!validation.ok || validation.status !== LEARNING_PLAN_STATUS.VALIDATED) {
    const error = new Error(validation.reason);
    error.validation = validation;
    throw error;
  }
  return validation.plan;
};
