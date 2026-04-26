import { describe, expect, it } from 'vitest';
import { buildDebugHudSnapshot, formatDebugValue } from './debugHud';

describe('formatDebugValue', () => {
  it('returns a dash for nullish values', () => {
    expect(formatDebugValue(null)).toBe('-');
    expect(formatDebugValue(undefined)).toBe('-');
  });

  it('pretty prints structured values', () => {
    expect(formatDebugValue({ ok: true })).toBe('{\n  "ok": true\n}');
  });
});

describe('buildDebugHudSnapshot', () => {
  it('builds a readable snapshot for the debug HUD', () => {
    const snapshot = buildDebugHudSnapshot({
      now: 20000,
      status: 'connected',
      caption: 'Estou vendo sua tela.',
      inputCaption: 'continuar daqui',
      trustedUtterance: { text: 'continuar daqui', timestamp: 123 },
      outputTranscript: 'Certo.',
      screenGeometry: { width: 1920, height: 1080 },
      diagnostics: {
        connection: 'conectada',
        gemini: 'respondendo',
        audioChunksSent: 3,
      },
      memorySummary: 'Usuario: continuar daqui | Alice: Certo.',
      knowledgeState: {
        navigationContext: {
          url: 'https://example.com/docs',
          domain: 'example.com',
          title: 'Docs',
          selectionText: 'trecho selecionado',
        },
        navigationContextCapturedAt: 15000,
        pageSnapshotCapturedAt: 17000,
        initialKnowledgeScope: 'current_page',
        initialKnowledgeSufficiency: 'partial',
        lastKnowledgeScope: 'same_domain',
        lastKnowledgeSufficiency: 'sufficient',
        lastKnowledgeOrigin: 'mesmo_dominio',
        lastSnapshotRefreshMode: 'reactive_sse',
        lastSnapshotRefreshLatencyMs: 118,
        lastExtensionSeenAt: 19000,
        lastKnowledgeSources: ['https://example.com/docs', 'https://example.com/guide'],
        lastFetchedPages: [{ url: 'https://example.com/guide', title: 'Guide' }],
        lastExpansionPath: ['page_inspection', 'same_domain_search'],
        lastFallbackReason: 'used_fresh_cached_snapshot_after_refresh_timeout',
        lastKnowledgeSummaryHint: 'Resposta baseada em complemento pelo mesmo dominio.',
      },
    });

    expect(snapshot.session.trustedUtterance).toBe('continuar daqui');
    expect(snapshot.session.screenWidth).toBe(1920);
    expect(snapshot.diagnostics.connection).toBe('conectada');
    expect(snapshot.memorySummary).toContain('Usuario: continuar daqui');
    expect(snapshot.knowledge.domain).toBe('example.com');
    expect(snapshot.knowledge.scope).toBe('same_domain');
    expect(snapshot.knowledge.navigationContextAge).toBe('5s');
    expect(snapshot.knowledge.pageSnapshotAge).toBe('3s');
    expect(snapshot.knowledge.initialSufficiency).toBe('partial');
    expect(snapshot.knowledge.sufficiency).toBe('sufficient');
    expect(snapshot.knowledge.refreshMode).toBe('reactive_sse');
    expect(snapshot.knowledge.refreshLatency).toBe('118ms');
    expect(snapshot.knowledge.extensionSeenAge).toBe('1s');
    expect(snapshot.knowledge.expansionPath).toBe('page_inspection -> same_domain_search');
    expect(snapshot.knowledge.fallbackReason).toBe('used_fresh_cached_snapshot_after_refresh_timeout');
    expect(snapshot.knowledge.fetchedPages).toContain('https://example.com/guide');
    expect(snapshot.knowledge.sources).toContain('https://example.com/guide');
  });
});
