import { describe, expect, it } from 'vitest';
import { createEmptyKnowledgeState, mergeKnowledgeState } from './webKnowledge';

describe('createEmptyKnowledgeState', () => {
  it('retorna um estado com todos os campos obrigatorios e valores padrao', () => {
    const state = createEmptyKnowledgeState();

    expect(state.navigationContext).toBeNull();
    expect(state.pageSnapshot).toBeNull();
    expect(state.navigationContextCapturedAt).toBe(0);
    expect(state.pageSnapshotCapturedAt).toBe(0);
    expect(state.lastKnowledgeSources).toEqual([]);
    expect(state.lastFetchedPages).toEqual([]);
    expect(state.lastExpansionPath).toEqual([]);
    expect(state.lastKnowledgeTrace).toEqual([]);
    expect(state.lastKnowledgeOrigin).toBe('-');
  });

  it('retorna instancias independentes a cada chamada (sem compartilhamento de referencia)', () => {
    const a = createEmptyKnowledgeState();
    const b = createEmptyKnowledgeState();

    expect(a).not.toBe(b);
    expect(a).toEqual(b);

    // Mutacao em uma nao afeta a outra
    a.lastKnowledgeQuestion = 'modificado';
    expect(b.lastKnowledgeQuestion).toBe('');
  });
});

describe('updateKnowledgeState logic', () => {
  /**
   * Simula a logica de updateKnowledgeState sem React.
   */
  const makeKnowledgeStore = () => {
    const ref = { current: createEmptyKnowledgeState() };
    return {
      update: (patch) => {
        const nextState = mergeKnowledgeState(ref.current, patch);
        ref.current = nextState;
      },
      get: () => ref.current,
    };
  };

  it('mescla um patch no estado atual preservando campos nao alterados', () => {
    const store = makeKnowledgeStore();

    store.update({ lastKnowledgeQuestion: 'qual e o preco?' });

    expect(store.get().lastKnowledgeQuestion).toBe('qual e o preco?');
    // Campo nao tocado permanece no valor padrao
    expect(store.get().pageSnapshot).toBeNull();
    expect(store.get().navigationContext).toBeNull();
  });

  it('acumula multiplos patches sem perder dados anteriores', () => {
    const store = makeKnowledgeStore();

    store.update({ lastKnowledgeQuestion: 'primeira pergunta' });
    store.update({ lastKnowledgeOrigin: 'page_snapshot' });

    expect(store.get().lastKnowledgeQuestion).toBe('primeira pergunta');
    expect(store.get().lastKnowledgeOrigin).toBe('page_snapshot');
  });

  it('reset efetivo ao aplicar estado vazio como patch — todos os campos voltam ao padrao', () => {
    const store = makeKnowledgeStore();

    store.update({ lastKnowledgeQuestion: 'pergunta anterior', lastKnowledgeOrigin: 'web_fetch' });
    store.update(createEmptyKnowledgeState());

    expect(store.get().lastKnowledgeQuestion).toBe('');
    expect(store.get().lastKnowledgeOrigin).toBe('-');
  });
});
