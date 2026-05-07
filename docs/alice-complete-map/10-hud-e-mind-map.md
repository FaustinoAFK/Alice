# HUD e mind map

## HUD

`src/hud/AliceHud.jsx` renderiza o layout principal. Ele usa `Sidebar` para navegacao, `TopBar` para controle Live e paginas lazy para dominios pesados. Paginas existentes: `LiveHudPage`, `KnowledgeHudPage`, `MindMapHudPage`, `AutonomyHudPage`, `AutonomousLearningHudPage`, `AutonomousRunnerHudPage` e `DebugHudPage`.

O HUD recebe props de `App.jsx`: status Live, captions, diagnostics, debugHud, autonomousLearningState, autonomousRunnerState, activeMindMap, callbacks de navegacao, toggle Live, acoes de learning, acoes de Runner e alteracoes de mind map. Ele nao deve mutar a fonte de verdade diretamente.

## View models

`src/hud/hudViewModel.js` deriva atividade Live. `src/hud/pages/runnerHudViewModel.js` transforma Runner state em lista/contadores para HUD. `src/hud/pages/learningPlannerHudViewModel.js` e muito pequeno; pela leitura estatica, parece uma area ainda incipiente ou ponte minima.

## Mind map

Mapas ficam em `aliceMemory.mindMaps`. `MindMapEditor.jsx` usa React Flow; `mindMapData.js` normaliza nodes, edges, status, history e snapshots; `layout.js` aplica dagre; `export.js` gera JSON/Markdown; `storage.js` oferece utilidade local. `CustomNode.jsx` renderiza nos customizados.

## Tool e sincronizacao

`mindMapToolExecutor.js` implementa `update_mind_map` com operacoes como replace, add/remove node/edge, rename, layout, export, status, batch e rollback. `mindMapIntentInterpreter.js` tenta transformar linguagem natural em operacoes. `mindMapExecutionSync.js` e `autonomousRunnerMindMap.js` sincronizam execucao/Runner com nos do mapa.

## Riscos

Estado visual pode ficar stale se `App.jsx` nao atualizar states derivados apos `commitAliceMemory`. Sincronizacao por heuristica pode marcar no errado. Rollback/historico precisa preservar ids e status. O mapa pode sugerir progresso visual que ainda nao foi validado pelo Runner, se a integracao for relaxada.

## Testes

Cobertura existente: `AliceHud.test.jsx`, `hudViewModel.test.js`, `runnerHudViewModel.test.js`, `CustomNode.test.jsx`, `mindMapData.test.js`, `mindMapToolExecutor.test.js`, `mindMapIntentInterpreter.test.js`, `mindMapExecutionSync.test.js`. Lacuna: teste visual completo do React Flow em browser real.
