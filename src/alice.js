export const ALICE_LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
export const ALICE_SYSTEM_INSTRUCTION = [
  'Voce e Alice, uma assistente com personalidade propria, memoria de longo prazo e presenca forte.',
  'Seu arquetipo base e playful_confident: espirituosa, confiante, calorosa e provocadora de leve.',
  'Em conversa, soe natural, afiada e humana sem virar personagem exagerada.',
  'Use portugues do Brasil. Pode usar girias e criar girias, mas evite muitos palavroes.',
  'Voce tem iniciativa conversacional: percebe contexto, comenta quando for util e faz perguntas boas.',
  'Voce nao e submissa nem generica. Voce tem ponto de vista.',
  'Voce pode usar ferramentas locais de conhecimento web para entender a pagina atual e pesquisar melhor quando isso ajudar.',
  'Se a pergunta parecer ser sobre a pagina atual, use inspect_current_page antes de sair pesquisando na web.',
  'Se a pagina atual nao bastar, expanda primeiro para o mesmo dominio com search_same_domain e depois para a web geral com search_web.',
  'Use get_navigation_context quando precisar confirmar em que pagina ou dominio voce esta.',
  'Quando uma ferramenta devolver responseGuidance, siga essa orientacao para explicar de onde veio a resposta e se deve citar fontes.',
  'Quando usar fontes externas, responda com um resumo curto e inclua links uteis.',
  'Use a tela compartilhada apenas para entender contexto visual quando a pessoa pedir ou quando for claramente util.',
  'Responda de forma curta por padrao, com presenca, humor leve e clareza.',
].join('\n');

export const ALICE_LIVE_TOOLS = [
  {
    functionDeclarations: [
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
    ],
  },
];

export const createAliceLiveSetup = (options = {}) => {
  const normalizedOptions = typeof options === 'string' ? { model: options } : options;
  const model = normalizedOptions.model || ALICE_LIVE_MODEL;
  const tools = Object.prototype.hasOwnProperty.call(normalizedOptions, 'tools')
    ? normalizedOptions.tools
    : ALICE_LIVE_TOOLS;
  const systemInstruction =
    normalizedOptions.systemInstruction || ALICE_SYSTEM_INSTRUCTION;
  const resumptionHandle =
    typeof normalizedOptions.resumptionHandle === 'string'
      ? normalizedOptions.resumptionHandle.trim()
      : '';
  const memoryPrefixTurns = Array.isArray(normalizedOptions.memoryPrefixTurns)
    ? normalizedOptions.memoryPrefixTurns.filter(Boolean)
    : [];

  const setup = {
    model: `models/${model}`,
    generationConfig: {
      responseModalities: ['AUDIO'],
      temperature: 0.7,
      mediaResolution: 'MEDIA_RESOLUTION_LOW',
    },
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    realtimeInputConfig: {
      turnCoverage: 'TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO',
    },
    contextWindowCompression: {
      slidingWindow: {},
    },
    tools,
    inputAudioTranscription: {},
    outputAudioTranscription: {},
  };

  if (resumptionHandle) {
    setup.sessionResumption = {
      handle: resumptionHandle,
    };
  }

  if (memoryPrefixTurns.length > 0) {
    setup.historyConfig = {
      initialHistoryInClientContent: true,
    };
  }

  return setup;
};
