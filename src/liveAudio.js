const PCM_MIN = -32768;
const PCM_MAX = 32767;

export const resampleFloat32 = (samples, inputRate, targetRate) => {
  if (inputRate === targetRate) {
    return samples;
  }

  const ratio = inputRate / targetRate;
  const outputLength = Math.max(1, Math.floor(samples.length / ratio));
  const output = new Float32Array(outputLength);

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const inputIndex = Math.min(samples.length - 1, Math.round(outputIndex * ratio));
    output[outputIndex] = samples[inputIndex];
  }

  return output;
};

export const bytesToBase64 = (bytes) => {
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

export const base64ToBytes = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

export const calculateRms = (samples) => {
  if (samples.length === 0) {
    return 0;
  }

  const squareSum = samples.reduce((total, sample) => total + sample * sample, 0);
  return Math.sqrt(squareSum / samples.length);
};

export const float32ToPcm16Bytes = (samples) => {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);

  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    const pcm = clamped < 0 ? clamped * -PCM_MIN : clamped * PCM_MAX;
    view.setInt16(index * 2, Math.round(pcm), true);
  });

  return bytes;
};

export const encodePcm16Base64 = (samples, inputRate, targetRate = 16000) => {
  const resampled = resampleFloat32(samples, inputRate, targetRate);
  return bytesToBase64(float32ToPcm16Bytes(resampled));
};

export const decodePcm16Base64 = (base64) => {
  const bytes = base64ToBytes(base64);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const samples = new Float32Array(bytes.length / 2);

  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 32768;
  }

  return samples;
};
