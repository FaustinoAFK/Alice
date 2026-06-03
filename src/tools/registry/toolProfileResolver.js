import { TOOL_CONTEXT_PROFILES } from './toolContextProfiles';

const FALLBACK_PROFILE = 'full';

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const hasProfile = (profileName) =>
  Object.prototype.hasOwnProperty.call(TOOL_CONTEXT_PROFILES, profileName);

const makeResolution = (profile, reason, confidence) => ({
  profile: hasProfile(profile) ? profile : FALLBACK_PROFILE,
  reason,
  confidence,
  fallbackProfile: FALLBACK_PROFILE,
});

const includesAny = (text, patterns) =>
  patterns.some((pattern) => pattern.test(text));

const getContextText = (context) =>
  [
    context.userText,
    context.targetEnvironment,
    context.requestedOperation,
    context.riskLevel,
    context.currentMode,
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(' ');

const HOST_SAFETY_PATTERNS = [
  /\bsnapshot\b/,
  /\brollback\b/,
  /\bcheckpoint\b/,
  /\brisco\b.*\b(pc real|host|maquina real)\b/,
  /\bpc real\b.*\b(risco|snapshot|rollback|checkpoint)\b/,
];

const SELF_IMPROVEMENT_PATTERNS = [
  /\bauto[- ]?melhoria\b/,
  /\bself[- ]?improvement\b/,
  /\bmelhorar\b.*\balice\b/,
  /\bcodigo da alice\b/,
  /\bproposta\b.*\balice\b/,
];

const WEB_PAGE_PATTERNS = [
  /\bessa pagina\b/,
  /\bnesta pagina\b/,
  /\bpagina atual\b/,
  /\bnesse site\b/,
  /\bneste site\b/,
  /\bsite atual\b/,
  /\baba atual\b/,
  /\bnesta aba\b/,
  /\bessa aba\b/,
];

const AMBIGUOUS_PATTERNS = [
  /\bisso\b/,
  /\baquilo\b/,
  /\bessa coisa\b/,
  /\bcontinua\b/,
  /\bfaz ai\b/,
];

export const resolveToolProfile = (context = {}) => {
  const safeContext = context && typeof context === 'object' ? context : {};
  const explicitToolProfile = normalizeText(safeContext.explicitToolProfile);

  if (explicitToolProfile) {
    if (hasProfile(explicitToolProfile)) {
      return makeResolution(
        explicitToolProfile,
        `explicitToolProfile valido: ${explicitToolProfile}.`,
        1,
      );
    }

    return makeResolution(
      FALLBACK_PROFILE,
      `explicitToolProfile invalido: ${safeContext.explicitToolProfile}; usando full por seguranca.`,
      1,
    );
  }

  const text = getContextText(safeContext);

  if (!text) {
    return makeResolution(
      FALLBACK_PROFILE,
      'Contexto vazio; usando full por seguranca.',
      0.3,
    );
  }

  if (includesAny(text, HOST_SAFETY_PATTERNS)) {
    return makeResolution(
      'hostSafety',
      'Pedido menciona snapshot, rollback, checkpoint ou risco no PC real.',
      0.9,
    );
  }

  if (includesAny(text, SELF_IMPROVEMENT_PATTERNS)) {
    return makeResolution(
      'selfImprovement',
      'Pedido menciona auto-melhoria ou codigo da Alice.',
      0.86,
    );
  }

  if (includesAny(text, WEB_PAGE_PATTERNS)) {
    if (safeContext.hasActiveWebPage === true) {
      return makeResolution(
        'web',
        'Pedido menciona pagina, site ou aba atual com pagina ativa.',
        0.86,
      );
    }

    return makeResolution(
      FALLBACK_PROFILE,
      'Pedido menciona pagina, site ou aba atual sem pagina ativa; usando full por seguranca.',
      0.55,
    );
  }

  if (includesAny(text, AMBIGUOUS_PATTERNS)) {
    return makeResolution(
      FALLBACK_PROFILE,
      'Pedido ambiguo; usando full por seguranca.',
      0.45,
    );
  }

  return makeResolution(
    'conversation',
    'Conversa comum sem sinais de ferramenta contextual especifica.',
    0.72,
  );
};
