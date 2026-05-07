import { LearningPlannerClient } from './learningPlannerClient';
import {
  LEARNING_PLAN_STATUS,
  createLearningPlan,
  normalizeArray,
  normalizeText,
} from './learningPlannerTypes';
import {
  getLearningPlannerState,
  saveLearningPlanRecord,
  setLearningPlanStatusInMemory,
} from './learningPlannerRepository';
import {
  LEARNING_PLAN_VALIDATION_DECISION,
  validateLearningPlanForExecution,
} from './learningPlanValidator';

const safeIdPart = (value = '') =>
  normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'learning';

export const createLocalLearningPlannerModelAdapter = () => ({
  async createLearningPlan({ request }) {
    const objective = normalizeText(request.objective);
    const dangerous = /\b(delete|apagar|remove-item|rm\s+-rf|real pc|pc real|pagamento|comprar|senha|captcha)\b/i
      .test(objective);
    const risk = dangerous
      ? {
          riskId: 'risk-user-review',
          level: 'high',
          decision: 'approval_required',
          reason: 'Objetivo pode envolver acao sensivel ou fora do escopo seguro.',
          requiresApproval: true,
        }
      : {
          riskId: 'risk-low',
          level: 'low',
          decision: 'valid',
          reason: 'Planejamento apenas, sem execucao.',
          requiresApproval: false,
        };

    return {
      learningGoal: {
        title: objective.length > 96 ? `${objective.slice(0, 93)}...` : objective,
        objective,
        successCriteria: [
          'Existe evidencia esperada para cada tarefa de treino.',
          'Nenhuma habilidade e considerada aprendida sem validacao posterior.',
        ],
      },
      requiredSkills: [
        {
          skillId: `skill-${safeIdPart(objective)}`,
          title: 'Planejar aprendizado governado',
          description: `Decompor o objetivo em treino validavel: ${objective}`,
          requiredTools: ['learning_planner', 'runner_evidence_validator'],
          successCriteria: ['Plano validado localmente antes de qualquer execucao.'],
        },
      ],
      trainingTasks: [
        {
          taskId: `training-${safeIdPart(objective)}`,
          title: 'Preparar treino controlado',
          objective,
          actionKind: 'validation',
          actionSummary: 'Definir tarefa de treino verificavel, sem executar comandos.',
          expectedEvidence: [
            {
              evidenceId: 'evidence-validation-plan',
              kind: 'validation_report',
              description: 'Relatorio futuro de validacao produzido apos execucao pelo Runner.',
              validationHint: 'Deve ser gerado por validacao local, nao por alegacao do modelo.',
            },
          ],
          risk: {
            level: risk.level,
            decision: risk.decision,
            reason: risk.reason,
            requiresApproval: risk.requiresApproval,
          },
        },
      ],
      validations: [
        {
          validationId: 'validation-evidence-required',
          criterion: 'Cada tarefa tem evidencia esperada antes de ser enviada para execucao futura.',
          evidenceIds: ['evidence-validation-plan'],
        },
      ],
      expectedEvidence: [
        {
          evidenceId: 'evidence-validation-plan',
          kind: 'validation_report',
          description: 'Evidencia futura obrigatoria para consolidacao.',
          validationHint: 'Nao aceitar conclusao sem arquivo/evidencia do Runner em fase posterior.',
        },
      ],
      risks: [risk],
      approvalRequirements: risk.requiresApproval
        ? ['Revisao humana obrigatoria antes de converter este plano em tarefas executaveis.']
        : [],
      blockedActions: ['Executar comandos', 'Operar VM', 'Marcar habilidade como aprendida'],
      consolidationSuggestions: ['Consolidar apenas como candidate/guarded depois de evidencia validada.'],
    };
  },
});

const failurePlanFromResult = (result = {}, { now = new Date().toISOString() } = {}) =>
  createLearningPlan({
    planId: `learning-plan-${safeIdPart(result.request?.requestId || result.request?.objective || now)}`,
    requestId: result.request?.requestId || '',
    objective: result.request?.objective || '',
    objectiveSuccessCriteria: ['Plano precisa ser revisado porque a resposta do modelo nao foi confiavel.'],
    status: result.status || LEARNING_PLAN_STATUS.PLAN_FAILED,
    skills: [
      {
        skillId: 'skill-review-invalid-plan',
        title: 'Revisar plano invalido',
        description: 'Plano nao confiavel gerado pelo modelo.',
        requiredTools: ['human_review'],
        successCriteria: ['Falha visivel no HUD antes de qualquer execucao.'],
      },
    ],
    trainingTasks: [
      {
        taskId: 'training-review-invalid-plan',
        title: 'Revisar falha de planejamento',
        objective: 'Inspecionar erro de validacao antes de tentar novamente.',
        actionKind: 'validation',
        actionSummary: 'Nenhuma execucao permitida para resposta invalida.',
        expectedEvidence: [
          {
            evidenceId: 'evidence-validation-error',
            kind: 'validation_report',
            description: result.reason || 'Resposta invalida do modelo.',
          },
        ],
        risk: { level: 'low', decision: 'valid', reason: result.reason || 'plan_failed' },
      },
    ],
    validations: ['Resposta invalida foi bloqueada antes de execucao.'],
    expectedEvidence: [
      {
        evidenceId: 'evidence-validation-error',
        kind: 'validation_report',
        description: result.reason || 'Resposta invalida do modelo.',
      },
    ],
    approvalRequirements: ['Revisar o erro antes de tentar converter em tarefa.'],
    blockedActions: ['Nao executar plano invalido', 'Nao marcar como aprendido'],
    consolidationSuggestions: ['Corrigir objetivo ou repetir planejamento com resposta estruturada valida.'],
    risk: { level: 'low', decision: 'valid', reason: result.reason || 'plan_failed' },
    createdAt: now,
    updatedAt: now,
  });

export const createLearningPlannerService = ({
  modelAdapter = createLocalLearningPlannerModelAdapter(),
  now = () => new Date().toISOString(),
} = {}) => {
  const client = new LearningPlannerClient({ modelAdapter, now });

  return {
    async createPlan(memory = {}, objective = '', options = {}) {
      const timestamp = now();
      const result = await client.createPlan({
        requestId: options.requestId || `learning-request-${Date.parse(timestamp) || Date.now()}`,
        objective,
        requestedBy: options.requestedBy || 'hud',
        context: options.context || {},
      });
      const planToSave = result.plan || failurePlanFromResult(result, { now: timestamp });
      return {
        ...result,
        memory: saveLearningPlanRecord(memory, planToSave, {
          validation: result.validation,
          now: timestamp,
        }),
        plan: planToSave,
      };
    },

    cancelActivePlan(memory = {}, { now: timestamp = now() } = {}) {
      const state = getLearningPlannerState(memory);
      const activePlanId = state.activePlanId || state.planOrder.at(-1) || '';
      if (!activePlanId) {
        return { ok: false, reason: 'learning_plan_not_found', memory };
      }
      return setLearningPlanStatusInMemory(memory, activePlanId, LEARNING_PLAN_STATUS.CANCELLED, {
        now: timestamp,
        reason: 'hud_cancel_request',
      });
    },

    markActivePlanForReview(memory = {}, { now: timestamp = now() } = {}) {
      const state = getLearningPlannerState(memory);
      const activePlanId = state.activePlanId || state.planOrder.at(-1) || '';
      if (!activePlanId) {
        return { ok: false, reason: 'learning_plan_not_found', memory };
      }
      return setLearningPlanStatusInMemory(memory, activePlanId, LEARNING_PLAN_STATUS.NEEDS_USER_REVIEW, {
        now: timestamp,
        reason: 'hud_mark_for_review',
      });
    },

    approveActivePlan(memory = {}, { now: timestamp = now() } = {}) {
      const state = getLearningPlannerState(memory);
      const activePlanId = state.activePlanId || state.planOrder.at(-1) || '';
      const activePlan = activePlanId ? state.plansById[activePlanId] : null;
      if (!activePlan) {
        return { ok: false, reason: 'learning_plan_not_found', memory };
      }

      const validation = validateLearningPlanForExecution(activePlan);
      if (
        validation.decision === LEARNING_PLAN_VALIDATION_DECISION.BLOCKED ||
        validation.decision === LEARNING_PLAN_VALIDATION_DECISION.NEEDS_USER_REVIEW
      ) {
        return {
          ok: false,
          reason: validation.reason || 'learning_plan_not_approvable',
          status: validation.decision,
          findings: validation.findings,
          memory,
        };
      }

      return setLearningPlanStatusInMemory(memory, activePlanId, LEARNING_PLAN_STATUS.VALIDATED, {
        now: timestamp,
        reason: validation.decision === LEARNING_PLAN_VALIDATION_DECISION.APPROVAL_REQUIRED
          ? 'hud_human_approval_granted'
          : 'hud_plan_approved',
      });
    },

    rejectActivePlan(memory = {}, { now: timestamp = now() } = {}) {
      const state = getLearningPlannerState(memory);
      const activePlanId = state.activePlanId || state.planOrder.at(-1) || '';
      if (!activePlanId) {
        return { ok: false, reason: 'learning_plan_not_found', memory };
      }
      return setLearningPlanStatusInMemory(memory, activePlanId, LEARNING_PLAN_STATUS.REJECTED, {
        now: timestamp,
        reason: 'hud_plan_rejected',
      });
    },
  };
};

export const summarizeLearningPlannerForHud = (learningPlannerState = {}) => {
  const plansById = learningPlannerState.plansById || {};
  const activePlanId = learningPlannerState.activePlanId || normalizeArray(learningPlannerState.planOrder).at(-1) || '';
  const activePlan = activePlanId ? plansById[activePlanId] : null;
  return {
    activePlan,
    activePlanId,
    status: activePlan?.status || 'idle',
    reason: activePlan?.validation?.reason || activePlan?.risk?.reason || '',
    issues: activePlan?.validation?.issues || [],
  };
};
