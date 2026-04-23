import { describe, expect, it } from 'vitest';
import { ALICE_LIVE_MODEL, ALICE_SYSTEM_INSTRUCTION, createAliceLiveSetup } from './alice';

describe('createAliceLiveSetup', () => {
  it('builds the live session setup for Alice voice and video conversation', () => {
    const setup = createAliceLiveSetup();

    expect(ALICE_LIVE_MODEL).toBe('gemini-2.5-flash-native-audio-preview-12-2025');
    expect(setup.model).toBe(`models/${ALICE_LIVE_MODEL}`);
    expect(setup.generationConfig.responseModalities).toEqual(['AUDIO']);
    expect(setup.systemInstruction.parts[0].text).toBe(ALICE_SYSTEM_INSTRUCTION);
    expect(setup.inputAudioTranscription).toEqual({});
    expect(setup.outputAudioTranscription).toEqual({});
    expect(setup).not.toHaveProperty('proactivity');
  });
});

describe('ALICE_SYSTEM_INSTRUCTION', () => {
  it('defines Alice as playful confident without changing protocol fields', () => {
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('playful_confident');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('personalidade propria');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('presenca forte');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('Voce tem ponto de vista.');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('Voce nao executa comandos');
  });
});
