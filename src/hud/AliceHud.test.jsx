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

describe('AliceHud lazy loading', () => {
  it('renders the knowledge tab with a suspense fallback instead of loading the page eagerly', () => {
    const html = renderToString(<AliceHud {...buildProps({ activeHudPage: 'knowledge' })} />);

    expect(html).toContain('Carregando conhecimento');
  });

  it('renders the mind map tab with a suspense fallback instead of breaking navigation', () => {
    const html = renderToString(<AliceHud {...buildProps()} />);

    expect(html).toContain('Carregando mapa mental');
  });

  it('renders the learning tab with a suspense fallback instead of eagerly loading the page', () => {
    const html = renderToString(<AliceHud {...buildProps({ activeHudPage: 'learning' })} />);

    expect(html).toContain('Carregando aprendizado autonomo');
  });

  it('renders the runner tab with a suspense fallback instead of loading the audit page eagerly', () => {
    const html = renderToString(<AliceHud {...buildProps({ activeHudPage: 'runner', debugHud: { runner: {} } })} />);

    expect(html).toContain('Carregando runner autonomo');
  });
});
