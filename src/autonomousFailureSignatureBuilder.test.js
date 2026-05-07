import { describe, expect, it } from 'vitest';
import {
  buildFailureSignature,
  buildTaskFailureSignature,
} from './autonomousFailureSignatureBuilder';

describe('autonomous failure signature builder', () => {
  it('builds stable signatures from learning gap, error, validation and method', () => {
    const signature = buildFailureSignature({
      task: {
        metadata: { capability: 'text.field interaction' },
      },
      step: {
        id: 'learning-vm-notepad-field-interaction-field-command',
        status: 'failed',
        result: {
          validation: { reason: 'file_contains_not_evidenced' },
        },
      },
      execution: {
        status: 'failed',
        validation: {
          reason: 'file_contains_not_evidenced',
          commandResult: {
            stderr: 'controlled_text_file_mismatch',
          },
        },
      },
    });

    expect(signature).toBe(
      'text.field_interaction|controlled_text_file_mismatch|file_contains_not_evidenced|sendkeys',
    );
  });

  it('includes environment when the failure is tied to VM execution', () => {
    const signature = buildTaskFailureSignature({
      id: 'learning-gap-field-123',
      status: 'failed',
      reason: 'max_attempts_reached',
      requiresRealVm: true,
      metadata: { capability: 'field.interaction' },
      steps: [{
        id: 'learning-vm-notepad-field-interaction-field-command',
        type: 'visual',
        status: 'failed',
        reason: 'max_attempts_reached',
        action: {
          kind: 'visual',
          environment: 'real_vm',
          requestedResources: {
            autonomousLearning: {
              strategyId: 'vm_notepad_field_interaction',
            },
          },
        },
      }],
      executionHistory: [{
        status: 'failed',
        reason: 'max_attempts_reached',
        validation: {
          reason: 'file_contains_not_evidenced',
          commandResult: {
            stderr: 'controlled_text_file_mismatch',
          },
        },
      }],
    });

    expect(signature).toBe(
      'field.interaction|controlled_text_file_mismatch|file_contains_not_evidenced|sendkeys|real_vm',
    );
  });

  it('deduplicates equivalent failures across different task ids and timestamps', () => {
    const baseTask = {
      status: 'failed',
      reason: 'max_attempts_reached',
      metadata: { capability: 'app.install.safe_probe' },
      steps: [{
        id: 'learning-vm-validate-safe-installer-flow-installer-command',
        status: 'failed',
        reason: 'winget_search_failed',
        action: { kind: 'visual', environment: 'real_vm', visualAction: 'run_command' },
      }],
      executionHistory: [{
        status: 'failed',
        reason: 'max_attempts_reached',
        validation: {
          reason: 'file_contains_not_evidenced',
          commandResult: {
            exitCode: 1,
            stderr: 'winget_source_unavailable',
          },
        },
      }],
    };

    const first = buildTaskFailureSignature({
      ...baseTask,
      id: 'learning-gap-app-install-1',
      updatedAt: '2026-05-04T10:00:00.000Z',
    });
    const second = buildTaskFailureSignature({
      ...baseTask,
      id: 'learning-gap-app-install-2',
      updatedAt: '2026-05-04T10:05:00.000Z',
    });

    expect(second).toBe(first);
    expect(first).toContain('app.install.safe_probe');
    expect(first).toContain('file_contains_not_evidenced');
    expect(first).toContain('real_vm');
  });
});
