export const KNOWLEDGE_SCOPES = {
  CURRENT_PAGE: 'current_page',
  SAME_DOMAIN: 'same_domain',
  GLOBAL: 'global',
};

export const KNOWLEDGE_SUFFICIENCY = {
  SUFFICIENT: 'sufficient',
  PARTIAL: 'partial',
  INSUFFICIENT: 'insufficient',
};

const EXPLICIT_PAGE_PATTERNS = [
  /\baqui\b/i,
  /\bnessa pagina\b/i,
  /\besta pagina\b/i,
  /\bnessa tela\b/i,
  /\bessa pagina\b/i,
  /\bessa tela\b/i,
  /\bresume isso\b/i,
  /\bo que isso significa\b/i,
  /\bonde fala disso\b/i,
  /\bessa pagina fala sobre\b/i,
];

const CONTEXTUAL_PAGE_PATTERNS = [
  /\bonde\b.*\b(fica|est[aá]|fala|tem|encontra)\b/i,
  /\bem que parte\b/i,
  /\bonde (fica|fala|tem)\b/i,
];

const SAME_DOMAIN_PATTERNS = [
  /\besse site\b/i,
  /\beste site\b/i,
  /\bo site fala\b/i,
  /\btem algo aqui sobre\b/i,
  /\bnesse site\b/i,
  /\bno site\b/i,
];

const GLOBAL_PATTERNS = [
  /\bna web\b/i,
  /\bem outros lugares\b/i,
  /\bfora daqui\b/i,
  /\bde forma geral\b/i,
  /\bquais sao os melhores lugares\b/i,
  /\bo que e\b/i,
];

const SUMMARY_PATTERNS = [
  /\bresume\b/i,
  /\bresumir\b/i,
  /\bdo que se trata\b/i,
  /\bsobre o que\b/i,
];

const tokenize = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

const normalizeQuestionText = (value) => tokenize(value).join(' ');

const STOP_WORDS = new Set([
  'a',
  'o',
  'as',
  'os',
  'de',
  'do',
  'da',
  'das',
  'dos',
  'e',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'um',
  'uma',
  'que',
  'isso',
  'essa',
  'esse',
  'esta',
  'este',
  'pra',
  'para',
  'com',
  'sobre',
  'tem',
  'fala',
  'site',
  'pagina',
]);

export const extractKnowledgeTerms = (question) =>
  tokenize(question).filter((token) => token.length > 2 && !STOP_WORDS.has(token));

export const normalizeNavigationContext = (context = null) => {
  if (!context || typeof context !== 'object') {
    return null;
  }

  const url = String(context.url || '').trim();
  const domain = String(context.domain || '').trim();
  const title = String(context.title || '').trim();
  const selectionText = String(context.selectionText || context.selectedText || '').trim();
  const timestamp = Number(context.timestamp || 0);

  if (!url && !domain && !title) {
    return null;
  }

  return {
    url,
    domain,
    title,
    selectionText,
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
  };
};

export const isPageSummaryIntent = (question) =>
  SUMMARY_PATTERNS.some((pattern) => pattern.test(normalizeQuestionText(question)));

export const classifyKnowledgeScope = ({ question = '', navigationContext = null } = {}) => {
  const normalizedQuestion = normalizeQuestionText(question);
  const normalizedContext = normalizeNavigationContext(navigationContext);
  const hasSelection = Boolean(normalizedContext?.selectionText);

  if (!normalizedQuestion) {
    return KNOWLEDGE_SCOPES.GLOBAL;
  }

  if (EXPLICIT_PAGE_PATTERNS.some((pattern) => pattern.test(normalizedQuestion))) {
    return KNOWLEDGE_SCOPES.CURRENT_PAGE;
  }

  if (SAME_DOMAIN_PATTERNS.some((pattern) => pattern.test(normalizedQuestion))) {
    return KNOWLEDGE_SCOPES.SAME_DOMAIN;
  }

  if (GLOBAL_PATTERNS.some((pattern) => pattern.test(normalizedQuestion))) {
    return KNOWLEDGE_SCOPES.GLOBAL;
  }

  if (hasSelection && extractKnowledgeTerms(normalizedQuestion).length <= 4) {
    return KNOWLEDGE_SCOPES.CURRENT_PAGE;
  }

  if (normalizedContext && isPageSummaryIntent(normalizedQuestion)) {
    return KNOWLEDGE_SCOPES.CURRENT_PAGE;
  }

  if (normalizedContext && /\besse\b|\bessa\b|\bisto\b|\bisso\b/i.test(normalizedQuestion)) {
    return KNOWLEDGE_SCOPES.CURRENT_PAGE;
  }

  if (normalizedContext && CONTEXTUAL_PAGE_PATTERNS.some((pattern) => pattern.test(normalizedQuestion))) {
    return KNOWLEDGE_SCOPES.CURRENT_PAGE;
  }

  if (normalizedContext && /\bsite\b|\bdocumentacao\b/i.test(normalizedQuestion)) {
    return KNOWLEDGE_SCOPES.SAME_DOMAIN;
  }

  return KNOWLEDGE_SCOPES.GLOBAL;
};

export const nextKnowledgeScopeForExpansion = ({ scope, sufficiency }) => {
  switch (scope) {
    case KNOWLEDGE_SCOPES.CURRENT_PAGE:
      return sufficiency === KNOWLEDGE_SUFFICIENCY.SUFFICIENT
        ? KNOWLEDGE_SCOPES.CURRENT_PAGE
        : KNOWLEDGE_SCOPES.SAME_DOMAIN;
    case KNOWLEDGE_SCOPES.SAME_DOMAIN:
      return sufficiency === KNOWLEDGE_SUFFICIENCY.SUFFICIENT
        ? KNOWLEDGE_SCOPES.SAME_DOMAIN
        : KNOWLEDGE_SCOPES.GLOBAL;
    default:
      return KNOWLEDGE_SCOPES.GLOBAL;
  }
};

export const createEmptyKnowledgeState = () => ({
  navigationContext: null,
  pageSnapshot: null,
  navigationContextCapturedAt: 0,
  pageSnapshotCapturedAt: 0,
  pageSnapshotUpdatedAt: 0,
  initialKnowledgeScope: KNOWLEDGE_SCOPES.GLOBAL,
  initialKnowledgeSufficiency: KNOWLEDGE_SUFFICIENCY.INSUFFICIENT,
  lastKnowledgeScope: KNOWLEDGE_SCOPES.GLOBAL,
  lastKnowledgeSufficiency: KNOWLEDGE_SUFFICIENCY.INSUFFICIENT,
  lastKnowledgeSources: [],
  lastFetchedPages: [],
  lastExpansionPath: [],
  lastKnowledgeTrace: [],
  lastFallbackReason: '',
  lastSnapshotRefreshMode: '',
  lastSnapshotRefreshLatencyMs: 0,
  lastExtensionSeenAt: 0,
  lastUserSelectionText: '',
  lastKnowledgeOrigin: '-',
  lastKnowledgeQuestion: '',
  lastKnowledgeSummaryHint: '',
  lastQuery: '',
});

export const mergeKnowledgeState = (currentState, patch = {}) => ({
  ...createEmptyKnowledgeState(),
  ...(currentState || {}),
  ...patch,
});
