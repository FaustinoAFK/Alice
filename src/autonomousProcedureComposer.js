import { matchProceduresForNeed } from './autonomousProcedureMatcher';

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

export const composeProceduresForNeed = ({ need = {}, procedures = [] } = {}) => {
  const text = normalizeText(need.description || need.text || '');
  const requiredCapabilities = [
    /pesquis|search/i.test(text) ? 'browser.search' : '',
    /abrir resultado|open result/i.test(text) ? 'browser.open_result' : '',
    /ler|read|pagina/i.test(text) ? 'page.read' : '',
    /resum|summar/i.test(text) ? 'page.summarize' : '',
    /form|campo|digitar|input/i.test(text) ? 'text.input' : '',
  ].filter(Boolean);
  const parts = requiredCapabilities
    .map((capability) => matchProceduresForNeed({
      need: { ...need, capability },
      procedures,
      minScore: 0.45,
    })[0])
    .filter(Boolean);

  if (requiredCapabilities.length < 2 || parts.length !== requiredCapabilities.length) {
    return { ok: false, reason: 'composition_not_available', parts: [] };
  }
  return {
    ok: true,
    reason: 'composition_available',
    compositionId: `composition-${requiredCapabilities.join('-').replace(/[^a-z0-9-]+/gi, '-')}`,
    capabilities: requiredCapabilities,
    parts,
  };
};
