# Memoria e estado

## O que e

A memoria persistente da Alice e um JSON versionado controlado por `src/aliceMemory.js` e salvo pelo Tauri como `alice-memory.json`. Ela funciona como banco local unico para fatos, contexto recente, projetos/tarefas, mind maps, auditoria autonoma, estado do Runner, learning planner, procedures aprendidas e estados de aprendizado/otimizacao.

## Arquivos responsaveis

- `src/aliceMemory.js`: contrato principal. Define `ALICE_MEMORY_SCHEMA_VERSION`, limite estimado, estado vazio, validacao, upgrade, prune, merge de fatos, mind maps, autonomia, Runner e helpers de storage.
- `src/aliceMemoryPersistence.js`: boundary de runtime. Decide quando carregar/salvar via Tauri e quando pular persistencia para evitar salvar antes da hidratacao.
- `src-tauri/src/lib.rs`: implementa `load_alice_memory_json` e `save_alice_memory_json`, valida payload vazio/tamanho e grava de forma atomica com arquivo temporario.
- `src/runnerAppDiagnostics.js`: escreve eventos de diagnostico do app no audit do Runner.
- `src/debugHud.js`: monta snapshot derivado para o HUD, sem ser fonte de verdade.
- `src/learningPlanner/learningPlannerRepository.js`: persiste planos dentro do subestado de aprendizado.

## Como carrega

1. `App.jsx` chama `loadAliceMemoryFromRuntimeBoundary({ invokeFn: invoke })`.
2. O boundary chama `invoke('load_alice_memory_json')`.
3. Rust resolve o app data e le `alice-memory.json`; ausencia vira memoria vazia no frontend.
4. `aliceMemory.js` valida, aplica defaults e normaliza subestruturas ausentes.
5. `App.jsx` grava em `aliceMemoryRef` e atualiza states derivados: mind map ativo, Runner, learning/autonomy e diagnosticos.

## Como salva

1. Qualquer mudanca relevante passa por `commitAliceMemory` ou helper que retorna nova memoria.
2. `commitAliceMemory` atualiza a ref, recalcula mind map/Runner e agenda save com debounce.
3. `flushAliceMemoryToRuntime` so salva se o runtime Tauri estiver disponivel e a memoria ja tiver sido hidratada.
4. Rust valida tamanho maximo, cria diretorio, grava `.tmp`, sincroniza, remove o antigo e renomeia.

## Partes da memoria

- Persona/fatos/projetos/tarefas: usados para contexto de conversa.
- `recentContextSummary`: resumo curto usado na rehidratacao e debug.
- `toolFacts` e `validatedProcedures`: conhecimento operacional consolidado.
- `mindMaps`: mapas persistentes, active id, nodes, edges e historico.
- `autonomousAudit` e `autonomousLearning`: logs, goals, gaps, candidates, procedures, VM state e planner.
- `autonomousRunner`: queue, tasks, steps, locks, audits e evidenceRefs.
- `autonomousOptimization` e `procedureReuseIndex`: otimizacao/reuso de procedures.

## Quem le e quem escreve

Leitores: `App.jsx`, setup Live, HUD/debug, Runner tick, learning loop, tool executors, mind map, learning planner e contexto operacional.

Escritores: conversa (`rememberAliceContext`), `mindMapToolExecutor`, `autonomousRunnerToolExecutor`, Runner tick, learning loop, observed learning, learning planner, diagnostics e callbacks do HUD.

## Riscos tecnicos

- Crescimento: audits, maps, plans e evidencias logicas podem aproximar a memoria do limite de 50 MiB.
- Corrupcao: JSON invalido pode levar a recovery para estado vazio; isso preserva app vivo, mas pode perder contexto.
- Concorrencia: timers de save, Runner e learning loop compartilham `aliceMemoryRef`.
- Inconsistencia: states derivados do React podem ficar defasados se algum fluxo alterar a ref sem recalcular.
- Compatibilidade: qualquer alteracao no schema precisa manter upgrade e testes de dados antigos.

## Como testar

Use `npm test -- aliceMemory`, `npm test -- aliceMemoryPersistence`, testes de Runner/learning planner e `cd src-tauri; cargo test` para validacao nativa de leitura/escrita. Para mudancas de schema, crie casos com memoria antiga, campos ausentes, dados excedentes e subestados parcialmente corrompidos.
