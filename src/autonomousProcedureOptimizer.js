import { createAutonomousOptimizationTask } from './autonomousLearningPlanner';
import { benchmarkProcedureVariant } from './autonomousProcedureBenchmark';
import { planProcedureOptimizationVariants } from './autonomousProcedureVariantPlanner';
import { AUTONOMOUS_OPTIMIZER_CREATED_BY } from './autonomousLearningPolicy';

const normalizeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
const normalizeText = (value) => String(value || '').trim();
const TERMINAL_TASK_STATUSES = new Set(['done', 'failed', 'cancelled']);

const optimizationKey = (procedureId = '', variantId = '') =>
  `${normalizeText(procedureId)}::${normalizeText(variantId)}`;

const buildExistingOptimizationKeys = ({ existingTasks = [], optimizationState = {} } = {}) => {
  const keys = new Set();
  normalizeArray(existingTasks)
    .filter((task) => task.metadata?.createdBy === AUTONOMOUS_OPTIMIZER_CREATED_BY)
    .filter((task) => !TERMINAL_TASK_STATUSES.has(task.status))
    .forEach((task) => {
      keys.add(optimizationKey(task.metadata?.procedureId || task.procedureId, task.metadata?.variantId));
    });
  normalizeArray(optimizationState.candidates)
    .filter((candidate) => ['task_created', 'running', 'pending'].includes(normalizeText(candidate.status)))
    .forEach((candidate) => {
      keys.add(optimizationKey(candidate.procedureId, candidate.variantId));
    });
  return keys;
};

export const findProcedureOptimizationCandidates = ({ procedures = [], minUsageCount = 2 } = {}) =>
  normalizeArray(procedures)
    .filter((procedure) => ['active', 'guarded', 'candidate'].includes(procedure.status))
    .filter((procedure) =>
      normalizeArray(procedure.steps).length >= 4 ||
      Number(procedure.usageCount || 0) >= minUsageCount ||
      Number(procedure.failureCount || 0) > 0 ||
      Number(procedure.averageDurationMs || 0) > 4000)
    .slice(0, 5);

export const planProcedureOptimizationTasks = ({
  procedures = [],
  existingTasks = [],
  optimizationState = {},
  now = new Date().toISOString(),
} = {}) =>
  (() => {
    const existingKeys = buildExistingOptimizationKeys({ existingTasks, optimizationState });
    return findProcedureOptimizationCandidates({ procedures })
    .flatMap((procedure) =>
      planProcedureOptimizationVariants(procedure, { now })
        .map((variant) => ({
          procedure,
          variant,
          benchmark: benchmarkProcedureVariant({ baseline: procedure, variant }),
        }))
        .filter(({ benchmark, procedure }) =>
          benchmark.equallyReliableOrBetter &&
          (benchmark.fasterOrSimpler || Number(procedure.failureCount || 0) > 0))
        .filter(({ procedure, variant }) =>
          !existingKeys.has(optimizationKey(procedure.procedureId, variant.variantId)))
        .slice(0, 1)
        .map(({ procedure, variant, benchmark }) => ({
          task: createAutonomousOptimizationTask({ procedure, variant: { ...variant, benchmark }, now }),
          procedure,
          variant,
          benchmark,
        })),
    );
  })();
