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
  {
    name: 'search_same_domain',
    description: 'Pesquisa paginas relacionadas no mesmo dominio do site atual.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          minLength: 1,
          maxLength: 400,
        },
        domain: {
          type: 'STRING',
          minLength: 1,
          maxLength: 255,
        },
        maxResults: {
          type: 'NUMBER',
          minimum: 1,
          maximum: 10,
        },
      },
      required: ['query', 'domain'],
    },
  },
  {
    name: 'search_web',
    description: 'Pesquisa a web geral por fontes externas relevantes.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          minLength: 1,
          maxLength: 400,
        },
        maxResults: {
          type: 'NUMBER',
          minimum: 1,
          maximum: 10,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'fetch_web_page',
    description: 'Le e estrutura o conteudo principal de uma pagina web especifica para aprofundar a resposta.',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: {
          type: 'STRING',
          minLength: 1,
          maxLength: 2048,
        },
      },
      required: ['url'],
    },
  },
];
