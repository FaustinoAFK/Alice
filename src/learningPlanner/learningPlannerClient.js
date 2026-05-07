import {
  LEARNING_EVIDENCE_KINDS,
  LEARNING_PLAN_STATUS,
  LEARNING_PLANNER_SCHEMA_VERSION,
  LEARNING_RISK_DECISIONS,
  LEARNING_RISK_LEVELS,
  LEARNING_TRAINING_ACTION_KINDS,
  createLearningPlan,
  createLearningRequest,
  normalizeArray,
  normalizeText,
} from './learningPlannerTypes';
import { validateLearningPlanSchema } from './learningPlanSchema';

export const LEARNING_PLANNER_MODEL_SCHEMA_NAME = 'alice_learning_plan_v1';

export const LEARNING_PLANNER_MODEL_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'learningGoal',
    'requiredSkills',
    'trainingTasks',
    'validations',
    'expectedEvidence',
    'risks',
    'approvalRequirements',
    'blockedActions',
    'consolidationSuggestions',
  ],
  properties: {
    learningGoal: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'objective', 'successCriteria'],
      properties: {
        title: { type: 'string' },
        objective: { type: 'string' },
        successCriteria: { type: 'array', items: { type: 'string' } },
      },
    },
    requiredSkills: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['skillId', 'title', 'description', 'requiredTools', 'successCriteria'],
        properties: {
          skillId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          requiredTools: { type: 'array', items: { type: 'string' } },
          successCriteria: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    trainingTasks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['taskId', 'title', 'objective', 'actionKind', 'actionSummary', 'expectedEvidence', 'risk'],
        properties: {
          taskId: { type: 'string' },
          title: { type: 'string' },
          objective: { type: 'string' },
          actionKind: { type: 'string' },
          actionSummary: { type: 'string' },
          expectedEvidence: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['evidenceId', 'kind', 'description'],
              properties: {
                evidenceId: { type: 'string' },
                kind: { type: 'string' },
                description: { type: 'string' },
                validationHint: { type: 'string' },
              },
            },
          },
          risk: {
            type: 'object',
            additionalProperties: false,
            required: ['level', 'decision', 'reason', 'requiresApproval'],
            properties: {
              level: { type: 'string' },
              decision: { type: 'string' },
              reason: { type: 'string' },
              requiresApproval: { type: 'boolean' },
            },
          },
        },
      },
    },
    validations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['validationId', 'criterion', 'evidenceIds'],
        properties: {
          validationId: { type: 'string' },
          criterion: { type: 'string' },
          evidenceIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    expectedEvidence: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['evidenceId', 'kind', 'description'],
        properties: {
          evidenceId: { type: 'string' },
          kind: { type: 'string' },
          description: { type: 'string' },
          validationHint: { type: 'string' },
        },
      },
    },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['riskId', 'level', 'decision', 'reason', 'requiresApproval'],
        properties: {
          riskId: { type: 'string' },
          level: { type: 'string' },
          decision: { type: 'string' },
          reason: { type: 'string' },
          requiresApproval: { type: 'boolean' },
        },
      },
    },
    approvalRequirements: { type: 'array', items: { type: 'string' } },
    blockedActions: { type: 'array', items: { type: 'string' } },
    consolidationSuggestions: { type: 'array', items: { type: 'string' } },
  },
};

export const createLearningPlannerPrompt = (request = {}) => {
  const normalizedRequest = createLearningRequest(request);
  return [
    'You are Alice Learning Planner.',
    'You are only a planner, not an executor.',
    'Do not claim that any task has been executed, completed, learned, installed, changed, verified, or validated.',
    'Do not call tools, do not run commands, do not operate a VM, and do not modify files.',
    'Return only a strict structured learning plan matching the provided schema.',
    'Every plan must include learningGoal, requiredSkills, trainingTasks, validations, expectedEvidence, risks, approvalRequirements, blockedActions, and consolidationSuggestions.',
    'Every skill must include requiredTools.',
    'Every training task must include expectedEvidence.',
    'Dangerous, unknown, destructive, external-message, purchase, credential, bypass, real-PC-write, or data-deleting actions must be marked with risk.decision="approval_required" or risk.decision="invalid".',
    `Learning request id: ${normalizedRequest.requestId}`,
    `Learning objective: ${normalizedRequest.objective}`,
  ].join('\n');
};

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const issue = (path, reason, message = reason) => ({ path, reason, message });

const parseModelPayload = (response) => {
  if (isObject(response?.parsed)) {
    return { ok: true, payload: response.parsed };
  }
  if (isObject(response?.outputParsed)) {
    return { ok: true, payload: response.outputParsed };
  }
  if (isObject(response?.payload)) {
    return { ok: true, payload: response.payload };
  }
  if (isObject(response)) {
    return { ok: true, payload: response };
  }
  if (typeof response === 'string') {
    try {
      return { ok: true, payload: JSON.parse(response) };
    } catch {
      return { ok: false, reason: 'model_response_invalid_json' };
    }
  }
  return { ok: false, reason: 'model_response_empty' };
};

const validateStringArray = (issues, value, path, reason) => {
  if (normalizeArray(value).map(normalizeText).filter(Boolean).length === 0) {
    issues.push(issue(path, reason));
  }
};

export const validateLearningPlannerModelResponse = (payload = {}) => {
  const issues = [];
  if (!isObject(payload)) {
    return {
      ok: false,
      reason: 'model_response_schema_invalid',
      issues: [issue('response', 'model_response_malformed')],
    };
  }

  if (!isObject(payload.learningGoal)) {
    issues.push(issue('learningGoal', 'learning_goal_missing'));
  } else {
    if (!normalizeText(payload.learningGoal.objective)) {
      issues.push(issue('learningGoal.objective', 'learning_goal_objective_missing'));
    }
    validateStringArray(
      issues,
      payload.learningGoal.successCriteria,
      'learningGoal.successCriteria',
      'learning_goal_success_criteria_missing',
    );
  }

  const skills = normalizeArray(payload.requiredSkills);
  if (skills.length === 0) {
    issues.push(issue('requiredSkills', 'required_skills_missing'));
  }
  skills.forEach((skill, index) => {
    if (!normalizeText(skill?.skillId)) {
      issues.push(issue(`requiredSkills.${index}.skillId`, 'required_skill_id_missing'));
    }
    validateStringArray(issues, skill?.requiredTools, `requiredSkills.${index}.requiredTools`, 'required_skill_tools_missing');
    validateStringArray(issues, skill?.successCriteria, `requiredSkills.${index}.successCriteria`, 'required_skill_success_criteria_missing');
  });

  const trainingTasks = normalizeArray(payload.trainingTasks);
  if (trainingTasks.length === 0) {
    issues.push(issue('trainingTasks', 'training_tasks_missing'));
  }
  trainingTasks.forEach((task, index) => {
    if (!normalizeText(task?.taskId)) {
      issues.push(issue(`trainingTasks.${index}.taskId`, 'training_task_id_missing'));
    }
    if (!LEARNING_TRAINING_ACTION_KINDS.includes(normalizeText(task?.actionKind).toLowerCase()) &&
        normalizeText(task?.risk?.decision).toLowerCase() !== 'approval_required') {
      issues.push(issue(`trainingTasks.${index}.actionKind`, 'training_task_action_kind_invalid'));
    }
    if (normalizeArray(task?.expectedEvidence).length === 0) {
      issues.push(issue(`trainingTasks.${index}.expectedEvidence`, 'training_task_expected_evidence_missing'));
    }
  });

  validateStringArray(issues, payload.validations, 'validations', 'validation_criteria_missing');
  normalizeArray(payload.validations).forEach((validation, index) => {
    if (!normalizeText(validation?.criterion)) {
      issues.push(issue(`validations.${index}.criterion`, 'validation_criterion_missing'));
    }
    validateStringArray(issues, validation?.evidenceIds, `validations.${index}.evidenceIds`, 'validation_evidence_ids_missing');
  });
  if (normalizeArray(payload.expectedEvidence).length === 0) {
    issues.push(issue('expectedEvidence', 'expected_evidence_missing'));
  }
  normalizeArray(payload.expectedEvidence).forEach((evidence, index) => {
    if (!LEARNING_EVIDENCE_KINDS.includes(normalizeText(evidence?.kind).toLowerCase())) {
      issues.push(issue(`expectedEvidence.${index}.kind`, 'expected_evidence_kind_invalid'));
    }
  });
  if (!Array.isArray(payload.risks)) {
    issues.push(issue('risks', 'risks_missing'));
  }
  normalizeArray(payload.risks).forEach((risk, index) => {
    if (!LEARNING_RISK_LEVELS.includes(normalizeText(risk?.level).toLowerCase())) {
      issues.push(issue(`risks.${index}.level`, 'risk_level_invalid'));
    }
    if (!LEARNING_RISK_DECISIONS.includes(normalizeText(risk?.decision).toLowerCase())) {
      issues.push(issue(`risks.${index}.decision`, 'risk_decision_invalid'));
    }
  });
  ['approvalRequirements', 'blockedActions', 'consolidationSuggestions'].forEach((field) => {
    if (!Array.isArray(payload[field])) {
      issues.push(issue(field, `${field}_missing`));
    }
  });

  return {
    ok: issues.length === 0,
    reason: issues.length === 0 ? 'model_response_valid' : 'model_response_schema_invalid',
    issues,
  };
};

const planRiskFromModel = (payload = {}) => {
  const risks = normalizeArray(payload.risks);
  const approval = risks.find((risk) =>
    normalizeText(risk.decision).toLowerCase() === 'approval_required' || risk.requiresApproval === true);
  const invalid = risks.find((risk) => normalizeText(risk.decision).toLowerCase() === 'invalid');
  const source = invalid || approval || risks[0] || {};
  return {
    level: source.level || 'low',
    decision: invalid ? 'invalid' : approval ? 'approval_required' : source.decision || 'valid',
    reason: source.reason || '',
    requiresApproval: Boolean(approval),
  };
};

export const convertModelResponseToLearningPlan = (payload = {}, request = {}, { now = new Date().toISOString() } = {}) =>
  createLearningPlan({
    schemaVersion: LEARNING_PLANNER_SCHEMA_VERSION,
    planId: `learning-plan-${normalizeText(request.requestId) || Date.parse(now) || Date.now()}`,
    requestId: request.requestId,
    objective: payload.learningGoal?.objective || request.objective,
    objectiveSuccessCriteria: payload.learningGoal?.successCriteria || [],
    status: LEARNING_PLAN_STATUS.DRAFT,
    learningGoal: payload.learningGoal,
    skills: normalizeArray(payload.requiredSkills).map((skill) => ({
      skillId: skill.skillId,
      title: skill.title,
      description: skill.description,
      requiredTools: skill.requiredTools,
      successCriteria: skill.successCriteria,
      trainingTaskIds: normalizeArray(payload.trainingTasks)
        .filter((task) => normalizeArray(task.skillIds).includes(skill.skillId))
        .map((task) => task.taskId),
      risk: { level: 'low', decision: 'valid' },
    })),
    trainingTasks: normalizeArray(payload.trainingTasks).map((task) => ({
      taskId: task.taskId,
      title: task.title,
      objective: task.objective,
      actionKind: task.actionKind,
      actionSummary: task.actionSummary,
      expectedEvidence: task.expectedEvidence,
      risk: task.risk,
    })),
    validations: normalizeArray(payload.validations).map((validation) => validation.criterion),
    expectedEvidence: payload.expectedEvidence,
    approvalRequirements: payload.approvalRequirements,
    blockedActions: payload.blockedActions,
    consolidationSuggestions: payload.consolidationSuggestions,
    risk: planRiskFromModel(payload),
    createdBy: 'learning_planner_model',
    createdAt: now,
    updatedAt: now,
  });

const resultFromFailure = ({ request, status = LEARNING_PLAN_STATUS.PLAN_FAILED, reason, issues = [], rawResponse = null }) => ({
  ok: false,
  status,
  reason,
  request,
  plan: null,
  rawResponse,
  validation: {
    ok: false,
    status,
    reason,
    issues,
  },
});

export class LearningPlannerClient {
  constructor({
    modelAdapter,
    now = () => new Date().toISOString(),
  } = {}) {
    this.modelAdapter = modelAdapter;
    this.now = now;
  }

  async createPlan(requestInput = {}, { timeoutMs = 30000 } = {}) {
    const now = this.now();
    const request = createLearningRequest(requestInput, { now });
    if (!normalizeText(request.objective)) {
      return resultFromFailure({
        request,
        reason: 'learning_request_objective_required',
        issues: [issue('request.objective', 'learning_request_objective_required')],
      });
    }
    if (!this.modelAdapter || typeof this.modelAdapter.createLearningPlan !== 'function') {
      return resultFromFailure({
        request,
        reason: 'learning_planner_model_adapter_missing',
        issues: [issue('modelAdapter', 'learning_planner_model_adapter_missing')],
      });
    }

    const prompt = createLearningPlannerPrompt(request);
    let rawResponse = null;
    try {
      rawResponse = await this.modelAdapter.createLearningPlan({
        request,
        prompt,
        timeoutMs,
        responseFormat: {
          type: 'json_schema',
          name: LEARNING_PLANNER_MODEL_SCHEMA_NAME,
          strict: true,
          schema: LEARNING_PLANNER_MODEL_RESPONSE_JSON_SCHEMA,
        },
      });
    } catch (error) {
      return resultFromFailure({
        request,
        reason: error?.name === 'TimeoutError' ? 'learning_planner_model_timeout' : 'learning_planner_model_failed',
        issues: [issue('model', error?.message || 'learning_planner_model_failed')],
      });
    }

    const parsed = parseModelPayload(rawResponse);
    if (!parsed.ok) {
      return resultFromFailure({
        request,
        reason: parsed.reason,
        issues: [issue('modelResponse', parsed.reason)],
        rawResponse,
      });
    }

    const modelValidation = validateLearningPlannerModelResponse(parsed.payload);
    if (!modelValidation.ok) {
      return resultFromFailure({
        request,
        reason: modelValidation.reason,
        issues: modelValidation.issues,
        rawResponse,
      });
    }

    const candidatePlan = convertModelResponseToLearningPlan(parsed.payload, request, { now });
    const planValidation = validateLearningPlanSchema(candidatePlan);
    if (planValidation.status === LEARNING_PLAN_STATUS.APPROVAL_REQUIRED) {
      return {
        ok: false,
        status: LEARNING_PLAN_STATUS.NEEDS_USER_REVIEW,
        reason: 'learning_plan_needs_user_review',
        request,
        plan: createLearningPlan({ ...planValidation.plan, status: LEARNING_PLAN_STATUS.NEEDS_USER_REVIEW }),
        rawResponse,
        validation: {
          ...planValidation,
          status: LEARNING_PLAN_STATUS.NEEDS_USER_REVIEW,
          reason: 'learning_plan_needs_user_review',
        },
      };
    }
    if (!planValidation.ok || !planValidation.plan) {
      return resultFromFailure({
        request,
        reason: planValidation.reason,
        issues: planValidation.issues,
        rawResponse,
      });
    }

    return {
      ok: true,
      status: LEARNING_PLAN_STATUS.VALIDATED,
      reason: 'learning_plan_created',
      request,
      plan: planValidation.plan,
      rawResponse,
      validation: planValidation,
    };
  }
}

export const createOpenAIResponsesLearningPlannerAdapter = ({
  openai,
  model = 'gpt-4o-mini',
} = {}) => ({
  async createLearningPlan({ prompt, responseFormat }) {
    if (!openai?.responses?.parse) {
      throw new Error('openai_responses_parse_unavailable');
    }
    const response = await openai.responses.parse({
      model,
      input: [
        {
          role: 'system',
          content: 'You create strict structured planning JSON only. You never execute tasks.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      text: {
        format: responseFormat,
      },
    });
    const outputMessage = normalizeArray(response.output).find((output) => output.type === 'message');
    const parsedItem = normalizeArray(outputMessage?.content).find((item) => item.parsed);
    const refusal = normalizeArray(outputMessage?.content).find((item) => item.type === 'refusal');
    if (refusal) {
      throw new Error('learning_planner_model_refused');
    }
    return parsedItem?.parsed || response.output_parsed || response;
  },
});
