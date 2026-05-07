# Fluxos principais

## A. Inicializacao da Alice

1. `index.html` carrega `/src/main.jsx`.
2. `main.jsx` importa CSS global, CSS do React Flow e monta `<App />`.
3. `App.jsx` cria refs e states iniciais: streams, Live session, transport, memoria vazia, conhecimento, autonomia, Runner, mind map, debug, timers e diagnosticos.
4. O primeiro `useEffect` tenta `loadAliceMemoryFromRuntimeBoundary({ invokeFn: invoke })`.
5. No Tauri, `load_alice_memory_json` em `src-tauri/src/lib.rs` le `alice-memory.json` no app data. Se nao existir, o frontend normaliza para memoria vazia.
6. `aliceMemory.js` valida schema, aplica defaults, upgrade/prune e garante subestados como mind maps, runner e autonomousLearning.
7. `App.jsx` registra diagnosticos de runtime, chama `recoverAutonomousTasksOnStartup`, hidrata estado de autonomia a partir de audit, atualiza `activeMindMap`, `autonomousRunnerState`, `mindMapRevision` e agenda save.
8. O HUD e montado por `AliceHud` com pagina ativa inicial `live`.
9. A sessao Live ainda nao abre automaticamente; ela fica preparada por setup factory, memoria e callbacks ate o usuario iniciar.
10. Audio/tela sao preparados apenas em `startLiveSession`, porque dependem de permissao do usuario.
11. Runner/autonomia sao hidratados apos memoria; outro effect agenda ticks e espera `memoryHydratedRef` + Tauri antes de executar.
12. Um poll dev runtime (`applyRuntimeHarnessRequests`) pode enfileirar pedidos de harness, sem executar Runner real por si so nesta analise.

## B. Fluxo de conversa

1. Usuario aciona iniciar no HUD; `TopBar` chama callback `onToggleLiveSession`.
2. `App.jsx` chama `startLiveSession`; se nao houver Tauri, falha com mensagem para abrir app desktop.
3. Browser captura tela com `getDisplayMedia` e audio com `getUserMedia`.
4. `invoke('create_gemini_live_url')` pede ao Rust URL WebSocket com chave de ambiente (`GEMINI_API_KEY` ou `GOOGLE_API_KEY`).
5. `createAliceLiveSetup` monta modelo, persona, ferramentas, transcricao, realtime config e resumption/history.
6. `LiveSessionOrchestrator` cria/renova `GeminiLiveSession`, trata goAway, reconnect e setup timeout.
7. `startMicrophoneStreaming` codifica PCM16 base64; `startScreenFrameStreaming` captura JPEG base64 do canvas.
8. Gemini retorna audio/transcricao/tool calls. `App.jsx` toca audio, atualiza captions, registra utterances e lembra contexto.
9. Tool calls entram na fila serial. Resultado volta ao modelo como `toolResponse`.
10. Riscos: permissao de midia, sample rate, WebSocket, tool call concorrente, resposta iniciada confundida com concluida e dependencia forte em `App.jsx`.

## C. Fluxo de tool calls

1. Tools sao declaradas em `src/alice.js` dentro de `ALICE_LIVE_TOOLS`.
2. Gemini emite `functionCall` em evento Live.
3. `App.jsx` decide executor pelo nome da ferramenta.
4. Conhecimento web vai para `knowledgeToolExecutor`; mind map para `mindMapToolExecutor`; autonomia/VM/snapshots para `autonomousLearningToolExecutor`; Runner para `autonomousRunnerToolExecutor`.
5. Executores validam argumentos parcialmente, chamam helpers e, quando necessario, `invoke`.
6. Rust valida fronteiras perigosas: paths, comandos, timeouts, evidencias, VM e filesystem.
7. Erros retornam como response `ok=false` ou excecao capturada, e sao registrados em debug interactions/diagnostics.
8. `LiveSessionTransport` empacota `functionResponse` e reenvia ao modelo.
9. Ferramentas podem alterar memoria, HUD, mind map, Runner, VM ou evidencias.
10. Riscos: schema e executor podem divergir; o roteador central esta em `App.jsx`; modelo nao deve ser tratado como validador.

## D. Fluxo do Autonomous Task Runner

1. Task nasce por tool `manage_autonomous_runner`, learning loop, learning planner/harness ou acao HUD.
2. Entra em `aliceMemory.autonomousRunner.queue` e `tasksById`, normalizada por `autonomousRunnerState.js`.
3. O tick em `App.jsx` chama `runAutonomousTaskRunnerTick`.
4. Runner normaliza estado, recupera tasks stale, respeita `enabled`, `paused` e `runnerLock`.
5. Scheduler escolhe eligible task por status/prioridade/tempo.
6. Planner pode converter `planned` em steps executaveis.
7. Preflight valida dependencias, VM/fallback, step executavel, completion criteria e expected evidence.
8. Lease/lock e adquirido por `acquireRunnerLease`; transicao para `running` exige `leaseId`.
9. Heartbeat atualiza `runnerLock.heartbeatAt` durante execucao.
10. Executor chama VM real (`run_local_vm_guest_task`) ou fallback (`run_local_workspace_playground_task`) conforme preflight.
11. Validacao avalia criterio; evidencia logica e criada; Tauri salva e verifica arquivos fisicos.
12. Task/step vira `done` somente com execucao verificada, validacao passada e evidencia persistida.
13. Falha de validacao ou evidencia leva a retry/failed; runtime indisponivel tende a blocked; cancelamento manual usa `cancelAutonomousRunnerTask`/queue.
14. Recovery cria tarefas para dependencia falha ou bloqueia loop.
15. HUD Runner mostra queue, status, task ativa, bloqueios, falhas e auditoria por view model.

## E. Fluxo de VM/local workspace

1. `get_local_vm_status` reporta providers e readiness.
2. Hyper-V requer PowerShell/PowerShell Direct; VirtualBox requer `VBoxManage`, Guest Additions e credenciais.
3. `ALICE_LOCAL_VM_ENABLE_GUEST_RUN=true` e opt-in para executar dentro do guest.
4. Se a task exige VM real e `guestCommandReady=false`, preflight bloqueia.
5. Fallback local e permitido apenas quando politica/risco permitem e a task nao exige VM real.
6. `autonomous_playground.rs` cria workspace controlado, copia arquivos, roda comando permitido sem shell amplo e coleta manifest/stdout/stderr.
7. Guest visual usa `vm_visual.rs` para instalar/diagnosticar/start residente/action/screenshot/smoke.
8. O guest agent Python executa `capture_screen`, mouse, teclado, texto, hotkeys, comando, background status/cancel.
9. Falhas retornam `ok=false`, `setupReason`, `readiness`, `providerStatus`, `background status` ou erro de validacao.
10. Runner consome esses resultados como `executionResult`.

## F. Fluxo de evidencias

1. Evidencias sao criadas apos execucao de step do Runner.
2. `autonomousRunnerEvidence.js` cria refs para metadata/stdout/stderr/validation.
3. `persistRunnerEvidenceFiles` chama `save_runner_evidence`.
4. Rust escreve em `data/evidence/<executionId>/metadata.json`, `stdout.txt`, `stderr.txt`, `validation.json`.
5. Em seguida `verify_runner_evidence` confirma existencia fisica e rejeita path traversal/nomes fora da whitelist.
6. Refs sao anexadas ao step/task/runner apenas quando persistencia passa.
7. Se salvar/verificar falhar, a validacao final vira failed com `evidence_persistence_failed`.
8. Isso evita falso positivo: sucesso de comando sem evidencia fisica nao conclui task.

## G. Fluxo de memoria

1. Memoria persistente fica em `alice-memory.json` no app data do Tauri.
2. Carregamento: `load_alice_memory_json` -> `aliceMemoryPersistence` -> `loadAliceMemory`.
3. Normalizacao: schema/version/defaults/prune em `aliceMemory.js`.
4. Save: `commitAliceMemory` atualiza refs/states e agenda debounce; `flushAliceMemoryToRuntime` chama `save_alice_memory_json`.
5. Leitores: Live setup, HUD/debug, Runner, learning loop, executores, mind map, knowledge.
6. Escritores: conversa, tools, Runner, learning, mind map, diagnostics, planner.
7. Partes: facts/context, active projects/tasks, tool facts, procedures, mindMaps, autonomousAudit, autonomousRunner, autonomousLearning, autonomousOptimization.
8. Riscos: corrupcao JSON, salvar antes de hidratar, crescimento proximo de 50 MiB, historicos/audits demais e inconsistencia entre state React e ref.
9. Testar com `aliceMemory.test.js`, `aliceMemoryPersistence.test.js`, Runner/learning planner tests e `cargo test` para persistencia nativa.

## H. Fluxo do HUD

1. `App.jsx` calcula `debugHud` por `buildDebugHudSnapshot`.
2. `AliceHud` monta `Sidebar`, `TopBar` e pagina ativa.
3. Paginas: live, knowledge, mind-map, autonomy, learning, runner, debug.
4. Estados mostrados: captions, status Live, diagnostics, conhecimento, autonomy state, runner state, mind map, logs, persistence.
5. Acoes: iniciar/parar Live, navegar, alterar mind map, aprovar/rejeitar proposta, controlar Runner, acoes de learning.
6. Conexao com estado real: callbacks retornam para `App.jsx`, que atualiza memoria/refs/states.
7. Risco: se state derivado nao for sincronizado apos memoria mudar, HUD pode mostrar estado antigo.

## I. Fluxo do mind map

1. Mapas sao armazenados em `aliceMemory.mindMaps`.
2. Nodes/edges sao normalizados por `hud/mindMap/utils/mindMapData.js`.
3. UI cria/altera via `MindMapEditor`; modelo altera via `update_mind_map`.
4. Status muda por operacoes `set_status`, `mark_done`, `mark_failed`, `mark_blocked`, `mark_in_progress`.
5. Historico permite rollback; export gera JSON/Markdown.
6. `syncMindMapWithRunnerTask` e `syncMindMapWithExecution` tentam refletir execucao real.
7. Riscos: heuristica associar no errado, ids divergirem, historico crescer e mapa sugerir progresso que Runner nao validou.

## J. Fluxo de aprendizado/autonomia

1. Modulos que aprendem: `autonomousLearningLoop`, `autonomousCapabilityScanner`, `autonomousLearningPlanner`, `autonomousObservedLearning`, `autonomousProcedure*`, `autonomousReuse*`, `learningPlanner/*`.
2. Candidatos sao criados por observacao, falhas/sucessos do Runner, planner ou tool `record_validated_learning`.
3. Validacao exige checks, comando/resultado e principalmente evidencia Runner quando consolidacao depende de execucao.
4. Alice evita fingir sucesso mantendo candidates/guarded, exigindo evidencia fisica e bloqueando plano invalido/risco alto.
5. Politicas decidem tentar, bloquear, pedir revisao humana ou usar fallback.
6. Recovery loops sao evitados por guards em Runner/recovery planner e por status/auditoria.
7. Tudo persiste em memoria e aparece no HUD de aprendizado/autonomia/Runner.
8. Riscos: responsabilidades duplicadas entre learning loop e learning planner, crescimento de memoria, excesso de automacao se politicas forem relaxadas.
