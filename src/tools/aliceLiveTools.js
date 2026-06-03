import { HOST_SAFETY_LIVE_TOOL_DECLARATIONS } from './hostSafetyLiveTools';
import { MIND_MAP_LIVE_TOOL_DECLARATIONS } from './mindMapLiveTools';
import { SELF_IMPROVEMENT_LIVE_TOOL_DECLARATIONS } from './selfImprovementLiveTools';
import { WEB_LIVE_TOOL_DECLARATIONS } from './webLiveTools';
import { ALICE_LIVE_TOOL_ORDER } from './aliceLiveToolDomains';

export const ALICE_LIVE_TOOL_DECLARATIONS_BY_DOMAIN = {
  web: WEB_LIVE_TOOL_DECLARATIONS,
  mindMap: MIND_MAP_LIVE_TOOL_DECLARATIONS,
  hostSafety: HOST_SAFETY_LIVE_TOOL_DECLARATIONS,
  selfImprovement: SELF_IMPROVEMENT_LIVE_TOOL_DECLARATIONS,
};

const allDeclarationsByName = Object.values(ALICE_LIVE_TOOL_DECLARATIONS_BY_DOMAIN)
  .flat()
  .reduce((index, declaration) => {
    index[declaration.name] = declaration;
    return index;
  }, {});

export const ALICE_LIVE_TOOL_DECLARATIONS = ALICE_LIVE_TOOL_ORDER.map(
  (toolName) => allDeclarationsByName[toolName],
);

export const ALICE_LIVE_TOOLS = [
  {
    functionDeclarations: ALICE_LIVE_TOOL_DECLARATIONS,
  },
];
