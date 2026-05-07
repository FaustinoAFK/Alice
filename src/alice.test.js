import { describe, expect, it } from 'vitest';
import {
  ALICE_LIVE_MODEL,
  ALICE_LIVE_TOOLS,
  ALICE_SYSTEM_INSTRUCTION,
  createAliceLiveSetup,
} from './alice';
import { ALICE_SYSTEM_INSTRUCTION as MODULE_SYSTEM_INSTRUCTION } from './prompts/aliceSystemInstruction';

describe('createAliceLiveSetup', () => {
  it('builds the live session setup for Alice voice and video conversation', () => {
    const setup = createAliceLiveSetup();

    expect(ALICE_LIVE_MODEL).toBe('gemini-2.5-flash-native-audio-preview-12-2025');
    expect(setup.model).toBe(`models/${ALICE_LIVE_MODEL}`);
    expect(setup.generationConfig.responseModalities).toEqual(['AUDIO']);
    expect(setup.generationConfig.temperature).toBe(0.7);
    expect(setup.generationConfig.mediaResolution).toBe('MEDIA_RESOLUTION_MEDIUM');
    expect(setup.systemInstruction.parts[0].text).toBe(ALICE_SYSTEM_INSTRUCTION);
    expect(setup.realtimeInputConfig.turnCoverage).toBe('TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO');
    expect(setup.contextWindowCompression).toEqual({ slidingWindow: {} });
    expect(setup.inputAudioTranscription).toEqual({});
    expect(setup.outputAudioTranscription).toEqual({});
    expect(setup.tools).toEqual([]);
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
});

describe('ALICE_SYSTEM_INSTRUCTION', () => {
  it('is re-exported from the prompt module without changing the facade contract', () => {
    expect(ALICE_SYSTEM_INSTRUCTION).toBe(MODULE_SYSTEM_INSTRUCTION);
    expect(typeof ALICE_SYSTEM_INSTRUCTION).toBe('string');
    expect(ALICE_SYSTEM_INSTRUCTION.trim().length).toBeGreaterThan(0);
  });

  it('defines Alice as a focused conversation and screen-vision assistant', () => {
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('Voce e Alice');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('conversa por voz com visao da tela compartilhada');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('somente conversar');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('frames da tela compartilhada');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('Nao use ferramentas locais');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('Nao prometa executar acoes no computador');
    expect(ALICE_SYSTEM_INSTRUCTION).not.toContain('manage_autonomous_runner');
    expect(ALICE_SYSTEM_INSTRUCTION).not.toContain('inspect_current_page');
  });
});

describe('ALICE_LIVE_TOOLS', () => {
  it('keeps local tools disabled in the default live setup', () => {
    expect(Array.isArray(ALICE_LIVE_TOOLS)).toBe(true);
    expect(ALICE_LIVE_TOOLS).toEqual([]);
  });

  it('uses the same tools object in createAliceLiveSetup by default', () => {
    const setup = createAliceLiveSetup();

    expect(setup.tools).toBe(ALICE_LIVE_TOOLS);
    expect(setup.tools).toEqual([]);
  });
});
