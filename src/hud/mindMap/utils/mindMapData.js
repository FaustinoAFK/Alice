import { v4 as uuidv4 } from 'uuid';

export const MIND_MAP_SCHEMA_VERSION = 1;
export const MAX_MIND_MAP_NODES = 120;
export const MAX_MIND_MAP_EDGES = 180;
export const MAX_MIND_MAP_HISTORY = 20;
export const MAX_MIND_MAP_EVOLUTION_CHANGES = 80;

const FALLBACK_NODE_LABEL = 'Ideia sem titulo';
const DEFAULT_NODE_COLOR = 'default';
const VALID_NODE_COLORS = new Set(['default', 'green', 'red', 'blue', 'gold']);
export const MIND_MAP_NODE_TYPES = ['task', 'goal', 'idea', 'resource', 'blocker', 'note'];
export const MIND_MAP_NODE_STATUSES = ['pending', 'in_progress', 'done', 'failed', 'blocked', 'unknown'];
export const MIND_MAP_NODE_PRIORITIES = ['low', 'medium', 'high', 'critical'];
export const MIND_MAP_NODE_SOURCES = ['manual', 'goal', 'text', 'execution', 'alice'];
export const MIND_MAP_CHANGE_TYPES = [
  'node_added',
  'status_changed',
  'edge_added',
  'rollback',
  'execution_sync',
  'node_renamed',
  'node_removed',
  'edge_removed',
  'layout',
  'map_replaced',
];

const RUNTIME_DATA_KEYS = new Set([
  'onChange',
  'onEditStart',
  'onEditEnd',
  'onDelete',
  'onColorChange',
  'onToggleFold',
  'dimmed',
  'hasChildren',
  'readOnly',
]);

const PERSISTED_EDGE_KEYS = new Set([
  'id',
  'source',
  'target',
  'sourceHandle',
  'targetHandle',
  'type',
  'animated',
  'style',
  'markerEnd',
  'label',
]);

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const normalizeNodeId = (value, index) => {
  const id = normalizeText(value);
  return id || `node-${index + 1}`;
};

const makeUniqueId = (candidate, seen) => {
  let nextId = candidate;
  let suffix = 2;

  while (seen.has(nextId)) {
    nextId = `${candidate}-${suffix}`;
    suffix += 1;
  }

  seen.add(nextId);
  return nextId;
};

const normalizePosition = (position = {}) => ({
  x: Number.isFinite(Number(position.x)) ? Number(position.x) : 0,
  y: Number.isFinite(Number(position.y)) ? Number(position.y) : 0,
});

const normalizeTimestamp = (value, fallback = '') => normalizeText(value) || fallback;

const normalizeEnum = (value, validValues, fallback) => {
  const normalizedValue = normalizeText(value);
  return validValues.includes(normalizedValue) ? normalizedValue : fallback;
};

export const normalizeNodeType = (value) => {
  const normalizedValue = normalizeText(value);
  if (normalizedValue === 'custom') {
    return 'idea';
  }

  return normalizeEnum(normalizedValue, MIND_MAP_NODE_TYPES, 'idea');
};

export const normalizeNodeStatus = (value) =>
  normalizeEnum(value, MIND_MAP_NODE_STATUSES, 'unknown');

const normalizePriority = (value) => {
  const normalizedValue = normalizeText(value);
  return MIND_MAP_NODE_PRIORITIES.includes(normalizedValue) ? normalizedValue : undefined;
};

const normalizeSource = (value) => {
  const normalizedValue = normalizeText(value);
  return MIND_MAP_NODE_SOURCES.includes(normalizedValue) ? normalizedValue : 'manual';
};

const normalizeConfidence = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.min(1, Math.max(0, numericValue)) : undefined;
};

const normalizeTags = (tags = []) => {
  if (!Array.isArray(tags)) {
    return [];
  }

  const seenTags = new Set();
  return tags
    .map((tag) => normalizeText(tag).toLowerCase())
    .filter((tag) => {
      if (!tag || seenTags.has(tag)) {
        return false;
      }

      seenTags.add(tag);
      return true;
    })
    .slice(0, 12);
};

const normalizeNodeData = (data = {}, index = 0) => {
  const persistedData = {};

  Object.entries(data || {}).forEach(([key, value]) => {
    if (!RUNTIME_DATA_KEYS.has(key) && typeof value !== 'function') {
      persistedData[key] = value;
    }
  });

  const label = normalizeText(persistedData.label) || `${FALLBACK_NODE_LABEL} ${index + 1}`;
  const color = VALID_NODE_COLORS.has(normalizeText(persistedData.color))
    ? normalizeText(persistedData.color)
    : DEFAULT_NODE_COLOR;

  const normalizedData = {
    ...persistedData,
    label,
    color,
    description: normalizeText(persistedData.description),
    source: normalizeSource(persistedData.source),
    isCollapsed: Boolean(persistedData.isCollapsed),
  };
  const priority = normalizePriority(persistedData.priority);
  const confidence = normalizeConfidence(persistedData.confidence);

  if (priority) {
    normalizedData.priority = priority;
  }

  if (confidence !== undefined) {
    normalizedData.confidence = confidence;
  }

  return normalizedData;
};

const normalizeNodeMetadata = (metadata = {}) => {
  const persistedMetadata = {};

  Object.entries(metadata || {}).forEach(([key, value]) => {
    if (typeof value !== 'function') {
      persistedMetadata[key] = value;
    }
  });

  return {
    goalId: normalizeText(persistedMetadata.goalId),
    procedureId: normalizeText(persistedMetadata.procedureId),
    executionId: normalizeText(persistedMetadata.executionId),
    createdAt: normalizeTimestamp(persistedMetadata.createdAt),
    updatedAt: normalizeTimestamp(persistedMetadata.updatedAt),
    lastSyncedAt: normalizeTimestamp(persistedMetadata.lastSyncedAt),
    tags: normalizeTags(persistedMetadata.tags),
  };
};

export const createStarterMindMap = () => ({
  version: MIND_MAP_SCHEMA_VERSION,
  id: uuidv4(),
  title: 'Minha Ideia Central',
  nodes: [
    {
      id: 'root',
      type: 'idea',
      status: 'unknown',
      data: {
        label: 'Minha Ideia Central',
        color: DEFAULT_NODE_COLOR,
        description: '',
        source: 'alice',
        isCollapsed: false,
      },
      metadata: {
        goalId: '',
        procedureId: '',
        executionId: '',
        createdAt: '',
        updatedAt: '',
        lastSyncedAt: '',
        tags: [],
      },
      position: { x: 250, y: 50 },
      sourcePosition: 'right',
      targetPosition: 'left',
    },
  ],
  edges: [],
  history: [],
  evolution: {
    changes: [],
  },
});

export const createMindMap = ({
  id = uuidv4(),
  title = 'Minha Ideia Central',
  nodes = createStarterMindMap().nodes,
  edges = [],
  history = [],
  evolution = { changes: [] },
  createdAt = '',
  updatedAt = '',
  goalId = '',
} = {}) =>
  normalizeMindMap({
    version: MIND_MAP_SCHEMA_VERSION,
    id,
    title,
    nodes,
    edges,
    history,
    evolution,
    createdAt,
    updatedAt,
    goalId,
  });

export const stripRuntimeNodeData = (node, index = 0) => {
  const normalizedId = normalizeNodeId(node?.id, index);

  return {
    id: normalizedId,
    type: normalizeNodeType(node?.type || node?.data?.nodeType),
    status: normalizeNodeStatus(node?.status || node?.data?.status),
    data: normalizeNodeData(node?.data, index),
    metadata: normalizeNodeMetadata(node?.metadata),
    position: normalizePosition(node?.position),
    sourcePosition: normalizeText(node?.sourcePosition) || 'right',
    targetPosition: normalizeText(node?.targetPosition) || 'left',
  };
};

export const isValidMindMapData = (data) => {
  return data && typeof data === 'object' && Array.isArray(data.nodes) && Array.isArray(data.edges);
};

const normalizeEdge = (edge, index, validNodeIds, seenEdgeIds) => {
  const source = normalizeText(edge?.source);
  const target = normalizeText(edge?.target);

  if (!source || !target || !validNodeIds.has(source) || !validNodeIds.has(target)) {
    return null;
  }

  const normalizedEdge = {};
  Object.entries(edge || {}).forEach(([key, value]) => {
    if (PERSISTED_EDGE_KEYS.has(key) && typeof value !== 'function') {
      normalizedEdge[key] = value;
    }
  });

  const fallbackId = `edge-${source}-${target}-${index + 1}`;
  const edgeId = makeUniqueId(normalizeText(normalizedEdge.id) || fallbackId, seenEdgeIds);

  return {
    ...normalizedEdge,
    id: edgeId,
    source,
    target,
    type: normalizeText(normalizedEdge.type) || 'smoothstep',
    animated: normalizedEdge.animated !== false,
  };
};

const normalizeMindMapSnapshot = (snapshot, index = 0) => {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  const normalized = normalizeMindMap({
    version: snapshot.version,
    id: snapshot.id || `snapshot-${index + 1}`,
    title: snapshot.title || `Versao ${index + 1}`,
    nodes: snapshot.nodes,
    edges: snapshot.edges,
    history: [],
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  }, { preserveHistory: false });

  return {
    reason: normalizeText(snapshot.reason) || 'snapshot',
    createdAt: normalizeTimestamp(snapshot.createdAt),
    version: normalized.version,
    nodes: normalized.nodes,
    edges: normalized.edges,
  };
};

const normalizeEvolutionChange = (change, index = 0) => {
  if (!change || typeof change !== 'object') {
    return null;
  }

  return {
    id: normalizeText(change.id) || `change-${index + 1}`,
    type: normalizeEnum(change.type, MIND_MAP_CHANGE_TYPES, 'execution_sync'),
    timestamp: normalizeTimestamp(change.timestamp),
    source: normalizeSource(change.source),
    summary: normalizeText(change.summary).slice(0, 240),
    affectedNodeIds: Array.isArray(change.affectedNodeIds)
      ? change.affectedNodeIds.map((nodeId) => normalizeText(nodeId)).filter(Boolean).slice(0, 20)
      : [],
    metadata: change.metadata && typeof change.metadata === 'object'
      ? Object.fromEntries(
          Object.entries(change.metadata)
            .filter(([, value]) => typeof value !== 'function')
            .slice(0, 20),
        )
      : {},
  };
};

const normalizeEvolution = (evolution = {}) => ({
  changes: Array.isArray(evolution?.changes)
    ? evolution.changes
        .slice(-MAX_MIND_MAP_EVOLUTION_CHANGES)
        .map((change, index) => normalizeEvolutionChange(change, index))
        .filter(Boolean)
    : [],
});

export const upgradeMindMapSchema = (map) => {
  if (!map || typeof map !== 'object') {
    return createStarterMindMap();
  }

  const starterMap = createStarterMindMap();
  const nodes = Array.isArray(map.nodes) ? map.nodes : starterMap.nodes;
  const edges = Array.isArray(map.edges) ? map.edges : [];

  return {
    ...map,
    version: MIND_MAP_SCHEMA_VERSION,
    id: normalizeText(map.id) || starterMap.id,
    title: normalizeText(map.title) || normalizeText(nodes[0]?.data?.label) || starterMap.title,
    nodes,
    edges,
    history: Array.isArray(map.history) ? map.history : [],
    evolution: normalizeEvolution(map.evolution),
    createdAt: normalizeTimestamp(map.createdAt),
    updatedAt: normalizeTimestamp(map.updatedAt),
    goalId: normalizeText(map.goalId),
  };
};

export const normalizeMindMap = (data, { preserveHistory = true } = {}) => {
  const upgradedData = upgradeMindMapSchema(data);

  const seenNodeIds = new Set();
  const nodes = upgradedData.nodes
    .slice(0, MAX_MIND_MAP_NODES)
    .map((node, index) => {
      const strippedNode = stripRuntimeNodeData(node, index);
      return {
        ...strippedNode,
        id: makeUniqueId(strippedNode.id, seenNodeIds),
      };
    });

  if (nodes.length === 0) {
    return createStarterMindMap();
  }

  const validNodeIds = new Set(nodes.map((node) => node.id));
  const seenEdgeIds = new Set();
  const edges = upgradedData.edges
    .slice(0, MAX_MIND_MAP_EDGES)
    .map((edge, index) => normalizeEdge(edge, index, validNodeIds, seenEdgeIds))
    .filter(Boolean);
  const history = preserveHistory
    ? upgradedData.history
        .slice(-MAX_MIND_MAP_HISTORY)
        .map((snapshot, index) => normalizeMindMapSnapshot(snapshot, index))
        .filter(Boolean)
    : [];
  const evolution = normalizeEvolution(upgradedData.evolution);

  return {
    version: MIND_MAP_SCHEMA_VERSION,
    id: normalizeText(upgradedData.id) || uuidv4(),
    title: normalizeText(upgradedData.title) || normalizeText(nodes[0]?.data?.label) || 'Mapa mental',
    nodes,
    edges,
    history,
    evolution,
    createdAt: normalizeTimestamp(upgradedData.createdAt),
    updatedAt: normalizeTimestamp(upgradedData.updatedAt),
    goalId: normalizeText(upgradedData.goalId),
  };
};

export const normalizeMindMapData = normalizeMindMap;

export const createMindMapSnapshot = (map, { reason = 'update', now = new Date().toISOString() } = {}) => {
  const normalized = normalizeMindMap(map, { preserveHistory: false });

  return {
    reason: normalizeText(reason) || 'update',
    createdAt: normalizeTimestamp(now),
    version: normalized.version,
    nodes: normalized.nodes,
    edges: normalized.edges,
  };
};

export const appendMindMapHistory = (
  nextMap,
  previousMap,
  { reason = 'update', now = new Date().toISOString() } = {},
) => {
  const normalizedNextMap = normalizeMindMap(nextMap);
  const normalizedPreviousMap = normalizeMindMap(previousMap, { preserveHistory: false });

  return normalizeMindMap({
    ...normalizedNextMap,
    history: [
      ...(normalizedNextMap.history || []),
      createMindMapSnapshot(normalizedPreviousMap, { reason, now }),
    ].slice(-MAX_MIND_MAP_HISTORY),
    updatedAt: now,
  });
};

export const appendMindMapEvolution = (
  map,
  {
    type = 'execution_sync',
    source = 'alice',
    summary = '',
    affectedNodeIds = [],
    metadata = {},
    now = new Date().toISOString(),
  } = {},
) => {
  const normalizedMap = normalizeMindMap(map);
  const change = normalizeEvolutionChange({
    id: uuidv4(),
    type,
    timestamp: now,
    source,
    summary,
    affectedNodeIds,
    metadata,
  });

  return normalizeMindMap({
    ...normalizedMap,
    evolution: {
      changes: [
        ...(normalizedMap.evolution?.changes || []),
        change,
      ].slice(-MAX_MIND_MAP_EVOLUTION_CHANGES),
    },
    updatedAt: now,
  });
};

const updateNodeStatus = (map, nodeId, status, metadata = {}, { now = new Date().toISOString(), source = 'execution' } = {}) => {
  const normalizedMap = normalizeMindMap(map);
  const normalizedNodeId = normalizeText(nodeId);
  const normalizedStatus = normalizeNodeStatus(status);

  if (!normalizedNodeId || normalizedStatus === 'unknown' && normalizeText(status) !== 'unknown') {
    return normalizedMap;
  }

  const targetNode = normalizedMap.nodes.find((node) => node.id === normalizedNodeId);
  if (!targetNode) {
    return normalizedMap;
  }

  const nextMap = {
    ...normalizedMap,
    nodes: normalizedMap.nodes.map((node) =>
      node.id === normalizedNodeId
        ? {
            ...node,
            status: normalizedStatus,
            metadata: {
              ...node.metadata,
              ...normalizeNodeMetadata({ ...node.metadata, ...metadata }),
              updatedAt: now,
              lastSyncedAt: source === 'execution' ? now : node.metadata?.lastSyncedAt || '',
            },
          }
        : node,
    ),
  };
  const withHistory = appendMindMapHistory(nextMap, normalizedMap, { reason: `status:${normalizedStatus}`, now });

  return appendMindMapEvolution(withHistory, {
    type: 'status_changed',
    source,
    summary: `${targetNode.data.label} -> ${normalizedStatus}`,
    affectedNodeIds: [normalizedNodeId],
    metadata: {
      status: normalizedStatus,
      ...metadata,
    },
    now,
  });
};

export const setMindMapNodeStatus = updateNodeStatus;

export const markNodeInProgress = (map, nodeId, metadata = {}, options = {}) =>
  updateNodeStatus(map, nodeId, 'in_progress', metadata, options);

export const markNodeDone = (map, nodeId, metadata = {}, options = {}) =>
  updateNodeStatus(map, nodeId, 'done', metadata, options);

export const markNodeFailed = (map, nodeId, metadata = {}, options = {}) =>
  updateNodeStatus(map, nodeId, 'failed', metadata, options);

export const markNodeBlocked = (map, nodeId, metadata = {}, options = {}) =>
  updateNodeStatus(map, nodeId, 'blocked', metadata, options);

export const buildMindMapSummary = (map) => {
  const normalizedMap = map ? normalizeMindMap(map) : null;
  if (!normalizedMap) {
    return {
      activeMapId: '',
      title: '',
      totalNodes: 0,
      pendingCount: 0,
      inProgressCount: 0,
      doneCount: 0,
      failedCount: 0,
      blockedCount: 0,
      highPriorityPending: 0,
      currentBlockers: [],
      relatedGoalId: '',
    };
  }

  const statusCounts = normalizedMap.nodes.reduce((counts, node) => ({
    ...counts,
    [node.status]: (counts[node.status] || 0) + 1,
  }), {});
  const currentBlockers = normalizedMap.nodes
    .filter((node) => node.status === 'blocked' || node.type === 'blocker')
    .slice(0, 5)
    .map((node) => ({
      id: node.id,
      label: node.data.label,
      status: node.status,
    }));

  return {
    activeMapId: normalizedMap.id,
    title: normalizedMap.title,
    totalNodes: normalizedMap.nodes.length,
    pendingCount: statusCounts.pending || 0,
    inProgressCount: statusCounts.in_progress || 0,
    doneCount: statusCounts.done || 0,
    failedCount: statusCounts.failed || 0,
    blockedCount: statusCounts.blocked || 0,
    highPriorityPending: normalizedMap.nodes.filter(
      (node) =>
        node.status === 'pending' &&
        (node.data.priority === 'high' || node.data.priority === 'critical'),
    ).length,
    currentBlockers,
    relatedGoalId: normalizedMap.goalId,
  };
};

const pickSentenceLabels = (text, limit) =>
  normalizeText(text)
    .split(/(?:\.|;|\n|\r|\?|!)+/)
    .map((item) => normalizeText(item).replace(/^[-*0-9. )]+/, ''))
    .filter(Boolean)
    .slice(0, limit);

export const generateMindMapFromText = (text, { title = '', maxNodes = 12 } = {}) => {
  const labels = pickSentenceLabels(text, Math.max(1, Math.min(maxNodes, MAX_MIND_MAP_NODES - 1)));
  const rootLabel = normalizeText(title) || labels[0] || 'Mapa mental';
  const childLabels = labels[0] === rootLabel ? labels.slice(1) : labels;
  const rootNode = {
    id: 'root',
    type: 'idea',
    status: 'unknown',
    data: { label: rootLabel, color: DEFAULT_NODE_COLOR, source: 'text', isCollapsed: false },
    metadata: { tags: [] },
    position: { x: 250, y: 50 },
    sourcePosition: 'right',
    targetPosition: 'left',
  };
  const nodes = [
    rootNode,
    ...childLabels.slice(0, maxNodes - 1).map((label, index) => ({
      id: `topic-${index + 1}`,
      type: 'idea',
      status: 'pending',
      data: { label, color: DEFAULT_NODE_COLOR, source: 'text', isCollapsed: false },
      metadata: { tags: [] },
      position: { x: 520, y: 80 + index * 100 },
      sourcePosition: 'right',
      targetPosition: 'left',
    })),
  ];
  const edges = nodes.slice(1).map((node, index) => ({
    id: `edge-root-${node.id}-${index + 1}`,
    source: 'root',
    target: node.id,
    type: 'smoothstep',
    animated: true,
  }));

  return normalizeMindMap({
    ...createStarterMindMap(),
    title: rootLabel,
    nodes,
    edges,
  });
};

export const generateMindMapFromGoal = (goal = {}) => {
  const goalTitle = normalizeText(goal.title || goal.goal || goal.objective || goal.reason) || 'Objetivo';
  const subtasks = Array.isArray(goal.subtasks)
    ? goal.subtasks
    : Array.isArray(goal.steps)
      ? goal.steps
      : Array.isArray(goal.tasks)
        ? goal.tasks
        : [];
  const dependencies = Array.isArray(goal.dependencies) ? goal.dependencies : [];
  const nodes = [
    {
      id: 'root',
      type: 'goal',
      status: 'pending',
      data: { label: goalTitle, color: 'blue', isCollapsed: false },
      metadata: { goalId: normalizeText(goal.goalId || goal.id || goal.taskId), tags: ['goal'] },
      position: { x: 250, y: 50 },
      sourcePosition: 'right',
      targetPosition: 'left',
    },
    ...subtasks.slice(0, 16).map((subtask, index) => ({
      id: normalizeText(subtask.id) || `subtask-${index + 1}`,
      type: 'task',
      status: normalizeNodeStatus(subtask.status) === 'unknown' ? 'pending' : normalizeNodeStatus(subtask.status),
      data: {
        label: normalizeText(subtask.title || subtask.label || subtask.summary || subtask) || `Subtarefa ${index + 1}`,
        color: subtask.status === 'done' ? 'green' : subtask.status === 'blocked' ? 'red' : 'default',
        source: 'goal',
        priority: normalizePriority(subtask.priority),
        isCollapsed: false,
      },
      metadata: {
        goalId: normalizeText(goal.goalId || goal.id || goal.taskId),
        procedureId: normalizeText(subtask.procedureId),
        executionId: normalizeText(subtask.executionId),
        tags: ['task'],
      },
      position: { x: 520, y: 80 + index * 100 },
      sourcePosition: 'right',
      targetPosition: 'left',
    })),
  ];
  const edges = [
    ...nodes.slice(1).map((node, index) => ({
      id: `edge-root-${node.id}-${index + 1}`,
      source: 'root',
      target: node.id,
      type: 'smoothstep',
      animated: true,
    })),
    ...dependencies.slice(0, MAX_MIND_MAP_EDGES).map((dependency, index) => ({
      id: normalizeText(dependency.id) || `dependency-${index + 1}`,
      source: normalizeText(dependency.source || dependency.from),
      target: normalizeText(dependency.target || dependency.to),
      type: 'smoothstep',
      animated: true,
    })),
  ];

  return normalizeMindMap({
    ...createStarterMindMap(),
    title: goalTitle,
    goalId: normalizeText(goal.goalId || goal.id || goal.taskId),
    nodes,
    edges,
  });
};

export const buildMindMapJson = (nodes, edges) => {
  return JSON.stringify(normalizeMindMap({ version: MIND_MAP_SCHEMA_VERSION, nodes, edges }), null, 2);
};

export const parseMindMapJson = (jsonText) => {
  return normalizeMindMap(JSON.parse(jsonText));
};
