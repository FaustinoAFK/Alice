import { getAutonomousRunnerState, updateAutonomousRunnerState } from './aliceMemory';
import { appendAutonomousRunnerAudit } from './autonomousRunnerState';

const normalizeText = (value) => String(value || '').trim();

export const createTauriRuntimeMetadata = (targetWindow = globalThis.window) => ({
  hasTauriInternals: Boolean(targetWindow?.__TAURI_INTERNALS__),
  hasTauri: Boolean(targetWindow?.__TAURI__),
  hasTauriIpc: Boolean(targetWindow?.__TAURI_IPC__),
  userAgent: normalizeText(targetWindow?.navigator?.userAgent).slice(0, 180),
});

export const appendRunnerAppDiagnostic = (
  memory,
  {
    type = 'app_runtime_event',
    summary = '',
    reason = '',
    metadata = {},
    now = new Date().toISOString(),
  } = {},
) =>
  updateAutonomousRunnerState(
    memory,
    (runner) => appendAutonomousRunnerAudit(runner, {
      timestamp: now,
      type,
      summary,
      reason,
      metadata,
    }),
    { now },
  );

export const createRunnerDiagnosticSnapshot = (memory) => {
  const runner = getAutonomousRunnerState(memory);

  return {
    enabled: runner.enabled,
    runnerState: runner.runnerState,
    activeTaskId: runner.activeTaskId || '',
    runnerLockActive: Boolean(runner.runnerLock),
    queueSize: runner.queue.length,
    readyCount: Object.values(runner.tasksById).filter((task) => task.status === 'ready').length,
    runningCount: Object.values(runner.tasksById).filter((task) => task.status === 'running').length,
  };
};
