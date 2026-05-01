import { describe, expect, it } from 'vitest';
import { planProcedureOptimizationTasks } from './autonomousProcedureOptimizer';

const procedure = {
  procedureId: 'procedure_browser_search_address_bar',
  title: 'Pesquisar no navegador',
  status: 'guarded',
  confidence: 0.8,
  capabilities: ['browser.search'],
  steps: ['abrir navegador', 'clicar barra', 'digitar', 'enter', 'validar pagina'],
};

describe('autonomous procedure optimizer', () => {
  it('does not create duplicate optimization tasks for the same active variant', () => {
    const firstPlan = planProcedureOptimizationTasks({
      procedures: [procedure],
      now: '2026-04-30T10:00:00.000Z',
    });

    expect(firstPlan).toHaveLength(1);

    const duplicatePlan = planProcedureOptimizationTasks({
      procedures: [procedure],
      existingTasks: [{
        id: firstPlan[0].task.id,
        status: 'ready',
        metadata: firstPlan[0].task.metadata,
      }],
      now: '2026-04-30T10:01:00.000Z',
    });

    expect(duplicatePlan).toHaveLength(0);
  });
});
