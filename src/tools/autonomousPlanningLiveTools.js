export const AUTONOMOUS_PLANNING_LIVE_TOOL_DECLARATIONS = [
  {
    name: 'plan_autonomous_task',
    description: 'Planeja uma tarefa operacional no fluxo oficial da Alice. Usa VM local real quando configurada ou workspace fallback honesto quando permitido.',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskType: { type: 'STRING' },
        reason: { type: 'STRING' },
        environment: { type: 'STRING' },
        riskLevel: { type: 'STRING' },
        priority: { type: 'STRING' },
        executionMode: { type: 'STRING' },
        targetFiles: { type: 'ARRAY', items: { type: 'STRING' } },
        targetApps: { type: 'ARRAY', items: { type: 'STRING' } },
        affectsOfficialCode: { type: 'BOOLEAN' },
        requiresSystemAccess: { type: 'BOOLEAN' },
        usesRealFilesDirectly: { type: 'BOOLEAN' },
        requiresRealVm: { type: 'BOOLEAN' },
        allowWorkspaceFallback: { type: 'BOOLEAN' },
        command: {
          type: 'STRING',
          description: 'Executavel permitido para rodar no ambiente selecionado. No fallback, roda em workspace local copiado, nao em VM real.',
        },
        args: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Argumentos passados diretamente ao executavel permitido, sem shell intermediario.',
        },
        timeoutMs: {
          type: 'NUMBER',
          minimum: 1,
          maximum: 60000,
        },
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
              directAccess: { type: 'BOOLEAN' },
            },
          },
        },
        requestedResources: {
          type: 'OBJECT',
          properties: {
            cpuPercent: { type: 'NUMBER' },
            ramMb: { type: 'NUMBER' },
            diskMb: { type: 'NUMBER' },
          },
        },
        hostResources: {
          type: 'OBJECT',
          properties: {
            cpuPercent: { type: 'NUMBER' },
            ramMb: { type: 'NUMBER' },
            diskMb: { type: 'NUMBER' },
          },
        },
        userConfirmed: { type: 'BOOLEAN' },
      },
    },
  },
];
