export const HUD_PAGES = [
  { id: 'live', label: 'Ao vivo', subtitle: 'voz e tela', icon: 'live' },
  { id: 'knowledge', label: 'Conhecimento', subtitle: 'pagina e busca', icon: 'knowledge' },
  { id: 'mind-map', label: 'Mapa', subtitle: 'ideias e relacoes', icon: 'mind-map' },
  { id: 'debug', label: 'Debug', subtitle: 'diagnostico', icon: 'debug' },
];

const clampMicrophonePercent = (microphoneLevel = 0) =>
  Math.round(Math.min(1, Math.max(0, Number(microphoneLevel || 0)) * 8) * 100);

export const buildLiveActivity = ({ status, error = '', diagnostics = {} } = {}) => {
  if (status === 'error') {
    return {
      label: 'Erro',
      detail: error || diagnostics.lastError || 'A sessao precisa de atencao.',
      tone: 'error',
    };
  }

  if (status === 'reconnecting') {
    return {
      label: 'Reconectando',
      detail: 'A Alice esta tentando preservar a sessao live.',
      tone: 'warning',
    };
  }

  if (status === 'starting' || status === 'configuring') {
    return {
      label: 'Preparando',
      detail: 'Abrindo tela, microfone e conexao com o modelo.',
      tone: 'warning',
    };
  }

  if (status === 'connected') {
    return {
      label: Number(diagnostics.microphoneLevel || 0) > 0.015 ? 'Ouvindo' : 'Ao vivo',
      detail: 'Tela e microfone estao sendo enviados para a sessao.',
      tone: 'success',
    };
  }

  return {
    label: 'Parada',
    detail: 'Inicie a sessao para a Alice ver a tela e ouvir voce.',
    tone: 'idle',
  };
};

export const buildSignalGroups = (diagnostics = {}) => [
  {
    title: 'Entrada',
    subtitle: 'captura local',
    items: [
      ['Microfone', diagnostics.microphone],
      ['Tela', diagnostics.screen],
      ['Nivel', `${clampMicrophonePercent(diagnostics.microphoneLevel)}%`],
    ],
  },
  {
    title: 'Modelo',
    subtitle: 'sessao Gemini',
    items: [
      ['Conexao', diagnostics.connection],
      ['Gemini', diagnostics.gemini],
      ['Voz Alice', diagnostics.outputAudioChunksReceived],
    ],
  },
  {
    title: 'Fluxo',
    subtitle: 'telemetria',
    items: [
      ['Frames', diagnostics.videoFramesSent],
      ['Audio', diagnostics.audioChunksSent],
      ['Eventos', diagnostics.serverMessagesReceived],
    ],
  },
  {
    title: 'Resiliencia',
    subtitle: 'continuidade',
    items: [
      ['Retomadas', diagnostics.successfulResumptions],
      ['Fallbacks', diagnostics.rehydratedReconnects],
      ['Fechamento', diagnostics.lastCloseReason],
    ],
  },
];

export const buildDebugSummaryCards = (debugHud) => [
  ['Status', debugHud.session.status],
  ['Tela', `${debugHud.session.screenWidth}x${debugHud.session.screenHeight}`],
  ['Frames', debugHud.diagnostics.videoFramesSent],
  ['Audio', debugHud.diagnostics.audioChunksSent],
  ['Reconexoes', debugHud.diagnostics.reconnectAttempts],
  ['Ult. erro', debugHud.diagnostics.lastError],
];

