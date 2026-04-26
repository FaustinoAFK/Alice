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
} = {}) => {
  const lines = [];
  const inputText = trimRehydrationSnippet(trustedUtterance?.text);
  const outputText = trimRehydrationSnippet(outputTranscript);

  if (inputText) {
    lines.push(`Ultima fala do usuario: ${inputText}`);
  }

  if (outputText) {
    lines.push(`Ultima resposta da Alice: ${outputText}`);
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
