# Inventario arquivo por arquivo - parte 3

Este inventario foi gerado por leitura estatica de imports/exports e enriquecido por classificacao de dominio. Dependentes por `invoke(...)` podem nao aparecer como import direto.

## `src/hud/AliceHud.jsx`

- Caminho relativo: `src/hud/AliceHud.jsx`.
- Tipo: UI/asset textual (.jsx).
- Dominio funcional: HUD.
- Responsabilidade principal: Layout principal do HUD e roteamento de paginas.
- O que faz: Layout principal do HUD e roteamento de paginas. Manipula principalmente: Props/snapshots de UI, status, contadores, listas e callbacks.
- Quando e usado: Quando a pagina correspondente do HUD e renderizada.
- Quem chama/importa: `src/App.jsx`, `src/hud/AliceHud.test.jsx`.
- Quem chama/importa internamente: `react`, `src/hud/components/Sidebar.jsx`, `src/hud/components/TopBar.jsx`, `src/hud/pages/LiveHudPage.jsx`, `src/hud/hudViewModel.js`, `src/hud/pages/KnowledgeHudPage.jsx`, `src/hud/pages/MindMapHudPage.jsx`, `src/hud/pages/AutonomyHudPage.jsx`, `src/hud/pages/AutonomousLearningHudPage.jsx`, `src/hud/pages/AutonomousRunnerHudPage.jsx`, `src/hud/pages/DebugHudPage.jsx`.
- Principais exports: `AliceHud`.
- Principais funcoes/classes/simbolos: `AliceHud`, `KnowledgeHudPage`, `MindMapHudPage`, `AutonomyHudPage`, `AutonomousLearningHudPage`, `AutonomousRunnerHudPage`, `DebugHudPage`, `renderLazyHudPage`, `liveActivity`.
- Principais estados/dados manipulados: Props/snapshots de UI, status, contadores, listas e callbacks.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: critico.
- Risco de alteracao: Alteracao pode quebrar fluxo central ou seguranca; revisar dependentes, testes e efeitos colaterais antes.
- Testes relacionados: `src/hud/AliceHud.test.jsx`.
- Observacoes tecnicas: arquivo central; ler fluxo completo antes de alterar, alto fan-in de dependencias importadas.

## `src/hud/AliceHud.test.jsx`

- Caminho relativo: `src/hud/AliceHud.test.jsx`.
- Tipo: teste/fixture (.jsx).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `react-dom/server`, `vitest`, `src/hud/AliceHud.jsx`, `src/hud/mindMap/utils/mindMapData.js`, `src/hud/pages/KnowledgeHudPage.jsx`, `src/hud/pages/MindMapHudPage.jsx`, `src/hud/pages/AutonomyHudPage.jsx`, `src/hud/pages/AutonomousLearningHudPage.jsx`, `src/hud/pages/AutonomousRunnerHudPage.jsx`, `src/hud/pages/DebugHudPage.jsx`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `buildProps`, `modules`, `html`.
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/hud/AliceHud.test.jsx`.
- Observacoes tecnicas: alto fan-in de dependencias importadas.

## `src/hud/components/DefinitionList.jsx`

- Caminho relativo: `src/hud/components/DefinitionList.jsx`.
- Tipo: UI/asset textual (.jsx).
- Dominio funcional: HUD.
- Responsabilidade principal: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks.
- O que faz: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks. Manipula principalmente: Props/snapshots de UI, status, contadores, listas e callbacks.
- Quando e usado: Quando a pagina correspondente do HUD e renderizada.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `DefinitionList`.
- Principais funcoes/classes/simbolos: `DefinitionList`.
- Principais estados/dados manipulados: Props/snapshots de UI, status, contadores, listas e callbacks.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/components/HudIcon.jsx`

- Caminho relativo: `src/hud/components/HudIcon.jsx`.
- Tipo: UI/asset textual (.jsx).
- Dominio funcional: HUD.
- Responsabilidade principal: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks.
- O que faz: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks. Manipula principalmente: Props/snapshots de UI, status, contadores, listas e callbacks.
- Quando e usado: Quando a pagina correspondente do HUD e renderizada.
- Quem chama/importa: `src/hud/components/Sidebar.jsx`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `HudIcon`.
- Principais funcoes/classes/simbolos: `HudIcon`.
- Principais estados/dados manipulados: Props/snapshots de UI, status, contadores, listas e callbacks.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/components/Sidebar.jsx`

- Caminho relativo: `src/hud/components/Sidebar.jsx`.
- Tipo: UI/asset textual (.jsx).
- Dominio funcional: HUD.
- Responsabilidade principal: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks.
- O que faz: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks. Manipula principalmente: Props/snapshots de UI, status, contadores, listas e callbacks.
- Quando e usado: Quando a pagina correspondente do HUD e renderizada.
- Quem chama/importa: `src/hud/AliceHud.jsx`.
- Quem chama/importa internamente: `src/hud/components/../hudViewModel`, `src/hud/components/HudIcon.jsx`.
- Principais exports: `Sidebar`.
- Principais funcoes/classes/simbolos: `Sidebar`.
- Principais estados/dados manipulados: Props/snapshots de UI, status, contadores, listas e callbacks.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/components/TopBar.jsx`

- Caminho relativo: `src/hud/components/TopBar.jsx`.
- Tipo: UI/asset textual (.jsx).
- Dominio funcional: HUD.
- Responsabilidade principal: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks.
- O que faz: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks. Manipula principalmente: Props/snapshots de UI, status, contadores, listas e callbacks.
- Quando e usado: Quando a pagina correspondente do HUD e renderizada.
- Quem chama/importa: `src/hud/AliceHud.jsx`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `TopBar`.
- Principais funcoes/classes/simbolos: `TopBar`, `title`.
- Principais estados/dados manipulados: Props/snapshots de UI, status, contadores, listas e callbacks.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/hudViewModel.js`

- Caminho relativo: `src/hud/hudViewModel.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: HUD.
- Responsabilidade principal: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks.
- O que faz: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks. Manipula principalmente: Props/snapshots de UI, status, contadores, listas e callbacks.
- Quando e usado: Quando a pagina correspondente do HUD e renderizada.
- Quem chama/importa: `src/hud/AliceHud.jsx`, `src/hud/hudViewModel.test.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `HUD_PAGES`, `buildLiveActivity`, `buildSignalGroups`, `buildDebugSummaryCards`, `buildAutonomySummaryCards`.
- Principais funcoes/classes/simbolos: `HUD_PAGES`, `clampMicrophonePercent`, `buildLiveActivity`, `buildSignalGroups`, `buildDebugSummaryCards`, `buildAutonomySummaryCards`.
- Principais estados/dados manipulados: Props/snapshots de UI, status, contadores, listas e callbacks.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: `src/hud/hudViewModel.test.js`, `src/hud/pages/runnerHudViewModel.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/hudViewModel.test.js`

- Caminho relativo: `src/hud/hudViewModel.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/hud/hudViewModel.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `groups`, `cards`.
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/hud/hudViewModel.test.js`, `src/hud/pages/runnerHudViewModel.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/mindMap/CustomNode.jsx`

- Caminho relativo: `src/hud/mindMap/CustomNode.jsx`.
- Tipo: UI/asset textual (.jsx).
- Dominio funcional: Mind map.
- Responsabilidade principal: Modelo, executor, editor ou utilitario do mapa mental persistente.
- O que faz: Modelo, executor, editor ou utilitario do mapa mental persistente. Manipula principalmente: Mapas mentais, nodes, edges, status, historico, layout e export.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/hud/mindMap/CustomNode.test.jsx`, `src/hud/mindMap/MindMapEditor.jsx`.
- Quem chama/importa internamente: `@xyflow/react`, `react`.
- Principais exports: `default`.
- Principais funcoes/classes/simbolos: `COLORS`, `STATUS_LABELS`, `TYPE_LABELS`, `CustomNode`, `onChange`, `onFocus`, `onBlur`, `currentColor`, `status`, `nodeType`.
- Principais estados/dados manipulados: Mapas mentais, nodes, edges, status, historico, layout e export.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: `src/hud/mindMap/CustomNode.test.jsx`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/mindMap/CustomNode.test.jsx`

- Caminho relativo: `src/hud/mindMap/CustomNode.test.jsx`.
- Tipo: teste/fixture (.jsx).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Mapas mentais, nodes, edges, status, historico, layout e export.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `react-dom/server`, `vitest`, `src/hud/mindMap/CustomNode.jsx`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `html`.
- Principais estados/dados manipulados: Mapas mentais, nodes, edges, status, historico, layout e export.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/hud/mindMap/CustomNode.test.jsx`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/mindMap/MindMapEditor.jsx`

- Caminho relativo: `src/hud/mindMap/MindMapEditor.jsx`.
- Tipo: UI/asset textual (.jsx).
- Dominio funcional: Mind map.
- Responsabilidade principal: Modelo, executor, editor ou utilitario do mapa mental persistente.
- O que faz: Modelo, executor, editor ou utilitario do mapa mental persistente. Manipula principalmente: Mapas mentais, nodes, edges, status, historico, layout e export.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `react`, `@xyflow/react`, `uuid`, `lucide-react`, `src/hud/mindMap/CustomNode.jsx`, `src/hud/mindMap/utils/storage.js`, `src/hud/mindMap/utils/export.js`, `src/hud/mindMap/utils/layout.js`, `src/hud/mindMap/utils/mindMapData.js`.
- Principais exports: `default`.
- Principais funcoes/classes/simbolos: `MindMapEditorContent`, `MindMapEditor`, `nodeTypes`, `cloneMapData`, `buildDefaultEdge`, `reactFlowWrapper`, `initialDataRef`, `onChangeRef`, `saveTimeoutRef`, `importInputRef`, `editingSnapshotRef`, `takeSnapshot`, `nds`, `eds`, `handleDeleteNode`, `handleColorChange`, `handleNodeChange`, `handleNodeEditStart`, `handleNodeEditEnd`, `handleToggleFold` (+40).
- Principais estados/dados manipulados: Mapas mentais, nodes, edges, status, historico, layout e export.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/mindMap/utils/export.js`

- Caminho relativo: `src/hud/mindMap/utils/export.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Mind map.
- Responsabilidade principal: Modelo, executor, editor ou utilitario do mapa mental persistente.
- O que faz: Modelo, executor, editor ou utilitario do mapa mental persistente. Manipula principalmente: Mapas mentais, nodes, edges, status, historico, layout e export.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/hud/mindMap/MindMapEditor.jsx`, `src/mindMapToolExecutor.js`.
- Quem chama/importa internamente: `html-to-image`, `src/hud/mindMap/utils/mindMapData.js`.
- Principais exports: `buildMarkdown`, `exportToImage`, `exportToMarkdown`, `exportToJson`.
- Principais funcoes/classes/simbolos: `buildMarkdown`, `childrenMap`, `isTarget`, `rootNodes`, `nodeMap`, `traverse`, `node`, `indent`, `text`, `exportToImage`, `element`, `fn`, `filter`, `exclusionClasses`, `dataUrl`, `link`, `exportToMarkdown`, `mdContent`, `blob`, `url` (+2).
- Principais estados/dados manipulados: Mapas mentais, nodes, edges, status, historico, layout e export.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/mindMap/utils/layout.js`

- Caminho relativo: `src/hud/mindMap/utils/layout.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Mind map.
- Responsabilidade principal: Modelo, executor, editor ou utilitario do mapa mental persistente.
- O que faz: Modelo, executor, editor ou utilitario do mapa mental persistente. Manipula principalmente: Mapas mentais, nodes, edges, status, historico, layout e export.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/hud/mindMap/MindMapEditor.jsx`, `src/mindMapToolExecutor.js`.
- Quem chama/importa internamente: `dagre`.
- Principais exports: `getLayoutedElements`.
- Principais funcoes/classes/simbolos: `getLayoutedElements`, `dagreGraph`, `width`, `height`, `newNodes`, `nodeWithPosition`.
- Principais estados/dados manipulados: Mapas mentais, nodes, edges, status, historico, layout e export.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/mindMap/utils/mindMapData.js`

- Caminho relativo: `src/hud/mindMap/utils/mindMapData.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Mind map.
- Responsabilidade principal: Modelo, executor, editor ou utilitario do mapa mental persistente.
- O que faz: Modelo, executor, editor ou utilitario do mapa mental persistente. Manipula principalmente: Mapas mentais, nodes, edges, status, historico, layout e export.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/aliceMemory.js`, `src/aliceMemory.test.js`, `src/autonomousRunner.test.js`, `src/autonomousRunnerMindMap.js`, `src/hud/AliceHud.test.jsx`, `src/hud/mindMap/MindMapEditor.jsx`, `src/hud/mindMap/utils/export.js`, `src/hud/mindMap/utils/storage.js`, `src/mindMapData.test.js`, `src/mindMapExecutionSync.js`, `src/mindMapExecutionSync.test.js`, `src/mindMapIntentInterpreter.js`, `src/mindMapIntentInterpreter.test.js`, `src/mindMapToolExecutor.js`, `src/mindMapToolExecutor.test.js`.
- Quem chama/importa internamente: `uuid`.
- Principais exports: `MIND_MAP_SCHEMA_VERSION`, `MAX_MIND_MAP_NODES`, `MAX_MIND_MAP_EDGES`, `MAX_MIND_MAP_HISTORY`, `MAX_MIND_MAP_EVOLUTION_CHANGES`, `MIND_MAP_NODE_TYPES`, `MIND_MAP_NODE_STATUSES`, `MIND_MAP_NODE_PRIORITIES`, `MIND_MAP_NODE_SOURCES`, `MIND_MAP_CHANGE_TYPES`, `normalizeNodeType`, `normalizeNodeStatus`, `createStarterMindMap`, `createMindMap`, `stripRuntimeNodeData`, `isValidMindMapData`, `upgradeMindMapSchema`, `normalizeMindMap` (+14).
- Principais funcoes/classes/simbolos: `MIND_MAP_SCHEMA_VERSION`, `MAX_MIND_MAP_NODES`, `MAX_MIND_MAP_EDGES`, `MAX_MIND_MAP_HISTORY`, `MAX_MIND_MAP_EVOLUTION_CHANGES`, `FALLBACK_NODE_LABEL`, `DEFAULT_NODE_COLOR`, `VALID_NODE_COLORS`, `MIND_MAP_NODE_TYPES`, `MIND_MAP_NODE_STATUSES`, `MIND_MAP_NODE_PRIORITIES`, `MIND_MAP_NODE_SOURCES`, `MIND_MAP_CHANGE_TYPES`, `RUNTIME_DATA_KEYS`, `PERSISTED_EDGE_KEYS`, `normalizeText`, `normalizeNodeId`, `id`, `makeUniqueId`, `normalizePosition` (+81).
- Principais estados/dados manipulados: Mapas mentais, nodes, edges, status, historico, layout e export.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: `src/mindMapData.test.js`.
- Observacoes tecnicas: muitos dependentes estaticos.

## `src/hud/mindMap/utils/storage.js`

- Caminho relativo: `src/hud/mindMap/utils/storage.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Mind map.
- Responsabilidade principal: Modelo, executor, editor ou utilitario do mapa mental persistente.
- O que faz: Modelo, executor, editor ou utilitario do mapa mental persistente. Manipula principalmente: Mapas mentais, nodes, edges, status, historico, layout e export.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/hud/mindMap/MindMapEditor.jsx`.
- Quem chama/importa internamente: `src/hud/mindMap/utils/mindMapData.js`.
- Principais exports: `saveToStorage`, `loadFromStorage`.
- Principais funcoes/classes/simbolos: `STORAGE_KEY`, `saveToStorage`, `data`, `loadFromStorage`, `dataString`.
- Principais estados/dados manipulados: Mapas mentais, nodes, edges, status, historico, layout e export.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/pages/AutonomousLearningHudPage.jsx`

- Caminho relativo: `src/hud/pages/AutonomousLearningHudPage.jsx`.
- Tipo: UI/asset textual (.jsx).
- Dominio funcional: HUD.
- Responsabilidade principal: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks.
- O que faz: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando a pagina correspondente do HUD e renderizada.
- Quem chama/importa: `src/hud/AliceHud.jsx`, `src/hud/AliceHud.test.jsx`, `src/hud/pages/AutonomousLearningHudPage.test.jsx`.
- Quem chama/importa internamente: `react`, `src/hud/pages/../components/DefinitionList`, `src/hud/pages/learningPlannerHudViewModel.js`.
- Principais exports: `AutonomousLearningHudPage`, `default`.
- Principais funcoes/classes/simbolos: `AutonomousLearningHudPage`, `formatPlannerList`, `learning`, `planner`, `activePlan`, `enabled`, `submitGoal`, `request`, `cancelPlan`, `result`, `markForReview`, `approvePlan`, `rejectPlan`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: `src/hud/pages/AutonomousLearningHudPage.test.jsx`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/pages/AutonomousLearningHudPage.test.jsx`

- Caminho relativo: `src/hud/pages/AutonomousLearningHudPage.test.jsx`.
- Tipo: teste/fixture (.jsx).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `react-dom/server`, `vitest`, `src/hud/pages/AutonomousLearningHudPage.jsx`, `src/hud/pages/learningPlannerHudViewModel.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `plan`, `renderPage`, `html`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/hud/pages/AutonomousLearningHudPage.test.jsx`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/pages/AutonomousRunnerHudPage.jsx`

- Caminho relativo: `src/hud/pages/AutonomousRunnerHudPage.jsx`.
- Tipo: UI/asset textual (.jsx).
- Dominio funcional: HUD.
- Responsabilidade principal: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks.
- O que faz: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks. Manipula principalmente: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Quando e usado: Quando a pagina correspondente do HUD e renderizada.
- Quem chama/importa: `src/hud/AliceHud.jsx`, `src/hud/AliceHud.test.jsx`.
- Quem chama/importa internamente: `src/hud/pages/../components/DefinitionList`, `src/hud/pages/runnerHudViewModel.js`.
- Principais exports: `AutonomousRunnerHudPage`, `default`.
- Principais funcoes/classes/simbolos: `AutonomousRunnerHudPage`, `formatTime`, `statusLabel`, `runner`, `tasks`, `activeTask`, `activeStep`, `audits`, `evidenceRefs`, `terminalTask`, `moveUp`, `moveDown`.
- Principais estados/dados manipulados: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/pages/AutonomyHudPage.jsx`

- Caminho relativo: `src/hud/pages/AutonomyHudPage.jsx`.
- Tipo: UI/asset textual (.jsx).
- Dominio funcional: HUD.
- Responsabilidade principal: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks.
- O que faz: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks. Manipula principalmente: Props/snapshots de UI, status, contadores, listas e callbacks.
- Quando e usado: Quando a pagina correspondente do HUD e renderizada.
- Quem chama/importa: `src/hud/AliceHud.jsx`, `src/hud/AliceHud.test.jsx`.
- Quem chama/importa internamente: `src/hud/pages/../components/DefinitionList`, `src/hud/pages/../hudViewModel`.
- Principais exports: `AutonomyHudPage`, `default`.
- Principais funcoes/classes/simbolos: `AutonomyHudPage`, `autonomyDisplay`, `cards`, `pendingProposals`.
- Principais estados/dados manipulados: Props/snapshots de UI, status, contadores, listas e callbacks.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/pages/DebugHudPage.jsx`

- Caminho relativo: `src/hud/pages/DebugHudPage.jsx`.
- Tipo: UI/asset textual (.jsx).
- Dominio funcional: HUD.
- Responsabilidade principal: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks.
- O que faz: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks. Manipula principalmente: Props/snapshots de UI, status, contadores, listas e callbacks.
- Quando e usado: Quando a pagina correspondente do HUD e renderizada.
- Quem chama/importa: `src/hud/AliceHud.jsx`, `src/hud/AliceHud.test.jsx`.
- Quem chama/importa internamente: `src/hud/pages/../components/DefinitionList`, `src/hud/pages/../hudViewModel`.
- Principais exports: `DebugHudPage`, `default`.
- Principais funcoes/classes/simbolos: `DebugHudPage`, `debugSummaryCards`, `interactions`.
- Principais estados/dados manipulados: Props/snapshots de UI, status, contadores, listas e callbacks.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/pages/KnowledgeHudPage.jsx`

- Caminho relativo: `src/hud/pages/KnowledgeHudPage.jsx`.
- Tipo: UI/asset textual (.jsx).
- Dominio funcional: HUD.
- Responsabilidade principal: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks.
- O que faz: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks. Manipula principalmente: Navigation context, snapshots de pagina, secoes, links, fontes, suficiencia e timeline.
- Quando e usado: Quando a pagina correspondente do HUD e renderizada.
- Quem chama/importa: `src/hud/AliceHud.jsx`, `src/hud/AliceHud.test.jsx`.
- Quem chama/importa internamente: `src/hud/pages/../components/DefinitionList`.
- Principais exports: `KnowledgeHudPage`, `default`.
- Principais funcoes/classes/simbolos: `KnowledgeHudPage`, `knowledgeDisplay`, `knowledgeTimeline`.
- Principais estados/dados manipulados: Navigation context, snapshots de pagina, secoes, links, fontes, suficiencia e timeline.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/pages/LiveHudPage.jsx`

- Caminho relativo: `src/hud/pages/LiveHudPage.jsx`.
- Tipo: UI/asset textual (.jsx).
- Dominio funcional: HUD.
- Responsabilidade principal: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks.
- O que faz: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks. Manipula principalmente: Props/snapshots de UI, status, contadores, listas e callbacks.
- Quando e usado: Quando a pagina correspondente do HUD e renderizada.
- Quem chama/importa: `src/hud/AliceHud.jsx`.
- Quem chama/importa internamente: `src/hud/pages/../hudViewModel`.
- Principais exports: `LiveHudPage`.
- Principais funcoes/classes/simbolos: `LiveHudPage`, `signalGroups`.
- Principais estados/dados manipulados: Props/snapshots de UI, status, contadores, listas e callbacks.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/pages/MindMapHudPage.jsx`

- Caminho relativo: `src/hud/pages/MindMapHudPage.jsx`.
- Tipo: UI/asset textual (.jsx).
- Dominio funcional: Mind map.
- Responsabilidade principal: Modelo, executor, editor ou utilitario do mapa mental persistente.
- O que faz: Modelo, executor, editor ou utilitario do mapa mental persistente. Manipula principalmente: Mapas mentais, nodes, edges, status, historico, layout e export.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/hud/AliceHud.jsx`, `src/hud/AliceHud.test.jsx`.
- Quem chama/importa internamente: `src/hud/pages/../mindMap/MindMapEditor`.
- Principais exports: `MindMapHudPage`, `default`.
- Principais funcoes/classes/simbolos: `MindMapHudPage`, `nodeCount`, `edgeCount`.
- Principais estados/dados manipulados: Mapas mentais, nodes, edges, status, historico, layout e export.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/pages/learningPlannerHudViewModel.js`

- Caminho relativo: `src/hud/pages/learningPlannerHudViewModel.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: HUD.
- Responsabilidade principal: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks.
- O que faz: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando a pagina correspondente do HUD e renderizada.
- Quem chama/importa: `src/hud/pages/AutonomousLearningHudPage.jsx`, `src/hud/pages/AutonomousLearningHudPage.test.jsx`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `createLearningPlannerHudRequest`.
- Principais funcoes/classes/simbolos: `createLearningPlannerHudRequest`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/pages/runnerHudViewModel.js`

- Caminho relativo: `src/hud/pages/runnerHudViewModel.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: HUD.
- Responsabilidade principal: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks.
- O que faz: Componente ou view model do HUD para apresentar estado operacional e acionar callbacks. Manipula principalmente: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Quando e usado: Quando a pagina correspondente do HUD e renderizada.
- Quem chama/importa: `src/hud/pages/AutonomousRunnerHudPage.jsx`, `src/hud/pages/runnerHudViewModel.test.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `RUNNER_PRIORITY_ORDER`, `RUNNER_ACTIVE_STATUS_ORDER`, `RUNNER_TERMINAL_STATUSES`, `RUNNER_EVIDENCE_STATUS_LABELS`, `isTerminalRunnerTask`, `sortRunnerTasksForHud`, `getRunnerQueueMove`, `getRunnerEvidencePhysicalStatus`, `formatRunnerEvidencePhysicalStatus`.
- Principais funcoes/classes/simbolos: `RUNNER_PRIORITY_ORDER`, `RUNNER_ACTIVE_STATUS_ORDER`, `RUNNER_TERMINAL_STATUSES`, `RUNNER_EVIDENCE_STATUS_LABELS`, `toMs`, `parsed`, `priorityRank`, `statusRank`, `isTerminalRunnerTask`, `sortRunnerTasksForHud`, `getRunnerQueueMove`, `currentTask`, `samePriorityTasks`, `currentIndex`, `targetIndex`, `targetTask`, `getRunnerEvidencePhysicalStatus`, `status`, `formatRunnerEvidencePhysicalStatus`.
- Principais estados/dados manipulados: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: `src/hud/pages/runnerHudViewModel.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/hud/pages/runnerHudViewModel.test.js`

- Caminho relativo: `src/hud/pages/runnerHudViewModel.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/hud/pages/runnerHudViewModel.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `task`, `sorted`, `tasks`, `doneTask`.
- Principais estados/dados manipulados: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/hud/pages/runnerHudViewModel.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/index.css`

- Caminho relativo: `src/index.css`.
- Tipo: UI/asset textual (.css).
- Dominio funcional: Frontend/orquestracao.
- Responsabilidade principal: Modulo auxiliar do projeto.
- O que faz: Modulo auxiliar do projeto. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/main.jsx`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: nenhum identificado estaticamente.
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/knowledgePipeline.js`

- Caminho relativo: `src/knowledgePipeline.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Conhecimento web.
- Responsabilidade principal: Classificacao, pipeline ou executor de conhecimento web.
- O que faz: Classificacao, pipeline ou executor de conhecimento web. Manipula principalmente: Navigation context, snapshots de pagina, secoes, links, fontes, suficiencia e timeline.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/knowledgePipeline.test.js`, `src/knowledgeToolExecutor.js`.
- Quem chama/importa internamente: `src/webKnowledge.js`.
- Principais exports: `executeKnowledgeTool`.
- Principais funcoes/classes/simbolos: `DEFAULT_MAX_SECTIONS`, `DEFAULT_MAX_RESULTS`, `DEFAULT_REFRESH_TIMEOUT_MS`, `MAX_INTERNAL_LINK_FETCHES`, `MAX_SAME_DOMAIN_FETCHES`, `MAX_GLOBAL_FETCHES`, `GENERIC_NAVIGATION_TOKENS`, `normalizeComparableText`, `clampCount`, `normalized`, `canonicalizeUrl`, `url`, `getDomain`, `uniqueStrings`, `createTraceEvent`, `createToolCallTrace`, `createRefreshTrace`, `buildAnswerMode`, `buildResponseGuidance`, `buildSummaryHint` (+60).
- Principais estados/dados manipulados: Navigation context, snapshots de pagina, secoes, links, fontes, suficiencia e timeline.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: critico.
- Risco de alteracao: Alteracao pode quebrar fluxo central ou seguranca; revisar dependentes, testes e efeitos colaterais antes.
- Testes relacionados: `src/knowledgePipeline.test.js`.
- Observacoes tecnicas: arquivo central; ler fluxo completo antes de alterar.

## `src/knowledgePipeline.test.js`

- Caminho relativo: `src/knowledgePipeline.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Navigation context, snapshots de pagina, secoes, links, fontes, suficiencia e timeline.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/knowledgePipeline.js`, `src/webKnowledge.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `buildContext`, `buildPage`, `invokeTool`.
- Principais estados/dados manipulados: Navigation context, snapshots de pagina, secoes, links, fontes, suficiencia e timeline.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/knowledgePipeline.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/knowledgeToolExecutor.js`

- Caminho relativo: `src/knowledgeToolExecutor.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Conhecimento web.
- Responsabilidade principal: Classificacao, pipeline ou executor de conhecimento web.
- O que faz: Classificacao, pipeline ou executor de conhecimento web. Manipula principalmente: Navigation context, snapshots de pagina, secoes, links, fontes, suficiencia e timeline.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/App.jsx`, `src/knowledgeToolExecutor.test.js`.
- Quem chama/importa internamente: `src/knowledgePipeline.js`.
- Principais exports: `KNOWLEDGE_TOOL_NAMES`, `isKnowledgeToolName`, `normalizeKnowledgeToolResponse`, `executeKnowledgeFunctionCall`.
- Principais funcoes/classes/simbolos: `KNOWLEDGE_TOOL_NAMES`, `isKnowledgeToolName`, `normalizeKnowledgeToolResponse`, `artifacts`, `executeKnowledgeFunctionCall`, `toolName`, `normalizedInvokeTool`.
- Principais estados/dados manipulados: Navigation context, snapshots de pagina, secoes, links, fontes, suficiencia e timeline.
- Efeitos colaterais: Pode atualizar memoria/estado e chamar Tauri via invoke conforme tool.
- Nivel de criticidade: critico.
- Risco de alteracao: Alteracao pode quebrar fluxo central ou seguranca; revisar dependentes, testes e efeitos colaterais antes.
- Testes relacionados: `src/knowledgeToolExecutor.test.js`.
- Observacoes tecnicas: arquivo central; ler fluxo completo antes de alterar.

## `src/knowledgeToolExecutor.test.js`

- Caminho relativo: `src/knowledgeToolExecutor.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Navigation context, snapshots de pagina, secoes, links, fontes, suficiencia e timeline.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/knowledgeToolExecutor.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `response`, `invokeTool`, `result`.
- Principais estados/dados manipulados: Navigation context, snapshots de pagina, secoes, links, fontes, suficiencia e timeline.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/knowledgeToolExecutor.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/learningPlanner/fakeLearningPlannerModelClient.js`

- Caminho relativo: `src/learningPlanner/fakeLearningPlannerModelClient.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Learning planner.
- Responsabilidade principal: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao.
- O que faz: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/learningPlanner/learningPlanner.test.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `createFakeLearningPlannerModelAdapter`.
- Principais funcoes/classes/simbolos: `createFakeLearningPlannerModelAdapter`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/learningPlanner/learningEvaluator.js`

- Caminho relativo: `src/learningPlanner/learningEvaluator.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Learning planner.
- Responsabilidade principal: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao.
- O que faz: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/learningPlanner/learningPlanner.test.js`, `src/learningPlanner/learningProcedureSynthesizer.js`.
- Quem chama/importa internamente: `src/learningPlanner/../aliceMemory`, `src/learningPlanner/../autonomousRunnerState`, `src/learningPlanner/learningPlannerRepository.js`, `src/learningPlanner/learningPlannerExecution.js`, `src/learningPlanner/learningPlannerTypes.js`.
- Principais exports: `LEARNING_SKILL_EVALUATION_STATUS`, `evaluateLearningSkill`, `evaluateLearningPlanSkills`, `evaluateLearningPlanFromMemory`.
- Principais funcoes/classes/simbolos: `LEARNING_SKILL_EVALUATION_STATUS`, `SUCCESSFUL_ATTEMPTS_FOR_CONSOLIDATION`, `FAILURES_BEFORE_REVIEW`, `evidenceIdsFromRunnerTask`, `latestValidationForAttempt`, `stepId`, `history`, `hasValidatedEvidence`, `validation`, `runnerEvidenceIds`, `attemptEvidenceIds`, `attemptFailureReason`, `attemptsForSkill`, `runnerTaskForAttempt`, `evaluateLearningSkill`, `normalizedRunner`, `skillId`, `attempts`, `validatedAttempts`, `claimedSuccessWithoutEvidence` (+10).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/learningPlanner/learningPlanSchema.js`

- Caminho relativo: `src/learningPlanner/learningPlanSchema.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Learning planner.
- Responsabilidade principal: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao.
- O que faz: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/learningPlanner/learningPlanValidator.js`, `src/learningPlanner/learningPlanner.test.js`, `src/learningPlanner/learningPlannerClient.js`.
- Quem chama/importa internamente: `src/learningPlanner/learningPlannerTypes.js`.
- Principais exports: `validateLearningPlanSchema`, `assertValidLearningPlanSchema`.
- Principais funcoes/classes/simbolos: `DANGEROUS_ACTION_PATTERN`, `addIssue`, `isObject`, `includesEnum`, `validateText`, `riskRank`, `index`, `classifyActionRisk`, `normalizedKind`, `text`, `explicitDecision`, `level`, `dangerous`, `unknownAction`, `validateEvidenceRequirement`, `validateRisk`, `validateSkill`, `validateTrainingTask`, `actionKindKnown`, `riskDecisionText` (+12).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/learningPlanner/learningPlanValidator.js`

- Caminho relativo: `src/learningPlanner/learningPlanValidator.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Learning planner.
- Responsabilidade principal: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao.
- O que faz: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/learningPlanner/learningPlanner.test.js`, `src/learningPlanner/learningPlannerService.js`, `src/learningPlanner/learningTaskCompiler.js`.
- Quem chama/importa internamente: `src/learningPlanner/learningPlanSchema.js`, `src/learningPlanner/learningPlannerTypes.js`.
- Principais exports: `LEARNING_PLAN_VALIDATION_DECISION`, `validateLearningPlanForExecution`.
- Principais funcoes/classes/simbolos: `LEARNING_PLAN_VALIDATION_DECISION`, `DEFAULT_AVAILABLE_TOOLS`, `destructiveFilesystemPattern`, `installPattern`, `loginPattern`, `messagePattern`, `purchasePattern`, `bypassRunnerPattern`, `learnedPattern`, `addFinding`, `planText`, `taskTexts`, `hasObjectiveValidation`, `hasExpectedEvidence`, `normalizeTool`, `reviewRequiredTools`, `available`, `requiredTools`, `unavailable`, `approvalReasonForTaskText` (+15).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/learningPlanner/learningPlanner.test.js`

- Caminho relativo: `src/learningPlanner/learningPlanner.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `react`, `react-dom/server`, `src/learningPlanner/../aliceMemory`, `src/learningPlanner/../debugHud`, `src/learningPlanner/../dev/autonomousRunnerHarness`, `src/learningPlanner/../autonomousRunnerEvidence`, `src/learningPlanner/../autonomousRunnerPreflight`, `src/learningPlanner/../autonomousRunnerValidation`, `src/learningPlanner/../hud/pages/AutonomousLearningHudPage`, `src/learningPlanner/learningPlannerTypes.js`, `src/learningPlanner/learningPlanSchema.js`, `src/learningPlanner/learningPlannerClient.js`, `src/learningPlanner/fakeLearningPlannerModelClient.js`, `src/learningPlanner/learningPlannerService.js`, `src/learningPlanner/learningPlanValidator.js` (+6).
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `validPlan`, `validModelResponse`, `validExecutablePracticePlan`, `createRunnerInvoke`, `learningAttempt`, `runnerTaskForAttempt`, `runnerForAttempts`, `memoryWithConsolidationCandidate`, `attempts`, `plan`, `withPlanner`, `result`, `memory`, `validation`, `nextMemory`, `state`, `rejected`, `client`, `timeout`, `service` (+31).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/learningPlanner/learningPlanner.test.js`.
- Observacoes tecnicas: alto fan-in de dependencias importadas.

## `src/learningPlanner/learningPlannerClient.js`

- Caminho relativo: `src/learningPlanner/learningPlannerClient.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Learning planner.
- Responsabilidade principal: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao.
- O que faz: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/learningPlanner/learningPlanner.test.js`, `src/learningPlanner/learningPlannerService.js`.
- Quem chama/importa internamente: `src/learningPlanner/learningPlannerTypes.js`, `src/learningPlanner/learningPlanSchema.js`.
- Principais exports: `LEARNING_PLANNER_MODEL_SCHEMA_NAME`, `LEARNING_PLANNER_MODEL_RESPONSE_JSON_SCHEMA`, `createLearningPlannerPrompt`, `validateLearningPlannerModelResponse`, `convertModelResponseToLearningPlan`, `LearningPlannerClient`, `createOpenAIResponsesLearningPlannerAdapter`.
- Principais funcoes/classes/simbolos: `LEARNING_PLANNER_MODEL_SCHEMA_NAME`, `LEARNING_PLANNER_MODEL_RESPONSE_JSON_SCHEMA`, `createLearningPlannerPrompt`, `normalizedRequest`, `isObject`, `issue`, `parseModelPayload`, `validateStringArray`, `validateLearningPlannerModelResponse`, `issues`, `skills`, `trainingTasks`, `planRiskFromModel`, `risks`, `approval`, `invalid`, `source`, `convertModelResponseToLearningPlan`, `resultFromFailure`, `now` (+12).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/learningPlanner/learningPlannerExecution.js`

- Caminho relativo: `src/learningPlanner/learningPlannerExecution.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Learning planner.
- Responsabilidade principal: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao.
- O que faz: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/learningPlanner/learningEvaluator.js`, `src/learningPlanner/learningPlanner.test.js`.
- Quem chama/importa internamente: `src/learningPlanner/../aliceMemory`, `src/learningPlanner/../autonomousTaskRunner`, `src/learningPlanner/../autonomousRunnerState`, `src/learningPlanner/learningPlannerRepository.js`, `src/learningPlanner/learningPlannerTypes.js`, `src/learningPlanner/learningTaskCompiler.js`.
- Principais exports: `LEARNING_PRACTICE_STATUS`, `createLearningPracticeAttempt`, `normalizeLearningPracticeAttempts`, `enqueueLearningPlanPracticeTasks`, `recordLearningPracticeRunnerResult`, `runLearningPlanPracticeRunnerTick`.
- Principais funcoes/classes/simbolos: `LEARNING_PRACTICE_STATUS`, `LEARNING_PRACTICE_STATUSES`, `normalizePracticeStatus`, `normalized`, `createLearningPracticeAttempt`, `normalizeLearningPracticeAttempts`, `upsertAttempt`, `nextAttempt`, `filtered`, `evidenceRefIds`, `executionIds`, `statusFromRunnerResult`, `taskStatus`, `validationPassed`, `evidenceOk`, `auditEvent`, `practiceStatusAuditEvents`, `statuses`, `enqueueLearningPlanPracticeTasks`, `state` (+17).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/learningPlanner/learningPlannerRepository.js`

- Caminho relativo: `src/learningPlanner/learningPlannerRepository.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Learning planner.
- Responsabilidade principal: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao.
- O que faz: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/learningPlanner/learningEvaluator.js`, `src/learningPlanner/learningPlanner.test.js`, `src/learningPlanner/learningPlannerExecution.js`, `src/learningPlanner/learningPlannerService.js`.
- Quem chama/importa internamente: `src/learningPlanner/learningPlannerTypes.js`, `src/learningPlanner/learningPlannerState.js`.
- Principais exports: `getLearningPlannerState`, `updateLearningPlannerState`, `saveLearningPlanRecord`, `setLearningPlanStatusInMemory`.
- Principais funcoes/classes/simbolos: `getAutonomousLearning`, `getLearningPlannerState`, `updateLearningPlannerState`, `currentState`, `nextState`, `saveLearningPlanRecord`, `plan`, `planRecord`, `planOrder`, `retained`, `plansById`, `setLearningPlanStatusInMemory`, `result`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/learningPlanner/learningPlannerService.js`

- Caminho relativo: `src/learningPlanner/learningPlannerService.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Learning planner.
- Responsabilidade principal: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao.
- O que faz: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/App.jsx`, `src/debugHud.js`, `src/learningPlanner/learningPlanner.test.js`.
- Quem chama/importa internamente: `src/learningPlanner/learningPlannerClient.js`, `src/learningPlanner/learningPlannerTypes.js`, `src/learningPlanner/learningPlannerRepository.js`, `src/learningPlanner/learningPlanValidator.js`.
- Principais exports: `createLocalLearningPlannerModelAdapter`, `createLearningPlannerService`, `summarizeLearningPlannerForHud`.
- Principais funcoes/classes/simbolos: `safeIdPart`, `createLocalLearningPlannerModelAdapter`, `objective`, `dangerous`, `risk`, `failurePlanFromResult`, `createLearningPlannerService`, `client`, `timestamp`, `result`, `planToSave`, `state`, `activePlanId`, `activePlan`, `validation`, `summarizeLearningPlannerForHud`, `plansById`.
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/learningPlanner/learningPlannerState.js`

- Caminho relativo: `src/learningPlanner/learningPlannerState.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Learning planner.
- Responsabilidade principal: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao.
- O que faz: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/learningPlanner/learningPlanner.test.js`, `src/learningPlanner/learningPlannerRepository.js`.
- Quem chama/importa internamente: `src/learningPlanner/learningPlannerTypes.js`.
- Principais exports: `createEmptyLearningPlannerState`, `normalizeLearningPlannerState`, `canTransitionLearningPlanStatus`, `transitionLearningPlanStatus`.
- Principais funcoes/classes/simbolos: `createEmptyLearningPlannerState`, `bounded`, `normalizePracticeAttempt`, `normalizePlanRecord`, `normalized`, `normalizeLearningPlannerState`, `base`, `source`, `plansById`, `sourcePlans`, `planOrder`, `retainedPlanIds`, `activePlanId`, `canTransitionLearningPlanStatus`, `from`, `to`, `transitions`, `transitionLearningPlanStatus`, `normalizedState`, `targetPlan` (+1).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/learningPlanner/learningPlannerTypes.js`

- Caminho relativo: `src/learningPlanner/learningPlannerTypes.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Learning planner.
- Responsabilidade principal: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao.
- O que faz: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/learningPlanner/learningEvaluator.js`, `src/learningPlanner/learningPlanSchema.js`, `src/learningPlanner/learningPlanValidator.js`, `src/learningPlanner/learningPlanner.test.js`, `src/learningPlanner/learningPlannerClient.js`, `src/learningPlanner/learningPlannerExecution.js`, `src/learningPlanner/learningPlannerRepository.js`, `src/learningPlanner/learningPlannerService.js`, `src/learningPlanner/learningPlannerState.js`, `src/learningPlanner/learningProcedureSynthesizer.js`, `src/learningPlanner/learningTaskCompiler.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `LEARNING_PLANNER_SCHEMA_VERSION`, `LEARNING_PLAN_STATUS`, `LEARNING_RISK_LEVEL`, `LEARNING_RISK_DECISION`, `LEARNING_EVIDENCE_KIND`, `LEARNING_TRAINING_ACTION_KIND`, `LEARNING_PLANNER_CREATED_BY`, `LEARNING_PLAN_STATUSES`, `LEARNING_RISK_LEVELS`, `LEARNING_RISK_DECISIONS`, `LEARNING_EVIDENCE_KINDS`, `LEARNING_TRAINING_ACTION_KINDS`, `LEARNING_PLAN_LIMITS`, `normalizeText`, `normalizeArray`, `createLearningEvidenceRequirement`, `createLearningRisk`, `createLearningTrainingTask` (+3).
- Principais funcoes/classes/simbolos: `LEARNING_PLANNER_SCHEMA_VERSION`, `LEARNING_PLAN_STATUS`, `LEARNING_RISK_LEVEL`, `LEARNING_RISK_DECISION`, `LEARNING_EVIDENCE_KIND`, `LEARNING_TRAINING_ACTION_KIND`, `LEARNING_PLANNER_CREATED_BY`, `LEARNING_PLAN_STATUSES`, `LEARNING_RISK_LEVELS`, `LEARNING_RISK_DECISIONS`, `LEARNING_EVIDENCE_KINDS`, `LEARNING_TRAINING_ACTION_KINDS`, `LEARNING_PLAN_LIMITS`, `normalizeText`, `normalizeArray`, `normalizeEnum`, `normalized`, `truncateText`, `createLearningEvidenceRequirement`, `createLearningRisk` (+4).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: muitos dependentes estaticos.

## `src/learningPlanner/learningProcedureSynthesizer.js`

- Caminho relativo: `src/learningPlanner/learningProcedureSynthesizer.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Learning planner.
- Responsabilidade principal: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao.
- O que faz: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/learningPlanner/learningPlanner.test.js`.
- Quem chama/importa internamente: `src/learningPlanner/../aliceMemory`, `src/learningPlanner/../autonomousLearning/learning`, `src/learningPlanner/learningEvaluator.js`, `src/learningPlanner/learningPlannerTypes.js`.
- Principais exports: `LEARNING_PROCEDURE_STATUS`, `synthesizeProcedureCandidateFromLearningSkill`, `synthesizeProcedureCandidatesFromLearningPlan`, `synthesizeLearningProcedureCandidatesInMemory`.
- Principais funcoes/classes/simbolos: `LEARNING_PROCEDURE_STATUS`, `toSafeIdPart`, `uniqueTexts`, `seen`, `key`, `skillTrainingTasks`, `taskIds`, `tasks`, `matched`, `triggerExamplesForSkill`, `stepsForSkill`, `validationCriteriaForSkill`, `successRateForEvaluation`, `successes`, `failures`, `total`, `synthesizeProcedureCandidateFromLearningSkill`, `evidenceRefs`, `skillId`, `successRate` (+21).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/learningPlanner/learningTaskCompiler.js`

- Caminho relativo: `src/learningPlanner/learningTaskCompiler.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Learning planner.
- Responsabilidade principal: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao.
- O que faz: Parte do planejador de aprendizado estruturado, schema, validacao, execucao ou consolidacao. Manipula principalmente: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/learningPlanner/learningPlanner.test.js`, `src/learningPlanner/learningPlannerExecution.js`.
- Quem chama/importa internamente: `src/learningPlanner/../aliceMemory`, `src/learningPlanner/../autonomousRunnerState`, `src/learningPlanner/../filesystem/filesystemNameSanitizer`, `src/learningPlanner/learningPlannerTypes.js`, `src/learningPlanner/learningPlanValidator.js`.
- Principais exports: `LEARNING_PLANNER_CREATED_BY`, `compileLearningPlanToRunnerTasks`, `enqueueCompiledLearningPlanTasks`.
- Principais funcoes/classes/simbolos: `LEARNING_PLANNER_CREATED_BY`, `toSafeIdPart`, `runnerEvidenceKindForLearningEvidence`, `requiredEvidenceTokens`, `tokens`, `findSkillForTrainingTask`, `taskId`, `explicitSkillId`, `validationDescriptionForTask`, `compilePracticeCommandArgs`, `folderNameInputForTask`, `createFolderResolution`, `originalRequestedName`, `sanitization`, `targetPath`, `validation`, `compileCreateFolderCommandArgs`, `fs`, `path`, `resolution` (+25).
- Principais estados/dados manipulados: Goals, gaps, tasks de treino, candidates, procedures, policies, logs, audits e VM status.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/liveAudio.js`

- Caminho relativo: `src/liveAudio.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Gemini Live/audio/tela.
- Responsabilidade principal: Modulo de conversa multimodal, audio PCM, tela, sessao Live ou contexto operacional.
- O que faz: Modulo de conversa multimodal, audio PCM, tela, sessao Live ou contexto operacional. Manipula principalmente: Audio PCM/base64, frames JPEG, WebSocket messages, transcripts, setup e session resumption.
- Quando e usado: Durante start/stop/reconexao da sessao Live e streaming multimodal.
- Quem chama/importa: `src/App.jsx`, `src/liveAudio.test.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `resampleFloat32`, `bytesToBase64`, `base64ToBytes`, `calculateRms`, `float32ToPcm16Bytes`, `encodePcm16Base64`, `decodePcm16Base64`.
- Principais funcoes/classes/simbolos: `PCM_MIN`, `PCM_MAX`, `resampleFloat32`, `ratio`, `outputLength`, `output`, `inputIndex`, `bytesToBase64`, `chunkSize`, `chunk`, `base64ToBytes`, `binary`, `bytes`, `calculateRms`, `squareSum`, `float32ToPcm16Bytes`, `view`, `clamped`, `pcm`, `encodePcm16Base64` (+3).
- Principais estados/dados manipulados: Audio PCM/base64, frames JPEG, WebSocket messages, transcripts, setup e session resumption.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: `src/liveAudio.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/liveAudio.test.js`

- Caminho relativo: `src/liveAudio.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/liveAudio.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `samples`, `encoded`, `decoded`.
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/liveAudio.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/liveDiagnostics.js`

- Caminho relativo: `src/liveDiagnostics.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Gemini Live/audio/tela.
- Responsabilidade principal: Modulo de conversa multimodal, audio PCM, tela, sessao Live ou contexto operacional.
- O que faz: Modulo de conversa multimodal, audio PCM, tela, sessao Live ou contexto operacional. Manipula principalmente: Audio PCM/base64, frames JPEG, WebSocket messages, transcripts, setup e session resumption.
- Quando e usado: Durante start/stop/reconexao da sessao Live e streaming multimodal.
- Quem chama/importa: `src/App.test.js`, `src/appUiState.js`, `src/liveDiagnostics.test.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `createLiveDiagnostics`, `updateLiveDiagnostics`.
- Principais funcoes/classes/simbolos: `createLiveDiagnostics`, `closeReasonLabels`, `updateLiveDiagnostics`.
- Principais estados/dados manipulados: Audio PCM/base64, frames JPEG, WebSocket messages, transcripts, setup e session resumption.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: `src/liveDiagnostics.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/liveDiagnostics.test.js`

- Caminho relativo: `src/liveDiagnostics.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/liveDiagnostics.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `diagnostics`.
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/liveDiagnostics.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/liveSessionOrchestrator.js`

- Caminho relativo: `src/liveSessionOrchestrator.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Gemini Live/audio/tela.
- Responsabilidade principal: Modulo de conversa multimodal, audio PCM, tela, sessao Live ou contexto operacional.
- O que faz: Modulo de conversa multimodal, audio PCM, tela, sessao Live ou contexto operacional. Manipula principalmente: Audio PCM/base64, frames JPEG, WebSocket messages, transcripts, setup e session resumption.
- Quando e usado: Durante start/stop/reconexao da sessao Live e streaming multimodal.
- Quem chama/importa: `src/App.jsx`, `src/liveSessionOrchestrator.test.js`.
- Quem chama/importa internamente: `src/geminiLive.js`.
- Principais exports: `GO_AWAY_RENEW_BUFFER_MS`, `MAX_SETUP_TIMEOUT_RETRIES`, `parseDurationToMs`, `LiveSessionOrchestrator`.
- Principais funcoes/classes/simbolos: `GO_AWAY_RENEW_BUFFER_MS`, `MAX_SETUP_TIMEOUT_RETRIES`, `timerHost`, `parseDurationToMs`, `match`, `delayMs`, `session`, `reconnectToken`, `nextGeneration`, `initialHistoryTurns`, `setup`, `previousSession`, `LiveSessionOrchestrator`.
- Principais estados/dados manipulados: Audio PCM/base64, frames JPEG, WebSocket messages, transcripts, setup e session resumption.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: critico.
- Risco de alteracao: Alteracao pode quebrar fluxo central ou seguranca; revisar dependentes, testes e efeitos colaterais antes.
- Testes relacionados: `src/liveSessionOrchestrator.test.js`.
- Observacoes tecnicas: arquivo central; ler fluxo completo antes de alterar.

## `src/liveSessionOrchestrator.test.js`

- Caminho relativo: `src/liveSessionOrchestrator.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/geminiLive.js`, `src/liveSessionOrchestrator.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `buildSetupStub`, `setup`, `buildConnectError`, `error`, `createSessionFactory`, `sessions`, `createSession`, `behavior`, `session`, `sessionReady`, `orchestrator`, `reconnectGate`, `firstReconnect`, `secondReconnect`, `statusUpdates`, `memoryPrefixTurns`, `closeReasons`.
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/liveSessionOrchestrator.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/liveSessionRehydration.js`

- Caminho relativo: `src/liveSessionRehydration.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Gemini Live/audio/tela.
- Responsabilidade principal: Modulo de conversa multimodal, audio PCM, tela, sessao Live ou contexto operacional.
- O que faz: Modulo de conversa multimodal, audio PCM, tela, sessao Live ou contexto operacional. Manipula principalmente: Audio PCM/base64, frames JPEG, WebSocket messages, transcripts, setup e session resumption.
- Quando e usado: Durante start/stop/reconexao da sessao Live e streaming multimodal.
- Quem chama/importa: `src/App.jsx`, `src/liveSessionRehydration.test.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `trimRehydrationSnippet`, `buildSessionRehydrationTurns`.
- Principais funcoes/classes/simbolos: `REHYDRATION_TEXT_LIMIT`, `trimRehydrationSnippet`, `normalized`, `buildSessionRehydrationTurns`, `lines`, `inputText`, `outputText`.
- Principais estados/dados manipulados: Audio PCM/base64, frames JPEG, WebSocket messages, transcripts, setup e session resumption.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: `src/liveSessionRehydration.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/liveSessionRehydration.test.js`

- Caminho relativo: `src/liveSessionRehydration.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/liveSessionRehydration.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `trimmed`, `turns`.
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/liveSessionRehydration.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/liveSessionTransport.js`

- Caminho relativo: `src/liveSessionTransport.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Gemini Live/audio/tela.
- Responsabilidade principal: Modulo de conversa multimodal, audio PCM, tela, sessao Live ou contexto operacional.
- O que faz: Modulo de conversa multimodal, audio PCM, tela, sessao Live ou contexto operacional. Manipula principalmente: Audio PCM/base64, frames JPEG, WebSocket messages, transcripts, setup e session resumption.
- Quando e usado: Durante start/stop/reconexao da sessao Live e streaming multimodal.
- Quem chama/importa: `src/App.jsx`, `src/liveSessionTransport.test.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `createFunctionResponseEnvelope`, `LiveSessionTransport`.
- Principais funcoes/classes/simbolos: `createFunctionResponseEnvelope`, `functionResponses`, `LiveSessionTransport`.
- Principais estados/dados manipulados: Audio PCM/base64, frames JPEG, WebSocket messages, transcripts, setup e session resumption.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: critico.
- Risco de alteracao: Alteracao pode quebrar fluxo central ou seguranca; revisar dependentes, testes e efeitos colaterais antes.
- Testes relacionados: `src/liveSessionTransport.test.js`.
- Observacoes tecnicas: arquivo central; ler fluxo completo antes de alterar.

## `src/liveSessionTransport.test.js`

- Caminho relativo: `src/liveSessionTransport.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/liveSessionTransport.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `call`, `transport`, `session`, `previousSession`, `resumedSession`, `functionResponse`, `replayedResponses`, `recreatedSession`, `firstSession`, `result`.
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/liveSessionTransport.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/main.jsx`

- Caminho relativo: `src/main.jsx`.
- Tipo: UI/asset textual (.jsx).
- Dominio funcional: Frontend/orquestracao.
- Responsabilidade principal: Ponto de entrada React que monta App e CSS globais.
- O que faz: Ponto de entrada React que monta App e CSS globais. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `react`, `react-dom/client`, `src/index.css`, `@xyflow/react/dist/style.css`, `src/App.jsx`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: nenhum identificado estaticamente.
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/mindMapData.test.js`

- Caminho relativo: `src/mindMapData.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Mapas mentais, nodes, edges, status, historico, layout e export.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/hud/mindMap/utils/mindMapData.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `upgraded`, `normalized`, `mindMap`.
- Principais estados/dados manipulados: Mapas mentais, nodes, edges, status, historico, layout e export.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/mindMapData.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/mindMapExecutionSync.js`

- Caminho relativo: `src/mindMapExecutionSync.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Mind map.
- Responsabilidade principal: Modelo, executor, editor ou utilitario do mapa mental persistente.
- O que faz: Modelo, executor, editor ou utilitario do mapa mental persistente. Manipula principalmente: Mapas mentais, nodes, edges, status, historico, layout e export.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/App.jsx`, `src/mindMapExecutionSync.test.js`.
- Quem chama/importa internamente: `src/hud/mindMap/utils/mindMapData.js`.
- Principais exports: `syncMindMapWithExecution`, `default`.
- Principais funcoes/classes/simbolos: `normalizeText`, `includesAny`, `classifyExecutionStatus`, `status`, `message`, `artifacts`, `findExecutionNode`, `candidates`, `directMatch`, `metadataMatch`, `goalId`, `buildDescription`, `parts`, `syncMindMapWithExecution`, `baseMap`, `targetNode`, `now`, `metadata`, `helpers`, `withStatus` (+3).
- Principais estados/dados manipulados: Mapas mentais, nodes, edges, status, historico, layout e export.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: `src/mindMapExecutionSync.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/mindMapExecutionSync.test.js`

- Caminho relativo: `src/mindMapExecutionSync.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Mapas mentais, nodes, edges, status, historico, layout e export.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/hud/mindMap/utils/mindMapData.js`, `src/mindMapExecutionSync.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `createGoalMap`, `result`.
- Principais estados/dados manipulados: Mapas mentais, nodes, edges, status, historico, layout e export.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/mindMapExecutionSync.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/mindMapIntentInterpreter.js`

- Caminho relativo: `src/mindMapIntentInterpreter.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Mind map.
- Responsabilidade principal: Modelo, executor, editor ou utilitario do mapa mental persistente.
- O que faz: Modelo, executor, editor ou utilitario do mapa mental persistente. Manipula principalmente: Mapas mentais, nodes, edges, status, historico, layout e export.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/mindMapIntentInterpreter.test.js`.
- Quem chama/importa internamente: `src/hud/mindMap/utils/mindMapData.js`.
- Principais exports: `interpretMindMapIntent`, `default`.
- Principais funcoes/classes/simbolos: `normalizeText`, `withTargetMapId`, `getContextMindMap`, `findNodesByReference`, `normalizedReference`, `exactMatches`, `nodeId`, `label`, `findNodeByReference`, `needsClarification`, `resolveSingleNode`, `contextualId`, `contextualNode`, `matches`, `extractCreateTopic`, `match`, `extractRename`, `extractConnection`, `extractDependency`, `extractAddNodeLabel` (+20).
- Principais estados/dados manipulados: Mapas mentais, nodes, edges, status, historico, layout e export.
- Efeitos colaterais: Efeito direto limitado a UI/callbacks; persistencia ocorre quando App/memoria aplica mudanca.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: `src/mindMapIntentInterpreter.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/mindMapIntentInterpreter.test.js`

- Caminho relativo: `src/mindMapIntentInterpreter.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Mapas mentais, nodes, edges, status, historico, layout e export.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/hud/mindMap/utils/mindMapData.js`, `src/mindMapIntentInterpreter.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `operations`, `mindMap`.
- Principais estados/dados manipulados: Mapas mentais, nodes, edges, status, historico, layout e export.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/mindMapIntentInterpreter.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/mindMapToolExecutor.js`

- Caminho relativo: `src/mindMapToolExecutor.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Mind map.
- Responsabilidade principal: Modelo, executor, editor ou utilitario do mapa mental persistente.
- O que faz: Modelo, executor, editor ou utilitario do mapa mental persistente. Manipula principalmente: Mapas mentais, nodes, edges, status, historico, layout e export.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/App.jsx`, `src/mindMapToolExecutor.test.js`.
- Quem chama/importa internamente: `uuid`, `src/hud/mindMap/utils/export.js`, `src/hud/mindMap/utils/layout.js`, `src/hud/mindMap/utils/mindMapData.js`, `src/aliceMemory.js`.
- Principais exports: `MIND_MAP_TOOL_NAMES`, `isMindMapToolName`, `applyMindMapOperation`, `executeMindMapFunctionCall`.
- Principais funcoes/classes/simbolos: `MIND_MAP_TOOL_NAMES`, `isMindMapToolName`, `normalizeString`, `buildResponse`, `createNode`, `findNode`, `buildStatusMap`, `nodeId`, `statusByOperation`, `status`, `helpers`, `nextMap`, `applyMindMapOperation`, `baseMindMap`, `replacement`, `normalizedReplacement`, `layoutedReplacement`, `node`, `parentId`, `source` (+27).
- Principais estados/dados manipulados: Mapas mentais, nodes, edges, status, historico, layout e export.
- Efeitos colaterais: Pode atualizar memoria/estado e chamar Tauri via invoke conforme tool.
- Nivel de criticidade: critico.
- Risco de alteracao: Alteracao pode quebrar fluxo central ou seguranca; revisar dependentes, testes e efeitos colaterais antes.
- Testes relacionados: `src/mindMapToolExecutor.test.js`.
- Observacoes tecnicas: arquivo central; ler fluxo completo antes de alterar.

## `src/mindMapToolExecutor.test.js`

- Caminho relativo: `src/mindMapToolExecutor.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Mapas mentais, nodes, edges, status, historico, layout e export.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/hud/mindMap/utils/mindMapData.js`, `src/mindMapToolExecutor.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `result`, `currentMindMap`, `renamed`, `exported`, `removed`, `mapA`, `mapB`, `updated`, `rolledBack`, `activeMap`.
- Principais estados/dados manipulados: Mapas mentais, nodes, edges, status, historico, layout e export.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/mindMapToolExecutor.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/operationalContext.js`

- Caminho relativo: `src/operationalContext.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Gemini Live/audio/tela.
- Responsabilidade principal: Modulo de conversa multimodal, audio PCM, tela, sessao Live ou contexto operacional.
- O que faz: Modulo de conversa multimodal, audio PCM, tela, sessao Live ou contexto operacional. Manipula principalmente: Audio PCM/base64, frames JPEG, WebSocket messages, transcripts, setup e session resumption.
- Quando e usado: Durante start/stop/reconexao da sessao Live e streaming multimodal.
- Quem chama/importa: `src/App.jsx`, `src/operationalContext.test.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `trimOperationalContextText`, `buildOperationalContextSnapshot`, `buildOperationalContextText`, `buildOperationalContextTurns`.
- Principais funcoes/classes/simbolos: `CONTEXT_TEXT_LIMIT`, `SOURCE_LIMIT`, `clean`, `trimOperationalContextText`, `normalized`, `freshAgeSeconds`, `value`, `formatSources`, `buildOperationalContextSnapshot`, `navigation`, `selectionText`, `visualAgent`, `latestVisualExecution`, `latestReplay`, `buildOperationalContextText`, `lines`, `buildOperationalContextTurns`, `snapshot`, `text`.
- Principais estados/dados manipulados: Audio PCM/base64, frames JPEG, WebSocket messages, transcripts, setup e session resumption.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: `src/operationalContext.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/operationalContext.test.js`

- Caminho relativo: `src/operationalContext.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/operationalContext.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `text`, `turns`, `snapshot`.
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/operationalContext.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/runnerAppDiagnostics.js`

- Caminho relativo: `src/runnerAppDiagnostics.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Autonomous Task Runner.
- Responsabilidade principal: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico.
- O que faz: Modulo auxiliar do Runner para planejamento, preflight, execucao, evidencia, recovery, HUD ou diagnostico. Manipula principalmente: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Quando e usado: Quando tasks sao enfileiradas, exibidas ou executadas pelo timer/harness/tool.
- Quem chama/importa: `src/App.jsx`, `src/runnerAppDiagnostics.test.js`.
- Quem chama/importa internamente: `src/aliceMemory.js`, `src/autonomousRunnerState.js`.
- Principais exports: `createTauriRuntimeMetadata`, `appendRunnerAppDiagnostic`, `createRunnerDiagnosticSnapshot`.
- Principais funcoes/classes/simbolos: `normalizeText`, `createTauriRuntimeMetadata`, `appendRunnerAppDiagnostic`, `createRunnerDiagnosticSnapshot`, `runner`.
- Principais estados/dados manipulados: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: alto.
- Risco de alteracao: Alteracao pode afetar runtime, persistencia, build ou execucao sensivel; exige testes direcionados.
- Testes relacionados: `src/runnerAppDiagnostics.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/runnerAppDiagnostics.test.js`

- Caminho relativo: `src/runnerAppDiagnostics.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/aliceMemory.js`, `src/runnerAppDiagnostics.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `memory`, `audit`, `snapshot`, `metadata`.
- Principais estados/dados manipulados: Runner state, tasks, steps, queue, leases, audits, evidenceRefs, validation results.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/runnerAppDiagnostics.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/screenFrameStreaming.js`

- Caminho relativo: `src/screenFrameStreaming.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Gemini Live/audio/tela.
- Responsabilidade principal: Modulo de conversa multimodal, audio PCM, tela, sessao Live ou contexto operacional.
- O que faz: Modulo de conversa multimodal, audio PCM, tela, sessao Live ou contexto operacional. Manipula principalmente: Audio PCM/base64, frames JPEG, WebSocket messages, transcripts, setup e session resumption.
- Quando e usado: Durante start/stop/reconexao da sessao Live e streaming multimodal.
- Quem chama/importa: `src/App.jsx`, `src/screenFrameStreaming.test.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `DEFAULT_SCREEN_FRAME_MAX_WIDTH`, `DEFAULT_SCREEN_FRAME_TARGET_FPS`, `DEFAULT_SCREEN_FRAME_INTERVAL_MS`, `DEFAULT_SCREEN_FRAME_JPEG_QUALITY`, `calculateScreenFrameSize`, `captureScreenFrame`, `startScreenFrameStreaming`.
- Principais funcoes/classes/simbolos: `DEFAULT_SCREEN_FRAME_MAX_WIDTH`, `DEFAULT_SCREEN_FRAME_TARGET_FPS`, `DEFAULT_SCREEN_FRAME_INTERVAL_MS`, `DEFAULT_SCREEN_FRAME_JPEG_QUALITY`, `calculateScreenFrameSize`, `width`, `height`, `limit`, `targetWidth`, `targetHeight`, `captureScreenFrame`, `frameSize`, `context`, `startScreenFrameStreaming`, `sendFrame`, `frame`, `intervalId`.
- Principais estados/dados manipulados: Audio PCM/base64, frames JPEG, WebSocket messages, transcripts, setup e session resumption.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: `src/screenFrameStreaming.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/screenFrameStreaming.test.js`

- Caminho relativo: `src/screenFrameStreaming.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/screenFrameStreaming.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `drawImage`, `video`, `canvas`, `frame`, `intervalIds`, `timerHost`, `onFrame`, `cleanup`.
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/screenFrameStreaming.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/screenGeometry.js`

- Caminho relativo: `src/screenGeometry.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Gemini Live/audio/tela.
- Responsabilidade principal: Modulo de conversa multimodal, audio PCM, tela, sessao Live ou contexto operacional.
- O que faz: Modulo de conversa multimodal, audio PCM, tela, sessao Live ou contexto operacional. Manipula principalmente: Audio PCM/base64, frames JPEG, WebSocket messages, transcripts, setup e session resumption.
- Quando e usado: Durante start/stop/reconexao da sessao Live e streaming multimodal.
- Quem chama/importa: `src/App.jsx`, `src/screenGeometry.test.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `SCREEN_SHARE_VIDEO_CONSTRAINTS`, `resolveScreenCaptureGeometry`.
- Principais funcoes/classes/simbolos: `SCREEN_SHARE_VIDEO_CONSTRAINTS`, `toPositiveNumber`, `numericValue`, `resolveScreenCaptureGeometry`, `width`, `height`.
- Principais estados/dados manipulados: Audio PCM/base64, frames JPEG, WebSocket messages, transcripts, setup e session resumption.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: `src/screenGeometry.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/screenGeometry.test.js`

- Caminho relativo: `src/screenGeometry.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/screenGeometry.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: nenhum identificado estaticamente.
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/screenGeometry.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/tauriRuntime.js`

- Caminho relativo: `src/tauriRuntime.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Frontend/orquestracao.
- Responsabilidade principal: Modulo auxiliar do projeto.
- O que faz: Modulo auxiliar do projeto. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/App.jsx`, `src/tauriRuntime.test.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `isTauriRuntime`.
- Principais funcoes/classes/simbolos: `isTauriRuntime`.
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/tauriRuntime.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/tauriRuntime.test.js`

- Caminho relativo: `src/tauriRuntime.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/tauriRuntime.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: nenhum identificado estaticamente.
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/tauriRuntime.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/webKnowledge.js`

- Caminho relativo: `src/webKnowledge.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Conhecimento web.
- Responsabilidade principal: Classificacao, pipeline ou executor de conhecimento web.
- O que faz: Classificacao, pipeline ou executor de conhecimento web. Manipula principalmente: Navigation context, snapshots de pagina, secoes, links, fontes, suficiencia e timeline.
- Quando e usado: Quando importado pelo modulo dependente ou executado pelo script correspondente.
- Quem chama/importa: `src/App.jsx`, `src/knowledgePipeline.js`, `src/knowledgePipeline.test.js`, `src/webKnowledge.test.js`.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: `KNOWLEDGE_SCOPES`, `KNOWLEDGE_SUFFICIENCY`, `extractKnowledgeTerms`, `normalizeNavigationContext`, `isPageSummaryIntent`, `classifyKnowledgeScope`, `nextKnowledgeScopeForExpansion`, `createEmptyKnowledgeState`, `mergeKnowledgeState`.
- Principais funcoes/classes/simbolos: `KNOWLEDGE_SCOPES`, `KNOWLEDGE_SUFFICIENCY`, `EXPLICIT_PAGE_PATTERNS`, `CONTEXTUAL_PAGE_PATTERNS`, `SAME_DOMAIN_PATTERNS`, `GLOBAL_PATTERNS`, `SUMMARY_PATTERNS`, `tokenize`, `normalizeQuestionText`, `STOP_WORDS`, `extractKnowledgeTerms`, `normalizeNavigationContext`, `url`, `domain`, `title`, `selectionText`, `timestamp`, `isPageSummaryIntent`, `classifyKnowledgeScope`, `normalizedQuestion` (+5).
- Principais estados/dados manipulados: Navigation context, snapshots de pagina, secoes, links, fontes, suficiencia e timeline.
- Efeitos colaterais: Sem efeito externo evidente pela leitura estatica, ou efeito mediado pelos chamadores.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: `src/webKnowledge.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `src/webKnowledge.test.js`

- Caminho relativo: `src/webKnowledge.test.js`.
- Tipo: teste/fixture (.js).
- Dominio funcional: Testes.
- Responsabilidade principal: Teste/fixture que protege comportamento do dominio Testes.
- O que faz: Teste/fixture que protege comportamento do dominio Testes. Manipula principalmente: Navigation context, snapshots de pagina, secoes, links, fontes, suficiencia e timeline.
- Quando e usado: Durante execucao de testes automatizados ou como fixture.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vitest`, `src/webKnowledge.js`.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: `navigationContext`, `state`.
- Principais estados/dados manipulados: Navigation context, snapshots de pagina, secoes, links, fontes, suficiencia e timeline.
- Efeitos colaterais: Normalmente nenhum efeito de producao; pode criar mocks/fixtures temporarias durante teste.
- Nivel de criticidade: baixo.
- Risco de alteracao: Risco localizado, mas ainda deve manter contrato/imports e teste relacionado.
- Testes relacionados: `src/webKnowledge.test.js`.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `start-alice.ps1`

- Caminho relativo: `start-alice.ps1`.
- Tipo: script PowerShell.
- Dominio funcional: Configuracao/build.
- Responsabilidade principal: Configuracao de dependencias, build, permissao, entrada ou inicializacao.
- O que faz: Configuracao de dependencias, build, permissao, entrada ou inicializacao. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Durante install, dev, build, lint, teste ou inicializacao.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: nenhum identificado estaticamente.
- Principais exports: nenhum identificado estaticamente.
- Principais funcoes/classes/simbolos: nenhum identificado estaticamente.
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Afeta install, build, permissao, lint, teste ou runtime quando usado.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.

## `vite.config.js`

- Caminho relativo: `vite.config.js`.
- Tipo: JavaScript modulo/script.
- Dominio funcional: Configuracao/build.
- Responsabilidade principal: Configuracao de dependencias, build, permissao, entrada ou inicializacao.
- O que faz: Configuracao de dependencias, build, permissao, entrada ou inicializacao. Manipula principalmente: Dados locais do proprio arquivo conforme imports/exports.
- Quando e usado: Durante install, dev, build, lint, teste ou inicializacao.
- Quem chama/importa: nenhum identificado estaticamente.
- Quem chama/importa internamente: `vite`, `@vitejs/plugin-react`.
- Principais exports: `default`.
- Principais funcoes/classes/simbolos: nenhum identificado estaticamente.
- Principais estados/dados manipulados: Dados locais do proprio arquivo conforme imports/exports.
- Efeitos colaterais: Afeta install, build, permissao, lint, teste ou runtime quando usado.
- Nivel de criticidade: medio.
- Risco de alteracao: Alteracao tende a afetar dominio especifico; exige teste do modulo e fluxo relacionado.
- Testes relacionados: nenhum identificado estaticamente.
- Observacoes tecnicas: nenhuma observacao adicional alem do contrato local.
