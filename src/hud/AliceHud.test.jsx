import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AliceHud } from './AliceHud';
import { createStarterMindMap } from './mindMap/utils/mindMapData';

const buildProps = (overrides = {}) => ({
  activeHudPage: 'mind-map',
  activeMindMap: createStarterMindMap(),
  autonomousLearningState: {},
  autonomousRunnerState: {
    enabled: false,
    runnerState: 'idle',
    queue: [],
    tasksById: {},
    audits: [],
    evidenceRefs: [],
  },
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
  onRunnerAction: vi.fn(),
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

  it('renders the runner audit tab controls', () => {
    const html = renderToString(<AliceHud {...buildProps({ activeHudPage: 'runner', debugHud: { runner: {} } })} />);

    expect(html).toContain('Autonomous Task Runner');
    expect(html).toContain('Ligar autonomia');
  });
});
