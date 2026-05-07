import { validateLearningPlanSchema } from './learningPlanSchema';
import {
  LEARNING_PLAN_STATUS,
  normalizeArray,
  normalizeText,
} from './learningPlannerTypes';

export const LEARNING_PLAN_VALIDATION_DECISION = {
  APPROVED: 'approved',
  APPROVAL_REQUIRED: 'approval_required',
  BLOCKED: 'blocked',
  NEEDS_USER_REVIEW: 'needs_user_review',
};

const DEFAULT_AVAILABLE_TOOLS = [
  'learning_planner',
  'runner_evidence',
  'runner_evidence_validator',
  'browser',
  'validation_report',
  'human_review',
];

const destructiveFilesystemPattern =
  /\b(rm\s+-rf|remove-item\s+-recurse|del\s+\/[fsq]|format\b|diskpart|delete_real_files|real_pc_write|wipe|erase|unlinkSync|rmdir\s+\/s)\b/i;
const installPattern = /\b(install|installer|instalar|instalacao|winget\s+install|choco\s+install|npm\s+install|pip\s+install|msiexec)\b/i;
const loginPattern = /\b(login|log in|signin|sign in|entrar na conta|account|conta|password|senha|token|credential|credencial)\b/i;
const messagePattern = /\b(send email|send_email|email|e-mail|enviar mensagem|send message|send_message|sms|whatsapp|telegram|slack)\b/i;
const purchasePattern = /\b(purchase|comprar|buy|payment|pagamento|cartao|credit card|checkout|assinar|subscribe)\b/i;
const bypassRunnerPattern =
  /\b(bypass runner|sem runner|fora do runner|direct execution|execute directly|run directly|chamar tauri direto|invoke direto|run_local_vm|run_vm_guest|autonomous task runner bypass)\b/i;
const learnedPattern =
  /\b(mark learned|marcar como aprendido|skill learned|habilidade aprendida|status\s*[:=]\s*learned|promote active|marcar active|active procedure)\b/i;

const addFinding = (findings, severity, path, reason, message = reason) => {
  if (findings.some((finding) =>
    finding.severity === severity && finding.path === path && finding.reason === reason)) {
    return;
  }
  findings.push({ severity, path, reason, message });
};

const planText = (plan = {}) => [
  plan.objective,
  plan.learningGoal?.objective,
  plan.learningGoal?.title,
  ...normalizeArray(plan.objectiveSuccessCriteria),
  ...normalizeArray(plan.validations),
  ...normalizeArray(plan.approvalRequirements),
  ...normalizeArray(plan.blockedActions),
  ...normalizeArray(plan.consolidationSuggestions),
  ...normalizeArray(plan.skills).flatMap((skill) => [
    skill.title,
    skill.description,
    ...normalizeArray(skill.requiredTools),
    ...normalizeArray(skill.successCriteria),
  ]),
  ...normalizeArray(plan.trainingTasks).flatMap((task) => [
    task.title,
    task.objective,
    task.actionKind,
    task.actionSummary,
    task.risk?.reason,
    ...normalizeArray(task.expectedEvidence).flatMap((evidence) => [
      evidence.kind,
      evidence.description,
      evidence.validationHint,
    ]),
  ]),
  ...normalizeArray(plan.expectedEvidence).flatMap((evidence) => [
    evidence.kind,
    evidence.description,
    evidence.validationHint,
  ]),
].map(normalizeText).filter(Boolean).join('\n');

const taskTexts = (plan = {}) =>
  normalizeArray(plan.trainingTasks).map((task, index) => ({
    index,
    text: [
      task.title,
      task.objective,
      task.actionKind,
      task.actionSummary,
      task.risk?.reason,
    ].map(normalizeText).filter(Boolean).join(' '),
  }));

const hasObjectiveValidation = (plan = {}) =>
  normalizeArray(plan.objectiveSuccessCriteria).map(normalizeText).filter(Boolean).length > 0 &&
  normalizeArray(plan.validations).map(normalizeText).filter(Boolean).length > 0;

const hasExpectedEvidence = (plan = {}) =>
  normalizeArray(plan.expectedEvidence).length > 0 &&
  normalizeArray(plan.trainingTasks).every((task) => normalizeArray(task.expectedEvidence).length > 0);

const normalizeTool = (tool = '') => normalizeText(tool).toLowerCase();

const reviewRequiredTools = (findings, plan = {}, availableTools = DEFAULT_AVAILABLE_TOOLS) => {
  const available = new Set(normalizeArray(availableTools).map(normalizeTool));
  normalizeArray(plan.skills).forEach((skill, index) => {
    const requiredTools = normalizeArray(skill.requiredTools)
      .map((tool) => normalizeTool(tool))
      .filter(Boolean);
    if (requiredTools.length === 0) {
      addFinding(
        findings,
        LEARNING_PLAN_VALIDATION_DECISION.NEEDS_USER_REVIEW,
        `skills.${index}.requiredTools`,
        'required_tools_missing',
      );
      return;
    }
    const unavailable = requiredTools.filter((tool) => !available.has(tool));
    if (unavailable.length > 0) {
      addFinding(
        findings,
        LEARNING_PLAN_VALIDATION_DECISION.BLOCKED,
        `skills.${index}.requiredTools`,
        'required_tools_unavailable',
        `Ferramentas indisponiveis: ${unavailable.join(', ')}`,
      );
    }
  });
};

const approvalReasonForTaskText = (taskText = '') => {
  const approvalPatterns = [
    [installPattern, 'software_install_requires_approval'],
    [loginPattern, 'login_or_account_action_requires_approval'],
    [messagePattern, 'message_or_email_requires_approval'],
    [purchasePattern, 'purchase_or_payment_requires_approval'],
  ];
  return approvalPatterns.find(([pattern]) => pattern.test(taskText))?.[1] || null;
};

const findingFromSchemaIssue = (issue, normalizedPlan) => {
  if (issue.reason === 'skill_required_tools_missing') {
    return {
      severity: LEARNING_PLAN_VALIDATION_DECISION.NEEDS_USER_REVIEW,
      reason: 'required_tools_missing',
    };
  }

  if (issue.reason === 'dangerous_action_requires_rejection_or_approval') {
    const taskIndex = Number(issue.path.match(/^trainingTasks\.(\d+)/)?.[1]);
    const taskText = taskTexts(normalizedPlan).find((task) => task.index === taskIndex)?.text || '';
    const approvalReason = approvalReasonForTaskText(taskText);

    if (approvalReason) {
      return {
        severity: LEARNING_PLAN_VALIDATION_DECISION.APPROVAL_REQUIRED,
        reason: approvalReason,
      };
    }
  }

  return {
    severity: LEARNING_PLAN_VALIDATION_DECISION.BLOCKED,
    reason: issue.reason,
  };
};

export const validateLearningPlanForExecution = (
  plan = {},
  {
    availableTools = DEFAULT_AVAILABLE_TOOLS,
    allowDestructiveFilesystem = false,
  } = {},
) => {
  const findings = [];
  const schema = validateLearningPlanSchema(plan);
  const normalizedPlan = schema.plan || plan;
  const text = planText(normalizedPlan);

  if (!schema.ok && schema.status !== LEARNING_PLAN_STATUS.APPROVAL_REQUIRED) {
    schema.issues.forEach((issue) => {
      const finding = findingFromSchemaIssue(issue, normalizedPlan);
      addFinding(
        findings,
        finding.severity,
        issue.path,
        finding.reason,
        issue.message,
      );
    });
  }

  if (!hasObjectiveValidation(normalizedPlan)) {
    addFinding(
      findings,
      LEARNING_PLAN_VALIDATION_DECISION.BLOCKED,
      'objectiveSuccessCriteria',
      'objective_validation_missing',
    );
  }

  if (!hasExpectedEvidence(normalizedPlan)) {
    addFinding(
      findings,
      LEARNING_PLAN_VALIDATION_DECISION.BLOCKED,
      'expectedEvidence',
      'expected_evidence_missing',
    );
  }

  reviewRequiredTools(findings, normalizedPlan, availableTools);

  if (!allowDestructiveFilesystem && destructiveFilesystemPattern.test(text)) {
    addFinding(
      findings,
      LEARNING_PLAN_VALIDATION_DECISION.BLOCKED,
      'trainingTasks',
      'destructive_filesystem_action_blocked',
    );
  }

  if (bypassRunnerPattern.test(text)) {
    addFinding(
      findings,
      LEARNING_PLAN_VALIDATION_DECISION.BLOCKED,
      'trainingTasks',
      'autonomous_runner_bypass_blocked',
    );
  }

  if (learnedPattern.test(text)) {
    addFinding(
      findings,
      LEARNING_PLAN_VALIDATION_DECISION.BLOCKED,
      'consolidationSuggestions',
      'direct_learned_status_blocked',
    );
  }

  taskTexts(normalizedPlan).forEach(({ index, text: taskText }) => {
    const approvalReason = approvalReasonForTaskText(taskText);
    if (approvalReason) {
      addFinding(
        findings,
        LEARNING_PLAN_VALIDATION_DECISION.APPROVAL_REQUIRED,
        `trainingTasks.${index}`,
        approvalReason,
      );
    }
  });

  const blocked = findings.filter((finding) => finding.severity === LEARNING_PLAN_VALIDATION_DECISION.BLOCKED);
  const approval = findings.filter((finding) => finding.severity === LEARNING_PLAN_VALIDATION_DECISION.APPROVAL_REQUIRED);
  const review = findings.filter((finding) => finding.severity === LEARNING_PLAN_VALIDATION_DECISION.NEEDS_USER_REVIEW);
  const decision = blocked.length > 0
    ? LEARNING_PLAN_VALIDATION_DECISION.BLOCKED
    : approval.length > 0
      ? LEARNING_PLAN_VALIDATION_DECISION.APPROVAL_REQUIRED
      : review.length > 0
        ? LEARNING_PLAN_VALIDATION_DECISION.NEEDS_USER_REVIEW
        : LEARNING_PLAN_VALIDATION_DECISION.APPROVED;

  return {
    ok: decision === LEARNING_PLAN_VALIDATION_DECISION.APPROVED,
    decision,
    reason: findings[0]?.reason || 'learning_plan_approved_for_future_execution',
    findings,
    schema,
  };
};
