const CONTEXT_TEXT_LIMIT = 360;
const SOURCE_LIMIT = 3;
const ITEM_LIMIT = 3;

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

const uniqueTextList = (values = [], limit = ITEM_LIMIT) => {
  const seen = new Set();
  return values
    .map((value) => clean(value))
    .filter((value) => {
      if (!value) {
        return false;
      }
      const key = value.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, limit);
};

const summarizeRunnerTask = (task) =>
  clean(task?.title || task?.reason || task?.id || task?.taskId || '');

const summarizeLearningGoal = (goal) =>
  trimOperationalContextText(goal?.description || goal?.title || goal?.goalId || '', 140);

const summarizeLearningGap = (gap) =>
  trimOperationalContextText(
    gap?.title || gap?.summary || gap?.reason || gap?.gapId || gap?.id || '',
    140,
  );

const summarizeExperiment = (experiment) =>
  trimOperationalContextText(
    experiment?.title || experiment?.summary || experiment?.reason || experiment?.status || '',
    140,
  );

const summarizeMindMapTopics = (activeMindMap) =>
  uniqueTextList(
    (activeMindMap?.nodes || [])
      .map((node) => node?.data?.label)
      .filter((label) => label && label !== 'Minha Ideia Central'),
    4,
  );

export const buildOperationalContextSnapshot = ({
  trustedUtterance = null,
  outputTranscript = '',
  memorySummary = '',
  knowledgeState = null,
  autonomousLearningState = null,
   autonomousLearningMemoryState = null,
   autonomousRunnerSummary = null,
   activeMindMap = null,
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
  const activeRunnerTask = summarizeRunnerTask(autonomousRunnerSummary?.activeTask);
  const learningGoals = uniqueTextList(
    (autonomousLearningMemoryState?.learningGoals || []).map(summarizeLearningGoal),
  );
  const knownGaps = uniqueTextList(
    (autonomousLearningMemoryState?.knownGaps || []).map(summarizeLearningGap),
  );
  const recentExperiments = uniqueTextList(
    (autonomousLearningMemoryState?.recentExperiments || []).map(summarizeExperiment),
  );
  const mindMapTopics = summarizeMindMapTopics(activeMindMap);

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
    learning: {
      enabled: autonomousLearningMemoryState?.enabled !== false,
      goalCount: Number(autonomousLearningMemoryState?.learningGoals?.length || 0),
      gapCount: Number(autonomousLearningMemoryState?.knownGaps?.length || 0),
      experimentCount: Number(autonomousLearningMemoryState?.recentExperiments?.length || 0),
      candidateCount: Number(autonomousLearningMemoryState?.procedureCandidates?.length || 0),
      promotedCount: Number(autonomousLearningMemoryState?.promotedProcedures?.length || 0),
      goals: learningGoals,
      gaps: knownGaps,
      experiments: recentExperiments,
      pendingProposals: Number(
        (autonomousLearningState?.improvementProposals || [])
          .filter((proposal) => proposal?.status === 'pending_approval').length || 0,
      ),
    },
    runner: {
      enabled: autonomousRunnerSummary?.enabled !== false,
      state: clean(autonomousRunnerSummary?.runnerState),
      queueSize: Number(autonomousRunnerSummary?.queueSize || 0),
      readyCount: Number(autonomousRunnerSummary?.readyCount || 0),
      blockedCount: Number(autonomousRunnerSummary?.blockedCount || 0),
      failedCount: Number(autonomousRunnerSummary?.failedCount || 0),
      activeTask: activeRunnerTask,
      activeTaskStatus: clean(autonomousRunnerSummary?.activeTaskStatus),
      currentRiskLevel: clean(autonomousRunnerSummary?.currentRiskLevel),
    },
    mindMap: {
      topicCount: Number(activeMindMap?.nodes?.length || 0),
      edgeCount: Number(activeMindMap?.edges?.length || 0),
      topics: mindMapTopics,
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
  if (
    snapshot.learning?.goalCount ||
    snapshot.learning?.gapCount ||
    snapshot.learning?.experimentCount ||
    snapshot.learning?.candidateCount ||
    snapshot.learning?.pendingProposals
  ) {
    lines.push(
      [
        'Aprendizado/objetivos:',
        `ligado=${snapshot.learning.enabled ? 'sim' : 'nao'}`,
        `objetivos=${snapshot.learning.goalCount}`,
        `gaps=${snapshot.learning.gapCount}`,
        `experimentos=${snapshot.learning.experimentCount}`,
        `candidatos=${snapshot.learning.candidateCount}`,
        `promovidos=${snapshot.learning.promotedCount}`,
        `propostas_pendentes=${snapshot.learning.pendingProposals}`,
      ].join(' '),
    );
    if (snapshot.learning.goals?.length) {
      lines.push(`Objetivos em foco: ${snapshot.learning.goals.join(' | ')}`);
    }
    if (snapshot.learning.gaps?.length) {
      lines.push(`Gaps conhecidos: ${snapshot.learning.gaps.join(' | ')}`);
    }
    if (snapshot.learning.experiments?.length) {
      lines.push(`Experimentos recentes: ${snapshot.learning.experiments.join(' | ')}`);
    }
  }
  if (
    snapshot.runner?.state ||
    snapshot.runner?.queueSize ||
    snapshot.runner?.activeTask ||
    snapshot.runner?.failedCount
  ) {
    lines.push(
      [
        'Runner autonomo:',
        `ligado=${snapshot.runner.enabled ? 'sim' : 'nao'}`,
        snapshot.runner.state ? `estado=${snapshot.runner.state}` : '',
        `fila=${snapshot.runner.queueSize}`,
        `ready=${snapshot.runner.readyCount}`,
        `blocked=${snapshot.runner.blockedCount}`,
        `failed=${snapshot.runner.failedCount}`,
        snapshot.runner.activeTask ? `task_ativa="${snapshot.runner.activeTask}"` : '',
        snapshot.runner.activeTaskStatus ? `status_task=${snapshot.runner.activeTaskStatus}` : '',
        snapshot.runner.currentRiskLevel ? `risco=${snapshot.runner.currentRiskLevel}` : '',
      ].filter(Boolean).join(' '),
    );
  }
  if (snapshot.mindMap?.topicCount > 1 || snapshot.mindMap?.edgeCount > 0) {
    lines.push(
      [
        'Mapa mental ativo:',
        `topicos=${snapshot.mindMap.topicCount}`,
        `conexoes=${snapshot.mindMap.edgeCount}`,
        snapshot.mindMap.topics?.length
          ? `destaques=${snapshot.mindMap.topics.join(' | ')}`
          : '',
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
