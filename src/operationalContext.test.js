import { describe, expect, it } from 'vitest';
import {
  buildOperationalContextSnapshot,
  buildOperationalContextText,
  buildOperationalContextTurns,
  trimOperationalContextText,
} from './operationalContext';

describe('operational context', () => {
  it('trims long context snippets without losing a compact signal', () => {
    const text = trimOperationalContextText('a'.repeat(80), 12);

    expect(text).toBe('aaaaaaaaa...');
    expect(text).toHaveLength(12);
  });

  it('prioritizes selection, page, screen and VM state in one compact turn', () => {
    const turns = buildOperationalContextTurns({
      trustedUtterance: { text: 'isso fala de autenticacao?' },
      outputTranscript: 'Vou verificar a pagina.',
      memorySummary: 'Usuario prefere respostas diretas.',
      autonomousLearningMemoryState: {
        learningGoals: [{ description: 'Aprender a automatizar pesquisas no navegador' }],
        knownGaps: [{ title: 'Descobrir melhor fluxo de busca no portal' }],
        recentExperiments: [{ summary: 'Teste validado de captura de contexto' }],
        procedureCandidates: [{ candidateId: 'candidate-1' }],
        promotedProcedures: [{ procedureId: 'procedure-1' }],
      },
      autonomousRunnerSummary: {
        enabled: true,
        runnerState: 'running',
        queueSize: 2,
        readyCount: 1,
        blockedCount: 0,
        failedCount: 0,
        activeTaskStatus: 'running',
        currentRiskLevel: 'medium',
        activeTask: { title: 'Validar fluxo de login na VM' },
      },
      activeMindMap: {
        nodes: [
          { data: { label: 'Minha Ideia Central' } },
          { data: { label: 'Login VM' } },
          { data: { label: 'Pesquisa portal' } },
        ],
        edges: [{}, {}],
      },
      screenGeometry: { width: 1920, height: 1080 },
      now: 20_000,
      knowledgeState: {
        navigationContext: {
          url: 'https://example.com/docs',
          domain: 'example.com',
          title: 'Docs',
          selectionText: 'OAuth setup',
          timestamp: 10_000,
        },
        navigationContextCapturedAt: 10_000,
        pageSnapshotCapturedAt: 15_000,
        lastKnowledgeQuestion: 'onde fala de login?',
        lastKnowledgeScope: 'current_page',
        lastKnowledgeOrigin: 'pagina_atual',
        lastKnowledgeSufficiency: 'partial',
        lastKnowledgeSources: ['https://example.com/docs'],
      },
      autonomousLearningState: {
        vm: {
          provider: 'virtualbox',
          status: 'active',
          providerStatus: 'ready',
          guestCommandReady: true,
          visualAgent: {
            online: true,
            lastAction: 'capture_screen',
            lastReplayId: 'replay-1',
          },
        },
        visualExecutions: [],
        visualReplays: [],
      },
    });

    expect(turns).toHaveLength(1);
    const text = turns[0].parts[0].text;
    expect(text).toContain('Prioridade de interpretacao');
    expect(text).toContain('Texto selecionado na pagina: OAuth setup');
    expect(text).toContain('Tela compartilhada: 1920x1080');
    expect(text).toContain('agente_visual=online');
    expect(text).toContain('Aprendizado/objetivos:');
    expect(text).toContain('Runner autonomo:');
    expect(text).toContain('Mapa mental ativo:');
    expect(text).toContain('Memoria util de longo prazo');
  });

  it('builds a structured snapshot that prefers latest visual state fallbacks', () => {
    const snapshot = buildOperationalContextSnapshot({
      autonomousLearningState: {
        vm: {
          provider: 'virtualbox',
          visualAgent: {},
        },
        visualExecutions: [{ action: 'click', hostScreenshotPath: 'screen.png' }],
        visualReplays: [{ replayId: 'replay-latest' }],
      },
    });

    expect(snapshot.vm.lastVisualAction).toBe('click');
    expect(snapshot.vm.lastScreenshotPath).toBe('screen.png');
    expect(snapshot.vm.lastReplayId).toBe('replay-latest');
  });

  it('renders page-only context without undefined noise', () => {
    const text = buildOperationalContextText({
      page: { title: 'Artigo', domain: 'site.test' },
      screen: {},
      vm: {},
    });

    expect(text).toContain('Pagina ativa: titulo="Artigo" dominio=site.test');
    expect(text).not.toContain('undefined');
  });
});
