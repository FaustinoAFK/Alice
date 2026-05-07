export const LEARNING_LIVE_TOOL_DECLARATIONS = [
  {
    name: 'record_validated_learning',
    description: 'Registra aprendizado operacional; so promove para procedimento oficial quando a validacao tiver evidencia real.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        summary: { type: 'STRING' },
        steps: { type: 'ARRAY', items: { type: 'STRING' } },
        source: { type: 'STRING' },
        confidence: { type: 'NUMBER' },
        validationChecks: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              type: { type: 'STRING' },
              label: { type: 'STRING' },
              passed: { type: 'BOOLEAN' },
              evidence: { type: 'STRING' },
            },
          },
        },
        requiredEvidence: { type: 'ARRAY', items: { type: 'STRING' } },
        commandResult: { type: 'OBJECT' },
      },
    },
  },
  {
    name: 'record_research_finding',
    description: 'Registra pesquisa operacional com fontes, riscos e plano testavel. Pesquisa deve ajudar a agir, nao virar loop.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING' },
        findings: { type: 'ARRAY', items: { type: 'OBJECT' } },
        recommendedApproach: { type: 'STRING' },
        alternatives: { type: 'ARRAY', items: { type: 'STRING' } },
        risks: { type: 'ARRAY', items: { type: 'STRING' } },
        confidence: { type: 'NUMBER' },
        testPlan: { type: 'ARRAY', items: { type: 'STRING' } },
      },
      required: ['query'],
    },
  },
  {
    name: 'inspect_project_context',
    description: 'Analisa arquivos de projeto, comandos, linguagens e riscos antes de enviar copias para VM/workspace ou alterar PC real.',
    parameters: {
      type: 'OBJECT',
      properties: {
        files: { type: 'ARRAY', items: { type: 'STRING' } },
        targetFiles: { type: 'ARRAY', items: { type: 'STRING' } },
        packageJson: { type: 'OBJECT' },
      },
    },
  },
];
