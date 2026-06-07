import { describe, expect, it } from 'vitest';
import { buildDebugHudSnapshot, formatDebugValue, humanizeDebugToken } from './debugHud';

describe('formatDebugValue', () => {
  it('returns a dash for nullish values', () => {
    expect(formatDebugValue(null)).toBe('-');
    expect(formatDebugValue(undefined)).toBe('-');
  });

  it('pretty prints structured values', () => {
    expect(formatDebugValue({ ok: true })).toBe('{\n  "ok": true\n}');
  });
});

describe('humanizeDebugToken', () => {
  it('translates internal knowledge tokens into user-facing labels', () => {
    expect(humanizeDebugToken('page_inspection')).toBe('leitura da pagina');
    expect(humanizeDebugToken('same_domain')).toBe('mesmo site');
    expect(humanizeDebugToken('refresh_failed')).toBe('falha ao atualizar contexto');
  });

  it('uses a friendly fallback for empty values', () => {
    expect(humanizeDebugToken('-')).toBe('Aguardando dados');
    expect(humanizeDebugToken('', 'Sem fontes')).toBe('Sem fontes');
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
        lastVideoFrameWidth: 1280,
        lastVideoFrameHeight: 720,
        lastVideoSourceWidth: 1920,
        lastVideoSourceHeight: 1080,
      },
      memorySummary: 'Usuario: continuar daqui | Alice: Certo.',
      persistenceDiagnostics: {
        sizeBytes: 120000,
        maxBytes: 52428800,
        percentUsed: 45.8,
        nearLimit: false,
        status: 'ok',
        lastMemorySaveAt: '2026-04-28T10:00:00.000Z',
        lastMemorySaveError: '',
        lastError: '',
      },
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
        lastKnowledgeTrace: [
          { step: 'tool_call_received', status: 'done', toolName: 'inspect_current_page' },
          { step: 'refresh_current_page_snapshot', status: 'done', refreshMode: 'reactive_sse' },
          { step: 'same_domain_search', status: 'done', results: 2 },
        ],
        lastFallbackReason: 'used_fresh_cached_snapshot_after_refresh_timeout',
        lastKnowledgeSummaryHint: 'Resposta baseada em complemento pelo mesmo dominio.',
      },
      interactions: [
        {
          id: 'turn-1',
          kind: 'conversation',
          timestamp: 20000,
          status: 'answered',
          userText: 'abra o bloco de notas',
          aliceText: 'Vou abrir.',
        },
        {
          id: 'tool-1',
          kind: 'tool',
          timestamp: 21000,
          status: 'failed',
          toolName: 'inspect_current_page',
          operation: 'open_app',
          ok: false,
          userText: 'abra o bloco de notas',
          message: 'Agente indisponivel.',
          reason: 'tool_failed',
        },
      ],
    });

    expect(snapshot.session.trustedUtterance).toBe('continuar daqui');
    expect(snapshot.session.screenWidth).toBe(1920);
    expect(snapshot.diagnostics.connection).toBe('conectada');
    expect(snapshot.diagnostics.lastVideoFrame).toBe('1280x720');
    expect(snapshot.diagnostics.lastVideoSource).toBe('1920x1080');
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
    expect(snapshot.knowledge.trace).toContain('tool_call_received');
    expect(snapshot.knowledge.trace).toContain('refreshMode=reactive_sse');
    expect(snapshot.knowledge.trace).toContain('same_domain_search');
    expect(snapshot.knowledge.fallbackReason).toBe('used_fresh_cached_snapshot_after_refresh_timeout');
    expect(snapshot.knowledge.fetchedPages).toContain('https://example.com/guide');
    expect(snapshot.knowledge.sources).toContain('https://example.com/guide');
    expect(snapshot.knowledge.display.initialScope).toBe('pagina atual');
    expect(snapshot.knowledge.display.scope).toBe('mesmo site');
    expect(snapshot.knowledge.display.origin).toBe('mesmo site');
    expect(snapshot.knowledge.display.refreshMode).toBe('captura em tempo real');
    expect(snapshot.knowledge.display.fallbackReason).toBe('usou snapshot recente apos timeout');
    expect(snapshot.knowledge.display.expansionSteps).toEqual(['leitura da pagina', 'busca no mesmo site']);
    expect(snapshot).not.toHaveProperty('autonomous');
    expect(snapshot).not.toHaveProperty('runner');
    expect(snapshot).not.toHaveProperty('learningLoop');
    expect(snapshot.persistence.memorySizeBytes).toBe(120000);
    expect(snapshot.persistence.memoryStatus).toBe('ok');
    expect(snapshot.persistence).not.toHaveProperty('lastRunnerEvidenceError');
    expect(snapshot.persistence.lastError).toBe('-');
    expect(snapshot.interactions).toHaveLength(2);
    expect(snapshot.interactions[0]).toMatchObject({
      id: 'tool-1',
      kind: 'tool',
      toolName: 'inspect_current_page',
      ok: false,
      reason: 'tool_failed',
    });
    expect(snapshot.interactions[1]).toMatchObject({
      id: 'turn-1',
      kind: 'conversation',
      userText: 'abra o bloco de notas',
      aliceText: 'Vou abrir.',
    });
  });

});
