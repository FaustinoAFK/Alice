import { describe, expect, it } from 'vitest';
import { TOOL_CONTEXT_PROFILES } from './toolContextProfiles';
import { resolveToolProfile } from './toolProfileResolver';

const expectResolutionShape = (resolution) => {
  expect(resolution).toEqual({
    profile: expect.any(String),
    reason: expect.any(String),
    confidence: expect.any(Number),
    fallbackProfile: 'full',
  });
  expect(resolution.confidence).toBeGreaterThanOrEqual(0);
  expect(resolution.confidence).toBeLessThanOrEqual(1);
};

describe('resolveToolProfile', () => {
  it('respects a valid explicitToolProfile', () => {
    const resolution = resolveToolProfile({
      explicitToolProfile: 'web',
      userText: 'conversa comum',
    });

    expectResolutionShape(resolution);
    expect(resolution.profile).toBe('web');
    expect(resolution.reason).toContain('explicitToolProfile valido');
  });

  it('falls back to full for an invalid explicitToolProfile', () => {
    const resolution = resolveToolProfile({
      explicitToolProfile: 'unknownProfile',
      userText: 'essa pagina',
      hasActiveWebPage: true,
    });

    expectResolutionShape(resolution);
    expect(resolution.profile).toBe('full');
    expect(resolution.reason).toContain('explicitToolProfile invalido');
  });

  it('returns conversation for common text without contextual signals', () => {
    const resolution = resolveToolProfile({
      userText: 'Oi Alice, como voce esta hoje?',
    });

    expectResolutionShape(resolution);
    expect(resolution.profile).toBe('conversation');
    expect(resolution.reason).toContain('Conversa comum');
  });

  it('returns full for empty or ambiguous text with a conservative reason', () => {
    const emptyResolution = resolveToolProfile({ userText: '   ' });
    const ambiguousResolution = resolveToolProfile({ userText: 'faz isso pra mim' });

    expect(emptyResolution.profile).toBe('full');
    expect(emptyResolution.reason).toContain('Contexto vazio');
    expect(ambiguousResolution.profile).toBe('full');
    expect(ambiguousResolution.reason).toContain('Pedido ambiguo');
  });

  it('returns web for current page questions when hasActiveWebPage is true', () => {
    const resolution = resolveToolProfile({
      userText: 'O que essa pagina esta dizendo?',
      hasActiveWebPage: true,
    });

    expectResolutionShape(resolution);
    expect(resolution.profile).toBe('web');
  });

  it('returns full for current page questions without an active page', () => {
    const resolution = resolveToolProfile({
      userText: 'Resume a aba atual',
      hasActiveWebPage: false,
    });

    expectResolutionShape(resolution);
    expect(resolution.profile).toBe('full');
    expect(resolution.reason).toContain('sem pagina ativa');
  });

  it('does not route VM requests to removed VM tools', () => {
    const resolution = resolveToolProfile({
      userText: 'Abrir o aplicativo Notepad e instalar ferramenta na VM',
      targetEnvironment: 'vm',
    });

    expectResolutionShape(resolution);
    expect(resolution.profile).toBe('conversation');
  });

  it('does not route runner requests to removed runner tools', () => {
    const resolution = resolveToolProfile({
      userText: 'Coloca essa tarefa longa na fila do runner',
    });

    expectResolutionShape(resolution);
    expect(resolution.profile).toBe('conversation');
  });

  it('does not route self-improvement requests to removed self-improvement tools', () => {
    const resolution = resolveToolProfile({
      userText: 'Crie uma proposta de auto-melhoria para o codigo da Alice',
    });

    expectResolutionShape(resolution);
    expect(resolution.profile).toBe('conversation');
  });

  it('does not route learning review requests to removed learning tools', () => {
    const resolution = resolveToolProfile({
      userText: 'Revise os candidatos de aprendizado e o procedimento sugerido',
    });

    expectResolutionShape(resolution);
    expect(resolution.profile).toBe('conversation');
  });

  it('does not route host safety requests to removed host safety tools', () => {
    const resolution = resolveToolProfile({
      userText: 'Crie snapshot e plano de rollback por risco no PC real',
      riskLevel: 'high',
    });
    
    expectResolutionShape(resolution);
    expect(resolution.profile).toBe('conversation');
  });

  it('returns only profiles that exist in TOOL_CONTEXT_PROFILES', () => {
    const contexts = [
      { explicitToolProfile: 'web' },
      { explicitToolProfile: 'invalid' },
      { userText: 'Oi Alice' },
      { userText: 'essa pagina', hasActiveWebPage: true },
      { userText: 'essa pagina', hasActiveWebPage: false },
      { userText: 'abrir app na VM', targetEnvironment: 'vm' },
      { userText: 'tarefa longa na fila do runner' },
      { userText: 'auto-melhoria da Alice' },
      { userText: 'candidato de aprendizado' },
      { userText: 'rollback no PC real' },
    ];

    contexts.forEach((context) => {
      expect(TOOL_CONTEXT_PROFILES).toHaveProperty(
        resolveToolProfile(context).profile,
      );
    });
  });

  it('is pure and does not mutate the received context', () => {
    const context = {
      userText: 'O que tem nessa pagina?',
      hasActiveWebPage: true,
      targetEnvironment: 'host',
      requestedOperation: 'inspect',
      riskLevel: 'low',
      currentMode: 'conversation',
    };
    const snapshot = JSON.stringify(context);

    const firstResolution = resolveToolProfile(context);
    const secondResolution = resolveToolProfile(context);

    expect(JSON.stringify(context)).toBe(snapshot);
    expect(secondResolution).toEqual(firstResolution);
  });
});
