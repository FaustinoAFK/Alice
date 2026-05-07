# Mapa completo da Alice - indice

            ## Objetivo

            Esta documentacao mapeia o projeto Alice em `c:/projetos/alice-virtual`: modulos, arquivos, fluxos, responsabilidades, dependencias internas, integracoes, testes, scripts, configuracoes, riscos e pontos frageis. A analise e baseada em leitura estatica dos arquivos do projeto; quando uma conclusao depende de inferencia, isso e indicado como inferencia.

            ## Documentos criados

            1. `00-indice.md`: objetivo, escopo, ordem de leitura e dominios.
            2. `01-visao-geral.md`: arquitetura geral e resumo critico.
            3. `02-arvore-de-arquivos.md`: arvore, pastas, exclusoes e organizacao.
            4. `03-inventario-arquivo-por-arquivo.md`: indice do inventario e links para partes.
            5. `03-inventario-arquivo-por-arquivo-parte-1.md`: inventario detalhado, parte 1.
            6. `03-inventario-arquivo-por-arquivo-parte-2.md`: inventario detalhado, parte 2.
            7. `03-inventario-arquivo-por-arquivo-parte-3.md`: inventario detalhado, parte 3.
            8. `04-modulos-por-dominio.md`: dominios funcionais e arquivos.
            9. `05-fluxos-principais.md`: fluxos A-J da Alice.
            10. `06-diagramas.md`: diagramas Mermaid.
            11. `07-memoria-e-estado.md`: memoria, schema, persistencia e riscos.
            12. `08-autonomous-task-runner.md`: fila, lease, heartbeat, evidencia e recovery.
            13. `09-vm-guest-agent-e-evidencias.md`: VM, fallback, guest agent e evidencia fisica.
            14. `10-hud-e-mind-map.md`: HUD e mind map.
            15. `11-ferramentas-tool-executors.md`: tools, roteamento e executores.
            16. `12-backend-tauri-rust.md`: backend nativo e comandos Tauri.
            17. `13-testes.md`: mapa de testes e lacunas.
            18. `14-scripts-configuracao-build.md`: scripts, configs, env vars e comandos.
            19. `15-riscos-acoplamentos-e-pontos-fracos.md`: acoplamentos, legado e pontos perigosos.
            20. `16-checklist-de-entendimento.md`: checklist antes de alterar o projeto.

            ## Ordem recomendada de leitura

            Comece por `01-visao-geral.md`, depois `05-fluxos-principais.md` e `06-diagramas.md`. Em seguida leia `04-modulos-por-dominio.md`. Para trabalho em codigo, consulte o inventario `03-*` e o documento especifico do dominio. Antes de mexer em producao, leia `15-riscos-acoplamentos-e-pontos-fracos.md` e `16-checklist-de-entendimento.md`.

            ## Escopo e exclusoes

            Foram analisados 236 arquivos textuais relevantes. Foram ignorados:

            - `.git/`: metadados Git, nao faz parte da arquitetura executavel.
- `node_modules/`: dependencias instaladas, geradas por `npm install`.
- `dist/`, `build/`, `target/`: saidas de build Vite/Tauri/Rust.
- `data/`: estado real/runtime, memoria e evidencias; ignorado para nao tocar em memoria/evidencia real.
- `.harness-smoke/`: artefatos grandes de smoke/harness.
- `src-tauri/gen/`: schemas gerados pelo Tauri.
- `__pycache__/`, `*.pyc`: caches Python.
- `*.log`, `*.out`, `*.err`: saidas de execucao/log.
- imagens e binarios (`*.png`, `*.ico`, `*.icns`): assets binarios listados como ignorados, nao analisados linha a linha.

            ## Dominios principais

            - Aprendizado/autonomia: 46 arquivo(s).
- Autonomous Task Runner: 13 arquivo(s).
- Backend Tauri/Rust: 10 arquivo(s).
- Configuracao/build: 15 arquivo(s).
- Conhecimento web: 3 arquivo(s).
- Core Rust auxiliar: 1 arquivo(s).
- Documentacao: 7 arquivo(s).
- Filesystem/sanitizacao: 1 arquivo(s).
- Frontend/orquestracao: 14 arquivo(s).
- Gemini Live/audio/tela: 9 arquivo(s).
- Guest agent: 11 arquivo(s).
- HUD: 14 arquivo(s).
- Harness/dev: 3 arquivo(s).
- Learning planner: 12 arquivo(s).
- Memoria persistente: 2 arquivo(s).
- Mind map: 11 arquivo(s).
- Navegador/bridge/extensao: 3 arquivo(s).
- Outro: 1 arquivo(s).
- Scripts/dev: 3 arquivo(s).
- Sidecar Python host: 2 arquivo(s).
- Testes: 55 arquivo(s).

            ## Avisos importantes

            - Nenhum Runner real, VM, guest agent, sidecar real ou automacao de ambiente foi executado.
            - A pasta `data/` nao foi lida de proposito, porque pode conter memoria/evidencias reais.
            - Dependentes sao inferidos principalmente por imports ESM locais; chamadas Tauri por string aparecem nos fluxos e no backend, mas nem sempre como import estatico.
            - `src/App.jsx`, `src/aliceMemory.js`, `src/autonomousTaskRunner.js`, `src/autonomousRunnerState.js` e `src-tauri/src/lib.rs` sao centros criticos e devem ser lidos diretamente antes de qualquer mudanca.
