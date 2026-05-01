use base64::Engine;
use serde::Deserialize;
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;
use wait_timeout::ChildExt;

use super::{truncate_shell_output, NativeCommandResult, MAX_SHELL_TIMEOUT_MS};

const DEFAULT_VISUAL_TIMEOUT_MS: u64 = 15_000;
const DEFAULT_GUEST_AGENT_DIR: &str = r"C:\AliceGuestAgent";
const DEFAULT_GUEST_PYTHON: &str = "python.exe";
const DEFAULT_RESIDENT_AGENT_PORT: u16 = 38_948;
const RESIDENT_AGENT_NAT_RULE_NAME: &str = "alice-guest-agent";
const AGENT_FILES: &[(&str, &str)] = &[
    ("agent.py", include_str!("../vm/guest_agent/agent.py")),
    ("server.py", include_str!("../vm/guest_agent/server.py")),
    ("protocol.py", include_str!("../vm/guest_agent/protocol.py")),
    (
        "screen_capture.py",
        include_str!("../vm/guest_agent/screen_capture.py"),
    ),
    (
        "input_controller.py",
        include_str!("../vm/guest_agent/input_controller.py"),
    ),
    ("ocr.py", include_str!("../vm/guest_agent/ocr.py")),
    (
        "element_recognition.py",
        include_str!("../vm/guest_agent/element_recognition.py"),
    ),
    (
        "visual_context.py",
        include_str!("../vm/guest_agent/visual_context.py"),
    ),
    (
        "action_executor.py",
        include_str!("../vm/guest_agent/action_executor.py"),
    ),
    (
        "background_runner.py",
        include_str!("../vm/guest_agent/background_runner.py"),
    ),
    (
        "validation.py",
        include_str!("../vm/guest_agent/validation.py"),
    ),
];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VmGuestAgentActionRequest {
    action: String,
    parameters: Option<Value>,
    timeout_ms: Option<u64>,
    task_id: Option<String>,
    correlation_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VmVisualSmokeTestRequest {
    timeout_ms: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VmVisualTimeoutRequest {
    timeout_ms: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VmResidentAgentRequest {
    timeout_ms: Option<u64>,
    host_port: Option<u16>,
    guest_port: Option<u16>,
}

#[derive(Debug, Clone)]
struct VmVisualState {
    provider: String,
    vm_name: String,
    vm_user: String,
    vm_password: String,
    guest_run_enabled: bool,
    vboxmanage_path: String,
    guest_agent_dir: String,
    guest_python: String,
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

fn env_bool(name: &str, default: bool) -> bool {
    let value = env_value(name);
    if value.is_empty() {
        return default;
    }
    matches!(
        value.to_ascii_lowercase().as_str(),
        "1" | "true" | "yes" | "on"
    )
}

fn env_u16(name: &str, default: u16) -> u16 {
    env_value(name)
        .parse::<u16>()
        .ok()
        .filter(|value| *value > 0)
        .unwrap_or(default)
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

fn read_state() -> VmVisualState {
    VmVisualState {
        provider: env_value("ALICE_LOCAL_VM_PROVIDER").to_ascii_lowercase(),
        vm_name: env_value("ALICE_LOCAL_VM_NAME"),
        vm_user: env_value_any(&["ALICE_LOCAL_VM_USER", "ALICE_LOCAL_VM_USERNAME"]),
        vm_password: env_value("ALICE_LOCAL_VM_PASSWORD"),
        guest_run_enabled: env_value("ALICE_LOCAL_VM_ENABLE_GUEST_RUN")
            .eq_ignore_ascii_case("true"),
        vboxmanage_path: resolve_vboxmanage_path().unwrap_or_default(),
        guest_agent_dir: env_value("ALICE_VM_GUEST_AGENT_DIR")
            .trim_matches('"')
            .to_string()
            .if_empty(DEFAULT_GUEST_AGENT_DIR),
        guest_python: env_value("ALICE_VM_GUEST_PYTHON")
            .trim_matches('"')
            .to_string()
            .if_empty(DEFAULT_GUEST_PYTHON),
    }
}

trait IfEmpty {
    fn if_empty(self, fallback: &str) -> String;
}

impl IfEmpty for String {
    fn if_empty(self, fallback: &str) -> String {
        if self.trim().is_empty() {
            fallback.to_string()
        } else {
            self
        }
    }
}

fn now_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn run_command_capture(
    mut command: Command,
    timeout_ms: u64,
) -> Result<(bool, String, String, Option<i32>), String> {
    let mut child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Falha ao iniciar comando visual da VM: {error}"))?;

    match child
        .wait_timeout(Duration::from_millis(timeout_ms))
        .map_err(|error| format!("Falha ao aguardar comando visual da VM: {error}"))?
    {
        Some(_) => {
            let output = child
                .wait_with_output()
                .map_err(|error| format!("Falha ao coletar saida visual da VM: {error}"))?;
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
            Err(format!("Comando visual da VM expirou apos {timeout_ms}ms."))
        }
    }
}

fn validate_ready(state: &VmVisualState) -> Result<(), String> {
    if state.provider != "virtualbox" {
        return Err("Guest Interaction Layer visual suporta VirtualBox nesta etapa. Configure ALICE_LOCAL_VM_PROVIDER=virtualbox.".to_string());
    }
    if state.vboxmanage_path.is_empty() {
        return Err(
            "VBoxManage nao encontrado. Configure ALICE_VBOXMANAGE_PATH ou instale VirtualBox."
                .to_string(),
        );
    }
    if state.vm_name.is_empty() {
        return Err("ALICE_LOCAL_VM_NAME nao configurado.".to_string());
    }
    if state.vm_user.is_empty() || state.vm_password.is_empty() {
        return Err("ALICE_LOCAL_VM_USER/ALICE_LOCAL_VM_USERNAME e ALICE_LOCAL_VM_PASSWORD sao obrigatorios.".to_string());
    }
    if !state.guest_run_enabled {
        return Err(
            "ALICE_LOCAL_VM_ENABLE_GUEST_RUN precisa ser true para interacao visual real."
                .to_string(),
        );
    }
    Ok(())
}

fn vbox_guest_run(
    state: &VmVisualState,
    exe: &str,
    args: &[&str],
    timeout_ms: u64,
) -> Result<(bool, String, String, Option<i32>), String> {
    let mut command = Command::new(&state.vboxmanage_path);
    command.args([
        "guestcontrol",
        &state.vm_name,
        "run",
        "--username",
        &state.vm_user,
        "--password",
        &state.vm_password,
        "--exe",
        exe,
        "--wait-stdout",
        "--wait-stderr",
        "--",
    ]);
    command.args(args);
    run_command_capture(command, timeout_ms)
}

fn vbox_guest_start(
    state: &VmVisualState,
    exe: &str,
    args: &[&str],
    timeout_ms: u64,
) -> Result<(bool, String, String, Option<i32>), String> {
    let mut command = Command::new(&state.vboxmanage_path);
    command.args([
        "guestcontrol",
        &state.vm_name,
        "start",
        "--username",
        &state.vm_user,
        "--password",
        &state.vm_password,
        "--exe",
        exe,
        "--",
    ]);
    command.args(args);
    run_command_capture(command, timeout_ms)
}

fn vbox_keyboard_put_string(
    state: &VmVisualState,
    text: &str,
    timeout_ms: u64,
) -> Result<(bool, String, String, Option<i32>), String> {
    validate_ready(state)?;
    let mut command = Command::new(&state.vboxmanage_path);
    command.args(["controlvm", &state.vm_name, "keyboardputstring", text]);
    run_command_capture(command, timeout_ms)
}

fn extract_type_text_value(parameters: &Value) -> Option<String> {
    parameters
        .get("text")
        .and_then(Value::as_str)
        .filter(|text| !text.is_empty())
        .map(ToString::to_string)
}

fn run_type_text_with_host_fallback(
    state: &VmVisualState,
    text: &str,
    task_id: &str,
    correlation_id: &str,
    timeout_ms: u64,
) -> Result<(Value, String, String, Option<i32>, bool), String> {
    let (mut agent_response, mut stdout, mut stderr, mut status_code, _transport) =
        run_agent_request(
            state,
            build_agent_request("type_text", json!({"text": text}), task_id, correlation_id),
            timeout_ms,
            true,
        )?;
    let success = agent_response
        .get("success")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let mut host_input_fallback = false;

    if !success {
        match vbox_keyboard_put_string(state, text, timeout_ms) {
            Ok((fallback_ok, fallback_stdout, fallback_stderr, fallback_status_code)) => {
                host_input_fallback = true;
                stdout = format!("{stdout}\n{fallback_stdout}");
                stderr = format!("{stderr}\n{fallback_stderr}");
                status_code = fallback_status_code.or(status_code);
                agent_response = json!({
                    "protocol_version": "1.0",
                    "request_id": format!("vm-visual-type_text-{}", now_ms()),
                    "correlation_id": correlation_id,
                    "action": "type_text",
                    "success": fallback_ok,
                    "result": {
                        "typed_length": text.chars().count(),
                        "method": "virtualbox_keyboardputstring",
                        "agent_error_before_fallback": agent_response.get("error").and_then(Value::as_str).unwrap_or(""),
                    },
                    "error": if fallback_ok { "" } else { "virtualbox_keyboardputstring_failed" },
                    "timestamp": now_ms(),
                });
            }
            Err(error) => {
                stderr = format!("{stderr}\n{error}");
            }
        }
    }

    Ok((
        agent_response,
        stdout,
        stderr,
        status_code,
        host_input_fallback,
    ))
}

fn vbox_copy_to(
    state: &VmVisualState,
    source: &Path,
    target_path: &str,
    timeout_ms: u64,
) -> Result<(bool, String, String, Option<i32>), String> {
    let source_text = source
        .to_str()
        .ok_or_else(|| "Caminho temporario do agente visual nao e UTF-8.".to_string())?;
    let mut command = Command::new(&state.vboxmanage_path);
    command.args([
        "guestcontrol",
        &state.vm_name,
        "copyto",
        "--username",
        &state.vm_user,
        "--password",
        &state.vm_password,
        source_text,
        target_path,
    ]);
    run_command_capture(command, timeout_ms)
}

fn vbox_copy_from(
    state: &VmVisualState,
    guest_path: &str,
    host_dir: &Path,
    timeout_ms: u64,
) -> Result<Option<PathBuf>, String> {
    fs::create_dir_all(host_dir)
        .map_err(|error| format!("Falha ao criar pasta de replay visual: {error}"))?;
    let filename = Path::new(guest_path)
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "screenshot.png".to_string());
    let host_path = host_dir.join(filename);
    let host_path_text = host_path
        .to_str()
        .ok_or_else(|| "Caminho de replay visual nao e UTF-8.".to_string())?;
    let mut command = Command::new(&state.vboxmanage_path);
    command.args([
        "guestcontrol",
        &state.vm_name,
        "copyfrom",
        "--username",
        &state.vm_user,
        "--password",
        &state.vm_password,
        guest_path,
        host_path_text,
    ]);
    let (ok, _stdout, stderr, _code) = run_command_capture(command, timeout_ms)?;
    if !ok {
        return Err(format!(
            "Falha ao copiar screenshot da VM para host: {stderr}"
        ));
    }
    Ok(Some(host_path))
}

fn replay_dir(correlation_id: &str) -> PathBuf {
    let root = std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("AliceVirtual")
        .join("vm_visual_replays");
    root.join(if correlation_id.trim().is_empty() {
        format!("visual-{}", now_ms())
    } else {
        correlation_id.to_string()
    })
}

fn install_agent_files(state: &VmVisualState, timeout_ms: u64) -> Result<Value, String> {
    validate_ready(state)?;
    let (mkdir_ok, _stdout, mkdir_stderr, _code) = vbox_guest_run(
        state,
        r"C:\Windows\System32\cmd.exe",
        &["cmd.exe", "/C", "mkdir", &state.guest_agent_dir],
        timeout_ms,
    )?;
    if !mkdir_ok && !mkdir_stderr.to_ascii_lowercase().contains("already exists") {
        return Err(format!(
            "Falha ao criar pasta do guest agent: {mkdir_stderr}"
        ));
    }

    let temp_root = std::env::temp_dir().join(format!("alice-guest-agent-install-{}", now_ms()));
    fs::create_dir_all(&temp_root)
        .map_err(|error| format!("Falha ao criar staging do guest agent: {error}"))?;
    let mut copied = Vec::new();
    for (name, content) in AGENT_FILES {
        let source = temp_root.join(name);
        fs::write(&source, content)
            .map_err(|error| format!("Falha ao preparar {name}: {error}"))?;
        let target_path = format!(r"{}\{}", state.guest_agent_dir, name);
        let (ok, _stdout, stderr, _code) = vbox_copy_to(state, &source, &target_path, timeout_ms)?;
        if !ok {
            return Err(format!("Falha ao copiar {name} para VM: {stderr}"));
        }
        copied.push(*name);
    }
    let _ = fs::remove_dir_all(temp_root);
    Ok(json!({
        "guestAgentDir": state.guest_agent_dir,
        "files": copied,
        "provider": "virtualbox",
    }))
}

fn build_agent_request(
    action: &str,
    parameters: Value,
    task_id: &str,
    correlation_id: &str,
) -> Value {
    json!({
        "protocol_version": "1.0",
        "request_id": format!("vm-visual-{}-{}", action, now_ms()),
        "correlation_id": correlation_id,
        "task_id": task_id,
        "action": action,
        "parameters": parameters,
        "timestamp": now_ms(),
    })
}

fn parse_agent_stdout(stdout: &str) -> Result<Value, String> {
    stdout
        .lines()
        .rev()
        .find_map(|line| serde_json::from_str::<Value>(line.trim()).ok())
        .ok_or_else(|| format!("Guest agent nao retornou JSON valido. stdout={stdout}"))
}

fn resident_agent_enabled() -> bool {
    env_bool("ALICE_VM_GUEST_AGENT_RESIDENT", true)
}

fn resident_agent_host_port() -> u16 {
    env_u16(
        "ALICE_VM_GUEST_AGENT_HOST_PORT",
        DEFAULT_RESIDENT_AGENT_PORT,
    )
}

fn resident_agent_guest_port() -> u16 {
    env_u16(
        "ALICE_VM_GUEST_AGENT_GUEST_PORT",
        DEFAULT_RESIDENT_AGENT_PORT,
    )
}

fn resident_agent_token() -> String {
    env_value("ALICE_VM_GUEST_AGENT_TOKEN")
}

fn build_resident_agent_url(host_port: u16, path: &str) -> String {
    format!(
        "http://127.0.0.1:{}{}",
        host_port,
        if path.starts_with('/') {
            path.to_string()
        } else {
            format!("/{path}")
        }
    )
}

fn build_nat_port_forward_rule(name: &str, host_port: u16, guest_port: u16) -> String {
    format!("{name},tcp,127.0.0.1,{host_port},,{guest_port}")
}

fn configure_resident_agent_port_forward(
    state: &VmVisualState,
    host_port: u16,
    guest_port: u16,
    timeout_ms: u64,
) -> Result<(), String> {
    let mut delete = Command::new(&state.vboxmanage_path);
    delete.args([
        "controlvm",
        &state.vm_name,
        "natpf1",
        "delete",
        RESIDENT_AGENT_NAT_RULE_NAME,
    ]);
    let _ = run_command_capture(delete, timeout_ms);

    let rule = build_nat_port_forward_rule(RESIDENT_AGENT_NAT_RULE_NAME, host_port, guest_port);
    let mut add = Command::new(&state.vboxmanage_path);
    add.args(["controlvm", &state.vm_name, "natpf1", &rule]);
    let (ok, _stdout, stderr, _status_code) = run_command_capture(add, timeout_ms)?;
    if ok {
        Ok(())
    } else {
        Err(format!(
            "Nao foi possivel configurar port-forward do agente residente: {stderr}"
        ))
    }
}

fn resident_agent_health(host_port: u16, timeout_ms: u64) -> Result<Value, String> {
    let token = resident_agent_token();
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(timeout_ms.clamp(250, 2_000)))
        .build()
        .map_err(|error| format!("Falha ao criar cliente do agente residente: {error}"))?;
    let mut request = client.get(build_resident_agent_url(host_port, "/health"));
    if !token.is_empty() {
        request = request.header("X-Alice-Agent-Token", token);
    }
    let response = request
        .send()
        .map_err(|error| format!("Agente residente nao respondeu healthcheck: {error}"))?;
    let status = response.status();
    let body = response
        .text()
        .map_err(|error| format!("Falha ao ler healthcheck do agente residente: {error}"))?;
    if !status.is_success() {
        return Err(format!(
            "Healthcheck do agente residente retornou HTTP {}: {}",
            status.as_u16(),
            body
        ));
    }
    serde_json::from_str::<Value>(&body)
        .map_err(|error| format!("Healthcheck do agente residente retornou JSON invalido: {error}"))
}

fn run_resident_agent_request(
    request: &Value,
    host_port: u16,
    timeout_ms: u64,
) -> Result<(Value, String, String, Option<i32>), String> {
    let token = resident_agent_token();
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|error| format!("Falha ao criar cliente do agente residente: {error}"))?;
    let mut http_request = client
        .post(build_resident_agent_url(host_port, "/v1/action"))
        .header("Content-Type", "application/json")
        .body(request.to_string());
    if !token.is_empty() {
        http_request = http_request.header("X-Alice-Agent-Token", token);
    }
    let response = http_request
        .send()
        .map_err(|error| format!("Agente residente indisponivel: {error}"))?;
    let status_code = Some(i32::from(response.status().as_u16()));
    let body = response
        .text()
        .map_err(|error| format!("Falha ao ler resposta do agente residente: {error}"))?;
    let parsed = serde_json::from_str::<Value>(&body).map_err(|error| {
        format!("Agente residente retornou JSON invalido: {error}. body={body}")
    })?;
    Ok((parsed, body, String::new(), status_code))
}

fn start_resident_agent(
    state: &VmVisualState,
    host_port: u16,
    guest_port: u16,
    timeout_ms: u64,
) -> Result<Value, String> {
    validate_ready(state)?;
    install_agent_files(state, timeout_ms)?;
    configure_resident_agent_port_forward(state, host_port, guest_port, timeout_ms)?;

    let server_path = format!(r"{}\server.py", state.guest_agent_dir);
    let guest_port_arg = guest_port.to_string();
    let token = resident_agent_token();
    let args = if token.is_empty() {
        vec![
            server_path.as_str(),
            "--host",
            "0.0.0.0",
            "--port",
            guest_port_arg.as_str(),
        ]
    } else {
        vec![
            server_path.as_str(),
            "--host",
            "0.0.0.0",
            "--port",
            guest_port_arg.as_str(),
            "--token",
            token.as_str(),
        ]
    };
    let _ = vbox_guest_start(state, &state.guest_python, &args, timeout_ms)?;

    let deadline = std::time::Instant::now()
        .checked_add(Duration::from_millis(timeout_ms.min(10_000)))
        .unwrap_or_else(std::time::Instant::now);
    let mut last_error = String::new();
    while std::time::Instant::now() < deadline {
        match resident_agent_health(host_port, 750) {
            Ok(health) => return Ok(health),
            Err(error) => {
                last_error = error;
                std::thread::sleep(Duration::from_millis(250));
            }
        }
    }

    Err(format!(
        "Agente residente nao ficou pronto dentro do timeout: {last_error}"
    ))
}

fn run_agent_request(
    state: &VmVisualState,
    request: Value,
    timeout_ms: u64,
    allow_resident_start: bool,
) -> Result<(Value, String, String, Option<i32>, String), String> {
    validate_ready(state)?;
    if resident_agent_enabled() {
        let host_port = resident_agent_host_port();
        match run_resident_agent_request(&request, host_port, timeout_ms) {
            Ok((response, stdout, stderr, status_code)) => {
                return Ok((
                    response,
                    stdout,
                    stderr,
                    status_code,
                    "resident_http".to_string(),
                ));
            }
            Err(first_error) => {
                let guest_port = resident_agent_guest_port();
                if allow_resident_start
                    && start_resident_agent(state, host_port, guest_port, timeout_ms).is_ok()
                {
                    if let Ok((response, stdout, stderr, status_code)) =
                        run_resident_agent_request(&request, host_port, timeout_ms)
                    {
                        return Ok((
                            response,
                            stdout,
                            stderr,
                            status_code,
                            "resident_http_started".to_string(),
                        ));
                    }
                }
                log::debug!("Agente residente indisponivel; fallback guestcontrol: {first_error}");
            }
        }
    }

    let encoded = base64::engine::general_purpose::STANDARD.encode(request.to_string());
    let agent_path = format!(r"{}\agent.py", state.guest_agent_dir);
    let (ok, stdout, stderr, status_code) = vbox_guest_run(
        state,
        &state.guest_python,
        &[&agent_path, "--request-json", &encoded],
        timeout_ms,
    )?;
    let parsed = parse_agent_stdout(&stdout).unwrap_or_else(|error| {
        json!({
            "success": false,
            "error": error,
            "raw_stdout": stdout,
            "raw_stderr": stderr,
        })
    });
    if !ok
        && parsed
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or("")
            .is_empty()
    {
        return Ok((
            json!({"success": false, "error": stderr}),
            stdout,
            stderr,
            status_code,
            "guestcontrol_run".to_string(),
        ));
    }
    Ok((
        parsed,
        stdout,
        stderr,
        status_code,
        "guestcontrol_run".to_string(),
    ))
}

#[tauri::command]
pub fn install_vm_guest_agent(
    request: Option<VmVisualTimeoutRequest>,
) -> Result<NativeCommandResult, String> {
    let state = read_state();
    let timeout_ms = request
        .and_then(|request| request.timeout_ms)
        .unwrap_or(DEFAULT_VISUAL_TIMEOUT_MS);
    if timeout_ms == 0 || timeout_ms > MAX_SHELL_TIMEOUT_MS {
        return Err(format!(
            "Timeout do install do guest agent fora do limite: {timeout_ms}ms."
        ));
    }
    match install_agent_files(&state, timeout_ms) {
        Ok(artifacts) => Ok(NativeCommandResult {
            ok: true,
            message: "Guest Interaction Agent instalado/copied dentro da VM.".to_string(),
            stdout: None,
            stderr: None,
            artifacts: Some(artifacts),
        }),
        Err(error) => Ok(NativeCommandResult {
            ok: false,
            message: format!("Nao foi possivel instalar o Guest Interaction Agent: {error}"),
            stdout: None,
            stderr: Some(error.clone()),
            artifacts: Some(json!({
                "provider": state.provider,
                "isRealVm": false,
                "guestAgentOnline": false,
                "error": error,
            })),
        }),
    }
}

#[tauri::command]
pub fn diagnose_vm_guest_agent() -> Result<NativeCommandResult, String> {
    let state = read_state();
    let request = build_agent_request("get_status", json!({}), "diagnostic", "diagnostic");
    let result = run_agent_request(&state, request, DEFAULT_VISUAL_TIMEOUT_MS, false);
    match result {
        Ok((agent_response, stdout, stderr, status_code, transport)) => {
            let success = agent_response
                .get("success")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            Ok(NativeCommandResult {
                ok: success,
                message: if success {
                    "Guest Interaction Agent online.".to_string()
                } else {
                    "Guest Interaction Agent respondeu com erro.".to_string()
                },
                stdout: Some(stdout),
                stderr: Some(stderr),
                artifacts: Some(json!({
                    "provider": state.provider,
                    "vmName": state.vm_name,
                    "guestAgentDir": state.guest_agent_dir,
                    "guestPython": state.guest_python,
                    "guestAgentOnline": success,
                    "statusCode": status_code,
                    "transport": transport,
                    "residentAgentEnabled": resident_agent_enabled(),
                    "residentAgentHostPort": resident_agent_host_port(),
                    "agentResponse": agent_response,
                    "capabilities": agent_response.get("result").and_then(|value| value.get("capabilities")).cloned().unwrap_or_else(|| json!({})),
                })),
            })
        }
        Err(error) => Ok(NativeCommandResult {
            ok: false,
            message: format!("Guest Interaction Agent indisponivel: {error}"),
            stdout: None,
            stderr: Some(error.clone()),
            artifacts: Some(json!({
                "provider": state.provider,
                "vmName": state.vm_name,
                "guestAgentDir": state.guest_agent_dir,
                "guestPython": state.guest_python,
                "guestAgentOnline": false,
                "requiresInstall": true,
                "error": error,
            })),
        }),
    }
}

#[tauri::command]
pub fn start_vm_guest_agent_resident(
    request: Option<VmResidentAgentRequest>,
) -> Result<NativeCommandResult, String> {
    let state = read_state();
    let request = request.unwrap_or(VmResidentAgentRequest {
        timeout_ms: None,
        host_port: None,
        guest_port: None,
    });
    let timeout_ms = request.timeout_ms.unwrap_or(DEFAULT_VISUAL_TIMEOUT_MS);
    if timeout_ms == 0 || timeout_ms > MAX_SHELL_TIMEOUT_MS {
        return Err(format!(
            "Timeout do agente visual residente fora do limite: {timeout_ms}ms."
        ));
    }
    let host_port = request.host_port.unwrap_or_else(resident_agent_host_port);
    let guest_port = request.guest_port.unwrap_or_else(resident_agent_guest_port);
    match start_resident_agent(&state, host_port, guest_port, timeout_ms) {
        Ok(health) => Ok(NativeCommandResult {
            ok: true,
            message: "Guest Interaction Agent residente online.".to_string(),
            stdout: Some(health.to_string()),
            stderr: None,
            artifacts: Some(json!({
                "provider": state.provider,
                "vmName": state.vm_name,
                "guestAgentDir": state.guest_agent_dir,
                "guestPython": state.guest_python,
                "guestAgentOnline": true,
                "residentAgentOnline": true,
                "residentAgentHostPort": host_port,
                "residentAgentGuestPort": guest_port,
                "transport": "resident_http",
                "health": health,
            })),
        }),
        Err(error) => Ok(NativeCommandResult {
            ok: false,
            message: format!("Nao foi possivel iniciar agente residente: {error}"),
            stdout: None,
            stderr: Some(error.clone()),
            artifacts: Some(json!({
                "provider": state.provider,
                "vmName": state.vm_name,
                "guestAgentDir": state.guest_agent_dir,
                "guestPython": state.guest_python,
                "guestAgentOnline": false,
                "residentAgentOnline": false,
                "residentAgentHostPort": host_port,
                "residentAgentGuestPort": guest_port,
                "error": error,
            })),
        }),
    }
}

fn run_vm_guest_agent_action_blocking(
    request: VmGuestAgentActionRequest,
) -> Result<NativeCommandResult, String> {
    let state = read_state();
    let timeout_ms = request.timeout_ms.unwrap_or(DEFAULT_VISUAL_TIMEOUT_MS);
    if timeout_ms == 0 || timeout_ms > MAX_SHELL_TIMEOUT_MS {
        return Err(format!(
            "Timeout da acao visual da VM fora do limite: {timeout_ms}ms."
        ));
    }
    let task_id = request
        .task_id
        .unwrap_or_else(|| format!("vm-visual-{}", now_ms()));
    let correlation_id = request.correlation_id.unwrap_or_else(|| task_id.clone());
    let action = request.action.trim().to_string();
    let parameters = request.parameters.unwrap_or_else(|| json!({}));
    let agent_request = build_agent_request(&action, parameters.clone(), &task_id, &correlation_id);
    let (mut agent_response, mut stdout, mut stderr, mut status_code, mut transport) =
        run_agent_request(&state, agent_request, timeout_ms, true)?;
    let mut success = agent_response
        .get("success")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let mut host_input_fallback = false;

    if !success && action == "type_text" {
        if let Some(text) = extract_type_text_value(&parameters) {
            let fallback = run_type_text_with_host_fallback(
                &state,
                &text,
                &task_id,
                &correlation_id,
                timeout_ms,
            )?;
            agent_response = fallback.0;
            stdout = fallback.1;
            stderr = fallback.2;
            status_code = fallback.3;
            host_input_fallback = fallback.4;
            transport = "host_keyboard_fallback".to_string();
            success = agent_response
                .get("success")
                .and_then(Value::as_bool)
                .unwrap_or(false);
        }
    }
    let mut host_screenshot_path = String::new();
    let guest_screenshot_path = agent_response
        .pointer("/result/visual_context/screenshot_path")
        .and_then(Value::as_str)
        .or_else(|| {
            agent_response
                .pointer("/result/capture/screenshot_path")
                .and_then(Value::as_str)
        })
        .unwrap_or("");
    if success && !guest_screenshot_path.is_empty() {
        if let Ok(Some(path)) = vbox_copy_from(
            &state,
            guest_screenshot_path,
            &replay_dir(&correlation_id),
            timeout_ms,
        ) {
            host_screenshot_path = path.to_string_lossy().to_string();
        }
    }

    Ok(NativeCommandResult {
        ok: success,
        message: if success {
            format!("Acao visual executada dentro da VM: {action}.")
        } else {
            format!(
                "Acao visual da VM falhou: {}",
                agent_response
                    .get("error")
                    .and_then(Value::as_str)
                    .unwrap_or("erro_desconhecido")
            )
        },
        stdout: Some(stdout),
        stderr: Some(stderr),
        artifacts: Some(json!({
            "taskId": task_id,
            "correlationId": correlation_id,
            "provider": state.provider,
            "vmName": state.vm_name,
            "isRealVm": true,
            "executionMode": "real_vm_visual",
            "transport": transport,
            "residentAgentEnabled": resident_agent_enabled(),
            "residentAgentHostPort": resident_agent_host_port(),
            "guestAgentOnline": true,
            "action": action,
            "hostInputFallback": host_input_fallback,
            "agentResponse": agent_response,
            "guestScreenshotPath": guest_screenshot_path,
            "hostScreenshotPath": host_screenshot_path,
            "statusCode": status_code,
        })),
    })
}

#[tauri::command]
pub async fn run_vm_guest_agent_action(
    request: VmGuestAgentActionRequest,
) -> Result<NativeCommandResult, String> {
    tauri::async_runtime::spawn_blocking(move || run_vm_guest_agent_action_blocking(request))
        .await
        .map_err(|error| format!("Falha ao aguardar acao visual da VM: {error}"))?
}

#[tauri::command]
pub fn capture_vm_guest_screen(
    request: Option<VmVisualTimeoutRequest>,
) -> Result<NativeCommandResult, String> {
    let timeout_ms = request.and_then(|request| request.timeout_ms);
    run_vm_guest_agent_action_blocking(VmGuestAgentActionRequest {
        action: "capture_screen".to_string(),
        parameters: Some(json!({})),
        timeout_ms,
        task_id: Some(format!("vm-capture-{}", now_ms())),
        correlation_id: Some(format!("vm-capture-{}", now_ms())),
    })
}

#[tauri::command]
pub fn run_vm_visual_smoke_test(
    request: Option<VmVisualSmokeTestRequest>,
) -> Result<NativeCommandResult, String> {
    let state = read_state();
    let timeout_ms = request
        .and_then(|request| request.timeout_ms)
        .unwrap_or(DEFAULT_VISUAL_TIMEOUT_MS);
    if timeout_ms == 0 || timeout_ms > MAX_SHELL_TIMEOUT_MS {
        return Err(format!(
            "Timeout do visual smoke test fora do limite: {timeout_ms}ms."
        ));
    }
    validate_ready(&state)?;
    let task_id = format!("vm-visual-smoke-{}", now_ms());
    let _ = vbox_guest_start(
        &state,
        r"C:\Windows\System32\notepad.exe",
        &["notepad.exe"],
        timeout_ms,
    );
    let typed = run_type_text_with_host_fallback(
        &state,
        "alice visual smoke ok",
        &task_id,
        &task_id,
        timeout_ms,
    )?;
    let captured = run_agent_request(
        &state,
        build_agent_request("capture_screen", json!({}), &task_id, &task_id),
        timeout_ms,
        true,
    )?;
    let typed_ok = typed
        .0
        .get("success")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let capture_ok = captured
        .0
        .get("success")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let guest_screenshot_path = captured
        .0
        .pointer("/result/visual_context/screenshot_path")
        .and_then(Value::as_str)
        .unwrap_or("");
    let host_screenshot_path = if capture_ok && !guest_screenshot_path.is_empty() {
        vbox_copy_from(
            &state,
            guest_screenshot_path,
            &replay_dir(&task_id),
            timeout_ms,
        )
        .ok()
        .flatten()
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_default()
    } else {
        String::new()
    };
    let ok = typed_ok && capture_ok && !host_screenshot_path.is_empty();

    Ok(NativeCommandResult {
        ok,
        message: if ok {
            "Visual smoke test executou Notepad, digitou texto, capturou screenshot e coletou replay.".to_string()
        } else {
            "Visual smoke test falhou em uma ou mais etapas.".to_string()
        },
        stdout: Some(format!(
            "typed_stdout={}\ncapture_stdout={}",
            typed.1, captured.1
        )),
        stderr: Some(format!(
            "typed_stderr={}\ncapture_stderr={}",
            typed.2, captured.2
        )),
        artifacts: Some(json!({
            "taskId": task_id,
            "provider": state.provider,
            "vmName": state.vm_name,
            "isRealVm": true,
            "executionMode": "real_vm_visual",
            "guestAgentOnline": true,
            "visualSmokeTest": true,
            "typedOk": typed_ok,
            "typedMethod": typed.0.pointer("/result/method").and_then(Value::as_str).unwrap_or(""),
            "hostInputFallback": typed.4,
            "captureOk": capture_ok,
            "guestScreenshotPath": guest_screenshot_path,
            "hostScreenshotPath": host_screenshot_path,
            "replayId": task_id,
            "validation": {
                "passed": ok,
                "typedTextSent": typed_ok,
                "screenshotCollected": !host_screenshot_path.is_empty(),
                "ocrValidated": false,
                "ocrReason": "OCR e opcional nesta etapa; validacao visual exige screenshot coletada."
            }
        })),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn visual_agent_request_is_versioned_and_correlated() {
        let request = build_agent_request("capture_screen", json!({}), "task-1", "corr-1");

        assert_eq!(request["protocol_version"], "1.0");
        assert_eq!(request["action"], "capture_screen");
        assert_eq!(request["task_id"], "task-1");
        assert_eq!(request["correlation_id"], "corr-1");
    }

    #[test]
    fn parses_last_json_line_from_agent_stdout() {
        let parsed =
            parse_agent_stdout("noise\n{\"success\":true,\"result\":{\"ok\":1}}\n").unwrap();

        assert_eq!(parsed["success"], true);
        assert_eq!(parsed["result"]["ok"], 1);
    }

    #[test]
    fn extracts_type_text_value_for_host_keyboard_fallback() {
        assert_eq!(
            extract_type_text_value(&json!({"text": "alice ok"})),
            Some("alice ok".to_string())
        );
        assert_eq!(extract_type_text_value(&json!({"text": ""})), None);
        assert_eq!(extract_type_text_value(&json!({"value": "missing"})), None);
    }

    #[test]
    fn resident_agent_url_is_loopback_only() {
        assert_eq!(
            build_resident_agent_url(38948, "/health"),
            "http://127.0.0.1:38948/health"
        );
        assert_eq!(
            build_resident_agent_url(38948, "v1/action"),
            "http://127.0.0.1:38948/v1/action"
        );
    }

    #[test]
    fn resident_nat_rule_uses_named_localhost_forward() {
        assert_eq!(
            build_nat_port_forward_rule("alice-guest-agent", 38948, 38949),
            "alice-guest-agent,tcp,127.0.0.1,38948,,38949"
        );
    }
}
