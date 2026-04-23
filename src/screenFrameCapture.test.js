import { describe, expect, it, vi } from 'vitest';
import { captureVideoFrameToCanvas, fitCaptureFrameSize } from './screenFrameCapture';

describe('fitCaptureFrameSize', () => {
  it('preserves aspect ratio while capping width', () => {
    expect(fitCaptureFrameSize(1920, 1080, 1600)).toEqual({
      width: 1600,
      height: 900,
    });
  });

  it('returns zero size when the source dimensions are invalid', () => {
    expect(fitCaptureFrameSize(0, 1080, 1600)).toEqual({
      width: 0,
      height: 0,
    });
  });
});

describe('captureVideoFrameToCanvas', () => {
  it('draws the current video frame into the provided canvas', () => {
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
    };
    const video = {
      videoWidth: 1280,
      videoHeight: 720,
    };

    const result = captureVideoFrameToCanvas(video, canvas, 1000);

    expect(result).toEqual({
      canvas,
      width: 1000,
      height: 563,
    });
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1000, 563);
  });
});
