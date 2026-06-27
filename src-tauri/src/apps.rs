use serde_json::Value;
use std::process::Command;

use crate::{open_app, MAX_SHELL_OUTPUT_CHARS};

pub(crate) fn run_powershell(script: &str, envs: &[(&str, &str)]) -> Result<std::process::Output, String> {
    let mut command = Command::new("powershell.exe");
    command.args([
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
    ]);

    for (key, value) in envs {
        command.env(key, value);
    }

    command
        .output()
        .map_err(|error| format!("Falha ao executar PowerShell: {error}"))
}

pub(crate) fn ensure_successful_output(
    output: std::process::Output,
    fallback_message: &str,
) -> Result<String, String> {
    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        return Ok(if stdout.is_empty() {
            fallback_message.to_string()
        } else {
            stdout
        });
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if stderr.is_empty() {
        fallback_message.to_string()
    } else {
        stderr
    })
}

pub(crate) fn open_app_generic(app: &str) -> Result<String, String> {
    match app.trim().to_lowercase().as_str() {
        "notepad" | "bloco de notas" => open_app("notepad"),
        "calculator" | "calculadora" => open_app("calculator"),
        "browser" | "navegador" => open_app("browser"),
        "file_explorer" | "explorador" | "explorer" => open_app("file_explorer"),
        _ => {
            let output = run_powershell(
                "Start-Process -FilePath $env:ALICE_APP_NAME; Write-Output 'Aplicativo aberto.'",
                &[("ALICE_APP_NAME", app)],
            )?;
            ensure_successful_output(output, "Aplicativo aberto.")
        }
    }
}

pub(crate) fn focus_app_window(app: &str) -> Result<String, String> {
    let output = run_powershell(
        "$wshell = New-Object -ComObject WScript.Shell; if ($wshell.AppActivate($env:ALICE_FOCUS_TARGET)) { Write-Output 'Janela focada.' } else { throw 'Nao encontrei a janela.' }",
        &[("ALICE_FOCUS_TARGET", app)],
    )?;
    ensure_successful_output(output, "Janela focada.")
}

pub(crate) fn close_app_patterns(app: &str) -> Vec<String> {
    match app.trim().to_lowercase().as_str() {
        "browser" | "navegador" => vec![
            "*chrome*".to_string(),
            "*google chrome*".to_string(),
            "*msedge*".to_string(),
            "*microsoft edge*".to_string(),
            "*firefox*".to_string(),
            "*mozilla firefox*".to_string(),
            "*brave*".to_string(),
            "*opera*".to_string(),
            "*browser*".to_string(),
            "*navegador*".to_string(),
        ],
        "file_explorer" | "explorador" | "explorer" => {
            vec!["*explorer*".to_string(), "*explorador*".to_string()]
        }
        "notepad" | "bloco de notas" => {
            vec!["*notepad*".to_string(), "*bloco de notas*".to_string()]
        }
        "calculator" | "calculadora" => {
            vec![
                "*calc*".to_string(),
                "*calculator*".to_string(),
                "*calculadora*".to_string(),
            ]
        }
        other => vec![format!("*{other}*")],
    }
}

pub(crate) const CLOSE_APP_SCRIPT: &str = r#"
$patterns = ($env:ALICE_CLOSE_PATTERNS -split '\|') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
$matchesPattern = {
  param($value)
  foreach ($pattern in $patterns) {
    if ($value -like $pattern) {
      return $true
    }
  }
  return $false
}

$targets = Get-Process | Where-Object {
  (
    (& $matchesPattern $_.ProcessName) -or
    (& $matchesPattern $_.MainWindowTitle)
  ) -and $_.MainWindowHandle -ne 0
}
if (-not $targets) { throw 'Nao encontrei a janela do app.' }

$wshell = New-Object -ComObject WScript.Shell
$attempted = 0

foreach ($target in $targets) {
  $closed = $false
  try {
    $closed = $target.CloseMainWindow()
  } catch {
    $closed = $false
  }

  if (-not $closed) {
    try {
      if ($wshell.AppActivate($target.Id)) {
        Start-Sleep -Milliseconds 150
        $wshell.SendKeys('%{F4}')
        $closed = $true
      }
    } catch {
      $closed = $false
    }
  }

  if ($closed) {
    $attempted += 1
  }
}

if ($attempted -le 0) {
  throw 'O app foi localizado, mas nao aceitou o fechamento.'
}

Write-Output ('Solicitacao de fechamento enviada para ' + $attempted + ' janela(s).')
"#;

pub(crate) fn close_app_window(app: &str) -> Result<String, String> {
    let patterns = close_app_patterns(app).join("|");
    let output = run_powershell(CLOSE_APP_SCRIPT, &[("ALICE_CLOSE_PATTERNS", &patterns)])?;
    ensure_successful_output(output, "Solicitacao de fechamento enviada.")
}

pub(crate) fn kill_process_checked(process_name: &str) -> Result<String, String> {
    let normalized_name = process_name.trim().trim_end_matches(".exe").to_lowercase();
    let critical = [
        "system",
        "registry",
        "smss",
        "csrss",
        "wininit",
        "services",
        "lsass",
        "winlogon",
        "dwm",
        "explorer",
        "svchost",
        "powershell",
        "cmd",
    ];

    if critical.contains(&normalized_name.as_str()) {
        return Err(format!(
            "Processo critico nao pode ser encerrado: {process_name}"
        ));
    }

    let output = run_powershell(
        "Stop-Process -Name $env:ALICE_PROCESS_NAME -Force; Write-Output 'Processo encerrado.'",
        &[("ALICE_PROCESS_NAME", &normalized_name)],
    )?;
    ensure_successful_output(output, "Processo encerrado.")
}

pub(crate) fn list_windows_json() -> Result<Value, String> {
    let output = run_powershell(
        "Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object ProcessName,Id,MainWindowTitle | ConvertTo-Json -Compress",
        &[],
    )?;
    let text = ensure_successful_output(output, "[]")?;
    serde_json::from_str(&text)
        .map_err(|error| format!("Falha ao interpretar lista de janelas: {error}"))
}

pub(crate) fn list_processes_json() -> Result<Value, String> {
    let output = run_powershell(
        "Get-Process | Select-Object ProcessName,Id,MainWindowTitle | ConvertTo-Json -Compress",
        &[],
    )?;
    let text = ensure_successful_output(output, "[]")?;
    serde_json::from_str(&text)
        .map_err(|error| format!("Falha ao interpretar lista de processos: {error}"))
}

pub(crate) fn truncate_shell_output(text: &str) -> String {
    let truncated: String = text.chars().take(MAX_SHELL_OUTPUT_CHARS).collect();
    truncated
}
