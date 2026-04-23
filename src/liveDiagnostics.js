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
});

export const updateLiveDiagnostics = (diagnostics, event) => {
  switch (event.type) {
    case 'connecting':
      return { ...diagnostics, connection: 'conectando' };
    case 'connected':
      return { ...diagnostics, connection: 'conectada', gemini: 'pronta' };
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
      return { ...diagnostics, connection: 'erro', gemini: 'erro' };
    default:
      return diagnostics;
  }
};
