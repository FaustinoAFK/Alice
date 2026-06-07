import { WEB_LIVE_TOOL_DECLARATIONS } from './webLiveTools';
import { ALICE_LIVE_TOOL_ORDER } from './aliceLiveToolDomains';

export const ALICE_LIVE_TOOL_DECLARATIONS_BY_DOMAIN = {
  web: WEB_LIVE_TOOL_DECLARATIONS,
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
