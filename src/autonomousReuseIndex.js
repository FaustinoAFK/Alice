const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

export const inferProcedureCapabilities = (procedure = {}) => {
  const explicit = normalizeArray(procedure.capabilities).map(normalizeText).filter(Boolean);
  if (explicit.length) {
    return explicit;
  }
  const haystack = normalizeLower([
    procedure.procedureId,
    procedure.title,
    procedure.summary,
    ...(procedure.steps || []),
  ].join(' '));
  const capabilities = [];
  if (/\b(browser|navegador|edge|chrome|url|barra|pesquis|search|ctrl\+l)\b/i.test(haystack)) {
    capabilities.push('browser.search');
  }
  if (/\b(type|digitar|texto|campo|input|formulario|form)\b/i.test(haystack)) {
    capabilities.push('text.input');
  }
  if (/\b(read|ler|pagina|page|conteudo|summarize|resumir)\b/i.test(haystack)) {
    capabilities.push('page.read');
  }
  return capabilities.length ? capabilities : ['procedure.general'];
};

const addToIndex = (bucket, key, procedureId) => {
  const normalizedKey = normalizeText(key);
  if (!normalizedKey || !procedureId) {
    return;
  }
  bucket[normalizedKey] = [...new Set([...(bucket[normalizedKey] || []), procedureId])];
};

export const rebuildProcedureReuseIndex = ({ procedures = [], candidates = [] } = {}) => {
  const index = {
    capabilities: {},
    apps: {},
    contexts: {},
    updatedAt: new Date().toISOString(),
  };
  [...normalizeArray(procedures), ...normalizeArray(candidates)]
    .filter((procedure) => procedure.procedureId || procedure.candidateId)
    .forEach((procedure) => {
      const procedureId = procedure.procedureId || procedure.candidateId;
      inferProcedureCapabilities(procedure).forEach((capability) => {
        addToIndex(index.capabilities, capability, procedureId);
      });
      const text = normalizeLower(`${procedure.title || ''} ${procedure.summary || ''}`);
      if (text.includes('edge')) {
        addToIndex(index.apps, 'edge', procedureId);
      }
      if (text.includes('chrome')) {
        addToIndex(index.apps, 'chrome', procedureId);
      }
      if (text.includes('browser') || text.includes('navegador') || text.includes('pagina')) {
        addToIndex(index.contexts, 'web', procedureId);
      }
    });
  return index;
};

export const normalizeProcedureReuseIndex = (index = {}, source = {}) => {
  if (!index || typeof index !== 'object' || !index.capabilities) {
    return rebuildProcedureReuseIndex(source);
  }
  return {
    capabilities: index.capabilities && typeof index.capabilities === 'object' ? index.capabilities : {},
    apps: index.apps && typeof index.apps === 'object' ? index.apps : {},
    contexts: index.contexts && typeof index.contexts === 'object' ? index.contexts : {},
    updatedAt: normalizeText(index.updatedAt) || new Date().toISOString(),
  };
};
