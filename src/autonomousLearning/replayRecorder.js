import { normalizeArray, normalizeText } from './contracts';
import { createVisualContext, createVmVisualAction } from './vmUiModels';

export const createVmVisualReplay = ({
  replayId = '',
  taskId = '',
  objective = '',
  provider = '',
  vmName = '',
  startedAt = Date.now(),
} = {}) => ({
  replayId: normalizeText(replayId) || `vm-visual-replay-${startedAt}`,
  taskId: normalizeText(taskId),
  objective: normalizeText(objective),
  provider: normalizeText(provider),
  vmName: normalizeText(vmName),
  startedAt: Number(startedAt || Date.now()),
  finishedAt: 0,
  status: 'running',
  steps: [],
  artifacts: [],
});

export const appendVmVisualReplayStep = (replay, {
  stepId = '',
  partialObjective = '',
  visualContextBefore = null,
  proposedAction = null,
  decisionResult = null,
  executedAction = null,
  visualContextAfter = null,
  validationResult = null,
  error = null,
  timestamp = Date.now(),
  durationMs = 0,
} = {}) => {
  const current = replay || createVmVisualReplay({ startedAt: timestamp });
  const normalizedStep = {
    stepId: normalizeText(stepId) || `step-${current.steps.length + 1}`,
    timestamp: Number(timestamp || Date.now()),
    partialObjective: normalizeText(partialObjective),
    screenshotBefore: visualContextBefore?.screenshotPath || '',
    visualContextBefore: visualContextBefore ? createVisualContext(visualContextBefore) : null,
    proposedAction: proposedAction ? createVmVisualAction(proposedAction) : null,
    decisionResult: decisionResult && typeof decisionResult === 'object' ? decisionResult : null,
    executedAction: executedAction ? createVmVisualAction(executedAction) : null,
    screenshotAfter: visualContextAfter?.screenshotPath || '',
    visualContextAfter: visualContextAfter ? createVisualContext(visualContextAfter) : null,
    validationResult: validationResult && typeof validationResult === 'object' ? validationResult : null,
    error: error ? normalizeText(error?.message || error) : '',
    durationMs: Math.max(0, Number(durationMs || 0)),
  };

  return {
    ...current,
    steps: [...normalizeArray(current.steps), normalizedStep],
    artifacts: [
      ...normalizeArray(current.artifacts),
      normalizedStep.screenshotBefore,
      normalizedStep.screenshotAfter,
    ].filter(Boolean),
  };
};

export const finishVmVisualReplay = (replay, {
  status = 'done',
  finishedAt = Date.now(),
  error = '',
} = {}) => ({
  ...(replay || createVmVisualReplay({ startedAt: finishedAt })),
  status: normalizeText(status) || 'done',
  finishedAt: Number(finishedAt || Date.now()),
  error: normalizeText(error),
});
