use serde::Deserialize;
use serde_json::json;
use std::process::{Command, Stdio};
use std::time::Duration;
use wait_timeout::ChildExt;

use super::{truncate_shell_output, NativeCommandResult, MAX_SHELL_TIMEOUT_MS};

const DEFAULT_GUEST_TIMEOUT_MS: u64 = 15_000;
const DEFAULT_DIAGNOSTIC_TIMEOUT_MS: u64 = 5_000;
const SMOKE_TEST_CONTENT: &str = "alice-vm-smoke-ok";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalVmGuestCommandRequest {
    task_id: String,
    command: String,
    args: Option<Vec<String>>,
    timeout_ms: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalVmSmokeTestRequest {
    timeout_ms: Option<u64>,
}

fn command_available(command: &str, args: &[&str]) -> bool {
    Command::new(command)
        .args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn resolve_vboxmanage_path() -> Option<String> {
    let configured = env_value("ALICE_VBOXMANAGE_PATH")
        .trim_matches('"')
        .to_string();
    let candidates = [
        configured.as_str(),
        "VBoxManage",
        r"C:\Program Files\Oracle\VirtualBox\VBoxManage.exe",
        r"C:\Program Files (x86)\Oracle\VirtualBox\VBoxManage.exe",
    ];

    candidates
        .iter()
        .filter(|candidate| !candidate.trim().is_empty())
        .find(|candidate| command_available(candidate, &["--version"]))
        .map(|candidate| candidate.to_string())
}

fn run_command_capture(
    mut command: Command,
    timeout_ms: u64,
) -> Result<(bool, String, String, Option<i32>), String> {
    let mut child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Falha ao iniciar comando de diagnostico de VM local: {error}"))?;

    match child
        .wait_timeout(Duration::from_millis(timeout_ms))
        .map_err(|error| format!("Falha ao aguardar diagnostico de VM local: {error}"))?
    {
        Some(_) => {
            let output = child
                .wait_with_output()
                .map_err(|error| format!("Falha ao coletar diagnostico de VM local: {error}"))?;
            Ok((
                output.status.success(),
                truncate_shell_output(&String::from_utf8_lossy(&output.stdout)),
                truncate_shell_output(&String::from_utf8_lossy(&output.stderr)),
                output.status.code(),
            ))
        }
        None => {
            let _ = child.kill();
            let _ = child.wait();
            Err(format!(
                "Diagnostico de VM local expirou apos {timeout_ms}ms."
            ))
        }
    }
}

fn env_value(name: &str) -> String {
    std::env::var(name).unwrap_or_default().trim().to_string()
}

fn env_value_any(names: &[&str]) -> String {
    names
        .iter()
        .map(|name| env_value(name))
        .find(|value| !value.is_empty())
        .unwrap_or_default()
}

fn now_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn provider_capabilities(can_guest_control: bool) -> serde_json::Value {
    json!({
        "can_detect": true,
        "can_start": true,
        "can_stop": true,
        "can_suspend": true,
        "can_snapshot": true,
        "can_restore_snapshot": true,
        "can_copy_files_to_guest": can_guest_control,
        "can_execute_command_in_guest": can_guest_control,
        "can_collect_artifacts": can_guest_control,
        "can_report_health": true,
        "can_report_resource_usage": true,
    })
}

fn provider_missing_requirements(name: &str, state: &VmProviderState) -> Vec<&'static str> {
    let available = match name {
        "hyper_v" => state.hyper_v_available,
        "virtualbox" => state.virtualbox_available,
        _ => false,
    };
    let mut missing = Vec::new();

    if !available {
        missing.push(match name {
            "hyper_v" => "install_or_enable_hyper_v_powershell",
            "virtualbox" => "install_virtualbox_and_vboxmanage",
            _ => "unsupported_provider",
        });
    }
    if state.requested_provider != name {
        missing.push(match name {
            "hyper_v" => "set_alice_local_vm_provider_hyper_v",
            "virtualbox" => "set_alice_local_vm_provider_virtualbox",
            _ => "set_supported_provider",
        });
    }
    if state.vm_name.is_empty() {
        missing.push("set_alice_local_vm_name");
    }
    if state.vm_user.is_empty() || state.vm_password.is_empty() {
        missing.push("set_alice_local_vm_user_and_password");
    }
    if !state.guest_run_enabled {
        missing.push("set_alice_local_vm_enable_guest_run_true");
    }

    missing
}

fn provider_operational_status(name: &str, state: &VmProviderState) -> &'static str {
    let available = match name {
        "hyper_v" => state.hyper_v_available,
        "virtualbox" => state.virtualbox_available,
        _ => false,
    };
    if !available {
        "not_detected"
    } else if state.requested_provider != name {
        "detected"
    } else if state.vm_name.is_empty() {
        "not_configured"
    } else if provider_missing_requirements(name, state).is_empty() {
        "ready"
    } else {
        "configured_not_ready"
    }
}

fn recommended_fix_for(missing: &[&str]) -> String {
    if missing.is_empty() {
        return "Provider pronto para smoke test e tarefas guest.".to_string();
    }

    format!(
        "Configure: {}.",
        missing
            .iter()
            .map(|item| item.replace('_', " "))
            .collect::<Vec<_>>()
            .join(", ")
    )
}

fn workspace_fallback_capabilities() -> serde_json::Value {
    json!({
        "can_detect": true,
        "can_start": false,
        "can_stop": false,
        "can_suspend": false,
        "can_snapshot": false,
        "can_restore_snapshot": false,
        "can_copy_files_to_guest": false,
        "can_execute_command_in_guest": false,
        "can_collect_artifacts": true,
        "can_report_health": true,
        "can_report_resource_usage": false,
    })
}

fn validate_guest_command(command: &str) -> Result<String, String> {
    let normalized = command.trim();
    if normalized.is_empty() {
        return Err("Comando de VM local nao pode ser vazio.".to_string());
    }
    if normalized.contains('\0') || normalized.contains('\n') || normalized.contains('\r') {
        return Err("Comando de VM local contem caractere de controle.".to_string());
    }
    Ok(normalized.to_string())
}

fn validate_guest_args(args: &[String]) -> Result<(), String> {
    for arg in args {
        if arg.contains('\0') || arg.contains('\n') || arg.contains('\r') {
            return Err("Argumento de VM local contem caractere de controle.".to_string());
        }
    }
    Ok(())
}

#[derive(Debug, Clone)]
struct VmProviderState {
    requested_provider: String,
    vm_name: String,
    vm_user: String,
    vm_password: String,
    guest_run_enabled: bool,
    hyper_v_available: bool,
    virtualbox_available: bool,
    vboxmanage_path: String,
}

fn read_provider_state() -> VmProviderState {
    let vboxmanage_path = resolve_vboxmanage_path().unwrap_or_default();
    VmProviderState {
        requested_provider: env_value("ALICE_LOCAL_VM_PROVIDER").to_ascii_lowercase(),
        vm_name: env_value("ALICE_LOCAL_VM_NAME"),
        vm_user: env_value_any(&["ALICE_LOCAL_VM_USER", "ALICE_LOCAL_VM_USERNAME"]),
        vm_password: env_value("ALICE_LOCAL_VM_PASSWORD"),
        guest_run_enabled: env_value("ALICE_LOCAL_VM_ENABLE_GUEST_RUN")
            .eq_ignore_ascii_case("true"),
        hyper_v_available: command_available(
            "powershell.exe",
            &[
                "-NoProfile",
                "-Command",
                "if (Get-Command Get-VM -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }",
            ],
        ),
        virtualbox_available: !vboxmanage_path.is_empty(),
        vboxmanage_path,
    }
}

fn provider_json(name: &str, state: &VmProviderState) -> serde_json::Value {
    let available = match name {
        "hyper_v" => state.hyper_v_available,
        "virtualbox" => state.virtualbox_available,
        _ => false,
    };
    let selected = state.requested_provider == name && !state.vm_name.is_empty();
    let credentials_ready = !state.vm_user.is_empty() && !state.vm_password.is_empty();
    let ready = available && selected && credentials_ready && state.guest_run_enabled;
    let missing_requirements = provider_missing_requirements(name, state);
    let status = provider_operational_status(name, state);
    let setup_reason = if !available {
        "provider_not_installed_or_command_unavailable"
    } else if !selected {
        "set_alice_local_vm_provider_and_name"
    } else if !credentials_ready {
        "set_alice_local_vm_user_and_password"
    } else if !state.guest_run_enabled {
        "set_alice_local_vm_enable_guest_run_true"
    } else {
        ""
    };

    json!({
        "name": name,
        "available": available,
        "configured": available && selected,
        "ready": ready,
        "requiresUserSetup": !ready,
        "setupReason": setup_reason,
        "machineName": if selected { state.vm_name.clone() } else { String::new() },
        "capabilities": provider_capabilities(ready),
        "executablePath": if name == "virtualbox" { state.vboxmanage_path.clone() } else { String::new() },
        "status": status,
        "missingRequirements": missing_requirements.clone(),
        "recommendedFix": recommended_fix_for(&missing_requirements),
        "safeToRunGuestTasks": ready,
    })
}

fn active_provider(state: &VmProviderState) -> (&'static str, bool, bool, &'static str) {
    let hyper_v_configured = state.hyper_v_available
        && state.requested_provider == "hyper_v"
        && !state.vm_name.is_empty();
    let virtualbox_configured = state.virtualbox_available
        && state.requested_provider == "virtualbox"
        && !state.vm_name.is_empty();
    let provider = if hyper_v_configured {
        "hyper_v"
    } else if virtualbox_configured {
        "virtualbox"
    } else {
        "none"
    };
    let credentials_ready = !state.vm_user.is_empty() && !state.vm_password.is_empty();
    let guest_ready = provider != "none" && credentials_ready && state.guest_run_enabled;
    let setup_reason = if provider == "none" {
        "local_vm_provider_not_configured"
    } else if !credentials_ready {
        "set_alice_local_vm_user_and_password"
    } else if !state.guest_run_enabled {
        "set_alice_local_vm_enable_guest_run_true"
    } else {
        ""
    };

    (provider, provider != "none", guest_ready, setup_reason)
}

fn powershell_check(
    script: &str,
    envs: &[(&str, &str)],
    timeout_ms: u64,
) -> (bool, String, String, Option<i32>) {
    let mut command = Command::new("powershell.exe");
    command.args(["-NoProfile", "-Command", script]);
    for (key, value) in envs {
        command.env(key, value);
    }

    run_command_capture(command, timeout_ms)
        .unwrap_or_else(|error| (false, String::new(), error, None))
}

fn virtualbox_check(args: &[&str], timeout_ms: u64) -> (bool, String, String, Option<i32>) {
    let executable = resolve_vboxmanage_path().unwrap_or_else(|| "VBoxManage".to_string());
    let mut command = Command::new(executable);
    command.args(args);
    run_command_capture(command, timeout_ms)
        .unwrap_or_else(|error| (false, String::new(), error, None))
}

fn build_hyper_v_diagnostic(state: &VmProviderState, timeout_ms: u64) -> serde_json::Value {
    let mut commands_checked = Vec::new();
    let mut last_error = String::new();
    let mut missing = provider_missing_requirements("hyper_v", state);
    let mut vm_exists = false;
    let mut powershell_direct_ok = false;
    let mut checkpoint_available = false;

    commands_checked.push("powershell:Get-Command Get-VM".to_string());
    if state.hyper_v_available && !state.vm_name.is_empty() {
        commands_checked.push("powershell:Get-VM -Name ALICE_LOCAL_VM_NAME".to_string());
        let (ok, _stdout, stderr, _code) = powershell_check(
            "if (Get-VM -Name $env:ALICE_LOCAL_VM_NAME -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }",
            &[("ALICE_LOCAL_VM_NAME", &state.vm_name)],
            timeout_ms,
        );
        vm_exists = ok;
        if !ok {
            missing.push("configured_hyper_v_vm_not_found");
            last_error = stderr;
        }
    }

    if state.hyper_v_available {
        commands_checked.push("powershell:Get-Command Checkpoint-VM".to_string());
        let (ok, _stdout, stderr, _code) = powershell_check(
            "if (Get-Command Checkpoint-VM -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }",
            &[],
            timeout_ms,
        );
        checkpoint_available = ok;
        if !ok && last_error.is_empty() {
            last_error = stderr;
        }
    }

    let ready_without_probe = state.hyper_v_available
        && state.requested_provider == "hyper_v"
        && !state.vm_name.is_empty()
        && !state.vm_user.is_empty()
        && !state.vm_password.is_empty()
        && state.guest_run_enabled
        && vm_exists;

    if ready_without_probe {
        commands_checked.push("powershell:Invoke-Command PowerShell Direct smoke".to_string());
        let script = r#"
$ErrorActionPreference = 'Stop'
$password = ConvertTo-SecureString $env:ALICE_LOCAL_VM_PASSWORD -AsPlainText -Force
$credential = [System.Management.Automation.PSCredential]::new($env:ALICE_LOCAL_VM_USER, $password)
$result = Invoke-Command -VMName $env:ALICE_LOCAL_VM_NAME -Credential $credential -ScriptBlock { 'alice-vm-diagnostic-ok' }
if ($result -match 'alice-vm-diagnostic-ok') { exit 0 } else { exit 1 }
"#;
        let (ok, _stdout, stderr, _code) = powershell_check(
            script,
            &[
                ("ALICE_LOCAL_VM_NAME", &state.vm_name),
                ("ALICE_LOCAL_VM_USER", &state.vm_user),
                ("ALICE_LOCAL_VM_PASSWORD", &state.vm_password),
            ],
            timeout_ms,
        );
        powershell_direct_ok = ok;
        if !ok {
            missing.push("powershell_direct_guest_command_failed");
            last_error = stderr;
        }
    }

    let safe_to_run_guest_tasks = ready_without_probe && powershell_direct_ok;
    let status = if !state.hyper_v_available {
        "not_detected"
    } else if state.requested_provider != "hyper_v" {
        "detected"
    } else if state.vm_name.is_empty() {
        "not_configured"
    } else if safe_to_run_guest_tasks {
        "ready"
    } else {
        "configured_not_ready"
    };
    let capabilities = provider_capabilities(safe_to_run_guest_tasks);

    json!({
        "provider": "hyper_v",
        "status": status,
        "ready": safe_to_run_guest_tasks,
        "available": state.hyper_v_available,
        "configured": state.requested_provider == "hyper_v" && !state.vm_name.is_empty(),
        "vmExists": vm_exists,
        "powerShellDirectAccessible": powershell_direct_ok,
        "snapshotAvailable": checkpoint_available,
        "copyArtifactsAvailable": safe_to_run_guest_tasks,
        "missingRequirements": missing.clone(),
        "recommendedFix": recommended_fix_for(&missing),
        "commandsChecked": commands_checked,
        "lastError": last_error,
        "safeToRunGuestTasks": safe_to_run_guest_tasks,
        "capabilities": capabilities,
    })
}

fn build_virtualbox_diagnostic(state: &VmProviderState, timeout_ms: u64) -> serde_json::Value {
    let mut commands_checked = Vec::new();
    let mut last_error = String::new();
    let mut missing = provider_missing_requirements("virtualbox", state);
    let mut vm_exists = false;
    let mut guest_additions_visible = false;
    let mut guestcontrol_ok = false;
    let mut snapshot_available = false;

    commands_checked.push("VBoxManage --version".to_string());
    if state.virtualbox_available && !state.vm_name.is_empty() {
        commands_checked.push("VBoxManage showvminfo ALICE_LOCAL_VM_NAME".to_string());
        let (ok, _stdout, stderr, _code) = virtualbox_check(
            &["showvminfo", &state.vm_name, "--machinereadable"],
            timeout_ms,
        );
        vm_exists = ok;
        if !ok {
            missing.push("configured_virtualbox_vm_not_found");
            last_error = stderr;
        }

        commands_checked
            .push("VBoxManage guestproperty get /VirtualBox/GuestAdd/Version".to_string());
        let (ok, stdout, stderr, _code) = virtualbox_check(
            &[
                "guestproperty",
                "get",
                &state.vm_name,
                "/VirtualBox/GuestAdd/Version",
            ],
            timeout_ms,
        );
        guest_additions_visible = ok && !stdout.to_ascii_lowercase().contains("no value set");
        if !guest_additions_visible && last_error.is_empty() {
            last_error = stderr;
            missing.push("virtualbox_guest_additions_not_visible");
        }

        commands_checked.push("VBoxManage snapshot ALICE_LOCAL_VM_NAME list".to_string());
        let (ok, _stdout, stderr, _code) = virtualbox_check(
            &["snapshot", &state.vm_name, "list", "--machinereadable"],
            timeout_ms,
        );
        snapshot_available = ok;
        if !ok && last_error.is_empty() {
            last_error = stderr;
        }
    }

    let ready_without_probe = state.virtualbox_available
        && state.requested_provider == "virtualbox"
        && !state.vm_name.is_empty()
        && !state.vm_user.is_empty()
        && !state.vm_password.is_empty()
        && state.guest_run_enabled
        && vm_exists;

    if ready_without_probe {
        commands_checked.push("VBoxManage guestcontrol run cmd smoke".to_string());
        let (ok, _stdout, stderr, _code) = virtualbox_check(
            &[
                "guestcontrol",
                &state.vm_name,
                "run",
                "--username",
                &state.vm_user,
                "--password",
                &state.vm_password,
                "--exe",
                "C:\\Windows\\System32\\cmd.exe",
                "--wait-stdout",
                "--wait-stderr",
                "--",
                "cmd.exe",
                "/C",
                "echo alice-vm-diagnostic-ok",
            ],
            timeout_ms,
        );
        guestcontrol_ok = ok;
        if !ok {
            missing.push("virtualbox_guestcontrol_command_failed");
            last_error = stderr;
        }
    }

    let safe_to_run_guest_tasks = ready_without_probe && guestcontrol_ok;
    let status = if !state.virtualbox_available {
        "not_detected"
    } else if state.requested_provider != "virtualbox" {
        "detected"
    } else if state.vm_name.is_empty() {
        "not_configured"
    } else if safe_to_run_guest_tasks {
        "ready"
    } else {
        "configured_not_ready"
    };
    let capabilities = provider_capabilities(safe_to_run_guest_tasks);

    json!({
        "provider": "virtualbox",
        "status": status,
        "ready": safe_to_run_guest_tasks,
        "available": state.virtualbox_available,
        "configured": state.requested_provider == "virtualbox" && !state.vm_name.is_empty(),
        "executablePath": state.vboxmanage_path.clone(),
        "vmExists": vm_exists,
        "guestAdditionsVisible": guest_additions_visible,
        "guestControlAccessible": guestcontrol_ok,
        "snapshotAvailable": snapshot_available,
        "copyArtifactsAvailable": safe_to_run_guest_tasks,
        "missingRequirements": missing.clone(),
        "recommendedFix": recommended_fix_for(&missing),
        "commandsChecked": commands_checked,
        "lastError": last_error,
        "safeToRunGuestTasks": safe_to_run_guest_tasks,
        "capabilities": capabilities,
    })
}

#[tauri::command]
pub fn diagnose_local_vm_setup() -> Result<NativeCommandResult, String> {
    let state = read_provider_state();
    let hyper_v = build_hyper_v_diagnostic(&state, DEFAULT_DIAGNOSTIC_TIMEOUT_MS);
    let virtualbox = build_virtualbox_diagnostic(&state, DEFAULT_DIAGNOSTIC_TIMEOUT_MS);
    let selected = match state.requested_provider.as_str() {
        "hyper_v" => hyper_v.clone(),
        "virtualbox" => virtualbox.clone(),
        _ => json!({
            "provider": "none",
            "status": "not_configured",
            "ready": false,
            "missingRequirements": ["set_alice_local_vm_provider_and_name"],
            "recommendedFix": "Defina ALICE_LOCAL_VM_PROVIDER como hyper_v ou virtualbox e ALICE_LOCAL_VM_NAME.",
            "commandsChecked": [],
            "lastError": "",
            "safeToRunGuestTasks": false,
            "capabilities": provider_capabilities(false),
        }),
    };
    let ready = selected
        .get("safeToRunGuestTasks")
        .and_then(|value| value.as_bool())
        .unwrap_or(false);

    Ok(NativeCommandResult {
        ok: true,
        message: if ready {
            "Diagnostico de VM local: provider pronto para tarefas guest.".to_string()
        } else {
            "Diagnostico de VM local: provider ausente ou configuracao incompleta.".to_string()
        },
        stdout: None,
        stderr: None,
        artifacts: Some(json!({
            "checkedAt": now_ms(),
            "selectedProvider": state.requested_provider,
            "selected": selected,
            "providers": [hyper_v, virtualbox],
            "safeToRunGuestTasks": ready,
        })),
    })
}

#[tauri::command]
pub fn get_local_vm_status() -> Result<NativeCommandResult, String> {
    let state = read_provider_state();
    let (provider, real_vm_available, guest_ready, setup_reason) = active_provider(&state);

    Ok(NativeCommandResult {
        ok: true,
        message: if guest_ready {
            format!("VM local real pronta para guest command via {provider}.")
        } else if real_vm_available {
            format!("VM local real detectada via {provider}, mas guest command exige configuracao adicional.")
        } else {
            "Nenhuma VM local real configurada. Workspace local fallback disponivel para tarefas permitidas."
                .to_string()
        },
        stdout: None,
        stderr: None,
        artifacts: Some(json!({
            "checkedAt": now_ms(),
            "supportedProviderStatuses": [
                "not_detected",
                "detected",
                "not_configured",
                "configured_not_ready",
                "ready",
                "running",
                "unavailable",
                "error"
            ],
            "provider": provider,
            "providerStatus": if guest_ready {
                "ready"
            } else if real_vm_available {
                "configured_not_ready"
            } else {
                "not_configured"
            },
            "realVmAvailable": real_vm_available,
            "guestCommandReady": guest_ready,
            "requiresUserSetup": !guest_ready,
            "setupReason": setup_reason,
            "fallbackWorkspaceAvailable": true,
            "executionMode": if real_vm_available { "real_vm" } else { "local_workspace_fallback" },
            "status": if guest_ready {
                "ready"
            } else if real_vm_available {
                "configured_not_ready"
            } else {
                "fallback_only"
            },
            "resourceMode": "idle",
            "machineName": state.vm_name,
            "providers": [
                provider_json("hyper_v", &state),
                provider_json("virtualbox", &state),
                {
                    "name": "local_workspace",
                    "available": true,
                    "configured": true,
                    "ready": true,
                    "requiresUserSetup": false,
                    "setupReason": "",
                    "machineName": "",
                    "capabilities": workspace_fallback_capabilities(),
                },
            ],
            "capabilities": if guest_ready {
                provider_capabilities(true)
            } else {
                provider_capabilities(false)
            },
            "hostResources": {
                "cpuPercent": 0,
                "ramAvailableMb": 0,
                "diskAvailableMb": 0,
            },
        })),
    })
}

fn run_hyper_v_guest_command(
    request: &LocalVmGuestCommandRequest,
    state: &VmProviderState,
    timeout_ms: u64,
) -> Result<NativeCommandResult, String> {
    let command = validate_guest_command(&request.command)?;
    let args = request.args.clone().unwrap_or_default();
    validate_guest_args(&args)?;
    let args_json = serde_json::to_string(&args)
        .map_err(|error| format!("Falha ao serializar argumentos da VM local: {error}"))?;
    let script = r#"
$ErrorActionPreference = 'Stop'
$password = ConvertTo-SecureString $env:ALICE_LOCAL_VM_PASSWORD -AsPlainText -Force
$credential = [System.Management.Automation.PSCredential]::new($env:ALICE_LOCAL_VM_USER, $password)
$guestArgs = ConvertFrom-Json $env:ALICE_VM_GUEST_ARGS_JSON
Invoke-Command -VMName $env:ALICE_LOCAL_VM_NAME -Credential $credential -ScriptBlock {
  param([string] $exe, [object[]] $argv)
  & $exe @argv
} -ArgumentList $env:ALICE_VM_GUEST_COMMAND, $guestArgs
"#;
    let child = Command::new("powershell.exe")
        .args(["-NoProfile", "-Command", script])
        .env("ALICE_LOCAL_VM_NAME", &state.vm_name)
        .env("ALICE_LOCAL_VM_USER", &state.vm_user)
        .env("ALICE_LOCAL_VM_PASSWORD", &state.vm_password)
        .env("ALICE_VM_GUEST_COMMAND", &command)
        .env("ALICE_VM_GUEST_ARGS_JSON", args_json)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Falha ao iniciar comando guest Hyper-V: {error}"))?;

    collect_guest_output(child, request, "hyper_v", timeout_ms)
}

fn run_virtualbox_guest_command(
    request: &LocalVmGuestCommandRequest,
    state: &VmProviderState,
    timeout_ms: u64,
) -> Result<NativeCommandResult, String> {
    let command = validate_guest_command(&request.command)?;
    let args = request.args.clone().unwrap_or_default();
    validate_guest_args(&args)?;
    let executable = if state.vboxmanage_path.is_empty() {
        resolve_vboxmanage_path().unwrap_or_else(|| "VBoxManage".to_string())
    } else {
        state.vboxmanage_path.clone()
    };
    let mut process = Command::new(executable);
    process.args([
        "guestcontrol",
        &state.vm_name,
        "run",
        "--username",
        &state.vm_user,
        "--password",
        &state.vm_password,
        "--exe",
        &command,
        "--wait-stdout",
        "--wait-stderr",
        "--",
        &command,
    ]);
    process.args(args);
    let child = process
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Falha ao iniciar comando guest VirtualBox: {error}"))?;

    collect_guest_output(child, request, "virtualbox", timeout_ms)
}

fn collect_guest_output(
    mut child: std::process::Child,
    request: &LocalVmGuestCommandRequest,
    provider: &str,
    timeout_ms: u64,
) -> Result<NativeCommandResult, String> {
    match child
        .wait_timeout(Duration::from_millis(timeout_ms))
        .map_err(|error| format!("Falha ao aguardar comando guest da VM local: {error}"))?
    {
        Some(_) => {
            let output = child
                .wait_with_output()
                .map_err(|error| format!("Falha ao coletar saida do guest da VM local: {error}"))?;
            let stdout = truncate_shell_output(&String::from_utf8_lossy(&output.stdout));
            let stderr = truncate_shell_output(&String::from_utf8_lossy(&output.stderr));
            Ok(NativeCommandResult {
                ok: output.status.success(),
                message: if output.status.success() {
                    format!("Comando executado dentro da VM local via {provider}.")
                } else {
                    format!("Comando guest da VM local falhou via {provider}.")
                },
                stdout: Some(stdout),
                stderr: Some(stderr),
                artifacts: Some(json!({
                    "taskId": request.task_id,
                    "provider": provider,
                    "isRealVm": true,
                    "executionMode": "real_vm",
                    "capabilitiesUsed": provider_capabilities(true),
                    "readiness": "ready",
                    "statusCode": output.status.code(),
                    "guestCommandExecuted": true,
                })),
            })
        }
        None => {
            let _ = child.kill();
            let _ = child.wait();
            Err(format!(
                "Comando guest da VM local expirou apos {timeout_ms}ms."
            ))
        }
    }
}

#[tauri::command]
pub fn run_local_vm_guest_task(
    request: LocalVmGuestCommandRequest,
) -> Result<NativeCommandResult, String> {
    let state = read_provider_state();
    let (provider, real_vm_available, guest_ready, setup_reason) = active_provider(&state);
    let timeout_ms = request.timeout_ms.unwrap_or(DEFAULT_GUEST_TIMEOUT_MS);
    if timeout_ms == 0 || timeout_ms > MAX_SHELL_TIMEOUT_MS {
        return Err(format!(
            "Timeout da VM local fora do limite: {timeout_ms}ms."
        ));
    }

    if !real_vm_available || !guest_ready {
        return Ok(NativeCommandResult {
            ok: false,
            message: if real_vm_available {
                format!(
                    "VM local real detectada, mas guest command nao esta pronto: {setup_reason}."
                )
            } else {
                "VM local real nao configurada. Esta tarefa deve ser bloqueada ou usar fallback apenas se a politica permitir explicitamente.".to_string()
            },
            stdout: None,
            stderr: None,
            artifacts: Some(json!({
                "taskId": request.task_id,
                "provider": provider,
                "isRealVm": real_vm_available,
                "executionMode": if real_vm_available { "real_vm" } else { "unavailable" },
                "capabilitiesUsed": provider_capabilities(false),
                "readiness": if real_vm_available { "configured_not_ready" } else { "not_configured" },
                "guestCommandExecuted": false,
                "requiresUserSetup": true,
                "setupReason": setup_reason,
            })),
        });
    }

    match provider {
        "hyper_v" => run_hyper_v_guest_command(&request, &state, timeout_ms),
        "virtualbox" => run_virtualbox_guest_command(&request, &state, timeout_ms),
        _ => Ok(NativeCommandResult {
            ok: false,
            message: "Provider de VM local nao suportado para guest command.".to_string(),
            stdout: None,
            stderr: None,
            artifacts: Some(json!({
                "taskId": request.task_id,
                "provider": provider,
                "guestCommandExecuted": false,
                "capabilitiesUsed": provider_capabilities(false),
            })),
        }),
    }
}

fn run_hyper_v_smoke_test(
    state: &VmProviderState,
    timeout_ms: u64,
) -> Result<NativeCommandResult, String> {
    let task_id = format!("vm-smoke-{}", now_ms());
    let script = r#"
$ErrorActionPreference = 'Stop'
$password = ConvertTo-SecureString $env:ALICE_LOCAL_VM_PASSWORD -AsPlainText -Force
$credential = [System.Management.Automation.PSCredential]::new($env:ALICE_LOCAL_VM_USER, $password)
$content = $env:ALICE_VM_SMOKE_CONTENT
$result = Invoke-Command -VMName $env:ALICE_LOCAL_VM_NAME -Credential $credential -ScriptBlock {
  param([string] $payload)
  $workspace = Join-Path $env:TEMP ('alice-smoke-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $workspace -Force | Out-Null
  $inputPath = Join-Path $workspace 'input.txt'
  $outputPath = Join-Path $workspace 'output.txt'
  Set-Content -Path $inputPath -Value $payload -Encoding UTF8
  Copy-Item -Path $inputPath -Destination $outputPath -Force
  $readBack = Get-Content -Path $outputPath -Raw
  Remove-Item -Path $workspace -Recurse -Force
  $readBack
} -ArgumentList $content
if ($result -match [regex]::Escape($content)) { Write-Output $result; exit 0 } else { Write-Error 'Smoke output mismatch'; exit 1 }
"#;
    let mut command = Command::new("powershell.exe");
    command
        .args(["-NoProfile", "-Command", script])
        .env("ALICE_LOCAL_VM_NAME", &state.vm_name)
        .env("ALICE_LOCAL_VM_USER", &state.vm_user)
        .env("ALICE_LOCAL_VM_PASSWORD", &state.vm_password)
        .env("ALICE_VM_SMOKE_CONTENT", SMOKE_TEST_CONTENT);
    let (ok, stdout, stderr, status_code) = run_command_capture(command, timeout_ms)?;
    let validated = ok && stdout.contains(SMOKE_TEST_CONTENT);

    Ok(NativeCommandResult {
        ok: validated,
        message: if validated {
            "Smoke test executado dentro da VM Hyper-V e validado.".to_string()
        } else {
            "Smoke test Hyper-V executou, mas a validacao falhou.".to_string()
        },
        stdout: Some(stdout),
        stderr: Some(stderr),
        artifacts: Some(json!({
            "taskId": task_id,
            "provider": "hyper_v",
            "isRealVm": true,
            "executionMode": "real_vm",
            "capabilitiesUsed": provider_capabilities(true),
            "readiness": "ready",
            "smokeTest": true,
            "skipped": false,
            "workspaceStrategy": "guest_temp_directory",
            "copyStrategy": "powershell_direct_content_write",
            "artifactCollection": "powershell_direct_read_back",
            "validated": validated,
            "expectedContent": SMOKE_TEST_CONTENT,
            "statusCode": status_code,
        })),
    })
}

fn run_virtualbox_smoke_test(
    state: &VmProviderState,
    timeout_ms: u64,
) -> Result<NativeCommandResult, String> {
    let task_id = format!("vm-smoke-{}", now_ms());
    let script = format!("echo {SMOKE_TEST_CONTENT}");
    let executable = if state.vboxmanage_path.is_empty() {
        resolve_vboxmanage_path().unwrap_or_else(|| "VBoxManage".to_string())
    } else {
        state.vboxmanage_path.clone()
    };
    let mut command = Command::new(executable);
    command.args([
        "guestcontrol",
        &state.vm_name,
        "run",
        "--username",
        &state.vm_user,
        "--password",
        &state.vm_password,
        "--exe",
        "C:\\Windows\\System32\\cmd.exe",
        "--wait-stdout",
        "--wait-stderr",
        "--",
        "cmd.exe",
        "/C",
        &script,
    ]);
    let (ok, stdout, stderr, status_code) = run_command_capture(command, timeout_ms)?;
    let validated = ok && stdout.contains(SMOKE_TEST_CONTENT);

    Ok(NativeCommandResult {
        ok: validated,
        message: if validated {
            "Smoke test executado dentro da VM VirtualBox e validado.".to_string()
        } else {
            "Smoke test VirtualBox executou, mas a validacao falhou.".to_string()
        },
        stdout: Some(stdout),
        stderr: Some(stderr),
        artifacts: Some(json!({
            "taskId": task_id,
            "provider": "virtualbox",
            "isRealVm": true,
            "executionMode": "real_vm",
            "capabilitiesUsed": provider_capabilities(true),
            "readiness": "ready",
            "smokeTest": true,
            "skipped": false,
            "workspaceStrategy": "guest_command_temp_output",
            "copyStrategy": "guestcontrol_command_payload",
            "artifactCollection": "guestcontrol_stdout",
            "validated": validated,
            "expectedContent": SMOKE_TEST_CONTENT,
            "statusCode": status_code,
        })),
    })
}

#[tauri::command]
pub fn run_local_vm_smoke_test(
    request: Option<LocalVmSmokeTestRequest>,
) -> Result<NativeCommandResult, String> {
    let state = read_provider_state();
    let (provider, real_vm_available, guest_ready, setup_reason) = active_provider(&state);
    let timeout_ms = request
        .and_then(|request| request.timeout_ms)
        .unwrap_or(DEFAULT_GUEST_TIMEOUT_MS);
    if timeout_ms == 0 || timeout_ms > MAX_SHELL_TIMEOUT_MS {
        return Err(format!(
            "Timeout do smoke test da VM local fora do limite: {timeout_ms}ms."
        ));
    }

    if !real_vm_available || !guest_ready {
        return Ok(NativeCommandResult {
            ok: false,
            message: if real_vm_available {
                format!("Smoke test ignorado: VM local real detectada, mas guest command nao esta pronto: {setup_reason}.")
            } else {
                "Smoke test ignorado: nenhuma VM local real configurada.".to_string()
            },
            stdout: None,
            stderr: None,
            artifacts: Some(json!({
                "provider": provider,
                "isRealVm": real_vm_available,
                "executionMode": if real_vm_available { "real_vm" } else { "unavailable" },
                "capabilitiesUsed": provider_capabilities(false),
                "readiness": if real_vm_available { "configured_not_ready" } else { "not_configured" },
                "smokeTest": true,
                "skipped": true,
                "guestCommandExecuted": false,
                "requiresUserSetup": true,
                "setupReason": setup_reason,
            })),
        });
    }

    match provider {
        "hyper_v" => run_hyper_v_smoke_test(&state, timeout_ms),
        "virtualbox" => run_virtualbox_smoke_test(&state, timeout_ms),
        _ => Ok(NativeCommandResult {
            ok: false,
            message: "Smoke test ignorado: provider de VM local nao suportado.".to_string(),
            stdout: None,
            stderr: None,
            artifacts: Some(json!({
                "provider": provider,
                "smokeTest": true,
                "skipped": true,
                "guestCommandExecuted": false,
                "capabilitiesUsed": provider_capabilities(false),
            })),
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_env_does_not_claim_guest_ready() {
        std::env::remove_var("ALICE_LOCAL_VM_PROVIDER");
        std::env::remove_var("ALICE_LOCAL_VM_NAME");
        std::env::remove_var("ALICE_LOCAL_VM_USER");
        std::env::remove_var("ALICE_LOCAL_VM_PASSWORD");
        std::env::remove_var("ALICE_LOCAL_VM_ENABLE_GUEST_RUN");

        let result = get_local_vm_status().unwrap();
        let artifacts = result.artifacts.unwrap();

        assert_eq!(artifacts["realVmAvailable"], false);
        assert_eq!(artifacts["guestCommandReady"], false);
        assert_eq!(artifacts["executionMode"], "local_workspace_fallback");
    }

    #[test]
    fn guest_task_blocks_without_provider_setup() {
        std::env::remove_var("ALICE_LOCAL_VM_PROVIDER");
        std::env::remove_var("ALICE_LOCAL_VM_NAME");

        let result = run_local_vm_guest_task(LocalVmGuestCommandRequest {
            task_id: "task-1".to_string(),
            command: "python".to_string(),
            args: Some(vec!["--version".to_string()]),
            timeout_ms: Some(1000),
        })
        .unwrap();

        assert!(!result.ok);
        assert_eq!(result.artifacts.unwrap()["guestCommandExecuted"], false);
    }

    #[test]
    fn provider_capabilities_make_guest_control_explicit() {
        let capabilities = provider_capabilities(false);

        assert_eq!(capabilities["can_detect"], true);
        assert_eq!(capabilities["can_execute_command_in_guest"], false);
    }

    #[test]
    fn virtualbox_path_can_be_configured_explicitly() {
        let previous = std::env::var("ALICE_VBOXMANAGE_PATH").ok();
        std::env::set_var("ALICE_VBOXMANAGE_PATH", "cmd.exe");

        let resolved = resolve_vboxmanage_path();

        match previous {
            Some(value) => std::env::set_var("ALICE_VBOXMANAGE_PATH", value),
            None => std::env::remove_var("ALICE_VBOXMANAGE_PATH"),
        }
        assert_eq!(resolved.as_deref(), Some("cmd.exe"));
    }

    #[test]
    fn env_value_any_accepts_username_alias() {
        let primary = "ALICE_TEST_LOCAL_VM_USER";
        let alias = "ALICE_TEST_LOCAL_VM_USERNAME";
        let previous_primary = std::env::var(primary).ok();
        let previous_alias = std::env::var(alias).ok();
        std::env::remove_var(primary);
        std::env::set_var(alias, "alice");

        let resolved = env_value_any(&[primary, alias]);

        match previous_primary {
            Some(value) => std::env::set_var(primary, value),
            None => std::env::remove_var(primary),
        }
        match previous_alias {
            Some(value) => std::env::set_var(alias, value),
            None => std::env::remove_var(alias),
        }
        assert_eq!(resolved, "alice");
    }

    #[test]
    fn diagnosis_reports_missing_configuration_without_claiming_guest_ready() {
        std::env::remove_var("ALICE_LOCAL_VM_PROVIDER");
        std::env::remove_var("ALICE_LOCAL_VM_NAME");
        std::env::remove_var("ALICE_LOCAL_VM_USER");
        std::env::remove_var("ALICE_LOCAL_VM_PASSWORD");
        std::env::remove_var("ALICE_LOCAL_VM_ENABLE_GUEST_RUN");

        let result = diagnose_local_vm_setup().unwrap();
        let artifacts = result.artifacts.unwrap();

        assert_eq!(artifacts["safeToRunGuestTasks"], false);
        assert_eq!(artifacts["selected"]["provider"], "none");
        assert_eq!(artifacts["selected"]["status"], "not_configured");
    }

    #[test]
    fn smoke_test_skips_without_real_vm_configuration() {
        std::env::remove_var("ALICE_LOCAL_VM_PROVIDER");
        std::env::remove_var("ALICE_LOCAL_VM_NAME");

        let result = run_local_vm_smoke_test(Some(LocalVmSmokeTestRequest {
            timeout_ms: Some(1000),
        }))
        .unwrap();
        let artifacts = result.artifacts.unwrap();

        assert!(!result.ok);
        assert_eq!(artifacts["smokeTest"], true);
        assert_eq!(artifacts["skipped"], true);
        assert_eq!(artifacts["guestCommandExecuted"], false);
    }
}
