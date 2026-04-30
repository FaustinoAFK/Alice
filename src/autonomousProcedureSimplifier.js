const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

export const simplifyProcedureSteps = (steps = []) => {
  const seen = new Set();
  return steps
    .map(normalizeText)
    .filter((step) => {
      const key = step.toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};
