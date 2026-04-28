import { describe, expect, it } from 'vitest';
import { createDecisionEngineInput } from './decisionEngine';

describe('createDecisionEngineInput mind map influence', () => {
  it('adds validation caution when the mind map has blockers or failures', () => {
    const decision = createDecisionEngineInput({
      actionInput: { reason: 'continuar plano' },
      behaviorContext: {
        playgroundStatus: {},
        mind_map_summary: {
          blockedCount: 1,
          failedCount: 1,
          highPriorityPending: 1,
        },
      },
      now: 1,
    });

    expect(decision.policyDecision.requiresValidation).toBe(true);
    expect(decision.policyDecision.policyFlags).toEqual(expect.arrayContaining([
      'mind_map_blockers_present',
      'mind_map_failures_present',
      'mind_map_high_priority_pending',
    ]));
    expect(decision.decisionTrace).toContainEqual(expect.objectContaining({
      step: 'mind_map_context',
      blockedCount: 1,
      failedCount: 1,
      highPriorityPending: 1,
    }));
  });
});
