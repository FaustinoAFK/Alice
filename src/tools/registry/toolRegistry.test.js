import { describe, expect, it } from 'vitest';
import { ALICE_LIVE_TOOLS } from '../aliceLiveTools';
import { TOOL_CONTEXT_PROFILES } from './toolContextProfiles';
import {
  buildLiveToolsForProfile,
  findDuplicateToolNamesForProfile,
  findUnknownDomainsForProfile,
  getToolDeclarationsForProfile,
  getToolDomainsForProfile,
  getToolNamesForProfile,
  validateAllProfileDomains,
  validateFullProfileMatchesAliceLiveTools,
  validateProfileHasNoDuplicateTools,
  validateProfileToolNamesExistInAliceLiveTools,
  validateToolDomainsForProfile,
} from './toolRegistry';

const DANGEROUS_TOOL_NAMES = [
  'manage_autonomous_runner',
  'diagnose_local_vm_setup',
  'run_local_vm_smoke_test',
  'install_vm_guest_agent',
  'diagnose_vm_guest_agent',
  'start_vm_guest_agent_resident',
  'capture_vm_guest_screen',
  'run_vm_guest_agent_action',
  'run_vm_visual_smoke_test',
  'run_vm_operational_task',
  'plan_autonomous_task',
];

describe('tool registry contextual profiles', () => {
  it('keeps the full profile equivalent to current live tools', () => {
    const fullTools = buildLiveToolsForProfile('full');

    expect(fullTools).toEqual(ALICE_LIVE_TOOLS);
    expect(validateFullProfileMatchesAliceLiveTools()).toBe(true);
  });

  it('keeps every profile mapped only to existing domains', () => {
    expect(validateAllProfileDomains()).toBe(true);

    Object.keys(TOOL_CONTEXT_PROFILES).forEach((profileName) => {
      expect(findUnknownDomainsForProfile(profileName)).toEqual([]);
      expect(validateToolDomainsForProfile(profileName)).toBe(true);
    });
  });

  it('keeps tool names unique inside every profile', () => {
    Object.keys(TOOL_CONTEXT_PROFILES).forEach((profileName) => {
      expect(findDuplicateToolNamesForProfile(profileName)).toEqual([]);
      expect(validateProfileHasNoDuplicateTools(profileName)).toBe(true);
    });
  });

  it('returns only names that exist in ALICE_LIVE_TOOLS', () => {
    const officialNames = new Set(
      ALICE_LIVE_TOOLS[0].functionDeclarations.map((tool) => tool.name),
    );

    Object.keys(TOOL_CONTEXT_PROFILES).forEach((profileName) => {
      expect(validateProfileToolNamesExistInAliceLiveTools(profileName)).toBe(true);
      getToolNamesForProfile(profileName).forEach((toolName) => {
        expect(officialNames.has(toolName)).toBe(true);
      });
    });
  });

  it('keeps conversation minimal and without dangerous tools', () => {
    expect(getToolDomainsForProfile('conversation')).toEqual([]);
    expect(getToolDeclarationsForProfile('conversation')).toEqual([]);
    expect(getToolNamesForProfile('conversation')).toEqual([]);
    expect(buildLiveToolsForProfile('conversation')).toEqual([
      {
        functionDeclarations: [],
      },
    ]);
    expect(
      getToolNamesForProfile('conversation').some((toolName) =>
        DANGEROUS_TOOL_NAMES.includes(toolName),
      ),
    ).toBe(false);
  });

  it('keeps the web profile limited to the web domain', () => {
    expect(getToolDomainsForProfile('web')).toEqual(['web']);
    expect(getToolNamesForProfile('web')).toEqual([
      'get_navigation_context',
      'inspect_current_page',
      'search_same_domain',
      'search_web',
      'fetch_web_page',
    ]);
  });

  it('keeps selfImprovement as declarations only, without runtime activation', () => {
    expect(getToolDomainsForProfile('selfImprovement')).toEqual(['selfImprovement']);
    expect(getToolNamesForProfile('selfImprovement')).toEqual([
      'create_self_improvement_proposal',
      'approve_self_improvement_proposal',
    ]);
  });

  it('does not expose VM, runner or autonomous learning profiles', () => {
    expect(TOOL_CONTEXT_PROFILES).not.toHaveProperty('vm');
    expect(TOOL_CONTEXT_PROFILES).not.toHaveProperty('runner');
    expect(TOOL_CONTEXT_PROFILES).not.toHaveProperty('learningReview');

    Object.keys(TOOL_CONTEXT_PROFILES).forEach((profileName) => {
      expect(getToolNamesForProfile(profileName).some((toolName) =>
        DANGEROUS_TOOL_NAMES.includes(toolName),
      )).toBe(false);
    });
  });
});
