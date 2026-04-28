$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

function Get-AliceEnvValue {
  param([Parameter(Mandatory = $true)][string]$Name)

  $value = [Environment]::GetEnvironmentVariable($Name, "Process")
  if ([string]::IsNullOrWhiteSpace($value)) {
    $value = [Environment]::GetEnvironmentVariable($Name, "User")
  }
  if ([string]::IsNullOrWhiteSpace($value)) {
    $value = [Environment]::GetEnvironmentVariable($Name, "Machine")
  }
  return $value
}

function Set-AliceProcessEnv {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [AllowNull()][string]$Value
  )

  if (-not [string]::IsNullOrWhiteSpace($Value)) {
    [Environment]::SetEnvironmentVariable($Name, $Value, "Process")
  }
}

$aliceEnvNames = @(
  "ALICE_LOCAL_VM_PROVIDER",
  "ALICE_LOCAL_VM_NAME",
  "ALICE_LOCAL_VM_ENABLE_GUEST_RUN",
  "ALICE_LOCAL_VM_USER",
  "ALICE_LOCAL_VM_USERNAME",
  "ALICE_LOCAL_VM_PASSWORD",
  "ALICE_VBOXMANAGE_PATH",
  "ALICE_VM_GUEST_PYTHON",
  "ALICE_VM_GUEST_AGENT_DIR"
)

foreach ($name in $aliceEnvNames) {
  Set-AliceProcessEnv -Name $name -Value (Get-AliceEnvValue -Name $name)
}

$vmUser = Get-AliceEnvValue -Name "ALICE_LOCAL_VM_USER"
$vmUsername = Get-AliceEnvValue -Name "ALICE_LOCAL_VM_USERNAME"
if ([string]::IsNullOrWhiteSpace($vmUser) -and -not [string]::IsNullOrWhiteSpace($vmUsername)) {
  Set-AliceProcessEnv -Name "ALICE_LOCAL_VM_USER" -Value $vmUsername
}
if ([string]::IsNullOrWhiteSpace($vmUsername) -and -not [string]::IsNullOrWhiteSpace($vmUser)) {
  Set-AliceProcessEnv -Name "ALICE_LOCAL_VM_USERNAME" -Value $vmUser
}

$vboxPath = Get-AliceEnvValue -Name "ALICE_VBOXMANAGE_PATH"
if ([string]::IsNullOrWhiteSpace($vboxPath)) {
  $defaultVBoxPath = "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"
  if (Test-Path -LiteralPath $defaultVBoxPath) {
    Set-AliceProcessEnv -Name "ALICE_VBOXMANAGE_PATH" -Value $defaultVBoxPath
  }
}

Write-Host "Iniciando Alice Virtual como aplicativo desktop."
Write-Host "Deixe esta janela aberta. Ao salvar arquivos, a janela da Alice atualiza sozinha."
Write-Host "VM local: provider=$env:ALICE_LOCAL_VM_PROVIDER name=$env:ALICE_LOCAL_VM_NAME guest_run=$env:ALICE_LOCAL_VM_ENABLE_GUEST_RUN user=$env:ALICE_LOCAL_VM_USER"

npm run app
