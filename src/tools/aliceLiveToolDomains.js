export const ALICE_LIVE_TOOL_ORDER = [
  'get_navigation_context',
  'inspect_current_page',
];

export const ALICE_LIVE_TOOL_DOMAINS = [
  {
    domain: 'web',
    toolNames: [
      'get_navigation_context',
      'inspect_current_page',
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
