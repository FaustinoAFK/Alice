import { describe, expect, it } from 'vitest';
import {
  createEmptyAliceMemory,
  enqueueAutonomousRunnerMemoryTask,
  getAutonomousRunnerState,
  updateAutonomousLearningMemoryState,
  updateAutonomousRunnerState,
} from './aliceMemory';
import { scanAutonomousCapabilityGaps } from './autonomousCapabilityScanner';
import { createAutonomousLearningTaskForGap } from './autonomousLearningPlanner';
import {
  clearAutonomousLearningTestData,
  isRunnerSafeForAutonomousLearning,
  runAutonomousLearningLoop,
} from './autonomousLearningLoop';
import { validateLearningExperimentTask } from './autonomousLearningValidator';
import { promoteLearningValidation } from './autonomousProcedurePromoter';
import { validateSynthesizedScript } from './autonomousScriptSynthesizer';
import { actionViolatesAutonomousLearningPolicy } from './autonomousLearningPolicy';
import { resolveProcedureReuseForGap } from './autonomousProcedureReuseEngine';
import { createProcedureVariantVersion } from './autonomousProcedureVersioning';
import { acquireRunnerLease } from './autonomousRunnerLease';
import { RUNNER_TASK_STATUSES } from './autonomousRunnerState';

const browserGap = {
  gapId: 'gap-browser-search-address-bar',
  type: 'browser_search',
  capability: 'browser.search',
  description: 'Alice nao tem procedimento confiavel para pesquisar usando a barra do navegador.',
  priority: 'high',
  evidence: ['test'],
  riskLevel: 'low',
};

const completeEvidenceRef = {
  id: 'evidence-1',
  executionId: 'exec-1',
  taskId: 'task-1',
  stepId: 'step-1',
  kind: 'metadata',
  path: 'data/evidence/exec-1/metadata.json',
  metadata: {
    physicalStatus: 'ok',
    persistence: { ok: true, status: 'ok' },
  },
};

describe('autonomous learning loop governance', () => {
  it('does not start before memory is hydrated', async () => {
    const result = await runAutonomousLearningLoop({
      memory: createEmptyAliceMemory(),
      memoryHydrated: false,
      nowMs: Date.parse('2026-04-30T10:00:00.000Z'),
    });

    expect(result.started).toBe(false);
    expect(result.reason).toBe('memory_not_hydrated');
    expect(result.createdTasks).toEqual([]);
  });

  it('does not start while the Runner has an active lock or running task', async () => {
    const planned = createAutonomousLearningTaskForGap(browserGap, {
      now: '2026-04-30T10:00:00.000Z',
    });
    let memory = enqueueAutonomousRunnerMemoryTask(createEmptyAliceMemory(), planned.task, {
      now: '2026-04-30T10:00:00.000Z',
    });
    const runner = getAutonomousRunnerState(memory);
    const task = runner.tasksById[planned.task.id];
    const lease = acquireRunnerLease(runner, task.id, task.steps[0].id, {
      now: '2026-04-30T10:01:00.000Z',
    });
    memory = updateAutonomousRunnerState(memory, lease.runner, {
      now: '2026-04-30T10:01:00.000Z',
    });

    expect(isRunnerSafeForAutonomousLearning(getAutonomousRunnerState(memory)).ok).toBe(false);
    const result = await runAutonomousLearningLoop({
      memory,
      memoryHydrated: true,
      nowMs: Date.parse('2026-04-30T10:02:00.000Z'),
    });

    expect(result.started).toBe(false);
    expect(result.reason).toBe('runner_not_safe_for_learning');
  });

  it('scanner detects browser search gap when no trusted procedure exists', () => {
    const scan = scanAutonomousCapabilityGaps(createEmptyAliceMemory(), {
      now: '2026-04-30T10:00:00.000Z',
    });

    expect(scan.gaps.some((gap) => gap.gapId === 'gap-browser-search-address-bar')).toBe(true);
    expect(scan.gaps[0].suggestedExperiments).toContain('ctrl_l_address_bar');
  });

  it('scanner ignores successful Runner audit events when looking for failure gaps', () => {
    const memory = createEmptyAliceMemory();
    const scan = scanAutonomousCapabilityGaps({
      ...memory,
      autonomousRunner: {
        ...memory.autonomousRunner,
        tasksById: {
          learning: { id: 'learning', title: 'Learning task', riskLevel: 'low' },
        },
        audits: [
          {
            type: 'evidence_persistence',
            taskId: 'learning',
            reason: 'evidence_persisted',
            summary: 'Evidencia fisica do Runner confirmada.',
            metadata: { ok: true },
          },
          {
            type: 'validation',
            taskId: 'learning',
            reason: 'runner_completion_validated',
            summary: 'Validacao do step aprovada.',
            metadata: { passed: true },
          },
          {
            type: 'preflight',
            taskId: 'learning',
            reason: 'preflight_passed',
            summary: 'Preflight aprovado.',
          },
        ],
      },
    }, {
      now: '2026-04-30T10:00:00.000Z',
    });

    expect(scan.gaps.some((gap) => gap.type === 'runner_failure')).toBe(false);
  });

  it('planner creates an official Runner task with governed learning metadata', () => {
    const planned = createAutonomousLearningTaskForGap(browserGap, {
      now: '2026-04-30T10:00:00.000Z',
    });

    expect(planned.ok).toBe(true);
    expect(planned.task.metadata.createdBy).toBe('autonomous_learning_loop');
    expect(planned.task.metadata.learningScenario).toBe('browser_search');
    expect(planned.task.steps.length).toBeGreaterThanOrEqual(3);
    expect(planned.task.maxAttempts).toBeGreaterThanOrEqual(planned.task.steps.length);
    expect(planned.task.metadata.limits.maxAttempts).toBe(planned.task.maxAttempts);
    expect(planned.task.steps.every((step) => step.expectedEvidence?.kind === 'complete')).toBe(true);
  });

  it('validator refuses learning without physical evidence and without verify_runner_evidence', async () => {
    const task = {
      id: 'task-1',
      status: RUNNER_TASK_STATUSES.DONE,
      metadata: { gapId: browserGap.gapId, capability: browserGap.capability },
      evidenceRefs: [],
      steps: [
        {
          id: 'step-1',
          status: 'done',
          result: {
            validation: {
              passed: true,
              evidencePersistence: { ok: true },
            },
          },
          evidenceRefs: [],
        },
      ],
    };

    const noEvidence = await validateLearningExperimentTask({ runner: { tasksById: { [task.id]: task } }, task });
    expect(noEvidence.ok).toBe(false);
    expect(noEvidence.reason).toBe('physical_evidence_not_confirmed');

    const withEvidenceNoVerify = await validateLearningExperimentTask({
      runner: { tasksById: { [task.id]: { ...task, evidenceRefs: [completeEvidenceRef] } }, evidenceRefs: [completeEvidenceRef] },
      task: { ...task, evidenceRefs: [completeEvidenceRef], steps: [{ ...task.steps[0], evidenceRefs: [completeEvidenceRef] }] },
    });
    expect(withEvidenceNoVerify.ok).toBe(false);
    expect(withEvidenceNoVerify.reason).toBe('verify_runner_evidence_required');
  });

  it('promoter creates candidate and guarded procedure, never active directly', () => {
    const task = {
      id: 'task-1',
      description: browserGap.description,
      metadata: {
        gapId: browserGap.gapId,
        capability: browserGap.capability,
        strategies: ['ctrl_l_address_bar', 'visual_click_address_bar'],
      },
      steps: [{ id: 'step-1', title: 'Focar barra com Ctrl+L' }],
    };
    const promotion = promoteLearningValidation({
      memory: createEmptyAliceMemory(),
      gap: browserGap,
      task,
      validation: {
        ok: true,
        reason: 'learning_experiment_validated',
        capability: browserGap.capability,
        confidence: 0.64,
        evidenceRefs: [completeEvidenceRef],
      },
      now: '2026-04-30T10:00:00.000Z',
    });

    expect(promotion.ok).toBe(true);
    expect(promotion.candidate.status).toBe('candidate');
    expect(promotion.procedure.status).toBe('guarded');
    expect(promotion.procedure.status).not.toBe('active');
  });

  it('processes completed learning tasks that only had a task_created experiment record', async () => {
    const planned = createAutonomousLearningTaskForGap(browserGap, {
      now: '2026-04-30T10:00:00.000Z',
    });
    const doneTask = {
      ...planned.task,
      status: RUNNER_TASK_STATUSES.DONE,
      attempts: planned.task.steps.length,
      evidenceRefs: [completeEvidenceRef],
      steps: planned.task.steps.map((step) => ({
        ...step,
        status: 'done',
        result: {
          validation: {
            passed: true,
            evidencePersistence: { ok: true },
          },
        },
        evidenceRefs: [completeEvidenceRef],
      })),
    };
    let memory = enqueueAutonomousRunnerMemoryTask(createEmptyAliceMemory(), doneTask, {
      now: '2026-04-30T10:00:00.000Z',
    });
    memory = updateAutonomousLearningMemoryState(memory, {
      ...memory.autonomousLearning,
      enabled: true,
      knownGaps: [browserGap],
      recentExperiments: [{
        experimentId: `experiment-${doneTask.id}`,
        taskId: doneTask.id,
        gapId: browserGap.gapId,
        status: 'task_created',
      }],
    }, {
      now: '2026-04-30T10:00:00.000Z',
    });

    const result = await runAutonomousLearningLoop({
      memory,
      memoryHydrated: true,
      verifyRunnerEvidence: async () => ({
        ok: true,
        artifacts: { status: 'ok' },
      }),
      nowMs: Date.parse('2026-04-30T10:01:00.000Z'),
    });

    expect(result.promotions).toHaveLength(1);
    expect(result.memory.autonomousLearning.recentExperiments.some((experiment) =>
      experiment.taskId === doneTask.id && experiment.status === 'validated',
    )).toBe(true);
    expect(result.memory.autonomousLearning.procedureCandidates[0].status).toBe('candidate');
  });

  it('script synthesizer and policy block destructive actions', () => {
    expect(validateSynthesizedScript({
      scriptType: 'node',
      content: "require('fs').rmSync('C:/Users', { recursive: true, force: true })",
    })).toMatchObject({ ok: false });
    expect(actionViolatesAutonomousLearningPolicy({
      actionText: 'apagar arquivos reais e comprar produto',
      riskLevel: 'critical',
      environment: 'local_workspace_fallback',
    })).toMatchObject({ ok: false });
  });

  it('reuse engine finds a compatible active procedure before a new experiment', () => {
    const memory = {
      ...createEmptyAliceMemory(),
      proceduralMemory: {
        procedures: [
          {
            procedureId: 'procedure_browser_search_address_bar',
            title: 'Pesquisar no navegador pela barra de endereco',
            summary: 'Usa Ctrl+L, digita a consulta, Enter e valida carregamento.',
            steps: ['Ctrl+L', 'Digitar consulta', 'Enter', 'Validar pagina'],
            status: 'active',
            confidence: 0.88,
            capabilities: ['browser.search'],
            evidenceRefs: [completeEvidenceRef],
          },
        ],
      },
    };

    const reuse = resolveProcedureReuseForGap({
      gap: browserGap,
      memory,
      policy: memory.autonomousLearning.policy,
      now: '2026-04-30T10:00:00.000Z',
    });

    expect(reuse.ok).toBe(true);
    expect(reuse.match.procedureId).toBe('procedure_browser_search_address_bar');
    expect(reuse.task.metadata.createdBy).toBe('autonomous_procedure_reuse');
  });

  it('clear-test-learning removes only autonomous learning tasks', () => {
    const planned = createAutonomousLearningTaskForGap(browserGap, {
      now: '2026-04-30T10:00:00.000Z',
    });
    let memory = enqueueAutonomousRunnerMemoryTask(createEmptyAliceMemory(), planned.task, {
      now: '2026-04-30T10:00:00.000Z',
    });
    memory = enqueueAutonomousRunnerMemoryTask(memory, {
      id: 'real-task',
      title: 'Task real',
      status: 'ready',
      steps: [],
      metadata: { createdBy: 'user' },
    }, {
      now: '2026-04-30T10:01:00.000Z',
    });

    const cleared = clearAutonomousLearningTestData(memory, {
      now: '2026-04-30T10:02:00.000Z',
    });
    const runner = getAutonomousRunnerState(cleared.memory);

    expect(runner.tasksById[planned.task.id]).toBeUndefined();
    expect(runner.tasksById['real-task']).toBeTruthy();
  });

  it('procedure versioning keeps old version as fallback', () => {
    const next = createProcedureVariantVersion({
      procedure: {
        procedureId: 'procedure_browser_search_address_bar',
        version: 'v1',
        status: 'active',
        steps: ['clicar barra', 'digitar', 'enter'],
        confidence: 0.8,
      },
      variant: {
        version: 'v2_candidate',
        steps: ['Ctrl+L', 'digitar', 'enter'],
      },
      status: 'guarded',
      now: '2026-04-30T10:00:00.000Z',
    });

    expect(next.version).toBe('v2_candidate');
    expect(next.fallbackVersion).toBe('v1');
    expect(next.versionHistory[0].version).toBe('v1');
  });

  it('run-once creates at most the configured number of Runner tasks and avoids loop inflation', async () => {
    const result = await runAutonomousLearningLoop({
      memory: createEmptyAliceMemory(),
      memoryHydrated: true,
      nowMs: Date.parse('2026-04-30T10:00:00.000Z'),
    });

    expect(result.started).toBe(true);
    expect(result.createdTasks.length).toBeLessThanOrEqual(2);
    expect(result.createdTasks[0].metadata.createdBy).toBe('autonomous_learning_loop');
  });
});
