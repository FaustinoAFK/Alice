import { describe, expect, it } from 'vitest';
import {
  ENVIRONMENT_TYPES,
  EXECUTION_MODES,
  RISK_LEVELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  VM_VISUAL_ACTIONS,
  VM_VISUAL_ACTION_SOURCES,
  VALIDATION_CHECK_TYPES,
  ValidationPipeline,
  ResultChecker,
  ImpactChecker,
  appendVmVisualReplayStep,
  archiveDeprecatedProcedures,
  buildProjectContext,
  createAppAutomationStrategy,
  createActionableResearchCycle,
  createEmptyAutonomousLearningState,
  createImprovementProposal,
  createLocalWorkspacePlan,
  createProcedureCandidate,
  createResearchPlan,
  createVmOperationalTaskPlan,
  createChangeSnapshot,
  createTurnContext,
  normalizeVmStatus,
  selectFilesForPlayground,
  selectPlaygroundExecution,
  evaluateValidationPipeline,
  enqueueAutonomousTask,
  evaluateAutonomousPolicy,
  evaluateValidationReport,
  hydrateAutonomousStateFromAudit,
  pauseBackgroundForUserRequest,
  policyAllowsProposalApplication,
  pruneOperationalLearning,
  promoteValidatedProcedure,
  recordUnexpectedRiskAndRollback,
  runUserPriorityHooks,
  runVmVisualLoop,
  resolveVmApp,
  serializeAutonomousStateForAudit,
  shouldStopResearch,
  startRunnableTasks,
  validateVmVisualActionProposal,
} from './autonomousLearning';
import { buildDebugHudSnapshot } from './debugHud';
import {
  createEmptyAliceMemory,
  mergeValidatedProcedures,
} from './aliceMemory';
import { executeAutonomousLearningFunctionCall } from './autonomousLearningToolExecutor';

describe('autonomous learning policy', () => {
  it('pauses background work when a user request arrives', () => {
    const initialState = createEmptyAutonomousLearningState();
    const { state: queuedState } = enqueueAutonomousTask(
      initialState,
      {
        taskType: TASK_TYPES.SELF_IMPROVEMENT,
        priority: TASK_PRIORITIES.INTERNAL_IMPROVEMENT,
        environment: ENVIRONMENT_TYPES.LOCAL_VM_PLAYGROUND,
        reason: 'analisar melhorias internas',
      },
      { now: 1000 },
    );
    const { state: runningState } = startRunnableTasks(queuedState, { now: 1001 });

    expect(runningState.tasks[0].status).toBe(TASK_STATUSES.RUNNING);

    const { state: pausedState, pausedTaskIds } = pauseBackgroundForUserRequest(runningState, {
      userRequest: 'organiza esse arquivo agora',
      now: 1002,
    });

    expect(pausedTaskIds).toEqual([runningState.tasks[0].taskId]);
    expect(pausedState.tasks[0].status).toBe(TASK_STATUSES.PAUSED);
    expect(pausedState.logs.at(-1).type).toBe('user_request_prioritized');
  });

  it('requests native cancellation for paused background tasks through official hooks', () => {
    const initialState = createEmptyAutonomousLearningState();
    const { state: queuedState } = enqueueAutonomousTask(
      initialState,
      {
        taskType: TASK_TYPES.BACKGROUND_OPTIMIZATION,
        priority: TASK_PRIORITIES.BACKGROUND_OPTIMIZATION,
        environment: ENVIRONMENT_TYPES.LOCAL_WORKSPACE_FALLBACK,
        reason: 'otimizacao em background',
      },
      { now: 1100 },
    );
    const { state: runningState } = startRunnableTasks(queuedState, { now: 1101 });
    const cancelCalls = [];
    const result = runUserPriorityHooks(runningState, {
      turnContext: createTurnContext({ userUtterance: 'alice pare e responda isso agora', now: 1102 }),
      cancelTask: (taskId, reason) => cancelCalls.push({ taskId, reason }),
      now: 1102,
    });

    expect(result.pausedTaskIds).toEqual([runningState.tasks[0].taskId]);
    expect(cancelCalls).toEqual([{ taskId: runningState.tasks[0].taskId, reason: 'user_request_preemption' }]);
    expect(result.state.logs.at(-1).type).toBe('user_priority_hooks_completed');
  });

  it('keeps real PC actions guarded by snapshot, validation and rollback', () => {
    const decision = evaluateAutonomousPolicy({
      environment: ENVIRONMENT_TYPES.REAL_PC,
      actionType: TASK_TYPES.USER_REQUEST,
      riskLevel: RISK_LEVELS.MEDIUM,
      priority: TASK_PRIORITIES.USER_NORMAL,
      targetFiles: ['src/App.jsx'],
      reason: 'ajustar app real',
    });

    expect(decision.allowed).toBe(true);
    expect(decision.requiresSnapshot).toBe(true);
    expect(decision.requiresValidation).toBe(true);
    expect(decision.requiresRollbackPlan).toBe(true);
    expect(decision.shouldPauseBackground).toBe(true);
  });

  it('blocks high-risk real PC actions until explicit confirmation', () => {
    const decision = evaluateAutonomousPolicy({
      environment: ENVIRONMENT_TYPES.REAL_PC,
      riskLevel: RISK_LEVELS.HIGH,
      requiresSystemAccess: true,
      targetFiles: ['C:/config/sistema.json'],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.requiresConfirmation).toBe(true);
    expect(decision.reason).toBe('high_risk_real_pc_action_requires_confirmation');
  });

  it('forces self-improvement on official code to be proposal first', () => {
    const decision = evaluateAutonomousPolicy({
      environment: ENVIRONMENT_TYPES.REAL_PC,
      executionMode: EXECUTION_MODES.EXECUTION,
      affectsOfficialCode: true,
      targetFiles: ['src/alice.js'],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('official_code_changes_require_proposal_first');
  });
});

describe('VM visual interaction layer contracts', () => {
  it('resolves high-level VM operational install tasks to background winget actions', () => {
    const app = resolveVmApp('baixe o Visual Studio na VM');
    const plan = createVmOperationalTaskPlan({
      objective: 'baixe o Visual Studio na VM',
      taskKind: 'install_app',
    });

    expect(app.displayName).toBe('Visual Studio Community 2022');
    expect(plan.ok).toBe(true);
    expect(plan.kind).toBe('install_app');
    expect(plan.nativeTool).toBe('run_vm_guest_agent_action');
    expect(plan.nativeArgs.request.action).toBe(VM_VISUAL_ACTIONS.START_BACKGROUND_COMMAND);
    expect(plan.nativeArgs.request.parameters.command).toBe('winget.exe');
    expect(plan.nativeArgs.request.parameters.args).toEqual(expect.arrayContaining([
      '--id',
      'Microsoft.VisualStudio.2022.Community',
    ]));
    expect(plan.backgroundTaskId).toContain('visual-studio-community-2022');
  });

  it('resolves high-level VM operational app opening without web research', () => {
    const plan = createVmOperationalTaskPlan({
      objective: 'abra o explorador de arquivos na VM',
    });

    expect(plan.ok).toBe(true);
    expect(plan.kind).toBe('open_app');
    expect(plan.nativeArgs.request.action).toBe(VM_VISUAL_ACTIONS.RUN_COMMAND);
    expect(plan.nativeArgs.request.parameters).toMatchObject({
      command: 'cmd.exe',
    });
    expect(plan.nativeArgs.request.parameters.args).toEqual([
      '/c',
      'start',
      '',
      'explorer.exe',
    ]);
  });

  it('resolves open-and-type VM requests into app open plus type_text follow-up', () => {
    const plan = createVmOperationalTaskPlan({
      objective: 'abra o bloco de notas e escreva alice teste na VM',
    });

    expect(plan.ok).toBe(true);
    expect(plan.kind).toBe('open_app');
    expect(plan.app.displayName).toBe('Bloco de Notas');
    expect(plan.nativeArgs.request.parameters.args).toEqual([
      '/c',
      'start',
      '',
      'notepad.exe',
    ]);
    expect(plan.textToType).toBe('alice teste');
    expect(plan.followUpActions).toEqual([
      expect.objectContaining({ action: VM_VISUAL_ACTIONS.WAIT }),
      expect.objectContaining({
        action: VM_VISUAL_ACTIONS.TYPE_TEXT,
        parameters: { text: 'alice teste', method: 'auto' },
      }),
    ]);
  });

  it('blocks unknown VM install tasks with a clear reason instead of searching forever', () => {
    const plan = createVmOperationalTaskPlan({
      objective: 'baixe aquele aplicativo estranho na VM',
      taskKind: 'install_app',
    });

    expect(plan.ok).toBe(false);
    expect(plan.reason).toBe('unknown_app_install_command');
  });

  it('records coordinate fallback only with reason and screenshot evidence', () => {
    const blocked = validateVmVisualActionProposal({
      proposedAction: {
        action: VM_VISUAL_ACTIONS.CLICK,
        source: VM_VISUAL_ACTION_SOURCES.COORDINATE_FALLBACK,
        parameters: { x: 10, y: 20 },
      },
      visualContext: { screenshotPath: 'C:/tmp/before.png' },
    });
    const allowed = validateVmVisualActionProposal({
      proposedAction: {
        action: VM_VISUAL_ACTIONS.CLICK,
        source: VM_VISUAL_ACTION_SOURCES.COORDINATE_FALLBACK,
        reason: 'botao detectado por OCR impreciso',
        parameters: { x: 10, y: 20 },
      },
      visualContext: { screenshotPath: 'C:/tmp/before.png' },
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe('coordinate_fallback_requires_reason_coordinates_and_screenshot');
    expect(allowed.allowed).toBe(true);
    expect(allowed.flags).toContain('coordinate_fallback_logged');
  });

  it('blocks repetitive visual actions before an infinite loop', () => {
    const previousSteps = [1, 2, 3].map((index) => ({
      stepId: `step-${index}`,
      executedAction: { action: VM_VISUAL_ACTIONS.WAIT },
    }));

    const decision = validateVmVisualActionProposal({
      proposedAction: { action: VM_VISUAL_ACTIONS.WAIT, parameters: { durationMs: 10 } },
      previousSteps,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('vm_visual_repetition_guard');
  });

  it('allows VM background commands so long installs can be polled instead of timing out', () => {
    const startDecision = validateVmVisualActionProposal({
      proposedAction: {
        action: VM_VISUAL_ACTIONS.START_BACKGROUND_COMMAND,
        parameters: {
          command: 'winget.exe',
          args: ['install', '--id', 'Microsoft.VisualStudio.2022.Community'],
        },
        reason: 'instalador longo dentro da VM deve rodar em background',
      },
    });
    const pollDecision = validateVmVisualActionProposal({
      proposedAction: {
        action: VM_VISUAL_ACTIONS.GET_BACKGROUND_COMMAND_STATUS,
        parameters: { background_task_id: 'task-1' },
      },
    });

    expect(startDecision.allowed).toBe(true);
    expect(pollDecision.allowed).toBe(true);
  });

  it('stores full replay evidence for visual steps', () => {
    const replay = appendVmVisualReplayStep(
      { replayId: 'replay-1', steps: [], artifacts: [] },
      {
        stepId: 'step-1',
        visualContextBefore: { screenshotPath: 'before.png', detectedElements: [] },
        proposedAction: { action: VM_VISUAL_ACTIONS.CLICK, reason: 'abrir campo' },
        decisionResult: { allowed: true },
        executedAction: { action: VM_VISUAL_ACTIONS.CLICK, reason: 'abrir campo' },
        visualContextAfter: { screenshotPath: 'after.png', detectedElements: [] },
        validationResult: { passed: true },
      },
    );

    expect(replay.steps).toHaveLength(1);
    expect(replay.artifacts).toEqual(['before.png', 'after.png']);
    expect(replay.steps[0].decisionResult.allowed).toBe(true);
  });

  it('runs visual loop through agent, decision and validation', async () => {
    let nowValue = 1000;
    const agent = {
      captureScreen: async () => ({
        screenshotPath: `screen-${nowValue}.png`,
        activeWindowTitle: 'Notepad',
        detectedElements: [],
      }),
      executeAction: async () => ({ ok: true, success: true }),
    };
    const result = await runVmVisualLoop({
      objective: 'digitar teste',
      taskId: 'visual-task-1',
      agent,
      capabilities: { can_capture_screen: true },
      planner: async () => ({
        action: VM_VISUAL_ACTIONS.TYPE_TEXT,
        parameters: { text: 'alice visual ok' },
        reason: 'preencher bloco de notas',
      }),
      validateStep: async () => ({ passed: true, completed: true }),
      maxSteps: 2,
      now: () => {
        nowValue += 10;
        return nowValue;
      },
    });

    expect(result.ok).toBe(true);
    expect(result.taskType).toBe(TASK_TYPES.VM_UI_INTERACTION);
    expect(result.replay.steps).toHaveLength(1);
    expect(result.replay.status).toBe('done');
  });
});

describe('local workspace fallback', () => {
  it('uses copied files and never direct real-file access', () => {
    const plan = createLocalWorkspacePlan({
      taskId: 'task-1',
      sourceFiles: [{ path: 'C:/projetos/alice-virtual/src/App.jsx', sizeBytes: 120 }],
      requestedResources: { cpuPercent: 20, ramMb: 512, diskMb: 256 },
      hostResources: { cpuPercent: 80, ramMb: 8192, diskMb: 20000 },
    });

    expect(plan.ok).toBe(true);
    expect(plan.isRealVm).toBe(false);
    expect(plan.directRealFileAccess).toBe(false);
    expect(plan.copyManifest[0]).toMatchObject({
      mode: 'copy',
      sourcePath: 'C:/projetos/alice-virtual/src/App.jsx',
    });
    expect(plan.copyManifest[0].workspacePath).toContain('alice-local-workspace/task-1/input/');
  });

  it('rejects direct access and excessive local resources', () => {
    const directPlan = createLocalWorkspacePlan({
      taskId: 'task-2',
      sourceFiles: [{ path: 'C:/real/file.txt', directAccess: true }],
    });
    const largePlan = createLocalWorkspacePlan({
      taskId: 'task-3',
      requestedResources: { cpuPercent: 90, ramMb: 16384, diskMb: 100000 },
      hostResources: { cpuPercent: 100, ramMb: 8192, diskMb: 20000 },
    });

    expect(directPlan.ok).toBe(false);
    expect(directPlan.violations).toContain('direct_real_file_access');
    expect(largePlan.ok).toBe(false);
    expect(largePlan.violations).toContain('cpu_limit_exceeded');
    expect(largePlan.violations).toContain('ram_limit_exceeded');
    expect(largePlan.violations).toContain('disk_limit_exceeded');
  });

  it('rejects unsafe target paths before runtime materialization', () => {
    const plan = createLocalWorkspacePlan({
      taskId: 'task-unsafe',
      sourceFiles: [{ content: 'ok', targetPath: '../outside.txt' }],
    });

    expect(plan.ok).toBe(false);
    expect(plan.violations).toContain('unsafe_target_path');
  });
});

describe('local VM provider contract', () => {
  it('keeps real VM guest execution separate from workspace fallback', () => {
    const vmStatus = normalizeVmStatus({
      provider: 'hyper_v',
      providerStatus: 'configured_not_ready',
      realVmAvailable: true,
      guestCommandReady: false,
      setupReason: 'set_alice_local_vm_user_and_password',
      providers: [
        {
          name: 'hyper_v',
          available: true,
          configured: true,
          ready: false,
          setupReason: 'set_alice_local_vm_user_and_password',
          capabilities: {
            can_detect: true,
            can_start: true,
            can_stop: true,
            can_suspend: true,
            can_snapshot: true,
            can_restore_snapshot: true,
            can_copy_files_to_guest: false,
            can_execute_command_in_guest: false,
            can_collect_artifacts: false,
            can_report_health: true,
            can_report_resource_usage: true,
          },
        },
      ],
    });
    const selection = selectPlaygroundExecution({
      policyDecision: { allowed: true },
      vmStatus,
      allowWorkspaceFallback: true,
    });

    expect(vmStatus.realVmAvailable).toBe(true);
    expect(vmStatus.providerStatus).toBe('configured_not_ready');
    expect(vmStatus.guestCommandReady).toBe(false);
    expect(selection.mode).toBe('real_vm');
    expect(selection.canExecuteGuestCommand).toBe(false);
    expect(selection.reason).toBe('real_local_vm_available_but_guest_command_not_ready');
  });

  it('uses fallback only when no real VM provider is configured and policy allows it', () => {
    const selection = selectPlaygroundExecution({
      policyDecision: { allowed: true },
      vmStatus: normalizeVmStatus({ realVmAvailable: false, fallbackWorkspaceAvailable: true }),
      allowWorkspaceFallback: true,
    });

    expect(selection.mode).toBe('local_workspace_fallback');
    expect(selection.isRealVm).toBe(false);
    expect(selection.reason).toBe('using_explicit_local_workspace_fallback');
  });

  it('blocks fallback when the task explicitly requires a real VM', () => {
    const decision = evaluateAutonomousPolicy(
      {
        environment: ENVIRONMENT_TYPES.LOCAL_VM_PLAYGROUND,
        riskLevel: RISK_LEVELS.LOW,
        requiresRealVm: true,
        allowWorkspaceFallback: true,
      },
      { realVmAvailable: false },
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('real_local_vm_unavailable');
  });
});

describe('rollback and validation', () => {
  it('rolls back from snapshot when unexpected risk appears', () => {
    const snapshot = createChangeSnapshot({
      actionId: 'change-1',
      files: [{ path: 'src/file.js', content: 'const ok = true;' }],
      now: 2000,
    });
    const nextState = recordUnexpectedRiskAndRollback(
      createEmptyAutonomousLearningState(),
      {
        snapshot,
        currentFiles: [{ path: 'src/file.js', content: 'const ok = false;' }],
        risk: { reason: 'resultado divergiu', level: RISK_LEVELS.HIGH },
        now: 2001,
      },
    );

    expect(nextState.risks[0].rollbackTriggered).toBe(true);
    expect(nextState.rollbacks[0].restoredFiles[0].content).toBe('const ok = true;');
    expect(nextState.logs.at(-1).type).toBe('risk_detected_rollback_triggered');
  });

  it('rejects validation based only on lack of command error', () => {
    const report = evaluateValidationReport({
      checks: [{ type: 'exit_code', label: 'comando retornou 0', passed: true }],
    });

    expect(report.passed).toBe(false);
    expect(report.reason).toBe('validation_rejected_exit_code_only');
  });

  it('accepts validation with substantive evidence', () => {
    const report = evaluateValidationReport({
      checks: [
        { type: 'test', label: 'vitest', passed: true, evidence: '12 tests passaram' },
        { type: 'file_diff', label: 'diff revisado', passed: true, evidence: '1 arquivo alterado' },
      ],
      requiredEvidence: ['test'],
    });

    expect(report.passed).toBe(true);
    expect(report.reason).toBe('validation_passed_with_substantive_evidence');
  });

  it('runs the complete validation pipeline with functional and impact checks', () => {
    const report = evaluateValidationPipeline({
      checks: [
        { type: 'functional', label: 'functional', passed: true, evidence: 'resultado esperado gerado' },
        { type: 'impact', label: 'impact', passed: true, evidence: 'somente workspace copiado' },
        { type: 'regression', label: 'regression', passed: true, evidence: 'testes existentes passaram' },
      ],
      requiredEvidence: ['functional', 'impact'],
    });

    expect(report.passed).toBe(true);
    expect(report.reason).toBe('validation_pipeline_passed');
    expect(report.solutionScore.score).toBeGreaterThanOrEqual(0.65);
  });

  it('exposes the named validation checkers required by the plan', () => {
    const checks = [
      { type: VALIDATION_CHECK_TYPES.RESULT, passed: true, evidence: 'resultado correto' },
      { type: VALIDATION_CHECK_TYPES.IMPACT, passed: true, evidence: 'impacto limitado' },
    ];

    expect(ResultChecker({ checks }).passed).toBe(true);
    expect(ImpactChecker({ checks }).passed).toBe(true);
    expect(ValidationPipeline({ checks, requiredEvidence: ['functional', 'impact'] }).passed).toBe(true);
  });
});

describe('research, app automation and learning memory', () => {
  it('caps research cycles and sources', () => {
    const plan = createResearchPlan({
      query: 'como validar scripts com rollback',
      maxCycles: 99,
      maxSources: 99,
    });

    expect(plan.limits.cycles).toBe(3);
    expect(plan.limits.sources).toBe(8);
    expect(shouldStopResearch({ cyclesCompleted: 3, sourcesRead: 1, plan })).toEqual({
      stop: true,
      reason: 'research_cycle_limit_reached',
    });
  });

  it('turns research into a bounded testable plan instead of an open-ended loop', () => {
    const plan = createResearchPlan({ query: 'como testar rollback', maxCycles: 2, maxSources: 2, now: 2200 });
    const cycle = createActionableResearchCycle({
      plan,
      findings: [
        { title: 'Rollback seguro', url: 'https://example.test/rollback', summary: 'use snapshot', confidence: 0.8 },
        { title: 'Teste de regressao', url: 'https://example.test/tests', summary: 'rode suite', confidence: 0.7 },
        { title: 'Extra', url: 'https://example.test/extra', summary: 'fora do limite', confidence: 0.6 },
      ],
      recommendedApproach: 'criar snapshot, aplicar patch em copia e validar rollback',
      testPlan: ['criar snapshot', 'aplicar patch em workspace', 'rodar testes', 'validar rollback'],
      risks: ['mudanca externa durante rollback'],
      confidence: 0.75,
      now: 2201,
    });

    expect(cycle.findings).toHaveLength(2);
    expect(cycle.actionable).toBe(true);
    expect(cycle.nextStep).toBe('test_in_playground');
  });

  it('uses UI elements before coordinate fallback for app automation', () => {
    expect(createAppAutomationStrategy({
      appName: 'Edge',
      goal: 'clicar em salvar',
      availableSignals: ['coordinates', 'ui_tree'],
    }).selectedMode).toBe('ui_tree');

    expect(createAppAutomationStrategy({
      appName: 'Edge',
      goal: 'clicar em salvar',
      availableSignals: ['coordinates'],
    }).coordinateFallbackOnly).toBe(true);
  });

  it('creates self-improvement proposals without direct application', () => {
    const proposal = createImprovementProposal({
      title: 'Melhorar HUD',
      affectedFiles: ['src/App.jsx'],
    });

    expect(proposal.requiresUserApproval).toBe(true);
    expect(proposal.mayApplyDirectly).toBe(false);
    expect(policyAllowsProposalApplication({ proposal, userApproved: false }).allowed).toBe(false);
    expect(policyAllowsProposalApplication({ proposal, userApproved: true }).allowed).toBe(false);
  });

  it('promotes only validated learning into official procedural memory', () => {
    const candidate = createProcedureCandidate({
      title: 'Validar patch em VM local',
      steps: ['copiar arquivos', 'rodar testes', 'comparar diff'],
      confidence: 0.5,
      now: 3000,
    });
    const validationReport = evaluateValidationReport({
      checks: [{ type: 'test', label: 'teste principal', passed: true, evidence: 'passou' }],
      now: 3001,
    });
    const promotion = promoteValidatedProcedure({ candidate, validationReport, now: 3002 });
    const memory = mergeValidatedProcedures(
      createEmptyAliceMemory(),
      [promotion.procedure],
      { now: '2026-04-28T12:00:00.000Z' },
    );

    expect(promotion.promoted).toBe(true);
    expect(memory.proceduralMemory.procedures).toHaveLength(1);
    expect(memory.proceduralMemory.procedures[0].title).toBe('Validar patch em VM local');
  });

  it('degrades bad learning and archives deprecated procedures after repeated failures', () => {
    const pruned = pruneOperationalLearning({
      procedures: [
        {
          procedureId: 'procedure:bad',
          status: 'active',
          confidence: 0.2,
          failureCount: 3,
        },
        {
          procedureId: 'procedure:old',
          status: 'deprecated',
          confidence: 0.1,
          failureCount: 4,
        },
      ],
      candidates: [
        { candidateId: 'candidate-bad', status: 'candidate', confidence: 0.05, failureCount: 3 },
      ],
      now: 3100,
    });

    expect(pruned.procedures[0].status).toBe('deprecated');
    expect(pruned.procedures[1].status).toBe('archived');
    expect(pruned.candidates).toHaveLength(0);
    expect(archiveDeprecatedProcedures({ procedures: pruned.procedures, now: 3101 })[1].status).toBe('archived');
  });

  it('detects project commands and keeps sensitive files out of playground selection', () => {
    const context = buildProjectContext({
      files: ['README.md', 'src/App.jsx', '.env', 'package.json', 'requirements.txt', 'tests/app.test.js'],
      packageJson: { scripts: { test: 'vitest run', build: 'vite build' } },
    });

    expect(context.languages).toContain('javascript');
    expect(context.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'test', command: 'npm' }),
      expect.objectContaining({ kind: 'build', command: 'npm' }),
    ]));
    expect(context.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'test', command: 'python' }),
    ]));
    expect(context.sensitiveFiles).toContain('.env');
    expect(context.highRiskFiles).toContain('src/App.jsx');
    expect(context.testFiles).toContain('tests/app.test.js');
    expect(context.configFiles).toContain('package.json');
    expect(selectFilesForPlayground({ files: context.files })).not.toContain('.env');
  });

  it('detects mixed projects and critical local data files', () => {
    const context = buildProjectContext({
      files: [
        'package.json',
        'src-tauri/Cargo.toml',
        'pyproject.toml',
        'service-account.json',
        'data/app.sqlite',
        'pnpm-lock.yaml',
      ],
      packageJson: {
        dependencies: { react: '^19.0.0', '@tauri-apps/api': '^2.0.0' },
        devDependencies: { vite: '^7.0.0' },
      },
    });

    expect(context.frameworks).toEqual(expect.arrayContaining(['react', 'vite', 'tauri', 'python', 'rust']));
    expect(context.lockfiles).toContain('pnpm-lock.yaml');
    expect(context.sensitiveFiles).toEqual(expect.arrayContaining(['service-account.json', 'data/app.sqlite']));
    expect(context.riskyFiles).toEqual(expect.arrayContaining(['service-account.json', 'data/app.sqlite']));
  });

  it('serializes and hydrates autonomous audit after reload', () => {
    const state = createEmptyAutonomousLearningState();
    const withLog = pauseBackgroundForUserRequest({
      ...state,
      procedures: [{ procedureId: 'procedure:ok', status: 'active', confidence: 0.9 }],
      pendingApprovals: [{ approvalId: 'approval-1', proposalId: 'proposal-1' }],
      risks: [{ riskId: 'risk-1', reason: 'risco', level: 'high' }],
      policyDecisions: [{ taskId: 'task-1', reason: 'allowed', allowed: true }],
    }, { userRequest: 'prioridade agora', now: 9000 }).state;
    const audit = serializeAutonomousStateForAudit(withLog, { now: '2026-04-28T12:00:00.000Z' });
    const hydrated = hydrateAutonomousStateFromAudit(audit);

    expect(audit.auditLogs).toHaveLength(1);
    expect(hydrated.logs[0].type).toBe('user_request_prioritized');
    expect(hydrated.procedures[0].procedureId).toBe('procedure:ok');
    expect(hydrated.pendingApprovals[0].approvalId).toBe('approval-1');
    expect(hydrated.risks[0].riskId).toBe('risk-1');
    expect(hydrated.policyDecisions[0].taskId).toBe('task-1');
  });

  it('shows VM, fallback, validation, research and rollback details in the HUD snapshot', () => {
    const snapshot = buildDebugHudSnapshot({
      autonomousLearningState: {
        ...createEmptyAutonomousLearningState(),
        vm: {
          ...createEmptyAutonomousLearningState().vm,
          provider: 'hyper_v',
          providerStatus: 'configured_not_ready',
          isRealVm: true,
          executionMode: 'real_vm',
          guestCommandReady: false,
          requiresUserSetup: true,
          setupReason: 'set_alice_local_vm_user_and_password',
          diagnostics: {
            selectedProvider: 'hyper_v',
            safeToRunGuestTasks: false,
          },
          smokeTest: {
            provider: 'hyper_v',
            skipped: true,
          },
          providers: [
            {
              provider: 'hyper_v',
              available: true,
              configured: true,
              ready: false,
              capabilities: { can_execute_command_in_guest: false },
              setupReason: 'set_alice_local_vm_user_and_password',
            },
          ],
        },
        validationReports: [{ validationId: 'validation-1', status: 'failed', reason: 'validation_missing_required_evidence' }],
        vmTaskRuns: [{ taskId: 'task-1', executionMode: 'real_vm', provider: 'hyper_v', ok: false }],
        researchRuns: [{ researchId: 'research-1', query: 'como testar', status: 'done', actionable: true }],
        rollbacks: [{ rollbackId: 'rollback-1', snapshotId: 'snapshot-1', status: 'done', reason: 'risk' }],
      },
      now: 10000,
    });

    expect(snapshot.autonomous.display.vmIsReal).toBe('sim');
    expect(snapshot.autonomous.display.guestCommandReady).toBe('nao');
    expect(snapshot.autonomous.display.providers).toContain('hyper_v');
    expect(snapshot.autonomous.display.vmDiagnostics).toContain('safeToRunGuestTasks');
    expect(snapshot.autonomous.display.vmSmokeTest).toContain('skipped');
    expect(snapshot.autonomous.display.validations).toContain('validation-1');
    expect(snapshot.autonomous.display.vmTaskRuns).toContain('task-1');
    expect(snapshot.autonomous.display.research).toContain('research-1');
    expect(snapshot.autonomous.display.rollbacks).toContain('snapshot-1');
  });
});

describe('autonomous learning tool executor', () => {
  it('records VM setup diagnostics without marking guest tasks ready when configuration is incomplete', async () => {
    const result = await executeAutonomousLearningFunctionCall({
      functionCall: {
        name: 'diagnose_local_vm_setup',
        args: {},
      },
      invokeTool: async () => ({
        ok: true,
        message: 'Diagnostico de VM local: provider ausente ou configuracao incompleta.',
        artifacts: {
          selectedProvider: 'hyper_v',
          safeToRunGuestTasks: false,
          selected: {
            provider: 'hyper_v',
            status: 'configured_not_ready',
            missingRequirements: ['set_alice_local_vm_user_and_password'],
            recommendedFix: 'Configure credenciais.',
            capabilities: { can_execute_command_in_guest: false },
          },
          providers: [
            {
              provider: 'hyper_v',
              status: 'configured_not_ready',
              ready: false,
              capabilities: { can_execute_command_in_guest: false },
            },
          ],
        },
      }),
      now: 5300,
    });

    expect(result.response.ok).toBe(true);
    expect(result.statePatch.vm.guestCommandReady).toBe(false);
    expect(result.statePatch.vm.providerStatus).toBe('configured_not_ready');
    expect(result.statePatch.logs.at(-1).type).toBe('local_vm_diagnostic_finished');
  });

  it('records VM smoke test as skipped when no real VM is configured', async () => {
    const result = await executeAutonomousLearningFunctionCall({
      functionCall: {
        name: 'run_local_vm_smoke_test',
        args: { timeoutMs: 1000 },
      },
      invokeTool: async (name, payload) => {
        expect(name).toBe('run_local_vm_smoke_test');
        expect(payload.request.timeoutMs).toBe(1000);
        return {
          ok: false,
          message: 'Smoke test ignorado: nenhuma VM local real configurada.',
          artifacts: {
            provider: 'none',
            smokeTest: true,
            skipped: true,
            guestCommandExecuted: false,
            requiresUserSetup: true,
            setupReason: 'local_vm_provider_not_configured',
          },
        };
      },
      now: 5310,
    });

    expect(result.response.ok).toBe(false);
    expect(result.response.smokeTest.skipped).toBe(true);
    expect(result.statePatch.vmTaskRuns[0].skipped).toBe(true);
    expect(result.statePatch.logs.at(-1).type).toBe('local_vm_smoke_test_skipped');
  });

  it('records Guest Interaction Layer visual actions with screenshot and replay evidence', async () => {
    const result = await executeAutonomousLearningFunctionCall({
      functionCall: {
        name: 'capture_vm_guest_screen',
        args: { timeoutMs: 1500 },
      },
      invokeTool: async (name, payload) => {
        expect(name).toBe('capture_vm_guest_screen');
        expect(payload.request.timeoutMs).toBe(1500);
        return {
          ok: true,
          message: 'Acao visual executada dentro da VM: capture_screen.',
          artifacts: {
            taskId: 'visual-task-1',
            correlationId: 'visual-replay-1',
            provider: 'virtualbox',
            vmName: 'AliceVM',
            guestAgentOnline: true,
            action: 'capture_screen',
            hostScreenshotPath: 'C:/Users/alice/AppData/Local/AliceVirtual/vm_visual_replays/visual-replay-1/screen.png',
            agentResponse: {
              success: true,
              result: {
                visual_context: {
                  screenshot_path: 'C:/Temp/screen.png',
                  active_window_title: 'Notepad',
                  detected_elements: [],
                },
              },
            },
          },
        };
      },
      now: 5320,
    });

    expect(result.response.ok).toBe(true);
    expect(result.statePatch.vm.visualAgent.online).toBe(true);
    expect(result.statePatch.vm.visualAgent.lastScreenshotPath).toContain('screen.png');
    expect(result.statePatch.visualExecutions[0].action).toBe('capture_screen');
    expect(result.statePatch.visualReplays[0].replayId).toBe('visual-replay-1');
    expect(result.statePatch.logs.at(-1).type).toBe('vm_visual_action_finished');
  });

  it('executes high-level VM operational install tasks through agent background actions', async () => {
    const calls = [];
    const invokeTool = async (name, payload) => {
      calls.push([name, payload]);
      if (name === 'diagnose_vm_guest_agent') {
        return {
          ok: true,
          message: 'Agente online.',
          artifacts: {
            guestAgentOnline: true,
            capabilities: { can_run_background_command: true },
          },
        };
      }
      if (name === 'run_vm_guest_agent_action' && payload.request.action === 'start_background_command') {
        return {
          ok: true,
          message: 'Background iniciado.',
          artifacts: {
            taskId: payload.request.taskId,
            provider: 'virtualbox',
            vmName: 'AliceVM',
            action: 'start_background_command',
          },
        };
      }
      if (name === 'run_vm_guest_agent_action' && payload.request.action === 'get_background_command_status') {
        return {
          ok: true,
          message: 'Status carregado.',
          artifacts: {
            agentResponse: {
              result: {
                status: 'running',
                background_task_id: payload.request.parameters.background_task_id,
              },
            },
          },
        };
      }
      throw new Error(`unexpected tool ${name}`);
    };

    const result = await executeAutonomousLearningFunctionCall({
      functionCall: {
        name: 'run_vm_operational_task',
        args: {
          objective: 'baixe o Visual Studio na VM',
          taskKind: 'install_app',
        },
      },
      invokeTool,
      now: 5330,
    });

    const startCall = calls.find(
      ([name, payload]) =>
        name === 'run_vm_guest_agent_action' &&
        payload.request.action === 'start_background_command',
    );

    expect(result.response.ok).toBe(true);
    expect(result.response.plan.kind).toBe('install_app');
    expect(result.response.plan.backgroundTaskId).toContain('visual-studio-community-2022');
    expect(result.response.nextAction).toContain('check_background_task');
    expect(startCall[1].request.parameters.command).toBe('winget.exe');
    expect(startCall[1].request.parameters.args).toEqual(expect.arrayContaining([
      'Microsoft.VisualStudio.2022.Community',
    ]));
    expect(result.statePatch.visualExecutions[0]).toMatchObject({
      toolName: 'run_vm_operational_task',
      action: 'install_app',
      ok: true,
      provider: 'virtualbox',
    });
    expect(result.statePatch.logs.at(-1).type).toBe('vm_operational_task_finished');
  });

  it('opens Notepad and types requested text through official VM operational flow', async () => {
    const calls = [];
    const invokeTool = async (name, payload) => {
      calls.push([name, payload]);
      if (name === 'diagnose_vm_guest_agent') {
        return {
          ok: true,
          message: 'Agente online.',
          artifacts: {
            guestAgentOnline: true,
            capabilities: { can_keyboard: true, can_run_command: true },
          },
        };
      }
      if (name === 'run_vm_guest_agent_action' && payload.request.action === VM_VISUAL_ACTIONS.RUN_COMMAND) {
        return {
          ok: true,
          message: 'Notepad aberto.',
          artifacts: {
            taskId: 'open-notepad',
            provider: 'virtualbox',
            vmName: 'AliceVM',
            action: VM_VISUAL_ACTIONS.RUN_COMMAND,
          },
        };
      }
      if (name === 'run_vm_guest_agent_action' && payload.request.action === VM_VISUAL_ACTIONS.WAIT) {
        return { ok: true, message: 'Aguardou.', artifacts: { action: VM_VISUAL_ACTIONS.WAIT } };
      }
      if (name === 'run_vm_guest_agent_action' && payload.request.action === VM_VISUAL_ACTIONS.TYPE_TEXT) {
        return {
          ok: true,
          message: 'Texto digitado.',
          artifacts: {
            action: VM_VISUAL_ACTIONS.TYPE_TEXT,
            agentResponse: { result: { text_length: payload.request.parameters.text.length } },
          },
        };
      }
      throw new Error(`unexpected tool ${name}`);
    };

    const result = await executeAutonomousLearningFunctionCall({
      functionCall: {
        name: 'run_vm_operational_task',
        args: {
          objective: 'abra o bloco de notas e escreva alice teste na VM',
        },
      },
      invokeTool,
      now: 5340,
    });

    const typeCall = calls.find(
      ([name, payload]) =>
        name === 'run_vm_guest_agent_action' &&
        payload.request.action === VM_VISUAL_ACTIONS.TYPE_TEXT,
    );

    expect(result.response.ok).toBe(true);
    expect(typeCall[1].request.parameters).toEqual({ text: 'alice teste', method: 'auto' });
    expect(result.response.followUpResults).toHaveLength(2);
    expect(result.statePatch.visualExecutions[0]).toMatchObject({
      toolName: 'run_vm_operational_task',
      action: 'open_app',
      ok: true,
      appName: 'Bloco de Notas',
    });
  });

  it('plans a playground task and exposes fallback workspace, policy and logs', async () => {
    const result = await executeAutonomousLearningFunctionCall({
      functionCall: {
        name: 'plan_autonomous_task',
        args: {
          taskType: TASK_TYPES.VM_EXPERIMENT,
          reason: 'testar script em copia',
          environment: ENVIRONMENT_TYPES.LOCAL_VM_PLAYGROUND,
          sourceFiles: [{ path: 'src/App.jsx', sizeBytes: 100 }],
        },
      },
      now: 4000,
    });

    expect(result.handled).toBe(true);
    expect(result.response.ok).toBe(true);
    expect(result.response.workspacePlan.ok).toBe(true);
    expect(result.statePatch.logs.some((event) => event.type === 'task_created')).toBe(true);
  });

  it('materializes a workspace fallback task through the native controlled runner when command is provided', async () => {
    const calls = [];
    const invokeTool = async (name, payload) => {
      calls.push([name, payload]);
      return {
        ok: true,
          message: 'Tarefa concluida no workspace local fallback.',
        stdout: 'ok from copy',
        stderr: '',
        artifacts: {
          statusCode: 0,
          workspacePath: 'C:/Users/dev/AppData/Roaming/alice/autonomous-playground/workspaces/task-1',
          copyManifest: [{ sourcePath: null, workspacePath: 'workspace/input/check.js', mode: 'inline_copy' }],
        },
      };
    };

    const result = await executeAutonomousLearningFunctionCall({
      functionCall: {
        name: 'plan_autonomous_task',
        args: {
          taskType: TASK_TYPES.VM_EXPERIMENT,
          reason: 'rodar teste em workspace copiado',
          environment: ENVIRONMENT_TYPES.LOCAL_VM_PLAYGROUND,
          sourceFiles: [{ content: 'console.log("ok")', targetPath: 'check.js' }],
          command: 'node',
          args: ['check.js'],
          timeoutMs: 5000,
        },
      },
      invokeTool,
      now: 4500,
    });

    expect(calls.some((call) => call[0] === 'get_local_vm_status')).toBe(true);
    expect(calls.some((call) => call[0] === 'run_local_workspace_playground_task')).toBe(true);
    const runCall = calls.find((call) => call[0] === 'run_local_workspace_playground_task');
    expect(runCall[1].request).toMatchObject({
      command: 'node',
      args: ['check.js'],
      timeoutMs: 5000,
    });
    expect(result.response.playgroundRun.ok).toBe(true);
    expect(result.response.validationReport.passed).toBe(true);
    expect(result.response.task.status).toBe(TASK_STATUSES.DONE);
    expect(result.statePatch.tasks.find((task) => task.taskId === result.response.task.taskId).status).toBe(
      TASK_STATUSES.DONE,
    );
    expect(result.statePatch.vm.status).toBe('active');
    expect(result.statePatch.logs.some((event) => event.type === 'workspace_fallback_task_finished')).toBe(true);
    expect(result.statePatch.logs.at(-1).type).toBe('task_finished');
  });

  it('blocks real VM guest execution clearly when provider is configured but guest runner is not ready', async () => {
    const calls = [];
    const invokeTool = async (name, payload) => {
      calls.push([name, payload]);
      if (name === 'get_local_vm_status') {
        return {
          ok: true,
          artifacts: {
            provider: 'hyper_v',
            realVmAvailable: true,
            guestCommandReady: false,
            setupReason: 'set_alice_local_vm_user_and_password',
            providers: [
              {
                name: 'hyper_v',
                available: true,
                configured: true,
                ready: false,
                setupReason: 'set_alice_local_vm_user_and_password',
                capabilities: { can_execute_command_in_guest: false },
              },
            ],
          },
        };
      }

      return {
        ok: false,
        message: 'VM local real detectada, mas guest command nao esta pronto.',
        artifacts: {
          provider: 'hyper_v',
          executionMode: 'real_vm',
          guestCommandExecuted: false,
          requiresUserSetup: true,
        },
      };
    };

    const result = await executeAutonomousLearningFunctionCall({
      functionCall: {
        name: 'plan_autonomous_task',
        args: {
          taskType: TASK_TYPES.VM_EXPERIMENT,
          reason: 'rodar teste isolado',
          environment: ENVIRONMENT_TYPES.LOCAL_VM_PLAYGROUND,
          sourceFiles: [{ content: 'print("ok")', targetPath: 'check.py' }],
          command: 'python',
          args: ['check.py'],
        },
      },
      invokeTool,
      now: 4550,
    });

    expect(calls.some((call) => call[0] === 'run_local_vm_guest_task')).toBe(true);
    expect(calls.some((call) => call[0] === 'run_local_workspace_playground_task')).toBe(false);
    expect(result.response.workspacePlan).toBeNull();
    expect(result.response.ok).toBe(false);
    expect(result.response.task.status).toBe(TASK_STATUSES.FAILED);
    expect(result.response.playgroundRun.artifacts.guestCommandExecuted).toBe(false);
    expect(result.statePatch.vm.executionMode).toBe('real_vm');
    expect(result.statePatch.logs.some((event) => event.type === 'real_vm_guest_task_blocked_or_failed')).toBe(true);
    expect(result.statePatch.logs.at(-1).type).toBe('task_failed');
  });

  it('rejects self-improvement proposals without separate patch and validation', async () => {
    const missingPatch = await executeAutonomousLearningFunctionCall({
      functionCall: {
        name: 'create_self_improvement_proposal',
        args: {
          title: 'Sem patch',
          validationReport: { passed: true },
        },
      },
      now: 4560,
    });
    const missingValidation = await executeAutonomousLearningFunctionCall({
      functionCall: {
        name: 'create_self_improvement_proposal',
        args: {
          title: 'Sem validacao',
          patch: 'diff --git a/src/a.js b/src/a.js',
          validationReport: { passed: false },
        },
      },
      now: 4561,
    });

    expect(missingPatch.response.ok).toBe(false);
    expect(missingPatch.response.reason).toBe('self_improvement_requires_separate_patch');
    expect(missingValidation.response.ok).toBe(false);
    expect(missingValidation.response.reason).toBe('self_improvement_requires_validated_patch');
  });

  it('creates and approves a self-improvement proposal only after explicit user approval', async () => {
    const validationReport = evaluateValidationPipeline({
      checks: [
        { type: 'functional', label: 'functional', passed: true, evidence: 'patch aplicado em copia' },
        { type: 'impact', label: 'impact', passed: true, evidence: 'sem escrita no codigo oficial' },
      ],
      requiredEvidence: ['functional', 'impact'],
      now: 4562,
    });
    const created = await executeAutonomousLearningFunctionCall({
      functionCall: {
        name: 'create_self_improvement_proposal',
        args: {
          title: 'Melhorar validacao',
          affectedFiles: ['src/autonomousLearning/validation.js'],
          patch: 'diff --git a/src/autonomousLearning/validation.js b/src/autonomousLearning/validation.js',
          validationReport,
        },
      },
      now: 4563,
    });
    const proposalId = created.response.proposal.proposalId;
    const approved = await executeAutonomousLearningFunctionCall({
      functionCall: {
        name: 'approve_self_improvement_proposal',
        args: {
          proposalId,
          userApproved: true,
        },
      },
      autonomousState: created.statePatch,
      now: 4564,
    });

    expect(created.response.ok).toBe(true);
    expect(created.statePatch.pendingApprovals[0].proposalId).toBe(proposalId);
    expect(approved.response.ok).toBe(true);
    expect(approved.response.proposal.status).toBe('approved_ready_to_apply');
  });

  it('creates a physical host snapshot through the native runtime before real PC changes', async () => {
    const calls = [];
    const invokeTool = async (name, payload) => {
      calls.push([name, payload]);
      return {
        ok: true,
        message: 'Snapshot fisico do PC real criado.',
        artifacts: {
          snapshotId: 'snapshot-1',
          manifest: { entries: [{ path: 'src/App.jsx', contentHash: 'hash' }] },
        },
      };
    };

    const result = await executeAutonomousLearningFunctionCall({
      functionCall: {
        name: 'create_host_change_snapshot',
        args: {
          actionId: 'change-1',
          taskId: 'task-change-1',
          files: ['src/App.jsx'],
          reason: 'alteracao real',
          declaredFiles: ['src/App.jsx'],
          plannedOperations: [{ file: 'src/App.jsx', operation: 'modify' }],
        },
      },
      invokeTool,
      now: 4600,
    });

    expect(calls[0][0]).toBe('create_host_file_snapshot');
    expect(calls[0][1].request.files).toEqual(['src/App.jsx']);
    expect(calls[0][1].request.taskId).toBe('task-change-1');
    expect(calls[0][1].request.plannedOperations[0]).toEqual({ file: 'src/App.jsx', operation: 'modify' });
    expect(result.response.ok).toBe(true);
    expect(result.statePatch.rollbacks[0].status).toBe('ready');
  });

  it('records physical checkpoints for controlled host writes', async () => {
    const calls = [];
    const result = await executeAutonomousLearningFunctionCall({
      functionCall: {
        name: 'record_host_file_checkpoint',
        args: {
          snapshotId: 'snapshot-1',
          file: 'src/App.jsx',
          stage: 'after_controlled_write',
          taskId: 'task-change-1',
          operation: 'modify',
        },
      },
      invokeTool: async (name, payload) => {
        calls.push([name, payload]);
        return {
          ok: true,
          message: 'Checkpoint fisico registrado para o rollback.',
          artifacts: {
            checkpoint: { stage: 'after_controlled_write', contentHash: 'hash-after' },
          },
        };
      },
      now: 4610,
    });

    expect(calls[0][0]).toBe('record_host_file_checkpoint');
    expect(calls[0][1].request).toMatchObject({
      snapshotId: 'snapshot-1',
      file: 'src/App.jsx',
      stage: 'after_controlled_write',
    });
    expect(result.response.ok).toBe(true);
    expect(result.statePatch.logs.at(-1).type).toBe('host_checkpoint_recorded');
  });

  it('uses physical rollback when unexpected risk includes snapshot id', async () => {
    const calls = [];
    const invokeTool = async (name, payload) => {
      calls.push([name, payload]);
      return {
        ok: true,
        message: 'Rollback fisico restaurou os arquivos do PC real.',
        artifacts: {
          rollbackId: 'rollback-1',
          restored: [{
            path: 'src/App.jsx',
            verified: true,
            divergenceClassification: 'conflict_after_apply_before_rollback',
            conflictBackupPath: 'snapshots/conflicts/src-App.jsx',
          }],
          conflictBackups: [{ path: 'src/App.jsx', backupPath: 'snapshots/conflicts/src-App.jsx' }],
          hasExternalOrUnknownChanges: true,
        },
      };
    };

    const result = await executeAutonomousLearningFunctionCall({
      functionCall: {
        name: 'report_unexpected_risk',
        args: {
          actionId: 'change-1',
          snapshotId: 'snapshot-1',
          reason: 'risco inesperado',
        },
      },
      invokeTool,
      now: 4700,
    });

    expect(calls[0][0]).toBe('restore_host_file_snapshot');
    expect(calls[0][1].request.snapshotId).toBe('snapshot-1');
    expect(result.response.ok).toBe(true);
    expect(result.statePatch.rollbacks[0].status).toBe('done');
    expect(result.statePatch.rollbacks[0].artifacts.hasExternalOrUnknownChanges).toBe(true);
  });

  it('records validated learning and returns procedures for official memory persistence', async () => {
    const result = await executeAutonomousLearningFunctionCall({
      functionCall: {
        name: 'record_validated_learning',
        args: {
          title: 'Checar rollback antes de aplicar',
          steps: ['criar snapshot', 'validar', 'aplicar com rollback'],
          validationChecks: [
            { type: 'functional', label: 'functional', passed: true, evidence: 'ok' },
            { type: 'impact', label: 'impact', passed: true, evidence: 'sem impacto fora da memoria procedural' },
          ],
          requiredEvidence: ['functional', 'impact'],
        },
      },
      now: 5000,
    });

    expect(result.response.ok).toBe(true);
    expect(result.memoryProcedures).toHaveLength(1);
    expect(result.statePatch.procedures).toHaveLength(1);
  });
});
