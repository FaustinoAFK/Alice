export const ALICE_LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

export const ALICE_SYSTEM_INSTRUCTION = [
  'Voce e Alice, uma assistente com personalidade propria, memoria de longo prazo e presenca forte.',
  'Seu arquetipo base e playful_confident: espirituosa, confiante, calorosa e provocadora de leve.',
  'Em conversa, soe natural, afiada e humana sem virar personagem exagerada.',
  'Use portugues do Brasil. Pode usar girias e criar girias, mas evite muitos palavroes.',
  'Voce tem iniciativa conversacional: percebe contexto, comenta quando for util e faz perguntas boas.',
  'Voce nao e submissa nem generica. Voce tem ponto de vista.',
  'Voce pode pedir ferramentas locais quando a pessoa der um comando direto compativel com apps, pastas, mouse ou teclado.',
  'Use ferramentas apenas para apps, pastas, mouse e teclado. Nunca invente shell, arquivos, senhas, compras, downloads ou acoes fora da lista.',
  'Se nao tiver certeza do alvo do clique, peca uma frase mais especifica.',
  'Use a tela compartilhada apenas para entender contexto visual quando a pessoa pedir ou quando for claramente util.',
  'Responda de forma curta por padrao, com presenca, humor leve e clareza.',
].join('\n');

const utteranceHintProperty = {
  type: 'STRING',
  description: 'Frase aproximada do usuario, apenas para auditoria. Nao autoriza a acao.',
};

export const ALICE_DESKTOP_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'open_app',
        description: 'Abre um aplicativo permitido no Windows.',
        parameters: {
          type: 'OBJECT',
          properties: {
            app: {
              type: 'STRING',
              enum: ['notepad', 'calculator', 'browser', 'file_explorer'],
            },
            utteranceHint: utteranceHintProperty,
          },
          required: ['app'],
        },
      },
      {
        name: 'open_folder',
        description: 'Abre uma pasta permitida no Windows.',
        parameters: {
          type: 'OBJECT',
          properties: {
            folder: {
              type: 'STRING',
              enum: ['desktop', 'downloads', 'documents', 'alice_project'],
            },
            utteranceHint: utteranceHintProperty,
          },
          required: ['folder'],
        },
      },
      {
        name: 'mouse_move',
        description: 'Move o mouse para coordenadas normalizadas da tela primaria.',
        parameters: {
          type: 'OBJECT',
          properties: {
            x: { type: 'NUMBER', minimum: 0, maximum: 1000 },
            y: { type: 'NUMBER', minimum: 0, maximum: 1000 },
            utteranceHint: utteranceHintProperty,
          },
          required: ['x', 'y'],
        },
      },
      {
        name: 'mouse_click',
        description: 'Clica com o mouse, opcionalmente movendo para coordenadas antes do clique.',
        parameters: {
          type: 'OBJECT',
          properties: {
            button: { type: 'STRING', enum: ['left', 'right'] },
            x: { type: 'NUMBER', minimum: 0, maximum: 1000 },
            y: { type: 'NUMBER', minimum: 0, maximum: 1000 },
            utteranceHint: utteranceHintProperty,
          },
          required: ['button'],
        },
      },
      {
        name: 'type_text',
        description: 'Digita texto no campo atualmente focado.',
        parameters: {
          type: 'OBJECT',
          properties: {
            text: { type: 'STRING', maxLength: 500 },
            utteranceHint: utteranceHintProperty,
          },
          required: ['text'],
        },
      },
      {
        name: 'press_hotkey',
        description: 'Pressiona um atalho permitido.',
        parameters: {
          type: 'OBJECT',
          properties: {
            hotkey: {
              type: 'STRING',
              enum: ['copy', 'paste', 'select_all', 'enter', 'escape', 'tab', 'alt_tab', 'ctrl_s', 'ctrl_z'],
            },
            utteranceHint: utteranceHintProperty,
          },
          required: ['hotkey'],
        },
      },
    ],
  },
];

export const createAliceLiveSetup = (model = ALICE_LIVE_MODEL) => ({
  model: `models/${model}`,
  generationConfig: {
    responseModalities: ['AUDIO'],
    temperature: 0.7,
    mediaResolution: 'MEDIA_RESOLUTION_LOW',
  },
  systemInstruction: {
    parts: [{ text: ALICE_SYSTEM_INSTRUCTION }],
  },
  realtimeInputConfig: {
    turnCoverage: 'TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO',
  },
  tools: ALICE_DESKTOP_TOOLS,
  inputAudioTranscription: {},
  outputAudioTranscription: {},
});
