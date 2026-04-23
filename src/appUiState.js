import { createLiveDiagnostics, updateLiveDiagnostics } from './liveDiagnostics';

export const statusCopy = {
  idle: 'pronta',
  starting: 'iniciando',
  configuring: 'conectando',
  connected: 'ao vivo',
  reconnecting: 'reconectando',
  stopped: 'encerrada',
  error: 'erro',
};

export const defaultCaption = 'A Alice fica pronta para ouvir sua voz e observar a tela compartilhada.';
export const stoppedCaption = 'Sessao encerrada. A Alice pode voltar quando voce quiser.';
export const readyCaption = 'Pode falar. A Alice esta ouvindo e vendo sua tela compartilhada.';

const getReconnectNotice = (mode) =>
  mode === 'resume' ? 'Conexao sendo renovada.' : 'Sessao sendo restaurada com o contexto recente.';

const getReconnectSuccessNotice = ({ resumed, rehydrated }) => {
  if (resumed) {
    return 'Conexao renovada.';
  }

  if (rehydrated) {
    return 'Sessao reconectada com o contexto recente.';
  }

  return 'Sessao reconectada.';
};

export const createInitialAppUiState = () => ({
  status: 'idle',
  caption: defaultCaption,
  inputCaption: '',
  error: '',
  diagnostics: createLiveDiagnostics(),
  lastCommand: null,
  sessionNotice: '',
});

export const reduceAppUiState = (state, action) => {
  switch (action.type) {
    case 'session-starting':
      return {
        ...createInitialAppUiState(),
        status: 'starting',
        caption: 'Escolha a tela ou janela que a Alice deve acompanhar.',
      };
    case 'session-live-status':
      return {
        ...state,
        status: action.status,
      };
    case 'session-reconnecting':
      return {
        ...state,
        status: 'reconnecting',
        error: '',
        sessionNotice: getReconnectNotice(action.mode),
      };
    case 'session-ready':
      if (action.mode === 'fresh') {
        return {
          ...state,
          status: 'connected',
          error: '',
          caption: action.caption || readyCaption,
          sessionNotice: '',
        };
      }

      return {
        ...state,
        status: 'connected',
        error: '',
        sessionNotice: getReconnectSuccessNotice(action),
      };
    case 'session-caption':
      return {
        ...state,
        caption: action.caption,
        sessionNotice: '',
      };
    case 'session-input-caption':
      return {
        ...state,
        inputCaption: action.inputCaption,
      };
    case 'command-state':
      return {
        ...state,
        lastCommand: action.commandState,
      };
    case 'session-error':
      return {
        ...state,
        status: 'error',
        error: action.error,
        caption: action.caption || state.caption,
        sessionNotice: '',
      };
    case 'diagnostic-event':
      return {
        ...state,
        diagnostics: updateLiveDiagnostics(state.diagnostics, action.event),
      };
    case 'session-stopped':
      return {
        ...createInitialAppUiState(),
        status: 'stopped',
        caption: stoppedCaption,
      };
    default:
      return state;
  }
};
