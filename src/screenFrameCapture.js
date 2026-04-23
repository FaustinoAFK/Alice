export const DEFAULT_OCR_CAPTURE_MAX_WIDTH = 1600;

export const fitCaptureFrameSize = (
  sourceWidth,
  sourceHeight,
  maxWidth = DEFAULT_OCR_CAPTURE_MAX_WIDTH,
) => {
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
    return { width: 0, height: 0 };
  }

  const boundedWidth = Math.min(sourceWidth, maxWidth);
  const scale = boundedWidth / sourceWidth;

  return {
    width: Math.round(boundedWidth),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
};

export const captureVideoFrameToCanvas = (
  video,
  canvas,
  maxWidth = DEFAULT_OCR_CAPTURE_MAX_WIDTH,
) => {
  const sourceWidth = Number(video?.videoWidth || 0);
  const sourceHeight = Number(video?.videoHeight || 0);
  const { width, height } = fitCaptureFrameSize(sourceWidth, sourceHeight, maxWidth);

  if (!width || !height || !canvas) {
    return null;
  }

  const context = canvas.getContext('2d', { alpha: false });
  canvas.width = width;
  canvas.height = height;
  context.drawImage(video, 0, 0, width, height);

  return {
    canvas,
    width,
    height,
  };
};
