import { describe, expect, it } from 'vitest';
import {
  createEmptyAliceMemory,
  enqueueAutonomousRunnerMemoryTask,
  getAutonomousLearningMemoryState,
  getAutonomousRunnerState,
  updateAutonomousLearningMemoryState,
  updateAutonomousRunnerState,
} from './aliceMemory';
import { scanAutonomousCapabilityGaps } from './autonomousCapabilityScanner';
import {
  createAutonomousLearningGoalFromText,
  upsertAutonomousLearningGoal,
} from './autonomousLearningGoals';
import {
  createAutonomousLearningTaskForGap,
  createAutonomousOptimizationTask,
  createAutonomousReuseTask,
  createControlledLearningText,
} from './autonomousLearningPlanner';
import {
  clearAutonomousLearnedData,
  clearAutonomousLearningTestData,
  isRunnerSafeForAutonomousLearning,
  runAutonomousLearningLoop,
  shouldRunAutonomousLearningAfterRunnerTick,
} from './autonomousLearningLoop';
import { validateLearningExperimentTask } from './autonomousLearningValidator';
import { promoteLearningValidation } from './autonomousProcedurePromoter';
import { validateSynthesizedScript } from './autonomousScriptSynthesizer';
import {
  actionViolatesAutonomousLearningPolicy,
  countRecentLearningExperiments,
} from './autonomousLearningPolicy';
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

const appLaunchGap = {
  gapId: 'gap-app-launch-safe',
  type: 'app_launch',
  capability: 'app.launch',
  description: 'Alice nao tem procedimento confiavel para abrir um aplicativo seguro em ambiente controlado e validar que iniciou.',
  priority: 'medium',
  evidence: ['test'],
  riskLevel: 'low',
};

const fileManagementGap = {
  gapId: 'gap-file-management-safe',
  type: 'file_management',
  capability: 'file.folder.create',
  description: 'Alice nao tem procedimento confiavel para abrir o Explorer, criar pasta e organizar arquivos em ambiente controlado.',
  priority: 'high',
  evidence: ['test'],
  riskLevel: 'low',
};

const appInstallGap = {
  gapId: 'gap-app-install-safe',
  type: 'app_install',
  capability: 'app.install.safe_probe',
  description: 'Alice nao tem procedimento confiavel para localizar pacote instalavel com seguranca na VM.',
  priority: 'medium',
  evidence: ['test'],
  riskLevel: 'low',
};

const fieldInteractionGap = {
  gapId: 'gap-text-field-interaction',
  type: 'field_interaction',
  capability: 'field.interaction',
  description: 'Alice nao tem procedimento confiavel para focar, preencher e validar campo.',
  priority: 'medium',
  evidence: ['test'],
  riskLevel: 'low',
};

const pageValidationGap = {
  gapId: 'gap-page-load-validation',
  type: 'page_validation',
  capability: 'page.validate',
  description: 'Alice nao tem procedimento confiavel para validar pagina carregada.',
  priority: 'medium',
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
    expect(scan.gaps.some((gap) => gap.gapId === 'gap-text-input-focused-field')).toBe(true);
    expect(scan.gaps.some((gap) => gap.gapId === 'gap-page-load-validation')).toBe(true);
    expect(scan.gaps[0].suggestedExperiments).toContain('ctrl_l_address_bar');
  });

  it('scanner suppresses foundational gaps when guarded procedures already cover them', () => {
    const memory = {
      ...createEmptyAliceMemory(),
      autonomousLearning: {
        ...createEmptyAliceMemory().autonomousLearning,
        promotedProcedures: [
          {
            procedureId: 'procedure_browser_search',
            title: 'Pesquisar no navegador',
            summary: 'Usa browser.search com Ctrl+L.',
            status: 'guarded',
            confidence: 0.66,
            environment: 'real_vm',
            environments: ['real_vm'],
            capabilities: ['browser.search'],
          },
          {
            procedureId: 'procedure_text_input',
            title: 'Digitar em campo focado',
            summary: 'Cobre text.input e field_value_changed.',
            status: 'guarded',
            confidence: 0.7,
            environment: 'real_vm',
            environments: ['real_vm'],
            capabilities: ['text.input'],
          },
        ],
      },
    };
    const scan = scanAutonomousCapabilityGaps(memory, {
      now: '2026-04-30T10:00:00.000Z',
    });

    expect(scan.gaps.some((gap) => gap.gapId === 'gap-browser-search-address-bar')).toBe(false);
    expect(scan.gaps.some((gap) => gap.gapId === 'gap-text-input-focused-field')).toBe(false);
    expect(scan.gaps.some((gap) => gap.gapId === 'gap-page-load-validation')).toBe(true);
  });

  it('creates a staged learning goal from a broad user request and exposes stages as scanner gaps', () => {
    const goalResult = createAutonomousLearningGoalFromText(
      'Aprender a pesquisar documentacao em um site, validar a pagina e resumir o conteudo',
      { now: '2026-04-30T10:00:00.000Z' },
    );
    expect(goalResult.ok).toBe(true);
    expect(goalResult.goal.broad).toBe(true);
    expect(goalResult.goal.stages.map((stage) => stage.type)).toEqual(
      expect.arrayContaining(['browser_search', 'page_validation', 'page_read']),
    );

    const memory = updateAutonomousLearningMemoryState(createEmptyAliceMemory(), (learning) =>
      upsertAutonomousLearningGoal(learning, goalResult.goal), {
      now: '2026-04-30T10:00:00.000Z',
    });
    const scan = scanAutonomousCapabilityGaps(memory, {
      now: '2026-04-30T10:01:00.000Z',
    });

    const goalGaps = scan.gaps.filter((gap) => gap.learningGoalId === goalResult.goal.goalId);
    expect(goalGaps.map((gap) => gap.type)).toEqual(
      expect.arrayContaining(['browser_search', 'page_validation', 'page_read']),
    );
    expect(goalGaps[0].description).toContain('Objetivo do usuario');
  });

  it('expands broad computer learning goals into a fuller staged curriculum', () => {
    const goalResult = createAutonomousLearningGoalFromText(
      'aprenda do basico ao avancado em coisas do computador',
      { now: '2026-04-30T10:00:00.000Z' },
    );

    expect(goalResult.goal.stages.map((stage) => stage.stageKey)).toEqual([
      'app_launch',
      'window_focus',
      'file_explorer',
      'file_management',
      'app_install',
      'text_input',
      'keyboard_shortcuts',
      'clipboard_text',
      'field_interaction',
      'form_fill',
      'browser_search',
      'browser_navigation',
      'page_validation',
      'search_result_validation',
      'page_read',
      'page_summary',
    ]);
    expect(goalResult.goal.stages.length).toBeGreaterThan(6);

    const legacyGoal = {
      ...goalResult.goal,
      stages: goalResult.goal.stages.filter((stage) =>
        ['browser_search', 'page_validation', 'page_read'].includes(stage.type)),
    };
    const memory = updateAutonomousLearningMemoryState(createEmptyAliceMemory(), (learning) =>
      upsertAutonomousLearningGoal(learning, legacyGoal), {
      now: '2026-04-30T10:01:00.000Z',
    });

    expect(getAutonomousLearningMemoryState(memory).learningGoals[0].stages.map((stage) => stage.stageKey)).toEqual([
      'app_launch',
      'window_focus',
      'file_explorer',
      'file_management',
      'app_install',
      'text_input',
      'keyboard_shortcuts',
      'clipboard_text',
      'field_interaction',
      'form_fill',
      'browser_search',
      'browser_navigation',
      'page_validation',
      'search_result_validation',
      'page_read',
      'page_summary',
    ]);
  });

  it('splits file organization and install requests into Explorer and installer learning stages', () => {
    const goalResult = createAutonomousLearningGoalFromText(
      'saber criar pastas, organizar arquivos, instalar programas',
      { now: '2026-04-30T10:00:00.000Z' },
    );

    expect(goalResult.ok).toBe(true);
    expect(goalResult.goal.stages.map((stage) => stage.stageKey)).toEqual(expect.arrayContaining([
      'file_explorer',
      'file_management',
      'app_install',
    ]));
  });

  it('does not create duplicate scanner gaps for learning goal stages already represented by Runner tasks', () => {
    const goalResult = createAutonomousLearningGoalFromText('Aprender a pesquisar no navegador', {
      now: '2026-04-30T10:00:00.000Z',
    });
    let memory = updateAutonomousLearningMemoryState(createEmptyAliceMemory(), (learning) =>
      upsertAutonomousLearningGoal(learning, goalResult.goal), {
      now: '2026-04-30T10:00:00.000Z',
    });
    const stageGap = goalResult.goal.stages[0];
    const planned = createAutonomousLearningTaskForGap({
      gapId: stageGap.gapId,
      type: stageGap.type,
      capability: stageGap.capability,
      description: stageGap.description,
      priority: stageGap.priority,
      riskLevel: stageGap.riskLevel,
    }, {
      now: '2026-04-30T10:02:00.000Z',
    });
    memory = enqueueAutonomousRunnerMemoryTask(memory, planned.task, {
      now: '2026-04-30T10:02:00.000Z',
    });

    const scan = scanAutonomousCapabilityGaps(memory, {
      now: '2026-04-30T10:03:00.000Z',
    });

    expect(scan.gaps.some((gap) => gap.gapId === stageGap.gapId)).toBe(false);
  });

  it('does not keep creating runner failure gaps for tasks that already recovered to done', () => {
    const memory = createEmptyAliceMemory();
    const taskId = 'learning-gap-browser-search-address-bar-1';
    const scan = scanAutonomousCapabilityGaps({
      ...memory,
      autonomousRunner: {
        ...memory.autonomousRunner,
        tasksById: {
          [taskId]: {
            id: taskId,
            title: 'Aprender browser search',
            status: 'done',
            riskLevel: 'low',
          },
        },
        audits: [
          {
            taskId,
            type: 'validation',
            reason: 'validation_failed',
            afterState: 'failed',
            summary: 'Falha antiga antes de recuperar.',
          },
        ],
      },
    }, {
      now: '2026-04-30T10:03:00.000Z',
    });

    expect(scan.gaps.some((gap) => gap.type === 'runner_failure')).toBe(false);
  });

  it('does not create another reuse task for the same gap and procedure once reuse was already attempted', () => {
    const gap = {
      gapId: 'gap-runner-failure-task-1',
      type: 'runner_failure',
      capability: 'runner.recovery',
      description: 'Falha recente do Runner precisa de aprendizado.',
      riskLevel: 'low',
    };
    const memory = {
      ...createEmptyAliceMemory(),
      autonomousLearning: {
        ...createEmptyAliceMemory().autonomousLearning,
        promotedProcedures: [
          {
            procedureId: 'procedure_runner_recovery',
            title: 'Procedimento para runner.recovery',
            summary: 'Recuperar runner.recovery em contexto seguro.',
            status: 'guarded',
            confidence: 0.9,
            capabilities: ['runner.recovery'],
            reuseValidation: { substantive: true },
            evidenceRefs: [{ id: 'evidence-1' }],
          },
        ],
      },
      autonomousRunner: {
        ...createEmptyAliceMemory().autonomousRunner,
        tasksById: {
          'reuse-procedure-runner-recovery-1': {
            id: 'reuse-procedure-runner-recovery-1',
            status: 'done',
            procedureId: 'procedure_runner_recovery',
            metadata: {
              createdBy: 'autonomous_procedure_reuse',
              gapId: gap.gapId,
              procedureId: 'procedure_runner_recovery',
            },
          },
        },
      },
    };

    const reuse = resolveProcedureReuseForGap({
      gap,
      memory,
      policy: memory.autonomousLearning.policy,
      now: '2026-04-30T10:04:00.000Z',
    });

    expect(reuse.ok).toBe(false);
    expect(reuse.reason).toBe('reuse_already_attempted_for_gap');
  });

  it('scanner does not trust workspace-only procedures when policy is VM-only', () => {
    const memory = {
      ...createEmptyAliceMemory(),
      autonomousLearning: {
        ...createEmptyAliceMemory().autonomousLearning,
        promotedProcedures: [
          {
            procedureId: 'procedure_browser_search',
            title: 'Pesquisar no navegador',
            summary: 'Contrato antigo validado em workspace local.',
            status: 'guarded',
            confidence: 0.9,
            environment: 'local_workspace_fallback',
            environments: ['local_workspace_fallback'],
            capabilities: ['browser.search'],
          },
        ],
      },
    };
    const scan = scanAutonomousCapabilityGaps(memory, {
      policy: memory.autonomousLearning.policy,
      now: '2026-04-30T10:00:00.000Z',
    });

    expect(scan.gaps.some((gap) => gap.gapId === 'gap-browser-search-address-bar')).toBe(true);
  });

  it('rate limit counts only unique unprocessed task_created experiment records', () => {
    const nowMs = Date.parse('2026-04-30T10:30:00.000Z');
    const recentExperiments = [
      {
        taskId: 'learning-1',
        status: 'task_created',
        createdAt: '2026-04-30T10:00:00.000Z',
      },
      {
        taskId: 'learning-1',
        status: 'validated',
        updatedAt: '2026-04-30T10:05:00.000Z',
      },
      {
        taskId: 'learning-2',
        status: 'task_created',
        createdAt: '2026-04-30T10:10:00.000Z',
      },
      {
        taskId: 'learning-2',
        status: 'task_created',
        createdAt: '2026-04-30T10:11:00.000Z',
      },
      {
        taskId: 'learning-old',
        status: 'task_created',
        createdAt: '2026-04-30T08:00:00.000Z',
      },
    ];

    expect(countRecentLearningExperiments(recentExperiments, { nowMs })).toBe(1);
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
    expect(planned.task.metadata.requiresSubstantiveValidation).toBe(true);
    expect(planned.task.metadata.substantiveValidation).toBe(true);
    expect(planned.task.metadata.requiredValidationSignals).toContain('controlled_outcome_marker');
    expect(planned.task.steps.length).toBeGreaterThanOrEqual(3);
    expect(planned.task.maxAttempts).toBeGreaterThanOrEqual(planned.task.steps.length);
    expect(planned.task.metadata.limits.maxAttempts).toBe(planned.task.maxAttempts);
    expect(planned.task.steps.every((step) => step.expectedEvidence?.kind === 'complete')).toBe(true);
    expect(planned.task.requiresRealVm).toBe(true);
    expect(planned.task.allowWorkspaceFallback).toBe(false);
    expect(planned.task.steps.every((step) => step.action?.environment === 'real_vm')).toBe(true);
    expect(planned.task.steps.every((step) => step.action?.kind === 'visual')).toBe(true);
    const browserStep = planned.task.steps.find((step) =>
      step.action?.kind === 'visual' &&
      step.action?.visualAction === 'run_command' &&
      step.action?.parameters?.args?.join(' ').includes("Start-Process -FilePath 'msedge.exe'"),
    );
    expect(browserStep).toBeTruthy();
    expect(browserStep.action.parameters.command).toBe('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
    expect(browserStep.action.parameters.args.join(' ')).toContain('MainWindowHandle');
    expect(browserStep.completionCriteria.type).toBe('file_contains');
    const registerStep = planned.task.steps.find((step) => step.id === 'register-learning-candidate');
    expect(registerStep.action.kind).toBe('visual');
    expect(registerStep.action.visualAction).toBe('run_command');
    const validationStep = planned.task.steps.find((step) => step.id === 'validate-learning-outcome');
    expect(validationStep).toBeTruthy();
    expect(validationStep.action.requestedResources.autonomousLearning.phase).toBe('substantive_validation');
    expect(validationStep.action.parameters.args.join(' ')).toContain('alice-learning-vm:browser-search-validated');
    expect(validationStep.action.parameters.args.join(' ')).toContain('browser_search_text_not_observed');
  });

  it('planner uses controlled but different text for repeated writing experiments', () => {
    const first = createAutonomousLearningTaskForGap(browserGap, {
      now: '2026-04-30T10:00:00.000Z',
    });
    const second = createAutonomousLearningTaskForGap(browserGap, {
      now: '2026-04-30T10:00:01.000Z',
    });
    const firstTypedText = first.task.steps
      .find((step) => step.action?.visualAction === 'type_text')
      ?.action?.parameters?.text;
    const secondTypedText = second.task.steps
      .find((step) => step.action?.visualAction === 'type_text')
      ?.action?.parameters?.text;

    expect(firstTypedText).toMatch(/^alice query [a-z0-9]+$/);
    expect(secondTypedText).toMatch(/^alice query [a-z0-9]+$/);
    expect(firstTypedText).not.toBe(secondTypedText);
  });

  it('controlled learning text is deterministic for the same task context', () => {
    const input = {
      gap: browserGap,
      strategy: { strategyId: 'ctrl_l_address_bar' },
      actionIndex: 1,
      now: '2026-04-30T10:00:00.000Z',
      purpose: 'query',
    };

    expect(createControlledLearningText(input)).toBe(createControlledLearningText(input));
    expect(createControlledLearningText(input)).not.toBe(createControlledLearningText({
      ...input,
      now: '2026-04-30T10:00:01.000Z',
    }));
  });

  it('planner validates app launch through the resident visual agent and process window checks', () => {
    const planned = createAutonomousLearningTaskForGap(appLaunchGap, {
      now: '2026-04-30T10:00:00.000Z',
    });
    const appStep = planned.task.steps.find((step) => step.id.includes('vm-start-safe-app'));

    expect(planned.ok).toBe(true);
    expect(appStep).toBeTruthy();
    expect(appStep.action.kind).toBe('visual');
    expect(appStep.action.visualAction).toBe('run_command');
    expect(appStep.action.environment).toBe('real_vm');
    expect(appStep.action.parameters.command).toBe('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
    expect(appStep.action.parameters.args.join(' ')).toContain('Start-Process -FilePath $appPath');
    expect(appStep.action.parameters.args.join(' ')).toContain('Get-Process -Name $targetProcessName');
    expect(appStep.action.parameters.args.join(' ')).toContain('MainWindowHandle');
    expect(appStep.completionCriteria).toEqual({
      type: 'file_contains',
      contains: 'alice-learning-vm:app-opened',
    });
  });

  it('planner creates real VM file Explorer and safe installer discovery tasks', () => {
    const fileTask = createAutonomousLearningTaskForGap(fileManagementGap, {
      now: '2026-04-30T10:00:00.000Z',
    });
    const installTask = createAutonomousLearningTaskForGap(appInstallGap, {
      now: '2026-04-30T10:00:00.000Z',
    });
    const fileScript = JSON.stringify(fileTask.task.steps.map((step) => step.action?.parameters || {}));
    const installScript = JSON.stringify(installTask.task.steps.map((step) => step.action?.parameters || {}));

    expect(fileTask.ok).toBe(true);
    expect(fileScript).toContain('explorer.exe');
    expect(fileScript).toContain('AliceLearningFiles');
    expect(fileScript).toContain('alice-learning-vm:file-managed');
    expect(installTask.ok).toBe(true);
    expect(installScript).toContain('winget');
    expect(installScript).toContain('search');
    expect(installScript).toContain('install_attempt=search_only_no_install');
    expect(installScript).toContain('alice-learning-vm:installer-checked');
  });

  it('planner emits parseable PowerShell for substantive VM outcome validation', () => {
    const fileTask = createAutonomousLearningTaskForGap({
      ...fileManagementGap,
      capability: 'file.explorer.open',
    }, {
      now: '2026-04-30T10:00:00.000Z',
    });
    const validationStep = fileTask.task.steps.find((step) => step.id === 'validate-learning-outcome');
    const command = validationStep.action.parameters.args.join(' ');

    expect(fileTask.ok).toBe(true);
    expect(command).toContain("$capability = 'file.explorer.open'");
    expect(command).toContain('$validated = $false');
    expect(command).toContain("if ($capability -eq 'file.explorer.open')");
    expect(command).toContain('unsupported_substantive_validation');
    expect(command).toContain('alice-learning-vm:learning-outcome-validated');
    expect(command).not.toContain('switch ($capability) {;');
  });

  it('planner covers goal-stage capabilities with substantive validation instead of unsupported fallbacks', () => {
    const windowTask = createAutonomousLearningTaskForGap({
      ...appLaunchGap,
      capability: 'app.window.focus',
    }, {
      now: '2026-04-30T10:00:00.000Z',
    });
    const formTask = createAutonomousLearningTaskForGap({
      ...fieldInteractionGap,
      capability: 'form.fill',
    }, {
      now: '2026-04-30T10:00:00.000Z',
    });
    const summaryTask = createAutonomousLearningTaskForGap({
      ...pageValidationGap,
      type: 'page_read',
      capability: 'page.summary',
    }, {
      now: '2026-04-30T10:00:00.000Z',
    });
    const searchTask = createAutonomousLearningTaskForGap({
      ...browserGap,
      type: 'page_validation',
      capability: 'search.results.validate',
    }, {
      now: '2026-04-30T10:00:00.000Z',
    });

    const windowValidation = windowTask.task.steps.find((step) => step.id === 'validate-learning-outcome');
    const formValidation = formTask.task.steps.find((step) => step.id === 'validate-learning-outcome');
    const summaryValidation = summaryTask.task.steps.find((step) => step.id === 'validate-learning-outcome');
    const searchValidation = searchTask.task.steps.find((step) => step.id === 'validate-learning-outcome');

    expect(windowValidation.action.parameters.args.join(' ')).toContain("$capability -eq 'app.window.focus'");
    expect(formValidation.action.parameters.args.join(' ')).toContain("$capability -eq 'form.fill'");
    expect(summaryValidation.action.parameters.args.join(' ')).toContain("$capability -eq 'page.summary'");
    expect(searchValidation.action.parameters.args.join(' ')).toContain('alice-learning-vm:browser-search-validated');
    expect(searchValidation.action.parameters.args.join(' ')).toContain('browser_search_text_not_observed');
  });

  it('planner creates real VM field interaction and page validation tasks in VM-only mode', () => {
    const fieldTask = createAutonomousLearningTaskForGap(fieldInteractionGap, {
      now: '2026-04-30T10:00:00.000Z',
    });
    const pageTask = createAutonomousLearningTaskForGap(pageValidationGap, {
      now: '2026-04-30T10:00:00.000Z',
    });

    expect(fieldTask.ok).toBe(true);
    expect(fieldTask.task.requiresRealVm).toBe(true);
    expect(fieldTask.task.steps.some((step) =>
      JSON.stringify(step.action?.parameters || {}).includes('alice-learning-vm:field-interacted'))).toBe(true);
    expect(fieldTask.task.steps.some((step) =>
      JSON.stringify(step.action?.parameters || {}).includes('alice field '))).toBe(true);

    expect(pageTask.ok).toBe(true);
    expect(pageTask.task.requiresRealVm).toBe(true);
    expect(pageTask.task.steps.some((step) =>
      JSON.stringify(step.action?.parameters || {}).includes('alice-learning-vm:page-validated'))).toBe(true);
  });

  it('planner validates text input in a controlled UI instead of blindly typing into unknown focus', () => {
    const textTask = createAutonomousLearningTaskForGap({
      gapId: 'gap-text-input-focused-field',
      type: 'text_input',
      capability: 'text.input',
      description: 'Alice nao tem procedimento confiavel para digitar texto em campo focado.',
      priority: 'high',
      riskLevel: 'low',
    }, {
      now: '2026-04-30T10:00:00.000Z',
    });

    expect(textTask.ok).toBe(true);
    expect(textTask.task.steps.some((step) => step.action?.visualAction === 'type_text')).toBe(false);
    expect(textTask.task.steps.some((step) =>
      JSON.stringify(step.action?.parameters || {}).includes('alice-learning-vm:field-interacted'))).toBe(true);
    expect(textTask.task.steps.some((step) =>
      JSON.stringify(step.action?.parameters || {}).includes('field_window_not_detected'))).toBe(true);
    expect(textTask.task.steps.some((step) =>
      JSON.stringify(step.action?.parameters || {}).includes('Set-Clipboard -Value $inputText'))).toBe(true);
    expect(textTask.task.steps.some((step) =>
      JSON.stringify(step.action?.parameters || {}).includes("inputMethod = 'clipboard_paste'"))).toBe(true);
    expect(textTask.task.steps.some((step) =>
      JSON.stringify(step.action?.parameters || {}).includes("inputMethod = 'sendkeys_fallback'"))).toBe(true);
    expect(textTask.task.steps.some((step) =>
      JSON.stringify(step.action?.parameters || {}).includes('vm_text_input_diagnostics='))).toBe(true);
    expect(textTask.task.steps.some((step) =>
      step.id === 'validate-learning-outcome' &&
      step.action?.requestedResources?.autonomousLearning?.substantiveValidation === true)).toBe(true);
  });

  it('planner adapts controlled text interaction to the app context when a known target is present', () => {
    const vscodeTask = createAutonomousLearningTaskForGap({
      gapId: 'gap-context-vscode-text-input',
      type: 'text_input',
      capability: 'text.input',
      description: 'Aprender a digitar em um editor de codigo.',
      priority: 'high',
      riskLevel: 'low',
      metadata: {
        context: {
          target: 'Visual Studio Code',
          observedTargets: [{ kind: 'application', label: 'VS Code' }],
        },
      },
    }, {
      now: '2026-04-30T10:00:00.000Z',
    });
    const payload = JSON.stringify(vscodeTask.task.steps.map((step) => ({
      title: step.title,
      parameters: step.action?.parameters,
      metadata: step.action?.requestedResources?.autonomousLearning,
    })));

    expect(vscodeTask.ok).toBe(true);
    expect(vscodeTask.task.metadata.controlledTarget).toMatchObject({
      profileId: 'vscode',
      kind: 'code_editor',
    });
    expect(payload).toContain('target_app_not_available:vscode');
    expect(payload).toContain('vscode_controlled_file_mismatch');
    expect(payload).toContain('target_profile=vscode');
  });

  it('planner uses the browser as the controlled target for browser-like text contexts', () => {
    const browserTextTask = createAutonomousLearningTaskForGap({
      gapId: 'gap-context-browser-field',
      type: 'text_input',
      capability: 'text.input',
      description: 'Aprender a digitar em campo de navegador.',
      priority: 'high',
      riskLevel: 'low',
      metadata: {
        context: {
          target: 'Microsoft Edge',
          observedTargets: [{ kind: 'application', label: 'Edge browser' }],
        },
      },
    }, {
      now: '2026-04-30T10:00:00.000Z',
    });
    const payload = JSON.stringify(browserTextTask.task.steps.map((step) => ({
      title: step.title,
      parameters: step.action?.parameters,
      metadata: step.action?.requestedResources?.autonomousLearning,
    })));

    expect(browserTextTask.ok).toBe(true);
    expect(browserTextTask.task.metadata.controlledTarget.profileId).toBe('browser');
    expect(payload).toContain('target_profile=browser');
    expect(payload).toContain('browser_search_text_not_observed');
    expect(payload).not.toContain('target_profile=notepad');
  });

  it('reuse and optimization tasks also require the real VM', () => {
    const reuseTask = createAutonomousReuseTask({
      gap: browserGap,
      match: {
        procedureId: 'procedure_browser_search_address_bar',
        matchScore: 0.9,
        procedure: {
          procedureId: 'procedure_browser_search_address_bar',
          capabilities: ['browser.search'],
        },
      },
      now: '2026-04-30T10:00:00.000Z',
    });
    const optimizationTask = createAutonomousOptimizationTask({
      procedure: {
        procedureId: 'procedure_browser_search_address_bar',
        capabilities: ['browser.search'],
        steps: ['click', 'type', 'enter', 'validate'],
      },
      variant: {
        variantId: 'procedure_browser_search_address_bar-v2-ctrl-l',
        steps: ['Ctrl+L', 'type', 'enter'],
      },
      now: '2026-04-30T10:00:00.000Z',
    });

    expect(reuseTask.requiresRealVm).toBe(true);
    expect(reuseTask.allowWorkspaceFallback).toBe(false);
    expect(reuseTask.steps.every((step) => step.action?.environment === 'real_vm')).toBe(true);
    expect(optimizationTask.requiresRealVm).toBe(true);
    expect(optimizationTask.allowWorkspaceFallback).toBe(false);
    expect(optimizationTask.steps.every((step) => step.action?.environment === 'real_vm')).toBe(true);
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

  it('validator refuses promoted learning when substantive validation step is missing', async () => {
    const planned = createAutonomousLearningTaskForGap(browserGap, {
      now: '2026-04-30T10:00:00.000Z',
    });
    const taskWithoutSubstantiveStep = {
      ...planned.task,
      status: RUNNER_TASK_STATUSES.DONE,
      evidenceRefs: [completeEvidenceRef],
      steps: planned.task.steps
        .filter((step) => step.id !== 'validate-learning-outcome')
        .map((step) => ({
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

    const validation = await validateLearningExperimentTask({
      runner: {
        tasksById: { [taskWithoutSubstantiveStep.id]: taskWithoutSubstantiveStep },
        evidenceRefs: [completeEvidenceRef],
      },
      task: taskWithoutSubstantiveStep,
      verifyRunnerEvidence: async () => ({ ok: true, artifacts: { status: 'ok' } }),
    });

    expect(validation.ok).toBe(false);
    expect(validation.reason).toBe('learning_requires_substantive_validation');
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
        substantive: true,
        validationKind: 'controlled_outcome',
        evidenceRefs: [completeEvidenceRef],
      },
      now: '2026-04-30T10:00:00.000Z',
    });

    expect(promotion.ok).toBe(true);
    expect(promotion.candidate.status).toBe('candidate');
    expect(promotion.procedure.status).toBe('guarded');
    expect(promotion.procedure.status).not.toBe('active');
    expect(promotion.procedure.environment).toBe('unknown');
    expect(promotion.procedure.validation.substantive).toBe(true);
    expect(promotion.procedure.validation.validationKind).toBe('controlled_outcome');
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

  it('processes completed learning tasks even when new experiments are rate-limited', async () => {
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
      policy: {
        ...memory.autonomousLearning.policy,
        maxExperimentsPerHour: 3,
      },
      knownGaps: [browserGap],
      recentExperiments: [
        {
          experimentId: `experiment-${doneTask.id}`,
          taskId: doneTask.id,
          gapId: browserGap.gapId,
          status: 'task_created',
          createdAt: '2026-04-30T10:00:00.000Z',
        },
        ...Array.from({ length: 9 }, (_, index) => ({
          experimentId: `experiment-other-${index + 1}`,
          taskId: `other-${index + 1}`,
          status: 'task_created',
          createdAt: `2026-04-30T10:${String(10 + index).padStart(2, '0')}:00.000Z`,
        })),
      ],
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
      nowMs: Date.parse('2026-04-30T10:15:00.000Z'),
    });

    expect(result.reason).toBe('learning_rate_limited');
    expect(result.promotions).toHaveLength(1);
    expect(result.createdTasks).toEqual([]);
    expect(result.memory.autonomousLearning.recentExperiments.some((experiment) =>
      experiment.taskId === doneTask.id && experiment.status === 'validated',
    )).toBe(true);
    expect(result.gaps.some((gap) => gap.gapId === browserGap.gapId)).toBe(false);
  });

  it('records terminal failed learning tasks as rejected instead of leaving them unprocessed', async () => {
    const planned = createAutonomousLearningTaskForGap(browserGap, {
      now: '2026-04-30T10:00:00.000Z',
    });
    const failedTask = {
      ...planned.task,
      status: RUNNER_TASK_STATUSES.FAILED,
      reason: 'max_attempts_reached',
      attempts: 1,
      steps: planned.task.steps.map((step, index) => ({
        ...step,
        status: index === 0 ? 'failed' : step.status,
      })),
    };
    let memory = enqueueAutonomousRunnerMemoryTask(createEmptyAliceMemory(), failedTask, {
      now: '2026-04-30T10:00:00.000Z',
    });
    memory = updateAutonomousLearningMemoryState(memory, {
      ...memory.autonomousLearning,
      enabled: true,
      knownGaps: [browserGap],
      recentExperiments: [{
        experimentId: `experiment-${failedTask.id}`,
        taskId: failedTask.id,
        gapId: browserGap.gapId,
        status: 'task_created',
        createdAt: '2026-04-30T10:00:00.000Z',
      }],
    }, {
      now: '2026-04-30T10:00:00.000Z',
    });

    const result = await runAutonomousLearningLoop({
      memory,
      memoryHydrated: true,
      nowMs: Date.parse('2026-04-30T10:01:00.000Z'),
    });

    expect(result.memory.autonomousLearning.recentExperiments.some((experiment) =>
      experiment.taskId === failedTask.id &&
      experiment.status === 'rejected' &&
      experiment.reason === 'learning_task_not_done',
    )).toBe(true);
    expect(result.createdTasks.some((task) => task.metadata?.gapId === browserGap.gapId)).toBe(false);
  });

  it('asks the App to re-run learning only after governed Runner tasks reach a terminal state', () => {
    expect(shouldRunAutonomousLearningAfterRunnerTick({
      result: {
        task: {
          id: 'learning-done',
          status: RUNNER_TASK_STATUSES.DONE,
          metadata: { createdBy: 'autonomous_learning_loop' },
        },
      },
    })).toBe(true);
    expect(shouldRunAutonomousLearningAfterRunnerTick({
      result: {
        task: {
          id: 'learning-running',
          status: RUNNER_TASK_STATUSES.RUNNING,
          metadata: { createdBy: 'autonomous_learning_loop' },
        },
      },
    })).toBe(false);
    expect(shouldRunAutonomousLearningAfterRunnerTick({
      result: {
        task: {
          id: 'user-done',
          status: RUNNER_TASK_STATUSES.DONE,
          metadata: { createdBy: 'user' },
        },
      },
    })).toBe(false);
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
            reuseValidation: { substantive: true },
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

  it('reuse engine refuses procedures without substantive reuse validation', () => {
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

    expect(reuse.ok).toBe(false);
    expect(reuse.reason).toBe('procedure_missing_substantive_reuse_validation');
    expect(reuse.task).toBeNull();
  });

  it('generic reuse marker is rejected and does not reinforce procedure confidence', async () => {
    const reuseTask = createAutonomousReuseTask({
      gap: browserGap,
      match: {
        procedureId: 'procedure_browser_search_address_bar',
        matchScore: 0.9,
        procedure: {
          procedureId: 'procedure_browser_search_address_bar',
          capabilities: ['browser.search'],
        },
      },
      now: '2026-04-30T10:00:00.000Z',
    });
    expect(reuseTask.metadata.substantiveValidation).toBe(false);
    expect(reuseTask.metadata.validationKind).toBe('infrastructure_marker');
    const doneReuseTask = {
      ...reuseTask,
      status: RUNNER_TASK_STATUSES.DONE,
      evidenceRefs: [completeEvidenceRef],
      steps: reuseTask.steps.map((step) => ({
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
    let memory = {
      ...createEmptyAliceMemory(),
      proceduralMemory: {
        procedures: [{
          procedureId: 'procedure_browser_search_address_bar',
          title: 'Pesquisar no navegador',
          status: 'guarded',
          confidence: 0.7,
          environment: 'local_workspace_fallback',
          environments: ['local_workspace_fallback'],
          capabilities: ['browser.search'],
        }],
      },
    };
    memory = enqueueAutonomousRunnerMemoryTask(memory, doneReuseTask, {
      now: '2026-04-30T10:00:00.000Z',
    });
    memory = updateAutonomousLearningMemoryState(memory, {
      ...memory.autonomousLearning,
      knownGaps: [browserGap],
      recentExperiments: [{
        experimentId: `experiment-${doneReuseTask.id}`,
        taskId: doneReuseTask.id,
        gapId: browserGap.gapId,
        createdBy: 'autonomous_procedure_reuse',
        status: 'task_created',
        createdAt: '2026-04-30T10:00:00.000Z',
      }],
    }, {
      now: '2026-04-30T10:00:00.000Z',
    });

    const result = await runAutonomousLearningLoop({
      memory,
      memoryHydrated: true,
      verifyRunnerEvidence: async () => ({ ok: true, artifacts: { status: 'ok' } }),
      nowMs: Date.parse('2026-04-30T10:01:00.000Z'),
    });
    const procedure = result.memory.proceduralMemory.procedures
      .find((item) => item.procedureId === 'procedure_browser_search_address_bar');

    expect(procedure.environment).toBe('local_workspace_fallback');
    expect(procedure.environments).toEqual(['local_workspace_fallback']);
    expect(procedure.confidence).toBe(0.7);
    expect(result.memory.autonomousLearning.recentExperiments).toEqual(expect.arrayContaining([
      expect.objectContaining({
      status: 'rejected',
      reason: 'procedure_reuse_requires_substantive_validation',
      }),
    ]));
  });

  it('scanner does not hide capability gaps behind non-substantive autonomous procedures', () => {
    const memory = {
      ...createEmptyAliceMemory(),
      proceduralMemory: {
        procedures: [{
          procedureId: 'procedure_browser_search_address_bar',
          title: 'Pesquisar no navegador',
          status: 'guarded',
          confidence: 1,
          source: 'autonomous_learning_loop',
          validation: {
            substantive: false,
            validationKind: 'controlled_experiment',
          },
          reuseValidation: {
            substantive: false,
            reason: 'reuse_requires_context_specific_validation',
          },
          environment: 'real_vm',
          environments: ['real_vm'],
          capabilities: ['browser.search'],
        }],
      },
    };

    const scan = scanAutonomousCapabilityGaps(memory, {
      policy: memory.autonomousLearning.policy,
      now: '2026-04-30T10:02:00.000Z',
    });

    expect(scan.gaps.some((gap) => gap.gapId === browserGap.gapId)).toBe(true);
  });

  it('scanner creates context-aware repair gaps from failed Runner tasks', () => {
    const memory = createEmptyAliceMemory();
    memory.autonomousLearning.observedTargets = [{
      targetId: 'observed-application-installer',
      kind: 'application',
      label: 'Instalador Seguro',
      seenCount: 2,
      lastSeenAt: '2026-04-30T10:00:00.000Z',
    }];
    memory.autonomousRunner = {
      ...memory.autonomousRunner,
      tasksById: {
        'task-install': {
          id: 'task-install',
          title: 'Instalar aplicativo de teste',
          status: 'failed',
          reason: 'package_manager_unavailable',
          riskLevel: 'low',
          metadata: { capability: 'app.install.safe_probe' },
          steps: [{
            id: 'step-winget',
            status: 'failed',
            reason: 'winget_search_failed',
          }],
        },
      },
      audits: [{
        type: 'runner_transition',
        taskId: 'task-install',
        afterState: 'failed',
        reason: 'package_manager_unavailable',
        summary: 'winget nao respondeu',
      }],
    };

    const scan = scanAutonomousCapabilityGaps(memory, {
      policy: memory.autonomousLearning.policy,
      now: '2026-04-30T10:01:00.000Z',
    });
    const contextualGap = scan.gaps.find((gap) => gap.gapId === 'gap-context-repair-task-install');

    expect(contextualGap).toBeTruthy();
    expect(contextualGap.type).toBe('app_install');
    expect(contextualGap.description).toContain('Instalador Seguro');
    expect(contextualGap.metadata.context.failureSignals.join(' ')).toContain('winget_search_failed');
    expect(contextualGap.metadata).toMatchObject({
      repairDepth: 1,
      originalFailedTaskId: 'task-install',
      repairFamily: 'repair-family-task-install',
      needsHumanReview: false,
    });
    expect(contextualGap.metadata.parentFailureSignature).toContain('package_manager_unavailable');
  });

  it('scanner routes failed context-repair tasks to human review instead of recursive repair', () => {
    const memory = createEmptyAliceMemory();
    memory.autonomousRunner = {
      ...memory.autonomousRunner,
      tasksById: {
        'learning-gap-context-repair-task-field-1': {
          id: 'learning-gap-context-repair-task-field-1',
          title: 'Aprender: reparar interacao de campo',
          status: 'failed',
          reason: 'max_attempts_reached',
          riskLevel: 'low',
          metadata: {
            gapId: 'gap-context-repair-task-field',
            capability: 'field.interaction',
            repairDepth: 1,
            originalFailedTaskId: 'task-field',
            parentFailureSignature: 'field.interaction|max_attempts_reached|file_contains_not_evidenced',
            repairFamily: 'repair-family-task-field',
          },
          steps: [{
            id: 'step-field',
            status: 'failed',
            reason: 'file_contains_not_evidenced',
          }],
        },
      },
      audits: [{
        type: 'runner_transition',
        taskId: 'learning-gap-context-repair-task-field-1',
        afterState: 'failed',
        reason: 'max_attempts_reached',
        summary: 'context repair repetiu file_contains_not_evidenced',
      }],
    };

    const scan = scanAutonomousCapabilityGaps(memory, {
      policy: memory.autonomousLearning.policy,
      now: '2026-04-30T10:02:00.000Z',
    });
    const reviewGap = scan.gaps.find((gap) => gap.gapId === 'gap-context-review-task-field');

    expect(reviewGap).toBeTruthy();
    expect(reviewGap.status).toBe('needs_human_review');
    expect(reviewGap.metadata).toMatchObject({
      needsHumanReview: true,
      humanReviewReason: 'context_repair_depth_limit_reached',
      repairDepth: 1,
      originalFailedTaskId: 'task-field',
      repairFamily: 'repair-family-task-field',
    });
    expect(scan.gaps.some((gap) => gap.gapId.startsWith('gap-context-repair-learning-gap-context-repair'))).toBe(false);
  });

  it('scanner dedupes repeated repair signatures into human review cooldown', () => {
    const memory = createEmptyAliceMemory();
    memory.autonomousRunner = {
      ...memory.autonomousRunner,
      tasksById: {
        'task-field': {
          id: 'task-field',
          title: 'Preencher campo controlado',
          status: 'failed',
          reason: 'max_attempts_reached',
          riskLevel: 'low',
          metadata: { capability: 'field.interaction' },
          steps: [{
            id: 'step-field',
            status: 'failed',
            reason: 'file_contains_not_evidenced',
          }],
        },
        'learning-gap-context-repair-task-field-1': {
          id: 'learning-gap-context-repair-task-field-1',
          title: 'Aprender: reparar interacao de campo',
          status: 'failed',
          reason: 'max_attempts_reached',
          riskLevel: 'low',
          metadata: {
            gapId: 'gap-context-repair-task-field',
            capability: 'field.interaction',
            repairDepth: 1,
            originalFailedTaskId: 'task-field',
            parentFailureSignature: 'field.interaction|max_attempts_reached|step-field|file_contains_not_evidenced',
            repairFamily: 'repair-family-task-field',
          },
          steps: [{
            id: 'step-field',
            status: 'failed',
            reason: 'file_contains_not_evidenced',
          }],
        },
      },
      audits: [{
        type: 'runner_transition',
        taskId: 'task-field',
        afterState: 'failed',
        reason: 'max_attempts_reached',
        summary: 'file_contains_not_evidenced',
      }],
    };

    const scan = scanAutonomousCapabilityGaps(memory, {
      policy: memory.autonomousLearning.policy,
      now: '2026-04-30T10:03:00.000Z',
    });
    const reviewGap = scan.gaps.find((gap) => gap.gapId === 'gap-context-review-task-field');

    expect(reviewGap).toBeTruthy();
    expect(reviewGap.status).toBe('needs_human_review');
    expect(reviewGap.metadata.humanReviewReason).toBe('context_repair_signature_cooldown');
    expect(scan.gaps.some((gap) => gap.gapId === 'gap-context-repair-task-field')).toBe(false);
  });

  it('planner refuses to create automatic tasks for human-review repair gaps', () => {
    const planned = createAutonomousLearningTaskForGap({
      gapId: 'gap-context-review-task-field',
      type: 'field_interaction',
      capability: 'field.interaction',
      description: 'Revisao humana necessaria para falha repetida.',
      status: 'needs_human_review',
      metadata: {
        repairDepth: 1,
        originalFailedTaskId: 'task-field',
        repairFamily: 'repair-family-task-field',
        parentFailureSignature: 'field.interaction|max_attempts_reached',
      },
    }, {
      policy: createEmptyAliceMemory().autonomousLearning.policy,
      now: '2026-04-30T10:04:00.000Z',
    });

    expect(planned.ok).toBe(false);
    expect(planned.reason).toBe('learning_gap_needs_human_review');
    expect(planned.task).toBeNull();
  });

  it('contextual repair gaps do not inherit an unrelated recently observed target', () => {
    const memory = createEmptyAliceMemory();
    memory.autonomousLearning.observedTargets = [{
      targetId: 'observed-web-app-random-site',
      kind: 'web_app',
      label: 'random.example',
      seenCount: 4,
      lastSeenAt: '2026-04-30T10:00:00.000Z',
    }];
    memory.autonomousRunner = {
      ...memory.autonomousRunner,
      tasksById: {
        'task-no-target': {
          id: 'task-no-target',
          title: 'Preencher campo controlado',
          status: 'failed',
          metadata: {
            capability: 'field.interaction',
          },
          steps: [{
            id: 'step-1',
            status: 'failed',
            reason: 'field_not_found',
          }],
        },
      },
      audits: [{
        taskId: 'task-no-target',
        type: 'task_failed',
        reason: 'field_not_found',
        summary: 'Falha ao preencher campo',
        timestamp: '2026-04-30T10:01:00.000Z',
      }],
    };

    const scan = scanAutonomousCapabilityGaps(memory, {
      policy: memory.autonomousLearning.policy,
      now: '2026-04-30T10:01:00.000Z',
    });
    const contextualGap = scan.gaps.find((gap) => gap.gapId === 'gap-context-repair-task-no-target');

    expect(contextualGap).toBeTruthy();
    expect(contextualGap.description).not.toContain('random.example');
    expect(contextualGap.metadata.context.target).toBe('');
    expect(contextualGap.metadata.context.observedTargets).toEqual([]);
  });

  it('completed optimization tasks become guarded variants instead of being forgotten', async () => {
    const procedure = {
      procedureId: 'procedure_browser_search_address_bar',
      title: 'Pesquisar no navegador',
      status: 'guarded',
      version: 'v1',
      confidence: 0.8,
      capabilities: ['browser.search'],
      steps: ['clicar barra', 'digitar consulta', 'enter', 'validar pagina'],
      evidenceRefs: [completeEvidenceRef],
    };
    const variant = {
      variantId: 'procedure_browser_search_address_bar-v2-ctrl-l',
      title: 'Usar Ctrl+L',
      steps: ['Ctrl+L', 'digitar consulta', 'enter', 'validar pagina'],
      benchmark: { equallyReliableOrBetter: true, fasterOrSimpler: true },
    };
    const task = createAutonomousOptimizationTask({
      procedure,
      variant,
      now: '2026-04-30T10:00:00.000Z',
    });
    const doneTask = {
      ...task,
      status: RUNNER_TASK_STATUSES.DONE,
      evidenceRefs: [completeEvidenceRef],
      steps: task.steps.map((step) => ({
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
    let memory = {
      ...createEmptyAliceMemory(),
      proceduralMemory: { procedures: [procedure] },
    };
    memory = enqueueAutonomousRunnerMemoryTask(memory, doneTask, {
      now: '2026-04-30T10:00:00.000Z',
    });
    memory = updateAutonomousLearningMemoryState(memory, {
      ...memory.autonomousLearning,
      policy: {
        ...memory.autonomousLearning.policy,
        maxExperimentsPerHour: 0,
      },
      recentExperiments: [{
        experimentId: `experiment-${doneTask.id}`,
        taskId: doneTask.id,
        createdBy: 'autonomous_procedure_optimizer',
        status: 'task_created',
        createdAt: '2026-04-30T10:00:00.000Z',
      }],
    }, { now: '2026-04-30T10:00:00.000Z' });
    memory.autonomousOptimization = {
      ...memory.autonomousOptimization,
      candidates: [{
        procedureId: procedure.procedureId,
        variantId: variant.variantId,
        variant,
        benchmark: variant.benchmark,
        taskId: doneTask.id,
        status: 'task_created',
        createdAt: '2026-04-30T10:00:00.000Z',
      }],
    };

    const result = await runAutonomousLearningLoop({
      memory,
      memoryHydrated: true,
      verifyRunnerEvidence: async () => ({ ok: true, artifacts: { status: 'ok' } }),
      nowMs: Date.parse('2026-04-30T10:01:00.000Z'),
    });

    expect(result.createdTasks).toEqual([]);
    expect(result.memory.autonomousOptimization.promotedVariants[0]).toMatchObject({
      procedureId: procedure.procedureId,
      status: 'guarded',
      previousVersion: 'v1',
      fallbackVersion: 'v1',
    });
    expect(result.memory.autonomousLearning.procedureCandidates[0]).toMatchObject({
      source: 'autonomous_procedure_optimizer',
      variantId: variant.variantId,
      status: 'guarded',
    });
    expect(result.memory.autonomousLearning.recentExperiments).toEqual(expect.arrayContaining([
      expect.objectContaining({
        taskId: doneTask.id,
        createdBy: 'autonomous_procedure_optimizer',
        status: 'validated',
      }),
    ]));
  });

  it('stores every optimization candidate created in the same run', async () => {
    const memory = updateAutonomousLearningMemoryState(createEmptyAliceMemory(), (learning) => ({
      ...learning,
      policy: {
        ...learning.policy,
        maxExperimentsPerStartup: 1,
        maxTasksCreatedPerRun: 6,
      },
    }), { now: '2026-04-30T09:59:00.000Z' });
    memory.proceduralMemory.procedures = [
      {
        procedureId: 'procedure-browser-search-1',
        title: 'Pesquisar no navegador 1',
        status: 'guarded',
        version: 'v1',
        confidence: 0.8,
        capabilities: ['browser.search'],
        steps: ['clicar barra', 'digitar consulta', 'pressionar enter', 'validar pagina', 'aguardar'],
      },
      {
        procedureId: 'procedure-browser-search-2',
        title: 'Pesquisar no navegador 2',
        status: 'guarded',
        version: 'v1',
        confidence: 0.82,
        capabilities: ['browser.search'],
        steps: ['clicar barra', 'digitar consulta', 'pressionar enter', 'validar pagina', 'aguardar'],
      },
    ];

    const result = await runAutonomousLearningLoop({
      memory,
      memoryHydrated: true,
      nowMs: Date.parse('2026-04-30T10:00:00.000Z'),
    });

    const optimizationTasks = result.createdTasks.filter((task) =>
      task.metadata?.createdBy === 'autonomous_procedure_optimizer');

    expect(optimizationTasks).toHaveLength(2);
    expect(result.memory.autonomousOptimization.candidates).toHaveLength(2);
    expect(result.memory.autonomousOptimization.stats.tasksCreated).toBe(2);
    expect(result.memory.autonomousOptimization.candidates.map((candidate) => candidate.taskId)).toEqual(
      expect.arrayContaining(optimizationTasks.map((task) => task.id)),
    );
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

  it('clear learned data removes autonomous procedures while preserving user procedures', () => {
    const learnedProcedure = {
      procedureId: 'procedure_browser_search',
      title: 'Pesquisar no navegador',
      source: 'autonomous_learning_loop',
      status: 'guarded',
      confidence: 0.8,
      capabilities: ['browser.search'],
    };
    const userProcedure = {
      procedureId: 'procedure_user_note_style',
      title: 'Preferencia manual do usuario',
      source: 'user',
      status: 'active',
      confidence: 0.9,
      capabilities: ['user.preference'],
    };
    const planned = createAutonomousLearningTaskForGap(browserGap, {
      now: '2026-04-30T10:00:00.000Z',
    });
    let memory = {
      ...createEmptyAliceMemory(),
      proceduralMemory: {
        procedures: [learnedProcedure, userProcedure],
      },
      autonomousAudit: {
        ...createEmptyAliceMemory().autonomousAudit,
        skillCandidates: [{ candidateId: 'candidate-autonomous', source: 'autonomous_learning_loop' }],
        procedures: [learnedProcedure],
        learningMemoryEvents: [{ id: 'learned-event' }],
      },
    };
    memory = enqueueAutonomousRunnerMemoryTask(memory, planned.task, {
      now: '2026-04-30T10:00:00.000Z',
    });
    memory = updateAutonomousLearningMemoryState(memory, {
      ...memory.autonomousLearning,
      procedureCandidates: [{ candidateId: 'candidate-browser', procedureId: 'procedure_browser_search' }],
      promotedProcedures: [learnedProcedure],
      generatedScripts: [{ scriptId: 'script-1', source: 'autonomous_learning_loop' }],
    }, {
      now: '2026-04-30T10:00:00.000Z',
    });

    const cleared = clearAutonomousLearnedData(memory, {
      now: '2026-04-30T10:01:00.000Z',
      disableLearning: true,
    });
    const runner = getAutonomousRunnerState(cleared.memory);

    expect(runner.tasksById[planned.task.id]).toBeUndefined();
    expect(cleared.memory.proceduralMemory.procedures).toHaveLength(1);
    expect(cleared.memory.proceduralMemory.procedures[0]).toMatchObject(userProcedure);
    expect(cleared.memory.autonomousLearning.enabled).toBe(false);
    expect(cleared.memory.autonomousLearning.procedureCandidates).toEqual([]);
    expect(cleared.memory.autonomousLearning.promotedProcedures).toEqual([]);
    expect(cleared.memory.autonomousLearning.generatedScripts).toEqual([]);
    expect(cleared.memory.autonomousOptimization.candidates).toEqual([]);
    expect(cleared.memory.procedureReuseIndex.capabilities).toEqual({});
    expect(cleared.memory.autonomousAudit.skillCandidates).toEqual([]);
    expect(cleared.memory.autonomousAudit.procedures).toEqual([]);
    expect(cleared.memory.autonomousAudit.learningMemoryEvents).toEqual([]);
    expect(cleared.removedLearning).toMatchObject({
      procedureCandidates: 1,
      promotedProcedures: 1,
      generatedScripts: 1,
      proceduralMemoryProcedures: 1,
      disabled: true,
    });
  });

  it('clear learned data can preserve user learning goals for reexecution', () => {
    const learnedProcedure = {
      procedureId: 'procedure_browser_search',
      title: 'Pesquisar no navegador',
      source: 'autonomous_learning_loop',
      status: 'guarded',
      confidence: 0.8,
      capabilities: ['browser.search'],
    };
    const task = createAutonomousLearningTaskForGap(browserGap, {
      now: '2026-04-30T10:00:00.000Z',
    }).task;
    let memory = {
      ...createEmptyAliceMemory(),
      autonomousLearning: {
        ...createEmptyAliceMemory().autonomousLearning,
        learningGoals: [{
          goalId: 'goal-1',
          title: 'Aprender operacoes basicas',
          description: 'Aprender operacoes basicas',
          status: 'open',
        }],
        procedureCandidates: [{ candidateId: 'candidate-browser', procedureId: 'procedure_browser_search' }],
        promotedProcedures: [learnedProcedure],
      },
      proceduralMemory: {
        procedures: [learnedProcedure],
      },
    };
    memory = enqueueAutonomousRunnerMemoryTask(memory, task, {
      now: '2026-04-30T10:00:00.000Z',
    });

    const cleared = clearAutonomousLearnedData(memory, {
      now: '2026-04-30T10:01:00.000Z',
      preserveGoals: true,
    });

    expect(cleared.memory.autonomousLearning.learningGoals).toHaveLength(1);
    expect(cleared.memory.autonomousLearning.learningGoals[0]).toMatchObject({
      goalId: 'goal-1',
      title: 'Aprender operacoes basicas',
      status: 'open',
    });
    expect(cleared.memory.autonomousLearning.procedureCandidates).toEqual([]);
    expect(cleared.memory.autonomousLearning.promotedProcedures).toEqual([]);
    expect(cleared.memory.proceduralMemory.procedures).toEqual([]);
    expect(getAutonomousRunnerState(cleared.memory).tasksById[task.id]).toBeUndefined();
    expect(cleared.removedLearning).toMatchObject({
      preservedLearningGoals: 1,
    });
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
    const limitedMemory = updateAutonomousLearningMemoryState(createEmptyAliceMemory(), (learning) => ({
      ...learning,
      policy: {
        ...learning.policy,
        maxExperimentsPerStartup: 2,
        maxTasksCreatedPerRun: 2,
      },
    }), { now: '2026-04-30T09:59:00.000Z' });
    const result = await runAutonomousLearningLoop({
      memory: limitedMemory,
      memoryHydrated: true,
      nowMs: Date.parse('2026-04-30T10:00:00.000Z'),
    });

    expect(result.started).toBe(true);
    expect(result.createdTasks.length).toBeLessThanOrEqual(2);
    expect(result.createdTasks[0].metadata.createdBy).toBe('autonomous_learning_loop');
  });

  it('default learning policy keeps learning open but batches startup task creation', async () => {
    const result = await runAutonomousLearningLoop({
      memory: createEmptyAliceMemory(),
      memoryHydrated: true,
      nowMs: Date.parse('2026-04-30T10:00:00.000Z'),
    });

    expect(result.started).toBe(true);
    expect(result.createdTasks.length).toBeGreaterThan(2);
    expect(result.createdTasks.length).toBeLessThanOrEqual(6);
  });

  it('records an idle audit instead of tasks_enqueued when no tasks are created', async () => {
    let memory = createEmptyAliceMemory();
    memory = updateAutonomousLearningMemoryState(memory, {
      ...memory.autonomousLearning,
      enabled: true,
      promotedProcedures: [
        ['procedure_browser_search', 'browser.search'],
        ['procedure_text_input', 'text.input'],
        ['procedure_page_validate', 'page.validate'],
        ['procedure_app_launch', 'app.launch'],
        ['procedure_file_explorer', 'file.explorer.open'],
        ['procedure_file_management', 'file.folder.create'],
        ['procedure_app_install_probe', 'app.install.safe_probe'],
        ['procedure_field_interaction', 'field.interaction'],
        ['procedure_page_read', 'page.read'],
      ].map(([procedureId, capability]) => ({
        procedureId,
        title: capability,
        summary: `Procedimento confiavel para ${capability}.`,
        status: 'guarded',
        confidence: 0.8,
        environment: 'real_vm',
        environments: ['real_vm'],
        capabilities: [capability],
      })),
    }, {
      now: '2026-04-30T10:00:00.000Z',
    });

    const result = await runAutonomousLearningLoop({
      memory,
      memoryHydrated: true,
      nowMs: Date.parse('2026-04-30T10:01:00.000Z'),
    });
    const lastAudit = result.memory.autonomousLearning.auditLog.at(-1);

    expect(result.createdTasks).toEqual([]);
    expect(lastAudit.type).toBe('learning_loop_idle');
    expect(lastAudit.reason).toBe('no_tasks_created');
    expect(lastAudit.summary).toBe('Loop de aprendizado terminou sem criar tasks.');
  });
});
