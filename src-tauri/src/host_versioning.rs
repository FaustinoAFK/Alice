use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::Manager;

use super::{alice_project_folder, validate_path_string, NativeCommandResult};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostSnapshotRequest {
    action_id: String,
    files: Vec<String>,
    reason: Option<String>,
    task_id: Option<String>,
    declared_files: Option<Vec<String>>,
    planned_operations: Option<Vec<PlannedOperation>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostRollbackRequest {
    snapshot_id: String,
    reason: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostCheckpointRequest {
    snapshot_id: String,
    file: String,
    stage: String,
    task_id: Option<String>,
    operation: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PlannedOperation {
    file: String,
    operation: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct FileCheckpoint {
    checkpoint_id: String,
    stage: String,
    task_id: String,
    operation: String,
    exists: bool,
    size_bytes: u64,
    content_hash: String,
    modified_ms: u128,
    captured_at_ms: u128,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SnapshotEntry {
    path: String,
    backup_name: String,
    existed: bool,
    size_bytes: u64,
    content_hash: String,
    modified_ms: u128,
    #[serde(default)]
    declared: bool,
    #[serde(default)]
    planned_operation: String,
    #[serde(default)]
    checkpoints: Vec<FileCheckpoint>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SnapshotManifest {
    snapshot_id: String,
    action_id: String,
    reason: String,
    created_at_ms: u128,
    entries: Vec<SnapshotEntry>,
}

fn now_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
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

fn hash_file(path: &Path) -> Result<String, String> {
    if !path.exists() {
        return Ok(String::new());
    }
    if path.is_dir() {
        return Ok("directory".to_string());
    }
    let mut file = fs::File::open(path).map_err(|error| {
        format!(
            "Falha ao abrir arquivo para hash {}: {error}",
            path.display()
        )
    })?;
    let mut buffer = [0_u8; 8192];
    let mut hash = 14695981039346656037_u64;
    loop {
        let read = file.read(&mut buffer).map_err(|error| {
            format!("Falha ao ler arquivo para hash {}: {error}", path.display())
        })?;
        if read == 0 {
            break;
        }
        for byte in &buffer[..read] {
            hash ^= u64::from(*byte);
            hash = hash.wrapping_mul(1099511628211);
        }
    }
    Ok(format!("fnv1a64-{hash:016x}"))
}

fn modified_ms(metadata: &fs::Metadata) -> u128 {
    metadata
        .modified()
        .ok()
        .and_then(|modified| modified.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn snapshot_root(app: &tauri::AppHandle, snapshot_id: &str) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Falha ao localizar app data da Alice: {error}"))?;
    Ok(app_data_dir
        .join("autonomous-playground")
        .join("host-snapshots")
        .join(sanitize_path_segment(snapshot_id)))
}

fn manifest_path(snapshot_dir: &Path) -> PathBuf {
    snapshot_dir.join("manifest.json")
}

fn resolve_host_target_path(path: &str) -> Result<PathBuf, String> {
    let raw = PathBuf::from(path);
    let resolved = if raw.is_absolute() {
        raw
    } else {
        alice_project_folder()?.join(raw)
    };
    validate_path_string(&resolved.to_string_lossy())?;
    Ok(resolved)
}

fn read_manifest(snapshot_dir: &Path) -> Result<SnapshotManifest, String> {
    let json = fs::read_to_string(manifest_path(snapshot_dir))
        .map_err(|error| format!("Falha ao ler manifesto de snapshot: {error}"))?;
    serde_json::from_str(&json).map_err(|error| format!("Manifesto de snapshot invalido: {error}"))
}

fn write_manifest(snapshot_dir: &Path, manifest: &SnapshotManifest) -> Result<(), String> {
    fs::write(
        manifest_path(snapshot_dir),
        serde_json::to_string_pretty(manifest)
            .map_err(|error| format!("Falha ao serializar manifesto de snapshot: {error}"))?,
    )
    .map_err(|error| format!("Falha ao gravar manifesto de snapshot: {error}"))
}

fn classify_snapshot_change(
    entry: &SnapshotEntry,
    current_exists: bool,
    current_hash: &str,
) -> &'static str {
    if entry.existed && !current_exists {
        "deleted"
    } else if !entry.existed && current_exists {
        "added"
    } else if entry.content_hash != current_hash {
        "modified"
    } else {
        "unchanged"
    }
}

fn capture_file_checkpoint(
    path: &Path,
    stage: &str,
    task_id: &str,
    operation: &str,
) -> FileCheckpoint {
    let metadata = fs::metadata(path).ok();
    FileCheckpoint {
        checkpoint_id: format!("checkpoint-{}-{}", sanitize_path_segment(stage), now_ms()),
        stage: stage.to_string(),
        task_id: task_id.to_string(),
        operation: operation.to_string(),
        exists: path.exists(),
        size_bytes: metadata
            .as_ref()
            .map(|metadata| metadata.len())
            .unwrap_or(0),
        content_hash: hash_file(path).unwrap_or_else(|_| "unreadable".to_string()),
        modified_ms: metadata.as_ref().map(modified_ms).unwrap_or(0),
        captured_at_ms: now_ms(),
    }
}

fn find_planned_operation(path: &str, operations: &[PlannedOperation]) -> String {
    operations
        .iter()
        .find(|operation| operation.file == path)
        .map(|operation| operation.operation.clone())
        .unwrap_or_default()
}

fn latest_checkpoint<'a>(entry: &'a SnapshotEntry, stage: &str) -> Option<&'a FileCheckpoint> {
    entry
        .checkpoints
        .iter()
        .rev()
        .find(|checkpoint| checkpoint.stage == stage)
}

fn classify_rollback_divergence(
    entry: &SnapshotEntry,
    current_exists: bool,
    current_hash: &str,
) -> &'static str {
    let change_type = classify_snapshot_change(entry, current_exists, current_hash);
    if change_type == "unchanged" {
        return "task_owned_change";
    }
    if !entry.declared {
        return "unexpected_task_change";
    }

    if let Some(before) = latest_checkpoint(entry, "before_controlled_write") {
        if before.exists != entry.existed || before.content_hash != entry.content_hash {
            return "conflict_before_apply";
        }
    }

    if let Some(after) = latest_checkpoint(entry, "after_controlled_write") {
        if after.exists == current_exists && after.content_hash == current_hash {
            return "expected_task_change";
        }

        return "conflict_after_apply_before_rollback";
    }

    if latest_checkpoint(entry, "before_controlled_write").is_some() {
        return "conflict_during_apply";
    }

    "external_or_unknown_change"
}

fn divergence_needs_conflict_backup(classification: &str) -> bool {
    matches!(
        classification,
        "external_or_unknown_change"
            | "external_likely_change"
            | "conflict_before_apply"
            | "conflict_during_apply"
            | "conflict_after_apply_before_rollback"
            | "unexpected_task_change"
    )
}

fn copy_dir_recursive(source: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(target).map_err(|error| {
        format!(
            "Falha ao criar backup de conflito {}: {error}",
            target.display()
        )
    })?;
    for entry in fs::read_dir(source).map_err(|error| {
        format!(
            "Falha ao listar diretorio de conflito {}: {error}",
            source.display()
        )
    })? {
        let entry = entry.map_err(|error| format!("Falha ao ler item de conflito: {error}"))?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        if source_path.is_dir() {
            copy_dir_recursive(&source_path, &target_path)?;
        } else {
            fs::copy(&source_path, &target_path).map_err(|error| {
                format!(
                    "Falha ao copiar arquivo de conflito de {} para {}: {error}",
                    source_path.display(),
                    target_path.display()
                )
            })?;
        }
    }
    Ok(())
}

fn preserve_conflict_backup(
    snapshot_dir: &Path,
    entry: &SnapshotEntry,
    target: &Path,
    classification: &str,
) -> Result<String, String> {
    if !target.exists() {
        return Ok(String::new());
    }

    let conflicts_dir = snapshot_dir.join("conflicts");
    fs::create_dir_all(&conflicts_dir)
        .map_err(|error| format!("Falha ao criar pasta de conflitos: {error}"))?;
    let backup_name = format!(
        "{}-{}",
        sanitize_path_segment(classification),
        sanitize_path_segment(&entry.path)
    );
    let backup_path = conflicts_dir.join(format!("{}-{}", now_ms(), backup_name));

    if target.is_dir() {
        copy_dir_recursive(target, &backup_path)?;
    } else {
        fs::copy(target, &backup_path).map_err(|error| {
            format!(
                "Falha ao preservar backup de conflito de {} para {}: {error}",
                target.display(),
                backup_path.display()
            )
        })?;
    }

    Ok(backup_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_host_file_snapshot(
    app: tauri::AppHandle,
    request: HostSnapshotRequest,
) -> Result<NativeCommandResult, String> {
    if request.files.is_empty() {
        return Err("Snapshot fisico exige pelo menos um arquivo alvo.".to_string());
    }
    let snapshot_id = format!(
        "host-snapshot-{}-{}",
        sanitize_path_segment(&request.action_id),
        now_ms()
    );
    let snapshot_dir = snapshot_root(&app, &snapshot_id)?;
    let files_dir = snapshot_dir.join("files");
    fs::create_dir_all(&files_dir).map_err(|error| {
        format!(
            "Falha ao criar pasta do snapshot fisico em {}: {error}",
            files_dir.display()
        )
    })?;

    let mut entries = Vec::new();
    let declared_files = request
        .declared_files
        .clone()
        .unwrap_or_else(|| request.files.clone());
    let planned_operations = request.planned_operations.clone().unwrap_or_default();
    let task_id = request
        .task_id
        .clone()
        .unwrap_or_else(|| request.action_id.clone());
    for (index, file_path) in request.files.iter().enumerate() {
        let path = resolve_host_target_path(file_path)?;
        let resolved_path = path.to_string_lossy().to_string();
        let existed = path.exists();
        let backup_name = format!("{index:03}-{}", sanitize_path_segment(&resolved_path));
        let backup_path = files_dir.join(&backup_name);
        let (size_bytes, content_hash, modified_at) = if existed {
            if !path.is_file() {
                return Err(format!(
                    "Snapshot fisico aceita apenas arquivos: {}",
                    path.display()
                ));
            }
            let metadata = fs::metadata(&path).map_err(|error| {
                format!("Falha ao ler metadados de {}: {error}", path.display())
            })?;
            fs::copy(&path, &backup_path).map_err(|error| {
                format!(
                    "Falha ao copiar arquivo para snapshot de {} para {}: {error}",
                    path.display(),
                    backup_path.display()
                )
            })?;
            (metadata.len(), hash_file(&path)?, modified_ms(&metadata))
        } else {
            (0, String::new(), 0)
        };

        let planned_operation = {
            let direct = find_planned_operation(file_path, &planned_operations);
            if direct.is_empty() {
                find_planned_operation(&resolved_path, &planned_operations)
            } else {
                direct
            }
        };

        entries.push(SnapshotEntry {
            declared: declared_files
                .iter()
                .any(|file| file == file_path || file == &resolved_path),
            planned_operation,
            checkpoints: vec![capture_file_checkpoint(
                &path,
                "before_task",
                &task_id,
                "snapshot_baseline",
            )],
            path: resolved_path,
            backup_name,
            existed,
            size_bytes,
            content_hash,
            modified_ms: modified_at,
        });
    }

    let manifest = SnapshotManifest {
        snapshot_id: snapshot_id.clone(),
        action_id: request.action_id,
        reason: request
            .reason
            .unwrap_or_else(|| "host_snapshot".to_string()),
        created_at_ms: now_ms(),
        entries,
    };
    write_manifest(&snapshot_dir, &manifest)?;

    Ok(NativeCommandResult {
        ok: true,
        message: "Snapshot fisico do PC real criado.".to_string(),
        stdout: None,
        stderr: None,
        artifacts: Some(json!({
            "snapshotId": snapshot_id,
            "snapshotPath": snapshot_dir.to_string_lossy(),
            "manifest": manifest,
        })),
    })
}

#[tauri::command]
pub fn diff_host_file_snapshot(
    app: tauri::AppHandle,
    request: HostRollbackRequest,
) -> Result<NativeCommandResult, String> {
    let snapshot_dir = snapshot_root(&app, &request.snapshot_id)?;
    let manifest = read_manifest(&snapshot_dir)?;
    let diff: Vec<_> = manifest
        .entries
        .iter()
        .map(|entry| {
            let path = PathBuf::from(&entry.path);
            let current_hash = hash_file(&path).unwrap_or_else(|_| "unreadable".to_string());
            let current_exists = path.exists();
            let change_type = classify_snapshot_change(entry, current_exists, &current_hash);
            let divergence_classification =
                classify_rollback_divergence(entry, current_exists, &current_hash);
            json!({
                "path": entry.path,
                "changeType": change_type,
                "divergenceClassification": divergence_classification,
                "declared": entry.declared,
                "plannedOperation": entry.planned_operation,
                "beforeHash": entry.content_hash,
                "afterHash": current_hash,
                "checkpoints": entry.checkpoints,
            })
        })
        .collect();

    Ok(NativeCommandResult {
        ok: true,
        message: "Diff fisico do snapshot calculado.".to_string(),
        stdout: None,
        stderr: None,
        artifacts: Some(json!({
            "snapshotId": request.snapshot_id,
            "diff": diff,
        })),
    })
}

#[tauri::command]
pub fn record_host_file_checkpoint(
    app: tauri::AppHandle,
    request: HostCheckpointRequest,
) -> Result<NativeCommandResult, String> {
    let snapshot_dir = snapshot_root(&app, &request.snapshot_id)?;
    let mut manifest = read_manifest(&snapshot_dir)?;
    let target = resolve_host_target_path(&request.file)?;
    let resolved_path = target.to_string_lossy().to_string();
    let checkpoint = capture_file_checkpoint(
        &target,
        &request.stage,
        request.task_id.as_deref().unwrap_or(&manifest.action_id),
        request
            .operation
            .as_deref()
            .unwrap_or("controlled_write_checkpoint"),
    );
    let mut found = false;

    for entry in &mut manifest.entries {
        if entry.path == resolved_path || entry.path == request.file {
            entry.checkpoints.push(checkpoint.clone());
            found = true;
            break;
        }
    }

    if !found {
        return Err(format!(
            "Checkpoint recusado: arquivo {} nao pertence ao snapshot {}.",
            request.file, request.snapshot_id
        ));
    }

    write_manifest(&snapshot_dir, &manifest)?;

    Ok(NativeCommandResult {
        ok: true,
        message: "Checkpoint fisico registrado para o rollback.".to_string(),
        stdout: None,
        stderr: None,
        artifacts: Some(json!({
            "snapshotId": request.snapshot_id,
            "file": resolved_path,
            "checkpoint": checkpoint,
        })),
    })
}

#[tauri::command]
pub fn restore_host_file_snapshot(
    app: tauri::AppHandle,
    request: HostRollbackRequest,
) -> Result<NativeCommandResult, String> {
    let snapshot_dir = snapshot_root(&app, &request.snapshot_id)?;
    let files_dir = snapshot_dir.join("files");
    let manifest = read_manifest(&snapshot_dir)?;
    let mut restored = Vec::new();
    let mut failed = Vec::new();
    let mut conflict_backups = Vec::new();

    for entry in &manifest.entries {
        let target = PathBuf::from(&entry.path);
        let current_hash_before = hash_file(&target).unwrap_or_else(|_| "unreadable".to_string());
        let current_exists_before = target.exists();
        let change_before_rollback =
            classify_snapshot_change(entry, current_exists_before, &current_hash_before);
        let divergence_classification =
            classify_rollback_divergence(entry, current_exists_before, &current_hash_before);
        let conflict_backup = if divergence_needs_conflict_backup(divergence_classification) {
            match preserve_conflict_backup(&snapshot_dir, entry, &target, divergence_classification)
            {
                Ok(path) => {
                    if !path.is_empty() {
                        conflict_backups.push(json!({
                            "path": entry.path,
                            "backupPath": path,
                            "classification": divergence_classification,
                        }));
                    }
                    Some(path)
                }
                Err(error) => {
                    failed.push(json!({
                        "path": entry.path,
                        "error": error,
                        "stage": "conflict_backup",
                        "classification": divergence_classification,
                    }));
                    None
                }
            }
        } else {
            None
        };
        let result = if entry.existed {
            let backup = files_dir.join(&entry.backup_name);
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    format!(
                        "Falha ao recriar pasta de rollback {}: {error}",
                        parent.display()
                    )
                })?;
            }
            fs::copy(&backup, &target)
                .map(|_| ())
                .map_err(|error| format!("Falha ao restaurar {}: {error}", target.display()))
        } else if target.is_dir() {
            fs::remove_dir_all(&target).map_err(|error| {
                format!(
                    "Falha ao remover diretorio criado {}: {error}",
                    target.display()
                )
            })
        } else if target.exists() {
            fs::remove_file(&target).map_err(|error| {
                format!(
                    "Falha ao remover arquivo criado {}: {error}",
                    target.display()
                )
            })
        } else {
            Ok(())
        };

        match result {
            Ok(()) => {
                let current_hash = hash_file(&target).unwrap_or_default();
                restored.push(json!({
                    "path": entry.path,
                    "changeBeforeRollback": change_before_rollback,
                    "divergenceClassification": divergence_classification,
                    "externalChangeDetected": divergence_needs_conflict_backup(divergence_classification),
                    "conflictRequiresReview": divergence_needs_conflict_backup(divergence_classification),
                    "conflictBackupPath": conflict_backup.unwrap_or_default(),
                    "declared": entry.declared,
                    "plannedOperation": entry.planned_operation,
                    "expectedHash": entry.content_hash,
                    "currentHash": current_hash,
                    "verified": current_hash == entry.content_hash,
                    "checkpoints": entry.checkpoints,
                }));
            }
            Err(error) => failed.push(json!({
                "path": entry.path,
                "error": error,
                "divergenceClassification": divergence_classification,
            })),
        }
    }

    Ok(NativeCommandResult {
        ok: failed.is_empty(),
        message: if failed.is_empty() {
            "Rollback fisico restaurou os arquivos do PC real.".to_string()
        } else {
            "Rollback fisico terminou com falhas parciais.".to_string()
        },
        stdout: None,
        stderr: None,
        artifacts: Some(json!({
            "rollbackId": format!("rollback-{}-{}", request.snapshot_id, now_ms()),
            "snapshotId": request.snapshot_id,
            "reason": request.reason.unwrap_or_else(|| "rollback_requested".to_string()),
            "restored": restored,
            "failed": failed,
            "conflictBackups": conflict_backups,
            "hasExternalOrUnknownChanges": !conflict_backups.is_empty(),
            "partial": !failed.is_empty(),
        })),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_snapshot_id_removes_unsafe_chars() {
        assert_eq!(sanitize_path_segment("a/b:c"), "a-b-c");
    }

    #[test]
    fn hash_missing_file_is_empty() {
        let missing = std::env::temp_dir().join("alice-missing-hash-file");
        assert_eq!(hash_file(&missing).unwrap(), "");
    }

    #[test]
    fn relative_snapshot_paths_resolve_inside_project() {
        let resolved = resolve_host_target_path("src/App.jsx").unwrap();

        assert!(resolved.ends_with("src\\App.jsx") || resolved.ends_with("src/App.jsx"));
    }

    #[test]
    fn classify_snapshot_change_covers_added_modified_and_deleted() {
        let existing = SnapshotEntry {
            path: "file.txt".to_string(),
            backup_name: "file.txt".to_string(),
            existed: true,
            size_bytes: 1,
            content_hash: "hash-a".to_string(),
            modified_ms: 1,
            declared: true,
            planned_operation: "modify".to_string(),
            checkpoints: vec![],
        };
        let missing = SnapshotEntry {
            existed: false,
            content_hash: String::new(),
            ..existing.clone()
        };

        assert_eq!(classify_snapshot_change(&existing, false, ""), "deleted");
        assert_eq!(classify_snapshot_change(&missing, true, "hash-b"), "added");
        assert_eq!(
            classify_snapshot_change(&existing, true, "hash-b"),
            "modified"
        );
        assert_eq!(
            classify_snapshot_change(&existing, true, "hash-a"),
            "unchanged"
        );
    }

    #[test]
    fn rollback_divergence_uses_checkpoints_for_external_conflicts() {
        let mut entry = SnapshotEntry {
            path: "file.txt".to_string(),
            backup_name: "file.txt".to_string(),
            existed: true,
            size_bytes: 1,
            content_hash: "hash-a".to_string(),
            modified_ms: 1,
            declared: true,
            planned_operation: "modify".to_string(),
            checkpoints: vec![],
        };

        assert_eq!(
            classify_rollback_divergence(&entry, true, "hash-b"),
            "external_or_unknown_change"
        );

        entry.checkpoints.push(FileCheckpoint {
            checkpoint_id: "checkpoint-after".to_string(),
            stage: "after_controlled_write".to_string(),
            task_id: "task-1".to_string(),
            operation: "modify".to_string(),
            exists: true,
            size_bytes: 2,
            content_hash: "hash-b".to_string(),
            modified_ms: 2,
            captured_at_ms: 2,
        });

        assert_eq!(
            classify_rollback_divergence(&entry, true, "hash-b"),
            "expected_task_change"
        );
        assert_eq!(
            classify_rollback_divergence(&entry, true, "hash-c"),
            "conflict_after_apply_before_rollback"
        );
    }
}
