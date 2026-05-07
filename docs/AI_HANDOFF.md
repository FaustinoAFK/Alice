# AI HANDOFF — Alice

## Estado atual do projeto

A Alice esta em Fase 1 de organizacao arquitetural incremental. `src/alice.js` ja foi reduzido para facade publica de modelo, prompt, tools e `createAliceLiveSetup`, enquanto prompt e tools foram movidos para modulos dedicados. A ultima mudanca adicionou apenas metadados de dominio das Live tools para preparar futura modularizacao sem alterar runtime.

## Ultima alteracao realizada

Foi executada a Fase 1.2: criacao de `src/tools/aliceLiveToolDomains.js` com agrupamento de nomes de tools por dominio e helpers puros para achatar os dominios e criar indice tool -> dominio. Os testes em `src/alice.test.js` foram ampliados para garantir que os dominios cobrem todas as tools, nao duplicam nomes, preservam a ordem oficial e continuam batendo com `ALICE_LIVE_TOOLS`. O plano em `docs/plano-melhoria-alice.md` foi atualizado com o historico da Fase 1.2.

## Objetivo da alteracao

Reduzir risco antes de uma futura separacao real das tools por dominio. A mudanca cria um contrato testavel de dominio e ordem, mas nao altera schemas, nomes, prompt, modelo Gemini, setup Gemini Live, Runner, VM, memoria, rollback ou Tauri.

## Arquivos criados

- `src/tools/aliceLiveToolDomains.js`
- `docs/AI_HANDOFF.md`

## Arquivos alterados

- `src/alice.test.js`
- `docs/plano-melhoria-alice.md`
- `docs/AI_HANDOFF.md`

## Arquivos criticos preservados

- `src/App.jsx`
  - alterado: nao
  - motivo: preservado fora do escopo da Fase 1.2.
  - risco: nenhum risco novo introduzido.

- `src/alice.js`
  - alterado: nao nesta rodada
  - motivo: ja estava como facade desde a Fase 1.1; nao foi necessario tocar.
  - risco: baixo; continua dependendo dos exports extraidos em `src/prompts/aliceSystemInstruction.js` e `src/tools/aliceLiveTools.js`.

- `src/aliceMemory.js`
  - alterado: nao
  - motivo: memoria persistente fora do escopo.
  - risco: nenhum risco novo introduzido.

- `src/autonomousTaskRunner.js`
  - alterado: nao
  - motivo: Runner fora do escopo.
  - risco: nenhum risco novo introduzido.

- `src/autonomousRunnerState.js`
  - alterado: nao
  - motivo: estado/transicoes do Runner fora do escopo.
  - risco: nenhum risco novo introduzido.

- `src/autonomousLearningLoop.js`
  - alterado: nao
  - motivo: learning loop fora do escopo.
  - risco: nenhum risco novo introduzido.

- `src-tauri/src/lib.rs`
  - alterado: nao
  - motivo: comandos Tauri/Rust fora do escopo.
  - risco: nenhum risco novo introduzido.

- `src-tauri/src/local_vm.rs`
  - alterado: nao
  - motivo: VM local fora do escopo.
  - risco: nenhum risco novo introduzido.

- `src-tauri/src/vm_visual.rs`
  - alterado: nao
  - motivo: guest agent visual fora do escopo.
  - risco: nenhum risco novo introduzido.

- `src-tauri/src/web_knowledge.rs`
  - alterado: nao
  - motivo: bridge/contexto web fora do escopo.
  - risco: nenhum risco novo introduzido.

## Contratos preservados

- `src/alice.js` continua como facade publica: sim.
- `ALICE_LIVE_MODEL` continua exportado: sim.
- `ALICE_SYSTEM_INSTRUCTION` continua exportado: sim.
- `ALICE_LIVE_TOOLS` continua exportado: sim.
- `createAliceLiveSetup` continua exportado: sim.
- Ordem das tools foi preservada: sim, validada por teste.
- Schemas das tools foram preservados: sim; `src/tools/aliceLiveTools.js` nao foi alterado nesta rodada.
- Prompt principal nao mudou semanticamente: sim; prompt nao foi alterado nesta rodada.
- Runner continua exigindo lease, validacao e evidencia: sim; Runner nao foi alterado.
- Nenhuma task pode virar done sem evidencia validada: sim; transicoes do Runner nao foram alteradas.
- Workspace fallback continua separado de VM real: sim; VM/fallback nao foram alterados.
- Rollback/snapshot nao foi enfraquecido: sim; rollback/snapshot nao foram alterados.
- Learning automatico nao promove comportamento ativo sem revisao: sim; learning nao foi alterado.

## Testes executados

```powershell
npm test
```

Resultado: passou. `45` arquivos de teste, `483` testes.

```powershell
npm run lint
```

Resultado: passou.

```powershell
npm run build
```

Resultado: passou. Permanece o aviso conhecido do Vite sobre chunks acima de 500 kB.

```powershell
cd src-tauri
cargo test
```

Resultado: nao executado nesta rodada da Fase 1.2 porque o escopo nao alterou Rust/Tauri. Ultima execucao anterior nesta sequencia passou com `77` testes.

## Riscos ainda existentes

- `src/App.jsx` continua grande e acoplado, ainda coordenando UI, Live, memoria, Runner, learning, HUD e timers.
- `src/aliceMemory.js` continua sendo facade e contrato persistente amplo demais.
- `src-tauri/src/lib.rs` continua concentrando comandos nativos sensiveis.
- Os dominios de tools agora sao metadados testados, mas os schemas ainda permanecem em um unico arquivo grande.

## Proximo passo

Executar Fase 1.3: criar contrato/snapshot leve para os schemas das tools antes de qualquer separacao real por arquivos de dominio. Nao mover schemas ainda sem teste de equivalencia forte.
