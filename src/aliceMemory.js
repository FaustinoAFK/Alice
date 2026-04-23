import { invoke } from '@tauri-apps/api/core';

export const ALICE_MEMORY_SCHEMA_VERSION = 1;
export const ALICE_MEMORY_FILE_NAME = 'alice-memory.json';
export const MAX_ACTIVE_PROJECTS = 10;
export const MAX_ACTIVE_TASKS = 20;
export const MAX_TOOL_FACTS = 50;

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
      source: normalizeText(factEntry.source) || 'tool',
      updatedAt: normalizeText(factEntry.updatedAt),
    };

    if (!normalizedEntry.fact) {
      return;
    }

    merged.set(`${normalizedEntry.kind}:${normalizeFactKey(normalizedEntry.fact)}`, normalizedEntry);
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

const buildRecentSummary = ({ inputTranscript = '', outputTranscript = '', lastCommand = null }) => {
  const lines = [];

  if (normalizeText(inputTranscript)) {
    lines.push(`Usuario: ${normalizeText(inputTranscript)}`);
  }

  if (normalizeText(outputTranscript)) {
    lines.push(`Alice: ${normalizeText(outputTranscript)}`);
  }

  if (lastCommand?.name && lastCommand?.status) {
    const commandLine = normalizeText(lastCommand.message)
      ? `Comando local: ${lastCommand.name} (${lastCommand.status}) - ${normalizeText(lastCommand.message)}`
      : `Comando local: ${lastCommand.name} (${lastCommand.status})`;
    lines.push(commandLine);
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
    typeof memory.recentContextSummary === 'object' &&
    typeof memory.bootstrapMeta === 'object'
  );
};

export const recoverFromCorruptMemory = () => createEmptyAliceMemory();

export const pruneAliceMemory = (memory) => {
  const baseMemory = validateAliceMemorySchema(memory) ? memory : recoverFromCorruptMemory();

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
    lastCommand = null,
    sessionModel = '',
  } = {},
  { now = new Date().toISOString() } = {},
) => {
  const inputText = normalizeText(inputTranscript);
  const outputText = normalizeText(outputTranscript);
  const combinedText = `${inputText}\n${outputText}`;
  const likes = parseListMatch(combinedText, /\beu gosto de\s+([^\n.!?]{2,120})/i);
  const dislikes = parseListMatch(combinedText, /\beu n(?:a|ã)o gosto de\s+([^\n.!?]{2,120})/i);
  const communicationStyle = [];

  if (/\b(resposta curta|respostas curtas|fale curto|mais curto)\b/i.test(combinedText)) {
    communicationStyle.push('Respostas curtas');
  }

  if (/\b(mais detalhes|detalhado|resposta detalhada)\b/i.test(combinedText)) {
    communicationStyle.push('Detalhar quando necessario');
  }

  const facts = {
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
      summary: buildRecentSummary({ inputTranscript: inputText, outputTranscript: outputText, lastCommand }),
      updatedAt: now,
    },
    bootstrapMeta: {
      lastUpdatedAt: now,
      lastSessionModel: normalizeText(sessionModel),
    },
  };

  if (lastCommand?.name && lastCommand?.status === 'executado') {
    facts.toolFacts.push({
      kind: normalizeText(lastCommand.name),
      fact: normalizeText(lastCommand.message) || `Comando ${normalizeText(lastCommand.name)} executado com sucesso.`,
      source: 'tool',
      updatedAt: now,
    });
  }

  return facts;
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

export const loadAliceMemory = async (storage = createAliceMemoryStorage()) => {
  try {
    const json = await storage.loadJson();
    if (!json) {
      return createEmptyAliceMemory();
    }

    const parsed = JSON.parse(json);
    return validateAliceMemorySchema(parsed) ? pruneAliceMemory(parsed) : recoverFromCorruptMemory();
  } catch {
    return recoverFromCorruptMemory();
  }
};

export const saveAliceMemory = async (memory, storage = createAliceMemoryStorage()) => {
  const normalizedMemory = pruneAliceMemory(memory);
  await storage.saveJson(JSON.stringify(normalizedMemory, null, 2));
  return normalizedMemory;
};
