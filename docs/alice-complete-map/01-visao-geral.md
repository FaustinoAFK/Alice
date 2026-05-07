# Visao geral

## Tipo de aplicacao

Alice Virtual e uma aplicacao desktop Tauri com frontend React/Vite. O frontend roda a experiencia da Alice, HUD, Gemini Live, memoria e orquestracao de ferramentas. O backend Rust/Tauri fornece a fronteira nativa: chave Gemini via ambiente, persistencia da memoria, evidencias fisicas, VM/local workspace, sidecars, bridge web e comandos permitidos.

## Tecnologias usadas

- React 19, React DOM, JSX e CSS proprio para UI/HUD.
- Vite 8 para dev/build e Vitest para testes JS/React.
- Tauri 2 e Rust para runtime desktop, comandos nativos, filesystem, HTTP local e integracao Windows.
- Gemini Live via WebSocket para conversa multimodal com audio e tela.
- `@xyflow/react`, `dagre` e `html-to-image` para mind map.
- Python para sidecar de janela no host e Guest Interaction Agent dentro da VM.
- Extensao Edge para coletar DOM/navegacao e alimentar conhecimento web.

## Arquitetura geral

`src/main.jsx` monta `src/App.jsx`. `App.jsx` e o orquestrador central: hidrata memoria, controla tela/microfone, cria a sessao Gemini Live, recebe tool calls, roteia para executores, agenda o Autonomous Task Runner, roda learning loop e renderiza `AliceHud`. O backend Tauri em `src-tauri/src/lib.rs` registra comandos para memoria, Gemini URL, evidencias, VM, guest agent, workspace fallback, snapshots e conhecimento web.

## Papel do frontend React

O frontend mantem estado operacional em refs/states, apresenta o HUD, serializa tool calls e decide qual executor JS deve tratar cada chamada. Ele tambem prepara contexto para a Gemini: memoria, rehidratacao, contexto operacional, audio e frames de tela.

## Papel do backend Tauri/Rust

O backend e a fronteira de confianca para operacoes sensiveis. Ele valida caminhos, comandos, timeouts, memoria, evidencias, VM, bridge web e sidecars. A chave Gemini fica no ambiente do processo Tauri e nao no frontend.

## Papel do HUD

O HUD e a interface operacional. Ele mostra Live, conhecimento, mind map, autonomia, aprendizado, Runner e debug. Importante: o HUD nao e a fonte de verdade; ele recebe snapshots de `App.jsx` e dispara callbacks.

## Papel da memoria persistente

`src/aliceMemory.js` define o schema persistente: fatos, contexto recente, mind maps, auditoria autonoma, Runner, aprendizado, procedures e planner. O Tauri salva fisicamente em `alice-memory.json` com escrita atomica e limite de tamanho.

## Papel do Gemini Live, audio e tela

`src/alice.js` define modelo, persona e ferramentas. `geminiLive`, `liveSessionOrchestrator`, `liveSessionTransport`, `liveAudio`, `screenGeometry` e `screenFrameStreaming` formam o canal multimodal. Audio entra como PCM16 base64; tela entra como frames JPEG; respostas retornam como audio/transcricao/tool calls.

## Papel da VM e guest agent

A VM real pode ser Hyper-V ou VirtualBox, configurada por variaveis de ambiente. `local_vm.rs` diagnostica e roda comandos guest. `vm_visual.rs` instala/aciona o guest agent Python para captura de tela, mouse, teclado, texto e comandos em background. Fallback local existe, mas e explicitamente workspace local, nao VM real.

## Papel do Autonomous Task Runner

O Runner executa tarefas longas/multistep com fila, preflight, lease, lock, heartbeat, executor, validacao, evidencia fisica, retry, recovery e HUD. Ele tenta impedir falso sucesso exigindo validacao e evidencia persistida antes de marcar `done`.

## Papel das evidencias

Evidencias do Runner sao arquivos fisicos salvos pelo Tauri: `metadata.json`, `stdout.txt`, `stderr.txt`, `validation.json`. Refs logicas so contam como prova quando `verify_runner_evidence` confirma existencia fisica.

## Papel do mind map

O mind map e uma visualizacao persistente de raciocinio, planos e execucao. Ele pode ser editado pelo HUD ou por tool call `update_mind_map`, e pode sincronizar status com Runner/execucoes.

## Papel das ferramentas/tool executors

Ferramentas sao declaradas em `src/alice.js`. `App.jsx` roteia tool calls para `knowledgeToolExecutor`, `mindMapToolExecutor`, `autonomousLearningToolExecutor` ou `autonomousRunnerToolExecutor`. Os executores atualizam memoria/estado ou chamam Tauri quando cruzam fronteira nativa.

## Resumo critico da arquitetura

Bem estruturado: ha separacao clara de varios dominios em modulos testaveis; o Runner tem invariantes fortes; o backend Rust valida operacoes perigosas; ha muitos testes unitarios; evidencia fisica e checada antes de sucesso.

Acoplado: `src/App.jsx` concentra Live, memoria, tools, Runner, learning loop, timers e HUD. `src/autonomousLearningToolExecutor.js` tambem concentra muitas responsabilidades. `src-tauri/src/lib.rs` e grande e mistura comandos centrais, memoria, validacoes e partes legadas.

Fragil: tool calls dependem de nomes string e schemas sincronizados manualmente; VM/guest dependem de ambiente externo; bridge Edge pode entregar snapshot stale; memoria cresce com logs/audits/plans; HUD pode exibir snapshot defasado se estado derivado nao for atualizado.

Critico: antes de qualquer refatoracao, entender `App.jsx`, `aliceMemory.js`, `alice.js`, `autonomousRunnerState.js`, `autonomousTaskRunner.js`, `autonomousLearningToolExecutor.js`, `src-tauri/src/lib.rs`, `local_vm.rs`, `vm_visual.rs` e `web_knowledge.rs`.
