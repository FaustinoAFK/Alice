import { useState } from 'react';
import { DefinitionList } from '../components/DefinitionList';
import { createLearningPlannerHudRequest } from './learningPlannerHudViewModel';

const formatPlannerList = (items = [], formatter = (item) => item) => {
  if (!Array.isArray(items) || items.length === 0) {
    return '-';
  }
  return items.map(formatter).filter(Boolean).join('\n') || '-';
};

export function AutonomousLearningHudPage({ debugHud, onAutonomousLearningAction }) {
  const learning = debugHud.learningLoop || {};
  const planner = learning.planner || {};
  const activePlan = planner.activePlan || null;
  const enabled = Boolean(learning.enabled);
  const [goalText, setGoalText] = useState('');
  const [plannerMessage, setPlannerMessage] = useState('');
  const submitGoal = (event) => {
    event.preventDefault();
    const request = createLearningPlannerHudRequest(goalText);
    if (!request.objective) {
      return;
    }
    setPlannerMessage('Criando plano...');
    Promise.resolve(onAutonomousLearningAction?.('create-learning-plan', request))
      .then((result) => {
        if (!result) {
          setPlannerMessage('Plano solicitado.');
          return;
        }
        setPlannerMessage(result.ok
          ? 'Plano criado e validado.'
          : result.status === 'needs_user_review'
            ? 'Plano criado, mas precisa de revisao.'
            : 'Plano bloqueado: resposta do modelo nao confiavel.');
        if (result.ok || result.status === 'needs_user_review') {
          setGoalText('');
        }
      })
      .catch((error) => {
        setPlannerMessage(`Falha ao criar plano: ${error?.message || error || 'erro desconhecido'}`);
      });
  };
  const cancelPlan = () => {
    const result = onAutonomousLearningAction?.('cancel-learning-plan');
    setPlannerMessage(result?.ok === false
      ? `Nao foi possivel cancelar: ${result.reason}`
      : 'Solicitacao de plano cancelada.');
  };
  const markForReview = () => {
    const result = onAutonomousLearningAction?.('mark-learning-plan-review');
    setPlannerMessage(result?.ok === false
      ? `Nao foi possivel marcar para revisao: ${result.reason}`
      : 'Plano marcado para revisao.');
  };
  const approvePlan = () => {
    const result = onAutonomousLearningAction?.('approve-learning-plan');
    setPlannerMessage(result?.ok === false
      ? `Nao foi possivel aprovar: ${result.reason}`
      : 'Plano aprovado para a proxima fase. Nenhuma tarefa foi executada.');
  };
  const rejectPlan = () => {
    const result = onAutonomousLearningAction?.('reject-learning-plan');
    setPlannerMessage(result?.ok === false
      ? `Nao foi possivel rejeitar: ${result.reason}`
      : 'Plano rejeitado.');
  };

  return (
    <section className="hud-page" aria-label="Aprendizado autonomo">
      <div className="page-hero page-hero--compact">
        <p className="topbar-kicker">aprendizado governado</p>
        <h2>Aprendizado Autonomo</h2>
        <p>Gaps, experimentos, reuso, otimizacao, evidencias e procedimentos candidatos ficam auditaveis antes de virar habito.</p>
      </div>

      <section className="debug-summary-grid" aria-label="Resumo do aprendizado autonomo">
        <article className="debug-summary-card">
          <span>Estado</span>
          <strong>{enabled ? 'ligado' : 'pausado'}</strong>
        </article>
        <article className="debug-summary-card">
          <span>Ult. scan</span>
          <strong>{learning.lastScanAt || '-'}</strong>
        </article>
        <article className="debug-summary-card">
          <span>Ult. experimento</span>
          <strong>{learning.lastExperimentAt || '-'}</strong>
        </article>
      </section>

      <section className="runner-actions" aria-label="Controles de aprendizado autonomo">
        <button
          type="button"
          onClick={() => onAutonomousLearningAction?.(enabled ? 'disable' : 'enable')}
        >
          {enabled ? 'Pausar' : 'Ligar'}
        </button>
        <button type="button" onClick={() => onAutonomousLearningAction?.('run-once')}>
          Rodar uma vez
        </button>
        <button type="button" onClick={() => onAutonomousLearningAction?.('dry-run')}>
          Dry-run
        </button>
        <button type="button" onClick={() => onAutonomousLearningAction?.('clear-test-learning')}>
          Limpar testes
        </button>
      </section>

      <form className="learning-goal-form" onSubmit={submitGoal} aria-label="Novo plano de aprendizado">
        <label htmlFor="learning-goal-input">O que a Alice deve aprender?</label>
        <div className="learning-goal-form__row">
          <textarea
            id="learning-goal-input"
            value={goalText}
            onChange={(event) => setGoalText(event.target.value)}
            placeholder="Ex.: aprender a pesquisar documentação, abrir o navegador, validar a página e resumir o conteúdo"
            rows={3}
          />
          <button type="submit" disabled={!goalText.trim()}>
            Criar plano
          </button>
        </div>
      </form>

      <section className="debug-hud__section debug-hud__section--wide" aria-label="Learning Planner">
        <div className="runner-task__actions">
          <button type="button" onClick={approvePlan} disabled={!activePlan}>
            Aprovar plano
          </button>
          <button type="button" onClick={rejectPlan} disabled={!activePlan}>
            Rejeitar plano
          </button>
          <button type="button" onClick={cancelPlan} disabled={!activePlan}>
            Cancelar plano
          </button>
          <button type="button" onClick={markForReview} disabled={!activePlan}>
            Marcar para revisao
          </button>
        </div>
        <DefinitionList
          items={[
            ['Status', planner.status || activePlan?.status || 'idle'],
            ['Objetivo', activePlan?.learningGoal?.objective || activePlan?.objective || '-'],
            ['Aprovacao', activePlan?.approvalRequirements?.length ? activePlan.approvalRequirements.join('\n') : 'nao exigida'],
            ['Bloqueio', activePlan?.blockedActions?.length ? activePlan.blockedActions.join('\n') : planner.reason || '-'],
          ]}
        />
        {plannerMessage ? <p className="status-note">{plannerMessage}</p> : null}
        {planner.issues?.length ? (
          <details open>
            <summary>Falhas de validacao do plano</summary>
            <pre>{planner.issues.map((issue) => `${issue.path || '-'} | ${issue.reason || '-'}`).join('\n')}</pre>
          </details>
        ) : null}
      </section>

      <div className="debug-hud__grid" aria-label="Detalhes do Learning Planner">
        <section className="debug-hud__section">
          <details open>
            <summary>Habilidades requeridas</summary>
            <pre>{formatPlannerList(activePlan?.skills, (skill) =>
              `${skill.skillId || '-'} | tools=${(skill.requiredTools || []).join(', ') || '-'} | ${skill.title || '-'}`)}
            </pre>
          </details>
        </section>

        <section className="debug-hud__section">
          <details open>
            <summary>Tarefas de treino</summary>
            <pre>{formatPlannerList(activePlan?.trainingTasks, (task) =>
              `${task.taskId || '-'} | ${task.actionKind || '-'} | ${task.title || '-'}`)}
            </pre>
          </details>
        </section>

        <section className="debug-hud__section">
          <details open>
            <summary>Riscos</summary>
            <pre>{activePlan?.risk
              ? `${activePlan.risk.level || '-'} | ${activePlan.risk.decision || '-'} | ${activePlan.risk.reason || '-'}`
              : '-'}
            </pre>
          </details>
        </section>

        <section className="debug-hud__section">
          <details open>
            <summary>Evidencia esperada</summary>
            <pre>{formatPlannerList(activePlan?.expectedEvidence, (evidence) =>
              `${evidence.evidenceId || '-'} | ${evidence.kind || '-'} | ${evidence.description || '-'}`)}
            </pre>
          </details>
        </section>
      </div>

      <div className="debug-hud__grid">
        <section className="debug-hud__section debug-hud__section--wide">
          <details open>
            <summary>Objetivos definidos pelo usuario</summary>
            <pre>{learning.goals || '-'}</pre>
          </details>
        </section>

        <section className="debug-hud__section debug-hud__section--wide">
          <details open>
            <summary>Alvos observados na tela</summary>
            <pre>{learning.observedTargets || '-'}</pre>
          </details>
        </section>

        <section className="debug-hud__section debug-hud__section--wide">
          <details open>
            <summary>Lacunas detectadas</summary>
            <pre>{learning.gaps || '-'}</pre>
          </details>
        </section>

        <section className="debug-hud__section debug-hud__section--wide">
          <details open>
            <summary>Experimentos e tasks</summary>
            <pre>{learning.experiments || '-'}</pre>
          </details>
        </section>

        <section className="debug-hud__section">
          <details open>
            <summary>Candidates</summary>
            <pre>{learning.candidates || '-'}</pre>
          </details>
        </section>

        <section className="debug-hud__section">
          <details open>
            <summary>Procedures guarded/active</summary>
            <pre>{learning.procedures || '-'}</pre>
          </details>
        </section>

        <section className="debug-hud__section debug-hud__section--wide">
          <details>
            <summary>Scripts gerados</summary>
            <pre>{learning.scripts || '-'}</pre>
          </details>
        </section>

        <section className="debug-hud__section debug-hud__section--wide">
          <details>
            <summary>Reuso e otimizacao</summary>
            <DefinitionList
              items={[
                ['Indice de reuso', learning.reuseIndex || '-'],
                ['Otimizacao', learning.optimization || '-'],
                ['Stats', learning.stats || '-'],
              ]}
            />
          </details>
        </section>

        <section className="debug-hud__section debug-hud__section--wide">
          <details>
            <summary>Auditoria</summary>
            <pre>{learning.audits || '-'}</pre>
          </details>
        </section>
      </div>
    </section>
  );
}

export default AutonomousLearningHudPage;
