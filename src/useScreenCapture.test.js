import { describe, expect, it } from 'vitest';
import { resolveScreenCaptureGeometry } from './screenGeometry';

describe('resolveScreenCaptureGeometry', () => {
  it('retorna width e height a partir das configuracoes do track quando disponíveis', () => {
    const geometry = resolveScreenCaptureGeometry({ width: 1920, height: 1080 }, null);

    expect(geometry.width).toBe(1920);
    expect(geometry.height).toBe(1080);
  });

  it('retorna zeros quando nao ha stream nem elemento de video', () => {
    const geometry = resolveScreenCaptureGeometry({}, null);

    expect(geometry.width).toBe(0);
    expect(geometry.height).toBe(0);
  });

  it('usa as dimensoes do elemento de video como fallback quando o track nao reporta dimensoes', () => {
    const videoElement = { videoWidth: 1280, videoHeight: 720 };
    const geometry = resolveScreenCaptureGeometry({}, videoElement);

    expect(geometry.width).toBe(1280);
    expect(geometry.height).toBe(720);
  });

  it('prioriza as configuracoes do track sobre as dimensoes do elemento de video', () => {
    const videoElement = { videoWidth: 640, videoHeight: 480 };
    const geometry = resolveScreenCaptureGeometry({ width: 2560, height: 1440 }, videoElement);

    expect(geometry.width).toBe(2560);
    expect(geometry.height).toBe(1440);
  });
});

describe('getScreenCaptureGeometry logic', () => {
  /**
   * Replica a lógica de getScreenCaptureGeometry sem React, usando refs simulados.
   */
  const makeGetGeometry = ({ screenStreamRef, videoRef }) =>
    () => {
      const settings = screenStreamRef.current?.getVideoTracks()[0]?.getSettings?.() || {};
      return resolveScreenCaptureGeometry(settings, videoRef.current);
    };

  it('usa as configuracoes do video track quando o stream esta ativo', () => {
    const screenStreamRef = {
      current: {
        getVideoTracks: () => [{ getSettings: () => ({ width: 2560, height: 1440 }) }],
      },
    };
    const videoRef = { current: null };
    const getGeometry = makeGetGeometry({ screenStreamRef, videoRef });

    expect(getGeometry()).toEqual({ width: 2560, height: 1440 });
  });

  it('retorna geometria vazia quando nao ha stream ativo', () => {
    const screenStreamRef = { current: null };
    const videoRef = { current: null };
    const getGeometry = makeGetGeometry({ screenStreamRef, videoRef });

    expect(getGeometry()).toEqual({ width: 0, height: 0 });
  });

  it('usa dimensoes do elemento de video quando o track nao tem getSettings', () => {
    const screenStreamRef = {
      current: {
        getVideoTracks: () => [{}],
      },
    };
    const videoRef = { current: { videoWidth: 1280, videoHeight: 720 } };
    const getGeometry = makeGetGeometry({ screenStreamRef, videoRef });

    expect(getGeometry()).toEqual({ width: 1280, height: 720 });
  });
});
