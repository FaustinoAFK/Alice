# AI HANDOFF — Alice

## Estado atual do projeto

A Alice esta em Fase 1 de organizacao arquitetural incremental. `src/alice.js` continua como facade publica; o prompt e as Live tools continuam separados em modulos dedicados; os dominios das tools continuam como metadados de apoio. A ultima alteracao adicionou um contrato JSON estavel para proteger os schemas completos das Live tools antes de qualquer futura separacao por dominio.

## Ultima alteracao realizada

Foi executada a Fase 1.3. Foi criado um fixture JSON em `src/tools/__fixtures__/aliceLiveTools.contract.json` contendo exatamente `ALICE_LIVE_TOOLS[0].functionDeclarations` serializado com `JSON.stringify(..., null, 2)`. Tambem foi criado `src/tools/aliceLiveTools.contract.test.js`, que valida shape top-level, campos obrigatorios, unicidade de nomes, ordem oficial via dominios, pertencimento exato a um dominio e igualdade completa contra o fixture.

## Objetivo da alteracao

Proteger os schemas completos das Live tools contra mudancas acidentais antes de mover qualquer declaration para arquivos separados por dominio. A mudanca cria uma trava de contrato auditavel sem alterar runtime, prompt, modelo Gemini, schemas reais, nomes, ordem, descriptions, parameters ou required.

## Arquivos criados

- `src/tools/__fixtures__/aliceLiveTools.contract.json`
- `src/tools/aliceLiveTools.contract.test.js`

## Arquivos alterados

- `docs/plano-melhoria-alice.md`
- `docs/AI_HANDOFF.md`

## Arquivos criticos preservados

- `src/App.jsx`
  - alterado: nao
  - motivo: fora do escopo da Fase 1.3.
  - risco: nenhum risco novo introduzido.

- `src/alice.js`
  - alterado: nao
  - motivo: facade publica preservada sem mudancas nesta rodada.
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
- Ordem das tools foi preservada: sim, validada contra `flattenAliceLiveToolDomainNames`.
- Schemas das tools foram preservados: sim, `src/tools/aliceLiveTools.js` nao foi alterado e o fixture bate com `functionDeclarations`.
- Prompt principal nao mudou semanticamente: sim, prompt nao foi alterado.
- Runner continua exigindo lease, validacao e evidencia: sim, Runner nao foi alterado.
- Nenhuma task pode virar done sem evidencia validada: sim, transicoes do Runner nao foram alteradas.
- Workspace fallback continua separado de VM real: sim, VM/fallback nao foram alterados.
- Rollback/snapshot nao foi enfraquecido: sim, rollback/snapshot nao foram alterados.
- Learning automatico nao promove comportamento ativo sem revisao: sim, learning nao foi alterado.

## Testes executados

```powershell
npm test
```

Resultado: passou. `46` arquivos de teste, `488` testes.

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

Resultado: nao executado nesta rodada porque nenhum arquivo em `src-tauri/` foi alterado.

## Riscos ainda existentes

- `src/App.jsx` continua grande e acoplado, coordenando UI, Live, memoria, Runner, learning, HUD e timers.
- `src/aliceMemory.js` continua sendo contrato persistente amplo demais.
- `src-tauri/src/lib.rs` continua concentrando comandos nativos sensiveis.
- Os schemas das Live tools continuam em um unico arquivo grande; agora estao protegidos por fixture, mas ainda nao foram modularizados por dominio.

## Proximo passo

Executar a proxima etapa da Fase 1 com uma separacao real, pequena e testada de declarations por dominio, provavelmente comecando por um dominio de baixo risco como `web`, mantendo `src/tools/aliceLiveTools.js` exportando o mesmo `ALICE_LIVE_TOOLS` final e usando o contrato JSON para bloquear qualquer mudanca acidental.
