# Alice Virtual

Aplicativo desktop da Alice usando Gemini Live API para conversa por voz, contexto visual da tela compartilhada e leitura contextual de paginas web via extensao do Edge.

## Como funciona

- `src/App.jsx`: orquestrador da sessao Live, captura de midia, memoria e tool calls.
- `src/hud/`: shell visual do HUD, componentes, paginas e estado derivado de apresentacao.
- `src/alice.js`: personalidade, modelo Live e declaracao das ferramentas de conhecimento web.
- `src/geminiLive.js`: WebSocket da Gemini Live API com audio e frames de tela em `realtimeInput`.
- `src/liveSessionOrchestrator.js`: ciclo de vida da sessao, retomada e reconexao.
- `src/knowledgeToolExecutor.js`: adaptador entre tool calls da Gemini, comandos Tauri e o pipeline de conhecimento.
- `src/knowledgePipeline.js`: decisao de escopo, refresh da pagina, leitura local, expansao por links, busca no dominio e busca web.
- `src/autonomousLearning/`: implementa no stack real JS/Tauri os conceitos do plano `Alice Autonomous Playground Learning`: TurnContext, BehaviorContext, DecisionEngine, orquestradores, politica, validacao, pesquisa, aprendizado, propostas e auditoria.
- `src/autonomousLearningToolExecutor.js`: integra as tools autonomas ao fluxo oficial do app, sem criar engine paralela.
- `src-tauri/src/web_knowledge.rs`: ponte local com a extensao, snapshot da pagina, DuckDuckGo HTML, fetch e extracao de paginas.
- `src-tauri/src/local_vm.rs`: detecta provedores de VM local real configuraveis, como Hyper-V ou VirtualBox.
- `src-tauri/src/autonomous_playground.rs`: executor de `local workspace fallback`. Ele usa copias e comandos controlados, mas nao e VM real.
- `src-tauri/src/host_versioning.rs`: snapshot fisico, diff e rollback de arquivos do PC real dentro dos escopos permitidos.
- `edge-extension/`: extensao Edge que envia contexto leve e snapshot profundo da aba ativa para o app.

A chave da Gemini nao aparece na interface. O Tauri usa `GEMINI_API_KEY` ou `GOOGLE_API_KEY` do ambiente para montar a conexao local com a Gemini Live API.

## Rodar

```powershell
npm install
.\start-alice.ps1
```

Na janela da Alice, clique em `Iniciar`, escolha a tela ou janela para compartilhar e permita o microfone. Para parar, clique em `Parar`.

Se a variavel `GEMINI_API_KEY` foi criada agora, reinicie o VS Code ou o terminal antes de abrir o app.

## Extensao Edge

1. Abra `edge://extensions`.
2. Ative o modo de desenvolvedor.
3. Clique em `Carregar sem compactacao`.
4. Selecione a pasta `edge-extension`.
5. Deixe o app Alice aberto para a extensao enviar o contexto para `127.0.0.1:38947`.

No HUD, use:

- `Ao vivo`: estado da Alice, entrada de voz/tela, conexao com Gemini e resiliencia da sessao.
- `Conhecimento`: URL atual, escopo escolhido, suficiência, origem final, timeline de investigacao e fontes consultadas.
- `Autonomia`: tarefas, VM real quando configurada, workspace fallback, validacoes, propostas, riscos, rollbacks e logs auditaveis.
- `Debug`: transcricoes, geometria visual, contadores e memoria recente.

## Autonomia, VM real e fallback

O plano de autonomia foi integrado ao stack real JS/Tauri do projeto. Os conceitos oficiais ficam mapeados assim:

- `TurnContext`, `BehaviorContext`, `DecisionEngine`, `centralOrchestrator`, `actionOrchestrator`, hooks e `InternalState` ficam em `src/autonomousLearning/`.
- A entrada do usuario passa por contexto de turno, contexto comportamental, decisao/policy, orquestracao, execucao, validacao, rollback quando necessario, persistencia e HUD.
- O estado auditavel e persistido em `aliceMemory.autonomousAudit`, junto da memoria oficial da Alice, para evitar banco paralelo.

VM real e workspace fallback sao coisas diferentes:

- VM local real: exige provedor local configurado por `ALICE_LOCAL_VM_PROVIDER` e `ALICE_LOCAL_VM_NAME`.
- Provedores detectados nesta fase: `hyper_v` e `virtualbox`.
- Execucao real dentro do guest exige tambem `ALICE_LOCAL_VM_USER`, `ALICE_LOCAL_VM_PASSWORD` e `ALICE_LOCAL_VM_ENABLE_GUEST_RUN=true`.
- Hyper-V usa PowerShell Direct quando a VM e as credenciais permitem. VirtualBox usa `VBoxManage guestcontrol`, portanto precisa de Guest Additions e credenciais configuradas.
- Se o provedor estiver apenas detectado/configurado, mas sem guest runner pronto, a tarefa fica bloqueada com `configured_not_ready`; ela nao e simulada no host.
- Workspace local fallback: usa copias em workspace controlado, permite cancelamento por `taskId`, mas nao oferece isolamento forte de VM e nao deve ser tratado como VM real.

Sem provedor configurado, tarefas que exigem VM real sao bloqueadas. Tarefas de baixo/medio risco podem usar o fallback se a politica permitir.

### Configurar Hyper-V

1. Ative Hyper-V no Windows e crie uma VM local.
2. Garanta que a VM aceite PowerShell Direct com usuario/senha.
3. Defina as variaveis no terminal antes de iniciar a Alice:

```powershell
$env:ALICE_LOCAL_VM_PROVIDER = "hyper_v"
$env:ALICE_LOCAL_VM_NAME = "NomeDaSuaVM"
$env:ALICE_LOCAL_VM_USER = "UsuarioDaVM"
$env:ALICE_LOCAL_VM_PASSWORD = "SenhaDaVM"
$env:ALICE_LOCAL_VM_ENABLE_GUEST_RUN = "true"
.\start-alice.ps1
```

Estados comuns:

- `not_detected`: Hyper-V/PowerShell nao esta disponivel.
- `not_configured`: falta `ALICE_LOCAL_VM_PROVIDER` ou `ALICE_LOCAL_VM_NAME`.
- `configured_not_ready`: VM foi apontada, mas falta credencial, opt-in ou acesso PowerShell Direct.
- `ready`: diagnostico conseguiu validar guest command.

### Configurar VirtualBox

1. Instale VirtualBox. A Alice procura `VBoxManage` no `PATH`, em `ALICE_VBOXMANAGE_PATH` ou nos caminhos padrao do Windows (`C:\Program Files\Oracle\VirtualBox\VBoxManage.exe`).
2. Crie uma VM local e instale Guest Additions.
3. Configure credenciais de usuario do guest.
4. Defina as variaveis:

```powershell
$env:ALICE_LOCAL_VM_PROVIDER = "virtualbox"
$env:ALICE_LOCAL_VM_NAME = "NomeDaSuaVM"
$env:ALICE_LOCAL_VM_USER = "UsuarioDaVM"
$env:ALICE_LOCAL_VM_PASSWORD = "SenhaDaVM"
$env:ALICE_LOCAL_VM_ENABLE_GUEST_RUN = "true"
# Opcional, se o VirtualBox estiver fora do PATH e fora do caminho padrao:
$env:ALICE_VBOXMANAGE_PATH = "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"
.\start-alice.ps1
```

`ALICE_LOCAL_VM_USERNAME` tambem e aceito como alias de `ALICE_LOCAL_VM_USER`, para compatibilidade com configuracoes locais antigas.

VirtualBox fica `configured_not_ready` se `VBoxManage` nao encontrar a VM, Guest Additions nao aparecerem, credenciais faltarem ou `guestcontrol` falhar.

### Diagnostico e smoke test

A Alice tem tools internas para diagnostico:

- `diagnose_local_vm_setup`: lista provider, status, requisitos faltando, comandos checados, ultimo erro e se e seguro rodar guest tasks.
- `run_local_vm_smoke_test`: so roda quando a VM real esta pronta. Se nao estiver, retorna `skipped` com motivo claro. Nunca usa workspace fallback fingindo VM.

No HUD em `Autonomia`, veja `Diagnostico VM`, `Smoke test VM`, `Guest command pronto?`, `Precisa configurar?`, provider e capacidades.

### Guest Interaction Layer visual

A camada visual da VM fica separada do executor de comandos:

- `install_vm_guest_agent`: copia o agente visual para dentro da VM real em `C:\AliceGuestAgent`.
- `diagnose_vm_guest_agent`: executa `get_status` no agente e mostra se ele esta online.
- `capture_vm_guest_screen`: captura screenshot real dentro da VM e copia a imagem para `%LOCALAPPDATA%\AliceVirtual\vm_visual_replays`.
- `run_vm_guest_agent_action`: executa acoes visuais governadas como `capture_screen`, `get_active_window`, `move_mouse`, `click`, `double_click`, `right_click`, `type_text`, `press_key`, `hotkey`, `wait`, `run_command`, `start_background_command`, `get_background_command_status`, `cancel_background_command` e `get_status`.
- `run_vm_visual_smoke_test`: abre Notepad na VM, digita texto, captura screenshot e registra evidencia visual.
- `run_vm_operational_task`: ferramenta de alto nivel para pedidos praticos na VM, como abrir apps, instalar/baixar via `winget` em background, abrir URL, capturar tela e acompanhar/cancelar progresso. Use isso antes de pesquisa quando o pedido for operacional.

Exemplos de pedidos que devem virar acao na VM, nao pesquisa solta:

- "Alice, abra o explorador de arquivos na VM."
- "Alice, instale o Visual Studio Code na VM."
- "Alice, baixe o Visual Studio Community na VM e acompanhe o progresso."
- "Alice, veja o status da instalacao `vm-bg-...`."

Instalacoes grandes retornam um `backgroundTaskId`. Acompanhe com `run_vm_operational_task` usando `taskKind=check_background_task`; nao espere Visual Studio terminar em uma chamada curta.

Requisitos dentro da VM:

```powershell
# Dentro da AliceVM
winget install Python.Python.3.12
py -m pip install pillow
```

Depois, no host, aponte o executavel Python do guest se `python.exe` nao estiver resolvendo pelo `guestcontrol`:

```powershell
$env:ALICE_VM_GUEST_PYTHON = "C:\Users\alice\AppData\Local\Programs\Python\Python312\python.exe"
```

OCR e pluggable: se `pytesseract` nao estiver instalado dentro da VM, o agente continua capturando tela e controlando mouse/teclado, mas marca OCR como indisponivel em vez de fingir leitura textual. Para OCR:

```powershell
# Dentro da AliceVM, opcional
py -m pip install pytesseract
```

Coordenadas sao fallback controlado. Toda acao por coordenada deve registrar motivo, screenshot antes/depois, validacao e replay. Se o agente, Python ou screenshot estiverem indisponiveis, a tarefa visual e bloqueada com erro claro; o workspace fallback nunca substitui controle visual de VM.

### Rollback e conflitos

Para acoes relevantes no PC real, use snapshot fisico antes da escrita. O snapshot registra manifesto, hash, tamanho, data e checkpoints. Antes/depois de uma escrita controlada, a Alice pode registrar `record_host_file_checkpoint` para melhorar a classificacao do rollback.

Classificacoes possiveis:

- `expected_task_change`: a alteracao bate com checkpoint da tarefa.
- `external_or_unknown_change`: houve mudanca, mas nao ha evidencia suficiente para atribuir.
- `conflict_before_apply`: o arquivo ja mudou antes da escrita controlada.
- `conflict_during_apply`: a escrita divergiu durante a janela controlada.
- `conflict_after_apply_before_rollback`: algo mudou depois da escrita da tarefa e antes do rollback.
- `unexpected_task_change`: arquivo fora da declaracao esperada mudou.

Quando houver conflito provavel, o rollback preserva uma copia em `conflicts/` dentro do snapshot antes de restaurar. Isso evita apagar evidencia ou alteracao recente sem registro.

## Comandos desktop legados

O fluxo padrao atual da Alice usa apenas ferramentas de conhecimento web. A superficie antiga de comandos desktop/local fica desativada por padrao no runtime Tauri.

Para compilar com esses comandos registrados novamente:

```powershell
cd src-tauri
cargo test --features desktop-commands
```

## Validar

```powershell
npm test
npm run lint
npm run build

cd src-tauri
cargo test
cargo test --features desktop-commands

cd ..
python -m unittest .\src-tauri\python_sidecar\tests\test_sidecar.py
```

Para gerar executavel sem instalador:

```powershell
npm run app:build -- --no-bundle
```
