# Dev Harness do Autonomous Task Runner

Esta ferramenta e uma entrada oficial de desenvolvimento para semear, diagnosticar,
recuperar e limpar cenarios do Autonomous Task Runner sem editar `alice-memory.json`
manualmente.

Ela nao cria Runner paralelo, nao cria banco novo e nao marca sucesso
artificialmente. Os comandos usam os helpers oficiais de memoria, estado, lease,
startup recovery e tick do Runner.

## Comando base

```bash
npm run runner:harness -- <comando>
```

Por padrao, o harness tenta localizar a memoria do app em:

```text
%APPDATA%\com.faustinoafk.alicevirtual\alice-memory.json
```

Tambem e possivel informar o caminho explicitamente:

```bash
npm run runner:harness -- print-state --memory-path "%APPDATA%\com.faustinoafk.alicevirtual\alice-memory.json"
```

Todo comando que altera memoria cria backup automatico ao lado do arquivo:

```text
alice-memory.json.harness-backup-YYYYMMDDTHHMMSSZ
```

Nao rode varios comandos do harness em paralelo. O harness carrega modulos via
Vite SSR em modo de desenvolvimento; comandos simultaneos podem competir pelo
transporte interno e gerar timeout sem melhorar a validacao.

## Comandos de estado

```bash
npm run runner:harness -- print-state
npm run runner:harness -- print-state --json
npm run runner:harness -- print-task <taskId>
npm run runner:harness -- print-audit
npm run runner:harness -- print-evidence
npm run runner:harness -- list-running
npm run runner:harness -- list-test-tasks
npm run runner:harness -- verify-safe-state
```

`verify-safe-state` retorna `SAFE` quando nao existem locks, tasks ou steps em
`running`, leases presos em tasks finalizadas, ids de fila quebrados ou
evidencias apontando para tasks ausentes.

## Controle do Runner

```bash
npm run runner:harness -- enable
npm run runner:harness -- disable
npm run runner:harness -- pause
npm run runner:harness -- resume
npm run runner:harness -- cancel-task <taskId>
```

`cancel-task` exige um `taskId` explicito e usa os helpers oficiais de memoria
do Runner. Ele e util para triagem manual de fila real antes de ligar o Runner.

## Aprendizado autonomo governado

Os comandos abaixo operam `aliceMemory.autonomousLearning` e sempre criam backup
quando mutam a memoria. Eles nao executam acoes diretamente: `run-once` apenas
cria tasks oficiais do Runner com `metadata.createdBy = "autonomous_learning_loop"`
quando a politica permite.

```bash
npm run runner:harness -- autonomous-learning print-state
npm run runner:harness -- autonomous-learning enable
npm run runner:harness -- autonomous-learning disable
npm run runner:harness -- autonomous-learning scan
npm run runner:harness -- autonomous-learning seed-gap browser-search
npm run runner:harness -- autonomous-learning run-once
npm run runner:harness -- autonomous-learning run-until-idle
npm run runner:harness -- autonomous-learning print-gaps
npm run runner:harness -- autonomous-learning print-experiments
npm run runner:harness -- autonomous-learning print-procedure <procedureId>
npm run runner:harness -- autonomous-learning verify-safe-state
npm run runner:harness -- autonomous-learning clear-test-learning
npm run runner:harness -- autonomous-learning dry-run
```

`dry-run` atualiza auditoria/scan, mas nao deve criar task. `clear-test-learning`
remove apenas tasks criadas por `autonomous_learning_loop`,
`autonomous_procedure_reuse` e `autonomous_procedure_optimizer`; evidencias
fisicas permanecem preservadas por padrao.

## Reuso de procedures

O reuso consulta procedures active/guarded/candidates antes de abrir novo
experimento. Simulacao e match sao read-only; `run` cria uma task oficial do
Runner com `metadata.createdBy = "autonomous_procedure_reuse"`.

```bash
npm run runner:harness -- autonomous-reuse print-index
npm run runner:harness -- autonomous-reuse match "Pesquisar documentacao sobre erro X"
npm run runner:harness -- autonomous-reuse simulate "Pesquisar documentacao sobre erro X"
npm run runner:harness -- autonomous-reuse run "Pesquisar documentacao sobre erro X"
npm run runner:harness -- autonomous-reuse print-procedure-usage <procedureId>
npm run runner:harness -- autonomous-reuse verify-safe-state
npm run runner:harness -- autonomous-reuse clear-test-reuse
```

## Seeds

```bash
npm run runner:harness -- seed-smoke
npm run runner:harness -- seed-failure
npm run runner:harness -- seed-large-task
npm run runner:harness -- seed-large-task --heavy
npm run runner:harness -- seed-vm-unavailable
npm run runner:harness -- seed-stale-running
npm run runner:harness -- seed-dependency-recovery
npm run runner:harness -- seed-learning-candidate
```

Todas as tasks criadas pelo harness recebem:

```js
metadata: {
  createdBy: "autonomous_runner_harness",
  testScenario: "...",
  createdAt: "..."
}
```

e `riskLevel: "harness"`. A limpeza usa essa marcacao para nao apagar task real.

## Limpeza

```bash
npm run runner:harness -- clear-test-tasks
npm run runner:harness -- clear-test-tasks --remove-evidence
```

Por padrao, o comando remove tasks e referencias de evidencia do estado do
Runner, mas preserva os arquivos de evidencia no disco. Use `--remove-evidence`
para tentar apagar os arquivos referenciados pelas tasks de harness.

O comando tambem limpa `settings.devOverrides.forceVmUnavailable`.

## Compactacao segura da memoria do Runner

```bash
npm run runner:harness -- compact-runner-memory
npm run runner:harness -- compact-runner-memory --keep-audits 80 --keep-evidence-refs 80 --keep-terminal-tasks 20
```

Use este comando quando `alice-memory.json` estiver perto ou acima do limite
nativo de 50 MiB antes de um smoke real. Ele:

- cria backup automatico;
- exige estado `SAFE`, a menos que `--force` seja usado conscientemente;
- preserva tasks ativas;
- preserva arquivos fisicos de evidencia por padrao;
- reduz historico pesado de auditoria e refs antigas em memoria;
- registra `harness_compaction` na auditoria do Runner.

O comando nao chama `save_runner_evidence` nem apaga `data/evidence`. Ele apenas
compacta o estado persistido por helpers oficiais para que o app Tauri volte a
conseguir salvar memoria.

## Tick e recovery

```bash
npm run runner:harness -- recover-startup
npm run runner:harness -- tick
npm run runner:harness -- tick --count 5
npm run runner:harness -- run-until-idle
```

`recover-startup` chama o recovery oficial e e adequado para validar tasks stale.

O comando `tick` chama o tick oficial, mas fora do runtime Tauri ele nao possui
`invoke` para executar comandos reais na VM/workspace. Assim, ele e util para
validar scheduler, preflight, retry e recovery. Para smoke real de execucao,
semeie a task e inicie o app/Tauri.

Importante sobre evidencias: fora do runtime Tauri, o harness nao consegue chamar
`save_runner_evidence` nem `verify_runner_evidence`. Portanto ele nao deve ser
usado como prova de persistencia fisica. Ele valida estado e contratos em memoria;
a persistencia real precisa ser verificada no app Tauri/HUD ou pelos testes Rust.

## Roteiro de smoke real

1. Ver estado inicial:

```bash
npm run runner:harness -- print-state
```

2. Semear smoke:

```bash
npm run runner:harness -- seed-smoke
```

3. Se a memoria estiver acima do limite, compacte antes de abrir o app:

```bash
npm run runner:harness -- compact-runner-memory
npm run runner:harness -- verify-safe-state
```

4. Iniciar a Alice em modo app:

```bash
npm run app
```

5. Abrir o HUD e ir para Runner.

6. Fechar a Alice ou garantir Runner idle antes de verificar:

```bash
npm run runner:harness -- print-state
npm run runner:harness -- print-evidence
npm run runner:harness -- verify-safe-state
```

Resultado esperado do smoke:

```text
task ready/running -> done
step ready/running -> done
validation.json existe em data/evidence/<executionId>/
stdout/stderr/metadata existem quando o Tauri salva evidencia
HUD mostra evidencia `confirmada`
falha de save/verificacao impede `done`
HUD mostra done
mapa mental mostra done
verify-safe-state retorna SAFE ao final
```

## Verificacao fisica de evidencias

O comando Tauri oficial `verify_runner_evidence` verifica apenas `executionId` e
nomes de arquivos permitidos, sem aceitar path arbitrario. Ele retorna:

- `executionId`
- `status`: `ok`, `missing`, `partial` ou `unavailable`
- `files`
- `existingFiles`
- `missingFiles`
- `relativeDir`

Arquivos oficiais esperados:

- `metadata.json`
- `stdout.txt`
- `stderr.txt`
- `validation.json`

No HUD do Runner, refs salvas pelo fluxo real passam a aparecer como:

- `confirmada`
- `parcialmente ausente`
- `ausente`
- `indisponivel`
- `nao verificada`

Se o save ou a verificacao falhar, o Runner registra `evidence_persistence_failed`
na auditoria e nao marca o step como `done`.

## Cenarios importantes

### Falha controlada

```bash
npm run runner:harness -- seed-failure
```

Esperado: task vai para `waiting_retry` e depois `failed`; nunca `done`.

### VM indisponivel

```bash
npm run runner:harness -- seed-vm-unavailable
```

Esse seed ativa:

```js
settings.devOverrides.forceVmUnavailable = true
```

Esperado: task que exige VM real vai para `waiting_retry` com reason
`vm_unavailable`; task de fallback continua elegivel quando o app puder executar.

Depois do teste:

```bash
npm run runner:harness -- clear-test-tasks
```

### Stale running

```bash
npm run runner:harness -- seed-stale-running
npm run runner:harness -- recover-startup
npm run runner:harness -- verify-safe-state
```

Esperado: task sai de `running`, lock e limpo, reason vira `stale_running_task`.

## Restaurar backup

Feche a Alice antes de restaurar. Depois substitua o arquivo ativo pelo backup
gerado pelo harness:

```powershell
Copy-Item -LiteralPath "<backup>" -Destination "%APPDATA%\com.faustinoafk.alicevirtual\alice-memory.json" -Force
```

## Validacao automatizada

```bash
npm test -- src/dev/autonomousRunnerHarness.test.js
npm test
npm run lint
npm run build
cargo test
```
