export const SCREEN_SHARE_VIDEO_CONSTRAINTS = {
  frameRate: { ideal: 30, max: 30 },
};

const toPositiveNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.round(numericValue) : 0;
};

export const resolveScreenCaptureGeometry = (trackSettings = {}, video = null) => {
  const width = toPositiveNumber(trackSettings?.width) || toPositiveNumber(video?.videoWidth);
  const height = toPositiveNumber(trackSettings?.height) || toPositiveNumber(video?.videoHeight);

  return { width, height };
};
