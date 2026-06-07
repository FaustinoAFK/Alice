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

  it('builds a compact local rehydration turn from recent transcripts', () => {
    const turns = buildSessionRehydrationTurns({
      trustedUtterance: { text: 'continuar daqui' },
      outputTranscript: 'Ja estou vendo a tela e ouvindo voce.',
      memorySummary: 'Usuario quer continuar o plano da memoria.',
      knowledgeState: {
        navigationContext: {
          title: 'Docs',
          url: 'https://example.com/docs',
        },
        lastKnowledgeQuestion: 'onde esta o login?',
      },
      activeMindMap: {
        nodes: [
          { id: 'root', data: { label: 'Minha Ideia Central' } },
          { id: 'login', data: { label: 'Login' } },
          { id: 'memoria', data: { label: 'Memoria' } },
        ],
        edges: [{ source: 'login', target: 'memoria' }],
      },
    });

    expect(turns).toEqual([
      {
        role: 'user',
        parts: [
          {
            text: expect.stringContaining('Contexto local recente antes de restaurar a sessao:'),
          },
        ],
      },
    ]);
    expect(turns[0].parts[0].text).toContain('Nao reative objetivos antigos nem projetos antigos');
    expect(turns[0].parts[0].text).toContain('Ultima fala do usuario: continuar daqui');
    expect(turns[0].parts[0].text).toContain('Resumo persistido: Usuario quer continuar o plano da memoria.');
    expect(turns[0].parts[0].text).not.toContain('Runner:');
    expect(turns[0].parts[0].text).not.toContain('Aprendizado:');
    expect(turns[0].parts[0].text).toContain('Mapa mental ativo: topicos=3 conexoes=1');
    expect(turns[0].parts[0].text).toContain('Relacoes do mapa: Login -> Memoria');
  });
});
