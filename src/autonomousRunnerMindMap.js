import {
  appendMindMapEvolution,
  normalizeMindMap,
} from './hud/mindMap/utils/mindMapData';

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const taskNodeId = (taskId) => `runner-task-${normalizeText(taskId)}`;
const stepNodeId = (taskId, stepId) => `runner-step-${normalizeText(taskId)}-${normalizeText(stepId)}`;
const dependencyEdgeId = (source, target) => `runner-dep-${source}-${target}`;

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

export const syncMindMapWithRunnerTask = (
  mindMap,
  task,
  { now = new Date().toISOString() } = {},
) => {
  const baseMap = normalizeMindMap(mindMap);
  if (!task?.id) {
    return baseMap;
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
