import {
  VM_VISUAL_ACTIONS,
  VM_VISUAL_ACTION_SOURCES,
  normalizeArray,
  normalizeText,
} from './contracts';

const DEFAULT_BOUNDS = { x: 0, y: 0, width: 0, height: 0 };

export const createDetectedElement = ({
  type = 'unknown',
  label = '',
  boundingBox = DEFAULT_BOUNDS,
  confidence = 0,
  source = VM_VISUAL_ACTION_SOURCES.HEURISTIC,
  clickable = false,
  metadata = {},
} = {}) => ({
  type: normalizeText(type) || 'unknown',
  label: normalizeText(label),
  boundingBox: {
    x: Number(boundingBox?.x || 0),
    y: Number(boundingBox?.y || 0),
    width: Number(boundingBox?.width || 0),
    height: Number(boundingBox?.height || 0),
  },
  confidence: Math.max(0, Math.min(1, Number(confidence || 0))),
  source: normalizeText(source) || VM_VISUAL_ACTION_SOURCES.HEURISTIC,
  clickable: Boolean(clickable),
  metadata: metadata && typeof metadata === 'object' ? metadata : {},
});

export const createVisualContext = ({
  screenshotPath = '',
  screenshotId = '',
  timestamp = Date.now(),
  activeWindowTitle = '',
  visibleTexts = [],
  detectedElements = [],
  mousePosition = {},
  confidence = 0,
  rawOcr = '',
  notes = [],
} = {}) => ({
  screenshotPath: normalizeText(screenshotPath),
  screenshotId: normalizeText(screenshotId),
  timestamp: Number(timestamp || Date.now()),
  activeWindowTitle: normalizeText(activeWindowTitle),
  visibleTexts: normalizeArray(visibleTexts).map((text) => normalizeText(text)).filter(Boolean),
  detectedElements: normalizeArray(detectedElements).map(createDetectedElement),
  mousePosition: {
    x: Number(mousePosition?.x || 0),
    y: Number(mousePosition?.y || 0),
  },
  confidence: Math.max(0, Math.min(1, Number(confidence || 0))),
  rawOcr: String(rawOcr || ''),
  notes: normalizeArray(notes).map((note) => normalizeText(note)).filter(Boolean),
});

export const createVmVisualAction = ({
  action = '',
  parameters = {},
  source = VM_VISUAL_ACTION_SOURCES.HEURISTIC,
  reason = '',
  targetElement = null,
  timeoutMs = 5000,
} = {}) => ({
  action: normalizeText(action),
  parameters: parameters && typeof parameters === 'object' ? parameters : {},
  source: normalizeText(source) || VM_VISUAL_ACTION_SOURCES.HEURISTIC,
  reason: normalizeText(reason),
  targetElement: targetElement ? createDetectedElement(targetElement) : null,
  timeoutMs: Math.max(1, Math.min(60000, Number(timeoutMs || 5000))),
});

export const validateVmVisualActionProposal = ({
  proposedAction,
  visualContext = null,
  previousSteps = [],
  capabilities = {},
} = {}) => {
  const action = createVmVisualAction(proposedAction);
  const allowedActions = new Set(Object.values(VM_VISUAL_ACTIONS));

  if (!allowedActions.has(action.action)) {
    return {
      allowed: false,
      reason: 'unsupported_vm_visual_action',
      flags: ['invalid_action'],
    };
  }

  if (action.source === VM_VISUAL_ACTION_SOURCES.COORDINATE_FALLBACK) {
    const hasCoordinates = Number.isFinite(Number(action.parameters?.x)) && Number.isFinite(Number(action.parameters?.y));
    if (!hasCoordinates || !action.reason || !visualContext?.screenshotPath) {
      return {
        allowed: false,
        reason: 'coordinate_fallback_requires_reason_coordinates_and_screenshot',
        flags: ['coordinate_fallback_guard'],
      };
    }
  }

  if (action.action === VM_VISUAL_ACTIONS.CAPTURE_SCREEN && capabilities.can_capture_screen === false) {
    return {
      allowed: false,
      reason: 'vm_visual_capture_unavailable',
      flags: ['capability_missing'],
    };
  }

  const repeatedCount = normalizeArray(previousSteps)
    .slice(-3)
    .filter((step) => step.executedAction?.action === action.action)
    .length;
  if (repeatedCount >= 3) {
    return {
      allowed: false,
      reason: 'vm_visual_repetition_guard',
      flags: ['loop_guard'],
    };
  }

  return {
    allowed: true,
    reason: 'vm_visual_action_allowed',
    flags: action.source === VM_VISUAL_ACTION_SOURCES.COORDINATE_FALLBACK ? ['coordinate_fallback_logged'] : [],
  };
};
