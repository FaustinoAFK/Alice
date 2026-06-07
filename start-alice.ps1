param(
  [string]$LogPath = ""
)

$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

Write-Host "Iniciando Alice Virtual como aplicativo desktop."
Write-Host "Deixe esta janela aberta. Ao salvar arquivos, a janela da Alice atualiza sozinha."

$env:NO_COLOR = "1"
$env:FORCE_COLOR = "0"
$env:CARGO_TERM_COLOR = "never"
$env:CLICOLOR = "0"

if (-not [string]::IsNullOrWhiteSpace($LogPath)) {
  $resolvedLogPath = $LogPath
  if (-not [System.IO.Path]::IsPathRooted($resolvedLogPath)) {
    $resolvedLogPath = Join-Path $PSScriptRoot $resolvedLogPath
  }
  $resolvedLogPath = [System.IO.Path]::GetFullPath($resolvedLogPath)
  $stderrPath = "$resolvedLogPath.stderr"
  New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($resolvedLogPath)) | Out-Null
  Remove-Item -LiteralPath $resolvedLogPath, $stderrPath -Force -ErrorAction SilentlyContinue
  Write-Host "Log limpo em: $resolvedLogPath"
  $process = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList @("run", "app") `
    -WorkingDirectory $PSScriptRoot `
    -NoNewWindow `
    -Wait `
    -PassThru `
    -RedirectStandardOutput $resolvedLogPath `
    -RedirectStandardError $stderrPath
  if (Test-Path -LiteralPath $stderrPath) {
    Add-Content -LiteralPath $resolvedLogPath -Value "`n--- stderr ---"
    Get-Content -LiteralPath $stderrPath | Add-Content -LiteralPath $resolvedLogPath
    Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
  }
  exit $process.ExitCode
}

npm.cmd run app
exit $LASTEXITCODE
