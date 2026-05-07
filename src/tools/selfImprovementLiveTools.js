export const SELF_IMPROVEMENT_LIVE_TOOL_DECLARATIONS = [
  {
    name: 'create_self_improvement_proposal',
    description: 'Cria uma proposta de auto-melhoria da Alice. A proposta exige aprovacao do usuario e nao e aplicada automaticamente.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        description: { type: 'STRING' },
        reason: { type: 'STRING' },
        affectedFiles: { type: 'ARRAY', items: { type: 'STRING' } },
        riskLevel: { type: 'STRING' },
        beforeMetrics: { type: 'OBJECT' },
        afterMetrics: { type: 'OBJECT' },
        testsRun: { type: 'ARRAY', items: { type: 'STRING' } },
        validationReport: { type: 'OBJECT' },
        rollbackPlan: { type: 'OBJECT' },
        patchSummary: { type: 'STRING' },
        patch: { type: 'STRING' },
        diff: { type: 'STRING' },
        vmTestReport: { type: 'OBJECT' },
        comparisonReport: { type: 'OBJECT' },
      },
    },
  },
  {
    name: 'approve_self_improvement_proposal',
    description: 'Registra aprovacao ou rejeicao de uma proposta de auto-melhoria. Mesmo aprovada, ela so fica pronta se tiver patch separado e validacao.',
    parameters: {
      type: 'OBJECT',
      properties: {
        proposalId: { type: 'STRING' },
        userApproved: { type: 'BOOLEAN' },
      },
      required: ['proposalId', 'userApproved'],
    },
  },
];
