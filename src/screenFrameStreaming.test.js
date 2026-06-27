import { describe, expect, it, vi } from 'vitest';
import {
  calculateScreenFrameSize,
  captureScreenFrame,
  startScreenFrameStreaming,
} from './screenFrameStreaming';

describe('calculateScreenFrameSize', () => {
  it('uses the full source resolution by default', () => {
    expect(calculateScreenFrameSize(1920, 1080)).toEqual({
      width: 1920,
      height: 1080,
      sourceWidth: 1920,
      sourceHeight: 1080,
    });
  });

  it('keeps the aspect ratio when an explicit max width is provided', () => {
    expect(calculateScreenFrameSize(1920, 1080, 1600)).toEqual({
      width: 1600,
      height: 900,
      sourceWidth: 1920,
      sourceHeight: 1080,
    });
  });

  it('does not upscale smaller captures', () => {
    expect(calculateScreenFrameSize(800, 600)).toEqual({
      width: 800,
      height: 600,
      sourceWidth: 800,
      sourceHeight: 600,
    });
  });

  it('rejects frames without a usable source size', () => {
    expect(calculateScreenFrameSize(0, 1080)).toBeNull();
    expect(calculateScreenFrameSize(1920, 0)).toBeNull();
  });
});

describe('captureScreenFrame', () => {
  it('draws a JPEG frame and returns metadata for diagnostics', () => {
    const drawImage = vi.fn();
    const video = { videoWidth: 1920, videoHeight: 1080 };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toDataURL: vi.fn(() => 'data:image/jpeg;base64,abc123'),
    };

    const frame = captureScreenFrame(video, canvas);

    expect(frame).toMatchObject({
      base64: 'abc123',
      width: 1920,
      height: 1080,
      sourceWidth: 1920,
      sourceHeight: 1080,
    });
    expect(canvas.width).toBe(1920);
    expect(canvas.height).toBe(1080);
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1920, 1080);
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 1);
  });
});

describe('startScreenFrameStreaming', () => {
  it('sends an immediate frame and clears the interval on cleanup', () => {
    const intervalIds = [];
    const timerHost = {
      setInterval: vi.fn((callback, intervalMs) => {
        intervalIds.push({ callback, intervalMs });
        return 7;
      }),
      clearInterval: vi.fn(),
    };
    const video = { videoWidth: 100, videoHeight: 50 };
    const canvas = {
      getContext: vi.fn(() => ({ drawImage: vi.fn() })),
      toDataURL: vi.fn(() => 'data:image/jpeg;base64,frame'),
    };
    const onFrame = vi.fn();

    const cleanup = startScreenFrameStreaming(video, canvas, onFrame, { timerHost });

    expect(timerHost.setInterval).toHaveBeenCalledWith(expect.any(Function), 33);
    expect(onFrame).toHaveBeenCalledTimes(1);

    intervalIds[0].callback();
    expect(onFrame).toHaveBeenCalledTimes(2);

    cleanup();
    expect(timerHost.clearInterval).toHaveBeenCalledWith(7);
  });
});
