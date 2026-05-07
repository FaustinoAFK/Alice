# Plano de Melhoria da Alice

## 1. Visao geral do projeto atual

A Alice Virtual atual e um aplicativo desktop Tauri + React que combina conversa por Gemini Live, captura de tela e audio, HUD operacional, memoria persistente, contexto web via extensao Edge, VM local, guest agent visual, evidencias fisicas, rollback/snapshot do host, mapas mentais, Autonomous Task Runner e aprendizado autonomo.

O projeto funciona como um runtime local com varias camadas:

- Interface/HUD React para sessao Live, diagnosticos, conhecimento, runner, aprendizado e mapas mentais.
- Runtime conversacional Gemini Live com prompt, ferramentas locais e historico/memoria.
- Memoria JSON persistente (`alice-memory.json`) contendo identidade, preferencias, auditoria, runner, aprendizado, otimizacao, procedimentos e mind maps.
- Backend Tauri/Rust com comandos nativos para memoria, Gemini Live URL, filesystem, shell controlado, VM, guest agent visual, web bridge, evidencias do Runner e snapshot/rollback.
- Extensao Edge que publica contexto DOM/snapshot da pagina para o bridge local.
- Autonomous Task Runner com fila, lease, preflight, execucao, validacao, evidencia fisica e recovery.
- Camada de aprendizado autonomo e learning planner que cria gaps, tarefas, candidatos e possiveis promocoes, mas ainda tem superficie grande demais para ser comportamento ativo sem revisao.

O estado atual mostra boa intencao de seguranca: separa VM real de workspace fallback, exige evidencia fisica para Runner, tem validacoes Rust de escopo/path/timeout, possui snapshot/rollback do host e mantem comandos desktop legados atras de feature flag. O maior risco arquitetural nao e falta de recursos; e excesso de responsabilidades nas mesmas fronteiras.

## 2. Mapa de modulos

### `src/App.jsx`

- Responsabilidade atual: componente raiz, HUD, sessao Gemini Live, captura de tela/audio, fila de tool calls, memoria, persistencia, runner tick, learning loop, mind map sync, diagnosticos e polling de harness dev.
- Dependencias importantes: `@tauri-apps/api/core`, React, `alice.js`, `aliceMemory.js`, Gemini Live, audio/screen streaming, knowledge executor, mind map executor, runner executor/tool executor, learning loop/tool executor, HUD, Tauri runtime, runtime harness.
- Problemas: 1876 linhas; mistura UI, runtime, efeitos longos, timers, persistencia e orquestracao; muitos refs mutaveis; loops de runner/learning/harness convivem no mesmo componente; tool routing esta dentro da UI.
- Risco: critico. Regressao aqui pode quebrar sessao Live, salvar memoria errado, duplicar ticks, ocultar falha de evidencia ou exibir HUD inconsistente.
- Recomendacao: extrair primeiro helpers puros e orquestradores sem mudar comportamento; depois mover bootstrap/runtime para `src/core/aliceRuntime.js`; manter `App.jsx` como UI + wiring.

### `src/alice.js`

- Responsabilidade atual: modelo Gemini Live, system instruction completo, declaracoes de ferramentas e `createAliceLiveSetup`.
- Dependencias importantes: Gemini Live API por contrato de setup; tool executors dependem dos nomes e schemas declarados aqui.
- Problemas: mistura persona, politicas de seguranca, regras operacionais, VM, runner, rollback, aprendizado, web e schemas de ferramentas em um unico arquivo.
- Risco: alto. Divergencia entre schema e executor quebra tool call; mudanca em prompt pode ativar comportamento perigoso.
- Recomendacao: separar prompts por dominio e tool declarations por registry, com teste de equivalencia garantindo que o setup final nao mudou.

### `src/aliceMemory.js`

- Responsabilidade atual: schema persistente, migracao, pruning, extracao de fatos, memoria de identidade/preferencias, mind maps, runner, aprendizado, otimizacao, auditoria e storage Tauri.
- Dependencias importantes: `@tauri-apps/api/core`, audit persistence, mind map data, runner state, learning policy/goals, reuse index.
- Problemas: 1339 linhas; contrato persistente de muitos dominios; normalizacao de runner/learning/mind map/procedures no mesmo arquivo; risco de migracao acidental; import direto de Tauri dificulta teste e fronteira.
- Risco: critico. Corromper memoria, pruning ou migracao afeta todos os subsistemas.
- Recomendacao: dividir por dominios mantendo `src/aliceMemory.js` como facade compatível; extrair normalizadores puros com testes de snapshot/migracao antes de tocar storage.

### `src/autonomousTaskRunner.js`

- Responsabilidade atual: tick oficial do Runner, selecao de task, lease/heartbeat, preflight, execucao, validacao, persistencia/verificacao de evidencia e candidatos de aprendizado.
- Dependencias importantes: runner state, lease, scheduler, planner, preflight, executor, evidence, validation, recovery planner, `createProcedureCandidate`.
- Problemas: boa separacao interna, mas ainda acopla resultado do Runner a candidatos de aprendizado; persistencia fisica via invoke esta no fluxo de tick; error handling e validacao sao sensiveis.
- Risco: critico. E a melhor peca operacional e tambem a fronteira que mais precisa preservar invariantes.
- Recomendacao: preservar comportamento; encapsular como `runner/runnerService.js` no futuro; nao alterar politica de lease/evidencia sem testes dedicados.

### `src/autonomousRunnerState.js`

- Responsabilidade atual: schema do Runner, normalizacao, transicoes de task/step, queue, auditoria, evidencias e protecoes de done/running.
- Dependencias importantes: `uuid`.
- Problemas: concentra estado e varias regras especificas, incluindo reparo de comandos de aprendizado; cresce como contrato de dominio e como camada de sanitizacao.
- Risco: critico. Uma transicao relaxada pode marcar task done sem evidencia ou sem lease.
- Recomendacao: manter como fonte de verdade por enquanto; depois mover para `src/runner/runnerState.js` com facade e testes de transicoes.

### `src/autonomousLearningLoop.js`

- Responsabilidade atual: ciclo de aprendizado, scan de gaps, criacao de tasks, processamento de tasks terminais, validacao/promocao, reuse e otimizacao.
- Dependencias importantes: `aliceMemory`, capability scanner, learning policy/planner/validator, procedure promoter/reuse/optimizer/versioning, runner state.
- Problemas: ambicioso e muito acoplado ao Runner e memoria; cria/promove/reusa/otimiza no mesmo loop; risco de comportamento ativo demais quando a confiabilidade ainda depende de evidencia e revisao.
- Risco: alto.
- Recomendacao: congelar promocao automatica agressiva; reduzir para candidates/review; exigir evidencia e aprovacao antes de consolidar comportamento.

### `src/autonomousLearning/`

- Responsabilidade atual: contratos, policies, estado, decision engine, task orchestration, VM controller, workspace fallback, visual loop, pesquisa, self improvement, replay, hooks e drivers como `vmTextInputDriver`.
- Dependencias importantes: runner diagnostics/validation, mind map data, VM/local workspace, tool executor e learning loop.
- Problemas: pasta mistura runtime atual, arquitetura experimental, drivers de VM e conceitos de orquestrador alternativo; parte dela parece mais framework futuro que caminho confiavel atual.
- Risco: alto.
- Recomendacao: classificar em `learning/candidates`, `learning/review`, `tools/vm` e `legacy/experimental`; manter APIs atuais e congelar promocao ativa.

### `src/hud/`

- Responsabilidade atual: layout do HUD, paginas Live/Knowledge/MindMap/Autonomy/Learning/Runner/Debug, view models, React Flow mind map.
- Dependencias importantes: React, lazy loading, mind map utilities, runner/learning snapshots vindos do `App.jsx`.
- Problemas: HUD e majoritariamente apresentacional, mas depende de snapshots grandes e callbacks amplos; se o App montar snapshot errado, a UI nao consegue distinguir fonte de verdade.
- Risco: medio.
- Recomendacao: preservar; criar view models por pagina; reduzir props opacas; manter HUD de auditoria como observabilidade principal.

### `src-tauri/src/lib.rs`

- Responsabilidade atual: inicializacao Tauri, URL Gemini Live, memoria, validacao de acoes desktop, filesystem/shell controlado, comandos nativos, evidencia do Runner, requests dev e registro de handlers.
- Dependencias importantes: Tauri, serde/serde_json, filesystem/processos, `local_vm`, `vm_visual`, `web_knowledge`, `autonomous_playground`, `host_versioning`, `python_sidecar`, `legacy_desktop_commands`.
- Problemas: 2952 linhas; concentra comandos publicos, validadores, filesystem scopes, shell, evidencia, memoria e testes; contem dois blocos `windows_input` condicionais; dificil evoluir sem tocar superficie sensivel.
- Risco: critico.
- Recomendacao: dividir em `commands/*`, `security/scope.rs` e `runtime/shell.rs` preservando `invoke_handler` e contratos Tauri; manter testes inline durante a migracao.

### `src-tauri/src/local_vm.rs`

- Responsabilidade atual: detectar Hyper-V/VirtualBox, status de VM local, guestcontrol, smoke test e execucao guest.
- Dependencias importantes: env vars `ALICE_LOCAL_VM_*`, `VBoxManage`, PowerShell/Hyper-V, `NativeCommandResult`.
- Problemas: depende de ambiente externo; precisa comunicar claramente quando nao ha VM real; fallback nao pode ser confundido com VM.
- Risco: alto.
- Recomendacao: preservar checks de opt-in e status honesto; adicionar smokes opt-in e documentar env vars/estados.

### `src-tauri/src/vm_visual.rs`

- Responsabilidade atual: instalar/iniciar guest agent visual, bridge residente, captura de tela, acoes visuais e smoke visual real.
- Dependencias importantes: arquivos Python embutidos em `src-tauri/vm/guest_agent`, VirtualBox guestcontrol/NAT, loopback resident agent.
- Problemas: superficie sensivel e dependente de VM configurada; screenshots/replay/elevacao precisam continuar auditaveis.
- Risco: alto.
- Recomendacao: preservar camada; melhorar contratos de capacidades e testes opt-in de VM real.

### `src-tauri/src/web_knowledge.rs`

- Responsabilidade atual: servidor local HTTP/SSE para extensao, cache de contexto/snapshot, refresh reativo, parse HTML, busca/fetch web.
- Dependencias importantes: `tiny_http`, `reqwest`, `scraper`, `url`, estado Tauri compartilhado.
- Problemas: mistura bridge local, cache, parse e search; depende da extensao Edge estar viva; freshness de snapshot e sufficiency sao criticos para resposta correta.
- Risco: alto.
- Recomendacao: manter conceito; separar bridge/cache de fetch/parse no futuro; adicionar teste de integracao extensao-bridge opt-in.

### `edge-extension/`

- Responsabilidade atual: extensao MV3 Edge que coleta DOM, contexto de navegacao, selecao, links, labels e publica para o bridge local; tambem consome pedidos de captura via polling/SSE.
- Dependencias importantes: Chrome extension APIs, bridge `127.0.0.1:38947`, `captureEvents.js`.
- Problemas: background worker tem logica de coleta e transporte; falhas silenciosas podem deixar contexto stale.
- Risco: medio/alto.
- Recomendacao: preservar como conceito; reforcar eventos de saude, testes de captura e contrato com `web_knowledge.rs`.

### `scripts/`

- Responsabilidade atual: auditor de codigo da Alice, harness do Runner e harness do learning planner via Vite SSR.
- Dependencias importantes: Vite, modulos em `src/dev/*`.
- Problemas: harnesses sao uteis, mas dev bridge tambem aparece no runtime principal via polling em `App.jsx`.
- Risco: medio.
- Recomendacao: manter harnesses; isolar dev runtime bridge atras de flag/config clara antes de producao.

### Testes existentes

- Responsabilidade atual: Vitest para JS/React/extension/scripts; Rust inline tests para Tauri/backend; Python unittest para guest agent e sidecar.
- Dependencias importantes: Vitest, Cargo, Python stdlib.
- Problemas: boa cobertura de modulos puros e Rust; lacunas em E2E real de Tauri+Edge+VM+HUD+startup; `App.jsx` real tem pouco teste direto em relacao ao risco.
- Risco: medio/alto.
- Recomendacao: manter suites atuais; adicionar smokes opt-in para runner, VM, evidencia, rollback, Edge e startup recovery.

## 3. Problemas prioritarios

### Criticos

- `App.jsx` coordena runtime, UI, memoria, Runner, learning loop e harness dev no mesmo componente.
- `aliceMemory.js` e contrato persistente multiplo: uma alteracao errada pode corromper memoria, runner, learning, mind maps ou migracao.
- `src-tauri/src/lib.rs` concentra comandos nativos, filesystem/shell, evidencia e memoria em arquivo unico.
- Transicoes do Runner dependem de lease, validacao e evidencia fisica; qualquer relaxamento quebra seguranca operacional.
- Workspace fallback e VM real coexistem; qualquer confusao entre eles pode gerar falsa confianca operacional.
- Evidencia fisica do Runner e rollback/snapshot do host precisam continuar obrigatorios para acoes reais.

### Altos

- `alice.js` mistura prompt, politica, tool schemas e dominios operacionais.
- Learning loop automatiza scan, task creation, validation, reuse, optimization e promotion em uma mesma rota.
- Tool routing por string depende de sincronizar schema, executor e testes manualmente.
- Dev/harness bridge roda dentro do `App.jsx`, o que pode poluir runtime principal.
- Contexto web depende de frescor de extension/bridge; falhas podem levar a respostas com contexto stale.

### Medios

- HUD recebe snapshots grandes e callbacks amplos em vez de contratos menores por pagina.
- Duplicacao conceitual entre `autonomousLearning/**`, `autonomousLearning*.js`, `autonomousProcedure*.js`, `autonomousReuse*.js` e `learningPlanner/**`.
- Mind map mistura modelo persistente, UI React Flow, sync com Runner e tool executor.
- Normalizadores e helpers `normalizeText`, arrays bounded e sanitizacao aparecem em varios lugares.
- Scripts/harnesses sao uteis, mas precisam ficar claramente dev-only.

### Baixos

- Organizacao de documentacao pode apontar melhor para o plano incremental.
- Nomes de pastas futuras podem ser preparados sem alterar runtime.
- Alguns logs antigos e artefatos locais devem permanecer fora do controle de versao.
- Pequenos view models do HUD podem reduzir props e facilitar testes, mas nao sao urgentes.

## 4. O que deve ser mantido

- Autonomous Task Runner como peca operacional central.
- Lease, heartbeat, preflight, completion criteria e expected evidence do Runner.
- Evidencia fisica em `data/evidence/<executionId>/` com save + verify.
- Separacao honesta entre VM real e workspace fallback.
- Guest Interaction Agent visual e replay/screenshot dentro da VM.
- HUD de auditoria/debug/runner/learning como observabilidade.
- Contexto web via extensao Edge e bridge local.
- Snapshot/diff/checkpoint/rollback do host para PC real.
- Validacao antes de conclusao de task.
- Harnesses uteis de Runner e learning planner.
- Testes Rust de seguranca de path/shell/evidencia.
- Feature flag para comandos desktop legados.

## 5. O que deve ser melhorado

- Reduzir responsabilidade do `App.jsx`.
- Dividir `aliceMemory.js` por dominios com facade compativel.
- Modularizar `alice.js` em prompts e tool declarations.
- Separar tool registry por contexto: web, VM, runner, filesystem, mind map, self-improvement.
- Isolar Runner como servico com API explicita.
- Reduzir aprendizado autonomo para modo candidato/revisao.
- Melhorar eventos de auditoria e saude de extension/bridge.
- Melhorar testes E2E/smoke opt-in.
- Melhorar contratos de dados entre frontend, Tauri e guest agent.
- Separar codigo experimental/dev do runtime principal.
- Padronizar helpers puros de normalizacao/sanitizacao sem alterar semantica.

## 6. O que deve ser apagado, congelado ou movido para legacy

| Item | Classificacao | Justificativa |
| --- | --- | --- |
| `src-tauri/src/legacy_desktop_commands.rs` | manter por enquanto; mover para legacy depois | Ja esta atras de feature flag; nao apagar antes de provar que nenhum fluxo depende dele. |
| Polling `load_dev_runtime_requests` em `App.jsx` | revisar depois; possivel dev-only | Util para harness, mas mistura dev bridge ao runtime principal. |
| `src/autonomousLearning/taskOrchestrator.js` | mover para legacy se confirmado | Documentacao existente indica fluxo legado/simples; precisa inventario antes de apagar. |
| Promocao automatica agressiva do learning loop | congelar | Deve produzir candidates/review ate evidencia + aprovacao humana. |
| Ferramentas sempre declaradas no Gemini Live | revisar depois | Tool surface muito ampla aumenta risco; futura registry por contexto deve carregar o necessario. |
| Duplicacoes entre learning planner/reuse/optimizer/procedure promoter | revisar depois | Pode haver contratos validos; consolidar so apos testes. |
| Bridges/harnesses dev no app principal | mover/encapsular | Dev runtime deve ficar atras de config/flag clara. |
| Logs e artefatos runtime | apagar fora de git quando necessario | Nao fazem parte da arquitetura; respeitar `.gitignore` e nao tocar evidencia real sem pedido. |
| `autonomousLearning/**` experimental | congelar parcialmente | Preservar drivers e contratos uteis, mas impedir evolucao ativa sem review. |

## 7. Nova arquitetura recomendada

A arquitetura deve nascer por facades e wrappers, nao por reescrita. O primeiro objetivo e criar fronteiras estaveis que preservam os imports atuais enquanto novos modulos recebem responsabilidades menores.

```text
src/
  app/
    App.jsx
    bootstrap.js

  core/
    aliceRuntime.js
    turn/
    orchestrator/
    decision/
    toolRouter/
    events/

  memory/
    index.js
    identityMemory.js
    conversationMemory.js
    runnerMemory.js
    procedureMemory.js
    learningMemory.js
    auditMemory.js
    mindMapMemory.js

  tools/
    web/
    vm/
    runner/
    filesystem/
    mindmap/
    selfImprovement/

  runner/
    runnerService.js
    runnerState.js
    runnerScheduler.js
    runnerExecutor.js
    runnerValidation.js
    runnerEvidence.js

  learning/
    learningCandidates.js
    learningReview.js
    procedurePromotion.js

  prompts/
    identityPrompt.js
    behaviorPrompt.js
    webPrompt.js
    vmPrompt.js
    runnerPrompt.js
    safetyPrompt.js
    buildSystemInstruction.js

  hud/
    ...
```

```text
src-tauri/src/
  commands/
    memory.rs
    evidence.rs
    filesystem.rs
    vm.rs
    web.rs
  security/
    scope.rs
  runtime/
    shell.rs
```

Sequencia recomendada:

- Manter `src/alice.js`, `src/aliceMemory.js` e arquivos atuais como facades no inicio.
- Criar modulos novos e mover apenas funcoes puras ou constantes com teste de equivalencia.
- Evitar mudar nomes de comandos Tauri ou payloads ate haver contrato testado.
- Criar `runnerService` envolvendo `runAutonomousTaskRunnerTick`, sem alterar tick.
- Separar `learning` conservador em candidates/review antes de mexer em planner/promoter.

## 8. Plano incremental de execucao

### Fase 0 — Diagnostico e seguranca

- Mapear modulos.
- Rodar testes.
- Registrar estado atual.
- Nao alterar comportamento.

### Fase 1 — Separacao leve sem quebrar runtime

- Criar `docs/plano-melhoria-alice.md`.
- Criar pastas novas sem mover tudo ainda.
- Extrair blocos pequenos e seguros.
- Comecar por helpers puros.
- Nao alterar fluxo do Runner.

### Fase 2 — `App.jsx` menor

- Criar `core/aliceRuntime.js`.
- Mover bootstrap e coordenacao de runtime para fora da UI.
- `App.jsx` deve ficar mais proximo de UI + wiring.
- Primeiro alvo: tool router e memory persistence scheduler.

### Fase 3 — Prompt e tools modulares

- Separar prompts em modulos.
- Separar tool declarations por dominio.
- Criar `buildSystemInstruction`.
- Carregar ferramentas conforme contexto.
- Testar equivalencia do setup final antes de alterar conteudo.

### Fase 4 — Memoria por dominio

- Separar normalizadores por dominio.
- Manter compatibilidade com schema atual.
- Nao migrar para SQLite ainda, apenas preparar fronteiras.
- Criar testes de migracao/pruning.

### Fase 5 — Runner como servico

- Encapsular API do Runner.
- Evitar acesso direto ao estado interno.
- Manter validacao/evidencia obrigatoria.
- Melhorar testes de failure/recovery/evidence.

### Fase 6 — Learning conservador

- Congelar promocao automatica agressiva.
- Manter apenas candidates/review.
- Exigir aprovacao antes de consolidar comportamento.
- Registrar no HUD.

### Fase 7 — Rust/Tauri modular

- Dividir `lib.rs` em comandos e modulos menores.
- Manter interface Tauri compativel.
- Nao quebrar comandos usados pelo frontend.
- Migrar testes junto com cada modulo extraido.

### Fase 8 — E2E real

- Adicionar testes/smokes opt-in para runner.
- Adicionar smokes opt-in para VM real.
- Adicionar smokes opt-in para evidencia fisica.
- Adicionar smokes opt-in para rollback.
- Adicionar smokes opt-in para HUD.
- Adicionar smokes opt-in para Edge extension.
- Adicionar smokes opt-in para startup recovery.

## 9. Criterios de sucesso

A melhoria so e valida se:

- `npm test` passa.
- `npm run lint` passa.
- `npm run build` passa.
- `cargo test` passa em `src-tauri`.
- Comandos existentes continuam funcionando.
- Runner continua exigindo lease, validacao e evidencia.
- Nenhuma task e marcada done sem evidencia.
- Workspace fallback continua separado da VM real.
- Memoria continua migrando corretamente.
- `App.jsx` fica menor ou com responsabilidades mais claras.
- Este documento explica claramente o proximo passo.

## 10. Primeira implementacao permitida

Implementacao permitida nesta primeira fase:

- Criar esta documentacao.
- Criar pastas de arquitetura futura com README de fronteira.
- Extrair funcoes puras pequenas apenas com teste de equivalencia.
- Separar prompts em arquivos sem mudar o conteudo final gerado.
- Separar tool declarations em arquivos sem mudar schemas.
- Criar wrappers/servicos sem mudar comportamento.
- Adicionar testes para garantir equivalencia.

Proibido nesta primeira fase:

- Reescrever o `App.jsx` inteiro.
- Trocar storage para SQLite.
- Apagar `autonomousLearning`.
- Alterar politica do Runner.
- Alterar validacao de evidencias.
- Mexer em rollback sem testes.
- Mudar comandos Tauri publicos.
- Mudar modelo Gemini.
- Adicionar feature nova.

## 11. Relatorio final obrigatorio

Ao final de cada ciclo, responder com:

- Resumo do que foi analisado.
- Problemas encontrados separados por criticidade.
- Mudancas feitas.
- Mudancas evitadas e motivo.
- Testes executados e resultado.
- Proximo passo recomendado.

## Proximo passo recomendado

Fase 1 deve continuar com uma mudanca de baixo risco: criar `src/prompts/` e `src/tools/` como fronteiras documentadas ou extrair o system instruction/tool declarations de `src/alice.js` com teste de equivalencia. A opcao mais segura e criar primeiro READMEs de fronteira e, no ciclo seguinte, mover constantes mantendo `alice.js` como facade.

## Historico de execucao

- Fase 1.1: separar `src/alice.js` em `src/prompts/aliceSystemInstruction.js` e `src/tools/aliceLiveTools.js`, mantendo `src/alice.js` como facade publica e adicionando testes de equivalencia estrutural.
- Fase 1.2: adicionar metadados de dominio em `src/tools/aliceLiveToolDomains.js` sem alterar `ALICE_LIVE_TOOLS`, validando cobertura, unicidade e ordem oficial por teste.
- Fase 1.3: adicionar fixture JSON de contrato para `ALICE_LIVE_TOOLS[0].functionDeclarations` e teste dedicado para proteger shape, campos obrigatorios, dominios, ordem e schemas completos antes de separar tools por dominio.
- Fase 1.4: modularizar completamente as Live tools por dominio em arquivos dedicados (`web`, `mindMap`, `autonomousStatus`, `runner`, `vm`, `autonomousPlanning`, `hostSafety`, `selfImprovement`, `learning`) e transformar `src/tools/aliceLiveTools.js` em montador/facade. Garantia principal: `ALICE_LIVE_TOOLS[0].functionDeclarations` continua igual ao fixture de contrato, preservando nomes, ordem, descriptions, parameters e required. Riscos restantes: ainda nao ha carregamento contextual de tools e `src/App.jsx`, `src/aliceMemory.js` e `src-tauri/src/lib.rs` seguem como centros de acoplamento. Proximo passo recomendado: criar uma camada de tool registry contextual somente em modo inerte/testado, sem mudar quais tools o Gemini Live recebe por padrao.
