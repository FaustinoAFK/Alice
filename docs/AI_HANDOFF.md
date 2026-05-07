# AI HANDOFF — Alice

## Estado atual do projeto

A Alice esta em Fase 1 de organizacao arquitetural incremental. `src/alice.js` continua como facade publica; o prompt segue separado; as Live tools agora estao modularizadas por dominio em arquivos dedicados; `src/tools/aliceLiveTools.js` virou montador/facade e continua exportando o mesmo `ALICE_LIVE_TOOLS` final. Nao ha carregamento contextual ativo ainda.

## Última alteração realizada

Foi executada a Fase 1.4 — Modularizacao completa das Live tools por dominio, com contrato preservado. As declarations foram movidas de `src/tools/aliceLiveTools.js` para arquivos por dominio: web, mind map, autonomous status, runner, VM, autonomous planning, host safety, self-improvement e learning. `aliceLiveTools.js` agora monta `ALICE_LIVE_TOOL_DECLARATIONS` na ordem oficial a partir dos dominios e exporta `ALICE_LIVE_TOOLS` no mesmo formato publico.

## Objetivo da alteração

Reduzir o tamanho e a responsabilidade de `src/tools/aliceLiveTools.js`, preparando uma futura arquitetura de tool registry contextual sem alterar o comportamento atual. A mudanca preserva exatamente o contrato completo de `ALICE_LIVE_TOOLS[0].functionDeclarations` contra o fixture JSON criado na Fase 1.3.

## Arquivos criados

- `src/tools/webLiveTools.js`
- `src/tools/mindMapLiveTools.js`
- `src/tools/autonomousStatusLiveTools.js`
- `src/tools/runnerLiveTools.js`
- `src/tools/vmLiveTools.js`
- `src/tools/autonomousPlanningLiveTools.js`
- `src/tools/hostSafetyLiveTools.js`
- `src/tools/selfImprovementLiveTools.js`
- `src/tools/learningLiveTools.js`

## Arquivos alterados

- `src/tools/aliceLiveTools.js`
- `src/tools/aliceLiveToolDomains.js`
- `src/tools/aliceLiveTools.contract.test.js`
- `docs/plano-melhoria-alice.md`
- `docs/AI_HANDOFF.md`

## Arquivos críticos preservados

- `src/App.jsx`
  - alterado: nao
  - motivo: runtime/UI fora do escopo.
  - risco: nenhum risco novo introduzido.

- `src/alice.js`
  - alterado: nao
  - motivo: facade publica preservada sem mudancas.
  - risco: nenhum risco novo introduzido.

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
  - motivo: Rust/Tauri fora do escopo.
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
- Ordem das tools foi preservada: sim, via `ALICE_LIVE_TOOL_ORDER`, dominios e fixture.
- Schemas das tools foram preservados: sim, `ALICE_LIVE_TOOLS[0].functionDeclarations` bate com `src/tools/__fixtures__/aliceLiveTools.contract.json`.
- Prompt principal nao mudou semanticamente: sim, prompt nao foi alterado.
- Runner continua exigindo lease, validacao e evidencia: sim, Runner nao foi alterado.
- Nenhuma task pode virar done sem evidencia validada: sim, transicoes do Runner nao foram alteradas.
- Workspace fallback continua separado de VM real: sim, VM/fallback nao foram alterados.
- Rollback/snapshot nao foi enfraquecido: sim, rollback/snapshot nao foram alterados.
- Learning automatico nao promove comportamento ativo sem revisao: sim, learning runtime nao foi alterado.

## Testes executados

```powershell
npx vitest run src/tools/aliceLiveTools.contract.test.js
```

Resultado: passou. `1` arquivo de teste, `7` testes.

```powershell
npm test
```

Resultado: passou. `46` arquivos de teste, `490` testes.

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

Resultado: nao necessario se `src-tauri/` permanecer intocado; registrar como nao executado ao final.
Nao executado nesta rodada porque nenhum arquivo em `src-tauri/` foi alterado.

## Riscos ainda existentes

- Ainda nao existe carregamento contextual ativo de tools; todas continuam indo para o Gemini Live por padrao.
- `src/App.jsx` continua grande e acoplado, coordenando UI, Live, memoria, Runner, learning, HUD e timers.
- `src/aliceMemory.js` continua sendo contrato persistente amplo demais.
- `src-tauri/src/lib.rs` continua concentrando comandos nativos sensiveis.
- Os schemas agora estao modularizados, mas qualquer mudanca futura precisa manter o fixture de contrato como trava.

## Próximo passo

Criar uma camada inerte de tool registry contextual que apenas descreve quais dominios seriam carregados em cada contexto, sem mudar ainda o `ALICE_LIVE_TOOLS` padrao enviado ao Gemini Live.
