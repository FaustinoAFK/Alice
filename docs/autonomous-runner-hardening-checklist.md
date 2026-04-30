# Autonomous Runner Hardening Checklist

Esta checklist congela o escopo da fase de hardening: testar, quebrar, observar,
corrigir bug real e retestar. Nao adicionar novas features grandes durante esta
fase.

## Contrato central automatizado

Os testes em `src/autonomousRunner.test.js` devem garantir:

- Nenhuma task entra em `running` sem lease.
- Nenhum step entra em `running` sem lease.
- Nenhuma task vira `done` sem execucao verificada, validacao aprovada e evidencia.
- Nenhum step vira `done` sem execucao verificada, validacao aprovada e evidencia.
- Nenhuma task/step vira `done` se `save_runner_evidence` falhar.
- Nenhuma task/step vira `done` se `verify_runner_evidence` retornar `missing`, `partial` ou `unavailable`.
- Refs de evidencia so entram no estado quando a persistencia fisica foi confirmada ou quando a falha esta registrada explicitamente sem fingir sucesso.
- Step sem `completionCriteria` nao executa.
- Step sem evidencia esperada nao pode validar conclusao.
- VM indisponivel coloca a task em `waiting_retry` sem travar a fila inteira.
- Falha controlada respeita tentativas e termina em `failed`/`blocked`.
- Heartbeat stale no startup recupera task `running` sem assumir sucesso.
- Retencao preserva evidencias importantes e de task ativa.
- Volume controlado mantem ordenacao por prioridade e `queueRank`.

Comando:

```bash
npm test -- src/autonomousRunner.test.js
```

## Evidencia fisica obrigatoria

Contrato atual:

1. O Runner pode montar refs candidatas em memoria para validar o criterio do step.
2. Antes de anexar refs ao estado ou marcar `done`, o app precisa chamar `save_runner_evidence`.
3. Depois do save, o app chama `verify_runner_evidence` para confirmar os arquivos em `data/evidence/<executionId>/`.
4. Se save ou verificacao falhar, a task fica em estado seguro (`waiting_retry`/`failed`) e a auditoria registra `evidence_persistence_failed`.
5. O HUD pode mostrar `confirmada`, `parcialmente ausente`, `ausente`, `indisponivel` ou `nao verificada`.

Arquivos esperados pelo comando nativo:

- `metadata.json`
- `stdout.txt`
- `stderr.txt`
- `validation.json`

Testes obrigatorios:

```bash
npm test -- src/autonomousRunner.test.js
cd src-tauri
cargo test verify_runner_evidence
```

Aceite:

- Falha simulada de `save_runner_evidence` nao cria refs validas e nao permite `done`.
- Falha simulada de `verify_runner_evidence` com status `partial` nao permite `done`.
- Sucesso de save + verificacao permite `done` apenas se execucao e validacao tambem passaram.
- Auditoria contem evento `evidence_persistence`.

## Aprendizado autonomo governado

O ciclo de aprendizado novo deve obedecer ao mesmo contrato do Runner:

- `src/autonomousLearningLoop.js` so cria tasks oficiais do Runner.
- Nenhum modulo de aprendizado, reuso ou otimizacao executa comandos diretamente.
- Tasks de aprendizado usam `metadata.createdBy = "autonomous_learning_loop"`.
- Tasks de reuso usam `metadata.createdBy = "autonomous_procedure_reuse"`.
- Tasks de otimizacao usam `metadata.createdBy = "autonomous_procedure_optimizer"`.
- O loop so inicia depois da memoria hidratada e com Runner sem lock/task/step em `running`.
- O scanner detecta gaps, mas o planner limita experimentos por ciclo e por hora.
- Antes de criar experimento novo, o loop consulta reuso de procedures.
- Promocao exige `done`, validacao positiva, evidencia fisica e `verify_runner_evidence`.
- Aprendizado promovido entra como `candidate`/`guarded`, nunca `active` direto.
- Scripts sintetizados ficam em workspace controlado, passam por validacao estrutural e bloqueiam acoes destrutivas.

Comandos de contrato:

```bash
npm test -- src/autonomousLearningLoop.test.js
npm run runner:harness -- autonomous-learning verify-safe-state
npm run runner:harness -- autonomous-learning dry-run
npm run runner:harness -- autonomous-reuse simulate "Pesquisar documentacao sobre erro X"
```

## Smoke test real na VM/workspace

Criar task real:

- Titulo: `Criar arquivo de teste na VM`
- Step unico: criar `runner-smoke-test.txt`
- `completionCriteria`: `file_exists`
- `expectedEvidence`: `metadata`, `stdout`/`stderr`, `validation`

Aceite:

- Task: `planned -> ready -> running -> done`
- Step: `ready -> running -> done`
- Evidencia em `data/evidence/<executionId>/`
- HUD mostra `done`, `reason`, lease antigo limpo e historico
- Mapa mental marca node como `done`
- Nenhuma task fica `running`

## Task grande real

Criar task com 5 a 10 steps:

1. Verificar Node.
2. Verificar npm.
3. Verificar Python.
4. Listar diretorio do projeto.
5. Rodar `npm test`.
6. Rodar `npm run lint`.
7. Rodar `npm run build`.
8. Salvar relatorio.

Cada step deve ter `completionCriteria`, `expectedEvidence`, `timeoutPolicy` e
`retryPolicy`.

Aceite:

- Steps rodam em ordem.
- Cada step salva evidencia.
- Falha em step critico nao marca a task como `done`.
- HUD mostra progresso por step.
- Auditoria explica transicoes e preflight.

## Falha controlada

Criar step:

- Comando: `comando_que_nao_existe_123`
- `completionCriteria`: `exit_code` esperado `0`

Aceite:

- Step vai para `waiting_retry`.
- `attempts` aumenta.
- `nextRunAt` e definido.
- Ao atingir `maxAttempts`, task vira `failed` ou `blocked`.
- Evidencia da falha e preservada.
- `response.ok` e `false`.

## VM indisponivel

Com VM/workspace bloqueado, criar duas tasks prontas.

Aceite:

- Task que precisa da VM falha no preflight.
- Status vira `waiting_retry`, reason `vm_unavailable`.
- Fila tenta outra task elegivel.
- HUD e auditoria mostram por que a task foi pulada.

## Startup recovery e heartbeat stale

Simular:

```js
task.status = "running"
task.heartbeatAt = "timestamp antigo"
runner.runnerLock.heartbeatAt = "timestamp antigo"
```

Aceite:

- `recoverAutonomousTasksOnStartup` detecta stale.
- Task sai de `running`.
- Reason `stale_running_task`.
- Lock invalido e limpo.
- Auditoria registra recovery.
- Nunca assumir sucesso sem evidencia.

## Dependencias e recovery

Criar Task B dependente de Task A.

Aceite quando A passa:

- A vira `done`.
- B fica elegivel e roda depois.

Aceite quando A falha:

- B nao roda.
- Recovery task e criada quando houver estrategia segura.
- Loop repetido sem progresso vira `recovery_loop_detected`.

## Autoplanejamento e dry-run

Criar task `planned` sem steps.

Aceite:

- Nao vira `running` diretamente.
- Gera steps com criterios e evidencias ou fica `blocked`/`waiting_input`.
- Dry-run nao altera projeto real.
- Dry-run nunca substitui execucao real.

## Evidencias e retencao

Verificar:

- Evidencia leve fica em memoria apenas como refs.
- Evidencia pesada fica em `data/evidence/<executionId>/`.
- `verify_runner_evidence` confirma fisicamente os arquivos referenciados sem aceitar path arbitrario.
- Falha de save/verificacao entra no HUD/debug e na auditoria.
- `alice-memory.json` fica abaixo do limite nativo de 50 MiB antes de smoke real.
- `compact-runner-memory` reduz auditoria/refs antigas somente via harness oficial, com backup e preservando evidencias fisicas por padrao.
- Falhas, blockers, task critica, task ativa e aprendizado aprovado sao preservados.
- Sucessos antigos podem ser limpos pela politica.

Comando de compactacao operacional:

```bash
npm run runner:harness -- compact-runner-memory
npm run runner:harness -- verify-safe-state
```

Aceite da compactacao:

- estado inicial precisa estar `SAFE`, exceto triagem manual com `--force`;
- backup `alice-memory.json.harness-backup-*` e criado;
- arquivos em `data/evidence` nao sao removidos;
- auditoria registra `harness_compaction`;
- tamanho persistido cai para abaixo de `52428800` bytes quando havia excesso apenas por historico/auditoria.

## HUD e mapa mental

Validar visualmente:

- Autonomia ON/OFF.
- Pausar/retomar Runner.
- Cancelar task/fila.
- Bloquear e reexecutar task.
- Reordenar fila atualiza `queueRank`.
- Auditoria mostra status, reason, attempts, heartbeat, lease, next retry e evidencias.
- Mapa mostra task, steps, dependencia, falha, recovery, blocker e evidencia.

## Agente visual residente

Validar quando usar VirtualBox:

- `start_vm_guest_agent_resident` instala/atualiza arquivos do agente antes de iniciar servidor residente.
- O port-forward NAT usa somente `127.0.0.1` no host e nome fixo `alice-guest-agent`.
- `run_vm_guest_agent_action` tenta `resident_http` primeiro e volta para `guestcontrol_run` se o residente estiver indisponivel.
- `diagnose_vm_guest_agent` nao deve iniciar o residente como efeito colateral.
- O protocolo HTTP residente preserva o shape JSON do agente one-shot (`success`, `result`, `error`, `request_id`, `correlation_id`).
- Acoes repetidas devem reportar `transport: resident_http` ou `resident_http_started` nos artifacts quando o caminho rapido estiver ativo.

## Instalacoes elevadas na VM

Contrato operacional:

- `run_vm_operational_task` pode iniciar instalacoes via `winget` em background apenas quando o pacote nao exigir elevacao interativa.
- Apps conhecidos que normalmente pedem UAC, como Oracle VirtualBox, devem marcar `requiresElevatedInstall`.
- Se o Guest Interaction Agent nao reportar `can_run_elevated_commands`, a tarefa deve retornar `elevated_agent_required` em vez de criar um background fadado a falhar.
- Se o agente estiver elevado, o mesmo fluxo deve aceitar qualquer `winget id`/comando informado, sem depender de dicionario fixo para permissao.
- `check_background_task` deve diferenciar "consulta feita com sucesso" de "tarefa consultada falhou". Status `failed`, `timeout` ou `cancelled` deve virar falha operacional visivel no HUD/auditoria.
- Exit code de instalador, quando disponivel, deve aparecer em `backgroundSummary`/artifacts para triagem.

Aceite:

- Pedido para instalar VirtualBox na VM nao inicia background automatico com agente nao elevado.
- Pedido para instalar VirtualBox na VM pode iniciar background quando o agente reporta capacidade elevada.
- Status `failed` de uma tarefa background nao retorna `response.ok=true`.
- Evento auditavel usa `vm_operational_task_failed` para background finalizado com erro.

## BehaviorContext e DecisionEngine

Validar que o contexto recebe apenas resumo leve:

```js
autonomous_runner_summary
```

Aceite:

- Nao enviar objeto gigante.
- Falhas recentes aumentam cautela.
- Blockers priorizam desbloqueio.
- Runner ativo evita iniciar outra tarefa grande em paralelo.

## Validacao final

Rodar:

```bash
npm test
npm run lint
npm run build
cargo test
```

Aceite final:

- Testes passam.
- Lint passa.
- Build passa.
- `cargo test` passa.
- Warning de chunk grande deve estar explicado; `MindMapHudPage` deve continuar lazy-loaded.
