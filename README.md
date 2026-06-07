# Alice Virtual

Aplicativo desktop pessoal da Alice com Gemini Live API, conversa por voz,
tela compartilhada, memoria local, mapa mental editavel no HUD e leitura de
paginas web via extensao do Edge.

O projeto e pessoal/local. Ele nao e preparado como produto publico e nao deve
ganhar superficie automatica ampla sem necessidade real.

## Escopo ativo

- Voz ao vivo pela Gemini Live API.
- Tela compartilhada enviada ao Live em baixa frequencia.
- HUD com paginas `Ao vivo`, `Conhecimento`, `Mapa` e `Debug`.
- Memoria local persistente em arquivo da aplicacao.
- Mapa mental editavel manualmente no HUD.
- Extensao Edge/Chrome MV3 para capturar contexto da aba ativa.
- Bridge local em `127.0.0.1:38947` para receber contexto do navegador.
- Pipeline interno de conhecimento para inspecionar pagina atual e, quando
  necessario, buscar/fazer fetch de paginas pelo backend.

## Tools Live expostas ao modelo

O Gemini Live deve receber somente estas function declarations:

- `get_navigation_context`
- `inspect_current_page`

Busca web ampla, fetch direto de URL, busca no mesmo dominio, edicao automatica
do mapa mental, comandos de host safety e comandos desktop nao sao tools Live
expostas nesta versao.

## Removido do runtime ativo

Estas camadas foram retiradas e nao devem voltar sem pedido explicito:

- VM local, VirtualBox/Hyper-V e variaveis `ALICE_LOCAL_VM_*`.
- Guest Agent Python de VM.
- Autonomous Runner.
- Aprendizado autonomo operacional.
- Learning planner/harnesses.
- Workspace fallback.
- Auto-melhoria automatizada.
- Edicao do mapa mental por tool call do modelo.

Testes podem citar esses nomes apenas como verificacao negativa para impedir
reintroducao acidental.

## Como funciona

- `src/App.jsx`: orquestra sessao Live, captura de midia, memoria, HUD e tool
  calls permitidas.
- `src/appLiveHelpers.js`: helpers de audio, microfone, PCM e debug Live.
- `src/alice.js`: monta o setup Gemini Live, modelo e tools ativas.
- `src/prompts/aliceSystemInstruction.js`: comportamento principal da Alice.
- `src/geminiLive.js`: WebSocket da Gemini Live API.
- `src/liveSessionOrchestrator.js`: ciclo de vida, retomada e reconexao.
- `src/screenFrameStreaming.js`: captura frames da tela para o Live.
- `src/knowledgePipeline.js`: fluxo interno de conhecimento web.
- `src/knowledgeToolExecutor.js`: executa apenas tools de conhecimento.
- `src/aliceMemory.js`: schema e normalizacao da memoria local.
- `src-tauri/src/alice_memory_store.rs`: leitura, escrita atomica e backups da
  memoria.
- `src-tauri/src/gemini_live_access.rs`: cria a URL do Gemini Live a partir do
  ambiente.
- `src-tauri/src/web_knowledge.rs`: bridge local da extensao, snapshots da
  pagina e comandos internos de busca/fetch.
- `src-tauri/src/web_knowledge_matcher.rs`: selecao de secoes, links e
  suficiencia do contexto da pagina.
- `src-tauri/src/host_versioning.rs`: snapshot, diff, checkpoint e rollback
  nativos. Existe no backend, mas nao e tool Live exposta ao modelo.
- `edge-extension/`: extensao MV3 do Edge/Chrome.

A chave da Gemini nao fica no codigo. O Tauri usa `GEMINI_API_KEY` ou
`GOOGLE_API_KEY` do ambiente.

## Rodar

```powershell
npm install
.\start-alice.ps1
```

Na janela da Alice, clique em `Iniciar`, escolha a tela ou janela para
compartilhar e permita o microfone.

Se a variavel `GEMINI_API_KEY` foi criada agora, reinicie o terminal ou o VS Code
antes de abrir o app.

## Extensao Edge

1. Abra `edge://extensions`.
2. Ative o modo de desenvolvedor.
3. Clique em `Carregar sem compactacao`.
4. Selecione a pasta `edge-extension`.
5. Deixe a Alice aberta para a extensao enviar contexto para
   `127.0.0.1:38947`.

Teste rapido do bridge:

```powershell
Invoke-WebRequest http://127.0.0.1:38947/health -UseBasicParsing
```

## Validar

```powershell
npm run lint
npm test
npm run build
```

Para backend Rust:

```powershell
cd src-tauri
cargo test
```

Para gerar executavel sem instalador:

```powershell
npm run app:build -- --no-bundle
```
