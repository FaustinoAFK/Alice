# Autonomous Task Runner

## O que e

O Autonomous Task Runner e o executor oficial para tarefas longas, multistep ou de background. Ele combina fila, status, preflight, lease, lock, heartbeat, executor, validacao, evidencia fisica, retry, recovery, learning candidates, sincronizacao com mind map e HUD.

## Arquivos centrais

- `src/autonomousTaskRunner.js`: tick principal e orquestracao.
- `src/autonomousRunnerState.js`: schema, normalizacao, tasks, steps, status, transicoes e auditoria.
- `src/autonomousRunnerLease.js`: lock, lease, heartbeat e recovery de stale tasks.
- `src/autonomousRunnerScheduler.js`: elegibilidade, prioridade e intervalo dinamico.
- `src/autonomousRunnerPlanner.js`: planejamento automatico de tasks `planned`.
- `src/autonomousRunnerPreflight.js`: valida dependencias, VM/fallback, step executavel, criterios e evidencia esperada.
- `src/autonomousRunnerExecutor.js`: traduz step para comando Tauri.
- `src/autonomousRunnerEvidence.js`: cria refs de evidencia.
- `src/autonomousRunnerValidation.js`: valida completion criteria.
- `src/autonomousRunnerRecoveryPlanner.js`: planeja recovery e evita loops.
- `src/autonomousRunnerToolExecutor.js`: tool `manage_autonomous_runner`.
- `src/autonomousRunnerMindMap.js`: sincroniza Runner com mind map.
- `src/hud/pages/AutonomousRunnerHudPage.jsx` e `runnerHudViewModel.js`: exibicao no HUD.

## Estados e contratos

O estado fica em `aliceMemory.autonomousRunner`. Campos principais: `enabled`, `runnerState`, `queue`, `tasksById`, `activeTaskId`, `runnerLock`, `evidenceRefs`, `auditRefs`, `audits` e `settings`. Task tem `status`, `priority`, `riskLevel`, `requiresRealVm`, `allowWorkspaceFallback`, `steps`, `dependencies`, `executionHistory` e `evidenceRefs`. Step tem `type`, `action`, `completionCriteria`, `expectedEvidence`, `timeoutPolicy`, `retryPolicy`, `attempts`, `result` e `evidenceRefs`.

## Invariantes importantes

- Runner disabled ou paused nao executa task.
- Lock ativo impede tick concorrente.
- Transicao para `running` exige lease.
- Heartbeat atualiza prova de atividade durante execucao.
- Transicao para `done` exige execucao verificada, validacao passada e evidencia persistida.
- Falha de persistencia de evidencia invalida o sucesso.
- Runtime/VM indisponivel deve gerar blocked/failure honesto, nao sucesso.
- Workspace fallback nao pode ser tratado como VM real.

## Fluxo de execucao

Task entra na fila por tool, learning loop, planner/harness ou HUD. O timer em `App.jsx` chama `runAutonomousTaskRunnerTick`. O Runner normaliza, recupera stale tasks, consulta scheduler, planeja se necessario, roda preflight, adquire lease, inicia heartbeat, executa step, valida, salva/verifica evidencia, atualiza task/step, libera lease e calcula proximo intervalo.

## Estados finais

- `done`: todos os steps relevantes passaram com evidencia fisica.
- `failed`: validacao falhou, max attempts acabou ou erro nao recuperavel ocorreu.
- `blocked`: dependencia/VM/runtime/politica impedem execucao segura.
- `waiting_retry`: tentativa falhou mas ainda ha retry permitido.
- `cancelled`: usuario/tool cancelou task ou fila.

## Riscos

Relaxar transicoes pode criar falso sucesso. Tasks criadas por tool com criterio fraco podem ficar bloqueadas ou produzir evidencia inutil. Recovery precisa evitar loops. Como `App.jsx` controla timers, persistencia e wake-ups, falhas de orquestracao afetam todo o Runner.

## Como testar

`src/autonomousRunner.test.js` e o principal arquivo. Ele cobre estado, scheduler, preflight, lease, executor, evidencias, validacao e recovery. `src/dev/autonomousRunnerHarness.test.js` cobre harness. Ainda falta validacao end-to-end com Tauri real, VM real e filesystem de evidencia em ambiente controlado.
