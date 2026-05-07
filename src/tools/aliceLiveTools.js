import { AUTONOMOUS_PLANNING_LIVE_TOOL_DECLARATIONS } from './autonomousPlanningLiveTools';
import { AUTONOMOUS_STATUS_LIVE_TOOL_DECLARATIONS } from './autonomousStatusLiveTools';
import { HOST_SAFETY_LIVE_TOOL_DECLARATIONS } from './hostSafetyLiveTools';
import { LEARNING_LIVE_TOOL_DECLARATIONS } from './learningLiveTools';
import { MIND_MAP_LIVE_TOOL_DECLARATIONS } from './mindMapLiveTools';
import { RUNNER_LIVE_TOOL_DECLARATIONS } from './runnerLiveTools';
import { SELF_IMPROVEMENT_LIVE_TOOL_DECLARATIONS } from './selfImprovementLiveTools';
import { VM_LIVE_TOOL_DECLARATIONS } from './vmLiveTools';
import { WEB_LIVE_TOOL_DECLARATIONS } from './webLiveTools';
import { ALICE_LIVE_TOOL_ORDER } from './aliceLiveToolDomains';

export const ALICE_LIVE_TOOL_DECLARATIONS_BY_DOMAIN = {
  web: WEB_LIVE_TOOL_DECLARATIONS,
  mindMap: MIND_MAP_LIVE_TOOL_DECLARATIONS,
  autonomousStatus: AUTONOMOUS_STATUS_LIVE_TOOL_DECLARATIONS,
  runner: RUNNER_LIVE_TOOL_DECLARATIONS,
  vm: VM_LIVE_TOOL_DECLARATIONS,
  autonomousPlanning: AUTONOMOUS_PLANNING_LIVE_TOOL_DECLARATIONS,
  hostSafety: HOST_SAFETY_LIVE_TOOL_DECLARATIONS,
  selfImprovement: SELF_IMPROVEMENT_LIVE_TOOL_DECLARATIONS,
  learning: LEARNING_LIVE_TOOL_DECLARATIONS,
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
