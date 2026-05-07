# Inventario arquivo por arquivo - parte 2

Este inventario foi gerado por leitura estatica de imports/exports e enriquecido por classificacao de dominio. Dependentes por `invoke(...)` podem nao aparecer como import direto.

## `src/autonomousLearning/appAutomation.js`

- Caminho relativo: `src/autonomousLearning/appAutomation.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `src/autonomousLearning/contracts.js`.
- Principais exports: `AUTOMATION_TARGET_ORDER`, `createAppAutomationStrategy`, `createUiActionRecord`, `planInterfaceRelearning`.
- Principais funcoes/classes/simbolos: `AUTOMATION_TARGET_ORDER`, `createAppAutomationStrategy`, `signalSet`, `selectedMode`, `createUiActionRecord`, `selectedStrategy`, `planInterfaceRelearning`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/auditPersistence.js`

- Caminho relativo: `src/autonomousLearning/auditPersistence.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/aliceMemory.js`.
- Quem chama/importa internamente: `src/autonomousLearning/contracts.js`, `src/autonomousLearning/state.js`.
- Principais exports: `createEmptyAutonomousAudit`, `serializeAutonomousStateForAudit`, `hydrateAutonomousStateFromAudit`.
- Principais funcoes/classes/simbolos: `bounded`, `createEmptyAutonomousAudit`, `serializeAutonomousStateForAudit`, `hydrateAutonomousStateFromAudit`, `base`, `latestVm`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/behaviorContext.js`

- Caminho relativo: `src/autonomousLearning/behaviorContext.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousLearning/behaviorContext.test.js`.
- Quem chama/importa internamente: `src/autonomousLearning/contracts.js`, `src/autonomousLearning/vmController.js`, `src/autonomousLearning/../hud/mindMap/utils/mindMapData`.
- Principais exports: `createBehaviorContext`.
- Principais funcoes/classes/simbolos: `createEmptyMindMapSummary`, `createEmptyAutonomousRunnerSummary`, `createBehaviorContext`, `normalizedVmStatus`, `activeParallelTasks`, `pendingImprovementProposals`, `resolvedMindMapSummary`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: `src/autonomousLearning/behaviorContext.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/behaviorContext.test.js`

- Caminho relativo: `src/autonomousLearning/behaviorContext.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/autonomousLearning/behaviorContext.js`, `src/autonomousLearning/state.js`, `src/autonomousLearning/../hud/mindMap/utils/mindMapData`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `context`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/autonomousLearning/behaviorContext.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/centralOrchestrator.js`

- Caminho relativo: `src/autonomousLearning/centralOrchestrator.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `src/autonomousLearning/state.js`, `src/autonomousLearning/taskOrchestrator.js`.
- Principais exports: `routeAutonomousTask`.
- Principais funcoes/classes/simbolos: `routeAutonomousTask`, `queued`, `runnable`, `nextState`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/contracts.js`

- Caminho relativo: `src/autonomousLearning/contracts.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousLearning/actionOrchestrator.js`, `src/autonomousLearning/appAutomation.js`, `src/autonomousLearning/auditPersistence.js`, `src/autonomousLearning/behaviorContext.js`, `src/autonomousLearning/decisionEngine.js`, `src/autonomousLearning/learning.js`, `src/autonomousLearning/localVmProviders.js`, `src/autonomousLearning/localWorkspacePlayground.js`, `src/autonomousLearning/policies.js`, `src/autonomousLearning/projectScanner.js`, `src/autonomousLearning/replayRecorder.js`, `src/autonomousLearning/research.js`, `src/autonomousLearning/selfImprovement.js`, `src/autonomousLearning/state.js`, `src/autonomousLearning/taskOrchestrator.js`, `src/autonomousLearning/turnContext.js` (+6).
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `ENVIRONMENT_TYPES`, `PLAYGROUND_EXECUTION_MODES`, `VM_RESOURCE_MODES`, `VM_PROVIDERS`, `AUTONOMY_LEVELS`, `RISK_LEVELS`, `TASK_PRIORITIES`, `EXECUTION_MODES`, `TASK_STATUSES`, `TASK_TYPES`, `VM_VISUAL_ACTIONS`, `VM_VISUAL_ACTION_SOURCES`, `LEARNING_STATES`, `AUTONOMOUS_LIMITS`, `getPriorityRank`, `isUserPriority`, `isBackgroundPriority`, `isHighRisk` (+5).
- Principais funcoes/classes/simbolos: `ENVIRONMENT_TYPES`, `PLAYGROUND_EXECUTION_MODES`, `VM_RESOURCE_MODES`, `VM_PROVIDERS`, `AUTONOMY_LEVELS`, `RISK_LEVELS`, `TASK_PRIORITIES`, `EXECUTION_MODES`, `TASK_STATUSES`, `TASK_TYPES`, `VM_VISUAL_ACTIONS`, `VM_VISUAL_ACTION_SOURCES`, `LEARNING_STATES`, `AUTONOMOUS_LIMITS`, `ORDERED_PRIORITIES`, `getPriorityRank`, `index`, `isUserPriority`, `isBackgroundPriority`, `isHighRisk` (+5).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: muitos dependentes estaticos.

## `src/autonomousLearning/decisionEngine.js`

- Caminho relativo: `src/autonomousLearning/decisionEngine.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousLearning/decisionEngine.test.js`.
- Quem chama/importa internamente: `src/autonomousLearning/policies.js`, `src/autonomousLearning/contracts.js`.
- Principais exports: `createDecisionEngineInput`.
- Principais funcoes/classes/simbolos: `createDecisionEngineInput`, `request`, `basePolicyDecision`, `mindMapSummary`, `runnerSummary`, `mindMapPolicyFlags`, `runnerPolicyFlags`, `policyDecision`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: `src/autonomousLearning/decisionEngine.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/decisionEngine.test.js`

- Caminho relativo: `src/autonomousLearning/decisionEngine.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/autonomousLearning/decisionEngine.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `decision`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/autonomousLearning/decisionEngine.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/hooks.js`

- Caminho relativo: `src/autonomousLearning/hooks.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `src/autonomousLearning/taskOrchestrator.js`, `src/autonomousLearning/state.js`.
- Principais exports: `runUserPriorityHooks`.
- Principais funcoes/classes/simbolos: `runUserPriorityHooks`, `paused`, `cancelRequests`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/index.js`

- Caminho relativo: `src/autonomousLearning/index.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/App.jsx`, `src/autonomousLearning.test.js`, `src/autonomousLearningToolExecutor.js`, `src/autonomousRunnerPreflight.js`, `src/autonomousTaskRunner.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: nenhum identificado estaticamente.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: muitos dependentes estaticos.

## `src/autonomousLearning/internalState.js`

- Caminho relativo: `src/autonomousLearning/internalState.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `src/autonomousLearning/state.js`.
- Principais exports: `createInternalStateSnapshot`, `attachInternalStateSnapshot`.
- Principais funcoes/classes/simbolos: `createInternalStateSnapshot`, `attachInternalStateSnapshot`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/learning.js`

- Caminho relativo: `src/autonomousLearning/learning.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `src/autonomousLearning/contracts.js`, `src/autonomousLearning/validation.js`.
- Principais exports: `createProcedureCandidate`, `advanceLearningState`, `promoteValidatedProcedure`, `degradeProcedure`, `archiveDeprecatedProcedures`, `pruneOperationalLearning`.
- Principais funcoes/classes/simbolos: `createProcedureCandidate`, `advanceLearningState`, `currentStatus`, `failureCount`, `successCount`, `nextConfidence`, `nextStatus`, `promoteValidatedProcedure`, `degradeProcedure`, `archiveDeprecatedProcedures`, `pruneOperationalLearning`, `originallyDeprecatedProcedureIds`, `degradedProcedures`, `retainedCandidates`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: `src/autonomousLearning.test.js`, `src/autonomousLearning/behaviorContext.test.js`, `src/autonomousLearning/decisionEngine.test.js`, `src/autonomousLearning/vmTextInputDriver.test.js`, `src/autonomousLearningLoop.test.js`, `src/autonomousObservedLearning.test.js`, `src/dev/learningPlannerHarness.test.js`, `src/hud/pages/AutonomousLearningHudPage.test.jsx`, `src/learningPlanner/learningPlanner.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/localVmProviders.js`

- Caminho relativo: `src/autonomousLearning/localVmProviders.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousLearning/vmController.js`.
- Quem chama/importa internamente: `src/autonomousLearning/contracts.js`.
- Principais exports: `VM_CAPABILITY_KEYS`, `VM_PROVIDER_STATUSES`, `LOCAL_VM_PROVIDER_TEMPLATES`, `normalizeProviderCapabilities`, `providerCanExecuteGuestCommand`.
- Principais funcoes/classes/simbolos: `VM_CAPABILITY_KEYS`, `VM_PROVIDER_STATUSES`, `createCapabilities`, `LOCAL_VM_PROVIDER_TEMPLATES`, `normalizeProviderCapabilities`, `provider`, `template`, `capabilities`, `providerCanExecuteGuestCommand`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/localWorkspacePlayground.js`

- Caminho relativo: `src/autonomousLearning/localWorkspacePlayground.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousLearning/actionOrchestrator.js`.
- Quem chama/importa internamente: `src/autonomousLearning/contracts.js`.
- Principais exports: `evaluateLocalWorkspaceResourcePolicy`, `createLocalWorkspacePlan`, `buildWorkspaceSessionState`.
- Principais funcoes/classes/simbolos: `DEFAULT_RESOURCE_POLICY`, `sanitizePathSegment`, `basename`, `parts`, `isSafeRelativeTargetPath`, `text`, `evaluateLocalWorkspaceResourcePolicy`, `requested`, `host`, `caps`, `violations`, `createLocalWorkspacePlan`, `normalizedTaskId`, `directAccessFiles`, `resourceDecision`, `workspacePath`, `copyManifest`, `sourcePath`, `targetPath`, `targetName` (+2).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/policies.js`

- Caminho relativo: `src/autonomousLearning/policies.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousLearning/decisionEngine.js`, `src/autonomousLearning/taskOrchestrator.js`.
- Quem chama/importa internamente: `src/autonomousLearning/contracts.js`.
- Principais exports: `evaluateAutonomousPolicy`, `shouldTaskYieldToUserRequest`.
- Principais funcoes/classes/simbolos: `IMPORTANT_REAL_PC_ACTIONS`, `evaluateAutonomousPolicy`, `request`, `flags`, `shouldPauseBackground`, `touchesFiles`, `importantAction`, `riskNeedsGuard`, `requiresConfirmation`, `shouldTaskYieldToUserRequest`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/projectScanner.js`

- Caminho relativo: `src/autonomousLearning/projectScanner.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `src/autonomousLearning/contracts.js`.
- Principais exports: `classifyFileRisk`, `detectProjectCommands`, `buildProjectContext`, `selectFilesForPlayground`.
- Principais funcoes/classes/simbolos: `SENSITIVE_PATTERNS`, `GENERATED_PATTERNS`, `extensionLanguage`, `lower`, `classifyFileRisk`, `normalizedPath`, `detectProjectCommands`, `commands`, `detectFrameworks`, `deps`, `frameworks`, `buildProjectContext`, `normalizedFiles`, `path`, `risk`, `fileSet`, `has`, `languages`, `selectFilesForPlayground`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/replayRecorder.js`

- Caminho relativo: `src/autonomousLearning/replayRecorder.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousLearning/visualLoop.js`.
- Quem chama/importa internamente: `src/autonomousLearning/contracts.js`, `src/autonomousLearning/vmUiModels.js`.
- Principais exports: `createVmVisualReplay`, `appendVmVisualReplayStep`, `finishVmVisualReplay`.
- Principais funcoes/classes/simbolos: `createVmVisualReplay`, `appendVmVisualReplayStep`, `current`, `normalizedStep`, `finishVmVisualReplay`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/research.js`

- Caminho relativo: `src/autonomousLearning/research.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `src/autonomousLearning/contracts.js`.
- Principais exports: `createResearchPlan`, `shouldStopResearch`, `recordResearchFinding`, `createActionableResearchCycle`.
- Principais funcoes/classes/simbolos: `createResearchPlan`, `limitedCycles`, `limitedSources`, `shouldStopResearch`, `cycleLimit`, `sourceLimit`, `recordResearchFinding`, `createActionableResearchCycle`, `researchPlan`, `findingRecord`, `limitedAlternatives`, `limitedRisks`, `limitedTestPlan`, `actionable`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/selfImprovement.js`

- Caminho relativo: `src/autonomousLearning/selfImprovement.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `src/autonomousLearning/contracts.js`.
- Principais exports: `createImprovementProposal`, `policyAllowsProposalApplication`, `approveImprovementProposal`.
- Principais funcoes/classes/simbolos: `createImprovementProposal`, `policyAllowsProposalApplication`, `approveImprovementProposal`, `policy`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/state.js`

- Caminho relativo: `src/autonomousLearning/state.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousLearning/actionOrchestrator.js`, `src/autonomousLearning/auditPersistence.js`, `src/autonomousLearning/behaviorContext.test.js`, `src/autonomousLearning/centralOrchestrator.js`, `src/autonomousLearning/hooks.js`, `src/autonomousLearning/internalState.js`, `src/autonomousLearning/taskOrchestrator.js`, `src/autonomousLearning/versioning.js`.
- Quem chama/importa internamente: `src/autonomousLearning/contracts.js`.
- Principais exports: `createEmptyAutonomousLearningState`, `appendAutonomousLog`, `mergeAutonomousLearningState`, `summarizeAutonomousState`.
- Principais funcoes/classes/simbolos: `bounded`, `createEmptyAutonomousLearningState`, `appendAutonomousLog`, `mergeAutonomousLearningState`, `summarizeAutonomousState`, `runningTasks`, `pausedTasks`, `queuedTasks`, `latestRisk`, `latestRollback`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: muitos dependentes estaticos.

## `src/autonomousLearning/taskOrchestrator.js`

- Caminho relativo: `src/autonomousLearning/taskOrchestrator.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousLearning/centralOrchestrator.js`, `src/autonomousLearning/hooks.js`.
- Quem chama/importa internamente: `src/autonomousLearning/contracts.js`, `src/autonomousLearning/policies.js`, `src/autonomousLearning/state.js`.
- Principais exports: `enqueueAutonomousTask`, `startRunnableTasks`, `pauseBackgroundForUserRequest`, `completeAutonomousTask`, `resumePausedBackgroundTasks`.
- Principais funcoes/classes/simbolos: `createTaskId`, `countRunningBy`, `hasCapacityForTask`, `enqueueAutonomousTask`, `taskType`, `actionRequest`, `policyDecision`, `task`, `startRunnableTasks`, `sortedTasks`, `nextTasks`, `startedTaskIds`, `currentTask`, `pauseBackgroundForUserRequest`, `pausedTaskIds`, `completeAutonomousTask`, `resumePausedBackgroundTasks`, `resumedTaskIds`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/turnContext.js`

- Caminho relativo: `src/autonomousLearning/turnContext.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `src/autonomousLearning/contracts.js`.
- Principais exports: `createTurnContext`.
- Principais funcoes/classes/simbolos: `createTurnContext`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/validation.js`

- Caminho relativo: `src/autonomousLearning/validation.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousLearning/learning.js`.
- Quem chama/importa internamente: `src/autonomousLearning/contracts.js`.
- Principais exports: `VALIDATION_CHECK_TYPES`, `createValidationCheck`, `evaluateValidationReport`, `validationAllowsLearningPromotion`, `ResultChecker`, `ImpactChecker`, `RegressionChecker`, `PerformanceChecker`, `QualityChecker`, `EnvironmentCompatibilityChecker`, `calculateSolutionScore`, `evaluateValidationPipeline`, `ValidationReport`, `ValidationPipeline`, `SolutionScore`.
- Principais funcoes/classes/simbolos: `SUBSTANTIVE_CHECK_TYPES`, `VALIDATION_CHECK_TYPES`, `createValidationCheck`, `evaluateValidationReport`, `normalizedChecks`, `substantiveChecks`, `failedChecks`, `hasOnlyNoErrorSignal`, `missingEvidence`, `passed`, `validationAllowsLearningPromotion`, `countPassed`, `buildChecker`, `scopedChecks`, `ResultChecker`, `ImpactChecker`, `RegressionChecker`, `PerformanceChecker`, `QualityChecker`, `EnvironmentCompatibilityChecker` (+16).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/versioning.js`

- Caminho relativo: `src/autonomousLearning/versioning.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `src/autonomousLearning/contracts.js`, `src/autonomousLearning/state.js`.
- Principais exports: `createChangeSnapshot`, `buildDiffSummary`, `createRollbackPlan`, `applyRollbackPlan`, `recordUnexpectedRiskAndRollback`.
- Principais funcoes/classes/simbolos: `hashText`, `text`, `normalizeFiles`, `createChangeSnapshot`, `normalizedFiles`, `snapshotId`, `buildDiffSummary`, `before`, `after`, `paths`, `beforeFile`, `afterFile`, `createRollbackPlan`, `applyRollbackPlan`, `restoredFiles`, `diffBeforeRollback`, `recordUnexpectedRiskAndRollback`, `rollback`, `riskEvent`, `nextState`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/visualLoop.js`

- Caminho relativo: `src/autonomousLearning/visualLoop.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `src/autonomousLearning/contracts.js`, `src/autonomousLearning/replayRecorder.js`, `src/autonomousLearning/vmUiModels.js`.
- Principais exports: `runVmVisualLoop`.
- Principais funcoes/classes/simbolos: `DEFAULT_MAX_STEPS`, `DEFAULT_TOTAL_TIMEOUT_MS`, `runVmVisualLoop`, `startedAt`, `proposedAction`, `decisionResult`, `actionStartedAt`, `actionResult`, `visualContextAfter`, `validationResult`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/vmController.js`

- Caminho relativo: `src/autonomousLearning/vmController.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousLearning/actionOrchestrator.js`, `src/autonomousLearning/behaviorContext.js`.
- Quem chama/importa internamente: `src/autonomousLearning/contracts.js`, `src/autonomousLearning/localVmProviders.js`.
- Principais exports: `createEmptyVmStatus`, `normalizeVmStatus`, `buildRealVmSessionState`, `selectPlaygroundExecution`.
- Principais funcoes/classes/simbolos: `createEmptyVmStatus`, `normalizeVmStatus`, `providers`, `configuredProvider`, `readyProvider`, `providerName`, `realVmAvailable`, `guestCommandReady`, `buildRealVmSessionState`, `normalizedStatus`, `selectPlaygroundExecution`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/vmOperationalTask.js`

- Caminho relativo: `src/autonomousLearning/vmOperationalTask.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `src/autonomousLearning/contracts.js`.
- Principais exports: `extractVmTextToType`, `resolveVmApp`, `requiresElevatedVmInstall`, `inferVmOperationalTaskKind`, `createVmOperationalTaskPlan`.
- Principais funcoes/classes/simbolos: `APP_CATALOG`, `INSTALL_WORDS`, `OPEN_WORDS`, `ELEVATION_WORDS`, `ELEVATED_WINGET_IDS`, `slug`, `includesAny`, `requiresElevatedVmAction`, `text`, `cleanTextToType`, `extractVmTextToType`, `providedText`, `match`, `resolveVmApp`, `requiresElevatedVmInstall`, `inferVmOperationalTaskKind`, `normalizedKind`, `createVmOperationalTaskPlan`, `normalizedObjective`, `kind` (+8).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/vmTextInputDriver.js`

- Caminho relativo: `src/autonomousLearning/vmTextInputDriver.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousLearning/vmTextInputDriver.test.js`, `src/autonomousLearningPlanner.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `buildNotepadControlledTextInputScript`.
- Principais funcoes/classes/simbolos: `quotePowerShellString`, `normalizeText`, `buildNotepadControlledTextInputScript`, `safeFileName`, `AliceVmWindow`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: `src/autonomousLearning/vmTextInputDriver.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/vmTextInputDriver.test.js`

- Caminho relativo: `src/autonomousLearning/vmTextInputDriver.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/autonomousLearning/../autonomousRunnerTextInputDiagnostics`, `src/autonomousLearning/../autonomousRunnerValidation`, `src/autonomousLearning/vmTextInputDriver.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `script`, `expectedText`, `diagnostics`, `validation`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/autonomousLearning/vmTextInputDriver.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearning/vmUiModels.js`

- Caminho relativo: `src/autonomousLearning/vmUiModels.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousLearning/replayRecorder.js`, `src/autonomousLearning/visualLoop.js`.
- Quem chama/importa internamente: `src/autonomousLearning/contracts.js`.
- Principais exports: `createDetectedElement`, `createVisualContext`, `createVmVisualAction`, `validateVmVisualActionProposal`.
- Principais funcoes/classes/simbolos: `DEFAULT_BOUNDS`, `createDetectedElement`, `createVisualContext`, `createVmVisualAction`, `validateVmVisualActionProposal`, `action`, `allowedActions`, `hasCoordinates`, `repeatedCount`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearningGoals.js`

- Caminho relativo: `src/autonomousLearningGoals.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/App.jsx`, `src/aliceMemory.js`, `src/autonomousCapabilityScanner.js`, `src/autonomousLearningLoop.test.js`, `src/autonomousObservedLearning.js`.
- Quem chama/importa internamente: `src/autonomousExperimentStrategies.js`.
- Principais exports: `createAutonomousLearningGoalFromText`, `normalizeAutonomousLearningGoal`, `createGapsFromLearningGoals`, `upsertAutonomousLearningGoal`.
- Principais funcoes/classes/simbolos: `normalizeText`, `stripDiacritics`, `normalizeLower`, `normalizeArray`, `MAX_LEARNING_GOALS`, `toSafeIdPart`, `stageTemplates`, `defaultStageOrder`, `broadComputerStageOrder`, `addUnique`, `buildObservedTargetContext`, `label`, `kind`, `stageOrderForGoal`, `lower`, `stages`, `mentionsComputerCurriculum`, `mentionsWebsite`, `mentionsComplexOperation`, `mentionsInputFlow` (+25).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: muitos dependentes estaticos.

## `src/autonomousLearningLoop.js`

- Caminho relativo: `src/autonomousLearningLoop.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/App.jsx`, `src/autonomousLearningLoop.test.js`.
- Quem chama/importa internamente: `src/aliceMemory.js`, `src/autonomousCapabilityScanner.js`, `src/autonomousLearningPolicy.js`, `src/autonomousLearningPlanner.js`, `src/autonomousLearningValidator.js`, `src/autonomousProcedurePromoter.js`, `src/autonomousProcedureReuseEngine.js`, `src/autonomousProcedureOptimizer.js`, `src/autonomousProcedureVersioning.js`, `src/autonomousReuseIndex.js`, `src/autonomousRunnerState.js`.
- Principais exports: `isRunnerSafeForAutonomousLearning`, `shouldRunAutonomousLearningAfterRunnerTick`, `runAutonomousLearningLoop`, `clearAutonomousLearningTestData`, `clearAutonomousLearnedData`.
- Principais funcoes/classes/simbolos: `TERMINAL_TASK_STATUSES`, `normalizeArray`, `normalizeText`, `createdBySet`, `learnedSourceSet`, `isLearnedProcedure`, `procedureId`, `source`, `isRunnerSafeForAutonomousLearning`, `normalizedRunner`, `issues`, `appendLearningAudit`, `activeLoopTasks`, `isTerminalExperimentRecord`, `terminalUnprocessedTasksByCreatedBy`, `processed`, `terminalUnprocessedLearningTasks`, `terminalUnprocessedReuseTasks`, `terminalUnprocessedOptimizationTasks`, `recentlyRejectedGapIds` (+64).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: `src/autonomousLearningLoop.test.js`.
- Observacoes tecnicas: alto fan-in de dependencias importadas.

## `src/autonomousLearningLoop.test.js`

- Caminho relativo: `src/autonomousLearningLoop.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/aliceMemory.js`, `src/autonomousCapabilityScanner.js`, `src/autonomousLearningGoals.js`, `src/autonomousLearningPlanner.js`, `src/autonomousLearningLoop.js`, `src/autonomousLearningValidator.js`, `src/autonomousProcedurePromoter.js`, `src/autonomousScriptSynthesizer.js`, `src/autonomousLearningPolicy.js`, `src/autonomousProcedureReuseEngine.js`, `src/autonomousProcedureVersioning.js`, `src/autonomousRunnerLease.js`, `src/autonomousRunnerState.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `browserGap`, `appLaunchGap`, `fileManagementGap`, `appInstallGap`, `fieldInteractionGap`, `pageValidationGap`, `completeEvidenceRef`, `result`, `planned`, `runner`, `task`, `lease`, `scan`, `memory`, `goalResult`, `goalGaps`, `legacyGoal`, `stageGap`, `taskId`, `gap` (+52).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/autonomousLearningLoop.test.js`.
- Observacoes tecnicas: alto fan-in de dependencias importadas.

## `src/autonomousLearningPlanner.js`

- Caminho relativo: `src/autonomousLearningPlanner.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousLearningLoop.js`, `src/autonomousLearningLoop.test.js`, `src/autonomousProcedureOptimizer.js`, `src/autonomousProcedureReuseEngine.js`.
- Quem chama/importa internamente: `src/autonomousExperimentStrategies.js`, `src/autonomousLearningPolicy.js`, `src/autonomousScriptSynthesizer.js`, `src/autonomousLearning/vmTextInputDriver.js`.
- Principais exports: `createControlledLearningText`, `createAutonomousLearningTaskForGap`, `createAutonomousReuseTask`, `createAutonomousOptimizationTask`.
- Principais funcoes/classes/simbolos: `COMPLETE_EVIDENCE`, `normalizeText`, `toSafeIdPart`, `taskAttemptBudgetForSteps`, `CONTROLLED_BROWSER_QUERY`, `CONTROLLED_BROWSER_URL`, `VM_POWERSHELL_EXE`, `LEARNING_VM_MARKERS`, `CONTROLLED_UI_TARGETS`, `quotePowerShellString`, `collectGapTargetText`, `context`, `observedTargets`, `resolveControlledUiTarget`, `text`, `summarizeControlledUiTarget`, `stableHash`, `createControlledLearningText`, `token`, `fillControlledTextTemplate` (+59).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousLearningPolicy.js`

- Caminho relativo: `src/autonomousLearningPolicy.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/aliceMemory.js`, `src/autonomousCapabilityScanner.js`, `src/autonomousExperimentStrategies.js`, `src/autonomousLearningLoop.js`, `src/autonomousLearningLoop.test.js`, `src/autonomousLearningPlanner.js`, `src/autonomousLearningValidator.js`, `src/autonomousProcedureOptimizer.js`, `src/autonomousProcedureReuseEngine.js`, `src/autonomousReusePolicy.js`, `src/autonomousRunnerMindMap.js`, `src/autonomousScriptSynthesizer.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `AUTONOMOUS_LEARNING_CREATED_BY`, `AUTONOMOUS_REUSE_CREATED_BY`, `AUTONOMOUS_OPTIMIZER_CREATED_BY`, `DEFAULT_AUTONOMOUS_LEARNING_POLICY`, `normalizeAutonomousLearningPolicy`, `riskWithinThreshold`, `commandOrScriptLooksDestructive`, `actionViolatesAutonomousLearningPolicy`, `countRecentLearningExperiments`, `canStartAutonomousLearningCycle`.
- Principais funcoes/classes/simbolos: `AUTONOMOUS_LEARNING_CREATED_BY`, `AUTONOMOUS_REUSE_CREATED_BY`, `AUTONOMOUS_OPTIMIZER_CREATED_BY`, `DEFAULT_AUTONOMOUS_LEARNING_POLICY`, `RISK_ORDER`, `normalizeText`, `normalizeArray`, `normalizePositiveInteger`, `number`, `normalizeStringArray`, `seen`, `normalizeAutonomousLearningPolicy`, `source`, `defaults`, `riskRank`, `rank`, `riskWithinThreshold`, `commandOrScriptLooksDestructive`, `actionViolatesAutonomousLearningPolicy`, `normalizedPolicy` (+10).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: muitos dependentes estaticos.

## `src/autonomousLearningToolExecutor.js`

- Caminho relativo: `src/autonomousLearningToolExecutor.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Executor das tools de autonomia, VM, snapshots, propostas e aprendizado.
- O que faz: Executor das tools de autonomia, VM, snapshots, propostas e aprendizado. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/App.jsx`, `src/autonomousLearning.test.js`, `src/autonomousRunner.test.js`.
- Quem chama/importa internamente: `src/autonomousLearning/index.js`.
- Principais exports: `AUTONOMOUS_LEARNING_TOOL_NAMES`, `isAutonomousLearningToolName`, `summarizeBackgroundTaskResult`, `executeAutonomousLearningFunctionCall`, `prioritizeUserRequestInAutonomy`.
- Principais funcoes/classes/simbolos: `AUTONOMOUS_LEARNING_TOOL_NAMES`, `isAutonomousLearningToolName`, `normalizeToolString`, `getRuntimeVmStatus`, `status`, `buildDefaultValidationChecks`, `BACKGROUND_FAILURE_STATUSES`, `BACKGROUND_ACTIVE_STATUSES`, `extractBackgroundAgentResult`, `summarizeBackgroundTaskResult`, `agentResult`, `exitCodeValue`, `exitCode`, `exitCodeKnown`, `backgroundTaskId`, `ok`, `vmOperationalLogType`, `isVmGuestAgentElevated`, `artifacts`, `capabilities` (+45).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Pode atualizar memoria/estado e chamar Tauri via invoke conforme tool.
- Nivel de criticidade: critico.
- Risco de alteracao: Alteracao pode quebrar fluxo central ou seguranca; revisar dependentes, testes e efeitos colaterais antes.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: arquivo central; ler fluxo completo antes de alterar, sem teste direto inferido pelo nome.

## `src/autonomousLearningValidator.js`

- Caminho relativo: `src/autonomousLearningValidator.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousLearningLoop.js`, `src/autonomousLearningLoop.test.js`, `src/autonomousReuseValidator.js`.
- Quem chama/importa internamente: `src/autonomousRunnerState.js`, `src/autonomousLearningPolicy.js`.
- Principais exports: `filesFromRunnerEvidenceRefs`, `verifyLearningEvidenceRefs`, `validateLearningExperimentTask`.
- Principais funcoes/classes/simbolos: `normalizeText`, `normalizeArray`, `allowedEvidenceFile`, `fileName`, `filesFromRunnerEvidenceRefs`, `prefix`, `physicalStatusOk`, `status`, `stepValidationPassed`, `isProcedureReuseTask`, `hasSubstantiveReuseValidation`, `isAutonomousLearningTask`, `hasSubstantiveLearningValidation`, `groupRefsByExecutionId`, `executionId`, `verifyLearningEvidenceRefs`, `groups`, `verifications`, `files`, `result` (+9).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousObservedLearning.js`

- Caminho relativo: `src/autonomousObservedLearning.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Frontend/orquestracao.
- Responsabilidade principal: Modulo auxiliar do projeto.
- O que faz: Modulo auxiliar do projeto. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/App.jsx`, `src/autonomousObservedLearning.test.js`.
- Quem chama/importa internamente: `src/aliceMemory.js`, `src/autonomousLearningGoals.js`.
- Principais exports: `isValidObservedLearningLabel`, `clearInvalidObservedLearningTargets`, `detectObservedLearningTargets`, `createObservedLearningGoalText`, `registerObservedLearningTargets`.
- Principais funcoes/classes/simbolos: `normalizeText`, `stripDiacritics`, `normalizeLower`, `normalizeArray`, `OBSERVED_TARGET_REFRESH_INTERVAL_MS`, `toSafeIdPart`, `GENERIC_SCREEN_LABELS`, `hasMeaningfulLetters`, `isValidObservedLearningLabel`, `normalized`, `lower`, `cleanScreenLabel`, `inferApplicationLabelFromWindowTitle`, `cleaned`, `parts`, `inferred`, `normalizeDomain`, `raw`, `schemeMatch`, `browserInternalSchemeMatch` (+29).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/autonomousObservedLearning.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousObservedLearning.test.js`

- Caminho relativo: `src/autonomousObservedLearning.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/aliceMemory.js`, `src/autonomousObservedLearning.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `targets`, `now`, `first`, `second`, `learning`, `text`, `memory`, `result`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/autonomousObservedLearning.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousProcedureBenchmark.js`

- Caminho relativo: `src/autonomousProcedureBenchmark.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousProcedureOptimizer.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `benchmarkProcedureVariant`.
- Principais funcoes/classes/simbolos: `benchmarkProcedureVariant`, `baselineSteps`, `variantSteps`, `baselineSuccess`, `variantSuccess`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousProcedureComposer.js`

- Caminho relativo: `src/autonomousProcedureComposer.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `src/autonomousProcedureMatcher.js`.
- Principais exports: `composeProceduresForNeed`.
- Principais funcoes/classes/simbolos: `normalizeText`, `composeProceduresForNeed`, `text`, `requiredCapabilities`, `parts`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousProcedureMatcher.js`

- Caminho relativo: `src/autonomousProcedureMatcher.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousProcedureComposer.js`, `src/autonomousProcedureReuseEngine.js`.
- Quem chama/importa internamente: `src/autonomousReuseIndex.js`.
- Principais exports: `scoreProcedureMatch`, `matchProceduresForNeed`.
- Principais funcoes/classes/simbolos: `normalizeText`, `normalizeLower`, `normalizeArray`, `capabilityFromNeed`, `text`, `statusScore`, `scoreProcedureMatch`, `neededCapability`, `capabilities`, `reasons`, `confidence`, `matchProceduresForNeed`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousProcedureOptimizer.js`

- Caminho relativo: `src/autonomousProcedureOptimizer.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousLearningLoop.js`, `src/autonomousProcedureOptimizer.test.js`.
- Quem chama/importa internamente: `src/autonomousLearningPlanner.js`, `src/autonomousProcedureBenchmark.js`, `src/autonomousProcedureVariantPlanner.js`, `src/autonomousLearningPolicy.js`.
- Principais exports: `findProcedureOptimizationCandidates`, `planProcedureOptimizationTasks`.
- Principais funcoes/classes/simbolos: `normalizeArray`, `normalizeText`, `TERMINAL_TASK_STATUSES`, `optimizationKey`, `buildExistingOptimizationKeys`, `keys`, `findProcedureOptimizationCandidates`, `planProcedureOptimizationTasks`, `existingKeys`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: `src/autonomousProcedureOptimizer.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousProcedureOptimizer.test.js`

- Caminho relativo: `src/autonomousProcedureOptimizer.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/autonomousProcedureOptimizer.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `procedure`, `firstPlan`, `duplicatePlan`.
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/autonomousProcedureOptimizer.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousProcedurePromoter.js`

- Caminho relativo: `src/autonomousProcedurePromoter.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousLearningLoop.js`, `src/autonomousLearningLoop.test.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `createProcedureCandidateFromValidation`, `promoteLearningValidation`.
- Principais funcoes/classes/simbolos: `normalizeText`, `normalizeArray`, `toProcedureId`, `base`, `procedureMatches`, `inferTaskEnvironments`, `environments`, `validationIsSubstantive`, `createProcedureCandidateFromValidation`, `capability`, `procedureId`, `primaryEnvironment`, `evidenceRefs`, `promoteLearningValidation`, `existingProcedures`, `duplicate`, `nextProcedure`, `nextProcedures`, `previousLearning`, `previousCandidates` (+1).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousProcedureReuseEngine.js`

- Caminho relativo: `src/autonomousProcedureReuseEngine.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousLearningLoop.js`, `src/autonomousLearningLoop.test.js`.
- Quem chama/importa internamente: `src/autonomousLearningPlanner.js`, `src/autonomousLearningPolicy.js`, `src/autonomousProcedureMatcher.js`, `src/autonomousReusePolicy.js`.
- Principais exports: `procedureHasSubstantiveReuseValidation`, `resolveProcedureReuseForGap`.
- Principais funcoes/classes/simbolos: `normalizeArray`, `normalizeText`, `procedureHasSubstantiveReuseValidation`, `reuseAlreadyAttempted`, `gapId`, `targetProcedureId`, `resolveProcedureReuseForGap`, `normalizedPolicy`, `procedures`, `candidates`, `matches`, `policyAllowedMatches`, `reusable`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousProcedureSimplifier.js`

- Caminho relativo: `src/autonomousProcedureSimplifier.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousProcedureVariantPlanner.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `simplifyProcedureSteps`.
- Principais funcoes/classes/simbolos: `normalizeText`, `simplifyProcedureSteps`, `seen`, `key`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousProcedureVariantPlanner.js`

- Caminho relativo: `src/autonomousProcedureVariantPlanner.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousProcedureOptimizer.js`.
- Quem chama/importa internamente: `src/autonomousProcedureSimplifier.js`.
- Principais exports: `planProcedureOptimizationVariants`.
- Principais funcoes/classes/simbolos: `normalizeText`, `toSafeIdPart`, `planProcedureOptimizationVariants`, `steps`, `text`, `variants`, `simplified`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousProcedureVersioning.js`

- Caminho relativo: `src/autonomousProcedureVersioning.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousLearningLoop.js`, `src/autonomousLearningLoop.test.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `createProcedureVariantVersion`.
- Principais funcoes/classes/simbolos: `normalizeText`, `createProcedureVariantVersion`, `currentVersion`, `nextVersion`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousReuseIndex.js`

- Caminho relativo: `src/autonomousReuseIndex.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/aliceMemory.js`, `src/autonomousLearningLoop.js`, `src/autonomousProcedureMatcher.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `inferProcedureCapabilities`, `rebuildProcedureReuseIndex`, `normalizeProcedureReuseIndex`.
- Principais funcoes/classes/simbolos: `normalizeText`, `normalizeLower`, `normalizeArray`, `inferProcedureCapabilities`, `explicit`, `haystack`, `capabilities`, `addToIndex`, `normalizedKey`, `rebuildProcedureReuseIndex`, `index`, `procedureId`, `text`, `normalizeProcedureReuseIndex`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousReusePolicy.js`

- Caminho relativo: `src/autonomousReusePolicy.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousProcedureReuseEngine.js`.
- Quem chama/importa internamente: `src/autonomousLearningPolicy.js`.
- Principais exports: `canReuseProcedureAutomatically`.
- Principais funcoes/classes/simbolos: `sensitiveNeed`, `canReuseProcedureAutomatically`, `normalizedPolicy`, `procedure`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousReuseValidator.js`

- Caminho relativo: `src/autonomousReuseValidator.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Aprendizado/autonomia.
- Responsabilidade principal: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures.
- O que faz: Parte da camada de autonomia/aprendizado governado, politicas, validacao, VM ou procedures. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `src/autonomousLearningValidator.js`.
- Principais exports: `validateProcedureReuseResult`, `applyProcedureReuseOutcome`.
- Principais funcoes/classes/simbolos: `validateProcedureReuseResult`, `verification`, `applyProcedureReuseOutcome`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousRunner.test.js`

- Caminho relativo: `src/autonomousRunner.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/aliceMemory.js`, `src/autonomousRunnerState.js`, `src/autonomousRunnerLease.js`, `src/autonomousRunnerScheduler.js`, `src/autonomousRunnerPreflight.js`, `src/autonomousTaskRunner.js`, `src/autonomousRunnerPlanner.js`, `src/autonomousRunnerRecoveryPlanner.js`, `src/autonomousRunnerMindMap.js`, `src/hud/mindMap/utils/mindMapData.js`, `src/autonomousRunnerToolExecutor.js`, `src/autonomousLearningToolExecutor.js`, `src/autonomousRunnerEvidence.js`, `src/autonomousRunnerValidation.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `executableStep`, `createReadyTask`, `createSuccessfulRunnerInvoke`, `task`, `longExecutionId`, `runner`, `malformedCommand`, `repairedCommand`, `staleCommand`, `result`, `taskResult`, `stepResult`, `lease`, `heartbeat`, `recovered`, `preflight`, `calls`, `smokeStep`, `verifyCall`, `step` (+35).
- Principais estados/dados manipulados: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/autonomousRunner.test.js`.
- Observacoes tecnicas: alto fan-in de dependencias importadas.

## `src/autonomousRunnerEvidence.js`

- Caminho relativo: `src/autonomousRunnerEvidence.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Autonomous Task Runner.
- Responsabilidade principal: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico.
- O que faz: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico. Manipula principalmente: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Quando e usado: Quando tasks sao enfileiradas, exibidas ou executadas pelo timer/harness/tool.
- Quem chama/importa: `src/autonomousRunner.test.js`, `src/autonomousTaskRunner.js`.
- Quem chama/importa internamente: `uuid`, `src/autonomousRunnerState.js`, `src/autonomousRunnerTextInputDiagnostics.js`.
- Principais exports: `RUNNER_PHYSICAL_EVIDENCE_STATUS`, `createRunnerExecutionId`, `createRunnerEvidenceRef`, `buildRunnerEvidenceFromExecution`, `applyRunnerEvidencePersistenceMetadata`, `summarizeRunnerEvidencePhysicalStatus`, `attachRunnerEvidenceRefs`, `applyRunnerEvidenceRetention`.
- Principais funcoes/classes/simbolos: `normalizeText`, `truncatePreview`, `hashText`, `safeEvidenceSegment`, `normalized`, `suffix`, `requiredEvidenceIncludes`, `parseFolderEvidenceFromOutput`, `lines`, `parsed`, `getEvidenceOutput`, `agentResult`, `RUNNER_PHYSICAL_EVIDENCE_STATUS`, `createRunnerExecutionId`, `createRunnerEvidenceRef`, `buildRunnerEvidenceFromExecution`, `artifacts`, `basePath`, `kind`, `refs` (+24).
- Principais estados/dados manipulados: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: alto.
- Risco de alteracao: Alteracao pode afetar runtime, persistencia, build ou execucao sensivel; exige testes direcionados.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: sem teste direto inferido pelo nome.

## `src/autonomousRunnerExecutor.js`

- Caminho relativo: `src/autonomousRunnerExecutor.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Autonomous Task Runner.
- Responsabilidade principal: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico.
- O que faz: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico. Manipula principalmente: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Quando e usado: Quando tasks sao enfileiradas, exibidas ou executadas pelo timer/harness/tool.
- Quem chama/importa: `src/autonomousTaskRunner.js`.
- Quem chama/importa internamente: `src/autonomousRunnerState.js`.
- Principais exports: `executeAutonomousRunnerStep`.
- Principais funcoes/classes/simbolos: `normalizeText`, `buildCommandRequest`, `executeAutonomousRunnerStep`, `timeoutMs`, `startedAt`, `nativeResult`.
- Principais estados/dados manipulados: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Efeitos colaterais: Pode atualizar memoria/estado e chamar Tauri via invoke conforme tool.
- Nivel de criticidade: alto.
- Risco de alteracao: Alteracao pode afetar runtime, persistencia, build ou execucao sensivel; exige testes direcionados.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: sem teste direto inferido pelo nome.

## `src/autonomousRunnerLease.js`

- Caminho relativo: `src/autonomousRunnerLease.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Autonomous Task Runner.
- Responsabilidade principal: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico.
- O que faz: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico. Manipula principalmente: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Quando e usado: Quando tasks sao enfileiradas, exibidas ou executadas pelo timer/harness/tool.
- Quem chama/importa: `src/App.jsx`, `src/autonomousLearningLoop.test.js`, `src/autonomousRunner.test.js`, `src/autonomousRunnerPreflight.js`, `src/autonomousRunnerScheduler.js`, `src/autonomousTaskRunner.js`.
- Quem chama/importa internamente: `uuid`, `src/autonomousRunnerState.js`.
- Principais exports: `createRunnerLeaseId`, `isRunnerHeartbeatStale`, `hasActiveRunnerLock`, `acquireRunnerLease`, `heartbeatRunnerLease`, `releaseRunnerLease`, `recoverAutonomousTasksOnStartup`.
- Principais funcoes/classes/simbolos: `normalizeText`, `toMs`, `parsed`, `createRunnerLeaseId`, `isRunnerHeartbeatStale`, `heartbeatAt`, `staleTimeoutMs`, `hasActiveRunnerLock`, `normalizedRunner`, `lock`, `task`, `acquireRunnerLease`, `step`, `leaseId`, `taskTransition`, `stepTransition`, `heartbeatRunnerLease`, `nextRunner`, `releaseRunnerLease`, `releasedTaskRunner` (+7).
- Principais estados/dados manipulados: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: alto.
- Risco de alteracao: Alteracao pode afetar runtime, persistencia, build ou execucao sensivel; exige testes direcionados.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: muitos dependentes estaticos, sem teste direto inferido pelo nome.

## `src/autonomousRunnerMindMap.js`

- Caminho relativo: `src/autonomousRunnerMindMap.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Mind map.
- Responsabilidade principal: Modelo, executor, editor ou utilitario do mapa mental persistente.
- O que faz: Modelo, executor, editor ou utilitario do mapa mental persistente. Manipula principalmente: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/App.jsx`, `src/autonomousRunner.test.js`.
- Quem chama/importa internamente: `src/hud/mindMap/utils/mindMapData.js`, `src/autonomousLearningPolicy.js`.
- Principais exports: `syncMindMapWithRunnerTask`.
- Principais funcoes/classes/simbolos: `normalizeText`, `normalizeSlug`, `COMPACT_AUTONOMOUS_CREATED_BY`, `taskNodeId`, `stepNodeId`, `dependencyEdgeId`, `compactTaskNodeId`, `createdBy`, `scope`, `primaryMapRootNodeId`, `shouldCompactTask`, `mapTaskStatus`, `mapStepStatus`, `upsertNode`, `index`, `upsertEdge`, `removeDetailedTaskNodes`, `rootId`, `stepPrefix`, `removedNodeIds` (+13).
- Principais estados/dados manipulados: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousRunnerPlanner.js`

- Caminho relativo: `src/autonomousRunnerPlanner.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Autonomous Task Runner.
- Responsabilidade principal: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico.
- O que faz: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico. Manipula principalmente: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Quando e usado: Quando tasks sao enfileiradas, exibidas ou executadas pelo timer/harness/tool.
- Quem chama/importa: `src/autonomousRunner.test.js`, `src/autonomousTaskRunner.js`.
- Quem chama/importa internamente: `src/autonomousRunnerState.js`.
- Principais exports: `generateOperationalPlanForTask`, `autoPlanAutonomousRunnerTask`.
- Principais funcoes/classes/simbolos: `normalizeText`, `inferStepType`, `text`, `inferCompletionType`, `generateOperationalPlanForTask`, `command`, `stepType`, `completionType`, `step`, `executable`, `autoPlanAutonomousRunnerTask`, `normalizedRunner`, `task`, `planResult`, `nextRunner`.
- Principais estados/dados manipulados: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: alto.
- Risco de alteracao: Alteracao pode afetar runtime, persistencia, build ou execucao sensivel; exige testes direcionados.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: sem teste direto inferido pelo nome.

## `src/autonomousRunnerPreflight.js`

- Caminho relativo: `src/autonomousRunnerPreflight.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Autonomous Task Runner.
- Responsabilidade principal: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico.
- O que faz: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico. Manipula principalmente: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Quando e usado: Quando tasks sao enfileiradas, exibidas ou executadas pelo timer/harness/tool.
- Quem chama/importa: `src/autonomousRunner.test.js`, `src/autonomousTaskRunner.js`.
- Quem chama/importa internamente: `src/autonomousRunnerState.js`, `src/autonomousRunnerLease.js`, `src/autonomousRunnerScheduler.js`, `src/autonomousLearning/index.js`, `src/filesystem/filesystemNameSanitizer.js`.
- Principais exports: `checkRunnerPolicy`, `checkDependencies`, `checkTaskExecutable`, `checkVmAvailability`, `checkWorkspaceReady`, `runAutonomousRunnerPreflight`.
- Principais funcoes/classes/simbolos: `commandLooksUnsafe`, `checkRunnerPolicy`, `normalizedRunner`, `checkDependencies`, `dependencyState`, `checkTaskExecutable`, `step`, `folderValidation`, `checkVmAvailability`, `normalizedVm`, `requestsWorkspaceFallback`, `requiresRealVm`, `checkWorkspaceReady`, `runAutonomousRunnerPreflight`, `policy`, `dependencies`, `executable`, `vm`, `workspace`.
- Principais estados/dados manipulados: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: alto.
- Risco de alteracao: Alteracao pode afetar runtime, persistencia, build ou execucao sensivel; exige testes direcionados.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: sem teste direto inferido pelo nome.

## `src/autonomousRunnerRecoveryPlanner.js`

- Caminho relativo: `src/autonomousRunnerRecoveryPlanner.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Autonomous Task Runner.
- Responsabilidade principal: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico.
- O que faz: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico. Manipula principalmente: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Quando e usado: Quando tasks sao enfileiradas, exibidas ou executadas pelo timer/harness/tool.
- Quem chama/importa: `src/autonomousRunner.test.js`, `src/autonomousTaskRunner.js`.
- Quem chama/importa internamente: `src/autonomousRunnerState.js`.
- Principais exports: `detectRecoveryLoop`, `createRecoveryTaskForDependencyFailure`, `applyRecoveryLoopGuard`.
- Principais funcoes/classes/simbolos: `normalizeText`, `latestFailureSignature`, `history`, `latest`, `command`, `reason`, `stderr`, `detectRecoveryLoop`, `latestSignature`, `repeated`, `signature`, `createRecoveryTaskForDependencyFailure`, `normalizedRunner`, `failedDependency`, `recoveryInput`, `withRecovery`, `recoveryTask`, `applyRecoveryLoopGuard`, `task`.
- Principais estados/dados manipulados: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: alto.
- Risco de alteracao: Alteracao pode afetar runtime, persistencia, build ou execucao sensivel; exige testes direcionados.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: sem teste direto inferido pelo nome.

## `src/autonomousRunnerScheduler.js`

- Caminho relativo: `src/autonomousRunnerScheduler.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Autonomous Task Runner.
- Responsabilidade principal: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico.
- O que faz: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico. Manipula principalmente: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Quando e usado: Quando tasks sao enfileiradas, exibidas ou executadas pelo timer/harness/tool.
- Quem chama/importa: `src/autonomousRunner.test.js`, `src/autonomousRunnerPreflight.js`, `src/autonomousTaskRunner.js`.
- Quem chama/importa internamente: `src/autonomousRunnerState.js`, `src/autonomousRunnerLease.js`.
- Principais exports: `isRetryDue`, `resolveRunnerDependencies`, `isTaskEligibleByStatus`, `getEligibleRunnerTasks`, `selectNextEligibleTask`, `computeNextRunnerIntervalMs`.
- Principais funcoes/classes/simbolos: `PRIORITY_RANK`, `toMs`, `parsed`, `isRetryDue`, `resolveRunnerDependencies`, `unresolved`, `failed`, `requiredTask`, `isTaskEligibleByStatus`, `getEligibleRunnerTasks`, `normalizedRunner`, `tasks`, `skipped`, `eligible`, `dependencyState`, `selectNextEligibleTask`, `result`, `selected`, `computeNextRunnerIntervalMs`, `intervals` (+1).
- Principais estados/dados manipulados: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: alto.
- Risco de alteracao: Alteracao pode afetar runtime, persistencia, build ou execucao sensivel; exige testes direcionados.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: sem teste direto inferido pelo nome.

## `src/autonomousRunnerState.js`

- Caminho relativo: `src/autonomousRunnerState.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Autonomous Task Runner.
- Responsabilidade principal: Contrato de estado, tasks, steps, transicoes, auditoria e resumo do Runner.
- O que faz: Contrato de estado, tasks, steps, transicoes, auditoria e resumo do Runner. Manipula principalmente: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Quando e usado: Quando tasks sao enfileiradas, exibidas ou executadas pelo timer/harness/tool.
- Quem chama/importa: `src/aliceMemory.js`, `src/autonomousLearningLoop.js`, `src/autonomousLearningLoop.test.js`, `src/autonomousLearningValidator.js`, `src/autonomousRunner.test.js`, `src/autonomousRunnerEvidence.js`, `src/autonomousRunnerExecutor.js`, `src/autonomousRunnerLease.js`, `src/autonomousRunnerPlanner.js`, `src/autonomousRunnerPreflight.js`, `src/autonomousRunnerRecoveryPlanner.js`, `src/autonomousRunnerScheduler.js`, `src/autonomousRunnerValidation.js`, `src/autonomousTaskRunner.js`, `src/runnerAppDiagnostics.js`.
- Quem chama/importa internamente: `uuid`.
- Principais exports: `AUTONOMOUS_RUNNER_SCHEMA_VERSION`, `MAX_RUNNER_QUEUE`, `MAX_RUNNER_TASKS`, `MAX_RUNNER_AUDIT_EVENTS`, `MAX_RUNNER_EVIDENCE_REFS`, `DEFAULT_RUNNER_STALE_TIMEOUT_MS`, `RUNNER_STATES`, `RUNNER_TASK_STATUSES`, `RUNNER_STEP_STATUSES`, `RUNNER_REASONS`, `RUNNER_PRIORITIES`, `RUNNER_STEP_TYPES`, `RUNNER_ACTION_KINDS`, `RUNNER_COMPLETION_TYPES`, `RUNNER_EVIDENCE_KINDS`, `createEmptyAutonomousRunnerState`, `resolveStepTimeout`, `normalizeAutonomousRunnerStep` (+25).
- Principais funcoes/classes/simbolos: `AUTONOMOUS_RUNNER_SCHEMA_VERSION`, `MAX_RUNNER_QUEUE`, `MAX_RUNNER_TASKS`, `MAX_RUNNER_AUDIT_EVENTS`, `MAX_RUNNER_EVIDENCE_REFS`, `DEFAULT_RUNNER_STALE_TIMEOUT_MS`, `RUNNER_STATES`, `RUNNER_TASK_STATUSES`, `RUNNER_STEP_STATUSES`, `RUNNER_REASONS`, `RUNNER_PRIORITIES`, `RUNNER_STEP_TYPES`, `RUNNER_ACTION_KINDS`, `RUNNER_COMPLETION_TYPES`, `RUNNER_EVIDENCE_KINDS`, `TASK_STATUS_VALUES`, `STEP_STATUS_VALUES`, `RUNNER_STATE_VALUES`, `TASK_TRANSITIONS`, `STEP_TRANSITIONS` (+121).
- Principais estados/dados manipulados: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: critico.
- Risco de alteracao: Alteracao pode quebrar fluxo central ou seguranca; revisar dependentes, testes e efeitos colaterais antes.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: arquivo central; ler fluxo completo antes de alterar, muitos dependentes estaticos, sem teste direto inferido pelo nome.

## `src/autonomousRunnerTextInputDiagnostics.js`

- Caminho relativo: `src/autonomousRunnerTextInputDiagnostics.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Autonomous Task Runner.
- Responsabilidade principal: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico.
- O que faz: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico. Manipula principalmente: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Quando e usado: Quando tasks sao enfileiradas, exibidas ou executadas pelo timer/harness/tool.
- Quem chama/importa: `src/autonomousRunnerEvidence.js`, `src/autonomousRunnerValidation.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `normalizeTextInputDiagnostics`, `parseTextInputDiagnosticsOutput`.
- Principais funcoes/classes/simbolos: `normalizeString`, `normalizeBoolean`, `normalizeNumber`, `number`, `normalizeTextInputDiagnostics`, `parseDiagnosticsPayload`, `jsonEnd`, `jsonText`, `parsed`, `createParseFailureDiagnostics`, `extractStringField`, `jsonMatch`, `lineMatch`, `extractBooleanField`, `match`, `extractNumberField`, `parseTruncatedDiagnosticsOutput`, `text`, `diagnostics`, `parseTextInputDiagnosticsOutput` (+4).
- Principais estados/dados manipulados: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: alto.
- Risco de alteracao: Alteracao pode afetar runtime, persistencia, build ou execucao sensivel; exige testes direcionados.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: sem teste direto inferido pelo nome.

## `src/autonomousRunnerToolExecutor.js`

- Caminho relativo: `src/autonomousRunnerToolExecutor.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Autonomous Task Runner.
- Responsabilidade principal: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico.
- O que faz: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico. Manipula principalmente: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Quando e usado: Quando tasks sao enfileiradas, exibidas ou executadas pelo timer/harness/tool.
- Quem chama/importa: `src/App.jsx`, `src/autonomousRunner.test.js`.
- Quem chama/importa internamente: `src/aliceMemory.js`.
- Principais exports: `AUTONOMOUS_RUNNER_TOOL_NAMES`, `isAutonomousRunnerToolName`, `executeAutonomousRunnerFunctionCall`.
- Principais funcoes/classes/simbolos: `AUTONOMOUS_RUNNER_TOOL_NAMES`, `isAutonomousRunnerToolName`, `normalizeText`, `buildRunnerResponse`, `executeAutonomousRunnerFunctionCall`, `toolName`, `args`, `operation`, `taskInput`.
- Principais estados/dados manipulados: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Efeitos colaterais: Pode atualizar memoria/estado e chamar Tauri via invoke conforme tool.
- Nivel de criticidade: alto.
- Risco de alteracao: Alteracao pode afetar runtime, persistencia, build ou execucao sensivel; exige testes direcionados.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: sem teste direto inferido pelo nome.

## `src/autonomousRunnerValidation.js`

- Caminho relativo: `src/autonomousRunnerValidation.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Autonomous Task Runner.
- Responsabilidade principal: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico.
- O que faz: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico. Manipula principalmente: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Quando e usado: Quando tasks sao enfileiradas, exibidas ou executadas pelo timer/harness/tool.
- Quem chama/importa: `src/autonomousRunner.test.js`, `src/autonomousTaskRunner.js`.
- Quem chama/importa internamente: `src/autonomousRunnerState.js`, `src/autonomousRunnerTextInputDiagnostics.js`.
- Principais exports: `validateRunnerCompletionCriteria`.
- Principais funcoes/classes/simbolos: `normalizeText`, `normalizeEvidenceToken`, `getExitCode`, `artifacts`, `agentResponse`, `agentResult`, `agentSuccessExitCode`, `code`, `getExecutionOutput`, `getExecutionDiagnosticOutput`, `parseFolderValidationOutput`, `lines`, `parsed`, `hasRequiredEvidence`, `required`, `token`, `acceptedTokens`, `metadata`, `haystack`, `validateRunnerCompletionCriteria` (+10).
- Principais estados/dados manipulados: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: alto.
- Risco de alteracao: Alteracao pode afetar runtime, persistencia, build ou execucao sensivel; exige testes direcionados.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: sem teste direto inferido pelo nome.

## `src/autonomousScriptSynthesizer.js`

- Caminho relativo: `src/autonomousScriptSynthesizer.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Frontend/orquestracao.
- Responsabilidade principal: Modulo auxiliar do projeto.
- O que faz: Modulo auxiliar do projeto. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousLearningLoop.test.js`, `src/autonomousLearningPlanner.js`.
- Quem chama/importa internamente: `src/autonomousLearningPolicy.js`.
- Principais exports: `CONTROLLED_LEARNING_SCRIPT_DIR`, `validateSynthesizedScript`, `synthesizeScriptForGap`, `createScriptWriteStep`.
- Principais funcoes/classes/simbolos: `CONTROLLED_LEARNING_SCRIPT_DIR`, `normalizeText`, `toSafeIdPart`, `normalizeScriptType`, `normalized`, `validateSynthesizedScript`, `normalizedType`, `source`, `synthesizeScriptForGap`, `gapId`, `strategyId`, `fileBase`, `reportPath`, `report`, `content`, `fs`, `validation`, `createScriptWriteStep`, `serializedPath`, `serializedContent` (+1).
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousTaskContext.js`

- Caminho relativo: `src/autonomousTaskContext.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Frontend/orquestracao.
- Responsabilidade principal: Modulo auxiliar do projeto.
- O que faz: Modulo auxiliar do projeto. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousCapabilityScanner.js`.
- Quem chama/importa internamente: `src/autonomousFailureSignatureBuilder.js`.
- Principais exports: `getTaskRepairMetadata`, `extractAutonomousTaskContext`, `createContextualLearningGapForTask`.
- Principais funcoes/classes/simbolos: `normalizeText`, `normalizeLower`, `normalizeArray`, `toSafeIdPart`, `terminalFailureStatuses`, `HUMAN_REVIEW_STATUS`, `inferGapTypeFromCapability`, `text`, `collectStepSignals`, `normalizeRepairDepth`, `depth`, `isContextRepairTask`, `metadata`, `getTaskRepairMetadata`, `currentDepth`, `originalFailedTaskId`, `parentFailureSignature`, `repairFamily`, `tokenizeForAffinity`, `hasObservedTargetAffinity` (+18).
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/autonomousTaskRunner.js`

- Caminho relativo: `src/autonomousTaskRunner.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Autonomous Task Runner.
- Responsabilidade principal: Tick principal do Autonomous Task Runner.
- O que faz: Tick principal do Autonomous Task Runner. Manipula principalmente: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Quando e usado: Quando tasks sao enfileiradas, exibidas ou executadas pelo timer/harness/tool.
- Quem chama/importa: `src/App.jsx`, `src/autonomousRunner.test.js`.
- Quem chama/importa internamente: `src/autonomousRunnerState.js`, `src/autonomousRunnerLease.js`, `src/autonomousRunnerScheduler.js`, `src/autonomousRunnerPlanner.js`, `src/autonomousRunnerPreflight.js`, `src/autonomousRunnerExecutor.js`, `src/autonomousRunnerEvidence.js`, `src/autonomousRunnerValidation.js`, `src/autonomousRunnerRecoveryPlanner.js`, `src/autonomousLearning/index.js`.
- Principais exports: `runAutonomousTaskRunnerTick`.
- Principais funcoes/classes/simbolos: `retryDelayMsForAttempt`, `toIso`, `getLatestTask`, `getLatestStep`, `resolveEffectiveVmStatus`, `createLearningCandidateForRunnerResult`, `normalizeErrorMessage`, `normalizeText`, `createEvidencePersistenceResult`, `runnerEvidenceFilesFromRefs`, `prefix`, `allowedFiles`, `files`, `path`, `fileName`, `formatPersistenceFiles`, `withEvidencePersistenceCheck`, `persistenceOk`, `persistenceCheck`, `isRuntimeUnavailableReason` (+43).
- Principais estados/dados manipulados: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: critico.
- Risco de alteracao: Alteracao pode quebrar fluxo central ou seguranca; revisar dependentes, testes e efeitos colaterais antes.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: arquivo central; ler fluxo completo antes de alterar, alto fan-in de dependencias importadas, sem teste direto inferido pelo nome.

## `src/debugHud.js`

- Caminho relativo: `src/debugHud.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Frontend/orquestracao.
- Responsabilidade principal: Modulo auxiliar do projeto.
- O que faz: Modulo auxiliar do projeto. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/App.jsx`, `src/autonomousLearning.test.js`, `src/debugHud.test.js`.
- Quem chama/importa internamente: `src/learningPlanner/learningPlannerService.js`.
- Principais exports: `formatDebugValue`, `humanizeDebugToken`, `buildDebugHudSnapshot`.
- Principais funcoes/classes/simbolos: `formatDebugValue`, `KNOWLEDGE_DISPLAY_LABELS`, `humanizeDebugToken`, `normalized`, `formatAgeMs`, `ageMs`, `formatTraceEvent`, `details`, `buildKnowledgeDisplay`, `expansionSteps`, `formatAutonomousList`, `normalizedLimit`, `omitted`, `visibleItems`, `lines`, `buildAutonomousDisplay`, `formatTime`, `value`, `normalizeInteraction`, `buildDebugHudSnapshot` (+11).
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/debugHud.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/debugHud.test.js`

- Caminho relativo: `src/debugHud.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/debugHud.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `snapshot`, `tasksById`.
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/debugHud.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/dev/autonomousRunnerHarness.js`

- Caminho relativo: `src/dev/autonomousRunnerHarness.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Harness/dev.
- Responsabilidade principal: Modulo auxiliar do projeto.
- O que faz: Modulo auxiliar do projeto. Manipula principalmente: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/dev/autonomousRunnerHarness.test.js`, `src/dev/learningPlannerHarness.js`, `src/dev/learningPlannerHarness.test.js`.
- Quem chama/importa internamente: `node:fs`, `node:os`, `node:path`, `node:process`, `src/dev/../aliceMemory`, `src/dev/../autonomousRunnerState`, `src/dev/../autonomousRunnerLease`, `src/dev/../autonomousTaskRunner`, `src/dev/../autonomousRunnerScheduler`, `src/dev/../autonomousLearning/learning`, `src/dev/../autonomousCapabilityScanner`, `src/dev/../autonomousLearningGoals`, `src/dev/../autonomousLearningLoop`, `src/dev/../autonomousObservedLearning`, `src/dev/../autonomousLearningPlanner`, `src/dev/../autonomousProcedureReuseEngine` (+3).
- Principais exports: `HARNESS_CREATED_BY`, `HARNESS_APP_ID`, `HARNESS_MEMORY_FILE`, `resolveMemoryPath`, `resolveRuntimeRequestDir`, `requestRuntimeTextInputSmoke`, `requestRuntimeTextInputNegativeSmoke`, `loadHarnessMemory`, `saveHarnessMemory`, `createHarnessBackup`, `isHarnessTask`, `assertSafeForHarnessMutation`, `seedSmokeTask`, `seedTextInputSmokeTask`, `seedFailureTask`, `seedLargeTask`, `seedVmUnavailableScenario`, `seedStaleRunningTask` (+24).
- Principais funcoes/classes/simbolos: `HARNESS_CREATED_BY`, `HARNESS_APP_ID`, `HARNESS_MEMORY_FILE`, `READ_ONLY_COMMANDS`, `RUNTIME_REQUEST_COMMANDS`, `AUTONOMOUS_LEARNING_READ_ONLY`, `AUTONOMOUS_REUSE_READ_ONLY`, `SEED_COMMANDS`, `COMPACTION_COMMANDS`, `RUNNER_ACTIVE_STATUSES`, `RUNNER_TERMINAL_STATUSES`, `DEFAULT_COMPACTION_KEEP_AUDITS`, `DEFAULT_COMPACTION_KEEP_EVIDENCE_REFS`, `DEFAULT_COMPACTION_KEEP_TERMINAL_TASKS`, `COMPLETE_EVIDENCE`, `normalizeText`, `toIso`, `normalizePositiveInteger`, `number`, `parseNonNegativeIntegerFlag` (+156).
- Principais estados/dados manipulados: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/dev/autonomousRunnerHarness.test.js`.
- Observacoes tecnicas: alto fan-in de dependencias importadas.

## `src/dev/autonomousRunnerHarness.test.js`

- Caminho relativo: `src/dev/autonomousRunnerHarness.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `node:fs`, `node:os`, `node:path`, `vitest`, `src/dev/../aliceMemory`, `src/dev/../autonomousRunnerState`, `src/dev/autonomousRunnerHarness.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `realTask`, `runner`, `task`, `seeded`, `recovered`, `recoveredTask`, `withRealRunner`, `withRealMemory`, `cleared`, `noisyRunner`, `memory`, `compacted`, `compactedRunner`, `safeState`, `snapshot`, `memoryPath`, `result`, `backupPath`, `seed`, `loadedAfterSeed` (+11).
- Principais estados/dados manipulados: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/dev/autonomousRunnerHarness.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/dev/learningPlannerHarness.js`

- Caminho relativo: `src/dev/learningPlannerHarness.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Harness/dev.
- Responsabilidade principal: Modulo auxiliar do projeto.
- O que faz: Modulo auxiliar do projeto. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/dev/learningPlannerHarness.test.js`.
- Quem chama/importa internamente: `node:process`, `src/dev/../aliceMemory`, `src/dev/../autonomousRunnerState`, `src/dev/../learningPlanner/learningPlannerExecution`, `src/dev/../learningPlanner/learningTaskCompiler`, `src/dev/../learningPlanner/learningPlanSchema`, `src/dev/../learningPlanner/learningPlanValidator`, `src/dev/../learningPlanner/learningPlannerTypes`, `src/dev/../learningPlanner/learningPlannerRepository`, `src/dev/autonomousRunnerHarness.js`.
- Principais exports: `LEARNING_HARNESS_CREATED_BY`, `LEARNING_HARNESS_SCENARIO`, `parseLearningHarnessArgs`, `createHarnessLearningRequest`, `createHarnessLearningPlan`, `printLearningState`, `verifyLearningSafeState`, `clearLearningHarnessTestData`, `applyLearningHarnessCommand`, `runLearningHarnessCommand`, `createFreshLearningHarnessMemory`.
- Principais funcoes/classes/simbolos: `LEARNING_HARNESS_CREATED_BY`, `LEARNING_HARNESS_SCENARIO`, `READ_ONLY_COMMANDS`, `toIso`, `toSafeIdPart`, `parseLearningHarnessArgs`, `positional`, `flags`, `token`, `key`, `next`, `getLearningRequests`, `upsertLearningRequest`, `learningRequests`, `findLearningRequest`, `requests`, `normalizedId`, `findLearningPlan`, `state`, `createHarnessLearningRequest` (+47).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/dev/learningPlannerHarness.test.js`.
- Observacoes tecnicas: alto fan-in de dependencias importadas.

## `src/dev/learningPlannerHarness.test.js`

- Caminho relativo: `src/dev/learningPlannerHarness.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `node:fs`, `node:os`, `node:path`, `vitest`, `src/dev/../aliceMemory`, `src/dev/learningPlannerHarness.js`, `src/dev/autonomousRunnerHarness.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `runSeedAndPlan`, `seeded`, `generated`, `result`, `state`, `validation`, `compiled`, `runner`, `memoryPath`, `seed`, `requestId`, `planId`, `safeState`, `enqueued`, `realRequest`, `withRealPlan`, `cleared`, `learning`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/dev/learningPlannerHarness.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/dev/runtimeHarnessBridge.js`

- Caminho relativo: `src/dev/runtimeHarnessBridge.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Harness/dev.
- Responsabilidade principal: Modulo auxiliar do projeto.
- O que faz: Modulo auxiliar do projeto. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/App.jsx`, `src/dev/autonomousRunnerHarness.js`, `src/dev/runtimeHarnessBridge.test.js`.
- Quem chama/importa internamente: `src/dev/../aliceMemory`, `src/dev/../autonomousLearning/vmTextInputDriver`, `src/dev/../autonomousRunnerState`.
- Principais exports: `RUNTIME_HARNESS_CREATED_BY`, `RUNTIME_TEXT_INPUT_SMOKE_SCENARIO`, `RUNTIME_TEXT_INPUT_SMOKE_REQUEST`, `RUNTIME_TEXT_INPUT_NEGATIVE_SMOKE_SCENARIO`, `RUNTIME_TEXT_INPUT_NEGATIVE_SMOKE_REQUEST`, `createRuntimeTextInputSmokeRequest`, `createRuntimeTextInputSmokeTask`, `createRuntimeTextInputNegativeSmokeRequest`, `createRuntimeTextInputNegativeSmokeTask`, `applyRuntimeHarnessRequests`.
- Principais funcoes/classes/simbolos: `RUNTIME_HARNESS_CREATED_BY`, `RUNTIME_TEXT_INPUT_SMOKE_SCENARIO`, `RUNTIME_TEXT_INPUT_SMOKE_REQUEST`, `RUNTIME_TEXT_INPUT_NEGATIVE_SMOKE_SCENARIO`, `RUNTIME_TEXT_INPUT_NEGATIVE_SMOKE_REQUEST`, `VM_POWERSHELL_EXE`, `FIELD_INTERACTED_MARKER`, `COMPLETE_EVIDENCE`, `normalizeText`, `toSafeIdPart`, `timestampId`, `parsed`, `quotePowerShellString`, `powerShellArgs`, `createRuntimeTextInputSmokeRequest`, `safeRequestId`, `createRuntimeTextInputSmokeTask`, `expectedText`, `script`, `createRuntimeTextInputNegativeSmokeRequest` (+11).
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/dev/runtimeHarnessBridge.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/dev/runtimeHarnessBridge.test.js`

- Caminho relativo: `src/dev/runtimeHarnessBridge.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/dev/../aliceMemory`, `src/dev/runtimeHarnessBridge.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `task`, `script`, `result`, `runner`, `request`, `first`, `second`.
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/dev/runtimeHarnessBridge.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/filesystem/filesystemNameSanitizer.js`

- Caminho relativo: `src/filesystem/filesystemNameSanitizer.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Filesystem/sanitizacao.
- Responsabilidade principal: Modulo auxiliar do projeto.
- O que faz: Modulo auxiliar do projeto. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/autonomousRunnerPreflight.js`, `src/filesystem/filesystemNameSanitizer.test.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `isReservedWindowsFolderName`, `hasInvalidWindowsFolderNameCharacters`, `sanitizeFolderName`, `isSafeWorkspaceRelativePath`, `validateResolvedFolderTarget`.
- Principais funcoes/classes/simbolos: `WINDOWS_INVALID_FOLDER_CHARS`, `WINDOWS_INVALID_FOLDER_CHAR_TEST`, `RESERVED_WINDOWS_NAMES`, `normalizeText`, `hasControlCharacter`, `replaceControlCharacters`, `uniqueWarnings`, `isReservedWindowsFolderName`, `baseName`, `hasInvalidWindowsFolderNameCharacters`, `sanitizeFolderName`, `originalName`, `warnings`, `safeFallback`, `boundedMaxLength`, `trimmed`, `withoutTrailingDotsOrSpaces`, `finalReserved`, `finalInvalidChars`, `ok` (+7).
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/filesystem/filesystemNameSanitizer.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/filesystem/filesystemNameSanitizer.test.js`

- Caminho relativo: `src/filesystem/filesystemNameSanitizer.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/filesystem/filesystemNameSanitizer.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `result`.
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/filesystem/filesystemNameSanitizer.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/geminiLive.js`

- Caminho relativo: `src/geminiLive.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Gemini Live/audio/tela.
- Responsabilidade principal: Modulo de conversa multimodal, audio PCM, tela, sessao Live ou contexto operacional.
- O que faz: Modulo de conversa multimodal, audio PCM, tela, sessao Live ou contexto operacional. Manipula principalmente: Audio PCM/base64, frames JPEG, WebSocket messages, transcripts, setup e session resumption.
- Quando e usado: Durante start/stop/reconexao da sessao Live e streaming multimodal.
- Quem chama/importa: `src/App.jsx`, `src/geminiLive.test.js`, `src/liveSessionOrchestrator.js`, `src/liveSessionOrchestrator.test.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `GEMINI_LIVE_WS_URL`, `LIVE_CLOSE_REASONS`, `buildGeminiLiveUrl`, `buildSetupMessage`, `buildClientContentMessage`, `buildClientTextMessage`, `buildToolResponseMessage`, `buildRealtimeAudioMessage`, `buildRealtimeVideoMessage`, `parseLiveMessageData`, `getLiveErrorMessage`, `extractLiveMessage`, `classifyLiveCloseReason`, `GeminiLiveSession`.
- Principais funcoes/classes/simbolos: `GEMINI_LIVE_WS_URL`, `LIVE_CLOSE_REASONS`, `buildGeminiLiveUrl`, `buildSetupMessage`, `buildClientContentMessage`, `buildClientTextMessage`, `buildToolResponseMessage`, `buildRealtimeAudioMessage`, `buildRealtimeVideoMessage`, `parseLiveMessageData`, `getLiveErrorMessage`, `normalizeGoAway`, `normalizeSessionResumptionUpdate`, `extractLiveMessage`, `serverContent`, `parts`, `classifyLiveCloseReason`, `normalizedReason`, `createLiveSessionError`, `error` (+7).
- Principais estados/dados manipulados: Audio PCM/base64, frames JPEG, WebSocket messages, transcripts, setup e session resumption.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: critico.
- Risco de alteracao: Alteracao pode quebrar fluxo central ou seguranca; revisar dependentes, testes e efeitos colaterais antes.
- Testes relacionados: `src/geminiLive.test.js`.
- Observacoes tecnicas: arquivo central; ler fluxo completo antes de alterar.

## `src/geminiLive.test.js`

- Caminho relativo: `src/geminiLive.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/geminiLive.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `url`, `event`, `callbackState`, `session`, `connectPromise`, `socket`, `closeReasons`, `errors`, `originalSetTimeout`, `FakeWebSocket`.
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/geminiLive.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.
