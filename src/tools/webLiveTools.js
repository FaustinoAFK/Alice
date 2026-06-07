export const WEB_LIVE_TOOL_DECLARATIONS = [
  {
    name: 'get_navigation_context',
    description: 'Retorna o contexto da pagina atual observada no navegador: URL, dominio, titulo e texto selecionado.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'inspect_current_page',
    description: 'Inspeciona em profundidade a pagina atual e retorna secoes, links e uma avaliacao preliminar de suficiencia para a pergunta.',
    parameters: {
      type: 'OBJECT',
      properties: {
        question: {
          type: 'STRING',
          minLength: 1,
          maxLength: 400,
        },
        maxSections: {
          type: 'NUMBER',
          minimum: 1,
          maximum: 8,
        },
      },
      required: ['question'],
    },
  },
];
