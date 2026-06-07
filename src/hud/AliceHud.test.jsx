import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AliceHud } from './AliceHud';
import { createStarterMindMap } from './mindMap/utils/mindMapData';

const buildProps = (overrides = {}) => ({
  activeHudPage: 'mind-map',
  activeMindMap: createStarterMindMap(),
  caption: '',
  debugHud: {},
  diagnostics: {},
  error: '',
  inputCaption: '',
  isBusy: false,
  isLive: false,
  mindMapRevision: 0,
  onMindMapChange: vi.fn(),
  onNavigate: vi.fn(),
  onToggleLiveSession: vi.fn(),
  onToggleSidebar: vi.fn(),
  sessionNotice: '',
  sidebarCollapsed: false,
  status: 'idle',
  statusLabel: 'Pronta',
  ...overrides,
});

describe('AliceHud lazy loading', () => {
  it('all lazy HUD pages expose a default component export', async () => {
    const modules = await Promise.all([
      import('./pages/KnowledgeHudPage'),
      import('./pages/MindMapHudPage'),
      import('./pages/DebugHudPage'),
    ]);

    modules.forEach((module) => {
      expect(typeof module.default).toBe('function');
    });
  });

  it('renders the knowledge tab with a suspense fallback instead of loading the page eagerly', () => {
    const html = renderToString(<AliceHud {...buildProps({ activeHudPage: 'knowledge' })} />);

    expect(html).toContain('Carregando conhecimento');
  });

  it('renders the mind map tab with a suspense fallback instead of breaking navigation', () => {
    const html = renderToString(<AliceHud {...buildProps()} />);

    expect(html).toContain('Carregando mapa mental');
  });

  it('does not render removed autonomy, learning or runner pages', () => {
    const html = renderToString(<AliceHud {...buildProps({ activeHudPage: 'runner' })} />);

    expect(html).not.toContain('Carregando runner autonomo');
    expect(html).not.toContain('Carregando aprendizado autonomo');
    expect(html).not.toContain('Carregando autonomia');
  });
});
