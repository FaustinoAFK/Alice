export const ALICE_LIVE_TOOL_ORDER = [
  'get_navigation_context',
  'inspect_current_page',
  'search_same_domain',
  'search_web',
  'fetch_web_page',
  'update_mind_map',
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
  'create_host_change_snapshot',
  'record_host_file_checkpoint',
  'create_self_improvement_proposal',
  'approve_self_improvement_proposal',
  'record_validated_learning',
  'record_research_finding',
  'inspect_project_context',
  'report_unexpected_risk',
];

export const ALICE_LIVE_TOOL_DOMAINS = [
  {
    domain: 'web',
    toolNames: [
      'get_navigation_context',
      'inspect_current_page',
      'search_same_domain',
      'search_web',
      'fetch_web_page',
    ],
  },
  {
    domain: 'mindMap',
    toolNames: [
      'update_mind_map',
    ],
  },
  {
    domain: 'autonomousStatus',
    toolNames: [
      'get_autonomous_learning_status',
    ],
  },
  {
    domain: 'runner',
    toolNames: [
      'manage_autonomous_runner',
    ],
  },
  {
    domain: 'vm',
    toolNames: [
      'diagnose_local_vm_setup',
      'run_local_vm_smoke_test',
      'install_vm_guest_agent',
      'diagnose_vm_guest_agent',
      'start_vm_guest_agent_resident',
      'capture_vm_guest_screen',
      'run_vm_guest_agent_action',
      'run_vm_visual_smoke_test',
      'run_vm_operational_task',
    ],
  },
  {
    domain: 'autonomousPlanning',
    toolNames: [
      'plan_autonomous_task',
    ],
  },
  {
    domain: 'hostSafety',
    toolNames: [
      'create_host_change_snapshot',
      'record_host_file_checkpoint',
      'report_unexpected_risk',
    ],
  },
  {
    domain: 'selfImprovement',
    toolNames: [
      'create_self_improvement_proposal',
      'approve_self_improvement_proposal',
    ],
  },
  {
    domain: 'learning',
    toolNames: [
      'record_validated_learning',
      'record_research_finding',
      'inspect_project_context',
    ],
  },
];

export const flattenAliceLiveToolDomainNames = (
  domains = ALICE_LIVE_TOOL_DOMAINS,
  officialOrder = ALICE_LIVE_TOOL_ORDER,
) => {
  const domainToolNames = domains.flatMap((domain) => domain.toolNames);
  const domainToolNameSet = new Set(domainToolNames);
  const orderedToolNames = officialOrder.filter((toolName) => domainToolNameSet.has(toolName));
  const extraToolNames = domainToolNames.filter((toolName) => !officialOrder.includes(toolName));

  return [...orderedToolNames, ...extraToolNames];
};

export const createAliceLiveToolDomainIndex = (
  domains = ALICE_LIVE_TOOL_DOMAINS,
) =>
  domains.reduce((index, domain) => {
    domain.toolNames.forEach((toolName) => {
      index[toolName] = domain.domain;
    });
    return index;
  }, {});
