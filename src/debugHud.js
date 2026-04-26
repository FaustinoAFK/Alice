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

const formatAgeMs = (timestamp, now) => {
  const normalized = Number(timestamp || 0);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return '-';
  }

  const ageMs = Math.max(0, now - normalized);
  return `${Math.round(ageMs / 100) / 10}s`;
};

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
  now = Date.now(),
} = {}) => ({
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
    fetchedPages:
      Array.isArray(knowledgeState?.lastFetchedPages) && knowledgeState.lastFetchedPages.length > 0
        ? knowledgeState.lastFetchedPages.map((page) => page.url || page.title || '-').join('\n')
        : '-',
    sources:
      Array.isArray(knowledgeState?.lastKnowledgeSources) && knowledgeState.lastKnowledgeSources.length > 0
        ? knowledgeState.lastKnowledgeSources.join('\n')
        : '-',
    summaryHint: knowledgeState?.lastKnowledgeSummaryHint || '-',
  },
});
