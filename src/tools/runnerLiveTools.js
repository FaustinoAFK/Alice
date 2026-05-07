export const RUNNER_LIVE_TOOL_DECLARATIONS = [
  {
    name: 'manage_autonomous_runner',
    description: 'Controla o Autonomous Task Runner oficial: status, ligar/desligar, pausar/retomar, enfileirar task grande, cancelar, bloquear, reexecutar e reordenar fila. Use para tarefas grandes com steps, evidencias e validacao.',
    parameters: {
      type: 'OBJECT',
      properties: {
        operation: {
          type: 'STRING',
          description: 'status | enable | disable | pause | resume | enqueue_task | cancel_task | cancel_queue | block_task | rerun_task | reorder_task',
        },
        taskId: { type: 'STRING' },
        queueRank: { type: 'NUMBER' },
        reason: { type: 'STRING' },
        title: { type: 'STRING' },
        description: { type: 'STRING' },
        command: { type: 'STRING' },
        args: { type: 'ARRAY', items: { type: 'STRING' } },
        priority: { type: 'STRING', description: 'critical | high | medium | low' },
        requiresRealVm: { type: 'BOOLEAN' },
        allowWorkspaceFallback: { type: 'BOOLEAN' },
        riskLevel: { type: 'STRING' },
        sourceFiles: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              path: { type: 'STRING' },
              content: { type: 'STRING' },
              targetPath: { type: 'STRING' },
              contentHash: { type: 'STRING' },
              sizeBytes: { type: 'NUMBER' },
            },
          },
        },
        steps: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              type: { type: 'STRING' },
              action: { type: 'OBJECT' },
              completionCriteria: { type: 'OBJECT' },
              expectedEvidence: { type: 'OBJECT' },
              timeoutPolicy: { type: 'OBJECT' },
              retryPolicy: { type: 'OBJECT' },
            },
          },
        },
        task: { type: 'OBJECT' },
        payload: { type: 'OBJECT' },
      },
      required: ['operation'],
    },
  },
];
