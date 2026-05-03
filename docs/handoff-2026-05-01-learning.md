# Handoff: Alice Learning Context

Data: 2026-05-01

Projeto: `C:\projetos\alice-virtual`

Commit de referencia ao abrir este handoff: `06801ea`

## Objetivo desta entrega

Registrar o estado atual do trabalho na parte de aprendizado autonomo da Alice para permitir retomada em outra conta sem depender do historico desta conversa.

## O que foi corrigido agora

### 1. Otimizacao de procedimentos

Arquivo principal: `src/autonomousLearningLoop.js`

Problema corrigido:

- quando o loop planejava mais de uma variante de otimizacao no mesmo ciclo, apenas a ultima permanecia em `autonomousOptimization.candidates`;
- `stats.tasksCreated` tambem nao acumulava corretamente nesse caso;
- isso reabria o risco de deduplicacao falhar no scan seguinte.

Correcao aplicada:

- o estado de otimizacao passou a ser relido de `nextMemory` a cada iteracao, em vez de reconstruir tudo a partir do snapshot antigo.

### 2. Observacao falsa de alvos web

Arquivo principal: `src/autonomousObservedLearning.js`

Problema corrigido:

- paginas como `about:blank`, `file:///...`, `chrome://...` e `edge://...` podiam virar `web_app` observado;
- isso gerava metas falsas de aprendizado ao navegar em contexto nao-web real.

Correcao aplicada:

- `normalizeDomain()` agora rejeita esquemas nao HTTP(S) antes de criar alvo observado.

### 3. Contexto errado em gaps de reparo

Arquivo principal: `src/autonomousTaskContext.js`

Problema corrigido:

- um task failure sem metadata suficiente podia herdar o ultimo `observedTarget` global da memoria, mesmo sem relacao com a falha;
- isso contaminava o gap contextual e podia fazer a Alice tentar “aprender” no alvo errado.

Correcao aplicada:

- o contexto agora prioriza:
  - `metadata.context.observedTargets`;
  - `metadata.observedTargetId`;
  - e so usa fallback de alvo recente quando existe afinidade textual real com a task falha.

### 4. Propagacao de contexto do alvo observado

Arquivo principal: `src/autonomousLearningGoals.js`

Problema corrigido:

- metas geradas por observacao tinham `metadata` no goal, mas esse contexto nao descia de forma estruturada para os gaps das stages;
- isso enfraquecia o planner e o reparo contextual.

Correcao aplicada:

- cada gap derivado de learning goal agora recebe `metadata.context`, `observedTargetId`, `observedTargetKind` e `observedTargetLabel`.

### 5. Churn de memoria por observacao repetida

Arquivo principal: `src/autonomousObservedLearning.js`

Problema corrigido:

- a mesma pagina ou app observado repetidamente podia causar `changed: true` em toda atualizacao;
- isso gerava commit de memoria, audit log e persistencia sem ganho real.

Correcao aplicada:

- observacoes repetidas dentro de uma janela curta nao marcam mudanca;
- refresh real continua acontecendo quando o alvo e novo, o source muda ou o intervalo minimo passa.

## Testes adicionados ou ajustados

Arquivos:

- `src/autonomousObservedLearning.test.js`
- `src/autonomousLearningLoop.test.js`

Cobertura de regressao adicionada:

- ignorar esquemas nao-web;
- nao fazer churn para o mesmo alvo observado em janela curta;
- nao herdar alvo observado aleatorio em gap contextual;
- preservar todos os candidatos de otimizacao criados no mesmo run.

## Validacao executada

Comando rodado:

```bash
npm run test -- autonomousObservedLearning.test.js autonomousLearningLoop.test.js
```

Resultado esperado atual:

- `2 passed`
- `55 passed`

## Arquivos principais alterados nesta parte

- `src/autonomousObservedLearning.js`
- `src/autonomousObservedLearning.test.js`
- `src/autonomousLearningGoals.js`
- `src/autonomousTaskContext.js`
- `src/autonomousLearningLoop.js`
- `src/autonomousLearningLoop.test.js`

## Observacao importante sobre o worktree

O repositorio ja estava com muitas alteracoes locais antes deste handoff. Ao retomar em outra conta:

- nao assumir que tudo no `git status` faz parte desta correcao;
- ler primeiro os arquivos listados na secao anterior;
- usar `git diff -- <arquivo>` para isolar o que mudou na area de aprendizado.

## Como retomar em outra conta

### Leitura minima recomendada

1. Ler este arquivo.
2. Ler:
   - `src/autonomousObservedLearning.js`
   - `src/autonomousTaskContext.js`
   - `src/autonomousLearningGoals.js`
   - `src/autonomousLearningLoop.js`
3. Rodar os testes da secao de validacao.

### Prompt recomendado para a nova conta

Usar algo proximo disto:

```text
Leia o handoff em docs/handoff-2026-05-01-learning.md e continue a partir dele.
Quero focar na parte de aprendizado autonomo da Alice.
Valide primeiro os testes citados no handoff e depois continue a investigacao/correcao.
```

## Proximos focos recomendados

1. Revisar sincronizacao entre `autonomousLearningState` da UI e `autonomousLearningMemoryState` persistida para garantir que HUD, memoria e auditoria representam o mesmo estado funcional.
2. Rodar a suite completa relacionada ao fluxo autonomo quando for oportuno, nao apenas os testes do aprendizado observado.
3. Revisar se existem outros pontos do `App.jsx` disparando persistencia excessiva por atualizacoes frequentes de contexto.
