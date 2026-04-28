import { normalizeText } from './contracts';

export const createTurnContext = ({
  turnId = '',
  userUtterance = '',
  toolName = '',
  toolArgs = {},
  source = 'gemini_live_tool',
  now = Date.now(),
} = {}) => ({
  turnId: normalizeText(turnId) || `turn-${now}`,
  source: normalizeText(source) || 'gemini_live_tool',
  userUtterance: normalizeText(userUtterance),
  toolName: normalizeText(toolName),
  toolArgs: toolArgs && typeof toolArgs === 'object' ? toolArgs : {},
  explicitUserRequest: Boolean(normalizeText(userUtterance)),
  createdAt: now,
});
