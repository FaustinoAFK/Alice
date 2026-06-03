export const ALICE_LIVE_TOOL_ORDER = [
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
