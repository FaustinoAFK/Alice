export const TRUSTED_UTTERANCE_WINDOW_MS = 8000;
const ALICE_WAKE_WORD = 'alice';

const ACTION_ALIASES = {
  open_app: {
    verbs: ['abre', 'abrir', 'inicia', 'iniciar', 'executa', 'executar'],
    targets: {
      notepad: ['bloco de notas', 'notepad', 'notas'],
      calculator: ['calculadora', 'calculator', 'calc'],
      browser: ['navegador', 'browser', 'chrome', 'google'],
      file_explorer: ['explorador', 'explorer', 'arquivos', 'arquivo'],
    },
  },
  open_folder: {
    verbs: ['abre', 'abrir', 'mostra', 'mostrar'],
    targets: {
      desktop: ['desktop', 'area de trabalho'],
      downloads: ['downloads', 'download', 'baixados'],
      documents: ['documentos', 'documents'],
      alice_project: ['projeto alice', 'alice project', 'alice'],
    },
  },
  mouse_move: {
    verbs: ['move', 'mover', 'leva', 'levar'],
    targets: { mouse_move: ['mouse', 'cursor'] },
  },
  mouse_click: {
    verbs: ['clica', 'clicar', 'clique', 'aperta', 'apertar', 'pressiona', 'pressionar', 'toca', 'tocar', 'toque', 'seleciona', 'selecionar'],
    targets: { mouse_click: [] },
  },
  type_text: {
    verbs: ['digita', 'digitar', 'escreve', 'escrever'],
    targets: { type_text: ['digita', 'digitar', 'escreve', 'escrever'] },
  },
  press_hotkey: {
    verbs: ['atalho', 'pressiona', 'pressionar', 'aperta', 'apertar', 'copia', 'cola', 'salva', 'desfaz'],
    targets: {
      copy: ['copy', 'copia', 'copiar'],
      paste: ['paste', 'cola', 'colar'],
      select_all: ['seleciona tudo', 'selecionar tudo', 'select all'],
      enter: ['enter'],
      escape: ['escape', 'esc'],
      tab: ['tab'],
      alt_tab: ['alt tab', 'alternar janela'],
      ctrl_s: ['salva', 'salvar', 'ctrl s'],
      ctrl_z: ['desfaz', 'desfazer', 'ctrl z'],
    },
  },
};

export const recordTrustedUtterance = (text, timestamp = Date.now()) => ({
  text: String(text || '').trim(),
  timestamp,
});

export const normalizeUtterance = (utterance) =>
  String(utterance || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const firstNormalizedWord = (utterance) => normalizeUtterance(utterance).split(' ')[0] || '';

const shouldJoinWakeWordWithoutSpace = (previousText, nextText) => {
  const previousWord = firstNormalizedWord(previousText);
  if (!previousWord || previousWord === ALICE_WAKE_WORD || !ALICE_WAKE_WORD.startsWith(previousWord)) {
    return false;
  }

  const mergedWord = firstNormalizedWord(`${previousText}${nextText}`);
  return Boolean(mergedWord && (mergedWord === ALICE_WAKE_WORD || ALICE_WAKE_WORD.startsWith(mergedWord)));
};

export const appendTrustedUtterance = (previous, text, timestamp = Date.now()) => {
  const nextText = String(text || '').trim();
  if (!nextText) {
    return previous;
  }

  if (!previous?.text || timestamp - previous.timestamp > TRUSTED_UTTERANCE_WINDOW_MS) {
    return recordTrustedUtterance(nextText, timestamp);
  }

  const previousNormalized = normalizeUtterance(previous.text);
  const nextNormalized = normalizeUtterance(nextText);

  if (nextNormalized.startsWith('alice ') || nextNormalized.startsWith(previousNormalized)) {
    return recordTrustedUtterance(nextText, timestamp);
  }

  if (shouldJoinWakeWordWithoutSpace(previous.text, nextText)) {
    return recordTrustedUtterance(`${previous.text}${nextText}`, timestamp);
  }

  return recordTrustedUtterance(`${previous.text} ${nextText}`, timestamp);
};

export const getRecentTrustedUtterance = (trustedUtteranceState, now = Date.now()) => {
  if (!trustedUtteranceState?.text) {
    return '';
  }

  if (now - trustedUtteranceState.timestamp > TRUSTED_UTTERANCE_WINDOW_MS) {
    return '';
  }

  return trustedUtteranceState.text;
};

const compactUtterance = (utterance) => normalizeUtterance(utterance).replace(/\s+/g, '');

const hasAny = (utterance, terms) => {
  const normalized = normalizeUtterance(utterance);
  const compact = compactUtterance(normalized);

  return terms.some((term) => {
    const normalizedTerm = normalizeUtterance(term);
    return normalized.includes(normalizedTerm) || compact.includes(compactUtterance(normalizedTerm));
  });
};

const getFunctionArgs = (functionCall) => functionCall?.args || functionCall?.arguments || {};

export const mapFunctionCallToDesktopAction = (functionCall) => {
  const args = getFunctionArgs(functionCall);

  switch (functionCall?.name) {
    case 'open_app':
      return { type: 'open_app', app: args.app };
    case 'open_folder':
      return { type: 'open_folder', folder: args.folder };
    case 'mouse_move':
      return { type: 'mouse_move', x: args.x, y: args.y };
    case 'mouse_click':
      return { type: 'mouse_click', button: args.button, x: args.x, y: args.y };
    case 'type_text':
      return { type: 'type_text', text: args.text };
    case 'press_hotkey':
      return { type: 'press_hotkey', hotkey: args.hotkey };
    default:
      return null;
  }
};

export const attachCaptureGeometry = (action, geometry) => {
  if (!['mouse_move', 'mouse_click'].includes(action?.type)) {
    return action;
  }

  const captureWidth = Number(geometry?.width);
  const captureHeight = Number(geometry?.height);
  if (!Number.isFinite(captureWidth) || !Number.isFinite(captureHeight) || captureWidth <= 0 || captureHeight <= 0) {
    return action;
  }

  return {
    ...action,
    captureWidth: Math.round(captureWidth),
    captureHeight: Math.round(captureHeight),
  };
};

export const isUtteranceCompatibleWithAction = (utterance, action) => {
  const normalized = normalizeUtterance(utterance);
  const aliases = ACTION_ALIASES[action?.type];

  if (!aliases || !hasAny(normalized, aliases.verbs)) {
    return false;
  }

  if (action.type === 'mouse_click' || action.type === 'type_text') {
    return true;
  }

  if (action.type === 'mouse_move') {
    return hasAny(normalized, Object.values(aliases.targets).flat());
  }

  const target = action.app || action.folder || action.hotkey;
  return Boolean(target && aliases.targets[target] && hasAny(normalized, aliases.targets[target]));
};

export const authorizeDesktopAction = (functionCall, trustedUtteranceState, now = Date.now()) => {
  const action = mapFunctionCallToDesktopAction(functionCall);
  if (!action) {
    return { authorized: false, reason: 'Acao local desconhecida.', action: null, utterance: '' };
  }

  const utterance = getRecentTrustedUtterance(trustedUtteranceState, now);
  if (!utterance) {
    return { authorized: false, reason: 'Comando negado: nenhuma fala recente confiavel.', action, utterance: '' };
  }

  if (!isUtteranceCompatibleWithAction(utterance, action)) {
    return { authorized: false, reason: 'Comando negado: fala local nao e compativel com a acao pedida.', action, utterance };
  }

  return { authorized: true, reason: 'Comando autorizado pela fala local.', action, utterance };
};
