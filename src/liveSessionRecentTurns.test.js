import { describe, expect, it } from 'vitest';
import { buildRecentSessionTurns } from './liveSessionRecentTurns';

describe('buildRecentSessionTurns', () => {
  it('builds a reconnect handoff from recent conversation and tool interactions', () => {
    const turns = buildRecentSessionTurns({
      interactions: [
        {
          kind: 'conversation',
          userText: 'vamos continuar o fluxo de login',
          aliceText: 'Certo, estou no passo da validacao.',
        },
        {
          kind: 'tool',
          toolName: 'inspect_current_page',
          operation: 'inspect',
          status: 'done',
          message: 'Pagina atual inspecionada.',
        },
      ],
    });

    expect(turns).toHaveLength(1);
    expect(turns[0].parts[0].text).toContain('Handoff recente da sessao atual:');
    expect(turns[0].parts[0].text).toContain('Priorize estas interacoes recentes');
    expect(turns[0].parts[0].text).toContain('Usuario: vamos continuar o fluxo de login');
    expect(turns[0].parts[0].text).toContain('Alice: Certo, estou no passo da validacao.');
    expect(turns[0].parts[0].text).toContain('Tool: inspect_current_page operacao=inspect status=done');
  });

  it('falls back to current transcripts when the interaction log is empty', () => {
    const turns = buildRecentSessionTurns({
      interactions: [],
      trustedUtterance: { text: 'foca so no deploy atual' },
      outputTranscript: 'Beleza, vou ignorar o resto.',
    });

    expect(turns[0].parts[0].text).toContain('Usuario: foca so no deploy atual');
    expect(turns[0].parts[0].text).toContain('Alice: Beleza, vou ignorar o resto.');
  });
});
