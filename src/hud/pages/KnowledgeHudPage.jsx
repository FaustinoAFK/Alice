import { DefinitionList } from '../components/DefinitionList';

export function KnowledgeHudPage({ debugHud }) {
  const knowledgeDisplay = debugHud.knowledge.display;
  const knowledgeTimeline = knowledgeDisplay.expansionSteps;

  return (
    <section className="hud-page" aria-label="Conhecimento web">
      <div className="page-hero page-hero--compact">
        <p className="topbar-kicker">contexto ativo</p>
        <h2>Investigacao da pagina</h2>
        <p>Caminho de entendimento usado pela Alice no ultimo turno, da pagina atual ate possiveis expansoes.</p>
      </div>

      <section className="knowledge-timeline" aria-label="Caminho de expansao">
        {knowledgeTimeline.map((step, index) => (
          <article key={`${step}-${index}`} className="timeline-step">
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{step}</strong>
          </article>
        ))}
      </section>

      <section className="knowledge-result-card" aria-label="Resultado da investigacao">
        <div className="section-header">
          <span>resultado final</span>
          <strong>{knowledgeDisplay.origin}</strong>
        </div>
        <div className="knowledge-result-grid">
          <div>
            <span>Escopo</span>
            <strong>{knowledgeDisplay.scope}</strong>
          </div>
          <div>
            <span>Suficiencia</span>
            <strong>{knowledgeDisplay.sufficiency}</strong>
          </div>
          <div>
            <span>Fallback</span>
            <strong>{knowledgeDisplay.fallbackReason}</strong>
          </div>
        </div>
        <p>{knowledgeDisplay.summaryHint}</p>
      </section>

      <div className="debug-hud__grid">
        <section className="debug-hud__section">
          <div className="section-header">
            <span>contexto</span>
            <strong>Pagina atual</strong>
          </div>
          <DefinitionList
            items={[
              ['Titulo', knowledgeDisplay.title],
              ['Dominio', knowledgeDisplay.domain],
              ['Selecao', knowledgeDisplay.selectedText],
              ['URL', knowledgeDisplay.url],
            ]}
          />
        </section>

        <section className="debug-hud__section">
          <div className="section-header">
            <span>decisao</span>
            <strong>Escopo e suficiencia</strong>
          </div>
          <DefinitionList
            items={[
              ['Inicial', `${knowledgeDisplay.initialScope} / ${knowledgeDisplay.initialSufficiency}`],
              ['Final', `${knowledgeDisplay.scope} / ${knowledgeDisplay.sufficiency}`],
              ['Origem', knowledgeDisplay.origin],
              ['Refresh', `${knowledgeDisplay.refreshMode} (${debugHud.knowledge.refreshLatency})`],
              ['Fallback', knowledgeDisplay.fallbackReason],
            ]}
          />
        </section>

        <section className="debug-hud__section debug-hud__section--wide">
          <div className="section-header">
            <span>fontes</span>
            <strong>Consulta e paginas lidas</strong>
          </div>
          <dl>
            <div>
              <dt>Consultadas</dt>
              <dd><pre>{knowledgeDisplay.sources}</pre></dd>
            </div>
            <div>
              <dt>Paginas lidas</dt>
              <dd><pre>{knowledgeDisplay.fetchedPages}</pre></dd>
            </div>
            <div>
              <dt>Trace</dt>
              <dd><pre>{knowledgeDisplay.trace}</pre></dd>
            </div>
          </dl>
        </section>
      </div>
    </section>
  );
}

export default KnowledgeHudPage;
