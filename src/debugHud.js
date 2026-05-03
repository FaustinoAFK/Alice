export const formatDebugValue = (value) => {
  if (value == null) {
    return '-';
  }

  if (typeof value === 'string') {
    return value.trim() || '-';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const KNOWLEDGE_DISPLAY_LABELS = {
  current_page: 'pagina atual',
  same_domain: 'mesmo site',
  global: 'web geral',
  sufficient: 'suficiente',
  partial: 'parcial',
  insufficient: 'insuficiente',
  pagina_atual: 'pagina atual',
  mesmo_dominio: 'mesmo site',
  web_geral: 'web geral',
  page_inspection: 'leitura da pagina',
  internal_link_follow: 'links da pagina',
  same_domain_search: 'busca no mesmo site',
  global_search: 'busca na web',
  search_only: 'busca direta',
  refresh_current_page_snapshot: 'atualizacao da pagina',
  reactive_sse: 'captura em tempo real',
  polling_fallback: 'captura por fallback',
  cache_fallback: 'snapshot em cache',
  refresh_failed: 'falha ao atualizar contexto',
  used_fresh_cached_snapshot_after_refresh_timeout: 'usou snapshot recente apos timeout',
  local_vm_playground: 'VM local real',
  local_workspace_fallback: 'workspace local fallback',
  real_vm: 'VM real',
  real_pc: 'PC real',
  pending_approval: 'aguardando aprovacao',
  high_risk_real_pc_action_requires_confirmation: 'risco alto exige confirmacao',
  official_code_changes_require_proposal_first: 'codigo oficial exige proposta',
  local_vm_playground_must_use_copies: 'VM local real exige copias',
  workspace_fallback_must_use_copies: 'workspace fallback exige copias',
  real_local_vm_unavailable: 'VM local real indisponivel',
  real_vm_unavailable_workspace_fallback_allowed: 'usando workspace fallback',
};

export const humanizeDebugToken = (value, fallback = 'Aguardando dados') => {
  const normalized = String(value || '').trim();

  if (!normalized || normalized === '-') {
    return fallback;
  }

  return KNOWLEDGE_DISPLAY_LABELS[normalized] || normalized.replace(/_/g, ' ');
};

const formatAgeMs = (timestamp, now) => {
  const normalized = Number(timestamp || 0);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return '-';
  }

  const ageMs = Math.max(0, now - normalized);
  return `${Math.round(ageMs / 100) / 10}s`;
};

const formatTraceEvent = (event) => {
  if (!event || typeof event !== 'object') {
    return '';
  }

  const details = Object.entries(event)
    .filter(([key, value]) => key !== 'step' && value !== '' && value != null)
    .map(([key, value]) => `${key}=${String(value)}`);

  return details.length > 0
    ? `${event.step || '-'} (${details.join(', ')})`
    : String(event.step || '-');
};

const buildKnowledgeDisplay = (knowledge) => {
  const expansionSteps = String(knowledge.expansionPath || '')
    .split('->')
    .map((step) => step.trim())
    .filter((step) => step && step !== '-')
    .map((step) => humanizeDebugToken(step));

  return {
    url: humanizeDebugToken(knowledge.url, 'Nenhuma pagina capturada ainda'),
    domain: humanizeDebugToken(knowledge.domain, 'Sem dominio ativo'),
    title: humanizeDebugToken(knowledge.title, 'Sem titulo capturado'),
    selectedText: humanizeDebugToken(knowledge.selectedText, 'Nenhuma selecao ativa'),
    initialScope: humanizeDebugToken(knowledge.initialScope),
    initialSufficiency: humanizeDebugToken(knowledge.initialSufficiency),
    scope: humanizeDebugToken(knowledge.scope),
    sufficiency: humanizeDebugToken(knowledge.sufficiency),
    origin: humanizeDebugToken(knowledge.origin, 'Sem origem definida'),
    refreshMode: humanizeDebugToken(knowledge.refreshMode, 'Sem refresh registrado'),
    fallbackReason: humanizeDebugToken(knowledge.fallbackReason, 'Sem fallback'),
    expansionSteps: expansionSteps.length > 0 ? expansionSteps : ['sem expansao registrada'],
    sources: humanizeDebugToken(knowledge.sources, 'Sem fontes consultadas neste turno'),
    fetchedPages: humanizeDebugToken(knowledge.fetchedPages, 'Nenhuma pagina adicional lida'),
    trace: humanizeDebugToken(knowledge.trace, 'Sem trace registrado'),
    summaryHint: humanizeDebugToken(knowledge.summaryHint, 'Aguardando uma pergunta contextual'),
  };
};

const formatAutonomousList = (items = [], formatter = (item) => item, { limit = 80, from = 'end' } = {}) => {
  if (!Array.isArray(items) || items.length === 0) {
    return '-';
  }

  const normalizedLimit = Math.max(1, Number(limit || 80));
  const omitted = Math.max(0, items.length - normalizedLimit);
  const visibleItems = omitted > 0
    ? from === 'start'
      ? items.slice(0, normalizedLimit)
      : items.slice(-normalizedLimit)
    : items;
  const lines = visibleItems.map(formatter).filter(Boolean);

  return [
    omitted > 0 ? `... ${omitted} item(ns) ocultos para manter o HUD responsivo ...` : '',
    ...lines,
  ].filter(Boolean).join('\n') || '-';
};

const buildAutonomousDisplay = (autonomous) => ({
  active: autonomous.active ? 'ativo' : 'inativo',
  vmStatus: humanizeDebugToken(autonomous.vmStatus, 'VM local sem sessao'),
  vmProvider: humanizeDebugToken(autonomous.vmProvider, 'sem provedor de VM'),
  vmProviderStatus: humanizeDebugToken(autonomous.vmProviderStatus, 'VM nao configurada'),
  vmExecutionMode: humanizeDebugToken(autonomous.vmExecutionMode, 'sem modo'),
  vmIsReal: autonomous.vmIsReal ? 'sim' : 'nao',
  guestCommandReady: autonomous.guestCommandReady ? 'sim' : 'nao',
  requiresUserSetup: autonomous.requiresUserSetup ? 'sim' : 'nao',
  setupReason: humanizeDebugToken(autonomous.setupReason, 'sem pendencia de configuracao'),
  vmCostMode: humanizeDebugToken(autonomous.vmCostMode, 'sem modo de custo'),
  hostResources: autonomous.hostResources && autonomous.hostResources !== '-' ? autonomous.hostResources : 'sem recursos do host',
  providerCapabilities:
    autonomous.providerCapabilities && autonomous.providerCapabilities !== '-'
      ? autonomous.providerCapabilities
      : 'sem capacidades registradas',
  providers: autonomous.providers && autonomous.providers !== '-' ? autonomous.providers : 'sem provedores detectados',
  vmDiagnostics:
    autonomous.vmDiagnostics && autonomous.vmDiagnostics !== '-'
      ? autonomous.vmDiagnostics
      : 'sem diagnostico de VM registrado',
  vmSmokeTest:
    autonomous.vmSmokeTest && autonomous.vmSmokeTest !== '-'
      ? autonomous.vmSmokeTest
      : 'sem smoke test de VM registrado',
  visualAgentOnline: autonomous.visualAgentOnline ? 'sim' : 'nao',
  visualAgentStatus: humanizeDebugToken(autonomous.visualAgentStatus, 'agente visual sem status'),
  visualCapabilities:
    autonomous.visualCapabilities && autonomous.visualCapabilities !== '-'
      ? autonomous.visualCapabilities
      : 'sem capacidades visuais',
  latestVisualScreenshot: humanizeDebugToken(autonomous.latestVisualScreenshot, 'sem screenshot visual'),
  latestVisualAction: humanizeDebugToken(autonomous.latestVisualAction, 'sem acao visual'),
  latestVisualReplay: humanizeDebugToken(autonomous.latestVisualReplay, 'sem replay visual'),
  visualExecutions:
    autonomous.visualExecutions && autonomous.visualExecutions !== '-'
      ? autonomous.visualExecutions
      : 'sem execucoes visuais',
  visualReplays:
    autonomous.visualReplays && autonomous.visualReplays !== '-'
      ? autonomous.visualReplays
      : 'sem replays visuais',
  runningTasks: autonomous.runningTasks,
  pausedTasks: autonomous.pausedTasks,
  queuedTasks: autonomous.queuedTasks,
  pendingProposals: autonomous.pendingProposals,
  pendingApprovals: autonomous.pendingApprovals,
  validatedProcedures: autonomous.validatedProcedures,
  latestRisk: humanizeDebugToken(autonomous.latestRisk, 'sem risco recente'),
  latestRollback: humanizeDebugToken(autonomous.latestRollback, 'sem rollback recente'),
  tasks: humanizeDebugToken(autonomous.tasks, 'sem tarefas registradas'),
  proposals: humanizeDebugToken(autonomous.proposals, 'sem propostas pendentes'),
  approvals: autonomous.approvals && autonomous.approvals !== '-' ? autonomous.approvals : 'sem aprovacoes pendentes',
  validations: autonomous.validations && autonomous.validations !== '-' ? autonomous.validations : 'sem validacoes',
  vmTaskRuns: autonomous.vmTaskRuns && autonomous.vmTaskRuns !== '-' ? autonomous.vmTaskRuns : 'sem execucoes de playground',
  research: autonomous.research && autonomous.research !== '-' ? autonomous.research : 'sem pesquisas',
  learning: autonomous.learning && autonomous.learning !== '-' ? autonomous.learning : 'sem aprendizados',
  rollbacks: humanizeDebugToken(autonomous.rollbacks, 'sem rollbacks'),
  logs: humanizeDebugToken(autonomous.logs, 'sem logs autonomos'),
});

const formatTime = (timestamp) => {
  const value = Number(timestamp || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return '-';
  }

  try {
    return new Date(value).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '-';
  }
};

const normalizeInteraction = (interaction = {}) => ({
  id: String(interaction.id || `${interaction.kind || 'interaction'}-${interaction.timestamp || ''}`),
  kind: String(interaction.kind || 'event'),
  timestamp: Number(interaction.timestamp || 0),
  time: formatTime(interaction.timestamp),
  status: String(interaction.status || 'unknown'),
  ok:
    typeof interaction.ok === 'boolean'
      ? interaction.ok
      : interaction.status === 'done' || interaction.status === 'answered',
  userText: formatDebugValue(interaction.userText),
  aliceText: formatDebugValue(interaction.aliceText),
  toolName: formatDebugValue(interaction.toolName),
  operation: formatDebugValue(interaction.operation),
  message: formatDebugValue(interaction.message),
  reason: formatDebugValue(interaction.reason),
  argsSummary: formatDebugValue(interaction.argsSummary),
  responseSummary: formatDebugValue(interaction.responseSummary),
});

export const buildDebugHudSnapshot = ({
  status = '',
  caption = '',
  inputCaption = '',
  diagnostics = {},
  trustedUtterance = null,
  outputTranscript = '',
  screenGeometry = {},
  memorySummary = '',
  knowledgeState = null,
  autonomousLearningState = null,
  autonomousLearningMemoryState = null,
  autonomousOptimizationState = null,
  procedureReuseIndex = null,
  autonomousRunnerState = null,
  persistenceDiagnostics = null,
  interactions = [],
  now = Date.now(),
} = {}) => {
  const knowledge = {
    url: knowledgeState?.navigationContext?.url || '-',
    domain: knowledgeState?.navigationContext?.domain || '-',
    title: knowledgeState?.navigationContext?.title || '-',
    selectedText:
      knowledgeState?.lastUserSelectionText ||
      knowledgeState?.navigationContext?.selectionText ||
      '-',
    navigationContextAge: formatAgeMs(knowledgeState?.navigationContextCapturedAt, now),
    pageSnapshotAge: formatAgeMs(knowledgeState?.pageSnapshotCapturedAt, now),
    initialScope: knowledgeState?.initialKnowledgeScope || '-',
    initialSufficiency: knowledgeState?.initialKnowledgeSufficiency || '-',
    scope: knowledgeState?.lastKnowledgeScope || '-',
    sufficiency: knowledgeState?.lastKnowledgeSufficiency || '-',
    origin: knowledgeState?.lastKnowledgeOrigin || '-',
    refreshMode: knowledgeState?.lastSnapshotRefreshMode || '-',
    refreshLatency:
      Number.isFinite(Number(knowledgeState?.lastSnapshotRefreshLatencyMs || 0)) &&
      Number(knowledgeState?.lastSnapshotRefreshLatencyMs || 0) > 0
        ? `${Math.round(Number(knowledgeState.lastSnapshotRefreshLatencyMs))}ms`
        : '-',
    extensionSeenAge: formatAgeMs(knowledgeState?.lastExtensionSeenAt, now),
    fallbackReason: knowledgeState?.lastFallbackReason || '-',
    expansionPath:
      Array.isArray(knowledgeState?.lastExpansionPath) && knowledgeState.lastExpansionPath.length > 0
        ? knowledgeState.lastExpansionPath.join(' -> ')
        : '-',
    trace:
      Array.isArray(knowledgeState?.lastKnowledgeTrace) && knowledgeState.lastKnowledgeTrace.length > 0
        ? knowledgeState.lastKnowledgeTrace.map(formatTraceEvent).filter(Boolean).join('\n')
        : '-',
    fetchedPages:
      Array.isArray(knowledgeState?.lastFetchedPages) && knowledgeState.lastFetchedPages.length > 0
        ? knowledgeState.lastFetchedPages.map((page) => page.url || page.title || '-').join('\n')
        : '-',
    sources:
      Array.isArray(knowledgeState?.lastKnowledgeSources) && knowledgeState.lastKnowledgeSources.length > 0
        ? knowledgeState.lastKnowledgeSources.join('\n')
        : '-',
    summaryHint: knowledgeState?.lastKnowledgeSummaryHint || '-',
  };
  const runningTasks = (autonomousLearningState?.tasks || []).filter((task) => task.status === 'running');
  const pausedTasks = (autonomousLearningState?.tasks || []).filter((task) => task.status === 'paused');
  const queuedTasks = (autonomousLearningState?.tasks || []).filter((task) => task.status === 'queued');
  const pendingProposals = (autonomousLearningState?.improvementProposals || []).filter(
    (proposal) => proposal.status === 'pending_approval',
  );
  const autonomous = {
    active: Boolean(autonomousLearningState?.autonomousLearningActive),
    vmStatus: autonomousLearningState?.vm?.status || '-',
    vmProvider: autonomousLearningState?.vm?.provider || '-',
    vmProviderStatus: autonomousLearningState?.vm?.providerStatus || '-',
    vmExecutionMode: autonomousLearningState?.vm?.executionMode || '-',
    vmIsReal: Boolean(autonomousLearningState?.vm?.isRealVm),
    guestCommandReady: Boolean(autonomousLearningState?.vm?.guestCommandReady),
    requiresUserSetup: Boolean(autonomousLearningState?.vm?.requiresUserSetup),
    setupReason: autonomousLearningState?.vm?.setupReason || '-',
    vmCostMode: autonomousLearningState?.vm?.resourceMode || autonomousLearningState?.vm?.costMode || '-',
    hostResources: formatDebugValue(autonomousLearningState?.vm?.hostResources),
    providerCapabilities: formatDebugValue(autonomousLearningState?.vm?.activeProviderCapabilities),
    vmDiagnostics: formatDebugValue(autonomousLearningState?.vm?.diagnostics),
    vmSmokeTest: formatDebugValue(autonomousLearningState?.vm?.smokeTest),
    visualAgentOnline: Boolean(autonomousLearningState?.vm?.visualAgent?.online),
    visualAgentStatus: autonomousLearningState?.vm?.visualAgent?.status || '-',
    visualCapabilities: formatDebugValue(autonomousLearningState?.vm?.visualAgent?.capabilities),
    latestVisualScreenshot: autonomousLearningState?.vm?.visualAgent?.lastScreenshotPath || '-',
    latestVisualAction: autonomousLearningState?.vm?.visualAgent?.lastAction || '-',
    latestVisualReplay: autonomousLearningState?.vm?.visualAgent?.lastReplayId || '-',
    visualExecutions: formatAutonomousList(autonomousLearningState?.visualExecutions, (execution) =>
      `${execution.executionId || '-'} | ${execution.action || '-'} | ok=${Boolean(execution.ok)} | ${execution.hostScreenshotPath || '-'}`,
    ),
    visualReplays: formatAutonomousList(autonomousLearningState?.visualReplays, (replay) =>
      `${replay.replayId || '-'} | ${replay.status || '-'} | ${replay.hostScreenshotPath || '-'}`,
    ),
    providers: formatAutonomousList(autonomousLearningState?.vm?.providers, (provider) =>
      `${provider.provider || provider.name || '-'} | available=${Boolean(provider.available)} | configured=${Boolean(provider.configured)} | ready=${Boolean(provider.ready)} | guest=${Boolean(provider.capabilities?.can_execute_command_in_guest)} | ${provider.setupReason || ''}`.trim(),
    ),
    runningTasks: runningTasks.length,
    pausedTasks: pausedTasks.length,
    queuedTasks: queuedTasks.length,
    pendingProposals: pendingProposals.length,
    pendingApprovals: autonomousLearningState?.pendingApprovals?.length || 0,
    validatedProcedures:
      (autonomousLearningState?.procedures || []).filter((procedure) => procedure.status === 'active').length,
    latestRisk: autonomousLearningState?.risks?.at(-1)?.reason || '-',
    latestRollback: autonomousLearningState?.rollbacks?.at(-1)?.reason || '-',
    tasks: formatAutonomousList(autonomousLearningState?.tasks, (task) =>
      `${task.taskId || '-'} | ${task.status || '-'} | ${task.priority || '-'} | ${task.policyDecision?.reason || '-'}`,
    ),
    proposals: formatAutonomousList(pendingProposals, (proposal) =>
      `${proposal.proposalId || '-'} | ${proposal.riskLevel || '-'} | ${proposal.title || '-'}`,
    ),
    approvals: formatAutonomousList(autonomousLearningState?.pendingApprovals, (approval) =>
      `${approval.approvalId || '-'} | ${approval.taskId || approval.proposalId || '-'} | ${approval.reason || '-'}`,
    ),
    validations: formatAutonomousList(autonomousLearningState?.validationReports, (report) =>
      `${report.validationId || '-'} | ${report.status || '-'} | ${report.reason || '-'} | score=${report.solutionScore?.score ?? '-'}`,
    ),
    vmTaskRuns: formatAutonomousList(autonomousLearningState?.vmTaskRuns, (run) =>
      `${run.taskId || '-'} | ${run.executionMode || '-'} | ok=${Boolean(run.ok)} | ${run.provider || '-'}`,
    ),
    research: formatAutonomousList(autonomousLearningState?.researchRuns, (run) =>
      `${run.researchId || '-'} | ${run.status || '-'} | ${run.query || '-'} | actionable=${Boolean(run.actionable)}`,
    ),
    learning: formatAutonomousList(
      [
        ...(autonomousLearningState?.procedureCandidates || []).map((item) => ({ ...item, kind: 'candidate' })),
        ...(autonomousLearningState?.procedures || []).map((item) => ({ ...item, kind: 'procedure' })),
      ],
      (item) =>
        `${item.kind || '-'} | ${item.candidateId || item.procedureId || '-'} | ${item.status || '-'} | confidence=${item.confidence ?? '-'}`,
    ),
    rollbacks: formatAutonomousList(autonomousLearningState?.rollbacks, (rollback) => {
      const classification =
        rollback.artifacts?.restored?.[0]?.divergenceClassification ||
        rollback.artifacts?.conflictBackups?.[0]?.classification ||
        '';
      return `${rollback.rollbackId || '-'} | ${rollback.status || '-'} | ${rollback.reason || '-'} | ${rollback.snapshotId || '-'} ${classification}`.trim();
    }),
    logs: formatAutonomousList((autonomousLearningState?.logs || []).slice(-12), (event) =>
      `${event.type || '-'} | ${event.taskId || event.proposalId || event.riskId || ''} ${event.reason || ''}`.trim(),
    ),
  };
  const runnerTasks = Object.values(autonomousRunnerState?.tasksById || {});
  const learningLoop = {
    enabled: Boolean(autonomousLearningMemoryState?.enabled),
    lastStartupRunAt: autonomousLearningMemoryState?.lastStartupRunAt || '-',
    lastScanAt: autonomousLearningMemoryState?.lastScanAt || '-',
    lastExperimentAt: autonomousLearningMemoryState?.lastExperimentAt || '-',
    goals: formatAutonomousList(autonomousLearningMemoryState?.learningGoals, (goal) =>
      `${goal.goalId || '-'} | ${goal.status || '-'} | stages=${goal.stages?.length || 0} | ${goal.description || '-'}`,
    ),
    observedTargets: formatAutonomousList(autonomousLearningMemoryState?.observedTargets, (target) =>
      `${target.targetId || '-'} | ${target.kind || '-'} | seen=${target.seenCount ?? 0} | ${target.status || '-'} | ${target.label || '-'}`,
    ),
    gaps: formatAutonomousList(autonomousLearningMemoryState?.knownGaps, (gap) =>
      `${gap.gapId || '-'} | ${gap.priority || '-'} | ${gap.riskLevel || '-'} | ${gap.description || '-'}`,
    ),
    experiments: formatAutonomousList(autonomousLearningMemoryState?.recentExperiments, (experiment) =>
      `${experiment.taskId || experiment.experimentId || '-'} | ${experiment.status || '-'} | ${experiment.gapId || '-'} | ${experiment.reason || '-'}`,
    ),
    candidates: formatAutonomousList(autonomousLearningMemoryState?.procedureCandidates, (candidate) =>
      `${candidate.candidateId || candidate.procedureId || '-'} | ${candidate.status || '-'} | confidence=${candidate.confidence ?? '-'}`,
    ),
    procedures: formatAutonomousList(autonomousLearningMemoryState?.promotedProcedures, (procedure) =>
      `${procedure.procedureId || '-'} | ${procedure.status || '-'} | confidence=${procedure.confidence ?? '-'} | used=${procedure.usageCount ?? 0}`,
    ),
    scripts: formatAutonomousList(autonomousLearningMemoryState?.generatedScripts, (script) =>
      `${script.scriptId || '-'} | ${script.scriptType || '-'} | ${script.relativePath || '-'}`,
    ),
    reuseIndex: formatDebugValue(procedureReuseIndex),
    optimization: formatDebugValue(autonomousOptimizationState),
    stats: formatDebugValue(autonomousLearningMemoryState?.stats),
    audits: formatAutonomousList((autonomousLearningMemoryState?.auditLog || []).slice(-16), (event) =>
      `${event.timestamp || '-'} | ${event.type || '-'} | ${event.reason || ''} | ${event.summary || ''}`.trim(),
    ),
  };
  const persistence = {
    memorySizeBytes: Number(persistenceDiagnostics?.sizeBytes || 0),
    memoryMaxBytes: Number(persistenceDiagnostics?.maxBytes || 0),
    memoryPercentUsed: Number(persistenceDiagnostics?.percentUsed || 0),
    memoryNearLimit: Boolean(persistenceDiagnostics?.nearLimit),
    memoryStatus: persistenceDiagnostics?.status || '-',
    lastMemorySaveAt: persistenceDiagnostics?.lastMemorySaveAt || '-',
    lastMemorySaveError: persistenceDiagnostics?.lastMemorySaveError || '-',
    lastRunnerEvidenceError: persistenceDiagnostics?.lastRunnerEvidenceError || '-',
    lastRunnerEvidenceErrorAt: persistenceDiagnostics?.lastRunnerEvidenceErrorAt || '-',
    lastError: persistenceDiagnostics?.lastError || '-',
  };
  const runner = {
    enabled: Boolean(autonomousRunnerState?.enabled),
    runnerState: autonomousRunnerState?.runnerState || '-',
    activeTaskId: autonomousRunnerState?.activeTaskId || '-',
    activeStepId: autonomousRunnerState?.runnerLock?.activeStepId || '-',
    queueSize: autonomousRunnerState?.queue?.length || 0,
    lock: formatDebugValue(autonomousRunnerState?.runnerLock),
    heartbeat: autonomousRunnerState?.runnerLock?.heartbeatAt || '-',
    readyCount: runnerTasks.filter((task) => task.status === 'ready').length,
    runningCount: runnerTasks.filter((task) => task.status === 'running').length,
    waitingRetryCount: runnerTasks.filter((task) => task.status === 'waiting_retry').length,
    blockedCount: runnerTasks.filter((task) => task.status === 'blocked').length,
    failedCount: runnerTasks.filter((task) => task.status === 'failed').length,
    tasks: formatAutonomousList(runnerTasks, (task) =>
      `${task.id || '-'} | ${task.status || '-'} | ${task.priority || '-'} | rank=${task.queueRank ?? '-'} | ${task.reason || task.title || '-'}`,
    ),
    queue: formatAutonomousList(
      (autonomousRunnerState?.queue || [])
        .map((taskId) => autonomousRunnerState?.tasksById?.[taskId])
        .filter(Boolean),
      (task) => `${task.id || '-'} | ${task.status || '-'} | next=${task.nextRunAt || '-'} | ${task.title || '-'}`,
    ),
    audits: formatAutonomousList((autonomousRunnerState?.audits || []).slice(-16), (event) =>
      `${event.timestamp || '-'} | ${event.type || '-'} | ${event.taskId || ''} ${event.reason || ''} | ${event.summary || ''}`.trim(),
    ),
    evidenceRefs: formatAutonomousList((autonomousRunnerState?.evidenceRefs || []).slice(-16), (ref) =>
      `${ref.kind || '-'} | ${ref.taskId || '-'} | ${ref.path || '-'} | important=${Boolean(ref.important)}`,
    ),
  };

  return {
    session: {
      status: status || '-',
      caption: caption || '-',
      inputCaption: inputCaption || '-',
      trustedUtterance: trustedUtterance?.text || '-',
      outputTranscript: outputTranscript || '-',
      screenWidth: Number(screenGeometry?.width || 0),
      screenHeight: Number(screenGeometry?.height || 0),
    },
    diagnostics: {
      connection: diagnostics.connection || '-',
      microphone: diagnostics.microphone || '-',
      screen: diagnostics.screen || '-',
      gemini: diagnostics.gemini || '-',
      audioChunksSent: diagnostics.audioChunksSent || 0,
      videoFramesSent: diagnostics.videoFramesSent || 0,
      lastVideoFrame:
        diagnostics.lastVideoFrameWidth && diagnostics.lastVideoFrameHeight
          ? `${diagnostics.lastVideoFrameWidth}x${diagnostics.lastVideoFrameHeight}`
          : '-',
      lastVideoSource:
        diagnostics.lastVideoSourceWidth && diagnostics.lastVideoSourceHeight
          ? `${diagnostics.lastVideoSourceWidth}x${diagnostics.lastVideoSourceHeight}`
          : '-',
      serverMessagesReceived: diagnostics.serverMessagesReceived || 0,
      outputAudioChunksReceived: diagnostics.outputAudioChunksReceived || 0,
      reconnectAttempts: diagnostics.reconnectAttempts || 0,
      successfulResumptions: diagnostics.successfulResumptions || 0,
      rehydratedReconnects: diagnostics.rehydratedReconnects || 0,
      lastCloseReason: diagnostics.lastCloseReason || '-',
      lastError: diagnostics.lastError || '-',
    },
    memorySummary: formatDebugValue(memorySummary),
    knowledge: {
      ...knowledge,
      display: buildKnowledgeDisplay(knowledge),
    },
    autonomous: {
      ...autonomous,
      display: buildAutonomousDisplay(autonomous),
    },
    learningLoop,
    runner,
    persistence,
    interactions: Array.isArray(interactions)
      ? interactions.slice(-80).map(normalizeInteraction).reverse()
      : [],
  };
};
