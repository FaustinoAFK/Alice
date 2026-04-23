# Alice Virtual

Aplicativo desktop da Alice usando Gemini Live API para conversa por voz com contexto visual da tela compartilhada.

## Como funciona

- `src/App.jsx`: interface desktop sem chat/HUD, com botao para iniciar/parar a sessao Live.
- `src/geminiLive.js`: WebSocket da Gemini Live API com audio e frames de tela em `realtimeInput`.
- `src/liveAudio.js`: conversao do microfone para PCM16 base64 em 16 kHz e reproducao do audio PCM recebido.
- `src/alice.js`: personalidade e configuracao da Alice para a sessao Live.
- `src-tauri`: comando local que le `GEMINI_API_KEY` ou `GOOGLE_API_KEY` do ambiente e monta a URL segura do WebSocket.

A chave da Gemini nao aparece na interface. O Tauri usa a variavel de ambiente para montar a conexao local com a Gemini Live API.

## Rodar

```powershell
npm install
.\start-alice.ps1
```

Na janela da Alice, clique em `Iniciar`, escolha a tela ou janela para compartilhar e permita o microfone. Para parar, clique em `Parar`.

Se a variavel `GEMINI_API_KEY` foi criada agora, reinicie o VS Code ou o terminal antes de abrir o app.

## Validar

```powershell
npm run test
npm run lint
npm run build

cd src-tauri
cargo test
```

Para gerar executavel sem instalador:

```powershell
npm run app:build -- --no-bundle
```
