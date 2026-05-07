# Modulos por dominio funcional

## Inicializacao da aplicacao

- Para que serve: organiza o dominio `Inicializacao da aplicacao` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `index.html`, `src/main.jsx`, `src/App.jsx`, `src/appUiState.js`, `src/tauriRuntime.js`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: `src/App.css`, `src/App.jsx`, `src/alice.js`, `src/aliceMemory.js`, `src/aliceMemoryPersistence.js`, `src/appUiState.js`, `src/autonomousLearning/index.js`, `src/autonomousLearningGoals.js`, `src/autonomousLearningLoop.js`, `src/autonomousLearningToolExecutor.js`, `src/autonomousObservedLearning.js`, `src/autonomousRunnerLease.js`, `src/autonomousRunnerMindMap.js`, `src/autonomousRunnerToolExecutor.js`, `src/autonomousTaskRunner.js`, `src/debugHud.js`, `src/dev/runtimeHarnessBridge.js`, `src/geminiLive.js`, `src/hud/AliceHud.jsx`, `src/index.css`, `src/knowledgeToolExecutor.js`, `src/learningPlanner/learningPlannerService.js`, `src/liveAudio.js`, `src/liveDiagnostics.js`, `src/liveSessionOrchestrator.js`, `src/liveSessionRehydration.js`, `src/liveSessionTransport.js`, `src/mindMapExecutionSync.js`, `src/mindMapToolExecutor.js`, `src/operationalContext.js` (+5).
- Dependencias externas: `@tauri-apps/api/core`, `@xyflow/react/dist/style.css`, `autonomous_playground`, `host_versioning`, `legacy_desktop_commands`, `local_vm`, `python_sidecar`, `react`, `react-dom/client`, `serde::{Deserialize, Serialize}`, `serde_json::{json, Value}`, `std::collections::HashMap`, `std::fs::{self, File}`, `std::io::Write`, `std::mem::size_of`, `std::path::{Path, PathBuf}`, `std::process::Command`, `std::process::{Command, Stdio}`, `std::ptr::null`, `std::time::Duration`, `tauri::Manager`, `tests {
    use super::*`, `vm_visual`, `wait_timeout::ChildExt`, `web_knowledge` (+6).
- Arquivos mais criticos: `src/App.jsx`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`.
- Testes existentes: `src/App.test.js`, `src/runnerAppDiagnostics.test.js`, `src/tauriRuntime.test.js`.
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

## Orquestracao central

- Para que serve: organiza o dominio `Orquestracao central` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `src/App.jsx`, `src/alice.js`, `src/aliceMemory.js`, `src/runnerAppDiagnostics.js`, `src/debugHud.js`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: `src/App.css`, `src/alice.js`, `src/aliceMemory.js`, `src/aliceMemoryPersistence.js`, `src/appUiState.js`, `src/autonomousLearning/auditPersistence.js`, `src/autonomousLearning/index.js`, `src/autonomousLearningGoals.js`, `src/autonomousLearningLoop.js`, `src/autonomousLearningPolicy.js`, `src/autonomousLearningToolExecutor.js`, `src/autonomousObservedLearning.js`, `src/autonomousReuseIndex.js`, `src/autonomousRunnerLease.js`, `src/autonomousRunnerMindMap.js`, `src/autonomousRunnerState.js`, `src/autonomousRunnerToolExecutor.js`, `src/autonomousTaskRunner.js`, `src/debugHud.js`, `src/dev/runtimeHarnessBridge.js`, `src/geminiLive.js`, `src/hud/AliceHud.jsx`, `src/hud/mindMap/utils/mindMapData.js`, `src/knowledgeToolExecutor.js`, `src/learningPlanner/learningPlannerService.js`, `src/liveAudio.js`, `src/liveSessionOrchestrator.js`, `src/liveSessionRehydration.js`, `src/liveSessionTransport.js`, `src/mindMapExecutionSync.js` (+7).
- Dependencias externas: `@tauri-apps/api/core`, `react`.
- Arquivos mais criticos: `src/App.jsx`, `src/alice.js`, `src/aliceMemory.js`, `src/runnerAppDiagnostics.js`.
- Testes existentes: `scripts/alice-code-auditor.test.mjs`, `src/alice.test.js`, `src/aliceMemory.test.js`, `src/aliceMemoryPersistence.test.js`, `src/App.test.js`, `src/debugHud.test.js`, `src/hud/AliceHud.test.jsx`, `src/runnerAppDiagnostics.test.js`.
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

## Gemini Live/conversa

- Para que serve: organiza o dominio `Gemini Live/conversa` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `src/geminiLive.js`, `src/liveAudio.js`, `src/liveDiagnostics.js`, `src/liveSessionOrchestrator.js`, `src/liveSessionRehydration.js`, `src/liveSessionTransport.js`, `src/operationalContext.js`, `src/screenFrameStreaming.js`, `src/screenGeometry.js`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: `src/geminiLive.js`.
- Dependencias externas: nenhum identificado estaticamente.
- Arquivos mais criticos: `src/geminiLive.js`, `src/liveSessionOrchestrator.js`, `src/liveSessionTransport.js`.
- Testes existentes: `src/geminiLive.test.js`, `src/liveAudio.test.js`, `src/liveDiagnostics.test.js`, `src/liveSessionOrchestrator.test.js`, `src/liveSessionRehydration.test.js`, `src/liveSessionTransport.test.js`, `src/operationalContext.test.js`, `src/screenFrameStreaming.test.js`, `src/screenGeometry.test.js`.
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

## Audio

- Para que serve: organiza o dominio `Audio` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `src/liveAudio.js`, `src/liveAudio.test.js`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: `src/liveAudio.js`.
- Dependencias externas: `vitest`.
- Arquivos mais criticos: nenhum identificado estaticamente.
- Testes existentes: `src/liveAudio.test.js`.
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

## Tela/screen frames

- Para que serve: organiza o dominio `Tela/screen frames` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `src/screenGeometry.js`, `src/screenFrameStreaming.js`, `src/screenGeometry.test.js`, `src/screenFrameStreaming.test.js`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: `src/screenFrameStreaming.js`, `src/screenGeometry.js`.
- Dependencias externas: `vitest`.
- Arquivos mais criticos: nenhum identificado estaticamente.
- Testes existentes: `src/screenFrameStreaming.test.js`, `src/screenGeometry.test.js`.
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

## Tool calls

- Para que serve: organiza o dominio `Tool calls` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `src/alice.js`, `src/App.jsx`, `src/liveSessionTransport.js`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: `src/App.css`, `src/alice.js`, `src/aliceMemory.js`, `src/aliceMemoryPersistence.js`, `src/appUiState.js`, `src/autonomousLearning/index.js`, `src/autonomousLearningGoals.js`, `src/autonomousLearningLoop.js`, `src/autonomousLearningToolExecutor.js`, `src/autonomousObservedLearning.js`, `src/autonomousRunnerLease.js`, `src/autonomousRunnerMindMap.js`, `src/autonomousRunnerToolExecutor.js`, `src/autonomousTaskRunner.js`, `src/debugHud.js`, `src/dev/runtimeHarnessBridge.js`, `src/geminiLive.js`, `src/hud/AliceHud.jsx`, `src/knowledgeToolExecutor.js`, `src/learningPlanner/learningPlannerService.js`, `src/liveAudio.js`, `src/liveSessionOrchestrator.js`, `src/liveSessionRehydration.js`, `src/liveSessionTransport.js`, `src/mindMapExecutionSync.js`, `src/mindMapToolExecutor.js`, `src/operationalContext.js`, `src/runnerAppDiagnostics.js`, `src/screenFrameStreaming.js`, `src/screenGeometry.js` (+2).
- Dependencias externas: `@tauri-apps/api/core`, `react`.
- Arquivos mais criticos: `src/alice.js`, `src/App.jsx`, `src/liveSessionTransport.js`.
- Testes existentes: `scripts/alice-code-auditor.test.mjs`, `src/alice.test.js`, `src/aliceMemory.test.js`, `src/aliceMemoryPersistence.test.js`, `src/App.test.js`, `src/hud/AliceHud.test.jsx`, `src/liveSessionTransport.test.js`, `src/runnerAppDiagnostics.test.js`.
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

## Tool executors

- Para que serve: organiza o dominio `Tool executors` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `src/knowledgeToolExecutor.js`, `src/mindMapToolExecutor.js`, `src/autonomousLearningToolExecutor.js`, `src/autonomousRunnerToolExecutor.js`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: `src/aliceMemory.js`, `src/autonomousLearning/index.js`, `src/hud/mindMap/utils/export.js`, `src/hud/mindMap/utils/layout.js`, `src/hud/mindMap/utils/mindMapData.js`, `src/knowledgePipeline.js`.
- Dependencias externas: `uuid`.
- Arquivos mais criticos: `src/knowledgeToolExecutor.js`, `src/mindMapToolExecutor.js`, `src/autonomousLearningToolExecutor.js`, `src/autonomousRunnerToolExecutor.js`.
- Testes existentes: `src/knowledgeToolExecutor.test.js`, `src/mindMapToolExecutor.test.js`.
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

## Memoria persistente

- Para que serve: organiza o dominio `Memoria persistente` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `src/aliceMemory.js`, `src/aliceMemoryPersistence.js`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: `src/aliceMemory.js`, `src/autonomousLearning/auditPersistence.js`, `src/autonomousLearningGoals.js`, `src/autonomousLearningPolicy.js`, `src/autonomousReuseIndex.js`, `src/autonomousRunnerState.js`, `src/hud/mindMap/utils/mindMapData.js`.
- Dependencias externas: `@tauri-apps/api/core`.
- Arquivos mais criticos: `src/aliceMemory.js`, `src/aliceMemoryPersistence.js`.
- Testes existentes: `src/aliceMemory.test.js`, `src/aliceMemoryPersistence.test.js`.
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

## Auditoria/logs

- Para que serve: organiza o dominio `Auditoria/logs` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `src/debugHud.js`, `src/runnerAppDiagnostics.js`, `src/autonomousLearning/auditPersistence.js`, `scripts/alice-code-auditor.mjs`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: `src/aliceMemory.js`, `src/autonomousLearning/contracts.js`, `src/autonomousLearning/state.js`, `src/autonomousRunnerState.js`, `src/learningPlanner/learningPlannerService.js`.
- Dependencias externas: `node:fs`, `node:fs/promises`, `node:path`, `node:process`.
- Arquivos mais criticos: `src/runnerAppDiagnostics.js`.
- Testes existentes: `scripts/alice-code-auditor.test.mjs`, `src/debugHud.test.js`, `src/runnerAppDiagnostics.test.js`.
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

## HUD

- Para que serve: organiza o dominio `HUD` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `src/hud/AliceHud.jsx`, `src/hud/components/DefinitionList.jsx`, `src/hud/components/HudIcon.jsx`, `src/hud/components/Sidebar.jsx`, `src/hud/components/TopBar.jsx`, `src/hud/hudViewModel.js`, `src/hud/pages/AutonomousLearningHudPage.jsx`, `src/hud/pages/AutonomousRunnerHudPage.jsx`, `src/hud/pages/AutonomyHudPage.jsx`, `src/hud/pages/DebugHudPage.jsx`, `src/hud/pages/KnowledgeHudPage.jsx`, `src/hud/pages/learningPlannerHudViewModel.js`, `src/hud/pages/LiveHudPage.jsx`, `src/hud/pages/runnerHudViewModel.js`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: `src/hud/components/HudIcon.jsx`, `src/hud/components/Sidebar.jsx`, `src/hud/components/TopBar.jsx`, `src/hud/hudViewModel.js`, `src/hud/pages/AutonomousLearningHudPage.jsx`, `src/hud/pages/AutonomousRunnerHudPage.jsx`, `src/hud/pages/AutonomyHudPage.jsx`, `src/hud/pages/DebugHudPage.jsx`, `src/hud/pages/KnowledgeHudPage.jsx`, `src/hud/pages/LiveHudPage.jsx`, `src/hud/pages/MindMapHudPage.jsx`, `src/hud/pages/learningPlannerHudViewModel.js`, `src/hud/pages/runnerHudViewModel.js`.
- Dependencias externas: `react`, `src/hud/components/../hudViewModel`, `src/hud/pages/../components/DefinitionList`, `src/hud/pages/../hudViewModel`.
- Arquivos mais criticos: `src/hud/AliceHud.jsx`.
- Testes existentes: `src/hud/AliceHud.test.jsx`, `src/hud/hudViewModel.test.js`, `src/hud/pages/AutonomousLearningHudPage.test.jsx`, `src/hud/pages/runnerHudViewModel.test.js`.
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

## Mind map

- Para que serve: organiza o dominio `Mind map` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `src/autonomousRunnerMindMap.js`, `src/hud/mindMap/CustomNode.jsx`, `src/hud/mindMap/MindMapEditor.jsx`, `src/hud/mindMap/utils/export.js`, `src/hud/mindMap/utils/layout.js`, `src/hud/mindMap/utils/mindMapData.js`, `src/hud/mindMap/utils/storage.js`, `src/hud/pages/MindMapHudPage.jsx`, `src/mindMapExecutionSync.js`, `src/mindMapIntentInterpreter.js`, `src/mindMapToolExecutor.js`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: `src/aliceMemory.js`, `src/autonomousLearningPolicy.js`, `src/hud/mindMap/CustomNode.jsx`, `src/hud/mindMap/utils/export.js`, `src/hud/mindMap/utils/layout.js`, `src/hud/mindMap/utils/mindMapData.js`, `src/hud/mindMap/utils/storage.js`.
- Dependencias externas: `@xyflow/react`, `dagre`, `html-to-image`, `lucide-react`, `react`, `src/hud/pages/../mindMap/MindMapEditor`, `uuid`.
- Arquivos mais criticos: `src/mindMapToolExecutor.js`.
- Testes existentes: `src/hud/mindMap/CustomNode.test.jsx`, `src/mindMapData.test.js`, `src/mindMapExecutionSync.test.js`, `src/mindMapIntentInterpreter.test.js`, `src/mindMapToolExecutor.test.js`.
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

## Autonomous Task Runner

- Para que serve: organiza o dominio `Autonomous Task Runner` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `src/autonomousRunnerEvidence.js`, `src/autonomousRunnerExecutor.js`, `src/autonomousRunnerLease.js`, `src/autonomousRunnerPlanner.js`, `src/autonomousRunnerPreflight.js`, `src/autonomousRunnerRecoveryPlanner.js`, `src/autonomousRunnerScheduler.js`, `src/autonomousRunnerState.js`, `src/autonomousRunnerTextInputDiagnostics.js`, `src/autonomousRunnerToolExecutor.js`, `src/autonomousRunnerValidation.js`, `src/autonomousTaskRunner.js`, `src/runnerAppDiagnostics.js`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: `src/aliceMemory.js`, `src/autonomousLearning/index.js`, `src/autonomousRunnerEvidence.js`, `src/autonomousRunnerExecutor.js`, `src/autonomousRunnerLease.js`, `src/autonomousRunnerPlanner.js`, `src/autonomousRunnerPreflight.js`, `src/autonomousRunnerRecoveryPlanner.js`, `src/autonomousRunnerScheduler.js`, `src/autonomousRunnerState.js`, `src/autonomousRunnerTextInputDiagnostics.js`, `src/autonomousRunnerValidation.js`, `src/filesystem/filesystemNameSanitizer.js`.
- Dependencias externas: `uuid`.
- Arquivos mais criticos: `src/autonomousRunnerEvidence.js`, `src/autonomousRunnerExecutor.js`, `src/autonomousRunnerLease.js`, `src/autonomousRunnerPlanner.js`, `src/autonomousRunnerPreflight.js`, `src/autonomousRunnerRecoveryPlanner.js`, `src/autonomousRunnerScheduler.js`, `src/autonomousRunnerState.js`, `src/autonomousRunnerTextInputDiagnostics.js`, `src/autonomousRunnerToolExecutor.js`, `src/autonomousRunnerValidation.js`, `src/autonomousTaskRunner.js`, `src/runnerAppDiagnostics.js`.
- Testes existentes: `src/runnerAppDiagnostics.test.js`.
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

## Aprendizado/autonomia

- Para que serve: organiza o dominio `Aprendizado/autonomia` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `src/autonomousLearning/actionOrchestrator.js`, `src/autonomousLearning/appAutomation.js`, `src/autonomousLearning/auditPersistence.js`, `src/autonomousLearning/behaviorContext.js`, `src/autonomousLearning/centralOrchestrator.js`, `src/autonomousLearning/contracts.js`, `src/autonomousLearning/decisionEngine.js`, `src/autonomousLearning/hooks.js`, `src/autonomousLearning/index.js`, `src/autonomousLearning/internalState.js`, `src/autonomousLearning/learning.js`, `src/autonomousLearning/localVmProviders.js`, `src/autonomousLearning/localWorkspacePlayground.js`, `src/autonomousLearning/policies.js`, `src/autonomousLearning/projectScanner.js`, `src/autonomousLearning/replayRecorder.js`, `src/autonomousLearning/research.js`, `src/autonomousLearning/selfImprovement.js`, `src/autonomousLearning/state.js`, `src/autonomousLearning/taskOrchestrator.js`, `src/autonomousLearning/turnContext.js`, `src/autonomousLearning/validation.js`, `src/autonomousLearning/versioning.js`, `src/autonomousLearning/visualLoop.js`, `src/autonomousLearning/vmController.js`, `src/autonomousLearning/vmOperationalTask.js`, `src/autonomousLearning/vmTextInputDriver.js`, `src/autonomousLearning/vmUiModels.js`, `src/autonomousLearningGoals.js`, `src/autonomousLearningLoop.js`, `src/autonomousLearningPlanner.js`, `src/autonomousLearningPolicy.js`, `src/autonomousLearningToolExecutor.js`, `src/autonomousLearningValidator.js`, `src/autonomousProcedureBenchmark.js`, `src/autonomousProcedureComposer.js`, `src/autonomousProcedureMatcher.js`, `src/autonomousProcedureOptimizer.js`, `src/autonomousProcedurePromoter.js`, `src/autonomousProcedureReuseEngine.js`, `src/autonomousProcedureSimplifier.js`, `src/autonomousProcedureVariantPlanner.js`, `src/autonomousProcedureVersioning.js`, `src/autonomousReuseIndex.js`, `src/autonomousReusePolicy.js`, `src/autonomousReuseValidator.js`, `src/learningPlanner/fakeLearningPlannerModelClient.js`, `src/learningPlanner/learningEvaluator.js`, `src/learningPlanner/learningPlannerClient.js`, `src/learningPlanner/learningPlannerExecution.js`, `src/learningPlanner/learningPlannerRepository.js`, `src/learningPlanner/learningPlannerService.js`, `src/learningPlanner/learningPlannerState.js`, `src/learningPlanner/learningPlannerTypes.js`, `src/learningPlanner/learningPlanSchema.js`, `src/learningPlanner/learningPlanValidator.js`, `src/learningPlanner/learningProcedureSynthesizer.js`, `src/learningPlanner/learningTaskCompiler.js`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: `src/aliceMemory.js`, `src/autonomousCapabilityScanner.js`, `src/autonomousExperimentStrategies.js`, `src/autonomousLearning/contracts.js`, `src/autonomousLearning/index.js`, `src/autonomousLearning/localVmProviders.js`, `src/autonomousLearning/localWorkspacePlayground.js`, `src/autonomousLearning/policies.js`, `src/autonomousLearning/replayRecorder.js`, `src/autonomousLearning/state.js`, `src/autonomousLearning/taskOrchestrator.js`, `src/autonomousLearning/validation.js`, `src/autonomousLearning/vmController.js`, `src/autonomousLearning/vmTextInputDriver.js`, `src/autonomousLearning/vmUiModels.js`, `src/autonomousLearningPlanner.js`, `src/autonomousLearningPolicy.js`, `src/autonomousLearningValidator.js`, `src/autonomousProcedureBenchmark.js`, `src/autonomousProcedureMatcher.js`, `src/autonomousProcedureOptimizer.js`, `src/autonomousProcedurePromoter.js`, `src/autonomousProcedureReuseEngine.js`, `src/autonomousProcedureSimplifier.js`, `src/autonomousProcedureVariantPlanner.js`, `src/autonomousProcedureVersioning.js`, `src/autonomousReuseIndex.js`, `src/autonomousReusePolicy.js`, `src/autonomousRunnerState.js`, `src/autonomousScriptSynthesizer.js` (+9).
- Dependencias externas: `src/autonomousLearning/../hud/mindMap/utils/mindMapData`, `src/learningPlanner/../aliceMemory`, `src/learningPlanner/../autonomousLearning/learning`, `src/learningPlanner/../autonomousRunnerState`, `src/learningPlanner/../autonomousTaskRunner`, `src/learningPlanner/../filesystem/filesystemNameSanitizer`.
- Arquivos mais criticos: `src/autonomousLearningToolExecutor.js`.
- Testes existentes: `src/autonomousLearning.test.js`, `src/autonomousLearning/behaviorContext.test.js`, `src/autonomousLearning/decisionEngine.test.js`, `src/autonomousLearning/vmTextInputDriver.test.js`, `src/autonomousLearningLoop.test.js`, `src/autonomousObservedLearning.test.js`, `src/autonomousProcedureOptimizer.test.js`, `src/dev/learningPlannerHarness.test.js`, `src/hud/pages/AutonomousLearningHudPage.test.jsx`, `src/learningPlanner/learningPlanner.test.js`.
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

## VM/local workspace

- Para que serve: organiza o dominio `VM/local workspace` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `src-tauri/src/local_vm.rs`, `src-tauri/src/autonomous_playground.rs`, `src-tauri/src/vm_visual.rs`, `src/autonomousLearning/localVmProviders.js`, `src/autonomousLearning/localWorkspacePlayground.js`, `src/autonomousLearning/vmController.js`, `src/autonomousLearning/vmOperationalTask.js`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: `src/autonomousLearning/contracts.js`, `src/autonomousLearning/localVmProviders.js`.
- Dependencias externas: `base64::Engine`, `serde::Deserialize`, `serde_json::json`, `serde_json::{json, Value}`, `std::collections::HashMap`, `std::fs`, `std::io::Write`, `std::path::{Component, Path, PathBuf}`, `std::path::{Path, PathBuf}`, `std::process::{Command, Stdio}`, `std::sync::{LazyLock, Mutex}`, `std::time::Duration`, `std::time::{Duration, Instant}`, `super::{
    alice_project_folder, truncate_shell_output, validate_path_string, NativeCommandResult,
    MAX_SHELL_TIMEOUT_MS,
}`, `super::{truncate_shell_output, NativeCommandResult, MAX_SHELL_TIMEOUT_MS}`, `tauri::Manager`, `tests {
    use super::*`, `wait_timeout::ChildExt`.
- Arquivos mais criticos: `src-tauri/src/local_vm.rs`, `src-tauri/src/autonomous_playground.rs`, `src-tauri/src/vm_visual.rs`.
- Testes existentes: nenhum identificado estaticamente.
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

## Guest agent

- Para que serve: organiza o dominio `Guest agent` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `src-tauri/vm/guest_agent/action_executor.py`, `src-tauri/vm/guest_agent/agent.py`, `src-tauri/vm/guest_agent/background_runner.py`, `src-tauri/vm/guest_agent/element_recognition.py`, `src-tauri/vm/guest_agent/input_controller.py`, `src-tauri/vm/guest_agent/ocr.py`, `src-tauri/vm/guest_agent/protocol.py`, `src-tauri/vm/guest_agent/screen_capture.py`, `src-tauri/vm/guest_agent/server.py`, `src-tauri/vm/guest_agent/validation.py`, `src-tauri/vm/guest_agent/visual_context.py`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: nenhum identificado estaticamente.
- Dependencias externas: `PIL`, `action_executor`, `argparse`, `base64`, `ctypes`, `ctypes.wintypes`, `element_recognition`, `http.server`, `input_controller`, `json`, `ocr`, `os`, `protocol`, `pytesseract`, `screen_capture`, `subprocess`, `sys`, `time`, `uuid`, `validation`, `visual_context`.
- Arquivos mais criticos: `src-tauri/vm/guest_agent/action_executor.py`, `src-tauri/vm/guest_agent/agent.py`, `src-tauri/vm/guest_agent/background_runner.py`, `src-tauri/vm/guest_agent/element_recognition.py`, `src-tauri/vm/guest_agent/input_controller.py`, `src-tauri/vm/guest_agent/ocr.py`, `src-tauri/vm/guest_agent/protocol.py`, `src-tauri/vm/guest_agent/screen_capture.py`, `src-tauri/vm/guest_agent/server.py`, `src-tauri/vm/guest_agent/validation.py`, `src-tauri/vm/guest_agent/visual_context.py`.
- Testes existentes: `src-tauri/vm/guest_agent/tests/test_background_actions.py`, `src-tauri/vm/guest_agent/tests/test_input_controller.py`, `src-tauri/vm/guest_agent/tests/test_resident_server.py`.
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

## Evidencias

- Para que serve: organiza o dominio `Evidencias` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `src/autonomousRunnerEvidence.js`, `src-tauri/src/lib.rs`, `src-tauri/src/host_versioning.rs`, `src/autonomousLearning/replayRecorder.js`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: `src/autonomousLearning/contracts.js`, `src/autonomousLearning/vmUiModels.js`, `src/autonomousRunnerState.js`, `src/autonomousRunnerTextInputDiagnostics.js`.
- Dependencias externas: `autonomous_playground`, `host_versioning`, `legacy_desktop_commands`, `local_vm`, `python_sidecar`, `serde::{Deserialize, Serialize}`, `serde_json::json`, `serde_json::{json, Value}`, `std::collections::HashMap`, `std::fs`, `std::fs::{self, File}`, `std::io::Read`, `std::io::Write`, `std::mem::size_of`, `std::path::{Path, PathBuf}`, `std::process::Command`, `std::process::{Command, Stdio}`, `std::ptr::null`, `std::time::Duration`, `super::{alice_project_folder, validate_path_string, NativeCommandResult}`, `tauri::Manager`, `tests {
    use super::*`, `uuid`, `vm_visual`, `wait_timeout::ChildExt` (+7).
- Arquivos mais criticos: `src/autonomousRunnerEvidence.js`, `src-tauri/src/lib.rs`, `src-tauri/src/host_versioning.rs`.
- Testes existentes: nenhum identificado estaticamente.
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

## Navegador/bridge/extensao

- Para que serve: organiza o dominio `Navegador/bridge/extensao` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `edge-extension/background.js`, `edge-extension/captureEvents.js`, `edge-extension/manifest.json`, `src/knowledgePipeline.js`, `src/knowledgeToolExecutor.js`, `src/webKnowledge.js`, `src-tauri/src/web_knowledge.rs`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: `edge-extension/captureEvents.js`, `src/knowledgePipeline.js`, `src/webKnowledge.js`.
- Dependencias externas: `crate::NativeCommandResult`, `reqwest::blocking::Client`, `scraper::{Html, Selector}`, `serde::{Deserialize, Serialize}`, `serde_json::{json, Value}`, `std::collections::HashSet`, `std::io::{Cursor, Read}`, `std::sync::{mpsc, Arc, Mutex}`, `std::thread`, `std::time::{Duration, SystemTime, UNIX_EPOCH}`, `tauri::State`, `tests {
    use super::*`, `tiny_http::{Header, Method, Response, Server, StatusCode}`, `url::Url`.
- Arquivos mais criticos: `src/knowledgePipeline.js`, `src/knowledgeToolExecutor.js`, `src-tauri/src/web_knowledge.rs`.
- Testes existentes: `edge-extension/captureEvents.test.js`, `src-tauri/tests/fixtures/web_knowledge/long_article.html`, `src-tauri/tests/fixtures/web_knowledge/noisy_navigation_links.html`, `src-tauri/tests/fixtures/web_knowledge/selected_text_page.html`, `src-tauri/tests/fixtures/web_knowledge/tables_and_lists.html`, `src-tauri/tests/fixtures/web_knowledge/technical_docs.html`, `src-tauri/tests/fixtures/web_knowledge/thin_landing_page.html`, `src-tauri/vm/guest_agent/tests/test_background_actions.py`, `src/knowledgePipeline.test.js`, `src/knowledgeToolExecutor.test.js`, `src/webKnowledge.test.js`.
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

## Backend Tauri/Rust

- Para que serve: organiza o dominio `Backend Tauri/Rust` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `src-tauri/build.rs`, `src-tauri/src/autonomous_playground.rs`, `src-tauri/src/host_versioning.rs`, `src-tauri/src/legacy_desktop_commands.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/local_vm.rs`, `src-tauri/src/main.rs`, `src-tauri/src/python_sidecar.rs`, `src-tauri/src/vm_visual.rs`, `src-tauri/src/web_knowledge.rs`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: nenhum identificado estaticamente.
- Dependencias externas: `autonomous_playground`, `base64::Engine`, `crate::NativeCommandResult`, `crate::python_sidecar`, `crate::{
    normalize_python_sidecar_error, perform_desktop_action, perform_local_action,
    validate_desktop_action, validate_local_action, DesktopAction, DesktopActionResult,
    LocalAction, NativeCommandResult,
}`, `host_versioning`, `legacy_desktop_commands`, `local_vm`, `python_sidecar`, `reqwest::blocking::Client`, `scraper::{Html, Selector}`, `serde::Deserialize`, `serde::{Deserialize, Serialize}`, `serde_json::json`, `serde_json::{json, Value}`, `std::collections::HashMap`, `std::collections::HashSet`, `std::env`, `std::fs`, `std::fs::{self, File}`, `std::io::Read`, `std::io::Write`, `std::io::{BufRead, BufReader, Write}`, `std::io::{Cursor, Read}`, `std::mem::size_of` (+33).
- Arquivos mais criticos: `src-tauri/build.rs`, `src-tauri/src/autonomous_playground.rs`, `src-tauri/src/host_versioning.rs`, `src-tauri/src/legacy_desktop_commands.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/local_vm.rs`, `src-tauri/src/main.rs`, `src-tauri/src/python_sidecar.rs`, `src-tauri/src/vm_visual.rs`, `src-tauri/src/web_knowledge.rs`.
- Testes existentes: `src-tauri/python_sidecar/tests/test_sidecar.py`, `src-tauri/tests/fixtures/web_knowledge/long_article.html`, `src-tauri/tests/fixtures/web_knowledge/noisy_navigation_links.html`, `src-tauri/tests/fixtures/web_knowledge/selected_text_page.html`, `src-tauri/tests/fixtures/web_knowledge/tables_and_lists.html`, `src-tauri/tests/fixtures/web_knowledge/technical_docs.html`, `src-tauri/tests/fixtures/web_knowledge/thin_landing_page.html`, `src/autonomousFailureSignatureBuilder.test.js`.
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

## Scripts

- Para que serve: organiza o dominio `Scripts` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `scripts/alice-code-auditor.mjs`, `scripts/learning-planner-harness.mjs`, `scripts/runner-harness.mjs`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: nenhum identificado estaticamente.
- Dependencias externas: `node:fs`, `node:fs/promises`, `node:path`, `node:process`, `vite`.
- Arquivos mais criticos: nenhum identificado estaticamente.
- Testes existentes: `scripts/alice-code-auditor.test.mjs`.
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

## Configuracao/build

- Para que serve: organiza o dominio `Configuracao/build` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `.gitignore`, `alice-core/.gitignore`, `alice-core/Cargo.lock`, `alice-core/Cargo.toml`, `eslint.config.js`, `index.html`, `package-lock.json`, `package.json`, `src-tauri/.gitignore`, `src-tauri/capabilities/default.json`, `src-tauri/Cargo.lock`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `start-alice.ps1`, `vite.config.js`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: nenhum identificado estaticamente.
- Dependencias externas: `@eslint/js`, `@vitejs/plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint/config`, `globals`, `vite`.
- Arquivos mais criticos: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`.
- Testes existentes: `edge-extension/captureEvents.test.js`, `scripts/alice-code-auditor.test.mjs`, `src-tauri/python_sidecar/tests/test_sidecar.py`, `src-tauri/tests/fixtures/web_knowledge/long_article.html`, `src-tauri/tests/fixtures/web_knowledge/noisy_navigation_links.html`, `src-tauri/tests/fixtures/web_knowledge/selected_text_page.html`, `src-tauri/tests/fixtures/web_knowledge/tables_and_lists.html`, `src-tauri/tests/fixtures/web_knowledge/technical_docs.html`, `src-tauri/tests/fixtures/web_knowledge/thin_landing_page.html`, `src-tauri/vm/guest_agent/tests/test_background_actions.py`, `src-tauri/vm/guest_agent/tests/test_input_controller.py`, `src-tauri/vm/guest_agent/tests/test_resident_server.py`, `src/alice.test.js`, `src/aliceMemory.test.js`, `src/aliceMemoryPersistence.test.js`, `src/App.test.js`, `src/autonomousContextRepair.test.js`, `src/autonomousFailureSignatureBuilder.test.js`, `src/autonomousLearning.test.js`, `src/autonomousLearning/behaviorContext.test.js`, `src/autonomousLearning/decisionEngine.test.js`, `src/autonomousLearning/vmTextInputDriver.test.js`, `src/autonomousLearningLoop.test.js`, `src/autonomousObservedLearning.test.js`, `src/autonomousProcedureOptimizer.test.js` (+30).
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

## Testes

- Para que serve: organiza o dominio `Testes` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `edge-extension/captureEvents.test.js`, `scripts/alice-code-auditor.test.mjs`, `src-tauri/python_sidecar/tests/test_sidecar.py`, `src-tauri/tests/fixtures/web_knowledge/long_article.html`, `src-tauri/tests/fixtures/web_knowledge/noisy_navigation_links.html`, `src-tauri/tests/fixtures/web_knowledge/selected_text_page.html`, `src-tauri/tests/fixtures/web_knowledge/tables_and_lists.html`, `src-tauri/tests/fixtures/web_knowledge/technical_docs.html`, `src-tauri/tests/fixtures/web_knowledge/thin_landing_page.html`, `src-tauri/vm/guest_agent/tests/test_background_actions.py`, `src-tauri/vm/guest_agent/tests/test_input_controller.py`, `src-tauri/vm/guest_agent/tests/test_resident_server.py`, `src/alice.test.js`, `src/aliceMemory.test.js`, `src/aliceMemoryPersistence.test.js`, `src/App.test.js`, `src/autonomousContextRepair.test.js`, `src/autonomousFailureSignatureBuilder.test.js`, `src/autonomousLearning.test.js`, `src/autonomousLearning/behaviorContext.test.js`, `src/autonomousLearning/decisionEngine.test.js`, `src/autonomousLearning/vmTextInputDriver.test.js`, `src/autonomousLearningLoop.test.js`, `src/autonomousObservedLearning.test.js`, `src/autonomousProcedureOptimizer.test.js`, `src/autonomousRunner.test.js`, `src/debugHud.test.js`, `src/dev/autonomousRunnerHarness.test.js`, `src/dev/learningPlannerHarness.test.js`, `src/dev/runtimeHarnessBridge.test.js`, `src/filesystem/filesystemNameSanitizer.test.js`, `src/geminiLive.test.js`, `src/hud/AliceHud.test.jsx`, `src/hud/hudViewModel.test.js`, `src/hud/mindMap/CustomNode.test.jsx`, `src/hud/pages/AutonomousLearningHudPage.test.jsx`, `src/hud/pages/runnerHudViewModel.test.js`, `src/knowledgePipeline.test.js`, `src/knowledgeToolExecutor.test.js`, `src/learningPlanner/learningPlanner.test.js`, `src/liveAudio.test.js`, `src/liveDiagnostics.test.js`, `src/liveSessionOrchestrator.test.js`, `src/liveSessionRehydration.test.js`, `src/liveSessionTransport.test.js`, `src/mindMapData.test.js`, `src/mindMapExecutionSync.test.js`, `src/mindMapIntentInterpreter.test.js`, `src/mindMapToolExecutor.test.js`, `src/operationalContext.test.js`, `src/runnerAppDiagnostics.test.js`, `src/screenFrameStreaming.test.js`, `src/screenGeometry.test.js`, `src/tauriRuntime.test.js`, `src/webKnowledge.test.js`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: `edge-extension/captureEvents.js`, `scripts/alice-code-auditor.mjs`, `src/alice.js`, `src/aliceMemory.js`, `src/aliceMemoryPersistence.js`, `src/appUiState.js`, `src/autonomousCapabilityScanner.js`, `src/autonomousFailureSignatureBuilder.js`, `src/autonomousLearning/behaviorContext.js`, `src/autonomousLearning/decisionEngine.js`, `src/autonomousLearning/index.js`, `src/autonomousLearning/state.js`, `src/autonomousLearning/vmTextInputDriver.js`, `src/autonomousLearningGoals.js`, `src/autonomousLearningLoop.js`, `src/autonomousLearningPlanner.js`, `src/autonomousLearningPolicy.js`, `src/autonomousLearningToolExecutor.js`, `src/autonomousLearningValidator.js`, `src/autonomousObservedLearning.js`, `src/autonomousProcedureOptimizer.js`, `src/autonomousProcedurePromoter.js`, `src/autonomousProcedureReuseEngine.js`, `src/autonomousProcedureVersioning.js`, `src/autonomousRunnerEvidence.js`, `src/autonomousRunnerLease.js`, `src/autonomousRunnerMindMap.js`, `src/autonomousRunnerPlanner.js`, `src/autonomousRunnerPreflight.js`, `src/autonomousRunnerRecoveryPlanner.js` (+52).
- Dependencias externas: `__future__`, `action_executor`, `alice_window_sidecar`, `http.client`, `input_controller`, `io`, `json`, `node:fs`, `node:os`, `node:path`, `os`, `pathlib`, `react`, `react-dom/server`, `server`, `src/autonomousLearning/../autonomousRunnerTextInputDiagnostics`, `src/autonomousLearning/../autonomousRunnerValidation`, `src/autonomousLearning/../hud/mindMap/utils/mindMapData`, `src/dev/../aliceMemory`, `src/dev/../autonomousRunnerState`, `src/learningPlanner/../aliceMemory`, `src/learningPlanner/../autonomousRunnerEvidence`, `src/learningPlanner/../autonomousRunnerPreflight`, `src/learningPlanner/../autonomousRunnerValidation`, `src/learningPlanner/../debugHud` (+9).
- Arquivos mais criticos: nenhum identificado estaticamente.
- Testes existentes: `edge-extension/captureEvents.test.js`, `scripts/alice-code-auditor.test.mjs`, `src-tauri/python_sidecar/tests/test_sidecar.py`, `src-tauri/tests/fixtures/web_knowledge/long_article.html`, `src-tauri/tests/fixtures/web_knowledge/noisy_navigation_links.html`, `src-tauri/tests/fixtures/web_knowledge/selected_text_page.html`, `src-tauri/tests/fixtures/web_knowledge/tables_and_lists.html`, `src-tauri/tests/fixtures/web_knowledge/technical_docs.html`, `src-tauri/tests/fixtures/web_knowledge/thin_landing_page.html`, `src-tauri/vm/guest_agent/tests/test_background_actions.py`, `src-tauri/vm/guest_agent/tests/test_input_controller.py`, `src-tauri/vm/guest_agent/tests/test_resident_server.py`, `src/alice.test.js`, `src/aliceMemory.test.js`, `src/aliceMemoryPersistence.test.js`, `src/App.test.js`, `src/autonomousContextRepair.test.js`, `src/autonomousFailureSignatureBuilder.test.js`, `src/autonomousLearning.test.js`, `src/autonomousLearning/behaviorContext.test.js`, `src/autonomousLearning/decisionEngine.test.js`, `src/autonomousLearning/vmTextInputDriver.test.js`, `src/autonomousLearningLoop.test.js`, `src/autonomousObservedLearning.test.js`, `src/autonomousProcedureOptimizer.test.js` (+30).
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

## Documentacao

- Para que serve: organiza o dominio `Documentacao` dentro da Alice e seus contratos de dados/efeitos.
- Arquivos: `AGENTS.MD`, `docs/autonomous-runner-dev-harness.md`, `docs/autonomous-runner-hardening-checklist.md`, `docs/handoff-2026-05-01-learning.md`, `docs/learning-planner-implementation-map.md`, `erros.md`, `README.md`.
- Fluxo principal: os arquivos de entrada recebem estado/evento/request, normalizam dados, chamam modulos internos ou Tauri quando necessario e devolvem estado/resultado para `App.jsx`, HUD, memoria ou testes.
- Entradas: props React, memoria, tool calls Gemini, requests Tauri, eventos de runtime, arquivos/configs ou fixtures conforme dominio.
- Saidas: estado atualizado, resposta de tool, UI renderizada, comandos nativos, evidencia, logs/audits ou relatorio de teste.
- Estados alterados: memoria Alice, refs/states de `App.jsx`, estado do Runner/autonomia/mind map, ou filesystem/runtime quando Tauri/guest agent participa.
- Dependencias internas: nenhum identificado estaticamente.
- Dependencias externas: nenhum identificado estaticamente.
- Arquivos mais criticos: nenhum identificado estaticamente.
- Testes existentes: nenhum identificado estaticamente.
- Riscos: acoplamento com `App.jsx`, divergencia entre contrato e executor, estado stale, falha de runtime externo ou ausencia de evidencia real quando o dominio toca execucao.
- Lacunas percebidas: testes unitarios existem em muitos modulos, mas fluxos integrados com Tauri/Live/VM/Browser real dependem de ambiente e nao foram executados nesta analise.

