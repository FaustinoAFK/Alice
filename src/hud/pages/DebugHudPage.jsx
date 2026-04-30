import { DefinitionList } from '../components/DefinitionList';
import { buildDebugSummaryCards } from '../hudViewModel';

export function DebugHudPage({ debugHud }) {
  const debugSummaryCards = buildDebugSummaryCards(debugHud);
  const interactions = debugHud.interactions || [];

  return (
    <section className="hud-page" aria-label="Debug HUD">
      <div className="page-hero page-hero--compact">
        <p className="topbar-kicker">diagnostico vivo</p>
        <h2>Estado interno da sessao</h2>
        <p>Uma pagina tecnica compacta para verificar sinais, erros e ultimos textos sem poluir o modo ao vivo.</p>
      </div>

      <section className="debug-summary-grid" aria-label="Resumo do debug">
        {debugSummaryCards.map(([label, value]) => (
          <article key={label} className="debug-summary-card">
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <div className="debug-hud__grid">
        <section className="debug-hud__section debug-hud__section--wide">
          <details open>
            <summary>Interacoes</summary>
            {interactions.length > 0 ? (
              <div className="debug-interactions">
                {interactions.map((interaction) => (
                  <article
                    key={interaction.id}
                    className={`debug-interaction debug-interaction--${interaction.ok ? 'ok' : 'fail'}`}
                  >
                    <div className="debug-interaction__header">
                      <span>{interaction.time}</span>
                      <strong>
                        {interaction.kind === 'tool'
                          ? interaction.toolName
                          : 'Conversa'}
                      </strong>
                      <em>{interaction.status}</em>
                    </div>

                    {interaction.kind === 'tool' ? (
                      <DefinitionList
                        items={[
                          ['Operacao', interaction.operation],
                          ['Resultado', interaction.ok ? 'ok' : 'falhou'],
                          ['Mensagem', interaction.message],
                          ['Motivo', interaction.reason],
                          ['Pedido', interaction.userText],
                          ['Args', interaction.argsSummary],
                          ['Resposta', interaction.responseSummary],
                        ]}
                      />
                    ) : (
                      <DefinitionList
                        items={[
                          ['Voce falou', interaction.userText],
                          ['Alice respondeu', interaction.aliceText],
                        ]}
                      />
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="debug-empty-state">Nenhuma interacao registrada nesta sessao.</p>
            )}
          </details>
        </section>

        <section className="debug-hud__section">
          <details open>
            <summary>Sessao</summary>
            <DefinitionList
              items={[
                ['Status', debugHud.session.status],
                ['Legenda', debugHud.session.caption],
                ['Entrada', debugHud.session.inputCaption],
                ['Fala confiavel', debugHud.session.trustedUtterance],
                ['Saida', debugHud.session.outputTranscript],
                ['Tela', `${debugHud.session.screenWidth}x${debugHud.session.screenHeight}`],
              ]}
            />
          </details>
        </section>

        <section className="debug-hud__section">
          <details open>
            <summary>Diagnosticos</summary>
            <DefinitionList
              items={[
                ['Conexao', debugHud.diagnostics.connection],
                ['Microfone', debugHud.diagnostics.microphone],
                ['Tela', debugHud.diagnostics.screen],
                ['Gemini', debugHud.diagnostics.gemini],
                ['Audio', debugHud.diagnostics.audioChunksSent],
                ['Frames', debugHud.diagnostics.videoFramesSent],
                ['Frame visual', debugHud.diagnostics.lastVideoFrame],
                ['Fonte visual', debugHud.diagnostics.lastVideoSource],
                ['Eventos', debugHud.diagnostics.serverMessagesReceived],
                ['Voz Alice', debugHud.diagnostics.outputAudioChunksReceived],
                ['Reconexoes', debugHud.diagnostics.reconnectAttempts],
                ['Retomadas', debugHud.diagnostics.successfulResumptions],
                ['Fallbacks', debugHud.diagnostics.rehydratedReconnects],
                ['Fechamento', debugHud.diagnostics.lastCloseReason],
                ['Ult. erro', debugHud.diagnostics.lastError],
              ]}
            />
          </details>
        </section>

        <section className="debug-hud__section debug-hud__section--wide">
          <details open>
            <summary>Memoria recente</summary>
            <pre>{debugHud.memorySummary}</pre>
          </details>
        </section>

        <section className="debug-hud__section">
          <details open>
            <summary>Persistencia</summary>
            <DefinitionList
              items={[
                ['Memoria', `${debugHud.persistence?.memorySizeBytes || 0}/${debugHud.persistence?.memoryMaxBytes || 0} bytes`],
                ['Uso', `${debugHud.persistence?.memoryPercentUsed || 0}%`],
                ['Status', debugHud.persistence?.memoryStatus || '-'],
                ['Perto do limite', debugHud.persistence?.memoryNearLimit ? 'sim' : 'nao'],
                ['Ult. save memoria', debugHud.persistence?.lastMemorySaveAt || '-'],
                ['Erro memoria', debugHud.persistence?.lastMemorySaveError || '-'],
                ['Erro evidencia', debugHud.persistence?.lastRunnerEvidenceError || '-'],
                ['Ult. erro', debugHud.persistence?.lastError || '-'],
              ]}
            />
          </details>
        </section>
      </div>
    </section>
  );
}
