import {
  blockAutonomousRunnerMemoryTask,
  cancelAutonomousRunnerMemoryQueue,
  cancelAutonomousRunnerMemoryTask,
  enqueueAutonomousRunnerMemoryTask,
  getAutonomousRunnerState,
  getAutonomousRunnerSummary,
  reorderAutonomousRunnerMemoryTask,
  rerunAutonomousRunnerMemoryTask,
  setAutonomousRunnerMemoryEnabled,
  setAutonomousRunnerMemoryPaused,
} from './aliceMemory';

export const AUTONOMOUS_RUNNER_TOOL_NAMES = ['manage_autonomous_runner'];

export const isAutonomousRunnerToolName = (toolName) =>
  AUTONOMOUS_RUNNER_TOOL_NAMES.includes(toolName);

const normalizeText = (value) => String(value || '').trim();

const buildRunnerResponse = ({
  ok = true,
  message = '',
  operation = '',
  memory,
  reason = '',
} = {}) => ({
  ok,
  message,
  operation,
  reason,
  summary: getAutonomousRunnerSummary(memory),
  runner: getAutonomousRunnerState(memory),
});

export const executeAutonomousRunnerFunctionCall = ({
  functionCall,
  currentMemory,
  trustedUtterance = '',
  now = new Date().toISOString(),
} = {}) => {
  const toolName = functionCall?.name || '';
  const args = functionCall?.args || {};
  const operation = normalizeText(args.operation || 'status');

  if (!isAutonomousRunnerToolName(toolName)) {
    return {
      handled: false,
      response: null,
      memory: currentMemory,
    };
  }

  let nextMemory = currentMemory;

  switch (operation) {
    case 'status':
      return {
        handled: true,
        memory: nextMemory,
        response: buildRunnerResponse({
          ok: true,
          message: 'Estado do Autonomous Task Runner carregado.',
          operation,
          memory: nextMemory,
        }),
      };

    case 'enable':
    case 'disable':
      nextMemory = setAutonomousRunnerMemoryEnabled(nextMemory, operation === 'enable', {
        now,
        reason: args.reason || trustedUtterance,
      });
      return {
        handled: true,
        memory: nextMemory,
        response: buildRunnerResponse({
          ok: true,
          message: operation === 'enable' ? 'Runner ligado.' : 'Runner desligado.',
          operation,
          memory: nextMemory,
        }),
      };

    case 'pause':
    case 'resume':
      nextMemory = setAutonomousRunnerMemoryPaused(nextMemory, operation === 'pause', {
        now,
        reason: args.reason || trustedUtterance,
      });
      return {
        handled: true,
        memory: nextMemory,
        response: buildRunnerResponse({
          ok: true,
          message: operation === 'pause' ? 'Runner pausado.' : 'Runner retomado.',
          operation,
          memory: nextMemory,
        }),
      };

    case 'enqueue_task': {
      const taskInput = {
        ...(args.task || args.payload || {}),
        title: args.title || args.task?.title || args.payload?.title || trustedUtterance || 'Tarefa autonoma',
        description: args.description || args.task?.description || args.payload?.description || trustedUtterance,
        command: args.command || args.task?.command || args.payload?.command,
        args: args.args || args.task?.args || args.payload?.args || [],
        steps: args.steps || args.task?.steps || args.payload?.steps || [],
        priority: args.priority || args.task?.priority || args.payload?.priority || 'medium',
        sourceFiles: args.sourceFiles || args.task?.sourceFiles || args.payload?.sourceFiles || [],
        requiresRealVm: Boolean(args.requiresRealVm || args.task?.requiresRealVm || args.payload?.requiresRealVm),
        allowWorkspaceFallback: args.allowWorkspaceFallback ?? args.task?.allowWorkspaceFallback ?? args.payload?.allowWorkspaceFallback ?? true,
        riskLevel: args.riskLevel || args.task?.riskLevel || args.payload?.riskLevel || 'low',
      };
      nextMemory = enqueueAutonomousRunnerMemoryTask(nextMemory, taskInput, { now });
      return {
        handled: true,
        memory: nextMemory,
        response: buildRunnerResponse({
          ok: true,
          message: 'Task enfileirada no Autonomous Task Runner.',
          operation,
          memory: nextMemory,
        }),
      };
    }

    case 'cancel_task':
      nextMemory = cancelAutonomousRunnerMemoryTask(nextMemory, args.taskId, {
        now,
        reason: args.reason || 'manual_cancel',
      });
      return {
        handled: true,
        memory: nextMemory,
        response: buildRunnerResponse({
          ok: true,
          message: 'Task cancelada no Runner.',
          operation,
          memory: nextMemory,
        }),
      };

    case 'cancel_queue':
      nextMemory = cancelAutonomousRunnerMemoryQueue(nextMemory, {
        now,
        reason: args.reason || 'manual_cancel',
      });
      return {
        handled: true,
        memory: nextMemory,
        response: buildRunnerResponse({
          ok: true,
          message: 'Fila do Runner cancelada.',
          operation,
          memory: nextMemory,
        }),
      };

    case 'block_task':
      nextMemory = blockAutonomousRunnerMemoryTask(nextMemory, args.taskId, {
        now,
        reason: args.reason || 'manual_block',
      });
      return {
        handled: true,
        memory: nextMemory,
        response: buildRunnerResponse({
          ok: true,
          message: 'Task bloqueada no Runner.',
          operation,
          memory: nextMemory,
        }),
      };

    case 'rerun_task':
      nextMemory = rerunAutonomousRunnerMemoryTask(nextMemory, args.taskId, { now });
      return {
        handled: true,
        memory: nextMemory,
        response: buildRunnerResponse({
          ok: true,
          message: 'Task preparada para reexecucao.',
          operation,
          memory: nextMemory,
        }),
      };

    case 'reorder_task':
      nextMemory = reorderAutonomousRunnerMemoryTask(nextMemory, args.taskId, Number(args.queueRank || 0), { now });
      return {
        handled: true,
        memory: nextMemory,
        response: buildRunnerResponse({
          ok: true,
          message: 'Task reordenada na fila.',
          operation,
          memory: nextMemory,
        }),
      };

    default:
      return {
        handled: true,
        memory: nextMemory,
        response: buildRunnerResponse({
          ok: false,
          message: 'Operacao do Runner nao suportada.',
          operation,
          reason: 'unsupported_runner_operation',
          memory: nextMemory,
        }),
      };
  }
};
