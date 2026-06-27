import {
  ALICE_MEMORY_ACTIVE_PROJECT_RECENCY_MS,
  ALICE_MEMORY_ACTIVE_TASK_RECENCY_MS,
  buildMemoryPrefixTurns,
  getActiveMindMap,
} from './aliceMemory';
import { buildSessionRehydrationTurns } from './liveSessionRehydration';
import { buildRecentSessionTurns } from './liveSessionRecentTurns';
import { buildOperationalContextTurns } from './operationalContext';

export const buildLiveMemoryPrefixTurns = ({
  mode = 'fresh',
  memory,
  interactions = [],
  trustedUtterance = null,
  outputTranscript = '',
  knowledgeState = null,
  screenGeometry = null,
}) => {
  const activeMindMap = getActiveMindMap(memory);
  const memorySummary = memory?.recentContextSummary?.summary || '';

  const operationalTurns = buildOperationalContextTurns({
    trustedUtterance,
    outputTranscript,
    memorySummary,
    knowledgeState,
    activeMindMap,
    screenGeometry,
  });

  const recentSessionTurns = buildRecentSessionTurns({
    interactions,
    trustedUtterance,
    outputTranscript,
  });

  const persistentMemoryTurns = buildMemoryPrefixTurns(memory, {
    supplementalOnly: mode !== 'fresh',
    includeRecentContext: mode === 'fresh',
    includeActiveProjects: mode === 'fresh',
    includeActiveTasks: mode === 'fresh',
    filterActiveItemsByRecency: true,
    activeProjectRecencyMs: ALICE_MEMORY_ACTIVE_PROJECT_RECENCY_MS,
    activeTaskRecencyMs: ALICE_MEMORY_ACTIVE_TASK_RECENCY_MS,
  });

  if (mode === 'resume') {
    return [
      ...operationalTurns,
      ...recentSessionTurns,
      ...persistentMemoryTurns,
    ];
  }

  const rehydrationTurns = buildSessionRehydrationTurns({
    trustedUtterance,
    outputTranscript,
    memorySummary,
    knowledgeState,
    activeMindMap,
  });

  return [
    ...operationalTurns,
    ...recentSessionTurns,
    ...persistentMemoryTurns,
    ...rehydrationTurns,
  ];
};
