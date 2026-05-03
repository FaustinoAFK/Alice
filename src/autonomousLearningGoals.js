import { getExperimentStrategiesForGap } from './autonomousExperimentStrategies';

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const stripDiacritics = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const normalizeLower = (value) => stripDiacritics(normalizeText(value)).toLowerCase();
const normalizeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
const MAX_LEARNING_GOALS = 500;

const toSafeIdPart = (value) =>
  normalizeLower(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'objetivo';

const stageTemplates = {
  app_launch: {
    type: 'app_launch',
    capability: 'app.launch',
    title: 'Abrir aplicativo',
    description: 'Aprender a abrir um aplicativo seguro na VM e validar janela real.',
    priority: 'high',
    keywords: ['abrir', 'aplicativo', 'programa', 'app', 'janela', 'notepad', 'edge'],
  },
  window_focus: {
    type: 'app_launch',
    capability: 'app.window.focus',
    title: 'Focar janela',
    description: 'Aprender a identificar e focar uma janela segura aberta na VM.',
    priority: 'high',
    keywords: ['janela', 'foco', 'alternar', 'ativar janela'],
  },
  file_explorer: {
    type: 'file_management',
    capability: 'file.explorer.open',
    title: 'Abrir Explorador de Arquivos',
    description: 'Aprender a abrir o Explorador de Arquivos em uma pasta temporaria controlada na VM e validar a janela.',
    priority: 'high',
    keywords: ['explorador', 'explorer', 'arquivo', 'arquivos', 'pasta', 'pastas', 'diretorio', 'diretorios'],
  },
  file_management: {
    type: 'file_management',
    capability: 'file.folder.create',
    title: 'Criar e organizar arquivos controlados',
    description: 'Aprender a criar pasta e arquivo temporarios na VM, abrir no Explorador e validar existencia.',
    priority: 'high',
    keywords: ['criar pasta', 'criar pastas', 'organizar arquivo', 'organizar arquivos', 'salvar arquivo', 'mover arquivo'],
  },
  app_install: {
    type: 'app_install',
    capability: 'app.install.safe_probe',
    title: 'Validar fluxo seguro de instalacao',
    description: 'Aprender a localizar um pacote de aplicativo por ferramenta segura na VM antes de qualquer instalacao real.',
    priority: 'medium',
    keywords: ['instalar', 'instalacao', 'baixar', 'download', 'programas', 'aplicativos', 'installer', 'winget'],
  },
  text_input: {
    type: 'text_input',
    capability: 'text.input',
    title: 'Digitar texto',
    description: 'Aprender a digitar texto em foco controlado e validar a entrada.',
    priority: 'high',
    keywords: ['digitar', 'escrever', 'texto', 'campo', 'input', 'preencher', 'formulario'],
  },
  keyboard_shortcuts: {
    type: 'text_input',
    capability: 'keyboard.shortcuts',
    title: 'Usar atalhos de teclado',
    description: 'Aprender atalhos basicos e seguros de teclado para operar aplicativos na VM.',
    priority: 'medium',
    keywords: ['atalho', 'teclado', 'ctrl', 'shift', 'enter', 'tab'],
  },
  clipboard_text: {
    type: 'text_input',
    capability: 'clipboard.text',
    title: 'Manipular texto controlado',
    description: 'Aprender a inserir, selecionar e validar texto controlado em um contexto seguro.',
    priority: 'medium',
    keywords: ['copiar', 'colar', 'selecionar', 'clipboard', 'area de transferencia'],
  },
  field_interaction: {
    type: 'field_interaction',
    capability: 'field.interaction',
    title: 'Interagir com campo',
    description: 'Aprender a focar, preencher e validar campos de texto em UI controlada.',
    priority: 'medium',
    keywords: ['campo', 'formulario', 'preencher', 'input', 'clicar', 'botao'],
  },
  form_fill: {
    type: 'field_interaction',
    capability: 'form.fill',
    title: 'Preencher formulario controlado',
    description: 'Aprender a preencher campos de formulario controlados e validar valores.',
    priority: 'medium',
    keywords: ['formulario', 'preencher', 'campo', 'submit', 'enviar'],
  },
  browser_search: {
    type: 'browser_search',
    capability: 'browser.search',
    title: 'Pesquisar pelo navegador',
    description: 'Aprender a pesquisar ou navegar usando o navegador em ambiente controlado.',
    priority: 'high',
    keywords: ['browser.search', 'barra', 'pesquis', 'buscar', 'search', 'navegador', 'browser', 'web', 'site', 'url', 'documentacao'],
  },
  browser_navigation: {
    type: 'browser_search',
    capability: 'browser.navigation',
    title: 'Navegar no navegador',
    description: 'Aprender a navegar para uma URL controlada usando o navegador na VM.',
    priority: 'medium',
    keywords: ['navegar', 'url', 'site', 'aba', 'endereco', 'voltar', 'avancar'],
  },
  page_validation: {
    type: 'page_validation',
    capability: 'page.validate',
    title: 'Validar carregamento de pagina',
    description: 'Aprender a confirmar que uma pagina carregou por URL, titulo ou conteudo.',
    priority: 'medium',
    keywords: ['page.validate', 'validar', 'carreg', 'pagina', 'site', 'conteudo', 'url', 'titulo'],
  },
  search_result_validation: {
    type: 'page_validation',
    capability: 'search.results.validate',
    title: 'Validar resultado de busca',
    description: 'Aprender a confirmar que uma busca controlada produziu resultado verificavel.',
    priority: 'medium',
    keywords: ['resultado', 'busca', 'pesquisa', 'validar resultado'],
  },
  page_read: {
    type: 'page_read',
    capability: 'page.read',
    title: 'Ler conteudo de pagina',
    description: 'Aprender a extrair e validar conteudo textual de uma pagina controlada.',
    priority: 'medium',
    keywords: ['page.read', 'ler', 'resum', 'conteudo', 'pagina', 'texto', 'documentacao'],
  },
  page_summary: {
    type: 'page_read',
    capability: 'page.summary',
    title: 'Resumir conteudo de pagina',
    description: 'Aprender a extrair sinais textuais de uma pagina controlada para resumo posterior.',
    priority: 'medium',
    keywords: ['resumir', 'sumario', 'conteudo', 'texto'],
  },
};

const defaultStageOrder = ['browser_search', 'page_validation', 'page_read'];
const broadComputerStageOrder = [
  'app_launch',
  'window_focus',
  'file_explorer',
  'file_management',
  'app_install',
  'text_input',
  'keyboard_shortcuts',
  'clipboard_text',
  'field_interaction',
  'form_fill',
  'browser_search',
  'browser_navigation',
  'page_validation',
  'search_result_validation',
  'page_read',
  'page_summary',
];

const addUnique = (items, value) => {
  if (!items.includes(value)) {
    items.push(value);
  }
};

const buildObservedTargetContext = (goal = {}) => {
  const label = normalizeText(goal.metadata?.observedTargetLabel);
  const kind = normalizeText(goal.metadata?.observedTargetKind);
  if (!label) {
    return null;
  }
  return {
    target: label,
    observedTargets: [{
      targetId: normalizeText(goal.metadata?.observedTargetId),
      kind: kind || 'application',
      label,
    }],
  };
};

const stageOrderForGoal = (text = '') => {
  const lower = normalizeLower(text);
  const stages = [];

  Object.entries(stageTemplates).forEach(([stageType, template]) => {
    if (template.keywords.some((keyword) => lower.includes(normalizeLower(keyword)))) {
      addUnique(stages, stageType);
    }
  });

  const mentionsComputerCurriculum = /\b(computador|pc|windows|desktop|sistema|basico|avancado|avancada|coisas do computador)\b/i
    .test(lower);
  const mentionsWebsite = /\b(site|web|pagina|browser|navegador|url|documentacao)\b/i.test(lower);
  const mentionsComplexOperation = /\b(usar|operar|aprend\w*|automatizar|navegar|interagir|fazer|resolver)\b/i.test(lower);
  const mentionsInputFlow = /\b(formulario|campo|preencher|login|pesquisar|buscar|digitar|escrever)\b/i.test(lower);

  if (mentionsComputerCurriculum && mentionsComplexOperation) {
    broadComputerStageOrder.forEach((stageType) => addUnique(stages, stageType));
  }
  if (mentionsWebsite && mentionsComplexOperation) {
    ['browser_search', 'page_validation', 'page_read'].forEach((stageType) => addUnique(stages, stageType));
  }
  if (mentionsWebsite && mentionsInputFlow) {
    ['text_input', 'field_interaction'].forEach((stageType) => addUnique(stages, stageType));
  }
  if (/\b(app|aplicativo|programa|janela)\b/i.test(lower)) {
    addUnique(stages, 'app_launch');
  }
  if (/\b(explorador|explorer|arquivo|arquivos|pasta|pastas|diretorio|organizar)\b/i.test(lower)) {
    ['file_explorer', 'file_management'].forEach((stageType) => addUnique(stages, stageType));
  }
  if (/\b(instalar|instalacao|baixar|download|programa|programas|aplicativo|aplicativos|winget)\b/i.test(lower)) {
    addUnique(stages, 'app_install');
  }

  if (stages.length === 0) {
    defaultStageOrder.forEach((stageType) => addUnique(stages, stageType));
  }

  return stages;
};

const goalAppearsBroad = (text = '', stageTypes = []) => {
  const lower = normalizeLower(text);
  const words = normalizeText(text).split(' ').filter(Boolean);
  return stageTypes.length > 1 ||
    words.length >= 8 ||
    /\b(usar|operar|aprend\w*|automatizar|site|sistema|aplicativo|qualquer|tudo|completo|computador|basico|avancado)\b/i
      .test(lower);
};

const buildStagesForGoal = ({
  goalId,
  description,
  stageTypes = [],
  broad = false,
  priority = 'high',
  now = new Date().toISOString(),
  existingStages = [],
} = {}) => {
  const existingByType = new Map(normalizeArray(existingStages).map((stage) => [
    stage.stageKey || stage.templateId || stage.type,
    stage,
  ]));

  return stageTypes.map((stageType, index) => {
    const template = stageTemplates[stageType] || stageTemplates.browser_search;
    const existing = existingByType.get(stageType) || {};
    const expectedStageId = `${goalId}-stage-${index + 1}-${stageType}`;
    const expectedGapId = `${goalId}-stage-${index + 1}-${stageType}`;
    const existingOrderStillMatches = Number(existing.order || 0) === index + 1 &&
      normalizeText(existing.stageId).endsWith(`stage-${index + 1}-${stageType}`);
    const stageId = existingOrderStillMatches ? existing.stageId : expectedStageId;
    const gapId = existingOrderStillMatches && normalizeText(existing.gapId).endsWith(`stage-${index + 1}-${stageType}`)
      ? existing.gapId
      : expectedGapId;
    const gap = {
      gapId,
      type: template.type,
      capability: template.capability,
      description: `${template.description} Objetivo do usuario: ${description}`,
      priority: index === 0 ? priority : template.priority,
      evidence: [
        `learning_goal=${goalId}`,
        `stage=${index + 1}`,
        broad ? 'goal_split_into_stages' : 'goal_single_stage',
      ],
      riskLevel: 'low',
    };

    return {
      ...existing,
      stageId,
      stageKey: stageType,
      gapId,
      order: index + 1,
      title: template.title,
      type: template.type,
      capability: template.capability,
      description: gap.description,
      priority: gap.priority,
      riskLevel: gap.riskLevel,
      status: existing.status || 'open',
      suggestedExperiments: getExperimentStrategiesForGap(gap).map((strategy) => strategy.strategyId),
      createdAt: existing.createdAt || now,
      updatedAt: now,
    };
  });
};

export const createAutonomousLearningGoalFromText = (text = '', {
  now = new Date().toISOString(),
  source = 'user',
  priority = 'high',
} = {}) => {
  const description = normalizeText(text);
  if (!description) {
    return { ok: false, reason: 'empty_learning_goal', goal: null };
  }

  const goalId = `learning-goal-${toSafeIdPart(description).slice(0, 48)}-${Date.parse(now) || Date.now()}`;
  const stageTypes = stageOrderForGoal(description);
  const broad = goalAppearsBroad(description, stageTypes);

  return {
    ok: true,
    reason: broad ? 'learning_goal_split_into_stages' : 'learning_goal_created',
    goal: {
      goalId,
      title: description.length > 96 ? `${description.slice(0, 93)}...` : description,
      description,
      source,
      status: 'open',
      priority,
      broad,
      createdAt: now,
      updatedAt: now,
      stages: buildStagesForGoal({
        goalId,
        description,
        stageTypes,
        broad,
        priority,
        now,
      }),
    },
  };
};

export const normalizeAutonomousLearningGoal = (goal = {}, {
  now = new Date().toISOString(),
} = {}) => {
  const description = normalizeText(goal.description || goal.title);
  if (!description) {
    return null;
  }

  const goalId = normalizeText(goal.goalId) ||
    `learning-goal-${toSafeIdPart(description).slice(0, 48)}-${Date.parse(now) || Date.now()}`;
  const expectedStageTypes = stageOrderForGoal(description);
  const existingStages = normalizeArray(goal.stages);
  const mergedStageTypes = [
    ...expectedStageTypes,
    ...existingStages.map((stage) => stage.stageKey || stage.templateId || stage.type).filter(Boolean),
  ].filter((stageType, index, all) => all.indexOf(stageType) === index);
  const broad = goal.broad ?? goalAppearsBroad(description, mergedStageTypes);

  return {
    ...goal,
    goalId,
    title: normalizeText(goal.title) || (description.length > 96 ? `${description.slice(0, 93)}...` : description),
    description,
    status: goal.status || 'open',
    priority: goal.priority || 'high',
    broad,
    createdAt: goal.createdAt || now,
    updatedAt: goal.updatedAt || now,
    stages: buildStagesForGoal({
      goalId,
      description,
      stageTypes: mergedStageTypes,
      broad,
      priority: goal.priority || 'high',
      now,
      existingStages,
    }),
  };
};

export const createGapsFromLearningGoals = (learningGoals = [], { policy = {}, now = new Date().toISOString() } = {}) =>
  normalizeArray(learningGoals)
    .map((goal) => normalizeAutonomousLearningGoal(goal, { now }))
    .filter(Boolean)
    .filter((goal) => ['open', 'active', 'in_progress'].includes(goal.status || 'open'))
    .flatMap((goal) => normalizeArray(goal.stages)
      .filter((stage) => ['open', 'ready', 'in_progress'].includes(stage.status || 'open'))
      .map((stage) => {
        const gap = {
          gapId: stage.gapId,
          type: stage.type,
          capability: stage.capability,
          description: stage.description || `${stage.title}. Objetivo do usuario: ${goal.description}`,
          priority: stage.priority || goal.priority || 'medium',
          evidence: [
            `learning_goal=${goal.goalId}`,
            `stage=${stage.order || 1}`,
            `source=${goal.source || 'user'}`,
          ],
          suggestedExperiments: normalizeArray(stage.suggestedExperiments),
          riskLevel: stage.riskLevel || 'low',
          status: stage.status || 'open',
          firstSeenAt: stage.createdAt || goal.createdAt || now,
          lastSeenAt: now,
          learningGoalId: goal.goalId,
          learningGoalStageId: stage.stageId,
          metadata: {
            learningGoalId: goal.goalId,
            learningGoalStageId: stage.stageId,
            observedTargetId: normalizeText(goal.metadata?.observedTargetId),
            observedTargetKind: normalizeText(goal.metadata?.observedTargetKind),
            observedTargetLabel: normalizeText(goal.metadata?.observedTargetLabel),
            context: buildObservedTargetContext(goal),
          },
        };
        return {
          ...gap,
          suggestedExperiments: gap.suggestedExperiments.length
            ? gap.suggestedExperiments
            : getExperimentStrategiesForGap(gap, { policy }).map((strategy) => strategy.strategyId),
        };
      }));

export const upsertAutonomousLearningGoal = (learningState = {}, goal = {}) => {
  const normalizedGoal = normalizeAutonomousLearningGoal(goal);
  const goals = normalizeArray(learningState.learningGoals);
  return {
    ...learningState,
    learningGoals: [
      ...goals.filter((item) => item.goalId !== normalizedGoal?.goalId),
      normalizedGoal,
    ].filter(Boolean).slice(-MAX_LEARNING_GOALS),
  };
};
