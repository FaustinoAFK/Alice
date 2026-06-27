import { useRef, useState } from 'react';
import { createDebugInteractionId, summarizeDebugPayload } from './appLiveHelpers';

// Número máximo de interações mantidas em memória para a aba de depuração
const MAX_DEBUG_INTERACTIONS = 80;

/**
 * Gerencia o histórico de interações de depuração (conversa e tool calls).
 * Mantém o ref sincronizado com o estado React para acesso síncrono no runtime.
 *
 * @param {{ trustedUtteranceRef: React.MutableRefObject }} params
 */
export function useDebugInteractions({ trustedUtteranceRef }) {
  const debugInteractionsRef = useRef([]);
  const latestConversationInteractionIdRef = useRef('');
  const [debugInteractions, setDebugInteractions] = useState([]);

  const commitDebugInteractions = (updater) => {
    const nextInteractions = updater(debugInteractionsRef.current).slice(-MAX_DEBUG_INTERACTIONS);
    debugInteractionsRef.current = nextInteractions;
    setDebugInteractions(nextInteractions);
  };

  const recordUserInteraction = (userText) => {
    const normalizedText = String(userText || '').trim();
    if (!normalizedText) {
      return;
    }

    commitDebugInteractions((current) => {
      const latestId = latestConversationInteractionIdRef.current;
      const latest = current.find((interaction) => interaction.id === latestId);
      if (latest && latest.kind === 'conversation' && !latest.aliceText) {
        return current.map((interaction) =>
          interaction.id === latestId
            ? { ...interaction, userText: normalizedText, status: 'listening', timestamp: Date.now() }
            : interaction,
        );
      }

      const interaction = {
        id: createDebugInteractionId(),
        kind: 'conversation',
        timestamp: Date.now(),
        status: 'listening',
        userText: normalizedText,
        aliceText: '',
      };
      latestConversationInteractionIdRef.current = interaction.id;
      return [...current, interaction];
    });
  };

  const recordAliceInteraction = (aliceText) => {
    const normalizedText = String(aliceText || '').trim();
    if (!normalizedText) {
      return;
    }

    commitDebugInteractions((current) => {
      const latestId = latestConversationInteractionIdRef.current;
      const latest = current.find((interaction) => interaction.id === latestId);
      if (latest && latest.kind === 'conversation') {
        return current.map((interaction) =>
          interaction.id === latestId
            ? { ...interaction, aliceText: normalizedText, status: 'answered', timestamp: Date.now() }
            : interaction,
        );
      }

      const interaction = {
        id: createDebugInteractionId(),
        kind: 'conversation',
        timestamp: Date.now(),
        status: 'answered',
        userText: trustedUtteranceRef.current?.text || '',
        aliceText: normalizedText,
      };
      latestConversationInteractionIdRef.current = interaction.id;
      return [...current, interaction];
    });
  };

  const recordToolInteraction = (functionCall, patch = {}) => {
    const toolName = functionCall?.name || 'ferramenta_desconhecida';
    const args = functionCall?.args || {};
    const existingId = patch.id;

    commitDebugInteractions((current) => {
      if (existingId) {
        return current.map((interaction) =>
          interaction.id === existingId
            ? {
                ...interaction,
                ...patch,
                timestamp: Date.now(),
              }
            : interaction,
        );
      }

      const interaction = {
        id: createDebugInteractionId(),
        kind: 'tool',
        timestamp: Date.now(),
        status: 'running',
        toolName,
        operation: args.operation || args.taskKind || args.action || '',
        ok: null,
        userText: trustedUtteranceRef.current?.text || '',
        argsSummary: summarizeDebugPayload(args),
        responseSummary: '',
        message: '',
        reason: '',
      };
      return [...current, interaction];
    });

    return existingId || debugInteractionsRef.current.at(-1)?.id || '';
  };

  return {
    debugInteractions,
    debugInteractionsRef,
    recordUserInteraction,
    recordAliceInteraction,
    recordToolInteraction,
  };
}
