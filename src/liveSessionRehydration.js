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
  lastCommand = null,
} = {}) => {
  const lines = [];
  const inputText = trimRehydrationSnippet(trustedUtterance?.text);
  const outputText = trimRehydrationSnippet(outputTranscript);
  const commandMessage = trimRehydrationSnippet(lastCommand?.message, 160);

  if (inputText) {
    lines.push(`Ultima fala do usuario: ${inputText}`);
  }

  if (outputText) {
    lines.push(`Ultima resposta da Alice: ${outputText}`);
  }

  if (lastCommand?.name && lastCommand?.status) {
    const statusLine = commandMessage
      ? `Ultimo comando local: ${lastCommand.name} (${lastCommand.status}) - ${commandMessage}`
      : `Ultimo comando local: ${lastCommand.name} (${lastCommand.status})`;
    lines.push(statusLine);
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
