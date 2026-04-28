/* eslint-disable react-hooks/set-state-in-effect -- React Flow state is synchronized from imported map data and edge-derived metadata in this editor. */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Panel,
  MarkerType,
  ConnectionLineType,
  MiniMap,
  useReactFlow,
  useOnSelectionChange
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { Download, Image as ImageIcon, Plus, Trash2, FileText, AlignCenter, CornerUpLeft, CornerUpRight, Upload, FilePlus2 } from 'lucide-react';
import CustomNode from './CustomNode';
import { saveToStorage, loadFromStorage } from './utils/storage';
import { exportToImage, exportToMarkdown, exportToJson } from './utils/export';
import { getLayoutedElements } from './utils/layout';
import { createStarterMindMap, normalizeMindMapData, parseMindMapJson } from './utils/mindMapData';

const nodeTypes = {
  custom: CustomNode,
  task: CustomNode,
  goal: CustomNode,
  idea: CustomNode,
  resource: CustomNode,
  blocker: CustomNode,
  note: CustomNode,
};

const cloneMapData = (data) => JSON.parse(JSON.stringify(data));

const buildDefaultEdge = (params) => ({
  ...params,
  animated: true,
  type: 'smoothstep',
  style: { stroke: 'rgba(255, 255, 255, 0.4)', strokeWidth: 3 },
  markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(255, 255, 255, 0.4)' },
});

function MindMapEditorContent({
  initialData = null,
  onChange = null,
  readOnly = false,
  storageKey = '',
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isReady, setIsReady] = useState(false);
  const reactFlowWrapper = useRef(null);
  const initialDataRef = useRef(initialData);
  const onChangeRef = useRef(onChange);
  const saveTimeoutRef = useRef(null);
  const importInputRef = useRef(null);
  const editingSnapshotRef = useRef(new Set());

  const { getNodes, getEdges } = useReactFlow();
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const takeSnapshot = useCallback(() => {
    if (readOnly) return;
    const nds = getNodes();
    const eds = getEdges();
    setPast(p => [...p.slice(-29), { nodes: cloneMapData(nds), edges: cloneMapData(eds) }]);
    setFuture([]);
  }, [getNodes, getEdges, readOnly]);

  const handleDeleteNode = useCallback((id) => {
    if (readOnly) return;
    takeSnapshot();
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
  }, [takeSnapshot, setNodes, setEdges, readOnly]);

  const handleColorChange = useCallback((id, color) => {
    if (readOnly) return;
    takeSnapshot();
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) return { ...node, data: { ...node.data, color } };
        return node;
      })
    );
  }, [takeSnapshot, setNodes, readOnly]);

  const handleNodeChange = useCallback((id, newLabel) => {
    if (readOnly) return;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) return { ...node, data: { ...node.data, label: newLabel } };
        return node;
      })
    );
  }, [setNodes, readOnly]);

  const handleNodeEditStart = useCallback((id) => {
    if (readOnly || editingSnapshotRef.current.has(id)) return;
    editingSnapshotRef.current.add(id);
    takeSnapshot();
  }, [takeSnapshot, readOnly]);

  const handleNodeEditEnd = useCallback((id) => {
    editingSnapshotRef.current.delete(id);
  }, []);

  const handleToggleFold = useCallback((id) => {
    if (readOnly) return;
    takeSnapshot();

    const currentEdges = getEdges();
    const currentNodes = getNodes();
    const nodeToToggle = currentNodes.find(n => n.id === id);
    if (!nodeToToggle) return;

    const isNowCollapsed = !nodeToToggle.data.isCollapsed;

    const hiddenNodeIds = new Set();
    const queue = [id];
    const visited = new Set();

    while (queue.length > 0) {
      const curr = queue.shift();
      visited.add(curr);
      currentEdges.filter(e => e.source === curr).forEach(e => {
        hiddenNodeIds.add(e.target);
        if (!visited.has(e.target)) queue.push(e.target);
      });
    }

    setNodes((nds) => nds.map((n) => {
      if (n.id === id) {
        return { ...n, data: { ...n.data, isCollapsed: isNowCollapsed } };
      }
      if (hiddenNodeIds.has(n.id)) {
        return { ...n, hidden: isNowCollapsed };
      }
      return n;
    }));

    setEdges((eds) => eds.map(e => {
      if (hiddenNodeIds.has(e.target) || hiddenNodeIds.has(e.source)) {
        return { ...e, hidden: isNowCollapsed };
      }
      return e;
    }));
  }, [takeSnapshot, getNodes, getEdges, setNodes, setEdges, readOnly]);

  const bootstrapDataHooks = useCallback((nds) => {
    return nds.map(n => ({
      ...n,
      sourcePosition: 'right',
      targetPosition: 'left',
      data: {
        ...n.data,
        status: n.status || 'unknown',
        nodeType: n.type || 'idea',
        readOnly,
        onChange: handleNodeChange,
        onEditStart: handleNodeEditStart,
        onEditEnd: handleNodeEditEnd,
        onDelete: handleDeleteNode,
        onColorChange: handleColorChange,
        onToggleFold: handleToggleFold,
      }
    }));
  }, [handleNodeChange, handleNodeEditStart, handleNodeEditEnd, handleDeleteNode, handleColorChange, handleToggleFold, readOnly]);

  const undo = useCallback(() => {
    if (readOnly || past.length === 0) return;
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    const previous = past[past.length - 1];

    setPast(p => p.slice(0, p.length - 1));
    setFuture(f => [...f, { nodes: cloneMapData(currentNodes), edges: cloneMapData(currentEdges) }]);

    setNodes(bootstrapDataHooks(previous.nodes));
    setEdges(previous.edges);
  }, [past, getNodes, getEdges, setNodes, setEdges, bootstrapDataHooks, readOnly]);

  const redo = useCallback(() => {
    if (readOnly || future.length === 0) return;
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    const next = future[future.length - 1];

    setFuture(f => f.slice(0, f.length - 1));
    setPast(p => [...p, { nodes: cloneMapData(currentNodes), edges: cloneMapData(currentEdges) }]);

    setNodes(bootstrapDataHooks(next.nodes));
    setEdges(next.edges);
  }, [future, getNodes, getEdges, setNodes, setEdges, bootstrapDataHooks, readOnly]);

  useEffect(() => {
    const handleGlobalKeys = (e) => {
      if (readOnly || e.target.tagName.toLowerCase() === 'textarea') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) { e.preventDefault(); redo(); }
        else { e.preventDefault(); undo(); }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault(); redo();
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [undo, redo, readOnly]);

  useOnSelectionChange({
    onChange: ({ nodes: selectedNodes }) => {
      const currentEdges = getEdges();
      const selectedIds = new Set(selectedNodes.map(n => n.id));

      if (selectedIds.size === 0) {
        setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, dimmed: false } })));
        setEdges(eds => eds.map(e => ({ ...e, style: { ...e.style, opacity: 1 } })));
        return;
      }

      const focusNodes = new Set();
      selectedIds.forEach(id => {
        const getAllRelated = (startId, forward) => {
          const related = new Set();
          const queue = [startId];
          while (queue.length > 0) {
            const curr = queue.shift();
            related.add(curr);
            const connected = currentEdges.filter(e => forward ? e.source === curr : e.target === curr);
            connected.forEach(e => {
              const nextNode = forward ? e.target : e.source;
              if (!related.has(nextNode)) queue.push(nextNode);
            });
          }
          return related;
        };
        getAllRelated(id, true).forEach(x => focusNodes.add(x));
        getAllRelated(id, false).forEach(x => focusNodes.add(x));
      });

      setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, dimmed: !focusNodes.has(n.id) } })));
      setEdges(eds => eds.map(e => ({ ...e, style: { ...e.style, opacity: (!focusNodes.has(e.source) || !focusNodes.has(e.target)) ? 0.15 : 1 } })));
    }
  });

  useEffect(() => {
    setNodes(nds => nds.map(n => {
      const hasChildren = edges.some(e => e.source === n.id);
      if (n.data?.hasChildren !== hasChildren || n.data?.readOnly !== readOnly) {
        return { ...n, data: { ...n.data, hasChildren, readOnly } };
      }
      return n;
    }));
  }, [edges, setNodes, readOnly]);

  useEffect(() => {
    let data = null;
    if (initialDataRef.current) {
      try {
        data = normalizeMindMapData(initialDataRef.current);
      } catch {
        data = null;
      }
    }

    if (!data && storageKey) {
      data = loadFromStorage(storageKey);
    }

    if (data && data.nodes && data.nodes.length > 0) {
      setNodes(bootstrapDataHooks(data.nodes));
      setEdges(data.edges || []);
    } else {
      const starterMap = createStarterMindMap();
      setNodes(bootstrapDataHooks(starterMap.nodes));
      setEdges(starterMap.edges);
    }
    setIsReady(true);
  }, [bootstrapDataHooks, setEdges, setNodes, storageKey]);

  useEffect(() => {
    if (!isReady) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (storageKey) {
        saveToStorage(nodes, edges, storageKey);
      }
      if (typeof onChangeRef.current === 'function') {
        onChangeRef.current(normalizeMindMapData({ nodes, edges }));
      }
    }, 1000);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [nodes, edges, isReady, storageKey]);

  const onConnect = useCallback(
    (params) => {
      if (readOnly) return;
      takeSnapshot();
      setEdges((eds) => addEdge(buildDefaultEdge(params), eds));
    },
    [takeSnapshot, setEdges, readOnly]
  );

  const addNode = () => {
    if (readOnly) return;
    takeSnapshot();
    const newNode = {
      id: uuidv4(),
      type: 'idea',
      status: 'pending',
      position: { x: window.innerWidth / 2 - 100 + Math.random() * 50, y: window.innerHeight / 2 - 100 + Math.random() * 50 },
      sourcePosition: 'right',
      targetPosition: 'left',
      data: { label: '', color: 'default', source: 'manual', isCollapsed: false },
      metadata: { tags: [] },
    };
    setNodes((nds) => nds.concat(bootstrapDataHooks([newNode])[0]));
  };

  const clearBoard = () => {
    if (readOnly) return;
    if (window.confirm('Tem certeza que deseja apagar todo o mapa mental?')) {
      takeSnapshot();
      const starterMap = createStarterMindMap();
      setNodes(bootstrapDataHooks(starterMap.nodes));
      setEdges(starterMap.edges);
    }
  };

  const newMap = () => {
    if (readOnly) return;
    if (window.confirm('Criar um novo mapa? O mapa atual será substituído.')) {
      takeSnapshot();
      const starterMap = createStarterMindMap();
      setNodes(bootstrapDataHooks(starterMap.nodes));
      setEdges(starterMap.edges);
    }
  };

  const importJson = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || readOnly) return;

    try {
      const text = await file.text();
      const data = parseMindMapJson(text);
      takeSnapshot();
      setNodes(bootstrapDataHooks(data.nodes));
      setEdges(data.edges);
    } catch (error) {
      console.error('Falha ao importar mapa mental:', error);
      alert('Não foi possível importar este arquivo JSON.');
    }
  }, [bootstrapDataHooks, setEdges, setNodes, takeSnapshot, readOnly]);

  const onLayout = useCallback(() => {
    if (readOnly) return;
    takeSnapshot();
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);
    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);
  }, [takeSnapshot, nodes, edges, setNodes, setEdges, readOnly]);

  const onKeyDown = useCallback((e) => {
    if (readOnly) return;
    const isTyping = e.target.tagName.toLowerCase() === 'textarea';
    const selectedNodes = nodes.filter(n => n.selected);

    if (selectedNodes.length === 1) {
      const parent = selectedNodes[0];

      if (e.key === 'Tab') {
        e.preventDefault();
        takeSnapshot();
        if (isTyping) e.target.blur();

        const newNodeId = uuidv4();
        const newNode = {
          id: newNodeId,
          type: 'idea',
          status: 'pending',
          position: { x: parent.position.x + 250, y: parent.position.y },
          sourcePosition: 'right',
          targetPosition: 'left',
          data: { label: '', color: parent.data.color || 'default', source: 'manual', isCollapsed: false },
          metadata: { tags: [] },
        };

        setNodes((nds) => nds.map(n => ({ ...n, selected: false })).concat(bootstrapDataHooks([{ ...newNode, selected: true }])[0]));
        setEdges((eds) => addEdge(buildDefaultEdge({ source: parent.id, target: newNodeId }), eds));

        setTimeout(() => {
          const textarea = document.getElementById(`text-${newNodeId}`);
          if (textarea) textarea.focus();
        }, 10);

      } else if (e.key === 'Enter') {
        if (isTyping) return;
        e.preventDefault();
        takeSnapshot();
        const parentEdge = edges.find(ed => ed.target === parent.id);
        const sourceId = parentEdge ? parentEdge.source : parent.id;

        const newNodeId = uuidv4();
        const newNode = {
          id: newNodeId,
          type: 'idea',
          status: 'pending',
          position: { x: parent.position.x, y: parent.position.y + 100 },
          sourcePosition: 'right',
          targetPosition: 'left',
          data: { label: '', color: parent.data.color || 'default', source: 'manual', isCollapsed: false },
          metadata: { tags: [] },
        };

        setNodes((nds) => nds.map(n => ({ ...n, selected: false })).concat(bootstrapDataHooks([{ ...newNode, selected: true }])[0]));
        setEdges((eds) => addEdge(buildDefaultEdge({ source: sourceId, target: newNodeId }), eds));

        setTimeout(() => {
          const textarea = document.getElementById(`text-${newNodeId}`);
          if (textarea) textarea.focus();
        }, 10);
      }
    }
  }, [nodes, edges, takeSnapshot, bootstrapDataHooks, setNodes, setEdges, readOnly]);

  if (!isReady) return null;

  return (
    <div className="mind-map-editor" ref={reactFlowWrapper} onKeyDown={onKeyDown} tabIndex={0}>
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        onChange={importJson}
        aria-label="Importar mapa mental em JSON"
        disabled={readOnly}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        snapToGrid={!readOnly}
        snapGrid={[24, 24]}
        connectionLineType={ConnectionLineType.SmoothStep}
        connectionLineStyle={{ stroke: 'rgba(255, 255, 255, 0.4)', strokeWidth: 3 }}
        defaultEdgeOptions={buildDefaultEdge({})}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={() => takeSnapshot()}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          if (!readOnly && window.confirm('Deletar este módulo?')) {
            handleDeleteNode(node.id);
          }
        }}
        onEdgeContextMenu={(event, edge) => {
          event.preventDefault();
          if (readOnly) return;
          takeSnapshot();
          setEdges((eds) => eds.filter(e => e.id !== edge.id));
        }}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        edgesReconnectable={!readOnly}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="#ccc" gap={24} size={1} variant="dots" />
        <Controls style={{ background: 'rgba(25, 27, 36, 0.8)', fill: 'white' }} />

        <MiniMap
          nodeColor={(n) => n.data.color === 'green' ? '#22c55e' : n.data.color === 'red' ? '#ef4444' : n.data.color === 'blue' ? '#3b82f6' : n.data.color === 'gold' ? '#eab308' : '#6d28d9'}
          style={{ background: 'rgba(25, 27, 36, 0.8)' }}
          maskColor="rgba(15, 17, 26, 0.7)"
        />

        <Panel position="top-center" className="tools-panel">
          <button className="btn" onClick={newMap} disabled={readOnly}>
            <FilePlus2 size={16} /> Novo
          </button>

          <button className="btn primary" onClick={addNode} disabled={readOnly}>
            <Plus size={16} /> Módulo
          </button>

          <button className="btn" onClick={onLayout} disabled={readOnly} style={{ color: '#a78bfa', borderColor: 'rgba(167, 139, 250, 0.5)' }}>
            <AlignCenter size={16} /> Auto-Organizar
          </button>

          <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', height: '24px', margin: 'auto 4px' }} />

          <button className="btn" onClick={undo} disabled={readOnly || past.length === 0} title="Desfazer (Ctrl+Z)" style={{ opacity: readOnly || past.length === 0 ? 0.3 : 1 }}>
            <CornerUpLeft size={16} />
          </button>

          <button className="btn" onClick={redo} disabled={readOnly || future.length === 0} title="Refazer (Ctrl+Y)" style={{ opacity: readOnly || future.length === 0 ? 0.3 : 1 }}>
            <CornerUpRight size={16} />
          </button>

          <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', height: '24px', margin: 'auto 4px' }} />

          <button className="btn" onClick={() => exportToImage('png')}>
            <ImageIcon size={16} /> PNG
          </button>

          <button className="btn" onClick={() => exportToImage('svg')}>
            <Download size={16} /> SVG
          </button>

          <button className="btn" onClick={() => exportToMarkdown(nodes, edges)}>
            <FileText size={16} /> TXT
          </button>

          <button className="btn" onClick={() => exportToJson(nodes, edges)}>
            <Download size={16} /> JSON
          </button>

          <button className="btn" onClick={() => importInputRef.current?.click()} disabled={readOnly}>
            <Upload size={16} /> Importar
          </button>

          <button className="btn" style={{ color: '#ef4444' }} onClick={clearBoard} disabled={readOnly} title="Limpar mapa" aria-label="Limpar mapa">
            <Trash2 size={16} />
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export default function MindMapEditor(props) {
  return (
    <ReactFlowProvider>
      <MindMapEditorContent {...props} />
    </ReactFlowProvider>
  );
}
