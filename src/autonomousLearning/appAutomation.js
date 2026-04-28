import { normalizeText } from './contracts';

export const AUTOMATION_TARGET_ORDER = [
  'ui_element',
  'accessibility_name',
  'ui_tree',
  'vision_ocr',
  'coordinates',
];

export const createAppAutomationStrategy = ({ appName = '', goal = '', availableSignals = [] } = {}) => {
  const signalSet = new Set(availableSignals);
  const selectedMode =
    AUTOMATION_TARGET_ORDER.find((mode) => signalSet.has(mode)) || 'blocked';

  return {
    appName: normalizeText(appName),
    goal: normalizeText(goal),
    selectedMode,
    allowed: selectedMode !== 'blocked',
    fallbackOrder: AUTOMATION_TARGET_ORDER,
    coordinateFallbackOnly: selectedMode === 'coordinates',
    reason:
      selectedMode === 'blocked'
        ? 'no_reliable_ui_signal_available'
        : selectedMode === 'coordinates'
          ? 'coordinates_are_last_resort'
          : 'automation_prefers_real_interface_elements',
  };
};

export const createUiActionRecord = ({
  app = '',
  appVersion = '',
  screenContext = '',
  targetElement = '',
  strategy = null,
  fallback = '',
  successSignal = '',
  failureSignal = '',
  confidence = 0,
  now = Date.now(),
} = {}) => {
  const selectedStrategy = strategy || createAppAutomationStrategy({
    appName: app,
    goal: targetElement,
    availableSignals: [],
  });

  return {
    actionId: `ui-action-${now}`,
    app: normalizeText(app),
    appVersion: normalizeText(appVersion),
    screenContext: normalizeText(screenContext),
    targetElement: normalizeText(targetElement),
    strategyUsed: selectedStrategy.selectedMode,
    fallback: normalizeText(fallback),
    successSignal: normalizeText(successSignal),
    failureSignal: normalizeText(failureSignal),
    confidence: Math.min(1, Math.max(0, Number(confidence || 0))),
    coordinatesLastResort: selectedStrategy.selectedMode === 'coordinates',
    createdAt: now,
  };
};

export const planInterfaceRelearning = ({
  previousElement = '',
  currentSignals = [],
  app = '',
  now = Date.now(),
} = {}) => ({
  relearningId: `interface-relearning-${now}`,
  app: normalizeText(app),
  previousElement: normalizeText(previousElement),
  steps: [
    'search_same_accessible_name',
    'search_similar_function',
    'inspect_visual_context',
    'research_documentation_if_needed',
    'test_in_playground',
    'update_interface_memory_after_validation',
  ],
  preferredSignals: currentSignals.filter((signal) => AUTOMATION_TARGET_ORDER.includes(signal)),
  coordinateFallbackAllowedOnlyAsLastResort: true,
  status: currentSignals.length > 0 ? 'planned' : 'needs_observation',
  createdAt: now,
});
