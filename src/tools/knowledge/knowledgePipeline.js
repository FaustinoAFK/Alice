import {
  classifyKnowledgeScope,
  createEmptyKnowledgeState,
  extractKnowledgeTerms,
  isPageSummaryIntent,
  KNOWLEDGE_SCOPES,
  KNOWLEDGE_SUFFICIENCY,
  normalizeNavigationContext,
} from '../../webKnowledge';

const DEFAULT_MAX_SECTIONS = 4;
const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_REFRESH_TIMEOUT_MS = 2000;
const MAX_INTERNAL_LINK_FETCHES = 3;
const MAX_SAME_DOMAIN_FETCHES = 2;
const MAX_GLOBAL_FETCHES = 2;
const GENERIC_NAVIGATION_TOKENS = new Set([
  'home',
  'inicio',
  'login',
  'entrar',
  'signup',
  'register',
  'pricing',
  'precos',
  'menu',
  'contact',
  'contato',
]);

const normalizeComparableText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const clampCount = (value, fallback, minimum, maximum) => {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(normalized)));
};

const canonicalizeUrl = (value) => {
  try {
    const url = new URL(String(value || '').trim());
    url.hash = '';
    return url.toString();
  } catch {
    return String(value || '').trim();
  }
};

const getDomain = (value) => {
  try {
    return new URL(String(value || '').trim()).hostname;
  } catch {
    return '';
  }
};

const uniqueStrings = (values) => [
  ...new Set(
    values
      .filter(Boolean)
      .map((value) => String(value).trim())
      .filter(Boolean),
  ),
];

const createTraceEvent = (step, fields = {}) => ({
  step,
  status: fields.status || 'done',
  ...fields,
});

const createToolCallTrace = ({ toolName, question }) =>
  createTraceEvent('tool_call_received', {
    toolName,
    question,
  });

const createRefreshTrace = (refreshResponse = null) =>
  createTraceEvent('refresh_current_page_snapshot', {
    status: refreshResponse?.ok ? 'done' : 'failed',
    refreshMode: refreshResponse?.refreshMode || (refreshResponse?.ok ? '' : 'refresh_failed'),
    latencyMs: Number(refreshResponse?.refreshLatencyMs || 0),
    fallbackReason: refreshResponse?.fallbackReason || '',
  });

const buildAnswerMode = ({ initialScope, finalOrigin, usedInternalLinks }) => {
  if (initialScope === KNOWLEDGE_SCOPES.GLOBAL && finalOrigin === 'web_geral') {
    return 'search_only';
  }
  if (usedInternalLinks) {
    return 'page_plus_internal_links';
  }
  if (finalOrigin === 'mesmo_dominio') {
    return 'page_plus_same_domain';
  }
  if (finalOrigin === 'web_geral') {
    return 'page_plus_web';
  }
  return 'page_only';
};

const buildResponseGuidance = ({
  initialScope,
  finalOrigin,
  consultedSources,
  fallbackReason,
  usedInternalLinks,
}) => ({
  answerMode: buildAnswerMode({ initialScope, finalOrigin, usedInternalLinks }),
  shouldCiteSources: consultedSources.length > 0 && finalOrigin !== 'pagina_atual',
  shouldExplainOrigin: finalOrigin !== 'pagina_atual' || Boolean(fallbackReason),
});

const buildSummaryHint = ({ finalOrigin, finalSufficiency, fallbackReason }) => {
  const originCopy =
    finalOrigin === 'links_internos'
      ? 'complemento por links internos'
      : finalOrigin === 'mesmo_dominio'
        ? 'complemento pelo mesmo dominio'
        : finalOrigin === 'web_geral'
          ? 'complemento pela web geral'
          : 'pagina atual';

  const fallbackCopy = fallbackReason ? ` com fallback (${fallbackReason})` : '';
  return `Resposta baseada em ${originCopy} com suficiência ${finalSufficiency}${fallbackCopy}.`;
};

const buildFetchedPages = async ({ results, invokeTool, limit }) => {
  const fetchedPages = [];

  for (const result of results.slice(0, limit)) {
    const pageResponse = await invokeTool('fetch_web_page', {
      url: result.url,
    });
    if (pageResponse?.ok && pageResponse.page) {
      fetchedPages.push({
        url: pageResponse.page.url,
        title: pageResponse.page.title,
        sections: pageResponse.page.sections || [],
        links: pageResponse.page.links || [],
      });
    }
  }

  return fetchedPages;
};

const scoreFetchedPage = ({ page, terms, isSummaryQuestion }) => {
  if (!page) {
    return 0;
  }

  const haystacks = [
    String(page.title || ''),
    ...(page.sections || []).map((section) => `${section.heading || ''} ${section.content || ''}`),
  ]
    .join(' ');
  const normalizedHaystack = normalizeComparableText(haystacks);

  if (isSummaryQuestion && (page.sections || []).length > 0) {
    return 2;
  }

  return terms.reduce((score, term) => score + (normalizedHaystack.includes(term) ? 1 : 0), 0);
};

const determineFetchedPagesSufficiency = ({ pages, question }) => {
  if (!Array.isArray(pages) || pages.length === 0) {
    return KNOWLEDGE_SUFFICIENCY.INSUFFICIENT;
  }

  const terms = extractKnowledgeTerms(question);
  const isSummaryQuestion = isPageSummaryIntent(question);
  const topScore = Math.max(
    ...pages.map((page) => scoreFetchedPage({ page, terms, isSummaryQuestion })),
    0,
  );

  if (topScore >= 2) {
    return KNOWLEDGE_SUFFICIENCY.SUFFICIENT;
  }

  if (topScore >= 1 && terms.length <= 2) {
    return KNOWLEDGE_SUFFICIENCY.SUFFICIENT;
  }

  return KNOWLEDGE_SUFFICIENCY.PARTIAL;
};

const scoreLinkCandidate = ({ link, questionTerms, domain }) => {
  const canonicalUrl = canonicalizeUrl(link.url);
  const linkDomain = getDomain(canonicalUrl);
  if (!canonicalUrl || (domain && linkDomain && linkDomain !== domain)) {
    return -1;
  }

  const linkText = String(link.text || '').toLowerCase();
  const urlText = canonicalUrl.toLowerCase();
  const normalizedLinkText = normalizeComparableText(linkText);
  const normalizedUrlText = normalizeComparableText(urlText);

  if (
    !questionTerms.some((term) => normalizedLinkText.includes(term) || normalizedUrlText.includes(term)) &&
    !isPageSummaryIntent(questionTerms.join(' '))
  ) {
    return 0;
  }

  if ([...GENERIC_NAVIGATION_TOKENS].some((token) => linkText === token || urlText.includes(`/${token}`))) {
    return -1;
  }

  const termScore = questionTerms.reduce(
    (score, term) =>
      score +
      (normalizedLinkText.includes(term) ? 3 : 0) +
      (normalizedUrlText.includes(term) ? 1 : 0),
    0,
  );
  const sameDomainBonus = linkDomain && domain && linkDomain === domain ? 3 : 0;
  return termScore + sameDomainBonus;
};

const selectInternalLinkCandidates = ({ inspectResponse, question, domain }) => {
  const questionTerms = extractKnowledgeTerms(question);
  const candidates = [
    ...(inspectResponse.matchedLinks || []),
    ...((inspectResponse.page?.links) || []),
  ]
    .map((link) => ({
      link,
      score: scoreLinkCandidate({
        link,
        questionTerms,
        domain,
      }),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  const seen = new Set();
  const selected = [];

  for (const candidate of candidates) {
    const canonicalUrl = canonicalizeUrl(candidate.link.url);
    if (!canonicalUrl || seen.has(canonicalUrl)) {
      continue;
    }
    seen.add(canonicalUrl);
    selected.push({
      text: candidate.link.text,
      url: canonicalUrl,
    });
    if (selected.length >= MAX_INTERNAL_LINK_FETCHES) {
      break;
    }
  }

  return selected;
};

const buildExpandedInspection = async ({
  question,
  initialScope,
  inspectResponse,
  navigationContext,
  maxResults,
  invokeTool,
}) => {
  const consultedSources = uniqueStrings([inspectResponse.page?.url]);
  const expansionPath = ['page_inspection'];
  const expansion = {
    initialScope,
    initialSufficiency: inspectResponse.sufficiency || KNOWLEDGE_SUFFICIENCY.INSUFFICIENT,
    finalScope: initialScope,
    finalOrigin: 'pagina_atual',
    finalSufficiency: inspectResponse.sufficiency || KNOWLEDGE_SUFFICIENCY.INSUFFICIENT,
    consultedSources,
    expansionPath,
    fallbackReason: inspectResponse.fallbackReason || '',
    internalLinkCandidates: [],
    internalLinkPages: [],
    sameDomainResults: [],
    sameDomainPages: [],
    globalResults: [],
    globalPages: [],
    trace: [
      createTraceEvent('page_inspection', {
        status: inspectResponse.ok ? 'done' : 'failed',
        sufficiency: inspectResponse.sufficiency || KNOWLEDGE_SUFFICIENCY.INSUFFICIENT,
      }),
    ],
  };

  if (!inspectResponse.ok) {
    return expansion;
  }

  if (
    inspectResponse.sufficiency === KNOWLEDGE_SUFFICIENCY.SUFFICIENT &&
    initialScope !== KNOWLEDGE_SCOPES.GLOBAL
  ) {
    return expansion;
  }

  const domain = navigationContext?.domain || '';
  const internalLinks = selectInternalLinkCandidates({
    inspectResponse,
    question,
    domain,
  });

  if (
    initialScope !== KNOWLEDGE_SCOPES.GLOBAL &&
    inspectResponse.sufficiency !== KNOWLEDGE_SUFFICIENCY.SUFFICIENT &&
    internalLinks.length > 0
  ) {
    expansionPath.push('internal_link_follow');
    expansion.internalLinkCandidates = internalLinks;
    expansion.internalLinkPages = await buildFetchedPages({
      results: internalLinks,
      invokeTool,
      limit: MAX_INTERNAL_LINK_FETCHES,
    });
    expansion.consultedSources = uniqueStrings([
      ...expansion.consultedSources,
      ...internalLinks.map((link) => link.url),
      ...expansion.internalLinkPages.map((page) => page.url),
    ]);

    const internalSufficiency = determineFetchedPagesSufficiency({
      pages: expansion.internalLinkPages,
      question,
    });
    expansion.trace.push(
      createTraceEvent('internal_link_follow', {
        fetchedPages: expansion.internalLinkPages.length,
        sufficiency: internalSufficiency,
      }),
    );
    if (internalSufficiency === KNOWLEDGE_SUFFICIENCY.SUFFICIENT) {
      expansion.finalScope = KNOWLEDGE_SCOPES.SAME_DOMAIN;
      expansion.finalOrigin = 'links_internos';
      expansion.finalSufficiency = KNOWLEDGE_SUFFICIENCY.SUFFICIENT;
      return expansion;
    }

    if (internalSufficiency === KNOWLEDGE_SUFFICIENCY.PARTIAL) {
      expansion.finalScope = KNOWLEDGE_SCOPES.SAME_DOMAIN;
      expansion.finalOrigin = 'links_internos';
      expansion.finalSufficiency = KNOWLEDGE_SUFFICIENCY.PARTIAL;
    }
  } else if (
    initialScope !== KNOWLEDGE_SCOPES.GLOBAL &&
    inspectResponse.sufficiency !== KNOWLEDGE_SUFFICIENCY.SUFFICIENT
  ) {
    expansion.trace.push(
      createTraceEvent('internal_link_follow', {
        status: 'skipped',
        reason: 'no_relevant_internal_links',
      }),
    );
  } else if (initialScope === KNOWLEDGE_SCOPES.GLOBAL) {
    expansion.trace.push(
      createTraceEvent('internal_link_follow', {
        status: 'skipped',
        reason: 'global_scope',
      }),
    );
  }

  const shouldRunSameDomain =
    initialScope === KNOWLEDGE_SCOPES.SAME_DOMAIN ||
    (initialScope === KNOWLEDGE_SCOPES.CURRENT_PAGE &&
      expansion.finalSufficiency !== KNOWLEDGE_SUFFICIENCY.SUFFICIENT);

  if (shouldRunSameDomain && domain) {
    expansionPath.push('same_domain_search');
    const sameDomainResponse = await invokeTool('search_same_domain', {
      query: question,
      domain,
      maxResults,
    });
    expansion.sameDomainResults = sameDomainResponse?.results || [];
    expansion.sameDomainPages = await buildFetchedPages({
      results: expansion.sameDomainResults,
      invokeTool,
      limit: MAX_SAME_DOMAIN_FETCHES,
    });
    expansion.consultedSources = uniqueStrings([
      ...expansion.consultedSources,
      ...expansion.sameDomainResults.map((item) => item.url),
      ...expansion.sameDomainPages.map((page) => page.url),
    ]);

    const sameDomainSufficiency = determineFetchedPagesSufficiency({
      pages: expansion.sameDomainPages,
      question,
    });
    expansion.trace.push(
      createTraceEvent('same_domain_search', {
        results: expansion.sameDomainResults.length,
        fetchedPages: expansion.sameDomainPages.length,
        sufficiency: sameDomainSufficiency,
      }),
    );
    if (sameDomainSufficiency === KNOWLEDGE_SUFFICIENCY.SUFFICIENT) {
      expansion.finalScope = KNOWLEDGE_SCOPES.SAME_DOMAIN;
      expansion.finalOrigin = 'mesmo_dominio';
      expansion.finalSufficiency = KNOWLEDGE_SUFFICIENCY.SUFFICIENT;
      return expansion;
    }

    if (sameDomainSufficiency === KNOWLEDGE_SUFFICIENCY.PARTIAL) {
      expansion.finalScope = KNOWLEDGE_SCOPES.SAME_DOMAIN;
      expansion.finalOrigin = 'mesmo_dominio';
      expansion.finalSufficiency = KNOWLEDGE_SUFFICIENCY.PARTIAL;
    }
  } else if (initialScope === KNOWLEDGE_SCOPES.GLOBAL) {
    expansion.trace.push(
      createTraceEvent('same_domain_search', {
        status: 'skipped',
        reason: 'global_scope',
      }),
    );
  } else if (shouldRunSameDomain && !domain) {
    expansion.trace.push(
      createTraceEvent('same_domain_search', {
        status: 'skipped',
        reason: 'missing_domain',
      }),
    );
  }

  const shouldRunGlobal =
    initialScope === KNOWLEDGE_SCOPES.GLOBAL ||
    expansion.finalSufficiency !== KNOWLEDGE_SUFFICIENCY.SUFFICIENT;

  if (shouldRunGlobal) {
    expansionPath.push('global_search');
    const globalResponse = await invokeTool('search_web', {
      query: question,
      maxResults,
    });
    expansion.globalResults = globalResponse?.results || [];
    expansion.globalPages = await buildFetchedPages({
      results: expansion.globalResults,
      invokeTool,
      limit: MAX_GLOBAL_FETCHES,
    });
    expansion.consultedSources = uniqueStrings([
      ...expansion.consultedSources,
      ...expansion.globalResults.map((item) => item.url),
      ...expansion.globalPages.map((page) => page.url),
    ]);

    const globalSufficiency = determineFetchedPagesSufficiency({
      pages: expansion.globalPages,
      question,
    });
    expansion.trace.push(
      createTraceEvent('global_search', {
        results: expansion.globalResults.length,
        fetchedPages: expansion.globalPages.length,
        sufficiency: globalSufficiency,
      }),
    );
    if (globalSufficiency !== KNOWLEDGE_SUFFICIENCY.INSUFFICIENT) {
      expansion.finalScope = KNOWLEDGE_SCOPES.GLOBAL;
      expansion.finalOrigin = 'web_geral';
      expansion.finalSufficiency = globalSufficiency;
      return expansion;
    }

    if (initialScope === KNOWLEDGE_SCOPES.GLOBAL) {
      expansion.finalScope = KNOWLEDGE_SCOPES.GLOBAL;
      expansion.finalOrigin = 'web_geral';
      expansion.finalSufficiency = KNOWLEDGE_SUFFICIENCY.INSUFFICIENT;
    }
  }

  return expansion;
};

const buildSearchResponse = async ({ toolName, baseResponse, invokeTool, query }) => {
  const limit =
    toolName === 'search_same_domain' ? MAX_SAME_DOMAIN_FETCHES : MAX_GLOBAL_FETCHES;
  const fetchedPages = await buildFetchedPages({
    results: baseResponse.results || [],
    invokeTool,
    limit,
  });
  const consultedSources = uniqueStrings([
    ...(baseResponse.results || []).map((item) => item.url),
    ...fetchedPages.map((page) => page.url),
  ]);
  const finalOrigin = toolName === 'search_same_domain' ? 'mesmo_dominio' : 'web_geral';
  const finalScope =
    toolName === 'search_same_domain' ? KNOWLEDGE_SCOPES.SAME_DOMAIN : KNOWLEDGE_SCOPES.GLOBAL;
  const finalSufficiency = determineFetchedPagesSufficiency({
    pages: fetchedPages,
    question: query,
  });

  return {
    ...baseResponse,
    fetchedPages,
    initialScope: finalScope,
    finalScope,
    initialSufficiency: finalSufficiency,
    finalSufficiency,
    finalOrigin,
    consultedSources,
    expansionPath: [toolName === 'search_same_domain' ? 'same_domain_search' : 'global_search'],
    responseGuidance: buildResponseGuidance({
      initialScope: finalScope,
      finalOrigin,
      consultedSources,
      fallbackReason: '',
      usedInternalLinks: false,
    }),
    summaryHint: buildSummaryHint({
      finalOrigin,
      finalSufficiency,
      fallbackReason: '',
    }),
    operationalTrace: [
      createToolCallTrace({ toolName, question: query }),
      createTraceEvent(toolName === 'search_same_domain' ? 'same_domain_search' : 'global_search', {
        results: baseResponse.results?.length || 0,
        fetchedPages: fetchedPages.length,
        sufficiency: finalSufficiency,
      }),
    ],
  };
};

export const executeKnowledgeTool = async ({
  toolName,
  args = {},
  trustedUtterance = '',
  knowledgeState = createEmptyKnowledgeState(),
  invokeTool,
}) => {
  const question = String(args.question || trustedUtterance || '').trim();
  const maxSections = clampCount(args.maxSections, DEFAULT_MAX_SECTIONS, 1, 8);
  const maxResults = clampCount(args.maxResults, DEFAULT_MAX_RESULTS, 1, 10);
  const currentState = knowledgeState || createEmptyKnowledgeState();
  const currentContext = normalizeNavigationContext(currentState.navigationContext);

  switch (toolName) {
    case 'get_navigation_context': {
      const response = await invokeTool(toolName, {});
      return {
        response,
        statePatch: response.ok
          ? {
              navigationContext: normalizeNavigationContext(response.context),
              navigationContextCapturedAt: Number(response.context?.timestamp || Date.now()),
              lastKnowledgeOrigin: 'pagina_atual',
            }
          : {
              navigationContext: null,
              pageSnapshot: null,
              navigationContextCapturedAt: 0,
              pageSnapshotCapturedAt: 0,
              lastKnowledgeOrigin: '-',
            },
      };
    }

    case 'inspect_current_page': {
      const refreshResponse = await invokeTool('refresh_current_page_snapshot', {
        timeoutMs: DEFAULT_REFRESH_TIMEOUT_MS,
      });
      const inspectResponse = await invokeTool(toolName, {
        question,
        maxSections,
      });
      const navigationContext =
        normalizeNavigationContext(inspectResponse.context) ||
        normalizeNavigationContext(refreshResponse.context) ||
        currentContext;
      const initialScope = classifyKnowledgeScope({
        question,
        navigationContext,
      });
      const expansion = await buildExpandedInspection({
        question,
        initialScope,
        inspectResponse: {
          ...inspectResponse,
          fallbackReason: refreshResponse?.fallbackReason || '',
        },
        navigationContext,
        maxResults,
        invokeTool,
      });

      const consultedSources = expansion.consultedSources;
      const responseGuidance = buildResponseGuidance({
        initialScope,
        finalOrigin: expansion.finalOrigin,
        consultedSources,
        fallbackReason: expansion.fallbackReason,
        usedInternalLinks: expansion.expansionPath.includes('internal_link_follow'),
      });
      const operationalTrace = [
        createToolCallTrace({ toolName, question }),
        createRefreshTrace(refreshResponse),
        ...expansion.trace,
      ];

      const response = {
        ...inspectResponse,
        refresh: refreshResponse,
        initialScope,
        finalScope: expansion.finalScope,
        initialSufficiency: expansion.initialSufficiency,
        finalSufficiency: expansion.finalSufficiency,
        finalOrigin: expansion.finalOrigin,
        consultedSources,
        expansionPath: expansion.expansionPath,
        fallbackReason: expansion.fallbackReason,
        responseGuidance,
        operationalTrace,
        summaryHint: buildSummaryHint({
          finalOrigin: expansion.finalOrigin,
          finalSufficiency: expansion.finalSufficiency,
          fallbackReason: expansion.fallbackReason,
        }),
        expansion,
      };

      return {
        response,
        statePatch: inspectResponse.ok
          ? {
              navigationContext,
              navigationContextCapturedAt:
                Number(navigationContext?.timestamp || Date.now()),
              pageSnapshot: inspectResponse.page || null,
              pageSnapshotCapturedAt: Number(inspectResponse.page?.timestamp || Date.now()),
              pageSnapshotUpdatedAt: Date.now(),
              initialKnowledgeScope: initialScope,
              initialKnowledgeSufficiency: expansion.initialSufficiency,
              lastKnowledgeScope: expansion.finalScope,
              lastKnowledgeSufficiency: expansion.finalSufficiency,
              lastUserSelectionText:
                inspectResponse.page?.selectedText ||
                navigationContext?.selectionText ||
                '',
              lastKnowledgeOrigin: expansion.finalOrigin,
              lastKnowledgeSources: consultedSources,
              lastFetchedPages: [
                ...expansion.internalLinkPages,
                ...expansion.sameDomainPages,
                ...expansion.globalPages,
              ],
              lastExpansionPath: expansion.expansionPath,
              lastKnowledgeTrace: operationalTrace,
              lastSnapshotRefreshMode:
                refreshResponse?.refreshMode || (refreshResponse?.ok ? '' : 'refresh_failed'),
              lastSnapshotRefreshLatencyMs: Number(refreshResponse?.refreshLatencyMs || 0),
              lastExtensionSeenAt: Number(refreshResponse?.extensionSeenAt || 0),
              lastFallbackReason: expansion.fallbackReason,
              lastKnowledgeQuestion: question,
              lastKnowledgeSummaryHint: response.summaryHint,
              lastQuery: question,
            }
          : {
              navigationContext: navigationContext || null,
              pageSnapshot: null,
              pageSnapshotCapturedAt: 0,
              lastKnowledgeOrigin: '-',
              lastKnowledgeSources: [],
              lastFetchedPages: [],
              lastExpansionPath: [],
              lastKnowledgeTrace: operationalTrace,
              lastSnapshotRefreshMode: refreshResponse?.refreshMode || (refreshResponse?.ok ? '' : 'refresh_failed'),
              lastSnapshotRefreshLatencyMs: Number(refreshResponse?.refreshLatencyMs || 0),
              lastExtensionSeenAt: Number(refreshResponse?.extensionSeenAt || 0),
              lastFallbackReason: refreshResponse?.fallbackReason || '',
              lastKnowledgeQuestion: question,
              lastKnowledgeSummaryHint: '',
              lastQuery: question,
            },
      };
    }

    case 'search_same_domain': {
      const domain = String(args.domain || currentContext?.domain || '').trim();
      const query = String(args.query || question);
      const baseResponse = await invokeTool(toolName, {
        query,
        domain,
        maxResults,
      });
      const response = await buildSearchResponse({
        toolName,
        baseResponse,
        invokeTool,
        query,
      });

      return {
        response,
        statePatch: {
          initialKnowledgeScope: KNOWLEDGE_SCOPES.SAME_DOMAIN,
          initialKnowledgeSufficiency: response.initialSufficiency,
          lastKnowledgeScope: KNOWLEDGE_SCOPES.SAME_DOMAIN,
          lastKnowledgeSufficiency: response.finalSufficiency,
          lastKnowledgeOrigin: 'mesmo_dominio',
          lastKnowledgeSources: response.consultedSources,
          lastFetchedPages: response.fetchedPages,
          lastExpansionPath: response.expansionPath,
          lastKnowledgeTrace: response.operationalTrace,
          lastFallbackReason: '',
          lastKnowledgeQuestion: query,
          lastKnowledgeSummaryHint: response.summaryHint,
          lastQuery: query,
        },
      };
    }

    case 'search_web': {
      const query = String(args.query || question);
      const baseResponse = await invokeTool(toolName, {
        query,
        maxResults,
      });
      const response = await buildSearchResponse({
        toolName,
        baseResponse,
        invokeTool,
        query,
      });

      return {
        response,
        statePatch: {
          initialKnowledgeScope: KNOWLEDGE_SCOPES.GLOBAL,
          initialKnowledgeSufficiency: response.initialSufficiency,
          lastKnowledgeScope: KNOWLEDGE_SCOPES.GLOBAL,
          lastKnowledgeSufficiency: response.finalSufficiency,
          lastKnowledgeOrigin: 'web_geral',
          lastKnowledgeSources: response.consultedSources,
          lastFetchedPages: response.fetchedPages,
          lastExpansionPath: response.expansionPath,
          lastKnowledgeTrace: response.operationalTrace,
          lastFallbackReason: '',
          lastKnowledgeQuestion: query,
          lastKnowledgeSummaryHint: response.summaryHint,
          lastQuery: query,
        },
      };
    }

    case 'fetch_web_page': {
      const targetUrl = String(args.url || '');
      const response = await invokeTool(toolName, {
        url: targetUrl,
      });
      return {
        response: {
          ...response,
          consultedSources: uniqueStrings([response.page?.url]),
          responseGuidance: {
            answerMode: 'search_only',
            shouldCiteSources: true,
            shouldExplainOrigin: true,
          },
        },
        statePatch: {
          lastKnowledgeOrigin: 'fonte_externa',
          lastKnowledgeSources: uniqueStrings([response.page?.url]),
          lastFetchedPages: response.page ? [response.page] : [],
          lastExpansionPath: ['fetch_web_page'],
          lastKnowledgeTrace: [
            createToolCallTrace({ toolName, question: targetUrl }),
            createTraceEvent('fetch_web_page', {
              status: response.ok ? 'done' : 'failed',
              url: response.page?.url || targetUrl,
            }),
          ],
          lastFallbackReason: '',
          lastKnowledgeQuestion: targetUrl,
          lastKnowledgeSummaryHint: response.page?.url
            ? `Leitura direta da fonte externa ${response.page.url}.`
            : '',
          lastQuery: targetUrl,
        },
      };
    }

    default:
      throw new Error(`Ferramenta de conhecimento nao suportada: ${toolName}`);
  }
};
