import { describe, expect, it, vi } from 'vitest';
import { executeKnowledgeTool } from './knowledgePipeline';
import { KNOWLEDGE_SCOPES, KNOWLEDGE_SUFFICIENCY } from '../../webKnowledge';

const buildContext = () => ({
  url: 'https://example.com/docs/page',
  domain: 'example.com',
  title: 'Docs',
  selectionText: '',
  timestamp: Date.now(),
});

const buildPage = (overrides = {}) => ({
  url: 'https://example.com/docs/page',
  title: 'Docs',
  selectedText: '',
  timestamp: Date.now(),
  sections: [{ id: 's1', kind: 'p', heading: '', content: 'Texto parcial sobre integração.' }],
  links: [],
  ...overrides,
});

describe('executeKnowledgeTool', () => {
  it('refreshes the page snapshot before inspecting it', async () => {
    const invokeTool = vi.fn(async (toolName) => {
      switch (toolName) {
        case 'refresh_current_page_snapshot':
          return {
            ok: true,
            context: buildContext(),
            page: buildPage(),
            requestId: 'capture-1',
            refreshMode: 'reactive_sse',
            refreshLatencyMs: 120,
            extensionSeenAt: 1700000000000,
            fallbackReason: '',
          };
        case 'inspect_current_page':
          return {
            ok: true,
            context: buildContext(),
            page: buildPage(),
            matchedSections: [],
            matchedLinks: [],
            sufficiency: KNOWLEDGE_SUFFICIENCY.SUFFICIENT,
          };
        default:
          throw new Error(`unexpected tool: ${toolName}`);
      }
    });

    const { response, statePatch } = await executeKnowledgeTool({
      toolName: 'inspect_current_page',
      args: { question: 'resume isso pra mim' },
      invokeTool,
    });

    expect(invokeTool).toHaveBeenNthCalledWith(1, 'refresh_current_page_snapshot', {
      timeoutMs: 2000,
    });
    expect(invokeTool).toHaveBeenNthCalledWith(2, 'inspect_current_page', {
      question: 'resume isso pra mim',
      maxSections: 4,
    });
    expect(response.refresh.requestId).toBe('capture-1');
    expect(response.refresh.refreshMode).toBe('reactive_sse');
    expect(statePatch.lastSnapshotRefreshMode).toBe('reactive_sse');
    expect(statePatch.lastSnapshotRefreshLatencyMs).toBe(120);
  });

  it('does not expand beyond the current page when inspect_current_page is already sufficient', async () => {
    const invokeTool = vi.fn(async (toolName) => {
      switch (toolName) {
        case 'refresh_current_page_snapshot':
          return {
            ok: true,
            context: buildContext(),
            page: buildPage(),
            requestId: 'capture-1',
            refreshMode: 'reactive_sse',
            refreshLatencyMs: 90,
            extensionSeenAt: Date.now(),
            fallbackReason: '',
          };
        case 'inspect_current_page':
          return {
            ok: true,
            context: buildContext(),
            page: buildPage(),
            matchedSections: [{ id: 's1', kind: 'p', heading: '', content: 'Texto suficiente.' }],
            matchedLinks: [],
            sufficiency: KNOWLEDGE_SUFFICIENCY.SUFFICIENT,
          };
        default:
          throw new Error(`unexpected tool: ${toolName}`);
      }
    });

    const { response, statePatch } = await executeKnowledgeTool({
      toolName: 'inspect_current_page',
      args: { question: 'onde fica a area de inteligencia artificial nessa pagina?' },
      invokeTool,
    });

    expect(response.initialScope).toBe(KNOWLEDGE_SCOPES.CURRENT_PAGE);
    expect(response.expansion.expansionPath).toEqual(['page_inspection']);
    expect(response.finalOrigin).toBe('pagina_atual');
    expect(response.finalScope).toBe(KNOWLEDGE_SCOPES.CURRENT_PAGE);
    expect(statePatch.lastKnowledgeOrigin).toBe('pagina_atual');
    expect(invokeTool).not.toHaveBeenCalledWith('search_same_domain', expect.anything());
    expect(invokeTool).not.toHaveBeenCalledWith('search_web', expect.anything());
  });

  it('follows relevant internal links before same-domain search for partial page answers', async () => {
    const invokeTool = vi.fn(async (toolName, payload) => {
      switch (toolName) {
        case 'refresh_current_page_snapshot':
          return {
            ok: true,
            context: buildContext(),
            page: buildPage(),
            requestId: 'capture-1',
            fallbackReason: '',
          };
        case 'inspect_current_page':
          return {
            ok: true,
            context: buildContext(),
            page: buildPage({
              links: [
                { text: 'Guia de integração', url: 'https://example.com/guide/integracao' },
                { text: 'Login', url: 'https://example.com/login' },
              ],
            }),
            matchedSections: [],
            matchedLinks: [{ text: 'Guia de integração', url: 'https://example.com/guide/integracao' }],
            sufficiency: KNOWLEDGE_SUFFICIENCY.PARTIAL,
          };
        case 'fetch_web_page':
          return {
            ok: true,
            page: {
              url: payload.url,
              title: 'Guia',
              sections: [
                {
                  id: 's2',
                  kind: 'p',
                  heading: 'Integração',
                  content: 'Integração com IA e autenticação prática.',
                },
              ],
              links: [],
            },
          };
        default:
          throw new Error(`unexpected tool: ${toolName}`);
      }
    });

    const { response, statePatch } = await executeKnowledgeTool({
      toolName: 'inspect_current_page',
      args: { question: 'essa pagina tem integracao com autenticacao?' },
      invokeTool,
    });

    expect(response.expansion.expansionPath).toContain('internal_link_follow');
    expect(response.expansion.expansionPath).not.toContain('same_domain_search');
    expect(response.finalOrigin).toBe('links_internos');
    expect(response.finalSufficiency).toBe(KNOWLEDGE_SUFFICIENCY.SUFFICIENT);
    expect(statePatch.lastKnowledgeOrigin).toBe('links_internos');
    expect(statePatch.lastKnowledgeSources).toContain('https://example.com/guide/integracao');
    expect(invokeTool).not.toHaveBeenCalledWith('search_same_domain', expect.anything());
  });

  it('ignores generic navigation links when selecting internal links', async () => {
    const invokeTool = vi.fn(async (toolName) => {
      switch (toolName) {
        case 'refresh_current_page_snapshot':
          return { ok: true, context: buildContext(), page: buildPage(), requestId: 'capture-1', fallbackReason: '' };
        case 'inspect_current_page':
          return {
            ok: true,
            context: buildContext(),
            page: buildPage({
              links: [
                { text: 'Login', url: 'https://example.com/login' },
                { text: 'Pricing', url: 'https://example.com/pricing' },
                { text: 'Integração OAuth', url: 'https://example.com/docs/oauth' },
              ],
            }),
            matchedSections: [],
            matchedLinks: [],
            sufficiency: KNOWLEDGE_SUFFICIENCY.PARTIAL,
          };
        case 'fetch_web_page':
          return { ok: true, page: { url: 'https://example.com/docs/oauth', title: 'OAuth', sections: [], links: [] } };
        case 'search_same_domain':
          return { ok: true, results: [] };
        case 'search_web':
          return { ok: true, results: [] };
        default:
          throw new Error(`unexpected tool: ${toolName}`);
      }
    });

    const { response } = await executeKnowledgeTool({
      toolName: 'inspect_current_page',
      args: { question: 'essa pagina fala sobre integracao oauth?' },
      invokeTool,
    });

    expect(response.expansion.internalLinkCandidates).toEqual([
      { text: 'Integração OAuth', url: 'https://example.com/docs/oauth' },
    ]);
  });

  it('expands to same-domain and global when the page and internal links are insufficient', async () => {
    const invokeTool = vi.fn(async (toolName, payload) => {
      switch (toolName) {
        case 'refresh_current_page_snapshot':
          return { ok: true, context: buildContext(), page: buildPage(), requestId: 'capture-1', fallbackReason: '' };
        case 'inspect_current_page':
          return {
            ok: true,
            context: buildContext(),
            page: buildPage(),
            matchedSections: [],
            matchedLinks: [],
            sufficiency: KNOWLEDGE_SUFFICIENCY.INSUFFICIENT,
          };
        case 'search_same_domain':
          return {
            ok: true,
            results: [{ title: 'Site Guide', url: 'https://example.com/guide', snippet: 'Guide' }],
          };
        case 'search_web':
          return {
            ok: true,
            results: [{ title: 'Global Guide', url: 'https://external.dev/guide', snippet: 'Guide' }],
          };
        case 'fetch_web_page':
          if (payload.url === 'https://example.com/guide') {
            return { ok: true, page: { url: payload.url, title: 'Guide', sections: [], links: [] } };
          }
          return {
            ok: true,
            page: {
              url: payload.url,
              title: 'Global Guide',
              sections: [{ id: 's9', kind: 'p', heading: 'Answer', content: 'retrieval augmented generation em detalhes' }],
              links: [],
            },
          };
        default:
          throw new Error(`unexpected tool: ${toolName}`);
      }
    });

    const { response, statePatch } = await executeKnowledgeTool({
      toolName: 'inspect_current_page',
      args: { question: 'o que isso significa sobre retrieval augmented generation?' },
      invokeTool,
    });

    expect(response.expansion.expansionPath).toEqual([
      'page_inspection',
      'same_domain_search',
      'global_search',
    ]);
    expect(response.finalOrigin).toBe('web_geral');
    expect(response.finalScope).toBe(KNOWLEDGE_SCOPES.GLOBAL);
    expect(response.responseGuidance.answerMode).toBe('page_plus_web');
    expect(statePatch.lastKnowledgeScope).toBe(KNOWLEDGE_SCOPES.GLOBAL);
  });

  it('does not inherit the active domain for clearly global questions', async () => {
    const invokeTool = vi.fn(async (toolName, payload) => {
      switch (toolName) {
        case 'refresh_current_page_snapshot':
          return { ok: true, context: buildContext(), page: buildPage(), requestId: 'capture-1', fallbackReason: '' };
        case 'inspect_current_page':
          return {
            ok: true,
            context: buildContext(),
            page: buildPage({
              sections: [{ id: 's1', kind: 'p', heading: '', content: 'Inteligencia artificial na pagina atual.' }],
            }),
            matchedSections: [{ id: 's1', kind: 'p', heading: '', content: 'Inteligencia artificial na pagina atual.' }],
            matchedLinks: [{ text: 'IA local', url: 'https://example.com/ia' }],
            sufficiency: KNOWLEDGE_SUFFICIENCY.SUFFICIENT,
          };
        case 'search_web':
          return {
            ok: true,
            results: [{ title: 'IA geral', url: 'https://external.dev/ia', snippet: 'Conceito geral' }],
          };
        case 'fetch_web_page':
          return {
            ok: true,
            page: {
              url: payload.url,
              title: 'IA geral',
              sections: [{ id: 's2', kind: 'p', heading: '', content: 'inteligencia artificial conceito geral' }],
              links: [],
            },
          };
        default:
          throw new Error(`unexpected tool: ${toolName}`);
      }
    });

    const { response, statePatch } = await executeKnowledgeTool({
      toolName: 'inspect_current_page',
      args: { question: 'o que e inteligencia artificial?' },
      invokeTool,
    });

    expect(response.initialScope).toBe(KNOWLEDGE_SCOPES.GLOBAL);
    expect(response.expansion.expansionPath).toEqual(['page_inspection', 'global_search']);
    expect(response.finalOrigin).toBe('web_geral');
    expect(response.finalScope).toBe(KNOWLEDGE_SCOPES.GLOBAL);
    expect(response.responseGuidance.answerMode).toBe('search_only');
    expect(statePatch.lastKnowledgeTrace.map((event) => event.step)).toEqual([
      'tool_call_received',
      'refresh_current_page_snapshot',
      'page_inspection',
      'internal_link_follow',
      'same_domain_search',
      'global_search',
    ]);
    expect(invokeTool).not.toHaveBeenCalledWith('search_same_domain', expect.anything());
    expect(invokeTool).not.toHaveBeenCalledWith('fetch_web_page', { url: 'https://example.com/ia' });
  });

  it('adds response guidance and metadata to direct searches', async () => {
    const invokeTool = vi.fn(async (toolName) => {
      switch (toolName) {
        case 'search_web':
          return {
            ok: true,
            results: [{ title: 'Result', url: 'https://site.dev/result', snippet: 'Snippet' }],
          };
        case 'fetch_web_page':
          return {
            ok: true,
            page: {
              url: 'https://site.dev/result',
              title: 'Result',
              sections: [{ id: 's1', kind: 'p', heading: '', content: 'Fetched result' }],
              links: [],
            },
          };
        default:
          throw new Error(`unexpected tool: ${toolName}`);
      }
    });

    const { response, statePatch } = await executeKnowledgeTool({
      toolName: 'search_web',
      args: { query: 'retrieval augmented generation' },
      invokeTool,
    });

    expect(response.responseGuidance.answerMode).toBe('search_only');
    expect(response.responseGuidance.shouldCiteSources).toBe(true);
    expect(response.consultedSources).toEqual(['https://site.dev/result']);
    expect(statePatch.lastKnowledgeSummaryHint).toContain('web geral');
  });

  it('continues processing remaining fetch URLs when one individual fetch fails', async () => {
    const invokeTool = vi.fn(async (toolName, payload) => {
      switch (toolName) {
        case 'search_web':
          return {
            ok: true,
            results: [
              { title: 'Pagina A', url: 'https://example.com/a', snippet: 'Trecho A' },
              { title: 'Pagina B', url: 'https://example.com/b', snippet: 'Trecho B' },
            ],
          };
        case 'fetch_web_page':
          if (payload.url === 'https://example.com/a') {
            throw new Error('fetch falhou para pagina A');
          }
          return {
            ok: true,
            page: {
              url: payload.url,
              title: 'Pagina B',
              sections: [{ id: 's1', kind: 'p', heading: '', content: 'Conteudo da pagina B.' }],
              links: [],
            },
          };
        default:
          throw new Error(`unexpected tool: ${toolName}`);
      }
    });

    const { response } = await executeKnowledgeTool({
      toolName: 'search_web',
      args: { query: 'exemplo de busca web' },
      invokeTool,
    });

    const fetchedUrls = (response.fetchedPages || []).map((p) => p.url);
    expect(fetchedUrls).not.toContain('https://example.com/a');
    expect(fetchedUrls).toContain('https://example.com/b');
  });

  it('records fallback metadata and continues the pipeline when the extension is offline', async () => {
    const invokeTool = vi.fn(async (toolName) => {
      switch (toolName) {
        case 'refresh_current_page_snapshot':
          return {
            ok: false,
            fallbackReason: 'extension_offline',
            refreshMode: 'fallback_cached',
          };
        case 'inspect_current_page':
          return {
            ok: true,
            context: buildContext(),
            page: buildPage(),
            matchedSections: [],
            matchedLinks: [],
            sufficiency: KNOWLEDGE_SUFFICIENCY.PARTIAL,
          };
        case 'search_same_domain':
          return { ok: true, results: [] };
        case 'search_web':
          return { ok: true, results: [] };
        default:
          throw new Error(`unexpected tool: ${toolName}`);
      }
    });

    const { statePatch } = await executeKnowledgeTool({
      toolName: 'inspect_current_page',
      args: { question: 'o que tem nessa pagina?' },
      invokeTool,
    });

    expect(statePatch.lastSnapshotRefreshMode).toBe('fallback_cached');
    expect(statePatch.lastFallbackReason).toBe('extension_offline');
    // pipeline nao abortou — inspect_current_page foi chamado apos o refresh falhar
    expect(invokeTool).toHaveBeenCalledWith('inspect_current_page', expect.anything());
  });
});
