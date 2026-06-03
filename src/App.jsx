import { invoke } from '@tauri-apps/api/core';
import { useEffect, useReducer, useRef, useState } from 'react';
import { ALICE_LIVE_MODEL, createAliceLiveSetup } from './alice';
import {
  ALICE_MEMORY_ACTIVE_PROJECT_RECENCY_MS,
  ALICE_MEMORY_ACTIVE_TASK_RECENCY_MS,
  buildMemoryPrefixTurns,
  createAliceMemoryPersistenceSnapshot,
  getAutonomousRunnerState,
  getAutonomousRunnerSummary,
  getAutonomousLearningMemoryState,
  createEmptyAliceMemory,
  extractImportantFacts,
  getActiveMindMap,
  mergeActiveMindMap,
  mergeAutonomousAudit,
  mergeImportantFacts,
  mergeMindMapFromGoal,
  mergeValidatedProcedures,
  saveAliceMemory,
  updateAutonomousLearningMemoryState,
  updateAutonomousRunnerState,
  updateMindMap,
} from './aliceMemory';
import { createInitialAppUiState, readyCaption, reduceAppUiState, statusCopy } from './appUiState';
import { GeminiLiveSession, LIVE_CLOSE_REASONS } from './geminiLive';
import { calculateRms, decodePcm16Base64, encodePcm16Base64 } from './liveAudio';
import { LiveSessionOrchestrator } from './liveSessionOrchestrator';
import { buildSessionRehydrationTurns } from './liveSessionRehydration';
import { buildRecentSessionTurns } from './liveSessionRecentTurns';
import { createFunctionResponseEnvelope, LiveSessionTransport } from './liveSessionTransport';
import { buildOperationalContextTurns } from './operationalContext';
import { resolveScreenCaptureGeometry, SCREEN_SHARE_VIDEO_CONSTRAINTS } from './screenGeometry';
import { startScreenFrameStreaming } from './screenFrameStreaming';
import { buildDebugHudSnapshot } from './debugHud';
import {
  createEmptyKnowledgeState,
  mergeKnowledgeState,
} from './webKnowledge';
import { executeKnowledgeFunctionCall } from './knowledgeToolExecutor';
import { executeMindMapFunctionCall } from './mindMapToolExecutor';
import {
  TASK_STATUSES,
  appendAutonomousLog,
  createEmptyAutonomousLearningState,
  hydrateAutonomousStateFromAudit,
  mergeAutonomousLearningState,
} from './autonomousLearning';
import {
  executeAutonomousLearningFunctionCall,
  prioritizeUserRequestInAutonomy,
} from './autonomousLearningToolExecutor';
import { executeAutonomousRunnerFunctionCall } from './autonomousRunnerToolExecutor';
import { runAutonomousTaskRunnerTick } from './autonomousTaskRunner';
import {
  clearAutonomousLearningTestData,
  runAutonomousLearningLoop,
  shouldRunAutonomousLearningAfterRunnerTick,
} from './autonomousLearningLoop';
import { createLearningPlannerService } from './learningPlanner/learningPlannerService';
import {
  createAutonomousLearningGoalFromText,
  upsertAutonomousLearningGoal,
} from './autonomousLearningGoals';
import { registerObservedLearningTargets } from './autonomousObservedLearning';
import { syncMindMapWithRunnerTask } from './autonomousRunnerMindMap';
import { syncMindMapWithExecution } from './mindMapExecutionSync';
import { AliceHud } from './hud/AliceHud';
import { isTauriRuntime } from './tauriRuntime';
import {
  appendRunnerAppDiagnostic,
  createRunnerDiagnosticSnapshot,
  createTauriRuntimeMetadata,
} from './runnerAppDiagnostics';
import {
  flushAliceMemoryToRuntime,
  loadAliceMemoryFromRuntime as loadAliceMemoryFromRuntimeBoundary,
} from './aliceMemoryPersistence';
import { applyRuntimeHarnessRequests } from './dev/runtimeHarnessBridge';
import './App.css';

const stopStream = (stream) => {
  stream?.getTracks().forEach((track) => track.stop());
};

const createPcmOutputPlayer = () => {
  let audioContext = null;
  let playheadTime = 0;
  let sources = [];

  const ensureContext = async () => {
    if (!audioContext) {
      audioContext = new AudioContext({ latencyHint: 'interactive', sampleRate: 24000 });
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    return audioContext;
  };

  return {
    async play(base64Audio) {
      const context = await ensureContext();
      const samples = decodePcm16Base64(base64Audio);
      const buffer = context.createBuffer(1, samples.length, 24000);
      buffer.copyToChannel(samples, 0);

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);

      const startAt = Math.max(context.currentTime + 0.02, playheadTime);
      source.start(startAt);
      playheadTime = startAt + buffer.duration;
      sources.push(source);
      source.onended = () => {
        sources = sources.filter((item) => item !== source);
      };
    },
    interrupt() {
      sources.forEach((source) => {
        try {
          source.stop();
        } catch {
          // The source may have already ended.
        }
      });
      sources = [];
      playheadTime = audioContext?.currentTime || 0;
    },
    close() {
      this.interrupt();
      audioContext?.close();
      audioContext = null;
    },
  };
};

const readyCheckPrompt =
  'Diga em uma frase curta, em portugues do Brasil, que voce esta ouvindo e recebendo a tela compartilhada. Nao descreva a tela ainda.';

const ALICE_MEMORY_SAVE_DELAY_MS = 750;
const TRUSTED_UTTERANCE_WINDOW_MS = 10000;
const MAX_DEBUG_INTERACTIONS = 80;
const AUTONOMY_RUNTIME_ENABLED = false;

const createDebugInteractionId = () =>
  `debug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const summarizeDebugPayload = (value, maxLength = 600) => {
  if (value == null) {
    return '';
  }

  try {
    return JSON.stringify(value).slice(0, maxLength);
  } catch {
    return String(value).slice(0, maxLength);
  }
};

const classifyToolDebugStatus = (response = {}) => {
  if (response?.ok === false) {
    return {
      status: 'failed',
      ok: false,
      reason: response.reason || 'tool_failed',
    };
  }

  if (response?.nextAction) {
    return {
      status: 'waiting_follow_up',
      ok: true,
      reason: response.nextAction,
    };
  }

  if (response?.backgroundStatus) {
    const backgroundState =
      response.backgroundStatus?.artifacts?.agentResponse?.result?.status ||
      response.backgroundStatus?.artifacts?.status ||
      response.backgroundStatus?.status ||
      '';
    if (['running', 'starting', 'queued'].includes(String(backgroundState).toLowerCase())) {
      return {
        status: 'running',
        ok: true,
        reason: `background=${backgroundState}`,
      };
    }
  }

  if (response?.task?.status && ['queued', 'running', 'waiting'].includes(String(response.task.status).toLowerCase())) {
    return {
      status: response.task.status,
      ok: true,
      reason: response.policyDecision?.reason || 'task_not_finished_yet',
    };
  }

  if (Array.isArray(response?.startedTaskIds) && response.startedTaskIds.length > 0 && !response?.playgroundRun) {
    return {
      status: 'running',
      ok: true,
      reason: `started=${response.startedTaskIds.join(',')}`,
    };
  }

  return {
    status: 'done',
    ok: true,
    reason: response?.reason || '',
  };
};

const appendTrustedUtterance = (currentUtterance, text) => {
  const normalizedText = String(text || '').trim();
  if (!normalizedText) {
    return currentUtterance;
  }

  const now = Date.now();
  const previousText =
    currentUtterance && now - Number(currentUtterance.timestamp || 0) <= TRUSTED_UTTERANCE_WINDOW_MS
      ? String(currentUtterance.text || '').trim()
      : '';

  return {
    text: previousText ? `${previousText} ${normalizedText}` : normalizedText,
    timestamp: now,
  };
};

const startMicrophoneStreaming = (voiceStream, onChunk) => {
  const audioTracks = voiceStream.getAudioTracks();

  if (audioTracks.length === 0) {
    return () => {};
  }

  const audioContext = new AudioContext({ latencyHint: 'interactive' });
  const source = audioContext.createMediaStreamSource(new MediaStream(audioTracks));
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const mutedOutput = audioContext.createGain();

  mutedOutput.gain.value = 0;
  processor.onaudioprocess = (event) => {
    const channel = event.inputBuffer.getChannelData(0);
    onChunk(encodePcm16Base64(channel, audioContext.sampleRate), calculateRms(channel));
  };

  source.connect(processor);
  processor.connect(mutedOutput);
  mutedOutput.connect(audioContext.destination);

  return () => {
    processor.disconnect();
    source.disconnect();
    mutedOutput.disconnect();
    audioContext.close();
  };
};

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const screenStreamRef = useRef(null);
  const voiceStreamRef = useRef(null);
  const liveSessionRef = useRef(null);
  const liveOrchestratorRef = useRef(null);
  const liveTransportRef = useRef(new LiveSessionTransport());
  const aliceMemoryRef = useRef(createEmptyAliceMemory());
  const memorySaveTimerRef = useRef(null);
  const memoryHydratedRef = useRef(false);
  const microphoneCleanupRef = useRef(null);
  const screenCleanupRef = useRef(null);
  const outputPlayerRef = useRef(createPcmOutputPlayer());
  const trustedUtteranceRef = useRef(null);
  const outputTranscriptRef = useRef('');
  const toolQueueRef = useRef(Promise.resolve());
  const knowledgeStateRef = useRef(createEmptyKnowledgeState());
  const autonomousLearningStateRef = useRef(createEmptyAutonomousLearningState());
  const runnerTimerRef = useRef(null);
  const runnerTickRunningRef = useRef(false);
  const autonomousLearningStartupLoopRef = useRef(false);
  const autonomousLearningLoopRunningRef = useRef(false);
  const tauriRuntimeAvailableRef = useRef(false);
  const runnerDiagnosticsRef = useRef({
    tickScheduled: false,
    waitingForMemory: false,
    nonTauriBypass: false,
  });
  const persistenceDiagnosticsRef = useRef(
    createAliceMemoryPersistenceSnapshot(createEmptyAliceMemory()),
  );
  const debugInteractionsRef = useRef([]);
  const latestConversationInteractionIdRef = useRef('');

  const [uiState, dispatchUi] = useReducer(reduceAppUiState, undefined, createInitialAppUiState);
  const [activeHudPage, setActiveHudPage] = useState('live');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [knowledgeState, setKnowledgeState] = useState(createEmptyKnowledgeState);
  const [autonomousLearningState, setAutonomousLearningState] = useState(createEmptyAutonomousLearningState);
  const [autonomousRunnerState, setAutonomousRunnerState] = useState(() =>
    getAutonomousRunnerState(createEmptyAliceMemory()),
  );
  const [activeMindMap, setActiveMindMap] = useState(() => getActiveMindMap(createEmptyAliceMemory()));
  const [mindMapRevision, setMindMapRevision] = useState(0);
  const [debugInteractions, setDebugInteractions] = useState([]);
  const [persistenceDiagnostics, setPersistenceDiagnostics] = useState(
    () => createAliceMemoryPersistenceSnapshot(createEmptyAliceMemory()),
  );
  const [runnerLoopWakeVersion, setRunnerLoopWakeVersion] = useState(0);
  const { status, caption, inputCaption, error, diagnostics, sessionNotice } = uiState;

  useEffect(() => {
    knowledgeStateRef.current = knowledgeState;
  }, [knowledgeState]);

  useEffect(() => {
    autonomousLearningStateRef.current = autonomousLearningState;
  }, [autonomousLearningState]);

  const noteDiagnostic = (event) => {
    dispatchUi({ type: 'diagnostic-event', event });
  };

  const commitDebugInteractions = (updater) => {
    const nextInteractions = updater(debugInteractionsRef.current).slice(-MAX_DEBUG_INTERACTIONS);
    debugInteractionsRef.current = nextInteractions;
    setDebugInteractions(nextInteractions);
  };

  const canUseTauriRuntime = () => tauriRuntimeAvailableRef.current || isTauriRuntime();

  const recordUserInteraction = (userText) => {
    const normalizedText = String(userText || '').trim();
    if (!normalizedText) {
      return;
    }

    commitDebugInteractions((current) => {
      const latestId = latestConversationInteractionIdRef.current;
      const latest = current.find((interaction) => interaction.id === latestId);
      if (latest && latest.kind === 'conversation' && !latest.aliceText) {
        return current.map((interaction) =>
          interaction.id === latestId
            ? { ...interaction, userText: normalizedText, status: 'listening', timestamp: Date.now() }
            : interaction,
        );
      }

      const interaction = {
        id: createDebugInteractionId(),
        kind: 'conversation',
        timestamp: Date.now(),
        status: 'listening',
        userText: normalizedText,
        aliceText: '',
      };
      latestConversationInteractionIdRef.current = interaction.id;
      return [...current, interaction];
    });
  };

  const recordAliceInteraction = (aliceText) => {
    const normalizedText = String(aliceText || '').trim();
    if (!normalizedText) {
      return;
    }

    commitDebugInteractions((current) => {
      const latestId = latestConversationInteractionIdRef.current;
      const latest = current.find((interaction) => interaction.id === latestId);
      if (latest && latest.kind === 'conversation') {
        return current.map((interaction) =>
          interaction.id === latestId
            ? { ...interaction, aliceText: normalizedText, status: 'answered', timestamp: Date.now() }
            : interaction,
        );
      }

      const interaction = {
        id: createDebugInteractionId(),
        kind: 'conversation',
        timestamp: Date.now(),
        status: 'answered',
        userText: trustedUtteranceRef.current?.text || '',
        aliceText: normalizedText,
      };
      latestConversationInteractionIdRef.current = interaction.id;
      return [...current, interaction];
    });
  };

  const recordToolInteraction = (functionCall, patch = {}) => {
    const toolName = functionCall?.name || 'ferramenta_desconhecida';
    const args = functionCall?.args || {};
    const existingId = patch.id;

    commitDebugInteractions((current) => {
      if (existingId) {
        return current.map((interaction) =>
          interaction.id === existingId
            ? {
                ...interaction,
                ...patch,
                timestamp: Date.now(),
              }
            : interaction,
        );
      }

      const interaction = {
        id: createDebugInteractionId(),
        kind: 'tool',
        timestamp: Date.now(),
        status: 'running',
        toolName,
        operation: args.operation || args.taskKind || args.action || '',
        ok: null,
        userText: trustedUtteranceRef.current?.text || '',
        argsSummary: summarizeDebugPayload(args),
        responseSummary: '',
        message: '',
        reason: '',
      };
      return [...current, interaction];
    });

    return existingId || debugInteractionsRef.current.at(-1)?.id || '';
  };

  const clearAliceMemorySaveTimer = () => {
    if (memorySaveTimerRef.current) {
      window.clearTimeout(memorySaveTimerRef.current);
      memorySaveTimerRef.current = null;
    }
  };

  const updatePersistenceDiagnostics = (patch = {}) => {
    const nextDiagnostics = createAliceMemoryPersistenceSnapshot(aliceMemoryRef.current, {
      ...persistenceDiagnosticsRef.current,
      ...patch,
    });
    persistenceDiagnosticsRef.current = nextDiagnostics;
    setPersistenceDiagnostics(nextDiagnostics);
    return nextDiagnostics;
  };

  const flushAliceMemory = async () => {
    clearAliceMemorySaveTimer();
    aliceMemoryRef.current = await flushAliceMemoryToRuntime({
      memory: aliceMemoryRef.current,
      canUseTauriRuntime: canUseTauriRuntime(),
      memoryHydrated: memoryHydratedRef.current,
      saveMemory: saveAliceMemory,
      onSkipped: () => {
        updatePersistenceDiagnostics();
      },
      onSaved: () => {
        updatePersistenceDiagnostics({
          lastMemorySaveAt: new Date().toISOString(),
          lastMemorySaveError: '',
        });
      },
      onSaveError: (saveError) => {
        updatePersistenceDiagnostics({
          lastMemorySaveError: String(saveError?.message || saveError || 'Falha ao salvar memoria.'),
        });
      },
    });
    return aliceMemoryRef.current;
  };

  const scheduleAliceMemorySave = () => {
    if (!canUseTauriRuntime()) {
      return;
    }

    clearAliceMemorySaveTimer();
    memorySaveTimerRef.current = window.setTimeout(() => {
      void flushAliceMemory().catch(() => {
        // Memory persistence should not break the live session flow.
      });
    }, ALICE_MEMORY_SAVE_DELAY_MS);
  };

  const commitAliceMemory = (nextMemory) => {
    aliceMemoryRef.current = nextMemory;
    setActiveMindMap(getActiveMindMap(nextMemory));
    setMindMapRevision((current) => current + 1);
    updatePersistenceDiagnostics();
    scheduleAliceMemorySave();
    return nextMemory;
  };

  const commitRunnerDiagnostic = (event) =>
    commitAliceMemory(appendRunnerAppDiagnostic(aliceMemoryRef.current, event));

  const verifyRunnerEvidenceForLearning = async ({ executionId, files = [] } = {}) =>
    invoke('verify_runner_evidence', {
      request: {
        executionId,
        files,
      },
    });

  const runStartupAutonomousLearningLoop = async ({ startup = false, dryRun = null } = {}) => {
    if (!AUTONOMY_RUNTIME_ENABLED) {
      return null;
    }

    if (!memoryHydratedRef.current || !canUseTauriRuntime()) {
      return null;
    }
    if (startup && autonomousLearningStartupLoopRef.current) {
      return null;
    }
    if (autonomousLearningLoopRunningRef.current) {
      return null;
    }
    if (startup) {
      autonomousLearningStartupLoopRef.current = true;
    }

    autonomousLearningLoopRunningRef.current = true;
    try {
      const result = await runAutonomousLearningLoop({
        memory: aliceMemoryRef.current,
        memoryHydrated: memoryHydratedRef.current,
        verifyRunnerEvidence: verifyRunnerEvidenceForLearning,
        dryRun,
        startup,
        nowMs: Number(new Date()),
      });
      if (result?.memory) {
        commitAliceMemory(result.memory);
      }
      return result;
    } catch (learningError) {
      const currentLearning = getAutonomousLearningMemoryState(aliceMemoryRef.current);
      commitAliceMemory(updateAutonomousLearningMemoryState(aliceMemoryRef.current, {
        ...currentLearning,
        auditLog: [
          ...(currentLearning.auditLog || []),
          {
            id: `learning-loop-error-${Number(new Date())}`,
            timestamp: new Date().toISOString(),
            type: 'learning_loop_error',
            summary: 'Loop de aprendizado autonomo falhou de forma tolerada.',
            reason: String(learningError?.message || learningError || 'learning_loop_error'),
          },
        ].slice(-120),
      }));
      return null;
    } finally {
      autonomousLearningLoopRunningRef.current = false;
    }
  };

  const registerObservedLearningFromContext = ({
    source = 'runtime_observation',
    screen = {},
    knowledge = knowledgeStateRef.current,
  } = {}) => {
    if (!AUTONOMY_RUNTIME_ENABLED) {
      return null;
    }

    if (!memoryHydratedRef.current) {
      return null;
    }
    const result = registerObservedLearningTargets(aliceMemoryRef.current, {
      source,
      screen,
      knowledgeState: knowledge,
      now: new Date().toISOString(),
    });
    if (!result.changed) {
      return result;
    }
    commitAliceMemory(result.memory);
    if (result.createdGoals.length > 0) {
      void runStartupAutonomousLearningLoop({ startup: false });
    }
    return result;
  };

  const loadAliceMemoryFromRuntime = async () => {
    try {
      const memory = await loadAliceMemoryFromRuntimeBoundary({ invokeFn: invoke });
      tauriRuntimeAvailableRef.current = true;
      return memory;
    } catch (loadError) {
      tauriRuntimeAvailableRef.current = false;
      throw loadError;
    }
  };

  const rememberAliceContext = ({
    inputTranscript = trustedUtteranceRef.current?.text || '',
    outputTranscript = outputTranscriptRef.current,
  } = {}) => {
    const extractedFacts = extractImportantFacts({
      inputTranscript,
      outputTranscript,
      sessionModel: ALICE_LIVE_MODEL,
    });

    aliceMemoryRef.current = mergeImportantFacts(aliceMemoryRef.current, extractedFacts);
    scheduleAliceMemorySave();
    return aliceMemoryRef.current;
  };

  const stopStreamingPipelines = () => {
    microphoneCleanupRef.current?.();
    screenCleanupRef.current?.();

    microphoneCleanupRef.current = null;
    screenCleanupRef.current = null;
  };

  const stopMediaStreams = () => {
    stopStream(screenStreamRef.current);
    stopStream(voiceStreamRef.current);

    screenStreamRef.current = null;
    voiceStreamRef.current = null;
  };

  const resetRuntimeRefs = () => {
    liveSessionRef.current = null;
    liveOrchestratorRef.current = null;
    liveTransportRef.current.clear();
    clearAliceMemorySaveTimer();
    trustedUtteranceRef.current = null;
    outputTranscriptRef.current = '';
    toolQueueRef.current = Promise.resolve();
  };

  const releaseLiveResources = () => {
    stopStreamingPipelines();
    stopMediaStreams();
    outputPlayerRef.current?.close();
    outputPlayerRef.current = createPcmOutputPlayer();
    setKnowledgeState(createEmptyKnowledgeState());
    knowledgeStateRef.current = createEmptyKnowledgeState();

    resetRuntimeRefs();

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const sendToolResponse = (functionCall, response, generation) =>
    liveTransportRef.current.sendToolResponse({
      generation,
      functionResponse: createFunctionResponseEnvelope(functionCall, response),
    });

  const updateKnowledgeState = (patch) => {
    const nextState = mergeKnowledgeState(knowledgeStateRef.current, patch);
    knowledgeStateRef.current = nextState;
    setKnowledgeState(nextState);
    registerObservedLearningFromContext({
      source: 'web_context_observed',
      knowledge: nextState,
    });
  };

  const updateAutonomousLearningState = (patch) => {
    if (!patch) {
      return;
    }

    setAutonomousLearningState((current) => {
      const nextState = mergeAutonomousLearningState(current, patch);
      autonomousLearningStateRef.current = nextState;
      aliceMemoryRef.current = mergeAutonomousAudit(aliceMemoryRef.current, nextState);
      const activeGoal = nextState.tasks.find((task) =>
        [TASK_STATUSES.RUNNING, TASK_STATUSES.QUEUED, TASK_STATUSES.WAITING].includes(task.status),
      );
      const hasGoalMindMap = activeGoal
        ? Object.values(aliceMemoryRef.current.mindMaps.byId || {}).some((map) => map.goalId === activeGoal.taskId)
        : false;
      if (activeGoal && !hasGoalMindMap) {
        aliceMemoryRef.current = mergeMindMapFromGoal(
          aliceMemoryRef.current,
          {
            goalId: activeGoal.taskId,
            title: activeGoal.reason || activeGoal.taskType,
            objective: activeGoal.actionRequest?.reason,
            subtasks: [
              ...(activeGoal.actionRequest?.targetFiles || []).map((file) => ({ id: `file-${file}`, title: file })),
              ...(activeGoal.actionRequest?.targetApps || []).map((app) => ({ id: `app-${app}`, title: app })),
            ],
          },
          { makeActive: false },
        );
      }
      scheduleAliceMemorySave();
      return nextState;
    });
  };

  const persistValidatedProcedures = (procedures = []) => {
    if (!procedures.length) {
      return;
    }

    aliceMemoryRef.current = mergeValidatedProcedures(aliceMemoryRef.current, procedures);
    scheduleAliceMemorySave();
  };

  const handleMindMapChange = (mindMapData) => {
    aliceMemoryRef.current = mergeActiveMindMap(aliceMemoryRef.current, mindMapData);
    setActiveMindMap(getActiveMindMap(aliceMemoryRef.current));
    scheduleAliceMemorySave();
  };

  const syncMindMapFromAutonomousResult = (autonomousResult) => {
    const task = autonomousResult?.response?.task;
    const playgroundRun = autonomousResult?.response?.playgroundRun;

    if (!task || !playgroundRun) {
      return null;
    }

    aliceMemoryRef.current = mergeMindMapFromGoal(
      aliceMemoryRef.current,
      {
        goalId: task.taskId,
        title: task.reason || task.taskType,
        objective: task.actionRequest?.reason,
        subtasks: [
          ...(task.actionRequest?.targetFiles || []).map((file) => ({ id: `file-${file}`, title: file })),
          ...(task.actionRequest?.targetApps || []).map((app) => ({ id: `app-${app}`, title: app })),
        ],
      },
      { makeActive: false },
    );

    const targetMap = Object.values(aliceMemoryRef.current.mindMaps.byId || {})
      .find((map) => map.goalId === task.taskId) || getActiveMindMap(aliceMemoryRef.current);
    const syncResult = syncMindMapWithExecution(playgroundRun, {
      activeMap: targetMap,
      goal: task,
      goalId: task.taskId,
      executionId: task.taskId,
    });

    if (!syncResult.updated) {
      return syncResult;
    }

    aliceMemoryRef.current = updateMindMap(
      aliceMemoryRef.current,
      targetMap.id,
      syncResult.mindMap,
      { historyReason: 'execution_sync' },
    );
    if (aliceMemoryRef.current.mindMaps.activeId === targetMap.id) {
      setActiveMindMap(getActiveMindMap(aliceMemoryRef.current));
      setMindMapRevision((current) => current + 1);
    }

    return syncResult;
  };

  const syncMindMapFromRunnerTask = (runnerTask) => {
    if (!runnerTask?.id) {
      return null;
    }

    const targetMap = getActiveMindMap(aliceMemoryRef.current);
    const syncedMap = syncMindMapWithRunnerTask(targetMap, runnerTask);
    aliceMemoryRef.current = updateMindMap(
      aliceMemoryRef.current,
      targetMap.id,
      syncedMap,
      { historyReason: 'runner_sync' },
    );
    setActiveMindMap(getActiveMindMap(aliceMemoryRef.current));
    setMindMapRevision((current) => current + 1);
    return syncedMap;
  };

  const persistRunnerLearningCandidates = (candidates = []) => {
    if (!candidates.length) {
      return;
    }

    const currentAutonomy = autonomousLearningStateRef.current;
    const nextState = appendAutonomousLog(
      mergeAutonomousLearningState(currentAutonomy, {
        procedureCandidates: [
          ...(currentAutonomy.procedureCandidates || []),
          ...candidates,
        ],
        learningMemoryEvents: [
          ...(currentAutonomy.learningMemoryEvents || []),
          ...candidates.map((candidate) => ({
            candidateId: candidate.candidateId,
            promoted: false,
            reason: 'runner_candidate_requires_review',
            createdAt: Date.now(),
          })),
        ],
      }),
      'runner_learning_candidates_created',
      {
        candidateIds: candidates.map((candidate) => candidate.candidateId),
        reason: 'requires_hud_review',
      },
    );
    updateAutonomousLearningState(nextState);
  };

  const rejectUnexpectedToolCall = async (functionCall, generation, debugInteractionId = '') => {
    noteDiagnostic({
      type: 'error',
      message: `Ferramenta inesperada recebida: ${functionCall?.name || 'desconhecida'}.`,
    });
    if (debugInteractionId) {
      recordToolInteraction(functionCall, {
        id: debugInteractionId,
        status: 'failed',
        ok: false,
        message: 'Ferramenta local desconhecida para a Alice.',
        reason: 'unexpected_tool_call',
      });
    }

    await sendToolResponse(
      functionCall,
      {
        ok: false,
        message: 'Ferramenta local desconhecida para a Alice.',
      },
      generation,
    );
  };

  const getScreenCaptureGeometry = () => {
    const settings = screenStreamRef.current?.getVideoTracks()[0]?.getSettings?.() || {};
    return resolveScreenCaptureGeometry(settings, videoRef.current);
  };

  const restartStreamingPipelines = (generation) => {
    stopStreamingPipelines();

    if (voiceStreamRef.current) {
      microphoneCleanupRef.current = startMicrophoneStreaming(voiceStreamRef.current, (chunk, level) => {
        const sent = liveTransportRef.current.sendRealtime({
          generation,
          send: (activeSession) => activeSession.sendAudio(chunk),
        });

        if (sent) {
          noteDiagnostic({ type: 'audio-sent', level });
        }
      });
    }

    if (videoRef.current && canvasRef.current) {
      screenCleanupRef.current = startScreenFrameStreaming(videoRef.current, canvasRef.current, (frame) => {
        const sent = liveTransportRef.current.sendRealtime({
          generation,
          send: (activeSession) => activeSession.sendVideo(frame.base64),
        });

        if (sent) {
          noteDiagnostic({
            type: 'video-sent',
            width: frame.width,
            height: frame.height,
            sourceWidth: frame.sourceWidth,
            sourceHeight: frame.sourceHeight,
          });
        }
      });
    }
  };

  const buildLiveMemoryPrefixTurns = ({ mode = 'fresh' } = {}) => {
    const currentMemory = aliceMemoryRef.current;
    const currentMindMap = getActiveMindMap(currentMemory);
    const runnerSummary = getAutonomousRunnerSummary(currentMemory);
    const operationalTurns = buildOperationalContextTurns({
      trustedUtterance: trustedUtteranceRef.current,
      outputTranscript: outputTranscriptRef.current,
      memorySummary: currentMemory.recentContextSummary?.summary || '',
      knowledgeState: knowledgeStateRef.current,
      autonomousLearningState: autonomousLearningStateRef.current,
      autonomousLearningMemoryState: currentMemory.autonomousLearning,
      autonomousRunnerSummary: {
        ...runnerSummary,
        activeTask: runnerSummary.activeTaskId
          ? getAutonomousRunnerState(currentMemory).tasksById[runnerSummary.activeTaskId]
          : null,
      },
      activeMindMap: currentMindMap,
      screenGeometry: getScreenCaptureGeometry(),
    });
    const recentSessionTurns = buildRecentSessionTurns({
      interactions: debugInteractionsRef.current,
      trustedUtterance: trustedUtteranceRef.current,
      outputTranscript: outputTranscriptRef.current,
    });
    const persistentMemoryTurns = buildMemoryPrefixTurns(currentMemory, {
      supplementalOnly: mode !== 'fresh',
      includeRecentContext: mode === 'fresh',
      includeActiveProjects: mode === 'fresh',
      includeActiveTasks: mode === 'fresh',
      filterActiveItemsByRecency: true,
      activeProjectRecencyMs: ALICE_MEMORY_ACTIVE_PROJECT_RECENCY_MS,
      activeTaskRecencyMs: ALICE_MEMORY_ACTIVE_TASK_RECENCY_MS,
    });
    const rehydrationTurns = buildSessionRehydrationTurns({
      trustedUtterance: trustedUtteranceRef.current,
      outputTranscript: outputTranscriptRef.current,
      memorySummary: currentMemory.recentContextSummary?.summary || '',
      knowledgeState: knowledgeStateRef.current,
      autonomousLearningState: autonomousLearningStateRef.current,
      autonomousLearningMemoryState: currentMemory.autonomousLearning,
      autonomousRunnerSummary: {
        ...runnerSummary,
        activeTask: runnerSummary.activeTaskId
          ? getAutonomousRunnerState(currentMemory).tasksById[runnerSummary.activeTaskId]
          : null,
      },
      activeMindMap: currentMindMap,
    });

    if (mode === 'resume') {
      return [
        ...operationalTurns,
        ...recentSessionTurns,
        ...persistentMemoryTurns,
        ...rehydrationTurns,
      ];
    }

    return [
      ...operationalTurns,
      ...recentSessionTurns,
      ...persistentMemoryTurns,
      ...rehydrationTurns,
    ];
  };

  const executeLocalToolCall = async (functionCall, generation) => {
    const debugInteractionId = recordToolInteraction(functionCall);
    try {
      const result = await executeKnowledgeFunctionCall({
        functionCall,
        trustedUtterance: trustedUtteranceRef.current?.text || '',
        knowledgeState: knowledgeStateRef.current,
        invokeTool: invoke,
      });

      if (result.handled) {
        updateKnowledgeState(result.statePatch);
        const debugStatus = classifyToolDebugStatus(result.response);
        recordToolInteraction(functionCall, {
          id: debugInteractionId,
          status: debugStatus.status,
          ok: debugStatus.ok,
          message: result.response?.message || '',
          reason: debugStatus.reason || result.response?.reason || '',
          responseSummary: summarizeDebugPayload(result.response),
        });

        await sendToolResponse(functionCall, result.response, generation);
        return;
      }

      const mindMapResult = await executeMindMapFunctionCall({
        functionCall,
        currentMemory: aliceMemoryRef.current,
        currentMindMap: getActiveMindMap(aliceMemoryRef.current),
      });

      if (mindMapResult.handled) {
        if (mindMapResult.response?.ok && mindMapResult.response.operation !== 'export') {
          aliceMemoryRef.current = mergeActiveMindMap(aliceMemoryRef.current, mindMapResult.mindMap, {
            targetMapId: mindMapResult.targetMapId,
          });
          setActiveMindMap(getActiveMindMap(aliceMemoryRef.current));
          setMindMapRevision((current) => current + 1);
          scheduleAliceMemorySave();
        }
        const debugStatus = classifyToolDebugStatus(mindMapResult.response);
        recordToolInteraction(functionCall, {
          id: debugInteractionId,
          status: debugStatus.status,
          ok: debugStatus.ok,
          message: mindMapResult.response?.message || '',
          reason: debugStatus.reason || mindMapResult.response?.reason || '',
          responseSummary: summarizeDebugPayload(mindMapResult.response),
        });

        await sendToolResponse(functionCall, mindMapResult.response, generation);
        return;
      }

      const runnerResult = executeAutonomousRunnerFunctionCall({
        functionCall,
        currentMemory: aliceMemoryRef.current,
        trustedUtterance: trustedUtteranceRef.current?.text || '',
      });

      if (runnerResult.handled) {
        commitAliceMemory(runnerResult.memory);
        const debugStatus = classifyToolDebugStatus(runnerResult.response);
        recordToolInteraction(functionCall, {
          id: debugInteractionId,
          status: debugStatus.status,
          ok: debugStatus.ok,
          message: runnerResult.response?.message || '',
          reason: debugStatus.reason || runnerResult.response?.reason || '',
          responseSummary: summarizeDebugPayload(runnerResult.response),
        });

        await sendToolResponse(functionCall, runnerResult.response, generation);
        return;
      }

      const autonomousResult = await executeAutonomousLearningFunctionCall({
        functionCall,
        trustedUtterance: trustedUtteranceRef.current?.text || '',
        autonomousState: autonomousLearningStateRef.current,
        activeMindMap: getActiveMindMap(aliceMemoryRef.current),
        autonomousRunnerSummary: getAutonomousRunnerSummary(aliceMemoryRef.current),
        invokeTool: invoke,
      });

      if (!autonomousResult.handled) {
        await rejectUnexpectedToolCall(functionCall, generation, debugInteractionId);
        return;
      }

      syncMindMapFromAutonomousResult(autonomousResult);
      updateAutonomousLearningState(autonomousResult.statePatch);
      persistValidatedProcedures(autonomousResult.memoryProcedures || []);
      const debugStatus = classifyToolDebugStatus(autonomousResult.response);
      recordToolInteraction(functionCall, {
        id: debugInteractionId,
        status: debugStatus.status,
        ok: debugStatus.ok,
        message: autonomousResult.response?.message || '',
        reason: debugStatus.reason || autonomousResult.response?.reason || '',
        responseSummary: summarizeDebugPayload(autonomousResult.response),
      });

      await sendToolResponse(functionCall, autonomousResult.response, generation);
    } catch (toolError) {
      const message = toolError?.message || String(toolError);
      noteDiagnostic({
        type: 'error',
        message,
      });
      recordToolInteraction(functionCall, {
        id: debugInteractionId,
        status: 'failed',
        ok: false,
        message,
        reason: 'tool_exception',
      });
      await sendToolResponse(
        functionCall,
        {
          ok: false,
          message,
        },
        generation,
      );
    }
  };

  const handleImprovementProposalDecision = async (proposalId, userApproved) => {
    const result = await executeAutonomousLearningFunctionCall({
      functionCall: {
        name: 'approve_self_improvement_proposal',
        args: {
          proposalId,
          userApproved,
        },
      },
      trustedUtterance: userApproved
        ? 'aprovar proposta de auto-melhoria'
        : 'rejeitar proposta de auto-melhoria',
      autonomousState: autonomousLearningStateRef.current,
      activeMindMap: getActiveMindMap(aliceMemoryRef.current),
      autonomousRunnerSummary: getAutonomousRunnerSummary(aliceMemoryRef.current),
      invokeTool: invoke,
    });

    if (result.handled) {
      updateAutonomousLearningState(result.statePatch);
    }
  };

  const handleRunnerAction = (operation, payload = {}) => {
    const result = executeAutonomousRunnerFunctionCall({
      functionCall: {
        name: 'manage_autonomous_runner',
        args: {
          operation,
          ...payload,
        },
      },
      currentMemory: aliceMemoryRef.current,
      trustedUtterance: trustedUtteranceRef.current?.text || '',
    });

    if (result.handled) {
      commitAliceMemory(result.memory);
    }
  };

  const handleAutonomousLearningAction = (operation, payload = {}) => {
    const now = new Date().toISOString();
    if (operation === 'create-learning-plan') {
      const objective = String(payload.objective || payload.goal || payload.text || '').trim();
      if (!objective) {
        return null;
      }
      const plannerService = createLearningPlannerService();
      return plannerService.createPlan(aliceMemoryRef.current, objective, {
        requestedBy: 'hud',
      }).then((result) => {
        commitAliceMemory(result.memory);
        return result;
      });
    }

    if (operation === 'cancel-learning-plan') {
      const result = createLearningPlannerService().cancelActivePlan(aliceMemoryRef.current, { now });
      commitAliceMemory(result.memory);
      return result;
    }

    if (operation === 'mark-learning-plan-review') {
      const result = createLearningPlannerService().markActivePlanForReview(aliceMemoryRef.current, { now });
      commitAliceMemory(result.memory);
      return result;
    }

    if (operation === 'approve-learning-plan') {
      const result = createLearningPlannerService().approveActivePlan(aliceMemoryRef.current, { now });
      commitAliceMemory(result.memory);
      return result;
    }

    if (operation === 'reject-learning-plan') {
      const result = createLearningPlannerService().rejectActivePlan(aliceMemoryRef.current, { now });
      commitAliceMemory(result.memory);
      return result;
    }

    if (operation === 'add-goal') {
      const goalResult = createAutonomousLearningGoalFromText(payload.goal || payload.text || '', {
        now,
        source: 'hud',
      });
      if (!goalResult.ok) {
        return;
      }
      const currentLearning = getAutonomousLearningMemoryState(aliceMemoryRef.current);
      const nextLearning = upsertAutonomousLearningGoal({
        ...currentLearning,
        stats: {
          ...(currentLearning.stats || {}),
          goalsCreated: Number(currentLearning.stats?.goalsCreated || 0) + 1,
        },
        auditLog: [
          ...(currentLearning.auditLog || []),
          {
            id: `learning-goal-added-${Date.parse(now)}`,
            timestamp: now,
            type: 'learning_goal_added',
            summary: goalResult.goal.broad
              ? `Objetivo amplo registrado com ${goalResult.goal.stages.length} etapas.`
              : 'Objetivo de aprendizado registrado.',
            reason: goalResult.reason,
            metadata: {
              goalId: goalResult.goal.goalId,
              stages: goalResult.goal.stages.map((stage) => stage.type),
            },
          },
        ].slice(-120),
      }, goalResult.goal);
      commitAliceMemory(updateAutonomousLearningMemoryState(aliceMemoryRef.current, nextLearning, { now }));
      void runStartupAutonomousLearningLoop({ startup: false, dryRun: payload.dryRun ?? null });
      return;
    }

    if (operation === 'enable' || operation === 'disable') {
      const currentLearning = getAutonomousLearningMemoryState(aliceMemoryRef.current);
      commitAliceMemory(updateAutonomousLearningMemoryState(aliceMemoryRef.current, {
        ...currentLearning,
        enabled: operation === 'enable',
        policy: {
          ...currentLearning.policy,
          enabled: operation === 'enable',
        },
        auditLog: [
          ...(currentLearning.auditLog || []),
          {
            id: `learning-${operation}-${Date.parse(now)}`,
            timestamp: now,
            type: `learning_${operation}`,
            summary: operation === 'enable'
              ? 'Aprendizado autonomo ligado pelo HUD.'
              : 'Aprendizado autonomo pausado pelo HUD.',
            reason: `hud_${operation}`,
          },
        ].slice(-120),
      }, { now }));
      return;
    }

    if (operation === 'clear-test-learning') {
      const result = clearAutonomousLearningTestData(aliceMemoryRef.current, { now });
      commitAliceMemory(result.memory);
      return;
    }

    if (operation === 'run-once' || operation === 'dry-run') {
      void runStartupAutonomousLearningLoop({
        startup: false,
        dryRun: operation === 'dry-run' ? true : payload.dryRun ?? null,
      });
    }
  };

  const createLiveOrchestrator = (url) =>
    new LiveSessionOrchestrator({
      buildSetup: ({ resumptionHandle = '', memoryPrefixTurns = [] }) =>
        createAliceLiveSetup({ resumptionHandle, memoryPrefixTurns }),
      createSession: ({
        setup,
        onEvent,
        onStatus,
        onGoAway,
        onSessionResumptionUpdate,
        onCloseReason,
        onError,
      }) =>
        new GeminiLiveSession({
          url,
          setup,
          onEvent,
          onStatus,
          onGoAway,
          onSessionResumptionUpdate,
          onCloseReason,
          onError,
        }),
      getMemoryPrefixTurns: async ({ mode } = {}) => buildLiveMemoryPrefixTurns({ mode }),
      onEvent: handleLiveEvent,
      onStatus: (nextStatus) => {
        if (nextStatus !== 'idle') {
          dispatchUi({ type: 'session-live-status', status: nextStatus });
        }

        if (nextStatus === 'error') {
          stopStreamingPipelines();
          liveSessionRef.current = null;
        }
      },
      onGoAway: (goAway) => {
        noteDiagnostic({ type: 'go-away', timeLeft: goAway?.timeLeft || '' });
      },
      onError: (sessionError) => {
        noteDiagnostic({
          type: 'error',
          message: sessionError.message || 'Nao foi possivel manter a sessao Live.',
        });
        dispatchUi({
          type: 'session-error',
          error: sessionError.message || 'Nao foi possivel manter a sessao Live.',
        });
      },
      onPrepareReconnect: async ({ mode }) => {
        liveTransportRef.current.beginReconnect({
          preserveActiveSession: mode === 'resume',
        });
        noteDiagnostic({ type: 'reconnecting' });
        dispatchUi({ type: 'session-reconnecting', mode });
      },
      onSessionReady: async ({ session, mode, generation, resumed, rehydrated }) => {
        liveTransportRef.current.activateSession({
          session,
          generation,
          replayPendingToolResponses: resumed,
          preserveAcceptedToolResponseGenerations: resumed,
        });
        liveSessionRef.current = session;
        restartStreamingPipelines(generation);
        noteDiagnostic({ type: 'connected' });
        if (resumed) {
          noteDiagnostic({ type: 'session-resumed' });
        } else if (rehydrated) {
          noteDiagnostic({ type: 'session-rehydrated' });
        }
        dispatchUi({
          type: 'session-ready',
          mode,
          resumed,
          rehydrated,
          caption: readyCaption,
        });

        if (mode === 'fresh' && liveTransportRef.current.canSendToLive(generation)) {
          session.sendText(readyCheckPrompt);
        }
      },
      onCloseReason: (reason, _event, session) => {
        liveTransportRef.current.deactivateSession(session);
        if (reason !== LIVE_CLOSE_REASONS.manualStop) {
          noteDiagnostic({ type: 'close-reason', reason });
        }
      },
      onSessionResumptionUpdate: () => {
        noteDiagnostic({ type: 'resumption-updated' });
      },
    });

  const enqueueToolCalls = (toolCalls, generation) => {
    toolQueueRef.current = toolCalls.reduce(
      (queue, functionCall) => queue.then(() => executeLocalToolCall(functionCall, generation)),
      toolQueueRef.current,
    );

    toolQueueRef.current = toolQueueRef.current.catch((toolError) => {
      noteDiagnostic({
        type: 'error',
        message: toolError.message || String(toolError),
      });
    });
  };

  const handleLiveEvent = (event, _message, _session, generation) => {
    noteDiagnostic({
      type: 'server-message',
      outputAudioChunksReceived: event.audioChunks.length,
    });

    if (event.interrupted) {
      outputPlayerRef.current.interrupt();
    }

    event.audioChunks.forEach((chunk) => {
      outputPlayerRef.current.play(chunk);
    });

    if (event.inputTranscript) {
      trustedUtteranceRef.current = appendTrustedUtterance(trustedUtteranceRef.current, event.inputTranscript);
      recordUserInteraction(trustedUtteranceRef.current.text);
      const autonomyPriority = prioritizeUserRequestInAutonomy({
        autonomousState: autonomousLearningStateRef.current,
        trustedUtterance: trustedUtteranceRef.current.text,
      });
      updateAutonomousLearningState(autonomyPriority.state);
      if (canUseTauriRuntime() && autonomyPriority.pausedTaskIds?.length) {
        void Promise.allSettled(
          autonomyPriority.pausedTaskIds.map((taskId) =>
            invoke('cancel_autonomous_task', {
              taskId,
              reason: 'user_request_preemption',
            }),
          ),
        ).then((results) => {
          const cancelledTaskIds = autonomyPriority.pausedTaskIds.filter(
            (_taskId, index) => results[index]?.status === 'fulfilled' && results[index]?.value?.ok !== false,
          );
          const failedTaskIds = autonomyPriority.pausedTaskIds.filter(
            (taskId) => !cancelledTaskIds.includes(taskId),
          );
          const currentAutonomy = autonomousLearningStateRef.current;
          const patchedState = appendAutonomousLog(
            mergeAutonomousLearningState(currentAutonomy, {
              tasks: currentAutonomy.tasks.map((task) =>
                cancelledTaskIds.includes(task.taskId)
                  ? {
                      ...task,
                      status: TASK_STATUSES.CANCELLED,
                      cancelledBy: 'user_request',
                      updatedAt: Date.now(),
                    }
                  : task,
              ),
            }),
            'native_background_cancel_completed',
            {
              taskIds: cancelledTaskIds,
              failedTaskIds,
            },
          );
          updateAutonomousLearningState(patchedState);
        });
      }
      dispatchUi({ type: 'session-input-caption', inputCaption: trustedUtteranceRef.current.text });
    }

    if (event.outputTranscript) {
      outputTranscriptRef.current = event.outputTranscript;
      recordAliceInteraction(event.outputTranscript);
      dispatchUi({ type: 'session-caption', caption: event.outputTranscript });
      rememberAliceContext({ outputTranscript: event.outputTranscript });
    }

    if (event.toolCallCancellation) {
      liveTransportRef.current.cancelPendingToolResponses(event.toolCallCancellation.ids || []);
      noteDiagnostic({
        type: 'error',
        message: 'A Gemini cancelou uma chamada de ferramenta pendente.',
      });
    }

    if (event.toolCalls.length > 0) {
      enqueueToolCalls(event.toolCalls, generation);
    }
  };

  const stopLiveSession = async () => {
    await liveOrchestratorRef.current?.stopLiveSession();
    await flushAliceMemory().catch(() => {
      // Ignore persistence errors during shutdown to keep stop responsive.
    });
    releaseLiveResources();
    dispatchUi({ type: 'session-stopped' });
  };

  const startLiveSession = async () => {
    if (liveOrchestratorRef.current || screenStreamRef.current || voiceStreamRef.current) {
      await stopLiveSession();
    }

    dispatchUi({ type: 'session-starting' });
    noteDiagnostic({ type: 'connecting' });

    try {
      if (!canUseTauriRuntime()) {
        throw new Error('Abra pelo aplicativo desktop da Alice para usar a chave do ambiente.');
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: SCREEN_SHARE_VIDEO_CONSTRAINTS,
        audio: false,
      });
      const voiceStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      screenStreamRef.current = screenStream;
      voiceStreamRef.current = voiceStream;
      const screenTrack = screenStream.getVideoTracks()[0];
      const screenSettings = screenTrack?.getSettings?.() || {};
      noteDiagnostic({
        type: 'screen-started',
        label: screenTrack?.label || '',
        displaySurface: screenSettings.displaySurface || '',
      });
      noteDiagnostic({ type: 'microphone-started' });
      videoRef.current.srcObject = screenStream;
      await videoRef.current.play();

      screenStream.getVideoTracks()[0]?.addEventListener('ended', stopLiveSession, { once: true });

      const liveAccess = await invoke('create_gemini_live_url');
      const liveOrchestrator = createLiveOrchestrator(liveAccess.url);

      liveTransportRef.current.clear();
      liveOrchestratorRef.current = liveOrchestrator;
      await liveOrchestrator.startLiveSession();
    } catch (sessionError) {
      await liveOrchestratorRef.current?.stopLiveSession();
      releaseLiveResources();
      noteDiagnostic({ type: 'error' });
      dispatchUi({
        type: 'session-error',
        error: sessionError.message || 'Nao foi possivel iniciar a sessao Live.',
        caption: 'Nao consegui abrir a sessao ainda.',
      });
    }
  };

  const toggleLiveSession = () => {
    if (status === 'connected' || status === 'configuring' || status === 'starting' || status === 'reconnecting') {
      void stopLiveSession();
      return;
    }

    void startLiveSession();
  };

  useEffect(() => {
    let disposed = false;
    const runtimeDetected = isTauriRuntime();

    void loadAliceMemoryFromRuntime().then((memory) => {
        if (!disposed) {
          let diagnosticMemory = appendRunnerAppDiagnostic(memory, {
            type: 'app_runtime_loaded',
            summary: runtimeDetected
              ? 'App da Alice detectou runtime Tauri.'
              : 'App da Alice confirmou runtime Tauri via invoke.',
            reason: runtimeDetected ? 'tauri_runtime_detected' : 'tauri_invoke_confirmed',
            metadata: {
              ...createTauriRuntimeMetadata(),
              runtimeDetected,
            },
          });
          diagnosticMemory = appendRunnerAppDiagnostic(diagnosticMemory, {
            type: 'memory_hydrated',
            summary: 'Memoria da Alice hidratada no app.',
            reason: 'load_alice_memory_json_completed',
            metadata: createRunnerDiagnosticSnapshot(diagnosticMemory),
          });
          aliceMemoryRef.current = diagnosticMemory;
          setActiveMindMap(getActiveMindMap(diagnosticMemory));
          setMindMapRevision((current) => current + 1);
          const hydratedAutonomy = hydrateAutonomousStateFromAudit(diagnosticMemory.autonomousAudit);
          autonomousLearningStateRef.current = hydratedAutonomy;
          setAutonomousLearningState(hydratedAutonomy);
          memoryHydratedRef.current = true;
          updatePersistenceDiagnostics();
          scheduleAliceMemorySave();
        }
      })
      .catch((loadError) => {
        memoryHydratedRef.current = true;
        runnerDiagnosticsRef.current.nonTauriBypass = true;
        // Browser-only previews cannot persist diagnostics, but this console line helps local debugging.
        console.info('[AliceRunner] app_runtime_not_tauri', {
          ...createTauriRuntimeMetadata(),
          message: loadError?.message || String(loadError),
        });
      });

    return () => {
      disposed = true;
      if (memorySaveTimerRef.current) {
        window.clearTimeout(memorySaveTimerRef.current);
        memorySaveTimerRef.current = null;
      }
      if (canUseTauriRuntime() && memoryHydratedRef.current) {
        void saveAliceMemory(aliceMemoryRef.current)
          .then((memory) => {
            aliceMemoryRef.current = memory;
          })
          .catch(() => {
            // Ignore persistence errors during unmount.
          });
      }
      void liveOrchestratorRef.current?.stopLiveSession();
      microphoneCleanupRef.current?.();
      screenCleanupRef.current?.();
      outputPlayerRef.current?.close();
      stopStream(screenStreamRef.current);
      stopStream(voiceStreamRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!AUTONOMY_RUNTIME_ENABLED) {
      return undefined;
    }

    let disposed = false;

    const clearRunnerTimer = () => {
      if (runnerTimerRef.current) {
        window.clearTimeout(runnerTimerRef.current);
        runnerTimerRef.current = null;
      }
    };

    const scheduleRunnerTick = (delayMs = 5000) => {
      clearRunnerTimer();
      if (memoryHydratedRef.current && !runnerDiagnosticsRef.current.tickScheduled) {
        runnerDiagnosticsRef.current.tickScheduled = true;
        commitRunnerDiagnostic({
          type: 'runner_tick_scheduled',
          summary: 'Tick do Runner agendado pelo app.',
          reason: 'runner_timer_scheduled',
          metadata: {
            delayMs: Math.max(1000, Number(delayMs || 5000)),
            ...createRunnerDiagnosticSnapshot(aliceMemoryRef.current),
          },
        });
      }
      runnerTimerRef.current = window.setTimeout(() => {
        void runRunnerTick();
      }, Math.max(1000, Number(delayMs || 5000)));
    };

    const commitRunnerState = (runner) => {
      if (disposed) {
        return;
      }
      aliceMemoryRef.current = updateAutonomousRunnerState(aliceMemoryRef.current, runner);
      setAutonomousRunnerState(getAutonomousRunnerState(aliceMemoryRef.current));
      scheduleAliceMemorySave();
    };

    const runRunnerTick = async () => {
      if (disposed) {
        return;
      }
      if (!memoryHydratedRef.current) {
        if (!runnerDiagnosticsRef.current.waitingForMemory) {
          runnerDiagnosticsRef.current.waitingForMemory = true;
          console.info('[AliceRunner] runner_tick_waiting_memory');
        }
        scheduleRunnerTick(1000);
        return;
      }
      if (!canUseTauriRuntime()) {
        if (!runnerDiagnosticsRef.current.nonTauriBypass) {
          runnerDiagnosticsRef.current.nonTauriBypass = true;
          console.info('[AliceRunner] runner_tick_bypassed_non_tauri', createTauriRuntimeMetadata());
        }
        scheduleRunnerTick(5000);
        return;
      }
      if (runnerTickRunningRef.current) {
        commitRunnerDiagnostic({
          type: 'runner_tick_skipped',
          summary: 'Tick ignorado porque outro tick ainda esta ativo.',
          reason: 'runner_tick_already_running',
          metadata: createRunnerDiagnosticSnapshot(aliceMemoryRef.current),
        });
        scheduleRunnerTick(1000);
        return;
      }

      runnerTickRunningRef.current = true;
      let nextDelayMs = 5000;
      let learningFollowUpNeeded = false;
      try {
        commitRunnerDiagnostic({
          type: 'runner_tick_started',
          summary: 'Tick do Runner iniciado pelo app.',
          reason: 'runner_tick_started',
          metadata: createRunnerDiagnosticSnapshot(aliceMemoryRef.current),
        });
        const runtimeVmStatus = await invoke('get_local_vm_status')
          .then((result) => result?.artifacts || result)
          .catch(() => autonomousLearningStateRef.current.vm);
        const result = await runAutonomousTaskRunnerTick({
          runner: getAutonomousRunnerState(aliceMemoryRef.current),
          vmStatus: runtimeVmStatus,
          invokeTool: invoke,
          onRunnerStateChange: commitRunnerState,
          nowMs: Date.now(),
        });

        if (!disposed) {
          let nextMemory = updateAutonomousRunnerState(aliceMemoryRef.current, result.runner);
          nextMemory = appendRunnerAppDiagnostic(nextMemory, {
            type: 'runner_tick_completed',
            summary: result.executed
              ? 'Tick do Runner executou uma task.'
              : 'Tick do Runner terminou sem executar task.',
            reason: result.reason || (result.executed ? 'runner_tick_executed' : 'runner_tick_no_execution'),
            metadata: {
              executed: Boolean(result.executed),
              taskId: result.task?.id || '',
              taskStatus: result.task?.status || '',
              nextIntervalMs: result.nextIntervalMs || 0,
              ...createRunnerDiagnosticSnapshot(nextMemory),
            },
          });
          aliceMemoryRef.current = nextMemory;
          setAutonomousRunnerState(getAutonomousRunnerState(aliceMemoryRef.current));
          if (result.task) {
            syncMindMapFromRunnerTask(result.task);
          }
          learningFollowUpNeeded = shouldRunAutonomousLearningAfterRunnerTick({ result });
          if (result.evidencePersistence?.ok === false) {
            updatePersistenceDiagnostics({
              lastRunnerEvidenceError:
                result.evidencePersistence.message ||
                result.evidencePersistence.reason ||
                'Falha ao persistir evidencia do Runner.',
              lastRunnerEvidenceErrorAt: new Date().toISOString(),
            });
          }
          persistRunnerLearningCandidates(result.learningCandidates || []);
          scheduleAliceMemorySave();
          nextDelayMs = result.nextIntervalMs || nextDelayMs;
        }
      } catch (tickError) {
        const message = String(tickError?.message || tickError || 'Falha no tick do Runner.');
        nextDelayMs = 10000;
        if (!disposed) {
          commitRunnerDiagnostic({
            type: 'runner_tick_failed',
            summary: 'Tick do Runner falhou antes de concluir.',
            reason: 'runner_tick_failed',
            metadata: {
              message,
              nextIntervalMs: nextDelayMs,
              ...createRunnerDiagnosticSnapshot(aliceMemoryRef.current),
            },
          });
          updatePersistenceDiagnostics({
            lastError: message,
          });
        }
      } finally {
        runnerTickRunningRef.current = false;
        if (!disposed) {
          if (learningFollowUpNeeded) {
            void runStartupAutonomousLearningLoop({ startup: false })
              .then((learningResult) => {
                if (learningResult?.createdTasks?.length) {
                  setRunnerLoopWakeVersion((current) => current + 1);
                }
              });
          }
          scheduleRunnerTick(nextDelayMs);
        }
      }
    };

    if (memoryHydratedRef.current) {
      void runRunnerTick();
    } else {
      scheduleRunnerTick(2000);
    }

    return () => {
      disposed = true;
      clearRunnerTimer();
    };
    // Runner loop reads refs so it can survive long executions without resubscribing timers.
  }, [runnerLoopWakeVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!AUTONOMY_RUNTIME_ENABLED) {
      return undefined;
    }

    let disposed = false;
    let timer = null;

    const clearTimer = () => {
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const schedulePoll = (delayMs = 3000) => {
      clearTimer();
      timer = window.setTimeout(() => {
        void pollRuntimeHarnessRequests();
      }, Math.max(1000, Number(delayMs || 3000)));
    };

    const clearRuntimeRequests = async (requestIds = []) => {
      await Promise.all(requestIds.map((requestId) =>
        invoke('clear_dev_runtime_request', { requestId }).catch(() => null)));
    };

    const pollRuntimeHarnessRequests = async () => {
      if (disposed) {
        return;
      }
      if (!memoryHydratedRef.current || !canUseTauriRuntime()) {
        schedulePoll(3000);
        return;
      }

      try {
        const requests = await invoke('load_dev_runtime_requests');
        if (Array.isArray(requests) && requests.length > 0) {
          const result = applyRuntimeHarnessRequests(aliceMemoryRef.current, requests, {
            now: new Date().toISOString(),
          });
          const handledRequestIds = [
            ...result.processedRequestIds,
            ...result.ignoredRequestIds,
          ];
          if (handledRequestIds.length > 0) {
            commitAliceMemory(result.memory);
            await clearRuntimeRequests(handledRequestIds);
            commitRunnerDiagnostic({
              type: 'runtime_harness_request',
              summary: 'Pedido dev de runtime processado pelo app.',
              reason: result.taskIds.length
                ? 'runtime_harness_text_input_smoke_enqueued'
                : 'runtime_harness_request_ignored',
              metadata: {
                taskIds: result.taskIds,
                processedRequestIds: result.processedRequestIds,
                ignoredRequestIds: result.ignoredRequestIds,
              },
            });
            if (result.taskIds.length > 0) {
              setRunnerLoopWakeVersion((current) => current + 1);
            }
          }
        }
      } catch (error) {
        updatePersistenceDiagnostics({
          lastError: String(error?.message || error || 'Falha ao ler pedidos dev de runtime.'),
        });
      } finally {
        if (!disposed) {
          schedulePoll(3000);
        }
      }
    };

    schedulePoll(1000);
    return () => {
      disposed = true;
      clearTimer();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isBusy = status === 'starting' || status === 'configuring';
  const isLive = status === 'connected' || status === 'configuring' || status === 'starting' || status === 'reconnecting';
  // Diagnostic-only snapshot: these refs mirror runtime state that should not drive normal rendering.
  /* eslint-disable react-hooks/refs */
  const debugHud = buildDebugHudSnapshot({
    status,
    caption,
    inputCaption,
    diagnostics,
    trustedUtterance: trustedUtteranceRef.current,
    outputTranscript: outputTranscriptRef.current,
    screenGeometry: getScreenCaptureGeometry(),
    memorySummary: aliceMemoryRef.current.recentContextSummary?.summary || '',
    knowledgeState,
    autonomousLearningState,
    autonomousLearningMemoryState: aliceMemoryRef.current.autonomousLearning,
    autonomousOptimizationState: aliceMemoryRef.current.autonomousOptimization,
    procedureReuseIndex: aliceMemoryRef.current.procedureReuseIndex,
    autonomousRunnerState,
    persistenceDiagnostics,
    interactions: debugInteractions,
  });
  /* eslint-enable react-hooks/refs */

  return (
    <main className={`app-shell app-shell--${status}`}>
      <video ref={videoRef} className="screen-preview" muted playsInline />
      <canvas ref={canvasRef} className="capture-canvas" aria-hidden="true" />

      <AliceHud
        activeHudPage={activeHudPage}
        activeMindMap={activeMindMap}
        caption={caption}
        debugHud={debugHud}
        diagnostics={diagnostics}
        error={error}
        inputCaption={inputCaption}
        isBusy={isBusy}
        isLive={isLive}
        mindMapRevision={mindMapRevision}
        onNavigate={setActiveHudPage}
        onAutonomousLearningAction={handleAutonomousLearningAction}
        onMindMapChange={handleMindMapChange}
        onApproveProposal={(proposalId) => void handleImprovementProposalDecision(proposalId, true)}
        onRejectProposal={(proposalId) => void handleImprovementProposalDecision(proposalId, false)}
        onRunnerAction={handleRunnerAction}
        onToggleLiveSession={toggleLiveSession}
        onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
        sessionNotice={sessionNotice}
        sidebarCollapsed={sidebarCollapsed}
        status={status}
        statusLabel={statusCopy[status]}
        autonomousLearningState={autonomousLearningState}
        autonomousRunnerState={autonomousRunnerState}
      />
    </main>
  );
}

export default App;
