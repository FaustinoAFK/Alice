import { describe, expect, it, vi } from 'vitest';
import { findOcrTextMatch, locateTextInCanvas, normalizeOcrText, tokenizeOcrTarget } from './ocrTextLocator';

describe('normalizeOcrText', () => {
  it('normalizes accents, punctuation and case for OCR comparisons', () => {
    expect(normalizeOcrText('Configurações!')).toBe('configuracoes');
  });
});

describe('tokenizeOcrTarget', () => {
  it('extracts meaningful OCR tokens from the target text', () => {
    expect(tokenizeOcrTarget('Salvar como')).toEqual(['salvar', 'como']);
  });
});

describe('findOcrTextMatch', () => {
  it('matches a single-word OCR target and returns normalized click coordinates', () => {
    const match = findOcrTextMatch(
      [
        { text: 'Salvar', bbox: { x0: 100, y0: 40, x1: 180, y1: 64 } },
        { text: 'Cancelar', bbox: { x0: 220, y0: 40, x1: 330, y1: 64 } },
      ],
      'Salvar',
      400,
      200,
    );

    expect(match).toMatchObject({
      text: 'Salvar',
      bbox: { x0: 100, y0: 40, x1: 180, y1: 64 },
      normalizedX: 350,
      normalizedY: 260,
    });
  });

  it('matches a multi-word OCR target by combining consecutive words', () => {
    const match = findOcrTextMatch(
      [
        { text: 'Fazer', bbox: { x0: 20, y0: 10, x1: 60, y1: 30 } },
        { text: 'login', bbox: { x0: 70, y0: 10, x1: 120, y1: 30 } },
      ],
      'Fazer login',
      200,
      100,
    );

    expect(match).toMatchObject({
      bbox: { x0: 20, y0: 10, x1: 120, y1: 30 },
    });
  });

  it('returns null when OCR words do not contain the requested target', () => {
    const match = findOcrTextMatch(
      [{ text: 'Continuar', bbox: { x0: 10, y0: 10, x1: 80, y1: 30 } }],
      'Salvar',
      200,
      100,
    );

    expect(match).toBeNull();
  });
});

describe('locateTextInCanvas', () => {
  it('delegates recognition to the OCR engine and returns the located target', async () => {
    const recognize = vi.fn(async () => ({
      data: {
        words: [{ text: 'Salvar', bbox: { x0: 100, y0: 40, x1: 180, y1: 64 } }],
      },
    }));
    const canvas = { width: 400, height: 200 };

    const result = await locateTextInCanvas(canvas, 'Salvar', { recognize });

    expect(recognize).toHaveBeenCalledWith(canvas);
    expect(result?.normalizedX).toBe(350);
  });
});
