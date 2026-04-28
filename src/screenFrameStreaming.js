export const DEFAULT_SCREEN_FRAME_MAX_WIDTH = Number.POSITIVE_INFINITY;
export const DEFAULT_SCREEN_FRAME_TARGET_FPS = 3;
export const DEFAULT_SCREEN_FRAME_INTERVAL_MS = Math.round(1000 / DEFAULT_SCREEN_FRAME_TARGET_FPS);
export const DEFAULT_SCREEN_FRAME_JPEG_QUALITY = 1;

export const calculateScreenFrameSize = (
  sourceWidth,
  sourceHeight,
  maxWidth = DEFAULT_SCREEN_FRAME_MAX_WIDTH,
) => {
  const width = Number(sourceWidth || 0);
  const height = Number(sourceHeight || 0);
  const limit = Number(maxWidth || DEFAULT_SCREEN_FRAME_MAX_WIDTH);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  const targetWidth = Math.max(
    1,
    Math.round(Number.isFinite(limit) && limit > 0 ? Math.min(width, limit) : width),
  );
  const targetHeight = Math.max(1, Math.round((height / width) * targetWidth));

  return {
    width: targetWidth,
    height: targetHeight,
    sourceWidth: Math.round(width),
    sourceHeight: Math.round(height),
  };
};

export const captureScreenFrame = (
  video,
  canvas,
  {
    maxWidth = DEFAULT_SCREEN_FRAME_MAX_WIDTH,
    jpegQuality = DEFAULT_SCREEN_FRAME_JPEG_QUALITY,
  } = {},
) => {
  const frameSize = calculateScreenFrameSize(video?.videoWidth, video?.videoHeight, maxWidth);
  if (!frameSize) {
    return null;
  }

  const context = canvas?.getContext?.('2d', { alpha: false });
  if (!context) {
    return null;
  }

  canvas.width = frameSize.width;
  canvas.height = frameSize.height;
  context.drawImage(video, 0, 0, frameSize.width, frameSize.height);

  const [, base64Frame] = String(canvas.toDataURL('image/jpeg', jpegQuality) || '').split(',');
  if (!base64Frame) {
    return null;
  }

  return {
    ...frameSize,
    base64: base64Frame,
  };
};

export const startScreenFrameStreaming = (
  video,
  canvas,
  onFrame,
  {
    intervalMs = DEFAULT_SCREEN_FRAME_INTERVAL_MS,
    maxWidth = DEFAULT_SCREEN_FRAME_MAX_WIDTH,
    jpegQuality = DEFAULT_SCREEN_FRAME_JPEG_QUALITY,
    timerHost = globalThis,
  } = {},
) => {
  const sendFrame = () => {
    const frame = captureScreenFrame(video, canvas, { maxWidth, jpegQuality });
    if (frame) {
      onFrame(frame);
    }
  };

  const intervalId = timerHost.setInterval(sendFrame, intervalMs);
  sendFrame();

  return () => timerHost.clearInterval(intervalId);
};
