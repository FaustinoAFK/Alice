import { describe, expect, it } from 'vitest';
import { parseTextInputDiagnosticsOutput } from '../autonomousRunnerTextInputDiagnostics';
import { validateRunnerCompletionCriteria } from '../autonomousRunnerValidation';
import { buildNotepadControlledTextInputScript } from './vmTextInputDriver';

describe('VM text input driver', () => {
  it('uses explicit Notepad file, clipboard paste, physical readback and SendKeys fallback', () => {
    const script = buildNotepadControlledTextInputScript({
      text: 'alice field test',
      fileName: 'alice-learning-notepad-test.txt',
      marker: 'alice-learning-vm:field-interacted',
    });

    expect(script).toContain("Start-Process -FilePath notepad.exe -ArgumentList $file");
    expect(script).toContain('[AliceVmWindow]::GetForegroundWindow()');
    expect(script).toContain('Set-Clipboard -Value $inputText');
    expect(script).toContain('Add-Type -AssemblyName System.Windows.Forms | Out-Null');
    expect(script).toContain('trap { if ($diagnostics');
    expect(script).toContain("$diagnostics.inputMethod = 'clipboard_paste'");
    expect(script).toContain("$diagnostics.inputMethod = 'sendkeys_fallback'");
    expect(script).toContain("[System.Windows.Forms.SendKeys]::SendWait('^v')");
    expect(script).toContain("[System.Windows.Forms.SendKeys]::SendWait($inputText)");
    expect(script).toContain("[System.Windows.Forms.SendKeys]::SendWait('^s')");
    expect(script).toContain('Get-Content -LiteralPath $file -Raw -Encoding UTF8');
    expect(script).toContain('$content -ceq $text');
    expect(script).toContain("throw 'controlled_text_file_mismatch'");
    expect(script).toContain('vm_text_input_diagnostics=');
    expect(script).toContain('expectedText = $text');
    expect(script).toContain('actualTextPreview');
    expect(script).toContain('fileExists');
    expect(script).toContain('fileSize');
    expect(script).toContain('activeWindowBeforeInput');
    expect(script).toContain('activeWindowAfterInput');
    expect(script).toContain('saveAttempted');
    expect(script).toContain('fileLastWriteTimeChanged');
    expect(script).toContain('failureReason');
    expect(script).toContain('alice-learning-vm:field-interacted');
  });

  it('uses mocked driver diagnostics without requiring a real VM', () => {
    const expectedText = 'alice expected text';
    const diagnostics = {
      driver: 'vmTextInputDriver',
      expectedText,
      actualTextPreview: '',
      inputMethod: 'clipboard_paste',
      fileExists: true,
      fileSize: 0,
      saveAttempted: true,
      fileLastWriteTimeChanged: false,
      validationPassed: false,
      failureReason: 'controlled_text_file_mismatch',
    };
    const validation = validateRunnerCompletionCriteria({
      step: {
        id: 'vm-text-input-stub',
        completionCriteria: { type: 'file_contains', contains: 'alice-learning-vm:field-interacted' },
        expectedEvidence: {
          kind: 'complete',
          required: ['stdout'],
        },
      },
      executionResult: {
        ok: true,
        stdout: `vm_text_input_diagnostics=${JSON.stringify(diagnostics)}`,
        stderr: 'controlled_text_file_mismatch',
      },
      evidenceRefs: [{
        kind: 'stdout',
        label: 'stdout',
        path: 'data/evidence/stub/stdout.txt',
      }],
    });

    expect(validation.passed).toBe(false);
    expect(validation.reason).toBe('file_contains_not_evidenced');
    expect(validation.textInputDiagnostics).toMatchObject({
      expectedText,
      fileExists: true,
      inputMethod: 'clipboard_paste',
      failureReason: 'controlled_text_file_mismatch',
    });
  });

  it('can intentionally type input text that differs from expected text for negative smoke validation', () => {
    const script = buildNotepadControlledTextInputScript({
      text: 'expected text',
      expectedText: 'expected text',
      inputText: 'actual mismatch text',
      fileName: 'alice-negative-smoke.txt',
    });

    expect(script).toContain("$text = 'expected text'");
    expect(script).toContain("$inputText = 'actual mismatch text'");
    expect(script).toContain('$allowSendKeysFallback = $true');
    expect(script).toContain('$closeExistingTargetProcesses = $false');
    expect(script).toContain('$forceMismatchFileOnActivationFailure = $false');
    expect(script).toContain('Set-Clipboard -Value $inputText');
    expect(script).toContain('[System.Windows.Forms.SendKeys]::SendWait($inputText)');
    expect(script).toContain('$content -ceq $text');
    expect(script).toContain("Write-Output ('typed_text=' + $inputText)");
  });

  it('can force a physical mismatch file for negative smoke when VM focus is unavailable', () => {
    const script = buildNotepadControlledTextInputScript({
      inputText: 'actual mismatch text',
      forceMismatchFileOnActivationFailure: true,
    });

    expect(script).toContain('$forceMismatchFileOnActivationFailure = $true');
    expect(script).toContain("[System.IO.File]::WriteAllText($file, $inputText");
    expect(script).toContain("$diagnostics.inputMethod = 'controlled_negative_file_write'");
    expect(script).toContain("$diagnostics.failureReason = 'controlled_text_file_mismatch'");
  });

  it('can close existing target process windows for isolated runtime smoke tests', () => {
    const script = buildNotepadControlledTextInputScript({
      closeExistingTargetProcesses: true,
    });

    expect(script).toContain('$closeExistingTargetProcesses = $true');
    expect(script).toContain('Stop-Process -Force');
  });

  it('can disable SendKeys fallback for controlled negative smoke mismatches', () => {
    const script = buildNotepadControlledTextInputScript({
      text: 'expected text',
      inputText: 'actual mismatch text',
      allowSendKeysFallback: false,
    });

    expect(script).toContain('$allowSendKeysFallback = $false');
    expect(script).toContain('if ($allowSendKeysFallback -and -not $diagnostics.clipboardPasteAttempted)');
    expect(script).toContain('if ($allowSendKeysFallback -and -not $diagnostics.validationPassed');
  });

  it('returns explicit diagnostic parse failure instead of silent null when output is malformed', () => {
    const validation = validateRunnerCompletionCriteria({
      step: {
        id: 'vm-text-input-malformed',
        completionCriteria: { type: 'file_contains', contains: 'alice-learning-vm:field-interacted' },
        expectedEvidence: {
          kind: 'complete',
          required: ['stdout'],
        },
      },
      executionResult: {
        ok: true,
        stdout: 'vm_text_input_diagnostics={"driver":"vmTextInputDriver","inputMethod":',
        stderr: '',
      },
      evidenceRefs: [{
        kind: 'stdout',
        label: 'stdout',
        path: 'data/evidence/stub/stdout.txt',
      }],
    });

    expect(validation.passed).toBe(false);
    expect(validation.textInputDiagnostics).toMatchObject({
      driver: 'vmTextInputDriver',
      validationPassed: false,
      failureReason: 'text_input_diagnostics_parse_failed',
    });
  });

  it('recovers structured diagnostics when the guest agent truncates the diagnostic prefix', () => {
    const diagnostics = parseTextInputDiagnosticsOutput([
      ' ProviderCmdlet = "Resolve-Path")]","inputMethod":"clipboard_paste",',
      '"sendKeysFallbackUsed":false,"activeWindowBeforeInput":"655824",',
      '"activeWindowAfterInput":"655824","saveAttempted":true,',
      '"fileExists":true,"fileSize":36,"fileLastWriteTimeChanged":true,',
      '"validationPassed":true,"failureReason":"","expectedLength":33,"actualLength":33}',
      'alice-learning-vm:field-interacted',
      'file_path=C:\\Users\\alice\\AppData\\Local\\Temp\\alice-runtime-text-input-smoke.txt',
      'typed_text=alice text input smoke real vm ok',
      'input_method=clipboard_paste',
    ].join('\n'));

    expect(diagnostics).toMatchObject({
      driver: 'vmTextInputDriver',
      expectedText: 'alice text input smoke real vm ok',
      inputMethod: 'clipboard_paste',
      sendKeysFallbackUsed: false,
      fileExists: true,
      fileSize: 36,
      expectedLength: 33,
      actualLength: 33,
      saveAttempted: true,
      fileLastWriteTimeChanged: true,
      validationPassed: true,
      failureReason: '',
      parseWarning: 'text_input_diagnostics_prefix_missing_or_truncated',
    });
  });
});
