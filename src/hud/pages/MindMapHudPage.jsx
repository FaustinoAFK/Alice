import MindMapEditor from '../mindMap/MindMapEditor';

export function MindMapHudPage({
  activeMindMap,
  mindMapRevision,
  onMindMapChange,
}) {
  const nodeCount = activeMindMap?.nodes?.length || 0;
  const edgeCount = activeMindMap?.edges?.length || 0;

  return (
    <section className="hud-page hud-mind-map">
      <div className="page-hero page-hero--compact">
        <span className="topbar-kicker">Mapa</span>
        <h2>Raciocinio visual</h2>
        <p>{nodeCount} topicos conectados por {edgeCount} relacoes.</p>
      </div>

      <div className="mind-map-shell">
        <MindMapEditor
          key={mindMapRevision}
          initialData={activeMindMap}
          onChange={onMindMapChange}
        />
      </div>
    </section>
  );
}

export default MindMapHudPage;
