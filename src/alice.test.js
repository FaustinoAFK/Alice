import { describe, expect, it } from 'vitest';
import {
  ALICE_LIVE_MODEL,
  ALICE_LIVE_TOOLS,
  ALICE_SYSTEM_INSTRUCTION,
  createAliceLiveSetup,
} from './alice';

describe('createAliceLiveSetup', () => {
  it('builds the live session setup for Alice voice and video conversation', () => {
    const setup = createAliceLiveSetup();

    expect(ALICE_LIVE_MODEL).toBe('gemini-2.5-flash-native-audio-preview-12-2025');
    expect(setup.model).toBe(`models/${ALICE_LIVE_MODEL}`);
    expect(setup.generationConfig.responseModalities).toEqual(['AUDIO']);
    expect(setup.generationConfig.mediaResolution).toBe('MEDIA_RESOLUTION_MEDIUM');
    expect(setup.systemInstruction.parts[0].text).toBe(ALICE_SYSTEM_INSTRUCTION);
    expect(setup.contextWindowCompression).toEqual({ slidingWindow: {} });
    expect(setup.inputAudioTranscription).toEqual({});
    expect(setup.outputAudioTranscription).toEqual({});
    expect(setup.tools[0].functionDeclarations.map((tool) => tool.name)).toEqual([
      'get_navigation_context',
      'inspect_current_page',
      'search_same_domain',
      'search_web',
      'fetch_web_page',
      'update_mind_map',
      'get_autonomous_learning_status',
      'diagnose_local_vm_setup',
      'run_local_vm_smoke_test',
      'install_vm_guest_agent',
      'diagnose_vm_guest_agent',
      'capture_vm_guest_screen',
      'run_vm_guest_agent_action',
      'run_vm_visual_smoke_test',
      'run_vm_operational_task',
      'plan_autonomous_task',
      'create_host_change_snapshot',
      'record_host_file_checkpoint',
      'create_self_improvement_proposal',
      'approve_self_improvement_proposal',
      'record_validated_learning',
      'record_research_finding',
      'inspect_project_context',
      'report_unexpected_risk',
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
});

describe('ALICE_SYSTEM_INSTRUCTION', () => {
  it('defines Alice as playful confident with contextual web research tools', () => {
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
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('ja pode atualizar a pagina');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('frame visual da tela compartilhada');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('Se o conteudo visual estiver pequeno');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('DOM real da extensao');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('leitura textual precisa');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('update_mind_map');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('Nao faca resumo por iniciativa propria');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('responda diretamente a pergunta');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('VM playground real depende de provedor local configurado');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('Workspace local fallback usa copias e nao e VM real');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('run_vm_operational_task antes de pesquisar');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('snapshot, diff, validacao e rollback');
    expect(ALICE_SYSTEM_INSTRUCTION).toContain('Auto-melhoria da Alice deve virar proposta');
  });
});
