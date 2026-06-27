import { describe, expect, it } from 'vitest';

// Máximo de interações — espelha a constante interna do hook
const MAX_DEBUG_INTERACTIONS = 80;

/**
 * Simula o comportamento de commitDebugInteractions sem React,
 * mantendo a lógica de limitação de tamanho e o ref sincronizado.
 */
const makeInteractionStore = (max = MAX_DEBUG_INTERACTIONS) => {
  let current = [];
  const ref = { current: [] };
  return {
    commit: (updater) => {
      current = updater(current).slice(-max);
      ref.current = current;
    },
    get: () => current,
    ref,
  };
};

describe('commitDebugInteractions', () => {
  it('limita o historico ao maximo configurado descartando as mais antigas', () => {
    const store = makeInteractionStore(3);
    const interactions = [
      { id: '1', kind: 'conversation' },
      { id: '2', kind: 'conversation' },
      { id: '3', kind: 'conversation' },
      { id: '4', kind: 'conversation' },
    ];
    store.commit(() => interactions);
    expect(store.get()).toHaveLength(3);
    // As tres mais recentes sao mantidas
    expect(store.get()[0].id).toBe('2');
    expect(store.get()[2].id).toBe('4');
  });

  it('mantem todas as interacoes quando o total esta abaixo do limite', () => {
    const store = makeInteractionStore(80);
    store.commit(() => [{ id: '1' }, { id: '2' }]);
    expect(store.get()).toHaveLength(2);
  });
});

describe('recordUserInteraction logic', () => {
  /**
   * Replica a lógica pura de recordUserInteraction sem usar React hooks.
   */
  const makeRecordUser = ({ latestIdRef, store }) =>
    (userText) => {
      const normalizedText = String(userText || '').trim();
      if (!normalizedText) return;

      store.commit((current) => {
        const latestId = latestIdRef.current;
        const latest = current.find((item) => item.id === latestId);
        if (latest && latest.kind === 'conversation' && !latest.aliceText) {
          return current.map((item) =>
            item.id === latestId
              ? { ...item, userText: normalizedText, status: 'listening', timestamp: Date.now() }
              : item,
          );
        }
        const interaction = {
          id: `id-${current.length + 1}`,
          kind: 'conversation',
          timestamp: Date.now(),
          status: 'listening',
          userText: normalizedText,
          aliceText: '',
        };
        latestIdRef.current = interaction.id;
        return [...current, interaction];
      });
    };

  it('cria uma nova interacao de conversa com status listening e texto correto', () => {
    const latestIdRef = { current: '' };
    const store = makeInteractionStore();
    const recordUser = makeRecordUser({ latestIdRef, store });

    recordUser('ola Alice');
    const interactions = store.get();

    expect(interactions).toHaveLength(1);
    expect(interactions[0].kind).toBe('conversation');
    expect(interactions[0].userText).toBe('ola Alice');
    expect(interactions[0].status).toBe('listening');
    expect(interactions[0].aliceText).toBe('');
  });

  it('ignora texto em branco e nao adiciona interacao ao historico', () => {
    const latestIdRef = { current: '' };
    const store = makeInteractionStore();
    const recordUser = makeRecordUser({ latestIdRef, store });

    recordUser('   ');
    recordUser('');
    recordUser(null);

    expect(store.get()).toHaveLength(0);
  });

  it('atualiza a interacao existente em vez de criar nova quando ainda sem resposta', () => {
    const latestIdRef = { current: 'id-1' };
    const store = makeInteractionStore();
    // Pré-popula com uma interação aberta (sem aliceText)
    store.commit(() => [
      { id: 'id-1', kind: 'conversation', userText: 'primeira', aliceText: '', status: 'listening' },
    ]);
    const recordUser = makeRecordUser({ latestIdRef, store });

    recordUser('texto atualizado');
    const interactions = store.get();

    expect(interactions).toHaveLength(1);
    expect(interactions[0].userText).toBe('texto atualizado');
  });
});

describe('recordToolInteraction logic', () => {
  /**
   * Replica a lógica pura de recordToolInteraction sem usar React hooks.
   */
  const makeRecordTool = ({ store, trustedUtteranceRef }) =>
    (functionCall, patch = {}) => {
      const toolName = functionCall?.name || 'ferramenta_desconhecida';
      const args = functionCall?.args || {};
      const existingId = patch.id;

      store.commit((current) => {
        if (existingId) {
          return current.map((item) =>
            item.id === existingId ? { ...item, ...patch, timestamp: Date.now() } : item,
          );
        }
        const interaction = {
          id: `id-${current.length + 1}`,
          kind: 'tool',
          timestamp: Date.now(),
          status: 'running',
          toolName,
          operation: args.operation || args.taskKind || args.action || '',
          ok: null,
          userText: trustedUtteranceRef.current?.text || '',
          argsSummary: String(args),
          responseSummary: '',
          message: '',
          reason: '',
        };
        return [...current, interaction];
      });

      return existingId || store.ref.current.at(-1)?.id || '';
    };

  it('cria uma nova interacao de tool com status running', () => {
    const store = makeInteractionStore();
    const trustedUtteranceRef = { current: null };
    const recordTool = makeRecordTool({ store, trustedUtteranceRef });

    recordTool({ name: 'inspect_current_page', args: { question: 'qual e o preco?' } });
    const interactions = store.get();

    expect(interactions).toHaveLength(1);
    expect(interactions[0].kind).toBe('tool');
    expect(interactions[0].toolName).toBe('inspect_current_page');
    expect(interactions[0].status).toBe('running');
    expect(interactions[0].ok).toBeNull();
  });

  it('atualiza uma interacao existente quando patch contem id', () => {
    const store = makeInteractionStore();
    const trustedUtteranceRef = { current: null };
    const recordTool = makeRecordTool({ store, trustedUtteranceRef });

    // Cria a interação inicial
    recordTool({ name: 'inspect_current_page', args: {} });
    const createdId = store.get()[0].id;

    // Atualiza com patch contendo o id
    recordTool({ name: 'inspect_current_page', args: {} }, {
      id: createdId,
      status: 'done',
      ok: true,
      message: 'sucesso',
    });

    expect(store.get()).toHaveLength(1);
    expect(store.get()[0].status).toBe('done');
    expect(store.get()[0].ok).toBe(true);
  });
});
