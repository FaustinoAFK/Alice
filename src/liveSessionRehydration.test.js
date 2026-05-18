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
      memorySummary: 'Usuario quer continuar o plano da VM.',
      knowledgeState: {
        navigationContext: {
          title: 'Docs',
          url: 'https://example.com/docs',
        },
        lastKnowledgeQuestion: 'onde esta o login?',
      },
      autonomousLearningState: {
        improvementProposals: [{ status: 'pending_approval' }],
      },
      autonomousLearningMemoryState: {
        learningGoals: [{ description: 'Aprender fluxo de login' }],
        knownGaps: [{ title: 'Gap de autenticacao' }],
        recentExperiments: [{ summary: 'Teste visual aprovado' }],
        procedureCandidates: [{ candidateId: 'candidate-1' }],
      },
      autonomousRunnerSummary: {
        runnerState: 'running',
        queueSize: 2,
        readyCount: 1,
        blockedCount: 0,
        failedCount: 0,
        activeTaskStatus: 'running',
        activeTask: { title: 'Validar fluxo VM' },
      },
      activeMindMap: {
        nodes: [
          { id: 'root', data: { label: 'Minha Ideia Central' } },
          { id: 'login', data: { label: 'Login' } },
          { id: 'vm', data: { label: 'VM' } },
        ],
        edges: [{ source: 'login', target: 'vm' }],
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
    expect(turns[0].parts[0].text).toContain('Ultima fala do usuario: continuar daqui');
    expect(turns[0].parts[0].text).toContain('Resumo persistido: Usuario quer continuar o plano da VM.');
    expect(turns[0].parts[0].text).toContain('Runner: estado=running fila=2');
    expect(turns[0].parts[0].text).toContain('Aprendizado: objetivos=1 gaps=1 experimentos=1 candidatos=1 propostas=1');
    expect(turns[0].parts[0].text).toContain('Mapa mental ativo: topicos=3 conexoes=1');
    expect(turns[0].parts[0].text).toContain('Relacoes do mapa: Login -> VM');
  });
});
