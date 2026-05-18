const REHYDRATION_TEXT_LIMIT = 280;
const LIST_LIMIT = 3;

export const trimRehydrationSnippet = (text, maxChars = REHYDRATION_TEXT_LIMIT) => {
  const normalized = String(text || '').trim().replace(/\s+/g, ' ');

  if (!normalized) {
    return '';
  }

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
};

const clean = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const uniqueList = (values = [], limit = LIST_LIMIT) => {
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

const summarizeMindMapTopics = (activeMindMap) =>
  uniqueList(
    (activeMindMap?.nodes || [])
      .map((node) => node?.data?.label)
      .filter((label) => label && label !== 'Minha Ideia Central'),
    4,
  );

export const buildSessionRehydrationTurns = ({
  trustedUtterance = null,
  outputTranscript = '',
  memorySummary = '',
  knowledgeState = null,
  autonomousLearningState = null,
  autonomousLearningMemoryState = null,
  autonomousRunnerSummary = null,
  activeMindMap = null,
} = {}) => {
  const lines = [];
  const inputText = trimRehydrationSnippet(trustedUtterance?.text);
  const outputText = trimRehydrationSnippet(outputTranscript);
  const normalizedMemorySummary = trimRehydrationSnippet(memorySummary, 220);
  const pageTitle = trimRehydrationSnippet(
    knowledgeState?.navigationContext?.title || knowledgeState?.pageSnapshot?.title || '',
    120,
  );
  const pageUrl = trimRehydrationSnippet(
    knowledgeState?.navigationContext?.url || knowledgeState?.pageSnapshot?.url || '',
    180,
  );
  const lastKnowledgeQuestion = trimRehydrationSnippet(knowledgeState?.lastKnowledgeQuestion, 120);
  const learningGoals = uniqueList(
    (autonomousLearningMemoryState?.learningGoals || []).map((goal) =>
      trimRehydrationSnippet(goal?.description || goal?.title || goal?.goalId || '', 120)),
  );
  const knownGaps = uniqueList(
    (autonomousLearningMemoryState?.knownGaps || []).map((gap) =>
      trimRehydrationSnippet(gap?.title || gap?.summary || gap?.reason || gap?.gapId || '', 120)),
  );
  const recentExperiments = uniqueList(
    (autonomousLearningMemoryState?.recentExperiments || []).map((experiment) =>
      trimRehydrationSnippet(experiment?.title || experiment?.summary || experiment?.reason || experiment?.status || '', 120)),
  );
  const mindMapTopics = summarizeMindMapTopics(activeMindMap);

  if (inputText) {
    lines.push(`Ultima fala do usuario: ${inputText}`);
  }

  if (outputText) {
    lines.push(`Ultima resposta da Alice: ${outputText}`);
  }

  if (normalizedMemorySummary) {
    lines.push(`Resumo persistido: ${normalizedMemorySummary}`);
  }

  if (pageTitle || pageUrl || lastKnowledgeQuestion) {
    lines.push(
      [
        'Pagina/Conhecimento:',
        pageTitle ? `titulo="${pageTitle}"` : '',
        pageUrl ? `url=${pageUrl}` : '',
        lastKnowledgeQuestion ? `ultima_pergunta="${lastKnowledgeQuestion}"` : '',
      ].filter(Boolean).join(' '),
    );
  }

  if (
    autonomousRunnerSummary?.runnerState ||
    autonomousRunnerSummary?.queueSize ||
    autonomousRunnerSummary?.activeTaskStatus
  ) {
    lines.push(
      [
        'Runner:',
        autonomousRunnerSummary?.runnerState ? `estado=${autonomousRunnerSummary.runnerState}` : '',
        `fila=${Number(autonomousRunnerSummary?.queueSize || 0)}`,
        `ready=${Number(autonomousRunnerSummary?.readyCount || 0)}`,
        `blocked=${Number(autonomousRunnerSummary?.blockedCount || 0)}`,
        `failed=${Number(autonomousRunnerSummary?.failedCount || 0)}`,
        autonomousRunnerSummary?.activeTask?.title
          ? `task_ativa="${trimRehydrationSnippet(autonomousRunnerSummary.activeTask.title, 100)}"`
          : '',
        autonomousRunnerSummary?.activeTaskStatus
          ? `status_task=${autonomousRunnerSummary.activeTaskStatus}`
          : '',
      ].filter(Boolean).join(' '),
    );
  }

  if (
    autonomousLearningMemoryState?.learningGoals?.length ||
    autonomousLearningMemoryState?.knownGaps?.length ||
    autonomousLearningMemoryState?.recentExperiments?.length ||
    autonomousLearningMemoryState?.procedureCandidates?.length ||
    autonomousLearningState?.improvementProposals?.length
  ) {
    lines.push(
      [
        'Aprendizado:',
        `objetivos=${Number(autonomousLearningMemoryState?.learningGoals?.length || 0)}`,
        `gaps=${Number(autonomousLearningMemoryState?.knownGaps?.length || 0)}`,
        `experimentos=${Number(autonomousLearningMemoryState?.recentExperiments?.length || 0)}`,
        `candidatos=${Number(autonomousLearningMemoryState?.procedureCandidates?.length || 0)}`,
        `propostas=${Number(autonomousLearningState?.improvementProposals?.length || 0)}`,
      ].join(' '),
    );
    if (learningGoals.length) {
      lines.push(`Objetivos em foco: ${learningGoals.join(' | ')}`);
    }
    if (knownGaps.length) {
      lines.push(`Gaps em foco: ${knownGaps.join(' | ')}`);
    }
    if (recentExperiments.length) {
      lines.push(`Experimentos recentes: ${recentExperiments.join(' | ')}`);
    }
  }

  if ((activeMindMap?.nodes?.length || 0) > 1 || (activeMindMap?.edges?.length || 0) > 0) {
    lines.push(
      [
        'Mapa mental ativo:',
        `topicos=${Number(activeMindMap?.nodes?.length || 0)}`,
        `conexoes=${Number(activeMindMap?.edges?.length || 0)}`,
        mindMapTopics.length ? `destaques=${mindMapTopics.join(' | ')}` : '',
      ].filter(Boolean).join(' '),
    );
  }

  if (lines.length === 0) {
    return [];
  }

  return [
    {
      role: 'user',
      parts: [
        {
          text: ['Contexto local recente antes de restaurar a sessao:', ...lines].join('\n'),
        },
      ],
    },
  ];
};
