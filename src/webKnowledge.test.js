import { describe, expect, it } from 'vitest';
import {
  classifyKnowledgeScope,
  createEmptyKnowledgeState,
  extractKnowledgeTerms,
  KNOWLEDGE_SCOPES,
  KNOWLEDGE_SUFFICIENCY,
  mergeKnowledgeState,
  nextKnowledgeScopeForExpansion,
  normalizeNavigationContext,
} from './webKnowledge';

describe('normalizeNavigationContext', () => {
  it('returns null for empty payloads', () => {
    expect(normalizeNavigationContext(null)).toBeNull();
    expect(normalizeNavigationContext({})).toBeNull();
  });

  it('normalizes the browser context payload', () => {
    expect(
      normalizeNavigationContext({
        url: 'https://example.com/docs',
        domain: 'example.com',
        title: 'Docs',
        selectionText: 'trecho',
        timestamp: 123,
      }),
    ).toEqual({
      url: 'https://example.com/docs',
      domain: 'example.com',
      title: 'Docs',
      selectionText: 'trecho',
      timestamp: 123,
    });
  });
});

describe('extractKnowledgeTerms', () => {
  it('keeps only meaningful terms from a question', () => {
    expect(extractKnowledgeTerms('essa pagina fala sobre retrieval augmented generation?')).toEqual([
      'retrieval',
      'augmented',
      'generation',
    ]);
  });
});

describe('classifyKnowledgeScope', () => {
  const navigationContext = {
    url: 'https://example.com/docs',
    domain: 'example.com',
    title: 'Docs',
    selectionText: 'texto selecionado',
    timestamp: 10,
  };

  it('classifies explicit page questions as current_page', () => {
    expect(
      classifyKnowledgeScope({
        question: 'essa pagina fala sobre RAG?',
        navigationContext,
      }),
    ).toBe(KNOWLEDGE_SCOPES.CURRENT_PAGE);
  });

  it('classifies site-wide questions as same_domain', () => {
    expect(
      classifyKnowledgeScope({
        question: 'esse site fala de integracao com IA?',
        navigationContext,
      }),
    ).toBe(KNOWLEDGE_SCOPES.SAME_DOMAIN);
  });

  it('classifies general questions as global', () => {
    expect(
      classifyKnowledgeScope({
        question: 'quais sao os melhores lugares para aprender IA?',
        navigationContext,
      }),
    ).toBe(KNOWLEDGE_SCOPES.GLOBAL);
  });

  it('prioritizes the current page when there is selected text and a short contextual question', () => {
    expect(
      classifyKnowledgeScope({
        question: 'o que isso significa?',
        navigationContext,
      }),
    ).toBe(KNOWLEDGE_SCOPES.CURRENT_PAGE);
  });
});

describe('nextKnowledgeScopeForExpansion', () => {
  it('expands from current page to same domain when the answer is not sufficient', () => {
    expect(
      nextKnowledgeScopeForExpansion({
        scope: KNOWLEDGE_SCOPES.CURRENT_PAGE,
        sufficiency: KNOWLEDGE_SUFFICIENCY.PARTIAL,
      }),
    ).toBe(KNOWLEDGE_SCOPES.SAME_DOMAIN);
  });

  it('expands from same domain to global when the answer is still insufficient', () => {
    expect(
      nextKnowledgeScopeForExpansion({
        scope: KNOWLEDGE_SCOPES.SAME_DOMAIN,
        sufficiency: KNOWLEDGE_SUFFICIENCY.INSUFFICIENT,
      }),
    ).toBe(KNOWLEDGE_SCOPES.GLOBAL);
  });
});

describe('knowledge state helpers', () => {
  it('creates and merges operational state without persisting page content in memory', () => {
    const state = mergeKnowledgeState(createEmptyKnowledgeState(), {
      lastKnowledgeScope: KNOWLEDGE_SCOPES.SAME_DOMAIN,
      lastKnowledgeSources: ['https://example.com/docs'],
    });

    expect(state.lastKnowledgeScope).toBe(KNOWLEDGE_SCOPES.SAME_DOMAIN);
    expect(state.lastKnowledgeSources).toEqual(['https://example.com/docs']);
    expect(state.pageSnapshot).toBeNull();
  });
});
