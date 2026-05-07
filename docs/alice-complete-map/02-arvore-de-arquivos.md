# Arvore de arquivos

            ## Arvore relevante

            ```text
            Pastas principais:
- alice-core/
- docs/
- edge-extension/
- public/
- scripts/
- src/
- src-tauri/

Arquivos analisados:
- .gitignore
- AGENTS.MD
- README.md
- alice-core/.gitignore
- alice-core/Cargo.lock
- alice-core/Cargo.toml
- alice-core/src/lib.rs
- docs/autonomous-runner-dev-harness.md
- docs/autonomous-runner-hardening-checklist.md
- docs/handoff-2026-05-01-learning.md
- docs/learning-planner-implementation-map.md
- edge-extension/background.js
- edge-extension/captureEvents.js
- edge-extension/captureEvents.test.js
- edge-extension/manifest.json
- erros.md
- eslint.config.js
- index.html
- package-lock.json
- package.json
- public/favicon.svg
- scripts/alice-code-auditor.mjs
- scripts/alice-code-auditor.test.mjs
- scripts/learning-planner-harness.mjs
- scripts/runner-harness.mjs
- src-tauri/.gitignore
- src-tauri/Cargo.lock
- src-tauri/Cargo.toml
- src-tauri/build.rs
- src-tauri/capabilities/default.json
- src-tauri/python_sidecar/alice_window_sidecar.py
- src-tauri/python_sidecar/main.py
- src-tauri/python_sidecar/tests/test_sidecar.py
- src-tauri/src/autonomous_playground.rs
- src-tauri/src/host_versioning.rs
- src-tauri/src/legacy_desktop_commands.rs
- src-tauri/src/lib.rs
- src-tauri/src/local_vm.rs
- src-tauri/src/main.rs
- src-tauri/src/python_sidecar.rs
- src-tauri/src/vm_visual.rs
- src-tauri/src/web_knowledge.rs
- src-tauri/tauri.conf.json
- src-tauri/tests/fixtures/web_knowledge/long_article.html
- src-tauri/tests/fixtures/web_knowledge/noisy_navigation_links.html
- src-tauri/tests/fixtures/web_knowledge/selected_text_page.html
- src-tauri/tests/fixtures/web_knowledge/tables_and_lists.html
- src-tauri/tests/fixtures/web_knowledge/technical_docs.html
- src-tauri/tests/fixtures/web_knowledge/thin_landing_page.html
- src-tauri/vm/guest_agent/action_executor.py
- src-tauri/vm/guest_agent/agent.py
- src-tauri/vm/guest_agent/background_runner.py
- src-tauri/vm/guest_agent/element_recognition.py
- src-tauri/vm/guest_agent/input_controller.py
- src-tauri/vm/guest_agent/ocr.py
- src-tauri/vm/guest_agent/protocol.py
- src-tauri/vm/guest_agent/screen_capture.py
- src-tauri/vm/guest_agent/server.py
- src-tauri/vm/guest_agent/tests/test_background_actions.py
- src-tauri/vm/guest_agent/tests/test_input_controller.py
- src-tauri/vm/guest_agent/tests/test_resident_server.py
- src-tauri/vm/guest_agent/validation.py
- src-tauri/vm/guest_agent/visual_context.py
- src/App.css
- src/App.jsx
- src/App.test.js
- src/alice.js
- src/alice.test.js
- src/aliceMemory.js
- src/aliceMemory.test.js
- src/aliceMemoryPersistence.js
- src/aliceMemoryPersistence.test.js
- src/appUiState.js
- src/autonomousCapabilityScanner.js
- src/autonomousContextRepair.test.js
- src/autonomousExperimentStrategies.js
- src/autonomousFailureSignatureBuilder.js
- src/autonomousFailureSignatureBuilder.test.js
- src/autonomousLearning.test.js
- src/autonomousLearning/actionOrchestrator.js
- src/autonomousLearning/appAutomation.js
- src/autonomousLearning/auditPersistence.js
- src/autonomousLearning/behaviorContext.js
- src/autonomousLearning/behaviorContext.test.js
- src/autonomousLearning/centralOrchestrator.js
- src/autonomousLearning/contracts.js
- src/autonomousLearning/decisionEngine.js
- src/autonomousLearning/decisionEngine.test.js
- src/autonomousLearning/hooks.js
- src/autonomousLearning/index.js
- src/autonomousLearning/internalState.js
- src/autonomousLearning/learning.js
- src/autonomousLearning/localVmProviders.js
- src/autonomousLearning/localWorkspacePlayground.js
- src/autonomousLearning/policies.js
- src/autonomousLearning/projectScanner.js
- src/autonomousLearning/replayRecorder.js
- src/autonomousLearning/research.js
- src/autonomousLearning/selfImprovement.js
- src/autonomousLearning/state.js
- src/autonomousLearning/taskOrchestrator.js
- src/autonomousLearning/turnContext.js
- src/autonomousLearning/validation.js
- src/autonomousLearning/versioning.js
- src/autonomousLearning/visualLoop.js
- src/autonomousLearning/vmController.js
- src/autonomousLearning/vmOperationalTask.js
- src/autonomousLearning/vmTextInputDriver.js
- src/autonomousLearning/vmTextInputDriver.test.js
- src/autonomousLearning/vmUiModels.js
- src/autonomousLearningGoals.js
- src/autonomousLearningLoop.js
- src/autonomousLearningLoop.test.js
- src/autonomousLearningPlanner.js
- src/autonomousLearningPolicy.js
- src/autonomousLearningToolExecutor.js
- src/autonomousLearningValidator.js
- src/autonomousObservedLearning.js
- src/autonomousObservedLearning.test.js
- src/autonomousProcedureBenchmark.js
- src/autonomousProcedureComposer.js
- src/autonomousProcedureMatcher.js
- src/autonomousProcedureOptimizer.js
- src/autonomousProcedureOptimizer.test.js
- src/autonomousProcedurePromoter.js
- src/autonomousProcedureReuseEngine.js
- src/autonomousProcedureSimplifier.js
- src/autonomousProcedureVariantPlanner.js
- src/autonomousProcedureVersioning.js
- src/autonomousReuseIndex.js
- src/autonomousReusePolicy.js
- src/autonomousReuseValidator.js
- src/autonomousRunner.test.js
- src/autonomousRunnerEvidence.js
- src/autonomousRunnerExecutor.js
- src/autonomousRunnerLease.js
- src/autonomousRunnerMindMap.js
- src/autonomousRunnerPlanner.js
- src/autonomousRunnerPreflight.js
- src/autonomousRunnerRecoveryPlanner.js
- src/autonomousRunnerScheduler.js
- src/autonomousRunnerState.js
- src/autonomousRunnerTextInputDiagnostics.js
- src/autonomousRunnerToolExecutor.js
- src/autonomousRunnerValidation.js
- src/autonomousScriptSynthesizer.js
- src/autonomousTaskContext.js
- src/autonomousTaskRunner.js
- src/debugHud.js
- src/debugHud.test.js
- src/dev/autonomousRunnerHarness.js
- src/dev/autonomousRunnerHarness.test.js
- src/dev/learningPlannerHarness.js
- src/dev/learningPlannerHarness.test.js
- src/dev/runtimeHarnessBridge.js
- src/dev/runtimeHarnessBridge.test.js
- src/filesystem/filesystemNameSanitizer.js
- src/filesystem/filesystemNameSanitizer.test.js
- src/geminiLive.js
- src/geminiLive.test.js
- src/hud/AliceHud.jsx
- src/hud/AliceHud.test.jsx
- src/hud/components/DefinitionList.jsx
- src/hud/components/HudIcon.jsx
- src/hud/components/Sidebar.jsx
- src/hud/components/TopBar.jsx
- src/hud/hudViewModel.js
- src/hud/hudViewModel.test.js
- src/hud/mindMap/CustomNode.jsx
- src/hud/mindMap/CustomNode.test.jsx
- src/hud/mindMap/MindMapEditor.jsx
- src/hud/mindMap/utils/export.js
- src/hud/mindMap/utils/layout.js
- src/hud/mindMap/utils/mindMapData.js
- src/hud/mindMap/utils/storage.js
- src/hud/pages/AutonomousLearningHudPage.jsx
- src/hud/pages/AutonomousLearningHudPage.test.jsx
- src/hud/pages/AutonomousRunnerHudPage.jsx
- src/hud/pages/AutonomyHudPage.jsx
- src/hud/pages/DebugHudPage.jsx
- src/hud/pages/KnowledgeHudPage.jsx
- src/hud/pages/LiveHudPage.jsx
- src/hud/pages/MindMapHudPage.jsx
- src/hud/pages/learningPlannerHudViewModel.js
- src/hud/pages/runnerHudViewModel.js
- src/hud/pages/runnerHudViewModel.test.js
- src/index.css
- src/knowledgePipeline.js
- src/knowledgePipeline.test.js
- src/knowledgeToolExecutor.js
- src/knowledgeToolExecutor.test.js
- src/learningPlanner/fakeLearningPlannerModelClient.js
- src/learningPlanner/learningEvaluator.js
- src/learningPlanner/learningPlanSchema.js
- src/learningPlanner/learningPlanValidator.js
- src/learningPlanner/learningPlanner.test.js
- src/learningPlanner/learningPlannerClient.js
- src/learningPlanner/learningPlannerExecution.js
- src/learningPlanner/learningPlannerRepository.js
- src/learningPlanner/learningPlannerService.js
- src/learningPlanner/learningPlannerState.js
- src/learningPlanner/learningPlannerTypes.js
- src/learningPlanner/learningProcedureSynthesizer.js
- src/learningPlanner/learningTaskCompiler.js
- src/liveAudio.js
- src/liveAudio.test.js
- src/liveDiagnostics.js
- src/liveDiagnostics.test.js
- src/liveSessionOrchestrator.js
- src/liveSessionOrchestrator.test.js
- src/liveSessionRehydration.js
- src/liveSessionRehydration.test.js
- src/liveSessionTransport.js
- src/liveSessionTransport.test.js
- src/main.jsx
- src/mindMapData.test.js
- src/mindMapExecutionSync.js
- src/mindMapExecutionSync.test.js
- src/mindMapIntentInterpreter.js
- src/mindMapIntentInterpreter.test.js
- src/mindMapToolExecutor.js
- src/mindMapToolExecutor.test.js
- src/operationalContext.js
- src/operationalContext.test.js
- src/runnerAppDiagnostics.js
- src/runnerAppDiagnostics.test.js
- src/screenFrameStreaming.js
- src/screenFrameStreaming.test.js
- src/screenGeometry.js
- src/screenGeometry.test.js
- src/tauriRuntime.js
- src/tauriRuntime.test.js
- src/webKnowledge.js
- src/webKnowledge.test.js
- start-alice.ps1
- vite.config.js
            ```

            ## Pastas ignoradas e motivo

            - `.git/`: metadados Git, nao faz parte da arquitetura executavel.
- `node_modules/`: dependencias instaladas, geradas por `npm install`.
- `dist/`, `build/`, `target/`: saidas de build Vite/Tauri/Rust.
- `data/`: estado real/runtime, memoria e evidencias; ignorado para nao tocar em memoria/evidencia real.
- `.harness-smoke/`: artefatos grandes de smoke/harness.
- `src-tauri/gen/`: schemas gerados pelo Tauri.
- `__pycache__/`, `*.pyc`: caches Python.
- `*.log`, `*.out`, `*.err`: saidas de execucao/log.
- imagens e binarios (`*.png`, `*.ico`, `*.icns`): assets binarios listados como ignorados, nao analisados linha a linha.

            ## Responsabilidade das pastas principais

            - `src/`: frontend React e logica JS de dominio.
- `src/hud/`: HUD, paginas e componentes.
- `src/autonomousLearning/`: autonomia modular, politicas, VM, validacao, aprendizado e auditoria.
- `src/learningPlanner/`: planejamento estruturado de aprendizado e compilacao para Runner.
- `src/dev/`: harnesses e ponte dev runtime.
- `src/filesystem/`: sanitizacao de nomes/caminhos para tarefas.
- `src-tauri/src/`: backend Rust/Tauri.
- `src-tauri/vm/guest_agent/`: agente Python executado dentro da VM.
- `src-tauri/python_sidecar/`: sidecar Python do host para comandos de janela legados.
- `edge-extension/`: extensao Edge e bridge de captura de DOM.
- `scripts/`: auditor e harnesses CLI.
- `docs/`: documentacao tecnica.
- `alice-core/`: crate Rust auxiliar isolado.
- `public/`: assets textuais publicos analisaveis.

            ## Agrupamento por dominio

            ### Aprendizado/autonomia

- `src/autonomousLearning/actionOrchestrator.js`
- `src/autonomousLearning/appAutomation.js`
- `src/autonomousLearning/auditPersistence.js`
- `src/autonomousLearning/behaviorContext.js`
- `src/autonomousLearning/centralOrchestrator.js`
- `src/autonomousLearning/contracts.js`
- `src/autonomousLearning/decisionEngine.js`
- `src/autonomousLearning/hooks.js`
- `src/autonomousLearning/index.js`
- `src/autonomousLearning/internalState.js`
- `src/autonomousLearning/learning.js`
- `src/autonomousLearning/localVmProviders.js`
- `src/autonomousLearning/localWorkspacePlayground.js`
- `src/autonomousLearning/policies.js`
- `src/autonomousLearning/projectScanner.js`
- `src/autonomousLearning/replayRecorder.js`
- `src/autonomousLearning/research.js`
- `src/autonomousLearning/selfImprovement.js`
- `src/autonomousLearning/state.js`
- `src/autonomousLearning/taskOrchestrator.js`
- `src/autonomousLearning/turnContext.js`
- `src/autonomousLearning/validation.js`
- `src/autonomousLearning/versioning.js`
- `src/autonomousLearning/visualLoop.js`
- `src/autonomousLearning/vmController.js`
- `src/autonomousLearning/vmOperationalTask.js`
- `src/autonomousLearning/vmTextInputDriver.js`
- `src/autonomousLearning/vmUiModels.js`
- `src/autonomousLearningGoals.js`
- `src/autonomousLearningLoop.js`
- `src/autonomousLearningPlanner.js`
- `src/autonomousLearningPolicy.js`
- `src/autonomousLearningToolExecutor.js`
- `src/autonomousLearningValidator.js`
- `src/autonomousProcedureBenchmark.js`
- `src/autonomousProcedureComposer.js`
- `src/autonomousProcedureMatcher.js`
- `src/autonomousProcedureOptimizer.js`
- `src/autonomousProcedurePromoter.js`
- `src/autonomousProcedureReuseEngine.js`
- `src/autonomousProcedureSimplifier.js`
- `src/autonomousProcedureVariantPlanner.js`
- `src/autonomousProcedureVersioning.js`
- `src/autonomousReuseIndex.js`
- `src/autonomousReusePolicy.js`
- `src/autonomousReuseValidator.js`
### Autonomous Task Runner

- `src/autonomousRunnerEvidence.js`
- `src/autonomousRunnerExecutor.js`
- `src/autonomousRunnerLease.js`
- `src/autonomousRunnerPlanner.js`
- `src/autonomousRunnerPreflight.js`
- `src/autonomousRunnerRecoveryPlanner.js`
- `src/autonomousRunnerScheduler.js`
- `src/autonomousRunnerState.js`
- `src/autonomousRunnerTextInputDiagnostics.js`
- `src/autonomousRunnerToolExecutor.js`
- `src/autonomousRunnerValidation.js`
- `src/autonomousTaskRunner.js`
- `src/runnerAppDiagnostics.js`
### Backend Tauri/Rust

- `src-tauri/build.rs`
- `src-tauri/src/autonomous_playground.rs`
- `src-tauri/src/host_versioning.rs`
- `src-tauri/src/legacy_desktop_commands.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/local_vm.rs`
- `src-tauri/src/main.rs`
- `src-tauri/src/python_sidecar.rs`
- `src-tauri/src/vm_visual.rs`
- `src-tauri/src/web_knowledge.rs`
### Configuracao/build

- `.gitignore`
- `alice-core/.gitignore`
- `alice-core/Cargo.lock`
- `alice-core/Cargo.toml`
- `eslint.config.js`
- `index.html`
- `package-lock.json`
- `package.json`
- `src-tauri/.gitignore`
- `src-tauri/Cargo.lock`
- `src-tauri/Cargo.toml`
- `src-tauri/capabilities/default.json`
- `src-tauri/tauri.conf.json`
- `start-alice.ps1`
- `vite.config.js`
### Conhecimento web

- `src/knowledgePipeline.js`
- `src/knowledgeToolExecutor.js`
- `src/webKnowledge.js`
### Core Rust auxiliar

- `alice-core/src/lib.rs`
### Documentacao

- `AGENTS.MD`
- `README.md`
- `docs/autonomous-runner-dev-harness.md`
- `docs/autonomous-runner-hardening-checklist.md`
- `docs/handoff-2026-05-01-learning.md`
- `docs/learning-planner-implementation-map.md`
- `erros.md`
### Filesystem/sanitizacao

- `src/filesystem/filesystemNameSanitizer.js`
### Frontend/orquestracao

- `src/App.css`
- `src/App.jsx`
- `src/alice.js`
- `src/appUiState.js`
- `src/autonomousCapabilityScanner.js`
- `src/autonomousExperimentStrategies.js`
- `src/autonomousFailureSignatureBuilder.js`
- `src/autonomousObservedLearning.js`
- `src/autonomousScriptSynthesizer.js`
- `src/autonomousTaskContext.js`
- `src/debugHud.js`
- `src/index.css`
- `src/main.jsx`
- `src/tauriRuntime.js`
### Gemini Live/audio/tela

- `src/geminiLive.js`
- `src/liveAudio.js`
- `src/liveDiagnostics.js`
- `src/liveSessionOrchestrator.js`
- `src/liveSessionRehydration.js`
- `src/liveSessionTransport.js`
- `src/operationalContext.js`
- `src/screenFrameStreaming.js`
- `src/screenGeometry.js`
### Guest agent

- `src-tauri/vm/guest_agent/action_executor.py`
- `src-tauri/vm/guest_agent/agent.py`
- `src-tauri/vm/guest_agent/background_runner.py`
- `src-tauri/vm/guest_agent/element_recognition.py`
- `src-tauri/vm/guest_agent/input_controller.py`
- `src-tauri/vm/guest_agent/ocr.py`
- `src-tauri/vm/guest_agent/protocol.py`
- `src-tauri/vm/guest_agent/screen_capture.py`
- `src-tauri/vm/guest_agent/server.py`
- `src-tauri/vm/guest_agent/validation.py`
- `src-tauri/vm/guest_agent/visual_context.py`
### HUD

- `src/hud/AliceHud.jsx`
- `src/hud/components/DefinitionList.jsx`
- `src/hud/components/HudIcon.jsx`
- `src/hud/components/Sidebar.jsx`
- `src/hud/components/TopBar.jsx`
- `src/hud/hudViewModel.js`
- `src/hud/pages/AutonomousLearningHudPage.jsx`
- `src/hud/pages/AutonomousRunnerHudPage.jsx`
- `src/hud/pages/AutonomyHudPage.jsx`
- `src/hud/pages/DebugHudPage.jsx`
- `src/hud/pages/KnowledgeHudPage.jsx`
- `src/hud/pages/LiveHudPage.jsx`
- `src/hud/pages/learningPlannerHudViewModel.js`
- `src/hud/pages/runnerHudViewModel.js`
### Harness/dev

- `src/dev/autonomousRunnerHarness.js`
- `src/dev/learningPlannerHarness.js`
- `src/dev/runtimeHarnessBridge.js`
### Learning planner

- `src/learningPlanner/fakeLearningPlannerModelClient.js`
- `src/learningPlanner/learningEvaluator.js`
- `src/learningPlanner/learningPlanSchema.js`
- `src/learningPlanner/learningPlanValidator.js`
- `src/learningPlanner/learningPlannerClient.js`
- `src/learningPlanner/learningPlannerExecution.js`
- `src/learningPlanner/learningPlannerRepository.js`
- `src/learningPlanner/learningPlannerService.js`
- `src/learningPlanner/learningPlannerState.js`
- `src/learningPlanner/learningPlannerTypes.js`
- `src/learningPlanner/learningProcedureSynthesizer.js`
- `src/learningPlanner/learningTaskCompiler.js`
### Memoria persistente

- `src/aliceMemory.js`
- `src/aliceMemoryPersistence.js`
### Mind map

- `src/autonomousRunnerMindMap.js`
- `src/hud/mindMap/CustomNode.jsx`
- `src/hud/mindMap/MindMapEditor.jsx`
- `src/hud/mindMap/utils/export.js`
- `src/hud/mindMap/utils/layout.js`
- `src/hud/mindMap/utils/mindMapData.js`
- `src/hud/mindMap/utils/storage.js`
- `src/hud/pages/MindMapHudPage.jsx`
- `src/mindMapExecutionSync.js`
- `src/mindMapIntentInterpreter.js`
- `src/mindMapToolExecutor.js`
### Navegador/bridge/extensao

- `edge-extension/background.js`
- `edge-extension/captureEvents.js`
- `edge-extension/manifest.json`
### Outro

- `public/favicon.svg`
### Scripts/dev

- `scripts/alice-code-auditor.mjs`
- `scripts/learning-planner-harness.mjs`
- `scripts/runner-harness.mjs`
### Sidecar Python host

- `src-tauri/python_sidecar/alice_window_sidecar.py`
- `src-tauri/python_sidecar/main.py`
### Testes

- `edge-extension/captureEvents.test.js`
- `scripts/alice-code-auditor.test.mjs`
- `src-tauri/python_sidecar/tests/test_sidecar.py`
- `src-tauri/tests/fixtures/web_knowledge/long_article.html`
- `src-tauri/tests/fixtures/web_knowledge/noisy_navigation_links.html`
- `src-tauri/tests/fixtures/web_knowledge/selected_text_page.html`
- `src-tauri/tests/fixtures/web_knowledge/tables_and_lists.html`
- `src-tauri/tests/fixtures/web_knowledge/technical_docs.html`
- `src-tauri/tests/fixtures/web_knowledge/thin_landing_page.html`
- `src-tauri/vm/guest_agent/tests/test_background_actions.py`
- `src-tauri/vm/guest_agent/tests/test_input_controller.py`
- `src-tauri/vm/guest_agent/tests/test_resident_server.py`
- `src/App.test.js`
- `src/alice.test.js`
- `src/aliceMemory.test.js`
- `src/aliceMemoryPersistence.test.js`
- `src/autonomousContextRepair.test.js`
- `src/autonomousFailureSignatureBuilder.test.js`
- `src/autonomousLearning.test.js`
- `src/autonomousLearning/behaviorContext.test.js`
- `src/autonomousLearning/decisionEngine.test.js`
- `src/autonomousLearning/vmTextInputDriver.test.js`
- `src/autonomousLearningLoop.test.js`
- `src/autonomousObservedLearning.test.js`
- `src/autonomousProcedureOptimizer.test.js`
- `src/autonomousRunner.test.js`
- `src/debugHud.test.js`
- `src/dev/autonomousRunnerHarness.test.js`
- `src/dev/learningPlannerHarness.test.js`
- `src/dev/runtimeHarnessBridge.test.js`
- `src/filesystem/filesystemNameSanitizer.test.js`
- `src/geminiLive.test.js`
- `src/hud/AliceHud.test.jsx`
- `src/hud/hudViewModel.test.js`
- `src/hud/mindMap/CustomNode.test.jsx`
- `src/hud/pages/AutonomousLearningHudPage.test.jsx`
- `src/hud/pages/runnerHudViewModel.test.js`
- `src/knowledgePipeline.test.js`
- `src/knowledgeToolExecutor.test.js`
- `src/learningPlanner/learningPlanner.test.js`
- `src/liveAudio.test.js`
- `src/liveDiagnostics.test.js`
- `src/liveSessionOrchestrator.test.js`
- `src/liveSessionRehydration.test.js`
- `src/liveSessionTransport.test.js`
- `src/mindMapData.test.js`
- `src/mindMapExecutionSync.test.js`
- `src/mindMapIntentInterpreter.test.js`
- `src/mindMapToolExecutor.test.js`
- `src/operationalContext.test.js`
- `src/runnerAppDiagnostics.test.js`
- `src/screenFrameStreaming.test.js`
- `src/screenGeometry.test.js`
- `src/tauriRuntime.test.js`
- `src/webKnowledge.test.js`

            ## Observacoes sobre organizacao

            A organizacao tem bons recortes por dominio (`hud`, `autonomousLearning`, `learningPlanner`, `src-tauri/src`, `guest_agent`), mas tambem apresenta concentracao forte em arquivos grandes: `App.jsx`, `aliceMemory.js`, `autonomousLearningToolExecutor.js`, `src-tauri/src/lib.rs` e `web_knowledge.rs`. Ha camadas de aprendizado/autonomia em mais de um conjunto de arquivos, o que exige cuidado para evitar duplicacao de responsabilidades.
