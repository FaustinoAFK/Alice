export const formatDebugValue = (value) => {
  if (value == null) {
    return '-';
  }

  if (typeof value === 'string') {
    return value.trim() || '-';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const KNOWLEDGE_DISPLAY_LABELS = {
  current_page: 'pagina atual',
  same_domain: 'mesmo site',
  global: 'web geral',
  sufficient: 'suficiente',
  partial: 'parcial',
  insufficient: 'insuficiente',
  pagina_atual: 'pagina atual',
  mesmo_dominio: 'mesmo site',
  web_geral: 'web geral',
  page_inspection: 'leitura da pagina',
  internal_link_follow: 'links da pagina',
  same_domain_search: 'busca no mesmo site',
  global_search: 'busca na web',
  search_only: 'busca direta',
  refresh_current_page_snapshot: 'atualizacao da pagina',
  reactive_sse: 'captura em tempo real',
  polling_fallback: 'captura por fallback',
  cache_fallback: 'snapshot em cache',
  refresh_failed: 'falha ao atualizar contexto',
  used_fresh_cached_snapshot_after_refresh_timeout: 'usou snapshot recente apos timeout',
  real_pc: 'PC real',
  pending_approval: 'aguardando aprovacao',
  high_risk_real_pc_action_requires_confirmation: 'risco alto exige confirmacao',
  official_code_changes_require_proposal_first: 'codigo oficial exige proposta',
};

export const humanizeDebugToken = (value, fallback = 'Aguardando dados') => {
  const normalized = String(value || '').trim();

  if (!normalized || normalized === '-') {
    return fallback;
  }

  return KNOWLEDGE_DISPLAY_LABELS[normalized] || normalized.replace(/_/g, ' ');
};

const formatAgeMs = (timestamp, now) => {
  const normalized = Number(timestamp || 0);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return '-';
  }

  const ageMs = Math.max(0, now - normalized);
  return `${Math.round(ageMs / 100) / 10}s`;
};

const formatTraceEvent = (event) => {
  if (!event || typeof event !== 'object') {
    return '';
  }

  const details = Object.entries(event)
    .filter(([key, value]) => key !== 'step' && value !== '' && value != null)
    .map(([key, value]) => `${key}=${String(value)}`);

  return details.length > 0
    ? `${event.step || '-'} (${details.join(', ')})`
    : String(event.step || '-');
};

const buildKnowledgeDisplay = (knowledge) => {
  const expansionSteps = String(knowledge.expansionPath || '')
    .split('->')
    .map((step) => step.trim())
    .filter((step) => step && step !== '-')
    .map((step) => humanizeDebugToken(step));

  return {
    url: humanizeDebugToken(knowledge.url, 'Nenhuma pagina capturada ainda'),
    domain: humanizeDebugToken(knowledge.domain, 'Sem dominio ativo'),
    title: humanizeDebugToken(knowledge.title, 'Sem titulo capturado'),
    selectedText: humanizeDebugToken(knowledge.selectedText, 'Nenhuma selecao ativa'),
    initialScope: humanizeDebugToken(knowledge.initialScope),
    initialSufficiency: humanizeDebugToken(knowledge.initialSufficiency),
    scope: humanizeDebugToken(knowledge.scope),
    sufficiency: humanizeDebugToken(knowledge.sufficiency),
    origin: humanizeDebugToken(knowledge.origin, 'Sem origem definida'),
    refreshMode: humanizeDebugToken(knowledge.refreshMode, 'Sem refresh registrado'),
    fallbackReason: humanizeDebugToken(knowledge.fallbackReason, 'Sem fallback'),
    expansionSteps: expansionSteps.length > 0 ? expansionSteps : ['sem expansao registrada'],
    sources: humanizeDebugToken(knowledge.sources, 'Sem fontes consultadas neste turno'),
    fetchedPages: humanizeDebugToken(knowledge.fetchedPages, 'Nenhuma pagina adicional lida'),
    trace: humanizeDebugToken(knowledge.trace, 'Sem trace registrado'),
    summaryHint: humanizeDebugToken(knowledge.summaryHint, 'Aguardando uma pergunta contextual'),
  };
};

const formatTime = (timestamp) => {
  const value = Number(timestamp || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return '-';
  }

  try {
    return new Date(value).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '-';
  }
};

const normalizeInteraction = (interaction = {}) => ({
  id: String(interaction.id || `${interaction.kind || 'interaction'}-${interaction.timestamp || ''}`),
  kind: String(interaction.kind || 'event'),
  timestamp: Number(interaction.timestamp || 0),
  time: formatTime(interaction.timestamp),
  status: String(interaction.status || 'unknown'),
  ok:
    typeof interaction.ok === 'boolean'
      ? interaction.ok
      : interaction.status === 'done' || interaction.status === 'answered',
  userText: formatDebugValue(interaction.userText),
  aliceText: formatDebugValue(interaction.aliceText),
  toolName: formatDebugValue(interaction.toolName),
  operation: formatDebugValue(interaction.operation),
  message: formatDebugValue(interaction.message),
  reason: formatDebugValue(interaction.reason),
  argsSummary: formatDebugValue(interaction.argsSummary),
  responseSummary: formatDebugValue(interaction.responseSummary),
});

export const buildDebugHudSnapshot = ({
  status = '',
  caption = '',
  inputCaption = '',
  diagnostics = {},
  trustedUtterance = null,
  outputTranscript = '',
  screenGeometry = {},
  memorySummary = '',
  knowledgeState = null,
  persistenceDiagnostics = null,
  interactions = [],
  now = Date.now(),
} = {}) => {
  const knowledge = {
    url: knowledgeState?.navigationContext?.url || '-',
    domain: knowledgeState?.navigationContext?.domain || '-',
    title: knowledgeState?.navigationContext?.title || '-',
    selectedText:
      knowledgeState?.lastUserSelectionText ||
      knowledgeState?.navigationContext?.selectionText ||
      '-',
    navigationContextAge: formatAgeMs(knowledgeState?.navigationContextCapturedAt, now),
    pageSnapshotAge: formatAgeMs(knowledgeState?.pageSnapshotCapturedAt, now),
    initialScope: knowledgeState?.initialKnowledgeScope || '-',
    initialSufficiency: knowledgeState?.initialKnowledgeSufficiency || '-',
    scope: knowledgeState?.lastKnowledgeScope || '-',
    sufficiency: knowledgeState?.lastKnowledgeSufficiency || '-',
    origin: knowledgeState?.lastKnowledgeOrigin || '-',
    refreshMode: knowledgeState?.lastSnapshotRefreshMode || '-',
    refreshLatency:
      Number.isFinite(Number(knowledgeState?.lastSnapshotRefreshLatencyMs || 0)) &&
      Number(knowledgeState?.lastSnapshotRefreshLatencyMs || 0) > 0
        ? `${Math.round(Number(knowledgeState.lastSnapshotRefreshLatencyMs))}ms`
        : '-',
    extensionSeenAge: formatAgeMs(knowledgeState?.lastExtensionSeenAt, now),
    fallbackReason: knowledgeState?.lastFallbackReason || '-',
    expansionPath:
      Array.isArray(knowledgeState?.lastExpansionPath) && knowledgeState.lastExpansionPath.length > 0
        ? knowledgeState.lastExpansionPath.join(' -> ')
        : '-',
    trace:
      Array.isArray(knowledgeState?.lastKnowledgeTrace) && knowledgeState.lastKnowledgeTrace.length > 0
        ? knowledgeState.lastKnowledgeTrace.map(formatTraceEvent).filter(Boolean).join('\n')
        : '-',
    fetchedPages:
      Array.isArray(knowledgeState?.lastFetchedPages) && knowledgeState.lastFetchedPages.length > 0
        ? knowledgeState.lastFetchedPages.map((page) => page.url || page.title || '-').join('\n')
        : '-',
    sources:
      Array.isArray(knowledgeState?.lastKnowledgeSources) && knowledgeState.lastKnowledgeSources.length > 0
        ? knowledgeState.lastKnowledgeSources.join('\n')
        : '-',
    summaryHint: knowledgeState?.lastKnowledgeSummaryHint || '-',
  };
  const persistence = {
    memorySizeBytes: Number(persistenceDiagnostics?.sizeBytes || 0),
    memoryMaxBytes: Number(persistenceDiagnostics?.maxBytes || 0),
    memoryPercentUsed: Number(persistenceDiagnostics?.percentUsed || 0),
    memoryNearLimit: Boolean(persistenceDiagnostics?.nearLimit),
    memoryStatus: persistenceDiagnostics?.status || '-',
    lastMemorySaveAt: persistenceDiagnostics?.lastMemorySaveAt || '-',
    lastMemorySaveError: persistenceDiagnostics?.lastMemorySaveError || '-',
    lastError: persistenceDiagnostics?.lastError || '-',
  };

  return {
    session: {
      status: status || '-',
      caption: caption || '-',
      inputCaption: inputCaption || '-',
      trustedUtterance: trustedUtterance?.text || '-',
      outputTranscript: outputTranscript || '-',
      screenWidth: Number(screenGeometry?.width || 0),
      screenHeight: Number(screenGeometry?.height || 0),
    },
    diagnostics: {
      connection: diagnostics.connection || '-',
      microphone: diagnostics.microphone || '-',
      screen: diagnostics.screen || '-',
      gemini: diagnostics.gemini || '-',
      audioChunksSent: diagnostics.audioChunksSent || 0,
      videoFramesSent: diagnostics.videoFramesSent || 0,
      lastVideoFrame:
        diagnostics.lastVideoFrameWidth && diagnostics.lastVideoFrameHeight
          ? `${diagnostics.lastVideoFrameWidth}x${diagnostics.lastVideoFrameHeight}`
          : '-',
      lastVideoSource:
        diagnostics.lastVideoSourceWidth && diagnostics.lastVideoSourceHeight
          ? `${diagnostics.lastVideoSourceWidth}x${diagnostics.lastVideoSourceHeight}`
          : '-',
      serverMessagesReceived: diagnostics.serverMessagesReceived || 0,
      outputAudioChunksReceived: diagnostics.outputAudioChunksReceived || 0,
      reconnectAttempts: diagnostics.reconnectAttempts || 0,
      successfulResumptions: diagnostics.successfulResumptions || 0,
      rehydratedReconnects: diagnostics.rehydratedReconnects || 0,
      lastCloseReason: diagnostics.lastCloseReason || '-',
      lastError: diagnostics.lastError || '-',
    },
    memorySummary: formatDebugValue(memorySummary),
    knowledge: {
      ...knowledge,
      display: buildKnowledgeDisplay(knowledge),
    },
    persistence,
    interactions: Array.isArray(interactions)
      ? interactions.slice(-80).map(normalizeInteraction).reverse()
      : [],
  };
};
