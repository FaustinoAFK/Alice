export const benchmarkProcedureVariant = ({ baseline = {}, variant = {} } = {}) => {
  const baselineSteps = Array.isArray(baseline.steps) ? baseline.steps.length : Number(baseline.stepCount || 0);
  const variantSteps = Array.isArray(variant.steps) ? variant.steps.length : Number(variant.stepCount || 0);
  const baselineSuccess = Number(baseline.successRate ?? baseline.confidence ?? 0);
  const variantSuccess = Number(variant.successRate ?? variant.confidence ?? baselineSuccess);
  return {
    baselineSteps,
    variantSteps,
    stepReduction: Math.max(0, baselineSteps - variantSteps),
    successDelta: Math.round((variantSuccess - baselineSuccess) * 1000) / 1000,
    fasterOrSimpler: variantSteps > 0 && baselineSteps > 0 ? variantSteps < baselineSteps : false,
    equallyReliableOrBetter: variantSuccess >= baselineSuccess,
  };
};
