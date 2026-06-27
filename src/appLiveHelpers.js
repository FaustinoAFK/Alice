import { calculateRms, decodePcm16Base64, encodePcm16Base64 } from './liveAudio';

export const TRUSTED_UTTERANCE_WINDOW_MS = 10000;

export const stopStream = (stream) => {
  stream?.getTracks().forEach((track) => track.stop());
};

export const createPcmOutputPlayer = () => {
  let audioContext = null;
  let playheadTime = 0;
  let sources = [];

  const ensureContext = async () => {
    if (!audioContext) {
      audioContext = new AudioContext({ latencyHint: 'interactive', sampleRate: 24000 });
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    return audioContext;
  };

  return {
    async play(base64Audio) {
      const context = await ensureContext();
      const samples = decodePcm16Base64(base64Audio);
      const buffer = context.createBuffer(1, samples.length, 24000);
      buffer.copyToChannel(samples, 0);

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);

      const startAt = Math.max(context.currentTime + 0.02, playheadTime);
      source.start(startAt);
      playheadTime = startAt + buffer.duration;
      sources.push(source);
      source.onended = () => {
        sources = sources.filter((item) => item !== source);
      };
    },
    interrupt() {
      sources.forEach((source) => {
        try {
          source.stop();
        } catch {
          // The source may have already ended.
        }
      });
      sources = [];
      playheadTime = audioContext?.currentTime || 0;
    },
    close() {
      this.interrupt();
      audioContext?.close();
      audioContext = null;
    },
  };
};

export const createDebugInteractionId = () =>
  `debug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const summarizeDebugPayload = (value, maxLength = 600) => {
  if (value == null) {
    return '';
  }

  try {
    return JSON.stringify(value).slice(0, maxLength);
  } catch {
    return String(value).slice(0, maxLength);
  }
};

export const classifyToolDebugStatus = (response = {}) => {
  if (response?.ok === false) {
    return {
      status: 'failed',
      ok: false,
      reason: response.reason || 'tool_failed',
    };
  }

  if (response?.nextAction) {
    return {
      status: 'waiting_follow_up',
      ok: true,
      reason: response.nextAction,
    };
  }

  if (response?.backgroundStatus) {
    const backgroundState =
      response.backgroundStatus?.artifacts?.agentResponse?.result?.status ||
      response.backgroundStatus?.artifacts?.status ||
      response.backgroundStatus?.status ||
      '';
    if (['running', 'starting', 'queued'].includes(String(backgroundState).toLowerCase())) {
      return {
        status: 'running',
        ok: true,
        reason: `background=${backgroundState}`,
      };
    }
  }

  if (response?.task?.status && ['queued', 'running', 'waiting'].includes(String(response.task.status).toLowerCase())) {
    return {
      status: response.task.status,
      ok: true,
      reason: response.policyDecision?.reason || 'task_not_finished_yet',
    };
  }

  if (Array.isArray(response?.startedTaskIds) && response.startedTaskIds.length > 0 && !response?.playgroundRun) {
    return {
      status: 'running',
      ok: true,
      reason: `started=${response.startedTaskIds.join(',')}`,
    };
  }

  return {
    status: 'done',
    ok: true,
    reason: response?.reason || '',
  };
};

export const appendTrustedUtterance = (currentUtterance, text) => {
  const normalizedText = String(text || '').trim();
  if (!normalizedText) {
    return currentUtterance;
  }

  const now = Date.now();
  const previousText =
    currentUtterance && now - Number(currentUtterance.timestamp || 0) <= TRUSTED_UTTERANCE_WINDOW_MS
      ? String(currentUtterance.text || '').trim()
      : '';

  return {
    text: previousText ? `${previousText} ${normalizedText}` : normalizedText,
    timestamp: now,
  };
};

export const startMicrophoneStreaming = (voiceStream, onChunk) => {
  const audioTracks = voiceStream.getAudioTracks();

  if (audioTracks.length === 0) {
    return () => {};
  }

  const audioContext = new AudioContext({ latencyHint: 'interactive' });
  let source, processor, mutedOutput;

  try {
    source = audioContext.createMediaStreamSource(new MediaStream(audioTracks));
    processor = audioContext.createScriptProcessor(4096, 1, 1);
    mutedOutput = audioContext.createGain();

    mutedOutput.gain.value = 0;
    processor.onaudioprocess = (event) => {
      const channel = event.inputBuffer.getChannelData(0);
      onChunk(encodePcm16Base64(channel, audioContext.sampleRate), calculateRms(channel));
    };

    source.connect(processor);
    processor.connect(mutedOutput);
    mutedOutput.connect(audioContext.destination);
  } catch (err) {
    audioContext.close();
    throw err;
  }

  return () => {
    processor.disconnect();
    mutedOutput.disconnect();
    source.disconnect();
    audioContext.close();
  };
};
