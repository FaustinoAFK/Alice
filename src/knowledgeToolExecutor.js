import { executeKnowledgeTool } from './knowledgePipeline';

export const KNOWLEDGE_TOOL_NAMES = [
  'get_navigation_context',
  'inspect_current_page',
  'search_same_domain',
  'search_web',
  'fetch_web_page',
];

export const isKnowledgeToolName = (toolName) => KNOWLEDGE_TOOL_NAMES.includes(toolName);

export const normalizeKnowledgeToolResponse = (toolName, nativeResponse) => {
  const artifacts = nativeResponse?.artifacts || {};

  switch (toolName) {
    case 'get_navigation_context':
      return {
        ok: nativeResponse.ok,
        message: nativeResponse.message,
        context: artifacts.context || null,
      };
    case 'inspect_current_page':
      return {
        ok: nativeResponse.ok,
        message: nativeResponse.message,
        context: artifacts.context || null,
        page: artifacts.page || null,
        matchedSections: artifacts.matchedSections || [],
        matchedLinks: artifacts.matchedLinks || [],
        sufficiency: artifacts.sufficiency || 'insufficient',
        initialScope: artifacts.initialScope || 'global',
        finalScope: artifacts.finalScope || artifacts.initialScope || 'global',
        initialSufficiency: artifacts.initialSufficiency || artifacts.sufficiency || 'insufficient',
        finalSufficiency: artifacts.finalSufficiency || artifacts.sufficiency || 'insufficient',
        finalOrigin: artifacts.finalOrigin || 'pagina_atual',
        consultedSources: artifacts.consultedSources || [],
        expansionPath: artifacts.expansionPath || [],
        responseGuidance: artifacts.responseGuidance || null,
        fallbackReason: artifacts.fallbackReason || '',
      };
    case 'search_same_domain':
    case 'search_web':
      return {
        ok: nativeResponse.ok,
        message: nativeResponse.message,
        query: artifacts.query || '',
        domain: artifacts.domain || '',
        results: artifacts.results || [],
        consultedSources: artifacts.consultedSources || [],
        fetchedPages: artifacts.fetchedPages || [],
        initialScope: artifacts.initialScope || (toolName === 'search_same_domain' ? 'same_domain' : 'global'),
        finalScope: artifacts.finalScope || (toolName === 'search_same_domain' ? 'same_domain' : 'global'),
        initialSufficiency: artifacts.initialSufficiency || 'insufficient',
        finalSufficiency: artifacts.finalSufficiency || 'insufficient',
        finalOrigin: artifacts.finalOrigin || (toolName === 'search_same_domain' ? 'mesmo_dominio' : 'web_geral'),
        expansionPath: artifacts.expansionPath || [],
        responseGuidance: artifacts.responseGuidance || null,
        summaryHint: artifacts.summaryHint || '',
      };
    case 'fetch_web_page':
      return {
        ok: nativeResponse.ok,
        message: nativeResponse.message,
        page: artifacts.page || null,
        consultedSources: artifacts.consultedSources || [],
        responseGuidance: artifacts.responseGuidance || null,
      };
    case 'refresh_current_page_snapshot':
      return {
        ok: nativeResponse.ok,
        message: nativeResponse.message,
        context: artifacts.context || null,
        page: artifacts.page || null,
        requestId: artifacts.requestId || '',
        refreshMode: artifacts.refreshMode || '',
        refreshLatencyMs: Number(artifacts.refreshLatencyMs || 0),
        extensionSeenAt: Number(artifacts.extensionSeenAt || 0),
        fallbackReason: artifacts.fallbackReason || '',
      };
    default:
      return {
        ok: Boolean(nativeResponse?.ok),
        message: nativeResponse?.message || 'Resposta local recebida.',
      };
  }
};

export const executeKnowledgeFunctionCall = async ({
  functionCall,
  trustedUtterance = '',
  knowledgeState,
  invokeTool,
}) => {
  const toolName = functionCall?.name || '';

  if (!isKnowledgeToolName(toolName)) {
    return {
      handled: false,
      toolName,
      response: null,
      statePatch: null,
    };
  }

  const normalizedInvokeTool = async (name, payload = {}) =>
    normalizeKnowledgeToolResponse(name, await invokeTool(name, payload));

  const { response, statePatch } = await executeKnowledgeTool({
    toolName,
    args: functionCall?.args || {},
    trustedUtterance,
    knowledgeState,
    invokeTool: normalizedInvokeTool,
  });

  return {
    handled: true,
    toolName,
    response,
    statePatch,
  };
};
