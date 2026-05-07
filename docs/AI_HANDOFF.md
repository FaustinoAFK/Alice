# AI HANDOFF - Alice

## Estado atual do projeto

A Alice esta em Fase 1 de organizacao arquitetural incremental. `src/alice.js` continua como facade publica; o prompt segue separado; as Live tools estao modularizadas por dominio em arquivos dedicados; `src/tools/aliceLiveTools.js` continua como montador/facade e exporta o mesmo `ALICE_LIVE_TOOLS` final. Existe uma camada inerte de registry contextual em `src/tools/registry/`, mas nao ha carregamento contextual ativo ainda.

## Ultima alteracao realizada

Foi executada a Fase 1.5 - Tool registry contextual inerte. Foram criados perfis contextuais que mapeiam contextos para dominios de tools, sem duplicar schemas e sem alterar runtime. O registry monta nomes, declarations e objetos Live tools por perfil apenas quando chamado diretamente em testes/codigo futuro; `createAliceLiveSetup` e `ALICE_LIVE_TOOLS` padrao continuam iguais.

## Objetivo da alteracao

Preparar a futura selecao contextual de tools com uma camada puramente funcional e inerte. A mudanca apenas descreve quais dominios seriam usados em perfis como `full`, `conversation`, `web`, `vm`, `selfImprovement` e `learningReview`; ela preserva exatamente o contrato completo de `ALICE_LIVE_TOOLS[0].functionDeclarations` contra o fixture JSON criado na Fase 1.3.

## Arquivos criados

- `src/tools/registry/toolContextProfiles.js`
- `src/tools/registry/toolRegistry.js`
- `src/tools/registry/toolRegistry.test.js`

## Arquivos alterados

- `docs/plano-melhoria-alice.md`
- `docs/AI_HANDOFF.md`

## Arquivos criticos preservados

- `src/App.jsx`
  - alterado: nao
  - motivo: runtime/UI fora do escopo.
  - risco: nenhum risco novo introduzido.

- `src/alice.js`
  - alterado: nao
  - motivo: facade publica preservada sem mudancas.
  - risco: nenhum risco novo introduzido.

- `src/tools/aliceLiveTools.js`
  - alterado: nao
  - motivo: `ALICE_LIVE_TOOLS` padrao fora do escopo.
  - risco: nenhum risco novo introduzido.

- `src/tools/aliceLiveToolDomains.js`
  - alterado: nao
  - motivo: dominios oficiais existentes foram reutilizados.
  - risco: nenhum risco novo introduzido.

- `src/tools/__fixtures__/aliceLiveTools.contract.json`
  - alterado: nao
  - motivo: fixture de contrato nao deve mascarar mudanca.
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

- `src-tauri/`
  - alterado: nao
  - motivo: Rust/Tauri fora do escopo.
  - risco: nenhum risco novo introduzido.

## Contratos preservados

- `src/alice.js` continua como facade publica: sim.
- `ALICE_LIVE_MODEL` continua exportado: sim.
- `ALICE_SYSTEM_INSTRUCTION` continua exportado: sim.
- `ALICE_LIVE_TOOLS` continua exportado: sim.
- `createAliceLiveSetup` continua exportado: sim.
- `createAliceLiveSetup` continua usando `ALICE_LIVE_TOOLS` completo por padrao: sim.
- Ordem das tools foi preservada: sim, via `ALICE_LIVE_TOOL_ORDER`, dominios e fixture.
- Schemas das tools foram preservados: sim, `ALICE_LIVE_TOOLS[0].functionDeclarations` bate com `src/tools/__fixtures__/aliceLiveTools.contract.json`.
- Registry contextual esta inerte: sim, nao e importado por `src/alice.js` nem usado por `createAliceLiveSetup`.
- Perfil `full` equivale ao contrato completo: sim, `buildLiveToolsForProfile('full')` bate com fixture e `ALICE_LIVE_TOOLS`.
- Prompt principal nao mudou semanticamente: sim, prompt nao foi alterado.
- Runner continua exigindo lease, validacao e evidencia: sim, Runner nao foi alterado.
- Nenhuma task pode virar done sem evidencia validada: sim, transicoes do Runner nao foram alteradas.
- Workspace fallback continua separado de VM real: sim, VM/fallback nao foram alterados.
- Rollback/snapshot nao foi enfraquecido: sim, rollback/snapshot nao foram alterados.
- Learning automatico nao promove comportamento ativo sem revisao: sim, learning runtime nao foi alterado.

## Registry criado

- `TOOL_CONTEXT_PROFILES` descreve perfis por lista de dominios, nao por schemas duplicados.
- `getToolDomainsForProfile(profileName)` lista dominios do perfil.
- `getToolNamesForProfile(profileName)` lista nomes de tools do perfil.
- `getToolDeclarationsForProfile(profileName)` monta declarations a partir das declarations oficiais, preservando a ordem oficial de `ALICE_LIVE_TOOLS`.
- `buildLiveToolsForProfile(profileName)` monta o shape Live tools para uso futuro/opt-in.
- Validadores puros cobrem dominios inexistentes, duplicidade de tools, existencia dos nomes no contrato oficial e equivalencia do perfil `full`.

## Testes executados

```powershell
npx vitest run src/tools/registry/toolRegistry.test.js
```

Resultado: passou. `1` arquivo de teste, `9` testes.

```powershell
npx vitest run src/tools/aliceLiveTools.contract.test.js
```

Resultado: passou. `1` arquivo de teste, `7` testes.

```powershell
npx vitest run src/alice.test.js
```

Resultado: passou. `1` arquivo de teste, `9` testes.

```powershell
npm test
```

Resultado: passou. `47` arquivos de teste, `499` testes.

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

- Ainda nao existe carregamento contextual ativo de tools; todas continuam indo para o Gemini Live por padrao.
- O registry contextual ainda e descritivo/inativo por design; qualquer ativacao futura precisa passar por `createAliceLiveSetup` com teste de equivalencia e decisao explicita.
- `src/App.jsx` continua grande e acoplado, coordenando UI, Live, memoria, Runner, learning, HUD e timers.
- `src/aliceMemory.js` continua sendo contrato persistente amplo demais.
- `src-tauri/src/lib.rs` continua concentrando comandos nativos sensiveis.
- Os schemas continuam protegidos pelo fixture de contrato; qualquer mudanca futura precisa manter essa trava.

## Proximo passo

Proximo passo seguro: revisar como o runtime poderia escolher um perfil em modo opt-in/testado, ainda sem mudar o padrao. Antes de ativar qualquer selecao contextual, adicionar teste que prove que o default continua enviando `ALICE_LIVE_TOOLS` completo.
