const CONTEXT_TEXT_LIMIT = 360;
const SOURCE_LIMIT = 3;

const clean = (value) => String(value || '').trim().replace(/\s+/g, ' ');

export const trimOperationalContextText = (value, maxChars = CONTEXT_TEXT_LIMIT) => {
  const normalized = clean(value);
  if (!normalized) {
    return '';
  }
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
};

const freshAgeSeconds = (timestamp, now) => {
  const value = Number(timestamp || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }
  return `${Math.round(Math.max(0, now - value) / 1000)}s`;
};

const formatSources = (sources = []) =>
  Array.isArray(sources)
    ? sources.map(clean).filter(Boolean).slice(0, SOURCE_LIMIT).join(' | ')
    : '';

export const buildOperationalContextSnapshot = ({
  trustedUtterance = null,
  outputTranscript = '',
  memorySummary = '',
  knowledgeState = null,
  autonomousLearningState = null,
  screenGeometry = {},
  now = Date.now(),
} = {}) => {
  const navigation = knowledgeState?.navigationContext || {};
  const selectionText =
    knowledgeState?.lastUserSelectionText ||
    navigation.selectionText ||
    knowledgeState?.pageSnapshot?.selectedText ||
    '';
  const visualAgent = autonomousLearningState?.vm?.visualAgent || {};
  const latestVisualExecution = (autonomousLearningState?.visualExecutions || []).at?.(-1);
  const latestReplay = (autonomousLearningState?.visualReplays || []).at?.(-1);

  return {
    userUtterance: trimOperationalContextText(trustedUtterance?.text, 240),
    previousAliceAnswer: trimOperationalContextText(outputTranscript, 220),
    memorySummary: trimOperationalContextText(memorySummary, 260),
    page: {
      url: clean(navigation.url),
      domain: clean(navigation.domain),
      title: clean(navigation.title),
      selectionText: trimOperationalContextText(selectionText, 260),
      contextAge: freshAgeSeconds(knowledgeState?.navigationContextCapturedAt || navigation.timestamp, now),
      snapshotAge: freshAgeSeconds(knowledgeState?.pageSnapshotCapturedAt, now),
      lastScope: clean(knowledgeState?.lastKnowledgeScope),
      lastOrigin: clean(knowledgeState?.lastKnowledgeOrigin),
      lastSufficiency: clean(knowledgeState?.lastKnowledgeSufficiency),
      lastQuestion: trimOperationalContextText(knowledgeState?.lastKnowledgeQuestion, 180),
      sources: formatSources(knowledgeState?.lastKnowledgeSources),
    },
    screen: {
      width: Number(screenGeometry?.width || 0),
      height: Number(screenGeometry?.height || 0),
      sourceWidth: Number(screenGeometry?.sourceWidth || 0),
      sourceHeight: Number(screenGeometry?.sourceHeight || 0),
    },
    vm: {
      provider: clean(autonomousLearningState?.vm?.provider),
      status: clean(autonomousLearningState?.vm?.status),
      providerStatus: clean(autonomousLearningState?.vm?.providerStatus),
      guestCommandReady: Boolean(autonomousLearningState?.vm?.guestCommandReady),
      visualAgentOnline: Boolean(visualAgent.online),
      lastVisualAction: clean(visualAgent.lastAction || latestVisualExecution?.action),
      lastScreenshotPath: clean(visualAgent.lastScreenshotPath || latestVisualExecution?.hostScreenshotPath),
      lastReplayId: clean(visualAgent.lastReplayId || latestReplay?.replayId),
    },
  };
};

export const buildOperationalContextText = (snapshot = {}) => {
  const lines = [
    'Contexto operacional atual da Alice:',
    'Prioridade de interpretacao: fala atual do usuario > texto selecionado/pagina ativa quando a pergunta disser aqui/isso/pagina > tela compartilhada para estado visual > VM quando o pedido mencionar VM/app dentro da VM > memoria apenas como apoio.',
  ];

  if (snapshot.userUtterance) {
    lines.push(`Fala recente do usuario: ${snapshot.userUtterance}`);
  }
  if (snapshot.previousAliceAnswer) {
    lines.push(`Ultima resposta da Alice: ${snapshot.previousAliceAnswer}`);
  }
  if (snapshot.page?.url || snapshot.page?.title || snapshot.page?.selectionText) {
    lines.push(
      [
        'Pagina ativa:',
        snapshot.page.title ? `titulo="${snapshot.page.title}"` : '',
        snapshot.page.domain ? `dominio=${snapshot.page.domain}` : '',
        snapshot.page.url ? `url=${snapshot.page.url}` : '',
        snapshot.page.contextAge ? `idade_contexto=${snapshot.page.contextAge}` : '',
        snapshot.page.snapshotAge ? `idade_snapshot=${snapshot.page.snapshotAge}` : '',
      ].filter(Boolean).join(' '),
    );
  }
  if (snapshot.page?.selectionText) {
    lines.push(`Texto selecionado na pagina: ${snapshot.page.selectionText}`);
  }
  if (snapshot.page?.lastQuestion || snapshot.page?.lastOrigin || snapshot.page?.sources) {
    lines.push(
      [
        'Ultima investigacao web:',
        snapshot.page.lastQuestion ? `pergunta="${snapshot.page.lastQuestion}"` : '',
        snapshot.page.lastScope ? `escopo=${snapshot.page.lastScope}` : '',
        snapshot.page.lastOrigin ? `origem=${snapshot.page.lastOrigin}` : '',
        snapshot.page.lastSufficiency ? `suficiencia=${snapshot.page.lastSufficiency}` : '',
        snapshot.page.sources ? `fontes=${snapshot.page.sources}` : '',
      ].filter(Boolean).join(' '),
    );
  }
  if (snapshot.screen?.width || snapshot.screen?.height) {
    lines.push(`Tela compartilhada: ${snapshot.screen.width}x${snapshot.screen.height}. Use-a para layout, janelas e estado visual.`);
  }
  if (snapshot.vm?.provider || snapshot.vm?.visualAgentOnline || snapshot.vm?.lastVisualAction) {
    lines.push(
      [
        'VM:',
        snapshot.vm.provider ? `provider=${snapshot.vm.provider}` : '',
        snapshot.vm.status ? `status=${snapshot.vm.status}` : '',
        snapshot.vm.providerStatus ? `provider_status=${snapshot.vm.providerStatus}` : '',
        `guest_command_pronto=${snapshot.vm.guestCommandReady ? 'sim' : 'nao'}`,
        `agente_visual=${snapshot.vm.visualAgentOnline ? 'online' : 'offline'}`,
        snapshot.vm.lastVisualAction ? `ultima_acao_visual=${snapshot.vm.lastVisualAction}` : '',
        snapshot.vm.lastReplayId ? `ultimo_replay=${snapshot.vm.lastReplayId}` : '',
      ].filter(Boolean).join(' '),
    );
  }
  if (snapshot.memorySummary) {
    lines.push(`Memoria util de longo prazo: ${snapshot.memorySummary}`);
  }

  return lines.join('\n');
};

export const buildOperationalContextTurns = (input = {}) => {
  const snapshot = buildOperationalContextSnapshot(input);
  const text = buildOperationalContextText(snapshot);

  if (!text.trim()) {
    return [];
  }

  return [
    {
      role: 'user',
      parts: [{ text }],
    },
  ];
};
