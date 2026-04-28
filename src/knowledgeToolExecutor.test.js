import { describe, expect, it, vi } from 'vitest';
import {
  executeKnowledgeFunctionCall,
  isKnowledgeToolName,
  normalizeKnowledgeToolResponse,
} from './knowledgeToolExecutor';

describe('normalizeKnowledgeToolResponse', () => {
  it('normalizes native inspect_current_page artifacts into the JS tool contract', () => {
    const response = normalizeKnowledgeToolResponse('inspect_current_page', {
      ok: true,
      message: 'ok',
      artifacts: {
        context: { url: 'https://example.com', domain: 'example.com' },
        page: { url: 'https://example.com', sections: [] },
        matchedSections: [{ id: 's1' }],
        sufficiency: 'partial',
      },
    });

    expect(response).toMatchObject({
      ok: true,
      message: 'ok',
      sufficiency: 'partial',
      initialScope: 'global',
      finalScope: 'global',
      finalOrigin: 'pagina_atual',
    });
    expect(response.matchedSections).toEqual([{ id: 's1' }]);
    expect(response.matchedLinks).toEqual([]);
  });

  it('normalizes refresh metadata with numeric diagnostics', () => {
    const response = normalizeKnowledgeToolResponse('refresh_current_page_snapshot', {
      ok: true,
      message: 'ok',
      artifacts: {
        requestId: 'capture-1',
        refreshMode: 'reactive_sse',
        refreshLatencyMs: '42',
        extensionSeenAt: '1700000000000',
      },
    });

    expect(response.requestId).toBe('capture-1');
    expect(response.refreshLatencyMs).toBe(42);
    expect(response.extensionSeenAt).toBe(1700000000000);
  });
});

describe('executeKnowledgeFunctionCall', () => {
  it('reports unsupported tool calls without invoking the runtime', async () => {
    const invokeTool = vi.fn();

    const result = await executeKnowledgeFunctionCall({
      functionCall: { name: 'unknown_tool', args: {} },
      invokeTool,
    });

    expect(result.handled).toBe(false);
    expect(result.toolName).toBe('unknown_tool');
    expect(invokeTool).not.toHaveBeenCalled();
  });

  it('executes a supported knowledge tool through the normalized invoke adapter', async () => {
    const invokeTool = vi.fn(async (toolName) => {
      if (toolName === 'get_navigation_context') {
        return {
          ok: true,
          message: 'Contexto disponivel.',
          artifacts: {
            context: {
              url: 'https://example.com/docs',
              domain: 'example.com',
              title: 'Docs',
              timestamp: 123,
            },
          },
        };
      }
      throw new Error(`unexpected tool: ${toolName}`);
    });

    const result = await executeKnowledgeFunctionCall({
      functionCall: { name: 'get_navigation_context', args: {} },
      invokeTool,
    });

    expect(isKnowledgeToolName('get_navigation_context')).toBe(true);
    expect(result.handled).toBe(true);
    expect(result.response.context.domain).toBe('example.com');
    expect(result.statePatch.navigationContext.domain).toBe('example.com');
  });

  it('runs the full inspect flow through refresh, page inspection, search, fetch, state patch and response', async () => {
    const invokeTool = vi.fn(async (toolName, payload = {}) => {
      switch (toolName) {
        case 'refresh_current_page_snapshot':
          return {
            ok: true,
            message: 'refresh ok',
            artifacts: {
              context: {
                url: 'https://example.com/docs',
                domain: 'example.com',
                title: 'Docs',
                timestamp: 1700000000000,
              },
              requestId: 'capture-1',
              refreshMode: 'reactive_sse',
              refreshLatencyMs: 50,
            },
          };
        case 'inspect_current_page':
          return {
            ok: true,
            message: 'inspect ok',
            artifacts: {
              context: {
                url: 'https://example.com/docs',
                domain: 'example.com',
                title: 'Docs',
                timestamp: 1700000000000,
              },
              page: {
                url: 'https://example.com/docs',
                title: 'Docs',
                timestamp: 1700000000000,
                sections: [],
                links: [],
              },
              matchedSections: [],
              matchedLinks: [],
              sufficiency: 'insufficient',
            },
          };
        case 'search_web':
          return {
            ok: true,
            message: 'search ok',
            artifacts: {
              results: [{ title: 'IA', url: 'https://external.dev/ia', snippet: 'inteligencia artificial' }],
            },
          };
        case 'fetch_web_page':
          expect(payload.url).toBe('https://external.dev/ia');
          return {
            ok: true,
            message: 'fetch ok',
            artifacts: {
              page: {
                url: 'https://external.dev/ia',
                title: 'IA',
                sections: [{ id: 's1', heading: '', content: 'inteligencia artificial explicada' }],
                links: [],
              },
            },
          };
        default:
          throw new Error(`unexpected tool: ${toolName}`);
      }
    });

    const result = await executeKnowledgeFunctionCall({
      functionCall: {
        name: 'inspect_current_page',
        args: { question: 'o que e inteligencia artificial?' },
      },
      invokeTool,
    });

    expect(result.handled).toBe(true);
    expect(result.response.initialScope).toBe('global');
    expect(result.response.finalOrigin).toBe('web_geral');
    expect(result.response.consultedSources).toContain('https://external.dev/ia');
    expect(result.statePatch.lastKnowledgeScope).toBe('global');
    expect(result.statePatch.lastKnowledgeOrigin).toBe('web_geral');
    expect(result.statePatch.lastKnowledgeTrace.map((event) => event.step)).toEqual([
      'tool_call_received',
      'refresh_current_page_snapshot',
      'page_inspection',
      'internal_link_follow',
      'same_domain_search',
      'global_search',
    ]);
    expect(invokeTool).toHaveBeenCalledWith('refresh_current_page_snapshot', { timeoutMs: 2000 });
    expect(invokeTool).toHaveBeenCalledWith('inspect_current_page', {
      question: 'o que e inteligencia artificial?',
      maxSections: 4,
    });
    expect(invokeTool).toHaveBeenCalledWith('search_web', {
      query: 'o que e inteligencia artificial?',
      maxResults: 5,
    });
    expect(invokeTool).not.toHaveBeenCalledWith('search_same_domain', expect.anything());
  });
});
