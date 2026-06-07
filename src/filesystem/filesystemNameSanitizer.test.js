import { describe, expect, it } from 'vitest';
import {
  sanitizeFolderName,
  validateResolvedFolderTarget,
} from './filesystemNameSanitizer';

describe('sanitizeFolderName', () => {
  it.each([
    ['teste/pasta', 'teste-pasta', ['invalid_characters_replaced']],
    ['Aprender: Pasta?', 'Aprender- Pasta-', ['invalid_characters_replaced']],
    ['nome "com aspas"', 'nome -com aspas-', ['invalid_characters_replaced']],
    ["nome com\nquebra", 'nome com-quebra', ['invalid_characters_replaced']],
    ['', 'alice-folder', ['fallback_name_used']],
    ['   ', 'alice-folder', ['outer_whitespace_trimmed', 'fallback_name_used']],
    ['CON', 'CON-folder', ['reserved_windows_name_adjusted']],
    ['AUX', 'AUX-folder', ['reserved_windows_name_adjusted']],
    ['pasta.', 'pasta', ['trailing_space_or_dot_removed']],
    ['pasta ', 'pasta', ['outer_whitespace_trimmed']],
  ])('sanitizes %s to %s', (input, expected, warnings) => {
    const result = sanitizeFolderName(input);

    expect(result.ok).toBe(true);
    expect(result.safeName).toBe(expected);
    expect(result.warnings).toEqual(expect.arrayContaining(warnings));
  });

  it('limits very long names', () => {
    const result = sanitizeFolderName('a'.repeat(200), { maxLength: 32 });

    expect(result.ok).toBe(true);
    expect(result.safeName).toHaveLength(32);
    expect(result.warnings).toContain('name_truncated');
  });

  it('validates resolved workspace folder targets', () => {
    expect(validateResolvedFolderTarget({
      filesystemName: 'Aprender- Pasta-',
      targetPath: 'output/Aprender- Pasta-',
    }).ok).toBe(true);

    expect(validateResolvedFolderTarget({
      filesystemName: 'bad/name',
      targetPath: '../bad/name',
    })).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        'filesystem_name_invalid_characters',
        'target_path_not_workspace_relative',
      ]),
    });
  });
});
