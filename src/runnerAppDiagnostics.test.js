import { describe, expect, it } from 'vitest';
import { createEmptyAliceMemory, enqueueAutonomousRunnerMemoryTask, getAutonomousRunnerState } from './aliceMemory';
import {
  appendRunnerAppDiagnostic,
  createRunnerDiagnosticSnapshot,
  createTauriRuntimeMetadata,
} from './runnerAppDiagnostics';

describe('runner app diagnostics', () => {
  it('records an app diagnostic in the official runner audit', () => {
    const memory = appendRunnerAppDiagnostic(createEmptyAliceMemory(), {
      type: 'memory_hydrated',
      summary: 'Memoria hidratada.',
      reason: 'test',
      metadata: { queueSize: 0 },
      now: '2026-04-29T10:00:00.000Z',
    });
    const audit = getAutonomousRunnerState(memory).audits.at(-1);

    expect(audit).toMatchObject({
      type: 'memory_hydrated',
      summary: 'Memoria hidratada.',
      reason: 'test',
      metadata: { queueSize: 0 },
    });
  });

  it('summarizes runner state without embedding tasks', () => {
    const memory = enqueueAutonomousRunnerMemoryTask(createEmptyAliceMemory(), {
      id: 'diagnostic-task',
      title: 'Diagnostico',
      steps: [
        {
          id: 'diagnostic-step',
          title: 'Step',
          type: 'command',
          action: { kind: 'command', command: 'node' },
          completionCriteria: { type: 'exit_code', expected: 0 },
          expectedEvidence: { kind: 'complete', required: ['metadata'] },
        },
      ],
    });
    const snapshot = createRunnerDiagnosticSnapshot(memory);

    expect(snapshot).toEqual(expect.objectContaining({
      queueSize: 1,
      readyCount: 1,
      runningCount: 0,
    }));
    expect(snapshot.tasksById).toBeUndefined();
  });

  it('captures Tauri runtime detection signals', () => {
    const metadata = createTauriRuntimeMetadata({
      __TAURI_IPC__: () => {},
      navigator: { userAgent: 'AliceTest/1.0' },
    });

    expect(metadata).toMatchObject({
      hasTauriInternals: false,
      hasTauri: false,
      hasTauriIpc: true,
      userAgent: 'AliceTest/1.0',
    });
  });
});
