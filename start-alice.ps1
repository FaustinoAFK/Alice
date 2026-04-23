$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

Write-Host "Iniciando Alice Virtual como aplicativo desktop."
Write-Host "Deixe esta janela aberta. Ao salvar arquivos, a janela da Alice atualiza sozinha."

npm run app
