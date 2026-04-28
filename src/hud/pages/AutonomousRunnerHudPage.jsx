import { DefinitionList } from '../components/DefinitionList';

const formatTime = (value) => {
  if (!value) {
    return '-';
  }
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return '-';
  }
};

const statusLabel = (status) => String(status || '-').replace(/_/g, ' ');

export function AutonomousRunnerHudPage({ runnerState, debugHud, onRunnerAction }) {
  const runner = runnerState || {};
  const tasks = Object.values(runner.tasksById || {})
    .sort((left, right) => Number(left.queueRank || 0) - Number(right.queueRank || 0));
  const activeTask = runner.activeTaskId ? runner.tasksById?.[runner.activeTaskId] : null;
  const activeStep = activeTask?.steps?.find((step) => step.status === 'running') ||
    activeTask?.steps?.find((step) => step.status !== 'done');
  const audits = (runner.audits || []).slice(-24).reverse();
  const evidenceRefs = (runner.evidenceRefs || []).slice(-24).reverse();

  return (
    <section className="hud-page" aria-label="Autonomous Task Runner">
      <div className="page-hero page-hero--compact">
        <p className="topbar-kicker">fila operacional</p>
        <h2>Autonomous Task Runner</h2>
        <p>Execucao sequencial com lease, heartbeat, preflight, validacao, evidencias, retry e recovery.</p>
      </div>

      <section className="runner-toolbar" aria-label="Controles do Runner">
        <button type="button" onClick={() => onRunnerAction?.(runner.enabled ? 'disable' : 'enable')}>
          {runner.enabled ? 'Desligar autonomia' : 'Ligar autonomia'}
        </button>
        <button type="button" onClick={() => onRunnerAction?.(runner.runnerState === 'paused' ? 'resume' : 'pause')}>
          {runner.runnerState === 'paused' ? 'Retomar Runner' : 'Pausar Runner'}
        </button>
        <button type="button" onClick={() => activeTask && onRunnerAction?.('cancel_task', { taskId: activeTask.id })} disabled={!activeTask}>
          Cancelar atual
        </button>
        <button type="button" onClick={() => activeTask && onRunnerAction?.('block_task', { taskId: activeTask.id, reason: 'manual_block' })} disabled={!activeTask}>
          Bloquear atual
        </button>
        <button type="button" onClick={() => onRunnerAction?.('cancel_queue', { reason: 'manual_cancel' })}>
          Cancelar fila
        </button>
      </section>

      <section className="debug-summary-grid" aria-label="Resumo do Runner">
        {[
          ['Estado', statusLabel(runner.runnerState)],
          ['Autonomia', runner.enabled ? 'ON' : 'OFF'],
          ['Fila', runner.queue?.length || 0],
          ['Ready', debugHud.runner?.readyCount || 0],
          ['Retry', debugHud.runner?.waitingRetryCount || 0],
          ['Bloqueadas', debugHud.runner?.blockedCount || 0],
        ].map(([label, value]) => (
          <article key={label} className="debug-summary-card">
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <div className="debug-hud__grid">
        <section className="debug-hud__section">
          <div className="section-header">
            <span>execucao</span>
            <strong>Task ativa</strong>
          </div>
          <DefinitionList
            items={[
              ['Task', activeTask?.title || '-'],
              ['Status', statusLabel(activeTask?.status)],
              ['Reason', activeTask?.reason || '-'],
              ['Attempts', activeTask ? `${activeTask.attempts}/${activeTask.maxAttempts}` : '-'],
              ['Heartbeat', formatTime(activeTask?.heartbeatAt || runner.runnerLock?.heartbeatAt)],
              ['Lease', activeTask?.leaseId || runner.runnerLock?.leaseId || '-'],
              ['Proximo retry', formatTime(activeTask?.nextRunAt)],
            ]}
          />
        </section>

        <section className="debug-hud__section">
          <div className="section-header">
            <span>step</span>
            <strong>Atual ou proximo</strong>
          </div>
          <DefinitionList
            items={[
              ['Step', activeStep?.title || '-'],
              ['Status', statusLabel(activeStep?.status)],
              ['Tipo', activeStep?.type || '-'],
              ['Criterio', activeStep?.completionCriteria?.type || '-'],
              ['Evidencia esperada', activeStep?.expectedEvidence?.kind || '-'],
              ['Attempts', activeStep ? `${activeStep.attempts}/${activeStep.maxAttempts}` : '-'],
              ['Timeout', activeStep?.timeoutPolicy?.timeoutMs ? `${activeStep.timeoutPolicy.timeoutMs}ms` : '-'],
            ]}
          />
        </section>

        <section className="debug-hud__section debug-hud__section--wide">
          <div className="section-header">
            <span>fila</span>
            <strong>Prioridade, queueRank e controles</strong>
          </div>
          <div className="runner-task-list">
            {tasks.length > 0 ? tasks.map((task) => (
              <article key={task.id} className={`runner-task runner-task--${task.status}`}>
                <div>
                  <strong>{task.title}</strong>
                  <span>{task.id}</span>
                </div>
                <div>
                  <span>{statusLabel(task.status)}</span>
                  <span>{task.priority}</span>
                  <span>rank {task.queueRank}</span>
                </div>
                <div className="runner-task__actions">
                  <button type="button" onClick={() => onRunnerAction?.('reorder_task', { taskId: task.id, queueRank: Number(task.queueRank || 0) - 1 })}>
                    Subir
                  </button>
                  <button type="button" onClick={() => onRunnerAction?.('reorder_task', { taskId: task.id, queueRank: Number(task.queueRank || 0) + 1 })}>
                    Descer
                  </button>
                  <button type="button" onClick={() => onRunnerAction?.('rerun_task', { taskId: task.id })}>
                    Reexecutar
                  </button>
                  <button type="button" onClick={() => onRunnerAction?.('cancel_task', { taskId: task.id })}>
                    Cancelar
                  </button>
                </div>
              </article>
            )) : <p className="empty-state">Nenhuma task no Runner.</p>}
          </div>
        </section>

        <section className="debug-hud__section debug-hud__section--wide">
          <div className="section-header">
            <span>auditoria</span>
            <strong>Decisoes, preflight, transicoes e recovery</strong>
          </div>
          <pre>{audits.length ? audits.map((event) =>
            `${event.timestamp} | ${event.type} | ${event.taskId || '-'} | ${event.reason || '-'} | ${event.summary || '-'}`,
          ).join('\n') : '-'}</pre>
        </section>

        <section className="debug-hud__section debug-hud__section--wide">
          <div className="section-header">
            <span>evidencias</span>
            <strong>Refs leves para artefatos</strong>
          </div>
          <pre>{evidenceRefs.length ? evidenceRefs.map((ref) =>
            `${ref.createdAt} | ${ref.kind} | ${ref.taskId}/${ref.stepId} | ${ref.path}`,
          ).join('\n') : '-'}</pre>
        </section>
      </div>
    </section>
  );
}
