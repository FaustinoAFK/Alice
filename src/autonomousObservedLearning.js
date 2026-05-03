import {
  getAutonomousLearningMemoryState,
  updateAutonomousLearningMemoryState,
} from './aliceMemory';
import {
  createAutonomousLearningGoalFromText,
  upsertAutonomousLearningGoal,
} from './autonomousLearningGoals';

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const stripDiacritics = (value) => normalizeText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const normalizeLower = (value) => stripDiacritics(value).toLowerCase();
const normalizeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
const OBSERVED_TARGET_REFRESH_INTERVAL_MS = 60000;
const toSafeIdPart = (value) =>
  normalizeLower(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'observado';

const GENERIC_SCREEN_LABELS = new Set([
  'screen',
  'monitor',
  'window',
  'tela',
  'janela',
  'entire screen',
  'whole screen',
  'application window',
  'screen 1',
  'screen 2',
  'display 1',
  'display 2',
]);

const hasMeaningfulLetters = (value = '') => /[a-zA-Z\u00C0-\u024F]{2,}/.test(normalizeText(value));

export const isValidObservedLearningLabel = (label = '') => {
  const normalized = normalizeText(label);
  const lower = normalizeLower(normalized);
  if (!normalized || GENERIC_SCREEN_LABELS.has(lower)) {
    return false;
  }
  if (!hasMeaningfulLetters(normalized)) {
    return false;
  }
  if (/^\d+\s*:\s*\d+$/.test(normalized)) {
    return false;
  }
  if (/^\d+\s*[x×]\s*\d+$/i.test(normalized)) {
    return false;
  }
  if (/^(screen|display|monitor|tela|janela)\s*\d*$/i.test(lower)) {
    return false;
  }
  return true;
};

const cleanScreenLabel = (value = '') =>
  normalizeText(value)
    .replace(/^(screen|window|monitor|tab)\s*[:#-]\s*/i, '')
    .replace(/\s+\|\s+Compartilhar.*$/i, '')
    .replace(/\s+\|\s+Share.*$/i, '')
    .trim();

const inferApplicationLabelFromWindowTitle = (label = '') => {
  const cleaned = cleanScreenLabel(label);
  if (!isValidObservedLearningLabel(cleaned)) {
    return '';
  }

  const parts = cleaned
    .split(/\s+(?:-|—|–|\|)\s+/)
    .map(normalizeText)
    .filter(Boolean);
  const inferred = parts.length > 1 ? parts[parts.length - 1] : cleaned;
  return isValidObservedLearningLabel(inferred) ? inferred : '';
};

const normalizeDomain = (value = '') => {
  const raw = normalizeText(value);
  const schemeMatch = raw.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  const browserInternalSchemeMatch = raw.match(/^(about|file|chrome|edge|data|blob|devtools):/i);
  if (browserInternalSchemeMatch || (schemeMatch && !/^https?$/i.test(schemeMatch[1]))) {
    return '';
  }
  const text = raw.replace(/^https?:\/\//i, '').split(/[/?#]/)[0];
  return text.replace(/^www\./i, '').toLowerCase();
};

const shouldRefreshObservedTarget = (existing = {}, target = {}, now = new Date().toISOString()) => {
  const lastSeenAt = Date.parse(existing.lastSeenAt || existing.updatedAt || '');
  const nowMs = Date.parse(now);
  if (!Number.isFinite(lastSeenAt) || !Number.isFinite(nowMs)) {
    return true;
  }
  if (existing.source !== target.source) {
    return true;
  }
  return nowMs - lastSeenAt >= OBSERVED_TARGET_REFRESH_INTERVAL_MS;
};

const createTarget = ({ kind, label, source, evidence = [], confidence = 0.65 } = {}) => {
  const normalizedLabel = normalizeText(label);
  if (!isValidObservedLearningLabel(normalizedLabel)) {
    return null;
  }
  const targetId = `observed-${kind}-${toSafeIdPart(normalizedLabel)}`;
  return {
    targetId,
    kind,
    label: normalizedLabel,
    source: normalizeText(source) || 'observation',
    confidence,
    evidence: normalizeArray(evidence).slice(0, 8),
  };
};

export const clearInvalidObservedLearningTargets = (
  memory,
  { now = new Date().toISOString(), reason = 'clear_invalid_observed_targets' } = {},
) => {
  const learning = getAutonomousLearningMemoryState(memory);
  const invalidTargetIds = new Set(
    normalizeArray(learning.observedTargets)
      .filter((target) => !isValidObservedLearningLabel(target.label))
      .map((target) => target.targetId)
      .filter(Boolean),
  );
  if (invalidTargetIds.size === 0) {
    return {
      memory,
      removedTargetIds: [],
      removedGoalIds: [],
    };
  }

  const removedGoalIds = normalizeArray(learning.learningGoals)
    .filter((goal) => invalidTargetIds.has(normalizeText(goal.metadata?.observedTargetId)))
    .map((goal) => goal.goalId)
    .filter(Boolean);
  const removedGoalIdSet = new Set(removedGoalIds);
  const nextLearning = {
    ...learning,
    observedTargets: normalizeArray(learning.observedTargets)
      .filter((target) => !invalidTargetIds.has(target.targetId)),
    learningGoals: normalizeArray(learning.learningGoals)
      .filter((goal) => !removedGoalIdSet.has(goal.goalId)),
    auditLog: [
      ...normalizeArray(learning.auditLog),
      {
        id: `observed-learning-cleanup-${Date.parse(now) || Date.now()}`,
        timestamp: now,
        type: 'observed_learning_cleanup',
        summary: `Removidos ${invalidTargetIds.size} alvo(s) observado(s) invalido(s).`,
        reason,
        metadata: {
          removedTargetIds: [...invalidTargetIds],
          removedGoalIds,
        },
      },
    ].slice(-1000),
  };

  return {
    memory: updateAutonomousLearningMemoryState(memory, nextLearning, { now }),
    removedTargetIds: [...invalidTargetIds],
    removedGoalIds,
  };
};

export const detectObservedLearningTargets = ({
  screen = {},
  knowledgeState = {},
  source = 'observation',
} = {}) => {
  const targets = [];
  const seen = new Set();
  const addTarget = (target) => {
    if (!target || seen.has(target.targetId)) {
      return;
    }
    seen.add(target.targetId);
    targets.push(target);
  };

  const screenLabel = inferApplicationLabelFromWindowTitle(screen.label || screen.trackLabel || '');
  if (screenLabel) {
    addTarget(createTarget({
      kind: 'application',
      label: screenLabel,
      source,
      confidence: 0.72,
      evidence: [
        'source=screen_capture_label',
        screen.displaySurface ? `displaySurface=${screen.displaySurface}` : '',
      ].filter(Boolean),
    }));
  }

  const context = knowledgeState.navigationContext || knowledgeState.pageSnapshot?.context || null;
  const domain = normalizeDomain(context?.domain || context?.url || '');
  if (domain) {
    addTarget(createTarget({
      kind: 'web_app',
      label: domain,
      source,
      confidence: 0.78,
      evidence: [
        'source=web_navigation_context',
        context?.title ? `title=${normalizeText(context.title)}` : '',
        context?.url ? `url=${normalizeText(context.url)}` : '',
      ].filter(Boolean),
    }));
  }

  return targets;
};

export const createObservedLearningGoalText = (target = {}) => {
  const label = normalizeText(target.label);
  if (target.kind === 'web_app') {
    return [
      `Aprender a operar o site ou web app observado "${label}" de forma segura.`,
      'Separar em etapas para navegar, pesquisar, ler conteudo, preencher campos controlados, validar carregamento, validar resultados e criar procedimentos reutilizaveis.',
    ].join(' ');
  }

  return [
    `Aprender a operar o aplicativo observado "${label}" de forma segura na VM.`,
    'Separar em etapas para abrir ou focar janela, navegar pela interface, usar atalhos de teclado, digitar em campos, validar mudancas visuais, consultar ajuda e criar procedimentos reutilizaveis.',
  ].join(' ');
};

export const registerObservedLearningTargets = (
  memory,
  { screen = {}, knowledgeState = {}, source = 'observation', now = new Date().toISOString() } = {},
) => {
  const learning = getAutonomousLearningMemoryState(memory);
  const targets = detectObservedLearningTargets({ screen, knowledgeState, source });
  const existingById = new Map(normalizeArray(learning.observedTargets).map((target) => [target.targetId, target]));
  const existingGoalTargetIds = new Set(
    normalizeArray(learning.learningGoals)
      .map((goal) => normalizeText(goal.metadata?.observedTargetId))
      .filter(Boolean),
  );
  const createdGoals = [];
  let changed = false;
  let nextLearning = learning;

  targets.forEach((target) => {
    const existing = existingById.get(target.targetId);
    let nextTarget = existing
      ? { ...existing }
      : {
          ...target,
          firstSeenAt: now,
          lastSeenAt: now,
          seenCount: 1,
          status: 'observed',
          goalId: '',
        };

    if (!existing) {
      changed = true;
    } else if (shouldRefreshObservedTarget(existing, target, now)) {
      nextTarget = {
        ...existing,
        ...target,
        firstSeenAt: existing.firstSeenAt || now,
        lastSeenAt: now,
        seenCount: Number(existing.seenCount || 0) + 1,
        status: existing.status || 'observed',
        goalId: existing.goalId || '',
      };
      changed = true;
    }

    if (!existingGoalTargetIds.has(target.targetId) && !nextTarget.goalId) {
      const goalResult = createAutonomousLearningGoalFromText(createObservedLearningGoalText(target), {
        now,
        source: 'screen_observation',
        priority: target.kind === 'application' ? 'high' : 'medium',
      });
      if (goalResult.ok && goalResult.goal) {
        const goal = {
          ...goalResult.goal,
          metadata: {
            ...(goalResult.goal.metadata || {}),
            createdBy: 'observed_learning',
            observedTargetId: target.targetId,
            observedTargetKind: target.kind,
            observedTargetLabel: target.label,
            source,
          },
        };
        nextLearning = upsertAutonomousLearningGoal(nextLearning, goal);
        nextTarget.goalId = goal.goalId;
        nextTarget.status = 'goal_created';
        createdGoals.push(goal);
        existingGoalTargetIds.add(target.targetId);
        changed = true;
      }
    }

    existingById.set(target.targetId, nextTarget);
  });

  if (targets.length === 0 || !changed) {
    return {
      memory,
      targets,
      createdGoals,
      changed: false,
    };
  }

  nextLearning = {
    ...nextLearning,
    observedTargets: [...existingById.values()].slice(-200),
    stats: {
      ...(nextLearning.stats || {}),
      observedTargets: existingById.size,
      observedLearningGoalsCreated: Number(nextLearning.stats?.observedLearningGoalsCreated || 0) + createdGoals.length,
    },
    auditLog: [
      ...normalizeArray(nextLearning.auditLog),
      {
        id: `observed-learning-${Date.parse(now) || Date.now()}-${targets.length}`,
        timestamp: now,
        type: createdGoals.length ? 'observed_learning_goal_created' : 'observed_learning_target_seen',
        summary: createdGoals.length
          ? `Criados ${createdGoals.length} objetivo(s) a partir do que apareceu na tela.`
          : 'Alvo observado novamente; objetivo existente preservado.',
        reason: source,
        metadata: {
          targetIds: targets.map((target) => target.targetId),
          createdGoalIds: createdGoals.map((goal) => goal.goalId),
        },
      },
    ].slice(-1000),
  };

  return {
    memory: updateAutonomousLearningMemoryState(memory, nextLearning, { now }),
    targets,
    createdGoals,
    changed,
  };
};
