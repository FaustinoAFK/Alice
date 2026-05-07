# Backend Tauri/Rust

## Estrutura

`src-tauri/src/main.rs` chama `alice_virtual_lib::run()`. `src-tauri/src/lib.rs` inicializa Tauri, instala log em debug, inicia o bridge de conhecimento web, registra estado compartilhado e monta `invoke_handler`. Modulos: `web_knowledge`, `local_vm`, `vm_visual`, `autonomous_playground`, `host_versioning`, `python_sidecar` e `legacy_desktop_commands`.

## Comandos expostos

- Gemini/memoria: `create_gemini_live_url`, `load_alice_memory_json`, `save_alice_memory_json`.
- Dev runtime: `load_dev_runtime_requests`, `clear_dev_runtime_request`.
- Evidencias: `save_runner_evidence`, `verify_runner_evidence`.
- VM real: `get_local_vm_status`, `diagnose_local_vm_setup`, `run_local_vm_guest_task`, `run_local_vm_smoke_test`.
- Guest visual: `install_vm_guest_agent`, `diagnose_vm_guest_agent`, `start_vm_guest_agent_resident`, `run_vm_guest_agent_action`, `capture_vm_guest_screen`, `run_vm_visual_smoke_test`.
- Workspace fallback: `run_local_workspace_playground_task`, `cancel_autonomous_task`.
- Host versioning: snapshot, diff, checkpoint e restore.
- Web knowledge: refresh, navigation context, inspect, same-domain search, web search e fetch.
- Legado desktop/local: registrado apenas com feature `desktop-commands`.

## Modulos

`web_knowledge.rs` mantem snapshot da pagina, servidor HTTP/SSE local, parsing HTML e busca/fetch. `local_vm.rs` diagnostica Hyper-V/VirtualBox e executa comandos guest. `vm_visual.rs` instala e aciona o guest agent visual. `autonomous_playground.rs` executa fallback local controlado. `host_versioning.rs` cria snapshots, diffs, checkpoints e rollback com preservacao de conflitos. `python_sidecar.rs` gerencia processo Python host. `legacy_desktop_commands.rs` encapsula comandos antigos.

## Seguranca

O backend valida paths, bloqueia escopos sensiveis, rejeita wildcards, limita texto, saida e timeout, whitelista apps/hotkeys/nomes de evidencia, exige opt-in para VM guest e evita shell amplo no fallback. Ainda assim, e a camada mais sensivel porque acessa filesystem, rede, processos, VM e sidecars.

## Riscos

`lib.rs` e grande e concentra responsabilidades. `web_knowledge.rs` mistura bridge, estado, servidor e extracao. `local_vm.rs` e `vm_visual.rs` dependem fortemente de ambiente Windows/VM. Alteracoes de validacao nativa exigem `cargo test`, testes com feature quando aplicavel e revisao de seguranca.

## Testes

Ha testes Rust inline para URL Gemini, validacao de desktop/local action, memoria, evidencia, VM, workspace fallback, host versioning, sidecar e web knowledge. A lacuna principal e integracao viva com Tauri app, Edge extension e VM real configurada.
