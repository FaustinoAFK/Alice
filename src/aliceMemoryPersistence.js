import {
  createEmptyAliceMemory,
  pruneAliceMemory,
  recoverFromCorruptMemory,
  saveAliceMemory,
} from './aliceMemory';

export const loadAliceMemoryFromRuntime = async ({ invokeFn }) => {
  const json = await invokeFn('load_alice_memory_json');
  if (!json) {
    return createEmptyAliceMemory();
  }

  try {
    return pruneAliceMemory(JSON.parse(json));
  } catch {
    return recoverFromCorruptMemory();
  }
};

export const flushAliceMemoryToRuntime = async ({
  memory,
  canUseTauriRuntime,
  memoryHydrated,
  saveMemory = saveAliceMemory,
  onSkipped = () => {},
  onSaved = () => {},
  onSaveError = () => {},
}) => {
  if (!canUseTauriRuntime || !memoryHydrated) {
    onSkipped(memory);
    return memory;
  }

  try {
    const savedMemory = await saveMemory(memory);
    onSaved(savedMemory);
    return savedMemory;
  } catch (error) {
    onSaveError(error);
    throw error;
  }
};
