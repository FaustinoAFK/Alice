import {
  ENVIRONMENT_TYPES,
  EXECUTION_MODES,
  PLAYGROUND_EXECUTION_MODES,
  RISK_LEVELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  appendAutonomousLog,
  approveImprovementProposal,
  buildProjectContext,
  completeAutonomousTask,
  createActionableResearchCycle,
  createBehaviorContext,
  createChangeSnapshot,
  createDecisionEngineInput,
  createEmptyAutonomousLearningState,
  createImprovementProposal,
  createInternalStateSnapshot,
  createProcedureCandidate,
  createTurnContext,
  evaluateValidationPipeline,
  mergeAutonomousLearningState,
  normalizeVmStatus,
  preparePlaygroundExecution,
  createVmOperationalTaskPlan,
  promoteValidatedProcedure,
  recordUnexpectedRiskAndRollback,
  routeAutonomousTask,
  runUserPriorityHooks,
  summarizeAutonomousState,
} from './autonomousLearning';

export const AUTONOMOUS_LEARNING_TOOL_NAMES = [
  'get_autonomous_learning_status',
  'diagnose_local_vm_setup',
  'run_local_vm_smoke_test',
  'install_vm_guest_agent',
  'diagnose_vm_guest_agent',
  'capture_vm_guest_screen',
  'run_vm_guest_agent_action',
  'run_vm_visual_smoke_test',
  'run_vm_operational_task',
  'plan_autonomous_task',
  'create_host_change_snapshot',
  'record_host_file_checkpoint',
  'create_self_improvement_proposal',
  'approve_self_improvement_proposal',
  'record_validated_learning',
  'record_research_finding',
  'inspect_project_context',
  'report_unexpected_risk',
];

export const isAutonomousLearningToolName = (toolName) =>
  AUTONOMOUS_LEARNING_TOOL_NAMES.includes(toolName);

const normalizeToolString = (value, fallback = '') => String(value || fallback).trim();

const getRuntimeVmStatus = async ({ invokeTool, fallbackStatus }) => {
  if (typeof invokeTool !== 'function') {
    return normalizeVmStatus(fallbackStatus);
  }

  try {
    const status = await invokeTool('get_local_vm_status');
    return normalizeVmStatus(status?.artifacts || status);
  } catch {
    return normalizeVmStatus(fallbackStatus);
  }
};

const buildDefaultValidationChecks = ({ run, executionMode }) => [
  {
    type: 'functional',
    label: 'functional',
    passed: Boolean(run?.ok && (run.stdout || run.stderr || run.artifacts)),
    evidence: run?.stdout || run?.stderr || run?.message || '',
  },
  {
    type: 'impact',
    label: 'impact',
    passed: executionMode !== PLAYGROUND_EXECUTION_MODES.UNAVAILABLE,
    evidence:
      executionMode === PLAYGROUND_EXECUTION_MODES.REAL_VM
        ? 'execucao ocorreu em VM local real configurada'
        : 'execucao limitada ao workspace local fallback com copias',
  },
];

export const executeAutonomousLearningFunctionCall = async ({
  functionCall,
  autonomousState = createEmptyAutonomousLearningState(),
  activeMindMap = null,
  autonomousRunnerSummary = null,
  trustedUtterance = '',
  invokeTool = null,
  now = Date.now(),
} = {}) => {
  const toolName = functionCall?.name || '';
  const args = functionCall?.args || {};
  const turnContext = createTurnContext({
    userUtterance: trustedUtterance,
    toolName,
    toolArgs: args,
    now,
  });

  if (!isAutonomousLearningToolName(toolName)) {
    return {
      handled: false,
      toolName,
      response: null,
      statePatch: null,
      memoryProcedures: [],
    };
  }

  switch (toolName) {
    case 'get_autonomous_learning_status': {
      const vmStatus = await getRuntimeVmStatus({ invokeTool, fallbackStatus: autonomousState.vm });
      const nextState = mergeAutonomousLearningState(autonomousState, { vm: { ...autonomousState.vm, ...vmStatus } });

      return {
        handled: true,
        toolName,
        response: {
          ok: true,
          message: 'Estado operacional autonomo carregado.',
          summary: summarizeAutonomousState(nextState),
          vmStatus,
          logs: nextState.logs.slice(-8),
        },
        statePatch: nextState,
        memoryProcedures: [],
      };
    }

    case 'diagnose_local_vm_setup': {
      if (typeof invokeTool !== 'function') {
        return {
          handled: true,
          toolName,
          response: {
            ok: false,
            message: 'Diagnostico de VM local exige runtime desktop Tauri.',
          },
          statePatch: null,
          memoryProcedures: [],
        };
      }

      const diagnosis = await invokeTool('diagnose_local_vm_setup');
      const artifacts = diagnosis?.artifacts || {};
      const nextState = appendAutonomousLog(
        mergeAutonomousLearningState(autonomousState, {
          vm: {
            ...autonomousState.vm,
            diagnostics: artifacts,
            provider: artifacts.selected?.provider || autonomousState.vm.provider,
            providerStatus: artifacts.selected?.status || autonomousState.vm.providerStatus,
            guestCommandReady: Boolean(artifacts.safeToRunGuestTasks),
            requiresUserSetup: !artifacts.safeToRunGuestTasks,
            setupReason:
              artifacts.selected?.missingRequirements?.join(',') ||
              artifacts.selected?.lastError ||
              autonomousState.vm.setupReason,
            providers: artifacts.providers || autonomousState.vm.providers,
            activeProviderCapabilities: artifacts.selected?.capabilities || autonomousState.vm.activeProviderCapabilities,
            lastHealthCheck: now,
          },
          hostResourceEvents: [
            ...(autonomousState.hostResourceEvents || []),
            {
              eventId: `vm-diagnostic-${now}`,
              kind: 'vm_diagnostic',
              provider: artifacts.selectedProvider || artifacts.selected?.provider || 'none',
              safeToRunGuestTasks: Boolean(artifacts.safeToRunGuestTasks),
              createdAt: now,
            },
          ],
        }),
        'local_vm_diagnostic_finished',
        {
          provider: artifacts.selectedProvider || artifacts.selected?.provider || 'none',
          ready: Boolean(artifacts.safeToRunGuestTasks),
          reason: artifacts.selected?.recommendedFix || diagnosis?.message || '',
        },
        { now },
      );

      return {
        handled: true,
        toolName,
        response: {
          ok: Boolean(diagnosis?.ok),
          message: diagnosis?.message || 'Diagnostico de VM local concluido.',
          diagnosis: artifacts,
        },
        statePatch: nextState,
        memoryProcedures: [],
      };
    }

    case 'run_local_vm_smoke_test': {
      if (typeof invokeTool !== 'function') {
        return {
          handled: true,
          toolName,
          response: {
            ok: false,
            message: 'Smoke test de VM local exige runtime desktop Tauri.',
          },
          statePatch: null,
          memoryProcedures: [],
        };
      }

      const smoke = await invokeTool('run_local_vm_smoke_test', {
        request: {
          timeoutMs: args.timeoutMs,
        },
      });
      const artifacts = smoke?.artifacts || {};
      const nextState = appendAutonomousLog(
        mergeAutonomousLearningState(autonomousState, {
          vm: {
            ...autonomousState.vm,
            smokeTest: artifacts,
            provider: artifacts.provider || autonomousState.vm.provider,
            guestCommandReady: Boolean(smoke?.ok && !artifacts.skipped),
            requiresUserSetup: Boolean(artifacts.requiresUserSetup),
            setupReason: artifacts.setupReason || autonomousState.vm.setupReason,
            lastHealthCheck: now,
          },
          vmTaskRuns: [
            ...(autonomousState.vmTaskRuns || []),
            {
              taskId: artifacts.taskId || `vm-smoke-${now}`,
              executionMode: artifacts.executionMode || 'real_vm',
              provider: artifacts.provider || 'none',
              ok: Boolean(smoke?.ok),
              skipped: Boolean(artifacts.skipped),
              artifacts,
              createdAt: now,
            },
          ],
        }),
        artifacts.skipped
          ? 'local_vm_smoke_test_skipped'
          : smoke?.ok
            ? 'local_vm_smoke_test_passed'
            : 'local_vm_smoke_test_failed',
        {
          provider: artifacts.provider || 'none',
          reason: smoke?.message || artifacts.setupReason || '',
        },
        { now },
      );

      return {
        handled: true,
        toolName,
        response: {
          ok: Boolean(smoke?.ok),
          message: smoke?.message || 'Smoke test de VM local concluido.',
          smokeTest: artifacts,
          stdout: smoke?.stdout || '',
          stderr: smoke?.stderr || '',
        },
        statePatch: nextState,
        memoryProcedures: [],
      };
    }

    case 'install_vm_guest_agent':
    case 'diagnose_vm_guest_agent':
    case 'capture_vm_guest_screen':
    case 'run_vm_guest_agent_action':
    case 'run_vm_visual_smoke_test': {
      if (typeof invokeTool !== 'function') {
        return {
          handled: true,
          toolName,
          response: {
            ok: false,
            message: 'Guest Interaction Layer exige runtime desktop Tauri.',
          },
          statePatch: null,
          memoryProcedures: [],
        };
      }

      const nativeName = toolName;
      const nativeArgs =
        toolName === 'install_vm_guest_agent'
          ? { request: { timeoutMs: args.timeoutMs } }
          : toolName === 'run_vm_guest_agent_action'
            ? {
                request: {
                  action: args.action,
                  parameters: args.parameters || {},
                  timeoutMs: args.timeoutMs,
                  taskId: args.taskId,
                  correlationId: args.correlationId,
                },
              }
            : toolName === 'run_vm_visual_smoke_test'
              ? { request: { timeoutMs: args.timeoutMs } }
              : toolName === 'capture_vm_guest_screen'
                ? { request: { timeoutMs: args.timeoutMs } }
                : {};
      const nativeResult = await invokeTool(nativeName, nativeArgs);
      const artifacts = nativeResult?.artifacts || {};
      const agentResponse = artifacts.agentResponse || {};
      const visualContext =
        agentResponse?.result?.visual_context ||
        agentResponse?.result?.capture?.visual_context ||
        null;
      const replayId = artifacts.replayId || artifacts.correlationId || artifacts.taskId || '';
      const visualExecution = {
        executionId: artifacts.taskId || `vm-visual-${now}`,
        toolName,
        action: artifacts.action || args.action || toolName,
        ok: Boolean(nativeResult?.ok),
        provider: artifacts.provider || 'none',
        vmName: artifacts.vmName || '',
        hostScreenshotPath: artifacts.hostScreenshotPath || '',
        guestScreenshotPath: artifacts.guestScreenshotPath || '',
        replayId,
        validation: artifacts.validation || null,
        createdAt: now,
      };
      const nextState = appendAutonomousLog(
        mergeAutonomousLearningState(autonomousState, {
          vm: {
            ...autonomousState.vm,
            visualAgent: {
              ...(autonomousState.vm?.visualAgent || {}),
              online: Boolean(artifacts.guestAgentOnline || nativeResult?.ok),
              status: nativeResult?.ok ? 'online' : 'error',
              capabilities: artifacts.capabilities || agentResponse?.result?.capabilities || autonomousState.vm?.visualAgent?.capabilities || {},
              lastError: nativeResult?.ok ? '' : nativeResult?.message || artifacts.error || '',
              lastScreenshotPath: artifacts.hostScreenshotPath || autonomousState.vm?.visualAgent?.lastScreenshotPath || '',
              lastReplayId: replayId || autonomousState.vm?.visualAgent?.lastReplayId || '',
              lastAction: visualExecution.action,
              lastValidation: artifacts.validation?.passed === true ? 'passed' : artifacts.validation?.passed === false ? 'failed' : '',
            },
            lastHealthCheck: now,
          },
          visualExecutions: [
            ...(autonomousState.visualExecutions || []),
            visualExecution,
          ],
          visualReplays: replayId
            ? [
                ...(autonomousState.visualReplays || []),
                {
                  replayId,
                  taskId: artifacts.taskId || '',
                  status: nativeResult?.ok ? 'done' : 'failed',
                  hostScreenshotPath: artifacts.hostScreenshotPath || '',
                  validation: artifacts.validation || null,
                  visualContext,
                  createdAt: now,
                },
              ]
            : autonomousState.visualReplays || [],
        }),
        nativeResult?.ok ? 'vm_visual_action_finished' : 'vm_visual_action_failed',
        {
          toolName,
          action: visualExecution.action,
          provider: visualExecution.provider,
          replayId,
          reason: nativeResult?.message || '',
        },
        { now },
      );

      return {
        handled: true,
        toolName,
        response: {
          ok: Boolean(nativeResult?.ok),
          message: nativeResult?.message || 'Acao visual da VM concluida.',
          artifacts,
          stdout: nativeResult?.stdout || '',
          stderr: nativeResult?.stderr || '',
        },
        statePatch: nextState,
        memoryProcedures: [],
      };
    }

    case 'run_vm_operational_task': {
      if (typeof invokeTool !== 'function') {
        return {
          handled: true,
          toolName,
          response: {
            ok: false,
            message: 'Tarefa operacional na VM exige runtime desktop Tauri.',
          },
          statePatch: null,
          memoryProcedures: [],
        };
      }

      const plan = createVmOperationalTaskPlan({
        objective: args.objective || trustedUtterance,
        taskKind: args.taskKind,
        appName: args.appName,
        command: args.command,
        args: args.args || [],
        textToType: args.textToType || args.text,
        url: args.url,
        backgroundTaskId: args.backgroundTaskId,
        timeoutMs: args.timeoutMs,
      });

      if (!plan.ok) {
        const nextState = appendAutonomousLog(
          autonomousState,
          'vm_operational_task_blocked',
          {
            reason: plan.reason,
            objective: args.objective || trustedUtterance,
          },
          { now },
        );
        return {
          handled: true,
          toolName,
          response: {
            ok: false,
            message: plan.message,
            reason: plan.reason,
            plan,
          },
          statePatch: nextState,
          memoryProcedures: [],
        };
      }

      const ensureSteps = [];
      let agentReady = false;
      let diagnosis = null;
      let install = null;

      diagnosis = await invokeTool('diagnose_vm_guest_agent');
      ensureSteps.push({
        step: 'diagnose_vm_guest_agent',
        ok: Boolean(diagnosis?.ok),
        message: diagnosis?.message || '',
      });
      agentReady = Boolean(diagnosis?.ok);

      if (!agentReady) {
        install = await invokeTool('install_vm_guest_agent', {
          request: { timeoutMs: Math.max(30000, Number(args.timeoutMs || 60000)) },
        });
        ensureSteps.push({
          step: 'install_vm_guest_agent',
          ok: Boolean(install?.ok),
          message: install?.message || '',
        });
        if (install?.ok) {
          diagnosis = await invokeTool('diagnose_vm_guest_agent');
          ensureSteps.push({
            step: 'diagnose_vm_guest_agent_after_install',
            ok: Boolean(diagnosis?.ok),
            message: diagnosis?.message || '',
          });
          agentReady = Boolean(diagnosis?.ok);
        }
      }

      if (!agentReady) {
        const nextState = appendAutonomousLog(
          mergeAutonomousLearningState(autonomousState, {
            vm: {
              ...autonomousState.vm,
              visualAgent: {
                ...(autonomousState.vm?.visualAgent || {}),
                online: false,
                status: 'offline',
                lastError: diagnosis?.message || install?.message || 'guest_agent_not_ready',
              },
            },
          }),
          'vm_operational_task_blocked_agent_unavailable',
          {
            objective: args.objective || trustedUtterance,
            reason: diagnosis?.message || install?.message || 'guest_agent_not_ready',
          },
          { now },
        );
        return {
          handled: true,
          toolName,
          response: {
            ok: false,
            message:
              diagnosis?.message ||
              install?.message ||
              'Agente da VM indisponivel; a tarefa operacional foi bloqueada.',
            plan,
            ensureSteps,
          },
          statePatch: nextState,
          memoryProcedures: [],
        };
      }

      const nativeResult = await invokeTool(plan.nativeTool, plan.nativeArgs);
      const followUpResults = [];
      if (nativeResult?.ok && Array.isArray(plan.followUpActions)) {
        for (const followUpAction of plan.followUpActions) {
          const followUpResult = await invokeTool('run_vm_guest_agent_action', {
            request: {
              action: followUpAction.action,
              parameters: followUpAction.parameters || {},
              timeoutMs: followUpAction.timeoutMs || args.timeoutMs || 15000,
              taskId: `${plan.kind}-${followUpAction.action}-${now}`,
              correlationId: `${plan.kind}-${followUpAction.action}-${now}`,
            },
          });
          followUpResults.push(followUpResult);
          if (!followUpResult?.ok) {
            break;
          }
        }
      }
      const followUpsOk = followUpResults.every((result) => result?.ok);
      const finalOk = Boolean(nativeResult?.ok) && followUpsOk;
      let backgroundStatus = null;
      if (finalOk && plan.backgroundTaskId && plan.kind === 'install_app') {
        try {
          backgroundStatus = await invokeTool('run_vm_guest_agent_action', {
            request: {
              action: 'get_background_command_status',
              parameters: { background_task_id: plan.backgroundTaskId },
              timeoutMs: 15000,
              taskId: plan.backgroundTaskId,
              correlationId: plan.backgroundTaskId,
            },
          });
        } catch (error) {
          backgroundStatus = {
            ok: false,
            message: error?.message || String(error),
          };
        }
      }

      const artifacts = nativeResult?.artifacts || {};
      const statusArtifacts = backgroundStatus?.artifacts || {};
      const visualExecution = {
        executionId: artifacts.taskId || plan.backgroundTaskId || `vm-operational-${now}`,
        toolName,
        action: plan.kind,
        ok: finalOk,
        provider: artifacts.provider || statusArtifacts.provider || 'virtualbox',
        vmName: artifacts.vmName || statusArtifacts.vmName || '',
        hostScreenshotPath: artifacts.hostScreenshotPath || '',
        guestScreenshotPath: artifacts.guestScreenshotPath || '',
        replayId: artifacts.replayId || artifacts.correlationId || '',
        validation: artifacts.validation || null,
        backgroundTaskId: plan.backgroundTaskId,
        appName: plan.app?.displayName || args.appName || '',
        createdAt: now,
      };
      const nextState = appendAutonomousLog(
        mergeAutonomousLearningState(autonomousState, {
          vm: {
            ...autonomousState.vm,
            visualAgent: {
              ...(autonomousState.vm?.visualAgent || {}),
              online: Boolean(agentReady || finalOk),
              status: finalOk ? 'online' : 'error',
              capabilities:
                diagnosis?.artifacts?.capabilities ||
                artifacts.capabilities ||
                autonomousState.vm?.visualAgent?.capabilities ||
                {},
              lastError: finalOk ? '' : followUpResults.find((result) => !result?.ok)?.message || nativeResult?.message || '',
              lastScreenshotPath:
                artifacts.hostScreenshotPath ||
                autonomousState.vm?.visualAgent?.lastScreenshotPath ||
                '',
              lastAction: plan.kind,
            },
            lastHealthCheck: now,
          },
          visualExecutions: [
            ...(autonomousState.visualExecutions || []),
            visualExecution,
          ],
          vmTaskRuns: plan.backgroundTaskId
            ? [
                ...(autonomousState.vmTaskRuns || []),
                {
                  taskId: plan.backgroundTaskId,
                  executionMode: 'real_vm',
                  provider: visualExecution.provider,
                  ok: finalOk,
                  artifacts: {
                    plan,
                    start: artifacts,
                    followUps: followUpResults.map((result) => result?.artifacts || result),
                    status: statusArtifacts,
                  },
                  createdAt: now,
                },
              ]
            : autonomousState.vmTaskRuns || [],
        }),
        finalOk ? 'vm_operational_task_finished' : 'vm_operational_task_failed',
        {
          objective: args.objective || trustedUtterance,
          kind: plan.kind,
          appName: plan.app?.displayName || args.appName || '',
          backgroundTaskId: plan.backgroundTaskId,
          reason: followUpResults.find((result) => !result?.ok)?.message || nativeResult?.message || '',
        },
        { now },
      );

      return {
        handled: true,
        toolName,
        response: {
          ok: finalOk,
          message: finalOk
            ? plan.message
            : followUpResults.find((result) => !result?.ok)?.message ||
              nativeResult?.message ||
              'Tarefa operacional na VM falhou.',
          plan,
          ensureSteps,
          result: nativeResult,
          followUpResults,
          backgroundStatus,
          nextAction: plan.backgroundTaskId
            ? `Use run_vm_operational_task com taskKind=check_background_task e backgroundTaskId=${plan.backgroundTaskId} para acompanhar.`
            : '',
        },
        statePatch: nextState,
        memoryProcedures: [],
      };
    }

    case 'plan_autonomous_task': {
      const vmStatus = await getRuntimeVmStatus({ invokeTool, fallbackStatus: autonomousState.vm });
      const behaviorContext = createBehaviorContext({
        turnContext,
        autonomousState,
        vmStatus,
        activeMindMap,
        autonomousRunnerSummary,
        now,
      });
      const actionInput = {
        taskType: args.taskType || TASK_TYPES.USER_REQUEST,
        requestedBy: args.requestedBy || 'alice',
        environment: args.environment || ENVIRONMENT_TYPES.LOCAL_VM_PLAYGROUND,
        riskLevel: args.riskLevel || RISK_LEVELS.LOW,
        priority: args.priority || TASK_PRIORITIES.USER_NORMAL,
        executionMode: args.executionMode || EXECUTION_MODES.EXECUTION,
        targetFiles: args.targetFiles || [],
        targetApps: args.targetApps || [],
        requiresSystemAccess: args.requiresSystemAccess,
        affectsOfficialCode: args.affectsOfficialCode,
        usesRealFilesDirectly: args.usesRealFilesDirectly,
        requiresRealVm: args.requiresRealVm,
        allowWorkspaceFallback: args.allowWorkspaceFallback,
        reason: args.reason || trustedUtterance,
        userConfirmed: Boolean(args.userConfirmed),
      };
      const decision = createDecisionEngineInput({ actionInput, behaviorContext, now });
      const routed = routeAutonomousTask(autonomousState, {
        actionInput,
        behaviorContext,
        decision,
        now,
      });
      const { task, policyDecision } = routed;
      let nextState = routed.state;
      let workspacePlan = null;
      let playgroundRun = null;
      let validationReport = null;
      let finalTaskStatus = null;
      const internalStateSnapshot = createInternalStateSnapshot({
        autonomousState: nextState,
        turnContext,
        behaviorContext,
        now,
      });

      if (
        policyDecision.allowed &&
        (actionInput.environment === ENVIRONMENT_TYPES.LOCAL_VM_PLAYGROUND ||
          actionInput.environment === ENVIRONMENT_TYPES.LOCAL_WORKSPACE_FALLBACK)
      ) {
        const prepared = preparePlaygroundExecution({
          state: nextState,
          task,
          policyDecision,
          vmStatus,
          sourceFiles: args.sourceFiles || [],
          requestedResources: args.requestedResources,
          hostResources: args.hostResources || vmStatus.hostResources,
          now,
        });
        nextState = prepared.state;
        workspacePlan = prepared.workspacePlan;

        if (
          prepared.selection.mode === PLAYGROUND_EXECUTION_MODES.REAL_VM &&
          args.command &&
          typeof invokeTool === 'function'
        ) {
          try {
            playgroundRun = await invokeTool('run_local_vm_guest_task', {
              request: {
                taskId: task.taskId,
                command: args.command,
                args: args.args || [],
                timeoutMs: args.timeoutMs,
              },
            });
            validationReport = evaluateValidationPipeline({
              actionId: task.taskId,
              checks: args.validationChecks || buildDefaultValidationChecks({
                run: playgroundRun,
                executionMode: prepared.selection.mode,
              }),
              commandResult: {
                exitCode: playgroundRun?.artifacts?.statusCode ?? (playgroundRun?.ok ? 0 : 1),
                stdout: playgroundRun?.stdout || '',
                stderr: playgroundRun?.stderr || '',
              },
              requiredEvidence: args.requiredEvidence || ['functional', 'impact'],
              hostImpact: playgroundRun?.artifacts?.hostImpact || {},
              vmEnvironment: playgroundRun?.artifacts?.vmEnvironment || {},
              hostEnvironment: playgroundRun?.artifacts?.hostEnvironment || {},
              now,
            });
            nextState = appendAutonomousLog(
              mergeAutonomousLearningState(nextState, {
                validationReports: [...nextState.validationReports, validationReport],
                vmTaskRuns: [
                  ...(nextState.vmTaskRuns || []),
                  {
                    taskId: task.taskId,
                    executionMode: prepared.selection.mode,
                    provider: prepared.selection.provider,
                    ok: Boolean(playgroundRun?.ok),
                    artifacts: playgroundRun?.artifacts || null,
                    createdAt: now,
                  },
                ],
                vm: {
                  ...nextState.vm,
                  status: playgroundRun?.ok ? 'active' : 'configured_not_ready',
                  lastHealthCheck: now,
                },
                lastInternalState: internalStateSnapshot,
              }),
              playgroundRun?.ok ? 'real_vm_guest_task_finished' : 'real_vm_guest_task_blocked_or_failed',
              {
                taskId: task.taskId,
                provider: prepared.selection.provider,
                reason: playgroundRun?.message || prepared.selection.setupReason,
              },
              { now },
            );
          } catch (error) {
            playgroundRun = {
              ok: false,
              message: error?.message || String(error),
              stdout: '',
              stderr: '',
              artifacts: {
                provider: prepared.selection.provider,
                executionMode: PLAYGROUND_EXECUTION_MODES.REAL_VM,
                guestCommandExecuted: false,
              },
            };
            nextState = appendAutonomousLog(
              nextState,
              'real_vm_guest_task_failed',
              {
                taskId: task.taskId,
                provider: prepared.selection.provider,
                reason: playgroundRun.message,
              },
              { now },
            );
          }
        } else if (prepared.selection.mode === PLAYGROUND_EXECUTION_MODES.REAL_VM && args.command) {
          nextState = appendAutonomousLog(
            nextState,
            'real_vm_task_blocked_no_guest_runner',
            {
              taskId: task.taskId,
              provider: prepared.selection.provider,
              reason: prepared.selection.setupReason || 'guest_runner_unavailable',
            },
            { now },
          );
        }

        if (
          prepared.selection.mode === PLAYGROUND_EXECUTION_MODES.LOCAL_WORKSPACE_FALLBACK &&
          workspacePlan?.ok &&
          args.command &&
          typeof invokeTool === 'function'
        ) {
          try {
            playgroundRun = await invokeTool('run_local_workspace_playground_task', {
              request: {
                taskId: task.taskId,
                sourceFiles: args.sourceFiles || [],
                command: args.command,
                args: args.args || [],
                timeoutMs: args.timeoutMs,
              },
            });
            validationReport = evaluateValidationPipeline({
              actionId: task.taskId,
              checks: args.validationChecks || buildDefaultValidationChecks({
                run: playgroundRun,
                executionMode: prepared.selection.mode,
              }),
              commandResult: {
                exitCode: playgroundRun?.artifacts?.statusCode ?? (playgroundRun?.ok ? 0 : 1),
                stdout: playgroundRun?.stdout || '',
                stderr: playgroundRun?.stderr || '',
              },
              requiredEvidence: args.requiredEvidence || ['functional', 'impact'],
              hostImpact: playgroundRun?.artifacts?.hostImpact || {},
              now,
            });
            nextState = appendAutonomousLog(
              mergeAutonomousLearningState(nextState, {
                validationReports: [...nextState.validationReports, validationReport],
                vmTaskRuns: [
                  ...(nextState.vmTaskRuns || []),
                  {
                    taskId: task.taskId,
                    executionMode: prepared.selection.mode,
                    ok: Boolean(playgroundRun?.ok),
                    artifacts: playgroundRun?.artifacts || null,
                    createdAt: now,
                  },
                ],
                vm: {
                  ...nextState.vm,
                  status: playgroundRun?.ok ? 'active' : 'error',
                  workspacePath: playgroundRun?.artifacts?.workspacePath || nextState.vm.workspacePath,
                  copyManifest: playgroundRun?.artifacts?.copyManifest || nextState.vm.copyManifest,
                  lastHealthCheck: now,
                },
                lastInternalState: internalStateSnapshot,
              }),
              playgroundRun?.ok ? 'workspace_fallback_task_finished' : 'workspace_fallback_task_failed',
              {
                taskId: task.taskId,
                reason: playgroundRun?.message || 'workspace_fallback_run_finished',
              },
              { now },
            );
          } catch (error) {
            playgroundRun = {
              ok: false,
              message: error?.message || String(error),
              stdout: '',
              stderr: '',
              artifacts: null,
            };
            nextState = appendAutonomousLog(
              mergeAutonomousLearningState(nextState, {
                vm: {
                  ...nextState.vm,
                  status: 'error',
                  lastHealthCheck: now,
                },
                lastInternalState: internalStateSnapshot,
              }),
              'workspace_fallback_task_failed',
              {
                taskId: task.taskId,
                reason: playgroundRun.message,
              },
              { now },
            );
          }
        }
      }

      if (playgroundRun) {
        finalTaskStatus = playgroundRun?.ok && (!validationReport || validationReport.passed)
          ? TASK_STATUSES.DONE
          : TASK_STATUSES.FAILED;
        nextState = completeAutonomousTask(nextState, task.taskId, {
          status: finalTaskStatus,
          result: {
            playgroundRun,
            validationReport,
            workspacePlan,
          },
          now,
        });
      }

      const responseTask = nextState.tasks.find((item) => item.taskId === task.taskId) || task;
      const responseOk = Boolean(policyDecision.allowed) && (!playgroundRun || finalTaskStatus === TASK_STATUSES.DONE);

      return {
        handled: true,
        toolName,
        response: {
          ok: responseOk,
          message: !policyDecision.allowed
            ? 'Tarefa bloqueada pela politica autonoma.'
            : playgroundRun && finalTaskStatus === TASK_STATUSES.FAILED
              ? 'Tarefa executada, mas falhou ou nao passou na validacao.'
              : playgroundRun
                ? 'Tarefa executada dentro do fluxo oficial autonomo.'
                : 'Tarefa planejada dentro do fluxo oficial autonomo.',
          turnContext,
          behaviorContext,
          decisionTrace: decision.decisionTrace,
          task: responseTask,
          policyDecision,
          startedTaskIds: routed.startedTaskIds,
          workspacePlan,
          playgroundRun,
          validationReport,
        },
        statePatch: nextState,
        memoryProcedures: [],
      };
    }

    case 'create_host_change_snapshot': {
      if (typeof invokeTool !== 'function') {
        return {
          handled: true,
          toolName,
          response: {
            ok: false,
            message: 'Snapshot fisico exige runtime desktop Tauri.',
          },
          statePatch: null,
          memoryProcedures: [],
        };
      }

      const snapshot = await invokeTool('create_host_file_snapshot', {
        request: {
          actionId: args.actionId || `host-change-${now}`,
          files: args.files || args.targetFiles || [],
          reason: args.reason || trustedUtterance || 'host_change_snapshot',
          taskId: args.taskId || args.actionId || '',
          declaredFiles: args.declaredFiles || args.files || args.targetFiles || [],
          plannedOperations: args.plannedOperations || [],
        },
      });
      const nextState = appendAutonomousLog(
        mergeAutonomousLearningState(autonomousState, {
          rollbacks: [
            ...autonomousState.rollbacks,
            {
              rollbackId: `rollback-ready-${snapshot?.artifacts?.snapshotId || now}`,
              snapshotId: snapshot?.artifacts?.snapshotId || '',
              reason: 'host_snapshot_ready',
              status: snapshot?.ok ? 'ready' : 'failed',
              createdAt: now,
            },
          ],
        }),
        'host_snapshot_created',
        {
          snapshotId: snapshot?.artifacts?.snapshotId || '',
          reason: snapshot?.message || '',
        },
        { now },
      );

      return {
        handled: true,
        toolName,
        response: snapshot,
        statePatch: nextState,
        memoryProcedures: [],
      };
    }

    case 'record_host_file_checkpoint': {
      if (typeof invokeTool !== 'function') {
        return {
          handled: true,
          toolName,
          response: {
            ok: false,
            message: 'Checkpoint fisico exige runtime desktop Tauri.',
          },
          statePatch: null,
          memoryProcedures: [],
        };
      }

      const checkpoint = await invokeTool('record_host_file_checkpoint', {
        request: {
          snapshotId: args.snapshotId,
          file: args.file,
          stage: args.stage,
          taskId: args.taskId || args.actionId || '',
          operation: args.operation || '',
        },
      });
      const nextState = appendAutonomousLog(
        autonomousState,
        checkpoint?.ok ? 'host_checkpoint_recorded' : 'host_checkpoint_failed',
        {
          snapshotId: args.snapshotId,
          file: args.file,
          stage: args.stage,
          reason: checkpoint?.message || '',
        },
        { now },
      );

      return {
        handled: true,
        toolName,
        response: checkpoint,
        statePatch: nextState,
        memoryProcedures: [],
      };
    }

    case 'create_self_improvement_proposal': {
      if (!(args.patch || args.diff)) {
        return {
          handled: true,
          toolName,
          response: {
            ok: false,
            message: 'Proposta de auto-melhoria exige patch ou diff separado.',
            reason: 'self_improvement_requires_separate_patch',
          },
          statePatch: appendAutonomousLog(
            autonomousState,
            'self_improvement_proposal_rejected',
            {
              reason: 'self_improvement_requires_separate_patch',
            },
            { now },
          ),
          memoryProcedures: [],
        };
      }

      if (!args.validationReport?.passed) {
        return {
          handled: true,
          toolName,
          response: {
            ok: false,
            message: 'Proposta de auto-melhoria exige validacao aprovada antes de ir para aprovacao.',
            reason: 'self_improvement_requires_validated_patch',
          },
          statePatch: appendAutonomousLog(
            autonomousState,
            'self_improvement_proposal_rejected',
            {
              reason: 'self_improvement_requires_validated_patch',
            },
            { now },
          ),
          memoryProcedures: [],
        };
      }

      const proposal = createImprovementProposal({
        title: args.title,
        description: args.description,
        reason: args.reason || trustedUtterance,
        affectedFiles: args.affectedFiles || [],
        riskLevel: args.riskLevel || RISK_LEVELS.MEDIUM,
        beforeMetrics: args.beforeMetrics || {},
        afterMetrics: args.afterMetrics || {},
        testsRun: args.testsRun || [],
        validationReport: args.validationReport || null,
        rollbackPlan: args.rollbackPlan || null,
        patchSummary: args.patchSummary || '',
        patch: args.patch || '',
        diff: args.diff || '',
        vmTestReport: args.vmTestReport || null,
        comparisonReport: args.comparisonReport || null,
        now,
      });
      let nextState = mergeAutonomousLearningState(autonomousState, {
        improvementProposals: [...autonomousState.improvementProposals, proposal],
        pendingApprovals: [
          ...autonomousState.pendingApprovals,
          {
            approvalId: `approval-${proposal.proposalId}`,
            proposalId: proposal.proposalId,
            reason: 'self_improvement_requires_user_approval',
            createdAt: now,
          },
        ],
      });
      nextState = appendAutonomousLog(
        nextState,
        'self_improvement_proposal_created',
        {
          proposalId: proposal.proposalId,
          affectedFiles: proposal.affectedFiles,
        },
        { now },
      );

      return {
        handled: true,
        toolName,
        response: {
          ok: true,
          message: 'Proposta criada. Ela nao sera aplicada sem aprovacao do usuario.',
          proposal,
        },
        statePatch: nextState,
        memoryProcedures: [],
      };
    }

    case 'approve_self_improvement_proposal': {
      const proposal = autonomousState.improvementProposals.find(
        (item) => item.proposalId === args.proposalId,
      );
      const updatedProposal = approveImprovementProposal({
        proposal,
        userApproved: Boolean(args.userApproved),
        now,
      });
      const nextState = appendAutonomousLog(
        mergeAutonomousLearningState(autonomousState, {
          improvementProposals: autonomousState.improvementProposals.map((item) =>
            item.proposalId === args.proposalId ? updatedProposal : item,
          ),
          pendingApprovals: autonomousState.pendingApprovals.filter(
            (approval) => approval.proposalId !== args.proposalId,
          ),
        }),
        args.userApproved ? 'approval_granted' : 'approval_rejected',
        {
          proposalId: args.proposalId,
          reason: updatedProposal.approvalPolicyReason,
        },
        { now },
      );

      return {
        handled: true,
        toolName,
        response: {
          ok: updatedProposal.status === 'approved_ready_to_apply',
          message: updatedProposal.approvalPolicyReason,
          proposal: updatedProposal,
        },
        statePatch: nextState,
        memoryProcedures: [],
      };
    }

    case 'record_validated_learning': {
      const candidate = createProcedureCandidate({
        title: args.title,
        summary: args.summary,
        steps: args.steps || [],
        source: args.source || 'observed',
        confidence: args.confidence || 0.2,
        now,
      });
      const validationReport = evaluateValidationPipeline({
        actionId: candidate.candidateId,
        checks: args.validationChecks || [],
        commandResult: args.commandResult || null,
        requiredEvidence: args.requiredEvidence || ['functional'],
        now,
      });
      const promotion = promoteValidatedProcedure({
        candidate,
        validationReport,
        now,
      });

      let nextState = mergeAutonomousLearningState(autonomousState, {
        procedureCandidates: [...autonomousState.procedureCandidates, candidate],
        validationReports: [...autonomousState.validationReports, validationReport],
        procedures: promotion.promoted
          ? [...autonomousState.procedures, promotion.procedure]
          : autonomousState.procedures,
        learningMemoryEvents: [
          ...(autonomousState.learningMemoryEvents || []),
          {
            candidateId: candidate.candidateId,
            promoted: promotion.promoted,
            reason: promotion.reason,
            createdAt: now,
          },
        ],
      });
      nextState = appendAutonomousLog(
        nextState,
        promotion.promoted ? 'validated_learning_saved' : 'learning_candidate_kept_untrusted',
        {
          candidateId: candidate.candidateId,
          reason: promotion.reason,
          validationReason: validationReport.reason,
        },
        { now },
      );

      return {
        handled: true,
        toolName,
        response: {
          ok: promotion.promoted,
          message: promotion.promoted
            ? 'Aprendizado validado salvo como procedimento operacional.'
            : 'Aprendizado registrado como candidato, mas ainda nao confiavel.',
          candidate,
          validationReport,
          promotion,
        },
        statePatch: nextState,
        memoryProcedures: promotion.promoted ? [promotion.procedure] : [],
      };
    }

    case 'record_research_finding': {
      const researchRun = createActionableResearchCycle({
        query: args.query || trustedUtterance,
        findings: args.findings || [],
        recommendedApproach: args.recommendedApproach,
        alternatives: args.alternatives || [],
        risks: args.risks || [],
        confidence: args.confidence,
        testPlan: args.testPlan || [],
        now,
      });
      const nextState = appendAutonomousLog(
        mergeAutonomousLearningState(autonomousState, {
          researchRuns: [...autonomousState.researchRuns, researchRun],
        }),
        'research_finding_recorded',
        {
          researchId: researchRun.researchId,
          status: researchRun.status,
        },
        { now },
      );

      return {
        handled: true,
        toolName,
        response: {
          ok: researchRun.actionable,
          message: researchRun.actionable
            ? 'Pesquisa registrada com plano testavel.'
            : 'Pesquisa registrada, mas ainda precisa de plano testavel.',
          researchRun,
        },
        statePatch: nextState,
        memoryProcedures: [],
      };
    }

    case 'inspect_project_context': {
      const projectContext = buildProjectContext({
        files: args.files || args.targetFiles || [],
        packageJson: args.packageJson || null,
      });

      return {
        handled: true,
        toolName,
        response: {
          ok: true,
          message: 'Contexto de projeto analisado com classificacao de risco.',
          projectContext,
        },
        statePatch: appendAutonomousLog(
          autonomousState,
          'project_context_built',
          {
            files: projectContext.files.length,
            criticalFiles: projectContext.criticalFiles.length,
          },
          { now },
        ),
        memoryProcedures: [],
      };
    }

    case 'report_unexpected_risk': {
      if (args.snapshotId && typeof invokeTool === 'function') {
        const rollback = await invokeTool('restore_host_file_snapshot', {
          request: {
            snapshotId: args.snapshotId,
            reason: args.reason || 'unexpected_risk_detected',
          },
        });
        const riskEvent = {
          riskId: `risk-${now}`,
          actionId: args.actionId || '',
          reason: args.reason || 'unexpected_risk_detected',
          level: args.riskLevel || RISK_LEVELS.HIGH,
          rollbackTriggered: Boolean(rollback?.ok),
          createdAt: now,
        };
        const nextState = appendAutonomousLog(
          mergeAutonomousLearningState(autonomousState, {
            risks: [...autonomousState.risks, riskEvent],
            rollbacks: [
              ...autonomousState.rollbacks,
              {
                rollbackId: rollback?.artifacts?.rollbackId || `rollback-event-${now}`,
                snapshotId: args.snapshotId,
                reason: riskEvent.reason,
                status: rollback?.ok ? 'done' : 'failed',
                artifacts: rollback?.artifacts || null,
                createdAt: now,
              },
            ],
          }),
          'risk_detected_physical_rollback_triggered',
          {
            riskId: riskEvent.riskId,
            snapshotId: args.snapshotId,
            reason: riskEvent.reason,
          },
          { now },
        );

        return {
          handled: true,
          toolName,
          response: {
            ok: Boolean(rollback?.ok),
            message: rollback?.message || 'Rollback fisico solicitado.',
            rollback,
            latestRisk: riskEvent,
          },
          statePatch: nextState,
          memoryProcedures: [],
        };
      }

      const snapshot = createChangeSnapshot({
        actionId: args.actionId || `risk-${now}`,
        files: args.snapshotFiles || [],
        reason: 'pre_risk_snapshot_logical_fallback',
        now,
      });
      const nextState = recordUnexpectedRiskAndRollback(
        autonomousState,
        {
          snapshot,
          currentFiles: args.currentFiles || [],
          risk: {
            reason: args.reason || 'unexpected_risk_detected',
            level: args.riskLevel || RISK_LEVELS.HIGH,
          },
          now,
        },
      );

      return {
        handled: true,
        toolName,
        response: {
          ok: true,
          message: 'Risco registrado. Use snapshotId para rollback fisico; sem ele foi usado fallback logico.',
          snapshot,
          latestRollback: nextState.rollbacks.at(-1),
          latestRisk: nextState.risks.at(-1),
        },
        statePatch: nextState,
        memoryProcedures: [],
      };
    }

    default:
      return {
        handled: false,
        toolName,
        response: {
          ok: false,
          message: `Ferramenta autonoma nao suportada: ${normalizeToolString(toolName, 'desconhecida')}.`,
        },
        statePatch: null,
        memoryProcedures: [],
      };
  }
};

export const prioritizeUserRequestInAutonomy = ({
  autonomousState = createEmptyAutonomousLearningState(),
  trustedUtterance = '',
  now = Date.now(),
} = {}) => {
  const turnContext = createTurnContext({
    userUtterance: trustedUtterance,
    toolName: 'user_priority_preemption',
    now,
  });
  return runUserPriorityHooks(autonomousState, {
    turnContext,
    now,
  });
};
