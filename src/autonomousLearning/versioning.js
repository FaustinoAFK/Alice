import { normalizeText } from './contracts';
import { appendAutonomousLog, mergeAutonomousLearningState } from './state';

const hashText = (value) => {
  const text = String(value || '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16)}`;
};

const normalizeFiles = (files = []) => {
  if (Array.isArray(files)) {
    return files
      .filter((file) => file?.path)
      .map((file) => ({
        path: normalizeText(file.path),
        content: String(file.content ?? ''),
        contentHash: file.contentHash || hashText(file.content ?? ''),
      }));
  }

  return Object.entries(files).map(([path, content]) => ({
    path: normalizeText(path),
    content: String(content ?? ''),
    contentHash: hashText(content ?? ''),
  }));
};

export const createChangeSnapshot = ({ actionId, files = [], reason = '', now = Date.now() } = {}) => {
  const normalizedFiles = normalizeFiles(files);
  const snapshotId = `snapshot-${normalizeText(actionId) || now}`;

  return {
    snapshotId,
    actionId: normalizeText(actionId),
    reason: normalizeText(reason),
    createdAt: now,
    files: normalizedFiles,
    fileCount: normalizedFiles.length,
    status: 'ready',
  };
};

export const buildDiffSummary = ({ beforeFiles = [], afterFiles = [] } = {}) => {
  const before = new Map(normalizeFiles(beforeFiles).map((file) => [file.path, file]));
  const after = new Map(normalizeFiles(afterFiles).map((file) => [file.path, file]));
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();

  return paths.map((path) => {
    const beforeFile = before.get(path);
    const afterFile = after.get(path);

    if (!beforeFile) {
      return { path, changeType: 'added', beforeHash: '', afterHash: afterFile.contentHash };
    }
    if (!afterFile) {
      return { path, changeType: 'deleted', beforeHash: beforeFile.contentHash, afterHash: '' };
    }
    if (beforeFile.contentHash !== afterFile.contentHash) {
      return {
        path,
        changeType: 'modified',
        beforeHash: beforeFile.contentHash,
        afterHash: afterFile.contentHash,
      };
    }

    return {
      path,
      changeType: 'unchanged',
      beforeHash: beforeFile.contentHash,
      afterHash: afterFile.contentHash,
    };
  });
};

export const createRollbackPlan = ({ snapshot, riskReason = '' } = {}) => ({
  rollbackPlanId: `rollback-${snapshot?.snapshotId || Date.now()}`,
  snapshotId: snapshot?.snapshotId || '',
  actionId: snapshot?.actionId || '',
  riskReason: normalizeText(riskReason),
  filesToRestore: (snapshot?.files || []).map((file) => ({
    path: file.path,
    contentHash: file.contentHash,
  })),
  status: snapshot?.files?.length ? 'ready' : 'empty',
});

export const applyRollbackPlan = ({ snapshot, currentFiles = [], reason = '', now = Date.now() } = {}) => {
  const restoredFiles = (snapshot?.files || []).map((file) => ({
    path: file.path,
    content: file.content,
    contentHash: file.contentHash,
  }));
  const diffBeforeRollback = buildDiffSummary({
    beforeFiles: snapshot?.files || [],
    afterFiles: currentFiles,
  }).filter((entry) => entry.changeType !== 'unchanged');

  return {
    ok: restoredFiles.length > 0,
    rollbackEvent: {
      rollbackId: `rollback-event-${snapshot?.snapshotId || now}`,
      snapshotId: snapshot?.snapshotId || '',
      actionId: snapshot?.actionId || '',
      reason: normalizeText(reason) || 'rollback_requested',
      restoredFiles,
      diffBeforeRollback,
      createdAt: now,
      status: restoredFiles.length > 0 ? 'done' : 'failed',
    },
  };
};

export const recordUnexpectedRiskAndRollback = (
  state,
  { snapshot, currentFiles = [], risk = {}, now = Date.now() } = {},
) => {
  const rollback = applyRollbackPlan({
    snapshot,
    currentFiles,
    reason: risk.reason || 'unexpected_risk_detected',
    now,
  });
  const riskEvent = {
    riskId: `risk-${now}`,
    actionId: snapshot?.actionId || '',
    reason: normalizeText(risk.reason) || 'unexpected_risk_detected',
    level: risk.level || 'high',
    rollbackTriggered: rollback.ok,
    createdAt: now,
  };
  const nextState = mergeAutonomousLearningState(state, {
    risks: [...(state?.risks || []), riskEvent],
    rollbacks: [...(state?.rollbacks || []), rollback.rollbackEvent],
  });

  return appendAutonomousLog(
    nextState,
    'risk_detected_rollback_triggered',
    {
      riskId: riskEvent.riskId,
      rollbackId: rollback.rollbackEvent.rollbackId,
      reason: riskEvent.reason,
    },
    { now },
  );
};
