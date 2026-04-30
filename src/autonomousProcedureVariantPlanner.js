import { simplifyProcedureSteps } from './autonomousProcedureSimplifier';

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const toSafeIdPart = (value) =>
  normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'procedure';

export const planProcedureOptimizationVariants = (procedure = {}, { now = new Date().toISOString() } = {}) => {
  const steps = Array.isArray(procedure.steps) ? procedure.steps : [];
  const text = `${procedure.title || ''} ${procedure.summary || ''} ${steps.join(' ')}`;
  const variants = [];
  if (/barra|browser|navegador|pesquis|search|click/i.test(text)) {
    variants.push({
      variantId: `${toSafeIdPart(procedure.procedureId)}-v2-ctrl-l`,
      title: 'Usar Ctrl+L em vez de clique visual',
      status: 'candidate',
      riskLevel: procedure.riskLevel || 'low',
      confidence: Math.max(0.5, Number(procedure.confidence || 0.5)),
      steps: [
        'Focar barra com Ctrl+L',
        'Digitar consulta',
        'Pressionar Enter',
        'Validar mudanca de URL/titulo/conteudo',
      ],
      fallbackVersion: procedure.version || 'v1',
      createdAt: now,
    });
  }
  const simplified = simplifyProcedureSteps(steps);
  if (simplified.length > 0 && simplified.length < steps.length) {
    variants.push({
      variantId: `${toSafeIdPart(procedure.procedureId)}-v2-simplified`,
      title: 'Remover passos redundantes',
      status: 'candidate',
      riskLevel: procedure.riskLevel || 'low',
      confidence: Number(procedure.confidence || 0.5),
      steps: simplified,
      fallbackVersion: procedure.version || 'v1',
      createdAt: now,
    });
  }
  return variants;
};
