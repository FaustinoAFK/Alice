const RECENT_TEXT_LIMIT = 220;

const clean = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const trim = (value, maxChars = RECENT_TEXT_LIMIT) => {
  const normalized = clean(value);
  if (!normalized) {
    return '';
  }

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
};

const buildConversationLines = (interaction = {}) => {
  const lines = [];
  const userText = trim(interaction.userText, 180);
  const aliceText = trim(interaction.aliceText, 180);

  if (userText) {
    lines.push(`Usuario: ${userText}`);
  }

  if (aliceText) {
    lines.push(`Alice: ${aliceText}`);
  }

  return lines;
};

const buildToolLine = (interaction = {}) => {
  const toolName = clean(interaction.toolName) || 'ferramenta';
  const operation = clean(interaction.operation);
  const status = clean(interaction.status) || 'desconhecido';
  const message = trim(interaction.message || interaction.reason || interaction.responseSummary, 180);

  return [
    `Tool: ${toolName}`,
    operation ? `operacao=${operation}` : '',
    `status=${status}`,
    message ? `detalhe="${message}"` : '',
  ].filter(Boolean).join(' ');
};

const normalizeRecentLines = (interactions = []) =>
  interactions.flatMap((interaction) => {
    if (interaction?.kind === 'conversation') {
      return buildConversationLines(interaction);
    }

    if (interaction?.kind === 'tool') {
      return [buildToolLine(interaction)];
    }

    return [];
  });

export const buildRecentSessionTurns = ({
  interactions = [],
  trustedUtterance = null,
  outputTranscript = '',
  maxInteractions = 6,
} = {}) => {
  const recentInteractions = Array.isArray(interactions)
    ? interactions.slice(-Math.max(1, maxInteractions))
    : [];
  let lines = normalizeRecentLines(recentInteractions);

  if (lines.length === 0) {
    const fallbackUserText = trim(trustedUtterance?.text, 180);
    const fallbackAliceText = trim(outputTranscript, 180);
    if (fallbackUserText) {
      lines.push(`Usuario: ${fallbackUserText}`);
    }
    if (fallbackAliceText) {
      lines.push(`Alice: ${fallbackAliceText}`);
    }
  }

  lines = lines
    .map((line) => clean(line))
    .filter(Boolean)
    .filter((line, index, collection) => collection.indexOf(line) === index)
    .slice(-12);

  if (lines.length === 0) {
    return [];
  }

  return [
    {
      role: 'user',
      parts: [
        {
          text: [
            'Handoff recente da sessao atual:',
            'Priorize estas interacoes recentes ao retomar a conversa. Se memoria antiga conflitar com isso, siga o foco recente e a fala atual do usuario.',
            ...lines,
          ].join('\n'),
        },
      ],
    },
  ];
};

export default buildRecentSessionTurns;
