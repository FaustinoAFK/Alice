export const HOST_SAFETY_LIVE_TOOL_DECLARATIONS = [
  {
    name: 'create_host_change_snapshot',
    description: 'Cria snapshot fisico dos arquivos do PC real antes de acao relevante, com manifesto e base para rollback.',
    parameters: {
      type: 'OBJECT',
      properties: {
        actionId: { type: 'STRING' },
        reason: { type: 'STRING' },
        files: { type: 'ARRAY', items: { type: 'STRING' } },
        targetFiles: { type: 'ARRAY', items: { type: 'STRING' } },
        taskId: { type: 'STRING' },
        declaredFiles: { type: 'ARRAY', items: { type: 'STRING' } },
        plannedOperations: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              file: { type: 'STRING' },
              operation: { type: 'STRING' },
            },
          },
        },
      },
    },
  },
  {
    name: 'record_host_file_checkpoint',
    description: 'Registra checkpoint antes/depois de escrita controlada para melhorar classificacao de conflito no rollback fisico.',
    parameters: {
      type: 'OBJECT',
      properties: {
        snapshotId: { type: 'STRING' },
        file: { type: 'STRING' },
        stage: { type: 'STRING' },
        taskId: { type: 'STRING' },
        operation: { type: 'STRING' },
      },
      required: ['snapshotId', 'file', 'stage'],
    },
  },
  {
    name: 'report_unexpected_risk',
    description: 'Registra risco inesperado no PC real e aciona rollback fisico quando snapshotId existir; sem snapshotId usa fallback logico de auditoria.',
    parameters: {
      type: 'OBJECT',
      properties: {
        actionId: { type: 'STRING' },
        snapshotId: { type: 'STRING' },
        reason: { type: 'STRING' },
        riskLevel: { type: 'STRING' },
        snapshotFiles: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              path: { type: 'STRING' },
              content: { type: 'STRING' },
            },
          },
        },
        currentFiles: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              path: { type: 'STRING' },
              content: { type: 'STRING' },
            },
          },
        },
      },
    },
  },
];
