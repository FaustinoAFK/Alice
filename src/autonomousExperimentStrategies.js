import { normalizeAutonomousLearningPolicy } from './autonomousLearningPolicy';

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

export const BROWSER_SEARCH_STRATEGIES = [
  {
    strategyId: 'ctrl_l_address_bar',
    type: 'keyboard_shortcut',
    title: 'Focar barra com Ctrl+L, digitar e Enter',
    capability: 'browser.search',
    priority: 1,
    environment: 'real_vm',
    actions: [
      { kind: 'hotkey', keys: ['CTRL', 'L'] },
      { kind: 'type_text', textTemplate: '{{query}}' },
      { kind: 'press_key', key: 'ENTER' },
    ],
    validationSignals: ['url_changed', 'title_changed', 'content_loaded'],
    fallbackStrategyId: 'visual_click_address_bar',
  },
  {
    strategyId: 'visual_click_address_bar',
    type: 'visual_ui',
    title: 'Clique visual na barra, digitar e Enter',
    capability: 'browser.search',
    priority: 2,
    environment: 'real_vm',
    actions: [
      { kind: 'click', target: 'browser_address_bar' },
      { kind: 'type_text', textTemplate: '{{query}}' },
      { kind: 'press_key', key: 'ENTER' },
    ],
    validationSignals: ['url_changed', 'content_loaded', 'screenshot_changed'],
    fallbackStrategyId: 'native_browser_command',
  },
  {
    strategyId: 'native_browser_command',
    type: 'native_command',
    title: 'Comando nativo do navegador com URL de busca controlada',
    capability: 'browser.search',
    priority: 3,
    environment: 'real_vm',
    actions: [
      { kind: 'run_command', command: 'browser_open_search_url' },
    ],
    validationSignals: ['process_started', 'url_changed'],
    fallbackStrategyId: 'controlled_script_browser_search',
  },
  {
    strategyId: 'playwright_browser_search',
    type: 'playwright',
    title: 'Script Playwright controlado para pesquisar',
    capability: 'browser.search',
    priority: 4,
    environment: 'local_workspace_fallback',
    scriptType: 'node',
    actions: [
      { kind: 'script', scriptType: 'node' },
    ],
    validationSignals: ['script_exit_code', 'stdout_marker', 'report_file'],
    fallbackStrategyId: 'controlled_script_browser_search',
  },
  {
    strategyId: 'controlled_script_browser_search',
    type: 'controlled_script',
    title: 'Script seguro controlado para simular e validar fluxo de pesquisa',
    capability: 'browser.search',
    priority: 5,
    environment: 'local_workspace_fallback',
    scriptType: 'node',
    actions: [
      { kind: 'script', scriptType: 'node' },
    ],
    validationSignals: ['script_exit_code', 'stdout_marker', 'report_file'],
    fallbackStrategyId: 'needs_new_tool',
  },
  {
    strategyId: 'needs_new_tool',
    type: 'tool_gap',
    title: 'Registrar necessidade de ferramenta nova',
    capability: 'tool.request',
    priority: 99,
    environment: 'local_workspace_fallback',
    actions: [
      { kind: 'record_gap' },
    ],
    validationSignals: ['gap_recorded'],
  },
];

export const STRATEGIES_BY_GAP_TYPE = {
  browser_search: BROWSER_SEARCH_STRATEGIES,
  text_input: [
    {
      strategyId: 'keyboard_type_text',
      type: 'keyboard_shortcut',
      title: 'Digitar texto no foco atual',
      capability: 'text.input',
      priority: 1,
      environment: 'real_vm',
      actions: [{ kind: 'type_text', textTemplate: '{{text}}' }],
      validationSignals: ['field_value_changed'],
    },
  ],
  page_validation: [
    {
      strategyId: 'capture_title_and_content',
      type: 'controlled_script',
      title: 'Validar titulo/conteudo de pagina',
      capability: 'page.validate',
      priority: 1,
      environment: 'local_workspace_fallback',
      scriptType: 'node',
      actions: [{ kind: 'script', scriptType: 'node' }],
      validationSignals: ['title_present', 'content_marker'],
    },
  ],
};

export const getExperimentStrategiesForGap = (gap = {}, { policy = {} } = {}) => {
  const normalizedPolicy = normalizeAutonomousLearningPolicy(policy);
  const gapType = normalizeText(gap.type || gap.capability || 'browser_search');
  const strategies = STRATEGIES_BY_GAP_TYPE[gapType] || STRATEGIES_BY_GAP_TYPE.browser_search;

  return strategies
    .filter((strategy) => {
      if (strategy.type === 'tool_gap') {
        return true;
      }
      if (strategy.scriptType && !normalizedPolicy.allowScriptSynthesis) {
        return false;
      }
      if (strategy.scriptType && !normalizedPolicy.allowedScriptTypes.includes(strategy.scriptType)) {
        return false;
      }
      if (strategy.environment === 'real_vm' && !normalizedPolicy.allowAppExploration) {
        return false;
      }
      if (strategy.capability?.startsWith('browser') && !normalizedPolicy.allowWebsiteExploration) {
        return false;
      }
      return normalizedPolicy.allowedEnvironments.includes(strategy.environment);
    })
    .sort((left, right) => Number(left.priority || 0) - Number(right.priority || 0));
};

export const summarizeExperimentStrategy = (strategy = {}) => ({
  strategyId: normalizeText(strategy.strategyId),
  title: normalizeText(strategy.title),
  type: normalizeText(strategy.type),
  capability: normalizeText(strategy.capability),
  environment: normalizeText(strategy.environment),
  scriptType: normalizeText(strategy.scriptType),
  validationSignals: Array.isArray(strategy.validationSignals) ? strategy.validationSignals : [],
});
