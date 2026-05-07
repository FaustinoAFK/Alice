const WINDOWS_INVALID_FOLDER_CHARS = /[<>:"/\\|?*]/g;
const WINDOWS_INVALID_FOLDER_CHAR_TEST = /[<>:"/\\|?*]/;
const RESERVED_WINDOWS_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  ...Array.from({ length: 9 }, (_, index) => `COM${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `LPT${index + 1}`),
]);

const normalizeText = (value = '') => String(value || '');
const hasControlCharacter = (value = '') =>
  [...normalizeText(value)].some((character) => character.charCodeAt(0) <= 31);
const replaceControlCharacters = (value = '', replacement = '-') =>
  [...normalizeText(value)]
    .map((character) => (character.charCodeAt(0) <= 31 ? replacement : character))
    .join('');

const uniqueWarnings = (warnings = []) => [...new Set(warnings.filter(Boolean))];

export const isReservedWindowsFolderName = (value = '') => {
  const baseName = normalizeText(value).split('.')[0].toUpperCase();
  return RESERVED_WINDOWS_NAMES.has(baseName);
};

export const hasInvalidWindowsFolderNameCharacters = (value = '') =>
  WINDOWS_INVALID_FOLDER_CHAR_TEST.test(normalizeText(value)) || hasControlCharacter(value);

export const sanitizeFolderName = (input = '', {
  fallbackName = 'alice-learning-folder',
  maxLength = 80,
  replacement = '-',
} = {}) => {
  const originalName = normalizeText(input);
  const warnings = [];
  const safeFallback = normalizeText(fallbackName)
    .replace(WINDOWS_INVALID_FOLDER_CHARS, replacement)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[ .]+$/g, '') || 'alice-learning-folder';
  const boundedMaxLength = Math.max(8, Math.min(Number(maxLength) || 80, 120));

  let safeName = originalName;
  if (WINDOWS_INVALID_FOLDER_CHAR_TEST.test(safeName)) {
    warnings.push('invalid_characters_replaced');
    safeName = safeName.replace(WINDOWS_INVALID_FOLDER_CHARS, replacement);
  }
  if (hasControlCharacter(safeName)) {
    warnings.push('invalid_characters_replaced');
    safeName = replaceControlCharacters(safeName, replacement);
  }
  if (/[\r\n\t]/.test(safeName)) {
    warnings.push('control_whitespace_normalized');
    safeName = safeName.replace(/[\r\n\t]+/g, ' ');
  }
  if (/\s{2,}/.test(safeName)) {
    warnings.push('duplicate_spaces_normalized');
    safeName = safeName.replace(/\s+/g, ' ');
  }

  const trimmed = safeName.trim();
  if (trimmed !== safeName) {
    warnings.push('outer_whitespace_trimmed');
    safeName = trimmed;
  }

  const withoutTrailingDotsOrSpaces = safeName.replace(/[ .]+$/g, '');
  if (withoutTrailingDotsOrSpaces !== safeName) {
    warnings.push('trailing_space_or_dot_removed');
    safeName = withoutTrailingDotsOrSpaces;
  }

  if (!safeName) {
    warnings.push('fallback_name_used');
    safeName = safeFallback;
  }

  if (isReservedWindowsFolderName(safeName)) {
    warnings.push('reserved_windows_name_adjusted');
    safeName = `${safeName}-folder`;
  }

  if (safeName.length > boundedMaxLength) {
    warnings.push('name_truncated');
    safeName = safeName.slice(0, boundedMaxLength).replace(/[ .]+$/g, '');
    if (!safeName) {
      safeName = safeFallback.slice(0, boundedMaxLength).replace(/[ .]+$/g, '') || 'alice-folder';
    }
  }

  const finalReserved = isReservedWindowsFolderName(safeName);
  const finalInvalidChars = hasInvalidWindowsFolderNameCharacters(safeName);
  const ok = Boolean(safeName) && !finalReserved && !finalInvalidChars && !/[ .]$/.test(safeName);

  return {
    ok,
    originalName,
    safeName,
    changed: originalName !== safeName,
    warnings: uniqueWarnings([
      ...warnings,
      finalReserved ? 'reserved_windows_name_unresolved' : '',
      finalInvalidChars ? 'invalid_characters_unresolved' : '',
      /[ .]$/.test(safeName) ? 'trailing_space_or_dot_unresolved' : '',
    ]),
  };
};

export const isSafeWorkspaceRelativePath = (targetPath = '') => {
  const normalized = normalizeText(targetPath).replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    return false;
  }
  return normalized.split('/').every((segment) =>
    segment &&
    segment !== '..' &&
    !hasInvalidWindowsFolderNameCharacters(segment) &&
    !isReservedWindowsFolderName(segment) &&
    !/[ .]$/.test(segment));
};

export const validateResolvedFolderTarget = ({
  filesystemName = '',
  targetPath = '',
  allowedRoot = 'output',
} = {}) => {
  const normalizedName = normalizeText(filesystemName);
  const normalizedPath = normalizeText(targetPath).replace(/\\/g, '/');
  const expectedPrefix = `${normalizeText(allowedRoot).replace(/^\/+|\/+$/g, '')}/`;
  const issues = [];

  if (!normalizedName) {
    issues.push('filesystem_name_required');
  }
  if (hasInvalidWindowsFolderNameCharacters(normalizedName)) {
    issues.push('filesystem_name_invalid_characters');
  }
  if (isReservedWindowsFolderName(normalizedName)) {
    issues.push('filesystem_name_reserved');
  }
  if (/[ .]$/.test(normalizedName)) {
    issues.push('filesystem_name_trailing_space_or_dot');
  }
  if (!isSafeWorkspaceRelativePath(normalizedPath)) {
    issues.push('target_path_not_workspace_relative');
  }
  if (!normalizedPath.startsWith(expectedPrefix)) {
    issues.push('target_path_outside_allowed_workspace_root');
  }
  if (normalizedPath.split('/').at(-1) !== normalizedName) {
    issues.push('target_path_does_not_match_filesystem_name');
  }

  return {
    ok: issues.length === 0,
    issues: uniqueWarnings(issues),
    filesystemName: normalizedName,
    targetPath: normalizedPath,
  };
};
