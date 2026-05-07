import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ALICE_LIVE_TOOL_DOMAINS,
  flattenAliceLiveToolDomainNames,
} from './aliceLiveToolDomains';
import { ALICE_LIVE_TOOLS } from './aliceLiveTools';

const contractPath = fileURLToPath(
  new URL('./__fixtures__/aliceLiveTools.contract.json', import.meta.url),
);

const loadContractDeclarations = () =>
  JSON.parse(readFileSync(contractPath, 'utf8'));

const serializeToolDeclarations = (functionDeclarations) =>
  JSON.stringify(functionDeclarations, null, 2);

const getFunctionDeclarations = () => ALICE_LIVE_TOOLS[0]?.functionDeclarations || [];

describe('ALICE_LIVE_TOOLS contract', () => {
  it('keeps the expected top-level shape', () => {
    expect(Array.isArray(ALICE_LIVE_TOOLS)).toBe(true);
    expect(ALICE_LIVE_TOOLS).toHaveLength(1);
    expect(ALICE_LIVE_TOOLS[0]).toHaveProperty('functionDeclarations');
    expect(Array.isArray(ALICE_LIVE_TOOLS[0].functionDeclarations)).toBe(true);
    expect(ALICE_LIVE_TOOLS[0].functionDeclarations.length).toBeGreaterThan(0);
  });

  it('keeps required declaration fields on every tool', () => {
    getFunctionDeclarations().forEach((tool) => {
      expect(typeof tool.name).toBe('string');
      expect(tool.name.trim().length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe('string');
      expect(tool.description.trim().length).toBeGreaterThan(0);
      expect(tool.parameters).toEqual(expect.any(Object));
    });
  });

  it('keeps tool names unique and aligned with domain order', () => {
    const names = getFunctionDeclarations().map((tool) => tool.name);
    const domainNames = flattenAliceLiveToolDomainNames();

    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(domainNames);
  });

  it('keeps every tool assigned to exactly one domain', () => {
    const names = getFunctionDeclarations().map((tool) => tool.name);
    const officialNameSet = new Set(names);
    const seenDomainTools = new Map();

    ALICE_LIVE_TOOL_DOMAINS.forEach((domain) => {
      domain.toolNames.forEach((toolName) => {
        expect(officialNameSet.has(toolName)).toBe(true);
        seenDomainTools.set(toolName, (seenDomainTools.get(toolName) || 0) + 1);
      });
    });

    names.forEach((toolName) => {
      expect(seenDomainTools.get(toolName)).toBe(1);
    });
    expect([...seenDomainTools.keys()]).toEqual(names);
  });

  it('matches the stable fixture for complete function declarations', () => {
    const contractDeclarations = loadContractDeclarations();

    expect(serializeToolDeclarations(getFunctionDeclarations())).toBe(
      serializeToolDeclarations(contractDeclarations),
    );
  });
});
