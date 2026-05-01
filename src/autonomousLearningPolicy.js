export const AUTONOMOUS_LEARNING_CREATED_BY = 'autonomous_learning_loop';
export const AUTONOMOUS_REUSE_CREATED_BY = 'autonomous_procedure_reuse';
export const AUTONOMOUS_OPTIMIZER_CREATED_BY = 'autonomous_procedure_optimizer';

export const DEFAULT_AUTONOMOUS_LEARNING_POLICY = {
  enabled: true,
  maxExperimentsPerStartup: 1000,
  maxExperimentsPerHour: 1000,
  maxPromotionsPerRun: 20,
  allowedEnvironments: ['real_vm'],
  allowedScriptTypes: ['node', 'python', 'powershell'],
  blockedActions: [
    'delete_real_files',
    'send_message',
    'send_email',
    'purchase',
    'payment',
    'bypass_login',
    'bypass_captcha',
    'real_pc_write',
  ],
  requireVmOrWorkspace: true,
  allowWebsiteExploration: true,
  allowAppExploration: true,
  allowScriptSynthesis: true,
  allowProcedurePromotion: true,
  allowProcedureReuse: true,
  allowProcedureOptimization: true,
  dryRunDefault: false,
  minEvidenceConfidence: 0.6,
  minReuseConfidence: 0.62,
  guardedReuseThreshold: 0.72,
  activeReuseThreshold: 0.6,
  maxLoopIterations: 1,
  maxTasksCreatedPerRun: 1000,
  riskThresholds: {
    maxAutomaticRisk: 'low',
    maxScriptRisk: 'low',
    maxReuseRisk: 'medium',
  },
};

const RISK_ORDER = ['low', 'medium', 'high', 'critical'];

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const normalizePositiveInteger = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : fallback;
};

const normalizeStringArray = (value, fallback = []) => {
  const seen = new Set();
  return normalizeArray(value.length ? value : fallback)
    .map(normalizeText)
    .filter((item) => {
      if (!item || seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });
};

export const normalizeAutonomousLearningPolicy = (policy = {}) => {
  const source = policy && typeof policy === 'object' ? policy : {};
  const defaults = DEFAULT_AUTONOMOUS_LEARNING_POLICY;
  return {
    ...defaults,
    ...source,
    enabled: source.enabled !== undefined ? Boolean(source.enabled) : defaults.enabled,
    maxExperimentsPerStartup: normalizePositiveInteger(
      source.maxExperimentsPerStartup,
      defaults.maxExperimentsPerStartup,
    ),
    maxExperimentsPerHour: normalizePositiveInteger(source.maxExperimentsPerHour, defaults.maxExperimentsPerHour),
    maxPromotionsPerRun: normalizePositiveInteger(source.maxPromotionsPerRun, defaults.maxPromotionsPerRun),
    allowedEnvironments: normalizeStringArray(source.allowedEnvironments || [], defaults.allowedEnvironments),
    allowedScriptTypes: normalizeStringArray(source.allowedScriptTypes || [], defaults.allowedScriptTypes),
    blockedActions: normalizeStringArray(source.blockedActions || [], defaults.blockedActions),
    requireVmOrWorkspace: source.requireVmOrWorkspace !== false,
    allowWebsiteExploration: source.allowWebsiteExploration !== false,
    allowAppExploration: source.allowAppExploration !== false,
    allowScriptSynthesis: source.allowScriptSynthesis !== false,
    allowProcedurePromotion: source.allowProcedurePromotion !== false,
    allowProcedureReuse: source.allowProcedureReuse !== false,
    allowProcedureOptimization: source.allowProcedureOptimization !== false,
    dryRunDefault: Boolean(source.dryRunDefault),
    minEvidenceConfidence: Math.min(1, Math.max(0, Number(source.minEvidenceConfidence ?? defaults.minEvidenceConfidence))),
    minReuseConfidence: Math.min(1, Math.max(0, Number(source.minReuseConfidence ?? defaults.minReuseConfidence))),
    guardedReuseThreshold: Math.min(1, Math.max(0, Number(source.guardedReuseThreshold ?? defaults.guardedReuseThreshold))),
    activeReuseThreshold: Math.min(1, Math.max(0, Number(source.activeReuseThreshold ?? defaults.activeReuseThreshold))),
    maxLoopIterations: Math.max(1, normalizePositiveInteger(source.maxLoopIterations, defaults.maxLoopIterations)),
    maxTasksCreatedPerRun: Math.max(1, normalizePositiveInteger(source.maxTasksCreatedPerRun, defaults.maxTasksCreatedPerRun)),
    riskThresholds: {
      ...defaults.riskThresholds,
      ...(source.riskThresholds || {}),
    },
  };
};

const riskRank = (riskLevel = 'low') => {
  const rank = RISK_ORDER.indexOf(normalizeText(riskLevel).toLowerCase());
  return rank >= 0 ? rank : 0;
};

export const riskWithinThreshold = (riskLevel = 'low', threshold = 'low') =>
  riskRank(riskLevel) <= riskRank(threshold);

export const commandOrScriptLooksDestructive = (text = '') =>
  /\b(rm\s+-rf|rmsync|unlinksync|remove-item\s+-recurse|del\s+\/[fsq]|format\b|shutdown\b|restart-computer\b|reg\s+delete|cipher\s+\/w|diskpart|bcdedit|takeown\b|icacls\b.*\/grant)\b/i
    .test(String(text || ''));

export const actionViolatesAutonomousLearningPolicy = ({
  actionText = '',
  riskLevel = 'low',
  environment = 'local_workspace_fallback',
  scriptType = '',
  policy = {},
} = {}) => {
  const normalizedPolicy = normalizeAutonomousLearningPolicy(policy);
  const normalizedAction = normalizeText(actionText).toLowerCase();
  const blockedByName = normalizedPolicy.blockedActions.some((blockedAction) =>
    normalizedAction.includes(normalizeText(blockedAction).replace(/_/g, ' ')) ||
    normalizedAction.includes(normalizeText(blockedAction)),
  );
  if (blockedByName || commandOrScriptLooksDestructive(normalizedAction)) {
    return { ok: false, reason: 'blocked_sensitive_or_destructive_action' };
  }
  if (!riskWithinThreshold(riskLevel, normalizedPolicy.riskThresholds.maxAutomaticRisk)) {
    return { ok: false, reason: 'risk_above_learning_threshold' };
  }
  if (!normalizedPolicy.allowedEnvironments.includes(environment)) {
    return { ok: false, reason: 'environment_not_allowed_for_learning' };
  }
  if (scriptType && !normalizedPolicy.allowedScriptTypes.includes(scriptType)) {
    return { ok: false, reason: 'script_type_not_allowed' };
  }
  return { ok: true, reason: 'policy_allows_learning_action' };
};

export const countRecentLearningExperiments = (recentExperiments = [], { nowMs = Date.now(), windowMs = 3600000 } = {}) =>
  (() => {
    const experiments = normalizeArray(recentExperiments);
    const terminalTaskIds = new Set(experiments
      .filter((experiment) => ['validated', 'rejected', 'promoted'].includes(normalizeText(experiment.status)))
      .map((experiment) => normalizeText(experiment.taskId))
      .filter(Boolean));
    const countedTaskIds = new Set();
    return experiments.filter((experiment) => {
      const taskId = normalizeText(experiment.taskId);
      if (normalizeText(experiment.status) !== 'task_created' || terminalTaskIds.has(taskId)) {
        return false;
      }
      if (taskId && countedTaskIds.has(taskId)) {
        return false;
      }
      if (taskId) {
        countedTaskIds.add(taskId);
      }
      const timestamp = Date.parse(experiment.createdAt || experiment.startedAt || experiment.updatedAt || '');
      return Number.isFinite(timestamp) && nowMs - timestamp <= windowMs;
    }).length;
  })();

export const canStartAutonomousLearningCycle = ({
  memoryHydrated = false,
  runnerSafe = false,
  hasRunnerLock = false,
  hasRunningTasks = false,
  recoveryPending = false,
  policy = {},
  recentExperiments = [],
  nowMs = Date.now(),
} = {}) => {
  const normalizedPolicy = normalizeAutonomousLearningPolicy(policy);
  if (!memoryHydrated) {
    return { ok: false, reason: 'memory_not_hydrated', policy: normalizedPolicy };
  }
  if (!normalizedPolicy.enabled) {
    return { ok: false, reason: 'autonomous_learning_disabled', policy: normalizedPolicy };
  }
  if (!runnerSafe || hasRunnerLock || hasRunningTasks || recoveryPending) {
    return { ok: false, reason: 'runner_not_safe_for_learning', policy: normalizedPolicy };
  }
  const recentCount = countRecentLearningExperiments(recentExperiments, { nowMs });
  if (recentCount >= normalizedPolicy.maxExperimentsPerHour) {
    return { ok: false, reason: 'learning_rate_limited', policy: normalizedPolicy };
  }
  return { ok: true, reason: 'learning_cycle_allowed', policy: normalizedPolicy };
};
