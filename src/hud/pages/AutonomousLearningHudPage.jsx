import { useState } from 'react';
import { DefinitionList } from '../components/DefinitionList';

export function AutonomousLearningHudPage({ debugHud, onAutonomousLearningAction }) {
  const learning = debugHud.learningLoop || {};
  const enabled = Boolean(learning.enabled);
  const [goalText, setGoalText] = useState('');
  const submitGoal = (event) => {
    event.preventDefault();
    const goal = goalText.trim();
    if (!goal) {
      return;
    }
    onAutonomousLearningAction?.('add-goal', { goal });
    setGoalText('');
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

      <form className="learning-goal-form" onSubmit={submitGoal} aria-label="Novo objetivo de aprendizado">
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
            Criar objetivo
          </button>
        </div>
      </form>

      <div className="debug-hud__grid">
        <section className="debug-hud__section debug-hud__section--wide">
          <details open>
            <summary>Objetivos definidos pelo usuario</summary>
            <pre>{learning.goals || '-'}</pre>
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
