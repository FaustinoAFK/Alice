import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AliceHud } from './AliceHud';
import { createStarterMindMap } from './mindMap/utils/mindMapData';

const buildProps = (overrides = {}) => ({
  activeHudPage: 'mind-map',
  activeMindMap: createStarterMindMap(),
  autonomousLearningState: {},
  caption: '',
  debugHud: {},
  diagnostics: {},
  error: '',
  inputCaption: '',
  isBusy: false,
  isLive: false,
  mindMapRevision: 0,
  onApproveProposal: vi.fn(),
  onMindMapChange: vi.fn(),
  onNavigate: vi.fn(),
  onRejectProposal: vi.fn(),
  onToggleLiveSession: vi.fn(),
  onToggleSidebar: vi.fn(),
  sessionNotice: '',
  sidebarCollapsed: false,
  status: 'idle',
  statusLabel: 'Pronta',
  ...overrides,
});

describe('AliceHud mind map lazy loading', () => {
  it('renders the mind map tab with a suspense fallback instead of breaking navigation', () => {
    const html = renderToString(<AliceHud {...buildProps()} />);

    expect(html).toContain('Carregando mapa mental');
  });
});
