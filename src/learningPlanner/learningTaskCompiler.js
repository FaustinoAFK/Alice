import { enqueueAutonomousRunnerMemoryTask } from '../aliceMemory';
import { normalizeAutonomousRunnerState } from '../autonomousRunnerState';
import {
  sanitizeFolderName,
  validateResolvedFolderTarget,
} from '../filesystem/filesystemNameSanitizer';
import { normalizeArray, normalizeText } from './learningPlannerTypes';
import {
  LEARNING_PLAN_VALIDATION_DECISION,
  validateLearningPlanForExecution,
} from './learningPlanValidator';

export const LEARNING_PLANNER_CREATED_BY = 'learning_planner';

const toSafeIdPart = (value = '', fallback = 'item') =>
  (normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || fallback)
    .slice(0, 80);

const runnerEvidenceKindForLearningEvidence = (evidence = {}, actionKind = '') => {
  if (evidence.kind === 'screenshot' || actionKind === 'visual') {
    return 'visual';
  }
  if (['command_output', 'file_artifact', 'validation_report', 'human_approval'].includes(evidence.kind)) {
    return 'complete';
  }
  return actionKind === 'visual' ? 'visual' : 'complete';
};

const requiredEvidenceTokens = (evidenceItems = []) => {
  const tokens = new Set(['metadata', 'validationResult']);

  evidenceItems.forEach((evidence) => {
    if (evidence.kind === 'command_output') {
      tokens.add('stdout');
      tokens.add('stderr');
    }
    if (evidence.kind === 'screenshot') {
      tokens.add('screenshot');
    }
  });

  return [...tokens].slice(0, 12);
};

const findSkillForTrainingTask = (plan = {}, task = {}) => {
  const taskId = normalizeText(task.taskId || task.id);
  const explicitSkillId = normalizeArray(task.dependsOnSkillIds).map(normalizeText).find(Boolean);

  return normalizeArray(plan.skills).find((skill) => normalizeText(skill.skillId || skill.id) === explicitSkillId) ||
    normalizeArray(plan.skills).find((skill) => normalizeArray(skill.trainingTaskIds).map(normalizeText).includes(taskId)) ||
    normalizeArray(plan.skills)[0] ||
    null;
};

const validationDescriptionForTask = (plan = {}, task = {}) => [
  `Validar aprendizado: ${task.objective || task.title || plan.objective}`,
  ...normalizeArray(plan.objectiveSuccessCriteria),
  ...normalizeArray(plan.validations),
  ...normalizeArray(task.expectedEvidence).map((evidence) => evidence.validationHint || evidence.description),
].map(normalizeText).filter(Boolean).join(' | ');

const compilePracticeCommandArgs = (plan = {}, task = {}) => [
  '-e',
  [
    `console.log(${JSON.stringify(`alice-learning-practice:${plan.planId}:${task.taskId}`)});`,
    `console.log(${JSON.stringify(task.objective || task.title || plan.objective)});`,
  ].join(' '),
];

const folderNameInputForTask = (plan = {}, task = {}, originalTask = {}) =>
  normalizeText(
    originalTask.folder?.displayName ||
    originalTask.folder?.originalName ||
    originalTask.folder?.name ||
    originalTask.target?.displayName ||
    originalTask.target?.originalName ||
    originalTask.target?.name ||
    originalTask.folderName ||
    originalTask.name ||
    task.folder?.displayName ||
    task.target?.displayName ||
    task.objective ||
    task.title ||
    plan.objective,
  );

const createFolderResolution = (plan = {}, task = {}, originalTask = {}) => {
  const originalRequestedName = folderNameInputForTask(plan, task, originalTask);
  const sanitization = sanitizeFolderName(originalRequestedName, {
    fallbackName: `learning-folder-${toSafeIdPart(task.taskId || task.title || plan.planId, 'folder')}`,
  });
  const targetPath = `output/${sanitization.safeName}`;
  const validation = validateResolvedFolderTarget({
    filesystemName: sanitization.safeName,
    targetPath,
  });

  return {
    ok: sanitization.ok && validation.ok,
    originalRequestedName: sanitization.originalName,
    resolvedFilesystemName: sanitization.safeName,
    displayName: sanitization.originalName,
    targetPath,
    sanitizationWarnings: sanitization.warnings,
    changed: sanitization.changed,
    validation,
  };
};

const compileCreateFolderCommandArgs = (folderResolution = {}) => [
  '-e',
  [
    "const fs=require('fs');",
    "const path=require('path');",
    `const resolution=${JSON.stringify(folderResolution)};`,
    "const workspace=process.cwd();",
    "const target=path.resolve(workspace,resolution.targetPath);",
    "if(!target.startsWith(workspace+path.sep)){throw new Error('target_path_outside_workspace');}",
    "fs.mkdirSync(target,{recursive:true});",
    "const folderExists=fs.existsSync(target)&&fs.statSync(target).isDirectory();",
    "const marker=path.join(target,'.alice-folder-created.json');",
    "const evidence={originalRequestedName:resolution.originalRequestedName,resolvedFilesystemName:resolution.resolvedFilesystemName,targetPath:resolution.targetPath,sanitizationWarnings:resolution.sanitizationWarnings,folderExists,validation:{passed:folderExists,reason:folderExists?'folder_exists':'folder_missing'}};",
    "fs.writeFileSync(marker,JSON.stringify(evidence,null,2));",
    "if(!folderExists){throw new Error('folder_missing_after_create');}",
    "console.log(JSON.stringify(evidence));",
  ].join(' '),
];

const compileCreateFolderStep = (plan = {}, task = {}, originalTask = {}) => {
  const folderResolution = createFolderResolution(plan, task, originalTask);
  if (!folderResolution.ok) {
    return {
      ok: false,
      reason: 'unsafe_folder_target',
      folderResolution,
    };
  }

  return {
    ok: true,
    step: {
      id: `learning-step-${toSafeIdPart(task.taskId || task.id || task.title)}`,
      title: task.title || 'Criar pasta controlada',
      description: task.actionSummary || task.objective || plan.objective,
      type: 'file_operation',
      action: {
        kind: 'command',
        command: 'node',
        args: compileCreateFolderCommandArgs(folderResolution),
        environment: 'local_workspace_fallback',
        folderCreate: {
          displayName: folderResolution.displayName,
          filesystemName: folderResolution.resolvedFilesystemName,
          originalRequestedName: folderResolution.originalRequestedName,
          targetPath: folderResolution.targetPath,
          sanitizationWarnings: folderResolution.sanitizationWarnings,
        },
        requestedResources: {
          learningPlanner: {
            planId: plan.planId,
            trainingTaskId: task.taskId,
            folder: {
              displayName: folderResolution.displayName,
              filesystemName: folderResolution.resolvedFilesystemName,
              targetPath: folderResolution.targetPath,
            },
          },
        },
      },
      completionCriteria: {
        type: 'file_exists',
        path: `${folderResolution.targetPath}/.alice-folder-created.json`,
        description: validationDescriptionForTask(plan, task),
      },
      expectedEvidence: {
        kind: 'complete',
        required: ['metadata', 'stdout', 'stderr', 'validationResult', 'folderResolution'],
      },
      retryPolicy: {
        maxAttempts: 1,
        backoff: 'none',
      },
    },
    folderResolution,
  };
};

const compileTrainingTaskStep = (plan = {}, task = {}, originalTask = {}) => {
  if (normalizeText(task.actionKind).toLowerCase() === 'create_folder') {
    return compileCreateFolderStep(plan, task, originalTask);
  }

  const evidenceItems = normalizeArray(task.expectedEvidence);
  const actionKind = normalizeText(task.actionKind).toLowerCase();
  const runnerEvidenceKind = evidenceItems.some((evidence) =>
    runnerEvidenceKindForLearningEvidence(evidence, actionKind) === 'visual')
    ? 'visual'
    : 'complete';

  return {
    ok: true,
    step: {
    id: `learning-step-${toSafeIdPart(task.taskId || task.id || task.title)}`,
    title: task.title || 'Executar treinamento de aprendizado',
    description: task.actionSummary || task.objective || plan.objective,
    type: actionKind === 'visual' ? 'visual' : 'validation',
    action: {
      kind: actionKind === 'visual' ? 'visual' : 'command',
      command: actionKind === 'visual' ? '' : 'node',
      args: actionKind === 'visual' ? [] : compilePracticeCommandArgs(plan, task),
      visualAction: actionKind === 'visual' ? task.actionSummary || task.objective || task.title : '',
      environment: actionKind === 'visual' ? 'real_vm' : 'local_workspace_fallback',
      requestedResources: {
        learningPlanner: {
          planId: plan.planId,
          trainingTaskId: task.taskId,
        },
      },
    },
    completionCriteria: {
      type: actionKind === 'visual' ? 'visual_state' : 'exit_code',
      expected: actionKind === 'visual' ? undefined : 0,
      description: validationDescriptionForTask(plan, task),
    },
    expectedEvidence: {
      kind: runnerEvidenceKind,
      required: requiredEvidenceTokens(evidenceItems),
    },
    retryPolicy: {
      maxAttempts: 1,
      backoff: 'none',
    },
    },
  };
};

export const compileLearningPlanToRunnerTasks = (
  plan = {},
  {
    availableTools,
    allowDestructiveFilesystem = false,
    now = new Date().toISOString(),
  } = {},
) => {
  const validation = validateLearningPlanForExecution(plan, {
    availableTools,
    allowDestructiveFilesystem,
  });

  if (validation.decision !== LEARNING_PLAN_VALIDATION_DECISION.APPROVED) {
    return {
      ok: false,
      reason: validation.reason,
      decision: validation.decision,
      validation,
      tasks: [],
    };
  }

  const normalizedPlan = validation.schema.plan;
  const compiledTaskEntries = [];
  const compileIssues = [];

  normalizeArray(normalizedPlan.trainingTasks).forEach((task, index) => {
    const originalTask = normalizeArray(plan.trainingTasks).find((item) =>
      normalizeText(item.taskId || item.id) === normalizeText(task.taskId)) || task;
    const skill = findSkillForTrainingTask(normalizedPlan, task);
    const skillId = normalizeText(skill?.skillId || skill?.id);
    const runnerTaskId = `learning-plan-${toSafeIdPart(normalizedPlan.planId)}-${toSafeIdPart(task.taskId || index + 1)}`;
    const compiledStep = compileTrainingTaskStep(normalizedPlan, task, originalTask);

    if (!compiledStep.ok) {
      compileIssues.push({
        taskId: task.taskId,
        reason: compiledStep.reason,
        folderResolution: compiledStep.folderResolution || null,
      });
      return;
    }

    compiledTaskEntries.push({
      id: runnerTaskId,
      title: `Aprender: ${task.title}`,
      description: task.objective || normalizedPlan.objective,
      status: 'ready',
      priority: task.risk?.level === 'critical' || task.risk?.level === 'high' ? 'high' : 'medium',
      riskLevel: task.risk?.level || normalizedPlan.risk?.level || 'low',
      allowWorkspaceFallback: task.actionKind !== 'visual',
      requiresRealVm: task.actionKind === 'visual',
      maxAttempts: 1,
      steps: [compiledStep.step],
      plan: {
        summary: normalizedPlan.objective,
        assumptions: [
          'Executar somente pelo Autonomous Task Runner',
          'Conclusao exige evidencia esperada e validacao objetiva',
        ],
        risks: [
          ...normalizeArray(normalizedPlan.blockedActions),
          ...normalizeArray(normalizedPlan.approvalRequirements),
        ],
        validationReport: {
          objectiveSuccessCriteria: normalizeArray(normalizedPlan.objectiveSuccessCriteria),
          validations: normalizeArray(normalizedPlan.validations),
          expectedEvidence: normalizeArray(task.expectedEvidence),
        },
      },
      requestedResources: {
        learningPlanner: {
          learningRequestId: normalizedPlan.requestId,
          learningPlanId: normalizedPlan.planId,
          trainingTaskId: task.taskId,
          skillId,
        },
      },
      metadata: {
        createdBy: LEARNING_PLANNER_CREATED_BY,
        taskType: 'learning_practice',
        learningRequestId: normalizedPlan.requestId,
        learningPlanId: normalizedPlan.planId,
        trainingTaskId: task.taskId,
        skillId,
        testScenario: normalizeText(originalTask.testScenario || plan.testScenario),
        expectedEvidence: normalizeArray(task.expectedEvidence),
        validationCriteria: [
          ...normalizeArray(normalizedPlan.objectiveSuccessCriteria),
          ...normalizeArray(normalizedPlan.validations),
        ],
        folderResolution: compiledStep.folderResolution || null,
        tags: ['learning-planner', skillId, task.actionKind].filter(Boolean),
        createdAt: now,
      },
    });
  });

  if (compileIssues.length > 0) {
    return {
      ok: false,
      reason: 'learning_plan_folder_target_invalid',
      decision: LEARNING_PLAN_VALIDATION_DECISION.BLOCKED,
      validation,
      compileIssues,
      tasks: [],
    };
  }

  return {
    ok: true,
    reason: 'learning_plan_compiled_to_runner_tasks',
    decision: validation.decision,
    validation,
    tasks: compiledTaskEntries,
  };
};

export const enqueueCompiledLearningPlanTasks = (
  existingMemory,
  plan = {},
  options = {},
) => {
  const compiled = compileLearningPlanToRunnerTasks(plan, options);
  if (!compiled.ok) {
    return {
      ...compiled,
      memory: existingMemory,
      taskIds: [],
    };
  }

  const now = options.now || new Date().toISOString();
  const memory = compiled.tasks.reduce(
    (nextMemory, task) => enqueueAutonomousRunnerMemoryTask(nextMemory, task, { now }),
    existingMemory,
  );
  const runner = normalizeAutonomousRunnerState(memory?.autonomousRunner);

  return {
    ...compiled,
    memory,
    runner,
    taskIds: compiled.tasks.map((task) => task.id),
  };
};
