

# CLAUDE.md — Alice Virtual

Assistente desktop pessoal com Gemini Live API, voz, tela compartilhada,
memória local, mapa mental editável e leitura de páginas via extensão Edge.

**Projeto pessoal/local. Não é produto público.**

---

## Stack

- **Frontend:** React 18, Vite, JSX, CSS modules
- **Backend nativo:** Tauri 2 (Rust)
- **IA:** Gemini Live API via WebSocket
- **Extensão:** Edge/Chrome MV3
- **Sidecar:** Python (`src-tauri/python_sidecar/`)
- **Testes:** Vitest (JS) + cargo test (Rust)

---

## Arquitetura — visão geral

```
alice-virtual/
├── src/                        # Frontend React
│   ├── App.jsx                 # Orquestrador principal (sessão Live, HUD, tools)
│   ├── alice.js                # Setup Gemini Live, modelo e tools ativas
│   ├── aliceMemory.js          # Schema e normalização da memória local
│   ├── aliceMemoryPersistence.js # Persistência da memória
│   ├── geminiLive.js           # WebSocket da Gemini Live API
│   ├── liveSessionOrchestrator.js # Ciclo de vida, retomada e reconexão
│   ├── liveSessionTransport.js # Transporte da sessão Live
│   ├── screenFrameStreaming.js # Captura de frames da tela
│   ├── appLiveHelpers.js       # Helpers de áudio, microfone, PCM e debug
│   ├── hud/                    # Interface HUD completa
│   │   ├── pages/              # LiveHudPage, KnowledgeHudPage, MindMapHudPage, DebugHudPage
│   │   ├── mindMap/            # Editor de mapa mental (utils: export, layout, storage)
│   │   ├── components/         # Sidebar, TopBar, HudIcon, DefinitionList
│   │   ├── AliceHud.jsx        # Componente raiz do HUD
│   │   └── hudViewModel.js     # Estado e lógica do HUD
│   ├── tools/                  # Fronteira oficial de tools
│   │   ├── aliceLiveTools.js   # Declarations das tools expostas ao modelo
│   │   ├── aliceLiveToolDomains.js
│   │   ├── webLiveTools.js
│   │   ├── knowledge/          # Pipeline de conhecimento web
│   │   │   ├── knowledgePipeline.js
│   │   │   └── knowledgeToolExecutor.js
│   │   └── registry/           # Registry e resolução de perfis de tools
│   │       ├── toolRegistry.js
│   │       ├── toolContextProfiles.js
│   │       └── toolProfileResolver.js
│   └── prompts/
│       └── aliceSystemInstruction.js  # Comportamento principal da Alice
│
├── src-tauri/src/              # Backend Rust (Tauri)
│   ├── alice_memory_store.rs   # Leitura, escrita atômica e backups da memória
│   ├── gemini_live_access.rs   # URL do Gemini Live a partir do ambiente
│   ├── web_knowledge.rs        # Bridge local da extensão e snapshots
│   ├── web_knowledge_matcher.rs # Seleção de seções, links e suficiência
│   ├── host_versioning.rs      # Snapshot, diff, checkpoint e rollback (NÃO é tool Live)
│   ├── windows_input.rs        # Input nativo Windows
│   ├── python_sidecar.rs       # Gerencia o sidecar Python
│   └── actions.rs / apps.rs    # Ações e apps nativos
│
├── src-tauri/python_sidecar/   # Sidecar Python
│   └── alice_window_sidecar.py # Controle de janela nativo
│
└── edge-extension/             # Extensão MV3 Edge/Chrome
    ├── background.js
    ├── captureEvents.js
    └── manifest.json
```

---

## Fronteira Rust / JavaScript

**Regra crítica — nunca duplicar lógica dos dois lados.**

| Camada | Responsabilidade |
|--------|-----------------|
| `src/` (JS/React) | Lógica de sessão Live, UI, tools, memória em runtime |
| `src-tauri/src/` (Rust) | I/O de arquivo, sistema nativo, bridge de rede, segurança |
| Comunicação | Exclusivamente via Tauri `invoke()` commands |

Toda operação de arquivo, porta de rede (`127.0.0.1:38947`) e acesso nativo
**fica no Rust**. O JS nunca acessa sistema de arquivos ou rede diretamente.

---

## Tools Live expostas ao modelo Gemini

Somente estas duas function declarations chegam ao modelo:

- `get_navigation_context`
- `inspect_current_page`

**Nenhuma outra tool é exposta ao modelo.** Busca web, fetch de URL, edição
do mapa mental, comandos desktop e host safety são capacidades internas —
não são declaradas ao Gemini Live.

O arquivo de contrato `src/tools/aliceLiveTools.contract.test.js` valida
exatamente quais tools estão expostas. **Nunca alterar sem atualizar o contrato.**

---

## Regras obrigatórias

- Sempre JSX para componentes React, nunca HTML cru
- Imports com caminho relativo explícito (sem alias `@/` — verificar vite.config.js antes de mudar)
- Todo arquivo JS novo deve ter seu `.test.js` ou `.test.jsx` correspondente
- Comentários em português, código (variáveis, funções) em inglês
- Nunca commitar `.env`, chaves de API ou logs de runtime (`.log`, `.err`)
- A chave Gemini vem exclusivamente de `GEMINI_API_KEY` ou `GOOGLE_API_KEY` do ambiente — nunca hardcoded

---

## PROIBIDO reintroduzir

Estas camadas foram **removidas intencionalmente** e não devem voltar sem
pedido explícito do usuário. Testes podem citar esses nomes apenas como
verificação negativa:

- VM local, VirtualBox, Hyper-V e variáveis `ALICE_LOCAL_VM_*`
- Guest Agent Python de VM (`src-tauri/vm/` existe mas está vazio — manter assim)
- Autonomous Runner (`src/runner/` existe mas está vazio — manter assim)
- Aprendizado autônomo operacional (`src/learning/` existe mas está vazio — manter assim)
- Learning planner / harnesses
- Workspace fallback
- Auto-melhoria automatizada
- Edição do mapa mental por tool call do modelo
- Comandos desktop expostos ao modelo

---

## Pastas vazias intencionais

Estas pastas existem mas estão vazias — **não popular sem pedido explícito:**

```
src/runner/
src/learning/
src/dev/
src-tauri/vm/
```

---

## Arquivos de log na raiz

Os arquivos `tauri-alice-run.*.log`, `alice-dev.*`, `alice-vite.*.log` são
logs de runtime. **Nunca commitar, nunca editar.** Já estão no `.gitignore`.

---

## Como rodar

```powershell
npm install
.\start-alice.ps1
```

Na janela da Alice: clique `Iniciar`, escolha a tela/janela, permita microfone.

Se `GEMINI_API_KEY` foi criada agora, reinicie o terminal antes de abrir o app.

---

## Extensão Edge

1. `edge://extensions` → Modo desenvolvedor → Carregar sem compactação
2. Selecionar pasta `edge-extension/`
3. Alice deve estar aberta para bridge funcionar em `127.0.0.1:38947`

Testar bridge:
```powershell
Invoke-WebRequest http://127.0.0.1:38947/health -UseBasicParsing
```

---

## Validar

```powershell
npm run lint
npm test
npm run build
```

Backend Rust:
```powershell
cd src-tauri
cargo test
```

Build sem instalador:
```powershell
npm run app:build -- --no-bundle
```

---

## Contexto do projeto

- Projeto pessoal da Alice — simplicidade e confiabilidade acima de tudo
- Não ganhar superfície automática ampla sem necessidade real
- HUD tem 4 páginas: `Ao vivo`, `Conhecimento`, `Mapa`, `Debug`
- Memória local persistente — schema normalizado em `aliceMemory.js`
- `host_versioning.rs` existe no backend mas **não é tool Live**
