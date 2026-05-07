const normalizeString = (value) => (value === undefined || value === null ? null : String(value));

const normalizeBoolean = (value) => (typeof value === 'boolean' ? value : null);

const normalizeNumber = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const normalizeTextInputDiagnostics = (diagnostics = {}) => {
  if (!diagnostics || typeof diagnostics !== 'object') {
    return null;
  }

  return {
    ...diagnostics,
    driver: normalizeString(diagnostics.driver) || 'vmTextInputDriver',
    expectedText: normalizeString(diagnostics.expectedText),
    actualTextPreview: normalizeString(diagnostics.actualTextPreview),
    fileExists: normalizeBoolean(diagnostics.fileExists),
    fileSize: normalizeNumber(diagnostics.fileSize),
    expectedLength: normalizeNumber(diagnostics.expectedLength),
    actualLength: normalizeNumber(diagnostics.actualLength),
    inputMethod: normalizeString(diagnostics.inputMethod),
    sendKeysFallbackUsed: normalizeBoolean(diagnostics.sendKeysFallbackUsed),
    activeWindowBeforeInput: normalizeString(diagnostics.activeWindowBeforeInput),
    activeWindowAfterInput: normalizeString(diagnostics.activeWindowAfterInput),
    saveAttempted: normalizeBoolean(diagnostics.saveAttempted),
    fileLastWriteTimeChanged: normalizeBoolean(diagnostics.fileLastWriteTimeChanged),
    validationPassed: normalizeBoolean(diagnostics.validationPassed),
    failureReason: normalizeString(diagnostics.failureReason) || '',
  };
};

const parseDiagnosticsPayload = (payload = '') => {
  const jsonEnd = payload.lastIndexOf('}');
  const jsonText = jsonEnd >= 0 ? payload.slice(0, jsonEnd + 1) : payload;
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  if (parsed.driver && parsed.driver !== 'vmTextInputDriver') {
    return null;
  }
  if (!parsed.driver && !('inputMethod' in parsed) && !('validationPassed' in parsed)) {
    return null;
  }
  return normalizeTextInputDiagnostics(parsed);
};

const createParseFailureDiagnostics = ({ raw = '', error = null } = {}) =>
  normalizeTextInputDiagnostics({
    driver: 'vmTextInputDriver',
    validationPassed: false,
    failureReason: 'text_input_diagnostics_parse_failed',
    parseError: error?.message || String(error || 'parse_failed'),
    rawPreview: String(raw || '').slice(0, 500),
  });

const extractStringField = (output = '', field = '') => {
  const jsonMatch = String(output).match(new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, 'i'));
  if (jsonMatch) {
    return jsonMatch[1].replace(/\\\\/g, '\\');
  }
  const lineMatch = String(output).match(new RegExp(`(?:^|\\n)${field}=([^\\r\\n]+)`, 'i'));
  return lineMatch ? lineMatch[1].trim() : null;
};

const extractBooleanField = (output = '', field = '') => {
  const match = String(output).match(new RegExp(`"${field}"\\s*:\\s*(true|false)`, 'i'));
  return match ? match[1].toLowerCase() === 'true' : null;
};

const extractNumberField = (output = '', field = '') => {
  const match = String(output).match(new RegExp(`"${field}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, 'i'));
  return match ? Number(match[1]) : null;
};

const parseTruncatedDiagnosticsOutput = (output = '') => {
  const text = String(output || '');
  if (
    !text.includes('"inputMethod"') &&
    !text.includes('"validationPassed"') &&
    !text.includes('input_method=')
  ) {
    return null;
  }

  const diagnostics = normalizeTextInputDiagnostics({
    driver: 'vmTextInputDriver',
    expectedText: extractStringField(text, 'expectedText') || extractStringField(text, 'typed_text'),
    actualTextPreview: extractStringField(text, 'actualTextPreview'),
    fileExists: extractBooleanField(text, 'fileExists'),
    fileSize: extractNumberField(text, 'fileSize'),
    expectedLength: extractNumberField(text, 'expectedLength'),
    actualLength: extractNumberField(text, 'actualLength'),
    inputMethod: extractStringField(text, 'inputMethod') || extractStringField(text, 'input_method'),
    sendKeysFallbackUsed: extractBooleanField(text, 'sendKeysFallbackUsed'),
    activeWindowBeforeInput: extractStringField(text, 'activeWindowBeforeInput'),
    activeWindowAfterInput: extractStringField(text, 'activeWindowAfterInput'),
    saveAttempted: extractBooleanField(text, 'saveAttempted'),
    fileLastWriteTimeChanged: extractBooleanField(text, 'fileLastWriteTimeChanged'),
    validationPassed: extractBooleanField(text, 'validationPassed'),
    failureReason: extractStringField(text, 'failureReason') || '',
    filePath: extractStringField(text, 'filePath') || extractStringField(text, 'file_path'),
    parseWarning: 'text_input_diagnostics_prefix_missing_or_truncated',
  });

  if (diagnostics.validationPassed === null && diagnostics.inputMethod) {
    diagnostics.validationPassed = text.includes('alice-learning-vm:field-interacted') ? true : null;
  }

  return diagnostics;
};

export const parseTextInputDiagnosticsOutput = (output = '') => {
  const lines = String(output || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let malformedPayload = null;
  let parseError = null;

  for (const line of lines.reverse()) {
    const prefix = 'vm_text_input_diagnostics=';
    const index = line.indexOf(prefix);
    if (index < 0) {
      continue;
    }
    const payload = line.slice(index + prefix.length);
    try {
      const diagnostics = parseDiagnosticsPayload(payload);
      if (diagnostics) {
        return diagnostics;
      }
    } catch (error) {
      malformedPayload = payload;
      parseError = error;
    }
  }

  if (malformedPayload !== null) {
    return createParseFailureDiagnostics({ raw: malformedPayload, error: parseError });
  }

  return parseTruncatedDiagnosticsOutput(output);
};
