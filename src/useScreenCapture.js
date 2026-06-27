import { useRef } from 'react';
import { resolveScreenCaptureGeometry } from './screenGeometry';

/**
 * Gerencia as refs de elementos de mídia para captura de tela:
 * video element, canvas de extração de frames e o MediaStream da tela.
 * Fornece helper para calcular a geometria atual da captura.
 */
export function useScreenCapture() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const screenStreamRef = useRef(null);

  /**
   * Retorna as dimensões da captura de tela ativa a partir das
   * configurações do video track ou do elemento de vídeo como fallback.
   */
  const getScreenCaptureGeometry = () => {
    const settings = screenStreamRef.current?.getVideoTracks()[0]?.getSettings?.() || {};
    return resolveScreenCaptureGeometry(settings, videoRef.current);
  };

  return {
    videoRef,
    canvasRef,
    screenStreamRef,
    getScreenCaptureGeometry,
  };
}
