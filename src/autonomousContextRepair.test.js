import { describe, expect, it } from 'vitest';
import { createEmptyAliceMemory } from './aliceMemory';
import { scanAutonomousCapabilityGaps } from './autonomousCapabilityScanner';

const scan = (memory) => scanAutonomousCapabilityGaps(memory, {
  policy: memory.autonomousLearning.policy,
  now: '2026-05-04T12:00:00.000Z',
});

describe('autonomous context repair guards', () => {
  it('does not generate context repair for runtime invoke unavailable', () => {
    const memory = createEmptyAliceMemory();
    memory.autonomousRunner = {
      ...memory.autonomousRunner,
      tasksById: {
        'runtime-required-task': {
          id: 'runtime-required-task',
          title: 'Smoke runtime indisponivel',
          status: 'blocked',
          reason: 'runtime_invoke_unavailable',
          metadata: {
            gapId: 'gap-text-field-interaction',
            capability: 'field.interaction',
          },
          steps: [{
            id: 'runtime-step',
            status: 'blocked',
            reason: 'runtime_invoke_unavailable',
          }],
        },
      },
      audits: [{
        type: 'validation',
        taskId: 'runtime-required-task',
        afterState: 'blocked',
        reason: 'runtime_invoke_unavailable',
        summary: 'Runtime Tauri indisponivel para executar VM/workspace.',
      }],
    };

    const result = scan(memory);

    expect(result.gaps.some((gap) => gap.gapId.includes('context-repair'))).toBe(false);
    expect(result.gaps.some((gap) => gap.evidence?.includes('runtime_invoke_unavailable'))).toBe(false);
  });

  it('does not generate repair-of-repair above the depth limit', () => {
    const memory = createEmptyAliceMemory();
    memory.autonomousRunner = {
      ...memory.autonomousRunner,
      tasksById: {
        'learning-gap-context-repair-field-1': {
          id: 'learning-gap-context-repair-field-1',
          title: 'Aprender: reparar campo',
          status: 'failed',
          reason: 'max_attempts_reached',
          metadata: {
            gapId: 'gap-context-repair-field',
            capability: 'field.interaction',
            repairDepth: 1,
            originalFailedTaskId: 'learning-gap-field-original',
            parentFailureSignature: 'field.interaction|controlled_text_file_mismatch|file_contains_not_evidenced|sendkeys|real_vm',
            repairFamily: 'repair-family-learning-gap-field-original',
          },
          steps: [{
            id: 'field-step',
            status: 'failed',
            reason: 'file_contains_not_evidenced',
          }],
        },
      },
      audits: [{
        type: 'validation',
        taskId: 'learning-gap-context-repair-field-1',
        afterState: 'failed',
        reason: 'max_attempts_reached',
        summary: 'controlled_text_file_mismatch',
      }],
    };

    const result = scan(memory);
    const reviewGap = result.gaps.find((gap) => gap.gapId === 'gap-context-review-learning-gap-field-original');

    expect(reviewGap).toBeTruthy();
    expect(reviewGap.status).toBe('needs_human_review');
    expect(reviewGap.metadata.humanReviewReason).toBe('context_repair_depth_limit_reached');
    expect(result.gaps.some((gap) => gap.gapId.startsWith('gap-context-repair-learning-gap-context-repair'))).toBe(false);
  });

  it('dedupes the same failureSignature into cooldown instead of a second automatic repair', () => {
    const memory = createEmptyAliceMemory();
    memory.autonomousRunner = {
      ...memory.autonomousRunner,
      tasksById: {
        'learning-gap-field-original': {
          id: 'learning-gap-field-original',
          title: 'Aprender campo original',
          status: 'failed',
          reason: 'max_attempts_reached',
          metadata: { capability: 'field.interaction' },
          steps: [{
            id: 'field-step',
            status: 'failed',
            reason: 'file_contains_not_evidenced',
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
        },
        'learning-gap-context-repair-field-1': {
          id: 'learning-gap-context-repair-field-1',
          title: 'Primeiro reparo',
          status: 'failed',
          reason: 'max_attempts_reached',
          metadata: {
            gapId: 'gap-context-repair-learning-gap-field-original',
            capability: 'field.interaction',
            repairDepth: 1,
            originalFailedTaskId: 'learning-gap-field-original',
            parentFailureSignature: 'field.interaction|controlled_text_file_mismatch|file_contains_not_evidenced|sendkeys',
            repairFamily: 'repair-family-learning-gap-field-original',
          },
          steps: [{
            id: 'field-step',
            status: 'failed',
            reason: 'file_contains_not_evidenced',
          }],
        },
      },
      audits: [{
        type: 'validation',
        taskId: 'learning-gap-field-original',
        afterState: 'failed',
        reason: 'max_attempts_reached',
        summary: 'controlled_text_file_mismatch',
      }],
    };

    const result = scan(memory);
    const reviewGap = result.gaps.find((gap) => gap.gapId === 'gap-context-review-learning-gap-field-original');

    expect(reviewGap).toBeTruthy();
    expect(reviewGap.status).toBe('needs_human_review');
    expect(reviewGap.metadata.humanReviewReason).toBe('context_repair_signature_cooldown');
    expect(result.gaps.some((gap) => gap.gapId === 'gap-context-repair-learning-gap-field-original')).toBe(false);
  });

  it('marks repeated controlled_text_file_mismatch as needs_human_review', () => {
    const memory = createEmptyAliceMemory();
    memory.autonomousRunner = {
      ...memory.autonomousRunner,
      tasksById: {
        'learning-gap-context-repair-field-1': {
          id: 'learning-gap-context-repair-field-1',
          title: 'Reparo de input no Notepad',
          status: 'failed',
          reason: 'max_attempts_reached',
          metadata: {
            gapId: 'gap-context-repair-field',
            capability: 'field.interaction',
            repairDepth: 1,
            originalFailedTaskId: 'learning-gap-text-field-interaction-1777852227437',
            parentFailureSignature: 'field.interaction|controlled_text_file_mismatch|file_contains_not_evidenced|sendkeys|real_vm',
            repairFamily: 'repair-family-learning-gap-text-field-interaction-1777852227437',
          },
          steps: [{
            id: 'learning-vm-notepad-field-interaction-field-command',
            status: 'failed',
            reason: 'max_attempts_reached',
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
        },
      },
      audits: [{
        type: 'validation',
        taskId: 'learning-gap-context-repair-field-1',
        afterState: 'failed',
        reason: 'max_attempts_reached',
        summary: 'controlled_text_file_mismatch',
      }],
    };

    const result = scan(memory);
    const reviewGap = result.gaps.find((gap) => gap.status === 'needs_human_review');

    expect(reviewGap).toBeTruthy();
    expect(reviewGap.metadata.parentFailureSignature).toContain('controlled_text_file_mismatch');
    expect(reviewGap.metadata.needsHumanReview).toBe(true);
  });
});
