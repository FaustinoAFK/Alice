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
    domain: 'mind_map',
    toolNames: [
      'update_mind_map',
    ],
  },
  {
    domain: 'autonomous_status',
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
    domain: 'autonomous_task_planning',
    toolNames: [
      'plan_autonomous_task',
    ],
  },
  {
    domain: 'host_versioning',
    toolNames: [
      'create_host_change_snapshot',
      'record_host_file_checkpoint',
    ],
  },
  {
    domain: 'self_improvement',
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
    ],
  },
  {
    domain: 'project_context',
    toolNames: [
      'inspect_project_context',
    ],
  },
  {
    domain: 'risk',
    toolNames: [
      'report_unexpected_risk',
    ],
  },
];

export const flattenAliceLiveToolDomainNames = (
  domains = ALICE_LIVE_TOOL_DOMAINS,
) => domains.flatMap((domain) => domain.toolNames);

export const createAliceLiveToolDomainIndex = (
  domains = ALICE_LIVE_TOOL_DOMAINS,
) =>
  domains.reduce((index, domain) => {
    domain.toolNames.forEach((toolName) => {
      index[toolName] = domain.domain;
    });
    return index;
  }, {});
