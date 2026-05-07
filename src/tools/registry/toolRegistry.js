import {
  ALICE_LIVE_TOOL_DECLARATIONS,
  ALICE_LIVE_TOOL_DECLARATIONS_BY_DOMAIN,
  ALICE_LIVE_TOOLS,
} from '../aliceLiveTools';
import { createAliceLiveToolDomainIndex } from '../aliceLiveToolDomains';
import { TOOL_CONTEXT_PROFILES } from './toolContextProfiles';

const aliceLiveToolDomainIndex = createAliceLiveToolDomainIndex();

const getProfileDomainsOrThrow = (profileName) => {
  const domains = TOOL_CONTEXT_PROFILES[profileName];

  if (!Array.isArray(domains)) {
    throw new RangeError(`Unknown tool context profile: ${profileName}`);
  }

  return domains;
};

export const getKnownToolDomains = () =>
  Object.keys(ALICE_LIVE_TOOL_DECLARATIONS_BY_DOMAIN);

export const getToolDomainsForProfile = (profileName) => [
  ...getProfileDomainsOrThrow(profileName),
];

export const getToolDeclarationsForProfile = (profileName) =>
  ALICE_LIVE_TOOL_DECLARATIONS.filter(
    (tool) => getToolDomainsForProfile(profileName).includes(
      aliceLiveToolDomainIndex[tool.name],
    ),
  );

export const getToolNamesForProfile = (profileName) =>
  getToolDeclarationsForProfile(profileName).map((tool) => tool.name);

export const buildLiveToolsForProfile = (profileName) => [
  {
    functionDeclarations: getToolDeclarationsForProfile(profileName),
  },
];

export const findUnknownDomainsForProfile = (profileName) => {
  const knownDomains = new Set(getKnownToolDomains());

  return getToolDomainsForProfile(profileName).filter(
    (domain) => !knownDomains.has(domain),
  );
};

export const findDuplicateToolNamesForProfile = (profileName) => {
  const seen = new Set();
  const duplicates = new Set();

  getToolDomainsForProfile(profileName)
    .flatMap((domain) => ALICE_LIVE_TOOL_DECLARATIONS_BY_DOMAIN[domain] || [])
    .forEach((tool) => {
      if (seen.has(tool.name)) {
        duplicates.add(tool.name);
      }
      seen.add(tool.name);
    });

  return [...duplicates];
};

export const validateToolDomainsForProfile = (profileName) =>
  findUnknownDomainsForProfile(profileName).length === 0;

export const validateProfileHasNoDuplicateTools = (profileName) =>
  findDuplicateToolNamesForProfile(profileName).length === 0;

export const validateAllProfileDomains = () =>
  Object.keys(TOOL_CONTEXT_PROFILES).every(validateToolDomainsForProfile);

export const validateFullProfileMatchesAliceLiveTools = () =>
  JSON.stringify(buildLiveToolsForProfile('full')) === JSON.stringify(ALICE_LIVE_TOOLS);

export const validateProfileToolNamesExistInAliceLiveTools = (profileName) => {
  const officialNames = new Set(ALICE_LIVE_TOOL_DECLARATIONS.map((tool) => tool.name));

  return getToolNamesForProfile(profileName).every((toolName) =>
    officialNames.has(toolName),
  );
};
