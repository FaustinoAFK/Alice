import { generateMindMapFromText, normalizeMindMap } from './hud/mindMap/utils/mindMapData';

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const withTargetMapId = (operation, targetMapId) =>
  targetMapId ? { ...operation, targetMapId } : operation;

const getContextMindMap = (context = {}) => normalizeMindMap(context.mindMap || context.activeMindMap);

const findNodesByReference = (mindMap, reference) => {
  const normalizedReference = normalizeText(reference).toLowerCase();
  if (!normalizedReference) {
    return [];
  }

  const exactMatches = mindMap.nodes.filter((node) => {
    const nodeId = normalizeText(node.id).toLowerCase();
    const label = normalizeText(node.data?.label).toLowerCase();
    return nodeId === normalizedReference || label === normalizedReference;
  });

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  return mindMap.nodes.filter((node) => {
    const label = normalizeText(node.data?.label).toLowerCase();
    return label.includes(normalizedReference) || normalizedReference.includes(label);
  });
};

const findNodeByReference = (mindMap, reference) => findNodesByReference(mindMap, reference)[0] || null;

const needsClarification = (message, candidates = []) => ({
  operation: 'needs_clarification',
  payload: {
    message,
    candidates: candidates.slice(0, 5).map((node) => ({
      id: node.id,
      label: node.data?.label || node.id,
    })),
  },
});

const resolveSingleNode = (mindMap, reference, context = {}) => {
  const contextualId = normalizeText(context.selectedNodeId || context.currentNodeId);
  if (/^(isso|isto|essa|esse|aqui|esta parte|essa parte)$/i.test(normalizeText(reference)) && contextualId) {
    const contextualNode = mindMap.nodes.find((node) => node.id === contextualId);
    if (contextualNode) {
      return { node: contextualNode, clarification: null };
    }
  }

  const matches = findNodesByReference(mindMap, reference || context.currentText || context.selectedText);
  if (matches.length === 1) {
    return { node: matches[0], clarification: null };
  }

  if (matches.length > 1) {
    return {
      node: null,
      clarification: needsClarification('Referencia ambigua no mapa mental.', matches),
    };
  }

  return {
    node: null,
    clarification: needsClarification('Nao encontrei um topico seguro para essa referencia.'),
  };
};

const extractCreateTopic = (input) => {
  const match = /\b(?:cria|crie|gera|gere|monta|monte)\s+(?:um\s+)?mapa(?:\s+mental)?\s+(?:sobre|de|para)\s+(.+)$/i.exec(input);
  return normalizeText(match?.[1]);
};

const extractRename = (input) => {
  const match = /\b(?:renomeia|renomeie|muda|troca)\s+(.+?)\s+(?:para|por)\s+(.+)$/i.exec(input);
  if (!match) {
    return null;
  }

  return {
    source: normalizeText(match[1]),
    label: normalizeText(match[2]),
  };
};

const extractConnection = (input) => {
  const match = /\b(?:conecta|conecte|liga|ligue|relaciona|relacione)\s+(.+?)\s+(?:com|a|ao|na|em)\s+(.+)$/i.exec(input);
  if (!match) {
    return null;
  }

  return {
    source: normalizeText(match[1]),
    target: normalizeText(match[2]),
  };
};

const extractDependency = (input) => {
  const match = /\b(.+?)\s+(?:depende|depender)\s+(?:de|da|do)\s+(.+)$/i.exec(input);
  if (!match) {
    return null;
  }

  return {
    source: normalizeText(match[2]),
    target: normalizeText(match[1]),
  };
};

const extractAddNodeLabel = (input, context = {}) => {
  const explicitMatch = /\b(?:adiciona|adicione|inclui|inclua|cria|crie)\s+(?:um\s+)?(?:topico|modulo|node|n[oó]|isso)?\s*:?\s*(.+)$/i.exec(input);
  const explicitLabel = normalizeText(explicitMatch?.[1]);

  if (explicitLabel && !/^(isso|isto|esse|essa|aqui)$/i.test(explicitLabel)) {
    return explicitLabel;
  }

  return normalizeText(context.selectedText || context.currentText || context.goal?.title || context.goal?.goal);
};

const extractStatusReference = (input, context = {}) => {
  if (/\b(?:isso|isto|essa parte|esse topico|esse tópico)\b/i.test(input)) {
    return context.selectedNodeId || context.currentNodeId || 'isso';
  }

  return normalizeText(input)
    .replace(/\b(?:marca|marque|define|defina)\b/gi, '')
    .replace(/\b(?:como|de|da|do|isso|isto|essa parte|esse topico|esse tópico)\b/gi, '')
    .replace(/\b(?:feito|concluido|conclu[ií]do|done|falhou|deu erro|fracassou|failed|bloqueado|travado|impedido|blocked|em andamento|em progresso|comecei|iniciou|continua|continue|est[aá])\b/gi, '')
    .trim();
};

export const interpretMindMapIntent = (input, context = {}) => {
  const text = normalizeText(input);
  if (!text) {
    return [];
  }

  const targetMapId = normalizeText(context.targetMapId || context.mapId);
  const mindMap = getContextMindMap(context);
  const operations = [];
  const createTopic = extractCreateTopic(text);

  if (createTopic) {
    operations.push(withTargetMapId({
      operation: 'replace',
      payload: {
        mindMap: generateMindMapFromText(createTopic, { title: createTopic }),
      },
    }, targetMapId));
  }

  const rename = extractRename(text);
  if (rename) {
    const node = findNodeByReference(mindMap, rename.source);
    if (node && rename.label) {
      operations.push(withTargetMapId({
        operation: 'rename_node',
        payload: {
          id: node.id,
          label: rename.label,
        },
      }, targetMapId));
    }
  }

  const connection = extractConnection(text);
  if (connection) {
    const sourceNode = findNodeByReference(mindMap, connection.source);
    const targetNode = findNodeByReference(mindMap, connection.target);
    if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
      operations.push(withTargetMapId({
        operation: 'add_edge',
        payload: {
          source: sourceNode.id,
          target: targetNode.id,
        },
      }, targetMapId));
    }
  }

  const dependency = extractDependency(text);
  if (dependency) {
    const sourceNode = findNodeByReference(mindMap, dependency.source);
    const targetNode = findNodeByReference(mindMap, dependency.target);
    if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
      operations.push(withTargetMapId({
        operation: 'add_edge',
        payload: {
          source: sourceNode.id,
          target: targetNode.id,
          label: 'depende',
        },
      }, targetMapId));
    } else {
      operations.push(needsClarification('Nao consegui resolver a dependencia com seguranca.'));
    }
  }

  const statusPatterns = [
    { pattern: /\b(?:marca|marque|define|defina).*(?:feito|concluido|conclu[ií]do|done)\b/i, operation: 'mark_done' },
    { pattern: /\b(?:falhou|deu erro|fracassou|failed)\b/i, operation: 'mark_failed' },
    { pattern: /\b(?:bloqueado|travado|impedido|blocked)\b/i, operation: 'mark_blocked' },
    { pattern: /\b(?:em andamento|em progresso|comecei|iniciou|continua|continue)\b/i, operation: 'mark_in_progress' },
  ];
  const statusIntent = statusPatterns.find((item) => item.pattern.test(text));

  if (statusIntent) {
    const reference = extractStatusReference(text, context) || context.currentText;
    const continuationNode = /\b(?:continue|continua).*(?:parou|andamento|progresso)?\b/i.test(text)
      ? mindMap.nodes.find((node) => node.status === 'in_progress') ||
        mindMap.nodes.find((node) => node.status === 'pending')
      : null;
    const resolved = continuationNode
      ? { node: continuationNode, clarification: null }
      : resolveSingleNode(mindMap, reference || 'isso', context);
    if (resolved.clarification) {
      operations.push(resolved.clarification);
    } else {
      operations.push(withTargetMapId({
        operation: statusIntent.operation,
        payload: {
          nodeId: resolved.node.id,
        },
      }, targetMapId));
    }
  }

  if (/\b(?:mostra|mostre|listar|liste).*(?:falta|pendente|pendentes)\b/i.test(text)) {
    operations.push(withTargetMapId({
      operation: 'export',
      payload: {
        format: 'markdown',
        filterStatus: ['pending', 'in_progress', 'blocked'],
      },
    }, targetMapId));
  }

  if (/\b(?:qual|quais|mostra|mostre).*(?:travada|travado|bloqueada|bloqueado|blocker)\b/i.test(text)) {
    operations.push(withTargetMapId({
      operation: 'export',
      payload: {
        format: 'markdown',
        filterStatus: ['blocked'],
      },
    }, targetMapId));
  }

  if (/\b(?:organiza|organize|arruma|arrume|layout)\b/i.test(text)) {
    operations.push(withTargetMapId({
      operation: 'layout',
      payload: /\bprioridade\b/i.test(text) ? { strategy: 'priority' } : {},
    }, targetMapId));
  }

  if (/\b(?:adiciona|adicione|inclui|inclua)\b/i.test(text) && operations.length === 0) {
    const label = extractAddNodeLabel(text, context);
    if (label) {
      operations.push(withTargetMapId({
        operation: 'add_node',
        payload: {
          label,
          parentId: context.parentNodeId || mindMap.nodes[0]?.id || 'root',
        },
      }, targetMapId));
    }
  }

  return operations.filter((operation) => operation.operation && operation.payload);
};

export default interpretMindMapIntent;
