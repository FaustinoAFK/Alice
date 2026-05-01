import {
  appendMindMapEvolution,
  normalizeMindMap,
} from './hud/mindMap/utils/mindMapData';
import {
  AUTONOMOUS_LEARNING_CREATED_BY,
  AUTONOMOUS_OPTIMIZER_CREATED_BY,
  AUTONOMOUS_REUSE_CREATED_BY,
} from './autonomousLearningPolicy';

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeSlug = (value, fallback = 'geral') =>
  normalizeText(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;

const COMPACT_AUTONOMOUS_CREATED_BY = new Set([
  AUTONOMOUS_LEARNING_CREATED_BY,
  AUTONOMOUS_REUSE_CREATED_BY,
  AUTONOMOUS_OPTIMIZER_CREATED_BY,
]);

const taskNodeId = (taskId) => `runner-task-${normalizeText(taskId)}`;
const stepNodeId = (taskId, stepId) => `runner-step-${normalizeText(taskId)}-${normalizeText(stepId)}`;
const dependencyEdgeId = (source, target) => `runner-dep-${source}-${target}`;
const compactTaskNodeId = (task = {}) => {
  const createdBy = normalizeSlug(task.metadata?.createdBy || 'runner');
  const scope = normalizeSlug(
    task.metadata?.capability ||
    task.metadata?.procedureId ||
    task.metadata?.gapId ||
    task.metadata?.learningScenario ||
    task.metadata?.testScenario ||
    task.procedureId ||
    task.id,
  );
  return `runner-compact-${createdBy}-${scope}`;
};

const primaryMapRootNodeId = (mindMap = {}) =>
  mindMap.nodes.find((node) => node.id === 'root')?.id ||
  mindMap.nodes.find((node) => node.type === 'goal')?.id ||
  mindMap.nodes[0]?.id ||
  '';

const shouldCompactTask = (task = {}, options = {}) =>
  options.compactAutonomousTasks !== false &&
  COMPACT_AUTONOMOUS_CREATED_BY.has(task.metadata?.createdBy);

const mapTaskStatus = (status) => {
  if (status === 'running') {
    return 'in_progress';
  }
  if (status === 'done') {
    return 'done';
  }
  if (status === 'failed') {
    return 'failed';
  }
  if (status === 'blocked' || status === 'waiting_input') {
    return 'blocked';
  }
  return 'pending';
};

const mapStepStatus = mapTaskStatus;

const upsertNode = (nodes, node) => {
  const index = nodes.findIndex((item) => item.id === node.id);
  if (index === -1) {
    return [...nodes, node];
  }
  return nodes.map((item) => (item.id === node.id ? { ...item, ...node, data: { ...item.data, ...node.data }, metadata: { ...item.metadata, ...node.metadata } } : item));
};

const upsertEdge = (edges, edge) =>
  edges.some((item) => item.id === edge.id || (item.source === edge.source && item.target === edge.target))
    ? edges
    : [...edges, edge];

const removeDetailedTaskNodes = (mindMap, taskId = '') => {
  const rootId = taskNodeId(taskId);
  const stepPrefix = stepNodeId(taskId, '');
  const removedNodeIds = new Set(
    mindMap.nodes
      .filter((node) => node.id === rootId || node.id.startsWith(stepPrefix))
      .map((node) => node.id),
  );
  if (removedNodeIds.size === 0) {
    return mindMap;
  }
  return {
    ...mindMap,
    nodes: mindMap.nodes.filter((node) => !removedNodeIds.has(node.id)),
    edges: mindMap.edges.filter((edge) => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target)),
  };
};

const syncCompactAutonomousTask = (baseMap, task, { now }) => {
  const compactBaseMap = removeDetailedTaskNodes(baseMap, task.id);
  const nodeId = compactTaskNodeId(task);
  const existingNode = compactBaseMap.nodes.find((node) => node.id === nodeId);
  const completedSteps = (task.steps || []).filter((step) => step.status === 'done').length;
  const totalSteps = (task.steps || []).length;
  const label = task.metadata?.capability
    ? `Aprendizado: ${task.metadata.capability}`
    : task.metadata?.procedureId
      ? `Procedimento: ${task.metadata.procedureId}`
      : task.title;
  const nodes = upsertNode(compactBaseMap.nodes, {
    id: nodeId,
    type: 'task',
    status: mapTaskStatus(task.status),
    position: existingNode?.position || {
      x: 360,
      y: 120 + compactBaseMap.nodes.filter((node) => node.id.startsWith('runner-compact-')).length * 90,
    },
    sourcePosition: 'right',
    targetPosition: 'left',
    data: {
      label,
      description: [
        task.title,
        `${completedSteps}/${totalSteps || 0} steps`,
        task.reason ? `reason=${task.reason}` : '',
      ].filter(Boolean).join(' | '),
      priority: task.priority,
      source: 'execution',
      evidenceRefs: task.evidenceRefs || [],
      syncMode: 'compact_runner_task',
      latestTaskId: task.id,
      createdBy: task.metadata?.createdBy || '',
    },
    metadata: {
      goalId: task.metadata?.gapId || task.goalId || task.id,
      executionId: task.id,
      procedureId: task.metadata?.procedureId || task.procedureId || '',
      createdAt: task.createdAt || now,
      updatedAt: now,
      lastSyncedAt: now,
      tags: ['runner', 'task', 'compact'],
    },
  });
  const rootId = primaryMapRootNodeId(compactBaseMap);
  const edges = rootId && rootId !== nodeId
    ? upsertEdge(compactBaseMap.edges, {
        id: `runner-compact-edge-${rootId}-${nodeId}`,
        source: rootId,
        target: nodeId,
        animated: task.status === 'running',
        label: 'aprendizado',
      })
    : compactBaseMap.edges;
  const nextMap = normalizeMindMap({
    ...compactBaseMap,
    title: compactBaseMap.title || 'Runner Autonomo',
    goalId: compactBaseMap.goalId || task.goalId || task.id,
    nodes,
    edges,
    updatedAt: now,
  });

  return appendMindMapEvolution(nextMap, {
    type: 'execution_sync',
    source: 'execution',
    summary: `Runner sincronizou resumo compacto de ${task.title} (${task.status}).`,
    affectedNodeIds: [nodeId],
    metadata: {
      taskId: task.id,
      status: task.status,
      reason: task.reason || '',
      compact: true,
    },
    now,
  });
};

export const syncMindMapWithRunnerTask = (
  mindMap,
  task,
  { now = new Date().toISOString(), compactAutonomousTasks = true } = {},
) => {
  const baseMap = normalizeMindMap(mindMap);
  if (!task?.id) {
    return baseMap;
  }
  if (shouldCompactTask(task, { compactAutonomousTasks })) {
    return syncCompactAutonomousTask(baseMap, task, { now });
  }

  const rootId = taskNodeId(task.id);
  let nodes = upsertNode(baseMap.nodes, {
    id: rootId,
    type: 'task',
    status: mapTaskStatus(task.status),
    position: { x: 160, y: 120 + baseMap.nodes.length * 60 },
    sourcePosition: 'right',
    targetPosition: 'left',
    data: {
      label: task.title,
      description: [
        task.description,
        task.reason ? `reason=${task.reason}` : '',
        task.nextRunAt ? `next=${task.nextRunAt}` : '',
      ].filter(Boolean).join(' | '),
      priority: task.priority,
      source: 'execution',
      evidenceRefs: task.evidenceRefs || [],
    },
    metadata: {
      goalId: task.goalId || task.id,
      executionId: task.id,
      procedureId: task.procedureId || '',
      createdAt: task.createdAt || now,
      updatedAt: now,
      lastSyncedAt: now,
      tags: ['runner', 'task'],
    },
  });
  let edges = baseMap.edges;

  (task.steps || []).forEach((step, index) => {
    const nodeId = stepNodeId(task.id, step.id);
    nodes = upsertNode(nodes, {
      id: nodeId,
      type: 'task',
      status: mapStepStatus(step.status),
      position: { x: 430, y: 120 + index * 95 },
      sourcePosition: 'right',
      targetPosition: 'left',
      data: {
        label: step.title,
        description: [
          step.description,
          step.reason ? `reason=${step.reason}` : '',
          `criteria=${step.completionCriteria?.type || 'missing'}`,
        ].filter(Boolean).join(' | '),
        priority: task.priority,
        source: 'execution',
        evidenceRefs: step.evidenceRefs || [],
      },
      metadata: {
        goalId: task.goalId || task.id,
        executionId: `${task.id}:${step.id}`,
        procedureId: task.procedureId || '',
        createdAt: task.createdAt || now,
        updatedAt: now,
        lastSyncedAt: now,
        tags: ['runner', 'step'],
      },
    });
    edges = upsertEdge(edges, {
      id: `runner-edge-${rootId}-${nodeId}`,
      source: rootId,
      target: nodeId,
      animated: step.status === 'running',
      label: 'step',
    });
  });

  (task.dependencies || []).forEach((dependency) => {
    const source = taskNodeId(dependency.taskId);
    edges = upsertEdge(edges, {
      id: dependencyEdgeId(source, rootId),
      source,
      target: rootId,
      animated: false,
      label: `depende de ${dependency.requiredStatus}`,
    });
  });

  if (task.recoveryOfTaskId) {
    const source = taskNodeId(task.recoveryOfTaskId);
    edges = upsertEdge(edges, {
      id: `runner-recovery-${rootId}-${source}`,
      source: rootId,
      target: source,
      animated: task.status === 'running',
      label: 'recovery',
    });
  }

  const nextMap = normalizeMindMap({
    ...baseMap,
    title: baseMap.title || 'Runner Autonomo',
    goalId: baseMap.goalId || task.goalId || task.id,
    nodes,
    edges,
    updatedAt: now,
  });

  return appendMindMapEvolution(nextMap, {
    type: 'execution_sync',
    source: 'execution',
    summary: `Runner sincronizou ${task.title} (${task.status}).`,
    affectedNodeIds: [rootId, ...(task.steps || []).map((step) => stepNodeId(task.id, step.id))],
    metadata: {
      taskId: task.id,
      status: task.status,
      reason: task.reason || '',
    },
    now,
  });
};
