# Riscos, acoplamentos e pontos fracos

            ## Arquivos centrais

            - `src/App.jsx`: altamente acoplado; controla Live, media, memoria, tools, Runner, learning loop, HUD, Tauri e timers.
            - `src/aliceMemory.js`: contrato persistente compartilhado por muitos dominios.
            - `src/alice.js`: persona/modelo/schema de ferramentas; divergencia quebra tool calls.
            - `src/autonomousTaskRunner.js` e `src/autonomousRunnerState.js`: invariantes de execucao/evidencia.
            - `src/autonomousLearningToolExecutor.js`: executor amplo e ramificado.
            - `src-tauri/src/lib.rs`: backend central e superficie sensivel.
            - `src-tauri/src/web_knowledge.rs`, `local_vm.rs`, `vm_visual.rs`, `host_versioning.rs`: integracoes externas e filesystem/processos.

            ## Arquivos com muitos dependentes estaticos

            - `src/autonomousLearning/contracts.js`: 22 dependente(s).
- `src/aliceMemory.js`: 15 dependente(s).
- `src/autonomousRunnerState.js`: 15 dependente(s).
- `src/hud/mindMap/utils/mindMapData.js`: 15 dependente(s).
- `src/autonomousLearningPolicy.js`: 12 dependente(s).
- `src/learningPlanner/learningPlannerTypes.js`: 11 dependente(s).
- `src/autonomousLearning/state.js`: 8 dependente(s).
- `src/autonomousRunnerLease.js`: 6 dependente(s).
- `src/autonomousLearning/index.js`: 5 dependente(s).
- `src/autonomousLearningGoals.js`: 5 dependente(s).

            ## Criticos/altos sem teste direto inferido pelo nome

            `package.json`, `src-tauri/Cargo.toml`, `src-tauri/src/autonomous_playground.rs`, `src-tauri/src/host_versioning.rs`, `src-tauri/src/legacy_desktop_commands.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/local_vm.rs`, `src-tauri/src/main.rs`, `src-tauri/src/vm_visual.rs`, `src-tauri/tauri.conf.json`, `src-tauri/vm/guest_agent/action_executor.py`, `src-tauri/vm/guest_agent/background_runner.py`, `src-tauri/vm/guest_agent/element_recognition.py`, `src-tauri/vm/guest_agent/ocr.py`, `src-tauri/vm/guest_agent/protocol.py`, `src-tauri/vm/guest_agent/screen_capture.py`, `src-tauri/vm/guest_agent/validation.py`, `src-tauri/vm/guest_agent/visual_context.py`, `src/autonomousLearningToolExecutor.js`, `src/autonomousRunnerEvidence.js`, `src/autonomousRunnerExecutor.js`, `src/autonomousRunnerLease.js`, `src/autonomousRunnerPlanner.js`, `src/autonomousRunnerPreflight.js`, `src/autonomousRunnerRecoveryPlanner.js`, `src/autonomousRunnerScheduler.js`, `src/autonomousRunnerState.js`, `src/autonomousRunnerTextInputDiagnostics.js`, `src/autonomousRunnerToolExecutor.js`, `src/autonomousRunnerValidation.js`, `src/autonomousTaskRunner.js`

            ## Possivel legado ou duplicacao

            - `src/autonomousLearning/taskOrchestrator.js` e descrito no README como fluxo legado/simples, nao executor principal.
            - `legacy_desktop_commands.rs` existe atras de feature flag e nao e fluxo padrao.
            - Existem varias camadas de aprendizado: `autonomousLearning/**`, arquivos `autonomousLearning*.js`, `autonomousProcedure*.js`, `autonomousReuse*.js` e `learningPlanner/**`. Isso parece poderoso, mas tambem aumenta risco de duplicacao conceitual.
            - `alice-core/` parece crate auxiliar isolado, pouco conectado ao app principal.

            ## Pontos frageis

            - Timers/effects em `App.jsx` podem competir: hidratacao, save, runner tick, learning loop e harness poll.
            - Tool calls usam nomes string; schema, executor e testes precisam caminhar juntos.
            - Memoria e auditorias podem crescer muito.
            - VM/guest dependem de ambiente externo e credenciais.
            - Evidencia fisica e correta, mas falha de app data transforma execucao em falha.
            - HUD mostra snapshots; se commit/state derivado falhar, pode mostrar estado incorreto.

            ## Perigoso de alterar sem teste

            `App.jsx`, `aliceMemory.js`, `alice.js`, `autonomousTaskRunner.js`, `autonomousRunnerState.js`, `autonomousLearningToolExecutor.js`, `learningTaskCompiler.js`, `src-tauri/src/lib.rs`, `local_vm.rs`, `vm_visual.rs`, `host_versioning.rs`, `web_knowledge.rs`, guest agent e bridge Edge.
