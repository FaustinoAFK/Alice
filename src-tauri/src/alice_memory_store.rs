use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};

const MAX_MEMORY_JSON_BYTES: usize = 52_428_800;
const ALICE_MEMORY_FILE_NAME: &str = "alice-memory.json";
const ALICE_MEMORY_BACKUP_COUNT: usize = 3;

pub(crate) fn validate_memory_json_payload(json: &str) -> Result<(), String> {
    let trimmed = json.trim();
    if trimmed.is_empty() {
        return Err("Memoria da Alice nao pode ser vazia.".to_string());
    }

    if trimmed.len() > MAX_MEMORY_JSON_BYTES {
        return Err(format!(
            "Memoria da Alice excede o limite de {} bytes.",
            MAX_MEMORY_JSON_BYTES
        ));
    }

    Ok(())
}

pub(crate) fn resolve_alice_memory_path(base_dir: &Path) -> PathBuf {
    base_dir.join(ALICE_MEMORY_FILE_NAME)
}

pub(crate) fn resolve_alice_memory_backup_path(path: &Path, index: usize) -> PathBuf {
    path.with_file_name(format!("alice-memory.backup-{index}.json"))
}

fn read_memory_backup_json(path: &Path) -> Result<Option<String>, String> {
    for index in 1..=ALICE_MEMORY_BACKUP_COUNT {
        let backup_path = resolve_alice_memory_backup_path(path, index);
        match fs::read_to_string(&backup_path) {
            Ok(json) => return Ok(Some(json)),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                return Err(format!(
                    "Falha ao ler backup da memoria local da Alice em {}: {error}",
                    backup_path.display()
                ));
            }
        }
    }

    Ok(None)
}

pub(crate) fn read_memory_json(path: &Path) -> Result<Option<String>, String> {
    match fs::read_to_string(path) {
        Ok(json) => Ok(Some(json)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => read_memory_backup_json(path),
        Err(error) => Err(format!(
            "Falha ao ler a memoria local da Alice em {}: {error}",
            path.display()
        )),
    }
}

fn rotate_memory_backups(path: &Path) -> Result<(), String> {
    let oldest_backup = resolve_alice_memory_backup_path(path, ALICE_MEMORY_BACKUP_COUNT);
    if oldest_backup.exists() {
        fs::remove_file(&oldest_backup).map_err(|error| {
            format!(
                "Falha ao remover backup antigo da memoria local da Alice em {}: {error}",
                oldest_backup.display()
            )
        })?;
    }

    for index in (1..ALICE_MEMORY_BACKUP_COUNT).rev() {
        let from = resolve_alice_memory_backup_path(path, index);
        let to = resolve_alice_memory_backup_path(path, index + 1);
        if from.exists() {
            fs::rename(&from, &to).map_err(|error| {
                format!(
                    "Falha ao rotacionar backup da memoria local da Alice de {} para {}: {error}",
                    from.display(),
                    to.display()
                )
            })?;
        }
    }

    Ok(())
}

fn preserve_current_memory_backup(path: &Path) -> Result<Option<PathBuf>, String> {
    if !path.exists() {
        return Ok(None);
    }

    rotate_memory_backups(path)?;
    let backup_path = resolve_alice_memory_backup_path(path, 1);
    fs::copy(path, &backup_path).map_err(|error| {
        format!(
            "Falha ao criar backup da memoria local da Alice em {}: {error}",
            backup_path.display()
        )
    })?;

    Ok(Some(backup_path))
}

pub(crate) fn write_memory_json_atomic(path: &Path, json: &str) -> Result<(), String> {
    validate_memory_json_payload(json)?;

    let parent_dir = path.parent().ok_or_else(|| {
        format!(
            "Nao consegui resolver a pasta da memoria local da Alice em {}.",
            path.display()
        )
    })?;
    fs::create_dir_all(parent_dir).map_err(|error| {
        format!(
            "Falha ao criar a pasta da memoria local da Alice em {}: {error}",
            parent_dir.display()
        )
    })?;

    let temp_path = path.with_extension("json.tmp");
    let mut temp_file = File::create(&temp_path).map_err(|error| {
        format!(
            "Falha ao criar arquivo temporario da memoria local da Alice em {}: {error}",
            temp_path.display()
        )
    })?;
    temp_file.write_all(json.as_bytes()).map_err(|error| {
        format!(
            "Falha ao gravar o arquivo temporario da memoria local da Alice em {}: {error}",
            temp_path.display()
        )
    })?;
    temp_file.sync_all().map_err(|error| {
        format!(
            "Falha ao sincronizar o arquivo temporario da memoria local da Alice em {}: {error}",
            temp_path.display()
        )
    })?;
    drop(temp_file);

    let last_good_backup = preserve_current_memory_backup(path)?;

    if path.exists() {
        fs::remove_file(path).map_err(|error| {
            format!(
                "Falha ao substituir a memoria local da Alice em {}: {error}",
                path.display()
            )
        })?;
    }

    fs::rename(&temp_path, path).map_err(|error| {
        if let Some(backup_path) = &last_good_backup {
            let _ = fs::copy(backup_path, path);
        }
        let _ = fs::remove_file(&temp_path);
        format!(
            "Falha ao concluir a gravacao atomica da memoria local da Alice em {}: {error}",
            path.display()
        )
    })?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_memory_json_payload_rejects_empty_payload() {
        assert!(validate_memory_json_payload("   ").is_err());
    }

    #[test]
    fn resolve_alice_memory_path_appends_expected_file_name() {
        let path = resolve_alice_memory_path(std::path::Path::new("C:\\temp\\alice"));

        assert_eq!(
            path,
            std::path::PathBuf::from("C:\\temp\\alice\\alice-memory.json")
        );
    }

    #[test]
    fn read_memory_json_returns_none_for_missing_file() {
        let base_dir = std::env::temp_dir().join(format!(
            "alice-memory-test-missing-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let memory_path = resolve_alice_memory_path(&base_dir);

        assert_eq!(read_memory_json(&memory_path), Ok(None));
    }

    #[test]
    fn write_memory_json_atomic_creates_and_replaces_file_contents() {
        let base_dir = std::env::temp_dir().join(format!(
            "alice-memory-test-write-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let memory_path = resolve_alice_memory_path(&base_dir);

        write_memory_json_atomic(&memory_path, "{\"ok\":true}").unwrap();
        assert_eq!(
            read_memory_json(&memory_path),
            Ok(Some("{\"ok\":true}".to_string()))
        );

        write_memory_json_atomic(&memory_path, "{\"ok\":false}").unwrap();
        assert_eq!(
            read_memory_json(&memory_path),
            Ok(Some("{\"ok\":false}".to_string()))
        );
        assert_eq!(
            fs::read_to_string(resolve_alice_memory_backup_path(&memory_path, 1)).unwrap(),
            "{\"ok\":true}".to_string()
        );

        write_memory_json_atomic(&memory_path, "{\"ok\":\"latest\"}").unwrap();
        assert_eq!(
            fs::read_to_string(resolve_alice_memory_backup_path(&memory_path, 1)).unwrap(),
            "{\"ok\":false}".to_string()
        );
        assert_eq!(
            fs::read_to_string(resolve_alice_memory_backup_path(&memory_path, 2)).unwrap(),
            "{\"ok\":true}".to_string()
        );

        let _ = fs::remove_dir_all(&base_dir);
    }

    #[test]
    fn read_memory_json_falls_back_to_latest_backup_when_primary_is_missing() {
        let base_dir = std::env::temp_dir().join(format!(
            "alice-memory-test-backup-read-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&base_dir).unwrap();
        let memory_path = resolve_alice_memory_path(&base_dir);
        fs::write(
            resolve_alice_memory_backup_path(&memory_path, 1),
            "{\"backup\":true}",
        )
        .unwrap();

        assert_eq!(
            read_memory_json(&memory_path),
            Ok(Some("{\"backup\":true}".to_string()))
        );

        let _ = fs::remove_dir_all(&base_dir);
    }
}
