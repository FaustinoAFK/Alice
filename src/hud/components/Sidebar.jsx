import { HUD_PAGES } from '../hudViewModel';
import { HudIcon } from './HudIcon';

export function Sidebar({
  activeHudPage,
  isLive,
  onNavigate,
  onToggleSidebar,
  sidebarCollapsed,
  statusLabel,
}) {
  return (
    <aside className={`hud-sidebar ${sidebarCollapsed ? 'hud-sidebar--collapsed' : ''}`}>
      <div className="sidebar-head">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">A</span>
          <div className="brand-copy">
            <strong>Alice HUD</strong>
            <small>Painel do operador</small>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <span aria-hidden="true">{sidebarCollapsed ? '>' : '<'}</span>
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Paginas do HUD">
        {HUD_PAGES.map((page) => (
          <button
            key={page.id}
            type="button"
            className={`sidebar-link ${activeHudPage === page.id ? 'sidebar-link--active' : ''}`}
            onClick={() => onNavigate(page.id)}
            aria-current={activeHudPage === page.id ? 'page' : undefined}
            title={page.label}
          >
            <span className="sidebar-link__icon" aria-hidden="true">
              <HudIcon type={page.icon} />
            </span>
            <span className="sidebar-link__copy">
              <strong>{page.label}</strong>
              <small>{page.subtitle}</small>
            </span>
          </button>
        ))}
      </nav>

      <section className="sidebar-card" aria-label="Resumo do runtime">
        <span>Status</span>
        <strong>{statusLabel}</strong>
        <small>{isLive ? 'Sessao live ativa ou em preparo.' : 'Sessao live parada.'}</small>
      </section>
    </aside>
  );
}
