import { inferProcedureCapabilities } from './autonomousReuseIndex';

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const capabilityFromNeed = (need = {}) => {
  const text = normalizeLower(`${need.description || need.text || need.type || ''} ${need.capability || ''}`);
  if (need.capability) {
    return need.capability;
  }
  if (text.includes('pesquis') || text.includes('search') || text.includes('barra') || text.includes('browser')) {
    return 'browser.search';
  }
  if (text.includes('digitar') || text.includes('campo') || text.includes('input')) {
    return 'text.input';
  }
  if (text.includes('ler') || text.includes('pagina') || text.includes('page')) {
    return 'page.read';
  }
  return 'procedure.general';
};

const statusScore = (status = '') => {
  if (status === 'active') {
    return 0.25;
  }
  if (status === 'guarded' || status === 'validated') {
    return 0.15;
  }
  if (status === 'candidate') {
    return 0.04;
  }
  return 0;
};

export const scoreProcedureMatch = ({ need = {}, procedure = {} } = {}) => {
  const neededCapability = capabilityFromNeed(need);
  const capabilities = inferProcedureCapabilities(procedure);
  const text = normalizeLower([
    procedure.procedureId,
    procedure.title,
    procedure.summary,
    ...(procedure.steps || []),
    ...capabilities,
  ].join(' '));
  let score = 0;
  const reasons = [];
  if (capabilities.includes(neededCapability)) {
    score += 0.45;
    reasons.push('capability_match');
  }
  normalizeLower(need.description || need.text || '').split(/\s+/).filter((token) => token.length > 4).slice(0, 8).forEach((token) => {
    if (text.includes(token)) {
      score += 0.025;
    }
  });
  const confidence = Math.min(1, Math.max(0, Number(procedure.confidence || 0)));
  score += confidence * 0.22;
  score += statusScore(procedure.status);
  if (Number(procedure.failureCount || 0) > 0) {
    score -= Math.min(0.3, Number(procedure.failureCount || 0) * 0.08);
    reasons.push('recent_failures_penalty');
  }
  if (normalizeArray(procedure.evidenceRefs).length > 0) {
    score += 0.05;
    reasons.push('has_evidence');
  }
  return {
    procedure,
    procedureId: procedure.procedureId || procedure.candidateId || '',
    matchScore: Math.max(0, Math.min(1, Math.round(score * 1000) / 1000)),
    neededCapability,
    reasons,
  };
};

export const matchProceduresForNeed = ({
  need = {},
  procedures = [],
  candidates = [],
  minScore = 0,
} = {}) =>
  [...normalizeArray(procedures), ...normalizeArray(candidates)]
    .map((procedure) => scoreProcedureMatch({ need, procedure }))
    .filter((match) => match.matchScore >= minScore)
    .sort((left, right) => right.matchScore - left.matchScore);
