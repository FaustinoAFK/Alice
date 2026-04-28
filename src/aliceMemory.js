import { invoke } from '@tauri-apps/api/core';
import {
  createEmptyAutonomousAudit,
  serializeAutonomousStateForAudit,
} from './autonomousLearning/auditPersistence';
import {
  appendMindMapHistory,
  createMindMap as createMindMapData,
  createStarterMindMap,
  generateMindMapFromGoal,
  normalizeMindMap,
} from './hud/mindMap/utils/mindMapData';
import {
  cancelAutonomousRunnerQueue,
  cancelAutonomousRunnerTask,
  createAutonomousRunnerSummary,
  createEmptyAutonomousRunnerState,
  enqueueAutonomousRunnerTask,
  normalizeAutonomousRunnerState,
  reorderAutonomousRunnerTask,
  rerunAutonomousRunnerTask,
  setAutonomousRunnerEnabled,
  setAutonomousRunnerPaused,
  updateAutonomousRunnerTask,
} from './autonomousRunnerState';

export const ALICE_MEMORY_SCHEMA_VERSION = 8;
export const ALICE_MEMORY_FILE_NAME = 'alice-memory.json';
export const MAX_ACTIVE_PROJECTS = 10;
export const MAX_ACTIVE_TASKS = 20;
export const MAX_TOOL_FACTS = 50;
export const MAX_PROCEDURES = 30;

const DEFAULT_ASSISTANT_NAME = 'Alice';
const DEFAULT_PERSONA_STYLE = 'playful_confident';
const DEFAULT_TRAITS = ['espirituosa', 'confiante', 'calorosa', 'provocadora de leve'];

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const normalizeFactKey = (value) => normalizeText(value).toLowerCase();

const uniqueNormalizedStrings = (values = []) => {
  const seen = new Set();

  return values
    .map((value) => normalizeText(value))
    .filter((value) => {
      if (!value) {
        return false;
      }

      const normalizedKey = value.toLowerCase();
      if (seen.has(normalizedKey)) {
        return false;
      }

      seen.add(normalizedKey);
      return true;
    });
};

const sortByUpdatedAtDesc = (items = []) =>
  [...items].sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')));

const normalizeMindMapsState = (memory = {}) => {
  const source = memory?.mindMaps;
  const byId = {};
  const maps = [];
  const legacyActiveMindMap = memory?.activeMindMap ? normalizeMindMap(memory.activeMindMap) : null;

  if (source && typeof source === 'object' && !Array.isArray(source) && source.byId && typeof source.byId === 'object') {
    maps.push(...Object.values(source.byId));
  } else if (Array.isArray(source)) {
    maps.push(...source);
  }

  if (legacyActiveMindMap) {
    maps.push(legacyActiveMindMap);
  }

  maps.forEach((map) => {
    const normalizedMap = normalizeMindMap(map);
    if (!normalizedMap.id) {
      return;
    }

    byId[normalizedMap.id] = normalizedMap;
  });

  if (Object.keys(byId).length === 0) {
    const starterMap = createMindMapData(createStarterMindMap());
    byId[starterMap.id] = starterMap;
  }

  const legacyActiveMindMapId = legacyActiveMindMap?.id || '';
  const preferredActiveId = normalizeText(legacyActiveMindMapId || source?.activeId || memory?.activeMindMapId);
  const activeId = byId[preferredActiveId] ? preferredActiveId : Object.keys(byId)[0];

  return {
    byId,
    activeId,
  };
};

const mergeNamedRecords = (existingItems = [], incomingItems = [], limit) => {
  const merged = new Map();

  [...existingItems, ...incomingItems].forEach((item) => {
    if (!item?.id || !item?.title) {
      return;
    }

    const normalizedItem = {
      id: normalizeText(item.id),
      title: normalizeText(item.title),
      summary: normalizeText(item.summary),
      status: normalizeText(item.status),
      updatedAt: normalizeText(item.updatedAt),
    };

    if (!normalizedItem.id || !normalizedItem.title) {
      return;
    }

    merged.set(normalizedItem.id, normalizedItem);
  });

  return sortByUpdatedAtDesc([...merged.values()]).slice(0, limit);
};

const mergeToolFacts = (existingFacts = [], incomingFacts = [], limit) => {
  const merged = new Map();

  [...existingFacts, ...incomingFacts].forEach((factEntry) => {
    if (!factEntry?.fact) {
      return;
    }

    const normalizedEntry = {
      kind: normalizeText(factEntry.kind) || 'general',
      fact: normalizeText(factEntry.fact),
      source: normalizeText(factEntry.source) || 'memory',
      updatedAt: normalizeText(factEntry.updatedAt),
    };

    if (!normalizedEntry.fact) {
      return;
    }

    merged.set(`${normalizedEntry.kind}:${normalizeFactKey(normalizedEntry.fact)}`, normalizedEntry);
  });

  return sortByUpdatedAtDesc([...merged.values()]).slice(0, limit);
};

const mergeProcedures = (existingProcedures = [], incomingProcedures = [], limit = MAX_PROCEDURES) => {
  const merged = new Map();

  [...existingProcedures, ...incomingProcedures].forEach((procedure) => {
    if (!procedure?.procedureId || !procedure?.title) {
      return;
    }

    const normalizedProcedure = {
      procedureId: normalizeText(procedure.procedureId),
      title: normalizeText(procedure.title),
      summary: normalizeText(procedure.summary),
      steps: uniqueNormalizedStrings(procedure.steps || []).slice(0, 20),
      status: normalizeText(procedure.status) || 'active',
      confidence: Math.min(1, Math.max(0, Number(procedure.confidence || 0))),
      source: normalizeText(procedure.source) || 'validated_operational_learning',
      updatedAt: normalizeText(procedure.updatedAt),
      createdAt: normalizeText(procedure.createdAt),
    };

    if (!normalizedProcedure.procedureId || !normalizedProcedure.title) {
      return;
    }

    merged.set(normalizedProcedure.procedureId, normalizedProcedure);
  });

  return sortByUpdatedAtDesc([...merged.values()]).slice(0, limit);
};

const parseListMatch = (text, pattern) => {
  const match = pattern.exec(text);
  if (!match?.[1]) {
    return [];
  }

  return uniqueNormalizedStrings(match[1].split(/,| e /i).map((item) => item.replace(/^de /i, '')));
};

const extractConventionMatches = (text) => {
  const conventions = [];
  const preferredNameMatch = /(?:pode me chamar de|me chama de)\s+([a-z0-9 _-]{2,40})/i.exec(text);
  if (preferredNameMatch?.[1]) {
    conventions.push(`Chamar o usuario de ${normalizeText(preferredNameMatch[1])}`);
  }

  if (/\b(respostas curtas|fale curto|mais curto)\b/i.test(text)) {
    conventions.push('Responder de forma curta por padrao');
  }

  if (/\b(detalhado|mais detalhe|mais detalhado)\b/i.test(text)) {
    conventions.push('Entrar em detalhes quando o usuario pedir');
  }

  return uniqueNormalizedStrings(conventions);
};

const extractProjects = (text, updatedAt) => {
  const projects = [];
  const projectMatch = /\bprojeto[: ]+([a-z0-9 _-]{3,60})/i.exec(text);
  if (projectMatch?.[1]) {
    const title = normalizeText(projectMatch[1]);
    projects.push({
      id: `project:${normalizeFactKey(title)}`,
      title,
      summary: `Projeto ativo mencionado pelo usuario: ${title}.`,
      status: 'active',
      updatedAt,
    });
  }

  return projects;
};

const extractTasks = (text, updatedAt) => {
  const tasks = [];
  const taskMatch = /\btarefa[: ]+([a-z0-9 _-]{3,80})/i.exec(text);
  if (taskMatch?.[1]) {
    const title = normalizeText(taskMatch[1]);
    tasks.push({
      id: `task:${normalizeFactKey(title)}`,
      title,
      summary: `Tarefa ativa mencionada pelo usuario: ${title}.`,
      status: 'doing',
      updatedAt,
    });
  }

  return tasks;
};

const buildRecentSummary = ({ inputTranscript = '', outputTranscript = '' }) => {
  const lines = [];

  if (normalizeText(inputTranscript)) {
    lines.push(`Usuario: ${normalizeText(inputTranscript)}`);
  }

  if (normalizeText(outputTranscript)) {
    lines.push(`Alice: ${normalizeText(outputTranscript)}`);
  }

  return lines.join(' | ');
};

export const createEmptyAliceMemory = () => ({
  schemaVersion: ALICE_MEMORY_SCHEMA_VERSION,
  identity: {
    assistantName: DEFAULT_ASSISTANT_NAME,
    personaStyle: DEFAULT_PERSONA_STYLE,
    permanentTraits: [...DEFAULT_TRAITS],
  },
  stablePreferences: {
    likes: [],
    dislikes: [],
    communicationStyle: [],
    userConventions: [],
  },
  activeProjects: [],
  activeTasks: [],
  toolFacts: [],
  proceduralMemory: {
    procedures: [],
  },
  autonomousAudit: createEmptyAutonomousAudit(),
  autonomousRunner: createEmptyAutonomousRunnerState(),
  mindMaps: normalizeMindMapsState(),
  recentContextSummary: {
    summary: '',
    updatedAt: '',
  },
  bootstrapMeta: {
    lastUpdatedAt: '',
    lastSessionModel: '',
    memoryRevision: 0,
  },
});

export const validateAliceMemorySchema = (memory) => {
  if (!memory || typeof memory !== 'object') {
    return false;
  }

  return (
    memory.schemaVersion === ALICE_MEMORY_SCHEMA_VERSION &&
    typeof memory.identity === 'object' &&
    typeof memory.stablePreferences === 'object' &&
    Array.isArray(memory.activeProjects) &&
    Array.isArray(memory.activeTasks) &&
    Array.isArray(memory.toolFacts) &&
    typeof memory.proceduralMemory === 'object' &&
    Array.isArray(memory.proceduralMemory.procedures) &&
    typeof memory.autonomousAudit === 'object' &&
    typeof memory.autonomousRunner === 'object' &&
    typeof memory.autonomousRunner.tasksById === 'object' &&
    Array.isArray(memory.autonomousRunner.queue) &&
    typeof memory.mindMaps === 'object' &&
    typeof memory.mindMaps.byId === 'object' &&
    typeof memory.mindMaps.activeId === 'string' &&
    typeof memory.recentContextSummary === 'object' &&
    typeof memory.bootstrapMeta === 'object'
  );
};

export const recoverFromCorruptMemory = () => createEmptyAliceMemory();

const upgradeAliceMemorySchema = (memory) => {
  if (!memory || typeof memory !== 'object') {
    return createEmptyAliceMemory();
  }

  if (memory.schemaVersion === ALICE_MEMORY_SCHEMA_VERSION) {
    return memory;
  }

  if (memory.schemaVersion === 1 || memory.schemaVersion === 2 || memory.schemaVersion === 3) {
    return {
      ...memory,
      schemaVersion: ALICE_MEMORY_SCHEMA_VERSION,
      proceduralMemory: {
        procedures: [],
      },
      autonomousAudit: createEmptyAutonomousAudit(),
      autonomousRunner: createEmptyAutonomousRunnerState(),
      mindMaps: normalizeMindMapsState(memory),
    };
  }

  if (memory.schemaVersion === 4) {
    return {
      ...memory,
      schemaVersion: ALICE_MEMORY_SCHEMA_VERSION,
      autonomousAudit: createEmptyAutonomousAudit(),
      autonomousRunner: createEmptyAutonomousRunnerState(),
      mindMaps: normalizeMindMapsState(memory),
    };
  }

  if (memory.schemaVersion === 5) {
    return {
      ...memory,
      schemaVersion: ALICE_MEMORY_SCHEMA_VERSION,
      autonomousRunner: createEmptyAutonomousRunnerState(),
      mindMaps: normalizeMindMapsState(memory),
    };
  }

  if (memory.schemaVersion === 6) {
    return {
      ...memory,
      schemaVersion: ALICE_MEMORY_SCHEMA_VERSION,
      autonomousRunner: createEmptyAutonomousRunnerState(),
      mindMaps: normalizeMindMapsState(memory),
    };
  }

  if (memory.schemaVersion === 7) {
    return {
      ...memory,
      schemaVersion: ALICE_MEMORY_SCHEMA_VERSION,
      autonomousRunner: normalizeAutonomousRunnerState(memory.autonomousRunner),
      mindMaps: normalizeMindMapsState(memory),
    };
  }

  return createEmptyAliceMemory();
};

export const pruneAliceMemory = (memory) => {
  const upgradedMemory = upgradeAliceMemorySchema(memory);
  const baseMemory = validateAliceMemorySchema(upgradedMemory) ? upgradedMemory : recoverFromCorruptMemory();

  return {
    schemaVersion: ALICE_MEMORY_SCHEMA_VERSION,
    identity: {
      assistantName: normalizeText(baseMemory.identity.assistantName) || DEFAULT_ASSISTANT_NAME,
      personaStyle: normalizeText(baseMemory.identity.personaStyle) || DEFAULT_PERSONA_STYLE,
      permanentTraits: uniqueNormalizedStrings(baseMemory.identity.permanentTraits).slice(0, 8),
    },
    stablePreferences: {
      likes: uniqueNormalizedStrings(baseMemory.stablePreferences.likes).slice(0, 12),
      dislikes: uniqueNormalizedStrings(baseMemory.stablePreferences.dislikes).slice(0, 12),
      communicationStyle: uniqueNormalizedStrings(baseMemory.stablePreferences.communicationStyle).slice(0, 12),
      userConventions: uniqueNormalizedStrings(baseMemory.stablePreferences.userConventions).slice(0, 12),
    },
    activeProjects: mergeNamedRecords(baseMemory.activeProjects, [], MAX_ACTIVE_PROJECTS),
    activeTasks: mergeNamedRecords(baseMemory.activeTasks, [], MAX_ACTIVE_TASKS),
    toolFacts: mergeToolFacts(baseMemory.toolFacts, [], MAX_TOOL_FACTS),
    proceduralMemory: {
      procedures: mergeProcedures(baseMemory.proceduralMemory.procedures, [], MAX_PROCEDURES),
    },
    autonomousAudit: {
      ...createEmptyAutonomousAudit(),
      ...(baseMemory.autonomousAudit || {}),
    },
    autonomousRunner: normalizeAutonomousRunnerState(baseMemory.autonomousRunner),
    mindMaps: normalizeMindMapsState(baseMemory),
    recentContextSummary: {
      summary: normalizeText(baseMemory.recentContextSummary.summary),
      updatedAt: normalizeText(baseMemory.recentContextSummary.updatedAt),
    },
    bootstrapMeta: {
      lastUpdatedAt: normalizeText(baseMemory.bootstrapMeta.lastUpdatedAt),
      lastSessionModel: normalizeText(baseMemory.bootstrapMeta.lastSessionModel),
      memoryRevision: Number.isFinite(baseMemory.bootstrapMeta.memoryRevision)
        ? Math.max(0, Math.trunc(baseMemory.bootstrapMeta.memoryRevision))
        : 0,
    },
  };
};

export const extractImportantFacts = (
  {
    inputTranscript = '',
    outputTranscript = '',
    sessionModel = '',
  } = {},
  { now = new Date().toISOString() } = {},
) => {
  const inputText = normalizeText(inputTranscript);
  const outputText = normalizeText(outputTranscript);
  const combinedText = `${inputText}\n${outputText}`;
  const likes = parseListMatch(combinedText, /\beu gosto de\s+([^\n.!?]{2,120})/i);
  const dislikes = parseListMatch(combinedText, /\beu n(?:a|Ã£)o gosto de\s+([^\n.!?]{2,120})/i);
  const communicationStyle = [];

  if (/\b(resposta curta|respostas curtas|fale curto|mais curto)\b/i.test(combinedText)) {
    communicationStyle.push('Respostas curtas');
  }

  if (/\b(mais detalhes|detalhado|resposta detalhada)\b/i.test(combinedText)) {
    communicationStyle.push('Detalhar quando necessario');
  }

  return {
    identity: {
      assistantName: DEFAULT_ASSISTANT_NAME,
      personaStyle: DEFAULT_PERSONA_STYLE,
      permanentTraits: [...DEFAULT_TRAITS],
    },
    stablePreferences: {
      likes,
      dislikes,
      communicationStyle,
      userConventions: extractConventionMatches(combinedText),
    },
    activeProjects: extractProjects(inputText, now),
    activeTasks: extractTasks(inputText, now),
    toolFacts: [],
    recentContextSummary: {
      summary: buildRecentSummary({ inputTranscript: inputText, outputTranscript: outputText }),
      updatedAt: now,
    },
    bootstrapMeta: {
      lastUpdatedAt: now,
      lastSessionModel: normalizeText(sessionModel),
    },
  };
};

export const mergeImportantFacts = (
  existingMemory,
  facts,
  { now = new Date().toISOString() } = {},
) => {
  const baseMemory = pruneAliceMemory(existingMemory);
  const nextRevision = baseMemory.bootstrapMeta.memoryRevision + 1;

  return pruneAliceMemory({
    ...baseMemory,
    identity: {
      assistantName: normalizeText(facts?.identity?.assistantName) || baseMemory.identity.assistantName,
      personaStyle: normalizeText(facts?.identity?.personaStyle) || baseMemory.identity.personaStyle,
      permanentTraits: uniqueNormalizedStrings([
        ...baseMemory.identity.permanentTraits,
        ...(facts?.identity?.permanentTraits || []),
      ]),
    },
    stablePreferences: {
      likes: uniqueNormalizedStrings([
        ...baseMemory.stablePreferences.likes,
        ...(facts?.stablePreferences?.likes || []),
      ]),
      dislikes: uniqueNormalizedStrings([
        ...baseMemory.stablePreferences.dislikes,
        ...(facts?.stablePreferences?.dislikes || []),
      ]),
      communicationStyle: uniqueNormalizedStrings([
        ...baseMemory.stablePreferences.communicationStyle,
        ...(facts?.stablePreferences?.communicationStyle || []),
      ]),
      userConventions: uniqueNormalizedStrings([
        ...baseMemory.stablePreferences.userConventions,
        ...(facts?.stablePreferences?.userConventions || []),
      ]),
    },
    activeProjects: mergeNamedRecords(
      baseMemory.activeProjects,
      facts?.activeProjects || [],
      MAX_ACTIVE_PROJECTS,
    ),
    activeTasks: mergeNamedRecords(
      baseMemory.activeTasks,
      facts?.activeTasks || [],
      MAX_ACTIVE_TASKS,
    ),
    toolFacts: mergeToolFacts(baseMemory.toolFacts, facts?.toolFacts || [], MAX_TOOL_FACTS),
    proceduralMemory: {
      procedures: mergeProcedures(
        baseMemory.proceduralMemory.procedures,
        facts?.proceduralMemory?.procedures || [],
        MAX_PROCEDURES,
      ),
    },
    autonomousAudit: baseMemory.autonomousAudit,
    recentContextSummary: normalizeText(facts?.recentContextSummary?.summary)
      ? {
          summary: normalizeText(facts.recentContextSummary.summary),
          updatedAt: normalizeText(facts.recentContextSummary.updatedAt) || now,
        }
      : baseMemory.recentContextSummary,
    bootstrapMeta: {
      lastUpdatedAt: normalizeText(facts?.bootstrapMeta?.lastUpdatedAt) || now,
      lastSessionModel:
        normalizeText(facts?.bootstrapMeta?.lastSessionModel) ||
        baseMemory.bootstrapMeta.lastSessionModel,
      memoryRevision: nextRevision,
    },
  });
};

export const mergeValidatedProcedures = (
  existingMemory,
  procedures = [],
  { now = new Date().toISOString() } = {},
) => {
  const baseMemory = pruneAliceMemory(existingMemory);

  return pruneAliceMemory({
    ...baseMemory,
    proceduralMemory: {
      procedures: mergeProcedures(
        baseMemory.proceduralMemory.procedures,
        procedures.map((procedure) => ({
          ...procedure,
          updatedAt: normalizeText(procedure.updatedAt) || now,
          createdAt: normalizeText(procedure.createdAt) || now,
        })),
        MAX_PROCEDURES,
      ),
    },
    bootstrapMeta: {
      ...baseMemory.bootstrapMeta,
      lastUpdatedAt: now,
      memoryRevision: baseMemory.bootstrapMeta.memoryRevision + 1,
    },
  });
};

export const getActiveMindMap = (memory) => {
  const normalizedMindMaps = normalizeMindMapsState(memory);
  return normalizedMindMaps.byId[normalizedMindMaps.activeId] || Object.values(normalizedMindMaps.byId)[0];
};

export const createMindMap = (
  existingMemory,
  mindMapData = {},
  { now = new Date().toISOString(), makeActive = true } = {},
) => {
  const baseMemory = pruneAliceMemory(existingMemory);
  const requestedMap = createMindMapData(mindMapData);
  const mapIdAlreadyExists = Boolean(baseMemory.mindMaps.byId[requestedMap.id]);
  const nextMap = normalizeMindMap({
    ...requestedMap,
    id: mapIdAlreadyExists ? createMindMapData({ ...mindMapData, id: '' }).id : requestedMap.id,
    createdAt: now,
    updatedAt: now,
  });
  const nextMindMaps = normalizeMindMapsState({
    mindMaps: {
      byId: {
        ...baseMemory.mindMaps.byId,
        [nextMap.id]: nextMap,
      },
      activeId: makeActive ? nextMap.id : baseMemory.mindMaps.activeId,
    },
  });

  return pruneAliceMemory({
    ...baseMemory,
    mindMaps: nextMindMaps,
    bootstrapMeta: {
      ...baseMemory.bootstrapMeta,
      lastUpdatedAt: now,
      memoryRevision: baseMemory.bootstrapMeta.memoryRevision + 1,
    },
  });
};

export const setActiveMindMap = (existingMemory, id, { now = new Date().toISOString() } = {}) => {
  const baseMemory = pruneAliceMemory(existingMemory);
  const activeId = normalizeText(id);

  if (!baseMemory.mindMaps.byId[activeId]) {
    return baseMemory;
  }

  return pruneAliceMemory({
    ...baseMemory,
    mindMaps: {
      ...baseMemory.mindMaps,
      activeId,
    },
    bootstrapMeta: {
      ...baseMemory.bootstrapMeta,
      lastUpdatedAt: now,
      memoryRevision: baseMemory.bootstrapMeta.memoryRevision + 1,
    },
  });
};

export const updateMindMap = (
  existingMemory,
  id,
  patch = {},
  { now = new Date().toISOString(), historyReason = 'update' } = {},
) => {
  const baseMemory = pruneAliceMemory(existingMemory);
  const targetId = normalizeText(id) || baseMemory.mindMaps.activeId;
  const currentMap = baseMemory.mindMaps.byId[targetId] || getActiveMindMap(baseMemory);

  if (!currentMap) {
    return baseMemory;
  }

  const patchedMap = typeof patch === 'function' ? patch(currentMap) : { ...currentMap, ...patch };
  const normalizedPatchedMap = normalizeMindMap({
    ...patchedMap,
    id: currentMap.id,
    createdAt: currentMap.createdAt,
    updatedAt: now,
  });
  const alreadyRecordedHistory =
    (normalizedPatchedMap.history?.length || 0) > (currentMap.history?.length || 0) ||
    historyReason === 'rollback';
  const nextMap = alreadyRecordedHistory
    ? normalizedPatchedMap
    : appendMindMapHistory(
        normalizedPatchedMap,
        currentMap,
        { reason: historyReason, now },
      );

  return pruneAliceMemory({
    ...baseMemory,
    mindMaps: {
      byId: {
        ...baseMemory.mindMaps.byId,
        [currentMap.id]: nextMap,
      },
      activeId: baseMemory.mindMaps.byId[targetId] ? baseMemory.mindMaps.activeId : currentMap.id,
    },
    bootstrapMeta: {
      ...baseMemory.bootstrapMeta,
      lastUpdatedAt: now,
      memoryRevision: baseMemory.bootstrapMeta.memoryRevision + 1,
    },
  });
};

export const deleteMindMap = (
  existingMemory,
  id,
  { now = new Date().toISOString() } = {},
) => {
  const baseMemory = pruneAliceMemory(existingMemory);
  const targetId = normalizeText(id);

  if (!targetId || !baseMemory.mindMaps.byId[targetId]) {
    return baseMemory;
  }

  const byId = { ...baseMemory.mindMaps.byId };
  delete byId[targetId];

  if (Object.keys(byId).length === 0) {
    const starterMap = normalizeMindMap({ ...createStarterMindMap(), createdAt: now, updatedAt: now });
    byId[starterMap.id] = starterMap;
  }

  const activeId = byId[baseMemory.mindMaps.activeId]
    ? baseMemory.mindMaps.activeId
    : sortByUpdatedAtDesc(Object.values(byId))[0]?.id || Object.keys(byId)[0];

  return pruneAliceMemory({
    ...baseMemory,
    mindMaps: {
      byId,
      activeId,
    },
    bootstrapMeta: {
      ...baseMemory.bootstrapMeta,
      lastUpdatedAt: now,
      memoryRevision: baseMemory.bootstrapMeta.memoryRevision + 1,
    },
  });
};

export const rollbackMindMap = (
  existingMemory,
  id,
  { now = new Date().toISOString() } = {},
) => {
  const baseMemory = pruneAliceMemory(existingMemory);
  const targetId = normalizeText(id) || baseMemory.mindMaps.activeId;
  const currentMap = baseMemory.mindMaps.byId[targetId] || getActiveMindMap(baseMemory);
  const snapshot = currentMap?.history?.at(-1);

  if (!currentMap || !snapshot) {
    return baseMemory;
  }

  const restoredMap = normalizeMindMap({
    ...currentMap,
    nodes: snapshot.nodes,
    edges: snapshot.edges,
    history: currentMap.history.slice(0, -1),
    updatedAt: now,
  });

  return pruneAliceMemory({
    ...baseMemory,
    mindMaps: {
      byId: {
        ...baseMemory.mindMaps.byId,
        [currentMap.id]: restoredMap,
      },
      activeId: baseMemory.mindMaps.activeId,
    },
    bootstrapMeta: {
      ...baseMemory.bootstrapMeta,
      lastUpdatedAt: now,
      memoryRevision: baseMemory.bootstrapMeta.memoryRevision + 1,
    },
  });
};

export const mergeMindMapFromGoal = (
  existingMemory,
  goal,
  { now = new Date().toISOString(), makeActive = false } = {},
) => {
  const baseMemory = pruneAliceMemory(existingMemory);
  const generatedMap = normalizeMindMap({
    ...generateMindMapFromGoal(goal),
    createdAt: now,
    updatedAt: now,
  });
  const existingMap = Object.values(baseMemory.mindMaps.byId).find(
    (map) => map.goalId && generatedMap.goalId && map.goalId === generatedMap.goalId,
  );

  if (existingMap) {
    return updateMindMap(
      baseMemory,
      existingMap.id,
      {
        ...generatedMap,
        id: existingMap.id,
        history: existingMap.history,
        createdAt: existingMap.createdAt,
      },
      { now, historyReason: 'goal_sync' },
    );
  }

  return createMindMap(
    baseMemory,
    {
      ...generatedMap,
      id: '',
    },
    { now, makeActive },
  );
};

export const mergeActiveMindMap = (
  existingMemory,
  mindMapData,
  { now = new Date().toISOString(), targetMapId = '' } = {},
) =>
  updateMindMap(existingMemory, targetMapId, mindMapData, {
    now,
    historyReason: 'active_map_update',
  });

export const buildMemoryPrefixTurns = (memory) => {
  const normalizedMemory = pruneAliceMemory(memory);
  const lines = [
    `Nome da assistente: ${normalizedMemory.identity.assistantName}.`,
    `Persona base: ${normalizedMemory.identity.personaStyle}.`,
  ];

  if (normalizedMemory.identity.permanentTraits.length > 0) {
    lines.push(`Tracos permanentes: ${normalizedMemory.identity.permanentTraits.join(', ')}.`);
  }

  if (normalizedMemory.stablePreferences.likes.length > 0) {
    lines.push(`Gostos do usuario: ${normalizedMemory.stablePreferences.likes.join(', ')}.`);
  }

  if (normalizedMemory.stablePreferences.dislikes.length > 0) {
    lines.push(`Nao gostos do usuario: ${normalizedMemory.stablePreferences.dislikes.join(', ')}.`);
  }

  if (normalizedMemory.stablePreferences.communicationStyle.length > 0) {
    lines.push(
      `Preferencias de comunicacao: ${normalizedMemory.stablePreferences.communicationStyle.join(', ')}.`,
    );
  }

  if (normalizedMemory.stablePreferences.userConventions.length > 0) {
    lines.push(`Combinados com o usuario: ${normalizedMemory.stablePreferences.userConventions.join(', ')}.`);
  }

  if (normalizedMemory.activeProjects.length > 0) {
    lines.push(
      `Projetos ativos: ${normalizedMemory.activeProjects
        .map((project) => `${project.title} (${project.status || 'active'})`)
        .join('; ')}.`,
    );
  }

  if (normalizedMemory.activeTasks.length > 0) {
    lines.push(
      `Tarefas ativas: ${normalizedMemory.activeTasks
        .map((task) => `${task.title} (${task.status || 'doing'})`)
        .join('; ')}.`,
    );
  }

  if (normalizedMemory.toolFacts.length > 0) {
    lines.push(
      `Fatos operacionais uteis: ${normalizedMemory.toolFacts
        .slice(0, 6)
        .map((factEntry) => factEntry.fact)
        .join('; ')}.`,
    );
  }

  if (normalizedMemory.proceduralMemory.procedures.length > 0) {
    lines.push(
      `Procedimentos validados: ${normalizedMemory.proceduralMemory.procedures
        .slice(0, 6)
        .map((procedure) => `${procedure.title} (${procedure.status || 'active'})`)
        .join('; ')}.`,
    );
  }

  const activeMindMap = getActiveMindMap(normalizedMemory);
  const hasMeaningfulMindMap =
    activeMindMap.nodes.length > 1 ||
    activeMindMap.edges.length > 0 ||
    activeMindMap.nodes[0]?.data?.label !== 'Minha Ideia Central';

  if (hasMeaningfulMindMap) {
    lines.push(
      `Mapa mental ativo: ${activeMindMap.nodes.length} topicos e ${activeMindMap.edges.length} conexoes.`,
    );
  }

  if (normalizedMemory.recentContextSummary.summary) {
    lines.push(`Resumo recente: ${normalizedMemory.recentContextSummary.summary}.`);
  }

  if (lines.length <= 2 && !normalizedMemory.recentContextSummary.summary) {
    return [];
  }

  return [
    {
      role: 'user',
      parts: [
        {
          text: ['Memoria persistida relevante da Alice:', ...lines].join('\n'),
        },
      ],
    },
  ];
};

export const createAliceMemoryStorage = ({ invokeFn = invoke } = {}) => ({
  async loadJson() {
    return invokeFn('load_alice_memory_json');
  },
  async saveJson(json) {
    return invokeFn('save_alice_memory_json', { json });
  },
});

export const mergeAutonomousAudit = (
  existingMemory,
  autonomousState,
  { now = new Date().toISOString() } = {},
) => {
  const baseMemory = pruneAliceMemory(existingMemory);

  return pruneAliceMemory({
    ...baseMemory,
    autonomousAudit: serializeAutonomousStateForAudit(autonomousState, { now }),
    bootstrapMeta: {
      ...baseMemory.bootstrapMeta,
      lastUpdatedAt: now,
      memoryRevision: baseMemory.bootstrapMeta.memoryRevision + 1,
    },
  });
};

export const getAutonomousRunnerState = (memory) =>
  normalizeAutonomousRunnerState(pruneAliceMemory(memory).autonomousRunner);

export const getAutonomousRunnerSummary = (memory) =>
  createAutonomousRunnerSummary(getAutonomousRunnerState(memory));

export const updateAutonomousRunnerState = (
  existingMemory,
  runnerPatch,
  { now = new Date().toISOString() } = {},
) => {
  const baseMemory = pruneAliceMemory(existingMemory);
  const currentRunner = normalizeAutonomousRunnerState(baseMemory.autonomousRunner);
  const nextRunner = typeof runnerPatch === 'function'
    ? normalizeAutonomousRunnerState(runnerPatch(currentRunner))
    : normalizeAutonomousRunnerState({ ...currentRunner, ...(runnerPatch || {}) });

  return pruneAliceMemory({
    ...baseMemory,
    autonomousRunner: nextRunner,
    bootstrapMeta: {
      ...baseMemory.bootstrapMeta,
      lastUpdatedAt: now,
      memoryRevision: baseMemory.bootstrapMeta.memoryRevision + 1,
    },
  });
};

export const enqueueAutonomousRunnerMemoryTask = (
  existingMemory,
  taskInput = {},
  { now = new Date().toISOString() } = {},
) =>
  updateAutonomousRunnerState(
    existingMemory,
    (runner) => enqueueAutonomousRunnerTask(runner, taskInput, { now }),
    { now },
  );

export const setAutonomousRunnerMemoryEnabled = (
  existingMemory,
  enabled,
  { now = new Date().toISOString(), reason = '' } = {},
) =>
  updateAutonomousRunnerState(
    existingMemory,
    (runner) => setAutonomousRunnerEnabled(runner, enabled, { now, reason }),
    { now },
  );

export const setAutonomousRunnerMemoryPaused = (
  existingMemory,
  paused,
  { now = new Date().toISOString(), reason = '' } = {},
) =>
  updateAutonomousRunnerState(
    existingMemory,
    (runner) => setAutonomousRunnerPaused(runner, paused, { now, reason }),
    { now },
  );

export const cancelAutonomousRunnerMemoryTask = (
  existingMemory,
  taskId,
  { now = new Date().toISOString(), reason = '' } = {},
) =>
  updateAutonomousRunnerState(
    existingMemory,
    (runner) => cancelAutonomousRunnerTask(runner, taskId, { now, reason }),
    { now },
  );

export const cancelAutonomousRunnerMemoryQueue = (
  existingMemory,
  { now = new Date().toISOString(), reason = '' } = {},
) =>
  updateAutonomousRunnerState(
    existingMemory,
    (runner) => cancelAutonomousRunnerQueue(runner, { now, reason }),
    { now },
  );

export const rerunAutonomousRunnerMemoryTask = (
  existingMemory,
  taskId,
  { now = new Date().toISOString() } = {},
) =>
  updateAutonomousRunnerState(
    existingMemory,
    (runner) => rerunAutonomousRunnerTask(runner, taskId, { now }),
    { now },
  );

export const reorderAutonomousRunnerMemoryTask = (
  existingMemory,
  taskId,
  queueRank,
  { now = new Date().toISOString() } = {},
) =>
  updateAutonomousRunnerState(
    existingMemory,
    (runner) => reorderAutonomousRunnerTask(runner, taskId, queueRank, { now }),
    { now },
  );

export const blockAutonomousRunnerMemoryTask = (
  existingMemory,
  taskId,
  { now = new Date().toISOString(), reason = 'manual_block' } = {},
) =>
  updateAutonomousRunnerState(
    existingMemory,
    (runner) => updateAutonomousRunnerTask(runner, taskId, {
      status: 'blocked',
      reason,
      updatedAt: now,
    }, {
      now,
      audit: {
        type: 'state_transition',
        summary: 'Task bloqueada manualmente pelo HUD.',
        reason,
        afterState: 'blocked',
      },
    }),
    { now },
  );

export const loadAliceMemory = async (storage = createAliceMemoryStorage()) => {
  try {
    const json = await storage.loadJson();
    if (!json) {
      return createEmptyAliceMemory();
    }

    const parsed = JSON.parse(json);
    return pruneAliceMemory(parsed);
  } catch {
    return recoverFromCorruptMemory();
  }
};

export const saveAliceMemory = async (memory, storage = createAliceMemoryStorage()) => {
  const normalizedMemory = pruneAliceMemory(memory);
  await storage.saveJson(JSON.stringify(normalizedMemory, null, 2));
  return normalizedMemory;
};
