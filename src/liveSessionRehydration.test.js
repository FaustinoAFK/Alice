import { describe, expect, it } from 'vitest';
import {
  buildSessionRehydrationTurns,
  trimRehydrationSnippet,
} from './liveSessionRehydration';

describe('trimRehydrationSnippet', () => {
  it('normalizes whitespace and keeps short snippets intact', () => {
    expect(trimRehydrationSnippet('  oi   Alice  ')).toBe('oi Alice');
  });

  it('truncates overly long snippets with ellipsis', () => {
    const trimmed = trimRehydrationSnippet('a'.repeat(300), 20);

    expect(trimmed).toBe('aaaaaaaaaaaaaaaaa...');
    expect(trimmed.length).toBe(20);
  });
});

describe('buildSessionRehydrationTurns', () => {
  it('returns an empty prefix when there is no local context to restore', () => {
    expect(buildSessionRehydrationTurns()).toEqual([]);
  });

  it('builds a compact local rehydration turn from recent transcripts and command state', () => {
    const turns = buildSessionRehydrationTurns({
      trustedUtterance: { text: 'abre o bloco de notas' },
      outputTranscript: 'Ja estou vendo a tela e ouvindo voce.',
      lastCommand: {
        name: 'open_app',
        status: 'executado',
        message: 'Bloco de notas aberto.',
      },
    });

    expect(turns).toEqual([
      {
        role: 'user',
        parts: [
          {
            text: [
              'Contexto local recente antes de restaurar a sessao:',
              'Ultima fala do usuario: abre o bloco de notas',
              'Ultima resposta da Alice: Ja estou vendo a tela e ouvindo voce.',
              'Ultimo comando local: open_app (executado) - Bloco de notas aberto.',
            ].join('\n'),
          },
        ],
      },
    ]);
  });
});
