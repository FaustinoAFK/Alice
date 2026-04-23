import { describe, expect, it } from 'vitest';
import { ALICE_LIVE_MODEL, ALICE_SYSTEM_INSTRUCTION, createAliceLiveSetup } from './alice';

describe('createAliceLiveSetup', () => {
  it('builds the live session setup for Alice voice and video conversation', () => {
    const setup = createAliceLiveSetup();

    expect(ALICE_LIVE_MODEL).toBe('gemini-2.5-flash-native-audio-preview-12-2025');
    expect(setup.model).toBe(`models/${ALICE_LIVE_MODEL}`);
    expect(setup.generationConfig.responseModalities).toEqual(['AUDIO']);
    expect(setup.systemInstruction.parts[0].text).toBe(ALICE_SYSTEM_INSTRUCTION);
    expect(setup.contextWindowCompression).toEqual({ slidingWindow: {} });
    expect(setup.inputAudioTranscription).toEqual({});
    expect(setup.outputAudioTranscription).toEqual({});
    expect(setup.tools[0].functionDeclarations.map((tool) => tool.name)).toEqual([
      'open_app',
      'open_folder',
      'mouse_move',
      'mouse_click',
      'click_target',
      'type_text',
      'press_hotkey',
    ]);
    expect(setup).not.toHaveProperty('proactivity');
    expect(setup).not.toHaveProperty('sessionResumption');
    expect(setup).not.toHaveProperty('prefixTurns');
    expect(setup).not.toHaveProperty('historyConfig');
  });

  it('includes a session resumption handle only when provided', () => {
    const setup = createAliceLiveSetup({ resumptionHandle: '  handle-123  ' });

    expect(setup.sessionResumption).toEqual({ handle: 'handle-123' });
  });

  it('enables initial history in client content when memory turns are provided', () => {
    const memoryPrefixTurns = [
      { role: 'user', parts: [{ text: 'Resumo de memoria importante.' }] },
      null,
    ];

    const setup = createAliceLiveSetup({ memoryPrefixTurns });

    expect(setup).not.toHaveProperty('prefixTurns');
    expect(setup.historyConfig).toEqual({
      initialHistoryInClientContent: true,
    });
  });

  it('accepts custom setup options without breaking the current string shorthand', () => {
    const setupFromString = createAliceLiveSetup('gemini-2.5-flash-preview-native-audio-dialog');
    const customSetup = createAliceLiveSetup({
      model: 'gemini-2.5-flash-preview-native-audio-dialog',
      systemInstruction: 'Instrucao customizada',
      tools: [{ functionDeclarations: [{ name: 'noop' }] }],
    });

    expect(setupFromString.model).toBe('models/gemini-2.5-flash-preview-native-audio-dialog');
    expect(customSetup.model).toBe('models/gemini-2.5-flash-preview-native-audio-dialog');
    expect(customSetup.systemInstruction.parts[0].text).toBe('Instrucao customizada');
    expect(customSetup.tools).toEqual([{ functionDeclarations: [{ name: 'noop' }] }]);
  });

  it('does not enforce a maxLength for type_text tool input', () => {
    const typeTextTool = createAliceLiveSetup().tools[0].functionDeclarations.find(
      (tool) => tool.name === 'type_text',
    );

    expect(typeTextTool.parameters.properties.text).toEqual({ type: 'STRING' });
  });
});

describe('ALICE_SYSTEM_INSTRUCTION', () => {
  it('defines Alice as playful confident without changing protocol fields', () => {
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('playful_confident');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('personalidade propria');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('presenca forte');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('Voce tem ponto de vista.');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('Voce pode pedir ferramentas locais');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('prefira click_target');
  });
});
