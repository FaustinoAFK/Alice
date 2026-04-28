import dagre from 'dagre';

export const getLayoutedElements = (nodes, edges, direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Direction: 'TB' (top to bottom) or 'LR' (left to right)
  dagreGraph.setGraph({ rankdir: direction, ranksep: 100, nodesep: 50 });

  nodes.forEach((node) => {
    // Tenta pegar o tamanho real renderizado (que a biblioteca ReactFlow injeta em 'measured'), 
    // se não, usa o fallback. Isso evita sobreposições de blocos gigantes com textos enormes!
    const width = node.measured?.width || 160;
    const height = node.measured?.height || 60;

    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const width = node.measured?.width || 160;
    const height = node.measured?.height || 60;
    
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};
