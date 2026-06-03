# Alice Virtual

Aplicativo desktop pessoal da Alice, com foco em conversa por voz, tela compartilhada, memoria local, conhecimento web e mapa mental.

## Rodar

```powershell
cd C:\projetos\alice-virtual
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-alice.ps1
```

O app usa Tauri. No Windows, rode a partir do **Developer PowerShell for VS 2022** quando precisar compilar o app desktop.

## Variavel de ambiente

A chave da Gemini deve ficar fora do codigo:

```powershell
$env:GEMINI_API_KEY = "sua_chave"
```

Tambem e aceito:

```powershell
$env:GOOGLE_API_KEY = "sua_chave"
```

## O que esta ativo

- sessao Gemini Live com voz e tela;
- memoria local da Alice;
- ferramentas web para pagina atual, busca e leitura;
- mapa mental persistente no HUD;
- diagnostico basico do app;
- snapshots/checkpoints do host para fluxos de seguranca;
- propostas de auto-melhoria, sempre dependentes de aprovacao.

## O que foi removido desta versao

- VM local;
- VirtualBox/Hyper-V;
- Guest Interaction Agent;
- runner autonomo;
- aprendizado autonomo;
- planner de aprendizado;
- paginas HUD de Autonomia, Aprendizado e Runner;
- ferramentas Live relacionadas a VM, runner e aprendizado.
