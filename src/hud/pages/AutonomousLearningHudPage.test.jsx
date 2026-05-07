import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AutonomousLearningHudPage } from './AutonomousLearningHudPage';
import { createLearningPlannerHudRequest } from './learningPlannerHudViewModel';

const plan = {
  status: 'validated',
  learningGoal: { objective: 'Aprender a pesquisar documentacao.' },
  skills: [
    {
      skillId: 'skill-browser-search',
      title: 'Pesquisar no navegador',
      requiredTools: ['browser', 'runner_evidence'],
    },
  ],
  trainingTasks: [
    {
      taskId: 'training-browser-search',
      title: 'Treino de busca',
      actionKind: 'visual',
    },
  ],
  risk: {
    level: 'low',
    decision: 'valid',
    reason: 'Planejamento apenas.',
  },
  expectedEvidence: [
    {
      evidenceId: 'evidence-validation',
      kind: 'validation_report',
      description: 'Relatorio de validacao esperado.',
    },
  ],
  approvalRequirements: [],
  blockedActions: ['Executar comandos'],
};

const renderPage = (planner) => renderToString(
  <AutonomousLearningHudPage
    debugHud={{
      learningLoop: {
        enabled: true,
        planner,
      },
    }}
    onAutonomousLearningAction={vi.fn()}
  />,
);

describe('AutonomousLearningHudPage Learning Planner section', () => {
  it('creates a trimmed LearningRequest payload from HUD input', () => {
    expect(createLearningPlannerHudRequest('  aprender browser  ')).toEqual({
      objective: 'aprender browser',
    });
  });

  it('displays a generated learning plan', () => {
    const html = renderPage({
      status: 'validated',
      activePlan: plan,
      issues: [],
    });

    expect(html).toContain('Learning Planner');
    expect(html).toContain('Aprender a pesquisar documentacao.');
    expect(html).toContain('skill-browser-search');
    expect(html).toContain('training-browser-search');
    expect(html).toContain('Relatorio de validacao esperado.');
    expect(html).toContain('Executar comandos');
    expect(html).toContain('Aprovar plano');
    expect(html).toContain('Rejeitar plano');
  });

  it('shows invalid or blocked plan details without hiding validation failures', () => {
    const html = renderPage({
      status: 'plan_failed',
      reason: 'model_response_schema_invalid',
      activePlan: {
        ...plan,
        status: 'plan_failed',
        blockedActions: ['Nao executar plano invalido'],
        approvalRequirements: ['Revisar resposta do modelo'],
      },
      issues: [
        { path: 'validations', reason: 'validation_criteria_missing' },
        { path: 'trainingTasks.0.expectedEvidence', reason: 'training_task_expected_evidence_missing' },
      ],
    });

    expect(html).toContain('plan_failed');
    expect(html).toContain('Nao executar plano invalido');
    expect(html).toContain('Revisar resposta do modelo');
    expect(html).toContain('validation_criteria_missing');
    expect(html).toContain('training_task_expected_evidence_missing');
  });
});
