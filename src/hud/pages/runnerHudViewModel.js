export const RUNNER_PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const RUNNER_ACTIVE_STATUS_ORDER = {
  running: 0,
  ready: 1,
  waiting_retry: 2,
  planned: 3,
  paused: 4,
  waiting_input: 5,
  blocked: 6,
};

export const RUNNER_TERMINAL_STATUSES = new Set(['done', 'failed', 'cancelled']);

export const RUNNER_EVIDENCE_STATUS_LABELS = {
  ok: 'confirmada',
  partial: 'parcialmente ausente',
  missing: 'ausente',
  unavailable: 'indisponivel',
  not_verified: 'nao verificada',
};

const toMs = (timestamp) => {
  const parsed = Date.parse(timestamp || '');
  return Number.isFinite(parsed) ? parsed : 0;
};

const priorityRank = (priority) => RUNNER_PRIORITY_ORDER[priority] ?? 99;

const statusRank = (status) =>
  RUNNER_TERMINAL_STATUSES.has(status)
    ? 99
    : RUNNER_ACTIVE_STATUS_ORDER[status] ?? 50;

export const isTerminalRunnerTask = (task = {}) =>
  RUNNER_TERMINAL_STATUSES.has(task.status);

export const sortRunnerTasksForHud = (tasks = []) =>
  [...tasks].sort((left, right) =>
    statusRank(left.status) - statusRank(right.status) ||
    priorityRank(left.priority) - priorityRank(right.priority) ||
    Number(left.queueRank || 0) - Number(right.queueRank || 0) ||
    toMs(left.nextRunAt) - toMs(right.nextRunAt) ||
    toMs(left.createdAt) - toMs(right.createdAt) ||
    String(left.id || '').localeCompare(String(right.id || '')),
  );

export const getRunnerQueueMove = (tasks = [], taskId = '', direction = 'up') => {
  const currentTask = tasks.find((task) => task.id === taskId);
  if (!currentTask || isTerminalRunnerTask(currentTask)) {
    return {
      canMove: false,
      queueRank: Number(currentTask?.queueRank || 0),
    };
  }

  const samePriorityTasks = [...tasks]
    .filter((task) => !isTerminalRunnerTask(task) && task.priority === currentTask.priority)
    .sort((left, right) =>
      Number(left.queueRank || 0) - Number(right.queueRank || 0) ||
      toMs(left.createdAt) - toMs(right.createdAt) ||
      String(left.id || '').localeCompare(String(right.id || '')),
    );
  const currentIndex = samePriorityTasks.findIndex((task) => task.id === taskId);
  const targetIndex = direction === 'down' ? currentIndex + 1 : currentIndex - 1;
  const targetTask = samePriorityTasks[targetIndex];

  if (currentIndex < 0 || !targetTask) {
    return {
      canMove: false,
      queueRank: Number(currentTask.queueRank || 0),
    };
  }

  return {
    canMove: true,
    queueRank: Number(targetTask.queueRank || 0),
  };
};

export const getRunnerEvidencePhysicalStatus = (ref = {}) => {
  const status =
    ref?.metadata?.physicalStatus ||
    ref?.metadata?.persistence?.status ||
    'not_verified';
  return RUNNER_EVIDENCE_STATUS_LABELS[status] ? status : 'not_verified';
};

export const formatRunnerEvidencePhysicalStatus = (ref = {}) => {
  const status = getRunnerEvidencePhysicalStatus(ref);
  return RUNNER_EVIDENCE_STATUS_LABELS[status];
};
