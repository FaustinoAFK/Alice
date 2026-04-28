import {
  AUTONOMOUS_LIMITS,
  ENVIRONMENT_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  createAutonomousActionRequest,
  getPriorityRank,
  isBackgroundPriority,
  normalizeText,
} from './contracts';
import { evaluateAutonomousPolicy, shouldTaskYieldToUserRequest } from './policies';
import {
  appendAutonomousLog,
  createEmptyAutonomousLearningState,
  mergeAutonomousLearningState,
} from './state';

const createTaskId = (taskType, now) => `${taskType}-${now}`;

const countRunningBy = (tasks, predicate) =>
  tasks.filter((task) => task.status === TASK_STATUSES.RUNNING && predicate(task)).length;

const hasCapacityForTask = (task, tasks, limits = AUTONOMOUS_LIMITS) => {
  if (task.priority === TASK_PRIORITIES.USER_CRITICAL || task.priority === TASK_PRIORITIES.USER_NORMAL) {
    return countRunningBy(tasks, (item) => item.priority === TASK_PRIORITIES.USER_CRITICAL || item.priority === TASK_PRIORITIES.USER_NORMAL) < limits.maxUserTasks;
  }

  if (task.environment === ENVIRONMENT_TYPES.LOCAL_VM_PLAYGROUND || task.environment === ENVIRONMENT_TYPES.LOCAL_WORKSPACE_FALLBACK) {
    return countRunningBy(
      tasks,
      (item) =>
        item.environment === ENVIRONMENT_TYPES.LOCAL_VM_PLAYGROUND ||
        item.environment === ENVIRONMENT_TYPES.LOCAL_WORKSPACE_FALLBACK,
    ) < limits.maxVmTasks;
  }

  if (task.taskType === TASK_TYPES.RESEARCH) {
    return countRunningBy(tasks, (item) => item.taskType === TASK_TYPES.RESEARCH) < limits.maxResearchTasks;
  }

  if (task.taskType === TASK_TYPES.SELF_IMPROVEMENT) {
    return countRunningBy(tasks, (item) => item.taskType === TASK_TYPES.SELF_IMPROVEMENT) < limits.maxSelfImprovementTasks;
  }

  if (isBackgroundPriority(task.priority)) {
    return countRunningBy(tasks, (item) => isBackgroundPriority(item.priority)) < limits.maxBackgroundTasks;
  }

  return true;
};

export const enqueueAutonomousTask = (
  state = createEmptyAutonomousLearningState(),
  input = {},
  { now = Date.now(), userConfirmed = false, realVmAvailable = false } = {},
) => {
  const taskType = input.taskType || input.actionType || TASK_TYPES.USER_REQUEST;
  const actionRequest = createAutonomousActionRequest(
    {
      ...input,
      actionId: input.actionId || createTaskId(taskType, now),
      actionType: taskType,
    },
    { now },
  );
  const policyDecision = evaluateAutonomousPolicy(actionRequest, { now, userConfirmed, realVmAvailable });
  const task = {
    taskId: actionRequest.actionId,
    taskType,
    priority: actionRequest.priority,
    environment: actionRequest.environment,
    status: policyDecision.allowed ? TASK_STATUSES.QUEUED : TASK_STATUSES.BLOCKED,
    reason: normalizeText(actionRequest.reason),
    riskLevel: actionRequest.riskLevel,
    actionRequest,
    policyDecision,
    createdAt: now,
    updatedAt: now,
  };

  let nextState = mergeAutonomousLearningState(state, {
    tasks: [...state.tasks, task],
    policyDecisions: [
      ...(state.policyDecisions || []),
      {
        taskId: task.taskId,
        allowed: policyDecision.allowed,
        reason: policyDecision.reason,
        flags: policyDecision.policyFlags,
        createdAt: now,
      },
    ],
  });
  nextState = appendAutonomousLog(
    nextState,
    policyDecision.allowed ? 'task_created' : 'task_blocked_by_policy',
    {
      taskId: task.taskId,
      taskType,
      reason: policyDecision.reason,
      policyFlags: policyDecision.policyFlags,
    },
    { now },
  );

  if (policyDecision.requiresConfirmation) {
    nextState = mergeAutonomousLearningState(nextState, {
      pendingApprovals: [
        ...nextState.pendingApprovals,
        {
          approvalId: `approval-${task.taskId}`,
          taskId: task.taskId,
          reason: policyDecision.reason,
          createdAt: now,
        },
      ],
    });
  }

  return { state: nextState, task, policyDecision };
};

export const startRunnableTasks = (
  state = createEmptyAutonomousLearningState(),
  { now = Date.now(), limits = AUTONOMOUS_LIMITS } = {},
) => {
  const sortedTasks = [...state.tasks].sort(
    (left, right) =>
      getPriorityRank(left.priority) - getPriorityRank(right.priority) ||
      Number(left.createdAt || 0) - Number(right.createdAt || 0),
  );
  const nextTasks = [...state.tasks];
  const startedTaskIds = [];

  for (const task of sortedTasks) {
    if (task.status !== TASK_STATUSES.QUEUED) {
      continue;
    }

    const currentTask = nextTasks.find((item) => item.taskId === task.taskId);
    if (!currentTask || !hasCapacityForTask(currentTask, nextTasks, limits)) {
      continue;
    }

    currentTask.status = TASK_STATUSES.RUNNING;
    currentTask.updatedAt = now;
    startedTaskIds.push(currentTask.taskId);
  }

  let nextState = mergeAutonomousLearningState(state, {
    tasks: nextTasks,
  });

  if (startedTaskIds.length > 0) {
    nextState = appendAutonomousLog(
      nextState,
      'tasks_started',
      {
        taskIds: startedTaskIds,
      },
      { now },
    );
  }

  return { state: nextState, startedTaskIds };
};

export const pauseBackgroundForUserRequest = (
  state = createEmptyAutonomousLearningState(),
  { userRequest = '', now = Date.now() } = {},
) => {
  const pausedTaskIds = [];
  const nextTasks = state.tasks.map((task) => {
    if (task.status === TASK_STATUSES.RUNNING && shouldTaskYieldToUserRequest(task)) {
      pausedTaskIds.push(task.taskId);
      return {
        ...task,
        status: TASK_STATUSES.PAUSED,
        pausedBy: 'user_request',
        preemptionRequested: true,
        updatedAt: now,
      };
    }

    return task;
  });

  let nextState = mergeAutonomousLearningState(state, {
    tasks: nextTasks,
    lastUserPriorityAt: now,
    pausedBackgroundTaskIds: pausedTaskIds,
  });

  nextState = appendAutonomousLog(
    nextState,
    'user_request_prioritized',
    {
      userRequest: normalizeText(userRequest),
      pausedTaskIds,
    },
    { now },
  );

  return {
    state: nextState,
    pausedTaskIds,
  };
};

export const completeAutonomousTask = (
  state = createEmptyAutonomousLearningState(),
  taskId,
  { status = TASK_STATUSES.DONE, result = null, now = Date.now() } = {},
) => {
  const nextTasks = state.tasks.map((task) =>
    task.taskId === taskId
      ? {
          ...task,
          status,
          result,
          updatedAt: now,
        }
      : task,
  );

  return appendAutonomousLog(
    mergeAutonomousLearningState(state, { tasks: nextTasks }),
    status === TASK_STATUSES.DONE ? 'task_finished' : 'task_failed',
    { taskId, status },
    { now },
  );
};

export const resumePausedBackgroundTasks = (
  state = createEmptyAutonomousLearningState(),
  { now = Date.now() } = {},
) => {
  const resumedTaskIds = [];
  const nextTasks = state.tasks.map((task) => {
    if (task.status === TASK_STATUSES.PAUSED && task.pausedBy === 'user_request') {
      resumedTaskIds.push(task.taskId);
      return {
        ...task,
        status: TASK_STATUSES.QUEUED,
        pausedBy: '',
        updatedAt: now,
      };
    }
    return task;
  });

  return appendAutonomousLog(
    mergeAutonomousLearningState(state, {
      tasks: nextTasks,
      pausedBackgroundTaskIds: [],
    }),
    'background_tasks_resumed',
    { taskIds: resumedTaskIds },
    { now },
  );
};
