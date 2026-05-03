import { describe, expect, it } from 'vitest';
import { createEmptyAliceMemory, getAutonomousLearningMemoryState } from './aliceMemory';
import {
  clearInvalidObservedLearningTargets,
  createObservedLearningGoalText,
  detectObservedLearningTargets,
  isValidObservedLearningLabel,
  registerObservedLearningTargets,
} from './autonomousObservedLearning';

describe('autonomous observed learning', () => {
  it('detects a generic application from a shared window label', () => {
    const targets = detectObservedLearningTargets({
      source: 'screen_capture_started',
      screen: {
        label: 'Projeto Alice - Editor Generico',
        displaySurface: 'window',
      },
    });

    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      kind: 'application',
      label: 'Editor Generico',
      source: 'screen_capture_started',
    });
  });

  it('detects a generic web app from navigation context', () => {
    const targets = detectObservedLearningTargets({
      source: 'web_context_observed',
      knowledgeState: {
        navigationContext: {
          url: 'https://app.exemplo.local/dashboard?tab=1',
          title: 'Painel',
        },
      },
    });

    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      kind: 'web_app',
      label: 'app.exemplo.local',
    });
  });

  it('detects a web app when navigation domain includes a port', () => {
    const targets = detectObservedLearningTargets({
      source: 'web_context_observed',
      knowledgeState: {
        navigationContext: {
          domain: 'localhost:5174',
          title: 'Alice Preview',
        },
      },
    });

    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      kind: 'web_app',
      label: 'localhost:5174',
    });
  });

  it('ignores non-http schemes from browser-internal or local pages', () => {
    expect(detectObservedLearningTargets({
      knowledgeState: {
        navigationContext: {
          url: 'about:blank',
          title: 'Blank',
        },
      },
    })).toEqual([]);

    expect(detectObservedLearningTargets({
      knowledgeState: {
        navigationContext: {
          url: 'file:///C:/temp/test.html',
          title: 'Local file',
        },
      },
    })).toEqual([]);

    expect(detectObservedLearningTargets({
      knowledgeState: {
        navigationContext: {
          url: 'chrome://settings',
          title: 'Settings',
        },
      },
    })).toEqual([]);
  });

  it('ignores generic screen labels that do not identify an app', () => {
    const targets = detectObservedLearningTargets({
      screen: {
        label: 'screen',
        displaySurface: 'monitor',
      },
    });

    expect(targets).toEqual([]);
  });

  it('rejects coordinate and resolution labels as observed apps', () => {
    expect(isValidObservedLearningLabel('0:0')).toBe(false);
    expect(isValidObservedLearningLabel('1920x1080')).toBe(false);
    expect(isValidObservedLearningLabel('Screen 1')).toBe(false);
    expect(detectObservedLearningTargets({
      screen: {
        label: '0:0',
        displaySurface: 'monitor',
      },
    })).toEqual([]);
  });

  it('creates one staged learning goal for an observed application and avoids duplicates', () => {
    const now = '2026-04-30T11:00:00.000Z';
    const first = registerObservedLearningTargets(createEmptyAliceMemory(), {
      now,
      source: 'screen_capture_started',
      screen: {
        label: 'Documento - Aplicativo Qualquer',
        displaySurface: 'window',
      },
    });

    expect(first.createdGoals).toHaveLength(1);
    expect(first.createdGoals[0].metadata).toMatchObject({
      createdBy: 'observed_learning',
      observedTargetKind: 'application',
      observedTargetLabel: 'Aplicativo Qualquer',
    });
    expect(first.createdGoals[0].stages.length).toBeGreaterThan(3);
    expect(first.createdGoals[0].stages.map((stage) => stage.stageKey)).toEqual(
      expect.arrayContaining(['app_launch', 'window_focus', 'text_input', 'field_interaction', 'page_validation']),
    );

    const second = registerObservedLearningTargets(first.memory, {
      now: '2026-04-30T11:01:00.000Z',
      source: 'screen_capture_started',
      screen: {
        label: 'Documento - Aplicativo Qualquer',
        displaySurface: 'window',
      },
    });
    const learning = getAutonomousLearningMemoryState(second.memory);

    expect(second.createdGoals).toEqual([]);
    expect(learning.learningGoals).toHaveLength(1);
    expect(learning.observedTargets[0].seenCount).toBe(2);
  });

  it('does not churn memory for the same observed target inside the refresh window', () => {
    const now = '2026-04-30T11:00:00.000Z';
    const first = registerObservedLearningTargets(createEmptyAliceMemory(), {
      now,
      source: 'screen_capture_started',
      screen: {
        label: 'Documento - Aplicativo Qualquer',
        displaySurface: 'window',
      },
    });

    const second = registerObservedLearningTargets(first.memory, {
      now: '2026-04-30T11:00:30.000Z',
      source: 'screen_capture_started',
      screen: {
        label: 'Documento - Aplicativo Qualquer',
        displaySurface: 'window',
      },
    });
    const learning = getAutonomousLearningMemoryState(second.memory);

    expect(second.changed).toBe(false);
    expect(second.createdGoals).toEqual([]);
    expect(learning.observedTargets[0].seenCount).toBe(1);
  });

  it('builds a broad generic goal text for any observed target', () => {
    const text = createObservedLearningGoalText({
      kind: 'application',
      label: 'Ferramenta Desconhecida',
    });

    expect(text).toContain('Ferramenta Desconhecida');
    expect(text).toContain('Separar em etapas');
    expect(text).not.toMatch(/vs code|visual studio code/i);
  });

  it('clears invalid observed targets and their generated goals', () => {
    const now = '2026-04-30T11:00:00.000Z';
    const memory = {
      ...createEmptyAliceMemory(),
      autonomousLearning: {
        ...createEmptyAliceMemory().autonomousLearning,
        observedTargets: [
          {
            targetId: 'observed-application-0-0',
            kind: 'application',
            label: '0:0',
            goalId: 'goal-invalid',
          },
          {
            targetId: 'observed-application-editor',
            kind: 'application',
            label: 'Editor Generico',
            goalId: 'goal-valid',
          },
        ],
        learningGoals: [
          {
            goalId: 'goal-invalid',
            title: 'Invalido',
            description: 'Aprender alvo falso',
            metadata: { observedTargetId: 'observed-application-0-0' },
          },
          {
            goalId: 'goal-valid',
            title: 'Valido',
            description: 'Aprender alvo valido',
            metadata: { observedTargetId: 'observed-application-editor' },
          },
        ],
      },
    };

    const result = clearInvalidObservedLearningTargets(memory, { now });
    const learning = getAutonomousLearningMemoryState(result.memory);

    expect(result.removedTargetIds).toEqual(['observed-application-0-0']);
    expect(result.removedGoalIds).toEqual(['goal-invalid']);
    expect(learning.observedTargets.map((target) => target.targetId)).toEqual(['observed-application-editor']);
    expect(learning.learningGoals.map((goal) => goal.goalId)).toEqual(['goal-valid']);
  });
});
