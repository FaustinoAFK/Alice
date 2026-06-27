import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { ALICE_LIVE_MODEL } from './alice';
import {
  createAliceMemoryPersistenceSnapshot,
  createEmptyAliceMemory,
  extractImportantFacts,
  getActiveMindMap,
  mergeActiveMindMap,
  mergeImportantFacts,
  saveAliceMemory,
} from './aliceMemory';
import {
  flushAliceMemoryToRuntime,
  loadAliceMemoryFromRuntime as loadAliceMemoryFromRuntimeBoundary,
} from './aliceMemoryPersistence';
import { isTauriRuntime } from './tauriRuntime';

const ALICE_MEMORY_SAVE_DELAY_MS = 750;

export function useAliceMemory() {
  const aliceMemoryRef = useRef(createEmptyAliceMemory());
  const memorySaveTimerRef = useRef(null);
  const memoryHydratedRef = useRef(false);
  const tauriRuntimeAvailableRef = useRef(false);
  const persistenceDiagnosticsRef = useRef(
    createAliceMemoryPersistenceSnapshot(createEmptyAliceMemory()),
  );

  const [activeMindMap, setActiveMindMap] = useState(() =>
    getActiveMindMap(createEmptyAliceMemory()),
  );
  const [mindMapRevision, setMindMapRevision] = useState(0);
  const [persistenceDiagnostics, setPersistenceDiagnostics] = useState(() =>
    createAliceMemoryPersistenceSnapshot(createEmptyAliceMemory()),
  );

  const canUseTauriRuntime = () => tauriRuntimeAvailableRef.current || isTauriRuntime();

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

  const loadMemoryFromRuntime = async () => {
    try {
      const memory = await loadAliceMemoryFromRuntimeBoundary({ invokeFn: invoke });
      tauriRuntimeAvailableRef.current = true;
      return memory;
    } catch (loadError) {
      tauriRuntimeAvailableRef.current = false;
      throw loadError;
    }
  };

  const rememberAliceContext = ({ inputTranscript = '', outputTranscript = '' } = {}) => {
    const extractedFacts = extractImportantFacts({
      inputTranscript,
      outputTranscript,
      sessionModel: ALICE_LIVE_MODEL,
    });

    aliceMemoryRef.current = mergeImportantFacts(aliceMemoryRef.current, extractedFacts);
    scheduleAliceMemorySave();
    return aliceMemoryRef.current;
  };

  const handleMindMapChange = (mindMapData) => {
    aliceMemoryRef.current = mergeActiveMindMap(aliceMemoryRef.current, mindMapData);
    setActiveMindMap(getActiveMindMap(aliceMemoryRef.current));
    scheduleAliceMemorySave();
  };

  useEffect(() => {
    let disposed = false;

    void loadMemoryFromRuntime()
      .then((memory) => {
        if (!disposed) {
          aliceMemoryRef.current = memory;
          setActiveMindMap(getActiveMindMap(memory));
          setMindMapRevision((current) => current + 1);
          memoryHydratedRef.current = true;
          updatePersistenceDiagnostics();
          scheduleAliceMemorySave();
        }
      })
      .catch((loadError) => {
        memoryHydratedRef.current = true;
        // Browser-only previews cannot persist diagnostics, but this console line helps local debugging.
        console.info('[Alice] app_runtime_not_tauri', {
          message: loadError?.message || String(loadError),
        });
      });

    return () => {
      disposed = true;
      clearAliceMemorySaveTimer();
      if (canUseTauriRuntime() && memoryHydratedRef.current) {
        void saveAliceMemory(aliceMemoryRef.current)
          .then((memory) => {
            aliceMemoryRef.current = memory;
          })
          .catch(() => {
            // Ignore persistence errors during unmount.
          });
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    aliceMemoryRef,
    activeMindMap,
    mindMapRevision,
    persistenceDiagnostics,
    canUseTauriRuntime,
    clearAliceMemorySaveTimer,
    flushAliceMemory,
    rememberAliceContext,
    handleMindMapChange,
  };
}
