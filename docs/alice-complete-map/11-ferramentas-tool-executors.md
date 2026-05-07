# Ferramentas e tool executors

## Declaracao das tools

`src/alice.js` declara `ALICE_LIVE_TOOLS`. A lista inclui ferramentas de conhecimento web, mind map, status/autonomia, VM real, guest agent, tarefa operacional de VM, planejamento autonomo, snapshots/rollback do host, auto-melhoria, aprendizado validado, pesquisa, inspeção de projeto e controle do Runner.

## Roteamento

Gemini Live envia `functionCall`. `App.jsx` registra a chamada em debug, coloca na fila serial `toolQueueRef` e decide o executor por nome. O resultado vira envelope por `createFunctionResponseEnvelope` em `liveSessionTransport.js` e volta ao modelo como `toolResponse`.

## Executors

- `src/knowledgeToolExecutor.js`: executa tools de conhecimento web e chama `knowledgePipeline.js`.
- `src/knowledgePipeline.js`: decide escopo, refresh/inspect/search/fetch e monta resposta com fontes.
- `src/mindMapToolExecutor.js`: aplica operacoes no mapa ativo e retorna estado/export/status.
- `src/autonomousLearningToolExecutor.js`: executor amplo para autonomia, VM, guest agent, snapshots, propostas, learning, pesquisa e riscos.
- `src/autonomousRunnerToolExecutor.js`: status, enable/disable, pause/resume, enqueue, cancel, block, rerun e reorder do Runner.

## Validacao e tratamento de erro

O JSON schema em `alice.js` limita forma basica, mas a validacao real fica nos executores JS e no Rust. Operacoes perigosas devem cruzar `invoke` e passar por validacao nativa de paths, comandos, timeouts, providers e evidencias. Erros viram `ok=false`, diagnostico ou excecao capturada; `App.jsx` registra status de tool para HUD/debug.

## Conexoes

Ferramentas podem alterar memoria (`commitAliceMemory`), mind map, estado de autonomia, Runner, HUD e backend Tauri. Algumas retornam task iniciada/background, nao conclusao final. Isso e importante para nao declarar sucesso antes de evidencia.

## Riscos

Nomes string podem divergir entre declaracao e executor. `App.jsx` concentra o roteador. `autonomousLearningToolExecutor.js` tem fan-out alto e mistura muitos dominios. O modelo nao deve decidir seguranca: qualquer relaxamento nos validadores JS/Rust pode abrir execucao indevida ou falso sucesso.
