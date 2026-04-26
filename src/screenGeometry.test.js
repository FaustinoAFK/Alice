import { describe, expect, it } from 'vitest';
import { resolveScreenCaptureGeometry, SCREEN_SHARE_VIDEO_CONSTRAINTS } from './screenGeometry';

describe('SCREEN_SHARE_VIDEO_CONSTRAINTS', () => {
  it('does not force a lower capture resolution for screen sharing', () => {
    expect(SCREEN_SHARE_VIDEO_CONSTRAINTS).toEqual({
      frameRate: { ideal: 5, max: 10 },
    });
  });
});

describe('resolveScreenCaptureGeometry', () => {
  it('prefers the track settings dimensions when they are available', () => {
    expect(
      resolveScreenCaptureGeometry({ width: 1920, height: 1080 }, { videoWidth: 1280, videoHeight: 720 }),
    ).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it('falls back to the rendered video dimensions when track settings are missing', () => {
    expect(resolveScreenCaptureGeometry({}, { videoWidth: 1366, videoHeight: 768 })).toEqual({
      width: 1366,
      height: 768,
    });
  });

  it('returns zeroes when no valid geometry exists yet', () => {
    expect(resolveScreenCaptureGeometry({}, { videoWidth: 0, videoHeight: 0 })).toEqual({
      width: 0,
      height: 0,
    });
  });
});
