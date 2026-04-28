import {
  appendMindMapEvolution,
  markNodeBlocked,
  markNodeDone,
  markNodeFailed,
  markNodeInProgress,
  normalizeMindMap,
} from './hud/mindMap/utils/mindMapData';

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const includesAny = (text, patterns) => patterns.some((pattern) => text.includes(pattern));

const classifyExecutionStatus = (executionResult = {}) => {
  const status = normalizeText(executionResult.status || executionResult.state).toLowerCase();
  const message = normalizeText(executionResult.message || executionResult.reason || executionResult.stderr).toLowerCase();
  const artifacts = executionResult.artifacts || {};

  if (
    status === 'running' ||
    status === 'started' ||
    status === 'in_progress' ||
    executionResult.started === true
  ) {
    return 'in_progress';
  }

  if (
    status === 'blocked' ||
    artifacts.requiresUserSetup ||
    artifacts.guestCommandExecuted === false ||
    includesAny(message, ['bloquead', 'blocked', 'not ready', 'nao esta pronto', 'não está pronto'])
  ) {
    return 'blocked';
  }

  if (executionResult.ok === true || status === 'done' || status === 'success' || status === 'completed') {
    return 'done';
  }

  if (executionResult.ok === false || status === 'failed' || status === 'error') {
    return 'failed';
  }

  return 'unknown';
};

const findExecutionNode = (mindMap, executionResult = {}, context = {}) => {
  const candidates = [
    context.nodeId,
    executionResult.nodeId,
    context.executionId,
    executionResult.executionId,
    executionResult.taskId,
    context.goal?.taskId,
    context.goal?.goalId,
    context.goalId,
    context.procedure?.procedureId,
    context.procedureId,
  ].map((value) => normalizeText(value)).filter(Boolean);

  for (const candidate of candidates) {
    const directMatch = mindMap.nodes.find((node) => node.id === candidate);
    if (directMatch) {
      return directMatch;
    }

    const metadataMatch = mindMap.nodes.find((node) =>
      node.metadata?.executionId === candidate ||
      node.metadata?.goalId === candidate ||
      node.metadata?.procedureId === candidate,
    );
    if (metadataMatch) {
      return metadataMatch;
    }
  }

  const goalId = normalizeText(context.goal?.taskId || context.goal?.goalId || context.goalId);
  if (goalId && mindMap.goalId === goalId) {
    return mindMap.nodes.find((node) => node.type === 'goal') || mindMap.nodes[0] || null;
  }

  return null;
};

const buildDescription = (executionResult = {}) => {
  const parts = [
    normalizeText(executionResult.message),
    normalizeText(executionResult.stdout).slice(0, 160),
    normalizeText(executionResult.stderr).slice(0, 160),
  ].filter(Boolean);

  return parts.join(' | ').slice(0, 360);
};

export const syncMindMapWithExecution = (executionResult = {}, context = {}) => {
  const baseMap = normalizeMindMap(context.activeMap || context.mindMap);
  const targetNode = findExecutionNode(baseMap, executionResult, context);
  const status = classifyExecutionStatus(executionResult);
  const now = context.now || new Date().toISOString();

  if (status === 'unknown' || !targetNode) {
    return {
      ok: false,
      updated: false,
      reason: status === 'unknown' ? 'insufficient_execution_evidence' : 'node_not_found',
      message: targetNode
        ? 'Execucao sem evidencia suficiente para atualizar o mapa com seguranca.'
        : 'Nenhum node correspondente foi encontrado para sincronizar a execucao.',
      mindMap: baseMap,
      targetNodeId: targetNode?.id || '',
      status,
    };
  }

  const metadata = {
    executionId: normalizeText(executionResult.executionId || executionResult.taskId || context.executionId),
    goalId: normalizeText(context.goal?.taskId || context.goal?.goalId || context.goalId || targetNode.metadata?.goalId),
    procedureId: normalizeText(context.procedure?.procedureId || context.procedureId || targetNode.metadata?.procedureId),
    lastSyncedAt: now,
  };
  const helpers = {
    in_progress: markNodeInProgress,
    done: markNodeDone,
    failed: markNodeFailed,
    blocked: markNodeBlocked,
  };
  const withStatus = helpers[status](baseMap, targetNode.id, metadata, { now, source: 'execution' });
  const description = buildDescription(executionResult);
  const withDescription = description
    ? normalizeMindMap({
        ...withStatus,
        nodes: withStatus.nodes.map((node) =>
          node.id === targetNode.id
            ? {
                ...node,
                data: {
                  ...node.data,
                  description,
                  source: 'execution',
                  confidence: executionResult.ok === true ? 1 : node.data.confidence,
                },
              }
            : node,
        ),
      })
    : withStatus;
  const nextMap = appendMindMapEvolution(withDescription, {
    type: 'execution_sync',
    source: 'execution',
    summary: `${targetNode.data.label} sincronizado como ${status}`,
    affectedNodeIds: [targetNode.id],
    metadata: {
      status,
      ok: executionResult.ok,
      executionId: metadata.executionId,
    },
    now,
  });

  return {
    ok: true,
    updated: true,
    reason: 'execution_evidence_applied',
    message: 'Mapa mental sincronizado com resultado real de execucao.',
    mindMap: nextMap,
    targetNodeId: targetNode.id,
    status,
  };
};

export default syncMindMapWithExecution;
