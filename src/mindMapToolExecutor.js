import { v4 as uuidv4 } from 'uuid';
import { buildMarkdown } from './hud/mindMap/utils/export';
import { getLayoutedElements } from './hud/mindMap/utils/layout';
import {
  appendMindMapEvolution,
  appendMindMapHistory,
  buildMindMapJson,
  createStarterMindMap,
  markNodeBlocked,
  markNodeDone,
  markNodeFailed,
  markNodeInProgress,
  normalizeMindMap,
  normalizeNodeStatus,
  setMindMapNodeStatus,
  isValidMindMapData,
  normalizeMindMapData,
} from './hud/mindMap/utils/mindMapData';
import { getActiveMindMap } from './aliceMemory';

export const MIND_MAP_TOOL_NAMES = ['update_mind_map'];

export const isMindMapToolName = (toolName) => MIND_MAP_TOOL_NAMES.includes(toolName);

const normalizeString = (value) => String(value || '').trim();

const buildResponse = ({
  ok,
  message,
  operation,
  mindMap,
  exportResult = null,
  reason = '',
  targetMapId = '',
  appliedOperations = [],
}) => ({
  ok,
  message,
  operation,
  reason,
  targetMapId,
  appliedOperations,
  mindMap: normalizeMindMapData(mindMap),
  export: exportResult,
  summary: {
    nodes: normalizeMindMapData(mindMap).nodes.length,
    edges: normalizeMindMapData(mindMap).edges.length,
  },
});

const createNode = ({ id, label, color, position, type, status, description, priority, source, metadata } = {}, index = 0) => ({
  id: normalizeString(id) || uuidv4(),
  type: normalizeString(type) || 'idea',
  status: normalizeString(status) || 'pending',
  position: {
    x: Number.isFinite(Number(position?.x)) ? Number(position.x) : 250 + index * 220,
    y: Number.isFinite(Number(position?.y)) ? Number(position.y) : 80 + index * 80,
  },
  sourcePosition: 'right',
  targetPosition: 'left',
  data: {
    label: normalizeString(label) || `Ideia sem titulo ${index + 1}`,
    color: normalizeString(color) || 'default',
    description: normalizeString(description),
    priority: normalizeString(priority),
    source: normalizeString(source) || 'manual',
    isCollapsed: false,
  },
  metadata: metadata && typeof metadata === 'object' ? metadata : { tags: [] },
});

const findNode = (mindMap, id) => mindMap.nodes.find((node) => node.id === id);

const uniqueIds = (values = []) => {
  const seen = new Set();
  return values
    .map((value) => normalizeString(value))
    .filter((value) => {
      if (!value || seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
};

const buildEdge = ({ id = '', source, target, label = '' }, index = 0) => ({
  id: normalizeString(id) || `edge-${source}-${target}-${index + 1}`,
  source,
  target,
  type: 'smoothstep',
  animated: true,
  ...(normalizeString(label) ? { label: normalizeString(label) } : {}),
});

const findExistingEdge = (mindMap, source, target, label = '') =>
  mindMap.edges.find((edge) =>
    edge.source === source &&
    edge.target === target &&
    normalizeString(edge.label) === normalizeString(label),
  );

const collectEdgeRequests = (payload = {}) => {
  if (Array.isArray(payload.connections) && payload.connections.length > 0) {
    return payload.connections.map((connection) => ({
      id: connection?.id,
      source: connection?.source,
      target: connection?.target,
      label: connection?.label,
    }));
  }

  return [{
    id: payload.id,
    source: payload.source,
    target: payload.target,
    label: payload.label,
  }];
};

const buildStatusMap = ({ operation, payload, baseMindMap, recordHistory, now }) => {
  const nodeId = normalizeString(payload.id || payload.nodeId);
  const statusByOperation = {
    set_status: normalizeNodeStatus(payload.status),
    mark_done: 'done',
    mark_failed: 'failed',
    mark_blocked: 'blocked',
    mark_in_progress: 'in_progress',
  };
  const status = statusByOperation[operation];

  if (!nodeId || !findNode(baseMindMap, nodeId)) {
    return {
      ok: false,
      reason: 'node_not_found',
      message: 'Status rejeitado: topico nao existe no mapa.',
      mindMap: baseMindMap,
    };
  }

  if (operation === 'set_status' && normalizeNodeStatus(payload.status) === 'unknown' && normalizeString(payload.status) !== 'unknown') {
    return {
      ok: false,
      reason: 'invalid_status',
      message: 'Status rejeitado: valor operacional invalido.',
      mindMap: baseMindMap,
    };
  }

  if (recordHistory) {
    const helpers = {
      mark_done: markNodeDone,
      mark_failed: markNodeFailed,
      mark_blocked: markNodeBlocked,
      mark_in_progress: markNodeInProgress,
    };
    const nextMap = operation === 'set_status'
      ? setMindMapNodeStatus(baseMindMap, nodeId, status, payload.metadata || {}, { now, source: payload.source || 'alice' })
      : helpers[operation](baseMindMap, nodeId, payload.metadata || {}, { now, source: payload.source || 'alice' });

    return {
      ok: true,
      message: 'Status do topico atualizado.',
      mindMap: nextMap,
    };
  }

  const nextMap = normalizeMindMap({
    ...baseMindMap,
    nodes: baseMindMap.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            status,
            metadata: {
              ...node.metadata,
              ...(payload.metadata || {}),
              updatedAt: now,
              lastSyncedAt: payload.source === 'execution' ? now : node.metadata?.lastSyncedAt || '',
            },
          }
        : node,
    ),
  });

  return {
    ok: true,
    message: 'Status do topico atualizado.',
    mindMap: appendMindMapEvolution(nextMap, {
      type: 'status_changed',
      source: payload.source || 'alice',
      summary: `${nodeId} -> ${status}`,
      affectedNodeIds: [nodeId],
      metadata: { status },
      now,
    }),
  };
};

export const applyMindMapOperation = ({
  operation,
  payload = {},
  currentMindMap = createStarterMindMap(),
  recordHistory = true,
  now = new Date().toISOString(),
} = {}) => {
  const baseMindMap = normalizeMindMap(currentMindMap);

  switch (operation) {
    case 'replace': {
      const replacement = payload.map || payload.mindMap || payload;
      if (!isValidMindMapData(replacement)) {
        return {
          ok: false,
          reason: 'invalid_replacement_payload',
          message: 'Substituicao rejeitada: payload de mapa invalido.',
          mindMap: baseMindMap,
        };
      }

      const normalizedReplacement = normalizeMindMap(replacement);
      const layoutedReplacement = getLayoutedElements(normalizedReplacement.nodes, normalizedReplacement.edges);

      return {
        ok: true,
        message: 'Mapa mental substituido e organizado.',
        mindMap: appendMindMapEvolution(normalizeMindMap({
          ...normalizedReplacement,
          ...layoutedReplacement,
        }), {
          type: 'map_replaced',
          source: payload.source || 'alice',
          summary: 'Mapa mental substituido.',
          affectedNodeIds: layoutedReplacement.nodes.map((node) => node.id).slice(0, 20),
          now,
        }),
      };
    }

    case 'add_node': {
      const node = createNode(payload.node || payload, baseMindMap.nodes.length);
      const linkedNodeIds = uniqueIds([
        payload.parentId,
        ...(Array.isArray(payload.parentIds) ? payload.parentIds : []),
        ...(Array.isArray(payload.linkedToIds) ? payload.linkedToIds : []),
      ]).filter((id) => findNode(baseMindMap, id));
      const nextEdges = linkedNodeIds.reduce((edges, linkedNodeId, index) => {
        if (findExistingEdge({ ...baseMindMap, edges }, linkedNodeId, node.id)) {
          return edges;
        }

        return [
          ...edges,
          buildEdge(
            {
              id: Array.isArray(payload.edgeIds) ? payload.edgeIds[index] : payload.edgeId,
              source: linkedNodeId,
              target: node.id,
            },
            baseMindMap.edges.length + index,
          ),
        ];
      }, [...baseMindMap.edges]);
      const nextMap = {
        ...baseMindMap,
        nodes: [...baseMindMap.nodes, node],
        edges: nextEdges,
      };

      return {
        ok: true,
        message: linkedNodeIds.length > 1
          ? 'Topico adicionado ao mapa mental com varias conexoes.'
          : 'Topico adicionado ao mapa mental.',
        mindMap: appendMindMapEvolution(normalizeMindMap(nextMap), {
          type: 'node_added',
          source: payload.source || 'alice',
          summary: linkedNodeIds.length > 0
            ? `Topico adicionado: ${node.data.label} ligado a ${linkedNodeIds.join(', ')}`
            : `Topico adicionado: ${node.data.label}`,
          affectedNodeIds: [node.id, ...linkedNodeIds],
          now,
        }),
      };
    }

    case 'add_edge': {
      const requestedEdges = collectEdgeRequests(payload).map((edge) => ({
        id: normalizeString(edge.id),
        source: normalizeString(edge.source),
        target: normalizeString(edge.target),
        label: normalizeString(edge.label),
      }));
      const invalidEdge = requestedEdges.find((edge) =>
        !edge.source ||
        !edge.target ||
        !findNode(baseMindMap, edge.source) ||
        !findNode(baseMindMap, edge.target),
      );

      if (invalidEdge) {
        return {
          ok: false,
          reason: 'invalid_edge_endpoints',
          message: 'Conexao rejeitada: origem ou destino nao existe no mapa.',
          mindMap: baseMindMap,
        };
      }

      const nextEdges = requestedEdges.reduce((edges, edge, index) => {
        if (findExistingEdge({ ...baseMindMap, edges }, edge.source, edge.target, edge.label)) {
          return edges;
        }

        return [
          ...edges,
          buildEdge(
            {
              id: edge.id,
              source: edge.source,
              target: edge.target,
              label: edge.label,
            },
            baseMindMap.edges.length + index,
          ),
        ];
      }, [...baseMindMap.edges]);
      const affectedNodeIds = uniqueIds(
        requestedEdges.flatMap((edge) => [edge.source, edge.target]),
      );

      return {
        ok: true,
        message: requestedEdges.length > 1
          ? 'Conexoes adicionadas ao mapa mental.'
          : 'Conexao adicionada ao mapa mental.',
        mindMap: appendMindMapEvolution(normalizeMindMap({
          ...baseMindMap,
          edges: nextEdges,
        }), {
          type: 'edge_added',
          source: payload.source || 'alice',
          summary: requestedEdges
            .slice(0, 4)
            .map((edge) => `${edge.source} -> ${edge.target}`)
            .join('; '),
          affectedNodeIds,
          now,
        }),
      };
    }

    case 'rename_node': {
      const id = normalizeString(payload.id || payload.nodeId);
      const label = normalizeString(payload.label);
      if (!id || !label || !findNode(baseMindMap, id)) {
        return {
          ok: false,
          reason: 'invalid_rename_payload',
          message: 'Renomeacao rejeitada: topico ausente ou label vazia.',
          mindMap: baseMindMap,
        };
      }

      return {
        ok: true,
        message: 'Topico renomeado.',
        mindMap: appendMindMapEvolution(normalizeMindMap({
          ...baseMindMap,
          nodes: baseMindMap.nodes.map((node) =>
            node.id === id ? { ...node, data: { ...node.data, label } } : node,
          ),
        }), {
          type: 'node_renamed',
          source: payload.source || 'alice',
          summary: `Topico renomeado: ${id}`,
          affectedNodeIds: [id],
          now,
        }),
      };
    }

    case 'remove_node': {
      const id = normalizeString(payload.id || payload.nodeId);
      if (!id || !findNode(baseMindMap, id)) {
        return {
          ok: false,
          reason: 'node_not_found',
          message: 'Remocao rejeitada: topico nao existe no mapa.',
          mindMap: baseMindMap,
        };
      }

      return {
        ok: true,
        message: 'Topico removido do mapa mental.',
        mindMap: appendMindMapEvolution(normalizeMindMap({
          ...baseMindMap,
          nodes: baseMindMap.nodes.filter((node) => node.id !== id),
          edges: baseMindMap.edges.filter((edge) => edge.source !== id && edge.target !== id),
        }), {
          type: 'node_removed',
          source: payload.source || 'alice',
          summary: `Topico removido: ${id}`,
          affectedNodeIds: [id],
          now,
        }),
      };
    }

    case 'remove_edge': {
      const id = normalizeString(payload.id || payload.edgeId);
      const source = normalizeString(payload.source);
      const target = normalizeString(payload.target);
      const nextEdges = baseMindMap.edges.filter((edge) => {
        if (id) return edge.id !== id;
        return !(source && target && edge.source === source && edge.target === target);
      });

      if (nextEdges.length === baseMindMap.edges.length) {
        return {
          ok: false,
          reason: 'edge_not_found',
          message: 'Remocao rejeitada: conexao nao encontrada.',
          mindMap: baseMindMap,
        };
      }

      return {
        ok: true,
        message: 'Conexao removida do mapa mental.',
        mindMap: appendMindMapEvolution(normalizeMindMap({ ...baseMindMap, edges: nextEdges }), {
          type: 'edge_removed',
          source: payload.source || 'alice',
          summary: 'Conexao removida.',
          affectedNodeIds: [source, target].filter(Boolean),
          now,
        }),
      };
    }

    case 'set_status':
    case 'mark_done':
    case 'mark_failed':
    case 'mark_blocked':
    case 'mark_in_progress':
      return buildStatusMap({ operation, payload, baseMindMap, recordHistory, now });

    case 'layout': {
      const layouted = getLayoutedElements(baseMindMap.nodes, baseMindMap.edges);
      return {
        ok: true,
        message: 'Mapa mental reorganizado.',
        mindMap: appendMindMapEvolution(normalizeMindMap({
          ...baseMindMap,
          ...layouted,
        }), {
          type: 'layout',
          source: payload.source || 'alice',
          summary: 'Layout reorganizado.',
          affectedNodeIds: baseMindMap.nodes.map((node) => node.id).slice(0, 20),
          now,
        }),
      };
    }

    case 'rollback': {
      const snapshot = baseMindMap.history?.at(-1);
      if (!snapshot) {
        return {
          ok: false,
          reason: 'history_empty',
          message: 'Rollback rejeitado: nao ha snapshot anterior.',
          mindMap: baseMindMap,
        };
      }

      return {
        ok: true,
        message: 'Mapa mental restaurado para a ultima versao.',
        mindMap: appendMindMapEvolution(normalizeMindMap({
          ...baseMindMap,
          nodes: snapshot.nodes,
          edges: snapshot.edges,
          history: baseMindMap.history.slice(0, -1),
        }), {
          type: 'rollback',
          source: payload.source || 'alice',
          summary: 'Rollback para ultimo snapshot.',
          affectedNodeIds: snapshot.nodes.map((node) => node.id).slice(0, 20),
          now,
        }),
      };
    }

    case 'batch': {
      const operations = Array.isArray(payload.operations) ? payload.operations : [];
      if (operations.length === 0) {
        return {
          ok: false,
          reason: 'empty_batch',
          message: 'Batch rejeitado: nenhuma operacao informada.',
          mindMap: baseMindMap,
          appliedOperations: [],
        };
      }

      let nextMap = baseMindMap;
      const appliedOperations = [];
      for (const item of operations.slice(0, 25)) {
        const miniOperation = normalizeString(item?.operation);
        if (miniOperation === 'export' || miniOperation === 'batch' || miniOperation === 'rollback') {
          return {
            ok: false,
            reason: 'unsupported_batch_operation',
            message: `Batch rejeitado: operacao ${miniOperation || 'desconhecida'} nao pode rodar dentro de batch.`,
            mindMap: baseMindMap,
            appliedOperations,
          };
        }

        const miniResult = applyMindMapOperation({
          operation: miniOperation,
          payload: item?.payload || {},
          currentMindMap: nextMap,
          recordHistory: false,
          now,
        });

        if (!miniResult.ok) {
          return {
            ...miniResult,
            message: `Batch rejeitado: ${miniResult.message}`,
            mindMap: baseMindMap,
            appliedOperations,
          };
        }

        nextMap = miniResult.mindMap;
        appliedOperations.push(miniOperation);
      }

      return {
        ok: true,
        message: 'Batch de mapa mental aplicado.',
        mindMap: appendMindMapHistory(nextMap, baseMindMap, { reason: 'batch', now }),
        appliedOperations,
      };
    }

    case 'export': {
      const format = normalizeString(payload.format).toLowerCase() || 'markdown';
      const filterStatus = Array.isArray(payload.filterStatus)
        ? new Set(payload.filterStatus.map((status) => normalizeNodeStatus(status)))
        : null;
      const exportMap = filterStatus
        ? normalizeMindMap({
            ...baseMindMap,
            nodes: baseMindMap.nodes.filter((node) => filterStatus.has(node.status)),
            edges: baseMindMap.edges.filter((edge) => {
              const nodeIds = new Set(baseMindMap.nodes.filter((node) => filterStatus.has(node.status)).map((node) => node.id));
              return nodeIds.has(edge.source) && nodeIds.has(edge.target);
            }),
          })
        : baseMindMap;
      const exportResult = format === 'json'
        ? {
            format: 'json',
            content: buildMindMapJson(exportMap.nodes, exportMap.edges),
          }
        : {
            format: 'markdown',
            content: buildMarkdown(exportMap.nodes, exportMap.edges),
          };

      return {
        ok: true,
        message: 'Mapa mental exportado.',
        mindMap: baseMindMap,
        exportResult,
      };
    }

    default:
      return {
        ok: false,
        reason: 'unsupported_operation',
        message: `Operacao de mapa mental nao suportada: ${operation || 'desconhecida'}.`,
        mindMap: baseMindMap,
      };
  }
};

export const executeMindMapFunctionCall = async ({
  functionCall,
  currentMindMap = createStarterMindMap(),
  currentMemory = null,
} = {}) => {
  const toolName = functionCall?.name || '';

  if (!isMindMapToolName(toolName)) {
    return {
      handled: false,
      toolName,
      response: null,
      mindMap: null,
    };
  }

  const args = functionCall?.args || {};
  const operation = normalizeString(args.operation);
  const payload = args.payload || {};
  const requestedTargetMapId = normalizeString(args.targetMapId || payload.targetMapId);
  const memoryMindMaps = currentMemory?.mindMaps?.byId || {};
  const targetMapId = requestedTargetMapId || currentMemory?.mindMaps?.activeId || normalizeMindMap(currentMindMap).id;

  if (requestedTargetMapId && !memoryMindMaps[requestedTargetMapId] && currentMemory?.mindMaps) {
    const fallbackMindMap = getActiveMindMap(currentMemory);
    const response = buildResponse({
      ok: false,
      operation,
      targetMapId: requestedTargetMapId,
      reason: 'target_map_not_found',
      message: 'Operacao rejeitada: mapa mental alvo nao encontrado.',
      mindMap: fallbackMindMap,
    });

    console.warn('[mind-map-tool] target map not found', { operation, targetMapId: requestedTargetMapId });

    return {
      handled: true,
      toolName,
      response,
      mindMap: fallbackMindMap,
      targetMapId: currentMemory.mindMaps.activeId,
    };
  }

  const selectedMindMap = requestedTargetMapId && memoryMindMaps[requestedTargetMapId]
    ? memoryMindMaps[requestedTargetMapId]
    : currentMemory?.mindMaps
      ? getActiveMindMap(currentMemory)
      : currentMindMap;

  const result = applyMindMapOperation({ operation, payload, currentMindMap: selectedMindMap });
  const response = buildResponse({ operation, targetMapId, ...result });

  if (result.ok) {
    console.info('[mind-map-tool] operation completed', { operation, targetMapId });
  } else {
    console.warn('[mind-map-tool] operation rejected', { operation, targetMapId, reason: result.reason });
  }

  return {
    handled: true,
    toolName,
    response,
    mindMap: result.ok && operation !== 'export' ? normalizeMindMap(result.mindMap) : normalizeMindMap(selectedMindMap),
    targetMapId,
  };
};
