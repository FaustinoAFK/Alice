export const createLiveDiagnostics = () => ({
  connection: 'aguardando',
  microphone: 'aguardando',
  screen: 'aguardando',
  gemini: 'aguardando',
  audioChunksSent: 0,
  videoFramesSent: 0,
  serverMessagesReceived: 0,
  outputAudioChunksReceived: 0,
  microphoneLevel: 0,
  lastVideoFrameWidth: 0,
  lastVideoFrameHeight: 0,
  lastVideoSourceWidth: 0,
  lastVideoSourceHeight: 0,
  goAwayEvents: 0,
  reconnectAttempts: 0,
  successfulResumptions: 0,
  rehydratedReconnects: 0,
  resumptionUpdates: 0,
  setupTimeouts: 0,
  resumptionRejections: 0,
  lastCloseReason: 'nenhum',
  lastError: '',
});

const closeReasonLabels = {
  manual_stop: 'manual',
  go_away_rotation: 'go_away',
  remote_close: 'remoto',
  socket_error: 'socket',
  setup_timeout: 'timeout',
  resumption_rejected: 'resume_negado',
  unknown_close: 'desconhecido',
};

export const updateLiveDiagnostics = (diagnostics, event) => {
  switch (event.type) {
    case 'connecting':
      return { ...diagnostics, connection: 'conectando', lastError: '' };
    case 'connected':
      return { ...diagnostics, connection: 'conectada', gemini: 'pronta' };
    case 'reconnecting':
      return {
        ...diagnostics,
        connection: 'renovando',
        gemini: 'renovando',
        reconnectAttempts: diagnostics.reconnectAttempts + 1,
      };
    case 'go-away':
      return {
        ...diagnostics,
        goAwayEvents: diagnostics.goAwayEvents + 1,
      };
    case 'resumption-updated':
      return {
        ...diagnostics,
        resumptionUpdates: diagnostics.resumptionUpdates + 1,
      };
    case 'session-resumed':
      return {
        ...diagnostics,
        successfulResumptions: diagnostics.successfulResumptions + 1,
      };
    case 'session-rehydrated':
      return {
        ...diagnostics,
        rehydratedReconnects: diagnostics.rehydratedReconnects + 1,
      };
    case 'close-reason':
      return {
        ...diagnostics,
        lastCloseReason: closeReasonLabels[event.reason] || closeReasonLabels.unknown_close,
        setupTimeouts:
          diagnostics.setupTimeouts + (event.reason === 'setup_timeout' ? 1 : 0),
        resumptionRejections:
          diagnostics.resumptionRejections + (event.reason === 'resumption_rejected' ? 1 : 0),
      };
    case 'microphone-started':
      return { ...diagnostics, microphone: 'ativo' };
    case 'screen-started':
      return { ...diagnostics, screen: 'ativa' };
    case 'audio-sent':
      return {
        ...diagnostics,
        microphone: 'enviando',
        audioChunksSent: diagnostics.audioChunksSent + 1,
        microphoneLevel: event.level ?? diagnostics.microphoneLevel,
      };
    case 'video-sent':
      return {
        ...diagnostics,
        screen: 'enviando',
        videoFramesSent: diagnostics.videoFramesSent + 1,
        lastVideoFrameWidth: Number(event.width || diagnostics.lastVideoFrameWidth || 0),
        lastVideoFrameHeight: Number(event.height || diagnostics.lastVideoFrameHeight || 0),
        lastVideoSourceWidth: Number(event.sourceWidth || diagnostics.lastVideoSourceWidth || 0),
        lastVideoSourceHeight: Number(event.sourceHeight || diagnostics.lastVideoSourceHeight || 0),
      };
    case 'server-message':
      return {
        ...diagnostics,
        gemini: 'respondendo',
        serverMessagesReceived: diagnostics.serverMessagesReceived + 1,
        outputAudioChunksReceived:
          diagnostics.outputAudioChunksReceived + (event.outputAudioChunksReceived || 0),
      };
    case 'error':
      return {
        ...diagnostics,
        connection: 'erro',
        gemini: 'erro',
        lastError: event.message || diagnostics.lastError,
      };
    default:
      return diagnostics;
  }
};
