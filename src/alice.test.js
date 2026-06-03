import { describe, expect, it } from 'vitest';
import {
  ALICE_LIVE_MODEL,
  ALICE_LIVE_TOOLS,
  ALICE_SYSTEM_INSTRUCTION,
  createAliceLiveSetup,
} from './alice';
import { ALICE_SYSTEM_INSTRUCTION as MODULE_SYSTEM_INSTRUCTION } from './prompts/aliceSystemInstruction';
import {
  ALICE_LIVE_TOOL_DOMAINS,
  createAliceLiveToolDomainIndex,
  flattenAliceLiveToolDomainNames,
} from './tools/aliceLiveToolDomains';
import { ALICE_LIVE_TOOLS as MODULE_LIVE_TOOLS } from './tools/aliceLiveTools';

const EXPECTED_TOOL_NAMES = [
  'get_navigation_context',
  'inspect_current_page',
  'search_same_domain',
  'search_web',
  'fetch_web_page',
  'update_mind_map',
  'create_host_change_snapshot',
  'record_host_file_checkpoint',
  'create_self_improvement_proposal',
  'approve_self_improvement_proposal',
  'report_unexpected_risk',
];

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
    expect(setup.tools[0].functionDeclarations.map((tool) => tool.name)).toEqual(EXPECTED_TOOL_NAMES);
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

  it('defines Alice as playful confident with contextual web research tools', () => {
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('Voce e Alice');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('playful_confident');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('personalidade propria');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('presenca forte');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('Voce tem ponto de vista.');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('inspect_current_page');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('search_same_domain');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('search_web');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('responseGuidance');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('finalOrigin');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('finalSufficiency');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('Em retomadas de sessao');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('ja pode atualizar a pagina');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('frame visual da tela compartilhada');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('Se o conteudo visual estiver pequeno');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('DOM real da extensao');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('leitura textual precisa');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('update_mind_map');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('Nao faca resumo por iniciativa propria');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('responda diretamente a pergunta');
    expect(ALICE_SYSTEM_INSTRUCTION).not.toContain('VM playground real');
    expect(ALICE_SYSTEM_INSTRUCTION).not.toContain('run_vm_operational_task');
    expect(ALICE_SYSTEM_INSTRUCTION).not.toContain('manage_autonomous_runner');
    expect(ALICE_SYSTEM_INSTRUCTION).not.toContain('aprendizado operacional autonomo');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('snapshot, diff, validacao e rollback');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('Auto-melhoria da Alice deve virar proposta');
  });
});

describe('ALICE_LIVE_TOOLS', () => {
  it('is re-exported from the tools module with function declarations in the same order', () => {
    expect(ALICE_LIVE_TOOLS).toBe(MODULE_LIVE_TOOLS);
    expect(Array.isArray(ALICE_LIVE_TOOLS)).toBe(true);
    expect(ALICE_LIVE_TOOLS[0]).toHaveProperty('functionDeclarations');
    expect(ALICE_LIVE_TOOLS[0].functionDeclarations.map((tool) => tool.name)).toEqual(EXPECTED_TOOL_NAMES);
  });

  it('keeps tool domain metadata complete, unique, and aligned with the official order', () => {
    const officialNames = ALICE_LIVE_TOOLS[0].functionDeclarations.map((tool) => tool.name);
    const domainNames = flattenAliceLiveToolDomainNames();
    const uniqueDomainNames = new Set(domainNames);
    const domainIndex = createAliceLiveToolDomainIndex();

    expect(domainNames).toEqual(officialNames);
    expect(domainNames).toEqual(EXPECTED_TOOL_NAMES);
    expect(uniqueDomainNames.size).toBe(domainNames.length);
    expect(Object.keys(domainIndex)).toHaveLength(officialNames.length);
    officialNames.forEach((toolName) => {
      expect(domainIndex[toolName]).toEqual(expect.any(String));
      expect(domainIndex[toolName].length).toBeGreaterThan(0);
    });
    ALICE_LIVE_TOOL_DOMAINS.forEach((domain) => {
      expect(domain.domain).toEqual(expect.any(String));
      expect(domain.toolNames.length).toBeGreaterThan(0);
    });
  });

  it('uses the same tools object in createAliceLiveSetup by default', () => {
    const setup = createAliceLiveSetup();

    expect(setup.tools).toBe(ALICE_LIVE_TOOLS);
    expect(setup.tools[0].functionDeclarations.map((tool) => tool.name)).toEqual(
      flattenAliceLiveToolDomainNames(),
    );
  });
});
