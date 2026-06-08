# Instrucoes do Projeto Alice Virtual

Estas instrucoes valem somente para o projeto `alice-virtual`.

## Identidade do Projeto

Alice Virtual e uma assistente pessoal local feita com Tauri, React e Gemini
Live API.

O foco ativo do projeto e:

- conversa por voz;
- contexto visual da tela compartilhada;
- contexto textual de paginas web via extensao Edge/Chrome;
- memoria local persistente;
- mapa mental editavel manualmente no HUD;
- HUD de diagnostico e controle;
- bridge local segura entre extensao e app;
- superficie pequena de tools Live.

Este projeto nao e um jogo Roblox. Nao aplique instrucoes de Roblox, Luau, game
design ou retencao de jogos aqui, a menos que o usuario peca explicitamente.

## Superficie Ativa

As unicas tools Live expostas ao Gemini devem ser:

- `get_navigation_context`
- `inspect_current_page`

O pipeline interno pode usar comandos Tauri de refresh, busca e fetch web, mas
isso nao significa que essas funcoes estejam liberadas como tools Live para o
modelo.

O mapa mental existe no HUD e pode ser editado pela interface. Nao ha tool Live
ativa para editar mapa mental automaticamente.

`host_versioning.rs` existe como capacidade nativa de snapshot, diff,
checkpoint e rollback, mas nao deve ser exposto como tool Live sem pedido
explicito.

## Removido e Nao Deve Ser Reativado

Nao reative sem pedido explicito:

- VM local, VirtualBox/Hyper-V ou variaveis `ALICE_LOCAL_VM_*`;
- Guest Agent Python de VM;
- Autonomous Runner;
- aprendizado autonomo operacional;
- learning planner e harnesses;
- workspace fallback;
- auto-melhoria automatizada;
- edicao automatica de mapa mental via tool call;
- comandos desktop amplos no Gemini Live.

Testes podem conter esses termos apenas para garantir que nao estao expostos ou
que memoria legada e podada.

## Prioridades

1. Confianca e controle do usuario.
2. Privacidade local.
3. Superficie pequena de tools ativas.
4. Memoria pessoal clara, editavel e recuperavel.
5. UX simples para entender o que a Alice esta vendo e lembrando.
6. Seguranca em bridge local, memoria e comandos nativos.
7. Manutencao incremental sem reescritas grandes.

## Tecnologias Principais

- Frontend: React, Vite, CSS.
- Desktop/backend: Tauri 2, Rust.
- Modelo/conversa: Gemini Live API.
- Testes JS: Vitest.
- Extensao: Edge/Chrome Extension MV3.

## Regras de Engenharia

- Antes de alterar codigo, entenda a estrutura atual. O projeto acabou de ser
  reduzido; nao use documentos ou nomes antigos como fonte de verdade.
- Preserve a superficie Live minima: `get_navigation_context` e
  `inspect_current_page`.
- Mantenha declaracoes, registry, executor e pipeline de tools dentro de
  `src/tools/`.
- Nao adicione tool Live, handler em `App.jsx` ou prompt que permita acao ampla
  sem necessidade concreta.
- Nao enfraqueca validacoes de path, shell, rollback, memoria ou bridge local.
- Trate `src/App.jsx`, `src/aliceMemory.js`, `src-tauri/src/lib.rs`,
  `src-tauri/src/web_knowledge.rs` e `src/prompts/aliceSystemInstruction.js`
  como arquivos criticos.
- Prefira refatoracoes pequenas, com testes.
- Use nomes neutros em exemplos e testes novos. Nao use VM/runner/learning como
  exemplo generico.
  
## Expansao Tecnica Permitida

- Quando for necessario e viavel para melhorar a Alice, e permitido usar outras
  linguagens de programacao, frameworks, bibliotecas, APIs e servicos locais,
  desde que a escolha tenha motivo claro e respeite as prioridades deste
  projeto.
- Essa liberdade tecnica nao autoriza aumentar a superficie Live sem necessidade
  concreta.
- Qualquer adicao deve preservar controle do usuario, privacidade local,
  manutencao razoavel e integracao coerente com a arquitetura atual.
- Antes de introduzir nova tecnologia, avalie se ela realmente melhora a Alice
  de forma pratica e se o ganho compensa custo, risco, dependencia e
  complexidade operacional.

## Seguranca e Privacidade

- A chave Gemini deve vir de `GEMINI_API_KEY` ou `GOOGLE_API_KEY`; nao salve
  segredos em arquivos versionados.
- Bridge local e extensao web devem ter limites claros.
- Memoria local deve ter backup, migracao segura e possibilidade de recuperacao.
- Qualquer acao real em arquivo deve considerar snapshot, diff, validacao e
  rollback, mesmo que essa capacidade nao esteja exposta ao modelo.

## Comandos Uteis

```powershell
npm run lint
npm test
npm run build
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
- Para melhorias da Alice, pense como assistente pessoal local, nao como produto
  publico.
- Para mudancas de codigo, implemente de forma incremental e verifique com
  testes quando possivel.
