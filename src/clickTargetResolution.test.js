import { describe, expect, it } from 'vitest';
import { buildOcrClickAction, formatOcrFallbackMessage } from './clickTargetResolution';

describe('buildOcrClickAction', () => {
  it('converts an OCR text match into a normalized mouse click action', () => {
    const action = buildOcrClickAction({
      action: { type: 'click_target', target: 'Salvar', button: 'left' },
      locatedText: { normalizedX: 320, normalizedY: 640 },
      geometry: { width: 1920, height: 1080 },
      attachCaptureGeometry: (nextAction, geometry) => ({
        ...nextAction,
        captureWidth: geometry.width,
        captureHeight: geometry.height,
      }),
    });

    expect(action).toEqual({
      type: 'mouse_click',
      button: 'left',
      x: 320,
      y: 640,
      captureWidth: 1920,
      captureHeight: 1080,
    });
  });
});

describe('formatOcrFallbackMessage', () => {
  it('describes the OCR fallback result with the located coordinates', () => {
    expect(
      formatOcrFallbackMessage({
        baseMessage: 'Clique executado.',
        target: 'Salvar',
        locatedText: { normalizedX: 320, normalizedY: 640 },
      }),
    ).toBe("Clique executado. (OCR encontrou 'Salvar' em 320,640).");
  });
});
