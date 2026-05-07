import { ALICE_SYSTEM_INSTRUCTION } from './prompts/aliceSystemInstruction';
import { ALICE_LIVE_TOOLS } from './tools/aliceLiveTools';

export const ALICE_LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

export { ALICE_SYSTEM_INSTRUCTION } from './prompts/aliceSystemInstruction';
export { ALICE_LIVE_TOOLS } from './tools/aliceLiveTools';

export const createAliceLiveSetup = (options = {}) => {
  const normalizedOptions = typeof options === 'string' ? { model: options } : options;
  const model = normalizedOptions.model || ALICE_LIVE_MODEL;
  const tools = Object.prototype.hasOwnProperty.call(normalizedOptions, 'tools')
    ? normalizedOptions.tools
    : ALICE_LIVE_TOOLS;
  const systemInstruction =
    normalizedOptions.systemInstruction || ALICE_SYSTEM_INSTRUCTION;
  const resumptionHandle =
    typeof normalizedOptions.resumptionHandle === 'string'
      ? normalizedOptions.resumptionHandle.trim()
      : '';
  const memoryPrefixTurns = Array.isArray(normalizedOptions.memoryPrefixTurns)
    ? normalizedOptions.memoryPrefixTurns.filter(Boolean)
    : [];

  const setup = {
    model: `models/${model}`,
    generationConfig: {
      responseModalities: ['AUDIO'],
      temperature: 0.7,
      mediaResolution: 'MEDIA_RESOLUTION_MEDIUM',
    },
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    realtimeInputConfig: {
      turnCoverage: 'TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO',
    },
    contextWindowCompression: {
      slidingWindow: {},
    },
    tools,
    inputAudioTranscription: {},
    outputAudioTranscription: {},
  };

  if (resumptionHandle) {
    setup.sessionResumption = {
      handle: resumptionHandle,
    };
  }

  if (memoryPrefixTurns.length > 0) {
    setup.historyConfig = {
      initialHistoryInClientContent: true,
    };
  }

  return setup;
};
