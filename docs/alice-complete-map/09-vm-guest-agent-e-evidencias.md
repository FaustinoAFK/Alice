# VM, guest agent e evidencias

## VM real

`src-tauri/src/local_vm.rs` detecta Hyper-V e VirtualBox por comandos locais e variaveis de ambiente. Para executar comandos dentro do guest, Alice exige `ALICE_LOCAL_VM_PROVIDER`, `ALICE_LOCAL_VM_NAME`, usuario/senha (`ALICE_LOCAL_VM_USER` ou `ALICE_LOCAL_VM_USERNAME`, `ALICE_LOCAL_VM_PASSWORD`) e opt-in `ALICE_LOCAL_VM_ENABLE_GUEST_RUN=true`. VirtualBox tambem aceita `ALICE_VBOXMANAGE_PATH`.

Estados relevantes: `not_detected`, `detected`, `not_configured`, `configured_not_ready`, `ready`. O codigo retorna `guestCommandReady=false` e `requiresUserSetup=true` quando ainda nao e seguro executar. Smoke test de VM nao usa fallback local para fingir VM.

## Workspace fallback

`src-tauri/src/autonomous_playground.rs` cria workspace local controlado, copia arquivos ou escreve conteudo fornecido, valida paths relativos, comando, args e timeout, executa e coleta stdout/stderr/manifesto. Ele pode ser usado para tarefas permitidas de risco menor, mas nao oferece isolamento forte. O Runner/preflight deve bloquear fallback quando `requiresRealVm=true` ou quando a politica nao permitir.

## Guest Interaction Agent

`src-tauri/src/vm_visual.rs` copia e aciona o agente Python em `src-tauri/vm/guest_agent`. O agente tem modo CLI (`agent.py`) e servidor residente (`server.py`). `action_executor.py` executa acoes; `input_controller.py` controla mouse/teclado/texto; `screen_capture.py` captura screenshots; `visual_context.py` cria contexto visual; `background_runner.py` acompanha comandos longos; `ocr.py` e opcional.

Acoes suportadas inferidas do codigo: `capture_screen`, `get_active_window`, `move_mouse`, `click`, `double_click`, `right_click`, `type_text`, `press_key`, `hotkey`, `wait`, `run_command`, `start_background_command`, `get_background_command_status`, `cancel_background_command`, `get_status`.

## Evidencias fisicas

Runner cria refs logicas em `autonomousRunnerEvidence.js`. A persistencia real passa por `save_runner_evidence` em `src-tauri/src/lib.rs`, que grava `metadata.json`, `stdout.txt`, `stderr.txt` e `validation.json` em `data/evidence/<executionId>/`. Em seguida `verify_runner_evidence` confirma existencia e rejeita nomes fora da whitelist/path traversal.

## Conexao com Runner

`autonomousRunnerExecutor.js` chama comandos Tauri conforme modo de execucao. O resultado vira `executionResult`, depois validacao e evidencia. Sem evidencia fisica confirmada, a task nao deve virar `done`.

## Riscos

Credenciais em ambiente, comandos dentro de VM, instaladores com UAC/elevacao, screenshots sensiveis, status de background mal interpretado, dependencias externas do VirtualBox/Hyper-V e fallback local usado indevidamente. O projeto mitiga com opt-in, status honesto, timeouts, whitelists e validacao, mas esta continua sendo uma superficie critica.
