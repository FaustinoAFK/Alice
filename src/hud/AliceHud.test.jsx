import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AliceHud } from './AliceHud';

const buildProps = (overrides = {}) => ({
  caption: '',
  diagnostics: {},
  error: '',
  inputCaption: '',
  isBusy: false,
  isLive: false,
  onNavigate: vi.fn(),
  onToggleLiveSession: vi.fn(),
  onToggleSidebar: vi.fn(),
  sessionNotice: '',
  sidebarCollapsed: false,
  status: 'idle',
  statusLabel: 'Pronta',
  ...overrides,
});

describe('AliceHud essential mode', () => {
  it('renders only the live conversation and screen-vision surface', () => {
    const html = renderToString(<AliceHud {...buildProps()} />);

    expect(html).toContain('Alice Live');
    expect(html).toContain('Voz e tela ao vivo');
    expect(html).toContain('Ao vivo');
    expect(html).not.toContain('Conhecimento');
    expect(html).not.toContain('Mapa');
    expect(html).not.toContain('Autonomia');
    expect(html).not.toContain('Runner');
  });
});
