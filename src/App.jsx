import { invoke } from '@tauri-apps/api/core';
import { useEffect, useReducer, useRef, useState } from 'react';
import { ALICE_LIVE_MODEL, createAliceLiveSetup } from './alice';
import {
  buildMemoryPrefixTurns,
  createEmptyAliceMemory,
  extractImportantFacts,
  getActiveMindMap,
  loadAliceMemory,
  mergeActiveMindMap,
  mergeAutonomousAudit,
  mergeImportantFacts,
  mergeMindMapFromGoal,
  mergeValidatedProcedures,
  saveAliceMemory,
  updateMindMap,
} from './aliceMemory';
import {
  createInitialAppUiState,
  readyCaption,
  reduceAppUiState,
  statusCopy,
} from './appUiState';
import { GeminiLiveSession, LIVE_CLOSE_REASONS } from './geminiLive';
import { calculateRms, decodePcm16Base64, encodePcm16Base64 } from './liveAudio';
import { LiveSessionOrchestrator } from './liveSessionOrchestrator';
import { buildSessionRehydrationTurns } from './liveSessionRehydration';
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
  normalizeVmStatus,
} from './autonomousLearning';
import {
  executeAutonomousLearningFunctionCall,
  prioritizeUserRequestInAutonomy,
} from './autonomousLearningToolExecutor';
import { syncMindMapWithExecution } from './mindMapExecutionSync';
import { AliceHud } from './hud/AliceHud';
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
  const microphoneCleanupRef = useRef(null);
  const screenCleanupRef = useRef(null);
  const outputPlayerRef = useRef(createPcmOutputPlayer());
  const trustedUtteranceRef = useRef(null);
  const outputTranscriptRef = useRef('');
  const toolQueueRef = useRef(Promise.resolve());
  const knowledgeStateRef = useRef(createEmptyKnowledgeState());
  const autonomousLearningStateRef = useRef(createEmptyAutonomousLearningState());
  const debugInteractionsRef = useRef([]);
  const latestConversationInteractionIdRef = useRef('');

  const [uiState, dispatchUi] = useReducer(reduceAppUiState, undefined, createInitialAppUiState);
  const [activeHudPage, setActiveHudPage] = useState('live');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [knowledgeState, setKnowledgeState] = useState(createEmptyKnowledgeState);
  const [autonomousLearningState, setAutonomousLearningState] = useState(createEmptyAutonomousLearningState);
  const [activeMindMap, setActiveMindMap] = useState(() => getActiveMindMap(createEmptyAliceMemory()));
  const [mindMapRevision, setMindMapRevision] = useState(0);
  const [debugInteractions, setDebugInteractions] = useState([]);
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

  const flushAliceMemory = async () => {
    clearAliceMemorySaveTimer();

    if (!window.__TAURI_INTERNALS__) {
      return aliceMemoryRef.current;
    }

    aliceMemoryRef.current = await saveAliceMemory(aliceMemoryRef.current);
    return aliceMemoryRef.current;
  };

  const scheduleAliceMemorySave = () => {
    if (!window.__TAURI_INTERNALS__) {
      return;
    }

    clearAliceMemorySaveTimer();
    memorySaveTimerRef.current = window.setTimeout(() => {
      void flushAliceMemory().catch(() => {
        // Memory persistence should not break the live session flow.
      });
    }, ALICE_MEMORY_SAVE_DELAY_MS);
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
    setKnowledgeState((current) => {
      const nextState = mergeKnowledgeState(current, patch);
      knowledgeStateRef.current = nextState;
      return nextState;
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

  const buildLiveMemoryPrefixTurns = () => [
    ...buildOperationalContextTurns({
      trustedUtterance: trustedUtteranceRef.current,
      outputTranscript: outputTranscriptRef.current,
      memorySummary: aliceMemoryRef.current.recentContextSummary?.summary || '',
      knowledgeState: knowledgeStateRef.current,
      autonomousLearningState: autonomousLearningStateRef.current,
      screenGeometry: getScreenCaptureGeometry(),
    }),
    ...buildMemoryPrefixTurns(aliceMemoryRef.current),
    ...buildSessionRehydrationTurns({
      trustedUtterance: trustedUtteranceRef.current,
      outputTranscript: outputTranscriptRef.current,
    }),
  ];

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

      const autonomousResult = await executeAutonomousLearningFunctionCall({
        functionCall,
        trustedUtterance: trustedUtteranceRef.current?.text || '',
        autonomousState: autonomousLearningStateRef.current,
        activeMindMap: getActiveMindMap(aliceMemoryRef.current),
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
      invokeTool: invoke,
    });

    if (result.handled) {
      updateAutonomousLearningState(result.statePatch);
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
      getMemoryPrefixTurns: async () => buildLiveMemoryPrefixTurns(),
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
        liveTransportRef.current.beginReconnect();
        stopStreamingPipelines();
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
      onCloseReason: (reason) => {
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
      if (window.__TAURI_INTERNALS__ && autonomyPriority.pausedTaskIds?.length) {
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
      if (!window.__TAURI_INTERNALS__) {
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
      noteDiagnostic({ type: 'screen-started' });
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

    if (window.__TAURI_INTERNALS__) {
      void loadAliceMemory().then((memory) => {
        if (!disposed) {
          aliceMemoryRef.current = memory;
          setActiveMindMap(getActiveMindMap(memory));
          setMindMapRevision((current) => current + 1);
          const hydratedAutonomy = hydrateAutonomousStateFromAudit(memory.autonomousAudit);
          autonomousLearningStateRef.current = hydratedAutonomy;
          setAutonomousLearningState(hydratedAutonomy);

          void invoke('get_local_vm_status')
            .then((status) => {
              if (disposed) {
                return;
              }
              const vmStatus = normalizeVmStatus(status?.artifacts || status);
              const refreshedAutonomy = appendAutonomousLog(
                mergeAutonomousLearningState(autonomousLearningStateRef.current, {
                  vm: {
                    ...autonomousLearningStateRef.current.vm,
                    ...vmStatus,
                    lastHealthCheck: Date.now(),
                  },
                }),
                'local_vm_status_refreshed_on_boot',
                {
                  provider: vmStatus.provider || 'none',
                  status: vmStatus.providerStatus || vmStatus.status || 'unknown',
                  guestCommandReady: Boolean(vmStatus.guestCommandReady),
                },
              );
              autonomousLearningStateRef.current = refreshedAutonomy;
              setAutonomousLearningState(refreshedAutonomy);
            })
            .catch(() => {
              // Runtime VM status is diagnostic-only; memory hydration remains usable without it.
            });
        }
      });
    }

    return () => {
      disposed = true;
      if (memorySaveTimerRef.current) {
        window.clearTimeout(memorySaveTimerRef.current);
        memorySaveTimerRef.current = null;
      }
      if (window.__TAURI_INTERNALS__) {
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
  }, []);

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
        onMindMapChange={handleMindMapChange}
        onApproveProposal={(proposalId) => void handleImprovementProposalDecision(proposalId, true)}
        onRejectProposal={(proposalId) => void handleImprovementProposalDecision(proposalId, false)}
        onToggleLiveSession={toggleLiveSession}
        onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
        sessionNotice={sessionNotice}
        sidebarCollapsed={sidebarCollapsed}
        status={status}
        statusLabel={statusCopy[status]}
        autonomousLearningState={autonomousLearningState}
      />
    </main>
  );
}

export default App;
