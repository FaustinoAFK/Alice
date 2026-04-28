import {
  RUNNER_REASONS,
  RUNNER_STEP_STATUSES,
  RUNNER_TASK_STATUSES,
  appendAutonomousRunnerAudit,
  isExecutableRunnerStep,
  normalizeAutonomousRunnerStep,
  normalizeAutonomousRunnerState,
  updateAutonomousRunnerTask,
} from './autonomousRunnerState';

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const inferStepType = (command = '', title = '') => {
  const text = `${command} ${title}`.toLowerCase();
  if (/\b(test|vitest|jest|pytest|cargo test)\b/.test(text)) {
    return 'test';
  }
  if (/\b(build|cargo build|vite build|tsc)\b/.test(text)) {
    return 'build';
  }
  return 'command';
};

const inferCompletionType = (stepType) => {
  if (stepType === 'test') {
    return 'tests_passed';
  }
  if (stepType === 'build') {
    return 'build_passed';
  }
  return 'exit_code';
};

export const generateOperationalPlanForTask = (task = {}, { now = new Date().toISOString() } = {}) => {
  const command = normalizeText(task.command || task.action?.command);
  if (!command) {
    return {
      ok: false,
      status: RUNNER_TASK_STATUSES.WAITING_INPUT,
      reason: RUNNER_REASONS.MISSING_CONTEXT,
      plan: {
        summary: 'Nao ha comando, acao visual ou step verificavel suficiente para executar.',
        assumptions: [],
        risks: ['Sem comando/acao executavel, o Runner nao deve iniciar.'],
        dependencies: [],
        validationReport: {
          structurallyValid: false,
          hasExecutableSteps: false,
          hasCompletionCriteria: false,
          hasExpectedEvidence: false,
          dryRunResult: null,
          blockers: [RUNNER_REASONS.NO_EXECUTABLE_STEP],
        },
      },
      steps: [],
    };
  }

  const stepType = inferStepType(command, task.title);
  const completionType = inferCompletionType(stepType);
  const step = normalizeAutonomousRunnerStep(
    {
      title: task.title || `Executar ${command}`,
      description: task.description,
      status: RUNNER_STEP_STATUSES.READY,
      type: stepType,
      action: {
        kind: 'command',
        command,
        args: task.args || [],
        sourceFiles: task.sourceFiles || [],
        requestedResources: task.requestedResources || null,
        environment: task.environment || '',
      },
      completionCriteria: {
        type: completionType,
        expected: completionType === 'exit_code' ? 0 : null,
        description: completionType,
      },
      expectedEvidence: {
        kind: 'complete',
        required: ['metadata'],
      },
      timeoutPolicy: {
        type: 'dynamic',
      },
      retryPolicy: {
        maxAttempts: task.maxAttempts || 3,
        backoff: 'dynamic',
      },
    },
    { index: 0, now, defaultMaxAttempts: task.maxAttempts || 3 },
  );

  const executable = isExecutableRunnerStep(step);
  return {
    ok: executable,
    status: executable ? RUNNER_TASK_STATUSES.READY : RUNNER_TASK_STATUSES.BLOCKED,
    reason: executable ? '' : RUNNER_REASONS.NO_EXECUTABLE_STEP,
    plan: {
      summary: `Plano operacional gerado para ${task.title || command}.`,
      assumptions: ['Execucao ocorrera em VM/workspace local controlado.'],
      risks: [],
      dependencies: [],
      validationReport: {
        structurallyValid: true,
        hasExecutableSteps: executable,
        hasCompletionCriteria: Boolean(step.completionCriteria),
        hasExpectedEvidence: Boolean(step.expectedEvidence),
        dryRunResult: { skipped: true, reason: 'dry_run_requires_runtime_tick' },
        blockers: executable ? [] : [RUNNER_REASONS.NO_EXECUTABLE_STEP],
      },
    },
    steps: [step],
  };
};

export const autoPlanAutonomousRunnerTask = (
  runner,
  taskId,
  { now = new Date().toISOString() } = {},
) => {
  const normalizedRunner = normalizeAutonomousRunnerState(runner);
  const task = normalizedRunner.tasksById[taskId];
  if (!task) {
    return {
      ok: false,
      reason: 'task_not_found',
      runner: normalizedRunner,
    };
  }
  if (task.steps.some(isExecutableRunnerStep)) {
    return {
      ok: true,
      reason: 'task_already_has_executable_steps',
      runner: normalizedRunner,
      task,
    };
  }

  const planResult = generateOperationalPlanForTask(task, { now });
  const nextRunner = updateAutonomousRunnerTask(
    normalizedRunner,
    task.id,
    {
      status: planResult.status,
      reason: planResult.reason || null,
      plan: {
        ...task.plan,
        ...planResult.plan,
      },
      steps: planResult.steps,
      updatedAt: now,
    },
    {
      now,
      audit: {
        type: 'autoplanning',
        summary: planResult.ok
          ? `Autoplanejamento gerou steps para ${task.title}.`
          : `Autoplanejamento bloqueou ${task.title}.`,
        reason: planResult.reason || 'autoplanning_ready',
        beforeState: task.status,
        afterState: planResult.status,
        metadata: planResult.plan.validationReport,
      },
    },
  );

  return {
    ok: planResult.ok,
    reason: planResult.reason,
    runner: appendAutonomousRunnerAudit(nextRunner, {
      timestamp: now,
      type: 'dry_run',
      taskId: task.id,
      summary: planResult.plan.validationReport.dryRunResult?.skipped
        ? 'Dry-run estrutural registrado; runtime real validara antes de concluir.'
        : 'Dry-run avaliado.',
      reason: planResult.plan.validationReport.dryRunResult?.reason || '',
      metadata: planResult.plan.validationReport.dryRunResult || {},
    }),
    task: nextRunner.tasksById[task.id],
  };
};
