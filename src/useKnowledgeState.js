import { useEffect, useRef, useState } from 'react';
import { createEmptyKnowledgeState, mergeKnowledgeState } from './webKnowledge';

/**
 * Gerencia o estado de conhecimento web da sessão ativa.
 * Mantém o ref sincronizado com o estado React para acesso síncrono no runtime
 * sem depender de closures desatualizadas.
 */
export function useKnowledgeState() {
  const knowledgeStateRef = useRef(createEmptyKnowledgeState());
  const [knowledgeState, setKnowledgeState] = useState(createEmptyKnowledgeState);

  // Mantém o ref sempre alinhado com o último estado commitado
  useEffect(() => {
    knowledgeStateRef.current = knowledgeState;
  }, [knowledgeState]);

  const updateKnowledgeState = (patch) => {
    const nextState = mergeKnowledgeState(knowledgeStateRef.current, patch);
    knowledgeStateRef.current = nextState;
    setKnowledgeState(nextState);
  };

  return {
    knowledgeState,
    knowledgeStateRef,
    updateKnowledgeState,
  };
}
