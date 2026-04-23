export const LIVE_GUIDANCE_GRID_STEP = 100;

export const normalizedCoordinateToCanvasPixel = (value, extent) => {
  if (!Number.isFinite(value) || !Number.isFinite(extent) || extent <= 0) {
    return 0;
  }

  const clampedValue = Math.min(1000, Math.max(0, value));
  return Math.round((clampedValue / 1000) * Math.max(0, extent - 1));
};

export const drawLiveGuidanceOverlay = (
  context,
  width,
  height,
  step = LIVE_GUIDANCE_GRID_STEP,
) => {
  if (!context || width <= 0 || height <= 0 || step <= 0) {
    return;
  }

  context.save();
  context.strokeStyle = 'rgba(135, 206, 250, 0.35)';
  context.fillStyle = 'rgba(255, 255, 255, 0.92)';
  context.lineWidth = 1;
  context.font = '12px sans-serif';
  context.textBaseline = 'top';

  for (let value = 0; value <= 1000; value += step) {
    const x = normalizedCoordinateToCanvasPixel(value, width);
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();

    const y = normalizedCoordinateToCanvasPixel(value, height);
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();

    if (value < 1000) {
      context.fillText(`${value}`, Math.min(width - 28, x + 4), 4);
      context.fillText(`${value}`, 4, Math.min(height - 16, y + 2));
    }
  }

  context.restore();
};
