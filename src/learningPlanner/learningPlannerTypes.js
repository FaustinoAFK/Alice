export const LEARNING_PLANNER_SCHEMA_VERSION = 1;

export const LEARNING_PLAN_STATUS = {
  DRAFT: 'draft',
  VALIDATED: 'validated',
  APPROVAL_REQUIRED: 'approval_required',
  REJECTED: 'rejected',
  PLAN_FAILED: 'plan_failed',
  NEEDS_USER_REVIEW: 'needs_user_review',
  CANCELLED: 'cancelled',
};

export const LEARNING_RISK_LEVEL = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

export const LEARNING_RISK_DECISION = {
  VALID: 'valid',
  APPROVAL_REQUIRED: 'approval_required',
  INVALID: 'invalid',
};

export const LEARNING_EVIDENCE_KIND = {
  COMMAND_OUTPUT: 'command_output',
  FILE_ARTIFACT: 'file_artifact',
  SCREENSHOT: 'screenshot',
  VALIDATION_REPORT: 'validation_report',
  HUMAN_APPROVAL: 'human_approval',
};

export const LEARNING_TRAINING_ACTION_KIND = {
  COMMAND: 'command',
  VISUAL: 'visual',
  RESEARCH: 'research',
  FILE_CHECK: 'file_check',
  VALIDATION: 'validation',
  CREATE_FOLDER: 'create_folder',
};

export const LEARNING_PLANNER_CREATED_BY = 'learning_planner';

export const LEARNING_PLAN_STATUSES = Object.values(LEARNING_PLAN_STATUS);
export const LEARNING_RISK_LEVELS = Object.values(LEARNING_RISK_LEVEL);
export const LEARNING_RISK_DECISIONS = Object.values(LEARNING_RISK_DECISION);
export const LEARNING_EVIDENCE_KINDS = Object.values(LEARNING_EVIDENCE_KIND);
export const LEARNING_TRAINING_ACTION_KINDS = Object.values(LEARNING_TRAINING_ACTION_KIND);

export const LEARNING_PLAN_LIMITS = {
  maxPlans: 40,
  maxAuditEvents: 120,
  maxSkills: 12,
  maxTrainingTasks: 40,
  maxEvidenceRequirements: 8,
  maxToolsPerSkill: 12,
  maxSuccessCriteria: 12,
  maxTextLength: 600,
  maxLongTextLength: 1600,
};

export const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
export const normalizeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const normalizeEnum = (value, validValues, fallback) => {
  const normalized = normalizeText(value).toLowerCase();
  return validValues.includes(normalized) ? normalized : fallback;
};

const truncateText = (value, maxLength = LEARNING_PLAN_LIMITS.maxTextLength) =>
  normalizeText(value).slice(0, maxLength);

export const createLearningEvidenceRequirement = (input = {}) => ({
  evidenceId: truncateText(input.evidenceId || input.id || ''),
  kind: normalizeEnum(input.kind, LEARNING_EVIDENCE_KINDS, ''),
  description: truncateText(input.description, LEARNING_PLAN_LIMITS.maxLongTextLength),
  required: input.required !== false,
  validationHint: truncateText(input.validationHint),
});

export const createLearningRisk = (input = {}) => ({
  level: normalizeEnum(input.level, LEARNING_RISK_LEVELS, LEARNING_RISK_LEVEL.LOW),
  decision: normalizeEnum(input.decision, LEARNING_RISK_DECISIONS, LEARNING_RISK_DECISION.VALID),
  reason: truncateText(input.reason),
  requiresApproval: Boolean(input.requiresApproval || input.decision === LEARNING_RISK_DECISION.APPROVAL_REQUIRED),
});

export const createLearningTrainingTask = (input = {}) => ({
  taskId: truncateText(input.taskId || input.id || ''),
  title: truncateText(input.title),
  objective: truncateText(input.objective, LEARNING_PLAN_LIMITS.maxLongTextLength),
  actionKind: normalizeEnum(input.actionKind || input.kind, LEARNING_TRAINING_ACTION_KINDS, ''),
  actionSummary: truncateText(input.actionSummary || input.summary, LEARNING_PLAN_LIMITS.maxLongTextLength),
  expectedEvidence: normalizeArray(input.expectedEvidence)
    .slice(0, LEARNING_PLAN_LIMITS.maxEvidenceRequirements)
    .map(createLearningEvidenceRequirement),
  risk: createLearningRisk(input.risk || {}),
  dependsOnSkillIds: normalizeArray(input.dependsOnSkillIds)
    .map((item) => truncateText(item))
    .slice(0, LEARNING_PLAN_LIMITS.maxSkills),
  folder: input.folder && typeof input.folder === 'object'
    ? {
        displayName: truncateText(input.folder.displayName || input.folder.originalName || input.folder.name),
        filesystemName: truncateText(input.folder.filesystemName),
      }
    : null,
  target: input.target && typeof input.target === 'object'
    ? {
        displayName: truncateText(input.target.displayName || input.target.originalName || input.target.name),
        filesystemName: truncateText(input.target.filesystemName),
      }
    : null,
});

export const createLearningSkill = (input = {}) => ({
  skillId: truncateText(input.skillId || input.id || ''),
  title: truncateText(input.title),
  description: truncateText(input.description, LEARNING_PLAN_LIMITS.maxLongTextLength),
  requiredTools: normalizeArray(input.requiredTools)
    .map((item) => truncateText(item))
    .slice(0, LEARNING_PLAN_LIMITS.maxToolsPerSkill),
  successCriteria: normalizeArray(input.successCriteria).map((item) => truncateText(item, LEARNING_PLAN_LIMITS.maxLongTextLength))
    .slice(0, LEARNING_PLAN_LIMITS.maxSuccessCriteria),
  trainingTaskIds: normalizeArray(input.trainingTaskIds)
    .map((item) => truncateText(item))
    .slice(0, LEARNING_PLAN_LIMITS.maxTrainingTasks),
  risk: createLearningRisk(input.risk || {}),
});

export const createLearningRequest = (input = {}, { now = new Date().toISOString() } = {}) => ({
  requestId: truncateText(input.requestId || input.id || `learning-request-${Date.parse(now) || Date.now()}`),
  objective: truncateText(input.objective, LEARNING_PLAN_LIMITS.maxLongTextLength),
  requestedBy: truncateText(input.requestedBy || 'hud'),
  context: input.context && typeof input.context === 'object' ? input.context : {},
  createdAt: truncateText(input.createdAt || now),
});

export const createLearningPlan = (input = {}, { now = new Date().toISOString() } = {}) => ({
  schemaVersion: Number(input.schemaVersion || LEARNING_PLANNER_SCHEMA_VERSION),
  planId: truncateText(input.planId || input.id || `learning-plan-${Date.parse(now) || Date.now()}`),
  requestId: truncateText(input.requestId || ''),
  objective: truncateText(input.objective, LEARNING_PLAN_LIMITS.maxLongTextLength),
  objectiveSuccessCriteria: normalizeArray(input.objectiveSuccessCriteria)
    .map((item) => truncateText(item, LEARNING_PLAN_LIMITS.maxLongTextLength))
    .slice(0, LEARNING_PLAN_LIMITS.maxSuccessCriteria),
  status: normalizeEnum(input.status, LEARNING_PLAN_STATUSES, LEARNING_PLAN_STATUS.DRAFT),
  skills: normalizeArray(input.skills).slice(0, LEARNING_PLAN_LIMITS.maxSkills).map(createLearningSkill),
  trainingTasks: normalizeArray(input.trainingTasks)
    .slice(0, LEARNING_PLAN_LIMITS.maxTrainingTasks)
    .map(createLearningTrainingTask),
  learningGoal: input.learningGoal && typeof input.learningGoal === 'object'
    ? {
        title: truncateText(input.learningGoal.title || input.learningGoal.learningGoal || input.objective),
        objective: truncateText(input.learningGoal.objective || input.objective, LEARNING_PLAN_LIMITS.maxLongTextLength),
      }
    : null,
  validations: normalizeArray(input.validations)
    .map((item) => truncateText(typeof item === 'string' ? item : item?.description || item?.criterion, LEARNING_PLAN_LIMITS.maxLongTextLength))
    .filter(Boolean)
    .slice(0, LEARNING_PLAN_LIMITS.maxSuccessCriteria),
  expectedEvidence: normalizeArray(input.expectedEvidence)
    .slice(0, LEARNING_PLAN_LIMITS.maxEvidenceRequirements)
    .map(createLearningEvidenceRequirement),
  approvalRequirements: normalizeArray(input.approvalRequirements)
    .map((item) => truncateText(typeof item === 'string' ? item : item?.reason || item?.description, LEARNING_PLAN_LIMITS.maxLongTextLength))
    .filter(Boolean)
    .slice(0, LEARNING_PLAN_LIMITS.maxSuccessCriteria),
  blockedActions: normalizeArray(input.blockedActions)
    .map((item) => truncateText(typeof item === 'string' ? item : item?.action || item?.reason, LEARNING_PLAN_LIMITS.maxLongTextLength))
    .filter(Boolean)
    .slice(0, LEARNING_PLAN_LIMITS.maxSuccessCriteria),
  consolidationSuggestions: normalizeArray(input.consolidationSuggestions)
    .map((item) => truncateText(typeof item === 'string' ? item : item?.suggestion || item?.description, LEARNING_PLAN_LIMITS.maxLongTextLength))
    .filter(Boolean)
    .slice(0, LEARNING_PLAN_LIMITS.maxSuccessCriteria),
  risk: createLearningRisk(input.risk || {}),
  createdBy: truncateText(input.createdBy || LEARNING_PLANNER_CREATED_BY),
  createdAt: truncateText(input.createdAt || now),
  updatedAt: truncateText(input.updatedAt || now),
});
