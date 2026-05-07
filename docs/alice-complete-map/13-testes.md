# Testes

## Visao geral

Foram identificados 55 arquivos de teste/fixture textuais. A maior cobertura esta em modulos JS puros, Runner, learning planner, web knowledge, HUD view models, Rust inline tests e Python unittest.

## `edge-extension/captureEvents.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `edge-extension/captureEvents.js`.
- Casos/simbolos identificados: `payload`, `parsed`, `tracker`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `scripts/alice-code-auditor.test.mjs`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `scripts/alice-code-auditor.mjs`.
- Casos/simbolos identificados: `detectedError`, `detectedImprovement`, `result`, `first`, `second`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src-tauri/python_sidecar/tests/test_sidecar.py`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `__future__`, `io`, `json`, `sys`, `unittest`, `pathlib`, `unittest.mock`, `alice_window_sidecar`.
- Casos/simbolos identificados: `NormalizeAliasTests`, `test_normalizes_browser_alias`, `test_normalizes_file_explorer_alias`, `test_returns_none_for_unknown_alias`, `ProtocolTests`, `test_handle_request_returns_foreground_context`, `test_handle_request_normalizes_sidecar_error`, `test_sidecar_main_processes_jsonl_requests`, `ResolveTargetTests`, `test_resolve_target_interprets_json_payload`, `test_resolve_target_raises_for_not_found`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src-tauri/tests/fixtures/web_knowledge/long_article.html`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: nenhum identificado estaticamente.
- Casos/simbolos identificados: nenhum identificado estaticamente.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src-tauri/tests/fixtures/web_knowledge/noisy_navigation_links.html`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: nenhum identificado estaticamente.
- Casos/simbolos identificados: nenhum identificado estaticamente.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src-tauri/tests/fixtures/web_knowledge/selected_text_page.html`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: nenhum identificado estaticamente.
- Casos/simbolos identificados: nenhum identificado estaticamente.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src-tauri/tests/fixtures/web_knowledge/tables_and_lists.html`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: nenhum identificado estaticamente.
- Casos/simbolos identificados: nenhum identificado estaticamente.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src-tauri/tests/fixtures/web_knowledge/technical_docs.html`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: nenhum identificado estaticamente.
- Casos/simbolos identificados: nenhum identificado estaticamente.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src-tauri/tests/fixtures/web_knowledge/thin_landing_page.html`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: nenhum identificado estaticamente.
- Casos/simbolos identificados: nenhum identificado estaticamente.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src-tauri/vm/guest_agent/tests/test_background_actions.py`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `json`, `os`, `sys`, `tempfile`, `time`, `unittest`, `action_executor`.
- Casos/simbolos identificados: `BackgroundActionTests`, `test_background_command_lifecycle`, `test_background_status_requires_known_task`, `test_status_reports_elevation_capability`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src-tauri/vm/guest_agent/tests/test_input_controller.py`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `os`, `sys`, `unittest`, `input_controller`.
- Casos/simbolos identificados: `InputControllerTests`, `test_utf16_code_units_preserve_non_ascii_text`, `test_type_text_uses_unicode_sendinput_by_default`, `test_type_text_auto_falls_back_to_clipboard_when_unicode_fails`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src-tauri/vm/guest_agent/tests/test_resident_server.py`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `json`, `os`, `sys`, `threading`, `time`, `unittest`, `http.client`, `pathlib`, `server`.
- Casos/simbolos identificados: `ResidentServerTests`, `setUp`, `tearDown`, `request`, `test_health_requires_token_and_reports_online`, `test_action_uses_existing_protocol_shape`, `test_action_error_is_json_not_connection_failure`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/App.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/liveDiagnostics.js`, `src/appUiState.js`.
- Casos/simbolos identificados: `buildLiveUiState`, `currentState`, `nextState`, `reconnectingState`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/alice.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/alice.js`.
- Casos/simbolos identificados: `setup`, `memoryPrefixTurns`, `setupFromString`, `customSetup`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/aliceMemory.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/aliceMemory.js`, `src/hud/mindMap/utils/mindMapData.js`.
- Casos/simbolos identificados: `memory`, `small`, `large`, `facts`, `baseMemory`, `merged`, `oversizedMemory`, `pruned`, `activeMindMap`, `firstMemory`, `secondMemory`, `activated`, `deleted`, `updated`, `rolledBack`, `activeBefore`, `goalMap`, `turns`, `legacyMemory`, `saveJson` (+1).
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/aliceMemoryPersistence.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/aliceMemory.js`, `src/aliceMemoryPersistence.js`.
- Casos/simbolos identificados: `memory`, `readError`, `onSkipped`, `saveMemory`, `flushed`, `onSaved`, `savedMemory`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/autonomousContextRepair.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/aliceMemory.js`, `src/autonomousCapabilityScanner.js`.
- Casos/simbolos identificados: `scan`, `memory`, `result`, `reviewGap`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/autonomousFailureSignatureBuilder.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/autonomousFailureSignatureBuilder.js`.
- Casos/simbolos identificados: `signature`, `baseTask`, `first`, `second`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/autonomousLearning.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/autonomousLearning/index.js`, `src/debugHud.js`, `src/aliceMemory.js`, `src/autonomousLearningToolExecutor.js`.
- Casos/simbolos identificados: `initialState`, `cancelCalls`, `result`, `decision`, `app`, `plan`, `explicitCommandPlan`, `summary`, `blocked`, `allowed`, `previousSteps`, `startDecision`, `pollDecision`, `replay`, `agent`, `directPlan`, `largePlan`, `vmStatus`, `selection`, `snapshot` (+26).
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/autonomousLearning/behaviorContext.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/autonomousLearning/behaviorContext.js`, `src/autonomousLearning/state.js`, `src/autonomousLearning/../hud/mindMap/utils/mindMapData`.
- Casos/simbolos identificados: `context`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/autonomousLearning/decisionEngine.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/autonomousLearning/decisionEngine.js`.
- Casos/simbolos identificados: `decision`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/autonomousLearning/vmTextInputDriver.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/autonomousLearning/../autonomousRunnerTextInputDiagnostics`, `src/autonomousLearning/../autonomousRunnerValidation`, `src/autonomousLearning/vmTextInputDriver.js`.
- Casos/simbolos identificados: `script`, `expectedText`, `diagnostics`, `validation`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/autonomousLearningLoop.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/aliceMemory.js`, `src/autonomousCapabilityScanner.js`, `src/autonomousLearningGoals.js`, `src/autonomousLearningPlanner.js`, `src/autonomousLearningLoop.js`, `src/autonomousLearningValidator.js`, `src/autonomousProcedurePromoter.js`, `src/autonomousScriptSynthesizer.js`, `src/autonomousLearningPolicy.js`, `src/autonomousProcedureReuseEngine.js`, `src/autonomousProcedureVersioning.js`, `src/autonomousRunnerLease.js`, `src/autonomousRunnerState.js`.
- Casos/simbolos identificados: `browserGap`, `appLaunchGap`, `fileManagementGap`, `appInstallGap`, `fieldInteractionGap`, `pageValidationGap`, `completeEvidenceRef`, `result`, `planned`, `runner`, `task`, `lease`, `scan`, `memory`, `goalResult`, `goalGaps`, `legacyGoal`, `stageGap`, `taskId`, `gap` (+52).
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/autonomousObservedLearning.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/aliceMemory.js`, `src/autonomousObservedLearning.js`.
- Casos/simbolos identificados: `targets`, `now`, `first`, `second`, `learning`, `text`, `memory`, `result`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/autonomousProcedureOptimizer.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/autonomousProcedureOptimizer.js`.
- Casos/simbolos identificados: `procedure`, `firstPlan`, `duplicatePlan`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/autonomousRunner.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/aliceMemory.js`, `src/autonomousRunnerState.js`, `src/autonomousRunnerLease.js`, `src/autonomousRunnerScheduler.js`, `src/autonomousRunnerPreflight.js`, `src/autonomousTaskRunner.js`, `src/autonomousRunnerPlanner.js`, `src/autonomousRunnerRecoveryPlanner.js`, `src/autonomousRunnerMindMap.js`, `src/hud/mindMap/utils/mindMapData.js`, `src/autonomousRunnerToolExecutor.js`, `src/autonomousLearningToolExecutor.js`, `src/autonomousRunnerEvidence.js`, `src/autonomousRunnerValidation.js`.
- Casos/simbolos identificados: `executableStep`, `createReadyTask`, `createSuccessfulRunnerInvoke`, `task`, `longExecutionId`, `runner`, `malformedCommand`, `repairedCommand`, `staleCommand`, `result`, `taskResult`, `stepResult`, `lease`, `heartbeat`, `recovered`, `preflight`, `calls`, `smokeStep`, `verifyCall`, `step` (+35).
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/debugHud.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/debugHud.js`.
- Casos/simbolos identificados: `snapshot`, `tasksById`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/dev/autonomousRunnerHarness.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `node:fs`, `node:os`, `node:path`, `vitest`, `src/dev/../aliceMemory`, `src/dev/../autonomousRunnerState`, `src/dev/autonomousRunnerHarness.js`.
- Casos/simbolos identificados: `realTask`, `runner`, `task`, `seeded`, `recovered`, `recoveredTask`, `withRealRunner`, `withRealMemory`, `cleared`, `noisyRunner`, `memory`, `compacted`, `compactedRunner`, `safeState`, `snapshot`, `memoryPath`, `result`, `backupPath`, `seed`, `loadedAfterSeed` (+11).
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/dev/learningPlannerHarness.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `node:fs`, `node:os`, `node:path`, `vitest`, `src/dev/../aliceMemory`, `src/dev/learningPlannerHarness.js`, `src/dev/autonomousRunnerHarness.js`.
- Casos/simbolos identificados: `runSeedAndPlan`, `seeded`, `generated`, `result`, `state`, `validation`, `compiled`, `runner`, `memoryPath`, `seed`, `requestId`, `planId`, `safeState`, `enqueued`, `realRequest`, `withRealPlan`, `cleared`, `learning`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/dev/runtimeHarnessBridge.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/dev/../aliceMemory`, `src/dev/runtimeHarnessBridge.js`.
- Casos/simbolos identificados: `task`, `script`, `result`, `runner`, `request`, `first`, `second`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/filesystem/filesystemNameSanitizer.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/filesystem/filesystemNameSanitizer.js`.
- Casos/simbolos identificados: `result`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/geminiLive.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/geminiLive.js`.
- Casos/simbolos identificados: `url`, `event`, `callbackState`, `session`, `connectPromise`, `socket`, `closeReasons`, `errors`, `originalSetTimeout`, `FakeWebSocket`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/hud/AliceHud.test.jsx`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `react-dom/server`, `vitest`, `src/hud/AliceHud.jsx`, `src/hud/mindMap/utils/mindMapData.js`, `src/hud/pages/KnowledgeHudPage.jsx`, `src/hud/pages/MindMapHudPage.jsx`, `src/hud/pages/AutonomyHudPage.jsx`, `src/hud/pages/AutonomousLearningHudPage.jsx`, `src/hud/pages/AutonomousRunnerHudPage.jsx`, `src/hud/pages/DebugHudPage.jsx`.
- Casos/simbolos identificados: `buildProps`, `modules`, `html`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/hud/hudViewModel.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/hud/hudViewModel.js`.
- Casos/simbolos identificados: `groups`, `cards`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/hud/mindMap/CustomNode.test.jsx`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `react-dom/server`, `vitest`, `src/hud/mindMap/CustomNode.jsx`.
- Casos/simbolos identificados: `html`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/hud/pages/AutonomousLearningHudPage.test.jsx`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `react-dom/server`, `vitest`, `src/hud/pages/AutonomousLearningHudPage.jsx`, `src/hud/pages/learningPlannerHudViewModel.js`.
- Casos/simbolos identificados: `plan`, `renderPage`, `html`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/hud/pages/runnerHudViewModel.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/hud/pages/runnerHudViewModel.js`.
- Casos/simbolos identificados: `task`, `sorted`, `tasks`, `doneTask`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/knowledgePipeline.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/knowledgePipeline.js`, `src/webKnowledge.js`.
- Casos/simbolos identificados: `buildContext`, `buildPage`, `invokeTool`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/knowledgeToolExecutor.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/knowledgeToolExecutor.js`.
- Casos/simbolos identificados: `response`, `invokeTool`, `result`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/learningPlanner/learningPlanner.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `react`, `react-dom/server`, `src/learningPlanner/../aliceMemory`, `src/learningPlanner/../debugHud`, `src/learningPlanner/../dev/autonomousRunnerHarness`, `src/learningPlanner/../autonomousRunnerEvidence`, `src/learningPlanner/../autonomousRunnerPreflight`, `src/learningPlanner/../autonomousRunnerValidation`, `src/learningPlanner/../hud/pages/AutonomousLearningHudPage`, `src/learningPlanner/learningPlannerTypes.js`, `src/learningPlanner/learningPlanSchema.js`, `src/learningPlanner/learningPlannerClient.js`, `src/learningPlanner/fakeLearningPlannerModelClient.js`, `src/learningPlanner/learningPlannerService.js` (+7).
- Casos/simbolos identificados: `validPlan`, `validModelResponse`, `validExecutablePracticePlan`, `createRunnerInvoke`, `learningAttempt`, `runnerTaskForAttempt`, `runnerForAttempts`, `memoryWithConsolidationCandidate`, `attempts`, `plan`, `withPlanner`, `result`, `memory`, `validation`, `nextMemory`, `state`, `rejected`, `client`, `timeout`, `service` (+31).
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/liveAudio.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/liveAudio.js`.
- Casos/simbolos identificados: `samples`, `encoded`, `decoded`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/liveDiagnostics.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/liveDiagnostics.js`.
- Casos/simbolos identificados: `diagnostics`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/liveSessionOrchestrator.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/geminiLive.js`, `src/liveSessionOrchestrator.js`.
- Casos/simbolos identificados: `buildSetupStub`, `setup`, `buildConnectError`, `error`, `createSessionFactory`, `sessions`, `createSession`, `behavior`, `session`, `sessionReady`, `orchestrator`, `reconnectGate`, `firstReconnect`, `secondReconnect`, `statusUpdates`, `memoryPrefixTurns`, `closeReasons`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/liveSessionRehydration.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/liveSessionRehydration.js`.
- Casos/simbolos identificados: `trimmed`, `turns`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/liveSessionTransport.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/liveSessionTransport.js`.
- Casos/simbolos identificados: `call`, `transport`, `session`, `previousSession`, `resumedSession`, `functionResponse`, `replayedResponses`, `recreatedSession`, `firstSession`, `result`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/mindMapData.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/hud/mindMap/utils/mindMapData.js`.
- Casos/simbolos identificados: `upgraded`, `normalized`, `mindMap`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/mindMapExecutionSync.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/hud/mindMap/utils/mindMapData.js`, `src/mindMapExecutionSync.js`.
- Casos/simbolos identificados: `createGoalMap`, `result`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/mindMapIntentInterpreter.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/hud/mindMap/utils/mindMapData.js`, `src/mindMapIntentInterpreter.js`.
- Casos/simbolos identificados: `operations`, `mindMap`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/mindMapToolExecutor.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/hud/mindMap/utils/mindMapData.js`, `src/mindMapToolExecutor.js`.
- Casos/simbolos identificados: `result`, `currentMindMap`, `renamed`, `exported`, `removed`, `mapA`, `mapB`, `updated`, `rolledBack`, `activeMap`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/operationalContext.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/operationalContext.js`.
- Casos/simbolos identificados: `text`, `turns`, `snapshot`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/runnerAppDiagnostics.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/aliceMemory.js`, `src/runnerAppDiagnostics.js`.
- Casos/simbolos identificados: `memory`, `audit`, `snapshot`, `metadata`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/screenFrameStreaming.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/screenFrameStreaming.js`.
- Casos/simbolos identificados: `drawImage`, `video`, `canvas`, `frame`, `intervalIds`, `timerHost`, `onFrame`, `cleanup`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/screenGeometry.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/screenGeometry.js`.
- Casos/simbolos identificados: nenhum identificado estaticamente.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/tauriRuntime.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/tauriRuntime.js`.
- Casos/simbolos identificados: nenhum identificado estaticamente.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## `src/webKnowledge.test.js`

- Dominio: Testes.
- Protege: Teste/fixture que protege comportamento do dominio Testes.
- Imports/fixtures: `vitest`, `src/webKnowledge.js`.
- Casos/simbolos identificados: `navigationContext`, `state`.
- Garantia: valida contrato local descrito pelos casos e evita regressao do modulo alvo inferido pelo nome/imports.

## Lacunas percebidas

- `App.jsx` tem teste pequeno perto do tamanho e da criticidade do orquestrador.
- Nao ha garantia end-to-end nesta analise para Gemini Live real, Tauri real, extensao Edge instalada e VM real.
- Guest agent tem unit tests, mas ambiente Windows/VM/Guest Additions/elevacao nao e coberto estaticamente.
- React Flow/mind map visual carece de teste de interacao em browser real.
- Persistencia fisica em `data/evidence` nao foi exercitada para respeitar a restricao de nao mexer em evidencias reais.

## Comandos de teste

```powershell
npm test
npm run lint
npm run build
cd src-tauri
cargo test
cargo test --features desktop-commands
cd ..
python -m unittest .\src-tauri\python_sidecar\tests\test_sidecar.py
python -m unittest discover .\src-tauri\vm\guest_agent\tests
```
