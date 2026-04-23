export const buildOcrClickAction = ({
  action,
  locatedText,
  geometry,
  attachCaptureGeometry,
}) =>
  attachCaptureGeometry(
    {
      type: 'mouse_click',
      button: action.button || 'left',
      x: locatedText.normalizedX,
      y: locatedText.normalizedY,
    },
    geometry,
  );

export const formatOcrFallbackMessage = ({
  baseMessage,
  target,
  locatedText,
}) =>
  `${baseMessage || 'Clique executado.'} (OCR encontrou '${target}' em ${locatedText.normalizedX},${locatedText.normalizedY}).`;
