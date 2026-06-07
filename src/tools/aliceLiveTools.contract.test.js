import { describe, expect, it } from 'vitest';
import {
  ALICE_LIVE_TOOL_DOMAINS,
  ALICE_LIVE_TOOL_ORDER,
  flattenAliceLiveToolDomainNames,
} from './aliceLiveToolDomains';
import {
  ALICE_LIVE_TOOL_DECLARATIONS,
  ALICE_LIVE_TOOL_DECLARATIONS_BY_DOMAIN,
  ALICE_LIVE_TOOLS,
} from './aliceLiveTools';

const serializeToolDeclarations = (functionDeclarations) =>
  JSON.stringify(functionDeclarations, null, 2);

const getFunctionDeclarations = () => ALICE_LIVE_TOOLS[0]?.functionDeclarations || [];

const namesOf = (declarations) => declarations.map((tool) => tool.name);

const EXPECTED_DOMAIN_TOOL_NAMES = {
  web: [
    'get_navigation_context',
    'inspect_current_page',
  ],
};

const REMOVED_RUNTIME_TOOL_NAMES = [
  'get_autonomous_learning_status',
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
  'create_self_improvement_proposal',
  'approve_self_improvement_proposal',
  'record_validated_learning',
  'record_research_finding',
  'inspect_project_context',
  'search_web',
  'search_same_domain',
  'fetch_web_page',
  'update_mind_map',
  'create_host_change_snapshot',
  'record_host_file_checkpoint',
  'report_unexpected_risk',
];

describe('ALICE_LIVE_TOOLS contract', () => {
  it('keeps the expected top-level shape', () => {
    expect(Array.isArray(ALICE_LIVE_TOOLS)).toBe(true);
    expect(ALICE_LIVE_TOOLS).toHaveLength(1);
    expect(ALICE_LIVE_TOOLS[0]).toHaveProperty('functionDeclarations');
    expect(Array.isArray(ALICE_LIVE_TOOLS[0].functionDeclarations)).toBe(true);
    expect(ALICE_LIVE_TOOLS[0].functionDeclarations.length).toBeGreaterThan(0);
  });

  it('keeps required declaration fields on every tool', () => {
    getFunctionDeclarations().forEach((tool) => {
      expect(typeof tool.name).toBe('string');
      expect(tool.name.trim().length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe('string');
      expect(tool.description.trim().length).toBeGreaterThan(0);
      expect(tool.parameters).toEqual(expect.any(Object));
    });
  });

  it('keeps tool names unique and aligned with domain order', () => {
    const names = getFunctionDeclarations().map((tool) => tool.name);
    const domainNames = flattenAliceLiveToolDomainNames();

    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(domainNames);
    expect(names).toEqual(ALICE_LIVE_TOOL_ORDER);
  });

  it('keeps every tool assigned to exactly one domain', () => {
    const names = getFunctionDeclarations().map((tool) => tool.name);
    const officialNameSet = new Set(names);
    const seenDomainTools = new Map();

    ALICE_LIVE_TOOL_DOMAINS.forEach((domain) => {
      domain.toolNames.forEach((toolName) => {
        expect(officialNameSet.has(toolName)).toBe(true);
        seenDomainTools.set(toolName, (seenDomainTools.get(toolName) || 0) + 1);
      });
    });

    names.forEach((toolName) => {
      expect(seenDomainTools.get(toolName)).toBe(1);
    });
    expect([...seenDomainTools.keys()].sort()).toEqual([...names].sort());
  });

  it('keeps each domain export limited to its expected tools', () => {
    expect(Object.keys(ALICE_LIVE_TOOL_DECLARATIONS_BY_DOMAIN).sort()).toEqual(
      Object.keys(EXPECTED_DOMAIN_TOOL_NAMES).sort(),
    );

    Object.entries(EXPECTED_DOMAIN_TOOL_NAMES).forEach(([domain, expectedToolNames]) => {
      expect(namesOf(ALICE_LIVE_TOOL_DECLARATIONS_BY_DOMAIN[domain])).toEqual(expectedToolNames);
      const metadata = ALICE_LIVE_TOOL_DOMAINS.find((item) => item.domain === domain);
      expect(metadata?.toolNames).toEqual(expectedToolNames);
    });
  });

  it('assembles final declarations from domain declarations in the official order', () => {
    const names = getFunctionDeclarations().map((tool) => tool.name);
    const domainDeclarationNames = Object.values(ALICE_LIVE_TOOL_DECLARATIONS_BY_DOMAIN)
      .flat()
      .map((tool) => tool.name);

    expect(ALICE_LIVE_TOOL_DECLARATIONS).toBe(getFunctionDeclarations());
    expect(names).toEqual(ALICE_LIVE_TOOL_ORDER);
    expect(new Set(domainDeclarationNames).size).toBe(domainDeclarationNames.length);
    expect([...domainDeclarationNames].sort()).toEqual([...ALICE_LIVE_TOOL_ORDER].sort());
  });

  it('does not expose removed runtime, broad web, mind map or host safety tools', () => {
    const activeNames = new Set(namesOf(getFunctionDeclarations()));

    REMOVED_RUNTIME_TOOL_NAMES.forEach((toolName) => {
      expect(activeNames.has(toolName)).toBe(false);
    });
    expect(serializeToolDeclarations(getFunctionDeclarations())).toContain('inspect_current_page');
  });
});
