import { DefinitionList } from '../components/DefinitionList';
import { buildAutonomySummaryCards } from '../hudViewModel';

export function AutonomyHudPage({ debugHud, autonomousLearningState, onApproveProposal, onRejectProposal }) {
  const autonomyDisplay = debugHud.autonomous.display;
  const cards = buildAutonomySummaryCards(debugHud);
  const pendingProposals = (autonomousLearningState?.improvementProposals || [])
    .filter((proposal) => proposal.status === 'pending_approval');

  return (
    <section className="hud-page" aria-label="Aprendizado autonomo">
      <div className="page-hero page-hero--compact">
        <p className="topbar-kicker">playground operacional</p>
        <h2>Autonomia supervisionada</h2>
        <p>Tarefas, VM local real, workspace fallback, propostas, riscos e rollbacks ficam visiveis aqui antes de qualquer acao sensivel.</p>
      </div>

      <section className="debug-summary-grid" aria-label="Resumo da autonomia">
        {cards.map(([label, value]) => (
          <article key={label} className="debug-summary-card">
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <div className="debug-hud__grid">
        <section className="debug-hud__section">
          <div className="section-header">
            <span>prioridade</span>
            <strong>Controle do usuario</strong>
          </div>
          <DefinitionList
            items={[
              ['Estado', autonomyDisplay.active],
              ['Tarefas rodando', autonomyDisplay.runningTasks],
              ['Tarefas pausadas', autonomyDisplay.pausedTasks],
              ['Tarefas na fila', autonomyDisplay.queuedTasks],
            ]}
          />
        </section>

        <section className="debug-hud__section">
          <div className="section-header">
            <span>ambiente</span>
            <strong>VM real, fallback e PC real</strong>
          </div>
          <DefinitionList
            items={[
              ['Status', autonomyDisplay.vmStatus],
              ['Provedor', autonomyDisplay.vmProvider],
              ['Provedor status', autonomyDisplay.vmProviderStatus],
              ['Modo execucao', autonomyDisplay.vmExecutionMode],
              ['E VM real?', autonomyDisplay.vmIsReal],
              ['Guest command pronto?', autonomyDisplay.guestCommandReady],
              ['Precisa configurar?', autonomyDisplay.requiresUserSetup],
              ['Motivo setup', autonomyDisplay.setupReason],
              ['Modo de custo', autonomyDisplay.vmCostMode],
              ['Recursos host', autonomyDisplay.hostResources],
              ['Risco recente', autonomyDisplay.latestRisk],
              ['Rollback recente', autonomyDisplay.latestRollback],
            ]}
          />
        </section>

        <section className="debug-hud__section">
          <div className="section-header">
            <span>visao</span>
            <strong>Guest Interaction Layer</strong>
          </div>
          <DefinitionList
            items={[
              ['Agente online?', autonomyDisplay.visualAgentOnline],
              ['Status agente', autonomyDisplay.visualAgentStatus],
              ['Ultima acao', autonomyDisplay.latestVisualAction],
              ['Ultimo replay', autonomyDisplay.latestVisualReplay],
              ['Ultima screenshot', autonomyDisplay.latestVisualScreenshot],
            ]}
          />
        </section>

        <section className="debug-hud__section debug-hud__section--wide">
          <div className="section-header">
            <span>auditoria</span>
            <strong>Fila, propostas e rollbacks</strong>
          </div>
          <dl>
            <div>
              <dt>Tarefas</dt>
              <dd><pre>{autonomyDisplay.tasks}</pre></dd>
            </div>
            <div>
              <dt>Provedores</dt>
              <dd><pre>{autonomyDisplay.providers}</pre></dd>
            </div>
            <div>
              <dt>Capacidades ativas</dt>
              <dd><pre>{autonomyDisplay.providerCapabilities}</pre></dd>
            </div>
            <div>
              <dt>Diagnóstico VM</dt>
              <dd><pre>{autonomyDisplay.vmDiagnostics}</pre></dd>
            </div>
            <div>
              <dt>Smoke test VM</dt>
              <dd><pre>{autonomyDisplay.vmSmokeTest}</pre></dd>
            </div>
            <div>
              <dt>Capacidades visuais</dt>
              <dd><pre>{autonomyDisplay.visualCapabilities}</pre></dd>
            </div>
            <div>
              <dt>Execucoes visuais</dt>
              <dd><pre>{autonomyDisplay.visualExecutions}</pre></dd>
            </div>
            <div>
              <dt>Replays visuais</dt>
              <dd><pre>{autonomyDisplay.visualReplays}</pre></dd>
            </div>
            <div>
              <dt>Propostas</dt>
              <dd><pre>{autonomyDisplay.proposals}</pre></dd>
            </div>
            {pendingProposals.length > 0 ? (
              <div>
                <dt>Aprovar/Rejeitar</dt>
                <dd className="proposal-actions">
                  {pendingProposals.map((proposal) => (
                    <div key={proposal.proposalId} className="proposal-actions__item">
                      <span>{proposal.title || proposal.proposalId}</span>
                      <button type="button" onClick={() => onApproveProposal?.(proposal.proposalId)}>
                        Aprovar
                      </button>
                      <button type="button" onClick={() => onRejectProposal?.(proposal.proposalId)}>
                        Rejeitar
                      </button>
                    </div>
                  ))}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Aprovações</dt>
              <dd><pre>{autonomyDisplay.approvals}</pre></dd>
            </div>
            <div>
              <dt>Validações</dt>
              <dd><pre>{autonomyDisplay.validations}</pre></dd>
            </div>
            <div>
              <dt>Execuções</dt>
              <dd><pre>{autonomyDisplay.vmTaskRuns}</pre></dd>
            </div>
            <div>
              <dt>Pesquisas</dt>
              <dd><pre>{autonomyDisplay.research}</pre></dd>
            </div>
            <div>
              <dt>Aprendizados</dt>
              <dd><pre>{autonomyDisplay.learning}</pre></dd>
            </div>
            <div>
              <dt>Rollbacks</dt>
              <dd><pre>{autonomyDisplay.rollbacks}</pre></dd>
            </div>
            <div>
              <dt>Logs</dt>
              <dd><pre>{autonomyDisplay.logs}</pre></dd>
            </div>
          </dl>
        </section>
      </div>
    </section>
  );
}

export default AutonomyHudPage;
