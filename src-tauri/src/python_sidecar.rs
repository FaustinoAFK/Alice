use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::env;
use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

const DEFAULT_REQUEST_TIMEOUT_MS: u64 = 5_000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PythonSidecarRequest {
    id: String,
    domain: String,
    action: String,
    args: Value,
    timeout_ms: u64,
}

#[derive(Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PythonSidecarResponse {
    pub(crate) id: String,
    pub(crate) ok: bool,
    pub(crate) message: String,
    pub(crate) artifacts: Option<Value>,
    pub(crate) stdout: Option<String>,
    pub(crate) stderr: Option<String>,
    pub(crate) error_code: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
struct LaunchSpec {
    program: String,
    args: Vec<String>,
}

#[derive(Debug)]
struct PythonSidecarProcess {
    child: Child,
    stdin: ChildStdin,
    stdout: Option<BufReader<ChildStdout>>,
}

#[derive(Debug, Default)]
struct PythonSidecarManager {
    process: Option<PythonSidecarProcess>,
    next_request_id: u64,
}

impl PythonSidecarManager {
    fn invoke(
        &mut self,
        action: &str,
        args: Value,
        timeout_ms: Option<u64>,
    ) -> Result<PythonSidecarResponse, String> {
        let request_timeout_ms = timeout_ms.unwrap_or(DEFAULT_REQUEST_TIMEOUT_MS);
        let request = PythonSidecarRequest {
            id: self.next_request_id(),
            domain: "window_ui".to_string(),
            action: action.to_string(),
            args,
            timeout_ms: request_timeout_ms,
        };

        self.ensure_process()?;
        match self.send_request(&request, request_timeout_ms) {
            Ok(response) => Ok(response),
            Err(first_error) => {
                self.restart()?;
                self.send_request(&request, request_timeout_ms).map_err(|second_error| {
                    format!(
                        "Sidecar Python falhou apos reinicio. Primeiro erro: {first_error}. Segundo erro: {second_error}"
                    )
                })
            }
        }
    }

    fn next_request_id(&mut self) -> String {
        self.next_request_id += 1;
        format!("py-sidecar-{}", self.next_request_id)
    }

    fn ensure_process(&mut self) -> Result<(), String> {
        let should_spawn = match self.process.as_mut() {
            None => true,
            Some(process) => match process.child.try_wait() {
                Ok(Some(_)) => true,
                Ok(None) => false,
                Err(_) => true,
            },
        };

        if should_spawn {
            self.spawn()?;
        }

        Ok(())
    }

    fn restart(&mut self) -> Result<(), String> {
        self.stop();
        self.spawn()
    }

    fn stop(&mut self) {
        if let Some(mut process) = self.process.take() {
            let _ = process.child.kill();
            let _ = process.child.wait();
        }
    }

    fn spawn(&mut self) -> Result<(), String> {
        let mut errors = Vec::new();
        for spec in resolve_launch_specs() {
            match spawn_process(&spec) {
                Ok(process) => {
                    self.process = Some(process);
                    return Ok(());
                }
                Err(error) => errors.push(format!("{} {:?}: {error}", spec.program, spec.args)),
            }
        }

        Err(if errors.is_empty() {
            "Nao encontrei launch spec para o sidecar Python.".to_string()
        } else {
            format!(
                "Nao consegui iniciar o sidecar Python. {}",
                errors.join(" | ")
            )
        })
    }

    fn send_request(
        &mut self,
        request: &PythonSidecarRequest,
        timeout_ms: u64,
    ) -> Result<PythonSidecarResponse, String> {
        let process = self
            .process
            .as_mut()
            .ok_or_else(|| "Sidecar Python nao iniciado.".to_string())?;
        let payload = serde_json::to_string(request)
            .map_err(|error| format!("Falha ao serializar requisicao do sidecar: {error}"))?;

        process
            .stdin
            .write_all(payload.as_bytes())
            .map_err(|error| format!("Falha ao enviar requisicao ao sidecar Python: {error}"))?;
        process
            .stdin
            .write_all(b"\n")
            .map_err(|error| format!("Falha ao finalizar requisicao ao sidecar Python: {error}"))?;
        process
            .stdin
            .flush()
            .map_err(|error| format!("Falha ao flushar requisicao ao sidecar Python: {error}"))?;

        let stdout = process
            .stdout
            .take()
            .ok_or_else(|| "Stdout do sidecar Python indisponivel.".to_string())?;
        let (sender, receiver) = std::sync::mpsc::channel();

        std::thread::spawn(move || {
            let mut reader = stdout;
            let mut line = String::new();
            let read_result = reader.read_line(&mut line);
            let _ = sender.send((reader, read_result, line));
        });

        match receiver.recv_timeout(Duration::from_millis(timeout_ms.max(1))) {
            Ok((reader, read_result, line)) => {
                process.stdout = Some(reader);
                let bytes = read_result
                    .map_err(|error| format!("Falha ao ler resposta do sidecar Python: {error}"))?;

                if bytes == 0 {
                    return Err("Sidecar Python encerrou sem responder.".to_string());
                }

                let response: PythonSidecarResponse =
                    serde_json::from_str(line.trim()).map_err(|error| {
                        format!("Falha ao interpretar resposta do sidecar Python: {error}")
                    })?;

                if response.id != request.id {
                    return Err(format!(
                        "Resposta do sidecar Python veio com correlacao invalida. Esperado {}, recebido {}.",
                        request.id, response.id
                    ));
                }

                Ok(response)
            }
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                self.stop();
                Err(format!("Sidecar Python expirou apos {}ms.", timeout_ms))
            }
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                self.stop();
                Err("Thread de leitura do sidecar Python foi interrompida.".to_string())
            }
        }
    }
}

fn spawn_process(spec: &LaunchSpec) -> Result<PythonSidecarProcess, String> {
    let mut child = Command::new(&spec.program)
        .args(&spec.args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Falha ao iniciar processo do sidecar Python: {error}"))?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Sidecar Python iniciou sem stdin.".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Sidecar Python iniciou sem stdout.".to_string())?;

    Ok(PythonSidecarProcess {
        child,
        stdin,
        stdout: Some(BufReader::new(stdout)),
    })
}

fn resolve_launch_specs() -> Vec<LaunchSpec> {
    let mut specs = Vec::new();

    if let Ok(custom_path) = env::var("ALICE_PYTHON_SIDECAR_PATH") {
        specs.extend(launch_specs_for_path(Path::new(&custom_path)));
    }

    let dev_path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("python_sidecar")
        .join("main.py");
    specs.extend(launch_specs_for_path(&dev_path));
    dedupe_launch_specs(specs)
}

fn launch_specs_for_path(path: &Path) -> Vec<LaunchSpec> {
    if !path.exists() {
        return Vec::new();
    }

    let normalized = path.to_string_lossy().to_string();
    if normalized.to_lowercase().ends_with(".py") {
        let launchers = sidecar_python_launchers();
        return launchers
            .into_iter()
            .map(|(program, mut args)| {
                args.push(normalized.clone());
                LaunchSpec { program, args }
            })
            .collect();
    }

    Vec::new()
}

fn sidecar_python_launchers() -> Vec<(String, Vec<String>)> {
    let mut launchers = Vec::new();
    if let Ok(custom_python) = env::var("ALICE_PYTHON_BIN") {
        launchers.push((custom_python, Vec::new()));
    }
    launchers.push(("python".to_string(), Vec::new()));
    launchers.push(("py".to_string(), vec!["-3".to_string()]));
    dedupe_launcher_programs(launchers)
}

fn dedupe_launch_specs(specs: Vec<LaunchSpec>) -> Vec<LaunchSpec> {
    let mut unique = Vec::new();
    for spec in specs {
        if !unique.iter().any(|existing: &LaunchSpec| existing == &spec) {
            unique.push(spec);
        }
    }
    unique
}

fn dedupe_launcher_programs(launchers: Vec<(String, Vec<String>)>) -> Vec<(String, Vec<String>)> {
    let mut unique = Vec::new();
    for launcher in launchers {
        if !unique.iter().any(|existing| existing == &launcher) {
            unique.push(launcher);
        }
    }
    unique
}

fn manager() -> &'static Mutex<PythonSidecarManager> {
    static MANAGER: OnceLock<Mutex<PythonSidecarManager>> = OnceLock::new();
    MANAGER.get_or_init(|| Mutex::new(PythonSidecarManager::default()))
}

pub(crate) fn invoke_window_ui(
    action: &str,
    args: Value,
    timeout_ms: Option<u64>,
) -> Result<PythonSidecarResponse, String> {
    let mut guard = manager()
        .lock()
        .map_err(|_| "Nao consegui bloquear o manager do sidecar Python.".to_string())?;
    guard.invoke(action, args, timeout_ms)
}

pub(crate) fn get_foreground_context() -> Result<PythonSidecarResponse, String> {
    invoke_window_ui(
        "get_foreground_context",
        json!({}),
        Some(DEFAULT_REQUEST_TIMEOUT_MS),
    )
}

#[cfg(test)]
pub(crate) fn reset_for_tests() {
    if let Ok(mut guard) = manager().lock() {
        guard.stop();
        guard.next_request_id = 0;
    }
}

#[cfg(test)]
pub(crate) fn test_env_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn write_fake_sidecar(script: &str) -> PathBuf {
        let path = env::temp_dir().join(format!(
            "alice-python-sidecar-test-{}-{}.py",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::write(&path, script).unwrap();
        path
    }

    #[test]
    fn launch_specs_include_custom_sidecar_path() {
        let _guard = test_env_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let script = write_fake_sidecar("print('ok')");
        env::set_var("ALICE_PYTHON_SIDECAR_PATH", &script);
        env::set_var("ALICE_PYTHON_BIN", "python");

        let specs = resolve_launch_specs();

        assert!(specs.iter().any(|spec| spec.program.contains("python")
            && spec.args.iter().any(|arg| arg == &script.to_string_lossy())));

        env::remove_var("ALICE_PYTHON_SIDECAR_PATH");
        env::remove_var("ALICE_PYTHON_BIN");
        let _ = fs::remove_file(script);
    }

    #[test]
    fn launch_specs_ignore_non_python_sidecar_paths() {
        let _guard = test_env_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let path = env::temp_dir().join(format!(
            "alice-python-sidecar-test-{}-{}.exe",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::write(&path, b"fake").unwrap();
        env::set_var("ALICE_PYTHON_SIDECAR_PATH", &path);
        env::set_var("ALICE_PYTHON_BIN", "python");

        let specs = resolve_launch_specs();

        assert!(!specs
            .iter()
            .any(|spec| spec.args.iter().any(|arg| arg == &path.to_string_lossy())));

        env::remove_var("ALICE_PYTHON_SIDECAR_PATH");
        env::remove_var("ALICE_PYTHON_BIN");
        let _ = fs::remove_file(path);
    }

    #[test]
    fn manager_starts_and_correlates_responses() {
        let _guard = test_env_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let script = write_fake_sidecar(
            "import json,sys\nfor line in sys.stdin:\n req=json.loads(line)\n print(json.dumps({'id': req['id'], 'ok': True, 'message': 'pong', 'artifacts': {'echo': req['action']}, 'stdout': None, 'stderr': None}), flush=True)\n",
        );
        env::set_var("ALICE_PYTHON_SIDECAR_PATH", &script);
        env::set_var("ALICE_PYTHON_BIN", "python");
        reset_for_tests();

        let response =
            invoke_window_ui("resolve_target", json!({"target": "Salvar"}), Some(1_000)).unwrap();

        assert!(response.id.starts_with("py-sidecar-"));
        assert_eq!(response.message, "pong");
        assert_eq!(response.artifacts, Some(json!({"echo": "resolve_target"})));

        reset_for_tests();
        env::remove_var("ALICE_PYTHON_SIDECAR_PATH");
        env::remove_var("ALICE_PYTHON_BIN");
        let _ = fs::remove_file(script);
    }

    #[test]
    fn manager_restarts_when_previous_process_exits() {
        let _guard = test_env_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let script = write_fake_sidecar(
            "import json,sys\nline=sys.stdin.readline()\nreq=json.loads(line)\nprint(json.dumps({'id': req['id'], 'ok': True, 'message': 'once', 'artifacts': {'pid': 'first'}, 'stdout': None, 'stderr': None}), flush=True)\n",
        );
        env::set_var("ALICE_PYTHON_SIDECAR_PATH", &script);
        env::set_var("ALICE_PYTHON_BIN", "python");
        reset_for_tests();

        let first =
            invoke_window_ui("resolve_target", json!({"target": "Salvar"}), Some(1_000)).unwrap();
        let second =
            invoke_window_ui("resolve_target", json!({"target": "Salvar"}), Some(1_000)).unwrap();

        assert_eq!(first.message, "once");
        assert_eq!(second.message, "once");

        reset_for_tests();
        env::remove_var("ALICE_PYTHON_SIDECAR_PATH");
        env::remove_var("ALICE_PYTHON_BIN");
        let _ = fs::remove_file(script);
    }

    #[test]
    fn manager_times_out_and_normalizes_failure() {
        let _guard = test_env_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let script = write_fake_sidecar(
            "import json,sys,time\nfor line in sys.stdin:\n req=json.loads(line)\n time.sleep(0.2)\n print(json.dumps({'id': req['id'], 'ok': True, 'message': 'late', 'artifacts': None, 'stdout': None, 'stderr': None}), flush=True)\n",
        );
        env::set_var("ALICE_PYTHON_SIDECAR_PATH", &script);
        env::set_var("ALICE_PYTHON_BIN", "python");
        reset_for_tests();

        let error =
            invoke_window_ui("resolve_target", json!({"target": "Salvar"}), Some(50)).unwrap_err();

        assert!(error.contains("expirou"));

        reset_for_tests();
        env::remove_var("ALICE_PYTHON_SIDECAR_PATH");
        env::remove_var("ALICE_PYTHON_BIN");
        let _ = fs::remove_file(script);
    }
}
