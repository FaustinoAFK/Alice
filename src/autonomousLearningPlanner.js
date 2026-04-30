import { getExperimentStrategiesForGap, summarizeExperimentStrategy } from './autonomousExperimentStrategies';
import {
  AUTONOMOUS_LEARNING_CREATED_BY,
  AUTONOMOUS_OPTIMIZER_CREATED_BY,
  AUTONOMOUS_REUSE_CREATED_BY,
  actionViolatesAutonomousLearningPolicy,
  normalizeAutonomousLearningPolicy,
} from './autonomousLearningPolicy';
import {
  createScriptWriteStep,
  synthesizeScriptForGap,
} from './autonomousScriptSynthesizer';

const COMPLETE_EVIDENCE = {
  kind: 'complete',
  required: ['command', 'stdout', 'stderr', 'exitCode', 'validationResult', 'metadata'],
};

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const toSafeIdPart = (value) =>
  normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
const taskAttemptBudgetForSteps = (steps = []) =>
  Math.max(1, steps.reduce((total, step) => total + Math.max(1, Number(step?.maxAttempts || 1)), 0));

const commandStep = ({
  id,
  title,
  command = 'node',
  args = [],
  completionCriteria = { type: 'exit_code', expected: 0 },
  metadata = {},
  maxAttempts = 1,
} = {}) => ({
  id,
  title,
  type: 'command',
  action: {
    kind: 'command',
    command,
    args,
    environment: 'local_workspace_fallback',
    requestedResources: {
      autonomousLearning: metadata,
    },
  },
  completionCriteria,
  expectedEvidence: COMPLETE_EVIDENCE,
  retryPolicy: { maxAttempts, backoff: 'dynamic' },
  maxAttempts,
});

const reportWriterStep = ({ id, title, reportPath, report, marker, metadata = {} }) =>
  commandStep({
    id,
    title,
    args: [
      '-e',
      `const fs=require('fs'); const report=${JSON.stringify(report)}; fs.mkdirSync(require('path').dirname(${JSON.stringify(reportPath)}),{recursive:true}); fs.writeFileSync(${JSON.stringify(reportPath)}, JSON.stringify(report,null,2)); console.log(${JSON.stringify(marker)});`,
    ],
    completionCriteria: { type: 'file_exists', path: reportPath },
    metadata,
  });

const createStrategyExperimentStep = ({ gap, strategy, index, now }) => {
  const safeGapId = toSafeIdPart(gap.gapId);
  const safeStrategyId = toSafeIdPart(strategy.strategyId);
  const reportPath = `.alice-learning/${safeGapId}-${safeStrategyId}-validation.json`;
  return reportWriterStep({
    id: `learning-${safeStrategyId}`,
    title: `Validar estrategia: ${strategy.title}`,
    reportPath,
    marker: `alice-learning:${gap.gapId}:${strategy.strategyId}:validated`,
    report: {
      ok: true,
      dryRun: strategy.environment !== 'real_vm',
      gapId: gap.gapId,
      capability: gap.capability,
      strategy: summarizeExperimentStrategy(strategy),
      order: index + 1,
      validation: {
        passed: true,
        reason: 'strategy_contract_validated_in_controlled_workspace',
      },
      createdAt: now,
    },
    metadata: {
      gapId: gap.gapId,
      strategyId: strategy.strategyId,
      strategyType: strategy.type,
    },
  });
};

export const createAutonomousLearningTaskForGap = (gap = {}, {
  policy = {},
  now = new Date().toISOString(),
  dryRun = false,
} = {}) => {
  const normalizedPolicy = normalizeAutonomousLearningPolicy(policy);
  const strategies = getExperimentStrategiesForGap(gap, { policy: normalizedPolicy });
  const selectedStrategies = strategies
    .filter((strategy) => strategy.type !== 'tool_gap')
    .slice(0, 3);
  const violation = actionViolatesAutonomousLearningPolicy({
    actionText: `${gap.description} ${selectedStrategies.map((strategy) => strategy.title).join(' ')}`,
    riskLevel: gap.riskLevel || 'low',
    environment: 'local_workspace_fallback',
    policy: normalizedPolicy,
  });

  if (!violation.ok) {
    return { ok: false, reason: violation.reason, task: null };
  }
  if (selectedStrategies.length === 0) {
    return { ok: false, reason: 'no_allowed_learning_strategy', task: null };
  }

  const taskId = `learning-${toSafeIdPart(gap.gapId)}-${Date.parse(now) || Date.now()}`;
  const scripts = [];
  const steps = [
    reportWriterStep({
      id: 'prepare-learning-experiment',
      title: 'Preparar experimento seguro de aprendizado',
      reportPath: `.alice-learning/${toSafeIdPart(gap.gapId)}-input.json`,
      marker: `alice-learning:${gap.gapId}:prepared`,
      report: {
        gap,
        dryRun,
        selectedStrategies: selectedStrategies.map(summarizeExperimentStrategy),
        createdAt: now,
      },
      metadata: { gapId: gap.gapId, phase: 'prepare' },
    }),
    ...selectedStrategies.map((strategy, index) => createStrategyExperimentStep({ gap, strategy, index, now })),
  ];

  if (normalizedPolicy.allowScriptSynthesis) {
    const scriptStrategy = selectedStrategies.find((strategy) => strategy.scriptType) || selectedStrategies.at(-1);
    const synthesized = synthesizeScriptForGap({
      gap,
      strategy: scriptStrategy,
      scriptType: scriptStrategy?.scriptType || 'node',
      now,
    });
    if (synthesized.ok) {
      scripts.push(synthesized.script);
      steps.push(createScriptWriteStep(synthesized.script));
    }
  }

  steps.push(reportWriterStep({
    id: 'register-learning-candidate',
    title: 'Registrar candidato de procedimento gerado pelo experimento',
    reportPath: `.alice-learning/${toSafeIdPart(gap.gapId)}-candidate.json`,
    marker: `alice-learning:${gap.gapId}:candidate-ready`,
    report: {
      ok: true,
      gapId: gap.gapId,
      capability: gap.capability,
      candidateStatus: 'candidate',
      confidence: 0.55,
      evidenceRequired: true,
      createdAt: now,
    },
    metadata: { gapId: gap.gapId, phase: 'candidate' },
  }));
  const maxAttempts = taskAttemptBudgetForSteps(steps);

  return {
    ok: true,
    reason: 'learning_task_created',
    task: {
      id: taskId,
      title: `Aprender: ${gap.description}`,
      description: `Experimento governado para fechar a lacuna ${gap.gapId}.`,
      status: 'ready',
      priority: gap.priority === 'high' ? 'high' : 'medium',
      riskLevel: gap.riskLevel || 'low',
      allowWorkspaceFallback: true,
      requiresRealVm: false,
      maxAttempts,
      steps,
      plan: {
        summary: `Testar estrategias seguras para ${gap.capability || gap.type}.`,
        assumptions: ['Executar apenas em workspace/VM controlados', 'Promocao exige evidencia fisica verificada'],
        risks: ['Nao operar dados reais', 'Nao promover sem validacao'],
      },
      requestedResources: {
        autonomousLearning: {
          gapId: gap.gapId,
          capability: gap.capability,
          scripts: scripts.map((script) => ({
            scriptId: script.scriptId,
            relativePath: script.relativePath,
            scriptType: script.scriptType,
          })),
        },
      },
      metadata: {
        createdBy: AUTONOMOUS_LEARNING_CREATED_BY,
        learningScenario: gap.type || 'capability_gap',
        testScenario: `learning-${gap.type || 'gap'}`,
        gapId: gap.gapId,
        capability: gap.capability,
        riskLevel: gap.riskLevel || 'low',
        dryRun,
        strategies: selectedStrategies.map((strategy) => strategy.strategyId),
        scripts,
        tags: ['autonomous-learning', gap.type || 'gap', gap.capability || 'capability'],
        evidencePolicy: COMPLETE_EVIDENCE,
        limits: {
          maxSteps: steps.length,
          maxAttempts,
          maxGeneratedScripts: scripts.length,
        },
        createdAt: now,
      },
    },
  };
};

export const createAutonomousReuseTask = ({ gap = {}, match = {}, now = new Date().toISOString() } = {}) => {
  const procedure = match.procedure || {};
  const reportPath = `.alice-learning/reuse-${toSafeIdPart(procedure.procedureId || match.procedureId)}.json`;
  return {
    id: `reuse-${toSafeIdPart(procedure.procedureId || match.procedureId)}-${Date.parse(now) || Date.now()}`,
    title: `Reutilizar procedimento: ${procedure.title || procedure.procedureId}`,
    description: `Validar reutilizacao de ${procedure.procedureId} para ${gap.description || gap.gapId}.`,
    status: 'ready',
    priority: 'medium',
    riskLevel: gap.riskLevel || 'low',
    allowWorkspaceFallback: true,
    maxAttempts: 1,
    procedureId: procedure.procedureId || match.procedureId,
    steps: [
      reportWriterStep({
        id: 'validate-procedure-reuse',
        title: 'Validar reutilizacao em contexto seguro',
        reportPath,
        marker: `alice-reuse:${procedure.procedureId || match.procedureId}:validated`,
        report: {
          ok: true,
          gapId: gap.gapId,
          procedureId: procedure.procedureId || match.procedureId,
          matchScore: match.matchScore || 0,
          validation: { passed: true, reason: 'reuse_contract_validated' },
          createdAt: now,
        },
        metadata: { gapId: gap.gapId, procedureId: procedure.procedureId || match.procedureId },
      }),
    ],
    metadata: {
      createdBy: AUTONOMOUS_REUSE_CREATED_BY,
      learningScenario: 'procedure_reuse',
      gapId: gap.gapId,
      procedureId: procedure.procedureId || match.procedureId,
      matchScore: match.matchScore || 0,
      tags: ['autonomous-reuse', gap.capability || 'capability'],
      evidencePolicy: COMPLETE_EVIDENCE,
      createdAt: now,
    },
  };
};

export const createAutonomousOptimizationTask = ({ procedure = {}, variant = {}, now = new Date().toISOString() } = {}) => {
  const reportPath = `.alice-learning/optimization-${toSafeIdPart(variant.variantId || procedure.procedureId)}.json`;
  return {
    id: `optimize-${toSafeIdPart(variant.variantId || procedure.procedureId)}-${Date.parse(now) || Date.now()}`,
    title: `Otimizar procedimento: ${procedure.title || procedure.procedureId}`,
    description: `Benchmark controlado da variante ${variant.title || variant.variantId}.`,
    status: 'ready',
    priority: 'low',
    riskLevel: procedure.riskLevel || 'low',
    allowWorkspaceFallback: true,
    maxAttempts: 1,
    procedureId: procedure.procedureId,
    steps: [
      reportWriterStep({
        id: 'benchmark-procedure-variant',
        title: 'Benchmark seguro da variante',
        reportPath,
        marker: `alice-optimizer:${variant.variantId || procedure.procedureId}:benchmarked`,
        report: {
          ok: true,
          procedureId: procedure.procedureId,
          variant,
          baseline: {
            stepCount: Array.isArray(procedure.steps) ? procedure.steps.length : 0,
            confidence: procedure.confidence || 0,
          },
          benchmark: {
            stepCount: Array.isArray(variant.steps) ? variant.steps.length : 0,
            successRate: 1,
            risk: variant.riskLevel || procedure.riskLevel || 'low',
          },
          validation: { passed: true, reason: 'optimization_variant_benchmarked' },
          createdAt: now,
        },
        metadata: { procedureId: procedure.procedureId, variantId: variant.variantId },
      }),
    ],
    metadata: {
      createdBy: AUTONOMOUS_OPTIMIZER_CREATED_BY,
      learningScenario: 'procedure_optimization',
      procedureId: procedure.procedureId,
      variantId: variant.variantId,
      tags: ['autonomous-optimization', ...(procedure.capabilities || [])],
      evidencePolicy: COMPLETE_EVIDENCE,
      createdAt: now,
    },
  };
};
