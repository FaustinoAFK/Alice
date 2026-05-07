# AI HANDOFF - Alice

## Estado atual do projeto

A Alice esta em Fase 1 de organizacao arquitetural incremental. `src/alice.js` continua como facade publica; o prompt segue separado; as Live tools estao modularizadas por dominio em arquivos dedicados; `src/tools/aliceLiveTools.js` continua como montador/facade e exporta o mesmo `ALICE_LIVE_TOOLS` final. Existe uma camada inerte de registry contextual em `src/tools/registry/`, incluindo um resolvedor puro que sugere perfis futuros, mas nao ha carregamento contextual ativo ainda.

## Ultima alteracao realizada

Foi executada a Fase 1.6 - Tool profile resolver inerte. Foi criado `resolveToolProfile(context)`, uma funcao pura que sugere um perfil de tools com base em texto/contexto, retorna `profile`, `reason`, `confidence` e `fallbackProfile`, e valida perfis contra `TOOL_CONTEXT_PROFILES`. O resolvedor nao e usado pelo runtime real; `createAliceLiveSetup` e `ALICE_LIVE_TOOLS` padrao continuam iguais.

## Objetivo da alteracao

Preparar uma camada conservadora para futura selecao contextual de tools sem ativar essa selecao. A mudanca apenas sugere perfis como `conversation`, `web`, `vm`, `runner`, `selfImprovement`, `learningReview`, `hostSafety` ou `full`, caindo para `full` quando ha duvida ou perfil explicito invalido.

## Arquivos criados

- `src/tools/registry/toolProfileResolver.js`
- `src/tools/registry/toolProfileResolver.test.js`

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
  - motivo: dominios oficiais existentes foram reutilizados sem mudanca.
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
- Schemas das tools foram preservados: sim, nenhum schema ou fixture foi alterado.
- Resolver contextual esta inerte: sim, nao e importado por `src/alice.js` nem usado por `createAliceLiveSetup`.
- Prompt principal nao mudou semanticamente: sim, prompt nao foi alterado.
- Runner continua exigindo lease, validacao e evidencia: sim, Runner nao foi alterado.
- Nenhuma task pode virar done sem evidencia validada: sim, transicoes do Runner nao foram alteradas.
- Workspace fallback continua separado de VM real: sim, VM/fallback nao foram alterados.
- Rollback/snapshot nao foi enfraquecido: sim, rollback/snapshot nao foram alterados.
- Learning automatico nao promove comportamento ativo sem revisao: sim, learning runtime nao foi alterado.

## Resolver criado

- `resolveToolProfile(context)` e uma funcao pura sem side effects.
- O retorno tem shape `{ profile, reason, confidence, fallbackProfile: 'full' }`.
- `explicitToolProfile` valido tem prioridade.
- `explicitToolProfile` invalido cai para `full` com reason claro.
- Perguntas sobre pagina/site/aba atual sugerem `web` apenas quando `hasActiveWebPage=true`; sem pagina ativa caem para `full`.
- Pedidos de VM sugerem `vm`.
- Pedidos de fila/tarefa longa/runner sugerem `runner`.
- Pedidos de auto-melhoria/codigo da Alice sugerem `selfImprovement`.
- Pedidos de aprendizado/candidato/procedimento sugerem `learningReview`.
- Pedidos de snapshot/rollback/risco no PC real sugerem `hostSafety`.
- Conversa comum sugere `conversation`, sempre com `fallbackProfile: 'full'`.
- Texto vazio ou ambiguo cai para `full` por seguranca.

## Testes executados

```powershell
npx vitest run src/tools/registry/toolProfileResolver.test.js
```

Resultado: passou. `1` arquivo de teste, `13` testes.

```powershell
npm test
```

Resultado: passou. `48` arquivos de teste, `512` testes.

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
- O resolver e heuristico e inerte por design; qualquer ativacao futura precisa ser opt-in/testada.
- Antes de usar o resolver no runtime, sera necessario provar que o default de `createAliceLiveSetup` continua enviando `ALICE_LIVE_TOOLS` completo.
- `src/App.jsx` continua grande e acoplado, coordenando UI, Live, memoria, Runner, learning, HUD e timers.
- `src/aliceMemory.js` continua sendo contrato persistente amplo demais.
- `src-tauri/src/lib.rs` continua concentrando comandos nativos sensiveis.
- Os schemas continuam protegidos pelo fixture de contrato; qualquer mudanca futura precisa manter essa trava.

## Proximo passo

Proximo passo seguro: criar um desenho opt-in para como o runtime poderia consultar `resolveToolProfile` sem alterar o comportamento padrao, ou adicionar testes de contrato que protejam explicitamente o default antes de qualquer wiring futuro.
