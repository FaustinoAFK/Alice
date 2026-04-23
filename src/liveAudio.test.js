import { describe, expect, it } from 'vitest';
import { calculateRms, decodePcm16Base64, encodePcm16Base64, resampleFloat32 } from './liveAudio';

describe('resampleFloat32', () => {
  it('keeps samples unchanged when the sample rate already matches', () => {
    const samples = new Float32Array([0, 0.5, -0.5]);

    expect(resampleFloat32(samples, 16000, 16000)).toEqual(samples);
  });
});

describe('encodePcm16Base64', () => {
  it('encodes float audio samples as little-endian PCM16 base64', () => {
    const encoded = encodePcm16Base64(new Float32Array([0, 1, -1]), 16000);

    expect(encoded).toBe('AAD/fwCA');
  });
});

describe('calculateRms', () => {
  it('returns the root mean square of audio samples', () => {
    expect(calculateRms(new Float32Array([0, 0.5, -0.5]))).toBeCloseTo(0.408, 3);
  });
});

describe('decodePcm16Base64', () => {
  it('decodes base64 PCM16 audio into float samples', () => {
    const decoded = decodePcm16Base64('AAD/fwCA');

    expect(Array.from(decoded)).toEqual([0, 32767 / 32768, -1]);
  });
});
