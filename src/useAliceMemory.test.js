import { describe, expect, it } from 'vitest';
import { useAliceMemory } from './useAliceMemory';

// Behavioral tests that invoke the hook directly require a React rendering
// environment (renderHook from @testing-library/react). The tests below cover
// what can be verified without it: module shape and exported contract.
describe('useAliceMemory', () => {
  it('exports a function named useAliceMemory', () => {
    expect(typeof useAliceMemory).toBe('function');
    expect(useAliceMemory.name).toBe('useAliceMemory');
  });
});
