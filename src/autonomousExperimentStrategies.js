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
      strategyId: 'vm_validate_controlled_page',
      type: 'native_command',
      title: 'Validar pagina controlada dentro da VM',
      capability: 'page.validate',
      priority: 1,
      environment: 'real_vm',
      actions: [{ kind: 'run_command', command: 'validate_controlled_page' }],
      validationSignals: ['status_code_ok', 'title_present', 'content_marker'],
      fallbackStrategyId: 'capture_title_and_content',
    },
    {
      strategyId: 'capture_title_and_content',
      type: 'controlled_script',
      title: 'Validar titulo/conteudo de pagina',
      capability: 'page.validate',
      priority: 2,
      environment: 'local_workspace_fallback',
      scriptType: 'node',
      actions: [{ kind: 'script', scriptType: 'node' }],
      validationSignals: ['title_present', 'content_marker'],
    },
  ],
  app_launch: [
    {
      strategyId: 'vm_start_safe_app',
      type: 'native_command',
      title: 'Abrir aplicativo permitido na VM e validar processo',
      capability: 'app.launch',
      priority: 1,
      environment: 'real_vm',
      actions: [{ kind: 'run_command', command: 'start_safe_app' }],
      validationSignals: ['process_started', 'window_detected'],
      fallbackStrategyId: 'controlled_script_app_launch',
    },
    {
      strategyId: 'controlled_script_app_launch',
      type: 'controlled_script',
      title: 'Script seguro para simular contrato de abertura de app',
      capability: 'app.launch',
      priority: 2,
      environment: 'local_workspace_fallback',
      scriptType: 'node',
      actions: [{ kind: 'script', scriptType: 'node' }],
      validationSignals: ['script_exit_code', 'stdout_marker', 'report_file'],
    },
  ],
  field_interaction: [
    {
      strategyId: 'vm_notepad_field_interaction',
      type: 'native_command',
      title: 'Focar campo controlado no Notepad, digitar e validar valor',
      capability: 'field.interaction',
      priority: 1,
      environment: 'real_vm',
      actions: [{ kind: 'run_command', command: 'validate_text_field_interaction' }],
      validationSignals: ['field_focused', 'field_value_changed', 'window_detected'],
      fallbackStrategyId: 'controlled_script_field_interaction',
    },
    {
      strategyId: 'controlled_script_field_interaction',
      type: 'controlled_script',
      title: 'Script seguro para validar contrato de campo de texto',
      capability: 'field.interaction',
      priority: 2,
      environment: 'local_workspace_fallback',
      scriptType: 'node',
      actions: [{ kind: 'script', scriptType: 'node' }],
      validationSignals: ['script_exit_code', 'stdout_marker', 'report_file'],
    },
  ],
  page_read: [
    {
      strategyId: 'vm_read_controlled_page',
      type: 'native_command',
      title: 'Ler pagina controlada dentro da VM',
      capability: 'page.read',
      priority: 1,
      environment: 'real_vm',
      actions: [{ kind: 'run_command', command: 'read_controlled_page' }],
      validationSignals: ['content_marker', 'stdout_marker'],
      fallbackStrategyId: 'extract_page_text_controlled',
    },
    {
      strategyId: 'extract_page_text_controlled',
      type: 'controlled_script',
      title: 'Extrair texto de pagina controlada e validar marcador',
      capability: 'page.read',
      priority: 2,
      environment: 'local_workspace_fallback',
      scriptType: 'node',
      actions: [{ kind: 'script', scriptType: 'node' }],
      validationSignals: ['content_marker', 'report_file'],
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
