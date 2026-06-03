# Instrucoes do Projeto Alice Virtual

Estas instrucoes valem somente para o projeto `alice-virtual`.

## Identidade do Projeto

Alice Virtual e uma assistente pessoal local feita com Tauri, React e Gemini Live API.

O foco do projeto e criar uma Alice confiavel para uso pessoal, com:

- conversa por voz;
- contexto de tela;
- contexto de paginas web via extensao;
- memoria local persistente;
- HUD de diagnostico e controle;
- ferramentas web;
- mapa mental;
- snapshots, rollback e auditoria para acoes sensiveis no host.

Este projeto nao e um jogo Roblox. Nao aplique instrucoes de Roblox, Luau, game design ou retencao de jogos aqui, a menos que o usuario peca explicitamente.

## Prioridades

1. Confianca e controle do usuario.
2. Privacidade local.
3. Seguranca em comandos, arquivos, shell e bridge local.
4. Memoria pessoal clara, editavel e recuperavel.
5. UX simples para entender o que a Alice esta vendo, lembrando e fazendo.
6. Manutencao incremental sem reescritas grandes.

## Tecnologias Principais

- Frontend: React, Vite, CSS.
- Desktop/backend: Tauri 2, Rust.
- Modelo/conversa: Gemini Live API.
- Testes JS: Vitest.
- Extensao: Edge/Chrome Extension MV3.

## Regras de Engenharia

- Preserve contratos existentes de memoria, tools web, mapa mental e comandos Tauri ativos.
- Antes de mudar comportamento sensivel, procure testes relacionados.
- Nao enfraqueca validacoes de path, shell, rollback, evidencia ou policy.
- Trate `src/App.jsx`, `src/aliceMemory.js`, `src/alice.js`, `src/tools/` e `src-tauri/src/lib.rs` como arquivos criticos.
- Prefira refatoracoes pequenas, com testes, mantendo facades compativeis.

## Seguranca e Privacidade

- Qualquer acao no PC real deve considerar snapshot, diff, validacao e rollback.
- Acoes de shell e filesystem devem ser tratadas como sensiveis.
- Bridge local e extensao web devem usar autenticacao/limites quando possivel.
- Memoria local deve ter backup, migracao segura e possibilidade de recuperacao.
- Nao salve segredos em arquivos versionados.

## Comandos Uteis

```powershell
npm run lint
npm test
npm run build
npm run audit:alice
```

Para backend Rust, quando arquivos em `src-tauri/` forem alterados:

```powershell
cd src-tauri
cargo test
```

## Estilo de Resposta para Este Projeto

- Explique riscos de forma simples.
- Separe problema real de melhoria futura.
- Quando criar relatorios, use Markdown claro com prioridade, motivo e sugestao.
- Para melhorias da Alice, pense como assistente pessoal local, nao como produto publico.
- Para mudancas de codigo, implemente de forma incremental e verifique com testes quando possivel.
