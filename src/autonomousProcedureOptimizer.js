import { createAutonomousOptimizationTask } from './autonomousLearningPlanner';
import { benchmarkProcedureVariant } from './autonomousProcedureBenchmark';
import { planProcedureOptimizationVariants } from './autonomousProcedureVariantPlanner';

const normalizeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

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
  now = new Date().toISOString(),
} = {}) =>
  findProcedureOptimizationCandidates({ procedures })
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
        .slice(0, 1)
        .map(({ procedure, variant, benchmark }) => ({
          task: createAutonomousOptimizationTask({ procedure, variant: { ...variant, benchmark }, now }),
          procedure,
          variant,
          benchmark,
        })),
    );
