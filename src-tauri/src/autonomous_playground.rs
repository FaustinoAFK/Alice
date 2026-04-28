use serde::Deserialize;
use serde_json::json;
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};
use tauri::Manager;

use super::{
    alice_project_folder, truncate_shell_output, validate_path_string, NativeCommandResult,
    MAX_SHELL_TIMEOUT_MS,
};

const DEFAULT_PLAYGROUND_TIMEOUT_MS: u64 = 15_000;
const MAX_PLAYGROUND_FILES: usize = 80;
const MAX_PLAYGROUND_FILE_BYTES: u64 = 2 * 1024 * 1024;
const MAX_PLAYGROUND_TOTAL_BYTES: u64 = 12 * 1024 * 1024;

static CANCELLED_TASKS: LazyLock<Mutex<HashMap<String, String>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSourceFile {
    path: Option<String>,
    content: Option<String>,
    target_path: Option<String>,
    content_hash: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceCommandRequest {
    task_id: String,
    source_files: Vec<WorkspaceSourceFile>,
    command: String,
    args: Option<Vec<String>>,
    timeout_ms: Option<u64>,
}

fn sanitize_path_segment(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
                character
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = sanitized.trim_matches('-');
    if trimmed.is_empty() {
        "item".to_string()
    } else {
        trimmed.to_string()
    }
}

fn is_safe_relative_path(path: &Path) -> bool {
    !path.as_os_str().is_empty()
        && path.is_relative()
        && path
            .components()
            .all(|component| matches!(component, Component::Normal(_) | Component::CurDir))
}

fn source_display_name(source_file: &WorkspaceSourceFile, index: usize) -> String {
    source_file
        .target_path
        .as_deref()
        .or(source_file.path.as_deref())
        .and_then(|path| Path::new(path).file_name())
        .and_then(|name| name.to_str())
        .map(sanitize_path_segment)
        .unwrap_or_else(|| format!("file-{index}.txt"))
}

fn resolve_source_path(path: &str) -> Result<PathBuf, String> {
    let raw_path = PathBuf::from(path);
    let resolved = if raw_path.is_absolute() {
        raw_path
    } else {
        alice_project_folder()?.join(raw_path)
    };
    let canonical = fs::canonicalize(&resolved).map_err(|error| {
        format!(
            "Falha ao resolver arquivo de origem para o workspace local fallback em {}: {error}",
            resolved.display()
        )
    })?;
    validate_path_string(&canonical.to_string_lossy())?;
    if !canonical.is_file() {
        return Err(format!(
            "O workspace local fallback aceita apenas arquivos como origem: {}",
            canonical.display()
        ));
    }
    Ok(canonical)
}

fn copy_or_write_source_file(
    source_file: &WorkspaceSourceFile,
    workspace_input_dir: &Path,
    index: usize,
) -> Result<serde_json::Value, String> {
    let file_name = source_display_name(source_file, index);
    let target_relative_path = source_file
        .target_path
        .as_deref()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(format!("{index:03}-{file_name}")));

    if !is_safe_relative_path(&target_relative_path) {
        return Err(format!(
            "Caminho de destino inseguro para workspace local fallback: {}",
            target_relative_path.display()
        ));
    }

    let target_path = workspace_input_dir.join(&target_relative_path);
    let target_parent = target_path.parent().ok_or_else(|| {
        format!(
            "Nao consegui resolver a pasta de destino do workspace local fallback para {}.",
            target_path.display()
        )
    })?;
    fs::create_dir_all(target_parent).map_err(|error| {
        format!(
            "Falha ao criar pasta do workspace local em {}: {error}",
            target_parent.display()
        )
    })?;

    if let Some(content) = &source_file.content {
        if content.len() as u64 > MAX_PLAYGROUND_FILE_BYTES {
            return Err(format!(
                "Arquivo inline excede {} bytes para workspace local fallback.",
                MAX_PLAYGROUND_FILE_BYTES
            ));
        }
        let mut file = fs::File::create(&target_path).map_err(|error| {
            format!(
                "Falha ao criar arquivo inline no workspace local fallback em {}: {error}",
                target_path.display()
            )
        })?;
        file.write_all(content.as_bytes()).map_err(|error| {
            format!(
                "Falha ao escrever arquivo inline no workspace local fallback em {}: {error}",
                target_path.display()
            )
        })?;
        return Ok(json!({
            "sourcePath": null,
            "workspacePath": target_path.to_string_lossy(),
            "relativePath": target_relative_path.to_string_lossy(),
            "mode": "inline_copy",
            "contentHash": source_file.content_hash.clone().unwrap_or_default(),
            "sizeBytes": content.len(),
        }));
    }

    let source_path = resolve_source_path(
        source_file
            .path
            .as_deref()
            .ok_or_else(|| "Source file precisa de path ou content.".to_string())?,
    )?;
    let metadata = fs::metadata(&source_path).map_err(|error| {
        format!(
            "Falha ao ler metadados do arquivo de origem {}: {error}",
            source_path.display()
        )
    })?;
    if metadata.len() > MAX_PLAYGROUND_FILE_BYTES {
        return Err(format!(
            "Arquivo de origem excede {} bytes: {}",
            MAX_PLAYGROUND_FILE_BYTES,
            source_path.display()
        ));
    }
    fs::copy(&source_path, &target_path).map_err(|error| {
        format!(
            "Falha ao copiar arquivo para workspace local fallback de {} para {}: {error}",
            source_path.display(),
            target_path.display()
        )
    })?;

    Ok(json!({
        "sourcePath": source_path.to_string_lossy(),
        "workspacePath": target_path.to_string_lossy(),
        "relativePath": target_relative_path.to_string_lossy(),
        "mode": "copy",
        "contentHash": source_file.content_hash.clone().unwrap_or_default(),
        "sizeBytes": metadata.len(),
    }))
}

fn validate_playground_command(command: &str) -> Result<String, String> {
    let normalized = command.trim();
    if normalized.is_empty() {
        return Err("Comando do workspace local fallback nao pode ser vazio.".to_string());
    }
    if normalized.contains('\\') || normalized.contains('/') {
        return Err(
            "Comando do workspace local fallback deve ser um executavel permitido, sem caminho."
                .to_string(),
        );
    }
    match normalized.to_ascii_lowercase().as_str() {
        "node" | "npm" | "python" | "python3" | "py" | "cargo" | "git" => {
            Ok(normalized.to_string())
        }
        _ => Err(format!(
            "Comando nao permitido no workspace local fallback: {normalized}"
        )),
    }
}

fn validate_playground_args(args: &[String], workspace_root: &Path) -> Result<(), String> {
    let workspace_root = fs::canonicalize(workspace_root).map_err(|error| {
        format!(
            "Falha ao validar workspace local fallback em {}: {error}",
            workspace_root.display()
        )
    })?;

    for arg in args {
        let trimmed = arg.trim();
        if trimmed.contains('\0') || trimmed.contains('\n') || trimmed.contains('\r') {
            return Err(
                "Argumento do workspace local fallback contem caractere de controle.".to_string(),
            );
        }
        let possible_path = PathBuf::from(trimmed);
        if possible_path.is_absolute() {
            let canonical = fs::canonicalize(&possible_path).unwrap_or(possible_path);
            if !canonical.starts_with(&workspace_root) {
                return Err(format!(
                    "Argumento com caminho absoluto fora do workspace local: {}",
                    canonical.display()
                ));
            }
        }
    }

    Ok(())
}

fn workspace_root_for(app: &tauri::AppHandle, task_id: &str) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Falha ao localizar app data da Alice: {error}"))?;
    Ok(app_data_dir
        .join("autonomous-playground")
        .join("workspaces")
        .join(sanitize_path_segment(task_id)))
}

#[tauri::command]
pub fn cancel_autonomous_task(
    task_id: String,
    reason: Option<String>,
) -> Result<NativeCommandResult, String> {
    let normalized_task_id = sanitize_path_segment(&task_id);
    let cancel_reason = reason.unwrap_or_else(|| "cancel_requested".to_string());
    let mut cancellations = CANCELLED_TASKS
        .lock()
        .map_err(|_| "Falha ao bloquear registro de cancelamento.".to_string())?;
    cancellations.insert(normalized_task_id.clone(), cancel_reason.clone());

    Ok(NativeCommandResult {
        ok: true,
        message: format!("Cancelamento solicitado para tarefa {normalized_task_id}."),
        stdout: None,
        stderr: None,
        artifacts: Some(json!({
            "taskId": normalized_task_id,
            "reason": cancel_reason,
        })),
    })
}

fn task_cancel_reason(task_id: &str) -> Option<String> {
    CANCELLED_TASKS
        .lock()
        .ok()
        .and_then(|cancellations| cancellations.get(task_id).cloned())
}

fn clear_task_cancel_request(task_id: &str) {
    if let Ok(mut cancellations) = CANCELLED_TASKS.lock() {
        cancellations.remove(task_id);
    }
}

#[tauri::command]
pub fn run_local_workspace_playground_task(
    app: tauri::AppHandle,
    request: WorkspaceCommandRequest,
) -> Result<NativeCommandResult, String> {
    if request.source_files.len() > MAX_PLAYGROUND_FILES {
        return Err(format!(
            "Workspace local fallback recebeu arquivos demais: maximo {MAX_PLAYGROUND_FILES}."
        ));
    }

    let task_id = sanitize_path_segment(&request.task_id);
    clear_task_cancel_request(&task_id);
    let command = validate_playground_command(&request.command)?;
    let args = request.args.unwrap_or_default();
    let timeout_ms = request.timeout_ms.unwrap_or(DEFAULT_PLAYGROUND_TIMEOUT_MS);
    if timeout_ms == 0 || timeout_ms > MAX_SHELL_TIMEOUT_MS {
        return Err(format!(
            "Timeout do workspace local fallback fora do limite: {timeout_ms}ms."
        ));
    }

    let workspace_root = workspace_root_for(&app, &task_id)?;
    if workspace_root.exists() {
        fs::remove_dir_all(&workspace_root).map_err(|error| {
            format!(
                "Falha ao limpar workspace local fallback anterior em {}: {error}",
                workspace_root.display()
            )
        })?;
    }
    let input_dir = workspace_root.join("input");
    let output_dir = workspace_root.join("output");
    let logs_dir = workspace_root.join("logs");
    fs::create_dir_all(&input_dir).map_err(|error| {
        format!(
            "Falha ao criar input do workspace local fallback em {}: {error}",
            input_dir.display()
        )
    })?;
    fs::create_dir_all(&output_dir).map_err(|error| {
        format!(
            "Falha ao criar output do workspace local fallback em {}: {error}",
            output_dir.display()
        )
    })?;
    fs::create_dir_all(&logs_dir).map_err(|error| {
        format!(
            "Falha ao criar logs do workspace local fallback em {}: {error}",
            logs_dir.display()
        )
    })?;

    let mut total_bytes = 0_u64;
    let mut copy_manifest = Vec::new();
    for (index, source_file) in request.source_files.iter().enumerate() {
        let copied = copy_or_write_source_file(source_file, &input_dir, index + 1)?;
        total_bytes += copied
            .get("sizeBytes")
            .and_then(|value| value.as_u64())
            .unwrap_or(0);
        if total_bytes > MAX_PLAYGROUND_TOTAL_BYTES {
            return Err(format!(
                "Workspace local fallback excede {} bytes.",
                MAX_PLAYGROUND_TOTAL_BYTES
            ));
        }
        copy_manifest.push(copied);
    }

    validate_playground_args(&args, &workspace_root)?;

    let mut child = Command::new(&command)
        .args(&args)
        .current_dir(&input_dir)
        .env("ALICE_LOCAL_WORKSPACE", &workspace_root)
        .env("ALICE_LOCAL_WORKSPACE_INPUT", &input_dir)
        .env("ALICE_LOCAL_WORKSPACE_OUTPUT", &output_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Falha ao iniciar tarefa no workspace local fallback: {error}"))?;

    let started_at = Instant::now();
    let timeout = Duration::from_millis(timeout_ms);
    let finished = loop {
        if let Some(reason) = task_cancel_reason(&task_id) {
            let _ = child.kill();
            let _ = child.wait();
            clear_task_cancel_request(&task_id);
            let cleanup_status = match fs::remove_dir_all(&workspace_root) {
                Ok(()) => "workspace_removed".to_string(),
                Err(error) => format!("workspace_cleanup_failed:{error}"),
            };
            return Ok(NativeCommandResult {
                ok: false,
                message: format!("Tarefa cancelada no workspace local fallback: {reason}"),
                stdout: None,
                stderr: None,
                artifacts: Some(json!({
                    "taskId": task_id,
                    "workspacePath": workspace_root.to_string_lossy(),
                    "cancelled": true,
                    "cancelReason": reason,
                    "cleanupStatus": cleanup_status,
                })),
            });
        }

        if let Some(status) = child.try_wait().map_err(|error| {
            format!("Falha ao consultar tarefa do workspace local fallback: {error}")
        })? {
            break status;
        }

        if started_at.elapsed() >= timeout {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!(
                "Tarefa do workspace local fallback expirou apos {timeout_ms}ms."
            ));
        }

        std::thread::sleep(Duration::from_millis(50));
    };

    let output = child
        .wait_with_output()
        .map_err(|error| format!("Falha ao coletar saida do workspace local fallback: {error}"))?;
    let stdout = truncate_shell_output(&String::from_utf8_lossy(&output.stdout));
    let stderr = truncate_shell_output(&String::from_utf8_lossy(&output.stderr));
    let status_code = finished.code().or_else(|| output.status.code());
    fs::write(logs_dir.join("stdout.txt"), &stdout)
        .map_err(|error| format!("Falha ao gravar stdout do workspace local fallback: {error}"))?;
    fs::write(logs_dir.join("stderr.txt"), &stderr)
        .map_err(|error| format!("Falha ao gravar stderr do workspace local fallback: {error}"))?;

    Ok(NativeCommandResult {
        ok: output.status.success(),
        message: if output.status.success() {
            "Tarefa concluida no workspace local fallback.".to_string()
        } else {
            "Tarefa do workspace local fallback concluiu com erro.".to_string()
        },
        stdout: Some(stdout),
        stderr: Some(stderr),
        artifacts: Some(json!({
            "taskId": task_id,
            "workspacePath": workspace_root.to_string_lossy(),
            "inputPath": input_dir.to_string_lossy(),
            "outputPath": output_dir.to_string_lossy(),
            "logsPath": logs_dir.to_string_lossy(),
            "copyManifest": copy_manifest,
            "command": command,
            "args": args,
            "timeoutMs": timeout_ms,
            "statusCode": status_code,
            "totalCopiedBytes": total_bytes,
            "isRealVm": false,
            "executionMode": "local_workspace_fallback",
        })),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_playground_command_rejects_shells_and_paths() {
        assert!(validate_playground_command("cmd").is_err());
        assert!(validate_playground_command("powershell").is_err());
        assert!(validate_playground_command("C:\\Windows\\System32\\cmd.exe").is_err());
        assert_eq!(validate_playground_command("node"), Ok("node".to_string()));
    }

    #[test]
    fn safe_relative_path_rejects_parent_components() {
        assert!(is_safe_relative_path(Path::new("input/file.txt")));
        assert!(!is_safe_relative_path(Path::new("../file.txt")));
        assert!(!is_safe_relative_path(Path::new("C:\\temp\\file.txt")));
    }

    #[test]
    fn cancel_registry_records_task_cancel_request() {
        clear_task_cancel_request("task-cancel-test");

        let result = cancel_autonomous_task(
            "task-cancel-test".to_string(),
            Some("user_request_preemption".to_string()),
        )
        .unwrap();

        assert!(result.ok);
        assert_eq!(
            task_cancel_reason("task-cancel-test"),
            Some("user_request_preemption".to_string())
        );

        clear_task_cancel_request("task-cancel-test");
    }
}
