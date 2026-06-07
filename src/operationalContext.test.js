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

  it('prioritizes selection, page, screen and mind map state in one compact turn', () => {
    const turns = buildOperationalContextTurns({
      trustedUtterance: { text: 'isso fala de autenticacao?' },
      outputTranscript: 'Vou verificar a pagina.',
      memorySummary: 'Usuario prefere respostas diretas.',
      activeMindMap: {
        nodes: [
          { id: 'root', data: { label: 'Minha Ideia Central' } },
          { id: 'login', data: { label: 'Login' } },
          { id: 'portal', data: { label: 'Pesquisa portal' } },
        ],
        edges: [
          { source: 'root', target: 'login' },
          { source: 'login', target: 'portal' },
        ],
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
    });

    expect(turns).toHaveLength(1);
    const text = turns[0].parts[0].text;
    expect(text).toContain('Prioridade de interpretacao');
    expect(text).toContain('Texto selecionado na pagina: OAuth setup');
    expect(text).toContain('Tela compartilhada: 1920x1080');
    expect(text).not.toContain('agente_visual=online');
    expect(text).not.toContain('Aprendizado/objetivos:');
    expect(text).not.toContain('Runner autonomo:');
    expect(text).toContain('Mapa mental ativo:');
    expect(text).toContain('Relacoes do mapa: Minha Ideia Central -> Login | Login -> Pesquisa portal');
    expect(text).toContain('Memoria util de longo prazo');
  });

  it('builds a structured snapshot without removed runtime state', () => {
    const snapshot = buildOperationalContextSnapshot({
      removedRuntimeState: { enabled: true },
    });

    expect(snapshot).not.toHaveProperty('vm');
    expect(snapshot).not.toHaveProperty('learning');
    expect(snapshot).not.toHaveProperty('runner');
  });

  it('renders page-only context without undefined noise', () => {
    const text = buildOperationalContextText({
      page: { title: 'Artigo', domain: 'site.test' },
      screen: {},
    });

    expect(text).toContain('Pagina ativa: titulo="Artigo" dominio=site.test');
    expect(text).not.toContain('undefined');
  });
});
