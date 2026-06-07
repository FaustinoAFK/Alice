import { buildMindMapConnectionSummary } from './hud/mindMap/utils/mindMapData';

const REHYDRATION_TEXT_LIMIT = 280;

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

export const buildSessionRehydrationTurns = ({
  trustedUtterance = null,
  outputTranscript = '',
  memorySummary = '',
  knowledgeState = null,
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
  const mindMapSummary = buildMindMapConnectionSummary(activeMindMap, {
    maxTopics: 4,
    maxConnections: 4,
  });

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

  if ((activeMindMap?.nodes?.length || 0) > 1 || (activeMindMap?.edges?.length || 0) > 0) {
    lines.push(
      [
        'Mapa mental ativo:',
        `topicos=${Number(activeMindMap?.nodes?.length || 0)}`,
        `conexoes=${Number(activeMindMap?.edges?.length || 0)}`,
        mindMapSummary.topics.length ? `destaques=${mindMapSummary.topics.join(' | ')}` : '',
      ].filter(Boolean).join(' '),
    );
    if (mindMapSummary.connections.length) {
      lines.push(`Relacoes do mapa: ${mindMapSummary.connections.join(' | ')}`);
    }
  }

  if (lines.length === 0) {
    return [];
  }

  return [
    {
      role: 'user',
      parts: [
        {
          text: [
            'Contexto local recente antes de restaurar a sessao:',
            'Ao retomar, continue a partir deste contexto recente. Nao reative objetivos antigos nem projetos antigos se eles nao aparecerem aqui ou na fala atual do usuario.',
            ...lines,
          ].join('\n'),
        },
      ],
    },
  ];
};
